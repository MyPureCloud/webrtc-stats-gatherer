// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      'no-prototype-builtins': 'off',
      '@typescript-eslint/no-var-requires': 'warn'
    }
  }
);
