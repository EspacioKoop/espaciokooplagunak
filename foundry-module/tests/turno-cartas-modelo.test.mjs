import assert from "node:assert/strict";
import { test } from "node:test";
import {
  combinarTarjetas,
  galeriaDePrueba,
  normalizarTarjeta,
  serializarTarjeta,
  tarjetaSvg,
  tarjetasDeIniciativa,
  tarjetasDesdeEstadoTurno,
} from "../scripts/turno-cartas-modelo.mjs";

test("combina raza, clase, bando y estado en capas visuales", () => {
  const carta = normalizarTarjeta({ id: "a", nombre: "Alda", raza: "elfo", clase: "mago", bando: "aliado", shiny: true, estados: ["ventaja", "concentracion"] });
  assert.deepEqual(carta.visual.paleta, { marco: "#8fa3d9", acento: "#d8f3dc" });
  assert.equal(carta.visual.iconoClase, "runa");
  assert.deepEqual(carta.visual.iconoEstados, ["estrella", "ojo"]);
  assert.equal(carta.visual.marcoShiny, "ornamentado");
});

test("los datos desconocidos no inventan raza, clase ni estados", () => {
  const carta = normalizarTarjeta({ raza: "dragón", clase: "", bando: "villano", estados: ["volando", "muerto", "muerto"] });
  assert.equal(carta.raza, "humano");
  assert.equal(carta.clase, "guerrero");
  assert.equal(carta.bando, "neutral");
  assert.deepEqual(carta.estados, ["muerto"]);
});

test("combinarTarjetas conserva la evolución y sustituye solo el overlay", () => {
  const base = normalizarTarjeta({ id: "a", nombre: "Alda", raza: "enano", clase: "guerrero", shiny: true });
  const carta = combinarTarjetas(base, { estados: ["herido"] });
  assert.equal(carta.shiny, true);
  assert.equal(carta.raza, "enano");
  assert.deepEqual(carta.estados, ["herido"]);
  assert.notEqual(carta, base);
});

test("ally ausente o no booleano no convierte un combatiente en enemigo", () => {
  for (const ally of [undefined, null, 0, "false"]) {
    const [carta] = tarjetasDesdeEstadoTurno({ combatants: [{ id: "a", ally }] });
    assert.equal(carta.bando, "neutral");
  }
  assert.equal(tarjetasDesdeEstadoTurno({ combatants: [{ id: "a", ally: false }] })[0].bando, "enemigo");
});

test("una actualización explícita puede retirar badges sin perder campaña", () => {
  const base = normalizarTarjeta({ id: "a", shiny: true, concentracion: true, inspiracion: true });
  const carta = combinarTarjetas(base, { concentracion: false, inspiracion: false });
  assert.equal(carta.concentracion, false);
  assert.equal(carta.inspiracion, false);
  assert.deepEqual(carta.badges, []);
  assert.equal(carta.shiny, true);
  assert.equal(base.concentracion, true);
  assert.deepEqual(normalizarTarjeta(carta), carta);
});

test("la galería cubre las nueve combinaciones de raza y clase", () => {
  const galeria = galeriaDePrueba();
  assert.equal(galeria.length, 9);
  assert.equal(new Set(galeria.map((carta) => `${carta.raza}:${carta.clase}`)).size, 9);
  assert.ok(galeria.some((carta) => carta.shiny));
});

