// OTACON Astra — loopback-only, read-only, no directory listings or credentials.
import http from "node:http";
import { readFile, realpath } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
const root = fileURLToPath(new URL("../../", import.meta.url));
export async function serve(port = 0) {
  const server = http.createServer(async (req, res) => {
    try {
      const name = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      ).replace(/^\//, "");
      if (!["GET", "HEAD"].includes(req.method)) throw new Error();
      if (
        !name.startsWith("tools/scene-engine/") &&
        !name.startsWith("foundry-module/scripts/")
      )
        throw new Error();
      if (name.split("/").some((p) => p.startsWith(".") || p === "output"))
        throw new Error();
      const file = await realpath(path.join(root, name));
      if (
        !file.startsWith(root) ||
        ![".html", ".mjs", ".js", ".css", ".md"].includes(path.extname(file))
      )
        throw new Error();
      const data = await readFile(file),
        mime = {
          ".html": "text/html",
          ".mjs": "text/javascript",
          ".js": "text/javascript",
          ".css": "text/css",
          ".md": "text/plain",
        };
      res.writeHead(200, {
        "Content-Type": mime[path.extname(file)] + "; charset=utf-8",
        "Cache-Control": "no-store",
      });
      res.end(req.method === "HEAD" ? undefined : data);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  return {
    server,
    url: `http://127.0.0.1:${server.address().port}/tools/scene-engine/index.html`,
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const { server, url } = await serve(+(process.argv[2] ?? 0));
  console.log(url);
  for (const signal of ["SIGINT", "SIGTERM"])
    process.once(signal, () => server.close());
}
