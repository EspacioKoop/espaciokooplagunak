// Datos de ejemplo autocontenidos: el sistema "Argia" usado por defecto por el
// visor standalone. No depende del puente ni de catalogo-cosmografico.mjs, así
// que index.html funciona abriendo la carpeta con un servidor estático cualquiera.
//
// Forma de cada cuerpo (compatible con lo que consume logica.mjs):
//   id, nombre, tipo: "estrella" | "planeta" | "luna" | "planetaEnano"
//   color            -> color base del material
//   radioRelativo    -> escala relativa del cuerpo (1 = terrestre de referencia)
//   orbita: { semiEje, velocidadAngular (rad/s), fase (rad), inclinacion (rad) }
//   anillo           -> booleano (anillos dibujables)
//   lunas            -> [cuerpo...] (opcional)

export const SISTEMA_EJEMPLO = {
  id: "argia",
  nombre: "Sistema Argia",
  cuerpos: [
    {
      id: "argia-a",
      nombre: "Argia",
      tipo: "estrella",
      color: "#ffd27f",
      radioRelativo: 8,
      orbita: { semiEje: 0, velocidadAngular: 0, fase: 0, inclinacion: 0 },
    },
    {
      id: "argia-b",
      nombre: "Bihotz",
      tipo: "planeta",
      color: "#7fb0d9",
      radioRelativo: 1.1,
      orbita: { semiEje: 4.2, velocidadAngular: 0.32, fase: 0.4, inclinacion: 0.05 },
      anillo: false,
      lunas: [
        {
          id: "argia-b1",
          nombre: "Ilaz",
          tipo: "luna",
          color: "#cfcfcf",
          radioRelativo: 0.27,
          orbita: { semiEje: 0.9, velocidadAngular: 1.4, fase: 1.1, inclinacion: 0.2 },
        },
      ],
    },
    {
      id: "argia-c",
      nombre: "Haran",
      tipo: "planeta",
      color: "#d98f5a",
      radioRelativo: 2.4,
      orbita: { semiEje: 7.5, velocidadAngular: 0.18, fase: 2.1, inclinacion: 0.12 },
      anillo: true,
    },
    {
      id: "argia-d",
      nombre: "Zulo",
      tipo: "planetaEnano",
      color: "#9a8fb0",
      radioRelativo: 0.5,
      orbita: { semiEje: 11, velocidadAngular: 0.1, fase: 4.0, inclinacion: 0.3 },
      anillo: false,
    },
  ],
};

// Aplana el sistema a una lista de cuerpos con su "padre" para el render
// (las lunas orbitan a su planeta, no a la estrella). Devuelve { cuerpo, padre }.
export function aplanarSistema(sistema) {
  const salida = [];
  for (const cuerpo of sistema.cuerpos) {
    salida.push({ cuerpo, padre: null });
    for (const luna of cuerpo.lunas ?? []) {
      salida.push({ cuerpo: luna, padre: cuerpo.id });
    }
  }
  return salida;
}
