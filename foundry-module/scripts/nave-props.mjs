// Vocabulario de props low-poly de la nave (#579).
//
// Hasta aquí, todo mueble del módulo era una CAJA: `cantina-escena.mjs`
// declara sus 126 piezas como `{centro, medidas}` y la fábrica de salas las
// dibuja con `caja(...)`. Para una barra, una estantería o un conducto eso es
// exactamente lo correcto —son cajas de verdad— y no hay nada que arreglar.
//
// Deja de serlo en cuanto el objeto tiene una SILUETA. Una silla-caja no se lee
// como silla ni con la mejor de las paletas: lo que hace reconocible una silla a
// diez metros y con cuatro tonos es el hueco entre el asiento y el respaldo, y
// las patas. La estética retro no obliga a que todo sea un cubo — la máquina de
// referencia hacía sillas con una docena de polígonos; lo que no podía era
// gastarlos en curvas.
//
// De ahí este archivo, y de ahí que sea un VOCABULARIO y no la geometría de una
// terraza concreta. La regla es la misma que impuso #550 con la rejilla de
// chapa: si cada espacio nuevo modela sus muebles a medida, la nave acaba siendo
// un decorado de piezas de distintas escalas. Una silla mide lo que mide una
// silla, aquí y en el siguiente espacio que la use.
//
// ## Qué devuelve cada prop
//
// Una lista de piezas en el MISMO formato que ya acepta `crearSalaCaja` como
// `mobiliario` —`{centro, medidas, color}`— con un campo más: `malla`. Con él,
// la fábrica dibuja esa malla en vez de la caja implícita, y sin él nada cambia
// para las 126 piezas que ya existen. `centro`/`medidas` siguen haciendo falta
// aunque haya malla: son la HUELLA con la que la fábrica deriva la colisión, y
// una silla debe estorbar como un bulto simple y no polígono a polígono.
//
// Puro: geometría y nada más. Ni Foundry, ni DOM, ni paleta propia —los colores
// entran desde fuera, que es la frontera de #351.

/**
 * Prisma de perfil variable: un polígono en el plano X/Z extruido entre dos
 * alturas, y con la posibilidad de que arriba sea más estrecho que abajo. Es la
 * única primitiva que hace falta para todo lo que hay aquí — una pata que
 * afina, un tablero octogonal, una caña que se estrecha hacia la punta.
 *
 * El perfil va en el mismo sentido que las caras de `caja` (horario visto desde
 * arriba): así las caras salen antihorarias vistas desde fuera, que es lo que
 * `componerEscena` necesita para descartar las de espaldas.
 *
 * @param {Array<[number,number]>} perfil - vértices [x, z] de la base.
 * @param {number} y0 - altura de la base.
 * @param {number} y1 - altura de la tapa.
 * @param {number} [escalaSuperior] - cuánto encoge el perfil arriba, sobre su
 *   propio centro. 1 es un prisma recto.
 */
export function prisma(perfil, y0, y1, escalaSuperior = 1) {
  const n = perfil.length;
  const cx = perfil.reduce((s, p) => s + p[0], 0) / n;
  const cz = perfil.reduce((s, p) => s + p[1], 0) / n;
  const abajo = perfil.map(([x, z]) => [x, y0, z]);
  const arriba = perfil.map(([x, z]) => [
    cx + (x - cx) * escalaSuperior,
    y1,
    cz + (z - cz) * escalaSuperior,
  ]);
  const vertices = [...abajo, ...arriba];

  const caras = [
    // Tapa en el orden del perfil; base al revés, porque se mira desde debajo.
    perfil.map((_, i) => n + i),
    perfil.map((_, i) => n - 1 - i),
  ];
  for (let i = 0; i < n; i += 1) {
    const j = (i + 1) % n;
    caras.push([i, j, n + j, n + i]);
  }
  return { vertices, caras };
}

/** Rectángulo como perfil, listo para `prisma`. */
export function perfilRect(cx, cz, ancho, fondo) {
  const x = ancho / 2;
  const z = fondo / 2;
  return [
    [cx - x, cz - z],
    [cx - x, cz + z],
    [cx + x, cz + z],
    [cx + x, cz - z],
  ];
}

/**
 * Polígono regular como perfil. `lados` es el mando de presupuesto: un tablero
 * de mesa se lee redondo con seis, y con veinte solo se gastan polígonos que a
 * esta resolución nadie distingue.
 */
export function perfilPoligono(cx, cz, radio, lados = 8, giro = 0) {
  return Array.from({ length: lados }, (_, i) => {
    // Signo negativo: recorre en horario visto desde arriba, como pide `prisma`.
    const a = giro - (i * 2 * Math.PI) / lados;
    return [cx + Math.cos(a) * radio, cz + Math.sin(a) * radio];
  });
}

