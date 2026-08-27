# Política de atribución de contribuciones

Esta política complementa [`CREDITS.md`](../CREDITS.md). Su objetivo es mantener
los créditos estables y legibles sin convertirlos en un registro de cada comando,
herramienta o ejecución puntual de un agente.

## Qué permanece en `CREDITS.md`

El archivo de créditos contiene únicamente información estable y de alto nivel:

1. dirección y mantenimiento del proyecto;
2. autoría heredada, upstream y licencias que deben conservarse;
3. agentes persistentes con un rol reconocible y continuado;
4. un enlace a esta política para la atribución detallada.

Las contribuciones puntuales no requieren añadir una nueva entrada permanente.

## Dónde vive la atribución detallada

La atribución concreta de una entrega se conserva en sus fuentes de autoridad:

- historial Git y mensaje del commit;
- issue y pull request, incluyendo revisión y verificación;
- documentación de procedencia cuando se incorpora un asset o una fuente externa.

No se reescribe el historial existente para añadir atribución retrospectiva.

## Trailers opcionales para agentes

Cuando aporte valor y el equipo lo acuerde, un commit puede incluir un trailer
`AI-Assisted-By` con el agente y el tipo de contribución:

```text
AI-Assisted-By: Nombre del agente (revisión y pruebas)
```

El trailer es metadato de trazabilidad, no una sustitución de la revisión humana,
la autoría legal ni la información de licencia. No se exige para commits antiguos,
ni para cada herramienta genérica (`git`, `pytest`, compiladores o editores).

## Regla de upstream

La autoría de EmptyEpsilon y de cualquier otra dependencia heredada permanece
separada de los créditos del fork. Una contribución nueva no puede desplazar,
mezclar ni reinterpretar esos créditos o sus obligaciones de licencia.

## Regla de mantenimiento

Si una contribución merece reconocimiento estable, se actualiza `CREDITS.md` con
una entrada breve y revisada. Si solo necesita trazabilidad de una entrega, se
deja en Git/GitHub y no se duplica en el documento. Esta política no introduce
hooks, reescrituras automáticas ni una integración futura con grafos: esas mejoras
requieren un diseño y una decisión independientes.

