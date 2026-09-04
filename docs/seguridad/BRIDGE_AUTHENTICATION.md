# Ciclo de vida de autenticación del puente

## Contrato actual

El puente v0 protege todos los endpoints `/v1/*` con un único token Bearer
compartido. `/healthz` no requiere autenticación. El token concede toda la
lista blanca de lectura y órdenes: no identifica a una persona, no acredita el
rol GM de Foundry y no diferencia permisos.

`BRIDGE_TOKEN` se lee al arrancar el proceso del puente. No hay caducidad,
revocación remota, lista de bloqueo ni periodo de solape entre dos tokens. Un
cambio en `docker/.env` no tiene efecto hasta recrear el servicio `bridge`.
El servidor de juego no necesita reiniciarse.

El navegador del GM mantiene su copia únicamente en memoria. Recargar o cerrar
la pestaña la elimina, pero no protege frente a extensiones, XSS, herramientas
de desarrollo o un equipo comprometido. Los jugadores no deben recibir la URL
ni el token del puente.

## Alta y custodia

1. Genera al menos 32 bytes aleatorios para cada despliegue o mesa. No reutilices
   contraseñas personales ni el mismo token entre entornos.
2. Guarda el valor en `docker/.env`, nunca en el repositorio. Limita el archivo a
   la cuenta operadora (`chmod 600 docker/.env`).
3. Transfiérelo al GM por un canal cifrado distinto de issues, chat público,
   capturas o logs. Introdúcelo en el control GM del módulo; no lo persistas en
   ajustes de mundo, Journal ni sockets de Foundry.
4. Conserva copias de recuperación solo si están cifradas y sujetas a la misma
   política que otros secretos. Elimina copias temporales y limpia el
   portapapeles; un gestor de historial puede conservar versiones anteriores.

Una forma local de generar el valor es `openssl rand -hex 32`. Evita incluir el
resultado en argumentos de comandos, historial del shell, nombres de archivo o
salida capturada. Compose inyecta el secreto como variable de entorno: una
persona con control del host o del daemon Docker puede inspeccionarlo. Un gestor
de secretos del sistema o del orquestador puede custodiar el valor, pero la
versión actual del puente solo lo consume mediante `BRIDGE_TOKEN`; no admite
Docker secrets por archivo de forma nativa.

No publiques salidas completas de `docker compose config`, `docker inspect`,
dumps de entorno o herramientas de diagnóstico: pueden contener el token
resuelto. Redactar la cabecera en los logs no elimina copias ya capturadas.

## Rotación planificada

Rota el token antes de una sesión sensible, al cambiar de persona operadora,
según la política local y siempre que exista duda sobre su exposición.

1. Avisa al GM de un corte breve y detén órdenes mutables durante la rotación.
2. Genera un token nuevo y sustituye únicamente `BRIDGE_TOKEN` en
   `docker/.env`, sin imprimirlo.
3. Recrea solo el puente:

   ```bash
   cd docker
   docker compose up -d --no-deps --force-recreate bridge
   ```

4. Comprueba `/healthz`; después verifica que una petición con el token anterior
   recibe `401` y que el nuevo token accede a `/v1/state`. Haz las pruebas desde
   un terminal privado y no muestres cabeceras ni trazas.
5. Borra el token antiguo del navegador, introduce el nuevo y confirma que la
   telemetría vuelve antes de reanudar órdenes.
6. Retira el valor anterior de notas, copias temporales, portapapeles e historial
   gestionado. No afirmes que el historial del portapapeles quedó purgado si la
   plataforma no ofrece esa garantía.

Las peticiones que el proceso anterior ya hubiera autenticado pueden terminar
antes de que el contenedor se detenga. Por eso la rotación requiere una pausa
de órdenes; no proporciona revocación transaccional de operaciones en vuelo.

## Revocación y respuesta ante exposición

La revocación consiste en reemplazar el único token y recrear el puente. Si hay
riesgo activo, corta primero el acceso:

```bash
cd docker
docker compose stop bridge
```

Después genera un valor nuevo, actualiza `docker/.env`, recrea `bridge` y repite
las comprobaciones de rotación. Revisa registros únicamente para acotar el
incidente y redacta cualquier credencial antes de compartir evidencia. Si el
puerto estuvo accesible desde una red no confiable, corrige también el bind o el
transporte: cambiar el token sin cerrar la exposición no resuelve la causa.

Un `401` confirma rechazo de la credencial presentada, no demuestra que no
existan otras copias. La revocación tampoco deshace órdenes ya aceptadas; revisa
el estado autoritativo de la simulación y el Journal si el contexto lo exige.

## Fallo y rollback

- Si la rotación falla por un error operativo y **no** existe sospecha de
  compromiso, se puede restaurar temporalmente el valor anterior y recrear el
  puente para recuperar servicio.
- Si el token anterior pudo filtrarse, no lo restaures. Mantén el puente parado,
  corrige la configuración y arranca únicamente con una credencial nueva.
- Un `/healthz` correcto solo prueba que el servicio responde; valida además un
  endpoint autenticado. Un `502` con el token nuevo indica que la autenticación
  pasó pero el juego no respondió correctamente; no vuelvas al token anterior
  por ese motivo.
- Conserva `BRIDGE_BIND=127.0.0.1` por defecto. Fuera del mismo host usa un túnel,
  VPN confiable o proxy HTTPS con certificado válido; CORS no cifra ni revoca.

## Limitaciones conocidas

El contrato v0 carece de tokens por usuario, capacidades separadas de
lectura/escritura, caducidad, refresh, auditoría de identidad e idempotencia
general para órdenes. La autorización visual `game.user.isGM` es una defensa de
cliente, no una autorización aplicada por FastAPI. Un despliegue multiusuario o
público requiere una arquitectura de credenciales distinta; no debe ampliar la
exposición del puente actual.

Véanse también el [modelo de amenazas](BRIDGE_THREAT_MODEL.md), la
[configuración Docker](../../docker/README.md) y la [política de
seguridad](../../SECURITY.md).
