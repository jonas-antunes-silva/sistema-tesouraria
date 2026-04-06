<template>
  <div>
    <h1 class="text-2xl font-bold mb-6">Ticket Refeição</h1>

    <div class="card bg-base-100 shadow-xl mb-6">
      <div class="card-body">
        <div class="flex items-end gap-4 flex-wrap">
          <div class="flex-1 min-w-[240px]">
            <label class="label p-0 mb-2">
              <span class="label-text font-medium">CPF do Beneficiário</span>
            </label>
            <input
              inputmode="numeric"
              type="text"
              class="input input-bordered w-full"
              placeholder="___.___.___-__"
              :value="cpfMascarado"
              @input="onCpfInput"
              autocomplete="off"
            />
          </div>
          <button class="btn btn-primary" @click="buscar" :disabled="carregando">
            <span v-if="carregando" class="loading loading-spinner loading-sm"></span>
            <span v-else>Buscar</span>
          </button>
        </div>
        <div v-if="erroValidacao" role="alert" class="alert alert-error mt-3">
          <span>{{ erroValidacao }}</span>
        </div>
      </div>
    </div>

    <Transition name="toast">
      <div v-if="sucessoEntrega" class="toast toast-top toast-center">
        <div class="alert alert-success text-white">
          <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{{ sucessoEntrega }}</span>
          <button class="btn btn-ghost btn-xs text-white" @click="sucessoEntrega = null">✕</button>
        </div>
      </div>
    </Transition>

    <Transition name="slide-fade">
      <div v-if="resumo && resumo.pagamentos.length > 0" class="card bg-base-100 shadow-xl mb-6">
        <div class="card-body">
          <div class="flex justify-between items-center mb-4">
            <div>
              <h2 class="text-lg font-semibold">{{ resumo.nome }}</h2>
              <p class="text-sm text-base-content/60">{{ formatarCpf(resumo.cpf) }}</p>
            </div>
            <div class="text-right">
              <p class="text-sm text-base-content/60">Saldo disponível</p>
              <p class="text-2xl font-bold text-primary">{{ formatarMoeda(resumo.saldo_disponivel) }}</p>
              <p class="text-sm text-base-content/60">{{ resumo.pagamentos.length }} pagamento(s) concluído(s)</p>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <div class="stats bg-base-200">
              <div class="stat py-3 px-4">
                <div class="stat-title text-xs">Créditos acumulados</div>
                <div class="stat-value text-lg">{{ formatarMoeda(resumo.total_creditos) }}</div>
              </div>
            </div>
            <div class="stats bg-base-200">
              <div class="stat py-3 px-4">
                <div class="stat-title text-xs">Já consumido</div>
                <div class="stat-value text-lg">{{ formatarMoeda(resumo.total_consumido) }}</div>
              </div>
            </div>
            <div class="stats bg-base-200">
              <div class="stat py-3 px-4">
                <div class="stat-title text-xs">Máx. tickets (tipo atual)</div>
                <div class="stat-value text-lg">{{ maxTickets }} </div>
              </div>
            </div>
          </div>

          <div class="max-h-[40vh] overflow-auto">
            <table class="table table-zebra text-left">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Valor</th>
                  <th>Situação do pagamento</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="p in resumo.pagamentos" :key="p.id">
                  <td>{{ formatarData(p.data) }}</td>
                  <td>{{ formatarMoeda(p.valor_total) }}</td>
                  <td>
                    <span class="badge" :class="traducaoSituacaoClasse(p.situacao)">
                      {{ traducaoSituacao(p.situacao) }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="card-actions justify-end mt-4">
            <button class="btn btn-primary" @click="abrirModal" :disabled="!temTipoDisponivel">
              Registrar Entrega
            </button>
          </div>
        </div>
      </div>
      <div v-else-if="buscou && (!resumo || resumo.pagamentos.length === 0)" class="alert mb-6">
        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <span>Nenhum crédito disponível para este CPF.</span>
      </div>
    </Transition>

    <div class="card bg-base-100 shadow-xl">
      <div class="card-body">
        <h2 class="card-title mb-4">Entregas do Dia</h2>
        
        <div v-if="carregandoTransacoes" class="flex justify-center py-4">
          <span class="loading loading-spinner loading-lg"></span>
        </div>
        
        <div v-else-if="transacoes.length === 0" class="text-center text-base-content/60 py-4">
          Nenhuma transação hoje
        </div>
        
        <div v-else class="max-h-[50vh] overflow-auto">
          <table class="table table-zebra text-left">
            <thead>
              <tr>
                <th>Horário</th>
                <th>Entregue por:</th>
                <th>CPF</th>
                <th>Beneficiário</th>
                <th>Tipo</th>
                <th>Qtd</th>
                <th>Consumo</th>
                <th>Saldo após</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="t in transacoes" :key="t.id">
                <td>{{ formatarDataHora(t.criado_em) }}</td>
                <td>{{ t.responsavel_nome }}</td>
                <td>{{ t.codigo_contribuinte ? formatarCpf(t.codigo_contribuinte) : '—' }}</td>
                <td>{{ t.nome_contribuinte || '—' }}</td>
                <td class="capitalize">{{ t.tipo }}</td>
                <td>{{ t.quantidade }}</td>
                <td>{{ formatarMoeda(t.valor_consumido || 0) }}</td>
                <td>{{ formatarMoeda(t.saldo_depois || 0) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <dialog ref="modalRef" class="modal">
      <div class="modal-box">
        <h3 class="font-bold text-lg">Confirmar Entrega de Tickets</h3>
        
        <div class="py-4">
          <div class="mb-4">
            <p class="font-medium">{{ resumo?.nome }}</p>
            <p class="text-sm text-base-content/60">{{ formatarCpf(resumo?.cpf || '') }}</p>
          </div>

          <div class="form-control mb-4">
            <label class="label">
              <span class="label-text font-medium">Tipo de Pessoa</span>
            </label>
            <div class="flex flex-col gap-2">
              <label class="label cursor-pointer justify-start gap-3">
                <input v-model="tipoPessoa" type="radio" name="tipo" value="estudante" class="radio radio-primary" />
                <span class="label-text">Estudante (R$ {{ precos.estudante?.toFixed(2) }})</span>
              </label>
              <label class="label cursor-pointer justify-start gap-3">
                <input v-model="tipoPessoa" type="radio" name="tipo" value="servidor" class="radio radio-primary" />
                <span class="label-text">Servidor (R$ {{ precos.servidor?.toFixed(2) }})</span>
              </label>
              <label class="label cursor-pointer justify-start gap-3">
                <input v-model="tipoPessoa" type="radio" name="tipo" value="visitante" class="radio radio-primary" />
                <span class="label-text">Visitante (R$ {{ precos.visitante?.toFixed(2) }})</span>
              </label>
            </div>
          </div>

          <div class="bg-base-200 p-4 rounded-lg">
            <div class="flex justify-between items-center">
              <span>Saldo disponível:</span>
              <span class="font-bold">{{ formatarMoeda(resumo?.saldo_disponivel || 0) }}</span>
            </div>
            <div class="flex justify-between items-center">
              <span>Valor Unitário:</span>
              <span>R$ {{ precos[tipoPessoa]?.toFixed(2) }}</span>
            </div>
            <div class="form-control my-3">
              <label class="label p-0 pb-2">
                <span class="label-text font-medium">Quantidade para baixa</span>
              </label>
              <input
                v-model.number="quantidadeEntrega"
                type="number"
                min="1"
                :max="maxTickets"
                class="input input-bordered"
              />
              <label class="label p-0 pt-2">
                <span class="label-text-alt">Máximo para o saldo atual: {{ maxTickets }}</span>
              </label>
            </div>
            <div class="divider my-2"></div>
            <div class="flex justify-between items-center">
              <span class="font-bold">Consumo desta baixa:</span>
              <span class="font-bold text-primary text-lg">{{ formatarMoeda(valorConsumoEntrega) }}</span>
            </div>
            <div class="flex justify-between items-center mt-1">
              <span class="font-bold">Saldo após baixa:</span>
              <span class="font-bold text-lg">{{ formatarMoeda(saldoAposEntrega) }}</span>
            </div>
          </div>
        </div>

        <div class="modal-action">
          <form method="dialog">
            <button class="btn btn-ghost mr-2">Cancelar</button>
            <button class="btn btn-primary" @click.prevent="confirmarEntrega" :disabled="salvando || quantidadeEntrega <= 0 || quantidadeEntrega > maxTickets">
              <span v-if="salvando" class="loading loading-spinner loading-sm"></span>
              Confirmar
            </button>
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
definePageMeta({ layout: 'default', middleware: 'auth' })

interface Pagamento {
  id: number
  codigo_contribuinte: string
  nome_contribuinte: string
  valor_total: number
  situacao: string
  data: string
}

interface TicketResumo {
  cpf: string
  nome: string | null
  total_creditos: number
  total_consumido: number
  saldo_disponivel: number
  pagamentos: Pagamento[]
}

interface Transacao {
  id: number
  tipo: string
  quantidade: number
  criado_em: string
  valor_consumido?: number
  saldo_depois?: number
  responsavel_nome: string
  codigo_contribuinte: string | null
  nome_contribuinte: string | null
}

const cpfDigits = ref('')
const resumo = ref<TicketResumo | null>(null)
const transacoes = ref<Transacao[]>([])
const buscou = ref(false)
const carregando = ref(false)
const carregandoTransacoes = ref(false)
const salvando = ref(false)
const modalRef = ref<HTMLDialogElement | null>(null)
const tipoPessoa = ref<'estudante' | 'servidor' | 'visitante'>('servidor')
const quantidadeEntrega = ref(1)
const erroValidacao = ref<string | null>(null)
const sucessoEntrega = ref<string | null>(null)

const precos = ref({
  estudante: 3,
  servidor: 10,
  visitante: 15,
})

const TIPOS_TICKET: Array<'estudante' | 'servidor' | 'visitante'> = ['estudante', 'servidor', 'visitante']

const maxTicketsPorTipo = computed<Record<'estudante' | 'servidor' | 'visitante', number>>(() => {
  const saldo = Number(resumo.value?.saldo_disponivel ?? 0)
  return {
    estudante: Math.floor(saldo / Number(precos.value.estudante || 0)) || 0,
    servidor: Math.floor(saldo / Number(precos.value.servidor || 0)) || 0,
    visitante: Math.floor(saldo / Number(precos.value.visitante || 0)) || 0,
  }
})

const temTipoDisponivel = computed(() => TIPOS_TICKET.some((tipo) => maxTicketsPorTipo.value[tipo] > 0))

const maxTickets = computed(() => {
  return maxTicketsPorTipo.value[tipoPessoa.value]
})

const valorConsumoEntrega = computed(() => {
  const qtd = Number(quantidadeEntrega.value || 0)
  const preco = Number(precos.value[tipoPessoa.value] ?? 0)
  if (qtd <= 0 || preco <= 0) return 0
  return Number((qtd * preco).toFixed(2))
})

const saldoAposEntrega = computed(() => {
  const saldo = Number(resumo.value?.saldo_disponivel ?? 0)
  return Number(Math.max(0, saldo - valorConsumoEntrega.value).toFixed(2))
})

function formatInputCpf(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`
}

const cpfMascarado = computed(() => formatInputCpf(cpfDigits.value))

function onCpfInput(ev: Event) {
  const target = ev.target as HTMLInputElement
  cpfDigits.value = target.value.replace(/\D/g, '').slice(0, 11)
  erroValidacao.value = null
  
  if (cpfDigits.value.length === 11) {
    buscar()
  } else if (cpfDigits.value.length === 0) {
    resumo.value = null
    buscou.value = false
  }
}

async function carregarPrecos() {
  try {
    const data = await $fetch<{ tipo: string; valor: number }[]>('/api/ticket/precos')
    for (const p of data) {
      precos.value[p.tipo as keyof typeof precos.value] = Number(p.valor)
    }
    ajustarTipoPessoaPorSaldo()
  } catch (err) {
    console.error('Erro ao carregar preços:', err)
  }
}

function ajustarTipoPessoaPorSaldo() {
  if (!resumo.value) return
  if (maxTicketsPorTipo.value[tipoPessoa.value] > 0) return

  const primeiroTipoDisponivel = TIPOS_TICKET.find((tipo) => maxTicketsPorTipo.value[tipo] > 0)
  if (primeiroTipoDisponivel) {
    tipoPessoa.value = primeiroTipoDisponivel
  }
}

async function buscar() {
  if (cpfDigits.value.length !== 11) {
    erroValidacao.value = 'Informe um CPF válido (11 dígitos)'
    return
  }
  
  erroValidacao.value = null
  carregando.value = true
  buscou.value = false
  try {
    const data = await $fetch<TicketResumo>('/api/ticket/pagamentos-cpf', {
      query: { cpf: cpfDigits.value },
    })
    resumo.value = data
    ajustarTipoPessoaPorSaldo()
    quantidadeEntrega.value = maxTickets.value > 0 ? 1 : 0
  } catch (err) {
    console.error('Erro ao buscar:', err)
  } finally {
    carregando.value = false
    buscou.value = true
  }
}

function abrirModal() {
  ajustarTipoPessoaPorSaldo()
  quantidadeEntrega.value = maxTickets.value > 0 ? 1 : 0
  modalRef.value?.showModal()
}

async function confirmarEntrega() {
  if (!resumo.value || maxTickets.value <= 0 || quantidadeEntrega.value <= 0) return
  if (quantidadeEntrega.value > maxTickets.value) return
  
  const quantidade = quantidadeEntrega.value
  salvando.value = true
  try {
    await $fetch('/api/ticket/entrega', {
      method: 'POST',
      body: {
        cpf: resumo.value.cpf,
        tipo: tipoPessoa.value,
        quantidade,
      },
    })
    modalRef.value?.close()
    sucessoEntrega.value = `Entrega de ${quantidade} ticket(s) registrada com sucesso!`
    await buscar()
    await carregarTransacoes()
    setTimeout(() => { sucessoEntrega.value = null }, 5000)
  } catch (err) {
    console.error('Erro ao confirmar:', err)
  } finally {
    salvando.value = false
  }
}

async function carregarTransacoes() {
  carregandoTransacoes.value = true
  try {
    const data = await $fetch<Transacao[]>('/api/ticket/transacoes')
    transacoes.value = data
  } catch (err) {
    console.error('Erro ao carregar transações:', err)
  } finally {
    carregandoTransacoes.value = false
  }
}

function formatarCpf(cpf: string): string {
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
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

function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
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

function traducaoSituacaoClasse(codigo: string): string {
  if (codigo === 'CO') return 'badge-success'
  if (codigo === 'CA') return 'badge-warning'
  if (codigo === 'RE') return 'badge-error'
  return 'badge-neutral'
}

carregarPrecos()
carregarTransacoes()

watch(tipoPessoa, () => {
  if (quantidadeEntrega.value > maxTickets.value) {
    quantidadeEntrega.value = maxTickets.value > 0 ? maxTickets.value : 0
  }
})

function formatarDataHora(data: string): string {
  if (!data) return '—'
  const match = data.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):?(\d{2})?/)
  if (match) {
    const [, year, month, day, hour, minute] = match
    return `${day}/${month}/${year} ${hour}:${minute}`
  }
  return data
}
</script>

<style scoped>
.slide-fade-enter-active {
  transition: all 0.3s ease-out;
}
.slide-fade-leave-active {
  transition: all 0.2s ease-in;
  transform: translateY(-20px);
  opacity: 0;
}
.slide-fade-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.toast-enter-active {
  transition: all 0.3s ease-out;
}
.toast-leave-active {
  transition: all 0.3s ease-in;
}
.toast-enter-from {
  opacity: 0;
  transform: translateY(-20px);
}
.toast-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}
</style>
