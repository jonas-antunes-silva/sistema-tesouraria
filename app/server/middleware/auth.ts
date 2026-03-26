import { defineEventHandler, getCookie, createError, getRequestURL } from 'h3'
import { validateSession } from '../utils/session'

const PUBLIC_ROUTES = ['/api/auth/login', '/api/auth/logout']

export default defineEventHandler(async (event) => {
  const pathname = getRequestURL(event).pathname

  // Aplica apenas em rotas /api/* exceto as públicas
  if (!pathname.startsWith('/api/') || PUBLIC_ROUTES.includes(pathname)) {
    return
  }

  const token = getCookie(event, 'session')
  if (!token) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const session = await validateSession(token)
  if (!session) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  event.context.userId = session.userId
})
