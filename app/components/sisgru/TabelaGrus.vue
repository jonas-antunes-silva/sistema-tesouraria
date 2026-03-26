<template>
  <div class="overflow-x-auto">
    <table class="table table-zebra w-full">
      <thead>
        <tr>
          <th>ID</th>
          <th>Nº RA</th>
          <th>Recolhedor</th>
          <th>Serviço</th>
          <th>Tipo Serviço</th>
          <th>Valor Total (R$)</th>
          <th>Situação</th>
          <th>Dt. Emissão</th>
          <th>Dt. Transferência</th>
          <th>Agente Arrecadador</th>
          <th>Meio Pagamento</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="grus.length === 0">
          <td colspan="11" class="text-center text-base-content/60 py-8">
            Nenhum registro encontrado
          </td>
        </tr>
        <tr v-for="gru in grus" :key="gru.id">
          <td class="font-mono text-xs">{{ gru.id }}</td>
          <td>{{ gru.numero_ra }}</td>
          <td>{{ gru.codigo_recolhedor }}</td>
          <td>{{ gru.servico }}</td>
          <td>{{ gru.tipo_servico }}</td>
          <td class="text-right">{{ formatarMoeda(gru.vl_total) }}</td>
          <td>{{ gru.situacao }}</td>
          <td>{{ gru.dt_emissao }}</td>
          <td>{{ gru.dt_transferencia }}</td>
          <td>{{ gru.agente_arrecadador }}</td>
          <td>{{ gru.meio_pagamento }}</td>
        </tr>
      </tbody>
      <tfoot v-if="grus.length > 0">
        <tr>
          <td colspan="5" class="font-semibold">
            Total: {{ grus.length }} registro{{ grus.length !== 1 ? 's' : '' }}
          </td>
          <td class="text-right font-semibold">{{ formatarMoeda(somaTotal) }}</td>
          <td colspan="5"></td>
        </tr>
      </tfoot>
    </table>
  </div>
</template>

<script setup lang="ts">
export interface GruRow {
  id: string
  numero_ra: string
  codigo_recolhedor: string
  servico: number
  tipo_servico: number
  vl_total: number
  situacao: string
  dt_emissao: string
  dt_transferencia?: string
  agente_arrecadador: string
  meio_pagamento: string
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
</script>
