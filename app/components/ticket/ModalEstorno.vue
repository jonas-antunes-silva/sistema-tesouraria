<template>
  <dialog ref="modalRef" class="modal">
    <div class="modal-box">
      <h3 class="font-bold text-lg">Estorno de entrega de ticket</h3>

      <div v-if="transacao" class="py-4 space-y-2">
        <p class="text-sm">Beneficiário: <strong>{{ transacao.nome_contribuinte || '—' }}</strong></p>
        <p class="text-sm">Documento: <strong>{{ transacao.codigo_contribuinte ? formatarDocumento(transacao.codigo_contribuinte) : '—' }}</strong></p>
        <p class="text-sm">Consumo registrado: <strong>{{ formatarMoeda(transacao.valor_consumido || 0) }}</strong></p>

        <div class="form-control mt-3">
          <label class="label">
            <span class="label-text font-medium">Motivo do estorno</span>
          </label>
          <textarea
            v-model="motivo"
            class="textarea textarea-bordered"
            rows="4"
            maxlength="500"
            placeholder="Descreva o motivo do estorno"
          ></textarea>
        </div>

      </div>

      <div class="modal-action">
        <button class="btn btn-ghost" :disabled="salvando" @click="fechar">Cancelar</button>
        <button class="btn btn-neutral" :disabled="salvando || motivo.trim().length < 3 || !transacao" @click="confirmar">
          <span v-if="salvando" class="loading loading-spinner loading-sm"></span>
          Confirmar Estorno
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button @click="fechar">close</button>
    </form>
  </dialog>

  <Transition name="toast">
    <div v-if="sucessoMsg" class="toast toast-top toast-center z-[9999]">
      <div class="alert alert-success text-white">
        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>{{ sucessoMsg }}</span>
        <button class="btn btn-ghost btn-xs text-white" @click="sucessoMsg = null">✕</button>
      </div>
    </div>
  </Transition>

  <Transition name="toast">
    <div v-if="erroMsg" class="toast toast-top toast-center z-[9999]">
      <div class="alert alert-error text-white">
        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>{{ erroMsg }}</span>
        <button class="btn btn-ghost btn-xs text-white" @click="erroMsg = null">✕</button>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref } from 'vue'

export interface TransacaoEstorno {
  id: number
  nome_contribuinte: string | null
  codigo_contribuinte: string | null
  valor_consumido?: number
}

const emit = defineEmits<{
  estornado: []
}>()

const modalRef = ref<HTMLDialogElement | null>(null)
const transacao = ref<TransacaoEstorno | null>(null)
const motivo = ref('')
const erroMsg = ref<string | null>(null)
const sucessoMsg = ref<string | null>(null)
const salvando = ref(false)

function abrir(novaTransacao: TransacaoEstorno): void {
  transacao.value = novaTransacao
  motivo.value = ''
  modalRef.value?.showModal()
}

function fechar(): void {
  if (salvando.value) return
  modalRef.value?.close()
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

async function confirmar(): Promise<void> {
  if (!transacao.value) return

  salvando.value = true

  try {
    await $fetch(`/api/ticket/entregas/${transacao.value.id}/estorno`, {
      method: 'POST',
      body: {
        motivo: motivo.value.trim(),
      },
    })

    salvando.value = false
    fechar()
    sucessoMsg.value = 'Estorno realizado com sucesso!'
    setTimeout(() => { sucessoMsg.value = null }, 3000)
    emit('estornado')
  } catch (err: unknown) {
    salvando.value = false
    fechar()
    erroMsg.value = mensagemErroApi(err, 'Não foi possível estornar este registro')
    setTimeout(() => { erroMsg.value = null }, 4000)
  }
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

function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

defineExpose({
  abrir,
  fechar
})
</script>

<style scoped>
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
