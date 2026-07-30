import assert from "node:assert/strict";
import test from "node:test";

/* Prueba del CABLEADO de la mesa (#308, paso 6) sin Foundry.
 *
 * `minijuegos-wiring.mjs` es la única capa del póker que las pruebas unitarias
 * declaraban «no testeable en Node», y es justo donde salieron los seis fallos
 * de la sesión en mesa del 2026-07-28: todos de integración, invisibles desde
 * los motores puros. Aquí se simula lo justo de Foundry —ajustes de mundo,
 * documentos `User` con flags, el hook `updateUser` y el socket— para correr
 * varios clientes de verdad contra el cableado.
 *
 * La pieza que hace honesta la prueba: cada cliente es una INSTANCIA distinta
 * del módulo (import con query propia), porque el cableado guarda estado a
 * nivel de módulo. Compartir instancia le daría a los jugadores la sesión viva
 * del coordinador —semilla, mazo y manos incluidos— y la prueba de privacidad
 * pasaría por construcción en vez de por mérito. `game` y `Hooks` se
 * intercambian antes de cada llamada, que es exactamente lo que distingue una
 * pestaña de otra.
 */

const RAIZ = new URL("../scripts/minijuegos-wiring.mjs", import.meta.url).href;
const MODULO = "espaciokoop-lagunak";

// Cada mundo importa instancias frescas del módulo: sin esto, el segundo test
// heredaría la sesión viva del primero y pasaría por razones equivocadas.
let generacion = 0;

async function crearMundo({ jugadores = ["p1", "p2"] } = {}) {
  const semilla = (generacion += 1);
  const ajustes = new Map(); // ajustes de MUNDO: los ven todos
  const clientes = [];
  let contador = 0;

  globalThis.foundry = { utils: { randomID: () => `id${semilla}_${(contador += 1)}` } };

  const difundirUpdateUser = (userDoc, changes) => {
    for (const c of clientes) c.conHooks(() => c.hooks.callAll("updateUser", userDoc, changes));
  };
  const difundirSocket = (canal, mensaje) => {
    for (const c of clientes) c.recibirSocket(canal, mensaje);
  };

  function crearCliente(id, { isGM = false } = {}) {
    const flags = {};
    const oyentesSocket = new Map();
    const hooksReg = new Map();

    const userDoc = {
      id,
      isGM,
      flags,
      getFlag: (mod, key) => flags[mod]?.[key],
      async setFlag(mod, key, valor) {
        flags[mod] ??= {};
        flags[mod][key] = valor;
        // Foundry entrega el DIFERENCIAL, no el documento entero. El sobre se
        // lee del `User` ya actualizado; el diff solo dice QUE el flag se tocó.
        difundirUpdateUser(userDoc, { flags: { [mod]: { [key]: valor } } });
      },
    };

    const hooks = {
      on: (nombre, fn) => {
        if (!hooksReg.has(nombre)) hooksReg.set(nombre, []);
        hooksReg.get(nombre).push(fn);
      },
      off: (nombre, fn) => {
        const lista = hooksReg.get(nombre) ?? [];
        const i = lista.indexOf(fn);
        if (i >= 0) lista.splice(i, 1);
      },
      callAll: (nombre, ...args) => {
        for (const fn of [...(hooksReg.get(nombre) ?? [])]) fn(...args);
      },
    };

    const recibidas = [];
    const relevos = [];
    const cliente = {
      id,
      userDoc,
      hooks,
      recibidas, // vistas privadas que ESTE cliente aceptó
      relevos,
      conectado: true,
      game: {
        user: userDoc,
        get users() {
          const lista = clientes.filter((c) => c.conectado).map((c) => c.userDoc);
          lista.activeGM = clientes.find((c) => c.conectado && c.userDoc.isGM)?.userDoc ?? null;
          lista.get = (uid) => lista.find((u) => u.id === uid) ?? null;
          return lista;
        },
        settings: {
          register: (mod, key, cfg) => {
            if (!ajustes.has(`${mod}.${key}`)) ajustes.set(`${mod}.${key}`, cfg.default ?? null);
          },
          get: (mod, key) => ajustes.get(`${mod}.${key}`) ?? null,
          set: (mod, key, valor) => ajustes.set(`${mod}.${key}`, valor),
        },
        socket: {
          on: (canal, fn) => oyentesSocket.set(canal, fn),
          off: (canal) => oyentesSocket.delete(canal),
          emit: (canal, mensaje) => difundirSocket(canal, mensaje),
        },
      },
      recibirSocket(canal, mensaje) {
        if (!cliente.conectado) return;
        const fn = oyentesSocket.get(canal);
        if (fn) cliente.conHooks(() => fn(mensaje));
      },
      // Ejecuta con ESTE cliente como global activo: es lo que distingue una
      // pestaña de otra.
      conHooks(fn) {
        const gAnt = globalThis.game;
        const hAnt = globalThis.Hooks;
        globalThis.game = cliente.game;
        globalThis.Hooks = hooks;
        try {
          return fn();
        } finally {
          globalThis.game = gAnt;
          globalThis.Hooks = hAnt;
        }
      },
    };

    hooks.on("lagunakMinijuegoVistaPrivada", (vista) => recibidas.push(vista));
    hooks.on("lagunakMinijuegoRelevoCoordinador", (info) => relevos.push(info ?? true));
    clientes.push(cliente);
    return cliente;
  }

  // Arranca un cliente: instancia propia del módulo y registro. Sirve también
  // para el F5, que es exactamente esto sobre un id que ya existía.
  async function arrancar(cliente, etiqueta = "") {
    cliente.wiring = await import(`${RAIZ}?mundo=${semilla}&cliente=${cliente.id}${etiqueta}`);
    cliente.conHooks(() => {
      cliente.wiring.registrarAjustesMinijuegos(MODULO);
      cliente.wiring.registrarSesionesMinijuegos(MODULO);
    });
    return cliente;
  }

  const gm = crearCliente("gm", { isGM: true });
  const mesa = { gm, ajustes, clientes, crearCliente, arrancar };
  mesa.jugadores = jugadores.map((id) => crearCliente(id));

  for (const c of [gm, ...mesa.jugadores]) await arrancar(c);

  mesa.publico = () => ajustes.get(`${MODULO}.minijuegoSesionPublica`);
  mesa.juego = () => mesa.publico()?.juegoPublico;
  mesa.stacks = () => {
    const p = mesa.publico();
    const finales = p?.resultado?.stacksFinales;
    if (finales) return { ...finales };
    return Object.fromEntries((mesa.juego()?.jugadores ?? []).map((j) => [j.userId, j.stack]));
  };
  // Las fichas comprometidas están en el BOTE, no en el stack: sumar solo los
  // stacks a media mano da un total menor y parece una fuga que no existe.
  mesa.total = (s) => Object.values(s).reduce((a, b) => a + b, 0) + (mesa.juego()?.bote ?? 0);
  mesa.proponer = (c, tipo, parametros) =>
    c.conHooks(() => c.wiring.proponerAccion({ tipo, parametros }));
  // La vista privada de la SESIÓN envuelve la del juego: la mano vive en
  // `juegoPrivado.tuMano`, no en la raíz.
  mesa.manoDe = (c) => c.recibidas.at(-1)?.juegoPrivado?.tuMano;

  return mesa;
}

