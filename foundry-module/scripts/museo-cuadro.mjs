// Los cuadros del museo (#836): obra PLANA colgada de un muro.
//
// POR QUÉ ES UN MÓDULO Y NO CUATRO LÍNEAS EN LA SALA. Un cuadro parece lo más
// fácil que se puede colgar y es lo contrario: el motor no mapea texturas y el
// módulo no admite binarios (regla de arte de `CLAUDE.md`), así que aquí no hay
// ninguna imagen que pegar. Un cuadro se DIBUJA con el mismo primitivo que la
// piel de los muros —`chapasDeRejilla` sobre una cara plana, #548/#550— y todo
// lo que sigue son las consecuencias de eso.
//
// LA CELDA DEL LIENZO ES SUYA, Y ES EL MANDO DE ESCALA DEL CUADRO. La piel del
// muro va a 10 cm (#551) y a esa resolución un lienzo de 1,2 × 0,8 m tiene
// DOCE por OCHO píxeles: no es un cuadro, es un icono. Un cuadro es además la
// superficie del museo que más de cerca se mira, así que baja a 2,5 cm. Lo que
// NO se hace es bajar la celda del mural para conseguirlo: eso movería la piel
// de toda la nave, que es exactamente el fallo de #551 —lo que estaba en filas
// se partió por la mitad en silencio y la franja de aviso de una puerta acabó a
// la altura de la rodilla—. Una celda, un sitio, un consumidor.
//
// EL MARCO LLEVA RELIEVE Y EL LIENZO NO. Un marco es un OBJETO de la sala y se
// ilumina como todo lo demás: canto claro arriba y a la izquierda, canto oscuro
// abajo y a la derecha, el mismo sentido que `panelBiselado` — dos relieves
// iluminados al revés en la misma sala se ven a la primera. La pintura es
// PLANA. Biselarla la convertiría en chapa remachada, que es un material
// equivocado, igual que la cantina apaga la piel de casco en sus muebles de
// madera (#550).
//
// NADA QUE SE PUEDA LEER COMO UN INSTRUMENTO. Es la regla de #526 aplicada
// donde más fácil sería saltársela: un cuadro admite cualquier cosa, así que
// nada impediría colgar una carta estelar, un esquema de la nave o un diagrama.
// Ninguna de las tres se puede colgar. Quien anda por el museo no tiene forma de
// saber que ese mapa no cuenta, y el ornamento no puede abrir por detrás la
// lectura falsa que la superficie cierra por delante. Las composiciones de aquí
// son abstractas por esa razón y no por gusto.
//
// EL PRESUPUESTO ES LA CONDICIÓN, NO UNA OPTIMIZACIÓN POSTERIOR (#551). Un
// lienzo son 48 × 32 celdas más el marco: 1.872 antes de fundir, sobre una sala
// que ya cuesta lo suyo. Pasan por `fundirRectangulos` y por el agrupado por
// color, y además cada composición se COMPRUEBA AL IMPORTAR contra
// `TOPE_CUADRO`: una que se pase revienta al cargar el módulo y no en mitad de
// una visita. Aquí no vale el recorte al tope que sí vale en un muro —en un
// muro sobra un greeble y sigue siendo un muro; en un cuadro se corta la
// pintura por la mitad y se lee como un fallo, que es el mismo motivo por el que
// el suelo va a todo o nada (#552).
//
// Puro: geometría y datos. Sin color propio (#351): todo sale de `CUADRO`.

import { CUADRO } from "./paleta.mjs";
import { chapasDeRejilla, crearLienzo, fundirRectangulos } from "./nave-mural-pixel.mjs";

/**
 * El lado de una celda del lienzo, en metros. El mando de escala del cuadro:
 * tocarlo cambia el tamaño del píxel de TODA la pintura y de nada más.
 *
 * 1,25 cm desde #838. Fue 2,5 y el argumento era el mismo que sigue valiendo
 * —un cuadro se mira más de cerca que un muro—, pero se quedó corto: a 2,5 cm
 * un lienzo son 48 x 32 celdas, y ahí una ladera solo puede ser un color plano
 * y una ola solo puede ser cuatro escalones. Lo que cambia al bajar no es la
 * cantidad de cosas, es que las masas admiten DENTRO una segunda lectura —vetas,
 * espuma partida, una cumbre con dos tonos—, que es la misma jerarquía a dos
 * distancias que gobierna la piel del muro (#551).
 *
 * Y se baja SOLO esta, que es justo lo que #551 enseñó a no hacer al revés: la
 * celda del mural sigue en 10 cm y un cuadro no arrastra a la nave entera.
 * Ojo con lo que va EN CELDAS y no en metros: al partir esta constante por la
 * mitad, todo lo que estuviera escrito como número de filas se queda del tamaño
 * equivocado en silencio. Por eso `MARCO` sube a la vez, y por eso las
 * composiciones de abajo derivan cada medida de `filas`/`columnas` en vez de
 * escribir el índice a mano.
 */
export const CELDA_LIENZO = 0.0125;

/**
 * Cuánto se despega el cuadro del muro. Más que el `SALIENTE` de la piel
 * (1 cm) porque el cuadro va ENCIMA de ella: con el mismo valor, las dos
 * superficies quedarían coplanares y se pelearían por el píxel.
 */
export const SALIENTE_CUADRO = 0.035;

