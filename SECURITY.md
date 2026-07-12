# Seguridad

## Cómo informar de una vulnerabilidad

Abre un [aviso de seguridad privado de GitHub](../../security/advisories/new)
o contacta con los mantenedores del fork. No publiques detalles explotables
en issues públicos hasta que exista una corrección.

Este es un fork comunitario de EmptyEpsilon: si la vulnerabilidad afecta
también a [upstream](https://github.com/daid/EmptyEpsilon), infórmala además
allí.

## Riesgo conocido: API HTTP heredada

El servidor de juego incluye un servidor HTTP heredado
(`httpserver=<puerto>`) cuyo endpoint `/exec.lua` **ejecuta Lua arbitrario
sin autenticación**. No es un bug de este fork, es el diseño heredado;
está inventariado en [`docs/API_HTTP.md`](docs/API_HTTP.md).

Reglas de este proyecto:

1. Ese puerto **no se publica nunca** fuera de la red interna de compose
   ([`docker/compose.yaml`](docker/compose.yaml)).
2. Todo acceso externo pasa por el puente ([`bridge/`](bridge/)): token
   obligatorio, lista blanca de operaciones, validación de esquema, límites
   de frecuencia y tamaño.
3. Un pull request que exponga `/exec.lua` a Foundry, a una LAN no confiable
   o a Internet se rechaza por defecto.

## Secretos

- Los secretos viven en archivos `.env` ignorados por git
  (`docker/.env.example` documenta las variables).
- No se aceptan tokens, contraseñas ni cookies en código, commits, issues,
  logs o capturas. Si un secreto se filtra, se rota inmediatamente y se
  registra en el issue correspondiente.

## Alcance

Espaciokoop Lagunak está pensado para LAN doméstica y mesas de juego
privadas. Exponerlo a Internet requiere, como mínimo, TLS y autenticación
por delante (proxy inverso) y no está soportado oficialmente todavía.
