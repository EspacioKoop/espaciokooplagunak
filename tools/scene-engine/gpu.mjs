// OTACON Astra — reversible Three.js/WebGL2 candidate. No CPU projection.
import * as THREE from "./node_modules/three/build/three.module.js";
import { validateScene, validateCamera, worldMatrices } from "./contract.mjs";
import { spriteRect, presentationEntities } from "./contract.mjs";
const vertexShader = `
  varying vec2 texcoord;
  varying float shade;
  uniform vec3 lightDirection;
  uniform float ambient;
  uniform float steps;
  uniform float unlit;
  void main() {
    texcoord = uv;
    vec3 n = normalize(mat3(modelMatrix) * normal);
    float raw = ambient + (1.0-ambient)*max(0.0,dot(n,normalize(lightDirection)));
    shade = mix(floor(raw*(steps-1.0)+0.5)/(steps-1.0),1.0,unlit);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
  }`;
const fragmentShader = `
  varying vec2 texcoord;
  varying float shade;
  uniform vec3 baseColor;
  uniform sampler2D atlas;
  uniform float textured;
  void main() {
    vec4 texel = texture2D(atlas,texcoord);
    if(textured > 0.5 && texel.a < 0.5) discard;
    vec3 color = mix(baseColor,texel.rgb,textured);
    gl_FragColor = vec4(floor(color*shade*255.0+0.5)/255.0,1.0);
  }`;