/**
 * Grosor del marco, en celdas. Cuatro son 5 cm: un listón, no una moldura.
 *
 * Sube de 2 a 4 en #838 EXACTAMENTE porque la celda bajó a la mitad: son los
 * mismos 5 cm de listón de antes. Dejarlo en 2 habría dado un marco de 2,5 cm
 * sin que fallara ninguna prueba — es el fallo de #551 repetido, y la razón de
 * que esto vaya escrito aquí y no en el diario de un PR.
 */
export const MARCO = 4;

/**
 * Cuántas chapas puede gastar un cuadro. No sale de una intuición: es el
 * presupuesto que las composiciones de hoy cumplen con holgura (ver la medida en
 * la cabecera de la sala) y el número que hay que volver a medir antes de
 * colgar una más. Si una composición no cabe, se simplifica el dibujo o se
 * quita un cuadro; nunca se sube la celda.
 *
 * Baja de 260 a 200 en #838, y baja porque el dibujo es más caro pero el
 * relieve se fue. Caras por lienzo, marco incluido:
 *
 *   composición              antes  con detalle  (extruido)
 *   campo-partido               19           48        116
 *   contratiempo-de-verdin      31           53        123
 *   frente-al-mar               51          170        364
 *   viento-del-sur              83          162        349
 *   sobre-la-niebla             61          149        328
 *
 * El detalle de la celda de 1,25 cm multiplica por tres el dibujo, y eso es lo
 * que se paga. La tercera columna es lo que llegó a costar la extrusión que se
 * retiró por no verse (ver `marcoMoldura`): más del doble para cambiar un 0,1 %
 * del fotograma. La ladera del Fuji costó 482 hasta que su cono pasó a peldaños
 * de dos filas — una ladera que cambia de ancho en cada fila es todo silueta, y
 * ESO sigue valiendo: lo que se paga en un dibujo es el perímetro.
 */
export const TOPE_CUADRO = 200;

/** Medidas del lienzo pintado, en metros, sin contar el marco. */
export const LIENZO = Object.freeze({ ancho: 1.2, alto: 0.8 });

const COLUMNAS_LIENZO = Math.round(LIENZO.ancho / CELDA_LIENZO);
const FILAS_LIENZO = Math.round(LIENZO.alto / CELDA_LIENZO);

/** Medidas totales del cuadro colgado, marco incluido. Se exportan porque la
 *  sala necesita saber qué hueco de muro ocupa antes de colgar nada. */
export const ANCHO_TOTAL = (COLUMNAS_LIENZO + MARCO * 2) * CELDA_LIENZO;
export const ALTO_TOTAL = (FILAS_LIENZO + MARCO * 2) * CELDA_LIENZO;

/* ---- las composiciones ----------------------------------------------------- */

/**
 * Una veta: una raya de una celda dentro de una masa, con la longitud rota a
 * propósito para que no parezca una junta.
 *
 * Es lo que llegó con la celda de 1,25 cm (#838). A 2,5 una masa solo podía ser
 * un color plano; con el doble de resolución admite dentro una segunda lectura
 * que premia acercarse, que es la misma jerarquía de la piel del muro (#551).
 * Va siempre en un tono que ya está en la composición: una veta de color nuevo
 * sería un objeto, no una textura.
 */
function veta({ linea }, v, u0, largo, color) {
  linea(v, u0, largo, color);
}

/**
 * Un triángulo isósceles apoyado en su base, dibujado fila a fila.
 *
 * Existe porque las tres composiciones interpretadas tienen una montaña, y una
 * montaña dibujada a mano en cada una acabaría con tres perfiles distintos por
 * descuido. `cima`/`filasCima` rematan la nieve; `sombra`/`ladera` oscurecen el
 * flanco que no da al sol, que a 1,25 cm ya se puede decir con un tono y a 2,5
 * no cabía.
 */
function cono({ linea }, { centro, base, alto, ancho, color, cima, filasCima = 0, sombra, ladera = 0.42, paso = 1 }) {
  for (let i = 0; i < alto; i += 1) {
    // El ancho se calcula por ESCALÓN y no por fila: con `paso` filas por
    // escalón, la ladera sale en peldaños de esa altura. No es un detalle de
    // estilo, es el presupuesto (#838): el relieve levanta un costado en cada
    // cambio de silueta, así que una ladera que cambia de ancho en todas las
    // filas cuesta el doble que una que cambia cada dos, y a esta resolución
    // el peldaño de dos filas no se distingue del de una.
    const escalon = Math.floor(i / paso) * paso;
    const anchoFila = Math.max(1, Math.round(ancho * (1 - escalon / alto)));
    const u0 = centro - Math.floor(anchoFila / 2);
    const tono = cima && i >= alto - filasCima ? cima : color;
    linea(base + i, u0, anchoFila, tono);
    // La ladera en sombra: la parte derecha de la fila, y solo mientras el tono
    // sea el del cuerpo — la nieve de la cima recibe luz por los dos lados.
    if (sombra && tono === color) {
      const anchoSombra = Math.round(anchoFila * ladera);
      if (anchoSombra > 0) linea(base + i, u0 + anchoFila - anchoSombra, anchoSombra, sombra);
    }
  }
}

