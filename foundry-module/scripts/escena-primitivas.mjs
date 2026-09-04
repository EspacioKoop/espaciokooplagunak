// Las formas con las que se construye TODO lo 3D del módulo (#589).
//
// POR QUÉ EXISTE. `caja` estaba copiada tres veces —`cantina-escena.mjs`,
// `minijuegos/poker-3d.mjs`, `minijuegos/blackjack-3d.mjs`— y la playa la
// importaba de la cantina, o sea, un exterior dependiendo del bar de la nave.
// Con una escena más generada, esa copia se vuelve cuatro. Es el mismo problema
// que #550 declaró inaceptable para la piel: si cada superficie elige su tamaño
// de detalle, la nave parece montada con piezas de tres maquetas.
//
// Y HAY UNA RAZÓN MÁS FUERTE QUE LA DUPLICACIÓN. Todo el módulo se dibujaba con
// cajas, y una caja es un prisma de CUATRO lados: un poste de madera salía con
// cuatro aristas vivas y se leía como una viga; un conducto de reactor, como un
// pilar cuadrado; el pie de una mesa, como un ladrillo. Cuatro lados es el único
// número que no puede parecer redondo. Con ocho —y algo de conicidad— la misma
// pieza pasa a leerse como lo que dice ser, y cuesta unas pocas caras.
//
// No es «más polígonos, más realismo». Es que faltaba la forma.
//
// TODAS DEVUELVEN `{vertices, caras}`, la malla que consume `componerEscena`.
// Las caras van en sentido ANTIHORARIO VISTAS DESDE FUERA, que es lo que el
// motor necesita para descartar las de espaldas: una cara con el bobinado al
// revés no se dibuja mal, no se dibuja. Pasó de verdad —la ladera de la duna
// desapareció entera y solo quedaron sus rizos flotando sobre el cielo— y por
// eso las primitivas se escriben una vez, aquí, con su prueba.
//
// Puras: ni Foundry, ni DOM, ni color. El color lo pone quien las usa.

/**
 * Cuántos metros mide un lado de la textura de un material.
 *
 * ESTA CONSTANTE ES LA QUE HACE QUE EL GRANO SEA GRANO. Con UV de 0 a 1 por cara
 * —que es lo que sale solo— la misma imagen se estira sobre la cara sea cual sea
 * su tamaño: la veta de un tablón de tres metros saldría con el mismo número de
 * rayas que la de un listón de diez centímetros, o sea treinta veces más gorda.
 * Y el ojo lee ESO antes que ninguna otra cosa, porque el tamaño del grano es
 * como se estima el tamaño de un objeto cuando no hay nada al lado para
 * comparar.
 *
 * Midiendo las UV en metros, la textura TILEA a densidad constante y una pieza
 * grande simplemente enseña más repeticiones. Es lo que `muestrearTextura` ya
 * permite: envuelve con módulo, así que una `u` de 7,3 es perfectamente válida.
 */
export const METROS_POR_TEXTURA = 0.5;

/**
 * Una caja alineada con los ejes, por su centro y sus medidas.
 *
 * La forma de trabajo de casi todo el módulo, y sigue siendo la correcta para lo
 * que de verdad es una caja: un armario, un cajón de registro, un tablero.
 */
export function caja([cx, cy, cz], [ancho, alto, fondo], { metrosPorTextura = METROS_POR_TEXTURA } = {}) {
  const x = ancho / 2;
  const y = alto / 2;
  const z = fondo / 2;
  const vertices = [
    [cx - x, cy - y, cz - z],
    [cx + x, cy - y, cz - z],
    [cx + x, cy + y, cz - z],
    [cx - x, cy + y, cz - z],
    [cx - x, cy - y, cz + z],
    [cx + x, cy - y, cz + z],
    [cx + x, cy + y, cz + z],
    [cx - x, cy + y, cz + z],
  ];
  const caras = [
    [0, 3, 2, 1], // frente (−z)
    [4, 5, 6, 7], // fondo (+z)
    [0, 4, 7, 3], // izquierda
    [1, 2, 6, 5], // derecha
    [3, 7, 6, 2], // techo
    [0, 1, 5, 4], // suelo
  ];
  return { vertices, caras, uvs: uvsDeCaja(ancho, alto, fondo, metrosPorTextura) };
}


