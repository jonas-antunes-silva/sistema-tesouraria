import { defineEventHandler, getQuery, createError } from 'h3'
import { z } from 'zod'
import { query } from '../../utils/db'

// Requisitos: 10.2, 12.2, 12.6
const schema = z.object({
  data: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, 'Formato inválido: DD/MM/YYYY'),
})

export default defineEventHandler(async (event) => {
  // Middleware auth garante event.context.userId
  const params = getQuery(event)
  const parsed = schema.safeParse(params)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.errors[0]?.message ?? 'Parâmetro inválido',
    })
  }

  // Converter DD/MM/YYYY → YYYY-MM-DD para PostgreSQL
  const [dd, mm, yyyy] = parsed.data.data.split('/')
  const dataPostgres = `${yyyy}-${mm}-${dd}`

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
              sp.data_alteracao_situacao_pag_tesouro,
              sp.data_pagamento_psp,
              sp.dt_criacao,
              sp.sincronizado_em
       FROM sisgru_pagamentos sp
       WHERE DATE(sp.data_alteracao_situacao_pag_tesouro) = $1::date
        ORDER BY sp.data DESC NULLS LAST, sp.id DESC`,
      [dataPostgres],
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