/**
 * «Campo partido»: dos masas de tierra que no se tocan, separadas por una línea
 * de hueso que no llega a los bordes.
 *
 * Lo que la hace un cuadro y no un patrón es que las masas están DESCENTRADAS:
 * una composición simétrica a esta escala se lee como un botón o como un aviso,
 * y ninguna de las dos cosas es una pintura.
 *
 * Con la celda de #838 las dos masas dejaron de ser rectángulos limpios: el
 * borde de arriba de la baja va MELLADO —dientes de dos y tres celdas, sin
 * paso fijo— y por dentro llevan vetas. Un canto perfectamente recto a esta
 * resolución se lee como recortado con tijera, y el empaste lo delata todavía
 * más ahora que tiene costado.
 */
function campoPartido({ rect, linea }, columnas, filas) {
  rect(0, 0, columnas, filas, CUADRO.fondo);

  // La masa baja, ancha y pesada, apoyada fuera de campo por la izquierda.
  const anchoBaja = Math.round(columnas * 0.62);
  const altoBaja = Math.round(filas * 0.46);
  rect(2, 0, anchoBaja, altoBaja, CUADRO.ocre);
  // Su borde mellado: dientes de altura irregular, ninguno del mismo ancho que
  // el anterior. La secuencia está escrita y no sorteada — un cuadro no se
  // vuelve a tirar en cada pantalla, y aquí no hay semilla que valga.
  const dientes = [
    [7, 2], [4, 3], [9, 1], [5, 3], [6, 1], [11, 2], [4, 1], [8, 3], [5, 2], [7, 1], [6, 3], [9, 2],
  ];
  let u = 0;
  for (const [ancho, sube] of dientes) {
    if (u >= anchoBaja) break;
    // Siempre sube algo: el borde queda CONTINUO y mellado. Con dientes que se
    // saltan tramos —como en el primer intento— lo que se ve no es un canto
    // roto, son bloques sueltos flotando encima de la masa.
    rect(2 + altoBaja, u, Math.min(ancho, anchoBaja - u), sube, CUADRO.ocre);
    u += ancho;
  }
  // Vetas dentro: dos claras arriba y una oscura abajo, todas cortas y sin
  // empezar a la misma altura.
  veta({ linea }, Math.round(altoBaja * 0.72), 5, Math.round(anchoBaja * 0.4), CUADRO.hueso);
  veta({ linea }, Math.round(altoBaja * 0.55), Math.round(anchoBaja * 0.5), Math.round(anchoBaja * 0.3), CUADRO.hueso);
  veta({ linea }, Math.round(altoBaja * 0.2), 9, Math.round(anchoBaja * 0.34), CUADRO.bermellon);

  // La alta, estrecha, entrando por arriba a la derecha: contrapeso, no espejo.
  const vAlta = Math.round(filas * 0.38);
  const uAlta = Math.round(columnas * 0.68);
  const anchoAlta = Math.round(columnas * 0.24);
  rect(vAlta, uAlta, anchoAlta, filas - vAlta, CUADRO.bermellon);
  // Su flanco izquierdo, un punto más oscuro: es la única concesión a la luz, y
  // va en un tono que ya existe.
  rect(vAlta, uAlta, 3, filas - vAlta, CUADRO.bermellonSombra);
  veta({ linea }, filas - Math.round(filas * 0.18), uAlta + 5, anchoAlta - 8, CUADRO.ocre);

  // El corte de luz. Una sola celda de alto y sin llegar a los bordes: si
  // cruzara el lienzo entero sería un horizonte, y un horizonte ya es un sitio.
  linea(Math.round(filas * 0.52), Math.round(columnas * 0.1), Math.round(columnas * 0.42), CUADRO.hueso);
}

/**
 * «Contratiempo de verdín»: masas que NO comparten base, de anchos y alturas sin
 * orden, dos de ellas cortadas por el borde del lienzo.
 *
 * Es la que justifica que haya dos cuadros propios y no uno: la otra es masa
 * contra masa, y esta es ritmo. Pero un ritmo REGULAR no es una pintura, es un
 * instrumento: la primera versión de este cuadro (#838) eran cuatro columnas
 * apoyadas en la misma base, con paso constante, altura estrictamente creciente
 * y un remate claro en el mismo costado de cada una — o sea, barras con sus
 * marcas, y se leía como un nivel en menos de un segundo. Que la cartela dijera
 * «esto no es una medida» era la señal de que sí lo parecía. Lo que rompe esa
 * gramática y hay que conservar al tocar el dibujo:
 *
 * - **ninguna base común**: cada masa arranca a una altura distinta y dos ni
 *   siquiera se apoyan —una cuelga del borde de arriba—, así que no hay eje;
 * - **alturas no monótonas** y anchos desiguales: no se puede ordenar la serie,
 *   que es lo que hace legible un gráfico de barras;
 * - **el hueso, una sola vez y atravesado**: cruza varias masas y el fondo en
 *   horizontal, en vez de rematar cada bloque por igual. Un acento repetido en
 *   el mismo sitio de cada elemento es un tic de escala;
 * - **dos masas cortadas por el borde**: lo que sale del cuadro dice que el
 *   dibujo sigue fuera, y una escala no se sale nunca de su regla.
 *
 * Las medidas van en FRACCIÓN del lienzo y no en celdas: así el reparto es el
 * mismo si la resolución vuelve a cambiar.
 */
