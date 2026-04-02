import { beforeEach, describe, expect, it, vi } from 'vitest'

const readBodyMock = vi.fn()
const queryMock = vi.fn()
const compareMock = vi.fn()
const hashMock = vi.fn()

vi.mock('h3', () => ({
  defineEventHandler: (handler: unknown) => handler,
  readBody: (...args: unknown[]) => readBodyMock(...args),
  createError: (input: { statusCode: number; statusMessage: string; data?: unknown }) => {
    const err = new Error(input.statusMessage) as Error & {
      statusCode: number
      statusMessage: string
      data?: unknown
    }
    err.statusCode = input.statusCode
    err.statusMessage = input.statusMessage
    err.data = input.data
    return err
  },
}))

vi.mock('../../utils/db', () => ({
  query: (...args: unknown[]) => queryMock(...args),
}))

vi.mock('bcryptjs', () => ({
  default: {
    compare: (...args: unknown[]) => compareMock(...args),
    hash: (...args: unknown[]) => hashMock(...args),
  },
}))

import handler from './trocar-senha.post'

describe('auth/trocar-senha.post', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retorna 401 quando nao autenticado', async () => {
    await expect(handler({ context: {} } as never)).rejects.toMatchObject({
      statusCode: 401,
      statusMessage: 'Não autenticado',
    })
  })

  it('retorna 400 para payload invalido', async () => {
    readBodyMock.mockResolvedValue({ senha_atual: '', nova_senha: '123' })

    await expect(handler({ context: { userId: 'u1' } } as never)).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'Dados inválidos',
    })
  })

  it('retorna 401 quando senha atual e invalida', async () => {
    readBodyMock.mockResolvedValue({ senha_atual: 'errada', nova_senha: 'NovaSenha@123' })
    queryMock.mockResolvedValueOnce({ rows: [{ senha_hash: 'hash-atual', ativo: true }] })
    compareMock.mockResolvedValueOnce(false)

    await expect(handler({ context: { userId: 'u1' } } as never)).rejects.toMatchObject({
      statusCode: 401,
      statusMessage: 'Senha atual inválida',
    })
  })

  it('troca senha com sucesso', async () => {
    readBodyMock.mockResolvedValue({ senha_atual: 'Atual@123', nova_senha: 'NovaSenha@123' })
    queryMock.mockResolvedValueOnce({ rows: [{ senha_hash: 'hash-atual', ativo: true }] })
    compareMock
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
    hashMock.mockResolvedValue('hash-nova')
    queryMock.mockResolvedValueOnce({ rowCount: 1 })

    const result = await handler({ context: { userId: 'u1' } } as never)

    expect(result).toEqual({ ok: true })
    expect(hashMock).toHaveBeenCalledWith('NovaSenha@123', 12)
    expect(queryMock).toHaveBeenNthCalledWith(
      2,
      'UPDATE usuarios SET senha_hash = $1, atualizado_em = NOW() WHERE id = $2',
      ['hash-nova', 'u1'],
    )
  })
  
    it('aceita payload camelCase', async () => {
      readBodyMock.mockResolvedValue({ senhaAtual: 'Atual@123', novaSenha: 'Nova@1234' })
      queryMock.mockResolvedValueOnce({ rows: [{ senha_hash: 'hash-atual', ativo: true }] })
      compareMock
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
      hashMock.mockResolvedValue('hash-novo')
      queryMock.mockResolvedValueOnce({ rowCount: 1 })

      const result = await handler({ context: { userId: 'u1' } } as never)

      expect(result).toEqual({ ok: true })
      expect(hashMock).toHaveBeenCalledWith('Nova@1234', 12)
      expect(queryMock).toHaveBeenNthCalledWith(
        2,
        'UPDATE usuarios SET senha_hash = $1, atualizado_em = NOW() WHERE id = $2',
        ['hash-novo', 'u1'],
      )
    })
})
