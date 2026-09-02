# Sistemas de RPG abiertos, licencias y repositorios CC0 para integración standalone

> **Issue:** [#886](https://github.com/VaroTv7/espaciokooplagunak/issues/886)  
> **Objetivo:** Investigar ocho sistemas, licencias y repositorios de RPG abiertos/CC0, con foco en si aportan reglas, contenido o contratos aprovechables para el objetivo **standalone** de Espaciokoop Lagunak, sin heredar dependencias de ejecución de Foundry VTT.  
> **Marco arquitectónico y legal:** Licencia de este repo: **GPL-2.0** ([`LICENSE`](../LICENSE)), principio **ADR-0008** ([`docs/adr/0008-standalone-first-autoridad-del-nucleo.md`](adr/0008-standalone-first-autoridad-del-nucleo.md)), política de contenido externo ([`docs/CONTENIDO_EXTERNO.md`](CONTENIDO_EXTERNO.md)) y verificación técnica de fuentes ([`docs/FUENTES_EXTERNAS.md`](FUENTES_EXTERNAS.md)).
>
> **Nota de revisión:** una pasada de revisión posterior a la redacción inicial no pudo confirmar en fuente primaria varias afirmaciones jurídicas categóricas (p. ej. que Cypher "restringe explícitamente videojuegos/software", que Open Legend "exige logo obligatorio", o que Dominion Rules es "incompatible con GPL-2.0"): los enlaces de licencia de esos recursos devolvieron 404/403 o no contenían la cláusula citada. Este documento se corrigió para marcar esos casos como **licencia no verificada** en vez de "descartado por incompatibilidad legal" — el criterio de #886 exige licencia verificada en fuente oficial, y una conclusión jurídica sin cita textual no lo satisface aunque el veredicto final (no portar código/texto todavía) sea el mismo.

---

## 1. Marco de Evaluación Standalone

Para que una fuente externa sea aprovechable en Espaciokoop Lagunak sin violar nuestros principios fundacionales, debe evaluarse bajo cuatro filtros obligatorios:

1. **Compatibilidad según el modo de reutilización, no una tabla binaria:** la compatibilidad de licencia depende de CÓMO se incorpora el material, y este documento distingue cuatro modos en vez de un veredicto único "compatible/incompatible":
   - **Port directo de código:** exige compatibilidad de licencia estricta con GPL-2.0 (MIT, BSD, CC0 y GPL-2.0-or-later son integrables; GPL-3.0 estricta o licencias con cláusulas propietarias, no comerciales o "no software" no lo son).
   - **Adaptación conceptual:** se toma la idea o el patrón mecánico sin copiar expresión protegida (texto, tablas literales, nombres propios de la mecánica); el riesgo de licencia es mucho menor pero no nulo si la mecánica en sí está protegida contractualmente (caso de licencias tipo COL/OLCL que regulan también el uso conceptual del sistema, no solo el texto).
   - **Dependencia en tiempo de ejecución:** se rige por la licencia y los términos de servicio del componente enlazado o invocado, no por la de este repositorio.
   - **Datos o assets sueltos:** cada recurso (audio, textura, tabla) se verifica por su propia licencia individual, nunca por la del directorio o índice que lo enlaza (regla de [`docs/FUENTES_EXTERNAS.md`](FUENTES_EXTERNAS.md)).
   Ninguna fila de la tabla de la sección 2 afirma "compatible con GPL-2.0" salvo que el modo de reutilización aplicable ya esté identificado explícitamente.
2. **Independencia de Foundry VTT (ADR-0008):** Todo contenido, regla o contrato adoptado debe residir canónicamente en el **núcleo C++** o en scripts de escenario Lua/formato de datos puro. Foundry VTT actúa únicamente como visor/proyector opcional.
3. **Cero dependencias pesadas de terceros:** No se importan motores completos externos (como Unity/Godot) para funciones que el simulador o el backend nativo deben resolver por sí mismos.
4. **Verificación de procedencia y licencias de archivos:** Se distingue la licencia del marco o repositorio respecto a los activos concretos (regla de [`docs/FUENTES_EXTERNAS.md`](FUENTES_EXTERNAS.md)).

---

## 2. Tabla Comparativa de los 8 Recursos

| # | Recurso / Proyecto | URL de Referencia | Licencia Exacta | Enlace a Fuente Oficial de Licencia | Qué Aporta | Riesgo de Integración | Compatibilidad Standalone | Decisión / Veredicto |
|---|---|---|---|---|---|---|---|---|
| 1 | **Reddit r/rpg Open TTRPGs Discussion** | [reddit.com/r/rpg/comments/104jygu/...](https://www.reddit.com/r/rpg/comments/104jygu/comment/j3a32ir/) | N/A — no es una fuente de licencia, es contenido de usuario bajo el ToS de Reddit | [Reddit User Agreement](https://www.redditinc.com/policies/user-agreement) | Contexto de comunidad sobre el movimiento post-OGL 1.0a; no es una librería reutilizable | **Fuera de la tabla de sistemas/licencias** (no aporta reglas ni assets propios) | N/A (no es un sistema, es debate) | **Solo contexto — mover a nota aparte, no tratar como "sistema evaluado"** |
| 2 | **Open Legend RPG** | [openlegendrpg.com](https://openlegendrpg.com/) | Open Legend Community License (OLCL) — nombre y URL confirmados; clausulado exacto **no verificado en esta pasada** (`openlegendrpg.com/licensing` no resolvió al re-fetch) | [Open Legend Licensing Terms](https://openlegendrpg.com/licensing) — **pendiente de re-verificar, puede haber cambiado de URL** | Reglas genéricas d20+dados de atributo, mecánicas de estados/banes/boons | **No portar código/texto** hasta citar la cláusula exacta que impone atribución/logo; tratar la afirmación de "exige logo obligatorio" como **no confirmada** | Sin cláusula citada, no se puede afirmar "incompatible como código núcleo" — solo que no se ha verificado que sea compatible | **Solo inspiración conceptual, sin código ni texto del SRD** (verdicto revisado a la baja: era "Descartar" con lenguaje jurídico no verificado) |
| 3 | **Cypher System Open License** | [montecookgames.com/cypher-system-open-license/](https://www.montecookgames.com/cypher-system-open-license/) | Cypher System Open License (CSOL) — la página de presentación habla de "tabletop roleplaying games" pero **no contiene una cláusula explícita que prohíba software/videojuegos**; el texto legal completo vive en csol.montecookgames.com y no se ha leído entero | [CSOL — página de licencia completa](https://csol.montecookgames.com/) | Sistema narrativo de dificultad 1-10, esfuerzo (Effort) y GM Intrusions | **Solo referencia, salvo revisión legal específica** — la afirmación previa de que "restringe explícitamente videojuegos/software" **no está soportada por el texto revisado** y se retira | No se puede afirmar "incompatible legalmente" sin haber leído la licencia completa; queda como pendiente, no como conclusión cerrada | **Solo referencia conceptual de GM Intrusions, sin importar texto** (verdicto de descarte legal degradado a "no verificado") |
| 4 | **Open Game Systems (RPGnet Wiki)** | [wiki.rpg.net/index.php/Open_Game_Systems](https://wiki.rpg.net/index.php/Open_Game_Systems) | **Licencia no verificada** — la página de términos (`RPGnet_Wiki:About`) devolvió 403 al re-fetch; no se confirma CC BY-SA ni FDL en fuente oficial | [RPGnet Wiki Terms](https://wiki.rpg.net/index.php/RPGnet_Wiki:About) — **enlace no verificado, no asumir licencia dual** | Directorio comparativo de decenas de SRDs (FUDGE, OGL, retroclones, PD) | **Solo referencia** (índice agregador; no se reutiliza texto de la wiki) | No aplica — se usa como índice de búsqueda, no como fuente de contenido | **Solo referencia / Directorio, licencia sin confirmar** |
| 5 | **QuestWorlds (Chaosium)** | [github.com/ChaosiumInc/QuestWorlds](https://github.com/ChaosiumInc/QuestWorlds) | Open RPG Creative License (ORC) — nombre confirmado; **versión y fecha exactas del notice no fijadas en este documento** | [QuestWorlds ORC Notice & Repo](https://github.com/ChaosiumInc/QuestWorlds) | Motor genérico de resolución de conflictos por apuestas/grados de éxito | **Solo referencia / posible adaptador**, fijando versión de la ORC antes de cualquier port | Buena candidata por ser SRD publicado en repo con notice explícito, pero pendiente de fijar versión | **Solo referencia; posible adaptador de resolución narrativa si se fija versión de ORC** |
| 6 | **Dominion Rules** | [dominionrules.org](https://dominionrules.org/) | Dominion Rules Licence (DRL), descrita como "open-gaming-style"; **el PDF con el clausulado completo no se ha leído**, solo la página de resumen | [Dominion Rules Licence (PDF)](https://dominionrules.org/licence) — **texto completo pendiente de lectura** | Sistema de reglas basado en d12, resolución unificada de habilidades y combate | **Referencia hasta demostrar compatibilidad** — la afirmación previa de "incompatibilidad estricta con GPL-2.0" se retira por no estar sustentada en el texto de la DRL leído | No se puede afirmar incompatibilidad sin leer el PDF; queda pendiente | **Referencia; no descartar formalmente hasta leer el clausulado completo** |
| 7 | **AnyRPG** | [anyrpg.org](https://www.anyrpg.org/) | MIT para el motor en GitHub (confirmado en el repo) + activos de terceros con licencias variables sin auditar | [AnyRPG GitHub License](https://github.com/AnyRPG/AnyRPGCore/blob/master/LICENSE) | Motor RPG en C# para Unity (gestión de quests, inventario, diálogos, combate) | **Descartar como motor** (acoplamiento a Unity, no a licencia) | Licencia del código (MIT) es compatible, pero la arquitectura Unity no lo es — el motivo de descarte es arquitectónico, no legal | **Descartar como motor/biblioteca; referencia de esquema de datos** |
| 8 | **awesome-cc0** | [github.com/madjin/awesome-cc0](https://github.com/madjin/awesome-cc0) | CC0 1.0 Universal para el propio índice; **cada asset enlazado mantiene su licencia individual, no heredada del directorio** | [awesome-cc0 LICENSE](https://github.com/madjin/awesome-cc0/blob/main/LICENSE) | Directorio curado de assets 3D, audio, texturas y fuentes en dominio público | **Descubrimiento; verificar cada asset por separado** antes de incorporarlo | Excelente como cantera, siempre que no se asuma que el índice certifica la licencia de cada recurso | **Depender caso a caso, con verificación individual obligatoria por asset** |

---

## 3. Análisis Detallado y Propuestas Concretas por Recurso

### 1. Reddit r/rpg: contexto de comunidad, no fuente de licencia

> Se trata aparte de la tabla de sistemas/licencias de la sección 2 porque no es un sistema evaluable: es contenido de usuario bajo el ToS de Reddit, sin reglas ni assets propios que portar.

- **URL:** [https://www.reddit.com/r/rpg/comments/104jygu/comment/j3a32ir/](https://www.reddit.com/r/rpg/comments/104jygu/comment/j3a32ir/)
- **Licencia:** Términos de Servicio de Reddit (contenido aportado por usuarios) — no aplica un "veredicto de licencia" a un hilo de discusión.
- **Qué aporta:** Contexto de comunidad sobre el movimiento hacia licencias abiertas (Creative Commons CC-BY, CC0, ORC) frente a licencias propietarias cerradas tras la crisis de la OGL 1.0a en 2023.
- **Riesgo:** Ninguno, es material puramente informativo; no se reutiliza texto ni estructura.
- **Propuesta concreta (contexto, no fuente reutilizable):**
  - Se cita en `docs/INSPIRACION_JUEGOS_LIBRES.md` como contexto del movimiento de apertura de reglas TTRPG.
  - No genera ningún archivo de código ni adaptación.

---

### 2. Open Legend RPG
- **URL:** [https://openlegendrpg.com/](https://openlegendrpg.com/)
- **Licencia:** Open Legend Community License (OLCL) — nombre confirmado en la web del proyecto; **el clausulado exacto no se ha podido releer en esta revisión** (`openlegendrpg.com/licensing` no resolvió al re-verificar). La afirmación de una edición previa de este documento — que la OLCL "obliga a estampar el logotipo" y "exige cláusulas de no descrédito" — **se retira por no estar sustentada en una lectura confirmada del texto vigente**; no se descarta que sea cierto, pero no se afirma como verificado.
- **Qué aporta:** Mecánicas de resolución ágiles con escalado de dados de atributo y un sistema modular de ventajas (*boons*) y desventajas (*banes*) aplicadas dinámicamente en situaciones tácticas o de estrés.
- **Riesgo:**
  - Sin cláusula citada del texto vigente de la OLCL, no se puede afirmar que sea "incompatible como código núcleo" ni que exija atribución específica — el estado correcto es **no verificado**, y hasta verificarlo se trata con el mismo cuidado que si lo fuera.
- **Propuesta concreta (conservadora, sin copiar texto ni SRD):**
  - **No portar** ningún texto del SRD de Open Legend ni vincular la OLCL hasta releer el clausulado en una fuente estable.
  - **Inspiración de diseño únicamente:** el patrón mecánico abstracto de "Banes/Boons" (estados temporales con impacto numérico directo en tiradas de control de averías o puestos) puede implementarse en Lua/C++ dentro de `#484` y `#847` sin emplear terminología ni texto protegido de Open Legend — esto no requiere ninguna licencia porque no copia expresión, solo una idea mecánica genérica y preexistente en muchos sistemas de rol.

---

### 3. Cypher System Open License (Monte Cook Games)
- **URL:** [https://www.montecookgames.com/cypher-system-open-license/](https://www.montecookgames.com/cypher-system-open-license/)
- **Licencia:** Cypher System Open License (CSOL) — nombre confirmado. La página de presentación en `montecookgames.com/cypher-system-open-license/` describe la CSOL en términos de "tabletop roleplaying games", pero **no contiene una cláusula explícita que prohíba software ejecutable o videojuegos**; el texto legal completo está en `csol.montecookgames.com` y no se ha leído íntegro en esta revisión.
- **Qué aporta:** La filosofía de resolución mediante niveles de dificultad de 1 a 10 (multiplicados por 3), el gasto de recursos del personaje (*Pools* / *Effort*) para reducir la dificultad, y las *GM Intrusions* (complicaciones narrativas a cambio de recompensas).
- **Riesgo:**
  - La afirmación de una edición previa de este documento — que "la Cypher Open License restringe explícitamente el uso de su contenido para software ejecutable y videojuegos interactivos" — **se retira**: no está sustentada en el texto revisado, que solo enfatiza el caso de uso de mesa sin excluir explícitamente otros. Hasta leer el texto legal completo en `csol.montecookgames.com`, el estado correcto es **no verificado**, no "descartado por incompatibilidad".
- **Propuesta concreta (conservadora hasta verificar el texto legal completo):**
  - **No portar** texto o reglas textuales de la CSOL sin antes leer el documento legal completo (no solo la página de presentación).
  - **Referencia conceptual:** la mecánica de "GM Intrusion" (evento imprevisto inyectado en un puesto por el GM que recompensa a la tripulación con reservas de energía o suministros) es un patrón de diseño genérico de juegos de rol y se cita en [`docs/CONSOLA_CALIENTE_GM.md`](CONSOLA_CALIENTE_GM.md) sin nombrarla ni derivarla textualmente de Cypher.

---

### 4. Open Game Systems (RPGnet Wiki)
- **URL:** [https://wiki.rpg.net/index.php/Open_Game_Systems](https://wiki.rpg.net/index.php/Open_Game_Systems)
- **Licencia:** **No verificada.** La página de términos (`RPGnet_Wiki:About`) devolvió 403 al re-verificar en esta revisión, así que no se confirma CC BY-SA ni FDL en fuente oficial; la afirmación anterior ("Wiki bajo CC BY-SA / FDL, según RPGnet") queda como no comprobada y no debe tratarse como un hecho establecido.
- **Qué aporta:** Índice taxonómico exhaustivo de sistemas de rol categorizados por licencia (OGL 1.0a, CC, Dominion Rules Licence, FUDGE Open License, etc.).
- **Riesgo:** Bajo, siempre que se use solo como índice de búsqueda y no se copie texto de sus páginas sin verificar antes la licencia real de la wiki.
- **Propuesta concreta (Solo Referencia / Catálogo de Exploración):**
  - Se referencia en `docs/ECOSISTEMA_OPEN_SOURCE.md` como repositorio de consulta para futuras revisiones de reglas de dominio público o CC0.

---

### 5. QuestWorlds (Chaosium Inc.)
- **URL:** [https://github.com/ChaosiumInc/QuestWorlds](https://github.com/ChaosiumInc/QuestWorlds)
- **Licencia:** Open RPG Creative License (ORC) ([ORC Notice](https://github.com/ChaosiumInc/QuestWorlds)).
- **Qué aporta:** Un sistema narrativo y de resolución de conflictos altamente formalizado basado en apuestas de resolución (*asymmetric resolution mechanics* y *extended contests*), publicado limpiamente en Markdown en un repositorio de GitHub bajo la licencia ORC promovida por la industria.
- **Riesgo y evaluación de compatibilidad:**
  - La licencia ORC separa con precisión el "ORC Content" (reglas del sistema libres de royalties y sublicenciables) del "Reserved Material" (marcas de Chaosium como Glorantha, HeroQuest, Call of Cthulhu).
  - Es apta para derivar sistemas de reglas auxiliares.
- **Propuesta concreta (Solo Referencia / Adaptador de Resolución Narrativa):**
  - No se requiere port de código.
  - **Si se adopta en el futuro:** Se puede escribir un resolvedor abstracto puro en Lua de misiones (p. ej. `scripts/` (misiones Lua) o tablas de resolución) que implemente la mecánica de resolución de conflictos asimétricos entre tripulación y entornos hostiles, atribuyendo formalmente a QuestWorlds SRD conforme a la ORC License Notice.

---

### 6. Dominion Rules
- **URL:** [https://dominionrules.org/](https://dominionrules.org/)
- **Licencia:** Dominion Rules Licence (DRL), descrita en la web del proyecto como un documento "open-gaming-style"; la página de licencia oficial devolvió 404 al re-verificar en esta revisión y **el PDF con el clausulado completo no se ha leído**.
- **Qué aporta:** Un motor de reglas de rol completo basado en tiradas de d12 frente a valores de atributo, con reglas detalladas para habilidades, fatiga, movimiento y combate por turnos.
- **Riesgo:**
  - La afirmación de una edición previa de este documento — que la DRL "no es compatible con la GPL-2.0" por exigir avisos específicos en toda redistribución — **se retira**: es plausible dado el patrón habitual de licencias "open-gaming" de esa época, pero no está verificada contra el texto real de la DRL, que no se ha podido leer. El estado correcto es **no verificado**, no "incompatibilidad legal estricta".
- **Propuesta concreta (referencia hasta demostrar compatibilidad):**
  - **No incluir** textos, fórmulas o archivos directos de Dominion Rules hasta leer el PDF completo de la DRL y confirmar sus términos exactos frente a GPL-2.0.
  - Se documenta como pendiente de verificación (no como descarte cerrado) para evitar tanto una reevaluación redundante como una afirmación legal no sustentada.

---

### 7. AnyRPG
- **URL:** [https://www.anyrpg.org/](https://www.anyrpg.org/) / [GitHub AnyRPGCore](https://github.com/AnyRPG/AnyRPGCore)
- **Licencia:** MIT para el código fuente del motor; activos visuales y de sonido en el paquete proceden de terceros con licencias mixtas.
- **Qué aporta:** Arquitectura de motor de juego RPG en C# sobre Unity: esquemas de datos serializables para misiones (*QuestSystem*), árboles de habilidades (*SkillTrees*), inventario y tablas de botín (*LootTables*).
- **Riesgo y motivos de descarte:**
  - AnyRPG está acoplado de forma inseparable al ecosistema de componentes de Unity (`MonoBehaviour`, `ScriptableObject`, Unity Engine APIs). Espaciokoop Lagunak es un simulador en C++17 nativo con frontend C++ / SFML y puente HTTP JSON. Intentar importar o adaptar AnyRPG supondría introducir un motor ajeno de gigabytes, rompiendo por completo la arquitectura standalone ligera del proyecto.
- **Propuesta concreta (Descarte de Motor / Referencia de Esquema):**
  - **Descartar** AnyRPG como motor y como biblioteca.
  - **Referencia de diseño:** Los esquemas declarativos JSON de prerrequisitos de misión y recompensas de AnyRPG pueden consultarse conceptualmente al diseñar los esquemas de misiones de campaña en el núcleo (`#766`), sin importar código ni binarios.

---

### 8. awesome-cc0 (Madjin)
- **URL:** [https://github.com/madjin/awesome-cc0](https://github.com/madjin/awesome-cc0)
- **Licencia:** CC0 1.0 Universal ([LICENSE en repo](https://github.com/madjin/awesome-cc0/blob/main/LICENSE)).
- **Qué aporta:** Directorio estructurado de repositorios y fuentes de recursos con licencia CC0 (Dominio Público): efectos de sonido (Freesound CC0, Kenney), texturas PBR (ambientCG), modelos 3D y fuentes tipográficas.
- **Riesgo:** Riesgo nulo siempre que se verifique la licencia individual de cada recurso conforme a `docs/FUENTES_EXTERNAS.md`.
- **Propuesta concreta (Depender Caso a Caso):**
  - **Capa afectada:** Capa 3 (Arte y Audio de cliente nativo y visor standalone).
  - **Procedimiento:** Cuando el cliente standalone requiera nuevos efectos de sonido de interfaz (confirmación de salto, alarmas de avería, pulsación de consola GM) o fuentes tipográficas libres, se consulta awesome-cc0, extrayendo piezas individuales con licencia CC0 verificada y registrándolas en [`docs/ASSETS_LIBRES.md`](ASSETS_LIBRES.md).

---

## 4. Matriz de Decisión Priorizada para Standalone

La siguiente matriz prioriza los 8 recursos en función de su **valor práctico para la arquitectura standalone** y su **coste/riesgo de integración**:

```
VALOR STANDALONE
 Alto  │ [8] awesome-cc0 (Assets CC0)          [5] QuestWorlds (ORC, fijar versión)
       │
 Medio │ [4] Open Game Systems (Directorio,     [1] r/rpg debate (Contexto,
       │     licencia no verificada)                fuera de tabla de licencias)
       │
 Bajo  │ [2] Open Legend (licencia no          [3] Cypher System (licencia no
       │     verificada)                            verificada — texto completo
       │ [6] Dominion Rules (licencia no            sin leer)
       │     verificada, PDF sin leer)          [7] AnyRPG (MIT, pero acoplado a Unity)
       └─────────────────────────────────────────────────────────────
         BAJO RIESGO / PERMISIVO               PENDIENTE DE VERIFICACIÓN LEGAL
                                                O COMPLEJIDAD ARQUITECTÓNICA
```

### Resumen de Prioridad de Acciones:
1. **Prioridad 1 (Aprovechable de inmediato):** `awesome-cc0` como cantera oficial para activos de audio y UI, verificando la licencia de cada asset individual antes de incorporarlo a la Capa 3.
2. **Prioridad 2 (Diseño conceptual e inspiración, sin copiar texto):** patrones mecánicos genéricos inspirados en la resolución asimétrica de `QuestWorlds` (con versión de ORC fijada) y en las GM Intrusions de `Cypher System`, implementados como ideas propias en Lua/C++ sin nombrar ni citar las obras originales.
3. **Prioridad 3 (No portar hasta verificar; no "descartar por incompatibilidad legal" sin haber leído el texto completo):** `Open Legend`, `Cypher System`, `Open Game Systems (RPGnet Wiki)` y `Dominion Rules` quedan en estado **licencia no verificada** — el motivo para no portarlos hoy es que no se ha confirmado su compatibilidad, no que se haya confirmado su incompatibilidad. `AnyRPG` es la única exclusión con motivo verificado y cerrado: licencia MIT compatible, pero acoplamiento arquitectónico irrenunciable a Unity.
