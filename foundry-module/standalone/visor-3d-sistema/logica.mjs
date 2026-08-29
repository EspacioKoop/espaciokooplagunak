// Lógica pura del visor de sistema planetario 3D.
// Sin dependencias de Three.js ni de Foundry: todo es matemática con números
// y vectores planos {x,y,z}, de modo que se puede testear desde Node sin navegador.
// El render (visor.mjs) importa estas funciones; la vista no contamina la lógica.

export const RADIO_ESTRELLA = 1.2; // unidades de escena para la estrella
export const RADIO_PLANETA_MIN = 0.12; // suelo visual para no desaparecer

// Normaliza un vector plano; devuelve {x:0,y:0,z:0} si es nulo.
export function normalizar(v) {
  const m = Math.hypot(v.x, v.y, v.z);
  if (m === 0) return { x: 0, y: 0, z: 0 };
  return { x: v.x / m, y: v.y / m, z: v.z / m };
}

// Ordena cuerpos para pintar: la estrella primero y luego por semieje orbital
// ascendente. No muta la entrada.
export function ordenarCuerpos(cuerpos) {
  const semieje = (c) => (c.tipo === "estrella" ? -1 : (c.orbita?.semiEje ?? 0));
  return [...cuerpos].sort((a, b) => semieje(a) - semieje(b));
}

// Posición de un cuerpo sobre su órbita en el instante t (segundos).
// Plano XZ con inclinación alrededor del eje X. La estrella (semieje 0) se
// queda en el origen. Es periódica: pos(t) == pos(t + 2π/velocidadAngular).
export function posicionOrbita(cuerpo, t) {
  const o = cuerpo.orbita ?? { semiEje: 0, velocidadAngular: 0, fase: 0, inclinacion: 0 };
  const r = o.semiEje ?? 0;
  const vel = o.velocidadAngular ?? 0;
  const fase = o.fase ?? 0;
  const inc = o.inclinacion ?? 0;
  const ang = fase + vel * t;
  return {
    x: r * Math.cos(ang),
    y: r * Math.sin(ang) * Math.sin(inc),
    z: r * Math.sin(ang) * Math.cos(inc),
  };
}

// Radio visual de un cuerpo en unidades de escena. La estrella es fija; los
// planetas usan una escala suave (logarítmica) para que un gigante gaseoso no
// devore a una supertierra. Monótona y positiva respecto a `radioRelativo`.
export function radioVisual(cuerpo) {
  if (cuerpo.tipo === "estrella") return RADIO_ESTRELLA;
  const rr = Math.max(cuerpo.radioRelativo ?? 1, 1e-3);
  return RADIO_PLANETA_MIN + 0.18 * Math.log10(rr + 1);
}

// ¿El cuerpo tiene anillo dibujable? Solo planetas con la bandera activa.
export function anilloActivo(cuerpo) {
  return cuerpo.tipo !== "estrella" && Boolean(cuerpo.anillo);
}

// Cuerpo más cercano a un rayo (origen + dirección) entre las posiciones dadas.
// Devuelve { indice, distancia }; ignora los cuerpos por detrás del origen
// (proyección t <= 0) y, en empate de distancia, el de menor índice (determinista).
// `posiciones` debe alinearse con `cuerpos`.
export function cuerpoMasCercanoAlRayo(cuerpos, origen, direccion, posiciones) {
  const d = normalizar(direccion);
  let mejor = -1;
  let mejorD = Infinity;
  for (let i = 0; i < cuerpos.length; i += 1) {
    const p = posiciones[i];
    const ox = p.x - origen.x;
    const oy = p.y - origen.y;
    const oz = p.z - origen.z;
    const t = ox * d.x + oy * d.y + oz * d.z; // proyección sobre la dirección
    if (t <= 0) continue; // está detrás de la cámara
    const cx = origen.x + d.x * t;
    const cy = origen.y + d.y * t;
    const cz = origen.z + d.z * t;
    const dist = Math.hypot(p.x - cx, p.y - cy, p.z - cz);
    if (dist < mejorD) {
      mejorD = dist;
      mejor = i;
    }
  }
  return { indice: mejor, distancia: mejorD };
}