// Una mesa con la primera mano ya repartida, que es el punto de partida de
// casi todo lo interesante.
async function mesaRepartida() {
  const mesa = await crearMundo();
  const [p1, p2] = mesa.jugadores;
  mesa.gm.conHooks(() => mesa.gm.wiring.abrirMesa({ id: "mesa-1", nombreJuego: "poker" }));
  await mesa.proponer(p1, "join");
  await mesa.proponer(p2, "join");
  await mesa.proponer(mesa.gm, "start");
  return mesa;
}

test("el GM abre la mesa y el estado público llega a todos por el ajuste de mundo", async () => {
  const mesa = await crearMundo();
  mesa.gm.conHooks(() => mesa.gm.wiring.abrirMesa({ id: "mesa-1", nombreJuego: "poker" }));

  assert.equal(mesa.publico()?.id, "mesa-1");
  assert.equal(mesa.publico()?.coordinadorId, "gm");
  // Un jugador lee el mismo ajuste desde su propia instancia: el estado público
  // no viaja por socket, así que quien entra tarde también lo ve.
  const [p1] = mesa.jugadores;
  const visto = p1.conHooks(() => p1.wiring.estadoPublicoVigente());
  assert.equal(visto?.id, "mesa-1");
});

test("los jugadores se sientan por su propio flag y el coordinador los admite", async () => {
  const mesa = await crearMundo();
  const [p1, p2] = mesa.jugadores;
  mesa.gm.conHooks(() => mesa.gm.wiring.abrirMesa({ id: "mesa-1", nombreJuego: "poker" }));

  await mesa.proponer(p1, "join");
  await mesa.proponer(p2, "join");

  assert.equal(mesa.publico()?.jugadores?.length, 2);
  assert.deepEqual(
    mesa.publico().jugadores.map((j) => j.userId).sort(),
    ["p1", "p2"],
  );
});

