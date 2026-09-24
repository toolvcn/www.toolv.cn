// JWT 解码的编排层：单输入框，解码结果与声明表实时派生，模块级单例。
// 验签是异步的，结果自带一份「当时用的 token 与密钥」快照，输入改了只提示重验、不自动清。
import { claimRows, decodeJwt } from './jwt.ts';
import { EXAMPLE_TOKEN, type JwtResult } from './types.ts';
import {
	algFamily,
	describeVerify,
	splitToken,
	verifyToken,
	type VerifyFamily,
	type VerifySnapshot,
	type VerifyTone
} from './verify.ts';
import { toast } from '$lib/ui/toast.svelte';
import { copyToClipboard } from '$lib/ui/copy';

/** 声明表的一行，供 UI 直接渲染 */
export interface ClaimRowView {
	key: string;
	label: string;
	value: string;
	/** 仅 exp 有三态：true 已过期 / false 有效中 / null 不是过期类声明 */
	expired: boolean | null;
}

class JwtStore {
	token = $state(EXAMPLE_TOKEN);

	/**
	 * 当前时间。SSR / 预渲染阶段为 0（不渲染相对状态，避免构建机时区烘进 HTML），
	 * hydration 后由页面效果写入真实时间，声明表随后带出「有效中 / 已过期」。
	 */
	now = $state(0);

	readonly result = $derived<JwtResult>(decodeJwt(this.token));

	get error(): string {
		return this.result.error;
	}

	get isEmpty(): boolean {
		return this.token.trim() === '';
	}

	get tokenCount(): number {
		return this.token.length;
	}

	/** header 的 alg 字段，给面板标题旁的小标签用 */
	get algorithm(): string {
		const alg = this.result.header?.data.alg;
		return typeof alg === 'string' && alg !== '' ? alg : '';
	}

	/** 注册声明表：依赖 now（客户端才有），SSR 阶段给空数组 */
	readonly claims = $derived<ClaimRowView[]>(
		this.now !== 0 && this.result.payload ? claimRows(this.result.payload.data, this.now) : []
	);

	// ---------------------------------------------------------------- 验签

	/** HS 的共享密钥 / RS 的公钥 PEM。只在内存里参与计算，不写 localStorage，刷新即失 */
	key = $state('');
	/** HS 档：密钥文本是 Base64，先解成字节再做 HMAC */
	base64Secret = $state(false);
	verifying = $state(false);
	/** 最近一次验签的结论；null = 还没验过 */
	verifySnapshot = $state<VerifySnapshot | null>(null);

	/** 自增序号：只认最后一次发起的验签，早先那份到了也丢（异步竞态） */
	#verifySeq = 0;

	/** 当前 alg 属于哪一族；不在六档内为 null */
	readonly verifyFamily = $derived<VerifyFamily | null>(algFamily(this.algorithm));

	/** payload 的 exp（Unix 秒）；不是数字就没有过期结论 */
	get expSeconds(): number | undefined {
		const value = this.result.payload?.data.exp;
		return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
	}

	get canVerify(): boolean {
		return !this.verifying && this.verifyFamily !== null && this.result.header !== null && this.key.trim() !== '';
	}

	/** 结果算出之后 token 或密钥又被改过 —— 不自动清，交给 UI 提示重验 */
	get verifyStale(): boolean {
		const snapshot = this.verifySnapshot;
		if (!snapshot || this.verifying) return false;
		return (
			snapshot.token !== this.token.trim() || snapshot.key !== this.key || snapshot.base64Secret !== this.base64Secret
		);
	}

	get verifyText(): string {
		return this.#describe().text;
	}

	get verifyTone(): VerifyTone {
		return this.#describe().tone;
	}

	async verify(): Promise<void> {
		const token = this.token.trim();
		const parts = splitToken(token);
		if (!this.canVerify || parts === null) {
			toast.show('请先填入密钥，并确保 token 已正常解码', true);
			return;
		}
		const key = this.key;
		const base64Secret = this.base64Secret;
		const alg = this.algorithm;
		const seq = ++this.#verifySeq;
		this.verifying = true;
		try {
			const outcome = await verifyToken({
				alg,
				signingInput: parts.signingInput,
				signature: parts.signature,
				key,
				base64Secret,
				exp: this.expSeconds,
				now: this.now
			});
			if (seq !== this.#verifySeq) return;
			this.verifySnapshot = { ...outcome, alg, token, key, base64Secret };
		} catch {
			if (seq !== this.#verifySeq) return;
			this.verifySnapshot = {
				status: 'error',
				message: '验签失败：当前环境可能不支持 WebCrypto',
				expired: null,
				alg,
				token,
				key,
				base64Secret
			};
		} finally {
			if (seq === this.#verifySeq) this.verifying = false;
		}
	}

	clearVerify(): void {
		this.#verifySeq++; // 让在途的那次作废
		this.verifying = false;
		this.verifySnapshot = null;
		this.key = '';
		this.base64Secret = false;
	}

	#describe(): { text: string; tone: VerifyTone } {
		return describeVerify({ outcome: this.verifySnapshot, verifying: this.verifying, stale: this.verifyStale });
	}

	// ---------------------------------------------------------------- 操作

	loadExample(): void {
		this.token = EXAMPLE_TOKEN;
		toast.show('已填入示例 JWT');
	}

	clearInput(): void {
		this.token = '';
	}

	async copyToken(): Promise<void> {
		await this.copy(this.token.trim(), '已复制 JWT 原文');
	}

	async copyJson(part: 'header' | 'payload'): Promise<void> {
		const json = part === 'header' ? this.result.header?.json : this.result.payload?.json;
		if (!json) {
			toast.show('没有可复制的内容，请先输入有效 JWT', true);
			return;
		}
		await this.copy(json, part === 'header' ? '已复制 Header JSON' : '已复制 Payload JSON');
	}

	async copy(text: string, successMessage: string): Promise<void> {
		await copyToClipboard(text, { ok: successMessage, fail: '复制失败，请手动选中复制' });
	}
}

export const jwtStore = new JwtStore();
