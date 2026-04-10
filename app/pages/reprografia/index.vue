<template>
  <div>
    <h1 class="text-2xl font-bold mb-6">Reprografia</h1>

    <div v-if="erroGeral" role="alert" class="alert alert-error mb-4">
      <span>{{ erroGeral }}</span>
    </div>

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

          <button class="btn btn-primary" @click="buscar" :disabled="carregandoConsulta">
            <span v-if="carregandoConsulta" class="loading loading-spinner loading-sm"></span>
            <span v-else>Buscar</span>
          </button>
        </div>

        <div v-if="erroConsulta" role="alert" class="alert alert-error mt-3">
          <span>{{ erroConsulta }}</span>
        </div>
      </div>
    </div>

    <Transition name="toast">
      <div v-if="sucessoBaixa" class="toast toast-top toast-center">
        <div class="alert alert-success text-white">
          <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{{ sucessoBaixa }}</span>
          <button class="btn btn-ghost btn-xs text-white" @click="sucessoBaixa = null">✕</button>
        </div>
      </div>
    </Transition>

    <Transition name="slide-fade">
      <div v-if="credito" class="card bg-base-100 shadow-xl mb-6">
        <div class="card-body">
          <div class="flex justify-between items-center mb-4">
            <div>
              <h2 class="text-lg font-semibold">{{ credito.nome }}</h2>
              <p class="text-sm text-base-content/60">{{ formatarCpf(credito.cpf) }}</p>
            </div>

            <div class="text-right">
              <p class="text-sm text-base-content/60">Saldo disponível</p>
              <p class="text-2xl font-bold text-primary">{{ formatarMoeda(credito.saldo) }}</p>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <div class="stats bg-base-200">
              <div class="stat py-3 px-4">
                <div class="stat-title text-xs">Créditos acumulados</div>
                <div class="stat-value text-lg">{{ formatarMoeda(totalAcumulado) }}</div>
              </div>
            </div>

            <div class="stats bg-base-200">
              <div class="stat py-3 px-4">
                <div class="stat-title text-xs">Já consumido</div>
                <div class="stat-value text-lg">{{ formatarMoeda(totalConsumido) }}</div>
              </div>
            </div>

            <div class="stats bg-base-200">
              <div class="stat py-3 px-4">
                <div class="stat-title text-xs">Valor por cópia</div>
                <div class="stat-value text-lg">{{ formatarMoeda(valorPorCopia ?? 0) }}</div>
              </div>
            </div>
          </div>

          <div class="card-actions justify-end">
            <button class="btn btn-primary" @click="abrirModalBaixa" :disabled="!podeRegistrarBaixa">
              Registrar Baixa
            </button>
          </div>
        </div>
      </div>

      <div v-else-if="buscou" class="alert mb-6">
        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <span>Nenhum crédito disponível para este CPF.</span>
      </div>
    </Transition>

    <div class="card bg-base-100 shadow-xl">
      <div class="card-body">
        <h2 class="card-title mb-4">Baixas de Impressão</h2>
        <ReprografiaTabelaUsos :usos="usos" @estornado="handleEstornoUso" />
      </div>
    </div>

    <dialog ref="modalBaixaRef" class="modal">
      <div class="modal-box">
        <h3 class="font-bold text-lg">Confirmar Baixa de Impressão</h3>

        <div class="py-4">
          <div class="mb-4">
            <p class="font-medium">{{ credito?.nome }}</p>
            <p class="text-sm text-base-content/60">{{ formatarCpf(credito?.cpf ?? '') }}</p>
          </div>

          <div class="bg-base-200 p-4 rounded-lg">
            <div class="flex justify-between items-center">
              <span>Saldo disponível:</span>
              <span class="font-bold">{{ formatarMoeda(credito?.saldo ?? 0) }}</span>
            </div>

            <div class="flex justify-between items-center mt-1">
              <span>Valor por cópia:</span>
              <span>{{ formatarMoeda(valorPorCopia ?? 0) }}</span>
            </div>

            <div class="form-control my-3">
              <label class="label p-0 pb-2">
                <span class="label-text font-medium">Quantidade para baixa</span>
              </label>
              <input
                v-model.number="numCopias"
                type="number"
                min="1"
                class="input input-bordered"
              />
            </div>

            <div class="divider my-2"></div>

            <div class="flex justify-between items-center">
              <span class="font-bold">Consumo desta baixa:</span>
              <span class="font-bold text-primary text-lg">{{ formatarMoeda(valorConsumoBaixa) }}</span>
            </div>

            <div class="flex justify-between items-center mt-1">
              <span class="font-bold">Saldo após baixa:</span>
              <span class="font-bold text-lg">{{ formatarMoeda(saldoAposBaixa) }}</span>
            </div>
          </div>

          <div v-if="erroBaixa" role="alert" class="alert alert-error mt-3">
            <span>{{ erroBaixa }}</span>
          </div>
        </div>

        <div class="modal-action">
          <form method="dialog">
            <button class="btn btn-ghost mr-2" :disabled="carregandoBaixa">Cancelar</button>
            <button
              class="btn btn-primary"
              @click.prevent="confirmarBaixa"
              :disabled="carregandoBaixa || !podeRegistrarConfirmacao"
            >
              <span v-if="carregandoBaixa" class="loading loading-spinner loading-sm"></span>
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
import type { CreditoRow } from '~/components/reprografia/ConsultaCpf.vue'
import type { UsoRow } from '~/components/reprografia/TabelaUsos.vue'

definePageMeta({ layout: 'default', middleware: 'auth' })

