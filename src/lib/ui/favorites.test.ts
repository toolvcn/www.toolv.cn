// 收藏的解析与切换（纯函数，不碰 DOM）—— 存储层里唯一值得测的部分。
// 坏的、旧的、手改过的存储值都要能安全降级，所以重点是宽容解析的边界。
import { describe, expect, it } from 'vitest';
import { parseStoredFavorites, toggleFavorite } from './favorites.svelte.ts';

describe('parseStoredFavorites', () => {
	it('正常列表原样还原，顺序不变', () => {
		expect(parseStoredFavorites('["/http","/regex","/clock"]')).toEqual(['/http', '/regex', '/clock']);
	});

	it('空值与坏 JSON 一律当作没收藏过', () => {
		expect(parseStoredFavorites(null)).toEqual([]);
		expect(parseStoredFavorites('')).toEqual([]);
		expect(parseStoredFavorites('{')).toEqual([]);
		expect(parseStoredFavorites('[1,2]')).toEqual([]);
	});

	it('不是数组的值也不当收藏列表', () => {
		expect(parseStoredFavorites('"/http"')).toEqual([]);
		expect(parseStoredFavorites('{"path":"/http"}')).toEqual([]);
		expect(parseStoredFavorites('null')).toEqual([]);
	});

	it('混进非字符串与空串时只留合法项', () => {
		expect(parseStoredFavorites('["/http",1,null,"/regex",true,"",{}]')).toEqual(['/http', '/regex']);
	});

	it('重复项只留第一次出现的位置', () => {
		expect(parseStoredFavorites('["/regex","/http","/regex"]')).toEqual(['/regex', '/http']);
	});
});

describe('toggleFavorite', () => {
	it('没收藏过就追加到末尾', () => {
		expect(toggleFavorite([], '/http')).toEqual(['/http']);
		expect(toggleFavorite(['/http'], '/regex')).toEqual(['/http', '/regex']);
	});

	it('已收藏就移除，其余项顺序不变', () => {
		expect(toggleFavorite(['/http', '/regex', '/clock'], '/regex')).toEqual(['/http', '/clock']);
	});

	it('不改原数组，返回的是新数组', () => {
		const original = ['/http'];
		const next = toggleFavorite(original, '/regex');
		expect(original).toEqual(['/http']);
		expect(next).not.toBe(original);
	});
});
