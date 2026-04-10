import { defineEventHandler, getQuery, createError } from 'h3'
import { z } from 'zod'
import { query } from '../../utils/db'
import { checkPermission } from '../../utils/rbac'

const schema = z.object({
  data: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida: YYYY-MM-DD')
    .optional(),
  cpf: z
    .string()
    .optional()
    .transform((v) => (v ? v.replace(/\D/g, '') : undefined))
    .refine((v) => (v ? v.length === 11 : true), 'CPF inválido'),
})

async function hasAnyPermission(userId: string): Promise<boolean> {
  const permissions = ['tesoureiro', 'admin', 'tesoureiro.ticket']
  for (const perm of permissions) {
    if (await checkPermission(userId, perm)) return true
  }
  return false
}

export default defineEventHandler(async (event) => {
  const userId = event.context.userId as string | undefined
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const allowed = await hasAnyPermission(userId)
  if (!allowed) {
    throw createError({ statusCode: 403, statusMessage: 'Acesso negado' })
  }

  const params = getQuery(event)
  const parsed = schema.safeParse(params)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.errors[0]?.message ?? 'Parâmetro inválido',
    })
  }

  const data = parsed.data.data ?? null
  const cpf = parsed.data.cpf ?? null

  try {
    const result = await query(
      `SELECT te.id,
              te.tipo,
              te.quantidade,
              te.criado_em,
              te.valor_unitario,
              te.valor_consumido,
              te.saldo_depois,
              te.estornado,
              te.estornado_em,
              te.estorno_motivo,
              u.nome AS responsavel_nome,
              ue.nome AS estornado_por_nome,
              te.cpf AS codigo_contribuinte,
              te.nome AS nome_contribuinte
       FROM ticket_entregas te
       LEFT JOIN usuarios u ON u.id = te.responsavel_id
       LEFT JOIN usuarios ue ON ue.id = te.estornado_por
       WHERE ($1::date IS NULL OR DATE(te.criado_em) = $1::date)
         AND ($2::text IS NULL OR regexp_replace(te.cpf, '\\D', '', 'g') = $2)
       ORDER BY te.criado_em DESC`,
      [data, cpf],
    )

    return result.rows.map((row) => ({
      ...row,
      id: Number(row.id),
      quantidade: Number(row.quantidade),
      valor_unitario: row.valor_unitario == null ? null : Number(row.valor_unitario),
      valor_consumido: row.valor_consumido == null ? null : Number(row.valor_consumido),
      saldo_depois: row.saldo_depois == null ? null : Number(row.saldo_depois),
    }))
  } catch {
    throw createError({ statusCode: 500, statusMessage: 'Erro interno' })
  }
})
