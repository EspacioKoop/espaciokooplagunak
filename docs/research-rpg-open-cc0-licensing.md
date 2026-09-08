# Sistemas de RPG abiertos, licencias y repositorios CC0 para integración standalone

> **Issue:** [#886](https://github.com/EspacioKoop/espaciokooplagunak/issues/886)  
> **Objetivo:** Investigar ocho sistemas, licencias y repositorios de RPG abiertos/CC0, con foco en si aportan reglas, contenido o contratos aprovechables para el objetivo **standalone** de Espaciokoop Lagunak, sin heredar dependencias de ejecución de Foundry VTT.  
> **Marco arquitectónico y legal:** Licencia de este repo: **GPL-2.0** ([`LICENSE`](../LICENSE)), principio **ADR-0008** ([`docs/adr/0008-standalone-first-autoridad-del-nucleo.md`](adr/0008-standalone-first-autoridad-del-nucleo.md)), política de contenido externo ([`docs/CONTENIDO_EXTERNO.md`](CONTENIDO_EXTERNO.md)) y verificación técnica de fuentes ([`docs/FUENTES_EXTERNAS.md`](FUENTES_EXTERNAS.md)).
> **No se incorpora código, texto ni assets de ninguno de los ocho recursos**; este documento es solo referencia de diseño.
>
> **Nota de revisión (actualizada tras #888):** una primera redacción incluyó conclusiones jurídicas categóricas sin cita textual (p. ej. que Cypher "restringe explícitamente videojuegos/software", que Open Legend "exige logo obligatorio", que Dominion Rules es "incompatible con GPL-2.0"). Una segunda pasada las retiró por prudencia, pero sin sustituirlas por la fuente primaria exacta, dejando el documento con enlaces rotos y sin clausulado citado. Esta revisión (tras la review de OTACON Astra en #888) verifica directamente en fuente primaria — texto de licencia obtenido y citado, no solo la página de presentación — para Open Legend, CSOL, QuestWorlds/ORC y Dominion Rules; ver la sección 3 de cada recurso para la cláusula exacta, versión y fecha.

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
| 2 | **Open Legend RPG** | [openlegendrpg.com](https://openlegendrpg.com/) | **Open Legend Community License (OLCL)**, verificada en fuente primaria (cláusula 2: uso limitado al SRD; cláusulas 5–6: logo y aviso obligatorios) | [openlegendrpg.com/community-license](https://openlegendrpg.com/community-license) — **verificado**, no `/licensing` (URL rota, retirada de este documento) | Reglas genéricas d20+dados de atributo, mecánicas de estados/banes/boons | **No portar código/texto** — la licencia solo cubre referenciar el SRD y exige logo + aviso de licencia visibles; no habilita incorporar texto al núcleo GPL-2.0 | Cubre solo el SRD (cláusula 2); portar como código núcleo exigiría cumplir logo/aviso (cláusulas 5–6), incompatible con la disciplina de licencia única del repo | **Solo inspiración conceptual, sin código ni texto del SRD** |
| 3 | **Cypher System Open License** | [montecookgames.com/cypher-system-open-license/](https://www.montecookgames.com/cypher-system-open-license/) | **Cypher System Open License (CSOL)**, texto completo verificado en [csol.montecookgames.com/license/](https://csol.montecookgames.com/license/): grant royalty-free para "tabletop roleplaying game materials" basados en el CSRD; exige marca "Compatible with the Cypher System" + aviso de no afiliación; **sin prohibición explícita de software/videojuegos** | [CSOL — texto completo](https://csol.montecookgames.com/license/) — **verificado** | Sistema narrativo de dificultad 1-10, esfuerzo (Effort) y GM Intrusions | **No portar** texto del CSRD sin marca/aviso obligatorios; la ausencia de prohibición de software no equivale a "compatible con GPL-2.0" — el grant es específico para el CSRD, no una licencia de software | Cubre solo texto del CSRD (no arte ni otras publicaciones de MCG); exige marca de compatibilidad visible, incompatible con la disciplina de licencia única del repo si se portara como código núcleo | **Solo referencia conceptual de GM Intrusions, sin importar texto del CSRD** |
| 4 | **Open Game Systems (RPGnet Wiki)** | [wiki.rpg.net/index.php/Open_Game_Systems](https://wiki.rpg.net/index.php/Open_Game_Systems) | **Licencia de la wiki no verificada** — la página de contenido (`Open_Game_Systems`) responde, pero la página de términos (`RPGnet_Wiki:About`) sigue bloqueada por el proveedor (403/challenge) en todas las verificaciones; la licencia de los SISTEMAS que la wiki indexa (OGL, CC, etc.) no es la licencia de la propia wiki, y no se confunden | [RPGnet Wiki Terms](https://wiki.rpg.net/index.php/RPGnet_Wiki:About) — **bloqueado, no verificable con las herramientas disponibles** | Directorio comparativo de decenas de SRDs (FUDGE, OGL, retroclones, PD) | **Solo referencia** (índice agregador; no se reutiliza texto de la wiki, cuya licencia sigue sin confirmar) | No aplica — se usa como índice de búsqueda, no como fuente de contenido | **Solo referencia / Directorio, licencia de la wiki sin confirmar** |
| 5 | **QuestWorlds (Chaosium)** | [github.com/ChaosiumInc/QuestWorlds](https://github.com/ChaosiumInc/QuestWorlds) | **Open RPG Creative License (ORC)**, verificada: fuente primaria exacta es [`0.1_Legal_Information.md`](https://github.com/ChaosiumInc/QuestWorlds/blob/master/0.1_Legal_Information.md) — QWSRD **0.97**, ORC notice **TX 9-307-067**; el grant principal de la ORC (texto oficial, sección II.a) es **no sublicenciable**; el material reservado (arte, trade dress, marcas) queda fuera | [`0.1_Legal_Information.md`](https://github.com/ChaosiumInc/QuestWorlds/blob/master/0.1_Legal_Information.md) + [ORC License, TX 9-307-067 (PDF)](https://downloads.paizo.com/ORC_LicenseFINAL.pdf) — **verificados** | Motor genérico de resolución de conflictos por apuestas/grados de éxito | **Posible adaptador solo como referencia**, no como sistema cableado: #886 exige una API/archivo de entrada-salida concreto para ese veredicto, que este documento no define | Buena candidata por ser SRD publicado con notice explícito y versión fijada (0.97); el material reservado (arte/trade dress/marcas) no se toca | **Solo referencia de diseño; "adaptador" requeriría definir la API de entrada/salida que exige #886, fuera de alcance de esta investigación** |
| 6 | **Dominion Rules** | [dominionrules.org](https://dominionrules.org/) | **Dominion Rules Licence (DRL), versión 2.01**, verificada en el PDF oficial enlazado por la propia portada del proyecto: secciones 5.2/5.3 regulan redistribución (con o sin modificaciones, notice obligatorio); 6.1/6.2 distinguen "Larger Works" (sujetas a toda la licencia) de "Compatible Works" (sujetas a toda la licencia salvo la sección 5, pero con aviso propio de compatibilidad) | [DRL v2.01 (PDF)](https://siteassets.pagecloud.com/dominion-rules/uploads/DRL-ife9a.pdf) — **verificado** | Sistema de reglas basado en d12, resolución unificada de habilidades y combate | **No portar** textos/fórmulas directos: cualquier redistribución (5.2/5.3) o "Larger Work" (6.1) queda sujeta íntegra a la DRL, una segunda licencia superpuesta a la GPL-2.0 del repo | La vía menos invasiva es "Compatible Work" (6.2): reglas propias que declaran compatibilidad sin heredar el resto de la DRL, pero exige el aviso de la cláusula 6.3 | **Referencia; no incorporar texto/reglas directas de Dominion Rules al núcleo** |
| 7 | **AnyRPG** | [anyrpg.org](https://www.anyrpg.org/) | **MIT verificado para el código del motor** ([LICENSE](https://github.com/AnyRPG/AnyRPGCore/blob/master/LICENSE), leído íntegro); los activos de terceros del árbol llevan licencias propias distintas (MIT/Apache 2.0 por componente, según el propio repo), nunca la del motor | [AnyRPG GitHub License](https://github.com/AnyRPG/AnyRPGCore/blob/master/LICENSE) | Motor RPG en C# para Unity (gestión de quests, inventario, diálogos, combate) | **Descartar como motor** (acoplamiento a Unity, no a licencia) | Licencia del código del motor (MIT) es compatible con GPL-2.0; la arquitectura Unity no lo es — el motivo de descarte es arquitectónico, no legal. Los assets de terceros no se tocan en ningún caso: no comparten licencia con el motor | **Descartar como motor/biblioteca; referencia de esquema de datos únicamente, nunca código ni assets** |
| 8 | **awesome-cc0** | [github.com/madjin/awesome-cc0](https://github.com/madjin/awesome-cc0) | CC0 1.0 Universal **verificado para el propio índice/repositorio**; **cada asset enlazado mantiene su licencia individual, no heredada del directorio, y no se ha verificado ninguna de ellas en esta pasada** | [awesome-cc0 LICENSE](https://github.com/madjin/awesome-cc0/blob/main/LICENSE) | Directorio curado de assets 3D, audio, texturas y fuentes en dominio público | **Descubrimiento; verificar cada asset por separado** antes de incorporarlo — el índice en sí no habilita usar ningún asset | Riesgo/licencia **desconocidos hasta verificar cada asset**: el CC0 del índice no se transfiere a lo que enlaza (regla de [`docs/FUENTES_EXTERNAS.md`](FUENTES_EXTERNAS.md)) | **Depender caso a caso, con verificación individual obligatoria por asset antes de cualquier incorporación** |

---

## 3. Análisis Detallado y Propuestas Concretas por Recurso

### 1. Reddit r/rpg: contexto de comunidad, no fuente de licencia

> Se trata aparte de la tabla de sistemas/licencias de la sección 2 porque no es un sistema evaluable: es contenido de usuario bajo el ToS de Reddit, sin reglas ni assets propios que portar.

- **URL:** [https://www.reddit.com/r/rpg/comments/104jygu/comment/j3a32ir/](https://www.reddit.com/r/rpg/comments/104jygu/comment/j3a32ir/)
- **Licencia:** No aplica un "veredicto de licencia" a un hilo de discusión — es contexto, no contenido reutilizable. Por el [Reddit User Agreement](https://www.redditinc.com/policies/user-agreement), el autor de cada comentario conserva sus derechos y solo concede una licencia a Reddit para operar el sitio; eso no habilita a terceros a reutilizar el texto del hilo como si tuviera una licencia de contenido propia.
- **Qué aporta:** Contexto de comunidad sobre el movimiento hacia licencias abiertas (Creative Commons CC-BY, CC0, ORC) frente a licencias propietarias cerradas tras la crisis de la OGL 1.0a en 2023.
- **Riesgo:** Ninguno, es material puramente informativo; no se reutiliza texto ni estructura.
- **Propuesta concreta (contexto, no fuente reutilizable):**
  - Se cita en `docs/INSPIRACION_JUEGOS_LIBRES.md` como contexto del movimiento de apertura de reglas TTRPG.
  - No genera ningún archivo de código ni adaptación.

---

### 2. Open Legend RPG
- **URL:** [https://openlegendrpg.com/](https://openlegendrpg.com/)
- **Licencia:** **Open Legend Community License (OLCL)**, verificada en fuente primaria estable ([openlegendrpg.com/community-license](https://openlegendrpg.com/community-license); `openlegendrpg.com/licensing`, enlazado en una revisión previa de este documento, no resuelve — se retira). Cláusulas relevantes, citadas literalmente:
  - **Cláusula 2 (alcance):** "Seventh Sphere Entertainment grants to the licensee the non-exclusive, non-assignable license to reference the Open Legend SRD [...] in their product. The licensee agrees not to reproduce other material by Seventh Sphere Entertainment, including but not limited to text, images, and page design, outside of the Open Legend SRD [...] without the express written consent of Seventh Sphere Entertainment." El grant está limitado al SRD; no cubre "Open Legend" como marca o mecánica en general.
  - **Cláusula 5 (logo):** "The licensee shall include the official Open Legend Licensed Content Logo [...], in a clearly visible size and format, on the front page, cover, or external packaging of their product."
  - **Cláusula 6 (aviso):** "The licensee shall place the following License Notice in a legible format and in a conspicuous location on/in their product: 'This product was created under the Open Legend Community License and contains material that is copyright to Seventh Sphere Entertainment. [...]'"
- **Qué aporta:** Mecánicas de resolución ágiles con escalado de dados de atributo y un sistema modular de ventajas (*boons*) y desventajas (*banes*) aplicadas dinámicamente en situaciones tácticas o de estrés.
- **Riesgo:**
  - Las cláusulas 5 y 6 exigen logo y aviso visibles en el producto final. El núcleo de Espaciokoop Lagunak se distribuye bajo una única licencia (GPL-2.0); incorporar texto del SRD bajo la OLCL introduciría una segunda licencia con obligaciones de marca propias, no una simple cuestión de compatibilidad de permisos. Por eso **no se afirma compatibilidad** con el modo "port directo de código" de la sección 1, más allá de lo que la cláusula 2 ya permite (referenciar, no reproducir).
- **Propuesta concreta (conservadora, sin copiar texto ni SRD):**
  - **No portar** ningún texto del SRD de Open Legend ni asumir la OLCL como licencia de ningún archivo del repo: la cláusula 2 solo autoriza referenciar el SRD, no reproducirlo fuera de él.
  - **Inspiración de diseño únicamente:** el patrón mecánico abstracto de "Banes/Boons" (estados temporales con impacto numérico directo en tiradas de control de averías o puestos) puede implementarse en Lua/C++ dentro de `#484` y `#847` sin emplear terminología ni texto protegido de Open Legend. Se trata como una idea mecánica genérica y preexistente en muchos sistemas de rol (no exclusiva de Open Legend), consistente con el modo "adaptación conceptual" de la sección 1 — sin que esto suponga afirmar que ninguna licencia pudiera aplicar a cualquier adaptación futura más cercana al texto original.

---

### 3. Cypher System Open License (Monte Cook Games)
- **URL:** [https://www.montecookgames.com/cypher-system-open-license/](https://www.montecookgames.com/cypher-system-open-license/)
- **Licencia:** **Cypher System Open License (CSOL)**, texto completo obtenido y leído en [csol.montecookgames.com/license/](https://csol.montecookgames.com/license/):
  > "[...] grants You a perpetual, non-exclusive, royalty-free, worldwide license to publish and distribute tabletop roleplaying game materials (the 'Work') based on and incorporating the Cypher System Reference Document ('CSRD') and declaring compatibility with the Cypher System."
  El texto completo **no contiene ninguna cláusula que prohíba software ejecutable o videojuegos** — la afirmación de una edición previa de este documento en ese sentido queda descartada por lectura directa, no solo "no confirmada". Sí exige, como condición del grant: incluir la frase o logo "Compatible with the Cypher System" en la portada, y un aviso de no afiliación con MCG en la sección de créditos/copyright del producto. El grant cubre el texto del CSRD; excluye explícitamente "text, art, or other content from other MCG publications".
- **Qué aporta:** La filosofía de resolución mediante niveles de dificultad de 1 a 10 (multiplicados por 3), el gasto de recursos del personaje (*Pools* / *Effort*) para reducir la dificultad, y las *GM Intrusions* (complicaciones narrativas a cambio de recompensas).
- **Riesgo:**
  - No hay prohibición de software, pero tampoco hay compatibilidad automática con GPL-2.0: el grant exige marca de compatibilidad + aviso de no afiliación en el producto final, obligaciones que una licencia de software libre estándar no contempla. Portar texto del CSRD al núcleo significaría llevar esas obligaciones de marca al binario compilado, no solo al repositorio de texto.
- **Propuesta concreta (con el texto legal completo ya verificado):**
  - **No portar** texto o reglas textuales de la CSOL: aunque no hay bloqueo legal para software, cumplir la marca/aviso obligatorios en cada distribución del juego es una carga que no se justifica frente al beneficio de reutilizar solo la filosofía de "Effort"/"GM Intrusions".
  - **Referencia conceptual:** la mecánica de "GM Intrusion" (evento imprevisto inyectado en un puesto por el GM que recompensa a la tripulación con reservas de energía o suministros) es un patrón de diseño genérico de juegos de rol y se cita en [`docs/CONSOLA_CALIENTE_GM.md`](CONSOLA_CALIENTE_GM.md) sin nombrarla ni derivarla textualmente de Cypher.

---

### 4. Open Game Systems (RPGnet Wiki)
- **URL:** [https://wiki.rpg.net/index.php/Open_Game_Systems](https://wiki.rpg.net/index.php/Open_Game_Systems)
- **Licencia:** **No verificada — de la wiki, no de los sistemas que indexa.** La página de contenido (`Open_Game_Systems`) responde; la página de términos de la wiki (`RPGnet_Wiki:About`) sigue devolviendo 403/challenge del proveedor en cada intento, incluidas peticiones con cabeceras de navegador completas. No se confirma que la propia wiki esté bajo CC BY-SA ni FDL. Esto es distinto de la licencia de cada sistema que la wiki cataloga (OGL, CC, DRL...): esa información aparece en las páginas de contenido y no requiere verificar la licencia de RPGnet.
- **Qué aporta:** Índice taxonómico exhaustivo de sistemas de rol categorizados por licencia (OGL 1.0a, CC, Dominion Rules Licence, FUDGE Open License, etc.).
- **Riesgo:** Bajo, siempre que se use solo como índice de búsqueda. No se copia texto de la wiki en sí (cuya licencia sigue sin confirmar); cada sistema que indexa se verifica por su propia fuente primaria si se decide investigarlo (como se hizo aquí con QuestWorlds, Cypher, Open Legend y Dominion Rules).
- **Propuesta concreta (Solo Referencia / Catálogo de Exploración):**
  - Se referencia en `docs/ECOSISTEMA_OPEN_SOURCE.md` como repositorio de consulta para futuras revisiones de reglas de dominio público o CC0.

---

### 5. QuestWorlds (Chaosium Inc.)
- **URL:** [https://github.com/ChaosiumInc/QuestWorlds](https://github.com/ChaosiumInc/QuestWorlds)
- **Licencia:** **Open RPG Creative License (ORC)**. Fuente primaria exacta: [`0.1_Legal_Information.md`](https://github.com/ChaosiumInc/QuestWorlds/blob/master/0.1_Legal_Information.md) en el repositorio (rama `master`), que identifica:
  - **QuestWorlds System Reference Document 0.97 ("QWSRD0.97")** como el texto cubierto.
  - El **ORC Notice**: "This product is licensed under the ORC License located at the Library of Congress at **TX 9-307-067**".
  - Atribución exigida: "QuestWorlds © copyright 2019–2023 Moon Design Publications LLC" más el logo QuestWorlds.
  - **Reserved Material**, explícitamente fuera del grant: "all artwork, illustrations, and graphic design, and trade dress, and all trademarks, including *Call of Cthulhu*, *Chaosium*, *Future-World*, *Magic World*, *Pendragon*, *RuneQuest*, *Superworld*, and *Worlds of Wonder*".
  - El texto oficial de la ORC License (TX 9-307-067, verificado en el PDF publicado por Azora Law/Paizo) formula el grant principal (sección II.a) como **"non-sublicensable"**: "Licensor hereby grants You a worldwide, royalty-free, **non-sublicensable**, non-exclusive, irrevocable license [...]". La adaptación (sección II.b, "Grant of Adapted Licensed Material by You") no es una sublicencia sino una oferta obligatoria del adaptador hacia sus propios destinatarios — mecanismo distinto, no "sublicenciable" en el sentido técnico. La afirmación anterior de este documento ("reglas [...] sublicenciables") se retira por impreciso.
- **Qué aporta:** Un sistema narrativo y de resolución de conflictos altamente formalizado basado en apuestas de resolución (*asymmetric resolution mechanics* y *extended contests*), publicado limpiamente en Markdown en un repositorio de GitHub bajo la licencia ORC promovida por la industria.
- **Riesgo y evaluación de compatibilidad:**
  - QWSRD 0.97 está fijado como versión de referencia; el Reserved Material (arte, trade dress, marcas de Chaosium) queda fuera de cualquier adaptación.
  - El grant no sublicenciable no impide adaptar el contenido con atribución (es su propósito declarado); sí impide redistribuirlo bajo una licencia distinta a quien lo recibe de nosotros sin que siga siendo, a su vez, Licensed/Adapted Material bajo la ORC.
- **Propuesta concreta (Solo Referencia — el veredicto de "adaptador" queda fuera de alcance):**
  - No se requiere port de código.
  - #886 exige, para calificar algo como "posible adaptador", una API o archivo de entrada/salida concreto que muestre cómo se traduciría la mecánica de QuestWorlds a datos de Espaciokoop Lagunak. Este documento no lo define, así que **QuestWorlds queda clasificado como referencia de diseño**, no como adaptador — si en el futuro se escribe ese resolvedor en Lua, deberá atribuir formalmente a QuestWorlds SRD 0.97 conforme al ORC Notice citado arriba.

---

### 6. Dominion Rules
- **URL:** [https://dominionrules.org/](https://dominionrules.org/)
- **Licencia:** **Dominion Rules Licence (DRL), versión 2.01**, verificada en el PDF enlazado directamente por la portada oficial del proyecto: [DRL v2.01 (PDF)](https://siteassets.pagecloud.com/dominion-rules/uploads/DRL-ife9a.pdf) (el enlace `dominionrules.org/licence` usado en una edición previa de este documento devolvía 404; este es el enlace vigente). Cláusulas relevantes:
  - **5.2 (redistribuir sin modificar):** exige conservar "the Dominion Rules Notice, the Copyright Notice, and this Licence" en toda copia.
  - **5.3 (redistribuir con modificaciones):** además de 5.2, exige publicar las modificaciones en un sitio web bajo la misma DRL, mantenerlas disponibles mientras se distribuyan, y actualizar el aviso de copyright.
  - **6.1 (Larger Works):** obras que combinan Dominion Rules con contenido que no es "Compatible Work" quedan sujetas a **toda** la DRL.
  - **6.2 (Compatible Works):** obras que solo declaran compatibilidad (sin incorporar texto de Dominion Rules) quedan sujetas a toda la DRL **excepto la sección 5**, pero deben llevar el aviso literal de la cláusula 6.3 ("This work is compatible with the Dominion Rules roleplaying system...").
- **Qué aporta:** Un motor de reglas de rol completo basado en tiradas de d12 frente a valores de atributo, con reglas detalladas para habilidades, fatiga, movimiento y combate por turnos.
- **Riesgo:**
  - Incorporar texto/fórmulas de Dominion Rules como "Larger Work" (6.1) sujetaría el conjunto a la DRL completa — una segunda licencia superpuesta a la GPL-2.0 del núcleo, con obligaciones de redistribución (5.2/5.3) que la GPL-2.0 no exige en esos términos. No se afirma "incompatibilidad legal" categórica: la vía de "Compatible Work" (6.2) sí permite declarar compatibilidad con reglas propias sin heredar la sección 5, a cambio del aviso de 6.3.
- **Propuesta concreta (con el clausulado completo ya verificado):**
  - **No incluir** textos, fórmulas o archivos directos de Dominion Rules como "Larger Work": la sección 5 impondría obligaciones de redistribución ajenas a la disciplina de licencia única del repo.
  - Si en el futuro se diseñan reglas propias inspiradas en el sistema de d12 sin copiar texto de la DRL, la vía correcta es declarar "Compatible Work" (6.2) con el aviso de 6.3, no incorporar el texto de Dominion Rules al núcleo.

---

### 7. AnyRPG
- **URL:** [https://www.anyrpg.org/](https://www.anyrpg.org/) / [GitHub AnyRPGCore](https://github.com/AnyRPG/AnyRPGCore)
- **Licencia:** **MIT verificado** para el código fuente del motor ([LICENSE](https://github.com/AnyRPG/AnyRPGCore/blob/master/LICENSE), leído íntegro: copyright Michael Day, texto MIT estándar). Los activos visuales y de sonido del árbol proceden de terceros con licencias propias por componente (no la MIT del motor) — se tratan como un lote aparte a efectos de licencia, nunca se asume que heredan la del código.
- **Qué aporta:** Arquitectura de motor de juego RPG en C# sobre Unity: esquemas de datos serializables para misiones (*QuestSystem*), árboles de habilidades (*SkillTrees*), inventario y tablas de botín (*LootTables*).
- **Riesgo y motivos de descarte:**
  - AnyRPG está acoplado de forma inseparable al ecosistema de componentes de Unity (`MonoBehaviour`, `ScriptableObject`, Unity Engine APIs). Espaciokoop Lagunak es un simulador en C++17 nativo con frontend C++ / SFML y puente HTTP JSON. Intentar importar o adaptar AnyRPG supondría introducir un motor ajeno de gigabytes, rompiendo por completo la arquitectura standalone ligera del proyecto.
- **Propuesta concreta (Descarte de Motor / Referencia de Esquema):**
  - **Descartar** AnyRPG como motor y como biblioteca.
  - **Referencia de diseño:** Los esquemas declarativos JSON de prerrequisitos de misión y recompensas de AnyRPG pueden consultarse conceptualmente al diseñar los esquemas de misiones de campaña en el núcleo (`#766`), sin importar código ni binarios.

---

### 8. awesome-cc0 (Madjin)
- **URL:** [https://github.com/madjin/awesome-cc0](https://github.com/madjin/awesome-cc0)
- **Licencia:** CC0 1.0 Universal ([LICENSE en repo](https://github.com/madjin/awesome-cc0/blob/main/LICENSE)) — **verificado solo para el índice/repositorio en sí**. Cada destino que enlaza (Freesound, Kenney, ambientCG, etc.) mantiene su propia licencia, no verificada aquí; el CC0 del índice no certifica la licencia de lo que enlaza.
- **Qué aporta:** Directorio estructurado de repositorios y fuentes de recursos con licencia CC0 (Dominio Público): efectos de sonido (Freesound CC0, Kenney), texturas PBR (ambientCG), modelos 3D y fuentes tipográficas.
- **Riesgo:** El del propio índice es nulo (CC0). El de cada asset enlazado es **desconocido hasta verificarlo individualmente** conforme a `docs/FUENTES_EXTERNAS.md` — no se hereda del índice, y no se etiqueta como "riesgo nulo" hasta esa verificación.
- **Propuesta concreta (Depender Caso a Caso):**
  - **Capa afectada:** Capa 3 (Arte y Audio de cliente nativo y visor standalone).
  - **Procedimiento:** Cuando el cliente standalone requiera nuevos efectos de sonido de interfaz (confirmación de salto, alarmas de avería, pulsación de consola GM) o fuentes tipográficas libres, se consulta awesome-cc0, extrayendo piezas individuales con licencia CC0 verificada y registrándolas en [`docs/ASSETS_LIBRES.md`](ASSETS_LIBRES.md).

---

## 4. Matriz de Decisión Priorizada para Standalone

La siguiente matriz prioriza los 8 recursos en función de su **valor práctico para la arquitectura standalone** y su **coste/riesgo de integración**:

```
VALOR STANDALONE
 Alto  │ [8] awesome-cc0 (Assets, índice CC0,   [5] QuestWorlds (ORC verificada,
       │     assets sin verificar)                  QWSRD 0.97, no sublicenciable)
       │
 Medio │ [4] Open Game Systems (Directorio,     [1] r/rpg debate (Contexto,
       │     licencia de la wiki sin verificar)     fuera de tabla de licencias)
       │
 Bajo  │ [2] Open Legend (OLCL verificada:     [3] Cypher System (CSOL verificada:
       │     logo+aviso obligatorios)               marca+aviso obligatorios,
       │ [6] Dominion Rules (DRL v2.01              sin bloqueo de software)
       │     verificada: 5.2/5.3/6.1/6.2)      [7] AnyRPG (MIT verificado, acoplado a Unity)
       └─────────────────────────────────────────────────────────────
         NO PORTAR: OBLIGACIONES DE MARCA        REFERENCIA CONCEPTUAL O
         O REDISTRIBUCIÓN VERIFICADAS             COMPLEJIDAD ARQUITECTÓNICA
```

### Resumen de Prioridad de Acciones:
1. **Prioridad 1 (Aprovechable de inmediato):** `awesome-cc0` como cantera oficial para activos de audio y UI, verificando la licencia de cada asset individual antes de incorporarlo a la Capa 3 — el CC0 del índice no cubre lo que enlaza.
2. **Prioridad 2 (Diseño conceptual e inspiración, sin copiar texto):** patrones mecánicos genéricos inspirados en la resolución asimétrica de `QuestWorlds` (QWSRD 0.97 fijado) y en las GM Intrusions de `Cypher System`, implementados como ideas propias en Lua/C++ sin nombrar ni citar las obras originales ni su Reserved Material/CSRD.
3. **Prioridad 3 (No portar — motivo verificado, no pendiente):** `Open Legend` (OLCL: logo + aviso obligatorios, grant limitado al SRD), `Cypher System` (CSOL: marca de compatibilidad + aviso obligatorios), y `Dominion Rules` (DRL v2.01: sección 5 de redistribución si se incorpora como "Larger Work") tienen ya su clausulado exacto verificado en fuente primaria; la razón para no portarlos es que sus obligaciones de marca/redistribución no encajan con la licencia única GPL-2.0 del repo, no que su licencia siga sin confirmar. `Open Game Systems (RPGnet Wiki)` sigue con la licencia de la wiki (no de los sistemas que indexa) sin verificar por bloqueo del proveedor. `AnyRPG` es la única exclusión puramente arquitectónica: licencia MIT verificada y compatible, descartada solo por el acoplamiento irrenunciable a Unity.