function contratiempoDeVerdin({ rect, linea }, columnas, filas) {
  rect(0, 0, columnas, filas, CUADRO.fondo);

  // v, u, ancho, alto — todo en fracción. Cortadas la primera por la izquierda
  // y la última por la derecha; la segunda cuelga del borde de arriba.
  const masas = [
    [0.28, 0.0, 0.17, 0.34, CUADRO.verdin],
    [0.56, 0.23, 0.12, 0.44, CUADRO.ocre],
    [0.09, 0.4, 0.21, 0.16, CUADRO.verdin],
    [0.37, 0.5, 0.1, 0.28, CUADRO.ocre],
    [0.19, 0.73, 0.27, 0.19, CUADRO.verdin],
    // Dos más pequeñas, que solo caben desde #838: rompen la cuenta de cinco
    // —cuatro o cinco elementos todavía se cuentan de un vistazo, y contar es
    // el primer gesto de leer una escala—.
    //
    // Ninguna de las dos toca la fila de abajo, y no es un descuido: la primera
    // versión de esta tanda sí lo hacía («cortada por el borde de abajo»), y la
    // guarda de gramática la rechazó con razón. Cortada por el lado es que el
    // dibujo sigue fuera; apoyada en el suelo del lienzo es una base, y basta
    // UNA para que el ojo empiece a buscar el eje.
    [0.06, 0.34, 0.07, 0.11, CUADRO.ocre],
    [0.72, 0.62, 0.08, 0.1, CUADRO.verdin],
  ];
  for (const [fv, fu, fa, fh, color] of masas) {
    const v = Math.round(filas * fv);
    const u = Math.round(columnas * fu);
    const ancho = Math.round(columnas * fa);
    const alto = Math.round(filas * fh);
    rect(v, u, ancho, alto, color);
    // Cada masa se come una esquina: un rectángulo intacto es una ficha, y
    // siete fichas son un inventario. La esquina cambia de sitio con el índice.
    const muerde = Math.max(2, Math.round(Math.min(ancho, alto) * 0.3));
    const arriba = (fu * 10) % 2 < 1;
    rect(arriba ? v + alto - muerde : v, u + ancho - muerde, muerde, muerde, CUADRO.fondo);
  }

  // El único acento de hueso, en horizontal y cruzando lo que se encuentre.
  linea(Math.round(filas * 0.62), Math.round(columnas * 0.06), Math.round(columnas * 0.44), CUADRO.hueso);
}

/* ---- las tres interpretadas (#836, segunda tanda) --------------------------- */

// LAS TRES DE ABAJO NO SON INVENTADAS: son REDIBUJOS de tres paisajes de dominio
// público, escogidos porque su composición sobrevive a la resolución del lienzo.
// Lo que hace que un cuadro clásico quepa aquí no es que sea famoso, es que se
// reconozca por MASAS: la ola, el cono rojo y la silueta contra la niebla se
// leen enteros a esta resolución, y un retrato o un interior se convertirían en
// una mancha. Qué son exactamente —una interpretación y no una reproducción— lo
// dice la cartela y lo dice el campo `naturaleza`, que por esto tuvo que
// estrenar el valor `interpretacion`: el fichero es nuestro y la composición no.
//
// NO HAY NINGÚN ESCANEO EN EL ÁRBOL, y esa es la diferencia con las estatuas.
// De la fuente CC0 sale la composición, no el fichero: se mira el escaneo y se
// vuelve a dibujar aquí con los mismos rectángulos que la piel de un muro. Por
// eso no hay `sha256` que comprobar —no hay archivo que se haya copiado— y por
// eso la ficha de `docs/PROCEDENCIA_ASSETS.md` de estos tres dice de qué obra
// vienen y no de qué fichero.
//
// EL DETALLE DE #838 NO ES «MÁS PARECIDO». Con el doble de resolución cabe
// decir la ladera en sombra, la espuma partida en garras y la niebla en dos
// capas; lo que NO cabe, y sigue sin caber, es la cara de nadie ni el trazo del
// original. Se sube el detalle donde el cuadro se lee por masas, no donde
// empezaría a reclamar ser una reproducción.

/**
 * «Frente al mar»: la gran ola por delante, la montaña detrás y muy pequeña.
 *
 * Del original se conserva lo único que cabe: la desproporción. La ola ocupa
 * media tabla y el monte es una cuña al fondo, que es de lo que trata el
 * grabado. La garra de espuma va en escalones y no en curva porque a esta
 * escala una curva son tres píxeles sueltos que se leen como suciedad.
 *
 * OJO CON EL PERFIL. La versión de #838 bajaba en escalones de altura
 * decreciente y llevaba encima marcas horizontales cortas y casi iguales: eso
 * es la misma gramática de gráfico que hubo que retirar del verdín, con la
 * excusa de ser una ola. El perfil de aquí NO es monótono —la cresta sube otra
 * vez antes de romper, que es lo que hace una ola— y las crestas del fondo son
 * de largos claramente distintos.
 */
