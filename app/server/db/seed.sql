-- =============================================================================
-- ATENÇÃO: Gere um hash bcrypt real para a senha antes de usar em produção.
-- Para gerar: docker compose exec nuxt node -e "
--   const bcrypt = require('bcryptjs');
--   bcrypt.hash('Admin@123456', 12).then(h => console.log(h));
-- "
-- Substitua o valor de senha_hash abaixo pelo hash gerado.
-- =============================================================================

-- Usuário admin inicial
INSERT INTO usuarios (id, nome, email, senha_hash, ativo)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Administrador',
    'admin@concordia.ifc.edu.br',
    '$2a$12$0eofmZFmqi2eEM0yGCuVC.G.Ygq8Hx4k/BEJxuuhnImZ1MTK/1feW',
    true
)
ON CONFLICT DO NOTHING;

-- Grupos
INSERT INTO grupos (id, nome, descricao) VALUES
    ('00000000-0000-0000-0000-000000000010', 'admin',       'Administradores do sistema'),
    ('00000000-0000-0000-0000-000000000011', 'tesoureiro',  'Servidores da tesouraria'),
    ('00000000-0000-0000-0000-000000000012', 'reprografia', 'Operadores da reprografia')
ON CONFLICT DO NOTHING;

-- Permissões
INSERT INTO permissoes (id, nome, descricao) VALUES
    ('00000000-0000-0000-0000-000000000020', 'admin.usuarios',    'Gerenciar usuários'),
    ('00000000-0000-0000-0000-000000000021', 'admin.grupos',      'Gerenciar grupos'),
    ('00000000-0000-0000-0000-000000000022', 'admin.reprografia', 'Configurar reprografia'),
    ('00000000-0000-0000-0000-000000000023', 'admin.sync_log',    'Visualizar log de sincronização'),
    ('00000000-0000-0000-0000-000000000024', 'admin.sync',        'Disparar sincronização manual'),
    ('00000000-0000-0000-0000-000000000025', 'tesoureiro.grus',       'Visualizar GRUs'),
    ('00000000-0000-0000-0000-000000000026', 'tesoureiro.pagamentos', 'Visualizar pagamentos'),
    ('00000000-0000-0000-0000-000000000027', 'tesoureiro.ticket',     'Marcar retirada de ticket'),
    ('00000000-0000-0000-0000-000000000028', 'reprografia.creditos',  'Consultar créditos de reprografia'),
    ('00000000-0000-0000-0000-000000000029', 'reprografia.usos',      'Registrar uso de reprografia')
ON CONFLICT DO NOTHING;

-- Associação: usuário admin → grupo admin
INSERT INTO usuario_grupos (usuario_id, grupo_id) VALUES
    ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010')
ON CONFLICT DO NOTHING;

-- Associações grupo_permissoes: grupo admin → todas as permissões
INSERT INTO grupo_permissoes (grupo_id, permissao_id) VALUES
    ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000020'),
    ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000021'),
    ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000022'),
    ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000023'),
    ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000024'),
    ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000025'),
    ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000026'),
    ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000027'),
    ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000028'),
    ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000029')
ON CONFLICT DO NOTHING;

-- Associações grupo_permissoes: grupo tesoureiro → tesoureiro.*
INSERT INTO grupo_permissoes (grupo_id, permissao_id) VALUES
    ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000025'),
    ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000026'),
    ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000027')
ON CONFLICT DO NOTHING;

-- Associações grupo_permissoes: grupo reprografia → reprografia.*
INSERT INTO grupo_permissoes (grupo_id, permissao_id) VALUES
    ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000028'),
    ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000029')
ON CONFLICT DO NOTHING;
