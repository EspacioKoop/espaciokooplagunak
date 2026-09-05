# Inventario de Scripts Foundry Module

## Resumen General

**Total de scripts:** 176

Comando utilizado para el conteo:
```bash
find foundry-module/scripts -name '*.mjs' -o -name '*.js' | wc -l
```

## Distribución por Subdirectorio

- **Raíz (scripts/):** 131 scripts
- **asistencia/:** 13 scripts  
- **contenido-externo/:** 5 scripts
- **minijuegos/:** 27 scripts

### 1. Nave y Sistemas de Navegación (40 scripts)
- `andar-nave-app.mjs`
- `nave-avatares-render.mjs`
- `nave-camara.mjs`
- `nave-catalogo-andar.mjs`
- `nave-consola.mjs`
- `nave-estancias.mjs`
- `nave-interaccion.mjs`
- `nave-luminaria.mjs`
- `nave-minimapa-lienzo.mjs`
- `nave-minimapa.mjs`
- `nave-mobiliario-sala.mjs`
- `nave-movimiento-lienzo.mjs`
- `nave-movimiento.mjs`
- `nave-movimiento-red.mjs`
- `nave-movimiento-sala-prueba.mjs`
- `nave-mural-pixel.mjs`
- `nave-piel-objeto.mjs`
- `nave-piel-puerta.mjs`
- `nave-piel-suelo.mjs`
- `nave-planta-phobos.mjs`
- `nave-presencia.mjs`
- `nave-props.mjs`
- `nave-sala-caja.mjs`
- `nave-sprite.mjs`
- `nave-ventana-espacio.mjs`
- `ficha-nave-aplicacion.mjs`
- `ficha-nave.mjs`
- `maniobra-control.mjs`
- `reposicion-control.mjs`
- `ship-view/ship-view.mjs`
- `visor-piloto-lienzo.mjs`
- `visor-piloto.mjs`
- `bitacora-nave.mjs`
- `nivel-alerta.mjs`
- `alarma-cruzada-escena.mjs`
- `alarma-cruzada.mjs`
- `alertas-nave.mjs`
- `seccion-nave-app.mjs`
- `seccion-nave.mjs`
- `seccion-lienzo.mjs`

### 2. Estaciones y Puertos Espaciales (11 scripts)
- `station-actions.mjs`
- `station-assignment.mjs`
- `station-handover.mjs`
- `station-order-forms.mjs`
- `station-order-relay.mjs`
- `station-order-wiring.mjs`
- `station-ui.mjs`
- `station-workspaces.mjs`
- `station-workspace-ui.mjs`
- `proyeccion-puesto.mjs`
- `requisitos-puesto.mjs`

### 3. Cantina y Áreas Sociales (11 scripts)
- `cantina-2d.mjs`
- `cantina-app.mjs`
- `cantina-avatar.mjs`
- `cantina-escena.mjs`
- `cantina-icono.mjs`
- `cantina-lienzo.mjs`
- `cantina.mjs`
- `cantina-planos.mjs`
- `cantina-sala.mjs`
- `cantina-ventana.mjs`
- `terraza-cantina.mjs`

### 4. Minijuegos (27 scripts)
- `adaptador-sesion.mjs`
- `agente-automatico.mjs`
- `aleatorio.mjs`
- `baraja-preset.mjs`
- `blackjack-3d.mjs`
- `blackjack-lectura.mjs`
- `blackjack-motor.mjs`
- `blackjack-vista.mjs`
- `cartas-pixelart.mjs`
- `dados-3d.mjs`
- `dados-agente.mjs`
- `dados-lienzo.mjs`
- `dados-motor.mjs`
- `dados-vista.mjs`
- `evaluador-manos.mjs`
- `fichas-pixelart.mjs`
- `mesa-blackjack-app.mjs`
- `mesa-config.mjs`
- `mesa-dados-app.mjs`
- `mesa-poker-app.mjs`
- `mesa-vista.mjs`
- `naipes.mjs`
- `poker-3d.mjs`
- `poker-motor.mjs`
- `pozos.mjs`
- `sesion-motor.mjs`
- `turnos-automaticos.mjs`

### 5. Asistencia y Utilidades (13 scripts)
- `bandas.mjs`
- `catalogo.mjs`
- `enfoques.mjs`
- `ficha-dnd5e.mjs`
- `precision.mjs`
- `probabilidad.mjs`
- `propuesta.mjs`
- `puzzle.mjs`
- `relevo.mjs`
- `secuencia.mjs`
- `sesion.mjs`
- `temporizacion.mjs`
- `vista.mjs`

