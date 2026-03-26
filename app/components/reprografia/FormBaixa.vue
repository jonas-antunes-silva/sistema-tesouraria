<template>
  <div v-if="credito" class="card bg-base-100 shadow-sm mt-4">
    <div class="card-body p-4">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="label p-0 mb-2">
            <span class="label-text font-medium">Nº de cópias</span>
          </label>
          <input
            type="number"
            min="1"
            step="1"
            class="input input-bordered w-full"
            :value="numCopias"
            @input="onNumCopiasInput"
            :disabled="carregando"
            inputmode="numeric"
          />
          <div v-if="erro" role="alert" class="alert alert-error mt-3 py-2 text-sm">
            <span>{{ erro }}</span>
          </div>
        </div>

        <div class="flex flex-col justify-center">
          <div class="text-sm text-base-content/70">Valor/cópia</div>
          <div class="font-semibold">
            {{ valorPorCopia != null ? formatarMoeda(valorPorCopia) : '—' }}
          </div>

          <div class="divider my-3" />

          <div class="text-sm text-base-content/70">Total a descontar</div>
          <div class="font-semibold" :class="{ 'text-error': saldoInsuficiente }">
            {{ formatarMoeda(totalParaDescontar) }}
          </div>

          <button
            class="btn btn-success mt-4"
            :disabled="!podeRegistrar || carregando"
            @click="registrar"
          >
            <span v-if="carregando" class="loading loading-spinner loading-sm" />
            <span v-else>Registrar Baixa</span>
          </button>
        </div>
      </div>
    </div>
  </div>

  <div v-else class="mt-4 text-base-content/60">
    Consulte um CPF para registrar uma baixa.
  </div>
</template>

<script setup lang="ts">
import type { CreditoRow } from './ConsultaCpf.vue'

const props = defineProps<{
  credito: CreditoRow | null
  valorPorCopia: number | null
  carregando?: boolean
  erro?: string | null
}>()

const emit = defineEmits<{
  registrar: [numCopias: number]
}>()

const numCopias = ref<number>(1)
const carregando = computed(() => props.carregando ?? false)
const erro = computed(() => props.erro ?? null)

const totalParaDescontar = computed(() => {
  if (!props.valorPorCopia) return 0
  return props.valorPorCopia * numCopias.value
})

const saldoInsuficiente = computed(() => {
  if (!props.credito) return false
  return totalParaDescontar.value > props.credito.saldo
})

const podeRegistrar = computed(() => {
  if (!props.credito) return false
  if (props.valorPorCopia == null) return false
  if (!Number.isInteger(numCopias.value) || numCopias.value <= 0) return false
  return !saldoInsuficiente.value
})

function onNumCopiasInput(ev: Event) {
  const target = ev.target as HTMLInputElement
  const value = Number(target.value)
  if (!Number.isFinite(value)) return
  numCopias.value = Math.max(1, Math.floor(value))
}

async function registrar() {
  if (!podeRegistrar.value) return
  emit('registrar', numCopias.value)
}

function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
</script>

