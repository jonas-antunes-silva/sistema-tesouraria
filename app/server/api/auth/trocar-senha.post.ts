import { defineEventHandler, readBody, createError } from 'h3'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { query } from '../../utils/db'

const trocarSenhaSchema = z.object({
  senha_atual: z.string().min(1).optional(),
  senhaAtual: z.string().min(1).optional(),
  nova_senha: z.string().min(8).optional(),
  novaSenha: z.string().min(8).optional(),
}).superRefine((data, ctx) => {
  if (!data.senha_atual && !data.senhaAtual) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['senha_atual'],
      message: 'Senha atual é obrigatória',
    })
  }
  if (!data.nova_senha && !data.novaSenha) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['nova_senha'],
      message: 'Nova senha é obrigatória',
    })
  }
})

interface UsuarioSenhaRow {
  senha_hash: string
  ativo: boolean
}

export default defineEventHandler(async (event) => {
  const userId = event.context.userId as string | undefined
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const body = await readBody(event)
  const parsed = trocarSenhaSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Dados inválidos',
      data: parsed.error.flatten().fieldErrors,
    })
  }

  const senhaAtual = parsed.data.senha_atual ?? parsed.data.senhaAtual
  const novaSenha = parsed.data.nova_senha ?? parsed.data.novaSenha
  if (!senhaAtual || !novaSenha) {
    throw createError({ statusCode: 400, statusMessage: 'Dados inválidos' })
  }

  try {
    const usuarioResult = await query<UsuarioSenhaRow>(
      'SELECT senha_hash, ativo FROM usuarios WHERE id = $1',
      [userId],
    )

    const usuario = usuarioResult.rows[0]
    if (!usuario || !usuario.ativo) {
      throw createError({ statusCode: 401, statusMessage: 'Usuário inválido' })
    }

    const senhaAtualValida = await bcrypt.compare(senhaAtual, usuario.senha_hash)
    if (!senhaAtualValida) {
      throw createError({ statusCode: 401, statusMessage: 'Senha atual inválida' })
    }

    const mesmaSenha = await bcrypt.compare(novaSenha, usuario.senha_hash)
    if (mesmaSenha) {
      throw createError({ statusCode: 400, statusMessage: 'A nova senha deve ser diferente da atual' })
    }

    const novaSenhaHash = await bcrypt.hash(novaSenha, 12)
    await query(
      'UPDATE usuarios SET senha_hash = $1, atualizado_em = NOW() WHERE id = $2',
      [novaSenhaHash, userId],
    )

    return { ok: true }
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'statusCode' in err) {
      throw err
    }

    console.error('[auth] erro ao trocar senha do usuário:', (err as Error).message)
    throw createError({ statusCode: 500, statusMessage: 'Erro interno' })
  }
})
