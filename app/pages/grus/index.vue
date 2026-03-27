<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold">GRUs</h1>
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
        <SisgruTabelaGrus :grus="grus" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { GruRow } from '~/components/sisgru/TabelaGrus.vue'

// Protege a rota e redireciona para /login quando não autenticado.
definePageMeta({ layout: 'default', middleware: 'auth' })

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function paraApiDate(d: string): string {
  const [y, m, dia] = d.split('-')
  return `${dia}/${m}/${y}`
}

const data = ref(hojeISO())
const grus = ref<GruRow[]>([])
const carregando = ref(false)
const erro = ref<string | null>(null)

async function buscarGrus() {
  carregando.value = true
  erro.value = null
  try {
    const resultado = await $fetch<GruRow[]>(`/api/sisgru/grus?data=${paraApiDate(data.value)}`)
    grus.value = resultado
  } catch {
    erro.value = 'Erro ao carregar GRUs. Tente novamente.'
    grus.value = []
  } finally {
    carregando.value = false
  }
}

watch(data, buscarGrus)

onMounted(buscarGrus)
</script>
