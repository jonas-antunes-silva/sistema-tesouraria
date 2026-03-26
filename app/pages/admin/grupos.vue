<template>
  <div>
    <h1 class="text-2xl font-bold mb-4">Grupos</h1>

    <div v-if="erro" role="alert" class="alert alert-error mb-4">
      <span>{{ erro }}</span>
    </div>

    <div class="overflow-x-auto">
      <table class="table table-zebra w-full">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Descrição</th>
            <th>Permissões</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="grupos.length === 0">
            <td colspan="3" class="text-center text-base-content/60 py-8">
              Nenhum grupo encontrado
            </td>
          </tr>
          <tr v-for="g in grupos" :key="g.id">
            <td class="font-mono text-xs">{{ g.nome }}</td>
            <td>{{ g.descricao ?? '—' }}</td>
            <td class="text-sm">{{ g.permissoes.join(', ') }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default', middleware: 'auth' })

interface GrupoRow {
  id: string
  nome: string
  descricao: string | null
  permissoes: string[]
}

const grupos = ref<GrupoRow[]>([])
const erro = ref<string | null>(null)

async function carregarGrupos() {
  erro.value = null
  try {
    grupos.value = await $fetch<GrupoRow[]>('/api/grupos')
  } catch {
    erro.value = 'Erro ao carregar grupos.'
    grupos.value = []
  }
}

onMounted(carregarGrupos)
</script>

