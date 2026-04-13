<template>
  <div>
    <h1 class="text-2xl font-bold mb-6">Relatório de Baixas de Impressões</h1>

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
                <th>Data/Hora</th>
                <th>CPF/CNPJ</th>
                <th>Nome</th>
                <th>Nº Cópias</th>
                <th>Valor Total</th>
                <th>Saldo Após</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="rows.length === 0">
                <td colspan="7" class="text-center text-base-content/60 py-8">Nenhum registro encontrado</td>
              </tr>
              <tr v-for="u in rowsPaginados" :key="u.id">
                <td>{{ formatarDataHora(u.registrado_em) }}</td>
                <td>{{ formatarDocumento(u.cpf) }}</td>
                <td>{{ u.nome }}</td>
                <td>{{ u.num_copias }}</td>
                <td>{{ formatarMoeda(u.valor_total) }}</td>
                <td>{{ formatarMoeda(u.saldo_posterior) }}</td>
                <td>
                  <span v-if="u.estornado" class="badge badge-warning">Estornado</span>
                  <span v-else class="badge badge-success">Ativo</span>
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

interface UsoRow {
  id: number
  cpf: string
  nome: string
  num_copias: number
  valor_total: number
  saldo_posterior: number
  registrado_em: string
  estornado: boolean
}

const rows = ref<UsoRow[]>([])
const carregando = ref(false)
const erro = ref<string | null>(null)
const hoje = new Date().toISOString().slice(0, 10)
const filtroData = ref<[string, string] | null>([hoje, hoje])
type TipoDocumento = 'cpf' | 'cnpj'

const tipoDocumento = ref<TipoDocumento>('cpf')
const documentoDigits = ref('')
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

function formatarDataHora(data: string): string {
  if (!data) return '—'
  const dt = new Date(data)
  if (Number.isNaN(dt.getTime())) return data
  return dt.toLocaleString('pt-BR')
}

function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
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
    rows.value = await $fetch<UsoRow[]>('/api/relatorios/reprografia-baixas', {
      query: {
        data_inicio: periodo.dataInicio,
        data_fim: periodo.dataFim,
        cpf: documentoDigits.value || undefined,
      },
    })
  } catch (err: unknown) {
    const maybeData = (err as { data?: { statusMessage?: string } })?.data
    const maybeStatus = (err as { statusMessage?: string })?.statusMessage
    erro.value = maybeData?.statusMessage || maybeStatus || 'Erro ao carregar relatório de reprografia.'
    rows.value = []
  } finally {
    carregando.value = false
  }
}

onMounted(buscar)

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
