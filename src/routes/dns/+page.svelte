<script lang="ts">
	import { Server } from '@lucide/svelte';
	import ToolShell from '$lib/components/ToolShell/ToolShell.svelte';
	import Workspace from './ui/Workspace.svelte';
</script>

<ToolShell
	icon={Server}
	name="公共 DNS"
	tagline="地址速查 + 换 DNS 命令"
	heading="公共 DNS 服务地址速查与更换命令"
	description="国内外公共 DNS 服务器地址速查：阿里云公共 DNS、腾讯 DNSPod、114DNS、百度 DNS、360 安全 DNS、CNNIC、清华大学 TUNA，以及 Google Public DNS、Cloudflare 1.1.1.1、Quad9、OpenDNS、AdGuard DNS 等，逐家列出 IPv4 / IPv6 / DoH / DoT 地址并附官方配置说明页；右侧直接给出 Windows / macOS / Linux 更换 DNS 的命令（含查看接口名与还原命令），逐条一键复制；另附为什么要换 DNS 的好处与代价。只做查阅，不解析、不测速，全程不联网。"
	keywords="公共DNS,DNS服务器,免费DNS,DNS地址,IPv6 DNS,DoH,DoT,加密DNS,换DNS,修改DNS命令,Windows换DNS,macOS换DNS,Linux换DNS,netsh,networksetup,nmcli,resolvectl,阿里DNS,腾讯DNSPod,114DNS,Google DNS,Cloudflare 1.1.1.1,Quad9,OpenDNS,AdGuard DNS"
	path="/dns"
	ogDescription="国内外公共 DNS 地址一览，附官方配置说明页与 Windows / macOS / Linux 更换命令（可一键复制、含还原）；只查不测速、不联网。"
	width="wide"
	fill="fill"
>
	<Workspace />
</ToolShell>
