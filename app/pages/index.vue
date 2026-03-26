<template>
  <div>
    <h1 class="text-2xl font-bold mb-6">Dashboard</h1>
    <p class="mb-6 text-base-content/70">Bem-vindo, {{ auth.user.value?.nome }}.</p>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <NuxtLink
        v-if="auth.hasPermission('tesoureiro')"
        to="/grus"
        class="card bg-base-100 shadow hover:shadow-md transition-shadow cursor-pointer"
      >
        <div class="card-body">
          <h2 class="card-title">GRUs</h2>
          <p class="text-sm text-base-content/60">Listagem de Guias de Recolhimento da União</p>
        </div>
      </NuxtLink>

      <NuxtLink
        v-if="auth.hasPermission('tesoureiro')"
        to="/pagamentos"
        class="card bg-base-100 shadow hover:shadow-md transition-shadow cursor-pointer"
      >
        <div class="card-body">
          <h2 class="card-title">Pagamentos</h2>
          <p class="text-sm text-base-content/60">Listagem de pagamentos e controle de tickets</p>
        </div>
      </NuxtLink>

      <NuxtLink
        v-if="auth.hasPermission('reprografia')"
        to="/reprografia"
        class="card bg-base-100 shadow hover:shadow-md transition-shadow cursor-pointer"
      >
        <div class="card-body">
          <h2 class="card-title">Reprografia</h2>
          <p class="text-sm text-base-content/60">Consulta e baixa de créditos de impressão</p>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default', middleware: 'auth' })
const auth = useAuth()
</script>
