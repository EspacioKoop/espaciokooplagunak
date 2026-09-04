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
      // En Foundry la colección tiene a TODOS los usuarios y la conexión se
      // lee de `active`; un desconectado sigue en `contents` con `active` en
      // falso. `cliente` se define más abajo, pero el getter se evalúa tarde.
      get active() {
        return cliente.conectado;
      },
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
    const accionesRecibidas = []; // en paralelo a `recibidas`, mismo índice
    const relevos = [];
    const cliente = {
      id,
      userDoc,
      hooks,
      recibidas, // vistas privadas que ESTE cliente aceptó
      accionesRecibidas,
      relevos,
      conectado: true,
      game: {
        user: userDoc,
        // Imita la COLECCIÓN de Foundry, no un array: producción lee
        // `game.users.contents` y filtra por `u.active`. Con un array pelado y
        // sin `active`, `usuariosConectados()` daba [] y el arnés validaba un
        // reparto que en producción no ocurre.
        get users() {
          const todos = clientes.map((c) => c.userDoc);
          return {
            contents: todos,
            [Symbol.iterator]: () => todos[Symbol.iterator](),
            get: (uid) => todos.find((u) => u.id === uid) ?? null,
            get activeGM() {
              return todos.find((u) => u.active && u.isGM) ?? null;
            },
            filter: (fn) => todos.filter(fn),
            map: (fn) => todos.map(fn),
          };
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

    hooks.on("lagunakMinijuegoVistaPrivada", (vista, acciones) => {
      recibidas.push(vista);
      accionesRecibidas.push(acciones);
    });
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
  // Dispara el hook `updateUser` a pelo, sin pasar por una propuesta: es la
  // única forma de probar que el relevo lo provoca el HOOK y no el camino de
  // la propuesta, que también lo acabaría arreglando y taparía un cableado roto.
  mesa.emitirUpdateUser = (userDoc, changes = {}) => difundirUpdateUser(userDoc, changes);
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

test("REGRESIÓN: el conectado que NO se ha sentado también recibe vista y acciones", async () => {
  // Esta es la ruta que solo existe si `usuariosConectados()` devuelve algo:
  // con lista vacía, `vistasPrivadas` recae en los jugadores SENTADOS y el
  // mirón se queda sin vista, sin poder ofrecerle «sentarse». El fallback hacía
  // que las demás pruebas siguieran en verde y tapaba el agujero.
  const mesa = await crearMundo();
  const [p1, p2] = mesa.jugadores;
  const miron = await mesa.arrancar(mesa.crearCliente("miron"), "-miron");

  mesa.gm.conHooks(() => mesa.gm.wiring.abrirMesa({ id: "mesa-1", nombreJuego: "poker" }));
  await mesa.proponer(p1, "join");
  await mesa.proponer(p2, "join");
  await mesa.proponer(mesa.gm, "start");

  const suya = miron.recibidas.at(-1);
  assert.ok(suya, "el conectado sin sentarse no recibió NINGUNA vista dirigida");
  // Se le manda exactamente la pública: ni mano ni secretos.
  assert.equal(suya.juegoPrivado?.tuMano, undefined, "al mirón le llegó una mano");
  // Y con sus acciones, que es lo que permite a la interfaz ofrecerle entrar.
  const acciones = miron.accionesRecibidas.at(-1);
  assert.ok(acciones, "el mirón recibió vista sin acciones: la ventana no puede ofrecerle nada");
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

test("el relevo de coordinador tiene red de seguridad: el GM anterior sigue conectado pero deja de ser el activo", async () => {
  // Caso que NO detecta `userConnected`: el GM anterior sigue en la partida
  // pero pierde `activeGM`. El módulo lo resuelve en `updateUser` antes de
  // procesar la propuesta, en vez de descartarla.
  const mesa = await crearMundo({ jugadores: ["p1", "p2"] });
  const [p1, p2] = mesa.jugadores;

  // GM abre mesa y reparte
  mesa.gm.conHooks(() => mesa.gm.wiring.abrirMesa({ id: "mesa-1", nombreJuego: "poker" }));
  await mesa.proponer(p1, "join");
  await mesa.proponer(p2, "join");
  await mesa.proponer(mesa.gm, "start");

  const publicoAntes = mesa.publico();
  assert.equal(publicoAntes.coordinadorId, "gm");
  assert.equal(publicoAntes.manoEnCurso, true);
  const epocaAntes = publicoAntes.epocaCoordinador;

  // Simular que otro GM se convierte en el activeGM (p. ej. el GM original
  // pierde el estatus pero sigue conectado). En Foundry esto pasa cuando
  // el GM transfiere el rol sin desconectarse.
  // Creamos un nuevo cliente GM y hacemos que `activeGM` lo devuelva.
  const nuevoGm = await mesa.arrancar(mesa.crearCliente("gm2", { isGM: true }), "-gm2");
  // Sobrescribir el getter activeGM en TODOS los clientes para que devuelva gm2
  for (const c of mesa.clientes) {
    const gameOrig = c.game;
    c.game = {
      ...gameOrig,
      get users() {
        const u = gameOrig.users;
        return { ...u, get activeGM() { return nuevoGm.userDoc; } };
      }
    };
  }

  // El relevo lo tiene que provocar el HOOK, no la propuesta. Se dispara
  // `updateUser` a pelo, con un cambio que no tiene nada que ver con la mesa:
  // si el cableado de `Hooks.on("updateUser", ...)` estuviera roto, esto no
  // haría nada y la comprobación de aquí abajo fallaría. Con la propuesta por
  // delante no se distinguía un hook bien cableado de uno que no existe,
  // porque el camino de la propuesta también acaba llamando a
  // `asegurarCoordinacion()`.
  mesa.emitirUpdateUser(nuevoGm.userDoc, { name: "gm2 renombrado" });

  const trasElHook = mesa.publico();
  assert.equal(
    trasElHook.coordinadorId,
    "gm2",
    "el relevo lo provoca el hook updateUser, no la propuesta que venga después",
  );
  assert.ok(
    trasElHook.epocaCoordinador > epocaAntes,
    "el hook sube la época al relevar, invalidando los sobres del coordinador anterior",
  );

  // El relevo cancela la mano en vuelo, y eso es lo honesto: la semilla, el
  // mazo y las manos vivían en la memoria del GM anterior, así que el nuevo
  // coordinador no puede continuarla sin inventarse las cartas.
  assert.equal(trasElHook.manoEnCurso, false, "la mano en vuelo no sobrevive al relevo");

  // Y ahora lo que de verdad importa: una propuesta que llega DESPUÉS del
  // relevo la atiende el coordinador nuevo, en vez de descartarse por "no hay
  // sesión" —que era el fallo con red de seguridad que cubre esta prueba—.
  await mesa.proponer(nuevoGm, "start");

  const despues = mesa.publico();
  assert.equal(despues.manoEnCurso, true, "la propuesta tras el relevo se atendió, no se descartó");
  assert.equal(despues.coordinadorId, "gm2", "y la atendió el coordinador nuevo");
  assert.ok(
    despues.epocaCoordinador > epocaAntes,
    "la época subió con el relevo, invalidando sobres del anterior",
  );
});

test("la semilla del coordinador nunca sale: no aparece en el estado público ni en el sobre que va al cliente", async () => {
  // La semilla se toma del CSPRNG del entorno (`crypto.getRandomValues`), así
  // que se fija a un valor conocido y se busca ESE número. Antes se buscaba
  // "cualquier entero de 31 bits que no esté en una lista de campos
  // permitidos", y esa lista es el problema: un campo público nuevo y legítimo
  // la rompe con un falso positivo, y una clave secreta que alguien añada a la
  // lista deja pasar la fuga en silencio. Comprobar el valor real no tiene
  // ninguno de los dos modos de fallo.
  const SEMILLA_FIJA = 1234567;
  // `globalThis.crypto` en Node solo tiene getter, así que se sustituye con
  // defineProperty y se restaura el descriptor original.
  const descriptorCrypto = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  let vecesPedida = 0;
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: {
      getRandomValues: (buffer) => {
        vecesPedida += 1;
        buffer[0] = SEMILLA_FIJA;
        return buffer;
      },
    },
  });

  let mesa;
  try {
    mesa = await mesaRepartida();
  } finally {
    Object.defineProperty(globalThis, "crypto", descriptorCrypto);
  }
  const [p1] = mesa.jugadores;

  // Sin esto la prueba sería hueca: si el motor dejara de pedir la semilla al
  // CSPRNG, se buscaría un número que no está en ninguna parte y pasaría sola.
  assert.ok(vecesPedida > 0, "la semilla tiene que salir del CSPRNG que se ha fijado");

  const publico = mesa.publico();
  const vistaPrivada = mesa.manoDe(p1);

  // Con una baraja de por medio, una semilla adivinable es un mazo adivinable.
  assert.deepEqual(
    rutasConValor(publico, SEMILLA_FIJA),
    [],
    "la semilla filtrada en el estado público",
  );
  assert.deepEqual(
    rutasConValor(vistaPrivada, SEMILLA_FIJA),
    [],
    "la semilla filtrada en la vista privada del jugador",
  );

  // Tampoco debe estar en las claves que solo el coordinador puede tener
  const clavesProhibidas = ["semilla", "estadoAleatorio", "mazo", "manos"];
  const rutasSecretas = [];
  function recorrer(obj, ruta = "") {
    if (!obj || typeof obj !== "object") return;
    for (const [k, v] of Object.entries(obj)) {
      if (clavesProhibidas.includes(k)) rutasSecretas.push(`${ruta}.${k}`);
      if (Array.isArray(v)) v.forEach((item, i) => recorrer(item, `${ruta}.${k}[${i}]`));
      else if (v && typeof v === "object") recorrer(v, `${ruta}.${k}`);
    }
  }
  recorrer(publico);
  assert.deepEqual(rutasSecretas, [], `claves secretas en el público: ${rutasSecretas.join(", ")}`);
});

// Dónde aparece un valor exacto dentro de una estructura, con su ruta: un
// fallo tiene que decir POR DÓNDE se escapó, no solo que se escapó.
function rutasConValor(valor, buscado, ruta = "", visitados = new WeakSet()) {
  if (valor === buscado) return [ruta || "(raíz)"];
  if (!valor || typeof valor !== "object") return [];
  if (visitados.has(valor)) return [];
  visitados.add(valor);
  const encontradas = [];
  for (const [k, v] of Object.entries(valor)) {
    encontradas.push(...rutasConValor(v, buscado, `${ruta}.${k}`, visitados));
  }
  return encontradas;
}

test("la entrada de mesa es configurable y afecta al juego: las ciegas de mundo determinan la apuesta inicial", async () => {
  // La entrada (fichas, ciegas) se decide por la mesa vía ajustes de mundo.
  // Verificamos que cambiar los ajustes de mundo cambia lo que se necesita para pagar.
  const mesa = await crearMundo({ jugadores: ["p1", "p2"] });
  const [p1, p2] = mesa.jugadores;

  // Configurar ciegas pequeñas: 5, grandes: 10
  mesa.ajustes.set("espaciokoop-lagunak.minijuegoFichasIniciales", 200); // Valor alto para no limitar stacks
  mesa.ajustes.set("espaciokoop-lagunak.minijuegoCiegaPequena", 5);
  mesa.ajustes.set("espaciokoop-lagunak.minijuegoCiegaGrande", 10);

  mesa.gm.conHooks(() => mesa.gm.wiring.abrirMesa({ id: "mesa-1", nombreJuego: "poker" }));
  await mesa.proponer(p1, "join");
  await mesa.proponer(p2, "join");
  await mesa.proponer(mesa.gm, "start");

  const publico = mesa.publico();
  assert.equal(publico.manoEnCurso, true, "la mano debería estar en curso");
  assert.ok(publico.juegoPublico, "debería haber juego público");

  // Después de las ciegas, la apuesta actual debería ser igual a la ciega grande
  assert.equal(publico.juegoPublico.apuestaActual, 10, "después de las ciegas, la apuesta actual debería ser la ciega grande");
  assert.equal(publico.juegoPublico.subidaMinima, 10, "la subida mínima debería ser igual a la ciega grande");

  // En heads-up (2 jugadores), el pequeño ciego actúa primero preflop
  const enTurno = publico.juegoPublico.turno;
  const jugadorEnTurno = publico.juegoPublico.jugadores.find(j => j.userId === enTurno);
  assert.ok(jugadorEnTurno, "debería haber un jugador cuyo turno sea");

  // Para pagar, este jugador necesita apostar (apuestaActual - apostadoRonda)
  // Después de las ciegas en heads-up:
  // - El jugador con el botón es el pequeño ciego (ha apostado 5, necesita 5 más para llegar a 10)
  // - El otro jugador es el grande ciego (ha apostado 10, necesita 0 más para llegar a 10)
  // Como el pequeño ciego actúa primero, necesita pagar la diferencia para igualar
  const cantidadParaPagar = publico.juegoPublico.apuestaActual - (jugadorEnTurno.apostadoRonda ?? 0);
  assert.equal(cantidadParaPagar, 5, "el jugador cuyo turno es (pequeño ciego en heads-up) debería necesitar apostar 5 para pagar");

  // Verificar que efectivamente puede pagar (tiene suficientes fichas)
  assert.ok((jugadorEnTurno.stack ?? 0) >= cantidadParaPagar, "el jugador debería tener suficientes fichas para pagar");
});