/** Une varias mallas en una, reindexando. Cada prop es una sola malla. */
export function fundirMallas(mallas) {
  const vertices = [];
  const caras = [];
  for (const malla of mallas) {
    const base = vertices.length;
    vertices.push(...malla.vertices);
    caras.push(...malla.caras.map((cara) => cara.map((i) => i + base)));
  }
  return { vertices, caras };
}

/** Gira una malla alrededor del eje Y (vertical) sobre un punto del suelo. */
export function girarMalla(malla, yaw, [cx, cz] = [0, 0]) {
  const cos = Math.cos(yaw);
  const sen = Math.sin(yaw);
  return {
    ...malla,
    vertices: malla.vertices.map(([x, y, z]) => {
      const dx = x - cx;
      const dz = z - cz;
      return [cx + dx * cos - dz * sen, y, cz + dx * sen + dz * cos];
    }),
  };
}

/** Inclina una malla sobre el eje X, alrededor de un punto. Para un respaldo. */
export function inclinarMalla(malla, pitch, [cy, cz] = [0, 0]) {
  const cos = Math.cos(pitch);
  const sen = Math.sin(pitch);
  return {
    ...malla,
    vertices: malla.vertices.map(([x, y, z]) => {
      const dy = y - cy;
      const dz = z - cz;
      return [x, cy + dy * cos - dz * sen, cz + dy * sen + dz * cos];
    }),
  };
}

/** Caja envolvente de una malla, que es lo que la fábrica usa para colisionar. */
export function envolvente(malla) {
  const ejes = [0, 1, 2].map((i) => {
    const valores = malla.vertices.map((v) => v[i]);
    return { min: Math.min(...valores), max: Math.max(...valores) };
  });
  return {
    centro: ejes.map((e) => (e.min + e.max) / 2),
    medidas: ejes.map((e) => e.max - e.min),
  };
}

/**
 * Envuelve una malla como pieza de `mobiliario`. La huella de colisión sale de
 * su envolvente y no se escribe a mano: dibujo y colisión de la misma
 * declaración, que es la lección de la cantina (#540).
 */
export function pieza(malla, color, opciones = {}) {
  return { malla, color, ...envolvente(malla), ...opciones };
}

// ---- El vocabulario --------------------------------------------------------

/** Alto de asiento de serie. Una silla mide lo que mide una silla. */
export const ALTO_ASIENTO = 0.45;
/** Alto de una mesa de sentarse. */
export const ALTO_MESA = 0.74;

/**
 * Silla: asiento, respaldo inclinado y cuatro patas que afinan hacia abajo.
 *
 * Las patas afinan porque es lo que separa una silla de cuatro palos: cuestan
 * lo mismo (un prisma de cuatro lados es un prisma de cuatro lados) y dan la
 * lectura. El respaldo va inclinado por la misma razón — una silla con el
 * respaldo a plomo se lee como un retrete.
 *
 * `yaw` la gira sobre su propio centro: una mesa con cuatro sillas encaradas
 * hacia ella necesita las cuatro iguales y giradas, no cuatro modelos.
 */
export function silla({ x, z, yaw = 0, color, colorRespaldo = color }) {
  const lado = 0.42;
  const grosorPata = 0.05;
  const sangrado = lado / 2 - grosorPata / 2 - 0.03;

  const patas = [
    [-1, -1], [1, -1], [1, 1], [-1, 1],
  ].map(([sx, sz]) =>
    prisma(
      perfilRect(x + sx * sangrado, z + sz * sangrado, grosorPata, grosorPata),
      0,
      ALTO_ASIENTO - 0.05,
      // Afinan hacia ABAJO, así que el prisma se construye del revés: se gira
      // después. Más simple: la escala superior es mayor que 1 y la base es la
      // punta, que es justo lo que se quiere.
      1.6,
    ),
  );

  const asiento = prisma(perfilRect(x, z, lado, lado), ALTO_ASIENTO - 0.05, ALTO_ASIENTO);

  // El respaldo nace del borde trasero del asiento y se inclina hacia atrás.
  const traseroZ = z + lado / 2 - 0.03;
  const respaldo = inclinarMalla(
    prisma(perfilRect(x, traseroZ, lado * 0.92, 0.045), ALTO_ASIENTO, ALTO_ASIENTO + 0.42),
    // Positivo: la parte alta cae HACIA ATRÁS (+z, el lado del respaldo). Con el
    // signo contrario el respaldo se echa sobre quien se sienta.
    0.14,
    [ALTO_ASIENTO, traseroZ],
  );

  const cuerpo = girarMalla(fundirMallas([...patas, asiento]), yaw, [x, z]);
  const respaldoGirado = girarMalla(respaldo, yaw, [x, z]);
  return [pieza(cuerpo, color), pieza(respaldoGirado, colorRespaldo, { colision: false })];
}

