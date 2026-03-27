<template>
  <div class="overflow-x-auto">
    <table class="table table-zebra w-full">
      <thead>
        <tr>
          <th>ID</th>
          <th>Recolhedor</th>
          <th>Serviço</th>
          <th>Tipo Serviço</th>
          <th>Valor Total (R$)</th>
          <th>Situação</th>
          <th>Data Pagt.</th>
          <th>Dt. Transferência</th>
          <th>Meio Pagamento</th>
          <th>Data Geração</th>
          <th>Ident. Pagto.</th>
          <th>Criação</th>
          <th>Sync</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="grus.length === 0">
          <td colspan="13" class="text-center text-base-content/60 py-8">
            Nenhum registro encontrado
          </td>
        </tr>
        <tr v-for="gru in grus" :key="gru.id">
          <td class="font-mono text-xs">{{ gru.id }}</td>
          <td>{{ gru.codigo_recolhedor }}</td>
          <td>{{ gru.servico }}</td>
          <td>{{ gru.tipo_servico }}</td>
          <td class="text-right">{{ formatarMoeda(gru.vl_total) }}</td>
          <td>{{ gru.situacao }}</td>
          <td>{{ gru.dt_emissao }}</td>
          <td>{{ gru.dt_transferencia }}</td>
          <td>{{ gru.meio_pagamento }}</td>
          <td>{{ gru.dt_criacao_sisgru }}</td>
          <td>{{ gru.codigo_pagamento }}</td>
          <td>{{ formatarDataHora(gru.dt_criacao) }}</td>
          <td>{{ formatarDataHora(gru.sincronizado_em) }}</td>
        </tr>
      </tbody>
      <tfoot v-if="grus.length > 0">
        <tr>
          <td colspan="4" class="font-semibold">
            Total: {{ grus.length }} registro{{ grus.length !== 1 ? 's' : '' }}
          </td>
          <td class="text-right font-semibold">{{ formatarMoeda(somaTotal) }}</td>
          <td colspan="8"></td>
        </tr>
      </tfoot>
    </table>
  </div>
</template>

<script setup lang="ts">
export interface GruRow {
  id: string
  codigo_recolhedor: string
  servico: number
  tipo_servico: number
  vl_total: number
  situacao: string
  dt_emissao: string
  dt_transferencia?: string
  meio_pagamento: string
  dt_criacao_sisgru: string
  codigo_pagamento: string
  dt_criacao: string
  sincronizado_em: string
}

const props = defineProps<{
  grus: GruRow[]
}>()

const somaTotal = computed(() =>
  props.grus.reduce((acc, g) => acc + Number(g.vl_total), 0)
)

function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatarDataHora(data: string | null | undefined): string {
  if (!data) return '—'
  const match = data.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):?(\d{2})?/)
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
</script>
