// JWT 解码的类型与常量。与纯逻辑放一起便于单测引用。
// 高亮 token 的类型是全站共用的（$lib/utils/json），这里引用一份给 DecodedPart 用
import type { JsonToken } from '$lib/utils/json';

export type { JsonToken };

/** 解出来的一段（header / payload）：原始解码 JSON + 高亮分词 + 解析后的对象 */
export interface DecodedPart {
	/** 美化后的 JSON 文本 */
	json: string;
	tokens: JsonToken[];
	data: Record<string, unknown>;
}

/** 解码结果。error 非空时三段内容都为 null / 空 */
export interface JwtResult {
	header: DecodedPart | null;
	payload: DecodedPart | null;
	/** 签名段原文（base64url），未提供时为空串 */
	signature: string;
	error: string;
}

/** 注册声明（RFC 7519）的中文说明，payload 面板下方的声明表按它渲染 */
export interface ClaimInfo {
	key: string;
	label: string;
	/** 这一列的值要不要按 Unix 秒的时间戳格式化 */
	time: boolean;
}

export const CLAIMS: ReadonlyArray<ClaimInfo> = [
	{ key: 'iss', label: '签发方 iss', time: false },
	{ key: 'sub', label: '主题 sub', time: false },
	{ key: 'aud', label: '接收方 aud', time: false },
	{ key: 'exp', label: '过期时间 exp', time: true },
	{ key: 'nbf', label: '生效时间 nbf', time: true },
	{ key: 'iat', label: '签发时间 iat', time: true },
	{ key: 'jti', label: '唯一标识 jti', time: false }
];

/** 首屏示例：一段三段齐全的 JWT（HS256，payload 带时间戳与数组，签名为 RFC 7515 示例值） */
export const EXAMPLE_TOKEN =
	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IuaXoOaDhSIsImFkbWluIjp0cnVlLCJpYXQiOjE3NTcwMDAwMDAsImV4cCI6MTc5MzAwMDAwMCwic2NvcGUiOlsicmVhZCIsIndyaXRlIl19.dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