function frenteAlMar({ rect, linea }, columnas, filas) {
  rect(0, 0, columnas, filas, CUADRO.azulPalido); // el cielo, hasta arriba
  const horizonte = Math.round(filas * 0.34);
  rect(0, 0, columnas, horizonte, CUADRO.azulMedio); // el mar
  rect(0, 0, columnas, Math.round(filas * 0.12), CUADRO.azulProfundo); // el primer plano

  // El monte al fondo, pequeño y a la derecha del centro.
  cono({ linea }, {
    centro: Math.round(columnas * 0.72),
    base: horizonte,
    alto: Math.round(filas * 0.17),
    ancho: Math.round(columnas * 0.24),
    color: CUADRO.niebla,
    cima: CUADRO.espuma,
    filasCima: Math.round(filas * 0.05),
  });

  // LA OLA, POR SILUETA Y NO POR BLOQUES. La versión anterior apilaba tramos
  // rectangulares con la cresta plana encima, y eso —columnas de distinta
  // altura con su remate— es la gramática de gráfico que este cuadro tiene
  // prohibida, con la coartada de ser una ola. Aquí el perfil se interpola
  // entre puntos de control, así que el canto es una CURVA escalonada y no una
  // sucesión de mesetas.
  //
  // Y sobre todo: la cresta VUELA por encima del agua que tiene delante. Un
  // voladizo es lo único que ninguna barra puede hacer —una barra nace en su
  // base y sube—, así que es lo que decide la lectura de un vistazo. Es además
  // lo que hace que la ola de Hokusai sea esa ola: la garra que se cierra.
  const perfil = [
    [0.0, 0.3], [0.08, 0.46], [0.16, 0.62], [0.24, 0.78], [0.31, 0.88],
    [0.36, 0.9], [0.42, 0.86], [0.48, 0.72], [0.54, 0.5], [0.62, 0.34],
    [0.72, 0.26], [0.85, 0.22], [1.0, 0.2],
  ];
  const alturaEn = (fu) => {
    for (let k = 1; k < perfil.length; k += 1) {
      const [a, ha] = perfil[k - 1];
      const [b, hb] = perfil[k];
      if (fu <= b) return ha + ((hb - ha) * (fu - a)) / (b - a);
    }
    return perfil[perfil.length - 1][1];
  };

  // El perfil se muestrea cada `PASO_OLA` columnas y no en todas: dos columnas
  // vecinas que difieren en una celda son dos rectángulos que `fundirRectangulos`
  // ya no puede juntar, y una silueta muestreada al píxel cuesta 671 caras —el
  // tope entero de un cuadro para una sola ola—. Con escalones de tres columnas
  // la curva se conserva entera y la cuenta baja a un tercio. Es el mismo
  // arreglo que el `paso` del cono, y la misma regla: el presupuesto es la
  // condición del dibujo, no un recorte de después.
  const PASO_OLA = 4;
  const cresta = [];
  for (let u = 0; u < columnas; u += 1) {
    const muestra = Math.floor(u / PASO_OLA) * PASO_OLA;
    const alto = Math.round(filas * alturaEn(muestra / (columnas - 1)));
    cresta.push(alto);
    linea(0, u, 1, CUADRO.azulMedio); // por si la columna quedara vacía
    for (let v = 0; v < alto; v += 1) linea(v, u, 1, CUADRO.azulMedio);
    // El seno del agua: el tercio bajo de la masa, más oscuro. Da cuerpo sin
    // partirla en franjas horizontales, porque su altura sigue a la silueta.
    for (let v = 0; v < Math.round(alto * 0.34); v += 1) linea(v, u, 1, CUADRO.azulProfundo);
    // El filo, dos celdas de espuma pegadas al canto.
    linea(alto - 1, u, 1, CUADRO.espuma);
    linea(alto - 2, u, 1, CUADRO.espuma);
  }

  // La garra: la cresta se desprende del filo en el tramo donde el perfil ya
  // cae, y avanza HACIA LA DERECHA sobre el vacío, con dedos que cuelgan. Cada
  // dedo tiene su largo y no hay dos seguidos iguales.
  const uGarra = Math.round(columnas * 0.36);
  const largoGarra = Math.round(columnas * 0.26);
  const dedos = [5, 2, 7, 3, 9, 4, 6, 2, 8, 3, 5, 7, 2, 6];
  for (let k = 0; k < largoGarra; k += 1) {
    const u = uGarra + k;
    if (u >= columnas) break;
    // El labio, siguiendo la altura de donde NACIÓ la garra y no la del agua de
    // debajo: por eso vuela.
    const vLabio = cresta[uGarra] - Math.round(k * 0.55);
    linea(vLabio, u, 1, CUADRO.espuma);
    linea(vLabio - 1, u, 1, CUADRO.espuma);
    // Los dedos van de DOS columnas y cada tres, no de una y cada dos: un dedo
    // de una celda a esta escala es una mota, y además cada uno es un
    // rectángulo suyo que no funde con nada.
    if (k % 3 === 0) {
      const largo = dedos[(k / 3) % dedos.length];
      for (let d = 0; d < largo; d += 1) {
        const v = vLabio - 2 - d;
        if (v > cresta[u] && u + 1 < columnas) linea(v, u, 2, CUADRO.espuma);
      }
    }
  }

  // El oleaje corto de la derecha, en cuñas y no en rayas: tres crestas que
  // nacen del agua y se cierran, de largos francamente distintos.
  const olitas = [
    [0.62, 0.2, 0.13],
    [0.78, 0.14, 0.07],
    [0.7, 0.09, 0.1],
  ];
  for (const [fu, fv, fa] of olitas) {
    const u0 = Math.round(columnas * fu);
    const v = Math.round(filas * fv);
    const ancho = Math.round(columnas * fa);
    for (let k = 0; k < ancho; k += 2) {
      const alto = 1 + Math.round(Math.sin((k / ancho) * Math.PI) * 2);
      for (let d = 0; d < alto; d += 1) linea(v + d, u0 + k, 2, CUADRO.espuma);
    }
  }
}

