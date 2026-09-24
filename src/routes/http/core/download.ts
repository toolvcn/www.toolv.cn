// 把响应存成文件时叫什么名字。纯函数，不碰 DOM（文件名要能在 node 里单测）。
//
// 从 Content-Type 猜扩展名，猜不出就 .txt；名字里带状态码是为了**同一批下载不互相覆盖**
// —— 连发几次拿到 200 / 404 / 500，都叫 response.txt 的话只留得下最后一次。
const EXTENSIONS: ReadonlyArray<{ match: RegExp; ext: string }> = [
	{ match: /json/, ext: 'json' },
	{ match: /html/, ext: 'html' },
	{ match: /xml/, ext: 'xml' },
	{ match: /csv/, ext: 'csv' },
	{ match: /javascript/, ext: 'js' },
	{ match: /css/, ext: 'css' },
	{ match: /text\/plain/, ext: 'txt' }
];

export function responseFileName(contentType: string, status: number): string {
	const normalized = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
	const ext = EXTENSIONS.find((item) => item.match.test(normalized))?.ext ?? 'txt';
	const code = Number.isFinite(status) && status > 0 ? Math.trunc(status) : 'unknown';
	return `response-${code}.${ext}`;
}

/** 从响应头里取 Content-Type（大小写不敏感；跨域场景常常只有几个头，取不到就是空串） */
export function contentTypeOf(headers: ReadonlyArray<{ name: string; value: string }>): string {
	const header = headers.find((item) => item.name.toLowerCase() === 'content-type');
	return header?.value ?? '';
}
