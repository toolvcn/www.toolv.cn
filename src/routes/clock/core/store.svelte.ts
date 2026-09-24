// 「悬浮时钟 · 计时器」的编排层：三个模式的选项、计时状态、显示样式，外加本地持久化。
// 模块顶层导出单例，组件里直接 clockStore.xxx 读写，不再为每个派生值包一层 getter 函数。
//
// ---------------------------------------------------------------------------
// 计时口径（本文件最要紧的一段，改之前先读）
//
//   一律**不做「每秒加一」**，只存「目标时刻 / 起点 + 累计里程」，每次读的时候用当前时刻换算。
//   原因：标签页切到后台时浏览器会把 setInterval 节流到大约 1 次/分钟，累加法半小时能差出好几分钟；
//   而存时间戳的算法任何时候读出来都对，切标签、卡顿都不影响它。
//
//   **计时进度刻意不落盘**：打开页面就自动开新一轮（见 startNewRound），刷新即新的一轮。
//   落盘的只有「设置」——模式、样式、四个模式的选项、窗口尺寸（见 persist）；那些每次刷新重来才叫烦。
//
//   · 倒计时时长型：`anchorMs` = 目标时刻，`frozenMs` = 暂停那一刻冻住的**带符号剩余**
//     （正数=还剩多少，负数=已超时多久）。用一个带符号量表达两种状态，
//     免得「到点之后再暂停」还要额外记一笔超时量。
//   · 倒计时时刻型：目标是「下一个整点」，每天都往下一天滚，所以不需要运行状态、也没有「到点」。
//   · 秒表：`anchorMs` = 本轮起点，`frozenMs` = 本轮之前已累计的里程。
//
//   `now` 由 +page.svelte 的走时定时器写入（全局副作用统一写在页面里，见 STRUCTURE §2 B）。
//   SSR 阶段它是 null，所有显示值退回占位，避免预渲染出来的 HTML 带着构建那一刻的时间。
// ---------------------------------------------------------------------------

import {
	DEFAULT_CLOCK_OPTIONS,
	DEFAULT_COUNTDOWN_OPTIONS,
	DEFAULT_STOPWATCH_OPTIONS,
	DEFAULT_STYLE,
	DEFAULT_TEXT_OPTIONS,
	STORAGE_KEY,
	type StylePreset
} from '../config.ts';
import {
	alignToPrecision,
	formatClock,
	formatDate,
	formatDuration,
	nextDailyTarget,
	timezoneLabel,
	weekdayLabel
} from './format.ts';
import type {
	ClockMode,
	ClockOptions,
	ClockStyle,
	CountdownOptions,
	DisplayOverrides,
	StopwatchOptions,
	TextOptions,
	TimerState
} from './types.ts';

/**
 * 落盘的数据形状：全部可选，缺项与坏数据都退回默认值。
 *
 * **这里只有「设置」，没有计时进度** —— 计时状态刻意不落盘，刷新即新的一轮（见 startNewRound）。
 */
interface PersistedData {
	mode?: ClockMode;
	style?: Partial<ClockStyle>;
	clockOptions?: Partial<ClockOptions>;
	countdownOptions?: Partial<CountdownOptions>;
	stopwatchOptions?: Partial<StopwatchOptions>;
	textOptions?: Partial<TextOptions>;
	windowSize?: string;
}

class ClockStore {
	// ---------------------------------------------------------------- 状态

	mode = $state<ClockMode>('clock');

	/** 当前时刻（epoch ms）。SSR 阶段为 null，见文件头注释 */
	now = $state<number | null>(null);

	style = $state<ClockStyle>({ ...DEFAULT_STYLE });
	clockOptions = $state<ClockOptions>({ ...DEFAULT_CLOCK_OPTIONS });
	countdownOptions = $state<CountdownOptions>({ ...DEFAULT_COUNTDOWN_OPTIONS });
	stopwatchOptions = $state<StopwatchOptions>({ ...DEFAULT_STOPWATCH_OPTIONS });
	textOptions = $state<TextOptions>({ ...DEFAULT_TEXT_OPTIONS });

	countdown = $state<TimerState>({
		state: 'idle',
		anchorMs: null,
		frozenMs: DEFAULT_COUNTDOWN_OPTIONS.durationMs
	});
	stopwatch = $state<TimerState>({ state: 'idle', anchorMs: null, frozenMs: 0 });

