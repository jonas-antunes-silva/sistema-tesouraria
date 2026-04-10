<template>
  <div>
    <h1 class="text-2xl font-bold mb-4">Sincronização SISGRU</h1>

    <div v-if="erro" role="alert" class="alert alert-error mb-4">
      <span>{{ erro }}</span>
    </div>

    <div class="card bg-base-100 shadow-sm">
      <div class="card-body p-4">
        <h2 class="card-title text-lg">Sincronização Manual</h2>
        <p class="text-sm text-base-content/70 mb-4">
          Sincroniza GRUs e Pagamentos do SISGRU para a data especificada.
          Por padrão, sincroniza dados do dia atual.
        </p>

        <div class="flex flex-col gap-4">
          <div>
            <label class="label p-0 mb-1">
              <span class="label-text font-medium">Data de referência</span>
            </label>
            <input
              class="input input-bordered w-full max-w-xs"
              type="date"
              v-model="dataAlvo"
              :disabled="sincronizando"
            />
            <label class="label p-0 mt-1">
              <span class="label-text-alt text-base-content/60">
                Deixe em branco para sincronizar o dia de hoje
              </span>
            </label>
          </div>

          <div class="flex items-center gap-3 flex-wrap">
            <button
              class="btn btn-primary"
              :disabled="sincronizando"
              @click="sincronizar"
            >
              <span v-if="sincronizando" class="loading loading-spinner loading-sm" />
              <span v-else>Iniciar Sincronização</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="resultado" class="card bg-base-100 shadow-sm mt-4">
      <div class="card-body p-4">
        <h2 class="card-title text-lg">Resultado</h2>
        <div class="overflow-x-auto">
          <table class="table table-sm">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Total</th>
                <th>Novos</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="log in resultado" :key="log.tipo">
                <td class="capitalize">{{ log.tipo }}</td>
                <td>{{ log.qtd_total ?? '—' }}</td>
                <td>{{ log.qtd_novos ?? '—' }}</td>
                <td>
                  <span
                    class="badge"
                    :class="log.status === 'sucesso' ? 'badge-success' : 'badge-error'"
                  >
                    {{ log.status === 'sucesso' ? 'Sucesso' : 'Erro' }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="resultadoMensagem" class="mt-2 text-sm text-base-content/70">
          {{ resultadoMensagem }}
        </div>
      </div>
    </div>

    <div class="card bg-base-100 shadow-sm mt-4">
      <div class="card-body p-4">
        <h2 class="card-title text-lg">Histórico de Sincronizações</h2>
        <div class="tabs tabs-boxed w-fit mb-3">
          <button
            class="tab"
            :class="abaHistorico === 'todas' ? 'tab-active' : ''"
            @click="abaHistorico = 'todas'"
          >
            Todas
          </button>
          <button
            class="tab"
            :class="abaHistorico === 'd1d5' ? 'tab-active' : ''"
            @click="abaHistorico = 'd1d5'"
          >
            D-1 a D-5
          </button>
        </div>
        <div class="overflow-x-auto">
          <table class="table table-sm">
            <thead>
              <tr>
                <th>Data/Hora</th>
                <th>Tipo</th>
                <th>Total</th>
                <th>Novos</th>
                <th>Status</th>
                <th>Erro</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="historicoFiltrado.length === 0">
                <td colspan="6" class="text-center text-base-content/60">
                  Nenhuma sincronização registrada nesta aba
                </td>
              </tr>
              <tr v-for="log in historicoFiltrado" :key="log.id">
                <td>{{ formatarData(log.finalizado_em) }}</td>
                <td class="capitalize">{{ log.tipo }}</td>
                <td>{{ log.qtd_total ?? '—' }}</td>
                <td>{{ log.qtd_novos ?? '—' }}</td>
                <td>
                  <span
                    class="badge"
                    :class="log.status === 'sucesso' ? 'badge-success' : 'badge-error'"
                  >
                    {{ log.status === 'sucesso' ? 'Sucesso' : 'Erro' }}
                  </span>
                </td>
                <td class="max-w-xs truncate" :title="log.mensagem_erro ?? ''">
                  {{ log.mensagem_erro ?? '—' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default', middleware: 'auth' })

const auth = useAuth()
const router = useRouter()

interface SyncLog {
  id: number
  tipo: string
  finalizado_em: string
  qtd_novos: number | null
  qtd_total: number | null
  status: 'sucesso' | 'erro'
  mensagem_erro: string | null
}

const erro = ref<string | null>(null)
const sincronizando = ref(false)
const dataAlvo = ref<string>('')
const historico = ref<SyncLog[]>([])
const abaHistorico = ref<'todas' | 'd1d5'>('todas')
const resultado = ref<SyncLog[] | null>(null)
const resultadoMensagem = ref<string>('')

const historicoFiltrado = computed<SyncLog[]>(() => {
  if (abaHistorico.value === 'd1d5') {
    return historico.value.filter(
      (log) => log.tipo === 'pagamentos_anteriores_5d' || log.tipo === 'pagamentos',
    )
  }
  return historico.value
})

function formatarData(data: string): string {
  const dt = new Date(data)
  if (Number.isNaN(dt.getTime())) return data
  return dt.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function carregarHistorico() {
  try {
    const logs = await $fetch<SyncLog[]>('/api/sisgru/sync-log')
    historico.value = logs
  } catch {
    // Silencioso - histórico não crítico
  }
}

function montarResultado(): SyncLog[] {
  const tiposDesejados = [
    'grus_manual_data',
    'pagamentos_manual_data',
    'grus_ultimos_5d',
    'pagamentos_hoje',
    'pagamentos_anteriores_5d',
  ]
  return tiposDesejados
    .map((tipo) => historico.value.find((log) => log.tipo === tipo))
    .filter((log): log is SyncLog => Boolean(log))
}

async function sincronizar() {
  sincronizando.value = true
  erro.value = null
  resultado.value = null
  resultadoMensagem.value = ''

  try {
    await $fetch('/api/sisgru/sync', {
      method: 'POST',
      body: dataAlvo.value ? { data: dataAlvo.value } : {},
    })
    resultadoMensagem.value = 'Sincronização iniciada. Atualizando histórico...'
    await carregarHistorico()
    resultado.value = montarResultado()
    resultadoMensagem.value = 'Sincronização concluída.'
  } catch (err: unknown) {
    const msg =
      err && typeof err === 'object' && 'statusMessage' in err
        ? (err as { statusMessage: string }).statusMessage
        : 'Erro ao iniciar sincronização.'
    erro.value = msg
  } finally {
    sincronizando.value = false
  }
}

onMounted(async () => {
  if (!auth.hasPermission('admin')) {
    erro.value = 'Acesso negado.'
    router.push('/')
    return
  }
  await carregarHistorico()
})
</script>
