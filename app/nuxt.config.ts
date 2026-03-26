// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxtjs/tailwindcss'],

  ssr: false,
  devtools: false,

  typescript: {
    strict: true,
  },

  runtimeConfig: {
    // Variáveis privadas do servidor (nunca expostas ao cliente)
    databaseUrl: process.env.DATABASE_URL ?? '',
    jwtSecret: process.env.JWT_SECRET ?? '',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
    sisgruUrlBase: process.env.SISGRU_URL_BASE ?? '',
    sisgruIssuer: process.env.SISGRU_ISSUER ?? '',
    sisgruPrivateKeyPath: process.env.SISGRU_PRIVATE_KEY_PATH ?? '',
    sisgruUg: process.env.SISGRU_UG ?? '',
    sisgruSyncIntervalMinutes: process.env.SISGRU_SYNC_INTERVAL_MINUTES ?? '10',

    // Variáveis públicas (acessíveis no cliente via useRuntimeConfig().public)
    public: {},
  },

  nitro: {
    experimental: {
      wasm: false,
    },
  },

  compatibilityDate: '2024-11-01',
})