	/**
	 * 已打开的窗口形态：关着 / 画中画悬浮窗 / 独立窗口。
	 * **刻意不落盘** —— 窗口活不过一次刷新，记下来只会得到一个「说开着、其实没开」的假状态。
	 */
	windowKind = $state<'closed' | 'pip' | 'standalone'>('closed');
	/** 小窗尺寸档 id */
	windowSize = $state('m');

	/**
	 * 是否已读过盘。必须做成 $state —— persit() 靠它提前返回，
	 * 而 effect 里提前返回意味着「没读到任何状态」，那这个 effect 就永远不会再跑，
	 * 后续改动也就一次都写不进磁盘。
	 */
	loaded = $state(false);

	// ---------------------------------------------------------------- 时钟显示

	/** 还没拿到系统时间时的占位，位数跟当前设置对齐，免得加载完宽度跳一下 */
	get clockPlaceholder(): string {
		return this.clockOptions.showSeconds ? '--:--:--' : '--:--';
	}

	readonly clockParts = $derived(
		this.now === null
			? { time: this.clockPlaceholder, meridiem: '' }
			: formatClock(this.now, this.clockOptions.hourSystem, this.clockOptions.showSeconds)
	);

	/** 冒号是否可见：只在时钟模式、开了闪烁、且落在奇数秒时淡出 */
	readonly colonVisible = $derived(
		this.mode !== 'clock' || !this.clockOptions.blinkColon || this.now === null
			? true
			: new Date(this.now).getSeconds() % 2 === 0
	);

	// ---------------------------------------------------------------- 倒计时

	/** 时长型的带符号剩余：正数=还剩，负数=已超时。暂停时把这一刻的值整个冻进 frozenMs */
	get durationSignedRemainMs(): number {
		const timer = this.countdown;
		if (timer.state === 'running' && timer.anchorMs !== null && this.now !== null) {
			return timer.anchorMs - this.now;
		}
		return timer.frozenMs;
	}

	/** 时刻型剩余：目标永远是「下一个 h:m:s」，所以恒为正，过了今天的点就自动指向明天 */
	get dailyRemainMs(): number {
		if (this.now === null) return 0;
		const { dailyHour, dailyMinute, dailySecond } = this.countdownOptions;
		return nextDailyTarget(this.now, dailyHour, dailyMinute, dailySecond) - this.now;
	}

	/** 距离到点还剩多少（已到点为 0） */
	get countdownRemainMs(): number {
		if (this.countdownOptions.kind === 'daily') return this.dailyRemainMs;
		return Math.max(0, this.durationSignedRemainMs);
	}

	/** 到点之后又过了多久；没开「超时正计时」或还没到点都是 0 */
	get countdownOvertimeMs(): number {
		if (this.countdownOptions.kind === 'daily' || !this.countdownOptions.overtime) return 0;
		return Math.max(0, -this.durationSignedRemainMs);
	}

	/** 时长型是否已到点（时刻型永远在等下一个整点，不存在到点） */
	get countdownFinished(): boolean {
		return this.countdownOptions.kind === 'duration' && this.durationSignedRemainMs <= 0;
	}

	/** 要不要给「开始 / 暂停 / 继续 / 重置」这四个按钮：只有时长型用得上 */
	get countdownRunnable(): boolean {
		return this.countdownOptions.kind === 'duration';
	}

	// ---------------------------------------------------------------- 秒表

	/** 已过的毫秒数：运行中是「本轮 + 之前累计」，暂停 / 未开始时就是累计值 */
	get stopwatchElapsedMs(): number {
		const timer = this.stopwatch;
		if (timer.state === 'running' && timer.anchorMs !== null && this.now !== null) {
			return timer.frozenMs + (this.now - timer.anchorMs);
		}
		return timer.frozenMs;
	}

	// ---------------------------------------------------------------- 舞台上的几行字

