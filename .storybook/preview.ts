// .storybook 不在 tsconfig 的 include 里，编辑器会把它当成 inferred project 处理，
// 拿不到项目全局类型。CSS 是副作用导入，靠 vite/client 里的 `declare module '*.css'` 才能解析。
/// <reference types="vite/client" />
import type { Preview } from '@storybook/sveltekit';

// Storybook 只渲染 story 组件，不会走 +layout.svelte，因此要在这里手动引入全站样式，
// 否则预览区拿不到 Tailwind 生成的工具类。
import '../src/routes/layout.css';

const preview: Preview = {
	parameters: {
		controls: {
			matchers: {
				color: /(background|color)$/i,
				date: /Date$/i
			}
		},

		a11y: {
			// 'todo' - show a11y violations in the test UI only
			// 'error' - fail CI on a11y violations
			// 'off' - skip a11y checks entirely
			test: 'todo'
		}
	}
};

export default preview;
