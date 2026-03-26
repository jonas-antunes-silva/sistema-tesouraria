# Documento de Requisitos: Sistema Tesouraria

## Introdução

O Sistema Tesouraria é uma aplicação web full-stack construída com NuxtJS, PostgreSQL, Tailwind CSS e daisyUI (tema emerald), containerizada via Docker Compose. O sistema oferece autenticação segura com JWT, controle de acesso baseado em papéis (RBAC), integração periódica com o webservice SISGRU do Tesouro Nacional para sincronização de GRUs e Pagamentos, e telas de listagem com filtro por data. Toda a implementação segue as diretrizes de segurança OWASP.

---

## Glossário

- **Sistema**: A aplicação web Sistema Tesouraria como um todo.
- **Nuxt_App**: O servidor NuxtJS responsável pelo frontend e pelas API Routes.
- **Auth_Service**: O módulo de autenticação da Nuxt_App (rotas `/api/auth/*`).
- **RBAC_Middleware**: O middleware server-side que verifica permissões antes de cada requisição protegida.
- **Database**: O banco de dados PostgreSQL acessado exclusivamente via queries parametrizadas.
- **SISGRU_Sync**: O Nuxt Server Plugin com `node-cron` responsável pela sincronização periódica com o webservice SISGRU.
- **SISGRU_Webservice**: O webservice externo do Tesouro Nacional (`https://webservice.sisgru.tesouro.gov.br/sisgru/services/v1`).
- **GRU**: Guia de Recolhimento da União, registro retornado pelo endpoint `/grus` do SISGRU_Webservice.
- **Pagamento**: Registro de pagamento retornado pelo endpoint `/pagamentos` do SISGRU_Webservice.
- **Sync_Log**: A tabela `sisgru_sync_log` que registra cada execução de sincronização.
- **Layout_Principal**: O template de interface com header, sidebar, área de conteúdo e footer.
- **Validator**: O módulo de validação de entrada baseado em Zod, aplicado em todas as API Routes.
- **Rate_Limiter**: O mecanismo de limitação de tentativas de autenticação por IP.
- **Docker_Compose**: A infraestrutura de containerização que orquestra Nginx, Nuxt_App, PostgreSQL e pgAdmin.
- **Nginx**: O reverse proxy responsável pela terminação SSL e roteamento de requisições.
- **JWT**: JSON Web Token usado para autenticação de sessão (HS256) e autenticação no SISGRU_Webservice (RS256).
- **RBAC**: Role-Based Access Control — controle de acesso baseado em grupos e permissões.
- **UG**: Unidade Gestora arrecadadora, identificada pelo código configurado em `SISGRU_UG`.

---

## Requisitos

### Requisito 1: Autenticação de Usuários

**User Story:** Como usuário do sistema, quero me autenticar com email e senha, para que eu possa acessar as funcionalidades protegidas do Sistema Tesouraria.

#### Critérios de Aceitação

1. WHEN um usuário envia `POST /api/auth/login` com email e senha válidos, THE Auth_Service SHALL verificar as credenciais contra o Database usando query parametrizada, gerar um JWT assinado com HS256 e retornar um cookie de sessão com flags `HttpOnly`, `Secure` e `SameSite=Strict`.
2. WHEN um usuário envia `POST /api/auth/login` com credenciais inválidas, THE Auth_Service SHALL retornar HTTP 401 com mensagem genérica "Credenciais inválidas", sem distinguir qual campo falhou.
3. WHILE um usuário está autenticado, THE Auth_Service SHALL responder `GET /api/auth/me` com os dados do usuário (`id`, `nome`, `email`, `grupos`).
4. WHEN um usuário envia `POST /api/auth/logout`, THE Auth_Service SHALL invalidar a sessão no Database e remover o cookie de sessão do cliente.
5. THE Database SHALL armazenar senhas exclusivamente como hash bcrypt com custo mínimo 12, nunca em texto plano.
6. THE Database SHALL armazenar na tabela `sessoes` apenas o hash SHA-256 do JWT, nunca o token bruto.
7. WHILE uma sessão está ativa, THE Auth_Service SHALL rejeitar sessões com `expira_em` anterior ao momento atual, retornando HTTP 401.
8. WHEN um usuário inativo tenta autenticar, THE Auth_Service SHALL retornar HTTP 401 sem revelar que a conta está inativa.

