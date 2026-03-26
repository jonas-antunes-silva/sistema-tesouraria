import { defineEventHandler, getQuery, createError } from 'h3'
import { z } from 'zod'
import { query } from '../../utils/db'
import { requirePermission } from '../../utils/rbac'

const schema = z.object({
  cpf: z
    .string()
    .min(1, 'CPF é obrigatório')
    .transform((v) => v.replace(/\D/g, ''))
    .refine((digits) => digits.length === 11, 'CPF inválido'),
})

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'reprografia.creditos')

  const params = getQuery(event)
  const parsed = schema.safeParse(params)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.errors[0]?.message ?? 'Parâmetro inválido',
    })
  }

  const cpfDigits = parsed.data.cpf

  try {
    const result = await query<{
      cpf: string
      nome: string
      saldo: string | number
      atualizado_em: string
    }>(
      `SELECT cpf, nome, saldo, atualizado_em
       FROM reprografia_creditos
       WHERE regexp_replace(cpf, '\\D', '', 'g') = $1
       LIMIT 1`,
      [cpfDigits],
    )

    const row = result.rows[0]
    if (!row) {
      throw createError({
        statusCode: 422,
        statusMessage: 'CPF não possui créditos cadastrados',
      })
    }

    return {
      cpf: row.cpf,
      nome: row.nome,
      saldo: Number(row.saldo),
      atualizado_em: row.atualizado_em,
    }
  } catch (err: unknown) {
    // Não mascarar erros HTTP (ex.: 400/401/403/422) gerados pelo próprio handler.
    if (err && typeof err === 'object' && 'statusCode' in err) {
      throw err
    }
    throw createError({ statusCode: 500, statusMessage: 'Erro interno' })
  }
})