/**
 * Una caja girada sobre su eje vertical, por su centro, sus medidas y su rumbo.
 *
 * POR QUÉ HACE FALTA. `caja` está alineada con los ejes, que es lo correcto para
 * un armario atornillado a un mamparo: los muebles de una nave no están
 * torcidos. Pero una PERSONA sí gira, y hasta que existió esto no había forma de
 * dibujar a nadie mirando a donde va — la limitación que `nave-avatares-render.mjs`
 * declaró y aparcó, porque girar exigía «rotar la malla entera por vértice antes
 * de proyectarla».
 *
 * Resulta que rotar por vértice es esto: ocho puntos y dos multiplicaciones cada
 * uno. Lo caro nunca fue la rotación, era no tener dónde ponerla.
 *
 * MISMO CONVENIO QUE EL MOVIMIENTO. `yaw = 0` mira a +z y el avance es
 * `(sen yaw, cos yaw)` en (x, z), igual que `moverXZ` en `nave-movimiento.mjs`.
 * Así el rumbo que viaja por la red se puede pasar aquí tal cual, sin invertir
 * ningún signo — y un signo invertido en un giro es de los errores que se ven
 * pero no se leen.
 *
 * LAS UV NO GIRAN. Se calculan igual que en `caja`, porque cada cara sigue
 * midiendo lo que medía: girar una pieza no cambia el tamaño de su grano, que es
 * lo que `METROS_POR_TEXTURA` protege. Girar también las UV haría que el mismo
 * tablón enseñara distinta densidad de veta según hacia dónde mire.
 */
export function cajaGirada([cx, cy, cz], [ancho, alto, fondo], yaw = 0, { metrosPorTextura = METROS_POR_TEXTURA } = {}) {
  const plana = caja([0, 0, 0], [ancho, alto, fondo], { metrosPorTextura });
  if (!Number.isFinite(yaw) || yaw === 0) {
    return {
      ...plana,
      vertices: plana.vertices.map(([x, y, z]) => [x + cx, y + cy, z + cz]),
    };
  }
  const sen = Math.sin(yaw);
  const cos = Math.cos(yaw);
  return {
    ...plana,
    // Giro sobre el centro de la propia caja y DESPUÉS traslación: al revés
    // sería una caja orbitando el origen de la sala, que es el mismo error que
    // `cantina-escena.mjs` documenta para la cámara.
    vertices: plana.vertices.map(([x, y, z]) => [
      cx + x * cos + z * sen,
      cy + y,
      cz - x * sen + z * cos,
    ]),
  };
}

/**
 * Las UV de una caja, una por cara y medidas en metros.
 *
 * Cada cara toma como ejes de la textura sus dos dimensiones REALES, no un
 * cuadrado normalizado: la cara frontal se mide en (ancho, alto), la lateral en
 * (fondo, alto) y las horizontales en (ancho, fondo). Así una caja larga y baja
 * enseña la textura estirada a lo largo, que es lo que se ve en un tablón, y no
 * una imagen deformada.
 */
export function uvsDeCaja(ancho, alto, fondo, metrosPorTextura = METROS_POR_TEXTURA) {
  const u = (metros) => Math.abs(metros) / metrosPorTextura;
  const [a, h, f] = [u(ancho), u(alto), u(fondo)];
  const rect = (ancho2, alto2) => [
    [0, alto2],
    [0, 0],
    [ancho2, 0],
    [ancho2, alto2],
  ];
  return [
    rect(a, h), // frente
    rect(a, h), // fondo
    rect(f, h), // izquierda
    rect(f, h), // derecha
    rect(a, f), // techo
    rect(a, f), // suelo
  ];
}

/**
 * Un prisma de `lados` caras, opcionalmente afilado hacia arriba.
 *
 * Se apoya en `centro` —que es su base, no su centro de masas— porque colocar
 * algo que se planta en el suelo es decir dónde toca el suelo, no dónde está su
 * mitad.
 *
 * `radioArriba` distinto de `radioAbajo` da conicidad: un poste que se estrecha,
 * una boya que se afila, y con radio cero arriba, un cono entero. Es el mismo
 * generador porque son la misma forma con otro número.
 *
 * OCHO LADOS DE SERIE. Con seis todavía se cuentan las aristas; con doce ya no se
 * gana nada visible y se paga en caras. Ocho es donde una pieza se lee como
 * redonda conservando las facetas de la época, que es exactamente el criterio con
 * el que se eligió la resolución de la esfera.
 */
