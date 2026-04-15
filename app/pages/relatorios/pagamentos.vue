<template>
  <div>
    <h1 class="text-2xl font-bold mb-6">Relatório de Pagamentos</h1>

    <div class="card bg-base-100 shadow-xl mb-6">
      <div class="card-body">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div class="form-control">
            <label class="label p-0 mb-2">
              <span class="label-text font-medium">Período</span>
            </label>
            <VueDatePicker
              v-model="filtroData"
              :formats="{ input: 'dd/MM/yyyy'}"
              :format="formatarValorDatePicker"
              :range="{ partialRange: false }"
              :enable-time-picker="false"
              model-type="yyyy-MM-dd"
              input-class-name="w-full"
              auto-apply
              class="w-full datepicker-input"
            />
            <label class="label p-0 mt-1">
              <span class="label-text-alt text-base-content/60">Selecione um dia ou um período</span>
            </label>
          </div>

          <div class="form-control">
            <label class="label p-0 mb-2">
              <span class="label-text font-medium">Documento</span>
            </label>
            <div class="join w-full">
              <select v-model="tipoDocumento" class="select select-bordered join-item w-24" @change="onTipoDocumentoChange">
                <option value="cpf">CPF</option>
                <option value="cnpj">CNPJ</option>
              </select>
              <input
                inputmode="numeric"
                type="text"
                class="input input-bordered join-item flex-1"
                :placeholder="documentoPlaceholder"
                :value="documentoMascarado"
                @input="onDocumentoInput"
              />
            </div>
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
                <th>CPF/CNPJ</th>
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
              <tr v-for="p in rowsPaginados" :key="p.id">
                <td>{{ formatarData(p.data) }}</td>
                <td>{{ formatarDocumento(p.codigo_contribuinte) }}</td>
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

        <div class="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div class="text-sm text-base-content/70">
            Exibindo {{ inicioPagina }}-{{ fimPagina }} de {{ totalRegistros }} registro(s)
          </div>

          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-sm">Itens por página</span>
            <select v-model.number="itensPorPagina" class="select select-bordered select-sm w-24">
              <option v-for="opcao in opcoesItensPorPagina" :key="opcao" :value="opcao">{{ opcao }}</option>
            </select>

            <button class="btn btn-sm" :disabled="paginaAtual <= 1" @click="paginaAtual -= 1">Anterior</button>
            <span class="text-sm px-1">Página {{ paginaAtual }} de {{ totalPaginas }}</span>
            <button class="btn btn-sm" :disabled="paginaAtual >= totalPaginas" @click="paginaAtual += 1">Próxima</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { VueDatePicker } from '@vuepic/vue-datepicker'
import '@vuepic/vue-datepicker/dist/main.css'

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
const hoje = new Date().toISOString().slice(0, 10)
const filtroData = ref<[string, string] | null>([hoje, hoje])
type TipoDocumento = 'cpf' | 'cnpj'

const tipoDocumento = ref<TipoDocumento>('cpf')
const documentoDigits = ref('')
const filtroServicos = ref<string[]>([])
const filtroSituacao = ref('')
const filtroTipoPagamento = ref('')
const opcoesServico = ref<string[]>([])
const opcoesSituacao = ref<string[]>([])
const opcoesTipoPagamento = ref<string[]>([])
const opcoesItensPorPagina = [10, 20, 30, 40, 50, 100]
const itensPorPagina = ref(30)
const paginaAtual = ref(1)

const totalRegistros = computed(() => rows.value.length)
const totalPaginas = computed(() => Math.max(1, Math.ceil(totalRegistros.value / itensPorPagina.value)))
const inicioPagina = computed(() => (totalRegistros.value === 0 ? 0 : (paginaAtual.value - 1) * itensPorPagina.value + 1))
const fimPagina = computed(() => Math.min(totalRegistros.value, paginaAtual.value * itensPorPagina.value))
const rowsPaginados = computed(() => {
  const inicio = (paginaAtual.value - 1) * itensPorPagina.value
  return rows.value.slice(inicio, inicio + itensPorPagina.value)
})