test("cada jugador recibe SU mano y ninguna carta ajena", async () => {
  const mesa = await mesaRepartida();
  const [p1, p2] = mesa.jugadores;

  const manoP1 = mesa.manoDe(p1);
  const manoP2 = mesa.manoDe(p2);
  assert.equal(Array.isArray(manoP1) && manoP1.length, 2);
  assert.equal(Array.isArray(manoP2) && manoP2.length, 2);
  assert.notDeepEqual(manoP1, manoP2);

  // p1 no puede haber visto NUNCA una vista privada que no fuera la suya: si el
  // reparto dirigido se equivocara de destinatario, se vería aquí y no en el
  // último mensaje.
  for (const vista of p1.recibidas) {
    if (vista.juegoPrivado) assert.deepEqual(vista.juegoPrivado.tuMano, manoP1);
  }
});

test("el estado público no lleva cartas ni claves de secreto", async () => {
  const mesa = await mesaRepartida();
  const [p1] = mesa.jugadores;
  const cartas = new Set(mesa.manoDe(p1));

  // Buscar por SUBCADENA daría falsos positivos: un código como "5c" aparece
  // dentro de cualquier id aleatorio. Se recorre el árbol comparando valores
  // exactos, y además se prohíben las claves que solo el coordinador puede tener.
  const filtraciones = [];
  const clavesSecretas = [];
  const prohibidas = ["manos", "mazo", "semilla", "tuMano", "estadoAleatorio"];
  const recorrer = (valor, ruta = "") => {
    if (typeof valor === "string" && cartas.has(valor)) filtraciones.push(ruta);
    const hoja = ruta.split(".").pop() ?? "";
    if (prohibidas.includes(hoja)) clavesSecretas.push(ruta);
    if (Array.isArray(valor)) valor.forEach((v, i) => recorrer(v, `${ruta}[${i}]`));
    else if (valor && typeof valor === "object") {
      for (const [k, v] of Object.entries(valor)) recorrer(v, ruta ? `${ruta}.${k}` : k);
    }
  };
  recorrer(mesa.publico());

  assert.deepEqual(filtraciones, [], `cartas de p1 filtradas en: ${filtraciones.join(", ")}`);
  assert.deepEqual(clavesSecretas, [], `secretos en el público: ${clavesSecretas.join(", ")}`);
});

test("una mano ni crea ni destruye fichas, y la siguiente no reparte la entrada otra vez", async () => {
  const mesa = await mesaRepartida();
  const [p1, p2] = mesa.jugadores;

  const inicial = mesa.stacks();
  assert.equal(mesa.total(inicial), 200, "dos entradas de 100");

  const enTurno = mesa.juego()?.turno;
  const clienteEnTurno = [p1, p2].find((c) => c.id === enTurno);
  assert.ok(clienteEnTurno, `el turno debería ser de un jugador sentado, y es de ${enTurno}`);
  await mesa.proponer(clienteEnTurno, "act", { tipo: "fold" });

  assert.equal(mesa.publico()?.manoEnCurso, false);
  const trasPrimera = mesa.stacks();
  assert.equal(mesa.total(trasPrimera), 200);
  // Si la mano no hubiera movido nada, la comprobación de recompra de abajo no
  // probaría nada: la primera mano tiene que dejar huella.
  assert.notDeepEqual(trasPrimera, inicial);

  await mesa.proponer(mesa.gm, "start");
  const segunda = mesa.stacks();
  // Ojo al comparar: al repartir ya están puestas las ciegas, así que los stacks
  // NO son los de después de la mano anterior. El discriminador bueno es otro:
  // con recompra, la segunda mano reproduciría EXACTAMENTE los stacks de la
  // primera —misma entrada, mismas ciegas—.
  assert.notDeepEqual(segunda, inicial, "la segunda mano repite el reparto: hay recompra");
  assert.equal(mesa.total(segunda), 200);
});

