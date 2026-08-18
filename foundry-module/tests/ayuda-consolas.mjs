// Ayuda de pruebas: las consolas de una estancia, con la forma `{rect, puesto}`
// que tenían antes de #582.
//
// Desde #582 una consola no es un campo propio de la estancia sino un punto de
// interacción más (`{id, zona, accion: {tipo: "consola", puesto}}`). Las
// invariantes que ya se comprobaban —que la zona no pisa una puerta, que no cae
// sobre la entrada, que la maquinaria no la encierra— siguen siendo sobre la
// CONSOLA y no sobre cualquier interacción, así que el filtro vive aquí una vez
// en vez de repetirse en cada aserción.

export function consolasDe(estancia) {
  return (estancia?.interacciones ?? [])
    .filter(({ accion }) => accion?.tipo === "consola")
    .map(({ zona, accion }) => ({ rect: zona, puesto: accion.puesto }));
}
