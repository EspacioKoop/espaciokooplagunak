# Módulo de Foundry VTT — Espaciokoop Lagunak

Esqueleto del módulo de integración (issue #8): muestra al director de juego el
estado en vivo de la nave simulada en Espaciokoop Lagunak, consultando el
[puente de integración](../bridge/README.md) (contrato v0) por polling. **Sin
órdenes de vuelta en esta iteración.**

## Requisitos

- Foundry VTT **v11.302 verificado** (la mesa real, issue #7). El módulo es
  adaptativo: usa la ventana clásica `Application` en v11 y, si el anfitrión
  ofrece `ApplicationV2`, la ventana moderna automáticamente. Incluye la forma
  de controles de escena de v13, pero v12/v13 siguen pendientes de prueba en
  una instalación real antes de declararlas verificadas. Solo importa la
  versión del **anfitrión** que hospeda la partida: los jugadores se conectan
  por navegador y no ejecutan Foundry.
- El puente de integración en marcha (`docker/README.md`): juego + puente vía
  compose, con `BRIDGE_TOKEN` definido.

## Instalación (manual, sin manifiesto todavía)

Copia o enlaza esta carpeta en el directorio de módulos de tu instalación de
Foundry, con el nombre del id del módulo:

```bash
ln -s /ruta/a/espaciokooplagunak/foundry-module \
      /ruta/a/FoundryVTT/Data/modules/espaciokoop-lagunak
```

Reinicia Foundry, activa «Espaciokoop Lagunak — Puente de mando» en el mundo y
entra como director de juego.

## Configuración (solo el navegador del GM)

En *Configuración → Ajustes del módulo*:

| Ajuste | Valor |
|---|---|
| URL del puente | `http://localhost:8090` (o donde esté publicado el puente) |
| Token del puente | el `BRIDGE_TOKEN` de `docker/.env` |
| Intervalo de sondeo | 1–30 s (2 s por defecto) |

Los tres ajustes son de ámbito **client**: viven en el navegador del GM, no
entran en la base de datos del mundo y no se sincronizan con los jugadores.
El token no aparece en logs ni en mensajes de error.

## Uso

1. En los controles de escena (grupo de fichas), pulsa el botón «Estado de la
   nave (Espaciokoop Lagunak)» — solo visible para el GM.
2. La ventana muestra el estado de conexión (`/healthz`), y la nave
   (`/v1/state`): posición, rumbo, casco, energía, escudos y sistemas.
3. Si el puente se cae, el módulo reintenta con backoff exponencial (hasta
   60 s) y se recupera solo al volver el puente.
4. «Anotar estado» escribe una página con el estado actual en el diario
   «Bitácora de la nave» (lo crea si no existe).
5. Al llegar a Argia en «Primera Guardia», el módulo recibe por polling un
   evento normalizado y crea automáticamente una página de llegada. El flag
   `eventId` evita duplicados al reabrir la ventana o reconectar.

## Estado de verificación

- Sintaxis de todos los archivos, `module.json` y traducciones válidos;
  cobertura i18n completa (es/en).
- `bridge-client.mjs` ejercitado desde Node contra el puente real del compose
  (healthz, state, 401 sin token, timeout y error de red) — es ESM puro sin
  dependencias de Foundry precisamente para eso.
- Tests Node cubren `/v1/events`, validación cerrada del evento y
  deduplicación persistente en Journal.
- **Manifiesto validado con el propio parser de Foundry v11.302**
  (`BaseModule`, modo estricto): sin errores de contenido. Foundry v11.302
  arranca limpio con el módulo instalado (symlink en `Data/modules`), sin
  rechazo del manifiesto.
- **Pendiente de verificación humana en un Foundry real con partida activa**:
  render de la ventana, botón de escena y escritura en el diario. Requiere una
  sesión de GM autenticada en el navegador; la licencia de Foundry no permite
  incluirlo en CI. Véase el criterio de aceptación de #8.

## Instalación para desarrollo (symlink)

Para trabajar el módulo contra tu instalación de Foundry, enlaza esta carpeta
en el directorio de módulos con el nombre del id del módulo:

```bash
ln -s /ruta/a/espaciokooplagunak/foundry-module \
      ~/.local/share/FoundryVTT/Data/modules/espaciokoop-lagunak
```

Los cambios en el repo se reflejan al recargar Foundry (F5 en el mundo).
