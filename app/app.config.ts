export default defineAppConfig({
  ui: {
    colors: {
      primary: 'red',
      neutral: 'gray'
    },
    button: {
      slots: { base: 'font-semibold' },
      defaultVariants: { size: 'md' }
    },
    card: {
      slots: { root: 'rounded-2xl', header: 'p-3 sm:px-4', body: 'p-3 sm:p-4', footer: 'p-3 sm:px-4' },
      variants: {
        variant: {
          outline: { root: 'bg-elevated ring-0 divide-y divide-default' }
        }
      }
    },
    modal: {
      slots: { content: 'bg-elevated' }
    },
    drawer: {
      slots: { content: 'bg-elevated ring-0' }
    },
    slideover: {
      slots: { content: 'bg-elevated' }
    }
  }
})