export function prisma(
  [cx, cy, cz],
  {
    radioAbajo,
    radioArriba = radioAbajo,
    alto,
    lados = 8,
    giro = 0,
    tapaAbajo = false,
    eje = "y",
    metrosPorTextura = METROS_POR_TEXTURA,
  },
) {
  // EL EJE PUEDE NO SER VERTICAL. Un poste, un pie de mesa o un tiesto crecen
  // hacia arriba, pero un tronco tumbado en la arena y la manga de un
  // aeródromo no: se tumban. Sin esto, la manga de viento salía de pie como un
  // farol y dejaba de decir hacia dónde sopla, que era su único trabajo.
  const colocar = (a, b, largo) => {
    if (eje === "x") return [cx + largo, cy + b, cz + a];
    if (eje === "z") return [cx + a, cy + b, cz + largo];
    return [cx + a, cy + largo, cz + b];
  };
  const vertices = [];
  for (const [nivel, radio] of [
    [0, radioAbajo],
    [alto, radioArriba],
  ]) {
    for (let j = 0; j < lados; j += 1) {
      const t = giro + (j / lados) * 2 * Math.PI;
      vertices.push(colocar(radio * Math.cos(t), radio * Math.sin(t), nivel));
    }
  }
  const caras = [];
  for (let j = 0; j < lados; j += 1) {
    const k = (j + 1) % lados;
    // Hacia AFUERA: subiendo por el vértice j y bajando por el k. Al revés, el
    // prisma se dibuja del revés —se le ve el interior y desaparece su
    // silueta—, que es el mismo fallo que borró la ladera de la duna.
    caras.push([j, lados + j, lados + k, k]);
  }
  // La tapa de arriba se cierra. La de abajo, solo si se pide: lo que se planta
  // en el suelo se apoya y no la enseña nunca, y una cara que no se ve es una
  // cara que se paga por nada. Una ficha tumbada sobre una mesa sí la necesita.
  caras.push(Array.from({ length: lados }, (_, j) => lados + (lados - 1 - j)));
  if (tapaAbajo) caras.push(Array.from({ length: lados }, (_, j) => j));

  // Las UV del costado, medidas en metros como las de la caja: `u` recorre el
  // PERÍMETRO y `v` la altura, que es como se envuelve una etiqueta en una lata.
  // Un poste alto enseña más repeticiones a lo largo; uno gordo, más a lo ancho.
  const perimetro = 2 * Math.PI * Math.max(radioAbajo, radioArriba);
  const paso = perimetro / lados / metrosPorTextura;
  const v1 = Math.abs(alto) / metrosPorTextura;
  const uvs = [];
  for (let j = 0; j < lados; j += 1) {
    const u0 = j * paso;
    uvs.push([
      [u0, 0],
      [u0, v1],
      [u0 + paso, v1],
      [u0 + paso, 0],
    ]);
  }
  // Las tapas se resuelven con un cuadrado del tamaño del prisma: son pequeñas y
  // casi siempre se ven de canto, así que no compensa proyectarlas en polar.
  const lado = ((radioArriba * 2) / metrosPorTextura) || 1;
  const tapa = Array.from({ length: lados }, (_, j) => {
    const t = (j / lados) * 2 * Math.PI;
    return [((Math.cos(t) + 1) / 2) * lado, ((Math.sin(t) + 1) / 2) * lado];
  });
  uvs.push(tapa);
  if (tapaAbajo) uvs.push(tapa);
  return { vertices, caras, uvs };
}

/**
 * Una esfera facetada.
 *
 * POCOS MERIDIANOS A PROPÓSITO. El motor sombrea plano por cara, así que lo que
 * hace que una esfera gire es la escalera de tonos entre facetas: con demasiadas
 * la escalera desaparece y queda un disco liso. Ocho por seis es donde se lee
 * como esfera y todavía tiene facetas, que es el aspecto de la época.
 */
