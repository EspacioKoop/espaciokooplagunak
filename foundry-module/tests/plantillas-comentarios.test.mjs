import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Guarda de comentarios de Handlebars en las plantillas.
//
// Un comentario corto `{{! ... }}` termina en el PRIMER `}}`. Si el texto del
// comentario menciona una expresión —`{{#each tabs}}`, `{{localize ...}}`— el
// comentario se cierra ahí y el resto de la frase se emite como TEXTO del
// documento.
//
// Por qué merece una prueba y no una convención: el fallo es silencioso en
// todos los eslabones menos el último. La plantilla compila, Handlebars no se
// queja, y en Foundry v12+ el texto suelto solo se ve raro. Pero en v11
// `Application._renderInner` hace `$(html)`, y jQuery interpreta una cadena que
// no empiece por `<` como un selector CSS: lanza «unrecognized expression» y la
// ventana **no abre**. Eso es lo que le pasó a la consola caliente desde #276
// (commit ca49a7bf) hasta que un smoke real en v11 lo destapó, con toda la
// suite Node en verde todo ese tiempo.
//
// La forma correcta cuando el texto menciona expresiones es la de bloque,
// `{{!-- ... --}}`, que sí admite `}}` dentro.

const raizPlantillas = join(dirname(fileURLToPath(import.meta.url)), "..", "templates");

function plantillas() {
  return readdirSync(raizPlantillas).filter((nombre) => nombre.endsWith(".hbs"));
}

/**
 * Devuelve las fugas de un archivo: comentarios cortos cuyo cuerpo, hasta el
 * primer `}}`, contiene un `{{`. Cada fuga trae el texto que se escaparía, que
 * es lo único que hace el fallo reconocible al leer el informe.
 */
function fugas(fuente) {
  const encontradas = [];
  const patron = /\{\{!(?!--)/g;
  for (const coincidencia of fuente.matchAll(patron)) {
    const inicio = coincidencia.index + coincidencia[0].length;
    const cierre = fuente.indexOf("}}", inicio);
    if (cierre === -1) continue;
    const cuerpo = fuente.slice(inicio, cierre);
    if (!cuerpo.includes("{{")) continue;
    const linea = fuente.slice(0, coincidencia.index).split("\n").length;
    const resto = fuente.slice(cierre + 2);
    const finFuga = resto.indexOf("}}");
    encontradas.push({
      linea,
      escapa: (finFuga === -1 ? resto.slice(0, 80) : resto.slice(0, finFuga + 2)).trim(),
    });
  }
  return encontradas;
}

test("ningún comentario corto de Handlebars menciona una expresión y se cierra antes de tiempo", () => {
  const problemas = [];
  for (const nombre of plantillas()) {
    for (const fuga of fugas(readFileSync(join(raizPlantillas, nombre), "utf8"))) {
      problemas.push(`  templates/${nombre}:${fuga.linea} escaparía como texto: ${JSON.stringify(fuga.escapa)}`);
    }
  }
  assert.deepEqual(
    problemas,
    [],
    "Comentarios que se cierran en su primer `}}` y vuelcan el resto al documento:\n" +
      problemas.join("\n") +
      "\n\nUsa la forma de bloque `{{!-- ... --}}`, que admite `}}` dentro. En v11 " +
      "esto no es cosmético: `$(html)` con texto delante del primer `<` lanza " +
      "«unrecognized expression» y la ventana no abre.",
  );
});

test("el detector encuentra de verdad el caso que motivó la guarda", () => {
  // Sin esto, un detector roto daría el mismo verde que un repositorio limpio —
  // que es exactamente el modo de fallo que esta prueba existe para cerrar.
  const roto = "{{! menciona {{#each tabs}}, y esto se escapa. }}\n<div></div>";
  const detectadas = fugas(roto);
  assert.equal(detectadas.length, 1);
  assert.equal(detectadas[0].linea, 1);
  assert.ok(detectadas[0].escapa.startsWith(", y esto se escapa."));

  // Y no da falsos positivos en los dos casos legítimos.
  assert.deepEqual(fugas("{{!-- menciona {{#each tabs}} sin problema --}}\n<div></div>"), []);
  assert.deepEqual(fugas("{{! comentario normal sin expresiones }}\n<div></div>"), []);
});

test("todo comentario de bloque está cerrado", () => {
  // Agujero real de la primera versión de esta guarda: al arreglar el comentario
  // de `consola-caliente.hbs` se perdió su cierre, y la prueba de «empieza por
  // markup» siguió pasando porque el comentario sin cerrar se comía la cabecera
  // entera y dejaba a la vista el <nav> de más abajo, que también empieza por
  // `<`. Contar delimitadores es lo que distingue «bien cerrado» de «se ha
  // tragado media plantilla».
  for (const nombre of plantillas()) {
    const fuente = readFileSync(join(raizPlantillas, nombre), "utf8");
    const abiertos = (fuente.match(/\{\{!--/g) ?? []).length;
    const cerrados = (fuente.match(/--\}\}/g) ?? []).length;
    assert.equal(
      abiertos,
      cerrados,
      `templates/${nombre}: ${abiertos} comentarios de bloque abiertos y ${cerrados} cerrados. ` +
        "Uno sin cerrar se traga todo lo que venga detrás hasta el siguiente cierre.",
    );
  }
});

test("toda plantilla empieza por markup, no por texto: `$(html)` de v11 lo exige", () => {
  // La consecuencia, comprobada aparte de su causa. Un comentario que se cierra
  // antes de tiempo es una forma de romper esto, pero no la única: cualquier
  // texto suelto al principio del archivo lo rompe igual.
  for (const nombre of plantillas()) {
    const fuente = readFileSync(join(raizPlantillas, nombre), "utf8");
    // Se quitan los comentarios bien formados de las dos formas antes de mirar.
    const sinComentarios = fuente
      .replace(/\{\{!--[\s\S]*?--\}\}/g, "")
      .replace(/\{\{![^}]*\}\}/g, "")
      .trim();
    assert.ok(
      sinComentarios.startsWith("<"),
      `templates/${nombre} empieza por texto y no por markup: ${JSON.stringify(sinComentarios.slice(0, 60))}`,
    );
  }
});
