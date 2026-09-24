<script lang="ts">
	import { Lock } from '@lucide/svelte';
	import ToolShell from '$lib/components/ToolShell/ToolShell.svelte';
	import Workspace from './ui/Workspace.svelte';
</script>

<ToolShell
	icon={Lock}
	name="加解密工具箱"
	tagline="AES · RSA · HMAC · 凯撒 · 维吉尼亚"
	heading="加解密工具箱"
	description="在线加解密工具箱：AES-128 / 192 / 256（CBC / GCM / CTR，密钥与 IV 可设）、RSA 密钥生成与加解密签名验签（PKCS#8 / SPKI，与 openssl 通用）、HMAC 生成器，以及凯撒与维吉尼亚古典密码。全部走浏览器原生 WebCrypto，密钥与内容只在本地内存里，不上传、不落库。"
	keywords="AES加密,AES解密,AES在线加密工具,AES-256,GCM,CBC,CTR,RSA加密,RSA解密,RSA密钥生成,签名验签,HMAC,SHA-256,凯撒密码,维吉尼亚密码,在线加解密"
	path="/crypto"
	ogDescription="AES / RSA / HMAC 与凯撒、维吉尼亚五合一：WebCrypto 原生实现，密钥与数据不离开浏览器。"
	width="wide"
	fill="fill"
>
	<Workspace />
</ToolShell>
