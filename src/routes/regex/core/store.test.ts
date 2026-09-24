// 编排层的单测：只测捕获组的展开状态，正则本身的行为在 regex.test.ts。
import { beforeEach, describe, expect, it } from 'vitest';
import { EXAMPLE_INPUT, MAX_SAVED, SAVED_WITH_INPUT_DEFAULT } from '../config.ts';
import { regexStore } from './store.svelte.ts';

// 共享 store 是模块级单例，每个用例前重置，避免相互污染
beforeEach(() => {
	regexStore.pattern = '(\\d{4})-(\\d{2})';
	regexStore.flags = 'g';
	regexStore.input = '2026-09 与 2026-10';
	regexStore.expanded.clear();
	regexStore.saved = [];
	regexStore.savedName = '';
	regexStore.saveWithInput = SAVED_WITH_INPUT_DEFAULT;
});

describe('捕获组展开', () => {
	it('结果里有捕获组时才显示展开控件', () => {
		expect(regexStore.hasGroups).toBe(true);
		regexStore.pattern = '\\d{4}';
		expect(regexStore.hasGroups).toBe(false);
	});

	it('同一行点两次是展开再收起', () => {
		expect(regexStore.isExpanded(0)).toBe(false);
		regexStore.toggleMatch(0);
		expect(regexStore.isExpanded(0)).toBe(true);
		regexStore.toggleMatch(0);
		expect(regexStore.isExpanded(0)).toBe(false);
	});

	it('全部展开后 allExpanded 为真，再点一次全部收起', () => {
		expect(regexStore.allExpanded).toBe(false);
		regexStore.toggleAllMatches();
		expect(regexStore.isExpanded(0)).toBe(true);
		expect(regexStore.isExpanded(1)).toBe(true);
		expect(regexStore.allExpanded).toBe(true);
		regexStore.toggleAllMatches();
		expect(regexStore.expanded.size).toBe(0);
	});
});

