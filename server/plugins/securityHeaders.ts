// Nuxt's renderer stamps x-powered-by on every page and payload; Nitro has no switch for it, so drop it here.
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('render:response', (_response, { event }) => {
    removeResponseHeader(event, 'x-powered-by')
  })
})
