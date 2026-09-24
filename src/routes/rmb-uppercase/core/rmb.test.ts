// 人民币大写纯函数与 store 的单测，跑在 vitest 的 server project（node 环境）。
// 期望值按《正确填写票据和结算凭证的基本规定》的常规实现口径。
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toRmbUppercase } from './rmb.ts';
import { rmbStore } from './store.svelte.ts';
import { toast } from '$lib/ui/toast.svelte';

beforeEach(() => {
	rmbStore.input = '';
	toast.message = '';
	toast.visible = false;
	toast.tone = 'neutral';
	vi.unstubAllGlobals();
});

describe('整数部分', () => {
	it('基础数字转大写', () => {
		expect(toRmbUppercase('1234567.89').output).toBe('壹佰贰拾叁万肆仟伍佰陆拾柒圆捌角玖分');
	});

	it('10 写作壹拾，不省略壹', () => {
		expect(toRmbUppercase('10').output).toBe('壹拾圆整');
		expect(toRmbUppercase('110').output).toBe('壹佰壹拾圆整');
	});

	it('中间的零合并成一个', () => {
		expect(toRmbUppercase('1002').output).toBe('壹仟零贰圆整');
		expect(toRmbUppercase('1020').output).toBe('壹仟零贰拾圆整');
		expect(toRmbUppercase('1000001').output).toBe('壹佰万零壹圆整');
	});

	it('万 / 亿在零位不丢失', () => {
		expect(toRmbUppercase('10000000').output).toBe('壹仟万圆整');
		expect(toRmbUppercase('100010000').output).toBe('壹亿零壹万圆整');
		expect(toRmbUppercase('100000000000').output).toBe('壹仟亿圆整');
	});

	it('超大数到千万亿（万亿作显式单位，整万亿数不会退化成「壹万」）', () => {
		expect(toRmbUppercase('1234567890123456').output).toBe(
			'壹仟贰佰叁拾肆万亿伍仟陆佰柒拾捌亿玖仟零壹拾贰万叁仟肆佰伍拾陆圆整'
		);
		expect(toRmbUppercase('1000000000000').output).toBe('壹万亿圆整');
	});

	it('连续大单位跨节衔接', () => {
		expect(toRmbUppercase('1234567890').output).toBe('壹拾贰亿叁仟肆佰伍拾陆万柒仟捌佰玖拾圆整');
	});
});

describe('角与分', () => {
	it('角分齐全', () => {
		expect(toRmbUppercase('0.55').output).toBe('伍角伍分');
		expect(toRmbUppercase('12.05').output).toBe('壹拾贰圆零伍分');
	});

	it('有角无分加整', () => {
		expect(toRmbUppercase('0.5').output).toBe('伍角整');
		expect(toRmbUppercase('12.3').output).toBe('壹拾贰圆叁角整');
	});

	it('整数为零时从角 / 分直接开始', () => {
		expect(toRmbUppercase('0.03').output).toBe('叁分');
		expect(toRmbUppercase('0').output).toBe('零圆整');
		expect(toRmbUppercase('0.0').output).toBe('零圆整');
	});
});

describe('输入规范化', () => {
	it('千分位逗号与空白可接受', () => {
		expect(toRmbUppercase('1,234.50').output).toBe('壹仟贰佰叁拾肆圆伍角整');
		expect(toRmbUppercase(' 1234 ').output).toBe('壹仟贰佰叁拾肆圆整');
	});

	it('前导零去掉，单个 0 保留', () => {
		expect(toRmbUppercase('007').output).toBe('柒圆整');
		expect(toRmbUppercase('0.7').output).toBe('柒角整');
	});

	it('第三位小数四舍五入到分', () => {
		expect(toRmbUppercase('1.234').output).toBe('壹圆贰角叁分');
		expect(toRmbUppercase('1.235').output).toBe('壹圆贰角肆分');
		expect(toRmbUppercase('1.2').output).toBe('壹圆贰角整');
	});

	it('进位连锁滚过小数进整数', () => {
		expect(toRmbUppercase('1.999').output).toBe('贰圆整');
		expect(toRmbUppercase('0.996').output).toBe('壹圆整');
	});

	it('负数带「负」前缀', () => {
		expect(toRmbUppercase('-12.5').output).toBe('负壹拾贰圆伍角整');
	});

	it('非法输入给中文错误，不抛异常', () => {
		expect(toRmbUppercase('abc').error).toContain('请输入有效金额');
		expect(toRmbUppercase('12.3.4').error).toContain('请输入有效金额');
		expect(toRmbUppercase('').error).toContain('请输入有效金额');
		expect(toRmbUppercase('--12').error).toContain('请输入有效金额');
	});

	it('整数超过 16 位提示超出范围', () => {
		expect(toRmbUppercase('12345678901234567').error).toContain('最多 16 位');
	});
});

describe('store', () => {
	it('输入变化后输出与错误实时跟着变', () => {
		rmbStore.input = '12.5';
		expect(rmbStore.output).toBe('壹拾贰圆伍角整');
		expect(rmbStore.error).toBe('');
		rmbStore.input = 'bad';
		expect(rmbStore.output).toBe('');
		expect(rmbStore.error).not.toBe('');
	});

	it('示例填充与清空', () => {
		rmbStore.loadExample();
		expect(rmbStore.input).not.toBe('');
		rmbStore.clearInput();
		expect(rmbStore.input).toBe('');
	});

	it('无结果复制给提示', async () => {
		rmbStore.input = 'bad';
		await rmbStore.copyOutput();
		expect(toast.message).toContain('没有可复制');
	});

	it('复制成功时写当前输出', async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		vi.stubGlobal('navigator', { clipboard: { writeText } });
		rmbStore.input = '1.5';
		await rmbStore.copyOutput();
		expect(writeText).toHaveBeenCalledWith('壹圆伍角整');
	});

	it('复制失败弹红色提示', async () => {
		vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
		rmbStore.input = '1.5';
		await rmbStore.copyOutput();
		expect(toast.tone).toBe('error');
	});
});
