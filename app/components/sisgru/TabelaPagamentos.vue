<template>
  <div class="overflow-x-auto">
    <table class="table table-zebra table-hover w-full">
      <thead>
        <tr>
          <th class="w-24">ID</th>
          <th class="w-48">Contribuinte</th>
          <th class="w-32">CPF</th>
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
          <th class="w-24">Data</th>
          <th class="w-36">Ticket</th>
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
            <td>{{ p.id }}</td>
            <td>{{ p.nome_contribuinte }}</td>
            <td class="font-mono text-xs">{{ mascaraCpf(p.codigo_contribuinte) }}</td>
            <td>{{ p.servico_nome }}</td>
            <td class="text-right">{{ formatarMoeda(p.valor_total) }}</td>
            <td>
              <span
                class="badge"
                :class="{
                  'badge-success': p.situacao === 'CO',
                  'badge-warning': p.situacao === 'RE',
                  'badge-neutral': p.situacao !== 'CO' && p.situacao !== 'RE'
                }"
              >{{ traducaoSituacao(p.situacao) }}</span>
            </td>
            <td>{{ p.tipo_pagamento_nome }}</td>
            <td>{{ formatarData(p.data) }}</td>
            <td>
              <template v-if="String(p.servico_id) === '14671'">
                <span v-if="p.ticket_retirado" class="text-success flex items-center gap-1">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                  Retirado
                </span>
                <button
                  v-else
                  class="btn btn-xs btn-neutral"
                  @click="abrirModal(p)"
                >
                  Registrar Entrega
                </button>
              </template>
            </td>
          </tr>
        </TransitionGroup>
      </tbody>
      <tfoot v-if="pagamentosFiltrados.length > 0">
        <tr>
          <td colspan="4" class="font-semibold text-neutral text-base">
            Total: {{ pagamentosFiltrados.length }} registro{{ pagamentosFiltrados.length !== 1 ? 's' : '' }}
          </td>
          <td class="text-right font-semibold text-neutral text-base">{{ formatarMoeda(somaTotal) }}</td>
          <td colspan="4"></td>
        </tr>
      </tfoot>
    </table>

    <dialog ref="modalRef" class="modal">
      <div class="modal-box">
        <h3 class="font-bold text-lg">Confirmar Entrega</h3>
        <p class="py-4">
          Confirmar a entrega do ticket refeição para<br>
          <strong>{{ pagamentoSelecionado?.nome_contribuinte }}</strong>?
        </p>
        <div class="modal-action">
          <form method="dialog">
            <button class="btn btn-ghost mr-2">Cancelar</button>
            <button class="btn btn-primary" @click.prevent="confirmarEntrega">Confirmar</button>
          </form>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>
  </div>
</template>

<script setup lang="ts">
export interface PagamentoRow {
  id: number
  nome_contribuinte: string
  codigo_contribuinte: string
  servico_nome: string
  servico_id: number
  valor_total: number
  situacao: string
  tipo_pagamento_nome: string
  data: string
  ticket_retirado: boolean
  ticket_retirado_em?: string
  ticket_retirado_por_nome?: string
}

interface ServicoOpcao {
  id: string
  nome: string
}

const props = defineProps<{
  pagamentos: PagamentoRow[]
}>()

const emit = defineEmits<{
  'marcar-ticket': [id: number]
}>()

const modalRef = ref<HTMLDialogElement | null>(null)
const pagamentoSelecionado = ref<PagamentoRow | null>(null)

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
  pagamentosFiltrados.value.reduce((acc, p) => acc + Number(p.valor_total), 0)
)

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
  const d = new Date(data)
  if (isNaN(d.getTime())) return data
  return d.toLocaleDateString('pt-BR')
}

function mascaraCpf(cpf: string): string {
  const digits = cpf.replace(/\D/g, '')
  if (digits.length !== 11) return cpf
  return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`
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

function abrirModal(pagamento: PagamentoRow) {
  pagamentoSelecionado.value = pagamento
  modalRef.value?.showModal()
}

function confirmarEntrega() {
  if (pagamentoSelecionado.value) {
    emit('marcar-ticket', pagamentoSelecionado.value.id)
  }
  modalRef.value?.close()
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
