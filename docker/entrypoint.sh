#!/bin/sh
# Traduce variables de entorno a las preferencias clave=valor que entiende
# EmptyEpsilon. Cualquier argumento extra se añade tal cual al final, de modo
# que `docker run imagen startpaused=1` sigue funcionando.
set -eu

: "${EE_SCENARIO:=scenario_00_basic.lua}"
: "${EE_SERVER_NAME:=Espaciokoop Lagunak}"
: "${EE_SERVER_PORT:=35666}"
: "${EE_HTTP_PORT:=8080}"
: "${EE_SERVER_PASSWORD:=}"

set -- \
    "headless=${EE_SCENARIO}" \
    "headless_name=${EE_SERVER_NAME}" \
    "headless_internet=0" \
    "server_port=${EE_SERVER_PORT}" \
    "httpserver=${EE_HTTP_PORT}" \
    "www_directory=/opt/espaciokoop/www" \
    "$@"

if [ -n "${EE_SERVER_PASSWORD}" ]; then
    set -- "headless_password=${EE_SERVER_PASSWORD}" "$@"
fi

exec /opt/espaciokoop/EmptyEpsilon "$@"
