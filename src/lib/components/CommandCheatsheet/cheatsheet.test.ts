// 共享编排层的参数预设单测：保存 / 应用 / 删除 / 恢复 / 导入。
// 序列化与解析本身在 $lib/utils/command-cheatsheet.test.ts 里测，这里只测「状态怎么动」。
import { describe, expect, it } from 'vitest';
import { CheatsheetStore } from './cheatsheet.svelte.ts';
import type { CheatsheetCommand, CheatsheetGroup, CheatsheetVarDef } from '$lib/utils/command-cheatsheet';

const GROUPS: CheatsheetGroup[] = [{ id: 'container', name: '容器' }];
const VAR_DEFS: CheatsheetVarDef[] = [
	{ key: 'container', label: '容器 ID / 名称', sample: 'my-nginx' },
	{ key: 'image', label: '镜像', sample: 'nginx:1.27', secondary: true }
];
const COMMANDS: CheatsheetCommand[] = [
	{
		id: 'c-exec',
		group: 'container',
		template: 'docker exec -it {{container}} /bin/bash',
		desc: '进入容器开 shell',
		keywords: ['进入容器', 'exec']
	}
];

function makeStore(): CheatsheetStore {
	return new CheatsheetStore(COMMANDS, GROUPS, VAR_DEFS);
}

describe('CheatsheetStore 参数预设', () => {
	it('名称必填：没填名称不落预设', () => {
		const store = makeStore();
		store.setVar('container', 'web');
		store.savePreset();
		expect(store.presets).toEqual([]);
	});

	it('一个变量都没填时不落预设（存下来等于示例值）', () => {
		const store = makeStore();
		store.presetName = '空的';
		store.savePreset();
		expect(store.presets).toEqual([]);
	});

	it('保存只收填了值的变量，值去首尾空白，保存后清空名称输入', () => {
		const store = makeStore();
		store.setVar('container', '  web-1  ');
		store.setVar('image', '');
		store.presetName = ' 生产 ';
		store.savePreset();

		expect(store.presets).toHaveLength(1);
		expect(store.presets[0].name).toBe('生产');
		expect(store.presets[0].vars).toEqual({ container: 'web-1' });
		expect(store.presetName).toBe('');
	});

	it('应用预设是完整快照：没存过的变量清空，回落到示例值', () => {
		const store = makeStore();
		store.setVar('container', 'web-prod');
		store.presetName = '生产';
		store.savePreset();
		const id = store.presets[0].id;

		// 改动两个变量后应用预设：只存了 container 的那条应把 image 也清掉
		store.setVar('container', 'other');
		store.setVar('image', 'redis:7');
		store.applyPreset(id);

		expect(store.vars).toEqual({ container: 'web-prod', image: '' });
		expect(store.effectiveVars.image).toBe('nginx:1.27');
	});

	it('删除按 id 移除', () => {
		const store = makeStore();
		store.setVar('container', 'web');
		store.presetName = 'a';
		store.savePreset();
		store.setVar('container', 'api');
		store.presetName = 'b';
		store.savePreset();

		store.deletePreset(store.presets[0].id);
		expect(store.presets.map((preset) => preset.name)).toEqual(['b']);
	});

	it('恢复与导入都重新分配 id，且导入是追加而非覆盖', () => {
		const store = makeStore();
		store.setVar('container', 'web');
		store.presetName = '本地';
		store.savePreset();
		const existingId = store.presets[0].id;

		store.importPresetsText('[{"name":"导入的","vars":{"image":"redis:7"}}]');
		expect(store.presets.map((preset) => preset.name)).toEqual(['本地', '导入的']);
		expect(store.presets[1].id).toBeGreaterThan(existingId);

		store.restorePresets([{ id: 99, name: '恢复的', vars: { container: 'restored' } }]);
		expect(store.presets).toHaveLength(1);
		expect(store.presets[0].id).not.toBe(99);
	});

	it('导入非法文本时列表原样不动', () => {
		const store = makeStore();
		store.importPresetsText('不是 JSON');
		expect(store.presets).toEqual([]);
	});

	it('导出文本能被解析回来（往返一致）', () => {
		const store = makeStore();
		store.setVar('container', 'web');
		store.setVar('image', 'nginx:1.27');
		store.presetName = '生产';
		store.savePreset();

		expect(JSON.parse(store.presetsText)).toEqual([{ name: '生产', vars: { container: 'web', image: 'nginx:1.27' } }]);
	});
});

describe('CheatsheetStore 已填变量', () => {
	it('留空 / 只有空白的不算「已填」，命令里因此仍按示例值上色', () => {
		const store = makeStore();
		expect(Object.keys(store.filledVars)).toEqual([]);

		store.setVar('container', '   ');
		expect(Object.keys(store.filledVars)).toEqual([]);

		store.setVar('image', 'redis:7');
		expect(Object.keys(store.filledVars)).toEqual(['image']);
	});
});
