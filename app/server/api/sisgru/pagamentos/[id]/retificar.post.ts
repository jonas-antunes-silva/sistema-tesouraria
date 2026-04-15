import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { pool } from '../../../../utils/db'
import { requirePermission } from '../../../../utils/rbac'
import {
  moduloPorServicoId,
  obterResumoLivroCaixa,
  registrarLancamentoLivroCaixa,
  travarContaLivroCaixa,
} from '../../../../utils/livroCaixa'

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
    const moduloAnterior = moduloPorServicoId(servicoIdAnterior)
    const moduloNovo = moduloPorServicoId(novoServicoId)

    if (moduloAnterior && moduloAnterior !== moduloNovo) {
      await travarContaLivroCaixa(client, moduloAnterior, cpfDigits)
      const resumoConta = await obterResumoLivroCaixa(client, moduloAnterior, cpfDigits)
      const saldoAtual = resumoConta.saldo
      
      if (saldoAtual < valorPagamento) {
        const mensagemErro = moduloAnterior === 'reprografia'
          ? 'Retificação bloqueada: crédito de impressão já utilizado'
          : 'Retificação bloqueada: o saldo atual de ticket não cobre o valor deste pagamento'

        throw createError({
          statusCode: 422,
          statusMessage: mensagemErro,
        })
      }
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

    const retificacaoResult = await client.query<{ id: number }>(
      `INSERT INTO sisgru_pagamentos_retificacoes (
         pagamento_id,
         servico_id_anterior,
         servico_nome_anterior,
         servico_id_novo,
         servico_nome_novo,
         retificado_por
       ) VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        pagamentoId,
        servicoIdAnterior,
        servicoNomeAnterior,
        novoServicoId,
        novoServicoNome,
        userId,
      ],
    )

    const retificacaoId = retificacaoResult.rows[0]?.id
    if (!retificacaoId) {
      throw createError({ statusCode: 500, statusMessage: 'Falha ao registrar retificação' })
    }

    if (valorPagamento > 0 && pagamento.situacao === 'CO' && moduloAnterior !== moduloNovo) {
      if (moduloAnterior) {
        await registrarLancamentoLivroCaixa(client, {
          modulo: moduloAnterior,
          cpf: cpfDigits,
          nome: pagamento.nome_contribuinte,
          tipo: 'debito',
          valor: valorPagamento,
          origem: 'retificacao_pagamento',
          origemId: String(retificacaoId),
          chaveIdempotencia: `${moduloAnterior}:retificacao_saida:${retificacaoId}`,
          metadata: {
            pagamento_id: pagamentoId,
            servico_id_anterior: servicoIdAnterior,
            servico_id_novo: novoServicoId,
          },
        })
      }

      if (moduloNovo) {
        await registrarLancamentoLivroCaixa(client, {
          modulo: moduloNovo,
          cpf: cpfDigits,
          nome: pagamento.nome_contribuinte,
          tipo: 'credito',
          valor: valorPagamento,
          origem: 'retificacao_pagamento',
          origemId: String(retificacaoId),
          chaveIdempotencia: `${moduloNovo}:retificacao_entrada:${retificacaoId}`,
          metadata: {
            pagamento_id: pagamentoId,
            servico_id_anterior: servicoIdAnterior,
            servico_id_novo: novoServicoId,
          },
        })
      }
    }

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