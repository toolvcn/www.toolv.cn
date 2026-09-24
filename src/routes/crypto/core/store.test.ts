// 编排层的单测：状态流转、「结果是否过时」的判定、失败与实时的分支。
// 直接 new 各个子状态类（导出就是给这里用的），不必把三十多个字段逐个重置。
// 跑在 vitest 的 server project（node 环境，自带 WebCrypto）。
import { describe, expect, it } from 'vitest';
import { AesState, CaesarState, HmacState, RsaState, VigenereState } from './store.svelte.ts';

const KEY_128 = '2b7e151628aed2a6abf7158809cf4f3c';
const IV_16 = '000102030405060708090a0b0c0d0e0f';

/** 填齐一套能跑通的 AES 参数（hex 密钥 + hex IV + hex 输出） */
function readyAes(): AesState {
	const aes = new AesState();
	aes.direction = 'encrypt';
	aes.mode = 'CBC';
	aes.keyText = KEY_128;
	aes.keyFormat = 'hex';
	aes.ivText = IV_16;
	aes.ivFormat = 'hex';
	aes.dataFormat = 'hex';
	return aes;
}

describe('AesState：执行与「过时」判定', () => {
	it('填齐参数后执行出结果，状态条报出档位与模式', async () => {
		const aes = readyAes();
		aes.input = 'hello';
		expect(aes.statusTone).toBe('neutral');

		await aes.run();
		expect(aes.output).not.toBe('');
		expect(aes.stale).toBe(false);
		expect(aes.statusTone).toBe('ok');
		expect(aes.statusText).toContain('AES-128');
		expect(aes.statusText).toContain('CBC');
	});

	it('参数改动后结果被判过时（转 warn 提醒重算），重算后恢复', async () => {
		const aes = readyAes();
		aes.input = 'hello';
		await aes.run();

		aes.keyText = '00112233445566778899aabbccddeeff';
		expect(aes.stale).toBe(true);
		expect(aes.statusTone).toBe('warn');
		expect(aes.statusText).toContain('重新点一次');

		await aes.run();
		expect(aes.stale).toBe(false);
		expect(aes.statusTone).toBe('ok');
	});

	it('失败时清掉旧结果，只留一句中文错误', async () => {
		const aes = readyAes();
		aes.input = 'hello';
		await aes.run();

		aes.ivText = 'ff'; // IV 长度不对
		await aes.run();
		expect(aes.output).toBe('');
		expect(aes.statusTone).toBe('error');
		expect(aes.statusText).toContain('CBC 的 IV 是 16 字节');
	});

	it('loadExample 把方向 / 模式 / 格式都摆好，并清掉旧结果', async () => {
		const aes = readyAes();
		aes.direction = 'decrypt';
		aes.mode = 'GCM';
		aes.input = 'x';
		await aes.run();

		aes.loadExample();
		expect(aes.direction).toBe('encrypt');
		expect(aes.mode).toBe('CBC');
		expect(aes.keyFormat).toBe('hex');
		expect(aes.output).toBe('');
		expect(aes.keyBytes).toBe(32);
	});

	it('随机密钥 / 随机 IV 顺手把格式切到 Hex，长度按档位与模式给', () => {
		const aes = new AesState();
		aes.keyFormat = 'text';
		aes.randomKey(16);
		expect(aes.keyFormat).toBe('hex');
		expect(aes.keyBytes).toBe(16);

		aes.ivFormat = 'base64';
		aes.mode = 'GCM';
		aes.randomIv();
		expect(aes.ivFormat).toBe('hex');
		expect(aes.ivText).toHaveLength(24); // 12 字节 → 24 个十六进制字符
	});
});

describe('RsaState：生成密钥对与四种操作', () => {
	it('生成后私钥 / 公钥就位；再生成一次会把旧结果清掉', async () => {
		const rsa = new RsaState();
		rsa.setModulus('2048');
		await rsa.generate();
		expect(rsa.generating).toBe(false);
		expect(rsa.modulusLength).toBe(2048);
		expect(rsa.privateKey.startsWith('-----BEGIN PRIVATE KEY-----')).toBe(true);
		expect(rsa.publicKey.startsWith('-----BEGIN PUBLIC KEY-----')).toBe(true);

		rsa.input = 'hi';
		await rsa.run();
		expect(rsa.output).not.toBe('');

		await rsa.generate();
		expect(rsa.output).toBe('');
		expect(rsa.stale).toBe(false);
	});

	it('签名有效 / 无效直接决定状态条的语义色', async () => {
		const rsa = new RsaState();
		await rsa.generate();

		rsa.setOperation('sign');
		rsa.input = 'abc';
		await rsa.run();
		const signature = rsa.output;
		expect(signature).not.toBe('');

		rsa.setOperation('verify');
		rsa.signature = signature;
		await rsa.run();
		expect(rsa.statusTone).toBe('ok');
		expect(rsa.statusText).toContain('签名有效');

		rsa.input = 'abcd'; // 原文改了，签名自然对不上
		await rsa.run();
		expect(rsa.statusTone).toBe('error');
		expect(rsa.statusText).toContain('签名无效');
	});
});

describe('HmacState：实时重算', () => {
	it('默认示例直接算出 32 字节摘要（64 个十六进制字符）', async () => {
		const hmac = new HmacState();
		await hmac.refresh();
		expect(hmac.output).toHaveLength(64);
		expect(hmac.statusTone).toBe('ok');
		expect(hmac.statusText).toContain('SHA-256');
	});

	it('消息或密钥为空时只清空结果，不报错', async () => {
		const hmac = new HmacState();
		await hmac.refresh();

		hmac.message = '';
		await hmac.refresh();
		expect(hmac.output).toBe('');
		expect(hmac.error).toBe('');
		expect(hmac.statusTone).toBe('neutral');
	});

	it('Hex / Base64 两种输出都能出，状态条跟着写清楚', async () => {
		const hmac = new HmacState();
		hmac.setOutputFormat('base64');
		await hmac.refresh();
		expect(hmac.output).toHaveLength(44);
		expect(hmac.statusText).toContain('Base64');
	});
});

describe('古典密码：派生结果与状态条', () => {
	it('凯撒默认 shift 3；改成 13 就是 ROT13（对照表跟着走）', () => {
		const caesar = new CaesarState();
		expect(caesar.output).toBe('Khoor, Zruog!');
		expect(caesar.statusTone).toBe('ok');

		caesar.setShift(13);
		expect(caesar.output).toBe('Uryyb, Jbeyq!');
		expect(caesar.table[0]).toEqual({ from: 'A', to: 'N' });
	});

	it('维吉尼亚：默认示例、密钥预览与方向切换', () => {
		const vigenere = new VigenereState();
		expect(vigenere.output).toBe('LXFOPV EF RNHR');
		expect(vigenere.flow).toBe('LEMONL EM ONLE');

		// 换方向只是把运算反过来，不会把输出搬回输入框（搬回是摩斯工具「互换」按钮的事）
		vigenere.setDirection('decrypt');
		vigenere.input = 'LXFOPV EF RNHR';
		expect(vigenere.output).toBe('ATTACK AT DAWN');
	});

	it('维吉尼亚密钥清空后给错误文案，不是抛异常', () => {
		const vigenere = new VigenereState();
		vigenere.key = '';
		expect(vigenere.output).toBe('');
		expect(vigenere.statusTone).toBe('error');
		expect(vigenere.statusText).toContain('至少要有一个字母');
	});
});
