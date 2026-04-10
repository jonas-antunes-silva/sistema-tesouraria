<template>
  <div class="h-screen bg-base-200 flex flex-col overflow-hidden" data-theme="emerald">
    <header class="navbar bg-base-100 px-4 shrink-0">
      <div class="flex-1 flex items-center gap-3">
        <img src="/logo.svg" alt="Logo" class="h-8" />
        <span class="text-xl font-bold text-neutral">Sistema Tesouraria</span>
      </div>
      <div class="flex-none gap-2">
        <div v-if="auth.user.value" class="dropdown dropdown-end">
          <button tabindex="0" class="btn btn-ghost btn-sm">
            {{ auth.user.value?.nome }}
          </button>
          <ul tabindex="0" class="menu menu-sm dropdown-content z-[1] mt-2 w-52 rounded-box bg-base-100 p-2 shadow">
            <li><button @click="abrirModalTrocaSenha">Trocar senha</button></li>
            <li><button @click="auth.logout()">Sair</button></li>
          </ul>
        </div>
      </div>
    </header>

    <div class="flex flex-1 min-h-0 bg-base-100 overflow-hidden">
      <ClientOnly>
        <aside v-if="auth.user.value" class="w-64 h-full bg-base-100 p-4 overflow-y-auto shrink-0">
          <ul class="menu">
            <li>
              <NuxtLink to="/" class="flex items-center gap-2">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Dashboard
              </NuxtLink>
            </li>
            <li v-if="auth.hasPermission('tesoureiro') || auth.hasPermission('admin')">
              <NuxtLink to="/grus" class="flex items-center gap-2">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                GRUs
              </NuxtLink>
            </li>
            <li v-if="auth.hasPermission('tesoureiro') || auth.hasPermission('admin')">
              <NuxtLink to="/pagamentos" class="flex items-center gap-2">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                Pagamentos
              </NuxtLink>
            </li>
            <li v-if="auth.hasPermission('reprografia') || auth.hasPermission('admin')">
              <NuxtLink to="/reprografia" class="flex items-center gap-2">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Reprografia
              </NuxtLink>
            </li>
            <li v-if="auth.hasPermission('tesoureiro') || auth.hasPermission('admin')">
              <NuxtLink to="/ticket-refeicao" class="flex items-center gap-2">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Ticket Refeição
              </NuxtLink>
            </li>
            <li v-if="auth.hasPermission('admin')">
              <details>
                <summary class="flex items-center gap-2">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Administração
                </summary>
                <ul>
                  <li><NuxtLink to="/admin/usuarios" class="flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Usuários
                  </NuxtLink></li>
                  <li><NuxtLink to="/admin/grupos" class="flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Grupos
                  </NuxtLink></li>
                  <li><NuxtLink to="/admin/reprografia" class="flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                    </svg>
                    Config. Reprografia
                  </NuxtLink></li>
                  <li><NuxtLink to="/admin/sisgru" class="flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    SISGRU Sync
                  </NuxtLink></li>
                  <li><NuxtLink to="/admin/ticket" class="flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Config. Ticket
                  </NuxtLink></li>
                </ul>
              </details>
            </li>
          </ul>
        </aside>
        <template #fallback>
          <aside class="w-64 h-full bg-base-100 p-4 shrink-0" />
        </template>
      </ClientOnly>

      <main class="flex-1 min-w-0 h-full overflow-y-auto p-6 bg-[#f8fafb] rounded-tl-2xl border-l border-t border-[#e6eaee] shadow-[inset_0_1px_8px_rgba(15,23,42,0.05)]">
        <slot />
      </main>
    </div>

    <footer class="footer footer-center p-4 bg-base-100 text-base-content shrink-0">
      <p class="text-xs opacity-50">Sistema Tesouraria v1.0</p>
    </footer>

    <div v-if="modalSenhaAberto" class="modal modal-open">
      <div class="modal-box w-full max-w-md">
        <h3 class="font-bold text-lg mb-4">Trocar minha senha</h3>

        <div v-if="erroTrocaSenha" role="alert" class="alert alert-error mb-3">
          <span>{{ erroTrocaSenha }}</span>
        </div>
        <div v-if="sucessoTrocaSenha" role="alert" class="alert alert-success mb-3">
          <span>{{ sucessoTrocaSenha }}</span>
        </div>

        <div class="form-control mb-3">
          <label class="label p-0 mb-1">
            <span class="label-text">Senha atual</span>
          </label>
          <input v-model="senhaAtual" type="password" class="input input-bordered" autocomplete="current-password" />
        </div>

        <div class="form-control mb-3">
          <label class="label p-0 mb-1">
            <span class="label-text">Nova senha</span>
          </label>
          <input v-model="novaSenha" type="password" class="input input-bordered" autocomplete="new-password" />
        </div>

        <div class="form-control mb-3">
          <label class="label p-0 mb-1">
            <span class="label-text">Confirmar nova senha</span>
          </label>
          <input v-model="confirmarNovaSenha" type="password" class="input input-bordered" autocomplete="new-password" />
        </div>

        <p v-if="erroTamanhoNovaSenha" class="text-error text-sm">{{ erroTamanhoNovaSenha }}</p>
        <p v-else-if="erroConfirmacao" class="text-error text-sm">{{ erroConfirmacao }}</p>

        <div class="modal-action">
          <button class="btn btn-ghost" @click="fecharModalTrocaSenha" :disabled="salvandoTrocaSenha">Cancelar</button>
          <button class="btn btn-primary" @click="trocarMinhaSenha" :disabled="salvandoTrocaSenha || !!erroConfirmacao || !!erroTamanhoNovaSenha || !senhaAtual || !novaSenha || !confirmarNovaSenha">
            <span v-if="salvandoTrocaSenha" class="loading loading-spinner loading-sm" />
            <span v-else>Salvar</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const auth = useAuth()

