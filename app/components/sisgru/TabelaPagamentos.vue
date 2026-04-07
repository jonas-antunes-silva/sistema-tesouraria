<template>
  <div class="overflow-x-auto">
    <table class="table table-zebra table-hover w-full">
      <thead>
        <tr>
          <!-- <th class="w-24">ID</th>
          <th class="w-32">Código</th> -->
          <th class="w-48">Contribuinte</th>
          <th class="w-32">CPF</th>
          <th class="w-40">Número de Referência</th>
          <th class="w-64">
            <div class="dropdown dropdown-hover dropdown-bottom dropdown-end">
              <label tabindex="0" class="flex items-center gap-1 cursor-pointer">
                Serviço
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
              </label>
              <ul tabindex="0" class="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-64">
                <li v-for="servico in servicosUnicos" :key="servico.id">
                  <label class="flex items-center gap-2 cursor-pointer py-1">
                    <input
                      type="checkbox"
                      class="checkbox checkbox-sm"
                      :checked="servicosSelecionados.includes(servico.id)"
                      @change="toggleServico(servico.id)"
                    />
                    <span class="text-sm">{{ servico.nome }}</span>
                  </label>
                </li>
              </ul>
            </div>
          </th>
          <th class="w-32">Valor Total (R$)</th>
          <th class="w-28">Situação</th>
          <th class="w-40">Tipo Pagamento</th>
          <th class="w-24">Data SISGRU</th>
          <!-- <th class="w-24">Data PagTesouro</th> -->
          <th class="w-36">Data PSP</th>
          <!-- <th class="w-36">Criação</th>
          <th class="w-36">Sync</th> -->
        </tr>
      </thead>
      <tbody>
        <tr v-if="pagamentosFiltrados.length === 0">
          <td colspan="9" class="text-center text-base-content/60 py-8">
            Nenhum registro encontrado
          </td>
        </tr>
        <TransitionGroup name="list">
          <tr v-for="p in pagamentosFiltrados" :key="p.id">
            <!-- <td>{{ p.id }}</td>
            <td class="font-mono text-xs">{{ p.codigo }}</td> -->
            <td>{{ p.nome_contribuinte }}</td>
            <td class="font-mono text-xs">{{ formatarCpf(p.codigo_contribuinte) }}</td>
            <td>{{ p.numero_referencia ?? '—' }}</td>
            <td>
              <div class="flex items-center gap-2">
                <span>{{ p.servico_nome }}</span>
                <button
                  v-if="p.situacao === 'CO'"
                  class="btn btn-ghost btn-xs"
                  title="Retificar serviço"
                  @click="abrirRetificacao(p)"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="h-4 w-4" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7h11m0 0l-3-3m3 3l-3 3M20 17H9m0 0l3-3m-3 3l3 3" />
                  </svg>
                </button>
                <button
                  v-if="p.retificado"
                  class="badge badge-info badge-outline cursor-pointer"
                  title="Ver histórico de retificações"
                  @click="abrirHistorico(p)"
                >
                  Retificado
                </button>
              </div>
            </td>
            <td>{{ formatarMoeda(p.valor_total) }}</td>
            <td>
              <span
                class="badge"
                :class="{
                  'badge-success text-white': p.situacao === 'CO',
                  'badge-warning text-neutral': p.situacao === 'CA',
                  'badge-error text-white': p.situacao === 'RE',
                  'badge-neutral': p.situacao !== 'CO' && p.situacao !== 'CA' && p.situacao !== 'RE'
                }"
              >{{ traducaoSituacao(p.situacao) }}</span>
            </td>
            <td>{{ p.tipo_pagamento_nome }}</td>
            <td>{{ formatarData(p.data) }}</td>
            <!-- <td>{{ formatarData(p.data_alteracao_situacao_pag_tesouro) }}</td> -->
            <td>{{ formatarDataHora(p.data_pagamento_psp) }}</td>
            <!-- <td>{{ formatarDataHora(p.dt_criacao) }}</td>
            <td>{{ formatarDataHora(p.sincronizado_em) }}</td> -->
          </tr>
        </TransitionGroup>
      </tbody>
      <tfoot v-if="pagamentosFiltrados.length > 0">
        <tr>
          <td colspan="5" class="font-semibold text-neutral text-base">
            Total: {{ pagamentosFiltrados.length }} registro{{ pagamentosFiltrados.length !== 1 ? 's' : '' }}
          </td>
          <td class="text-right font-semibold text-neutral text-base">{{ formatarMoeda(somaTotal) }}</td>
          <td colspan="3"></td>
        </tr>
      </tfoot>
    </table>
  </div>

  <dialog ref="retificacaoModal" class="modal">
    <div class="modal-box">
      <h3 class="font-bold text-lg">Retificar tipo de serviço</h3>

      <p v-if="pagamentoSelecionado" class="text-sm mt-2">
        Pagamento #{{ pagamentoSelecionado.id }} - {{ pagamentoSelecionado.nome_contribuinte }}
      </p>
      <p v-if="pagamentoSelecionado" class="text-sm text-base-content/70">
        Serviço atual: {{ pagamentoSelecionado.servico_nome }}
      </p>

      <div class="form-control mt-4">
        <label class="label" for="novo-servico">
          <span class="label-text">Novo tipo de serviço</span>
        </label>
        <select id="novo-servico" v-model="novoServicoSelecionado" class="select select-bordered w-full">
          <option disabled value="">Selecione...</option>
          <option v-for="servico in opcoesRetificacao" :key="servico.id" :value="servico.id">
            {{ servico.nome }}
          </option>
        </select>
      </div>

      <div v-if="erroRetificacao" class="alert alert-error mt-4 py-2">
        <span>{{ erroRetificacao }}</span>
      </div>

      <div class="modal-action">
        <button class="btn btn-ghost" :disabled="retificando" @click="fecharRetificacao">Cancelar</button>
        <button class="btn btn-primary" :disabled="retificando || !novoServicoSelecionado" @click="confirmarRetificacao">
          <span v-if="retificando" class="loading loading-spinner loading-xs"></span>
          Confirmar
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button @click="fecharRetificacao">close</button>
    </form>
  </dialog>

  <dialog ref="historicoModal" class="modal">
    <div class="modal-box max-w-3xl">
      <h3 class="font-bold text-lg">Histórico de retificações</h3>

      <div v-if="carregandoHistorico" class="flex justify-center py-8">
        <span class="loading loading-spinner loading-md"></span>
      </div>

      <div v-else-if="historicoRetificacoes.length === 0" class="py-6 text-base-content/70">
        Nenhuma retificação registrada para este pagamento.
      </div>

      <div v-else class="overflow-x-auto mt-4">
        <table class="table table-zebra w-full">
          <thead>
            <tr>
              <th>Quando</th>
              <th>Troca</th>
              <th>Por</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in historicoRetificacoes" :key="item.id">
              <td>{{ formatarDataHora(item.retificado_em) }}</td>
              <td>
                {{ item.servico_nome_anterior }}
                <span class="text-base-content/50">→</span>
                {{ item.servico_nome_novo }}
              </td>
              <td>{{ item.retificado_por_nome }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="modal-action">
        <button class="btn" @click="fecharHistorico">Fechar</button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button @click="fecharHistorico">close</button>
    </form>
  </dialog>
</template>

<script setup lang="ts">
export interface PagamentoRow {
  id: number
  codigo: string
  nome_contribuinte: string
  codigo_contribuinte: string
  numero_referencia: number | null
  servico_nome: string
  servico_id: number
  valor_total: number
  situacao: string
  tipo_pagamento_nome: string
  data: string
  data_alteracao_situacao_pag_tesouro: string
  data_pagamento_psp: string | null
  dt_criacao: string
  sincronizado_em: string
  retificado: boolean
  retificado_em: string | null
}

interface RetificacaoHistoricoRow {
  id: number
  servico_id_anterior: number
  servico_nome_anterior: string
  servico_id_novo: number
  servico_nome_novo: string
  retificado_por: string
  retificado_por_nome: string
  retificado_em: string
}

interface ServicoOpcao {
  id: string
  nome: string
}

const props = defineProps<{
  pagamentos: PagamentoRow[]
}>()

const emit = defineEmits<{
  retificado: []
}>()

const servicosUnicos = computed<ServicoOpcao[]>(() => {
  const seen = new Set<string>()
  const result: ServicoOpcao[] = []
  for (const p of props.pagamentos) {
    const id = String(p.servico_id)
    if (!seen.has(id) && p.servico_nome) {
      seen.add(id)
      result.push({ id, nome: p.servico_nome })
    }
  }
  return result.sort((a, b) => a.nome.localeCompare(b.nome))
})

const servicosSelecionados = ref<string[]>(['14671', '16279'])

const pagamentosFiltrados = computed(() =>
  props.pagamentos.filter(p => servicosSelecionados.value.includes(String(p.servico_id)))
)

const somaTotal = computed(() =>
  pagamentosFiltrados.value
    .filter((p) => p.situacao === 'CO')
    .reduce((acc, p) => acc + Number(p.valor_total), 0)
)

const retificacaoModal = ref<HTMLDialogElement | null>(null)
const historicoModal = ref<HTMLDialogElement | null>(null)
const pagamentoSelecionado = ref<PagamentoRow | null>(null)
const novoServicoSelecionado = ref<string>('')
const retificando = ref(false)
const erroRetificacao = ref<string | null>(null)

const carregandoHistorico = ref(false)
const historicoRetificacoes = ref<RetificacaoHistoricoRow[]>([])

const opcoesRetificacao = computed<ServicoOpcao[]>(() => {
  const atual = pagamentoSelecionado.value
  if (!atual) return []
  return servicosUnicos.value.filter((s) => Number(s.id) !== atual.servico_id)
})

function abrirRetificacao(pagamento: PagamentoRow): void {
  pagamentoSelecionado.value = pagamento
  novoServicoSelecionado.value = ''
  erroRetificacao.value = null
  retificacaoModal.value?.showModal()
}

function fecharRetificacao(): void {
  if (retificando.value) return
  retificacaoModal.value?.close()
}

function mensagemErroApi(err: unknown, fallback: string): string {
  if (err && typeof err === 'object') {
    const maybeData = (err as { data?: { statusMessage?: string } }).data
    if (maybeData?.statusMessage) return maybeData.statusMessage
    const maybeStatus = (err as { statusMessage?: string }).statusMessage
    if (maybeStatus) return maybeStatus
  }
  return fallback
}

async function confirmarRetificacao(): Promise<void> {
  const pagamento = pagamentoSelecionado.value
  if (!pagamento || !novoServicoSelecionado.value) return

  const novoServico = servicosUnicos.value.find((s) => s.id === novoServicoSelecionado.value)
  if (!novoServico) {
    erroRetificacao.value = 'Serviço selecionado inválido'
    return
  }

  retificando.value = true
  erroRetificacao.value = null

  try {
    await $fetch(`/api/sisgru/pagamentos/${pagamento.id}/retificar`, {
      method: 'POST',
      body: {
        novo_servico_id: Number(novoServico.id),
        novo_servico_nome: novoServico.nome,
      },
    })

    fecharRetificacao()
    emit('retificado')
  } catch (err: unknown) {
    erroRetificacao.value = mensagemErroApi(err, 'Não foi possível retificar este pagamento')
  } finally {
    retificando.value = false
  }
}

async function abrirHistorico(pagamento: PagamentoRow): Promise<void> {
  pagamentoSelecionado.value = pagamento
  historicoRetificacoes.value = []
  carregandoHistorico.value = true
  historicoModal.value?.showModal()

  try {
    historicoRetificacoes.value = await $fetch<RetificacaoHistoricoRow[]>(
      `/api/sisgru/pagamentos/${pagamento.id}/retificacoes`,
    )
  } catch {
    historicoRetificacoes.value = []
  } finally {
    carregandoHistorico.value = false
  }
}

function fecharHistorico(): void {
  historicoModal.value?.close()
}

function toggleServico(id: string) {
  const idx = servicosSelecionados.value.indexOf(id)
  if (idx === -1) {
    servicosSelecionados.value.push(id)
  } else {
    servicosSelecionados.value.splice(idx, 1)
  }
}

function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatarData(data: string): string {
  if (!data) return '—'
  const match = data.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) {
    const [, year, month, day] = match
    return `${day}/${month}/${year}`
  }
  return data
}