describe('本地保存的表达式', () => {
	it('保存后进入列表，名称留空用表达式本体，输入框清空', () => {
		regexStore.savedName = '';
		regexStore.saveCurrent();
		expect(regexStore.saved).toHaveLength(1);
		expect(regexStore.saved[0].name).toBe('(\\d{4})-(\\d{2})');
		expect(regexStore.saved[0].flags).toBe('g');
		expect(regexStore.savedName).toBe('');
	});

	it('给了名称就用名称', () => {
		regexStore.savedName = '年月';
		regexStore.saveCurrent();
		expect(regexStore.saved[0].name).toBe('年月');
	});

	it('空正则与非法正则都不保存', () => {
		regexStore.pattern = '';
		regexStore.saveCurrent();
		expect(regexStore.saved).toHaveLength(0);

		regexStore.pattern = '(';
		regexStore.saveCurrent();
		expect(regexStore.saved).toHaveLength(0);
	});

	it('同一表达式 + 修饰符不重复保存，换修饰符算另一条', () => {
		regexStore.saveCurrent();
		regexStore.saveCurrent();
		expect(regexStore.saved).toHaveLength(1);

		regexStore.flags = 'gm';
		regexStore.saveCurrent();
		expect(regexStore.saved).toHaveLength(2);
	});

	it('存满后不再收，canSave 为假', () => {
		regexStore.restoreSaved(
			Array.from({ length: MAX_SAVED }, (_, i) => ({ name: `n${i}`, pattern: `p${i}`, flags: 'g' }))
		);
		expect(regexStore.canSave).toBe(false);
		regexStore.saveCurrent();
		expect(regexStore.saved).toHaveLength(MAX_SAVED);
	});

	it('点一条把表达式与修饰符一起填回', () => {
		regexStore.savedName = '数字';
		regexStore.saveCurrent();
		regexStore.pattern = '\\s+';
		regexStore.flags = '';

		regexStore.applySaved(regexStore.saved[0].id);
		expect(regexStore.pattern).toBe('(\\d{4})-(\\d{2})');
		expect(regexStore.flags).toBe('g');
	});

	it('勾选「同时保存测试文本」后，条目里带上文本', () => {
		regexStore.saveWithInput = true;
		regexStore.saveCurrent();
		expect(regexStore.saved[0].input).toBe('2026-09 与 2026-10');
		expect(JSON.parse(regexStore.savedText)[0].input).toBe('2026-09 与 2026-10');
	});

	it('不勾选时只存表达式三件套，没有 input', () => {
		regexStore.saveWithInput = false;
		regexStore.saveCurrent();
		expect(regexStore.saved[0].input).toBeUndefined();
		expect('input' in JSON.parse(regexStore.savedText)[0]).toBe(false);
	});

	it('勾了但测试文本为空时不写 input，免得列表标成含文本', () => {
		regexStore.input = '';
		regexStore.saveWithInput = true;
		regexStore.saveCurrent();
		expect(regexStore.saved[0].input).toBeUndefined();
	});

	it('测试文本为空 / 未编辑过（仍是首屏示例）时，直接还原条目里的文本', () => {
		regexStore.saveWithInput = true;
		regexStore.saveCurrent();

		for (const untouched of ['', EXAMPLE_INPUT]) {
			regexStore.input = untouched;
			expect(regexStore.needsTextConfirm(regexStore.saved[0].id)).toBe(false);
			regexStore.applySaved(regexStore.saved[0].id);
			expect(regexStore.input).toBe('2026-09 与 2026-10');
		}
	});

	it('已经与条目文本相同时不算「会覆盖」，也不必弹确认', () => {
		regexStore.saveWithInput = true;
		regexStore.saveCurrent();
		regexStore.input = '2026-09 与 2026-10';

		expect(regexStore.needsTextConfirm(regexStore.saved[0].id)).toBe(false);
	});

	it('测试文本被改过：不传 overwriteText 时保留当前文本，只换表达式与修饰符', () => {
		regexStore.saveWithInput = true;
		regexStore.saveCurrent();
		regexStore.input = '我正在编辑的文本';
		regexStore.pattern = '\\s+';
		regexStore.flags = '';

		expect(regexStore.needsTextConfirm(regexStore.saved[0].id)).toBe(true);
		regexStore.applySaved(regexStore.saved[0].id);
		expect(regexStore.input).toBe('我正在编辑的文本');
		expect(regexStore.pattern).toBe('(\\d{4})-(\\d{2})');
		expect(regexStore.flags).toBe('g');
	});

	it('确认覆盖（overwriteText: true）时才用条目文本替换', () => {
		regexStore.saveWithInput = true;
		regexStore.saveCurrent();
		regexStore.input = '我正在编辑的文本';

		regexStore.applySaved(regexStore.saved[0].id, { overwriteText: true });
		expect(regexStore.input).toBe('2026-09 与 2026-10');
	});

	it('没存文本的条目（含旧本地配置），点击后保持当前测试文本', () => {
		regexStore.saveWithInput = false;
		regexStore.saveCurrent();
		regexStore.restoreSaved(JSON.parse(regexStore.savedText));
		regexStore.input = '还在编辑的文本';

		regexStore.applySaved(regexStore.saved[0].id);
		expect(regexStore.input).toBe('还在编辑的文本');
	});

	it('删除只删点中的那条', () => {
		regexStore.saveCurrent();
		regexStore.flags = 'gi';
		regexStore.saveCurrent();
		const first = regexStore.saved[0].id;

		regexStore.deleteSaved(first);
		expect(regexStore.saved).toHaveLength(1);
		expect(regexStore.saved.some((item) => item.id === first)).toBe(false);
	});

	it('恢复的数据重新分配 id', () => {
		regexStore.restoreSaved([
			{ name: 'a', pattern: 'a', flags: 'g' },
			{ name: 'b', pattern: 'b', flags: '' }
		]);
		const ids = regexStore.saved.map((item) => item.id);
		expect(new Set(ids).size).toBe(2);
		expect(ids[1]).toBe(ids[0] + 1);
		expect(JSON.parse(regexStore.savedText)).toHaveLength(2);
	});
});
