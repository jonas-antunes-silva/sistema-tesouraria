<template>
  <div>
    <h1 class="text-2xl font-bold mb-4">Usuários</h1>

    <div v-if="erro" role="alert" class="alert alert-error mb-4">
      <span>{{ erro }}</span>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="card bg-base-100 shadow-sm">
        <div class="card-body p-4">
          <h2 class="text-lg font-semibold mb-3">Criar usuário</h2>

          <form @submit.prevent="criarUsuario">
            <div class="form-control mb-3">
              <label class="label p-0 mb-1">
                <span class="label-text font-medium">Nome</span>
              </label>
              <input class="input input-bordered" v-model="form.nome" type="text" />
              <div v-if="erros.nome" class="text-error text-sm mt-1">{{ erros.nome }}</div>
            </div>

            <div class="form-control mb-3">
              <label class="label p-0 mb-1">
                <span class="label-text font-medium">Email</span>
              </label>
              <input class="input input-bordered" v-model="form.email" type="email" />
              <div v-if="erros.email" class="text-error text-sm mt-1">{{ erros.email }}</div>
            </div>

            <div class="form-control mb-3">
              <label class="label p-0 mb-1">
                <span class="label-text font-medium">Senha</span>
              </label>
              <input class="input input-bordered" v-model="form.senha" type="password" autocomplete="new-password" />
              <div v-if="erros.senha" class="text-error text-sm mt-1">{{ erros.senha }}</div>
            </div>

            <div class="form-control mb-4">
              <label class="cursor-pointer label justify-start gap-3">
                <input type="checkbox" class="checkbox checkbox-primary" v-model="form.ativo" />
                <span class="label-text font-medium">Ativo</span>
              </label>
            </div>

            <button class="btn btn-primary w-full" :disabled="carregandoCriar">
              <span v-if="carregandoCriar" class="loading loading-spinner loading-sm" />
              <span v-else>Criar</span>
            </button>
          </form>
        </div>
      </div>

      <div class="card bg-base-100 shadow-sm">
        <div class="card-body p-4">
          <h2 class="text-lg font-semibold mb-3">Lista de usuários</h2>

          <div class="overflow-x-auto">
            <table class="table table-zebra w-full">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Email</th>
                  <th>Grupos</th>
                  <th>Ativo</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="usuarios.length === 0">
                  <td colspan="5" class="text-center text-base-content/60 py-8">
                    Nenhum usuário encontrado
                  </td>
                </tr>

                <tr v-for="u in usuarios" :key="u.id">
                  <td>{{ u.nome }}</td>
                  <td class="font-mono text-xs">{{ u.email }}</td>
                  <td class="text-sm">
                    <button 
                      @click="abrirModalGrupos(u)" 
                      class="link link-primary"
                      :disabled="carregandoGrupos"
                    >
                      <span v-if="u.grupos.length > 0">{{ u.grupos.join(', ') }}</span>
                      <span v-else class="text-base-content/60">Sem grupos</span>
                    </button>
                  </td>
                  <td>
                    <span class="badge" :class="u.ativo ? 'badge-success' : 'badge-neutral'">
                      {{ u.ativo ? 'Sim' : 'Não' }}
                    </span>
                  </td>
                  <td>
                    <button class="btn btn-xs btn-outline" @click="abrirModalSenhaAdmin(u)">
                      Trocar senha
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <div v-if="modalSenhaAdminAberto" class="modal modal-open">
      <div class="modal-box w-full max-w-md">
        <h3 class="font-bold text-lg mb-4">
          Trocar senha: <span class="text-primary">{{ usuarioSenhaSelecionado?.nome }}</span>
        </h3>

        <div v-if="erroSenhaAdmin" role="alert" class="alert alert-error mb-3">
          <span>{{ erroSenhaAdmin }}</span>
        </div>

        <div class="form-control mb-3">
          <label class="label p-0 mb-1">
            <span class="label-text">Nova senha</span>
          </label>
          <input v-model="novaSenhaAdmin" type="password" class="input input-bordered" autocomplete="new-password" />
        </div>

        <div class="form-control mb-3">
          <label class="label p-0 mb-1">
            <span class="label-text">Confirmar nova senha</span>
          </label>
          <input v-model="confirmarNovaSenhaAdmin" type="password" class="input input-bordered" autocomplete="new-password" />
        </div>

        <p v-if="erroTamanhoSenhaAdmin" class="text-error text-sm">{{ erroTamanhoSenhaAdmin }}</p>
        <p v-else-if="erroConfirmacaoSenhaAdmin" class="text-error text-sm">{{ erroConfirmacaoSenhaAdmin }}</p>

        <div class="modal-action">
          <button class="btn btn-ghost" @click="fecharModalSenhaAdmin" :disabled="carregandoSenhaAdmin">Cancelar</button>
          <button class="btn btn-primary" @click="salvarSenhaAdmin" :disabled="carregandoSenhaAdmin || !!erroConfirmacaoSenhaAdmin || !!erroTamanhoSenhaAdmin || !novaSenhaAdmin || !confirmarNovaSenhaAdmin">
            <span v-if="carregandoSenhaAdmin" class="loading loading-spinner loading-sm" />
            <span v-else>Salvar</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Modal para gerenciar grupos -->
    <div v-if="modalAberto" class="modal modal-open">
      <div class="modal-box w-full max-w-md">
        <h3 class="font-bold text-lg mb-4">
          Grupos: <span class="text-primary">{{ usuarioSelecionado?.nome }}</span>
        </h3>

        <div v-if="erroModal" role="alert" class="alert alert-error mb-4">
          <span>{{ erroModal }}</span>
        </div>

        <div class="form-control max-h-96 overflow-y-auto mb-6">
          <label v-for="g in gruposDisponiveis" :key="g.id" class="label cursor-pointer justify-start gap-3">
            <input 
              type="checkbox" 
              class="checkbox checkbox-primary" 
              :checked="gruposAtribudosIds.includes(g.id)"
              @change="(e) => toggleGrupo(g.id, (e.target as HTMLInputElement).checked)"
            />
            <span class="label-text flex-1">
              <span class="font-medium">{{ g.nome }}</span>
              <span v-if="g.descricao" class="block text-xs text-base-content/60">{{ g.descricao }}</span>
            </span>
          </label>
        </div>

        <div class="modal-action">
          <button 
            @click="fecharModalGrupos" 
            class="btn btn-ghost"
            :disabled="carregandoGrupos"
          >
            Cancelar
          </button>
          <button 
            @click="salvarGrupos" 
            class="btn btn-primary"
            :disabled="carregandoGrupos"
          >
            <span v-if="carregandoGrupos" class="loading loading-spinner loading-sm" />
            <span v-else>Salvar</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { z } from 'zod'

