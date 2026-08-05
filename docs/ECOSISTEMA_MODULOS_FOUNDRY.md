# Ecosistema de módulos Foundry: integración e inspiración

Estudio del entorno Foundry real donde se ejecuta `espaciokoop-lagunak`, para decidir
**de qué módulos ajenos dependemos**, **cuáles imitamos sin depender** y **cuáles nos
estorban**. No es una lista de deseos: parte del inventario efectivo de la instalación
de desarrollo (103 módulos, Foundry v11, sistema dnd5e, Babele en español).

Este documento es de diseño. Ninguna dependencia descrita aquí está declarada todavía
en `foundry-module/module.json`; declararlas es un cambio de código aparte.

## Principios

1. **Depender es un compromiso permanente.** Cada `dependencies` en `module.json`
   añade un modo de fallo que no controlamos y una versión que puede romperse.
   Solo se justifica cuando el módulo ajeno resuelve un problema *de infraestructura*
   (RPC, parcheo, render) que no es nuestro dominio.
2. **Nunca dependemos de módulos de contenido licenciado.** El proyecto está anclado
   a SRD 5.1 bajo CC-BY-4.0 y a las reglas de 2014.
3. **La verdad de la nave vive en la simulación.** Ningún módulo ajeno puede convertirse
   en autoridad sobre el estado del barco; como mucho lo *representa*.
4. **Copiar el patrón es más barato que heredar el módulo.** Para casi todo lo visual,
   leer cómo lo hace otro y escribir 100 líneas propias sale mejor que una dependencia.
5. **Licencia compatible declarada.** El módulo es GPL-2.0. Ninguna dependencia —y menos
   un paquete de assets— entra sin licencia de redistribución compatible por escrito.

## Regla de admisión

> Una dependencia es admisible **solo si su ausencia degrada la presentación y nunca la
> autoridad.**

Es el test que resuelve los casos futuros sin volver a discutirlos, y se deriva de la
tabla de autoridad de FOUNDRY.md. `fxmaster` lo pasa: solo pinta. `socketlib` lo falla:
tocaba la ruta autoritativa. Los documentos `Cards` lo fallan: persistirían un estado que
el contrato de minijuegos declara efímero.

## Descartes razonados

Se dejan escritos porque son las propuestas que cualquier desarrollador con experiencia
en Foundry va a repetir, y el repo se ahorra la discusión la próxima vez.

- **socketlib** (1.0.13) — **descartada.** No resuelve #237. Es una librería *de cliente*
  sobre `game.socket`, y el servidor de Foundry no acredita al emisor de un evento
  `module.<id>`: el identificador del emisor viaja en el payload que compone el propio
  cliente. Es exactamente el canal que MINIJUEGOS_FOUNDRY.md (decisión 6) rechaza por
  escrito. La ruta ascendente correcta ya está implementada: *flag* en el propio `User` →
  `updateUser` resuelto por el GM, que sí lleva acreditación del servidor. El socket solo
  se usa en la dirección no autoritativa (GM → cliente), donde el emisor ya es la
  autoridad; así está comentado en `telemetria-difusion.mjs`, `station-workspace-ui.mjs`
  y `asistencia-wiring.mjs`. Lo único que socketlib aportaría es azúcar de
  petición/respuesta con promesas sobre ~40 líneas ya escritas y probadas: ergonomía, no
  autoridad, y no paga una dependencia dura.
