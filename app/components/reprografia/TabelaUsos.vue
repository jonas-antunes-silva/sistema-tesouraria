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
        </tr>
      </thead>
      <tbody>
        <tr v-if="usos.length === 0">
          <td colspan="6" class="text-center text-base-content/60 py-8">
            Nenhum uso registrado
          </td>
        </tr>

        <tr v-for="u in usos" :key="u.id">
          <td class="whitespace-nowrap">{{ formatarDataHora(u.registrado_em) }}</td>
          <td class="font-mono text-xs">{{ mascaraCpf(u.cpf) }}</td>
          <td>{{ u.nome }}</td>
          <td>{{ u.num_copias }}</td>
          <td class="text-right">{{ formatarMoeda(u.valor_total) }}</td>
          <td class="text-right">{{ formatarMoeda(u.saldo_posterior) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
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
}

const props = defineProps<{
  usos: UsoRow[]
}>()

function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function mascaraCpf(cpf: string): string {
  const digits = cpf.replace(/\D/g, '')
  if (digits.length !== 11) return cpf
  return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`
}

function formatarDataHora(d: string): string {
  // O PG geralmente retorna TIMESTAMP sem ISO estrito; isso funciona bem o suficiente para exibição.
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return d
  return dt.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}
</script>

