// El catálogo de PIEZAS PROPIAS del pasillo de los recuerdos: la Guardiana y
// sus centinelas. Las piezas "recordadas" no están aquí — son las 18 del museo
// (`museo-piezas.mjs`), reaprovechadas tal cual con su propia cartela, porque
// son justo eso: memorias de otros mundos, no invenciones de este pasillo.
//
// LA GUARDIANA NO ES NINGUNA DEIDAD DE UN MANUAL AJENO. Es un personaje
// original de esta ficción —"guardiana de los recuerdos y la memoria del
// multiverso"—, sin nombre ni iconografía de ningún juego, libro o SRD. La
// tentación obvia (una deidad conocida de cuervos y olvido) queda descartada a
// propósito: no está en el SRD 5.1 (CC-BY-4.0) que es el único límite de
// licencia D&D que este módulo admite (ver `npc-tablas.mjs`), así que
// nombrarla o citarla sería la misma frontera que ese módulo ya vigila.
//
// `naturaleza: "obra-propia"` en las dos, y `malla` apunta a una silueta
// GENERADA por `pasillo-guardiana.mjs`, no a un escaneo: no hay ningún archivo
// que buscar en `data/mallas/`.

const PROCEDENCIA_PROPIA = Object.freeze({
  kind: "original",
  source: "Espaciokoop Lagunak: silueta generada por scripts/pasillo-guardiana.mjs",
  license: "GPL-2.0-or-later, como el resto del módulo",
});

export const CATALOGO_PASILLO = Object.freeze({
  formato: "espaciokoop-piezas",
  version: 1,
  piezas: Object.freeze([
    Object.freeze({
      id: "guardiana",
      malla: "guardiana",
      naturaleza: "obra-propia",
      nombre: Object.freeze({
        es: "La Guardiana",
        en: "The Guardian",
      }),
      cartela: Object.freeze({
        es: "No tiene más nombre que este. Vela los recuerdos que el "
          + "multiverso deja caer —mundos que ya no están, gente que nadie "
          + "más recuerda— y los guarda aquí, a los dos lados de un pasillo "
          + "que no termina en ningún muro que hayas visto todavía. Los "
          + "centinelas que la acompañan no hablan: solo miran, para que "
          + "nada de lo guardado se pierda una segunda vez.",
        en: "She has no other name than this. She watches over the memories "
          + "the multiverse lets fall — worlds that are gone, people no one "
          + "else remembers — and keeps them here, on both sides of a "
          + "corridor that has not yet ended at any wall you have seen. Her "
          + "sentinels do not speak: they only watch, so that nothing kept "
          + "here is lost a second time.",
      }),
      provenance: PROCEDENCIA_PROPIA,
    }),
    Object.freeze({
      id: "centinela",
      malla: "centinela",
      naturaleza: "obra-propia",
      nombre: Object.freeze({
        es: "Centinela",
        en: "Sentinel",
      }),
      cartela: Object.freeze({
        es: "Uno de tantos. No custodia una pieza concreta: custodia el "
          + "pasillo entero, y por eso ninguno mira a la memoria que tiene "
          + "al lado.",
        en: "One of many. It does not guard a single piece: it guards the "
          + "whole corridor, and that is why none of them look at the "
          + "memory beside it.",
      }),
      provenance: PROCEDENCIA_PROPIA,
    }),
  ]),
});
