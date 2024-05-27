import js from '@eslint/js';
import globals from 'globals';

export default [
	{
		...js.configs.recommended,
		ignores: ['static/*', '.venv/**'],
		languageOptions: {
			sourceType: 'module',
			globals: {
				...globals.browser
			}
		},
		rules: {
			'array-callback-return': 'error',
			'consistent-return': 'error',
			'curly': 'error',
			'eol-last': 'error',
			'eqeqeq': 'error',
			'indent': ['error', 'tab', {'SwitchCase': 1}],
			'key-spacing': 'error',
			'linebreak-style': ['error', 'unix'],
			'no-console': 'off',
			'no-multi-spaces': 'error',
			'no-multiple-empty-lines': 'error',
			'no-new-wrappers': 'error',
			'no-proto': 'error',
			'no-prototype-builtins': 'off',
			'no-undef': 'error',
			'no-var': 'error',
			'no-with': 'error',
			'prefer-const': 'error',
			'prefer-template': 'error',
			'quotes': ['error', 'single'],
			'semi': ['error', 'always'],
			'spaced-comment': ['error', 'never'],
			'strict': 'error',
			'template-curly-spacing': ['error', 'never']
		}
	}
];
