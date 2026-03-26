<template>
  <div class="card bg-base-100 shadow-sm">
    <div class="card-body p-4">
      <div class="flex items-end gap-4 flex-wrap">
        <div class="flex-1 min-w-[240px]">
          <label class="label p-0 mb-2">
            <span class="label-text font-medium">CPF</span>
          </label>
          <input
            inputmode="numeric"
            type="text"
            class="input input-bordered w-full"
            :placeholder="cpfPlaceholder"
            :value="cpfMascarado"
            @input="onCpfInput"
            autocomplete="off"
          />
        </div>

        <button class="btn btn-primary" :disabled="carregando" @click="consultar">
          <span v-if="carregando" class="loading loading-spinner loading-sm" />
          <span v-else>Consultar</span>
        </button>
      </div>

      <div v-if="erroValidacao" role="alert" class="alert alert-error mt-3">
        <span>{{ erroValidacao }}</span>
      </div>

      <div v-if="credito" class="mt-4">
        <div class="flex flex-wrap gap-4">
          <div>
            <div class="text-sm text-base-content/70">Nome</div>
            <div class="font-semibold">{{ credito.nome }}</div>
          </div>
          <div>
            <div class="text-sm text-base-content/70">Saldo disponível</div>
            <div class="font-semibold">{{ formatarMoeda(credito.saldo) }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
export interface CreditoRow {
  cpf: string
  nome: string
  saldo: number
  atualizado_em?: string
}

const props = defineProps<{
  credito: CreditoRow | null
  carregando?: boolean
  erro?: string | null
}>()

const emit = defineEmits<{
  consultar: [cpf: string]
}>()

const cpfDigits = ref('')
const erroLocal = ref<string | null>(null)
const erroValidacao = computed(() => props.erro ?? erroLocal.value ?? null)
const carregando = computed(() => props.carregando ?? false)

const cpfPlaceholder = '___.___.___-__'

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
}

function validarCpf(): string | null {
  const digits = cpfDigits.value
  if (digits.length !== 11) return 'Informe um CPF válido (11 dígitos)'
  return digits
}

async function consultar() {
  const digits = validarCpf()
  if (!digits) {
    erroLocal.value = 'Informe um CPF válido (11 dígitos)'
    return
  }
  erroLocal.value = null
  emit('consultar', digits)
}

function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
</script>

