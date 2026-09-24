// 响应体体积的纯函数。
// 高亮分词原先也在这个文件（tokenizeResponse），已连同另外三份副本收到 `$lib/utils/json`。

/** UTF-8 字节数（响应大小按字节显示，中文按 3 字节计） */
export function byteLength(text: string): number {
	return new TextEncoder().encode(text).length;
}