function formatarDataHora(data: string | null | undefined): string {
  if (!data) return '—'
  const match = data.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/)
  if (match) {
    const [, year, month, day, hour, minute] = match
    let h = parseInt(hour, 10) - 3
    let d = parseInt(day, 10)
    let m = parseInt(month, 10)
    let y = parseInt(year, 10)
    if (h < 0) {
      h += 24
      d -= 1
      if (d < 1) {
        m -= 1
        if (m < 1) {
          m = 12
          y -= 1
        }
        const diasNoMes = new Date(y, m, 0).getDate()
        d = diasNoMes
      }
    }
    return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y} ${String(h).padStart(2, '0')}:${minute}`
  }
  return data
}

function formatarCpf(cpf: string): string {
  const digits = cpf.replace(/\D/g, '')
  if (digits.length !== 11) return cpf
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`
}

function traducaoSituacao(codigo: string): string {
  const traducoes: Record<string, string> = {
    CR: 'Criado',
    IN: 'Iniciado',
    SU: 'Submetido',
    CO: 'Concluído',
    ER: 'Erro',
    CA: 'Cancelado',
    RE: 'Rejeitado',
  }
  return traducoes[codigo] ?? codigo
}
</script>

<style scoped>
.list-enter-active,
.list-leave-active {
  transition: opacity 0.3s ease;
}
.list-enter-from,
.list-leave-to {
  opacity: 0;
}
</style>