/**
 * «Viento del sur»: el cono rojo con su nieve, el bosque abajo y las nubes en
 * bandas.
 *
 * Es la más simple de las tres a propósito, y la que mejor demuestra por qué la
 * celda del lienzo tiene que ser suya: a los 10 cm del mural, este cono son
 * cuatro píxeles y un cambio de color.
 *
 * Lo que trajo #838: la ladera del este en sombra —el «Fuji rojo» lo es porque
 * le da el sol de amanecer por un lado y no por el otro—, y la nieve bajando en
 * LENGUAS por los barrancos en vez de cortada en recto. Una cima con el corte
 * horizontal es un sombrero; con lenguas es nieve.
 */
function vientoDelSur({ rect, linea }, columnas, filas) {
  rect(0, 0, columnas, filas, CUADRO.azulPalido);

  const baseCono = Math.round(filas * 0.2);
  const altoCono = Math.round(filas * 0.74);
  const centro = Math.round(columnas * 0.44);
  cono({ linea }, {
    centro,
    base: baseCono,
    alto: altoCono,
    ancho: columnas - Math.round(columnas * 0.08),
    color: CUADRO.bermellon,
    cima: CUADRO.espuma,
    filasCima: Math.round(filas * 0.09),
    sombra: CUADRO.bermellonSombra,
    paso: 2,
  });

  // Las lenguas de nieve, colgando del filo de la cima. Largos distintos y
  // sin paso fijo: la nieve baja por donde hay barranco.
  const nieve = [-7, -4, -1, 2, 5, 9];
  const filoNieve = baseCono + altoCono - Math.round(filas * 0.09);
  nieve.forEach((du, i) => {
    const largo = 2 + ((i * 3) % 5);
    for (let k = 0; k < largo; k += 1) linea(filoNieve - k, centro + du, 1, CUADRO.espuma);
  });

  // El bosque, con el borde de arriba roto: una línea recta ahí sería un zócalo.
  const altoBosque = Math.round(filas * 0.2);
  rect(0, 0, columnas, altoBosque, CUADRO.verdin);
  const copas = [3, 5, 2, 6, 4, 3, 7, 2, 5, 4, 6, 3, 4, 5];
  let u = 0;
  for (let i = 0; i < copas.length && u < columnas; i += 1) {
    const ancho = copas[i];
    if (i % 2 === 0) rect(altoBosque, u, Math.min(ancho, columnas - u), 1 + (i % 3), CUADRO.verdin);
    u += ancho;
  }

  // Las nubes en banda, arriba y a la derecha. Van por encima del cono porque
  // en el original pasan por delante de la ladera, no por detrás. Cada banda va
  // PARTIDA en dos tramos desiguales: tres barras enteras y paralelas serían
  // justo la lectura que este cuadro no puede tener.
  const bandas = [
    [0.94, 0.58, 0.18, 0.79, 0.09],
    [0.88, 0.66, 0.12, 0.81, 0.06],
    [0.82, 0.72, 0.09, 0.85, 0.04],
  ];
  for (const [fv, fu1, fa1, fu2, fa2] of bandas) {
    const v = Math.round(filas * fv);
    linea(v, Math.round(columnas * fu1), Math.round(columnas * fa1), CUADRO.espuma);
    linea(v, Math.round(columnas * fu2), Math.round(columnas * fa2), CUADRO.espuma);
  }
}

/**
 * «Sobre la niebla»: una figura de espaldas en lo alto de una peña, y debajo el
 * mar de nubes con las cumbres asomando.
 *
 * La figura se dibuja con el color del FONDO del lienzo y no con un negro
 * propio: a contraluz no hay detalle que enseñar, y el pigmento más oscuro que
 * ya existe hace de silueta sin estrenar ninguno. Es la única de las tres con
 * una persona dentro, y sigue sin ser legible como nada: de espaldas y sin cara.
 * Con la celda de #838 gana el vuelo del abrigo y el bastón, que es silueta y no
 * rasgo — sigue sin haber a quién reconocer.
 */
