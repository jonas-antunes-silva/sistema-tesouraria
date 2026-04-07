import { createError, defineEventHandler, getRouterParam } from 'h3'
import { query } from '../../../../utils/db'
import { requirePermission } from '../../../../utils/rbac'

interface RetificacaoRow {
  id: number
  pagamento_id: number
  servico_id_anterior: number
  servico_nome_anterior: string
  servico_id_novo: number
  servico_nome_novo: string
  retificado_por: string
  retificado_por_nome: string
  retificado_em: string
}

function parseId(value: string | undefined): number {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID de pagamento inválido' })
  }
  return id
}

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'tesoureiro.pagamentos')

  const pagamentoId = parseId(getRouterParam(event, 'id'))

  try {
    const result = await query<RetificacaoRow>(
      `SELECT r.id,
              r.pagamento_id,
              r.servico_id_anterior,
              r.servico_nome_anterior,
              r.servico_id_novo,
              r.servico_nome_novo,
              r.retificado_por,
              u.nome AS retificado_por_nome,
              r.retificado_em
       FROM sisgru_pagamentos_retificacoes r
       INNER JOIN usuarios u ON u.id = r.retificado_por
       WHERE r.pagamento_id = $1
       ORDER BY r.retificado_em DESC, r.id DESC`,
      [pagamentoId],
    )

    return result.rows.map((row) => ({
      ...row,
      id: Number(row.id),
      pagamento_id: Number(row.pagamento_id),
      servico_id_anterior: Number(row.servico_id_anterior),
      servico_id_novo: Number(row.servico_id_novo),
    }))
  } catch {
    throw createError({ statusCode: 500, statusMessage: 'Erro interno' })
  }
})