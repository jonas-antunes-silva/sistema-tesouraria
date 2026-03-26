import { defineEventHandler, readBody, createError, setResponseStatus } from 'h3'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { requirePermission } from '../../utils/rbac'
import { query } from '../../utils/db'

// Schema Zod de validação (Requisito 4.5)
const criarUsuarioSchema = z.object({
  nome: z.string().min(2),
  email: z.string().email(),
  senha: z.string().min(8),
  ativo: z.boolean().optional().default(true),
})

interface UsuarioCriadoRow {
  id: string
  nome: string
  email: string
  ativo: boolean
}

export default defineEventHandler(async (event) => {
  // Requer permissão admin.usuarios (Requisitos 4.2, 4.4)
  await requirePermission(event, 'admin.usuarios')

  // Validação Zod antes de qualquer operação no banco (Requisito 5.1)
  const body = await readBody(event)
  const parsed = criarUsuarioSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Dados inválidos',
      data: parsed.error.flatten().fieldErrors,
    })
  }

  const { nome, email, senha, ativo } = parsed.data

  // Hash bcrypt com custo 12 — nunca armazena senha em texto plano (Requisito 1.5, 4.2)
  const senhaHash = await bcrypt.hash(senha, 12)

  try {
    // INSERT parametrizado (Requisito 5.2)
    const result = await query<UsuarioCriadoRow>(
      `INSERT INTO usuarios (nome, email, senha_hash, ativo)
       VALUES ($1, $2, $3, $4)
       RETURNING id, nome, email, ativo`,
      [nome, email, senhaHash, ativo],
    )

    setResponseStatus(event, 201)
    return result.rows[0]
  } catch (err: unknown) {
    // Tratar conflito de email único (Requisito 4.2)
    if (
      err instanceof Error &&
      err.message.includes('unique') ||
      (err as { code?: string }).code === '23505'
    ) {
      throw createError({ statusCode: 409, statusMessage: 'Email já cadastrado' })
    }
    // Nunca expõe detalhes internos ao cliente (Requisito 5.4)
    throw createError({ statusCode: 500, statusMessage: 'Erro interno' })
  }
})
