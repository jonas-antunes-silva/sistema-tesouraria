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
                </tr>
              </thead>
              <tbody>
                <tr v-if="usuarios.length === 0">
                  <td colspan="4" class="text-center text-base-content/60 py-8">
                    Nenhum usuário encontrado
                  </td>
                </tr>

                <tr v-for="u in usuarios" :key="u.id">
                  <td>{{ u.nome }}</td>
                  <td class="font-mono text-xs">{{ u.email }}</td>
                  <td class="text-sm">
                    <span v-if="u.grupos.length > 0">{{ u.grupos.join(', ') }}</span>
                    <span v-else class="text-base-content/60">—</span>
                  </td>
                  <td>
                    <span class="badge" :class="u.ativo ? 'badge-success' : 'badge-neutral'">
                      {{ u.ativo ? 'Sim' : 'Não' }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
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

const form = ref({
  nome: '',
  email: '',
  senha: '',
  ativo: true,
})

const erros = ref<Record<string, string>>({})

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

