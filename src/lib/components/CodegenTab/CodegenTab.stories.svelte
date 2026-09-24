<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import CodegenTab from './CodegenTab.svelte';

	const { Story } = defineMeta({ title: '组件/CodegenTab', component: CodegenTab });

	/** 跟 http 的 core/codegen.ts 同形的语言列表 */
	const HTTP_LANGS = [
		{ id: 'javascript', label: 'JavaScript' },
		{ id: 'typescript', label: 'TypeScript' },
		{ id: 'python', label: 'Python' },
		{ id: 'go', label: 'Go' },
		{ id: 'java', label: 'Java' },
		{ id: 'php', label: 'PHP' },
		{ id: 'csharp', label: 'C#' },
		{ id: 'powershell', label: 'PowerShell' }
	] as const;

	const SAMPLE = `const res = await fetch("https://api.example.com/users", {
  method: "GET",
  headers: { "Accept": "application/json" }
});
console.log(await res.json());`;

	/** 短片段：代码块有剩余空间时不会撑满 */
	const SHORT = `curl https://api.example.com/users`;
</script>

<!-- 八个语言 chips + 复制按钮：chips 不换行放不下时自动折行 -->
{#snippet http()}
	<div class="flex h-[420px] flex-col rounded-xl border border-gray-200 bg-white shadow-sm">
		<CodegenTab
			langs={HTTP_LANGS}
			value="javascript"
			onchange={() => {}}
			code={SAMPLE}
			oncopy={() => {}}
			copyLabel="复制当前语言的请求代码"
			blockId="story-codegen-http"
			blockLabel="生成的请求代码"
		/>
	</div>
{/snippet}

<!-- 两种语言 + 短代码：验证 chips 少、代码块内容短时的版式 -->
{#snippet pair()}
	<div class="flex h-72 flex-col rounded-xl border border-gray-200 bg-white shadow-sm">
		<CodegenTab
			langs={[
				{ id: 'js', label: 'JavaScript' },
				{ id: 'py', label: 'Python' }
			]}
			value="py"
			onchange={() => {}}
			code={SHORT}
			oncopy={() => {}}
			copyLabel="复制当前语言的生成代码"
			blockId="story-codegen-pair"
			blockLabel="生成的代码"
		/>
	</div>
{/snippet}

<Story name="HttpLangs" template={http} />
<Story name="TwoLangs" template={pair} />
