# ADR-0016: Seguridad de la capa lúdica

- Estado: Propuesta
- Fecha: 2026-09-07
- Relacionado: #700, #691, #338, #354

## Contexto

La crónica, las hazañas y los paneles de progreso añadirán eventos y estado a la experiencia. Esa capa debe respetar la frontera existente del puente: Foundry puede presentar y transportar, pero no se convierte en autoridad ni obtiene datos GM-only.

## Decisión

La capa lúdica adopta seis invariantes antes de incorporar su primer consumidor:

1. **Fuga de información:** un evento solo puede contener datos ya visibles para el puesto receptor. Contactos, parámetros de spawn y telemetría GM-only quedan fuera del evento.
2. **Suplantación:** la inscripción se acepta únicamente desde el camino autorizado del puente y la identidad de puesto existente. Un cliente no escribe crónica directamente.
3. **Integridad:** la bitácora deduplicada es la única vía de persistencia. Las hazañas se derivan de eventos y no mantienen un almacén paralelo.
4. **Privilegios:** títulos, rarezas y desbloqueos narrativos nunca amplían la lista blanca ni conceden órdenes del puente.
5. **Secretos y carga útil:** los eventos transportan identificadores y versión, nunca credenciales, tokens, secretos o payloads de sensores.
6. **Disponibilidad:** la inscripción se limita por sesión y puesto antes de persistir o difundir eventos.

## Consecuencias

- El primer esquema de eventos debe rechazar campos GM-only, secretos y payloads de sensores.
- El primer consumidor debe aportar pruebas de origen no autorizado, deduplicación y límite de frecuencia.
- La capa lúdica puede desactivarse sin cambiar la autoridad de la simulación.
- Este ADR no implementa el puente ni decide una cadencia concreta; esa cifra pertenece al diseño del primer consumidor.

## Verificación pendiente

El repositorio contiene `SECURITY.md` como documento de seguridad general, pero no contiene todavía `BRIDGE_THREAT_MODEL.md`. Cuando ese modelo se incorpore, deberá enlazar este ADR. Los tests de payload, origen, privilegios y rate limit se añadirán con la primera pieza de crónica, tal como define #700.