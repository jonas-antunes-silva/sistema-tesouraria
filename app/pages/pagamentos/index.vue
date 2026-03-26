<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold">Pagamentos</h1>
      <SisgruFiltroData v-model="data" />
    </div>

    <div v-if="erro" role="alert" class="alert alert-error mb-4">
      <span>{{ erro }}</span>
    </div>

    <div v-if="carregando" class="card bg-base-100 shadow-sm">
      <div class="flex justify-center py-12">
        <span class="loading loading-spinner loading-lg"></span>
      </div>
    </div>

    <div v-else class="card bg-base-100 shadow-sm">
      <div class="card-body p-0">
        <SisgruTabelaPagamentos
          :pagamentos="pagamentos"
          @marcar-ticket="marcarTicket"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PagamentoRow } from '~/components/sisgru/TabelaPagamentos.vue'

definePageMeta({ layout: 'default', middleware: 'auth' })

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function paraApiDate(d: string): string {
  const [y, m, dia] = d.split('-')
  return `${dia}/${m}/${y}`
}

const data = ref(hojeISO())
const pagamentos = ref<PagamentoRow[]>([])
const carregando = ref(false)
const erro = ref<string | null>(null)

async function buscarPagamentos() {
  carregando.value = true
  erro.value = null
  try {
    const resultado = await $fetch<PagamentoRow[]>(`/api/sisgru/pagamentos?data=${paraApiDate(data.value)}`)
    pagamentos.value = resultado
  } catch {
    erro.value = 'Erro ao carregar pagamentos. Tente novamente.'
    pagamentos.value = []
  } finally {
    carregando.value = false
  }
}

async function marcarTicket(id: number) {
  erro.value = null
  try {
    const atualizado = await $fetch<PagamentoRow>(`/api/sisgru/pagamentos/${id}/ticket`, {
      method: 'PATCH'
    })
    const idx = pagamentos.value.findIndex(p => p.id === id)
    if (idx !== -1) {
      pagamentos.value[idx] = atualizado
    }
  } catch {
    erro.value = 'Erro ao marcar retirada do ticket. Tente novamente.'
  }
}

watch(data, buscarPagamentos)

onMounted(buscarPagamentos)
</script>