export function esfera([cx, cy, cz], radio, meridianos = 8, paralelos = 6) {
  const vertices = [];
  const caras = [];
  for (let i = 0; i <= paralelos; i += 1) {
    const phi = (i / paralelos) * Math.PI;
    for (let j = 0; j < meridianos; j += 1) {
      const theta = (j / meridianos) * 2 * Math.PI;
      vertices.push([
        cx + radio * Math.sin(phi) * Math.cos(theta),
        cy + radio * Math.cos(phi),
        cz + radio * Math.sin(phi) * Math.sin(theta),
      ]);
    }
  }
  const indice = (i, j) => i * meridianos + (j % meridianos);
  for (let i = 0; i < paralelos; i += 1) {
    for (let j = 0; j < meridianos; j += 1) {
      caras.push([indice(i, j), indice(i + 1, j), indice(i + 1, j + 1), indice(i, j + 1)]);
    }
  }
  return { vertices, caras };
}

/** Un anillo plano —inclinable— alrededor de un centro. */
export function anillo([cx, cy, cz], interior, exterior, lados = 16, inclinacion = 0.22) {
  const vertices = [];
  const caras = [];
  for (let j = 0; j < lados; j += 1) {
    const t = (j / lados) * 2 * Math.PI;
    const [co, si] = [Math.cos(t), Math.sin(t)];
    for (const r of [interior, exterior]) {
      vertices.push([cx + r * co, cy + r * si * inclinacion, cz + r * si]);
    }
  }
  for (let j = 0; j < lados; j += 1) {
    caras.push([(j * 2) % (lados * 2), (j * 2 + 1) % (lados * 2), (j * 2 + 3) % (lados * 2), (j * 2 + 2) % (lados * 2)]);
  }
  return { vertices, caras };
}

/**
 * Un cuadrilátero horizontal a la altura `y`, por sus esquinas en planta.
 *
 * Para todo lo que va pegado al suelo y no tiene grosor que enseñar: una sombra
 * proyectada, un reflejo, una mancha de humedad. Los puntos se dan en orden
 * antihorario visto desde arriba.
 */
export function losa(puntos, y) {
  return {
    vertices: puntos.map(([px, pz]) => [px, y, pz]),
    caras: [[0, 1, 2, 3]],
  };
}

/**
 * Una superficie de cuatro esquinas a alturas cualesquiera.
 *
 * Es la que permite una pendiente DE VERDAD en vez de una escalera de losas
 * horizontales. La duna de la playa fueron terrazas hasta que se vio de cerca:
 * seis centímetros de escalón no se ven de frente, pero de canto y a ras de
 * suelo se alinean y aquello se lee como una escalinata de piedra.
 */
export function rampa([a, b, c, d]) {
  return { vertices: [a, b, c, d], caras: [[0, 1, 2, 3]] };
}

/** Traslada una malla. */
export function trasladar(malla, [dx, dy, dz]) {
  return { ...malla, vertices: malla.vertices.map(([x, y, z]) => [x + dx, y + dy, z + dz]) };
}

/**
 * Un disco extruido, centrado en su grosor: la ficha de los minijuegos.
 *
 * Estaba escrito dos veces —`poker-3d.mjs` y `blackjack-3d.mjs`— y era, sin
 * decirlo, un `prisma` de N lados. Es el caso que mejor resume por qué existe
 * este módulo: la forma que le faltaba al resto del módulo llevaba meses
 * escrita, escondida dentro de una ficha de póker.
 *
 * Se centra en `y` y no se apoya en la base, a diferencia de `prisma`, porque
 * una ficha se tumba sobre una mesa y lo que se coloca es su centro. Cambiarlo
 * movería todas las fichas de sitio para no ganar nada.
 */
export function disco({ radio = 0.3, grosor = 0.16, lados = 10 } = {}) {
  return prisma([0, -grosor / 2, 0], { radioAbajo: radio, alto: grosor, lados, tapaAbajo: true });
}

/* ---- UV para malla importada ---------------------------------------------- */

/** La normal de una cara, para decidir a qué plano mira. */
function normalDeCara(vertices, cara) {
  const [a, b, c] = cara.map((i) => vertices[i]);
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
  const largo = Math.hypot(...n) || 1;
  return n.map((k) => k / largo);
}

