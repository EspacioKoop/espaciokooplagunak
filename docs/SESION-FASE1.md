# Sesión de prueba — Fase 1

Registro de la primera sesión jugable con compilación propia del fork: servidor
headless con el escenario propio y **dos puestos de tripulación conectados**.
Cierra el criterio de salida de la Fase 1 del roadmap.

## Entorno

- Ubuntu 24.04 (x86-64), compilación nativa según [`BUILDING.md`](BUILDING.md)
  (g++ 13.3, CMake 3.28.3, Ninja 1.11.1, SDL2 2.30.0; SeriousProton hermano).
- Escenario: `scripts/scenario_90_lagunak_primera_guardia.lua` (PR #15).
- Compilación con `WARNING_IS_ERROR=1`, binario `build/EmptyEpsilon`.

## Instalación y arranque

Servidor headless con el escenario propio:

```bash
./build/EmptyEpsilon headless=scenario_90_lagunak_primera_guardia.lua
```

El servidor escucha en TCP y UDP `35666` (puerto de multijugador por defecto).
Dos clientes de escritorio, cada uno autoconectándose a un puesto distinto de la
misma nave:

```bash
# Timón
./build/EmptyEpsilon fullscreen=0 instance_name=Timonel \
  autoconnect=helms autoconnect_address=127.0.0.1

# Armas
./build/EmptyEpsilon fullscreen=0 instance_name=Armas \
  autoconnect=weapons autoconnect_address=127.0.0.1
```

En Foundry/red local, `autoconnect` acepta los nombres de puesto (`helms`,
`weapons`, `engineering`, `science`, `relay`) y `autoconnect_address` la IP del
servidor. Los jugadores reales se reparten los puestos del mismo modo desde la
pantalla de conexión.

## Resultado

- Ambos clientes autoconectan y reclaman su puesto en la nave `Itsaso 1`:
  - **Timón**: HUD de navegación (rumbo, energía, impulso), con la nave atracada
    en la estación Lagunak al inicio (spawn en puerto, deliberado — la guardia
    zarpa de puerto) y el botón «Undock» disponible.
  - **Armas**: HUD de armamento (tubos, cargas Homing/Nuke/Mine/EMP/HVLI,
    escudos frontal/trasero) y la estación Lagunak en el radar.
- El servidor confirma la nave y el escenario activos: nave `Itsaso 1`, fase
  `guardia`, con los dos puestos ocupados.
- Los títulos de ventana muestran la identidad del fork (PR #13) más el
  `instance_name`: «Espaciokoop Lagunak (EmptyEpsilon) - Timonel» / «- Armas».

Criterio de salida de la Fase 1 cumplido: una persona nueva puede compilar
siguiendo [`BUILDING.md`](BUILDING.md), iniciar el escenario propio y conectar
dos estaciones sin instrucciones privadas.

## Reproducibilidad y segundo entorno (Fase 2)

El servidor headless también se ha ejecutado de forma reproducible en contenedor
(compose de la Fase 2, [`docker/README.md`](../docker/README.md)) sobre Ubuntu
24.04, con el puente v0 leyendo el estado de este mismo escenario. Sumado a la
compilación nativa verificada en Arch/CachyOS (issue #14), el arranque
reproducible de la simulación queda cubierto en más de un entorno.