test("el botón rota: quien pagó la ciega pequeña no la vuelve a pagar", async () => {
  const mesa = await mesaRepartida();
  const [p1, p2] = mesa.jugadores;

  const enTurno = mesa.juego()?.turno;
  await mesa.proponer([p1, p2].find((c) => c.id === enTurno), "act", { tipo: "fold" });
  const trasPrimera = mesa.stacks();
  await mesa.proponer(mesa.gm, "start");
  const segunda = mesa.stacks();

  // Quien paga la ciega pequeña pierde 1 y quien paga la grande pierde 2, así
  // que la rotación se lee en la diferencia y no hace falta exponer el disco.
  const pagoP1 = trasPrimera.p1 - segunda.p1;
  const pagoP2 = trasPrimera.p2 - segunda.p2;
  assert.ok(
    pagoP1 !== 1 || pagoP2 !== 2,
    `p1 vuelve a pagar la ciega pequeña: no rota (p1 ${pagoP1}, p2 ${pagoP2})`,
  );
});

test("REGRESIÓN: el sobre se lee del User, no del diferencial", async () => {
  // La segunda propuesta de un mismo cliente llega con un diff que solo trae
  // las claves cambiadas: sin `sessionId` ni época. Si el cableado leyera el
  // sobre del diff en vez del documento ya actualizado, la segunda acción de un
  // jugador se caería. Dos acciones seguidas del mismo cliente lo fijan.
  const mesa = await crearMundo();
  const [p1, p2] = mesa.jugadores;
  mesa.gm.conHooks(() => mesa.gm.wiring.abrirMesa({ id: "mesa-1", nombreJuego: "poker" }));

  await mesa.proponer(p1, "join");
  await mesa.proponer(p2, "join");
  await mesa.proponer(mesa.gm, "start");

  const enTurno = mesa.juego()?.turno;
  const clienteEnTurno = [p1, p2].find((c) => c.id === enTurno);
  await mesa.proponer(clienteEnTurno, "act", { tipo: "fold" });
  // Segunda propuesta del MISMO cliente, ya con el flag existente.
  await mesa.proponer(mesa.gm, "start");
  assert.equal(mesa.publico()?.manoEnCurso, true, "la segunda propuesta del GM se perdió");
});

test("el que se desconecta no recibe vistas dirigidas, y al volver las pide", async () => {
  const mesa = await mesaRepartida();
  const [p1, p2] = mesa.jugadores;

  const antes = p1.recibidas.length;
  p1.conectado = false;
  const enTurno = mesa.juego()?.turno;
  await mesa.proponer([p1, p2].find((c) => c.id === enTurno), "act", { tipo: "fold" });
  assert.equal(p1.recibidas.length, antes, "un cliente caído no debería recibir nada");

  // Al volver, lo que sirve para entrar es el ajuste de mundo; la vista privada
  // la PIDE el cliente, porque los envíos dirigidos se pierden si el receptor
  // aún no escuchaba.
  p1.conectado = true;
  const vigente = p1.conHooks(() => p1.wiring.estadoPublicoVigente());
  assert.equal(vigente?.id, "mesa-1");
  p1.conHooks(() => p1.wiring.pedirVista());
  assert.ok(p1.recibidas.length > antes, "pedir la vista tras reconectar no devolvió nada");
});

test("el GM que recarga readopta su propia mesa: sin semilla no se reanuda la mano", async () => {
  const mesa = await mesaRepartida();
  const publicoAntes = mesa.publico();
  assert.equal(publicoAntes.manoEnCurso, true);
  assert.equal(publicoAntes.coordinadorId, "gm");

  // F5 del GM: mismo id y sigue figurando como coordinador —un ajuste de mundo
  // no se entera de una recarga— pero ha perdido semilla, mazo y manos. Lo que
  // dispara el relevo es NO tener la sesión viva, no quién figure en el público.
  await mesa.arrancar(mesa.gm, "&recarga=1");

  const despues = mesa.publico();
  assert.equal(despues.manoEnCurso, false, "la mano debería cancelarse: sin semilla no hay forma honesta de seguirla");
  assert.ok(
    despues.epocaCoordinador > publicoAntes.epocaCoordinador,
    "la época tiene que subir para invalidar los sobres en vuelo del coordinador anterior",
  );
  assert.equal(despues.id, "mesa-1", "la mesa sobrevive al relevo; lo que muere es la mano");
  // El relevo se anuncia para que la UI pueda explicarlo: una mano que
  // desaparece sin decir por qué se lee como un fallo de la mesa.
  assert.ok(mesa.gm.relevos.length > 0, "el relevo no anunció `lagunakMinijuegoRelevoCoordinador`");
});