const credito = ref<CreditoRow | null>(null)
const usos = ref<UsoRow[]>([])
const valorPorCopia = ref<number | null>(null)
const cpfDigits = ref('')
const buscou = ref(false)
const numCopias = ref(1)
const modalBaixaRef = ref<HTMLDialogElement | null>(null)
const sucessoBaixa = ref<string | null>(null)

const carregandoConsulta = ref(false)
const carregandoBaixa = ref(false)

const erroGeral = ref<string | null>(null)
const erroConsulta = ref<string | null>(null)
const erroBaixa = ref<string | null>(null)

const totalConsumido = computed(() =>
  usos.value
    .filter((u) => !u.estornado)
    .reduce((acc, u) => acc + Number(u.valor_total), 0),
)

const totalAcumulado = computed(() => Number((Number(credito.value?.saldo ?? 0) + totalConsumido.value).toFixed(2)))

const valorConsumoBaixa = computed(() => {
  const qtd = Number(numCopias.value || 0)
  const valor = Number(valorPorCopia.value ?? 0)
  if (qtd <= 0 || valor <= 0) return 0
  return Number((qtd * valor).toFixed(2))
})

const saldoAposBaixa = computed(() => {
  const saldo = Number(credito.value?.saldo ?? 0)
  return Number(Math.max(0, saldo - valorConsumoBaixa.value).toFixed(2))
})

const podeRegistrarBaixa = computed(() =>
  Boolean(credito.value) && Boolean(valorPorCopia.value && valorPorCopia.value > 0),
)

const podeRegistrarConfirmacao = computed(() => {
  if (!podeRegistrarBaixa.value) return false
  if (!Number.isInteger(numCopias.value) || numCopias.value <= 0) return false
  return valorConsumoBaixa.value <= Number(credito.value?.saldo ?? 0)
})

const cpfMascarado = computed(() => formatInputCpf(cpfDigits.value))

function formatInputCpf(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`
}

function formatarCpf(cpf: string): string {
  const digits = cpf.replace(/\D/g, '')
  if (digits.length !== 11) return cpf
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

function onCpfInput(ev: Event): void {
  const target = ev.target as HTMLInputElement
  cpfDigits.value = target.value.replace(/\D/g, '').slice(0, 11)
  erroConsulta.value = null

  if (cpfDigits.value.length === 11) {
    buscar()
  } else if (cpfDigits.value.length === 0) {
    credito.value = null
    usos.value = []
    buscou.value = false
  }
}

async function carregarConfig() {
  erroGeral.value = null
  try {
    const cfg = await $fetch<{ valor_por_copia: number }>(`/api/reprografia/config`)
    valorPorCopia.value = cfg.valor_por_copia
  } catch (err: unknown) {
    erroGeral.value = 'Erro ao carregar configuração de reprografia.'
  }
}

async function carregarCredito(cpf: string) {
  erroConsulta.value = null
  try {
    const row = await $fetch<CreditoRow>(
      `/api/reprografia/creditos?cpf=${encodeURIComponent(cpf)}`,
    )
    credito.value = row
  } catch (err: any) {
    const statusCode = err?.response?.status
    if (statusCode === 422) {
      credito.value = null
      usos.value = []
      erroConsulta.value = 'Não há créditos cadastrados para este CPF.'
      return
    }
    credito.value = null
    usos.value = []
    erroConsulta.value = 'Erro ao consultar CPF. Tente novamente.'
  }
}

async function carregarUsos(cpf?: string) {
  try {
    const path = cpf ? `/api/reprografia/usos?cpf=${encodeURIComponent(cpf)}` : '/api/reprografia/usos'
    const rows = await $fetch<UsoRow[]>(path)
    usos.value = rows
  } catch {
    usos.value = []
  }
}

async function handleConsultarCpf(cpfDigits: string) {
  carregandoConsulta.value = true
  erroConsulta.value = null
  buscou.value = false

  try {
    await carregarCredito(cpfDigits)
    if (credito.value) {
      await carregarUsos(cpfDigits)
    } else {
      usos.value = []
    }
    buscou.value = true
  } finally {
    carregandoConsulta.value = false
  }
}

async function buscar() {
  if (cpfDigits.value.length !== 11) {
    erroConsulta.value = 'Informe um CPF válido (11 dígitos)'
    return
  }
  await handleConsultarCpf(cpfDigits.value)
}

function abrirModalBaixa() {
  erroBaixa.value = null
  numCopias.value = 1
  modalBaixaRef.value?.showModal()
}

async function handleRegistrarBaixa(numCopias: number) {
  if (!credito.value) return
  if (valorPorCopia.value == null) return

  carregandoBaixa.value = true
  erroBaixa.value = null

  try {
    await $fetch(`/api/reprografia/usos`, {
      method: 'POST',
      body: {
        cpf: credito.value.cpf,
        num_copias: numCopias,
      },
    })

    // Atualiza saldo e histórico sem recarregar a página.
    await carregarCredito(credito.value.cpf)
    await carregarUsos(credito.value.cpf)
    sucessoBaixa.value = `Baixa de ${numCopias} cópia(s) registrada com sucesso!`
    setTimeout(() => {
      sucessoBaixa.value = null
    }, 5000)
  } catch {
    erroBaixa.value = 'Erro ao registrar baixa. Tente novamente.'
  } finally {
    carregandoBaixa.value = false
  }
}

async function confirmarBaixa() {
  if (!podeRegistrarConfirmacao.value) return
  await handleRegistrarBaixa(numCopias.value)
  if (!erroBaixa.value) {
    modalBaixaRef.value?.close()
  }
}

async function handleEstornoUso() {
  if (!credito.value) return
  await carregarCredito(credito.value.cpf)
  await carregarUsos(credito.value.cpf)
}

onMounted(async () => {
  await carregarConfig()
  await carregarUsos()
})

function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
</script>

