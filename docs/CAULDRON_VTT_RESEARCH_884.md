# Investigación: recursos de Cauldron VTT y ecosistema físico 3D standalone

> **Refs:** [#884](https://github.com/EspacioKoop/espaciokooplagunak/issues/884).
> **Estado:** investigación parcial, no decisión de dependencia ni cierre del issue.
> **Objetivo:** identificar patrones de interacción y candidatos para #868/#413,
> sin Foundry como dependencia de ejecución del futuro runtime standalone.

## 0. Revisión y alcance de la evidencia

La corrección de eGurucharri en `67fab2848f665bd2ba8e97902df50487d4c35d90`
retira las rutas inexistentes, corrige websocket y Rapier y separa Cauldron
del ecosistema externo. Esta revalidación conserva esas decisiones y acota las
inferencias restantes: no se declara riesgo jurídico nulo, licencia global
sobre assets ni aceptación completa de #884.

Fuentes de Cauldron fijadas a
[`e7217c10a45916d703d962a894c8902f6e1c2402`][cauldron-tree]. La revalidación
consultó el árbol completo mediante la API oficial (627 entradas), README,
LICENSE, el cliente de espectador, el adaptador de dados y el fichero de
monstruos en ese SHA. Las fuentes externas se fijan a commit o versión abajo.
Ver una licencia de proyecto no verifica automáticamente sus dependencias,
binarios vendorizados, modelos, sonidos o datos de terceros.

**Aceptación pendiente de #884:** la tabla contiene siete recursos/componentes
evaluados, pero no siete licencias exactas de distribución verificadas. Los
datos siguen sin licencia acreditada y falta precisar la concesión GPL de
Cauldron por archivo. Tampoco se entrega un catálogo de assets reutilizables
con procedencia individual ni una integración física ejecutada. Integrar este
documento no completa ni debe cerrar #884.

## 1. Qué aporta realmente Cauldron

Cauldron es un VTT web independiente de Foundry. Su [README fijado][cauldron-readme]
declara JavaScript, PHP, MySQL para información de partida y **websocket para
comunicación cliente-a-cliente**. Esto acredita el stack declarado, no una
prueba de rendimiento, determinismo, autoridad segura o despliegue realizada aquí.

No debe confundirse con Cauldron of Plentiful Resources/Chris's Premades ni con
las bibliotecas independientes comparadas en la sección 3. No se investigan
licencias ni capacidades de esos módulos homónimos en esta entrega.

### 1.1. Puertas, muros y niebla

En [`public/js/spectate.js`][spectate] se verificaron `LAYER_FOG_OF_WAR`,
`door_show_closed`, `wall_position`, selección de muros transparentes y
`new WebSocket(...)`. El manejador de mensajes actualiza objetos del DOM.
Eso respalda estudiar **estado por objeto** y eventos de puertas/muros; no
acredita un algoritmo geométrico de LOS o raycasting 3D reutilizable.
`open`/`closed`/`locked` sería un contrato a diseñar en Lagunak, no una
certificación de que Cauldron exponga exactamente ese enum.

Las antiguas rutas `public/js/canvas.js`, `application/libraries/dice.php` y
`data/` no están en el árbol fijado. Se retiran como fuentes, junto con las
conclusiones de raycasting, parser propio y compendio SRD basadas en ellas.
No se concluye de una ruta ausente que no exista lógica de dados en otro archivo.

### 1.2. Dados y datos son cosas distintas

El adaptador real [`public/dice-box/dice-box.js`][dice-adapter] importa
`dice-box.es.min.js` y llama a `Box.roll(...)`. El árbol contiene assets de
Ammo/WASM, modelos, imágenes y sonido. Por tanto, **no** se describe esta
solución como «JS puro sin WASM». El [README independiente de Dice-Box][dice-readme]
explica BabylonJS, AmmoJS, workers y offscreenCanvas. Su licencia MIT no
certifica que la copia vendorizada por Cauldron corresponda al mismo commit
ni cubre por sí sola todas las piezas que se distribuirían.

[`public/data/monsters`][monsters] contiene nombres, estadísticas y códigos
`source`, por ejemplo `XMM` o `SKT`, sin aviso SRD/OGL/CC-BY en el fichero
consultado. No se expande `XMM` a «Xanathar's»: esa identificación anterior no
estaba acreditada. Los códigos de manual no prueban por sí solos la situación
jurídica de cada entrada. **No se acredita una licencia de reutilización del
conjunto**, ni que todo el conjunto sea ajeno al SRD. Se descarta importarlo
mientras no exista trazabilidad por entrada. No se infiere su licencia de la
GPL del código.

### 1.3. Adaptación de transporte

Se retira «AJAX periódicas / SSE» como descripción del transporte principal.
El websocket de Cauldron es evidencia de su implementación, no una autorización
para adoptar su protocolo, ni una demostración de que encaje con el puente de
Lagunak. Esta investigación no cambia autoridad, autenticación, protocolo ni
runtime y no propone copiar un esquema de diffs sin contrato y pruebas propios.

## 2. Tabla de evaluación (siete componentes; aceptación parcial)

| # | Recurso y fuente primaria fijada | Licencia y límite verificado | Aporte | Consumo / decisión y riesgo |
|---|---|---|---|---|
| 1 | [Cauldron completo][cauldron-tree], [LICENSE][cauldron-license] | Texto GNU GPL versión 2. El texto de ejemplo «or later» al final de la licencia no demuestra por sí solo una concesión GPL-2.0-or-later sobre todo el proyecto. Precisión por archivo pendiente. | Arquitectura de VTT web independiente de Foundry. | **Referencia**. No importar código ni datos; una futura copia exige avisos aplicables, atribución y revisión del conjunto distribuido. |
| 2 | [Estado de puertas/muros/niebla][spectate] | LICENSE GPLv2 del proyecto; no se acredita aquí un aviso individual que resuelva la variante exacta para este fichero. | Estado visible por objeto, no LOS 3D certificado. | **Adaptar patrón con implementación propia**. No se autoriza port literal ni se declara riesgo nulo. |
| 3 | [3d-dice/dice-box: LICENSE][dice-license], [README][dice-readme]; [adaptador en Cauldron][dice-adapter] | MIT del código del proyecto independiente en `eea7f1b042338b1083d4d696585b847b84f84a55`. Dependencias, assets y equivalencia de la copia vendorizada pendientes. | Dados 3D de navegador con BabylonJS/AmmoJS; candidato, no solución JS pura. | **Vigilar** como biblioteca independiente. No importar la carpeta de Cauldron ni suponer que MIT cubre todo el paquete de ejecución. |
| 4 | [Datos de monstruos de Cauldron][monsters] | **No verificada**: sin licencia de reutilización acreditada por entrada. | Ningún dataset autorizado entregado. | **Descartar importación por ahora**. Riesgo de derechos de terceros, no dictamen de infracción ni prohibición de toda referencia conceptual. |
| 5 | [cannon-es 0.20.0, metadatos oficiales][cannon] | MIT declarada en el campo `license` de esa versión npm. No es una auditoría de dependencias ni un smoke. | Candidato de física ligera para props/dados. | **Evaluar primero**, sin decidir incorporación. Para copiar/enlazar: conservar copyright/licencia y auditar el artefacto concreto. |
| 6 | [@dimforge/rapier3d 0.20.0][rapier], [rapier3d-compat 0.20.0][rapier-compat], [LICENSE en gitHead][rapier-license] | **Apache-2.0**, ambos paquetes y LICENSE coinciden. No hay evidencia de MIT dual en estos artefactos. | Alternativa de física 3D WASM. | **Vigilar**, sin dependencia de runtime. Debe revisarse el encaje de distribución con la versión GPL realmente aplicable al código combinado. |
| 7 | [Objects-Interactions-FX: LICENSE][oif-license], [árbol][oif-tree] | MIT del código en `050d33d4890ec796ad33ae235b7572e5ba38b46c`, no concesión sobre Foundry o cualquier asset externo. | Referencia de automatización; candidato conceptual para objeto→estado/tags→trigger→efecto. | **Solo referencia** e implementación propia. No se ejecuta ni importa un módulo Foundry en standalone. |

La antigua fila `MadRabbits/Godot-VTT` se retira: la review original identificó
una fuente 404 y no se aporta sustituto primario verificable. No se usa ese
nombre genérico para acreditar licencia MIT ni sumar otro recurso aceptado.

## 3. Ecosistema externo y reglas por tipo de uso

`cannon-es`, Rapier y Objects-Interactions-FX **no son capacidades de Cauldron**.
Dice-Box es un proyecto de terceros usado por Cauldron, no su motor propio.

| Tipo de uso | Frontera de esta investigación |
|---|---|
| Copiar código | Requiere licencia del archivo y versión exactos, avisos de copyright, atribución y cumplimiento de distribución. No autorizado por una casilla «riesgo nulo». |
| Enlazar dependencia | MIT exige conservar sus avisos. Apache-2.0 tiene condiciones propias; no se presupone compatibilidad con GPLv2-only ni se cambia la licencia del fork para hacerla encajar. Revisar conjunto y modalidad de distribución antes de incorporar. |
| Incorporar datos/assets | Licencia y procedencia individuales; la del motor no basta. No se incorpora ningún dato, imagen, modelo ni sonido con esta entrega. |
| Portar algoritmo | Una traducción o reescritura cercana de código puede seguir siendo derivada; no se presume que «reescribir» elimine las obligaciones. |
| Referencia conceptual | Describir una idea e implementar un contrato propio, sin copiar expresión, datos ni assets. Es la recomendación actual; no supone un aval jurídico general. |

No se afirma que Espaciokoop Lagunak sea íntegramente GPL-2.0-or-later a partir
del ejemplo incluido en su LICENSE. Este documento no cambia la GPL heredada,
la atribución de EmptyEpsilon ni las decisiones de producto de Varo y Gurucharri.

## 4. Prioridad y siguiente paso

1. **Adaptar patrones**, no portar código: estudiar un contrato propio de objeto,
   opciones, resolución y efecto para #868, con autoridad y pruebas independientes.
2. **Evaluar cannon-es** para #413 antes de introducir física adicional. Quedan
   pendientes artefacto de distribución, avisos y prueba real; no hay selección
   de motor ni dependencia añadida por esta investigación.
3. **Vigilar Rapier y Dice-Box** como alternativas independientes. Rapier no se
   recomienda mediante un supuesto build MIT. Dice-Box exige auditar también
   dependencias y assets, no solo su LICENSE.
4. **No importar datos o assets de Cauldron** sin ficha de procedencia y licencia.
   La razón no es una supuesta prohibición general de binarios: el contrato del
   repositorio permite assets con procedencia acreditada.
5. **Mantener #884 abierto** hasta acreditar licencia exacta por fila aceptada y
   completar su alcance. El runtime standalone debe resolver sus interacciones
   sin Foundry; cualquier adaptador de reglas es una cuestión separada.

## 5. Límites de verificación

Se verificaron fuentes primarias y declaraciones documentales, no una aplicación
Cauldron arrancada, benchmarks, partidas, integración de bibliotecas ni dictamen
jurídico. Las comprobaciones docs/tools del PR validan el documento/repositorio,
no sustituyen esos trabajos. La aprobación documental, si procede, acepta este
alcance parcial y no afirma el cumplimiento del criterio de cierre de #884.

[cauldron-tree]: https://gitlab.com/hsleisink/cauldron/-/tree/e7217c10a45916d703d962a894c8902f6e1c2402
[cauldron-readme]: https://gitlab.com/hsleisink/cauldron/-/blob/e7217c10a45916d703d962a894c8902f6e1c2402/README.md
[cauldron-license]: https://gitlab.com/hsleisink/cauldron/-/blob/e7217c10a45916d703d962a894c8902f6e1c2402/LICENSE
[spectate]: https://gitlab.com/hsleisink/cauldron/-/blob/e7217c10a45916d703d962a894c8902f6e1c2402/public/js/spectate.js
[dice-adapter]: https://gitlab.com/hsleisink/cauldron/-/blob/e7217c10a45916d703d962a894c8902f6e1c2402/public/dice-box/dice-box.js
[monsters]: https://gitlab.com/hsleisink/cauldron/-/blob/e7217c10a45916d703d962a894c8902f6e1c2402/public/data/monsters
[dice-license]: https://github.com/3d-dice/dice-box/blob/eea7f1b042338b1083d4d696585b847b84f84a55/LICENSE
[dice-readme]: https://github.com/3d-dice/dice-box/blob/eea7f1b042338b1083d4d696585b847b84f84a55/README.md
[cannon]: https://registry.npmjs.org/cannon-es/0.20.0
[rapier]: https://registry.npmjs.org/@dimforge%2Frapier3d/0.20.0
[rapier-compat]: https://registry.npmjs.org/@dimforge%2Frapier3d-compat/0.20.0
[rapier-license]: https://github.com/dimforge/rapier/blob/3e12c2679cb1940a876bde93af9cec0cf2f57944/LICENSE
[oif-license]: https://github.com/ZotyDev/objects-interactions-fx/blob/050d33d4890ec796ad33ae235b7572e5ba38b46c/LICENSE
[oif-tree]: https://github.com/ZotyDev/objects-interactions-fx/tree/050d33d4890ec796ad33ae235b7572e5ba38b46c
