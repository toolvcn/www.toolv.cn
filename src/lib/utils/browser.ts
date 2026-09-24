// 浏览器能力的薄封装：剪贴板与文件下载。
//
// 这几个都是 DOM 副作用，由 websocket 与 csv-json 等多个工具共用，故提升到 $lib。
// core/ 不碰 DOM，调用方都在 ui/ 层。

/**
 * 复制文本，优先用剪贴板 API，不可用时退回 textarea + execCommand。
 * 返回是否成功 —— 失败也要让调用方知道，不能一律弹「已复制」
 * （非安全上下文下两条路都会失败，误报成功比不报更糟）。
 */
export async function copyText(text: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		/* 非安全上下文或权限被拒，走下面的回退 */
	}
	try {
		const textarea = document.createElement('textarea');
		textarea.value = text;
		document.body.appendChild(textarea);
		textarea.select();
		const ok = document.execCommand('copy');
		textarea.remove();
		return ok;
	} catch {
		return false;
	}
}

/**
 * 读剪贴板里的文本，读不到返回 null。
 *
 * 与 copyText **不对称**：写剪贴板失败还能退回 textarea + execCommand，读没有回退路径，
 * 只能靠 `navigator.clipboard.readText()` —— 非安全上下文下 `navigator.clipboard` 本身就是
 * undefined，Safari / Firefox 还会弹一次授权、拒绝就抛。而且它必须在用户手势里调用（点按钮那一刻），
 * 所以拿不到时**不能**当成空串：空串是「剪贴板里确实没有文字」，null 是「浏览器不给读」，
 * 调用方要给两条不同的提示。
 */
export async function readText(): Promise<string | null> {
	try {
		return await navigator.clipboard.readText();
	} catch {
		return null;
	}
}

/** 把一段文本当文件下载下来（导出日志 / 下载 CSV 用） */
export function downloadText(filename: string, text: string, mime = 'text/plain;charset=utf-8'): void {
	const link = document.createElement('a');
	link.href = URL.createObjectURL(new Blob([text], { type: mime }));
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	link.remove();
	// 立即撤销会让部分浏览器取消下载，延后一拍
	setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