---

### Requisito 2: Rate Limiting de Autenticação

**User Story:** Como administrador de segurança, quero que o sistema limite tentativas de login por IP, para que ataques de força bruta sejam mitigados.

#### Critérios de Aceitação

1. WHEN um mesmo IP realiza mais de 5 tentativas de login com falha em uma janela de 10 minutos, THE Rate_Limiter SHALL bloquear novas tentativas desse IP e retornar HTTP 429.
2. WHEN o período de bloqueio expira, THE Rate_Limiter SHALL restaurar a capacidade de autenticação para o IP bloqueado.
3. THE Auth_Service SHALL aplicar o Rate_Limiter exclusivamente no endpoint `POST /api/auth/login`.

---

### Requisito 3: Controle de Acesso Baseado em Papéis (RBAC)

**User Story:** Como administrador, quero controlar o acesso às funcionalidades por grupos e permissões, para que cada usuário acesse apenas o que lhe é permitido.

#### Critérios de Aceitação

1. WHEN uma requisição chega a uma rota protegida, THE RBAC_Middleware SHALL extrair e validar o JWT do cookie de sessão antes de permitir o acesso.
2. WHEN o JWT é válido, THE RBAC_Middleware SHALL consultar o Database para obter as permissões do usuário e verificar se a permissão necessária para a rota está presente.
3. IF o JWT está ausente, adulterado ou expirado, THEN THE RBAC_Middleware SHALL retornar HTTP 401 e redirecionar o frontend para `/login`.
4. IF o usuário está autenticado mas não possui a permissão necessária para a rota, THEN THE RBAC_Middleware SHALL retornar HTTP 403.
5. THE RBAC_Middleware SHALL aplicar verificação de permissões server-side em toda rota protegida, sem depender exclusivamente de validações no frontend.
6. THE Database SHALL manter a estrutura relacional: `usuarios` → `usuario_grupos` → `grupos` → `grupo_permissoes` → `permissoes`.

---

### Requisito 4: Gerenciamento de Usuários e Grupos

**User Story:** Como administrador, quero gerenciar usuários e grupos pelo sistema, para que eu possa controlar quem tem acesso e com quais permissões.

#### Critérios de Aceitação

1. WHEN um administrador envia `GET /api/usuarios`, THE Nuxt_App SHALL retornar a lista de usuários cadastrados no Database.
2. WHEN um administrador envia `POST /api/usuarios` com dados válidos, THE Nuxt_App SHALL criar o usuário no Database com senha armazenada como hash bcrypt (custo ≥ 12).
3. WHEN um administrador envia `GET /api/grupos`, THE Nuxt_App SHALL retornar a lista de grupos cadastrados no Database.
4. IF um não-administrador tenta acessar `/api/usuarios` ou `/api/grupos`, THEN THE RBAC_Middleware SHALL retornar HTTP 403.
5. THE Validator SHALL validar todos os campos de entrada das rotas de usuários e grupos com Zod antes de qualquer operação no Database.

---

### Requisito 5: Validação de Entrada e Proteção contra Injeção

**User Story:** Como desenvolvedor de segurança, quero que todas as entradas sejam validadas e que o banco de dados seja acessado apenas via queries parametrizadas, para que o sistema esteja protegido contra SQL Injection e outras injeções.

#### Critérios de Aceitação

1. THE Validator SHALL validar todas as entradas de todas as API Routes com schemas Zod antes de qualquer processamento.
2. THE Database SHALL executar todas as queries usando exclusivamente parâmetros posicionais (`$1`, `$2`, ...), nunca interpolação de strings SQL.
3. IF a validação Zod falhar, THEN THE Nuxt_App SHALL retornar HTTP 400 com mensagem de erro descritiva, sem expor detalhes internos ou stack traces ao cliente.
4. THE Nuxt_App SHALL retornar mensagens de erro genéricas ao cliente em todos os cenários de erro interno (HTTP 500), registrando o erro completo apenas nos logs do servidor.

