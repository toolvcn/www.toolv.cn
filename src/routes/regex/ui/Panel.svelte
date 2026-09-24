<script lang="ts">
	// 正则测试主布局：最左常用正则（通高）、中央上正则栏 + 中央下工作区（五个标签）、
	// 最右正则速查表。速查表在 xl 起才是右栏；1024~1279 三栏已经很挤，让它横铺在底部。
	import CheatSheetCard from './CheatSheetCard.svelte';
	import PatternCard from './PatternCard.svelte';
	import PresetCard from './PresetCard.svelte';
	import Workspace from './Workspace.svelte';
	import Toast from '$lib/ui/Toast/Toast.svelte';
</script>

<!-- 移动端单列自然流（各卡片自带封顶高度），桌面 lg 两列、xl 三列。
     两侧栏宽：左 17rem（常用正则条目竖排两行 + 顶部「名称 / 保存」一行要放得下）、
     右 24rem（速查表一行两条，每列才有 ~170px 显示完整说明）。
     1280 视口下中间列还剩约 35rem —— 再宽就会挤到中央工作区，要加宽得先确认这一点。

     工作区那行的下限与整列滚动是一对，缺一不可：
       - `minmax(18rem,1fr)` 而不是 `minmax(0,1fr)`：lg 起页面钉在视口高（ToolShell fill=lg），
         视口一矮，1fr 会被压成 0，测试文本的编辑区跟着塌成一条线 —— 输入框就「丢了」。
         18rem 是「标签条 + 工具条 + 七八行编辑区」的地板价（扣掉两块条，编辑区还剩 ~170px）。
       - `lg:overflow-y-auto`：行有了下限后，矮视口下三行加起来会超出容器；
         外壳是 overflow-hidden，不加这条超出的部分会被裁掉（速查表少一截），
         改成整列滚动就只是多一条滚动条。 -->
<div
	class="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[17rem_minmax(0,1fr)] lg:grid-rows-[auto_minmax(18rem,1fr)_auto] lg:overflow-y-auto xl:grid-cols-[17rem_minmax(0,1fr)_24rem] xl:grid-rows-[auto_minmax(18rem,1fr)]"
>
	<PresetCard class="lg:col-start-1 lg:row-span-3 lg:row-start-1 xl:row-span-2" />
	<PatternCard class="lg:col-start-2 lg:row-start-1" />
	<Workspace class="lg:col-start-2 lg:row-start-2" />
	<CheatSheetCard class="lg:col-start-2 lg:row-start-3 xl:col-start-3 xl:row-span-2 xl:row-start-1 xl:max-h-none" />
</div>

<Toast />