### 6. Contenido Externo (5 scripts)
- `adaptador.mjs`
- `edicion.mjs`
- `inventario.mjs`
- `proveedor-foundry.mjs`
- `ventana.mjs`

### 7. Escenas y Entornos (17 scripts)
- `escena-exteriores.mjs`
- `escena-primitivas.mjs`
- `control-escena.mjs`
- `decorado-fondo.mjs`
- `filtros-escena.mjs`
- `horizonte-matte.mjs`
- `horizonte-preset.mjs`
- `alerta-escena.mjs`
- `playa-escena.mjs`
- `props-exteriores.mjs`
- `props-materiales.mjs`
- `puerta-catalogo.mjs`
- `retro3d-estrellas.mjs`
- `retro3d-lienzo.mjs`
- `retro3d.mjs`
- `museo-escena.mjs`
- `museo-piezas.mjs`

### 8. Audio y Música (4 scripts)
- `arte/audio/audio-ficheros.mjs`
- `arte/audio/musica-mando.mjs`
- `arte/audio/musica-procedural.mjs`
- `arte/audio/musica-reproductor.mjs`

### 9. Avatares y Personajes (6 scripts)
- `avatar/avatar-assignment.mjs`
- `avatar/avatar-preview.mjs`
- `avatar/avatar-sugerencia.mjs`
- `avatar/avatar-ui.mjs`
- `avatar/retrato-tripulante.mjs`
- `lamina-contacto.mjs`

### 10. Interfaz de Usuario y Paneles (9 scripts)
- `asistencia-ui.mjs`
- `asistencia-wiring.mjs`
- `iconos-sistema.mjs`
- `idioma-modulo.mjs`
- `panel-gm-app.mjs`
- `panel-gm.mjs`
- `pausa-control.mjs`
- `ventana-nave.mjs`
- `laminas-clasicas.mjs`

### 11. Ingeniería y Sistemas (8 scripts)
- `ship-view/casco-clases.mjs`
- `ship-view/casco-dano.mjs`
- `ingenieria-control.mjs`
- `sensores-lista.mjs`
- `ship-view/telemetria-difusion.mjs`
- `tempo-control.mjs`
- `resolver-objetivo-sensores.mjs`
- `resolver-posicion-relay.mjs`

### 12. Base de Datos y Catálogos (7 scripts)
- `atlas-hyg.mjs`
- `base-datos-cientifica.mjs`
- `catalogo-cosmografico.mjs`
- `catalogo-piezas.mjs`
- `procedencia-catalogo.mjs`
- `paleta.mjs`
- `png-indexado.mjs`

### 13. Eventos y Bitácora (3 scripts)
- `event-journal.mjs`
- `encuentro-control.mjs`
- `bridge-token-session.mjs`

### 14. Conexión y Diagnóstico (3 scripts)
- `bridge-client.mjs`
- `consola-caliente-poll.mjs`
- `diagnostico-conexion.mjs`

### 15. Renderizado y Gráficos (7 scripts)
- `ship-view/barras-estado.mjs`
- `foco-render.mjs`
- `mapa-marco.mjs`
- `mapa-render.mjs`
- `piel-textura.mjs`
- `contactos-degradados.mjs`
- `rig-esqueleto.mjs`

### 16. Core y Configuración Principal (2 scripts)
- `main.mjs`
- `lagunak-constantes.mjs`

### 17. Consolas y Versiones (3 scripts)
- `consola-caliente-v1.mjs`
- `consola-caliente-v2.mjs`
- `minijuegos-wiring.mjs`

## Verificación

**Suma de agrupaciones temáticas:** 40 + 11 + 11 + 27 + 13 + 5 + 17 + 4 + 6 + 9 + 8 + 7 + 3 + 3 + 7 + 2 + 3 = 176

La suma coincide con el total de scripts encontrados, confirmando que todos los scripts han sido contabilizados y agrupados correctamente.

## Notas

- Todos los scripts están en formato `.mjs` (ES Modules)
- La estructura de directorios incluye 3 subdirectorios principales: `asistencia/`, `contenido-externo/`, y `minijuegos/`
- Los scripts en la raíz cubren una amplia variedad de funcionalidades relacionadas con la navegación espacial, gestión de estaciones, interfaces de usuario y sistemas de juego
- Los minijuegos representan una categoría significativa con 27 scripts dedicados a juegos de cartas, dados y poker
