# Sistemas de RPG abiertos, licencias y repositorios CC0 para integración standalone

> **Issue:** [#886](https://github.com/VaroTv7/espaciokooplagunak/issues/886)  
> **Objetivo:** Investigar ocho sistemas, licencias y repositorios de RPG abiertos/CC0, con foco en si aportan reglas, contenido o contratos aprovechables para el objetivo **standalone** de Espaciokoop Lagunak, sin heredar dependencias de ejecución de Foundry VTT.  
> **Marco arquitectónico y legal:** Licencia de este repo: **GPL-2.0** ([`LICENSE`](../LICENSE)), principio **ADR-0008** ([`docs/adr/0008-standalone-first-autoridad-del-nucleo.md`](adr/0008-standalone-first-autoridad-del-nucleo.md)), política de contenido externo ([`docs/CONTENIDO_EXTERNO.md`](CONTENIDO_EXTERNO.md)) y verificación técnica de fuentes ([`docs/FUENTES_EXTERNAS.md`](FUENTES_EXTERNAS.md)).

---

## 1. Marco de Evaluación Standalone

Para que una fuente externa sea aprovechable en Espaciokoop Lagunak sin violar nuestros principios fundacionales, debe evaluarse bajo cuatro filtros obligatorios:

1. **Compatibilidad con GPL-2.0:** El software de Espaciokoop Lagunak es GPL-2.0 pura. Código con licencias incompatibles (como GPL-3.0 estricta o Apache-2.0 incorporada como código) no puede fusionarse. Licencias permisivas (MIT, BSD, CC0) y copyleft compatible (GPL-2.0-or-later) son integrables. Datos y textos bajo CC-BY o CC0 son aprovechables con atribución debida. Licencias propietarias o con cláusulas no comerciales (NC) o prohibitivas de software no pueden incorporarse al núcleo.
2. **Independencia de Foundry VTT (ADR-0008):** Todo contenido, regla o contrato adoptado debe residir canónicamente en el **núcleo C++** o en scripts de escenario Lua/formato de datos puro. Foundry VTT actúa únicamente como visor/proyector opcional.
3. **Cero dependencias pesadas de terceros:** No se importan motores completos externos (como Unity/Godot) para funciones que el simulador o el backend nativo deben resolver por sí mismos.
4. **Verificación de procedencia y licencias de archivos:** Se distingue la licencia del marco o repositorio respecto a los activos concretos (regla de [`docs/FUENTES_EXTERNAS.md`](FUENTES_EXTERNAS.md)).

---

## 2. Tabla Comparativa de los 8 Recursos

| # | Recurso / Proyecto | URL de Referencia | Licencia Exacta | Enlace a Fuente Oficial de Licencia | Qué Aporta | Riesgo de Integración | Compatibilidad Standalone | Decisión / Veredicto |
|---|---|---|---|---|---|---|---|---|
| 1 | **Reddit r/rpg Open TTRPGs Discussion** | [reddit.com/r/rpg/comments/104jygu/...](https://www.reddit.com/r/rpg/comments/104jygu/comment/j3a32ir/) | Discusión comunitaria (N/A / Copyright usuarios) | [Reddit User Agreement](https://www.redditinc.com/policies/user-agreement) | Cantera de debate sobre licencias post-OGL 1.0a, distinción mecánica vs. texto | **Solo referencia** (sin código ni assets) | N/A (foro de debate) | **Solo referencia / Cantera** |
| 2 | **Open Legend RPG** | [openlegendrpg.com](https://openlegendrpg.com/) | Open Legend Community License (OLCL) | [Open Legend Licensing Terms](https://openlegendrpg.com/licensing) | Reglas genéricas d20+dados de atributo, mecánicas de estados/banes/boons | **Descartar** (licencia custom restrictiva para software; exige logo obligatorio) | Incompatible como código núcleo; mecánicas abstraibles como ideas | **Descartar** (tomar conceptos de boons/banes como inspiración sin texto) |
| 3 | **Cypher System Open License** | [montecookgames.com/cypher-system-open-license/](https://www.montecookgames.com/cypher-system-open-license/) | Cypher Open License (COL) | [Monte Cook Games COL](https://www.montecookgames.com/cypher-open-license/) | Sistema narrativo de dificultad 1-10, esfuerzo (Effort) y GM Intrusions | **Descartar** (licencia contractual limitada a TTRPG de mesa; restringe videojuegos/software) | Incompatible legalmente para software embebido; alta fricción contractual | **Descartar** (referencia conceptual de GM Intrusions para eventos de simulación) |
| 4 | **Open Game Systems (RPGnet Wiki)** | [wiki.rpg.net/index.php/Open_Game_Systems](https://wiki.rpg.net/index.php/Open_Game_Systems) | Wiki bajo CC BY-SA / FDL (según RPGnet) | [RPGnet Wiki Terms](https://wiki.rpg.net/index.php/RPGnet_Wiki:About) | Directorio comparativo de decenas de SRDs (FUDGE, OGL, retroclones, PD) | **Solo referencia** (índice agregador) | Totalmente compatible como índice de investigación | **Solo referencia / Directorio** |
| 5 | **QuestWorlds (Chaosium)** | [github.com/ChaosiumInc/QuestWorlds](https://github.com/ChaosiumInc/QuestWorlds) | Open RPG Creative License (ORC) | [QuestWorlds ORC Notice & Repo](https://github.com/ChaosiumInc/QuestWorlds) | Motor genérico de resolución de conflictos por apuestas/grados de éxito | **Solo referencia / Adaptador de datos** | Alta compatibilidad para tablas y mecánicas libres | **Solo referencia / Posible Adaptador de resolución narrativa** |
| 6 | **Dominion Rules** | [dominionrules.org](https://dominionrules.org/) | Dominion Rules Licence (DRL v3.1) | [Dominion Rules Licence](https://dominionrules.org/licence) | Sistema de reglas basado en d12, resolución unificada de habilidades y combate | **Descartar** (DRL es copyleft custom no homologado con GPL-2.0, impone avisos específicos) | Incompatible para mezclar con código GPL-2.0 | **Descartar** (incompatibilidad legal estricta de la DRL con GPL-2.0) |
| 7 | **AnyRPG** | [anyrpg.org](https://www.anyrpg.org/) | MIT (código motor en GitHub) + activos de terceros variables | [AnyRPG GitHub License](https://github.com/AnyRPG/AnyRPGCore/blob/master/LICENSE) | Motor RPG en C# para Unity (gestión de quests, inventario, diálogos, combate) | **Descartar** (atadura dura a Unity Engine; código no aprovechable en C++ nativo) | Incompatible con la arquitectura ligera en C++/Lua de EmptyEpsilon | **Descartar como motor** (patrón de datos JSON de misiones como referencia) |
| 8 | **awesome-cc0** | [github.com/madjin/awesome-cc0](https://github.com/madjin/awesome-cc0) | CC0 1.0 Universal / Public Domain | [awesome-cc0 LICENSE](https://github.com/madjin/awesome-cc0/blob/main/LICENSE) | Directorio curado de assets 3D, audio, texturas y fuentes en dominio público | **Depender caso a caso** (assets directos de sonido y UI) | Excelente para standalone (activos sin dependencias ni royalties) | **Depender caso a caso** (cantera oficial de audio y UI para cliente nativo) |

---

## 3. Análisis Detallado y Propuestas Concretas por Recurso

### 1. Reddit r/rpg: Debate sobre sistemas abiertos y licencias post-OGL
- **URL:** [https://www.reddit.com/r/rpg/comments/104jygu/comment/j3a32ir/](https://www.reddit.com/r/rpg/comments/104jygu/comment/j3a32ir/)
- **Licencia:** Términos de Servicio de Reddit (contenido aportado por usuarios).
- **Qué aporta:** Análisis y recopilación de la comunidad respecto al movimiento hacia licencias abiertas (Creative Commons CC-BY, CC0, ORC) frente a las limitaciones de licencias propietarias cerradas tras la crisis de la OGL 1.0a en 2023.
- **Riesgo:** Ninguno, es material puramente informativo.
- **Propuesta concreta (Solo Referencia):**
  - Se cita en `docs/INSPIRACION_JUEGOS_LIBRES.md` como contexto del movimiento de apertura de reglas TTRPG.
  - No genera ningún archivo de código ni adaptación.

---

### 2. Open Legend RPG
- **URL:** [https://openlegendrpg.com/](https://openlegendrpg.com/)
- **Licencia:** Open Legend Community License (OLCL) ([Términos OLCL](https://openlegendrpg.com/licensing)).
- **Qué aporta:** Mecánicas de resolución ágiles con escalado de dados de atributo y un sistema modular de ventajas (*boons*) y desventajas (*banes*) aplicadas dinámicamente en situaciones tácticas o de estrés.
- **Riesgo y motivos de descarte:**
  - La licencia OLCL es una licencia propietaria a medida que obliga a estampar el logotipo "Open Legend Licensed Product", exige cláusulas de no descrédito y está diseñada primordialmente para suplementos de rol de mesa en PDF/impreso, no para integrarse en código fuente GPL-2.0 de simuladores.
- **Propuesta concreta (Descarte Legal con Extracción Conceptual):**
  - **Descartar** cualquier copia de texto del SRD de Open Legend o vinculación de la OLCL.
  - **Inspiración de diseño:** El patrón mecánico abstracto de "Banes/Boons" (estados temporales con impacto numérico directo en tiradas de control de averías o puestos) se implementa de forma matemática limpia en Lua/C++ dentro de `#484` y `#847` sin emplear terminología ni texto protegido.

---

### 3. Cypher System Open License (Monte Cook Games)
- **URL:** [https://www.montecookgames.com/cypher-system-open-license/](https://www.montecookgames.com/cypher-system-open-license/)
- **Licencia:** Cypher Open License (COL) ([Términos COL](https://www.montecookgames.com/cypher-open-license/)).
- **Qué aporta:** La filosofía de resolución mediante niveles de dificultad de 1 a 10 (multiplicados por 3), el gasto de recursos del personaje (*Pools* / *Effort*) para reducir la dificultad, y las *GM Intrusions* (complicaciones narrativas a cambio de recompensas).
- **Riesgo y motivos de descarte:**
  - La Cypher Open License restringe explícitamente el uso de su contenido para software ejecutable y videojuegos interactivos (está acotada a publicaciones de rol de mesa tradicionales).
  - La licencia impone obligaciones contractuales directas con Monte Cook Games incompatibles con la redistribución irrestricta de GPL-2.0.
- **Propuesta concreta (Descarte Legal / Solo Referencia):**
  - **Descartar** la importación de texto o reglas textuales de la CRD.
  - **Referencia conceptual:** La mecánica de "GM Intrusion" (evento imprevisto inyectado en un puesto por el GM que recompensa a la tripulación con reservas de energía o suministros) se cita en [`docs/CONSOLA_CALIENTE_GM.md`](CONSOLA_CALIENTE_GM.md) como patrón de diseño de eventos en caliente.

---

### 4. Open Game Systems (RPGnet Wiki)
- **URL:** [https://wiki.rpg.net/index.php/Open_Game_Systems](https://wiki.rpg.net/index.php/Open_Game_Systems)
- **Licencia:** Documentación colaborativa Wiki (CC BY-SA / FDL).
- **Qué aporta:** Índice taxonómico exhaustivo de sistemas de rol categorizados por licencia (OGL 1.0a, CC, Dominion Rules Licence, FUDGE Open License, etc.).
- **Riesgo:** Cero riesgo; actúa como metadatos de búsqueda.
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
- **Licencia:** Dominion Rules Licence v3.1 (DRL) ([Licencia DRL](https://dominionrules.org/licence)).
- **Qué aporta:** Un motor de reglas de rol completo basado en tiradas de d12 frente a valores de atributo, con reglas detalladas para habilidades, fatiga, movimiento y combate por turnos.
- **Riesgo y motivos de descarte:**
  - La DRL es una licencia copyleft personalizada ("open-gaming style") redactada a finales de los años 90 / principios de los 2000. No es compatible con la GPL-2.0 de nuestro repositorio (exige la inclusión obligatoria de su propio clausulado y aviso de copyright en toda redistribución, lo que entra en conflicto con las restricciones no añadidas de la GPL).
- **Propuesta concreta (Descarte por Incompatibilidad de Licencia):**
  - **Descartar** completamente la inclusión de textos, fórmulas o archivos directos de Dominion Rules.
  - Se documenta en el catálogo de descartes para evitar revaluaciones redundantes.

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
 Alto  │ [8] awesome-cc0 (Assets CC0)        [5] QuestWorlds (ORC / Apuestas)
       │
 Medio │ [4] Open Game Systems (Directorio)   [1] r/rpg debate (Cantera)
       │
 Bajo  │ [2] Open Legend (OLCL restrictivo)   [3] Cypher System (Prohíbe software)
       │ [6] Dominion Rules (DRL incompatible) [7] AnyRPG (Acoplado a Unity)
       └─────────────────────────────────────────────────────────────
         BAJO RIESGO / PERMISIVO               ALTO RIESGO / INCOMPATIBLE
                                               COMPLEJIDAD / RESTRICCIÓN
```

### Resumen de Prioridad de Acciones:
1. **Prioridad 1 (Aprovechable de inmediato):** `awesome-cc0` como cantera oficial para activos de audio y UI con licencia CC0, incorporados según demanda en la Capa 3.
2. **Prioridad 2 (Diseño conceptual e inspiración):** Modelos de apuestas y resolución asimétrica de `QuestWorlds` para misiones de simulación en Lua, y mecánicas de GM Intrusions (`Cypher System`) para la consola GM.
3. **Prioridad 3 (Descartes formales documentados):** `Open Legend`, `Cypher System (código)`, `Dominion Rules` y `AnyRPG` quedan descartados formalmente para evitar fricción legal (licencias incompatibles o restrictivas para software) o arquitectónica (dependencia de motores externos).
