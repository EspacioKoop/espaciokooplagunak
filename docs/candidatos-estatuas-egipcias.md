# Candidatos de estatuas egipcias

Este documento es una lista de **candidatos**, no un catálogo de piezas admitidas.
Ninguna de estas fichas concede todavía nada: falta seleccionar la malla, y la
licencia de una malla es un asunto distinto del de la ficha del museo (ver
«Qué cubre cada licencia» al final).

## Statuette of Amun

- **Fuente:** Met 26.7.1412 — object ID `544874`
- **Cultura:** Egipcia
- **Fecha:** Tercer Período Intermedio, Dinastía 22, ca. 945–721 a.C.
- **Enlace:** https://www.metmuseum.org/art/collection/search/544874
- **Material y medidas:** oro; 17,5 × 4,7 × 5,8 cm
- **Crédito:** Purchase, Edward S. Harkness Gift, 1926
- **Evidencia:** `collectionapi.metmuseum.org/public/collection/v1/objects/544874`
  devuelve `title: "Statuette of Amun"`, `accessionNumber: "26.7.1412"`,
  `objectDate: "ca. 945–721 BCE"`, `isPublicDomain: true`.
- **Licencia (ficha e imágenes del Met):** el objeto está marcado
  `isPublicDomain: true`, es decir Open Access / CC0 para las imágenes que el
  Met publica de él.
- **Por qué sirve:** silueta clara y geometría simple, ideal para bajo poligonaje.

## Statue of two men and a boy that served as a domestic icon

- **Fuente:** Met 11.150.21 — object ID `544683`
- **Cultura:** Egipcia
- **Fecha:** Reino Nuevo, Período de Amarna, Dinastía 18, ca. 1347–1330 a.C.
- **Enlace:** https://www.metmuseum.org/art/collection/search/544683
- **Material y medidas:** caliza policromada; 17 × 12,5 cm
- **Crédito:** Rogers Fund, 1911
- **Evidencia:** `collectionapi.metmuseum.org/public/collection/v1/objects/544683`
  devuelve `title: "Statue of two men and a boy that served as a domestic icon"`,
  `accessionNumber: "11.150.21"`, `objectDate: "ca. 1347–1330 BCE"`,
  `isPublicDomain: true`.
- **Licencia (ficha e imágenes del Met):** `isPublicDomain: true` — Open Access /
  CC0 para las imágenes publicadas por el Met.
- **Por qué sirve:** composición triangular reconocible incluso con pocos polígonos.

## Qué cubre cada licencia, y qué no

La marca de dominio público del Met cubre **la obra y las imágenes que el propio
Met publica**. No dice nada sobre:

- **La malla 3D**, que todavía no está seleccionada. Un escaneo o una
  fotogrametría de un original en dominio público puede publicarse bajo su propia
  licencia, y esa es la que habría que verificar y anotar por separado antes de
  admitir la pieza. Mientras no haya malla elegida, estos candidatos no pueden
  pasar por `procedencia-catalogo.mjs`, que exige `naturaleza` (escaneo,
  escaneo-de-vaciado, fotogrametría, reconstrucción, obra propia).
- **Los metadatos de terceros** que puedan acompañar a una malla de otra
  procedencia.

## Estado

**Faltan 4 estatuas para completar las 6 solicitadas.** La verificación de las 4
restantes se detuvo al agotar el presupuesto de peticiones que este proyecto se
impone para la API del Met (500 peticiones/día). Ese tope es **interno**, una
regla de cortesía propia: el Met no publica un límite de peticiones para su API
de colección.
