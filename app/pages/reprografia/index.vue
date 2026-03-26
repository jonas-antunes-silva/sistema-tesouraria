<template>
  <div>
    <h1 class="text-2xl font-bold mb-4">Reprografia</h1>

    <div v-if="erroGeral" role="alert" class="alert alert-error mb-4">
      <span>{{ erroGeral }}</span>
    </div>

    <ReprografiaConsultaCpf
      :credito="credito"
      :carregando="carregandoConsulta"
      :erro="erroConsulta"
      @consultar="handleConsultarCpf"
    />

    <ReprografiaFormBaixa
      :credito="credito"
      :valorPorCopia="valorPorCopia"
      :carregando="carregandoBaixa"
      :erro="erroBaixa"
      @registrar="handleRegistrarBaixa"
    />

    <ReprografiaTabelaUsos :usos="usos" />
  </div>
</template>

<script setup lang="ts">
import type { CreditoRow } from '~/components/reprografia/ConsultaCpf.vue'
import type { UsoRow } from '~/components/reprografia/TabelaUsos.vue'

definePageMeta({ layout: 'default', middleware: 'auth' })

const credito = ref<CreditoRow | null>(null)
const usos = ref<UsoRow[]>([])
const valorPorCopia = ref<number | null>(null)

const carregandoConsulta = ref(false)
const carregandoBaixa = ref(false)

const erroGeral = ref<string | null>(null)
const erroConsulta = ref<string | null>(null)
const erroBaixa = ref<string | null>(null)

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

async function carregarUsos(cpf: string) {
  try {
    const rows = await $fetch<UsoRow[]>(
      `/api/reprografia/usos?cpf=${encodeURIComponent(cpf)}`,
    )
    usos.value = rows
  } catch {
    usos.value = []
  }
}

async function handleConsultarCpf(cpfDigits: string) {
  carregandoConsulta.value = true
  erroConsulta.value = null

  try {
    await carregarCredito(cpfDigits)
    if (credito.value) {
      await carregarUsos(cpfDigits)
    } else {
      usos.value = []
    }
  } finally {
    carregandoConsulta.value = false
  }
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
  } catch {
    erroBaixa.value = 'Erro ao registrar baixa. Tente novamente.'
  } finally {
    carregandoBaixa.value = false
  }
}

onMounted(async () => {
  await carregarConfig()
})
</script>

