# Setup do Ambiente Dev (Docker Compose)

Este documento descreve como subir o ambiente de desenvolvimento (`dev`) do **Sistema Tesouraria** usando `docker compose`.

## 1. Pre-requisitos

- Docker e Docker Compose instalados e funcionando.
- A pasta do projeto e o diretorio de trabalho e:
  - `.../sistema-tesouraria`

## 2. Configurar variaveis de ambiente

1. Copie o exemplo para o `.env`:

```bash
cp .env.example .env
```

2. Preencha obrigatoriamente:
- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `PGADMIN_DEFAULT_PASSWORD`

3. Verifique se `DATABASE_URL` e compativel com os containers (conforme o `.env.example`).

### 2.1 Como gerar o `JWT_SECRET`

`JWT_SECRET` e a **chave secreta usada para assinar JWT HS256** (nao e chave SSL).

Para gerar um valor forte (recomendado: 32 bytes ou mais), rode dentro do container `nuxt`:

```bash
docker compose exec nuxt node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Copie o valor impresso e cole no `.env` em `JWT_SECRET=...`.

## 3. Gerar certificado SSL do dev (necessario para Nginx)

O Nginx no dev termina SSL e monta o diretorio:
- `./ssl/dev`  (como `/etc/nginx/ssl` dentro do container)

Garanta que existam:
- `ssl/dev/cert.pem`
- `ssl/dev/key.pem`

Para gerar:

```bash
sh scripts/gen-ssl-dev.sh
```

## 4. Subir os containers

No diretorio raiz do projeto:

```bash
docker compose up -d --build
```

## 5. Checar portas e acessos

- Aplicacao via Nginx/SSL:
  - `https://localhost` (HTTP `80` redireciona para `HTTPS`)
- pgAdmin (dev):
  - `http://localhost:5050`

## 6. Rodar migrations

As migrations estao em `app/server/db/migrations/*.sql`.

Execute o script no container `nuxt`:

```bash
docker compose exec nuxt npx tsx server/db/migrate.ts
```

## 7. Aplicar seed (criar admin + grupos/permissoes)

O seed esta em `app/server/db/seed.sql`.

Para executar via container `nuxt` (evita depender de ferramentas no host):

```bash
docker compose exec nuxt node -e "
  const fs = require('fs');
  const { Pool } = require('pg');
  const sql = fs.readFileSync('server/db/seed.sql', 'utf8');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  pool.query(sql)
    .then(() => { console.log('seed ok'); return pool.end(); })
    .catch((e) => { console.error(e); process.exit(1); });
"
```

Depois do seed, voce pode entrar na aplicacao com o admin inicial criado pelo seed.

Credenciais (do seed):
- Email: `admin@concordia.ifc.edu.br`
- Senha: `Admin@123456` (verifique no comentario do proprio `seed.sql`, caso voce tenha alterado o hash)

## 8. (Opcional) SISGRU sync

O cron de sincronizacao do SISGRU e desabilitado automaticamente quando a chave RSA nao estiver disponivel.

Para habilitar:
- garanta que `SISGRU_PRIVATE_KEY_PATH` esteja apontando para um arquivo legivel **dentro** do container (conforme `.env`).

## 9. Parar o ambiente

```bash
docker compose down
```

## 10. Deploy de producao (imagem pronta)

O projeto agora usa build multi-stage no Dockerfile para producao.
Isso significa que o `npm run build` acontece no `docker build` e o container sobe
direto com `node .output/server/index.mjs`.

### 10.1 Preparar ambiente de producao

1. Crie `.env.prod` a partir de `.env.example` e preencha os valores de producao.
2. Garanta os certificados TLS em:
   - `ssl/prod/cert.pem`
   - `ssl/prod/key.pem`
3. Garanta que a senha no `DATABASE_URL` esteja com URL encoding quando tiver caracteres especiais.
  - Exemplo: `@` vira `%40`, `#` vira `%23`, `!` vira `%21`.
4. Se for usar SISGRU, garanta o arquivo de chave em `.secrets/sisgru.key` e use:
  - `SISGRU_PRIVATE_KEY_PATH=/run/secrets/sisgru.key`

### 10.2 Subir stack de producao

Use o compose dedicado de producao:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

### 10.3 Rodar migrations em producao

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod exec nuxt npx tsx server/db/migrate.ts
```

### 10.4 Seed inicial (somente primeiro deploy)

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

### 10.5 Verificacao rapida

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod ps
docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f nginx nuxt postgres
```

### 10.6 Atualizacao de versao

1. Atualize o codigo no servidor.
2. Execute novamente:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.prod exec nuxt npx tsx server/db/migrate.ts
```

