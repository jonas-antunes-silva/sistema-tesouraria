import { defineEventHandler, getQuery, createError } from 'h3'
import { z } from 'zod'
import { query } from '../../utils/db'
import { requirePermission } from '../../utils/rbac'

const schema = z.object({
  cpf: z
    .string()
    .optional()
    .transform((v) => (v ? v.replace(/\D/g, '') : undefined))
    .refine((v) => (v ? v.length === 11 || v.length === 14 : true), 'CPF/CNPJ inválido')
})

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'reprografia.usos')

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
      id: number
      cpf: string
      nome: string
      num_copias: number
      valor_por_copia: string | number
      valor_total: string | number
      saldo_posterior: string | number
      registrado_em: string
      estornado: boolean
      estornado_em: string | null
      estorno_motivo: string | null
      estornado_por_nome: string | null
    }>(
      `SELECT
         ru.id,
         ru.cpf,
         ru.nome,
         ru.num_copias,
         ru.valor_por_copia,
         ru.valor_total,
         ru.saldo_posterior,
         ru.registrado_em,
         ru.estornado,
         ru.estornado_em,
         ru.estorno_motivo,
         ue.nome AS estornado_por_nome
       FROM reprografia_usos ru
       LEFT JOIN usuarios ue ON ue.id = ru.estornado_por
       WHERE ($1::text IS NULL OR regexp_replace(ru.cpf, '\\D', '', 'g') = $1)
       ORDER BY ru.registrado_em DESC`,
      [cpfDigits ?? null],
    )

    return result.rows.map((r) => ({
      ...r,
      valor_por_copia: Number(r.valor_por_copia),
      valor_total: Number(r.valor_total),
      saldo_posterior: Number(r.saldo_posterior),
    }))
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'statusCode' in err) {
      throw err
    }
    throw createError({ statusCode: 500, statusMessage: 'Erro interno' })
  }
})

