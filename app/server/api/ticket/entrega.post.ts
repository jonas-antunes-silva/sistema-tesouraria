import { defineEventHandler, readBody, createError } from 'h3'
import { z } from 'zod'
import { checkPermission } from '../../utils/rbac'
import { transaction } from '../../utils/db'

const BodySchema = z.object({
  pagamento_ids: z.array(z.any().transform(v => Number(v))),
  tipo: z.enum(['estudante', 'servidor', 'visitante']),
  quantidade: z.any().transform(v => Number(v)).pipe(z.number().int().min(1)),
})

async function hasAnyPermission(userId: string, permissions: string[]): Promise<boolean> {
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

  const allowed = await hasAnyPermission(userId, [
    'tesoureiro',
    'admin',
    'tesoureiro.ticket',
  ])
  if (!allowed) {
    throw createError({ statusCode: 403, statusMessage: 'Acesso negado' })
  }

  const body = await readBody(event)
  const parsed = BodySchema.safeParse(body)

  if (!parsed.success) {
    console.error('[ticket/entrega] Dados inválidos:', parsed.error.errors)
    throw createError({ statusCode: 400, statusMessage: 'Dados inválidos' })
  }

  try {
    await transaction(async (client) => {
      const transacaoResult = await client.query(
        `INSERT INTO ticket_transacoes (tipo, quantidade, responsavel_id)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [parsed.data.tipo, parsed.data.quantidade, userId],
      )
      const transacaoId = transacaoResult.rows[0].id
      const now = new Date()

      for (const id of parsed.data.pagamento_ids) {
        await client.query(
          `UPDATE sisgru_pagamentos 
           SET ticket_retirado = true, 
               ticket_retirado_em = $1, 
               ticket_retirado_por = $2,
               ticket_transacao_id = $3
           WHERE id = $4`,
          [now, userId, transacaoId, id],
        )
      }
    })
    return { ok: true, quantidade: parsed.data.pagamento_ids.length }
  } catch (err) {
    console.error('[ticket/entrega] Erro:', (err as Error).message)
    throw createError({ statusCode: 500, statusMessage: 'Erro interno' })
  }
})
