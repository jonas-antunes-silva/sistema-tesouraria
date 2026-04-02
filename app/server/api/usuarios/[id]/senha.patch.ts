import { defineEventHandler, readBody, createError, getRouterParam } from 'h3'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { requirePermission } from '../../../utils/rbac'
import { query } from '../../../utils/db'

const trocarSenhaAdminSchema = z.object({
  nova_senha: z.string().min(8).optional(),
  novaSenha: z.string().min(8).optional(),
}).superRefine((data, ctx) => {
  if (!data.nova_senha && !data.novaSenha) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['nova_senha'],
      message: 'Nova senha é obrigatória',
    })
  }
})

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'admin.usuarios')

  const usuarioId = getRouterParam(event, 'id')
  if (!usuarioId) {
    throw createError({ statusCode: 400, statusMessage: 'ID do usuário não fornecido' })
  }

  const body = await readBody(event)
  const parsed = trocarSenhaAdminSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Dados inválidos',
      data: parsed.error.flatten().fieldErrors,
    })
  }

  const novaSenha = parsed.data.nova_senha ?? parsed.data.novaSenha
  if (!novaSenha) {
    throw createError({ statusCode: 400, statusMessage: 'Dados inválidos' })
  }

  try {
    const usuarioExiste = await query<{ id: string }>(
      'SELECT id FROM usuarios WHERE id = $1',
      [usuarioId],
    )

    if (usuarioExiste.rows.length === 0) {
      throw createError({ statusCode: 404, statusMessage: 'Usuário não encontrado' })
    }

    const novaSenhaHash = await bcrypt.hash(novaSenha, 12)

    await query(
      'UPDATE usuarios SET senha_hash = $1, atualizado_em = NOW() WHERE id = $2',
      [novaSenhaHash, usuarioId],
    )

    return { ok: true }
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'statusCode' in err) {
      throw err
    }

    console.error('[usuarios] erro ao trocar senha por admin:', (err as Error).message)
    throw createError({ statusCode: 500, statusMessage: 'Erro interno' })
  }
})
