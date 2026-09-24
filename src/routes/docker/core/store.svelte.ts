// Docker 命令速查的 store：拿本工具的数据 new 出共享的 CheatsheetStore（逻辑与界面都在 $lib）。
// 模块顶层导出单例，组件里直接读写 —— 与 STRUCTURE §0 硬约束 3 的口径一致。
import { CheatsheetStore } from '$lib/components/CommandCheatsheet/cheatsheet.svelte';
import { VAR_DEFS } from '../config.ts';
import { DOCKER_COMMANDS, DOCKER_GROUPS } from './commands.ts';

export const dockerStore = new CheatsheetStore(DOCKER_COMMANDS, DOCKER_GROUPS, VAR_DEFS);
