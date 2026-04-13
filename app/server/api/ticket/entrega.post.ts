import { defineEventHandler, readBody, createError } from 'h3'
import { z } from 'zod'
import { checkPermission } from '../../utils/rbac'
import { transaction } from '../../utils/db'
import {
  obterResumoLivroCaixa,
  registrarLancamentoLivroCaixa,
  travarContaLivroCaixa,
} from '../../utils/livroCaixa'

const BodySchema = z.object({
  cpf: z
    .string()
    .transform((v) => v.replace(/\D/g, ''))
    .refine((digits) => digits.length === 11 || digits.length === 14, 'CPF/CNPJ deve ter 11 ou 14 dígitos'),
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
    const resultado = await transaction(async (client) => {
      const precoResult = await client.query<{ valor: string }>(
        `SELECT valor::text AS valor
         FROM ticket_precos
         WHERE tipo = $1
         LIMIT 1`,
        [parsed.data.tipo],
      )

      if (precoResult.rows.length === 0) {
        throw createError({ statusCode: 422, statusMessage: 'Preço do tipo não configurado' })
      }

      const nomeResult = await client.query<{ nome_contribuinte: string }>(
        `SELECT nome_contribuinte
         FROM sisgru_pagamentos
         WHERE regexp_replace(codigo_contribuinte, '\\D', '', 'g') = $1
           AND COALESCE(servico_id_retificado, servico_id) = 14671
         ORDER BY data DESC
         LIMIT 1`,
        [parsed.data.cpf],
      )

      const nomeContribuinte = nomeResult.rows[0]?.nome_contribuinte?.trim()
      if (!nomeContribuinte) {
        throw createError({ statusCode: 404, statusMessage: 'Documento sem pagamentos de ticket' })
      }

      await travarContaLivroCaixa(client, 'ticket', parsed.data.cpf)

      const valorUnitario = Number(precoResult.rows[0].valor)
      const resumo = await obterResumoLivroCaixa(client, 'ticket', parsed.data.cpf)
      const saldoAntes = resumo.saldo
      const valorConsumido = Number((parsed.data.quantidade * valorUnitario).toFixed(2))

      if (valorConsumido > saldoAntes) {
        throw createError({
          statusCode: 422,
          statusMessage: 'Saldo insuficiente para a quantidade informada',
        })
      }

      const saldoDepois = Number((saldoAntes - valorConsumido).toFixed(2))

      const entregaResult = await client.query<{ id: number }>(
        `INSERT INTO ticket_entregas (
           cpf, nome, tipo, quantidade,
           valor_unitario, valor_consumido,
           saldo_antes, saldo_depois,
           responsavel_id
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`,
        [
          parsed.data.cpf,
          nomeContribuinte,
          parsed.data.tipo,
          parsed.data.quantidade,
          valorUnitario,
          valorConsumido,
          saldoAntes,
          saldoDepois,
          userId,
        ],
      )

      const entregaId = entregaResult.rows[0]?.id
      if (!entregaId) {
        throw createError({ statusCode: 500, statusMessage: 'Falha ao registrar entrega' })
      }

      await registrarLancamentoLivroCaixa(client, {
        modulo: 'ticket',
        cpf: parsed.data.cpf,
        nome: nomeContribuinte,
        tipo: 'debito',
        valor: valorConsumido,
        origem: 'ticket_entrega',
        origemId: String(entregaId),
        chaveIdempotencia: `ticket:entrega:${entregaId}`,
        metadata: {
          tipo: parsed.data.tipo,
          quantidade: parsed.data.quantidade,
        },
      })

      return {
        quantidade: parsed.data.quantidade,
        valorConsumido,
        saldoDepois,
      }
    })

    return { ok: true, ...resultado }
  } catch (err) {
    if (err && typeof err === 'object' && 'statusCode' in err) throw err
    console.error('[ticket/entrega] Erro:', (err as Error).message)
    throw createError({ statusCode: 500, statusMessage: 'Erro interno' })
  }
})