- **sequencer + JB2A** (3.1.4 / 0.6.0) — **descartados, ni siquiera como opcionales.**
  Sequencer anima el canvas de Foundry, y el proyecto ya decidió dos veces que ese canvas
  no es la superficie táctica (#354: "no son tokens de contacto vivos"; #427/#431: lectura
  viva en ventanas propias con lienzo propio). Animar un impacto sobre tokens que no
  siguen a la simulación es animar una mentira. Además JB2A choca con la doctrina de arte
  cerrada del módulo (procedural en cliente, cero binarios en el repo, colores solo en
  `paleta.mjs` con test que lo hace cumplir, #351) y con la estética PSX de #362, y es
  arte de terceros con su propia licencia.
- **Documentos `Cards` del core** — **descartados**, ya investigado en #340 y documentado
  en MINIJUEGOS_FOUNDRY.md, sección "El sistema nativo de cartas de Foundry (Cards)":
  `Cards#shuffle()` usa el generador global sin nuestra semilla (rompe el reductor
  determinista), cualquier cliente puede crear cartas en el mundo (rompe el coordinador
  único) y son documentos persistentes con barra lateral (rompe el estado efímero). Ya se
  tomó prestado lo barato: el preset en `CONFIG.Cards.presets` y `Card` como formato de
  intercambio (`baraja-preset.mjs`).

## Candidatos a dependencia real

Uno solo, y todavía no declarado: **lib-wrapper** (1.12.13.0), para parchear con educación
métodos del core. Con ~100 módulos instalados, parchear a pelo es garantía de conflicto.
Pero hoy el módulo no parchea nada: es aditivo de punta a punta (ventanas propias,
controles propios, hooks estándar), así que declarar la dependencia ahora añadiría un modo
de fallo por una necesidad hipotética. La declara el PR que introduzca el primer
`libWrapper.register` — previsiblemente el POV por puesto, fase 4+.

No hay ninguna otra dependencia dura, y es el resultado correcto: el módulo se sostiene solo.

## Integración hecha: FXMaster (`scripts/filtros-escena.mjs`)

La única integración con un módulo ajeno que el proyecto ha aceptado, y por qué fue esta
y no otra de las candidatas más vistosas:

- **Licencia inequívoca y compatible.** El componente de software es **BSD 3-Clause**,
  compatible con nuestro GPL-2.0. Era el único de la lista con una licencia declarada y
  permisiva: TokenMagic no declara ninguna (= todos los derechos reservados, no se puede
  tomar prestado su GLSL), y Argon y combat-carousel son GPL-3, que permite leerlos e
  inspirarse pero no copiar código a un módulo GPL-2.0.
- **Frontera de licencia dentro del propio FXMaster: filtros sí, partículas nunca.** Sus
  filtros son shaders sin un solo asset. Sus efectos de partículas traen sprites con
  licencias mixtas —JB2A bajo CC-BY-NC-SA, iconos bajo EULA de Rexard—, y un *non
  commercial* en un proyecto que quiere poder distribuirse es una vía muerta.
- **Pasa la regla de admisión.** Tiñe la escena entera, que es ambiente; no anima nada
  sobre un token, que sería afirmar una posición que la simulación no respalda (#354).
  Si FXMaster no está, el borde de alerta de `alerta-escena.mjs` sigue funcionando igual.
- **No reinventa ni cede lo nuestro.** El tinte de alerta accesible sobre el `<body>` y
  su aviso textual siguen siendo nuestros y no dependen de nadie. Lo que se delega es lo
  que no vamos a escribir: un pase de shaders sobre el lienzo de PIXI con su ciclo de
  vida, sus migraciones y sus capas. El color no lo pone FXMaster: sale de `ALERTA` en
  `paleta.mjs`, y la prueba de #351 vigila este módulo como a cualquier otro de arte.

Aparte del tinte por nivel, expone el grano de consola (`oldfilm`) parametrizado por
época, con los mismos criterios que el motor de #362: la PSX ensucia, la GameCube no.

**Ajuste `filtrosEscena`, de mundo y apagado por defecto.** No es timidez: el
`setFilters` de FXMaster *reemplaza* el conjunto entero de filtros de la escena, así que
activarlo es ceder la escena al módulo y no añadir una capa que convive con la niebla que
el GM tuviera puesta. Eso lo decide el GM a sabiendas, y la descripción del ajuste lo dice.

## Integraciones oportunistas (opcionales, detectadas en runtime)
- **tokenmagic** (0.6.4.1) — shaders por token: escudo, daño de casco, ocultación.
  Directamente útil para el objetivo estético retro de consola (#362).
- **polyglot** (2.2) — idiomas ofuscados en chat según lo que sepa el personaje.
  Regalo para un juego espacial y complementario al selector de idioma propio del
  módulo (#370), que es otra cosa: aquel es idioma de *interfaz*, este de *ficción*.
- **monks-tokenbar** (11.02) — solo como referencia de interfaz. La petición de tiradas
  es superficie **propia**: delegar en él rompería el camino autoritativo de la asistencia
  (#309), donde el asistente pide por *flag* de su `User`, el GM resuelve en `updateUser`
  y el titular gasta el token por relé (#237). La petición volvería con la identidad y el
  ciclo de vida de otro módulo. Lo que falta no es superficie nueva sino la ventana del
  asistente y la barra de temporización, ya con issue.
- **item-piles** (2.7.14) — carga, botín y transferencia de objetos entre naves.
- **effectmacro / itemacro / templatemacro** — colgar comportamiento de forma
  declarativa en efectos y objetos en vez de cablear hooks en nuestro módulo.

## Solo inspiración: leer el código, no depender

- **enhancedcombathud (Argon)** (1.7.8) — la referencia de HUD a pantalla completa que
  sustituye la interfaz de Foundry por una consola por personaje. Es el patrón visual
  exacto de los puestos de tripulación. Leer *cómo* desmonta y reemplaza la UI.
- **combat-carousel** (0.3.3) y **combat-tracker-dock** (2.5.1) — dos soluciones
  distintas al mismo problema: sustituir el rastreador de combate por una tira de
  retratos. Aplicable a los retratos de tripulación y al orden de iniciativa de los
  minijuegos por turnos.
- **ready-to-use-cards** (1.12.3) — motor de barajas sobre los documentos `Cards` del
  core: repartir, mano privada, revelar. Vale como referencia de interfaz; la migración a
  `Cards` está descartada (ver arriba y #340).
- **token-action-hud-core** (1.4.20) — cómo se define un HUD de acciones extensible por
  sistema. Buen molde para "acciones disponibles según el puesto".
- **PopOut!** (2.14) — sacar una aplicación de Foundry a una ventana independiente.
  Es la vía conocida para "cada tripulante en su propia pantalla"; leerlo aunque no se
  integre.
- **monks-enhanced-journal** (11.07) — modelo de diario enriquecido, referencia para el
  codex.
- **warpgate** (1.18.2) — su `spawn` resuelve el mismo problema que nuestro
  `spawn_encounter` y que la reposición a ancla (#176). Merece una lectura comparativa
  antes de ampliar el nuestro.
- **scene-packer** / **moulinette** — empaquetado y distribución de escenas, relevante
  si algún día publicamos contenido junto al módulo (ver FOUNDRY_DISTRIBUTION.md).

## Riesgos del entorno real

- **Pila de automatización pesada.** midi-qol + DAE + chris-premades + Automated
  Animations + ATL + times-up están todos activos en la instalación de referencia. El
  contrato soportado sigue siendo **un mundo dnd5e limpio en v11**: esa es la línea base,
  igual que en #332 se decidió detectar y no depender. La pila pesada es un **segundo
  entorno de prueba** valioso —y donde hay que probar asistencia y minijuegos con
  tiradas— del que no depende ninguna funcionalidad. Un bug que solo se reproduce con
  midi-qol activo es un bug de convivencia, no una dependencia.
- **Módulos de contenido licenciado**: `plutonium`, `plutonium-addon-automation`,
  `ddb-importer`, `wanderers-guide-2-merchants-n-magic`. No pueden ser fuente de datos
  del proyecto. La lectura opcional de contenido ya importado por el usuario (#332) es
  otra cosa distinta y se rige por CONTENIDO_EXTERNO.md.
- **combat-utility-belt** (1.10.4) está abandonado desde v9–v10 y solapa con
  midi-qol/DAE. Candidato a desinstalar en el entorno de desarrollo; no lo consideramos
  soportado.
- **Babele + dnd5e-babele-spanish** traducen los compendios: cualquier lógica nuestra
  que compare nombres de objetos o clases en inglés fallará en esta instalación.
  Comparar siempre por identificador, nunca por nombre visible.
- **Versión**: el ecosistema del usuario está clavado en v11, pero eso no puede convertirse
  en la política de versiones del proyecto. El módulo es adaptativo v11–v13 (ventanas
  hermanas V1/V2 escritas justo para eso). Decisión: **`minimum` se queda en 11 mientras la
  mesa de referencia esté en v11; `verified` sigue a lo que realmente se verifique.** Subir
  `verified` no rompe nada al usuario —él decide cuándo actualiza su Foundry—; subir
  `minimum` sí.

## Coste de merge frente a upstream

Cero. Todo lo que este documento decide vive en `docs/` y `foundry-module/`; nada toca
`src/` ni el puente, así que ninguna de estas decisiones crea divergencia que haya que
reconciliar en la siguiente sincronización con `upstream/`.
