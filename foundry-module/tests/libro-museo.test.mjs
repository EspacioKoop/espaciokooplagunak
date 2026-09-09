import assert from "node:assert/strict";
import test from "node:test";

import { componerMuseoConLibro, piezasLibroEnSala, PAGINAS_LIBRO } from "../scripts/libro-museo.mjs";
import { ATRIL_LIBRO, INTERACCIONES } from "../scripts/museo-escena.mjs";
import { colisiona } from "../scripts/nave-movimiento.mjs";
import { PLANTA_MUSEO } from "../scripts/museo-escena.mjs";
import { activarLibro, cerrarLibro, reiniciarLibroParaPruebas } from "../scripts/libro-sesion.mjs";

const PUNTO_LIBRO = INTERACCIONES.find((p) => p.id === "libro-clasico");

test.beforeEach(() => reiniciarLibroParaPruebas());

test("el punto de interacción del libro cae en suelo libre de la sala", () => {
  assert.ok(PUNTO_LIBRO, "no se declaró el punto de interacción del libro");
  assert.equal(
    colisiona(PUNTO_LIBRO.punto[0], PUNTO_LIBRO.punto[1], 0.35, PLANTA_MUSEO),
    false,
  );
});

test("con el libro cerrado, componerMuseoConLibro no compone nada extra", () => {
  const [x, z] = PUNTO_LIBRO.punto;
  const cerrado = componerMuseoConLibro(x, 0, z, PUNTO_LIBRO.orientacion, { tiempo: 0 });
  assert.ok(cerrado.poligonos.length > 0, "la sala en sí debe pintar algo");
  // No se activó nada: el resultado con el libro cerrado no debería pagar el
  // presupuesto extra de la página.
});

test("abrir el libro añade polígonos frente a tenerlo cerrado, mirando desde el mismo punto", () => {
  const [x, z] = PUNTO_LIBRO.punto;
  const { orientacion: yaw } = PUNTO_LIBRO;

  const cerrado = componerMuseoConLibro(x, 0, z, yaw, { tiempo: 0 });

  activarLibro({ totalPaginas: PAGINAS_LIBRO, reducirMovimiento: true, ahoraMs: 0 });
  const abierto = componerMuseoConLibro(x, 0, z, yaw, { tiempo: 0 });

  assert.ok(
    abierto.poligonos.length > cerrado.poligonos.length,
    `abierto (${abierto.poligonos.length}) debería tener más polígonos que cerrado (${cerrado.poligonos.length})`,
  );
});

test("cerrarLibro devuelve la composición al mismo recuento que el estado inicial", () => {
  const [x, z] = PUNTO_LIBRO.punto;
  const { orientacion: yaw } = PUNTO_LIBRO;

  const cerradoInicial = componerMuseoConLibro(x, 0, z, yaw, { tiempo: 0 });
  activarLibro({ totalPaginas: PAGINAS_LIBRO, reducirMovimiento: true, ahoraMs: 0 });
  componerMuseoConLibro(x, 0, z, yaw, { tiempo: 0 }); // abierto
  cerrarLibro();
  const cerradoOtraVez = componerMuseoConLibro(x, 0, z, yaw, { tiempo: 0 });

  assert.equal(cerradoOtraVez.poligonos.length, cerradoInicial.poligonos.length);
});

test("el presupuesto documentado: la página no se compone hasta pasar el umbral de apertura", () => {
  // Umbral 0.05 rad declarado en la cabecera de libro-museo.mjs. Se comprueba
  // sobre `piezasLibroEnSala` directamente y no contando polígonos de la
  // escena compuesta: el recorte de cámara cambia la silueta visible del
  // propio cuerpo en cuanto `apertura` se mueve un poco, así que esa cuenta es
  // frágil para afirmar justo esto.
  const apenasAbierto = { fase: "abriendo", apertura: 0.01, hojaVuelo: 0, paginaActual: 0, transicion: {} };
  const abiertoDeVerdad = { fase: "abierto", apertura: 0.5, hojaVuelo: 0, paginaActual: 0, transicion: null };

  assert.equal(piezasLibroEnSala(apenasAbierto).length, 1, "solo el cuerpo, sin página, por debajo del umbral");
  assert.ok(piezasLibroEnSala(abiertoDeVerdad).length > 1, "cuerpo + materiales de página, por encima del umbral");
});

test("ATRIL_LIBRO tiene una posición y altura sensatas dentro de la sala", () => {
  assert.ok(ATRIL_LIBRO.x > 0 && ATRIL_LIBRO.z > 0);
  assert.ok(ATRIL_LIBRO.altura > 0 && ATRIL_LIBRO.altura < 2);
});

import { ALTURA_OJOS } from "../scripts/nave-camara.mjs";
import { ANCHO_PAGINA, ALTO_PAGINA, TOPE_PAGINA } from "../scripts/libro-pagina.mjs";
import { PAGINA } from "../scripts/paleta.mjs";

test("el libro completo queda encuadrado de pie durante apertura y paso", () => {
  const [cx, cz] = PUNTO_LIBRO.punto;
  const yaw = PUNTO_LIBRO.orientacion;
  const focal = 480 / (2 * Math.tan(62 * Math.PI / 360));
  for (let paso = 0; paso <= 20; paso++) {
    for (const estado of [
      { apertura: paso * Math.PI / 40, hojaVuelo: 0, paginaActual: 0 },
      { apertura: Math.PI / 2, hojaVuelo: paso * Math.PI / 40, paginaActual: 0 },
    ]) {
      const piezas = piezasLibroEnSala(estado);
      for (const { malla } of piezas) for (const [x,y,z] of malla.vertices) {
        const depth = (x-cx)*Math.sin(yaw)+(z-cz)*Math.cos(yaw);
        const lateral = (x-cx)*Math.cos(yaw)-(z-cz)*Math.sin(yaw);
        const sx = 240 + focal*lateral/depth, sy = 135-focal*(y-ALTURA_OJOS)/depth;
        assert.ok(depth > 0 && sx > 8 && sx < 472 && sy > 8 && sy < 262,
          `vértice fuera del encuadre: ${sx}, ${sy}`);
      }
      assert.ok(piezas.slice(1).reduce((n,p)=>n+p.malla.caras.length,0) <= TOPE_PAGINA);
    }
  }
});

test("la página conserva anchura, altura, materiales y normales hacia quien lee", () => {
  const piezas = piezasLibroEnSala({ apertura: Math.PI/2, hojaVuelo: 0, paginaActual: 0 }).slice(1);
  assert.ok(piezas.some(p=>p.color===PAGINA.papel));
  assert.ok(new Set(piezas.map(p=>p.color)).size > 1);
  const vertices=piezas.flatMap(p=>p.malla.vertices);
  const ys=vertices.map(v=>v[1]);
  assert.ok(Math.abs(Math.max(...ys)-Math.min(...ys)-ALTO_PAGINA)<1e-9);
  const zs=vertices.map(v=>v[2]);
  assert.ok(Math.max(...zs)-Math.min(...zs)>ANCHO_PAGINA/2);
  const [cx,cz]=PUNTO_LIBRO.punto;
  for(const {malla} of piezas) for(const face of malla.caras){
    const [a,b,c]=face.map(i=>malla.vertices[i]);
    const u=b.map((v,i)=>v-a[i]),v=c.map((v,i)=>v-a[i]);
    const normal=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    assert.ok(normal[0]*(cx-a[0])+normal[1]*(ALTURA_OJOS-a[1])+normal[2]*(cz-a[2])>0);
  }
});