---

### Requisito 6: Infraestrutura Docker Compose

**User Story:** Como operador de infraestrutura, quero que o sistema rode em containers Docker com SSL, para que o ambiente seja reproduzível e seguro tanto em desenvolvimento quanto em produção.

#### Critérios de Aceitação

1. THE Docker_Compose SHALL orquestrar os serviços: Nginx (portas 80/443), Nuxt_App (porta 3000 interna), PostgreSQL (porta 5432 interna) e pgAdmin (porta 5050, apenas em desenvolvimento).
2. WHEN o ambiente é desenvolvimento, THE Docker_Compose SHALL usar certificado SSL autoassinado gerado no build, montado em `./ssl/dev/`.
3. WHEN o ambiente é produção, THE Docker_Compose SHALL usar certificado SSL fornecido pelo usuário, montado via volume em `./ssl/prod/`, sem versionar o certificado.
4. THE Nginx SHALL terminar SSL e encaminhar requisições via HTTP interno para a Nuxt_App.
5. THE Docker_Compose SHALL manter dados do PostgreSQL em volume nomeado `postgres_data` persistente entre reinicializações.
6. THE Sistema SHALL proteger via `.gitignore` os arquivos: `.env*`, `ssl/`, `*.pem`, `*.key`, e quaisquer outros arquivos de segredos.
7. WHERE o ambiente é produção, THE Docker_Compose SHALL desabilitar o pgAdmin e usar `nuxt build` + `nuxt start` em vez de `nuxt dev`.

---

### Requisito 7: Sincronização Periódica com SISGRU

**User Story:** Como tesoureiro, quero que o sistema sincronize automaticamente GRUs e Pagamentos do SISGRU, para que os dados estejam sempre atualizados sem intervenção manual.

#### Critérios de Aceitação

1. THE SISGRU_Sync SHALL executar a sincronização de GRUs e Pagamentos em intervalos configurados pela variável de ambiente `SISGRU_SYNC_INTERVAL_MINUTES` (padrão: 10 minutos).
2. WHEN o SISGRU_Sync executa, THE SISGRU_Sync SHALL gerar um JWT RS256 com expiração de 10 minutos usando a chave privada RSA configurada em `SISGRU_PRIVATE_KEY_PATH`.
3. WHEN o SISGRU_Sync executa, THE SISGRU_Sync SHALL consultar `GET /grus` do SISGRU_Webservice com os parâmetros `ugArrecadadora` (valor de `SISGRU_UG`) e `dtEmissao` (data atual do servidor).
4. WHEN o SISGRU_Sync executa, THE SISGRU_Sync SHALL consultar `GET /pagamentos` do SISGRU_Webservice com os parâmetros `ug` (valor de `SISGRU_UG`) e `dataAlteracaoSituacaoPagTesouro` (data atual do servidor).
5. WHEN o SISGRU_Webservice retorna dados XML, THE SISGRU_Sync SHALL fazer parse do XML para objetos TypeScript e inserir os registros no Database via `INSERT ... ON CONFLICT (id) DO NOTHING`.
6. WHEN a sincronização de um endpoint conclui (com sucesso ou erro), THE SISGRU_Sync SHALL registrar na Sync_Log: `tipo`, `iniciado_em`, `finalizado_em`, `qtd_novos`, `qtd_total`, `status` e `mensagem_erro` (quando aplicável).
7. IF a sincronização de um endpoint falha (timeout, erro HTTP, XML malformado), THEN THE SISGRU_Sync SHALL registrar o erro na Sync_Log com `status = 'erro'` e continuar a sincronização do outro endpoint independentemente.
8. IF o arquivo de chave privada RSA não está montado no container, THEN THE SISGRU_Sync SHALL registrar erro crítico no log de inicialização e desabilitar a sincronização, sem impedir a inicialização da Nuxt_App.
9. THE SISGRU_Sync SHALL implementar deduplicação via `INSERT ... ON CONFLICT (id) DO NOTHING`, descartando silenciosamente registros com `id` já existente no Database.

