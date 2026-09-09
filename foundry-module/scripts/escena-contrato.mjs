// Contrato mínimo versionado para una escena render-agnóstica.
//
// Guarda la división entre estado autoritativo, presentación y recursos; nunca
// incluye permisos ni decisiones de render dentro del dato de escena.

export const SCENE_CONTRACT_VERSION = "1.0.0";

const VALID_PROJECTIONS = Object.freeze(["perspective", "orthographic"]);

const emptyScene = Object.freeze({
  version: SCENE_CONTRACT_VERSION,
  revision: 0,
  state: { authoritative: false, entities: [] },
  presentation: {
    camera: {
      position: { x: 0, y: 0, z: 0 },
      projection: "perspective",
    },
    entities: [],
  },
  resources: [],
});

function cloneValue(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((entry) => cloneValue(entry));
  if (typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, cloneValue(entry)]));
  return value;
}

function asNumber(value, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return fallback;
}

function normalizeVector3(value, fallback = 0) {
  const src = value && typeof value === "object" ? value : {};
  return {
    x: asNumber(src.x, fallback),
    y: asNumber(src.y, fallback),
    z: asNumber(src.z, fallback),
  };
}

function normalizeCamera(value) {
  const src = value && typeof value === "object" ? value : {};
  return {
    position: normalizeVector3(src.position),
    projection: VALID_PROJECTIONS.includes(src.projection) ? src.projection : "perspective",
  };
}

function normalizeEntityPresentation(value) {
  const src = value && typeof value === "object" ? value : {};
  const transform = src.transform && typeof src.transform === "object" ? src.transform : {};
  const position = normalizeVector3(transform.position, 0);
  const rotation = normalizeVector3(transform.rotation, 0);
  // Una escala ausente significa "tamaño natural" (1), no "colapsada a un
  // punto" (0): compartía el mismo default 0 que posición/rotación, que es
  // correcto para ellas pero borra la entidad visualmente para la escala.
  const scale = normalizeVector3(transform.scale, 1);
  return {
    id: typeof src.id === "string" ? src.id : null,
    kind: typeof src.kind === "string" ? src.kind : "mesh",
    material: src.material && typeof src.material === "object" ? { ...src.material } : null,
    transform: { position, rotation, scale },
    interaction: src.interaction && typeof src.interaction === "object" ? { ...src.interaction } : null,
    visibility: src.visibility && typeof src.visibility === "object" ? { ...src.visibility } : { render: true },
    // Una entidad de presentación puede colgar de otra (jerarquía) y puede
    // apuntar a un recurso del array `resources`; ambos campos se
    // descartaban en la normalización sin que ningún test lo notara.
    parentId: typeof src.parentId === "string" ? src.parentId : null,
    resourceId: typeof src.resourceId === "string" ? src.resourceId : null,
  };
}

function normalizeResource(value) {
  const src = value && typeof value === "object" ? value : {};
  return {
    id: typeof src.id === "string" ? src.id : null,
    type: typeof src.type === "string" ? src.type : "generic",
    url: typeof src.url === "string" ? src.url : "",
  };
}

export function normalizarEscena(input = {}) {
  const source = cloneValue(input ?? {});
  const version = source.version === SCENE_CONTRACT_VERSION ? SCENE_CONTRACT_VERSION : SCENE_CONTRACT_VERSION;
  const revision = Number.isInteger(source.revision) && source.revision >= 0 ? source.revision : 0;
  const state = source.state && typeof source.state === "object" ? source.state : { authoritative: false, entities: [] };
  const presentation = source.presentation && typeof source.presentation === "object" ? source.presentation : { camera: { position: { x: 0, y: 0, z: 0 }, projection: "perspective" }, entities: [] };

  const normalized = {
    version,
    revision,
    state: {
      authoritative: Boolean(state.authoritative),
      entities: Array.isArray(state.entities) ? state.entities.map((entity) => ({ ...entity })) : [],
    },
    presentation: {
      camera: normalizeCamera(presentation.camera),
      entities: Array.isArray(presentation.entities)
        ? presentation.entities.map((entity) => normalizeEntityPresentation(entity))
        : [],
    },
    resources: Array.isArray(source.resources) ? source.resources.map((resource) => normalizeResource(resource)) : [],
  };

  if (source.selection && typeof source.selection === "object") {
    normalized.selection = {
      id: typeof source.selection.id === "string" ? source.selection.id : null,
      source: typeof source.selection.source === "string" ? source.selection.source : "client",
    };
  }

  return normalized;
}

export function validarEscena(escena) {
  // La validación mira la entrada CRUDA, antes de que normalizarEscena
  // aplique ningún default: normalizar primero y validar el resultado hacía
  // inalcanzable cualquier rama de error, porque normalizarEscena sustituye
  // todo valor inválido por uno válido (version siempre se fuerza a la
  // versión soportada, revision negativa cae a 0, authoritative se
  // convierte a booleano con Boolean(), projection desconocida cae a
  // "perspective"...).
  const source = cloneValue(escena && typeof escena === "object" ? escena : {});
  const errors = [];

  if (source.version !== SCENE_CONTRACT_VERSION) {
    errors.push("version: contrato no soportado");
  }
  if (!Number.isInteger(source.revision) || source.revision < 0) {
    errors.push("revision: debe ser un entero no negativo");
  }
  const rawState = source.state && typeof source.state === "object" ? source.state : {};
  if (typeof rawState.authoritative !== "boolean") {
    errors.push("state.authoritative: debe ser booleano");
  }
  const rawPresentation = source.presentation && typeof source.presentation === "object" ? source.presentation : null;
  const rawCamera = rawPresentation && typeof rawPresentation.camera === "object" ? rawPresentation.camera : null;
  if (!rawCamera) {
    errors.push("presentation.camera: faltan datos de cámara");
  } else if (!VALID_PROJECTIONS.includes(rawCamera.projection)) {
    errors.push("presentation.camera.projection: proyección no soportada");
  }

  const normalized = normalizarEscena(escena);

  for (const entity of normalized.presentation.entities) {
    if (!entity || typeof entity.id !== "string" || entity.id.trim() === "") {
      errors.push("presentation.entities: id no válido");
      break;
    }
  }

  for (const resource of normalized.resources) {
    if (!resource || typeof resource.id !== "string" || resource.id.trim() === "") {
      errors.push("resources: id no válido");
      break;
    }
  }

  return { ok: errors.length === 0, errors };
}

export function serializarEscena(escena) {
  const normalized = normalizarEscena(escena);
  return JSON.stringify(normalized, null, 2);
}
