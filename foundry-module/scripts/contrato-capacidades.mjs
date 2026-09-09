const MODULE_PATTERN = /^[a-z][a-z0-9-]{1,63}$/;
const EVENT_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)+$/;
const CAPABILITY_PATTERN = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;

function requireArray(value, field) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new TypeError(`${field} must be an array of strings`);
  }
  if (new Set(value).size !== value.length) {
    throw new TypeError(`${field} must not contain duplicates`);
  }
}

function requireNames(values, pattern, field) {
  requireArray(values, field);
  if (values.some((value) => !pattern.test(value))) {
    throw new TypeError(`${field} contains an invalid name`);
  }
}

export function validarManifiesto(manifest) {
  if (!manifest || typeof manifest !== "object") throw new TypeError("manifest must be an object");
  if (typeof manifest.module !== "string" || !MODULE_PATTERN.test(manifest.module)) {
    throw new TypeError("module has an invalid name");
  }
  if (typeof manifest.standalone !== "boolean") throw new TypeError("standalone must be boolean");
  requireNames(manifest.produces, EVENT_PATTERN, "produces");
  requireNames(manifest.consumes, EVENT_PATTERN, "consumes");
  requireNames(manifest.capabilities, CAPABILITY_PATTERN, "capabilities");
  const required = manifest.required ?? [];
  requireNames(required, MODULE_PATTERN, "required");
  if (manifest.standalone && required.length > 0) {
    throw new TypeError("standalone modules cannot declare required dependencies");
  }
  return true;
}

export function validarManifiestos(manifests) {
  if (!Array.isArray(manifests)) throw new TypeError("manifests must be an array");
  const modules = new Set();
  for (const manifest of manifests) {
    validarManifiesto(manifest);
    if (modules.has(manifest.module)) throw new TypeError("module names must be unique");
    modules.add(manifest.module);
  }
  for (const manifest of manifests) {
    for (const dependency of manifest.required ?? []) {
      if (!modules.has(dependency)) throw new TypeError(`required module is missing: ${dependency}`);
    }
  }
  return true;
}

export function consumidoresDeEvento(manifests, event) {
  validarManifiestos(manifests);
  if (typeof event !== "string" || !EVENT_PATTERN.test(event)) return [];
  return manifests
    .filter((manifest) => manifest.consumes.includes(event))
    .map((manifest) => manifest.module);
}