/**
 * UV por proyección TRIPLANAR: cada cara se proyecta sobre el plano al que más
 * mira.
 *
 * ES LA VÍA GENERAL PARA MALLA IMPORTADA (#590), y se eligió comparándola con
 * las otras dos en una hoja de contactos. Una malla de fuera no trae UV, así que
 * hay que inventárselas, y hay tres maneras:
 *
 *  - PLANA, como una diapositiva sobre un plano fijo: tres líneas, y se estira
 *    hasta el borrón en todo lo que mire de lado. En una figura de bulto, la
 *    mitad de la superficie.
 *  - CILÍNDRICA, envolviendo el eje vertical: perfecta para una columna o un
 *    ánfora —cuerpos de revolución—, y hay que coser la costura a mano. En algo
 *    que no es un cilindro aprieta el patrón donde la pieza se estrecha.
 *  - TRIPLANAR: no se estira en ningún sitio, no hay costura que coser, y no
 *    supone nada sobre la forma de la pieza. El precio es una junta visible
 *    donde dos caras vecinas eligen ejes distintos, que a la escala de téxel de
 *    este motor se confunde con la propia facetación.
 *
 * La escala va en metros, igual que en la caja y el prisma: el grano tiene que
 * medir lo mismo en una estatua que en un tablón, o la escena se lee a dos
 * tamaños distintos a la vez.
 */
export function uvsTriplanar({ vertices, caras }, metrosPorTextura = METROS_POR_TEXTURA) {
  return caras.map((cara) => {
    const n = normalDeCara(vertices, cara).map(Math.abs);
    // A qué plano mira más: se descarta el eje dominante y se proyecta sobre los
    // otros dos, que es exactamente lo que evita el estirado.
    const eje = n[0] >= n[1] && n[0] >= n[2] ? 0 : n[1] >= n[2] ? 1 : 2;
    const [a, b] = eje === 0 ? [2, 1] : eje === 1 ? [0, 2] : [0, 1];
    return cara.map((i) => [vertices[i][a] / metrosPorTextura, vertices[i][b] / metrosPorTextura]);
  });
}

/**
 * La malla de una pieza de avatar, sea caja o no.
 *
 * Las piezas de un avatar viajan como `{color, centro, medidas}` y sus cuatro
 * consumidores las convertían en geometría con `caja`/`cajaGirada`. Eso deja
 * fuera cualquier objeto que no sea un ortoedro: una espada con punta, un
 * báculo torneado, cualquier cosa con `prisma`. Aceptar aquí una `malla` ya
 * hecha —en coordenadas del objeto, con su centro en el origen— abre esa puerta
 * sin tocar ni una pieza de las que ya existen: sin `malla`, esto es
 * exactamente `cajaGirada` y no cambia nada.
 *
 * El orden importa y es el mismo que en `cajaGirada`: se gira sobre el propio
 * centro de la pieza y DESPUÉS se traslada. Al revés sería un objeto orbitando
 * el origen de la sala.
 *
 * @param {{centro:number[], medidas?:number[], malla?:{vertices:number[][], caras:number[][]}}} pieza
 * @param {[number,number,number]} desplazamiento se resta al centro (la cámara,
 *   donde el consumidor trabaja en coordenadas de mundo).
 */
export function mallaDePieza(pieza, { desplazamiento = [0, 0, 0], giro = 0 } = {}) {
  const [dx, dy, dz] = desplazamiento;
  const [cx, cy, cz] = pieza.centro;
  const centro = [cx - dx, cy - dy, cz - dz];
  if (!pieza.malla) return cajaGirada(centro, pieza.medidas, giro ?? pieza.giro ?? 0);

  const yaw = Number.isFinite(giro) ? giro : 0;
  const sen = Math.sin(yaw);
  const cos = Math.cos(yaw);
  return {
    ...pieza.malla,
    vertices: pieza.malla.vertices.map(([x, y, z]) =>
      yaw === 0
        ? [x + centro[0], y + centro[1], z + centro[2]]
        : [centro[0] + x * cos + z * sen, centro[1] + y, centro[2] - x * sen + z * cos]),
  };
}
