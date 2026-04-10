import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { pool } from '../../../../utils/db'
import { checkPermission } from '../../../../utils/rbac'
import { registrarLancamentoLivroCaixa } from '../../../../utils/livroCaixa'

const bodySchema = z.object({
  motivo: z.string().trim().min(3, 'Motivo do estorno é obrigatório').max(500),
})

function parseId(value: string | undefined): number {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID inválido' })
  }
  return id
}

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

  const entregaId = parseId(getRouterParam(event, 'id'))
  const body = await readBody(event)
  const parsed = bodySchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.errors[0]?.message ?? 'Dados inválidos',
    })
  }

  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const entregaResult = await client.query<{
      id: number
      cpf: string
      nome: string
      valor_consumido: string
      criado_em: string
      estornado: boolean
    }>(
      `SELECT id, cpf, nome, valor_consumido::text, criado_em, estornado
       FROM ticket_entregas
       WHERE id = $1
       FOR UPDATE`,
      [entregaId],
    )

    const entrega = entregaResult.rows[0]
    if (!entrega) {
      throw createError({ statusCode: 404, statusMessage: 'Entrega não encontrada' })
    }

    if (entrega.estornado) {
      throw createError({ statusCode: 409, statusMessage: 'Entrega já estornada' })
    }

    const hojeResult = await client.query<{ ok: number }>(
      `SELECT 1 AS ok
       FROM ticket_entregas
       WHERE id = $1
         AND DATE(criado_em) = CURRENT_DATE
       LIMIT 1`,
      [entregaId],
    )

    if (hojeResult.rows.length === 0) {
      throw createError({
        statusCode: 422,
        statusMessage: 'Somente entregas do dia podem ser estornadas',
      })
    }

    const posteriorResult = await client.query<{ ok: number }>(
      `SELECT 1 AS ok
       FROM ticket_entregas te
       WHERE regexp_replace(te.cpf, '\\D', '', 'g') = regexp_replace($1, '\\D', '', 'g')
         AND te.estornado = false
         AND te.id <> $2
         AND te.criado_em > $3
       LIMIT 1`,
      [entrega.cpf, entrega.id, entrega.criado_em],
    )

    if (posteriorResult.rows.length > 0) {
      throw createError({
        statusCode: 422,
        statusMessage: 'Estorno bloqueado: já existem entregas posteriores para este CPF',
      })
    }

    await client.query(
      `UPDATE ticket_entregas
       SET estornado = true,
           estornado_em = NOW(),
           estornado_por = $1,
           estorno_motivo = $2
       WHERE id = $3`,
      [userId, parsed.data.motivo, entregaId],
    )

    await registrarLancamentoLivroCaixa(client, {
      modulo: 'ticket',
      cpf: entrega.cpf,
      nome: entrega.nome,
      tipo: 'credito',
      valor: Number(entrega.valor_consumido),
      origem: 'ticket_estorno',
      origemId: String(entregaId),
      chaveIdempotencia: `ticket:entrega_estorno:${entregaId}`,
      metadata: {
        motivo: parsed.data.motivo,
      },
    })

    await client.query('COMMIT')
    return { ok: true }
  } catch (err: unknown) {
    try {
      await client.query('ROLLBACK')
    } catch {
      // ignore rollback errors
    }

    if (err && typeof err === 'object' && 'statusCode' in err) {
      throw err
    }

    console.error('[ticket/entregas/estorno] Erro:', (err as Error).message)
    throw createError({ statusCode: 500, statusMessage: 'Erro interno' })
  } finally {
    client.release()
  }
})