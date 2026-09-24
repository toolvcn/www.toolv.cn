// Git 命令速查的 store：拿本工具的数据 new 出共享的 CheatsheetStore（逻辑与界面都在 $lib）。
// 模块顶层导出单例，组件里直接读写 —— 与 STRUCTURE §0 硬约束 3 的口径一致。
//
// 注意 `$lib` 下的 `.svelte.ts` 模块**不带 `.ts` 后缀**引入（与 `$lib/ui/favorites.svelte` 同一写法）：
// 带上后缀会触发 svelte-check 的「导入用了 .ts 扩展名但不是相对路径」报错。
import { CheatsheetStore } from '$lib/components/CommandCheatsheet/cheatsheet.svelte';
import { VAR_DEFS } from '../config.ts';
import { GIT_COMMANDS, GIT_GROUPS } from './commands.ts';

export const gitStore = new CheatsheetStore(GIT_COMMANDS, GIT_GROUPS, VAR_DEFS);
