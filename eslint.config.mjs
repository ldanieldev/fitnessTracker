// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  {
    rules: {
      // Disable rules that conflict with Prettier
      'vue/singleline-html-element-content-newline': 'off',
      'vue/multiline-html-element-content-newline': 'off',
      'vue/html-indent': 'off',
      'vue/html-closing-bracket-newline': 'off',
      'vue/html-self-closing': 'off',
      'vue/max-attributes-per-line': 'off',
      'vue/first-attribute-linebreak': 'off',
      '@stylistic/indent': 'off',
      '@stylistic/space-before-function-paren': 'off',
      '@stylistic/space-in-parens': 'off',
      '@stylistic/func-call-spacing': 'off',
      '@stylistic/operator-linebreak': 'off',
      '@stylistic/arrow-parens': 'off',
      '@stylistic/member-delimiter-style': 'off',
      '@stylistic/quote-props': 'off',
      '@stylistic/max-len': [
        'error',
        { code: 120, ignoreUrls: true, ignoreRegExpLiterals: true }
      ]
    }
  },
  {
    // A raw $fetch skips apiFetch's 401 → logout/redirect handling (app/composables/useSessionGuard.ts).
    files: ['app/**/*.{ts,vue}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'CallExpression[callee.name="$fetch"]',
          message:
            'Use apiFetch from app/composables/useSessionGuard.ts instead of raw $fetch — ' +
            'it handles a stale-session 401 by logging out and redirecting.'
        }
      ]
    }
  },
  {
    files: ['app/composables/useSessionGuard.ts'],
    rules: {
      'no-restricted-syntax': 'off'
    }
  },
  {
    files: ['**/*.vue'],
    rules: {
      '@stylistic/max-len': 'off',
      'vue/max-len': [
        'error',
        {
          code: 120,
          ignoreUrls: true,
          ignoreRegExpLiterals: true
        }
      ]
    }
  },
  {
    ignores: ['.superpowers/**']
  }
)
