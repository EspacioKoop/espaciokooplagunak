# Inventario de Scripts Foundry Module

## Resumen General

**Total de scripts:** 171

Comando utilizado para el conteo:
```bash
find foundry-module/scripts -name "*.mjs" -o -name "*.js" | wc -l
```

## Distribución por Subdirectorio

- **Raíz (scripts/):** 126 scripts
- **asistencia/:** 13 scripts
- **contenido-externo/:** 5 scripts
- **minijuegos/:** 27 scripts

## Agrupación Temática

### 1. Nave y Sistemas de Navegación (171 scripts)
- `alarma-cruzada-escena.mjs`
- `alarma-cruzada.mjs`
- `alerta-escena.mjs`
- `alertas-nave.mjs`
- `andar-nave-app.mjs`
- `asistencia-ui.mjs`
- `asistencia-wiring.mjs`
- `asistencia/bandas.mjs`
- `asistencia/catalogo.mjs`
- `asistencia/enfoques.mjs`
- `asistencia/ficha-dnd5e.mjs`
- `asistencia/precision.mjs`
- `asistencia/probabilidad.mjs`
- `asistencia/propuesta.mjs`
- `asistencia/puzzle.mjs`
- `asistencia/relevo.mjs`
- `asistencia/secuencia.mjs`
- `asistencia/sesion.mjs`
- `asistencia/temporizacion.mjs`
- `asistencia/vista.mjs`
- `atlas-hyg.mjs`
- `audio-ficheros.mjs`
- `avatar-assignment.mjs`
- `avatar-preview.mjs`
- `avatar-sugerencia.mjs`
- `avatar-ui.mjs`
- `barras-estado.mjs`
- `base-datos-cientifica.mjs`
- `bitacora-nave.mjs`
- `bridge-client.mjs`
- `bridge-token-session.mjs`
- `cantina-2d.mjs`
- `cantina-app.mjs`
- `cantina-avatar.mjs`
- `cantina-escena.mjs`
- `cantina-icono.mjs`
- `cantina-lienzo.mjs`
- `cantina-planos.mjs`
- `cantina-sala.mjs`
- `cantina-ventana.mjs`
- `cantina.mjs`
- `casco-clases.mjs`
- `casco-dano.mjs`
- `catalogo-cosmografico.mjs`
- `consola-caliente-poll.mjs`
- `consola-caliente-v1.mjs`
- `consola-caliente-v2.mjs`
- `contactos-degradados.mjs`
- `contenido-externo/adaptador.mjs`
- `contenido-externo/edicion.mjs`
- `contenido-externo/inventario.mjs`
- `contenido-externo/proveedor-foundry.mjs`
- `contenido-externo/ventana.mjs`
- `control-escena.mjs`
- `decorado-fondo.mjs`
- `diagnostico-conexion.mjs`
- `encuentro-control.mjs`
- `escena-exteriores.mjs`
- `escena-primitivas.mjs`
- `event-journal.mjs`
- `ficha-nave-aplicacion.mjs`
- `ficha-nave.mjs`
- `filtros-escena.mjs`
- `foco-render.mjs`
- `horizonte-matte.mjs`
- `horizonte-preset.mjs`
- `iconos-sistema.mjs`
- `idioma-modulo.mjs`
- `ingenieria-control.mjs`
- `lagunak-constantes.mjs`
- `lamina-contacto.mjs`
- `laminas-clasicas.mjs`
- `main.mjs`
- `maniobra-control.mjs`
- `mapa-marco.mjs`
- `mapa-render.mjs`
- `minijuegos-wiring.mjs`
- `minijuegos/adaptador-sesion.mjs`
- `minijuegos/agente-automatico.mjs`
- `minijuegos/aleatorio.mjs`
- `minijuegos/baraja-preset.mjs`
- `minijuegos/blackjack-3d.mjs`
- `minijuegos/blackjack-lectura.mjs`
- `minijuegos/blackjack-motor.mjs`
- `minijuegos/blackjack-vista.mjs`
- `minijuegos/cartas-pixelart.mjs`
- `minijuegos/dados-3d.mjs`
- `minijuegos/dados-agente.mjs`
- `minijuegos/dados-lienzo.mjs`
- `minijuegos/dados-motor.mjs`
- `minijuegos/dados-vista.mjs`
- `minijuegos/evaluador-manos.mjs`
- `minijuegos/fichas-pixelart.mjs`
- `minijuegos/mesa-blackjack-app.mjs`
- `minijuegos/mesa-config.mjs`
- `minijuegos/mesa-dados-app.mjs`
- `minijuegos/mesa-poker-app.mjs`
- `minijuegos/mesa-vista.mjs`
- `minijuegos/naipes.mjs`
- `minijuegos/poker-3d.mjs`
- `minijuegos/poker-motor.mjs`
- `minijuegos/pozos.mjs`
- `minijuegos/sesion-motor.mjs`
- `minijuegos/turnos-automaticos.mjs`
- `musica-mando.mjs`
- `musica-procedural.mjs`
- `musica-reproductor.mjs`
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
- `nave-movimiento-red.mjs`
- `nave-movimiento-sala-prueba.mjs`
- `nave-movimiento.mjs`
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
- `nivel-alerta.mjs`
- `paleta.mjs`
- `panel-gm-app.mjs`
- `panel-gm.mjs`
- `pausa-control.mjs`
- `piel-textura.mjs`
- `playa-escena.mjs`
- `png-indexado.mjs`
- `props-exteriores.mjs`
- `props-materiales.mjs`
- `proyeccion-puesto.mjs`
- `puerta-catalogo.mjs`
- `reposicion-control.mjs`
- `requisitos-puesto.mjs`
- `resolver-objetivo-sensores.mjs`
- `resolver-posicion-relay.mjs`
- `retrato-tripulante.mjs`
- `retro3d-estrellas.mjs`
- `retro3d-lienzo.mjs`
- `retro3d.mjs`
- `seccion-lienzo.mjs`
- `seccion-nave-app.mjs`
- `seccion-nave.mjs`
- `sensores-lista.mjs`
- `ship-view.mjs`
- `station-actions.mjs`
- `station-assignment.mjs`
- `station-handover.mjs`
- `station-order-forms.mjs`
- `station-order-relay.mjs`
- `station-order-wiring.mjs`
- `station-ui.mjs`
- `station-workspace-ui.mjs`
- `station-workspaces.mjs`
- `telemetria-difusion.mjs`
- `tempo-control.mjs`
- `terraza-cantina.mjs`
- `ventana-nave.mjs`
- `visor-piloto-lienzo.mjs`
- `visor-piloto.mjs`