	/** 主数字。倒计时的剩余向上取整，秒表向下取整（口径见 core/format.ts 顶部） */
	readonly primaryText = $derived.by(() => {
		// 文字模式没有「主数字」这回事，把内容原样交出去 —— 自动字号按最长一行算，见 ClockStage
		if (this.mode === 'text') return this.textOptions.content;
		if (this.mode === 'countdown') {
			const overtime = this.countdownOvertimeMs;
			const ms =
				overtime > 0
					? alignToPrecision(overtime, 'second', 'down')
					: alignToPrecision(this.countdownRemainMs, 'second', 'up');
			return formatDuration(ms, 'second');
		}
		if (this.mode === 'stopwatch') {
			const precision = this.stopwatchOptions.precision;
			return formatDuration(alignToPrecision(this.stopwatchElapsedMs, precision, 'down'), precision);
		}
		return this.clockParts.time;
	});

	/** 主数字右侧的 AM / PM，只有时钟模式的 12 小时制才有 */
	readonly meridiemText = $derived(this.mode === 'clock' ? this.clockParts.meridiem : '');

	/** 主数字上方的说明文字：倒计时与秒表可自定义，时钟模式没有这一行 */
	readonly prefixText = $derived(
		this.mode === 'countdown'
			? this.countdownOptions.prefix.trim()
			: this.mode === 'stopwatch'
				? this.stopwatchOptions.prefix.trim()
				: ''
	);

	/** 主数字下方的小字：时钟给日期 / 星期 / 时区，倒计时到点给提示，秒表没有 */
	readonly captionText = $derived.by(() => {
		if (this.mode === 'clock') {
			if (this.now === null) return '';
			const parts: string[] = [];
			const date = formatDate(this.now, this.clockOptions.dateFormat);
			if (date !== '') parts.push(date);
			if (this.clockOptions.showWeekday) parts.push(weekdayLabel(this.now));
			if (this.clockOptions.showTimezone) parts.push(timezoneLabel(this.now));
			return parts.join('  ·  ');
		}
		if (this.mode === 'countdown' && this.countdownFinished) {
			return this.countdownOptions.overtime ? '超时' : '时间到';
		}
		return '';
	});

	/** 到点后主数字转红（配色在 ClockStage 里定） */
	readonly alarmed = $derived(this.mode === 'countdown' && this.countdownFinished);

	// ---------------------------------------------------------------- 操作：模式与样式

	setMode(mode: ClockMode): void {
		this.mode = mode;
	}

	patchStyle(patch: Partial<ClockStyle>): void {
		this.style = { ...this.style, ...patch };
	}

	/** 套用配色预设：只覆盖预设里写了的那几项，字号、字体这些留着不动 */
	applyPreset(preset: StylePreset): void {
		this.style = { ...this.style, ...preset.style };
	}

	// ---------------------------------------------------------------- 操作：开新一轮

	/**
	 * 打开页面时调一次：倒计时按设定时长起算、秒表从 0 起算 —— **不用手动点「开始」**。
	 *
	 * 计时进度刻意不落盘（见 PersistedData），所以「刷新页面」就等于重新开一轮，
	 * 不会出现「昨天设的 30 分钟、今天打开还在倒」这种事。
	 * 时刻型倒计时用不上它 —— 那个算的是「离下一个整点还有多久」，本来就不需要开始。
	 */
	startNewRound(): void {
		if (this.now === null) return;
		const duration = this.countdownOptions.durationMs;
		this.countdown = { state: 'running', anchorMs: this.now + duration, frozenMs: duration };
		this.stopwatch = { state: 'running', anchorMs: this.now, frozenMs: 0 };
	}

	// ---------------------------------------------------------------- 操作：倒计时

	/** 改设定时长。只在「未开始」时同步到当前这一轮，运行中 / 暂停中不动它 */
	setDuration(durationMs: number): void {
		this.countdownOptions.durationMs = durationMs;
		if (this.countdown.state === 'idle') this.countdown.frozenMs = durationMs;
	}

	startCountdown(): void {
		if (!this.countdownRunnable || this.now === null) return;
		// 从当前冻结值起算；已经归零（跑完过一轮）就按设定时长重来
		const remain = this.countdown.frozenMs > 0 ? this.countdown.frozenMs : this.countdownOptions.durationMs;
		this.countdown = { state: 'running', anchorMs: this.now + remain, frozenMs: remain };
	}

	pauseCountdown(): void {
		if (this.countdown.state !== 'running') return;
		// 把这一刻的带符号剩余冻起来：负数即「已超时」，继续时从那里接着走
		this.countdown = { state: 'paused', anchorMs: null, frozenMs: this.durationSignedRemainMs };
	}

	resetCountdown(): void {
		this.countdown = { state: 'idle', anchorMs: null, frozenMs: this.countdownOptions.durationMs };
	}

