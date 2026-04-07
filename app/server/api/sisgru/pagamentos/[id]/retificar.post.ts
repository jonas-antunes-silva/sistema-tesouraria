import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { pool } from '../../../../utils/db'
import { requirePermission } from '../../../../utils/rbac'

const bodySchema = z.object({
  novo_servico_id: z.number().int().positive('Serviço inválido'),
  novo_servico_nome: z.string().trim().min(1, 'Nome do serviço inválido').max(255),
})

interface PagamentoLockRow {
  id: number
  codigo_contribuinte: string
  nome_contribuinte: string
  valor_total: string
  situacao: string
  servico_id: number | string
  servico_nome: string
  servico_id_retificado: number | string | null
  servico_nome_retificado: string | null
}

function parseId(value: string | undefined): number {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID de pagamento inválido' })
  }
  return id
}

function toNumber(value: string): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'tesoureiro.pagamentos')

  const userId = event.context.userId as string
  const pagamentoId = parseId(getRouterParam(event, 'id'))
  const body = await readBody(event)
  const parsedBody = bodySchema.safeParse(body)

  if (!parsedBody.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsedBody.error.errors[0]?.message ?? 'Dados inválidos',
    })
  }

  const { novo_servico_id: novoServicoId, novo_servico_nome: novoServicoNome } = parsedBody.data
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const pagamentoResult = await client.query<PagamentoLockRow>(
      `SELECT id,
              codigo_contribuinte,
              nome_contribuinte,
              valor_total::text,
              situacao,
              servico_id,
              servico_nome,
              servico_id_retificado,
              servico_nome_retificado
       FROM sisgru_pagamentos
       WHERE id = $1
       FOR UPDATE`,
      [pagamentoId],
    )

    const pagamento = pagamentoResult.rows[0]
    if (!pagamento) {
      throw createError({ statusCode: 404, statusMessage: 'Pagamento não encontrado' })
    }

    const servicoIdAnterior = Number(pagamento.servico_id_retificado ?? pagamento.servico_id)
    const servicoNomeAnterior = pagamento.servico_nome_retificado ?? pagamento.servico_nome
    const valorPagamento = toNumber(pagamento.valor_total)

    if (servicoIdAnterior === novoServicoId && servicoNomeAnterior === novoServicoNome) {
      throw createError({ statusCode: 409, statusMessage: 'Pagamento já está com esse serviço' })
    }

    if (pagamento.situacao !== 'CO') {
      throw createError({
        statusCode: 422,
        statusMessage: 'Apenas pagamentos concluídos podem ser retificados',
      })
    }

    const servicoExiste = await client.query<{ ok: number }>(
      `SELECT 1 AS ok
       FROM sisgru_pagamentos
       WHERE (
         (servico_id = $1 AND servico_nome = $2)
         OR (servico_id_retificado = $1 AND servico_nome_retificado = $2)
       )
       LIMIT 1`,
      [novoServicoId, novoServicoNome],
    )

    if (servicoExiste.rows.length === 0) {
      throw createError({ statusCode: 400, statusMessage: 'Serviço de destino inválido' })
    }

    const cpf = pagamento.codigo_contribuinte
    const cpfDigits = cpf.replace(/\D/g, '')

    // Se sair de impressão, estorna o crédito local da reprografia.
    if (servicoIdAnterior === 16279 && novoServicoId !== 16279) {
      const saldoReproResult = await client.query<{ saldo: string }>(
        `SELECT saldo::text
         FROM reprografia_creditos
         WHERE regexp_replace(cpf, '\\D', '', 'g') = $1
         FOR UPDATE`,
        [cpfDigits],
      )
      const saldoAtual = toNumber(saldoReproResult.rows[0]?.saldo ?? '0')
      if (saldoAtual < valorPagamento) {
        throw createError({
          statusCode: 422,
          statusMessage: 'Retificação bloqueada: crédito de impressão já utilizado',
        })
      }

      await client.query(
        `UPDATE reprografia_creditos
         SET saldo = saldo - $1::numeric,
             atualizado_em = NOW()
         WHERE regexp_replace(cpf, '\\D', '', 'g') = $2`,
        [valorPagamento.toFixed(2), cpfDigits],
      )
    }

    // Se sair de ticket, bloqueia somente se este pagamento já tiver consumo FIFO.
    if (servicoIdAnterior === 14671 && novoServicoId !== 14671) {
      const totalConsumidoResult = await client.query<{ total: string }>(
        `SELECT COALESCE(SUM(te.valor_consumido), 0)::text AS total
         FROM ticket_entregas te
         WHERE regexp_replace(te.cpf, '\\D', '', 'g') = $1
           AND te.estornado = false`,
        [cpfDigits],
      )

      const totalConsumido = toNumber(totalConsumidoResult.rows[0]?.total ?? '0')

      const consumoPagamentoResult = await client.query<{ consumido_no_pagamento: string }>(
        `WITH creditos AS (
           SELECT
             sp.id,
             sp.valor_total::numeric AS valor,
             SUM(sp.valor_total::numeric) OVER (
               ORDER BY sp.data ASC, sp.id ASC
               ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
             ) AS acumulado_ate_atual
           FROM sisgru_pagamentos sp
           WHERE regexp_replace(sp.codigo_contribuinte, '\\D', '', 'g') = $1
             AND sp.situacao = 'CO'
             AND COALESCE(sp.servico_id_retificado, sp.servico_id) = 14671
         ),
         alvo AS (
           SELECT
             id,
             valor,
             acumulado_ate_atual - valor AS acumulado_antes,
             acumulado_ate_atual
           FROM creditos
           WHERE id = $2
         )
         SELECT GREATEST(
                  0::numeric,
                  LEAST($3::numeric, acumulado_ate_atual) - acumulado_antes
                )::text AS consumido_no_pagamento
         FROM alvo`,
        [cpfDigits, pagamentoId, totalConsumido.toFixed(2)],
      )

      const consumidoNoPagamento = toNumber(
        consumoPagamentoResult.rows[0]?.consumido_no_pagamento ?? '0',
      )

      if (consumidoNoPagamento > 0) {
        throw createError({
          statusCode: 422,
          statusMessage: 'Retificação bloqueada: este pagamento de ticket já foi consumido',
        })
      }
    }

    // Se entrar em impressão, soma crédito local da reprografia.
    if (servicoIdAnterior !== 16279 && novoServicoId === 16279) {
      await client.query(
        `INSERT INTO reprografia_creditos (cpf, nome, saldo)
         VALUES ($1, $2, $3)
         ON CONFLICT (cpf) DO UPDATE
           SET saldo = reprografia_creditos.saldo + EXCLUDED.saldo,
               nome = EXCLUDED.nome,
               atualizado_em = NOW()`,
        [cpfDigits, pagamento.nome_contribuinte.trim(), valorPagamento.toFixed(2)],
      )
    }

    await client.query(
      `UPDATE sisgru_pagamentos
       SET servico_id_retificado = $1,
           servico_nome_retificado = $2,
           retificado = true,
           retificado_em = NOW(),
           retificado_por = $3
       WHERE id = $4`,
      [novoServicoId, novoServicoNome, userId, pagamentoId],
    )

    await client.query(
      `INSERT INTO sisgru_pagamentos_retificacoes (
         pagamento_id,
         servico_id_anterior,
         servico_nome_anterior,
         servico_id_novo,
         servico_nome_novo,
         retificado_por
       ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        pagamentoId,
        servicoIdAnterior,
        servicoNomeAnterior,
        novoServicoId,
        novoServicoNome,
        userId,
      ],
    )

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

    console.error('[sisgru/pagamentos/retificar] Erro:', (err as Error).message)
    throw createError({ statusCode: 500, statusMessage: 'Erro interno' })
  } finally {
    client.release()
  }
})