function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return new THREE.Vector3(
    ((n >> 16) & 255) / 255,
    ((n >> 8) & 255) / 255,
    (n & 255) / 255,
  );
}
function geometry(mesh) {
  const positions = [],
    normals = [];
  for (const t of mesh.triangles) {
    const [a, b, c] = t.map((i) => new THREE.Vector3(...mesh.positions[i]));
    const n = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
    for (const i of t) {
      positions.push(...mesh.positions[i]);
      normals.push(...n.toArray());
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  g.setAttribute(
    "uv",
    new THREE.Float32BufferAttribute(
      Array((positions.length / 3) * 2).fill(0),
      2,
    ),
  );
  g.computeBoundingSphere();
  return g;
}
export class GPUBackend {
  constructor(canvas, scene, onState = () => {}) {
    validateScene(scene);
    this.canvas = canvas;
    this.scene = scene;
    this.onState = onState;
    this.disposed = false;
    this.lost = false;
    this.resources = new Set();
    this.objects = new Map();
    this.pendingQueries = [];
    this.lastGpuMs = null;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      depth: true,
      stencil: false,
      preserveDrawingBuffer: true,
      powerPreference: "default",
    });
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(...scene.logicalSize, false);
    this.renderer.setClearColor(
      new THREE.Color().setRGB(
        ...rgb(scene.background).toArray(),
        THREE.LinearSRGBColorSpace,
      ),
    );
    this.renderer.autoClear = false;
    this.renderer.info.autoReset = false;
    this.world = new THREE.Scene();
    this.world.scale.z = -1;
    this.screen = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera();
    const [w, h] = scene.logicalSize;
    this.screenCamera = new THREE.OrthographicCamera(0, w, 0, h, 0.1, 10);
    this.screenCamera.position.z = 1;
    const own = (x) => {
      this.resources.add(x);
      return x;
    };
    const textures = new Map(
      Object.entries(scene.atlases).map(([id, a]) => {
        const t = own(
          new THREE.DataTexture(
            new Uint8Array(a.rgba),
            a.width,
            a.height,
            THREE.RGBAFormat,
          ),
        );
        t.magFilter = THREE.NearestFilter;
        t.minFilter = THREE.NearestFilter;
        t.generateMipmaps = false;
        t.flipY = false;
        t.needsUpdate = true;
        return [id, t];
      }),
    );
    const white = own(
      new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1),
    );
    white.needsUpdate = true;
    const geometries = new Map(
      Object.entries(scene.meshes).map(([id, m]) => [id, own(geometry(m))]),
    );
    const material = (m, texture = null) =>
      own(
        new THREE.ShaderMaterial({
          vertexShader,
          fragmentShader,
          depthTest: true,
          depthWrite: true,
          side: THREE.FrontSide,
          uniforms: {
            baseColor: { value: rgb(m.color) },
            atlas: { value: texture ?? white },
            textured: { value: texture ? 1 : 0 },
            unlit: { value: m.shading === "unlit" ? 1 : 0 },
            lightDirection: {
              value: new THREE.Vector3(
                scene.light.direction[0],
                scene.light.direction[1],
                -scene.light.direction[2],
              ),
            },
            ambient: { value: scene.light.ambient },
            steps: { value: scene.light.steps },
          },
        }),
      );
    const materials = new Map(
      Object.entries(scene.materials).map(([id, m]) => [id, material(m)]),
    );
    for (const e of scene.entities) {
      let object;
      if (e.kind === "mesh")
        object = new THREE.Mesh(
          geometries.get(e.mesh),
          materials.get(e.material),
        );
      else if (e.kind === "sprite") {
        const r = spriteRect(e),
          g = own(new THREE.BufferGeometry()),
          [fx, fy, fw, fh] = e.frame,
          a = scene.atlases[e.atlas];
        g.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(
            [
              r.left,
              r.top,
              0,
              r.right,
              r.top,
              0,
              r.right,
              r.bottom,
              0,
              r.left,
              r.bottom,
              0,
            ],
            3,
          ),
        );
        g.setAttribute(
          "normal",
          new THREE.Float32BufferAttribute(
            [0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1],
            3,
          ),
        );
        g.setAttribute(
          "uv",
          new THREE.Float32BufferAttribute(
            [
              fx / a.width,
              fy / a.height,
              (fx + fw) / a.width,
              fy / a.height,
              (fx + fw) / a.width,
              (fy + fh) / a.height,
              fx / a.width,
              (fy + fh) / a.height,
            ],
            2,
          ),
        );
        g.setIndex([0, 1, 2, 0, 2, 3]);
        object = new THREE.Mesh(
          g,
          material(
            { color: scene.background, shading: "unlit" },
            textures.get(e.atlas),
          ),
        );
        if (e.layer === "screen") {
          object.material.side = THREE.DoubleSide;
          object.material.depthTest = false;
          object.material.depthWrite = false;
          object.renderOrder = scene.entities.indexOf(e);
        }
      } else object = new THREE.Group();
      object.matrixAutoUpdate = false;
      object.userData.entityId = e.id;
      (e.layer === "world" ? this.world : this.screen).add(object);
      this.objects.set(e.id, object);
    }
    this.gl = this.renderer.getContext();
    this.timer = this.gl.getExtension("EXT_disjoint_timer_query_webgl2");
    this.handleLost = (event) => {
      event.preventDefault();
      this.lost = true;
      this.pendingQueries = [];
      this.lastGpuMs = null;
      onState("context-lost");
    };
    this.handleRestored = () => {
      // Three rebuilds WebGLBackground with its default black clear color.
      // Reapply presentation state as well as rebuilding GPU resources.
      this.renderer.setClearColor(
        new THREE.Color().setRGB(
          ...rgb(scene.background).toArray(),
          THREE.LinearSRGBColorSpace,
        ),
      );
      this.lost = false;
      this.timer = this.gl.getExtension("EXT_disjoint_timer_query_webgl2");
      onState("ready");
    };
    canvas.addEventListener("webglcontextlost", this.handleLost);
    canvas.addEventListener("webglcontextrestored", this.handleRestored);
  }
  render(camera = this.scene.camera, poses = {}) {
    if (this.disposed) throw new Error("disposed");
    validateCamera(camera);
    if (this.lost) return { cpuMs: 0, gpuMs: null, state: "context-lost" };
    const start = performance.now(),
      s = this.scene;
    this.camera.fov = camera.fov;
    this.camera.aspect = s.logicalSize[0] / s.logicalSize[1];
    this.camera.near = camera.near;
    this.camera.far = camera.far;
    this.camera.position.set(
      camera.position[0],
      camera.position[1],
      -camera.position[2],
    );
    this.camera.rotation.set(camera.pitch, -camera.yaw, 0, "YXZ");
    this.camera.updateProjectionMatrix();
    const matrices = worldMatrices(presentationEntities(s.entities, poses));
    for (const e of s.entities) {
      const object = this.objects.get(e.id);
      object.matrix.fromArray(matrices.get(e.id));
      if (e.layer === "screen" && e.kind === "sprite") {
        // Screen convention is top-left, Y down. Snap the actual top-left,
        // not merely the pivot, so odd-size centred sprites stay on the grid.
        const k = e.transform.scale,
          r = spriteRect(e),
          [x, y] = e.transform.position;
        object.matrix.makeScale(k, -k, k);
        object.matrix.setPosition(
          Math.round(x + r.left * k) - r.left * k,
          Math.round(y - r.top * k) + r.top * k,
          0,
        );
      }
      object.matrixWorldNeedsUpdate = true;
    }
    const gl = this.gl,
      ext = this.timer;
    if (ext) {
      if (gl.getParameter(ext.GPU_DISJOINT_EXT)) {
        this.pendingQueries.forEach((q) => gl.deleteQuery(q));
        this.pendingQueries = [];
        this.lastGpuMs = null;
      }
      while (
        this.pendingQueries.length &&
        gl.getQueryParameter(this.pendingQueries[0], gl.QUERY_RESULT_AVAILABLE)
      ) {
        const q = this.pendingQueries.shift();
        this.lastGpuMs = gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6;
        gl.deleteQuery(q);
      }
    }
    let query = null;
    if (ext && this.pendingQueries.length < 4) {
      query = gl.createQuery();
      gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
    }
    this.renderer.info.reset();
    this.renderer.clear(true, true, true);
    this.renderer.render(this.world, this.camera);
    if (s.screenBand) {
      this.renderer.setScissor(0, 0, s.logicalSize[0], s.screenBand);
      this.renderer.setScissorTest(true);
      this.renderer.clear(true, true, false);
      this.renderer.setScissorTest(false);
    }
    this.renderer.clearDepth();
    this.renderer.render(this.screen, this.screenCamera);
    if (query) {
      gl.endQuery(ext.TIME_ELAPSED_EXT);
      this.pendingQueries.push(query);
    }
    return {
      cpuMs: performance.now() - start,
      gpuMs: this.lastGpuMs,
      drawCalls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      geometries: this.renderer.info.memory.geometries,
      textures: this.renderer.info.memory.textures,
    };
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.canvas.removeEventListener("webglcontextlost", this.handleLost);
    this.canvas.removeEventListener(
      "webglcontextrestored",
      this.handleRestored,
    );
    this.pendingQueries.forEach((q) => this.gl.deleteQuery(q));
    this.pendingQueries = [];
    this.resources.forEach((r) => r.dispose());
    this.resources.clear();
    this.objects.clear();
    this.world.clear();
    this.screen.clear();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