	// ---------------------------------------------------------------- 操作：秒表

	startStopwatch(): void {
		if (this.now === null || this.stopwatch.state === 'running') return;
		// 保留已累计的里程，所以「暂停 → 继续」是从暂停处接着走；重开一轮请走 startNewRound
		this.stopwatch = { state: 'running', anchorMs: this.now, frozenMs: this.stopwatch.frozenMs };
	}

	pauseStopwatch(): void {
		if (this.stopwatch.state !== 'running') return;
		this.stopwatch = { state: 'paused', anchorMs: null, frozenMs: this.stopwatchElapsedMs };
	}

	resetStopwatch(): void {
		this.stopwatch = { state: 'idle', anchorMs: null, frozenMs: 0 };
	}

	// ---------------------------------------------------------------- 持久化

	/** 读一次存储。没有 localStorage（SSR）或读不动（隐私模式）都给 null，调用方退回默认值 */
	#readStorage(): string | null {
		if (typeof localStorage === 'undefined') return null;
		try {
			return localStorage.getItem(STORAGE_KEY);
		} catch {
			return null;
		}
	}

	/** 把一份存储内容应用上来（只回填「设置」，计时进度不在存储里） */
	#apply(raw: string): void {
		try {
			const data = JSON.parse(raw) as PersistedData;
			if (data.mode) this.mode = data.mode;
			// 逐块浅合并：老版本少一个字段也不会让整份配置作废
			if (data.style) this.style = { ...this.style, ...data.style };
			if (data.clockOptions) this.clockOptions = { ...this.clockOptions, ...data.clockOptions };
			if (data.countdownOptions) this.countdownOptions = { ...this.countdownOptions, ...data.countdownOptions };
			if (data.stopwatchOptions) this.stopwatchOptions = { ...this.stopwatchOptions, ...data.stopwatchOptions };
			if (data.textOptions) this.textOptions = { ...this.textOptions, ...data.textOptions };
			if (data.windowSize) this.windowSize = data.windowSize;
		} catch {
			// 存坏了就整份丢掉用默认值起来，不因为一条脏数据白屏
		}
	}

	/** 首次读盘。只在客户端跑一次，loaded 闸门保证后面再调也是空转 */
	hydrate(): void {
		if (this.loaded) return;
		this.loaded = true;
		const raw = this.#readStorage();
		if (raw) this.#apply(raw);
	}

	/**
	 * 把独立窗口 URL 参数里**真的写了**的那几项盖到当前状态上（解析见 core/params.ts）。
	 * 没写的项保持 store 的初始值 —— 展示页不读 localStorage，地址就是那份窗口的唯一真值。
	 *
	 * ⚠️ 本方法对每个字段都是「先读再写回」，所以**在 effect 里同步调用必须裹 untrack**：
	 * 读到的依赖被自己改掉，effect 会无限自触发（详细解释见 display/+page.svelte 的注释）。
	 */
	applyOverrides(overrides: DisplayOverrides): void {
		if (overrides.mode) this.mode = overrides.mode;
		this.style = { ...this.style, ...overrides.style };
		this.clockOptions = { ...this.clockOptions, ...overrides.clockOptions };
		this.countdownOptions = { ...this.countdownOptions, ...overrides.countdownOptions };
		this.stopwatchOptions = { ...this.stopwatchOptions, ...overrides.stopwatchOptions };
		this.textOptions = { ...this.textOptions, ...overrides.textOptions };
	}

	/**
	 * 写盘：整体覆盖一次。
	 * 在 effect 里调用，函数体读到的每个 $state 都会成为那个 effect 的依赖 —— 所以别再往里加
	 * 「只在某些字段变化时才写」的判断，那样反而会漏依赖。
	 */
	persist(): void {
		if (!this.loaded || typeof localStorage === 'undefined') return;
		const data: PersistedData = {
			mode: this.mode,
			style: this.style,
			clockOptions: this.clockOptions,
			countdownOptions: this.countdownOptions,
			stopwatchOptions: this.stopwatchOptions,
			textOptions: this.textOptions,
			windowSize: this.windowSize
		};
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
		} catch {
			// 配额满 / 隐私模式：静默降级。功能照常用，只是不留记忆
		}
	}
}

export const clockStore = new ClockStore();
