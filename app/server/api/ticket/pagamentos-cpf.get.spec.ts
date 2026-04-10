import { beforeEach, describe, expect, it, vi } from 'vitest'

const getQueryMock = vi.fn()
const queryMock = vi.fn()

vi.mock('h3', () => ({
  defineEventHandler: (handler: unknown) => handler,
  getQuery: (...args: unknown[]) => getQueryMock(...args),
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

import handler from './pagamentos-cpf.get'

describe('ticket/pagamentos-cpf.get', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retorna 400 quando CPF invalido', async () => {
    getQueryMock.mockReturnValue({ cpf: '123' })

    await expect(handler({} as never)).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'CPF deve ter 11 dígitos',
    })
  })

  it('calcula saldo com base no livro-caixa de ticket', async () => {
    getQueryMock.mockReturnValue({ cpf: '12345678901' })

    queryMock
      .mockResolvedValueOnce({
        rows: [
          {
            id: 10,
            codigo_contribuinte: '12345678901',
            nome_contribuinte: 'Usuario Teste',
            valor_total: '50.00',
            situacao: 'CO',
            data: '2026-04-01',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ creditos: '100.00', debitos: '30.00' }] })

    const result = await handler({} as never)

    expect(result).toMatchObject({
      cpf: '12345678901',
      nome: 'Usuario Teste',
      total_creditos: 100,
      total_consumido: 30,
      saldo_disponivel: 70,
    })

    expect(result.pagamentos).toHaveLength(1)
    expect(result.pagamentos[0]).toMatchObject({
      id: 10,
      valor_total: 50,
    })

    const sqlCalls = queryMock.mock.calls.map((call) => String(call[0]).toLowerCase())
    expect(sqlCalls.some((sql) => sql.includes('financeiro_lancamentos'))).toBe(true)
    expect(sqlCalls.some((sql) => sql.includes('ticket_retirado'))).toBe(false)
    expect(sqlCalls.some((sql) => sql.includes('ticket_transacao'))).toBe(false)
  })
})