test("el boceto SVG cambia por raza, clase y shiny sin usar binarios", () => {
  const normal = tarjetaSvg({ nombre: "Alda", raza: "elfo", clase: "mago" });
  const shiny = tarjetaSvg({ nombre: "Alda", raza: "elfo", clase: "mago", shiny: true });
  assert.match(normal, /runa/);
  assert.match(normal, /#8fa3d9/);
  assert.doesNotMatch(normal, /stroke-dasharray/);
  assert.match(shiny, /stroke-dasharray/);
});

test("expone badges de concentración, inspiración y agotamiento acotado", () => {
  const carta = normalizarTarjeta({ concentracion: true, inspiracion: true, agotamiento: 9 });
  assert.deepEqual(carta.badges, ["concentracion", "inspiracion", "agotamiento"]);
  assert.deepEqual(carta.visual.iconoBadges, ["foco", "chispa", "fatiga"]);
  assert.equal(carta.agotamiento, 6);
  assert.match(tarjetaSvg(carta), /E6\/6/);
});

test("el agotamiento cero no crea badge ni altera shiny", () => {
  const carta = normalizarTarjeta({ shiny: true, agotamiento: 0 });
  assert.deepEqual(carta.badges, []);
  assert.equal(carta.shiny, true);
  assert.doesNotMatch(tarjetaSvg(carta), /E0\/6/);
});

test("marca activo y siguiente sin cambiar la identidad de las cartas", () => {
  const cartas = tarjetasDeIniciativa([
    { id: "a", nombre: "Alda", raza: "elfo", clase: "mago" },
    { id: "b", nombre: "Borin", raza: "enano", clase: "guerrero" },
  ], { activoId: "b", siguienteId: "a" });
  assert.equal(cartas[0].siguiente, true);
  assert.equal(cartas[1].activo, true);
  assert.equal(cartas[1].posicion, 1);
  assert.equal(cartas[0].id, "a");
});

test("proyecta el estado del reducer sin convertirlo en otra fuente de verdad", () => {
  const cartas = tarjetasDesdeEstadoTurno({
    active: true,
    currentIndex: 1,
    combatants: [
      { id: "a", name: "Alda", initiative: 12, ally: true },
      { id: "b", name: "Borin", initiative: 8, ally: false, race: "enano", className: "guerrero", exhaustion: 2 },
    ],
  });
  assert.equal(cartas[0].bando, "aliado");
  assert.equal(cartas[1].bando, "enemigo");
  assert.equal(cartas[1].activo, true);
  assert.equal(cartas[0].siguiente, true);
  assert.equal(cartas[1].raza, "enano");
  assert.equal(cartas[1].clase, "guerrero");
  assert.equal(cartas[1].agotamiento, 2);
});

test("tarjetasDesdeEstadoTurno conserva el bando explícito en vez de asumir ally", () => {
  const cartas = tarjetasDesdeEstadoTurno({
    active: false,
    currentIndex: 0,
    combatants: [{ id: "a", name: "Testigo", initiative: 5, bando: "neutral" }],
  });
  assert.equal(cartas[0].bando, "neutral");
});

test("combinarTarjetas es idempotente y conserva concentracion/inspiracion al combinar", () => {
  const base = normalizarTarjeta({ id: "a", nombre: "Alda", concentracion: true, inspiracion: true });
  assert.deepEqual(base.badges, ["concentracion", "inspiracion"]);

  // Ida y vuelta: renormalizar una tarjeta ya normalizada no debe perder nada.
  const reNormalizada = normalizarTarjeta(base);
  assert.deepEqual(reNormalizada.badges, ["concentracion", "inspiracion"]);

  // Actualización parcial: combinar con una capa que solo trae estados no
  // debe borrar los badges que ya estaban activos.
  const combinada = combinarTarjetas(base, { estados: ["herido"] });
  assert.deepEqual(combinada.estados, ["herido"]);
  assert.deepEqual(combinada.badges, ["concentracion", "inspiracion"]);
});

test("un valor desconocido se descarta con constancia, no se convierte en false ni inventa bando", () => {
  // Criterio explícito de #1030. La forma de dejarlo constar es la de
  // `contenido-externo/`: fallar cerrado y anotar el descarte, en vez de
  // arrastrar hasta el render una cadena que nadie ha definido.
  const tarjeta = normalizarTarjeta({
    id: "x",
    raza: "orco",
    bando: "hostil",
    estados: ["herido", "petrificado"],
  });
  assert.equal(tarjeta.raza, "humano", "cae al valor por defecto, no a null");
  assert.equal(tarjeta.bando, "neutral", "no inventa una alineación");
  assert.deepEqual([...tarjeta.estados], ["herido"], "el estado desconocido no llega a la lectura");
  assert.deepEqual(
    tarjeta.descartes.map((d) => `${d.campo}=${d.valor}`).sort(),
    ["bando=hostil", "estados=petrificado", "raza=orco"],
    "pero queda constancia de los tres, con su campo",
  );
});

test("una tarjeta completa no deja descartes", () => {
  const tarjeta = normalizarTarjeta({ id: "y", raza: "elfo", clase: "mago", bando: "aliado", estados: ["ventaja"] });
  assert.deepEqual([...tarjeta.descartes], []);
});

test("serializarTarjeta produce una copia propia, sin compartir las constantes del módulo", () => {
  const entrada = { id: "z", raza: "enano", clase: "picaro", bando: "enemigo", estados: ["herido"], agotamiento: 3 };
  const plana = serializarTarjeta(entrada);
  const normal = normalizarTarjeta(entrada);

  assert.deepEqual(plana, JSON.parse(JSON.stringify(normal)), "mismo contenido que la normalizada");
  assert.notEqual(plana.visual.paleta, normal.visual.paleta, "la paleta es una copia, no la referencia compartida");
  assert.ok(!Object.isFrozen(plana), "la copia es manipulable por quien la recibe");
  assert.equal(JSON.parse(JSON.stringify(plana)).id, "z", "sobrevive una ida y vuelta por JSON");
});