definePageMeta({ layout: 'default', middleware: 'auth' })

interface UsuarioRow {
  id: string
  nome: string
  email: string
  ativo: boolean
  grupos: string[]
}

const usuarios = ref<UsuarioRow[]>([])
const erro = ref<string | null>(null)

const carregandoCriar = ref(false)
const carregandoGrupos = ref(false)
const carregandoSenhaAdmin = ref(false)

const modalSenhaAdminAberto = ref(false)
const usuarioSenhaSelecionado = ref<UsuarioRow | null>(null)
const novaSenhaAdmin = ref('')
const confirmarNovaSenhaAdmin = ref('')
const erroSenhaAdmin = ref<string | null>(null)

// Modal de grupos
const modalAberto = ref(false)
const usuarioSelecionado = ref<UsuarioRow | null>(null)
const gruposDisponiveis = ref<Array<{ id: string; nome: string; descricao: string | null }>>([])
const gruposAtribudosIds = ref<string[]>([])
const erroModal = ref<string | null>(null)

const form = ref({
  nome: '',
  email: '',
  senha: '',
  ativo: true,
})

const erros = ref<Record<string, string>>({})

const erroConfirmacaoSenhaAdmin = computed(() => {
  if (!confirmarNovaSenhaAdmin.value) return null
  if (novaSenhaAdmin.value !== confirmarNovaSenhaAdmin.value) {
    return 'A confirmação da senha não confere.'
  }
  return null
})

const erroTamanhoSenhaAdmin = computed(() => {
  if (!novaSenhaAdmin.value) return null
  if (novaSenhaAdmin.value.length < 8) {
    return 'A nova senha deve ter ao menos 8 caracteres.'
  }
  return null
})

