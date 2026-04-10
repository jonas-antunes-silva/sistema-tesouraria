<template>
  <div>
    <h1 class="text-2xl font-bold mb-6">Relatório de Pagamentos</h1>

    <div class="card bg-base-100 shadow-xl mb-6">
      <div class="card-body">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="form-control">
            <label class="label p-0 mb-2">
              <span class="label-text font-medium">Data</span>
            </label>
            <input v-model="filtroData" type="date" class="input input-bordered" />
          </div>

          <div class="form-control">
            <label class="label p-0 mb-2">
              <span class="label-text font-medium">CPF</span>
            </label>
            <input
              inputmode="numeric"
              type="text"
              class="input input-bordered"
              placeholder="___.___.___-__"
              :value="cpfMascarado"
              @input="onCpfInput"
            />
          </div>

          <div class="form-control">
            <label class="label p-0 mb-2">
              <span class="label-text font-medium">Serviço</span>
            </label>
            <select
              v-model="filtroServicos"
              class="select select-bordered h-28"
              multiple
            >
              <option v-for="servico in opcoesServico" :key="servico" :value="servico">
                {{ servico }}
              </option>
            </select>
            <label class="label p-0 mt-1">
              <span class="label-text-alt text-base-content/60">Segure Ctrl para selecionar vários</span>
            </label>
          </div>

          <div class="form-control">
            <label class="label p-0 mb-2">
              <span class="label-text font-medium">Situação</span>
            </label>
            <select v-model="filtroSituacao" class="select select-bordered">
              <option value="">Todas</option>
              <option v-for="situacao in opcoesSituacao" :key="situacao" :value="situacao">
                {{ traduzirSituacao(situacao) }}
              </option>
            </select>
          </div>

          <div class="form-control">
            <label class="label p-0 mb-2">
              <span class="label-text font-medium">Tipo de Pagamento</span>
            </label>
            <select v-model="filtroTipoPagamento" class="select select-bordered">
              <option value="">Todos</option>
              <option v-for="tipo in opcoesTipoPagamento" :key="tipo" :value="tipo">
                {{ tipo }}
              </option>
            </select>
          </div>

          <div class="form-control justify-end">
            <button class="btn btn-primary" :disabled="carregando" @click="buscar">
              <span v-if="carregando" class="loading loading-spinner loading-sm"></span>
              <span v-else>Filtrar</span>
            </button>
          </div>
        </div>

        <div v-if="erro" role="alert" class="alert alert-error mt-4">
          <span>{{ erro }}</span>
        </div>
      </div>
    </div>

    <div class="card bg-base-100 shadow-xl">
      <div class="card-body">
        <h2 class="card-title mb-4">Resultado</h2>

        <div class="overflow-auto max-h-[65vh]">
          <table class="table table-zebra text-left">
            <thead>
              <tr>
                <th>Data</th>
                <th>CPF</th>
                <th>Contribuinte</th>
                <th>Serviço</th>
                <th>Tipo de Pagto</th>
                <th>Situação</th>
                <th>Valor</th>
                <th>Retificado</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="rows.length === 0">
                <td colspan="8" class="text-center text-base-content/60 py-8">Nenhum registro encontrado</td>
              </tr>
              <tr v-for="p in rows" :key="p.id">
                <td>{{ formatarData(p.data) }}</td>
                <td>{{ formatarCpf(p.codigo_contribuinte) }}</td>
                <td>{{ p.nome_contribuinte }}</td>
                <td>{{ p.servico_nome }}</td>
                <td>{{ p.tipo_pagamento_nome }}</td>
                <td>
                  <span class="badge" :class="badgeSituacao(p.situacao)">{{ traduzirSituacao(p.situacao) }}</span>
                </td>
                <td>{{ formatarMoeda(p.valor_total) }}</td>
                <td>
                  <span v-if="p.retificado" class="badge badge-info">Sim</span>
                  <span v-else class="badge badge-ghost">Não</span>
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

interface PagamentoRow {
  id: number
  codigo_contribuinte: string
  nome_contribuinte: string
  servico_nome: string
  tipo_pagamento_nome: string
  situacao: string
  valor_total: number
  data: string
  retificado: boolean
}

interface PagamentosFiltrosResponse {
  servicos: string[]
  tiposPagamento: string[]
  situacoes: string[]
}

const rows = ref<PagamentoRow[]>([])
const carregando = ref(false)
const erro = ref<string | null>(null)
const filtroData = ref(new Date().toISOString().slice(0, 10))
const cpfDigits = ref('')
const filtroServicos = ref<string[]>([])
const filtroSituacao = ref('')
const filtroTipoPagamento = ref('')
const opcoesServico = ref<string[]>([])
const opcoesSituacao = ref<string[]>([])
const opcoesTipoPagamento = ref<string[]>([])

const cpfMascarado = computed(() => formatInputCpf(cpfDigits.value))

function formatInputCpf(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`
}

function onCpfInput(ev: Event): void {
  const target = ev.target as HTMLInputElement
  cpfDigits.value = target.value.replace(/\D/g, '').slice(0, 11)
}

function formatarCpf(cpf: string): string {
  const digits = cpf.replace(/\D/g, '')
  if (digits.length !== 11) return cpf || '—'
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

function formatarData(data: string): string {
  if (!data) return '—'
  const m = data.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return data
  return `${m[3]}/${m[2]}/${m[1]}`
}

function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function badgeSituacao(s: string): string {
  if (s === 'CO') return 'badge-success'
  if (s === 'CG') return 'badge-info'
  if (s === 'CA') return 'badge-warning'
  if (s === 'RE') return 'badge-error'
  return 'badge-neutral'
}

function traduzirSituacao(codigo: string): string {
  const map: Record<string, string> = {
    IN: 'Iniciado',
    SU: 'Submetido',
    CO: 'Concluído',
    CG: 'GRU',
    ER: 'Erro',
    CA: 'Cancelado',
    RE: 'Rejeitado',
  }
  return map[codigo] ?? codigo
}

async function buscar(): Promise<void> {
  erro.value = null

  if (cpfDigits.value && cpfDigits.value.length !== 11) {
    erro.value = 'Informe um CPF válido (11 dígitos).'
    return
  }

  carregando.value = true
  try {
    rows.value = await $fetch<PagamentoRow[]>('/api/relatorios/pagamentos', {
      query: {
        data: filtroData.value || undefined,
        cpf: cpfDigits.value || undefined,
        servicos: filtroServicos.value.length > 0 ? filtroServicos.value.join(',') : undefined,
        situacao: filtroSituacao.value || undefined,
        tipo_pagamento: filtroTipoPagamento.value || undefined,
      },
    })
  } catch (err: unknown) {
    const maybeData = (err as { data?: { statusMessage?: string } })?.data
    const maybeStatus = (err as { statusMessage?: string })?.statusMessage
    erro.value = maybeData?.statusMessage || maybeStatus || 'Erro ao carregar relatório de pagamentos.'
    rows.value = []
  } finally {
    carregando.value = false
  }
}

async function carregarFiltros(): Promise<void> {
  try {
    const payload = await $fetch<PagamentosFiltrosResponse>('/api/relatorios/pagamentos-filtros')
    opcoesServico.value = payload.servicos
    opcoesSituacao.value = payload.situacoes
    opcoesTipoPagamento.value = payload.tiposPagamento
  } catch {
    opcoesServico.value = []
    opcoesSituacao.value = ['IN', 'SU', 'CO', 'CG', 'ER', 'CA', 'RE']
    opcoesTipoPagamento.value = []
  }
}

onMounted(async () => {
  await carregarFiltros()
  await buscar()
})
</script>
