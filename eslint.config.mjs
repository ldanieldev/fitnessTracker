// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
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
    '@stylistic/arrow-parens': 'off'
  }
})
