import fs from 'node:fs'
import jwt from 'jsonwebtoken'

/**
 * Verifica se o arquivo de chave privada RSA existe e é legível.
 * Retorna true/false sem lançar exceção.
 */
function verificarChavePrivada(): boolean {
  const keyPath = process.env.SISGRU_PRIVATE_KEY_PATH
  if (!keyPath) return false
  try {
    fs.accessSync(keyPath, fs.constants.R_OK)
    return true
  } catch {
    return false
  }
}

/**
 * Gera um JWT RS256 para autenticação no SISGRU.
 * Header: { alg: 'RS256', typ: 'JWT' }
 * Payload: { iss, iat, exp (iat + 600) }
 * Lança erro descritivo se a chave privada não existir.
 */
function gerarJwtSisgru(): string {
  const keyPath = process.env.SISGRU_PRIVATE_KEY_PATH
  if (!keyPath) {
    throw new Error(
      '[sisgruJwt] SISGRU_PRIVATE_KEY_PATH não está definido nas variáveis de ambiente.',
    )
  }

  if (!verificarChavePrivada()) {
    throw new Error(
      `[sisgruJwt] Chave privada RSA não encontrada ou sem permissão de leitura: ${keyPath}`,
    )
  }

  const privateKey = fs.readFileSync(keyPath, 'utf-8')
  const iat = Math.floor(Date.now() / 1000)

  const token = jwt.sign(
    {
      iss: process.env.SISGRU_ISSUER,
      iat,
      exp: iat + 600,
    },
    privateKey,
    {
      algorithm: 'RS256',
      header: { alg: 'RS256', typ: 'JWT' },
    },
  )

  return token
}

export { gerarJwtSisgru, verificarChavePrivada }
