import { beforeEach, describe, expect, it, vi } from 'vitest'

const queryMock = vi.fn()

vi.mock('h3', () => ({
  defineEventHandler: (handler: unknown) => handler,
  createError: (input: { statusCode: number; statusMessage: string }) => {
    const err = new Error(input.statusMessage) as Error & {
      statusCode: number
      statusMessage: string
    }
    err.statusCode = input.statusCode
    err.statusMessage = input.statusMessage
    return err
  },
}))

vi.mock('../../utils/db', () => ({
  query: (...args: unknown[]) => queryMock(...args),
}))

import handler from './transacoes.get'

describe('ticket/transacoes.get', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retorna transacoes do dia vindas de ticket_entregas', async () => {
    queryMock.mockResolvedValue({
      rows: [
        {
          id: 1,
          tipo: 'visitante',
          quantidade: 2,
          criado_em: '2026-04-01T12:00:00.000Z',
          valor_unitario: '18.50',
          valor_consumido: '37.00',
          saldo_depois: '63.00',
          responsavel_nome: 'Tesoureiro',
          codigo_contribuinte: '12345678901',
          nome_contribuinte: 'Pessoa Teste',
        },
      ],
    })

    const result = await handler()

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: 1,
      tipo: 'visitante',
      quantidade: 2,
      codigo_contribuinte: '12345678901',
      nome_contribuinte: 'Pessoa Teste',
    })

    const sqlCalls = queryMock.mock.calls.map((call) => String(call[0]).toLowerCase())
    expect(sqlCalls.some((sql) => sql.includes('from ticket_entregas'))).toBe(true)
    expect(sqlCalls.some((sql) => sql.includes('ticket_transacoes'))).toBe(false)
    expect(sqlCalls.some((sql) => sql.includes('ticket_retirado'))).toBe(false)
  })

  it('retorna 500 em erro interno', async () => {
    queryMock.mockRejectedValue(new Error('db down'))

    await expect(handler()).rejects.toMatchObject({
      statusCode: 500,
      statusMessage: 'Erro interno',
    })
  })
})
