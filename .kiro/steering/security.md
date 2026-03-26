# Steering: Segurança

Todo código gerado deve considerar segurança seguindo as diretrizes OWASP:
- Proteção contra SQL Injection via queries parametrizadas exclusivamente
- Proteção contra XSS, CSRF e outras vulnerabilidades do OWASP Top 10
- Senhas sempre armazenadas com bcrypt (custo mínimo 12)
- Cookies de sessão com flags HttpOnly, Secure e SameSite=Strict
- Validação de entrada com Zod em todas as API routes
- Nunca expor stack traces ou detalhes internos ao cliente
- Rate limiting em endpoints de autenticação