---

### Requisito 8: Parser e Serializador XML do SISGRU

**User Story:** Como desenvolvedor, quero que o sistema faça parse correto do XML retornado pelo SISGRU, para que os dados sejam armazenados com fidelidade no banco de dados.

#### Critérios de Aceitação

1. WHEN o SISGRU_Webservice retorna XML de GRUs, THE SISGRU_Sync SHALL fazer parse de todos os campos definidos no modelo `SisgruGru` para os tipos corretos (string, number, date, timestamp).
2. WHEN o SISGRU_Webservice retorna XML de Pagamentos, THE SISGRU_Sync SHALL fazer parse de todos os campos definidos no modelo `SisgruPagamento` para os tipos corretos.
3. THE SISGRU_Sync SHALL serializar objetos `SisgruGru` e `SisgruPagamento` para o formato de inserção no Database preservando todos os campos.
4. FOR ALL objetos `SisgruGru` e `SisgruPagamento` válidos, fazer parse do XML e serializar para inserção no Database e depois recuperar do Database SHALL produzir um objeto equivalente ao original (propriedade de round-trip).
5. IF o XML retornado pelo SISGRU_Webservice está malformado ou incompleto, THEN THE SISGRU_Sync SHALL registrar o erro na Sync_Log e não inserir registros parciais no Database.

---

### Requisito 9: Tela de Listagem de GRUs

**User Story:** Como tesoureiro, quero visualizar as GRUs filtradas por data de emissão com totalizadores, para que eu possa acompanhar as arrecadações do dia.

#### Critérios de Aceitação

1. WHEN um usuário autenticado acessa `/grus`, THE Nuxt_App SHALL exibir a tela de listagem de GRUs usando o Layout_Principal.
2. WHEN um usuário seleciona uma data no filtro da tela `/grus`, THE Nuxt_App SHALL enviar `GET /api/sisgru/grus?data=DD/MM/YYYY` e recarregar a tabela com os registros da tabela `sisgru_grus` filtrados por `dt_emissao`.
3. THE Nuxt_App SHALL exibir na tabela de GRUs as colunas: ID, Nº RA, Recolhedor, Serviço, Tipo Serviço, Valor Total (formatado em R$), Situação, Dt. Emissão, Dt. Transferência, Agente Arrecadador e Meio Pagamento.
4. THE Nuxt_App SHALL exibir no rodapé da tabela de GRUs o total de registros retornados e a soma de `vl_total` formatada em R$.
5. WHEN nenhuma data é selecionada, THE Nuxt_App SHALL usar a data atual como padrão no filtro de GRUs.
6. IF um usuário não autenticado tenta acessar `/grus`, THEN THE RBAC_Middleware SHALL redirecionar para `/login`.

---

### Requisito 10: Tela de Listagem de Pagamentos

**User Story:** Como tesoureiro, quero visualizar os Pagamentos filtrados por data de alteração de situação com totalizadores, para que eu possa acompanhar os pagamentos processados.

#### Critérios de Aceitação

1. WHEN um usuário autenticado acessa `/pagamentos`, THE Nuxt_App SHALL exibir a tela de listagem de Pagamentos usando o Layout_Principal.
2. WHEN um usuário seleciona uma data no filtro da tela `/pagamentos`, THE Nuxt_App SHALL enviar `GET /api/sisgru/pagamentos?data=DD/MM/YYYY` e recarregar a tabela com os registros da tabela `sisgru_pagamentos` filtrados por `data_alteracao_situacao_pag_tesouro`.
3. THE Nuxt_App SHALL exibir na tabela de Pagamentos as colunas: ID, Código, Contribuinte, CPF/CNPJ (mascarado no formato `***.XXX.XXX-**`), Serviço, Recolhimento, Valor Total (formatado em R$), Situação (badge colorido: CO=verde, RE=amarelo), Tipo Pagamento, Data e Dt. Alteração.
4. THE Nuxt_App SHALL exibir no rodapé da tabela de Pagamentos o total de registros retornados e a soma de `valor_total` formatada em R$.
5. WHEN nenhuma data é selecionada, THE Nuxt_App SHALL usar a data atual como padrão no filtro de Pagamentos.
6. IF um usuário não autenticado tenta acessar `/pagamentos`, THEN THE RBAC_Middleware SHALL redirecionar para `/login`.

