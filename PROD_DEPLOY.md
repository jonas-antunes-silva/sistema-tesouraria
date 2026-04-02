# Deploy de Producao

Este guia descreve como subir o ambiente de producao do Sistema Tesouraria com Docker Compose.

## 1. Pre-requisitos

- Docker Engine e Docker Compose Plugin instalados
- DNS do dominio apontando para o servidor
- Portas 80 e 443 liberadas

## 2. Preparar arquivos e segredos

1. Na raiz do projeto, crie `.env.prod` a partir de `.env.example`.
2. Preencha pelo menos:
   - `POSTGRES_DB`
   - `POSTGRES_USER`
   - `POSTGRES_PASSWORD`
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `NODE_ENV=production`
3. Se a senha do banco tiver caracteres especiais, aplique URL encoding no `DATABASE_URL`.
   - Exemplo: `@` -> `%40`, `#` -> `%23`, `!` -> `%21`
4. Garanta os certificados TLS:
   - `ssl/prod/cert.pem`
   - `ssl/prod/key.pem`
5. Se usar SISGRU, garanta a chave em `.secrets/sisgru.key` e configure:
   - `SISGRU_PRIVATE_KEY_PATH=/run/secrets/sisgru.key`

## 3. Subir a stack de producao

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

## 4. Rodar migrations

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod exec nuxt npx tsx server/db/migrate.ts
```

## 5. Seed inicial (somente primeiro deploy)

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod exec nuxt node -e "
  const fs = require('fs');
  const { Pool } = require('pg');
  const sql = fs.readFileSync('server/db/seed.sql', 'utf8');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  pool.query(sql)
    .then(() => { console.log('seed ok'); return pool.end(); })
    .catch((e) => { console.error(e); process.exit(1); });
"
```

## 6. Verificacao rapida

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod ps
docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f nginx nuxt postgres
```

## 7. Atualizacao de versao

1. Atualize o codigo no servidor.
2. Reexecute:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.prod exec nuxt npx tsx server/db/migrate.ts
```

## 8. Erros comuns

1. Erro de `.output/server/index.mjs`:
   - Confirme que esta usando apenas `docker-compose.prod.yml`.
2. Erro de conexao ao banco (`ENOTFOUND` com host estranho):
   - Revise o `DATABASE_URL` e aplique URL encoding na senha.
3. SISGRU desabilitado no startup:
   - Confirme mount da chave e `SISGRU_PRIVATE_KEY_PATH`.
