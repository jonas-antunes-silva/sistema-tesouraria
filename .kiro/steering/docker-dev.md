# Steering: Ambiente Docker Dev

Todo procedimento ou comando executado pelo editor/LLM/IA deve ser rodado no ambiente Docker dev.
- Nunca executar comandos diretamente no host (npm, node, psql, etc.)
- Usar `docker compose exec` ou `docker compose run` para rodar comandos dentro dos containers
- Migrações de banco de dados devem ser executadas via container do Nuxt/app
- Instalação de dependências deve ocorrer dentro do container ou via rebuild da imagem
