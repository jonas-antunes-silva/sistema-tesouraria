<template>
  <div>
    <h1 class="text-2xl font-bold mb-6">Configurar Preços de Ticket</h1>

    <div class="card bg-base-100 shadow-xl">
      <div class="card-body">
        <h2 class="card-title mb-4">Valores por Tipo</h2>
        
        <div v-if="loading" class="flex justify-center py-8">
          <span class="loading loading-spinner loading-lg"></span>
        </div>

        <form v-else @submit.prevent="salvar">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div class="form-control">
              <label class="label">
                <span class="label-text font-medium">Estudante</span>
              </label>
              <div class="relative">
                <span class="absolute left-3 top-1/2 -translate-y-1/2">R$</span>
                <input
                  v-model.number="precos[0].valor"
                  type="number"
                  step="0.01"
                  min="0"
                  class="input input-bordered w-full pl-10"
                />
              </div>
            </div>

            <div class="form-control">
              <label class="label">
                <span class="label-text font-medium">Servidor</span>
              </label>
              <div class="relative">
                <span class="absolute left-3 top-1/2 -translate-y-1/2">R$</span>
                <input
                  v-model.number="precos[1].valor"
                  type="number"
                  step="0.01"
                  min="0"
                  class="input input-bordered w-full pl-10"
                />
              </div>
            </div>

            <div class="form-control">
              <label class="label">
                <span class="label-text font-medium">Visitante</span>
              </label>
              <div class="relative">
                <span class="absolute left-3 top-1/2 -translate-y-1/2">R$</span>
                <input
                  v-model.number="precos[2].valor"
                  type="number"
                  step="0.01"
                  min="0"
                  class="input input-bordered w-full pl-10"
                />
              </div>
            </div>
          </div>

          <div class="card-actions justify-end">
            <button type="submit" class="btn btn-primary" :disabled="salvando">
              <span v-if="salvando" class="loading loading-spinner loading-sm"></span>
              Salvar
            </button>
          </div>
        </form>

        <div v-if="mensagem" class="alert alert-success mt-4">
          {{ mensagem }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Preco {
  id: number
  tipo: string
  valor: number
}

const precos = ref<Preco[]>([])
const loading = ref(true)
const salvando = ref(false)
const mensagem = ref('')

async function carregarPrecos() {
  try {
    const data = await $fetch<Preco[]>('/api/ticket/precos')
    precos.value = data
  } catch (err) {
    console.error('Erro ao carregar preços:', err)
  } finally {
    loading.value = false
  }
}

async function salvar() {
  salvando.value = true
  mensagem.value = ''
  try {
    await $fetch('/api/ticket/precos', {
      method: 'PUT',
      body: { precos: precos.value },
    })
    mensagem.value = 'Preços salvos com sucesso!'
    setTimeout(() => { mensagem.value = '' }, 3000)
  } catch (err) {
    console.error('Erro ao salvar:', err)
  } finally {
    salvando.value = false
  }
}

carregarPrecos()
</script>
