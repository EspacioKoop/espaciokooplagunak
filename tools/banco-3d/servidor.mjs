// Servidor estático mínimo para el banco de pruebas (#976): sirve el
// repositorio entero por HTTP para que `index.html` pueda importar los
// módulos de producción con rutas relativas normales, sin build ni bundler.
// Node `http` nativo, sin dependencias — el mismo criterio que ya pide #976
// para `capturar.mjs`.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";

const TIPOS = Object.freeze({
  ".html": "text/html; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
});

/**
 * Arranca un servidor estático sobre `raiz` (por defecto, la raíz del
 * repositorio) en un puerto libre. Devuelve `{ servidor, url, cerrar }`.
 */
export function servirEstatico(raiz, puerto = 0) {
  const raizNormalizada = normalize(raiz);
  const servidor = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      let ruta = decodeURIComponent(url.pathname);
      if (ruta === "/") ruta = "/tools/banco-3d/index.html";
      const destino = normalize(join(raizNormalizada, ruta));
      // Fuera de la raíz servida: ni `..` ni un enlace la sacan de aquí.
      if (!destino.startsWith(raizNormalizada + sep) && destino !== raizNormalizada) {
        res.writeHead(403).end("prohibido");
        return;
      }
      const info = await stat(destino).catch(() => null);
      if (!info || !info.isFile()) {
        res.writeHead(404).end("no encontrado");
        return;
      }
      const cuerpo = await readFile(destino);
      const tipo = TIPOS[extname(destino)] ?? "application/octet-stream";
      res.writeHead(200, { "content-type": tipo });
      res.end(cuerpo);
    } catch (error) {
      res.writeHead(500).end(String(error?.message ?? error));
    }
  });

  return new Promise((resolve) => {
    servidor.listen(puerto, "127.0.0.1", () => {
      const { port } = servidor.address();
      resolve({
        servidor,
        url: `http://127.0.0.1:${port}`,
        cerrar: () => new Promise((r) => servidor.close(() => r())),
      });
    });
  });
}
