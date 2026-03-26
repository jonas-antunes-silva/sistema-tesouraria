<template>
  <div class="card w-full max-w-sm bg-base-100 shadow-xl">
    <div class="card-body">
      <h1 class="card-title text-2xl justify-center">Sistema Tesouraria</h1>
      <p class="text-center text-base-content/60 text-sm mb-4">Acesso ao Sistema</p>

      <form @submit.prevent="handleSubmit">
        <div class="form-control mb-3">
          <label class="label" for="email">
            <span class="label-text">E-mail</span>
          </label>
          <input
            id="email"
            v-model="email"
            type="email"
            placeholder="seu@email.gov.br"
            class="input input-bordered w-full"
            required
            autocomplete="email"
          />
        </div>

        <div class="form-control mb-4">
          <label class="label" for="senha">
            <span class="label-text">Senha</span>
          </label>
          <input
            id="senha"
            v-model="senha"
            type="password"
            placeholder="••••••••"
            class="input input-bordered w-full"
            required
            autocomplete="current-password"
          />
        </div>

        <div v-if="erro" role="alert" class="alert alert-error mb-4 text-sm py-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Credenciais inválidas ou erro de conexão</span>
        </div>

        <button
          type="submit"
          class="btn btn-primary w-full"
          :class="{ loading: loading }"
          :disabled="loading"
        >
          {{ loading ? 'Entrando...' : 'Entrar' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'auth', middleware: 'auth' })

const auth = useAuth()
const router = useRouter()

const email = ref('')
const senha = ref('')
const loading = ref(false)
const erro = ref(false)

const handleSubmit = async () => {
  loading.value = true
  erro.value = false

  try {
    await auth.login(email.value, senha.value)
    await router.push('/')
  } catch {
    // Nunca exibir detalhes do erro — mensagem genérica conforme requisito 1.2 / 5.4
    erro.value = true
  } finally {
    loading.value = false
  }
}
</script>
