import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { pool } from '../../../../utils/db'
import { requirePermission } from '../../../../utils/rbac'
import { registrarLancamentoLivroCaixa, travarContaLivroCaixa } from '../../../../utils/livroCaixa'

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

function toNumber(value: string): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'reprografia.usos')

  const userId = event.context.userId as string
  const usoId = parseId(getRouterParam(event, 'id'))
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

    const usoResult = await client.query<{
      id: number
      cpf: string
      nome: string
      valor_total: string
      registrado_em: string
      estornado: boolean
    }>(
      `SELECT id, cpf, nome, valor_total::text, registrado_em, estornado
       FROM reprografia_usos
       WHERE id = $1
       FOR UPDATE`,
      [usoId],
    )

    const uso = usoResult.rows[0]
    if (!uso) {
      throw createError({ statusCode: 404, statusMessage: 'Registro de uso não encontrado' })
    }

    if (uso.estornado) {
      throw createError({ statusCode: 409, statusMessage: 'Registro já estornado' })
    }

    const hojeResult = await client.query<{ ok: number }>(
      `SELECT 1 AS ok
       FROM reprografia_usos
       WHERE id = $1
         AND DATE(registrado_em) = CURRENT_DATE
       LIMIT 1`,
      [usoId],
    )

    if (hojeResult.rows.length === 0) {
      throw createError({
        statusCode: 422,
        statusMessage: 'Somente baixas do dia podem ser estornadas',
      })
    }

    const posteriorResult = await client.query<{ ok: number }>(
      `SELECT 1 AS ok
       FROM reprografia_usos ru
       WHERE ru.cpf = $1
         AND ru.estornado = false
         AND ru.id <> $2
         AND ru.registrado_em > $3
       LIMIT 1`,
      [uso.cpf, uso.id, uso.registrado_em],
    )

    if (posteriorResult.rows.length > 0) {
      throw createError({
        statusCode: 422,
        statusMessage: 'Estorno bloqueado: já existem baixas posteriores para este CPF',
      })
    }

    await travarContaLivroCaixa(client, 'reprografia', uso.cpf)
    const valorEstorno = toNumber(uso.valor_total)

    // Evita inconsistência por valor inválido de origem.
    if (valorEstorno <= 0) {
      throw createError({
        statusCode: 422,
        statusMessage: 'Registro com valor inválido para estorno',
      })
    }

    await client.query(
      `UPDATE reprografia_usos
       SET estornado = true,
           estornado_em = NOW(),
           estornado_por = $1,
           estorno_motivo = $2
       WHERE id = $3`,
      [userId, parsed.data.motivo, usoId],
    )

    await registrarLancamentoLivroCaixa(client, {
      modulo: 'reprografia',
      cpf: uso.cpf,
      nome: uso.nome,
      tipo: 'credito',
      valor: valorEstorno,
      origem: 'reprografia_estorno',
      origemId: String(usoId),
      chaveIdempotencia: `reprografia:uso_estorno:${usoId}`,
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

    console.error('[reprografia/usos/estorno] Erro:', (err as Error).message)
    throw createError({ statusCode: 500, statusMessage: 'Erro interno' })
  } finally {
    client.release()
  }
})