function sobreLaNiebla({ rect, linea }, columnas, filas) {
  rect(0, 0, columnas, filas, CUADRO.azulPalido); // el cielo alto
  // El mar de nubes, ahora en dos capas: el vapor de abajo más denso y el de
  // arriba atravesado por la luz. Con una sola capa la niebla era un gris.
  rect(0, 0, columnas, Math.round(filas * 0.52), CUADRO.niebla);
  rect(Math.round(filas * 0.38), 0, columnas, Math.round(filas * 0.14), CUADRO.nieblaClara);
  // Los jirones: tiras claras de largos y alturas dispares dentro del vapor.
  const jirones = [
    [0.2, 0.05, 0.26],
    [0.31, 0.4, 0.17],
    [0.14, 0.62, 0.31],
    [0.44, 0.24, 0.13],
    [0.26, 0.78, 0.19],
  ];
  for (const [fv, fu, fa] of jirones) {
    linea(Math.round(filas * fv), Math.round(columnas * fu), Math.round(columnas * fa), CUADRO.nieblaClara);
  }

  // Las cumbres que asoman, a los dos lados y a distinta altura: son la escala
  // de la niebla, sin ellas el gris es un fondo y no una distancia. Van MÁS
  // OSCURAS que el vapor y no más claras: una cumbre más clara que la niebla que
  // la rodea se lee como un roto en la niebla, no como una montaña detrás.
  cono({ linea }, {
    centro: Math.round(columnas * 0.14),
    base: Math.round(filas * 0.5),
    alto: Math.round(filas * 0.16),
    ancho: Math.round(columnas * 0.23),
    color: CUADRO.azulProfundo,
  });
  cono({ linea }, {
    centro: Math.round(columnas * 0.84),
    base: Math.round(filas * 0.46),
    alto: Math.round(filas * 0.22),
    ancho: Math.round(columnas * 0.31),
    color: CUADRO.azulProfundo,
  });
  cono({ linea }, {
    centro: Math.round(columnas * 0.62),
    base: Math.round(filas * 0.49),
    alto: Math.round(filas * 0.09),
    ancho: Math.round(columnas * 0.14),
    color: CUADRO.azulProfundo,
  });

  // La peña, maciza y descentrada, entrando por abajo. Con repisas: una roca de
  // canto liso a esta resolución se lee como un pedestal.
  const anchoPena = Math.round(columnas * 0.3);
  const uPena = Math.round(columnas * 0.36);
  const altoPena = Math.round(filas * 0.3);
  rect(0, uPena, anchoPena, altoPena, CUADRO.roca);
  linea(altoPena, uPena + 2, anchoPena - 5, CUADRO.roca);
  linea(altoPena + 1, uPena + 6, Math.round(anchoPena * 0.4), CUADRO.roca);
  veta({ linea }, Math.round(altoPena * 0.7), uPena + 3, Math.round(anchoPena * 0.55), CUADRO.fondo);
  veta({ linea }, Math.round(altoPena * 0.38), uPena + 8, Math.round(anchoPena * 0.4), CUADRO.fondo);

  // La figura: piernas, abrigo, hombros y cabeza. Cuatro masas y el bastón.
  const uFigura = uPena + Math.round(anchoPena / 2) - 2;
  const base = altoPena + 2;
  const alto = Math.round(filas * 0.19);
  rect(base, uFigura + 1, 3, Math.round(alto * 0.32), CUADRO.fondo); // las piernas
  rect(base + Math.round(alto * 0.3), uFigura, 5, Math.round(alto * 0.34), CUADRO.fondo); // el abrigo
  rect(base + Math.round(alto * 0.62), uFigura + 1, 4, Math.round(alto * 0.2), CUADRO.fondo); // los hombros
  rect(base + Math.round(alto * 0.8), uFigura + 2, 2, Math.round(alto * 0.18), CUADRO.fondo); // la cabeza
  // El bastón, apoyado a su derecha y clavado en la peña.
  for (let k = 0; k < Math.round(alto * 0.5); k += 1) {
    linea(base + k, uFigura + 6, 1, CUADRO.fondo);
  }
}

/**
 * De ID a dibujo. El mismo papel que `MALLAS_MUSEO` con las estatuas: la ficha
 * del catálogo dice `malla: "campo-partido"` y aquí se resuelve. Un cuadro no
 * tiene una malla suya —es una rejilla que se convierte en chapas por color—,
 * pero la ficha, el validador y la guarda de referencia no cambian por eso.
 */
export const COMPOSICIONES = Object.freeze({
  "campo-partido": campoPartido,
  "contratiempo-de-verdin": contratiempoDeVerdin,
  "frente-al-mar": frenteAlMar,
  "viento-del-sur": vientoDelSur,
  "sobre-la-niebla": sobreLaNiebla,
});

/**
 * El MARCO, como moldura pintada (#838).
 *
 * POR QUÉ PINTADA Y NO EXTRUIDA. La primera versión de esto sacaba el volumen
 * con geometría: cada masa adelantada unos milímetros y el motor sacándole los
 * costados. Está MEDIDO y no se ve — con y sin extrusión cambian entre 0 y 168
 * píxeles de los 129.600 del fotograma, y ni subiéndola a 5 centímetros pasa
 * del 0,3 %. La causa es de fondo y no se arregla con más profundidad: un
 * cuadro colgado se mira DE FRENTE, así que sus costados se ven de canto, y a
 * 480x270 un canto de milímetros ocupa menos de un píxel. Lo mismo que hace que
 * el relieve no cueste polígonos en pantalla —caen por recorte— es lo que hace
 * que no se vea.
 *
 * Lo que sí se ve a esta resolución son PÍXELES, y aquí hay de sobra: la celda
 * del lienzo es 1,25 cm, ocho veces más fina que la del muro, así que un listón
 * de 5 cm son cuatro celdas y en cuatro celdas cabe un perfil de moldura de
 * verdad. Esto es la excepción explícita a la regla del módulo: el LIENZO sigue
 * plano —biselar la pintura la convertiría en chapa remachada— y el marco sí se
 * bisela, porque un marco es un objeto de la sala y se ilumina como tal.
 *
 * EL PERFIL, de fuera adentro: un canto que sube, el cuerpo del listón y un
 * REBAJE que baja hacia el lienzo. El rebaje lleva la luz AL REVÉS que el canto
 * exterior —oscuro arriba y a la izquierda, claro abajo y a la derecha— y esa
 * inversión es toda la diferencia entre un marco y un borde de color: sin ella
 * el lienzo parece pegado encima del listón en vez de encajado detrás. Es la
 * regla de `nave-mural-pixel.mjs` («una pieza montada y un hueco recortado
 * llevan el bisel al revés el uno del otro») aplicada dentro de una sola pieza.
 */