/**
 * Mesa de pie central: tablero poligonal, columna y base. Una mesa de cuatro
 * patas cuesta el doble y estorba a las sillas, que es justo lo que no se
 * quiere en una terraza donde además se anda.
 */
export function mesa({ x, z, radio = 0.55, color, colorPie = color }) {
  const tablero = prisma(perfilPoligono(x, z, radio, 8), ALTO_MESA - 0.05, ALTO_MESA);
  const columna = prisma(perfilPoligono(x, z, 0.07, 6), 0.04, ALTO_MESA - 0.05);
  const base = prisma(perfilPoligono(x, z, radio * 0.55, 8), 0, 0.04, 0.9);
  return [pieza(fundirMallas([base, columna]), colorPie), pieza(tablero, color)];
}

/**
 * Caña de pescar: un prisma que afina de la empuñadura a la punta, con el puño
 * marcado. Tumbada sobre `yaw` e inclinada hacia arriba por `alzado`.
 *
 * Es un PROP reutilizable y no geometría pegada al escenario: el minijuego de
 * pesca tendrá que poder ponerla en las manos de alguien, y para eso hace falta
 * que la caña exista como pieza y no como un trazo pintado en la terraza.
 */
export function cana({ x, z, base = 0, largo = 1.9, yaw = 0, alzado = 0.9, color }) {
  const cuerpo = prisma(perfilRect(x, z, 0.035, 0.035), base + 0.18, base + largo, 0.25);
  const puno = prisma(perfilRect(x, z, 0.05, 0.05), base, base + 0.18, 0.95);
  const tumbada = inclinarMalla(fundirMallas([puno, cuerpo]), -(Math.PI / 2 - alzado), [base, z]);
  // No estorba: una caña apoyada en su soporte no es un obstáculo que separe
  // zonas del suelo andable, y hacerla colisionar partiría la terraza en dos.
  return [pieza(girarMalla(tumbada, yaw, [x, z]), color, { colision: false })];
}

/**
 * Soporte de cañas: base, dos postes y un travesaño con las cañas apoyadas.
 *
 * Que las cañas vivan en un soporte y no en el suelo no es decoración: es la
 * decisión de que el futuro minijuego sea «interactuar con el puesto de pesca →
 * se asigna una caña», y no «recoger un objeto». Así la primera versión de la
 * pesca no arrastra un sistema de inventario.
 */
export function soporteCanas({ x, z, yaw = 0, ancho = 1.1, color, colorCana = color }) {
  const alto = 1.15;
  const postes = [-1, 1].map((s) =>
    prisma(perfilRect(x + (s * ancho) / 2, z, 0.07, 0.07), 0, alto, 0.8),
  );
  const travesano = prisma(perfilRect(x, z, ancho, 0.06), alto - 0.1, alto);
  const base = prisma(perfilRect(x, z, ancho + 0.2, 0.28), 0, 0.06);
  const armazon = girarMalla(fundirMallas([base, ...postes, travesano]), yaw, [x, z]);

  // Tres cañas, de largos ligeramente distintos: son aparejo de a bordo, no un
  // expositor de tienda. Se construyen sin girar y se gira el CONJUNTO sobre el
  // centro del soporte: girando cada una sobre su propio pie, el reparto a lo
  // largo del travesaño se quedaría mirando al norte con el soporte ya girado.
  const canas = [-0.3, 0, 0.3]
    .flatMap((desplazamiento, i) =>
      cana({ x: x + desplazamiento, z, largo: 1.75 + i * 0.12, alzado: 1.15, color: colorCana }),
    )
    .map((p) => pieza(girarMalla(p.malla, yaw, [x, z]), p.color, { colision: false }));

  return [pieza(armazon, color), ...canas];
}

/**
 * Barandilla: un pasamanos continuo sobre balaustres, a lo largo de un tramo.
 *
 * Existe por seguridad de LECTURA, no de simulación: el borde de una terraza
 * abierta al espacio tiene que verse como un borde. Sin ella, el suelo
 * simplemente se acaba y eso se lee como geometría rota.
 */
export function barandilla({ x, z, largo, eje = "x", color, alto = 0.95 }) {
  const alongX = eje === "x";
  const grosor = 0.06;
  const paso = 0.55;
  const cuantos = Math.max(2, Math.round(largo / paso));
  const balaustres = Array.from({ length: cuantos + 1 }, (_, i) => {
    const d = -largo / 2 + (i * largo) / cuantos;
    const px = alongX ? x + d : x;
    const pz = alongX ? z : z + d;
    return prisma(perfilRect(px, pz, grosor * 0.7, grosor * 0.7), 0, alto - grosor);
  });
  const pasamanos = prisma(
    alongX ? perfilRect(x, z, largo, grosor * 1.6) : perfilRect(x, z, grosor * 1.6, largo),
    alto - grosor,
    alto,
  );
  return [pieza(fundirMallas([...balaustres, pasamanos]), color)];
}