---

### Requisito 11: Template de Interface (Layout Principal)

**User Story:** Como usuário, quero navegar pelo sistema através de um layout consistente com sidebar e header, para que eu possa acessar as funcionalidades de forma intuitiva.

#### Critérios de Aceitação

1. THE Layout_Principal SHALL exibir: header com logo, nome do usuário logado e botão de logout; sidebar com menu de navegação filtrado pelos grupos do usuário; área de conteúdo dinâmica; e footer com a versão do sistema.
2. WHEN um usuário clica no botão de logout no header, THE Nuxt_App SHALL chamar `POST /api/auth/logout` e redirecionar para `/login`.
3. THE Nuxt_App SHALL aplicar o tema daisyUI "emerald" globalmente em todas as páginas autenticadas.
4. WHEN um usuário não autenticado acessa qualquer rota protegida, THE Nuxt_App SHALL usar o layout `auth.vue` (conteúdo centralizado) e exibir a tela de login.
5. THE Nuxt_App SHALL exibir no sidebar apenas os itens de menu correspondentes aos grupos e permissões do usuário autenticado.

---

### Requisito 12: Endpoints de API SISGRU

**User Story:** Como desenvolvedor, quero endpoints de API bem definidos para consulta e sincronização manual do SISGRU, para que as telas e administradores possam interagir com os dados sincronizados.

#### Critérios de Aceitação

1. WHEN um usuário autenticado envia `GET /api/sisgru/grus?data=DD/MM/YYYY`, THE Nuxt_App SHALL retornar os registros de `sisgru_grus` filtrados por `dt_emissao` igual à data informada, usando query parametrizada.
2. WHEN um usuário autenticado envia `GET /api/sisgru/pagamentos?data=DD/MM/YYYY`, THE Nuxt_App SHALL retornar os registros de `sisgru_pagamentos` filtrados por `data_alteracao_situacao_pag_tesouro` igual à data informada, usando query parametrizada.
3. WHEN um administrador envia `GET /api/sisgru/sync-log`, THE Nuxt_App SHALL retornar o histórico de registros da Sync_Log.
4. WHEN um administrador envia `POST /api/sisgru/sync`, THE Nuxt_App SHALL disparar a sincronização manual chamando `SISGRU_Sync.syncDia()` e retornar o resultado.
5. IF um não-administrador tenta acessar `GET /api/sisgru/sync-log` ou `POST /api/sisgru/sync`, THEN THE RBAC_Middleware SHALL retornar HTTP 403.
6. THE Validator SHALL validar o parâmetro `data` no formato `DD/MM/YYYY` com Zod antes de executar qualquer query nos endpoints de listagem.

---

### Requisito 13: Proteção contra XSS e CSRF

**User Story:** Como usuário, quero que o sistema me proteja contra ataques XSS e CSRF, para que minha sessão e dados não sejam comprometidos por scripts maliciosos.

#### Critérios de Aceitação

1. THE Nuxt_App SHALL configurar cookies de sessão com as flags `HttpOnly`, `Secure` e `SameSite=Strict` para prevenir acesso via JavaScript e ataques CSRF.
2. THE Nuxt_App SHALL sanitizar toda saída renderizada no frontend para prevenir execução de scripts injetados (XSS).
3. THE Nuxt_App SHALL nunca expor stack traces, mensagens de erro internas ou detalhes de implementação nas respostas HTTP ao cliente.

---

### Requisito 14: Logging e Auditoria

