<template>
  <div class="overflow-x-auto">
    <table class="table table-zebra table-hover w-full">
      <thead>
        <tr>
          <!-- <th class="w-24">ID</th>
          <th class="w-32">Código</th> -->
          <th class="w-48">Contribuinte</th>
          <th class="w-32">CPF</th>
          <th class="w-64">
            <div class="dropdown dropdown-hover dropdown-bottom dropdown-end">
              <label tabindex="0" class="flex items-center gap-1 cursor-pointer">
                Serviço
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
              </label>
              <ul tabindex="0" class="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-64">
                <li v-for="servico in servicosUnicos" :key="servico.id">
                  <label class="flex items-center gap-2 cursor-pointer py-1">
                    <input
                      type="checkbox"
                      class="checkbox checkbox-sm"
                      :checked="servicosSelecionados.includes(servico.id)"
                      @change="toggleServico(servico.id)"
                    />
                    <span class="text-sm">{{ servico.nome }}</span>
                  </label>
                </li>
              </ul>
            </div>
          </th>
          <th class="w-32">Valor Total (R$)</th>
          <th class="w-28">Situação</th>
          <th class="w-40">Tipo Pagamento</th>
          <th class="w-24">Data SISGRU</th>
          <!-- <th class="w-24">Data PagTesouro</th> -->
          <th class="w-36">Data PSP</th>
          <!-- <th class="w-36">Criação</th>
          <th class="w-36">Sync</th> -->
        </tr>
      </thead>
      <tbody>
        <tr v-if="pagamentosFiltrados.length === 0">
          <td colspan="8" class="text-center text-base-content/60 py-8">
            Nenhum registro encontrado
          </td>
        </tr>
        <TransitionGroup name="list">
          <tr v-for="p in pagamentosFiltrados" :key="p.id">
            <!-- <td>{{ p.id }}</td>
            <td class="font-mono text-xs">{{ p.codigo }}</td> -->
            <td>{{ p.nome_contribuinte }}</td>
            <td class="font-mono text-xs">{{ formatarCpf(p.codigo_contribuinte) }}</td>
            <td>{{ p.servico_nome }}</td>
            <td>{{ formatarMoeda(p.valor_total) }}</td>
            <td>
              <span
                class="badge"
                :class="{
                  'badge-success text-white': p.situacao === 'CO',
                  'badge-warning text-neutral': p.situacao === 'CA',
                  'badge-error text-white': p.situacao === 'RE',
                  'badge-neutral': p.situacao !== 'CO' && p.situacao !== 'CA' && p.situacao !== 'RE'
                }"
              >{{ traducaoSituacao(p.situacao) }}</span>
            </td>
            <td>{{ p.tipo_pagamento_nome }}</td>
            <td>{{ formatarData(p.data) }}</td>
            <!-- <td>{{ formatarData(p.data_alteracao_situacao_pag_tesouro) }}</td> -->
            <td>{{ formatarDataHora(p.data_pagamento_psp) }}</td>
            <!-- <td>{{ formatarDataHora(p.dt_criacao) }}</td>
            <td>{{ formatarDataHora(p.sincronizado_em) }}</td> -->
          </tr>
        </TransitionGroup>
      </tbody>
      <tfoot v-if="pagamentosFiltrados.length > 0">
        <tr>
          <td colspan="4" class="font-semibold text-neutral text-base">
            Total: {{ pagamentosFiltrados.length }} registro{{ pagamentosFiltrados.length !== 1 ? 's' : '' }}
          </td>
          <td class="text-right font-semibold text-neutral text-base">{{ formatarMoeda(somaTotal) }}</td>
          <td colspan="4"></td>
        </tr>
      </tfoot>
    </table>
  </div>
</template>

<script setup lang="ts">
export interface PagamentoRow {
  id: number
  codigo: string
  nome_contribuinte: string
  codigo_contribuinte: string
  servico_nome: string
  servico_id: number
  valor_total: number
  situacao: string
  tipo_pagamento_nome: string
  data: string
  data_alteracao_situacao_pag_tesouro: string
  data_pagamento_psp: string | null
  dt_criacao: string
  sincronizado_em: string
}

interface ServicoOpcao {
  id: string
  nome: string
}

const props = defineProps<{
  pagamentos: PagamentoRow[]
}>()

const servicosUnicos = computed<ServicoOpcao[]>(() => {
  const seen = new Set<string>()
  const result: ServicoOpcao[] = []
  for (const p of props.pagamentos) {
    const id = String(p.servico_id)
    if (!seen.has(id) && p.servico_nome) {
      seen.add(id)
      result.push({ id, nome: p.servico_nome })
    }
  }
  return result.sort((a, b) => a.nome.localeCompare(b.nome))
})

const servicosSelecionados = ref<string[]>(['14671', '16279'])

const pagamentosFiltrados = computed(() =>
  props.pagamentos.filter(p => servicosSelecionados.value.includes(String(p.servico_id)))
)

const somaTotal = computed(() =>
  pagamentosFiltrados.value.reduce((acc, p) => acc + Number(p.valor_total), 0)
)

function toggleServico(id: string) {
  const idx = servicosSelecionados.value.indexOf(id)
  if (idx === -1) {
    servicosSelecionados.value.push(id)
  } else {
    servicosSelecionados.value.splice(idx, 1)
  }
}

function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
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

function formatarDataHora(data: string | null | undefined): string {
  if (!data) return '—'
  const match = data.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/)
  if (match) {
    const [, year, month, day, hour, minute] = match
    let h = parseInt(hour, 10) - 3
    let d = parseInt(day, 10)
    let m = parseInt(month, 10)
    let y = parseInt(year, 10)
    if (h < 0) {
      h += 24
      d -= 1
      if (d < 1) {
        m -= 1
        if (m < 1) {
          m = 12
          y -= 1
        }
        const diasNoMes = new Date(y, m, 0).getDate()
        d = diasNoMes
      }
    }
    return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y} ${String(h).padStart(2, '0')}:${minute}`
  }
  return data
}

function mascaraCpf(cpf: string): string {
  const digits = cpf.replace(/\D/g, '')
  if (digits.length !== 11) return cpf
  return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`
}

function formatarCpf(cpf: string): string {
  const digits = cpf.replace(/\D/g, '')
  if (digits.length !== 11) return cpf
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`
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
</script>

<style scoped>
.list-enter-active,
.list-leave-active {
  transition: opacity 0.3s ease;
}
.list-enter-from,
.list-leave-to {
  opacity: 0;
}
</style>
