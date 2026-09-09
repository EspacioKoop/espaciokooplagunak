// Libro 3D interactuable: geometría pura por ángulo de apertura y hoja en vuelo.
// Devuelve {vertices, caras} (caras como cuadriláteros) sin tocar el motor, igual
// que rig-esqueleto.mjs (#603). Consumidor previsto: libro-catalogo.mjs / la escena
// andable, que lo compondrá con componerEscena.
//
// Modelo de bisagra: el lomo está en x=0 (eje z = altura del libro). Cada tapa cuelga
// de la bisagra y se abre en el plano xy. ángulo para cada tapa:
//   α = π/2 − apertura/2
// - apertura = 0  → α = π/2 → tapas verticales y coincidentes en el lomo (cerrado).
// - apertura = π  → α = 0    → tapas en el plano xz, una a cada lado (abierto plano).
// La hoja gira desde la tapa izquierda (hojaVuelo = 0) hasta la derecha (hojaVuelo = apertura),
// siempre levantada grosor sobre las tapas para no coincidir salvo en los extremos.
//
// PRESUPUESTO (medido 2026-08-29, psx, Node puro sin pintor, por libro y cualquier
// estado de apertura/hoja):
//   vértices 32, caras 24 (cuadriláteros = 48 triángulos).
//   Esto es ~3.3 % de la sala más cara medida en #551 (~1466 polígonos); un libro
//   por estancia cabe sobradamente. El coste real estará en el ORDEN DE CARAS (#510)
//   cuando dos caras tocan el lomo (hojaVuelo∈{0, apertura} las deja coplanares con su
//   tapa): se documenta, no se reintenta aquí.
//
// No importa nada del motor (retro3d, paleta, nave-*): puro, sin Foundry, DOM, red,
// reloj ni Math.random(). Probado desde Node.

/**
 * Crea una malla de libro con dos tapas, lomo y una hoja que gira.
 * @param {number} apertura - Ángulo entre las tapas (radianes, 0 = cerrado, π = abierto plano).
 * @param {number} hojaVuelo - Ángulo de la hoja respecto de la tapa izquierda (radianes,
 *   0 = hoja sobre la tapa izquierda, apertura = hoja sobre la tapa derecha).
 * @param {number} [ancho=0.2] - Ancho de cada tapa (m).
 * @param {number} [alto=0.15] - Alto del libro (m).
 * @param {number} [grosor=0.02] - Grosor de cada tapa (m).
 * @returns {{vertices: number[][], caras: number[][]}} malla lista para componerEscena.
 */
export function libroGeometria(apertura, hojaVuelo, ancho = 0.2, alto = 0.15, grosor = 0.02) {
  if (!Number.isFinite(apertura) || !Number.isFinite(hojaVuelo)) {
    throw new TypeError("libroGeometria requiere apertura y hojaVuelo finitos");
  }
  if (!(ancho > 0) || !(alto > 0) || !(grosor > 0)) {
    throw new RangeError("libroGeometria requiere ancho, alto y grosor estrictamente positivos");
  }

  const alfa = Math.PI / 2 - apertura / 2;
  const beta = Math.PI / 2 - hojaVuelo;
  const partes = [];

  // Tapas: cuelgan de la bisagra (x=0) a lados opuestos; se abren con el mismo α.
  const tapaIzq = cajaBisagrada(ancho, alto, grosor, -1);
  const tapaDer = cajaBisagrada(ancho, alto, grosor, +1);
  partes.push(transformar(tapaIzq, alfa, 0));
  partes.push(transformar(tapaDer, alfa, 0));

  // Lomo: caja fina en el eje x=0 que une las tapas a lo largo de z.
  const lomo = cajaBisagrada(grosor, alto, grosor * 2, 0);
  partes.push(transformar(lomo, 0, 0));

  // Hoja: página sobre la tapa izquierda (lado -1), levantada grosor para no coincidir.
  const hoja = cajaBisagrada(ancho, alto, grosor / 2, -1);
  partes.push(transformar(hoja, beta, grosor));

  let vertices = [];
  let caras = [];
  let offset = 0;
  for (const parte of partes) {
    vertices = vertices.concat(parte.vertices);
    for (const cara of parte.caras) {
      caras.push(cara.map((i) => i + offset));
    }
    offset += parte.vertices.length;
  }

  return { vertices, caras };
}

/** Rotación en torno al eje z (bisagra del libro, eje x=0). */
function rotacionZ([x, y, z], angulo) {
  const c = Math.cos(angulo);
  const s = Math.sin(angulo);
  return [x * c - y * s, x * s + y * c, z];
}

function trasladar([x, y, z], [dx, dy, dz]) {
  return [x + dx, y + dy, z + dz];
}

/**
 * Placa fina con la bisagra en x=0.
 * @param {number} ancho - Largo de la placa a lo largo de x.
 * @param {number} alto - Largo a lo largo de z.
 * @param {number} grosor - Grosor a lo largo de y.
 * @param {-1|0|1} lado - -1 ocupa x∈[-ancho,0]; +1 x∈[0,ancho]; 0 centrada en x=0.
 */
function cajaBisagrada(ancho, alto, grosor, lado) {
  // Bisagra siempre en x=0; el borde libre queda en x = lado*ancho, salvo el
  // lomo (lado=0) que se centra en el eje para unir las tapas.
  const lo = lado === 0 ? -ancho / 2 : 0;
  const hi = lado === 0 ? ancho / 2 : lado * ancho;
  const hy = grosor / 2;
  const hz = alto / 2;
  const vertices = [
    [lo, -hy, -hz], [hi, -hy, -hz], [hi, hy, -hz], [lo, hy, -hz],
    [lo, -hy, hz], [hi, -hy, hz], [hi, hy, hz], [lo, hy, hz],
  ];
  const caras = [
    [0, 1, 2, 3], // atrás (-z)
    [4, 5, 6, 7], // adelante (+z)
    [0, 1, 5, 4], // abajo (-y)
    [3, 2, 6, 7], // arriba (+y)
    [0, 3, 7, 4], // bisagra (-x)
    [1, 2, 6, 5], // borde libre (+x)
  ];
  return { vertices, caras };
}

function transformar(parte, anguloZ, empujeY) {
  return {
    vertices: parte.vertices.map((v) => trasladar(rotacionZ(v, anguloZ), [0, empujeY, 0])),
    caras: parte.caras,
  };
}