**User Story:** Como administrador de segurança, quero que o sistema registre eventos de autenticação e erros, para que eu possa auditar acessos e investigar incidentes.

#### Critérios de Aceitação

1. THE Auth_Service SHALL registrar nos logs do servidor cada tentativa de autenticação (sucesso e falha), incluindo IP de origem, sem registrar senhas ou tokens em texto plano.
2. THE SISGRU_Sync SHALL registrar na Sync_Log cada execução de sincronização com `tipo`, `iniciado_em`, `finalizado_em`, `qtd_novos`, `qtd_total`, `status` e `mensagem_erro`.
3. THE Nuxt_App SHALL registrar erros internos completos exclusivamente nos logs do servidor, nunca expondo detalhes ao cliente.
4. THE Database SHALL armazenar na tabela `sessoes` o campo `ip_origem` de cada sessão criada para fins de auditoria.

---

### Requisito 15: Controle de Retirada de Ticket de Alimentação

**User Story:** Como servidor da tesouraria, quero marcar na lista de pagamentos quais tickets de alimentação já foram retirados, para que eu possa controlar a entrega sem duplicidade.

#### Critérios de Aceitação

1. WHEN um usuário autenticado acessa `/pagamentos`, THE Nuxt_App SHALL exibir na coluna "Ticket" um botão "Marcar Retirada" para registros com `servico_id = 14671` e `ticket_retirado = false`.
2. WHEN um usuário autenticado acessa `/pagamentos`, THE Nuxt_App SHALL exibir na coluna "Ticket" um badge "Retirado" com tooltip contendo data/hora e nome do servidor para registros com `servico_id = 14671` e `ticket_retirado = true`.
3. WHEN um servidor clica em "Marcar Retirada", THE Nuxt_App SHALL enviar `PATCH /api/sisgru/pagamentos/:id/ticket` e, em caso de sucesso, atualizar a linha na tabela sem recarregar a página.
4. WHEN o endpoint `PATCH /api/sisgru/pagamentos/:id/ticket` é chamado, THE Nuxt_App SHALL verificar que o registro existe, que `servico_id = 14671` e que `ticket_retirado = false` antes de executar a atualização.
5. WHEN a marcação é realizada com sucesso, THE Database SHALL registrar em `sisgru_pagamentos`: `ticket_retirado = true`, `ticket_retirado_em = NOW()` e `ticket_retirado_por = id do usuário autenticado`.
6. IF o registro não existe, `servico_id ≠ 14671` ou `ticket_retirado` já é `true`, THEN THE Nuxt_App SHALL retornar HTTP 422 com mensagem descritiva.
7. THE Nuxt_App SHALL exibir a coluna "Ticket" como vazia (N/A) para registros com `servico_id ≠ 14671`.
8. IF um usuário não autenticado tenta chamar `PATCH /api/sisgru/pagamentos/:id/ticket`, THEN THE RBAC_Middleware SHALL retornar HTTP 401.

---

### Requisito 16: Acumulação de Créditos de Reprografia na Sincronização

**User Story:** Como operador da reprografia, quero que os créditos de impressão sejam acumulados automaticamente a partir dos pagamentos do SISGRU, para que o saldo de cada usuário esteja sempre atualizado sem intervenção manual.

#### Critérios de Aceitação

1. WHEN o SISGRU_Sync processa pagamentos com `servico_id = 16279`, THE SISGRU_Sync SHALL acumular o `valorTotal` de cada registro em `reprografia_creditos` para o CPF correspondente (`codigoContribuinte`), via `INSERT ... ON CONFLICT (cpf) DO UPDATE SET saldo = saldo + EXCLUDED.saldo`.
2. WHEN um CPF ainda não existe em `reprografia_creditos`, THE SISGRU_Sync SHALL criar o registro com `cpf`, `nome` (`nomeContribuinte`) e `saldo` igual ao `valorTotal` do pagamento.
3. WHEN um CPF já existe em `reprografia_creditos`, THE SISGRU_Sync SHALL atualizar o `nome` com o valor mais recente de `nomeContribuinte` e somar o `valorTotal` ao saldo existente.
4. THE SISGRU_Sync SHALL processar créditos de reprografia apenas para pagamentos com `servico_id = 16279`, ignorando outros serviços.
5. THE SISGRU_Sync SHALL garantir que cada pagamento com `servico_id = 16279` contribua para o saldo apenas uma vez, usando o `id` do pagamento como controle de deduplicação via `sisgru_pagamentos`.

