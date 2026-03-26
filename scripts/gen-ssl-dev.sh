#!/bin/sh
# Gera certificado SSL autoassinado para desenvolvimento.
# Pode ser executado via Docker ou diretamente no host como pré-requisito de setup:
#   docker compose run --rm nuxt sh /app/scripts/gen-ssl-dev.sh
#   ou: sh scripts/gen-ssl-dev.sh

set -e

CERT_DIR="$(dirname "$0")/../ssl/dev"
mkdir -p "$CERT_DIR"

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout "$CERT_DIR/key.pem" \
  -out "$CERT_DIR/cert.pem" \
  -subj "/CN=localhost"

echo "Certificado autoassinado gerado em $CERT_DIR"
