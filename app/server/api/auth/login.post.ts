import { defineEventHandler, readBody, getRequestIP, createError, setCookie } from 'h3'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { query } from '../../utils/db'
import { signJwt } from '../../utils/jwt'
import { createSession } from '../../utils/session'
import { checkRateLimit, recordFailedAttempt, resetAttempts } from '../../utils/rateLimiter'

const loginSchema = z.object({
  email: z.string().email(),
  senha: z.string().min(1),
})

export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'

  try {
    // Validação Zod
    const body = await readBody(event)
    const parsed = loginSchema.safeParse(body)
    if (!parsed.success) {
      throw createError({ statusCode: 400, statusMessage: 'Dados inválidos' })
    }
    const { email, senha } = parsed.data

    // Rate limiting
    const rateLimit = checkRateLimit(ip)
    if (rateLimit.blocked) {
      console.log(`[auth] login bloqueado por rate limit - IP: ${ip}`)
      throw createError({ statusCode: 429, statusMessage: 'Muitas tentativas. Tente novamente mais tarde.' })
    }

    // Buscar usuário por email (query parametrizada)
    const result = await query<{ id: string; senha_hash: string; ativo: boolean }>(
      'SELECT id, senha_hash, ativo FROM usuarios WHERE email = $1',
      [email],
    )

    const usuario = result.rows[0]

    // Usuário não encontrado ou inativo — mensagem genérica (não revela qual campo falhou)
    if (!usuario || !usuario.ativo) {
      recordFailedAttempt(ip)
      console.log(`[auth] login falha (usuário inválido) - IP: ${ip}`)
      throw createError({ statusCode: 401, statusMessage: 'Credenciais inválidas' })
    }

    // Verificar senha com bcrypt
    const senhaValida = await bcrypt.compare(senha, usuario.senha_hash)
    if (!senhaValida) {
      recordFailedAttempt(ip)
      console.log(`[auth] login falha (senha incorreta) - IP: ${ip}`)
      throw createError({ statusCode: 401, statusMessage: 'Credenciais inválidas' })
    }

    // Buscar grupos do usuário
    const gruposResult = await query<{ nome: string }>(
      `SELECT g.nome FROM grupos g
       INNER JOIN usuario_grupos ug ON ug.grupo_id = g.id
       WHERE ug.usuario_id = $1`,
      [usuario.id],
    )
    const grupos = gruposResult.rows.map((r) => r.nome)

    // Gerar JWT
    const token = signJwt({ sub: usuario.id, email, grupos })

    // Criar sessão no banco (armazena apenas hash SHA-256)
    await createSession(usuario.id, ip, token)

    // Resetar contador de tentativas falhas
    resetAttempts(ip)

    // Set-Cookie com flags de segurança (HttpOnly, Secure, SameSite=Strict)
    setCookie(event, 'session', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 28800, // 8 horas em segundos
    })

    console.log(`[auth] login sucesso - IP: ${ip}`)
    return { ok: true }
  } catch (err: unknown) {
    // Re-lança erros H3 (400, 401, 429) sem modificar
    if (err && typeof err === 'object' && 'statusCode' in err) {
      throw err
    }
    // Erro interno — loga detalhes no servidor, retorna mensagem genérica ao cliente
    console.error('[auth] erro interno no login:', (err as Error).message)
    throw createError({ statusCode: 500, statusMessage: 'Erro interno. Tente novamente.' })
  }
})