const schema = z.object({
  nome: z.string().min(2, 'Nome deve ter ao menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  senha: z.string().min(8, 'Senha deve ter ao menos 8 caracteres'),
  ativo: z.boolean(),
})

async function carregarUsuarios() {
  erro.value = null
  try {
    usuarios.value = await $fetch<UsuarioRow[]>('/api/usuarios')
  } catch {
    erro.value = 'Erro ao carregar usuários.'
    usuarios.value = []
  }
}

async function carregarGrupos() {
  try {
    gruposDisponiveis.value = await $fetch<Array<{ id: string; nome: string; descricao: string | null }>>('/api/usuarios/grupos-disponiveis')
  } catch {
    erroModal.value = 'Erro ao carregar grupos disponíveis.'
    gruposDisponiveis.value = []
  }
}

async function abrirModalGrupos(usuario: UsuarioRow) {
  usuarioSelecionado.value = usuario
  gruposAtribudosIds.value = []
  erroModal.value = null
  
  carregandoGrupos.value = true
  try {
    await carregarGrupos()
    // Mapeia nomes de grupos para IDs
    gruposAtribudosIds.value = gruposDisponiveis.value
      .filter((g) => usuario.grupos.includes(g.nome))
      .map((g) => g.id)
    modalAberto.value = true
  } finally {
    carregandoGrupos.value = false
  }
}

function fecharModalGrupos() {
  modalAberto.value = false
  usuarioSelecionado.value = null
  gruposAtribudosIds.value = []
  erroModal.value = null
}

function toggleGrupo(grupoId: string, marcado: boolean) {
  if (marcado) {
    if (!gruposAtribudosIds.value.includes(grupoId)) {
      gruposAtribudosIds.value.push(grupoId)
    }
  } else {
    gruposAtribudosIds.value = gruposAtribudosIds.value.filter((id) => id !== grupoId)
  }
}

async function salvarGrupos() {
  if (!usuarioSelecionado.value) return

  erroModal.value = null
  carregandoGrupos.value = true

  try {
    await $fetch(`/api/usuarios/${usuarioSelecionado.value.id}`, {
      method: 'PATCH',
      body: { grupo_ids: gruposAtribudosIds.value },
    })

    // Recarrega lista de usuários
    await carregarUsuarios()
    fecharModalGrupos()
  } catch {
    erroModal.value = 'Erro ao salvar grupos.'
  } finally {
    carregandoGrupos.value = false
  }
}

function abrirModalSenhaAdmin(usuario: UsuarioRow) {
  usuarioSenhaSelecionado.value = usuario
  novaSenhaAdmin.value = ''
  confirmarNovaSenhaAdmin.value = ''
  erroSenhaAdmin.value = null
  modalSenhaAdminAberto.value = true
}

function fecharModalSenhaAdmin() {
  modalSenhaAdminAberto.value = false
  usuarioSenhaSelecionado.value = null
}

async function salvarSenhaAdmin() {
  if (!usuarioSenhaSelecionado.value || erroConfirmacaoSenhaAdmin.value || erroTamanhoSenhaAdmin.value) return

  erroSenhaAdmin.value = null
  carregandoSenhaAdmin.value = true

  try {
    await $fetch(`/api/usuarios/${usuarioSenhaSelecionado.value.id}/senha`, {
      method: 'PATCH',
      body: { nova_senha: novaSenhaAdmin.value },
    })

    fecharModalSenhaAdmin()
  } catch (err: unknown) {
    const data = (err as { data?: { statusMessage?: string; data?: Record<string, string[] | undefined> } })?.data
    const fieldErrors = data?.data
    const message = data?.statusMessage
      ?? fieldErrors?.nova_senha?.[0]
      ?? (err instanceof Error ? err.message : '')
    erroSenhaAdmin.value = message || 'Erro ao alterar senha do usuário.'
  } finally {
    carregandoSenhaAdmin.value = false
  }
}

function validarForm(): { ok: true } | { ok: false; fieldErrors: Record<string, string> } {
  const parsed = schema.safeParse(form.value)
  if (parsed.success) return { ok: true }

  const fieldErrors: Record<string, string> = {}
  for (const [key, value] of Object.entries(parsed.error.flatten().fieldErrors)) {
    fieldErrors[key] = value?.[0] ?? 'Campo inválido'
  }

  return { ok: false, fieldErrors }
}

async function criarUsuario() {
  erro.value = null
  const validation = validarForm()
  if (!validation.ok) {
    erros.value = validation.fieldErrors
    return
  }
  erros.value = {}

  carregandoCriar.value = true
  try {
    const res = await $fetch('/api/usuarios', {
      method: 'POST',
      body: {
        nome: form.value.nome,
        email: form.value.email,
        senha: form.value.senha,
        ativo: form.value.ativo,
      },
    })

    // Depois de criar, recarrega a lista para refletir grupos (se houver).
    void res
    await carregarUsuarios()

    // Limpa apenas campos sensíveis.
    form.value.senha = ''
  } catch {
    erro.value = 'Erro ao criar usuário.'
  } finally {
    carregandoCriar.value = false
  }
}

onMounted(carregarUsuarios)
</script>