const modalSenhaAberto = ref(false)
const senhaAtual = ref('')
const novaSenha = ref('')
const confirmarNovaSenha = ref('')
const erroTrocaSenha = ref<string | null>(null)
const sucessoTrocaSenha = ref<string | null>(null)
const salvandoTrocaSenha = ref(false)

const erroConfirmacao = computed(() => {
  if (!confirmarNovaSenha.value) return null
  if (novaSenha.value !== confirmarNovaSenha.value) {
    return 'A confirmação da senha não confere.'
  }
  return null
})

const erroTamanhoNovaSenha = computed(() => {
  if (!novaSenha.value) return null
  if (novaSenha.value.length < 8) {
    return 'A nova senha deve ter ao menos 8 caracteres.'
  }
  return null
})

function abrirModalTrocaSenha() {
  modalSenhaAberto.value = true
  erroTrocaSenha.value = null
  sucessoTrocaSenha.value = null
  senhaAtual.value = ''
  novaSenha.value = ''
  confirmarNovaSenha.value = ''
}

function fecharModalTrocaSenha() {
  modalSenhaAberto.value = false
}

async function trocarMinhaSenha() {
  if (erroConfirmacao.value || erroTamanhoNovaSenha.value) return

  erroTrocaSenha.value = null
  sucessoTrocaSenha.value = null
  salvandoTrocaSenha.value = true

  try {
    await $fetch('/api/auth/trocar-senha', {
      method: 'POST',
      body: {
        senha_atual: senhaAtual.value,
        nova_senha: novaSenha.value,
      },
    })

    sucessoTrocaSenha.value = 'Senha atualizada com sucesso.'
    senhaAtual.value = ''
    novaSenha.value = ''
    confirmarNovaSenha.value = ''
  } catch (err: unknown) {
    const data = (err as { data?: { statusMessage?: string; data?: Record<string, string[] | undefined> } })?.data
    const fieldErrors = data?.data
    const message = data?.statusMessage
      ?? fieldErrors?.senha_atual?.[0]
      ?? fieldErrors?.nova_senha?.[0]
      ?? (err instanceof Error ? err.message : '')
    erroTrocaSenha.value = message || 'Não foi possível trocar a senha.'
  } finally {
    salvandoTrocaSenha.value = false
  }
}
</script>
