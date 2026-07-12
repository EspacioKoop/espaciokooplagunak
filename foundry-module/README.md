# Módulo de Foundry VTT — Espaciokoop Lagunak

Esqueleto del módulo de integración (issue #8): muestra al director de juego el
estado en vivo de la nave simulada en Espaciokoop Lagunak, consultando el
[puente de integración](../bridge/README.md) (contrato v0) por polling. **Sin
órdenes de vuelta en esta iteración.**

## Requisitos

- Foundry VTT **v12** (mínimo provisional; la decisión definitiva de versiones
  es el issue #7).
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

## Estado de verificación

- Verificado sin Foundry (2026-07-12): sintaxis de todos los archivos,
  manifiesto y traducciones válidos, y `bridge-client.mjs` ejercitado desde
  Node contra el puente real del compose (healthz, state, 401 sin token,
  timeout y error de red) — es ESM puro sin dependencias de Foundry
  precisamente para eso.
- **Pendiente de verificación humana en un Foundry real**: activación del
  módulo, ventana, botón de escena y escritura en el diario. La licencia de
  Foundry no permite incluirlo en CI; véase el criterio de aceptación de #8.
