// 统一的「成功 / 失败」结果类型：失败时带一句**能直接展示给用户**的中文说明。
//
// 从 /crypto 的 core/types.ts 提上来的（第二个用它的工具是 /subnet-calculator）——
// 两侧的口径完全一致：谁失败谁负责写清楚原因，不靠调用方翻译错误码。
// 只做类型与两个构造函数，不碰 DOM、不认识任何业务，所以 node 环境能直接单测。
//
// 顺带说明为什么不用抛异常：这里的失败大多是**用户输入不合法**（IP 少写一段、掩码不连续、
// 密钥长度不对），属于正常流程的一部分，不是意外。返回值让调用方必须处理，
// 异常容易被 catch 掉或在异步边界上丢掉。

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export function ok<T>(value: T): Result<T> {
	return { ok: true, value };
}

export function fail<T>(error: string): Result<T> {
	return { ok: false, error };
}
