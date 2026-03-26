# AGENTS.md - Sistema Tesouraria

## Overview

Nuxt 3 (Vue 3 + TypeScript) + PostgreSQL application for treasury operations: GRUs, payments, and reprography credits.

## Docker Environment (REQUIRED)

All commands MUST run inside Docker:

```bash
docker compose exec nuxt <command>
```

### Build Commands

```bash
docker compose exec nuxt npm run dev      # Development server
docker compose exec nuxt npm run build    # Production build
docker compose exec nuxt npm run preview # Preview build
```

### Database

```bash
docker compose exec nuxt npx tsx app/server/db/migrate.ts  # Run migrations

# Seed database (admin user + permissions)
docker compose exec nuxt node -e "
  const fs = require('fs');
  const { Pool } = require('pg');
  const sql = fs.readFileSync('app/server/db/seed.sql', 'utf8');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  pool.query(sql).then(() => { console.log('seed ok'); return pool.end(); })
    .catch((e) => { console.error(e); process.exit(1); });
"
```

### Testing (Vitest)

```bash
docker compose exec nuxt npx vitest run           # All tests
docker compose exec nuxt npx vitest run --watch   # Watch mode
docker compose exec nuxt npx vitest run app/path/to/test.spec.ts  # Single file
docker compose exec nuxt npx vitest run --grep "pattern"          # By pattern
```

## Code Style

### TypeScript
- Strict mode enabled (`nuxt.config.ts`)
- Explicit types for parameters and return types
- Interfaces over type aliases for object shapes
- Use `satisfies` for type checking without widening

### Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Files | kebab-case | `useAuth.ts`, `login.post.ts` |
| Functions/Variables | camelCase | `fetchUser()` |
| Types/Interfaces | PascalCase | `AuthUser`, `PagamentoRow` |
| DB columns | snake_case | `usuario_id` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_ATTEMPTS` |
| Vue Components | PascalCase | `TabelaPagamentos.vue` |

### API Routes (Nuxt Server)

```typescript
// File: resource.action.ts (login.post.ts, me.get.ts)
// Always use defineEventHandler, typed responses, Zod validation

// SQL - ALWAYS parameterized
await query('SELECT id FROM usuarios WHERE email = $1', [email])
// NEVER: query(`SELECT * FROM users WHERE email = '${email}'`)
```

### Error Handling

```typescript
throw createError({ statusCode: 400, statusMessage: 'Dados inválidos' })

catch (err: unknown) {
  if (err && typeof err === 'object' && 'statusCode' in err) throw err
  console.error('[auth] erro interno:', (err as Error).message)
  throw createError({ statusCode: 500, statusMessage: 'Erro interno' })
}
```

### Vue Components

```vue
<script setup lang="ts">
interface Props { pagamentos: PagamentoRow[] }
const props = defineProps<Props>()
const emit = defineEmits<{ 'marcar-ticket': [id: number] }>()
</script>
```

### Styling
- Tailwind CSS + DaisyUI
- Theme: `emerald` (tailwind.config.ts)

## Security (OWASP)

1. Parameterized SQL queries exclusively
2. bcrypt cost factor minimum 12
3. Session cookies: `HttpOnly`, `Secure`, `SameSite=Strict`
4. Zod validation on all API routes
5. RBAC via `requirePermission()`
6. Rate limiting via `checkRateLimit()` for auth endpoints
7. Never expose internal errors to client

## File Organization

```
app/
├── components/      # Vue components (auto-imported)
│   ├── reprografia/
│   └── sisgru/
├── composables/    # useAuth.ts, etc.
├── layouts/        # auth.vue, default.vue
├── middleware/      # Client middleware (auth.ts)
├── pages/          # Route pages (admin/, grus/, pagamentos/, reprografia/)
├── server/
│   ├── api/        # auth/, grupos/, reprografia/, sisgru/, usuarios/
│   ├── db/         # migrations/, migrate.ts, seed.sql
│   ├── middleware/ # Server middleware
│   ├── services/
│   └── utils/      # db.ts, jwt.ts, rbac.ts, rateLimiter.ts, session.ts
└── nuxt.config.ts
```

## Database Conventions

- Migrations: `NNN_description.sql` (001_auth.sql)
- Always add entry to `_migrations` table
- snake_case columns, underscore prefix for private

## Logging

```typescript
console.log(`[auth] login sucesso - IP: ${ip}`)
console.error('[db] Erro ao executar query:', err.message)
```
