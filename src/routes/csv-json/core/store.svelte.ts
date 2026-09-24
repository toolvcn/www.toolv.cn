// CSV ↔ JSON 的编排层：两个方向各留一份输入，输出是派生值，模块级单例。
import { copyText, downloadText } from '$lib/utils/browser';
import { csvToJson, jsonToCsv } from './csv.ts';
import { EXAMPLE_CSV, EXAMPLE_JSON, type ConvertResult, type Delimiter, type Direction } from './types.ts';
import { toast } from '$lib/ui/toast.svelte';

class CsvJsonStore {
	direction = $state<Direction>('csv-to-json');

	// CSV → JSON 工作区
	csvInput = $state(EXAMPLE_CSV);
	headerRow = $state(true);
	inferTypes = $state(true);

	// JSON → CSV 工作区
	jsonInput = $state(EXAMPLE_JSON);
	writeHeader = $state(true);

	// 分隔符两个方向共用
	delimiter = $state<Delimiter>(',');

	readonly csvResult = $derived(
		csvToJson(this.csvInput, {
			delimiter: this.delimiter,
			headerRow: this.headerRow,
			inferTypes: this.inferTypes
		})
	);
	readonly jsonResult = $derived(
		jsonToCsv(this.jsonInput, { delimiter: this.delimiter, writeHeader: this.writeHeader })
	);

	/** 当前方向的结果与输入 */
	get result(): ConvertResult {
		return this.direction === 'csv-to-json' ? this.csvResult : this.jsonResult;
	}
	get isEmpty(): boolean {
		return (this.direction === 'csv-to-json' ? this.csvInput : this.jsonInput).trim() === '';
	}
	get hasError(): boolean {
		return !this.isEmpty && !this.result.ok;
	}
	/** 空态与错误态下输出区都不给内容 */
	get output(): string {
		return this.result.ok ? this.result.text : '';
	}

	// ---------------------------------------------------------------- 操作

	setDirection(direction: Direction): void {
		this.direction = direction;
	}

	setDelimiter(value: string): void {
		this.delimiter = value as Delimiter;
	}

	loadExample(): void {
		if (this.direction === 'csv-to-json') {
			this.csvInput = EXAMPLE_CSV;
			this.headerRow = true;
			this.inferTypes = true;
		} else {
			this.jsonInput = EXAMPLE_JSON;
			this.writeHeader = true;
		}
	}

	clearInput(): void {
		if (this.direction === 'csv-to-json') this.csvInput = '';
		else this.jsonInput = '';
	}

	async copyOutput(): Promise<void> {
		if (!this.result.ok) {
			toast.show('当前输入有误，没有可复制的结果', true);
			return;
		}
		const ok = await copyText(this.result.text);
		toast.show(ok ? '已复制结果' : '复制失败，请手动选中复制', !ok);
	}

	downloadOutput(): void {
		if (!this.result.ok || this.result.text === '') {
			toast.show('当前没有可下载的结果', true);
			return;
		}
		if (this.direction === 'csv-to-json') downloadText('data.json', this.result.text, 'application/json;charset=utf-8');
		else downloadText('data.csv', this.result.text, 'text/csv;charset=utf-8');
		toast.show('已开始下载');
	}
}

export const csvJsonStore = new CsvJsonStore();
