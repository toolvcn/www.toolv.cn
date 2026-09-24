// 编码速查表的编排层：当前标签、两张老表各自的搜索词、七张通用表各自的搜索词。
// 切标签不丢搜索词，模块级单例。
import { searchAsciiEntries } from './ascii.ts';
import { searchMimeEntries } from './mime.ts';
import type { ReferenceTableId } from './reference.ts';
import { emptyQueries } from './tables.ts';

/** 前两个是专属形态的老表，其余七个是通用速查表（见 core/tables.ts） */
export type Tab = 'mime' | 'ascii' | ReferenceTableId;

class CheatsheetStore {
	tab = $state<Tab>('mime');
	mimeQuery = $state('');
	asciiQuery = $state('');
	/** 七张通用表各留各的搜索词 */
	referenceQueries = $state<Record<ReferenceTableId, string>>(emptyQueries());

	readonly mimeResults = $derived(searchMimeEntries(this.mimeQuery));
	readonly asciiResults = $derived(searchAsciiEntries(this.asciiQuery));

	setTab(tab: Tab): void {
		this.tab = tab;
	}

	clearMimeQuery(): void {
		this.mimeQuery = '';
	}

	clearAsciiQuery(): void {
		this.asciiQuery = '';
	}

	setReferenceQuery(id: ReferenceTableId, value: string): void {
		this.referenceQueries[id] = value;
	}

	clearReferenceQuery(id: ReferenceTableId): void {
		this.referenceQueries[id] = '';
	}
}

export const cheatsheetStore = new CheatsheetStore();
