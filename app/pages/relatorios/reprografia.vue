<template>
  <div>
    <h1 class="text-2xl font-bold mb-6">Relatório de Baixas de Impressões</h1>

    <div class="card bg-base-100 shadow-xl mb-6">
      <div class="card-body">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="form-control">
            <label class="label p-0 mb-2">
              <span class="label-text font-medium">Data</span>
            </label>
            <input v-model="filtroData" type="date" class="input input-bordered" />
          </div>

          <div class="form-control">
            <label class="label p-0 mb-2">
              <span class="label-text font-medium">CPF</span>
            </label>
            <input
              inputmode="numeric"
              type="text"
              class="input input-bordered"
              placeholder="___.___.___-__"
              :value="cpfMascarado"
              @input="onCpfInput"
            />
          </div>

          <div class="form-control justify-end">
            <button class="btn btn-primary" :disabled="carregando" @click="buscar">
              <span v-if="carregando" class="loading loading-spinner loading-sm"></span>
              <span v-else>Filtrar</span>
            </button>
          </div>
        </div>

        <div v-if="erro" role="alert" class="alert alert-error mt-4">
          <span>{{ erro }}</span>
        </div>
      </div>
    </div>

    <div class="card bg-base-100 shadow-xl">
      <div class="card-body">
        <h2 class="card-title mb-4">Resultado</h2>

        <div class="overflow-auto max-h-[65vh]">
          <table class="table table-zebra text-left">
            <thead>
              <tr>
                <th>Data/Hora</th>
                <th>CPF</th>
                <th>Nome</th>
                <th>Nº Cópias</th>
                <th>Valor Total</th>
                <th>Saldo Após</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="rows.length === 0">
                <td colspan="7" class="text-center text-base-content/60 py-8">Nenhum registro encontrado</td>
              </tr>
              <tr v-for="u in rows" :key="u.id">
                <td>{{ formatarDataHora(u.registrado_em) }}</td>
                <td>{{ formatarCpf(u.cpf) }}</td>
                <td>{{ u.nome }}</td>
                <td>{{ u.num_copias }}</td>
                <td>{{ formatarMoeda(u.valor_total) }}</td>
                <td>{{ formatarMoeda(u.saldo_posterior) }}</td>
                <td>
                  <span v-if="u.estornado" class="badge badge-warning">Estornado</span>
                  <span v-else class="badge badge-success">Ativo</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default', middleware: 'auth' })

interface UsoRow {
  id: number
  cpf: string
  nome: string
  num_copias: number
  valor_total: number
  saldo_posterior: number
  registrado_em: string
  estornado: boolean
}

const rows = ref<UsoRow[]>([])
const carregando = ref(false)
const erro = ref<string | null>(null)
const filtroData = ref(new Date().toISOString().slice(0, 10))
const cpfDigits = ref('')

const cpfMascarado = computed(() => formatInputCpf(cpfDigits.value))

function formatInputCpf(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`
}

function onCpfInput(ev: Event): void {
  const target = ev.target as HTMLInputElement
  cpfDigits.value = target.value.replace(/\D/g, '').slice(0, 11)
}

function formatarCpf(cpf: string): string {
  const digits = cpf.replace(/\D/g, '')
  if (digits.length !== 11) return cpf || '—'
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

function formatarDataHora(data: string): string {
  if (!data) return '—'
  const dt = new Date(data)
  if (Number.isNaN(dt.getTime())) return data
  return dt.toLocaleString('pt-BR')
}

function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

async function buscar(): Promise<void> {
  erro.value = null

  if (cpfDigits.value && cpfDigits.value.length !== 11) {
    erro.value = 'Informe um CPF válido (11 dígitos).'
    return
  }

  carregando.value = true
  try {
    rows.value = await $fetch<UsoRow[]>('/api/relatorios/reprografia-baixas', {
      query: {
        data: filtroData.value || undefined,
        cpf: cpfDigits.value || undefined,
      },
    })
  } catch (err: unknown) {
    const maybeData = (err as { data?: { statusMessage?: string } })?.data
    const maybeStatus = (err as { statusMessage?: string })?.statusMessage
    erro.value = maybeData?.statusMessage || maybeStatus || 'Erro ao carregar relatório de reprografia.'
    rows.value = []
  } finally {
    carregando.value = false
  }
}

onMounted(buscar)
</script>
