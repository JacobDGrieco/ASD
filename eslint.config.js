/**
 * ESLint flat configuration for project linting.
 *
 * Keeps generated Prisma output out of linting and enables both browser and
 * Node globals because this repo mixes Vite client code, Vercel handlers, and
 * maintenance scripts under one ESLint command.
 */
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
	globalIgnores(['dist', 'src/generated/prisma/**']),
	{
		files: ['**/*.{js,jsx}'],
		extends: [
			js.configs.recommended,
			reactHooks.configs.flat.recommended,
			reactRefresh.configs.vite,
		],
		languageOptions: {
			ecmaVersion: 'latest',
			sourceType: 'module',
			parserOptions: {
				ecmaFeatures: {
					jsx: true,
				},
			},
			globals: {
				...globals.browser,
				...globals.node,
			},
		},
		rules: {
			'react-hooks/immutability': 'off',
			'react-hooks/preserve-manual-memoization': 'off',
			'react-hooks/refs': 'off',
			'react-hooks/set-state-in-effect': 'off',
			'react-refresh/only-export-components': 'off',
		},
	},
	{
		files: ['**/*.jsx'],
		rules: {
			'no-unused-vars': 'off',
		},
	},
]);
