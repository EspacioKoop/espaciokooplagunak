# Norma platino de colaboración: terminar antes de empezar

Norma compartida de Varo y Gurucharri, aplicable a personas, agentes y bots.
Se lee al inicio de cada tarea junto con `AGENTS.md`. Regula la entrega del
repositorio; no sustituye las fronteras de privacidad ni las reglas de seguridad.

## 1. La cola existente tiene prioridad

Antes de abrir otro issue, rama o PR, consultar la cola viva y priorizar, por este
orden: resolver bloqueantes de entregas abiertas, revisar e integrar cambios
listos, cerrar duplicados o entregas sustituidas con un enlace a su sucesor, y
terminar los issues ya asumidos. No abrir otro frente para esquivar una review.

Si todo lo pertinente está bloqueado por una dependencia real o una decisión
humana, dejar el motivo y siguiente acción en el hilo existente y avanzar en
trabajo independiente. Las incidencias urgentes de seguridad o regresión no
esperan. No generar issues de seguimiento duplicados ni comentarios de estado
sin nueva evidencia. Un issue solo se cierra como completado cuando se cumple
su aceptación; un PR sustituido se cierra indicando dónde continúa su trabajo.

## 2. Review proporcional, no espera por rutina

Varo y Gurucharri tienen la misma autoridad de administración. Para cambios
ordinarios, acotados y reversibles, la revisión propia del diff, las pruebas
aplicables y los checks obligatorios permiten integrar por PR sin esperar una
aprobación ajena, también en contribuciones propias. Los agentes que actúan con
su autorización siguen ese mismo criterio: no inventan una segunda firma ni
solicitan otra autorización ya concedida para el mismo alcance.

La review cruzada sigue siendo útil, pero no es una ceremonia obligatoria para
toda entrega. Reutilizar evidencia válida del mismo candidato y criterio; un
cambio invalida solo las pruebas afectadas. No volver a exigir pruebas costosas
sin una razón técnica concreta ni añadir requisitos laterales en una re-review.

## 3. Los riesgos reales sí bloquean

Se exige revisión independiente adicional cuando el cambio afecte a autenticación,
permisos, secretos, fronteras de datos, operaciones destructivas, migraciones
irreversibles, workflows privilegiados o cambios incompatibles de protocolo.
Las decisiones de producto abiertas siguen perteneciendo a la dirección compartida.

No integrar con defectos bloqueantes conocidos, checks obligatorios fallidos o
pendientes, conversaciones sin resolver, licencia sin verificar o pruebas de
aceptación exigidas que no se han realizado. Una solicitud de cambios se resuelve
con evidencia sobre sus hallazgos, no ignorando al revisor ni descartando su review
para despejar un contador. Las mejoras no bloqueantes pueden seguir después,
sin presentar como resuelto lo que no lo está.

## 4. Integrar y verificar, sin saltarse protecciones

Comprobar el SHA, base, conflictos, checks, reviews y PR dependientes inmediatamente
antes del merge. Integrar en serie los cambios solapados y conservar el trabajo de
ambas ramas. Verificar después el merge y el estado de los issues afectados.
Integrado en `main` no significa desplegado ni probado por personas.

La política técnica de `main` mantiene PR, conversaciones resueltas, los siete
checks obligatorios, administradores sujetos a las protecciones y prohibición de
force-push y borrado. El mínimo de aprobaciones es **0**, sin aprobación ajena
obligatoria del último push; esto no elimina la revisión por riesgo de arriba.
No usar bypass de administrador ni alterar protecciones ante un bloqueo.
Si la configuración deriva, informar: este documento no modifica GitHub por sí solo.

## Registro del cambio y reversibilidad

El 2026-09-07 se sustituyó la aprobación externa universal por revisión proporcional.
Se verificaron por API `required_approving_review_count: 0` y
`require_last_push_approval: false`, conservando las demás protecciones.
Para restaurar la política anterior, administración puede volver a establecer
`required_approving_review_count: 1` y `require_last_push_approval: true`,
con autorización expresa y actualizando estos documentos.
