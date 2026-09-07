# Módulo de Foundry VTT — Espaciokoop Lagunak

Módulo de integración (issue #8): muestra al director de juego el estado en
vivo de la nave simulada en Espaciokoop Lagunak y ofrece controles GM cerrados,
consultando el [puente de integración](../bridge/README.md) (contrato v0) por
polling.

## Compatibilidad objetivo

El proyecto mantiene dos entornos de Foundry como objetivos explícitos:

| Entorno | Foundry VTT | Sistema de juego | Papel en el proyecto |
|---|---|---|---|
| Eloy | **v11.302** | **dnd5e 2.3.1** | Objetivo legado y de regresión que no debe romperse |
| Varo/OTACON | Versión estable más reciente disponible | Registrar id y versión en cada smoke | Objetivo moderno de desarrollo y APIs actuales |

`dnd5e 2.3.1` identifica el mundo real usado por Eloy para probar; no es una
dependencia obligatoria del módulo. El código debe conservar tanto la ruta
clásica de v11 como la moderna: usa `Application` en v11 y, cuando el anfitrión
expone la API, `ApplicationV2`. Un cambio que use APIs modernas no puede romper
v11.302 de forma implícita; retirar ese objetivo requiere una decisión explícita
del proyecto.

Foundry VTT **v11.302 está verificado** (issue #7). Las versiones modernas solo
se añadirán a `compatibility.verified` después de ejecutar y registrar su smoke
real en el issue [#29](https://github.com/EspacioKoop/espaciokooplagunak/issues/29).
Solo importa la versión del **anfitrión** que hospeda la partida: los jugadores
se conectan por navegador y no ejecutan el servidor, aunque el módulo se carga
también en sus clientes web.

## Requisitos

- El puente de integración en marcha (`docker/README.md`): juego + puente vía
  compose, con `BRIDGE_TOKEN` definido y el origen web de Foundry incluido en
  `BRIDGE_ALLOWED_ORIGINS` (por ejemplo, `http://localhost:30000`).

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
| Intervalo de sondeo | 1–30 s (2 s por defecto) |

## Idioma del módulo (cualquier cliente)

En los mismos ajustes hay **Idioma del módulo**, y no es el idioma de Foundry:
Foundry tiene uno solo y lo aplica a todo, así que con el core en inglés los
textos de la nave salían en inglés aunque la partida se jugara en castellano.
Este ajuste separa las dos cosas y cambia **solo** los textos de Lagunak.

Es de **cliente**: en qué idioma lee cada cual no es una decisión de la partida.
Dos personas de la misma mesa pueden leer la misma consola en idiomas distintos
y estar viendo exactamente lo mismo. «Automático» sigue a Foundry, que es el
comportamiento de siempre. El cambio se ve al momento, sin recargar.

Flujo recomendado para el token (issue #183): **copiar → pegar → guardar**.

1. **Copiar**: `python3 tools/instalar.py --copiar-token` (o la opción «Copiar
   el token del puente» del menú) lo deja en el portapapeles sin mostrarlo.
2. **Pegar y guardar**: pulsa **Configurar token del puente** en los controles
   de escena del GM, pégalo en el campo de contraseña y pulsa **Guardar**. El
   asistente vacía el portapapeles cuando confirmas que has terminado. Un
   gestor de historial externo puede conservar copias: elimina también su
   entrada o desactívalo durante la operación. Guardar dispara automáticamente
   el mismo diagnóstico que antes exigía abrir aparte **Probar conexión con el
   puente** (issue #289): comprueba `/healthz` y después `/v1/state`, y
   distingue en una notificación: todo correcto, token ausente o rechazado, o
   puente inaccesible (pila caída, URL o CORS). El token nunca aparece en el
   mensaje. **Probar conexión con el puente** sigue disponible en el grupo de
   controles de escena para comprobar el estado sin reabrir el diálogo del
   token.

El emparejamiento automático o remoto del token queda **fuera de alcance**
mientras el puente escuche solo en `127.0.0.1`; ampliar `BRIDGE_BIND` es una
decisión explícita con revisión ADR (ver `docker/compose.yaml`).

La configuración del contenedor debe permitir el origen **exacto** que aparece
en la barra del navegador (esquema, host y puerto, sin barra final), no
necesariamente la URL del puente. Por ejemplo:

```dotenv
BRIDGE_ALLOWED_ORIGINS=http://localhost:30000
```

La URL y el intervalo son ajustes de ámbito **client**: viven en el navegador
del GM y no entran en la base de datos del mundo. El token vive **solo en
memoria** durante la sesión de esa pestaña; al recargar o cerrar hay que pegarlo
de nuevo. El módulo vacía al arrancar cualquier valor del antiguo setting
persistente. El token no aparece en logs, Journal, sockets ni mensajes de error.

El **token Bearer es la autoridad efectiva del puente** y debe entregarse solo
al GM. Las comprobaciones `game.user.isGM` ocultan la interfaz y evitan órdenes
accidentales desde un usuario jugador, pero no acreditan el rol ante el puente:
cualquier cliente que obtenga el token puede invocar las órdenes autorizadas.

## Uso

1. En los controles de escena (grupo de fichas), pulsa el botón «Estado de la
   nave (Espaciokoop Lagunak)» — solo visible para el GM.
2. La ventana muestra el estado de conexión (`/healthz`), y la nave
   (`/v1/state`): posición, rumbo, destino, distancia, ETA, casco, energía,
   escudos y sistemas. Con la nave detenida la ETA se muestra como no
   disponible, sin dividir por cero.
3. El GM puede pausar o reanudar la simulación con los botones de tempo. La
   ventana refleja el estado `paused` confirmado por `/v1/scenario`; la pausa
   global de Foundry se muestra aparte y no se sincroniza automáticamente con
   la simulación para evitar bucles.
4. Si el puente se cae, el módulo reintenta con backoff exponencial (hasta
   60 s) y se recupera solo al volver el puente.
5. «Anotar estado» escribe una página con el estado actual en el diario
   «Bitácora de la nave» (lo crea si no existe).
6. Al llegar a Argia en «Primera Guardia», el módulo recibe por polling un
   evento normalizado y crea automáticamente una página de llegada. El flag
   `eventId` evita duplicados al reabrir la ventana o reconectar.
7. Una reposición GM aceptada crea del mismo modo una página localizada con el
   ancla y el tiempo de escenario. Sondeos repetidos no la duplican; respuestas
   fallidas o eventos fuera del catálogo no escriben nada.

## Puestos de tripulación

El control «Puestos de tripulación» está disponible tanto para jugadores como
para el GM. Cada jugador puede elegir o cambiar únicamente su propio puesto;
el GM ve a toda la tripulación y puede corregir cualquier asignación, incluso
si el usuario está desconectado. Los puestos iniciales son capitán, navegación,
ingeniería, sensores, comunicaciones y armas.

La elección se guarda como un flag del documento `User` de Foundry, por lo que
se comparte con el mundo y sobrevive a recargas y reconexiones. No entrega el
token del puente ni concede por sí sola permiso para enviar órdenes externas:
esa autorización por puesto requiere un contrato posterior del puente.

En este primer vertical se permiten puestos duplicados; el GM puede resolverlos
desde la misma ventana. Los usuarios GM no forman parte de la tripulación
asignable: dirigen la mesa y supervisan las asignaciones de los jugadores.

### Espacios de trabajo por puesto

El control «Espacio de trabajo del puesto» abre una consola distinta para cada
asignación. El diseño toma de las pantallas de EmptyEpsilon la jerarquía de
instrumentación, retículas, alarmas, matrices de sistemas y disciplina de
guardia, pero la adapta a Foundry con mejor contraste, distribución responsive
y reducción de movimiento:

| Puesto | Instrumentación principal |
|---|---|
| Capitán | resumen de casco, energía, escudos, ruta y cobertura de tripulación |
| Navegación | rumbo, velocidad, posición, destino y retícula de orientación |
| Ingeniería | energía, casco, pico térmico y matriz de salud/calor/potencia |
| Sensores | cobertura, contactos próximos y aviso de lectura truncada |
| Comunicaciones | indicativo, bitácora, canales y disciplina de mensajes |
| Armas | escudos, salud de sistemas de armas y contactos confirmados |

Cada consola incluye una lista de guardia específica y el estado de la
tripulación. Un jugador abre directamente su puesto asignado; si aún no tiene
uno, la ventana le lleva al selector. El GM puede previsualizar las seis
consolas y actualizar manualmente telemetría de `/v1/state` y `/v1/contacts`.

La consola avisa de los puestos no atendidos (#951). La lista se calcula en
[`station-assignment.mjs`](scripts/station-assignment.mjs) exclusivamente desde
usuarios jugadores conectados y su flag de asignación efectivo; una orden nunca
cuenta como ocupación. Los cambios de conexión o asignación repintan el aviso de
forma determinista. Conforme a la decisión #512, el aviso no emite órdenes, no
reasigna puestos ni transfiere autoridad: la simulación conserva el último valor
ordenado.

La frontera es deliberada: los jugadores **no leen URL/token, no consultan el
puente y no reciben telemetría omnisciente**. Sus consolas muestran asignación,
tripulación y procedimientos locales. La previsualización GM es solo lectura;
no se añaden órdenes de navegación, energía o armas en este vertical.

## Mapa vivo

El botón «Mapa vivo (Espaciokoop Lagunak)» (junto al de estado, solo GM) abre
un visor retro tipo Neo Geo: campo de estrellas en parallax, la nave propia en
el centro (morro arriba) y los objetos cercanos como **sprites pixel-art «falso
3D»** (siluetas de caza, carguero, crucero o estación según la plantilla y
clase/subclase reales del contacto,
con sombreado de volumen y coloreados por facción), con leyenda de indicativos y
distancias. Los contactos fuera del visor se marcan en el borde del anillo. Los
sprites se dibujan solo con primitivas de canvas, sin assets externos.

- **Datos**: `/v1/state` (posición y rumbo propios) y **`/v1/contacts`** del
  puente. Este último endpoint llega con el PR #69 del puente: contra un
  puente anterior la ventana muestra el estado de error y reintenta con
  backoff, sin romper nada.
- **Movimiento**: la nave propia, el rumbo y los contactos con identidad pública
  inequívoca se interpolan entre las dos últimas muestras confirmadas del
  puente. Nunca se extrapola: el mapa es una vista, no un simulador — con la
  simulación en pausa, el mapa se congela. Contactos anónimos o duplicados se
  muestran directamente en su última posición para no asociar objetos distintos;
  una coordenada no finita se omite hasta recibir una muestra válida, nunca se
  convierte en una posición inventada.
- **Dibujo**: canvas interno de 320×320 escalado con `image-rendering:
  pixelated`, hasta 60 fps, con scanlines por CSS. Un sondeo solo posicional
  actualiza el canvas y las distancias sin reconstruir la ventana; el bucle de
  animación se detiene al cerrarla.
- **Legibilidad del decorado**: los planetas de fondo se siembran con separación
  mínima entre siluetas, dejan libre el entorno inmediato de la nave y usan tres
  planos discretos de tamaño/opacidad para dar profundidad sin competir con los
  contactos. Siguen sin etiquetas porque son ambientación, no destinos tácticos.

## Estado de verificación

- Sintaxis de todos los archivos, `module.json` y traducciones válidos;
  cobertura i18n completa (es/en).
- `bridge-client.mjs` ejercitado desde Node contra el puente real del compose
  (healthz, state, 401 sin token, timeout y error de red) — es ESM puro sin
  dependencias de Foundry precisamente para eso.
- Tests Node cubren `/v1/events`, validación y deduplicación persistente del
  Journal para llegadas y reposiciones GM, formato destino/ETA, POST cerrado de
  pausa, bloqueo no-GM y las seis
  consolas de puesto. También cubren las alertas de umbral de la nave
  (`alertas-nave.mjs`): derivación por flanco descendente (casco/energía/sistema)
  a partir de `/v1/state` y anotación una sola vez por sesión y umbral, con
  bloqueo no-GM. También verifican que un jugador no lee ajustes del
  puente ni recibe telemetría aunque otro código intente inyectársela.
- Del mapa vivo, los tests Node cubren la lógica pura (proyección, interpolación
  sin extrapolar de nave/contactos, identidades ambiguas, throttle de fps y
  composición del frame), el canvas estable entre sondeos posicionales y la
  compatibilidad del botón/ventana v11 y v13. El pintado real sobre `<canvas>`
  (`mapa-render.mjs`) queda dentro del punto pendiente de verificación humana.
- De la vista por puesto (`proyeccion-puesto.mjs`, #331 paso 2) los tests cubren
  lo que de verdad la sostiene: que una proyección **no añade nada** —quitando el
  énfasis se recupera el frame de entrada tal cual—, que dos puestos leen
  distinto el mismo frame, que las etiquetas solo salen de campos publicados y
  que un frame sin contactos no los inventa en ninguna vista. El selector del
  mapa es del GM: mirar «como navegación» no cambia lo que se difunde, solo lo
  que se resalta.
- De los sprites pixel-art de las naves (`nave-sprite.mjs`) los tests Node cubren
  el flujo DTO → proyección → clasificación (clases de EmptyEpsilon → silueta), el sombreado
  (aclarar/oscurecer el color de facción) y la construcción determinista del
  sprite; el pintado sobre `<canvas>` queda en verificación humana.
- Del decorado de fondo (nebulosas/planetas/asteroides, `decorado-fondo.mjs`,
  issue #203) los tests Node cubren la siembra determinista y el parallax puros;
  el pintado sobre `<canvas>` queda en el punto pendiente de verificación humana.
- **Manifiesto validado con el propio parser de Foundry v11.302**
  (`BaseModule`, modo estricto): sin errores de contenido. Foundry v11.302
  arranca limpio con el módulo instalado (symlink en `Data/modules`), sin
  rechazo del manifiesto.
- **Pendiente de verificación humana en un Foundry real con partida activa**:
  render de las ventanas, responsive, contraste, botones de escena, reconexión
  de jugador y escritura en el diario. Requiere sesiones GM/jugador autenticadas
  en navegador; la licencia de Foundry no permite incluirlo en CI. Véanse #8,
  #162 y #173.

## Instalación para desarrollo (symlink)

Para trabajar el módulo contra tu instalación de Foundry, enlaza esta carpeta
en el directorio de módulos con el nombre del id del módulo:

```bash
ln -s /ruta/a/espaciokooplagunak/foundry-module \
      ~/.local/share/FoundryVTT/Data/modules/espaciokoop-lagunak
```

Los cambios en el repo se reflejan al recargar Foundry (F5 en el mundo).
