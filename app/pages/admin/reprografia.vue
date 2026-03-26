<template>
  <div>
    <h1 class="text-2xl font-bold mb-4">Configurações de Reprografia</h1>

    <div v-if="erro" role="alert" class="alert alert-error mb-4">
      <span>{{ erro }}</span>
    </div>

    <div class="card bg-base-100 shadow-sm">
      <div class="card-body p-4">
        <div class="flex flex-col gap-3">
          <div>
            <label class="label p-0 mb-1">
              <span class="label-text font-medium">Valor por cópia (R$)</span>
            </label>
            <input
              class="input input-bordered w-full max-w-xs"
              type="text"
              v-model="valorInput"
              placeholder="0,10"
              :disabled="carregandoSalvar"
            />
          </div>

          <div class="flex items-center gap-3 flex-wrap">
            <button class="btn btn-primary" :disabled="carregandoSalvar" @click="salvar">
              <span v-if="carregandoSalvar" class="loading loading-spinner loading-sm" />
              <span v-else>Salvar</span>
            </button>
          </div>

          <div class="text-sm text-base-content/70">
            Última atualização:
            <span class="font-medium text-base-content">{{ lastUpdateText }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default', middleware: 'auth' })

const auth = useAuth()
const router = useRouter()

const erro = ref<string | null>(null)
const carregandoSalvar = ref(false)

const config = ref<{
  valor_por_copia: number
  atualizado_em: string
  atualizado_por_nome: string | null
} | null>(null)

const valorInput = ref<string>('0.10')

const lastUpdateText = computed(() => {
  if (!config.value) return '—'
  const dt = new Date(config.value.atualizado_em)
  const data = Number.isNaN(dt.getTime())
    ? config.value.atualizado_em
    : dt.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const nome = config.value.atualizado_por_nome ?? '—'
  return `${data} por ${nome}`
})

async function carregarConfig() {
  erro.value = null
  try {
    const cfg = await $fetch<{
      valor_por_copia: number
      atualizado_em: string
      atualizado_por_nome: string | null
    }>(`/api/reprografia/config`)

    config.value = cfg
    valorInput.value = cfg.valor_por_copia.toString().replace('.', ',')
  } catch {
    erro.value = 'Erro ao carregar configuração.'
  }
}

async function salvar() {
  if (!config.value) return
  carregandoSalvar.value = true
  erro.value = null

  try {
    await $fetch(`/api/reprografia/config`, {
      method: 'PUT',
      body: { valor_por_copia: valorInput.value },
    })
    await carregarConfig()
  } catch {
    erro.value = 'Erro ao salvar configuração. Verifique os dados e tente novamente.'
  } finally {
    carregandoSalvar.value = false
  }
}

onMounted(async () => {
  if (!auth.hasPermission('admin')) {
    erro.value = 'Acesso negado.'
    router.push('/')
    return
  }
  await carregarConfig()
})
</script>

