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
está inventariado en [`docs/seguridad/API_HTTP.md`](docs/seguridad/API_HTTP.md).

Reglas de este proyecto:

1. Ese puerto **no se publica nunca** fuera de la red interna de compose
   ([`docker/compose.yaml`](docker/compose.yaml)).
2. Todo acceso externo pasa por el puente ([`bridge/`](bridge/)): token
   obligatorio, lista blanca de operaciones, validación de esquema, límites
   de frecuencia y tamaño.
3. Un pull request que exponga `/exec.lua` a Foundry, a una LAN no confiable
   o a Internet se rechaza por defecto.

Actores, activos, fronteras, amenazas y riesgos residuales están inventariados
en el [`modelo de amenazas del puente`](docs/seguridad/BRIDGE_THREAT_MODEL.md).

## Secretos

- Los secretos viven en archivos `.env` ignorados por git
  (`docker/.env.example` documenta las variables).
- No se aceptan tokens, contraseñas ni cookies en código, commits, issues,
  logs o capturas. Si un secreto se filtra, se rota inmediatamente y se
  registra en el issue correspondiente.

La generación, custodia, rotación, revocación y recuperación del Bearer se
detallan en [`docs/seguridad/BRIDGE_AUTHENTICATION.md`](docs/seguridad/BRIDGE_AUTHENTICATION.md).

## Transporte del puente Foundry

El puente autentica con un token Bearer, pero su endpoint directo usa HTTP. Por
defecto compose lo publica solo en `127.0.0.1`. Para acceder desde otro host,
protege el trayecto mediante túnel SSH, VPN confiable o proxy HTTPS con
certificado válido. No publiques el puerto `8090` directamente en Internet ni
envíes el Bearer en claro por una red no confiable. Foundry servido por HTTPS
debe consumir también un endpoint HTTPS para evitar contenido mixto.

## Alcance

Espaciokoop Lagunak está pensado para LAN doméstica y mesas de juego
privadas. Exponerlo a Internet requiere, como mínimo, TLS y autenticación
por delante (proxy inverso) y no está soportado oficialmente todavía.

## Riesgo nuevo: agentes automáticos con acceso al repositorio

Este repositorio es **público** y parte del trabajo lo realizan agentes de IA que
corren en la máquina de un colaborador con acceso `git` y `gh`. Un agente puede
leer el entorno donde viven las claves de API y escribir commits, issues y
comentarios. El riesgo no es hipotético: basta con que un agente pegue el
contenido de un fichero de configuración en un informe.

Defensa en capas, de fuera hacia dentro:

### 1. Protección en el servidor

**Secret scanning** y **push protection** de GitHub están activados en este
repositorio. Push protection se aplica al repositorio, no como regla de una rama:
rechaza secretos reconocidos antes de que lleguen al historial remoto. Secret
scanning avisa de credenciales que ya se hayan publicado o se detecten después.

Procedimiento operativo:

1. Si push protection bloquea un push, no lo eludas: retira el secreto de los
   ficheros y commits que se iban a publicar y vuelve a intentarlo. Si era una
   credencial real, revócala o rótala aunque el push no llegara al remoto.
2. Ante una alerta de secret scanning, revoca o rota primero la credencial en su
   proveedor y sustituye cualquier referencia legítima por configuración local.
3. Resuelve la alerta en *Security → Secret scanning* solo después de verificar
   la revocación. Para un falso positivo o valor de prueba, documenta el motivo
   en la propia alerta; no copies allí el valor completo.
4. Si el secreto llegó al historial, considéralo comprometido y comunica el
   incidente por el canal privado indicado al principio de este documento.

Una persona con permiso de administración puede comprobar ambas protecciones
sin registrar alertas ni credenciales:

```bash
gh api repos/VaroTv7/espaciokooplagunak \
  -q '.security_and_analysis.secret_scanning.status,
      .security_and_analysis.secret_scanning_push_protection.status'
```

Las dos líneas deben ser `enabled`.

### 2. Hook local

[`tools/hook-secretos.sh`](tools/hook-secretos.sh) bloquea commits y pushes que
contengan credenciales. El mismo fichero sirve para los dos hooks y mira cosas
distintas segun cual sea: en `pre-commit`, el indice; en `pre-push`, los commits
que se van a publicar. Esa distincion no es un detalle — un `pre-push` que mire
el indice no mira nada, porque al empujar no hay nada preparado, y deja pasar
justo el caso que importa: una credencial que ya esta en un commit hecho antes
de instalar el hook o con `SKIP_SECRET_SCAN`. Instálalo con `core.hooksPath` global y no solo en
`.git/hooks`: los agentes **clonan** el repositorio en directorios de trabajo
propios, y un hook instalado únicamente en el clon de la persona no los cubre.

### 3. Mínimo privilegio y rotación

- Las credenciales viven en el entorno; no se copian a ficheros del repositorio.
- Los tokens se acotan al permiso mínimo necesario.
- Ante cualquier duda de exposición, la credencial se rota. Es barato; el
  análisis para convencerse de que no pasó nada, no.

Si detectas una credencial en el historial, **no abras un issue público con
ella**: sigue el procedimiento de aviso privado del principio de este documento.
