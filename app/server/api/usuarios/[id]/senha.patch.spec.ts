import { beforeEach, describe, expect, it, vi } from 'vitest'

const readBodyMock = vi.fn()
const getRouterParamMock = vi.fn()
const requirePermissionMock = vi.fn()
const queryMock = vi.fn()
const hashMock = vi.fn()

vi.mock('h3', () => ({
  defineEventHandler: (handler: unknown) => handler,
  readBody: (...args: unknown[]) => readBodyMock(...args),
  getRouterParam: (...args: unknown[]) => getRouterParamMock(...args),
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

vi.mock('../../../utils/rbac', () => ({
  requirePermission: (...args: unknown[]) => requirePermissionMock(...args),
}))

vi.mock('../../../utils/db', () => ({
  query: (...args: unknown[]) => queryMock(...args),
}))

vi.mock('bcryptjs', () => ({
  default: {
    hash: (...args: unknown[]) => hashMock(...args),
  },
}))

import handler from './senha.patch'

describe('usuarios/[id]/senha.patch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requirePermissionMock.mockResolvedValue(undefined)
  })

  it('retorna 400 quando id nao e informado', async () => {
    getRouterParamMock.mockReturnValue(undefined)

    await expect(handler({} as never)).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'ID do usuário não fornecido',
    })
  })

  it('retorna 400 para payload invalido', async () => {
    getRouterParamMock.mockReturnValue('u1')
    readBodyMock.mockResolvedValue({ nova_senha: '123' })

    await expect(handler({} as never)).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'Dados inválidos',
    })
  })

  it('retorna 404 quando usuario nao existe', async () => {
    getRouterParamMock.mockReturnValue('u404')
    readBodyMock.mockResolvedValue({ nova_senha: 'NovaSenha@123' })
    queryMock.mockResolvedValueOnce({ rows: [] })

    await expect(handler({} as never)).rejects.toMatchObject({
      statusCode: 404,
      statusMessage: 'Usuário não encontrado',
    })
  })

  it('troca senha por admin com sucesso', async () => {
    getRouterParamMock.mockReturnValue('u1')
    readBodyMock.mockResolvedValue({ nova_senha: 'NovaSenha@123' })
    queryMock.mockResolvedValueOnce({ rows: [{ id: 'u1' }] })
    hashMock.mockResolvedValue('hash-admin')
    queryMock.mockResolvedValueOnce({ rowCount: 1 })

    const result = await handler({} as never)

    expect(result).toEqual({ ok: true })
    expect(requirePermissionMock).toHaveBeenCalled()
    expect(hashMock).toHaveBeenCalledWith('NovaSenha@123', 12)
    expect(queryMock).toHaveBeenNthCalledWith(
      2,
      'UPDATE usuarios SET senha_hash = $1, atualizado_em = NOW() WHERE id = $2',
      ['hash-admin', 'u1'],
    )
  })

  it('aceita payload camelCase para nova senha', async () => {
    getRouterParamMock.mockReturnValue('u1')
    readBodyMock.mockResolvedValue({ novaSenha: 'NovaSenha@123' })
    queryMock.mockResolvedValueOnce({ rows: [{ id: 'u1' }] })
    hashMock.mockResolvedValue('hash-admin')
    queryMock.mockResolvedValueOnce({ rowCount: 1 })

    const result = await handler({} as never)

    expect(result).toEqual({ ok: true })
    expect(hashMock).toHaveBeenCalledWith('NovaSenha@123', 12)
  })
})