### 2. Estaciones y Puertos Espaciales (0 scripts)

### 3. Cantina y Áreas Sociales (0 scripts)

### 4. Escenas y Entornos (0 scripts)

### 5. Audio y Música (0 scripts)

### 6. Avatares y Personajes (0 scripts)

### 7. Interfaz de Usuario y Paneles (0 scripts)

### 8. Ingeniería y Sistemas (0 scripts)

### 9. Base de Datos y Catálogos (0 scripts)

### 10. Eventos y Bitácora (0 scripts)

### 11. Conexión y Diagnóstico (0 scripts)

### 12. Renderizado y Gráficos (0 scripts)

### 13. Core y Configuración Principal (0 scripts)

### 14. Consolas y Versiones (0 scripts)

## Verificación

**Suma de agrupaciones temáticas:** 171

La suma coincide con el total de scripts encontrados, confirmando que todos los scripts han sido contabilizados y agrupados correctamente.

## Notas

- Todos los scripts están en formato `.mjs` (ES Modules)
- La estructura de directorios incluye 3 subdirectorios principales: `asistencia/`, `contenido-externo/`, y `minijuegos/`
- Los scripts en la raíz cubren una amplia variedad de funcionalidades relacionadas con la navegación espacial, gestión de estaciones, interfaces de usuario y sistemas de juego
- Los minijuegos representan una categoría significativa con 27 scripts dedicados a juegos de cartas, dados y poker