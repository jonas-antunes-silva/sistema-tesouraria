import { defineEventHandler, getQuery, createError } from 'h3'
import { z } from 'zod'
import { query } from '../../utils/db'
import { checkPermission } from '../../utils/rbac'

const schema = z.object({
  data_inicio: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida: YYYY-MM-DD')
    .optional(),
  data_fim: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida: YYYY-MM-DD')
    .optional(),
  cpf: z
    .string()
    .optional()
    .transform((v) => (v ? v.replace(/\D/g, '') : undefined))
    .refine((v) => (v ? v.length === 11 : true), 'CPF inválido'),
}).refine(
  (v) => !v.data_inicio || !v.data_fim || v.data_inicio <= v.data_fim,
  'Data inicial não pode ser maior que data final',
)

export default defineEventHandler(async (event) => {
  const userId = event.context.userId as string | undefined
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const allowed =
    (await checkPermission(userId, 'admin')) ||
    (await checkPermission(userId, 'reprografia')) ||
    (await checkPermission(userId, 'reprografia.usos'))

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

  const dataInicio = parsed.data.data_inicio ?? null
  const dataFim = parsed.data.data_fim ?? null
  const cpf = parsed.data.cpf ?? null

  try {
    const result = await query(
      `SELECT ru.id,
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
       WHERE ($1::date IS NULL OR DATE(ru.registrado_em) >= $1::date)
         AND ($2::date IS NULL OR DATE(ru.registrado_em) <= $2::date)
         AND ($3::text IS NULL OR regexp_replace(ru.cpf, '\\D', '', 'g') = $3)
       ORDER BY ru.registrado_em DESC`,
      [dataInicio, dataFim, cpf],
    )

    return result.rows.map((r) => ({
      ...r,
      id: Number(r.id),
      num_copias: Number(r.num_copias),
      valor_por_copia: Number(r.valor_por_copia),
      valor_total: Number(r.valor_total),
      saldo_posterior: Number(r.saldo_posterior),
    }))
  } catch {
    throw createError({ statusCode: 500, statusMessage: 'Erro interno' })
  }
})
