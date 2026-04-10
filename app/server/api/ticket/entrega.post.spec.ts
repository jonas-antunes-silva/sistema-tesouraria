import { beforeEach, describe, expect, it, vi } from 'vitest'

const readBodyMock = vi.fn()
const checkPermissionMock = vi.fn()
const transactionMock = vi.fn()

vi.mock('h3', () => ({
  defineEventHandler: (handler: unknown) => handler,
  readBody: (...args: unknown[]) => readBodyMock(...args),
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

vi.mock('../../utils/rbac', () => ({
  checkPermission: (...args: unknown[]) => checkPermissionMock(...args),
}))

vi.mock('../../utils/db', () => ({
  transaction: (...args: unknown[]) => transactionMock(...args),
}))

import handler from './entrega.post'

describe('ticket/entrega.post', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retorna 401 quando nao autenticado', async () => {
    await expect(handler({ context: {} } as never)).rejects.toMatchObject({
      statusCode: 401,
      statusMessage: 'Não autenticado',
    })
  })

  it('retorna 403 sem permissao', async () => {
    checkPermissionMock.mockResolvedValue(false)

    await expect(handler({ context: { userId: 'u1' } } as never)).rejects.toMatchObject({
      statusCode: 403,
      statusMessage: 'Acesso negado',
    })
  })

  it('registra baixa parcial com saldo suficiente', async () => {
    checkPermissionMock.mockImplementation(async (_userId: string, perm: string) => perm === 'tesoureiro')
    readBodyMock.mockResolvedValue({
      cpf: '12345678901',
      tipo: 'visitante',
      quantidade: 2,
    })

    const clientQueryMock = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ valor: '18.50' }] })
      .mockResolvedValueOnce({ rows: [{ nome_contribuinte: 'Pessoa Teste' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ creditos: '100.00', debitos: '20.00' }] })
      .mockResolvedValueOnce({ rows: [{ id: 123 }] })
      .mockResolvedValueOnce({ rows: [{ id: '1' }], rowCount: 1 })

    transactionMock.mockImplementation(async (cb: (client: { query: typeof clientQueryMock }) => Promise<unknown>) =>
      cb({ query: clientQueryMock }),
    )

    const result = await handler({ context: { userId: 'u1' } } as never)

    expect(result).toMatchObject({
      ok: true,
      quantidade: 2,
      valorConsumido: 37,
      saldoDepois: 43,
    })

    const sqlCalls = clientQueryMock.mock.calls.map((call) => String(call[0]).toLowerCase())
    expect(sqlCalls.some((sql) => sql.includes('ticket_retirado'))).toBe(false)
    expect(sqlCalls.some((sql) => sql.includes('ticket_transacao'))).toBe(false)
  })

  it('retorna 422 quando saldo insuficiente', async () => {
    checkPermissionMock.mockImplementation(async (_userId: string, perm: string) => perm === 'tesoureiro')
    readBodyMock.mockResolvedValue({
      cpf: '12345678901',
      tipo: 'visitante',
      quantidade: 2,
    })

    const clientQueryMock = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ valor: '20.00' }] })
      .mockResolvedValueOnce({ rows: [{ nome_contribuinte: 'Pessoa Teste' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ creditos: '30.00', debitos: '0.00' }] })

    transactionMock.mockImplementation(async (cb: (client: { query: typeof clientQueryMock }) => Promise<unknown>) =>
      cb({ query: clientQueryMock }),
    )

    await expect(handler({ context: { userId: 'u1' } } as never)).rejects.toMatchObject({
      statusCode: 422,
      statusMessage: 'Saldo insuficiente para a quantidade informada',
    })
  })
})
