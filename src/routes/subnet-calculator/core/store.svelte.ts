// 子网计算器的编排层：一个输入 + 一个「切到哪个前缀」的选择，其余全是派生。模块级单例。
//
// 输入不合法时不抛异常、也不保留上一次的结果 —— 两个面板一起回到空态，错误只出现在状态条与输入框描边里。
// 这样用户改一位数字就能看到结果回来，不会出现「结果还在、但它已经不是当前输入算的」。
import { copyToClipboard } from '$lib/ui/copy';
import type { StatusTone } from '$lib/ui/styles';
import { toast } from '$lib/ui/toast.svelte';
import {
	CIDR_EXAMPLES,
	DEFAULT_INPUT,
	DEFAULT_PREFIX,
	describeSubnet,
	parseCidr,
	splitSubnets,
	splitTargets,
	type SubnetRow
} from './subnet.ts';

class SubnetStore {
	input = $state(DEFAULT_INPUT);
	/** 用户选的目标前缀；null 表示用「原前缀 + 2」的默认档 */
	chosenTarget = $state<number | null>(null);

	readonly parsed = $derived(parseCidr(this.input));
	readonly error = $derived(this.parsed.ok ? '' : this.parsed.error);
	readonly info = $derived(this.parsed.ok ? describeSubnet(this.parsed.value.ip, this.parsed.value.prefix) : null);
	/** 输入里没写掩码、按默认前缀算的 */
	readonly assumed = $derived(this.parsed.ok && this.parsed.value.assumed);

	readonly targets = $derived(this.info === null ? [] : splitTargets(this.info.prefix));

	/** 当前生效的目标前缀：选的那个还合法就用它，否则退回「原前缀 + 2」（不够就 +1） */
	readonly target = $derived(this.#effectiveTarget());

	readonly split = $derived.by((): { rows: readonly SubnetRow[]; error: string } => {
		const info = this.info;
		const target = this.target;
		if (info === null || target === null) return { rows: [], error: '' };
		const result = splitSubnets(info.ip, info.prefix, target);
		return result.ok ? { rows: result.value, error: '' } : { rows: [], error: result.error };
	});

	#effectiveTarget(): number | null {
		const info = this.info;
		if (info === null || info.prefix >= 32) return null;
		const chosen = this.chosenTarget;
		if (chosen !== null && chosen > info.prefix && chosen <= 32) return chosen;
		const auto = info.prefix + 2;
		return auto <= 32 ? auto : info.prefix + 1;
	}

	// ---------------------------------------------------------------- 状态条文案

	get infoTone(): StatusTone {
		if (this.error !== '') return 'error';
		if (this.info !== null && this.info.note !== '') return 'warn';
		return this.info === null ? 'neutral' : 'ok';
	}

	get infoText(): string {
		if (this.error !== '') return this.error;
		const info = this.info;
		if (info === null) return '等待输入';
		const head = this.assumed ? `没写掩码，按 /${DEFAULT_PREFIX} 算 · ` : '';
		const note = info.note === '' ? '' : `${info.note} · `;
		return `${head}${note}${info.scope} · ${info.ipClass} · 可用 ${info.usable} 个地址`;
	}

	get splitTone(): StatusTone {
		if (this.error !== '' || this.split.error !== '') return 'error';
		return this.split.rows.length === 0 ? 'neutral' : 'ok';
	}

	get splitText(): string {
		if (this.error !== '') return this.error;
		if (this.split.error !== '') return this.split.error;
		const info = this.info;
		if (info === null) return '等待输入';
		const target = this.target;
		if (target === null) return `/${info.prefix} 没法再往下切：已经是单个主机地址`;
		const rows = this.split.rows;
		if (rows.length === 0) return '这个前缀没有可切的下级网段';
		return `切成 ${rows.length} 个 /${target}，每段 ${rows[0]?.usable ?? 0} 个可用地址`;
	}

	// ---------------------------------------------------------------- 操作

	setTarget(value: string): void {
		this.chosenTarget = Number(value);
	}

	loadExample(id: string): void {
		const example = CIDR_EXAMPLES.find((item) => item.id === id);
		if (!example) return;
		this.input = example.value;
		this.chosenTarget = null;
		toast.show(`已填入示例：${example.label}`);
	}

	clearInput(): void {
		this.input = '';
		this.chosenTarget = null;
	}

	async copyValue(text: string, label: string): Promise<void> {
		await copyToClipboard(text, { ok: `已复制${label}`, fail: '复制失败，请手动选中复制' });
	}
}

export const subnetStore = new SubnetStore();
