// OTACON Astra — GPL-2.0. Presentation data only: no Foundry, clock or authority.
export const VERSION = 1;
const check = (ok, message) => {
  if (!ok) throw new TypeError(message);
};
const vector = (v, n) =>
  Array.isArray(v) && v.length === n && v.every(Number.isFinite);
const positive = (n) => Number.isFinite(n) && n > 0;
const id = (s) => typeof s === "string" && /^[a-zA-Z0-9_.:-]{1,100}$/.test(s);
export function validateCamera(c) {
  check(
    c &&
      vector(c.position, 3) &&
      Number.isFinite(c.yaw) &&
      Number.isFinite(c.pitch),
    "camera pose",
  );
  check(
    Math.abs(c.pitch) < Math.PI / 2 &&
      c.fov > 1 &&
      c.fov < 179 &&
      positive(c.near) &&
      c.far > c.near &&
      Number.isFinite(c.far),
    "camera frustum",
  );
  return c;
}
export function validateScene(s) {
  check(s?.version === VERSION, "scene version");
  check(
    s.depth === "test-write" && s.pixelPolicy === "integer-or-crop",
    "presentation policy",
  );
  check(
    vector(s.logicalSize, 2) &&
      s.logicalSize.every((n) => Number.isInteger(n) && n > 0 && n <= 2048),
    "logical size",
  );
  check(/^#[0-9a-f]{6}$/i.test(s.background), "background");
  check(
    Number.isInteger(s.screenBand) &&
      s.screenBand >= 0 &&
      s.screenBand < s.logicalSize[1],
    "screen band",
  );
  validateCamera(s.camera);
  check(
    vector(s.light.direction, 3) &&
      Math.hypot(...s.light.direction) > 0 &&
      s.light.ambient >= 0 &&
      s.light.ambient <= 1 &&
      Number.isInteger(s.light.steps) &&
      s.light.steps === 16,
    "light",
  );
  for (const [key, m] of Object.entries(s.materials)) {
    check(
      id(key) &&
        /^#[0-9a-f]{6}$/i.test(m.color) &&
        ["flat", "unlit"].includes(m.shading) &&
        m.alpha === "opaque",
      "material",
    );
  }
  for (const [key, m] of Object.entries(s.meshes)) {
    check(
      id(key) &&
        Array.isArray(m.positions) &&
        m.positions.length > 0 &&
        m.positions.every((v) => vector(v, 3)),
      "mesh positions",
    );
    check(
      Array.isArray(m.triangles) &&
        m.triangles.every(
          (t) =>
            vector(t, 3) &&
            t.every(
              (i) => Number.isInteger(i) && i >= 0 && i < m.positions.length,
            ),
        ),
      "mesh indices",
    );
  }
  for (const a of Object.values(s.atlases)) {
    check(
      Number.isInteger(a.width) &&
        a.width > 0 &&
        Number.isInteger(a.height) &&
        a.height > 0 &&
        a.width <= 2048 &&
        a.height <= 2048,
      "atlas size",
    );
    check(
      Array.isArray(a.rgba) &&
        a.rgba.length === a.width * a.height * 4 &&
        a.rgba.every((n) => Number.isInteger(n) && n >= 0 && n <= 255),
      "atlas pixels",
    );
    check(a.sampling === "nearest" && a.alpha === "cutout", "atlas policy");
    check(
      a.rgba.every((n, i) => i % 4 !== 3 || n === 0 || n === 255),
      "binary alpha only",
    );
  }
  check(Array.isArray(s.entities) && s.entities.length <= 10000, "entities");
  const ids = new Set();
  for (const e of s.entities) {
    check(id(e.id) && !ids.has(e.id), "entity identity");
    ids.add(e.id);
    check(["group", "mesh", "sprite"].includes(e.kind), "entity kind");
    check(
      vector(e.transform?.position, 3) &&
        vector(e.transform.rotation, 3) &&
        positive(e.transform.scale),
      "transform",
    );
    check(e.layer === "world" || e.layer === "screen", "layer");
    if (e.kind === "mesh")
      check(
        s.meshes[e.mesh] && s.materials[e.material] && e.layer === "world",
        "mesh references",
      );
    if (e.kind === "sprite") {
      const a = s.atlases[e.atlas];
      check(
        a && vector(e.frame, 4) && e.frame.every(Number.isInteger),
        "sprite frame",
      );
      const [x, y, w, h] = e.frame;
      check(
        x >= 0 &&
          y >= 0 &&
          w > 0 &&
          h > 0 &&
          x + w <= a.width &&
          y + h <= a.height &&
          vector(e.pivot, 2) &&
          positive(e.pixelSize),
        "sprite bounds",
      );
      check(
        e.pivot.every((n) => n >= 0 && n <= 1),
        "sprite pivot",
      );
      if (e.layer === "screen")
        check(
          !e.parent &&
            e.transform.rotation.every((n) => n === 0) &&
            Number.isInteger(e.pixelSize * e.transform.scale) &&
            e.transform.position.every(Number.isInteger),
          "screen pixel grid",
        );
    }
  }
  const byId = new Map(s.entities.map((e) => [e.id, e]));
  for (const e of s.entities) {
    const seen = new Set([e.id]);
    let p = e.parent;
    while (p) {
      check(byId.has(p) && !seen.has(p), "parent missing or cycle");
      seen.add(p);
      check(byId.get(p).layer === e.layer, "parent layer");
      p = byId.get(p).parent;
    }
  }
  return s;
}
export function pixelViewport(width, height, logicalSize) {
  check(
    vector([width, height], 2) && width >= 0 && height >= 0,
    "viewport size",
  );
  const [w, h] = logicalSize;
  const scale = Math.max(1, Math.floor(Math.min(width / w, height / h)));
  return {
    scale,
    width: w * scale,
    height: h * scale,
    x: Math.floor((width - w * scale) / 2),
    y: Math.floor((height - h * scale) / 2),
    cropped: width < w || height < h,
  };
}
export function logicalPoint(x, y, viewport, logicalSize) {
  const p = [
    (x - viewport.x) / viewport.scale,
    (y - viewport.y) / viewport.scale,
  ];
  return p[0] >= 0 &&
    p[1] >= 0 &&
    p[0] < logicalSize[0] &&
    p[1] < logicalSize[1]
    ? p
    : null;
}
export const identityTransform = () => ({
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: 1,
});
// Column-major, Y yaw -> X pitch -> Z roll, positive uniform scale only.
export function transformMatrix(t) {
  const [yaw, pitch, roll] = t.rotation,
    cy = Math.cos(yaw),
    sy = Math.sin(yaw),
    cp = Math.cos(pitch),
    sp = Math.sin(pitch),
    cr = Math.cos(roll),
    sr = Math.sin(roll),
    k = t.scale;
  return [
    (cr * cy - sr * sp * sy) * k,
    (sr * cy + cr * sp * sy) * k,
    -cp * sy * k,
    0,
    -sr * cp * k,
    cr * cp * k,
    sp * k,
    0,
    (cr * sy + sr * sp * cy) * k,
    (sr * sy - cr * sp * cy) * k,
    cp * cy * k,
    0,
    ...t.position,
    1,
  ];
}
export function multiply(a, b) {
  return Array.from({ length: 16 }, (_, i) => {
    const r = i % 4,
      c = Math.floor(i / 4);
    return [0, 1, 2, 3].reduce((v, k) => v + a[k * 4 + r] * b[c * 4 + k], 0);
  });
}
export function point(m, p) {
  return [0, 1, 2].map(
    (r) => m[r] * p[0] + m[4 + r] * p[1] + m[8 + r] * p[2] + m[12 + r],
  );
}
// Pose overrides are ephemeral presentation, never simulation state. Resources
// and entity membership remain fixed for one backend instance.
export function presentationEntities(entities, poses = {}) {
  check(
    poses && typeof poses === "object" && !Array.isArray(poses),
    "presentation poses",
  );
  const ids = new Set(entities.map((e) => e.id));
  for (const [key, t] of Object.entries(poses)) {
    check(
      ids.has(key) &&
        vector(t?.position, 3) &&
        vector(t.rotation, 3) &&
        positive(t.scale),
      "presentation transform",
    );
    const e = entities.find((entity) => entity.id === key);
    check(e.layer === "world", "screen poses require scene reconstruction");
  }
  return entities.map((e) =>
    Object.hasOwn(poses, e.id) ? { ...e, transform: poses[e.id] } : e,
  );
}
export function worldMatrices(entities) {
  const byId = new Map(entities.map((e) => [e.id, e])),
    result = new Map();
  function resolve(e) {
    if (!result.has(e.id)) {
      let m = transformMatrix(e.transform);
      if (e.parent) m = multiply(resolve(byId.get(e.parent)), m);
      result.set(e.id, m);
    }
    return result.get(e.id);
  }
  entities.forEach(resolve);
  return result;
}
export function cameraPoint(p, c) {
  const [x, y, z] = p.map((v, i) => v - c.position[i]),
    cy = Math.cos(c.yaw),
    sy = Math.sin(c.yaw),
    cp = Math.cos(c.pitch),
    sp = Math.sin(c.pitch);
  return [
    cy * x - sy * z,
    -sy * sp * x + cp * y - cy * sp * z,
    sy * cp * x + sp * y + cy * cp * z,
  ];
}
export function cameraDirection(p, c) {
  return cameraPoint(p, { ...c, position: [0, 0, 0] });
}
export function spriteRect(e) {
  const w = e.frame[2] * e.pixelSize,
    h = e.frame[3] * e.pixelSize;
  return {
    left: -e.pivot[0] * w,
    right: (1 - e.pivot[0]) * w,
    bottom: -(1 - e.pivot[1]) * h,
    top: e.pivot[1] * h,
  };
}
