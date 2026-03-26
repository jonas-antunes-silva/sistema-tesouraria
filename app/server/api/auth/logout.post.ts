import { defineEventHandler, getCookie, setCookie } from 'h3'
import { invalidateSession } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'session')

  // Idempotente — sem cookie, retorna 200 normalmente
  if (!token) {
    return { ok: true }
  }

  // Invalida sessão no banco
  await invalidateSession(token)

  // Limpa o cookie no cliente
  setCookie(event, 'session', '', {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  })

  return { ok: true }
})