---

### Requisito 17: Tela de Baixa de Créditos de Reprografia

**User Story:** Como operador da reprografia, quero consultar o saldo de um usuário pelo CPF e registrar o uso de cópias descontando do saldo, para que o controle de créditos seja feito de forma simples e auditável.

#### Critérios de Aceitação

1. WHEN um operador acessa `/reprografia`, THE Nuxt_App SHALL exibir um campo de CPF e um botão "Consultar" usando o Layout_Principal.
2. WHEN um operador informa um CPF e clica "Consultar", THE Nuxt_App SHALL enviar `GET /api/reprografia/creditos?cpf=XXX` e exibir o nome do usuário e o saldo disponível em R$.
3. WHEN o CPF não existe em `reprografia_creditos`, THE Nuxt_App SHALL exibir mensagem informando que não há créditos cadastrados para o CPF informado.
4. WHEN um operador informa o número de cópias, THE Nuxt_App SHALL calcular e exibir em tempo real o total a descontar (`num_copias * valor_por_copia`) e bloquear o botão "Registrar Baixa" se o total exceder o saldo disponível.
5. WHEN um operador clica "Registrar Baixa" com dados válidos, THE Nuxt_App SHALL enviar `POST /api/reprografia/usos` e, em caso de sucesso, atualizar o saldo exibido e adicionar o registro ao histórico sem recarregar a página.
6. WHEN a baixa é registrada com sucesso, THE Database SHALL registrar em `reprografia_usos`: `cpf`, `nome`, `num_copias`, `valor_por_copia` (snapshot do valor vigente), `valor_total`, `saldo_anterior`, `saldo_posterior` e `operador_id`; e debitar `valor_total` de `reprografia_creditos.saldo` na mesma transação.
7. THE Nuxt_App SHALL exibir abaixo do formulário uma tabela de histórico de usos ordenada por `registrado_em` decrescente, com colunas: Data/Hora, CPF (mascarado), Nome, Nº Cópias, Valor Total e Saldo Após.
8. IF `num_copias * valor_por_copia` excede o saldo disponível, THEN THE Nuxt_App SHALL retornar HTTP 422 e não alterar o saldo no Database.
9. IF um usuário não autenticado tenta acessar `/reprografia`, THEN THE RBAC_Middleware SHALL redirecionar para `/login`.

---

### Requisito 18: Administração de Configurações de Reprografia

**User Story:** Como administrador, quero configurar o valor cobrado por cópia, para que o sistema calcule corretamente o desconto de créditos.

#### Critérios de Aceitação

1. WHEN um administrador acessa `/admin/reprografia`, THE Nuxt_App SHALL exibir o valor atual por cópia configurado em `reprografia_config` e a data/hora da última atualização com o nome do administrador que a realizou.
2. WHEN um administrador altera o valor por cópia e clica "Salvar", THE Nuxt_App SHALL enviar `PUT /api/reprografia/config` e atualizar `reprografia_config` com o novo valor, `atualizado_em = NOW()` e `atualizado_por = id do usuário autenticado`.
3. THE Validator SHALL validar que o valor por cópia é um número positivo maior que zero antes de qualquer atualização no Database.
4. IF um não-administrador tenta acessar `/admin/reprografia` ou `PUT /api/reprografia/config`, THEN THE RBAC_Middleware SHALL retornar HTTP 403.
5. THE Nuxt_App SHALL usar o valor de `reprografia_config` vigente no momento de cada baixa, de forma que alterações futuras no valor não afetem registros históricos em `reprografia_usos`.
