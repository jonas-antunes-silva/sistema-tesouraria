<template>
  <div class="overflow-x-auto mt-6">
    <table class="table table-zebra w-full">
      <thead>
        <tr>
          <th>Data/Hora</th>
          <th>CPF</th>
          <th>Nome</th>
          <th>Nº Cópias</th>
          <th>Valor Total</th>
          <th>Saldo Após</th>
          <th>Ações</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="usos.length === 0">
          <td colspan="7" class="text-center text-base-content/60 py-8">
            Nenhum uso registrado
          </td>
        </tr>

        <tr v-for="u in usos" :key="u.id">
          <td class="whitespace-nowrap">{{ formatarDataHora(u.registrado_em) }}</td>
          <td class="font-mono text-xs">{{ formatarCpf(u.cpf) }}</td>
          <td>{{ u.nome }}</td>
          <td>{{ u.num_copias }}</td>
          <td class="text-right">{{ formatarMoeda(u.valor_total) }}</td>
          <td class="text-right">{{ formatarMoeda(u.saldo_posterior) }}</td>
          <td>
            <div v-if="u.estornado" class="text-xs">
              <span class="badge badge-warning normal-case text-xs font-medium">Estornado</span>
            </div>
            <button
              v-else-if="isHoje(u.registrado_em)"
              class="btn btn-neutral btn-xs"
              @click="abrirModalEstorno(u)"
            >
              Realizar estorno
            </button>
            <span v-else class="text-xs text-base-content/50">—</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <dialog ref="modalEstornoRef" class="modal">
    <div class="modal-box">
      <h3 class="font-bold text-lg">Estorno de baixa de impressão</h3>

      <div v-if="usoEstorno" class="py-4 space-y-2">
        <p class="text-sm">Nome: <strong>{{ usoEstorno.nome }}</strong></p>
        <p class="text-sm">CPF: <strong>{{ formatarCpf(usoEstorno.cpf) }}</strong></p>
        <p class="text-sm">Valor da baixa: <strong>{{ formatarMoeda(usoEstorno.valor_total) }}</strong></p>

        <div class="form-control mt-3">
          <label class="label">
            <span class="label-text font-medium">Motivo do estorno</span>
          </label>
          <textarea
            v-model="motivoEstorno"
            class="textarea textarea-bordered"
            rows="4"
            maxlength="500"
            placeholder="Descreva o motivo do estorno"
          ></textarea>
        </div>

        <div v-if="erroEstorno" role="alert" class="alert alert-error py-2">
          <span>{{ erroEstorno }}</span>
        </div>
      </div>

      <div class="modal-action">
        <button class="btn btn-ghost" :disabled="salvandoEstorno" @click="fecharModalEstorno">Cancelar</button>
        <button class="btn btn-neutral" :disabled="salvandoEstorno || motivoEstorno.trim().length < 3" @click="confirmarEstorno">
          <span v-if="salvandoEstorno" class="loading loading-spinner loading-sm"></span>
          Confirmar Estorno
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button @click="fecharModalEstorno">close</button>
    </form>
  </dialog>
</template>

<script setup lang="ts">
export interface UsoRow {
  id: number
  cpf: string
  nome: string
  num_copias: number
  valor_total: number
  saldo_posterior: number
  registrado_em: string
  estornado: boolean
  estornado_em: string | null
  estorno_motivo: string | null
  estornado_por_nome: string | null
}

const props = defineProps<{
  usos: UsoRow[]
}>()

const emit = defineEmits<{
  estornado: []
}>()

const modalEstornoRef = ref<HTMLDialogElement | null>(null)
const usoEstorno = ref<UsoRow | null>(null)
const motivoEstorno = ref('')
const erroEstorno = ref<string | null>(null)
const salvandoEstorno = ref(false)

function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatarCpf(cpf: string): string {
  const digits = cpf.replace(/\D/g, '')
  if (digits.length !== 11) return cpf
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`
}

function formatarDataHora(d: string): string {
  // O PG geralmente retorna TIMESTAMP sem ISO estrito; isso funciona bem o suficiente para exibição.
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return d
  return dt.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function isHoje(d: string): boolean {
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return false
  const now = new Date()
  return dt.getFullYear() === now.getFullYear()
    && dt.getMonth() === now.getMonth()
    && dt.getDate() === now.getDate()
}

function abrirModalEstorno(uso: UsoRow): void {
  usoEstorno.value = uso
  motivoEstorno.value = ''
  erroEstorno.value = null
  modalEstornoRef.value?.showModal()
}

function fecharModalEstorno(): void {
  if (salvandoEstorno.value) return
  modalEstornoRef.value?.close()
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

async function confirmarEstorno(): Promise<void> {
  const uso = usoEstorno.value
  if (!uso) return

  salvandoEstorno.value = true
  erroEstorno.value = null

  try {
    await $fetch(`/api/reprografia/usos/${uso.id}/estorno`, {
      method: 'POST',
      body: {
        motivo: motivoEstorno.value.trim(),
      },
    })

    modalEstornoRef.value?.close()
    emit('estornado')
  } catch (err: unknown) {
    erroEstorno.value = mensagemErroApi(err, 'Não foi possível estornar este registro')
  } finally {
    salvandoEstorno.value = false
  }
}
</script>

