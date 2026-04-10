import { defineEventHandler, getQuery, createError } from 'h3'
import { z } from 'zod'
import { checkPermission } from '../../utils/rbac'
import { query } from '../../utils/db'

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
  servicos: z
    .string()
    .optional()
    .transform((v) => {
      if (!v) return undefined
      const itens = v
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
      return itens.length > 0 ? itens : undefined
    }),
  situacao: z.string().trim().min(1).max(32).optional(),
  tipo_pagamento: z.string().trim().min(1).max(120).optional(),
})

async function hasAnyPermission(userId: string): Promise<boolean> {
  const permissions = ['tesoureiro', 'admin', 'tesoureiro.pagamentos']
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
  const servicos = parsed.data.servicos ?? null
  const situacao = parsed.data.situacao ?? null
  const tipoPagamento = parsed.data.tipo_pagamento ?? null

  try {
    const result = await query(
      `SELECT sp.id,
              sp.codigo,
              sp.codigo_contribuinte,
              sp.nome_contribuinte,
              sp.numero_referencia,
              COALESCE(sp.servico_id_retificado, sp.servico_id) AS servico_id,
              COALESCE(sp.servico_nome_retificado, sp.servico_nome) AS servico_nome,
              sp.retificado,
              sp.retificado_em,
              sp.valor_total,
              sp.situacao,
              sp.tipo_pagamento_nome,
              sp.data,
              sp.data_pagamento_psp,
              sp.data_alteracao_situacao_pag_tesouro,
              sp.dt_criacao,
              sp.sincronizado_em
       FROM sisgru_pagamentos sp
       WHERE ($1::date IS NULL OR DATE(sp.data) = $1::date)
         AND ($2::text IS NULL OR regexp_replace(sp.codigo_contribuinte, '\\D', '', 'g') = $2)
         AND ($3::text[] IS NULL OR COALESCE(sp.servico_nome_retificado, sp.servico_nome) = ANY($3::text[]))
         AND ($4::text IS NULL OR sp.situacao = $4)
         AND ($5::text IS NULL OR sp.tipo_pagamento_nome = $5)
       ORDER BY sp.data DESC NULLS LAST, sp.id DESC`,
      [data, cpf, servicos, situacao, tipoPagamento],
    )

    return result.rows.map((row) => ({
      ...row,
      id: Number(row.id),
      numero_referencia: row.numero_referencia == null ? null : Number(row.numero_referencia),
      servico_id: Number(row.servico_id),
      valor_total: Number(row.valor_total),
    }))
  } catch {
    throw createError({ statusCode: 500, statusMessage: 'Erro interno' })
  }
})
