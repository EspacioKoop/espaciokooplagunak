# Guía editorial de localización es-ES

Esta guía define el criterio humano para los catálogos españoles de Espaciokoop Lagunak. La salida de traducción automática es solo un borrador y no se considera terminada hasta pasar revisión contextual.

## Voz y registro

- Español de España, claro y natural.
- Interfaz dirigida al jugador con **tú**: `Introduce`, `Selecciona`, `Vuelve`.
- Instrucciones en imperativo cuando expresan una acción: `Destruye`, `Atraca`, `Defiende`.
- Evitar infinitivos telegráficos si el original da una orden y evitar tratamiento formal (`usted`, `ingrese`, `seleccione`).
- Usar mayúscula inicial en botones, títulos y estados; evitar capitalización inglesa en cada palabra.

## Terminología base

| Inglés | Español preferido | Evitar |
|---|---|---|
| ship / player ship | nave / nave de jugadores | barco |
| crew | tripulación | equipo, personal cuando alude a puestos de la nave |
| game master / GM | director de juego / DJ | maestro de juego, MM |
| hull | casco | estructura, armadura salvo contexto específico |
| shield | escudo | blindaje |
| beam | haz | viga, rayo salvo frase narrativa |
| warp | curvatura | urdimbre |
| dock / docking | atracar / atraque | acoplar salvo maniobra física concreta |
| homing missile | misil guiado | misil casero |
| fighter | caza | luchador |
| gunship | cañonera | barco de armas |
| carrier | portanaves | transportador |
| dreadnought | acorazado | dreadnought en etiquetas genéricas |
| wave (enemies) | oleada | onda |
| friendly (entity) | aliado | amigo, amable |
| time left | tiempo restante | hora izquierda |
| hacked (system) | hackeado | saboteado, que oculta la causa técnica |

Se conservan siglas asentadas como `HVLI` y nombres propios como `Atlantis`, `Fermi 500`, `Kessler` y `Lagunak`.

## Selector de escenarios

Categorías visibles:

| Clave interna | Etiqueta es-ES |
|---|---|
| Replayable Mission | Misión rejugable |
| Mission | Misión |
| Basic | Básico |
| PvP | JcJ |
| Development | Desarrollo |
| Race | Carrera |

Las claves internas permanecen en inglés para no romper filtros ni compatibilidad. Solo se localiza la etiqueta mostrada.

Los títulos deben traducirse por sentido y género del juego, no palabra por palabra. Ejemplos:

- `Surf's Up!` → `¡A surfear!`
- `Push The Payload` → `Empuja la carga`
- `Battlefield` → `Campo de batalla`

## Reglas técnicas

1. Revisar siempre por la clave `(msgctxt, msgid)`; una palabra aislada puede requerir traducciones distintas.
2. Preservar exactamente placeholders (`%s`, `%d`, `%02d`, `{name}`), etiquetas y saltos de línea funcionales.
3. No traducir identificadores internos, nombres de plantilla o valores usados para filtrar sin comprobar el código consumidor.
4. Mantener sincronizados los catálogos `.en.po` y `.es.po` cuando cambia un `msgid` del código o del encabezado Lua.
5. Comprobar la sincronía de metadatos Lua con `python3 tools/check_scenario_header_locale.py .`. Mientras se corrige deuda existente, `--report-only` genera el inventario sin devolver error.
6. Validar los catálogos españoles con `msgfmt --check --check-format` y con `tools/i18n_es.py --validate-only`.
7. Probar visualmente menús y textos largos: una traducción válida puede desbordar el espacio disponible.

## Criterio de terminado

Una entrada está terminada cuando:

- transmite el sentido correcto en su pantalla o evento;
- respeta esta terminología y el registro es-ES;
- no conserva inglés salvo nombre propio, sigla o tecnicismo deliberado;
- conserva placeholders y formato;
- ha sido comprobada en catálogo y, para textos de interfaz, en ejecución.
