import jwt from 'jsonwebtoken'

export interface JWTPayload {
  sub: string
  email: string
  grupos: string[]
  iat?: number
  exp?: number
}

/**
 * Gera um JWT assinado com HS256.
 * Chave: process.env.JWT_SECRET
 * Expiração: process.env.JWT_EXPIRES_IN ?? '8h'
 */
export function signJwt(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET não configurado')
  }
  return jwt.sign(payload, secret, {
    algorithm: 'HS256',
    expiresIn: (process.env.JWT_EXPIRES_IN ?? '8h') as jwt.SignOptions['expiresIn'],
  })
}

/**
 * Verifica assinatura e expiração do JWT.
 * Lança erro genérico se inválido — não expõe detalhes ao cliente.
 */
export function verifyJwt(token: string): JWTPayload {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET não configurado')
  }
  try {
    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] })
    return decoded as JWTPayload
  } catch {
    throw new Error('Token inválido')
  }
}