function marcoMoldura(lienzo, columnas, filas) {
  const { linea, columna } = lienzo;
  // Anillo exterior: el canto que sube. La luz viene de arriba y de la
  // izquierda, así que arriba e izquierda cogen luz. El orden de las cuatro
  // llamadas decide las esquinas, y no es indiferente: la última manda.
  linea(filas - 1, 0, columnas, CUADRO.marcoLuz);
  columna(0, 0, filas, CUADRO.marcoLuz);
  linea(0, 0, columnas, CUADRO.marcoSombra);
  columna(columnas - 1, 0, filas, CUADRO.marcoSombra);

  // Anillo interior: el rebaje contra el lienzo, con la luz invertida.
  const d = MARCO - 1;
  linea(filas - 1 - d, d, columnas - d * 2, CUADRO.marcoSombra);
  columna(d, d, filas - d * 2, CUADRO.marcoSombra);
  linea(d, d, columnas - d * 2, CUADRO.marcoLuz);
  columna(columnas - 1 - d, d, filas - d * 2, CUADRO.marcoLuz);
}

/**
 * La pintura en coordenadas de rejilla, marco incluido. Se expone aparte de la
 * geometría por el mismo motivo que `rejillaMural`: es LA decisión de dibujo, y
 * es lo que se puede leer en un test sin montar una escena.
 *
 * @param {string} id una clave de `COMPOSICIONES`.
 * @returns {(string|null)[][]} `[fila][columna]`, fila 0 = la de abajo.
 */
export function rejillaCuadro(id) {
  const dibujo = COMPOSICIONES[id];
  if (!dibujo) throw new RangeError(`No hay ninguna composición llamada «${id}».`);
  const columnas = COLUMNAS_LIENZO + MARCO * 2;
  const filas = FILAS_LIENZO + MARCO * 2;
  const lienzo = crearLienzo(columnas, filas);

  lienzo.rect(0, 0, columnas, filas, CUADRO.marco);
  marcoMoldura(lienzo, columnas, filas);

  // La pintura se dibuja en su propio lienzo y se estampa dentro del marco. Se
  // hace así, y no pasándole el offset al dibujo, para que ninguna composición
  // pueda pintar sobre el marco por un índice mal sumado: lo que se sale del
  // lienzo pequeño se pierde ahí, que es lo que ya garantiza `crearLienzo`.
  const pintura = crearLienzo(COLUMNAS_LIENZO, FILAS_LIENZO);
  dibujo(pintura, COLUMNAS_LIENZO, FILAS_LIENZO);
  for (let v = 0; v < FILAS_LIENZO; v += 1) {
    for (let u = 0; u < COLUMNAS_LIENZO; u += 1) {
      const color = pintura.rejilla[v][u];
      if (color) lienzo.poner(v + MARCO, u + MARCO, color);
    }
  }
  return lienzo.rejilla;
}

/**
 * Las chapas de un cuadro colgado, listas para la lista de mobiliario de
 * `crearSalaCaja`.
 *
 * @param {object} opciones
 * @param {{eje:"x"|"z", plano:number, sentido:1|-1}} opciones.cara la cara
 *   interior del muro del que cuelga, en la convención de `chapaEnCara`.
 * @param {number} opciones.u dónde empieza el cuadro a lo largo de esa cara, en
 *   metros de mundo (una z si el muro es lateral, una x si es de fondo).
 * @param {number} opciones.cota altura del borde INFERIOR del marco.
 * @param {string} opciones.composicion clave de `COMPOSICIONES`.
 * @returns {{malla:object, color:string}[]}
 */
export function piezasCuadro({ cara, u, cota, composicion }) {
  return chapasDeRejilla({ ...cara, u0: u }, rejillaCuadro(composicion), {
    base: cota,
    celda: CELDA_LIENZO,
    saliente: SALIENTE_CUADRO,
    tope: TOPE_CUADRO,
  });
}

/**
 * Cuántas chapas gasta una composición después de fundir. Es la medida que hay
 * que pegar en el PR al tocar un dibujo, y la que comprueba la guarda de abajo.
 */
export function costeCuadro(composicion) {
  return piezasCuadro({
    cara: { eje: "z", plano: 0, sentido: 1 },
    u: 0,
    cota: 0,
    composicion,
  }).reduce((total, { malla }) => total + malla.caras.length, 0);
}

// LA GUARDA, AL IMPORTAR. Una composición que se pase del tope no se recorta
// —media pintura se lee como un fallo—, así que revienta aquí y no dentro de la
// sala: el mismo criterio que el catálogo de asistencia, donde una tarea rota
// falla al cargar y no en mitad de una crisis.
//
// Mide sobre `fundirRectangulos`, ANTES del tope: `piezasCuadro`/`costeCuadro`
// pasan por `chapasDeRejilla`, que ya aplica `.slice(0, tope)` antes de
// devolver las chapas, así que su cuenta nunca puede superar `TOPE_CUADRO` — la
// guarda sería inalcanzable y una composición demasiado grande perdería chapas
// en silencio en vez de reventar (revisión de #878).
for (const composicion of Object.keys(COMPOSICIONES)) {
  const coste = fundirRectangulos(rejillaCuadro(composicion)).length;
  if (coste > TOPE_CUADRO) {
    throw new RangeError(
      `La composición «${composicion}» gasta ${coste} chapas y el tope es ${TOPE_CUADRO}. ` +
        "Simplifica el dibujo o cuelga un cuadro menos; NO subas CELDA_LIENZO.",
    );
  }
}
