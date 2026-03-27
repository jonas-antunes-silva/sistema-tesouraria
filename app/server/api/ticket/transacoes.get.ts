import { defineEventHandler, createError } from 'h3'
import { query } from '../../utils/db'

export default defineEventHandler(async () => {
  try {
    const result = await query(
      `SELECT * FROM (
         SELECT DISTINCT ON (tt.id)
                tt.id, tt.tipo, tt.quantidade, tt.criado_em,
                u.nome as responsavel_nome,
                p.codigo_contribuinte,
                p.nome_contribuinte
         FROM ticket_transacoes tt
         LEFT JOIN usuarios u ON u.id = tt.responsavel_id
         LEFT JOIN (
           SELECT DISTINCT ON (ticket_transacao_id)
                  ticket_transacao_id, codigo_contribuinte, nome_contribuinte
           FROM sisgru_pagamentos
           WHERE ticket_transacao_id IS NOT NULL
         ) p ON p.ticket_transacao_id = tt.id
         WHERE DATE(tt.criado_em) = CURRENT_DATE
         ORDER BY tt.id
       ) AS sub
       ORDER BY criado_em DESC`,
      [],
    )
    return result.rows
  } catch {
    throw createError({ statusCode: 500, statusMessage: 'Erro interno' })
  }
})
