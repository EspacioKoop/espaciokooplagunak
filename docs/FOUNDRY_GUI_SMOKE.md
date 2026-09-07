# Smoke GUI del módulo Foundry VTT

Este runbook prepara la verificación manual del issue [#29](https://github.com/EspacioKoop/espaciokooplagunak/issues/29). Debe ejecutarse una vez en **Foundry VTT v11.302 con dnd5e 2.3.1** y otra en el entorno moderno de Varo/OTACON, que usa la versión estable más reciente disponible de Foundry y debe registrar su versión exacta en cada pasada.

La prueba requiere una licencia y una sesión GM reales; no se ejecuta en CI. No marques una casilla ni aumentes `compatibility.verified` sin haber ejercitado esa versión del anfitrión.

## Matriz mantenida por el proyecto

| Entorno | Foundry VTT | Sistema | Expectativa |
|---|---|---|---|
| Eloy | **v11.302** | **dnd5e 2.3.1** | Regresión obligatoria de la ruta clásica |
| Varo/OTACON | Última versión estable disponible | Registrar id y versión exactos | Validación de la ruta moderna |

Ambas pasadas forman parte de la compatibilidad objetivo. La versión moderna no
sustituye a v11.302, y conservar v11 no justifica evitar las APIs modernas cuando
pueden seleccionarse de forma adaptativa. Si una pasada falla, registra la
incompatibilidad con reproducción; no cambies el rango del manifiesto por
suposición.

## Alcance

Cada pasada comprueba:

- activación del módulo sin errores de consola;
- botón GM en los controles de escena;
- render de la ventana de estado;
- lectura autenticada del puente;
- creación de una página en la bitácora;
- pausa y reanudación desde Foundry cuando el commit probado incluya controles
  de tempo;
- fallo cerrado y recuperación tras interrumpir el puente;
- ausencia del token en consola, notificaciones, Journal y evidencias.

No valida todavía otras órdenes desde Foundry, varios clientes ni una sesión
completa de juego. Si el commit probado es anterior a los controles de tempo,
marca esas casillas como `N/A` en vez de asumir un resultado.

## Preparación segura

1. Usa un mundo desechable o haz una copia de seguridad del mundo antes de activar el módulo.
2. Confirma que el repositorio está en el commit que se quiere probar:

   ```bash
   git rev-parse HEAD
   git status --short
   ```

3. Instala el módulo con un enlace cuyo nombre coincida con su id:

   ```bash
   ln -s /ruta/a/espaciokooplagunak/foundry-module \
     /ruta/a/FoundryVTT/Data/modules/espaciokoop-lagunak
   ```

4. Elige el transporte antes de arrancar el puente:

   - **Mismo host:** conserva `BRIDGE_BIND=127.0.0.1` y configura Foundry con
     `http://127.0.0.1:8090`.
   - **Host remoto:** usa un túnel SSH, una VPN confiable o un proxy HTTPS con
     certificado válido. No publiques `8090` directamente en Internet ni
     envíes el Bearer en claro por una LAN no confiable.
   - Si Foundry se sirve por HTTPS, usa HTTPS también para el puente: el
     navegador puede bloquear `https://` → `http://` por contenido mixto.

5. Prepara el puente sin mostrar el secreto en comandos, capturas ni logs:

   ```bash
   cd /ruta/a/espaciokooplagunak/docker
   cp .env.example .env
   # Edita .env localmente y define BRIDGE_TOKEN.
   # Revisa también BRIDGE_ALLOWED_ORIGINS: debe contener el origen EXACTO
   # donde se sirve Foundry (el .env.example trae http://localhost:30000).
   # Si no coincide, el navegador bloquea el fetch del módulo por CORS y la
   # ventana queda en «Disconnected» aunque /healthz responda por curl
   # (issue #92). Nunca uses "*": el puente lo rechaza al arrancar.
   docker compose up -d --build
   docker compose ps
   ```

6. Entra al mundo como GM, activa «Espaciokoop Lagunak — Puente de mando» y recarga el mundo.
7. En *Configuración → Ajustes del módulo*, configura la URL segura elegida y
   un intervalo de 2 segundos. Después pulsa **Configurar token del puente** en
   los controles de escena del GM y pégalo en el campo de contraseña. El token
   vive solo en memoria durante esa sesión de la pestaña: no se guarda en los
   ajustes del navegador ni del mundo y, tras recargar o cerrar, hay que pegarlo
   de nuevo. No lo copies a Journal, issues o capturas.
8. Abre las herramientas de desarrollo del navegador, limpia la consola y evita capturar paneles de red que muestren cabeceras `Authorization`.

## Identificación del anfitrión

Registra la versión que ejecuta el servidor, no la del navegador del jugador. En la consola del GM:

```js
({
  foundry: game.version,
  system: game.system.id,
  systemVersion: game.system.version,
  module: game.modules.get("espaciokoop-lagunak")?.version
})
```

La salida esperada identifica Foundry, sistema y módulo sin contener credenciales.

## Pasada GUI

Ejecuta la secuencia completa en cada anfitrión:

- [ ] El mundo carga con el módulo activo y la consola no muestra errores del módulo.
- [ ] Con usuario GM, el grupo de controles de fichas muestra «Estado de la nave (Espaciokoop Lagunak)».
- [ ] El botón abre una sola ventana «Estado de la nave» y volver a pulsarlo reutiliza la ventana.
- [ ] La ventana pasa de «conectando» a estado conectado y muestra posición, rumbo, casco, energía, escudos y sistemas.
- [ ] Los valores cambian cuando cambia el estado real de la simulación.
- [ ] «Anotar estado» crea o reutiliza el Journal «Bitácora de la nave» y añade una página con el estado visible.
- [ ] La página contiene datos de nave, pero no URL del puente, token ni cabeceras HTTP.
- [ ] En otro navegador autenticado como usuario no-GM, no aparece el botón y
      no queda abierta una ventana agregada de la nave.

### Token efímero y revocación

1. Con el estado ya conectado, recarga la pestaña del GM.

- [ ] El módulo no reutiliza el token anterior y vuelve a pedir configuración.
- [ ] Las ventanas que consultan el puente fallan cerradas: no conservan un
      cliente autenticado ni muestran datos nuevos con la credencial anterior.
- [ ] El ajuste legado `bridgeToken`, si existía de una instalación previa,
      queda vacío y no vuelve a poblarse.

2. Pega de nuevo el token mediante **Configurar token del puente** y valida la
   conexión.

- [ ] Estado, mapa y consola GM recuperan la conexión sin reiniciar Foundry.
- [ ] El campo de contraseña nunca aparece pre-rellenado.

3. Usa la acción de borrar/revocar el token con ventanas del módulo abiertas.

- [ ] Todas dejan de usar el cliente autenticado anterior y pasan a estado sin
      credencial/error controlado.
- [ ] Una respuesta tardía iniciada antes de la revocación no repinta datos ni
      reabre una ventana cerrada.
- [ ] Token, URL con credenciales y cabeceras `Authorization` siguen ausentes de
      consola, notificaciones y Journal.

### Pausa y reanudación (si están incluidas en el commit)

1. Pon la nave en movimiento para que posición y tiempo de escenario avancen.
2. Pulsa «Pausar» desde la ventana Foundry.

- [ ] Foundry muestra confirmación localizada sin revelar URL ni token.
- [ ] La posición/tiempo dejan de avanzar durante al menos dos intervalos de
      sondeo, sin cerrar la ventana.

3. Pulsa «Reanudar».

- [ ] Foundry muestra confirmación localizada.
- [ ] La posición/tiempo vuelven a avanzar.
- [ ] Un usuario no-GM no ve estos controles y no puede abrir la ventana desde
      su navegador. Esta comprobación valida la UI; la autoridad del puente
      sigue siendo el token Bearer entregado al GM.

### Interrupción y recuperación

Desde el directorio `docker/`, detén únicamente el puente:

```bash
docker compose stop bridge
```

- [ ] La ventana cambia a error sin cerrar Foundry ni mostrar el token.
- [ ] No se crean páginas de Journal durante el fallo.

Recupéralo y espera al siguiente reintento (el backoff está limitado a 60 segundos):

```bash
docker compose start bridge
docker compose ps
```

- [ ] La ventana vuelve por sí sola al estado conectado.
- [ ] El estado vuelve a actualizarse y «Anotar estado» funciona de nuevo.

## Revisión de seguridad y evidencias

Antes de compartir resultados:

1. Revisa consola, notificaciones y las páginas creadas en «Bitácora de la nave».
2. No publiques capturas del ajuste del token, `docker/.env`, almacenamiento del navegador ni cabeceras de red.
3. Si una captura contiene una credencial, no basta con difuminarla: descártala y rota el token.
4. Recorta o sustituye datos que identifiquen el entorno o la campaña: nombres
   de usuario/host, rutas locales, IDs de mundo, nombres narrativos, callsign,
   destino, extensiones del navegador y metadatos de la imagen.
5. Prefiere un mundo desechable con nombres ficticios y elimina los metadatos
   de las capturas antes de adjuntarlas.
6. Adjunta solo:
   - versiones del anfitrión, sistema y módulo;
   - commit probado;
   - captura de la ventana conectada sin información sensible;
   - captura o descripción de la página de Journal;
   - errores reproducibles ya saneados, sin credenciales ni datos privados;
   - resultado de interrupción y recuperación.

## Registro de resultados

Copia esta plantilla en el issue #29 por cada anfitrión:

```markdown
### Smoke GUI — <Foundry y sistema>

- Commit probado: `<sha>`
- Foundry: `<versión exacta>`
- Sistema: `<id y versión>`
- Módulo: `<versión>`
- Plataforma/navegador: `<datos>`
- Activación y consola: OK / FALLA
- Botón GM y bloqueo no-GM: OK / FALLA
- Render y estado vivo: OK / FALLA
- Pausa/reanudación y efecto observable: OK / FALLA / N/A
- Escritura en Journal: OK / FALLA
- Caída y recuperación del puente: OK / FALLA
- Token efímero tras recarga/revocación: OK / FALLA
- Token ausente de ajustes/logs/Journal/evidencias: OK / FALLA
- Evidencias saneadas de datos de entorno/campaña: OK / FALLA
- Evidencias: <enlaces o descripción>
- Incidencias: <ninguna o detalle reproducible>
```

## Cierre y rollback

1. Cierra la ventana y comprueba que no continúa generando tráfico de sondeo.
2. Detén el entorno de QA si no debe quedar activo:

   ```bash
   cd /ruta/a/espaciokooplagunak/docker
   docker compose down
   ```

3. Si la prueba usó un mundo real, elimina solo las páginas de prueba identificadas y restaura la copia si hubo cambios no deseados.
4. Desactiva el módulo y retira el enlace simbólico si la instalación era temporal.
5. Rota el token si pudo quedar expuesto.

`compatibility.verified` solo se actualiza mediante otro cambio revisado después de completar la matriz. Un fallo debe registrarse con pasos de reproducción; no se amplía el rango de compatibilidad para una versión no probada.