const documentoMaxLength = computed(() => (tipoDocumento.value === 'cpf' ? 11 : 14))
const documentoPlaceholder = computed(() => (tipoDocumento.value === 'cpf' ? '___.___.___-__' : '__.___.___/____-__'))
const documentoMascarado = computed(() => formatInputDocumento(documentoDigits.value, tipoDocumento.value))

function formatInputDocumento(digits: string, tipo: TipoDocumento): string {
  const d = digits.replace(/\D/g, '').slice(0, tipo === 'cpf' ? 11 : 14)

  if (tipo === 'cnpj') {
    if (d.length <= 2) return d
    if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`
    if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`
    if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`
  }

  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`
}

function onTipoDocumentoChange(): void {
  documentoDigits.value = documentoDigits.value.slice(0, documentoMaxLength.value)
}

function onDocumentoInput(ev: Event): void {
  const target = ev.target as HTMLInputElement
  documentoDigits.value = target.value.replace(/\D/g, '').slice(0, documentoMaxLength.value)
}

function formatarDocumento(documento: string): string {
  const digits = documento.replace(/\D/g, '')
  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  }
  if (digits.length === 14) {
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  }
  return documento || '—'
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
    CR: 'Criado',
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

function formatarDataVisual(dataIso: string): string {
  const match = dataIso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return dataIso
  return `${match[3]}/${match[2]}/${match[1]}`
}

function formatarValorDatePicker(value: string | string[]): string {
  const formatar = (dataIso: string): string => formatarDataVisual(dataIso)

  if (Array.isArray(value)) {
    const [inicio, fim] = value
    const inicioFormatado = inicio ? formatar(inicio) : ''
    const fimFormatado = fim ? formatar(fim) : ''

    if (inicioFormatado && fimFormatado) return `${inicioFormatado} - ${fimFormatado}`
    if (inicioFormatado) return inicioFormatado
    return ''
  }

  return formatar(value)
}

function obterPeriodoSelecionado(): { dataInicio?: string; dataFim?: string } {
  if (!filtroData.value) return {}

  const [inicio, fim] = filtroData.value
  const dataInicio = inicio ?? ''
  const dataFim = fim ?? ''
  if (!dataInicio || !dataFim || dataInicio > dataFim) return {}
  return { dataInicio, dataFim }
}

async function buscar(): Promise<void> {
  erro.value = null
  paginaAtual.value = 1

  if (documentoDigits.value && documentoDigits.value.length !== documentoMaxLength.value) {
    erro.value = tipoDocumento.value === 'cpf'
      ? 'Informe um CPF válido (11 dígitos).'
      : 'Informe um CNPJ válido (14 dígitos).'
    return
  }

  const periodo = obterPeriodoSelecionado()

  carregando.value = true
  try {
    rows.value = await $fetch<PagamentoRow[]>('/api/relatorios/pagamentos', {
      query: {
        data_inicio: periodo.dataInicio,
        data_fim: periodo.dataFim,
        cpf: documentoDigits.value || undefined,
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
    opcoesSituacao.value = ['CR', 'IN', 'SU', 'CO', 'CG', 'ER', 'CA', 'RE']
    opcoesTipoPagamento.value = []
  }
}

onMounted(async () => {
  await carregarFiltros()
  await buscar()
})

watch([itensPorPagina, totalPaginas], () => {
  if (paginaAtual.value > totalPaginas.value) {
    paginaAtual.value = totalPaginas.value
  }
})
</script>

<style scoped>
.datepicker-input {
  width: 100%;
}

.datepicker-input :deep(.dp__input) {
  height: 3rem;
  border-radius: 0.5rem;
  padding-left: 30px;
  padding-right: 3rem;
}

.datepicker-input :deep(.dp__input_icon_pad) {
  padding-right: 3rem !important;
}
</style>
