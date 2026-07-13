# Smoke GUI del módulo Foundry VTT

Este runbook prepara la verificación manual del issue [#29](https://github.com/VaroTv7/espaciokooplagunak/issues/29). Debe ejecutarse una vez en **Foundry VTT v11.302 con dnd5e 2.3.1** y otra en el host moderno de Varo, registrando su versión exacta.

La prueba requiere una licencia y una sesión GM reales; no se ejecuta en CI. No marques una casilla ni aumentes `compatibility.verified` sin haber ejercitado esa versión del anfitrión.

## Alcance

Cada pasada comprueba:

- activación del módulo sin errores de consola;
- botón GM en los controles de escena;
- render de la ventana de estado;
- lectura autenticada del puente;
- creación de una página en la bitácora;
- fallo cerrado y recuperación tras interrumpir el puente;
- ausencia del token en consola, notificaciones, Journal y evidencias.

No valida todavía órdenes desde Foundry, varios clientes ni una sesión completa de juego.

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

4. Prepara el puente sin mostrar el secreto en comandos, capturas ni logs:

   ```bash
   cd /ruta/a/espaciokooplagunak/docker
   cp .env.example .env
   # Edita .env localmente y define BRIDGE_TOKEN.
   docker compose up -d --build
   docker compose ps
   ```

5. Entra al mundo como GM, activa «Espaciokoop Lagunak — Puente de mando» y recarga el mundo.
6. En *Configuración → Ajustes del módulo*, configura la URL del puente, el token y un intervalo de 2 segundos. El token es una credencial provisional guardada en el navegador del GM: no lo copies a un ajuste de mundo, Journal, issue o captura.
7. Abre las herramientas de desarrollo del navegador, limpia la consola y evita capturar paneles de red que muestren cabeceras `Authorization`.

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
- [ ] Un usuario no-GM no ve el botón ni obtiene la vista agregada de la nave.

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
4. Adjunta solo:
   - versiones del anfitrión, sistema y módulo;
   - commit probado;
   - captura de la ventana conectada sin información sensible;
   - captura o descripción de la página de Journal;
   - errores exactos sin credenciales;
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
- Escritura en Journal: OK / FALLA
- Caída y recuperación del puente: OK / FALLA
- Token ausente de logs/Journal/evidencias: OK / FALLA
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
