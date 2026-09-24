<script lang="ts">
	import { FileCode } from '@lucide/svelte';
	import ToolShell from '$lib/components/ToolShell/ToolShell.svelte';
	import Panel from './ui/Panel.svelte';
</script>

<ToolShell
	icon={FileCode}
	name="htaccess ↔ Nginx 互转"
	tagline="RewriteRule · Header · Redirect · 双向互转"
	description="在线 .htaccess 与 nginx 配置互转：RewriteCond + RewriteRule 与 if + rewrite 双向对应，Redirect / Header / ErrorDocument / Options 等常用指令逐条映射，正向自动补、反向自动去 RewriteBase 路径前缀；旁边还有一张参数速查表，按方向列出常用指令、RewriteRule 标记与 %&#123;…&#125; / $… 变量对照，点一行就把写法插进输入框。两边做不到的指令都不会被悄悄丢掉，而是就地标出来并说明怎么改。全部本地转换，不上传任何配置。"
	keywords="htaccess转nginx,nginx转htaccess,nginx配置转换,htaccess转换,RewriteRule,rewrite规则,Apache转Nginx,htaccess在线转换,nginx rewrite,nginx指令速查,htaccess指令速查,nginx变量,在线工具"
	path="/htaccess-to-nginx"
	ogDescription=".htaccess 与 nginx 配置双向互转：RewriteRule / Header / Redirect 都有对应，附可点插的参数速查表，做不到的就地标出来，纯本地转换。"
	width="full"
	fill="fill"
>
	<Panel />
</ToolShell>
