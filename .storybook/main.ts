import type { StorybookConfig } from '@storybook/sveltekit';

/**
 * Storybook 配置
 * 文档：https://storybook.js.org/docs/api/main-config
 */
const config: StorybookConfig = {
	stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|ts|svelte)'],

	addons: [
		'@storybook/addon-svelte-csf',
		'@chromatic-com/storybook',
		'@storybook/addon-vitest',
		'@storybook/addon-a11y',
		'@storybook/addon-docs'
	],

	framework: '@storybook/sveltekit',

	// ===== core 配置 =====
	core: {
		// 允许所有主机访问（CNB 平台必需）
		allowedHosts: true,
		// 禁用遥测
		disableTelemetry: true
	}
};

export default config;
