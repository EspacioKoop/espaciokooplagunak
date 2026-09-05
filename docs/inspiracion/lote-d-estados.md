# Lote D — Estados de personaje legibles (el subconjunto de cinco para un puente)

Parte de docs/INSPIRACION_JUEGOS_LIBRES.md (issue #840).

- **Autor del análisis:** Hermes (consolidación), fuente verificada por lectura de
  wikis y del código de referencia del repo.
- **Fuente declarada:** wiki de diseño de Cataclysm: DDA y de Veloren, y el propio
  LICENSE de cada repo. **Leído por encima**, no jugado. Licencias verificadas
  contra los repositorios (no de memoria).
- **Fichero previsto en el issue:** `docs/inspiracion/lote-d-estados.md`.
- **Estado:** borrador de primera pasada validado contra el código real del repo
  (ver ancla abajo).

La pregunta del lote (textual de #840): *cuál es el subconjunto de cinco estados
que sirve en un puente, y qué se descarta*. Cataclysm: DDA tiene una red de
~30 estados corporales/morales/fatiga; devolverlos todos sería no haber hecho el
trabajo. El recorte se guía por dos ejes duros del repo:

1. **Legibilidad (#484).** El fallo de un puesto tiene que ser *material para otro
   puesto* (cadena de la crisis multipuesto). Un estado que solo existe internamente
   no propaga nada.
2. **Frontera #526.** El estado describe lo **observable**; no se afirma una lectura
   interna/moral no observable. Por eso *moral* queda fuera.

Convención de lectura de este documento: lo que el juego hace es **evidencia**
(sección *Mecánica* de cada entrada); lo que proponemos para el fork es **propuesta**
(secciones *Problema nuestro* / *Coste* y la tabla). Ninguna penalización futura se
fija desde aquí: donde un estado necesita una consecuencia que hoy no produce nadie,
entra como `bloqueado`, no con una penalización inventada (ver fila 4).

Y hay un tercer eje que la primera pasada de este documento se saltó, y que es el que
manda: **un estado de personaje no es la salud operativa de su puesto.** «El enlace de
comunicaciones está caído» o «este puesto tiene seis órdenes sin confirmar» son
telemetría del puesto —material del Lote C—, no condiciones de la persona sentada en él.
Mezclarlas cambia la pregunta del issue por otra. Aquí van separadas: los cinco de la
tabla son del **personaje**, y la salud de puesto queda en un anexo aparte que dice que no
compite por esas cinco plazas.

Y un cuarto, heredado de ADR-0008: **un estado que condiciona lo que la nave acepta tiene
que residir donde reside esa decisión.** Si un estado baja el nivel de una acción o mete
latencia, esa consecuencia la produce el escenario Lua o el núcleo, y Foundry la
**representa**. Un modelo de estados que viva en Node y `station-actions.mjs` desaparece
al quitar Foundry y se lleva por delante el efecto que decía tener. Por eso, abajo, cada
estado declara **quién lo produce hoy** — y donde no lo produce nadie, se dice, en vez de
inventarle un efecto.

## Ancla en el código real (por qué esto no es invento)

- `foundry-module/scripts/station-actions.mjs` es la **proyección** en el módulo de la
  matriz de autoridad: declara qué órdenes ofrece cada puesto de las que el puente ya
  autoriza. Es *qué puede hacer* un puesto, y **no es donde reside la autoridad**: si
  Foundry desaparece, manda el escenario y el puente. Sirve como ancla de que el fork ya
  piensa por puesto; **no** como sede propuesta para el modelo de estados de este lote.
- `docs/CRISIS_MULTIPUESTO.md` (#484) define que el fallo de un eslabón cambia el
  resultado para los demás. Los 5 estados de abajo son justo la interfaz legible que
  la cadena necesita para detectar «este puesto acaba de caer».
- `foundry-module/scripts/npc-generador/npc-generador.mjs` ya deriva texto de un modelo de
  condición SRD; los estados del puente se enchufan en esa misma derivación de texto
  (describir lo observable, no afirmar lo interno — #526).

## Cataclysm: DDA

1. **Juego y licencia:** Cataclysm: DDA — **CC-BY-SA-3.0** (verificado en
   `LICENSE.txt` del repo `CleverRaven/Cataclysm-DDA`: «Creative Commons
   Attribution-ShareAlike 3.0 Unported»).
2. **Mecánica:** red de estados corporales/morales/fatiga con efectos *legibles*
   sobre la actuación del personaje, no un número de PV oculto. El jugador ve
   «aturdido», «agotado», «distraído» y actúa en consecuencia.
3. **Problema nuestro:** aporta la *taxonomía* de la que recortamos el subconjunto
   de 5 para la tripulación del puente. Cruza con #484 (el fallo de un puesto debe
   ser material para otro) y con `station-actions.mjs` (cuando un puesto cae, su
   autoridad se suspende — el estado es el gatillo).
4. **Coste:** **Lua de escenario / núcleo** para el estado canónico y para cualquier
   efecto sobre lo que la nave acepta; puro/Node solo para derivar el texto legible y
   pintarlo. Cero núcleo C++ nuevo si el escenario basta, cero arte. Lo que **no** vale es
   el reparto de la primera pasada (modelo en Node + consumo en `station-actions.mjs`):
   eso deja el estado fuera del juego cuando no hay VTT (ADR-0008).
5. **Veredicto:** `adoptar` como catálogo de origen del subconjunto. Tarjeta:
   `feat(estado-tripulacion): cinco estados de personaje con su estado canónico en el
   escenario, publicados por el puente y representados por el módulo`.

## Veloren

1. **Juego y licencia:** Veloren — **GPL-3.0** (verificado vía API de GitHub, repo
   `veloren/veloren`).
2. **Mecánica:** condiciones de personaje derivadas de combate/entorno, mostradas
   como buffs/debuffs *legibles* (nombre + efecto observable), no como número
   oculto detrás de la UI.
3. **Problema nuestro:** confirma la regla de oro de este lote — un estado debe ser
   *legible por quien lo recibe*, no solo existir internamente. Aporta además la segunda
   mitad, que este lote toma prestada del comentario de F sobre Veloren: **las condiciones
   caducan**. Un estado de personaje con duración y recuperación es un estado; uno
   permanente es una ficha nueva.
4. **Coste:** la **representación** es puro/Node (datos + texto derivado, igual que
   `npc-generador.mjs` deriva texto de una condición SRD); la **condición y su caducidad**
   son del escenario. Cero núcleo C++ nuevo.
5. **Veredicto:** `adoptar` como segundo punto de vista (legibilidad sobre
   existencia). Misma tarjeta `feat(estado-tripulacion)`; Veloren aporta la regla
   «si otro puesto no puede leerlo, no es estado, es ruido».

## Síntesis — el subconjunto de cinco estados **de personaje**

Cada estado es una **etiqueta observable + un efecto legible + quién lo produce**, nunca
una lectura interna. La cuarta columna es la que faltaba: sin un productor nativo, un
efecto está inventado aquí, y entonces el estado entra **bloqueado** en vez de entrar
mintiendo.

| # | Estado | Observable (lo que ve otro puesto) | Efecto legible | Quién lo produce hoy |
|---|--------|-----------------------------------|----------------|----------------------|
| 1 | **Herida** | atendida / sin atender, tras un impacto | el escenario decide qué le cierra a esa persona | el escenario (el daño ya es de la simulación); la ficha 5e lo representa |
| 2 | **Exposición** | vacío, atmósfera, radiación en la sala | condición con caducidad y recuperación (Veloren) | el escenario; **bloqueado** mientras el estado de sala no se publique |
| 3 | **Aturdimiento** | tras impacto o maniobra brusca | condición corta que caduca sola | el escenario (impactos y maniobras ya existen) |
| 4 | **Fatiga** | decaimiento sostenido a lo largo de la guardia | efecto **por decidir por quien tenga la autoridad**; este lote NO propone latencia ni bajar acciones | **nadie hoy** → entra `bloqueado`, solo como etiqueta legible |
| 5 | **Atención / Enfoque** | atendiendo / distraído / saturado | lo lee otro puesto y decide (pedir relevo) — **no concede ni quita nada por sí solo** | lo declara la propia persona o el GM; es lectura, no regla |

**Frontera #526 en cada uno:** se describe la condición observable, nunca se afirma una
lectura interna («está desmoralizado», «sufre»). Y los efectos que la primera pasada se
inventó —latencia, bajar el nivel de una acción, suspender autoridad— **salen de aquí**:
el primero y el segundo quedan como decisión de quien tenga la autoridad nativa, y el
tercero es del Lote C y del anexo de abajo, no de un estado de personaje.

## Anexo — salud de puesto (esto **no** son estados de personaje)

Las tres entradas que la primera pasada colaba en la tabla son telemetría del puesto, no
condiciones de la persona. Se conservan porque son útiles, pero **fuera** de las cinco
plazas y con su residencia dicha:

| Señal | Observable | Dónde vive |
|-------|-----------|-----------|
| **Integridad de puesto** | presente / ausente / incapacitado | estado y decisión en el escenario Lua (es lo que el Lote C propone para suspender autoridad); el módulo lo pinta |
| **Carga de órdenes** | nº de órdenes sin confirmar en cola | el puente ya sabe qué ha aceptado; el módulo lo muestra |
| **Enlace** | enlace al puente arriba / abajo | es salud de la conexión, y ya se diagnostica en `diagnostico-conexion.mjs` |

Que estas tres se lean bien es material del **Lote C** (el fallo de un puesto es material
para otro). Meterlas aquí cambiaba la pregunta de #840 —«estados de personaje»— por
«salud operativa de puestos», y las dos preguntas merecen respuesta, pero no la misma
plaza.

## Descarte razonado (lo que NO entra)

De la red de ~30 estados de CDDA, se descartan estos y por qué:

- **Moral** — estado interno/subjetivo; afirmarlo en el puesto sería inventar una
  lectura → viola #526. En la primera pasada se había propuesto *Enlace* como su
  sustituto observable, pero *Enlace* ya no es estado de personaje: pasó al anexo de
  salud de puesto (es telemetría de la conexión, no condición de la persona). Moral,
  pues, no tiene sustituto entre los cinco y se descarta por su propio motivo.
  `descartado`.
- **Dolor / Hambre / Sed / Enfermedad** — estados corporales internos no observables
  desde la conducta del puente en nuestro alcance; modelarlos exigiría simular el
  cuerpo (núcleo C++, fuera de standalone-first). `descartado`.
- **Resistencia / Stamina** — se funde con *Fatiga*; tener ambos es el fallo de
  «treinta estados». `descartado` por redundancia.
- **Poder de biónica** — recurso sci-fi sin analogía en nuestro modelo de tripulación.
  `descartado` (fuera de alcance).
- **Estados de sistema de nave** (casco, escudos, energía) — ya cubiertos por
  `barras-estado` / el `/v1/state` de la nave; no son de tripulación. `descartado`
  por solapamiento (viven en otro módulo).

## Resumen del lote

Dos `adoptar` (Cataclysm: DDA como taxonomía, Veloren como regla de legibilidad y
caducidad) + un subconjunto de **cinco estados de personaje** —dos de ellos declarados
`bloqueado` a falta de autoridad que los produzca— + un anexo de salud de puesto que
**no** compite por esas plazas + cinco descartes razonados. La residencia va escrita:
estado canónico y efectos en el escenario Lua o el núcleo, publicación por el puente,
Node/Foundry como **representación** (ADR-0008). Frontera #526 respetada en cada
veredicto.

> **Pendiente:** el índice final docs/INSPIRACION_JUEGOS_LIBRES.md (citado aquí en
> prosa a propósito, porque aún no existe) lo escribe quien cierre el último lote.
