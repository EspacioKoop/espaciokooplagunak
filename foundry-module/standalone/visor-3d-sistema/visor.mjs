// Render 3D del visor de sistema planetario con Three.js.
// Es la única pieza que depende del navegador; importa la lógica pura de
// ./logica.mjs para no duplicar matemática. No escribe ninguna variable global:
// todo queda dentro de la instancia, de modo que varios visores pueden convivir
// en la misma página sin colisiones. Three.js se carga vía importmap desde CDN
// (ver index.html), así que no hay build ni node_modules.

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  ordenarCuerpos,
  posicionOrbita,
  radioVisual,
  anilloActivo,
  normalizar,
} from "./logica.mjs";
import { aplanarSistema } from "./datos.mjs";

const VELOCIDAD_DEFECTO = 1; // multiplicador de tiempo de simulación

export class VisorSistema3D {
  constructor(contenedor, opciones = {}) {
    this.contenedor =
      typeof contenedor === "string" ? document.getElementById(contenedor) : contenedor;
    if (!this.contenedor) throw new Error("VisorSistema3D: contenedor no encontrado");

    this.sistema = opciones.sistema ?? null;
    this.velocidad = opciones.velocidad ?? VELOCIDAD_DEFECTO;
    this.mostrarOrbitas = opciones.mostrarOrbitas ?? true;

    this._raf = 0;
    this._inicio = performance.now();
    this._nodos = new Map(); // id -> { mesh, cuerpo, padreId }
    this._mallas = []; // para el raycaster
    this._objetivo = new THREE.Vector3();
    this._bucle = this._bucle.bind(this);

    this._construirEscena();
    this._enlazarEventos();
    this.cargarSistema(this.sistema);
    this._raf = requestAnimationFrame(this._bucle);
  }

  _construirEscena() {
    const ancho = this.contenedor.clientWidth || 640;
    const alto = this.contenedor.clientHeight || 480;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio || 1);
    this.renderer.setSize(ancho, alto);
    this.contenedor.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05070f);

    this.camera = new THREE.PerspectiveCamera(55, ancho / alto, 0.1, 1000);
    this.camera.position.set(0, 9, 16);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;

    this.scene.add(new THREE.AmbientLight(0x404a5a, 1.1));
    this._luzEstrella = new THREE.PointLight(0xfff0d0, 2.2, 0, 0.4);
    this.scene.add(this._luzEstrella);
  }

  _enlazarEventos() {
    this._onClick = (e) => this._manejarClick(e);
    this.renderer.domElement.addEventListener("pointerdown", this._onClick);
    this._onResize = () => this._ajustarTamano();
    window.addEventListener("resize", this._onResize);
  }

  // (Re)construye los cuerpos a partir de un sistema. Limpia lo previo.
  cargarSistema(sistema) {
    if (!sistema) return;
    this.sistema = sistema;
    for (const { mesh } of this._nodos.values()) {
      this.scene.remove(mesh);
      mesh.geometry?.dispose?.();
      mesh.material?.dispose?.();
    }
    this._nodos.clear();
    this._mallas = [];

    const planos = new Map(); // id -> nodo para resolver padres (lunas)
    for (const { cuerpo, padre } of aplanarSistema(sistema)) {
      const radio = radioVisual(cuerpo);
      const geo = new THREE.SphereGeometry(radio, 32, 24);
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(cuerpo.color ?? "#cccccc"),
        roughness: 0.85,
        metalness: 0.05,
        emissive: cuerpo.tipo === "estrella" ? new THREE.Color(cuerpo.color ?? "#ffd27f") : new THREE.Color(0x000000),
        emissiveIntensity: cuerpo.tipo === "estrella" ? 0.9 : 0,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.userData.id = cuerpo.id;
      this.scene.add(mesh);

      let orbitaMalla = null;
      if (this.mostrarOrbitas && (cuerpo.orbita?.semiEje ?? 0) > 0) {
        orbitaMalla = this._crearOrbita(cuerpo.orbita);
        this.scene.add(orbitaMalla);
      }

      const nodo = { mesh, cuerpo, padreId: padre, orbitaMalla };
      this._nodos.set(cuerpo.id, nodo);
      this._mallas.push(mesh);
      planos.set(cuerpo.id, nodo);
    }
  }

  _crearOrbita(orbita) {
    const segs = 128;
    const puntos = [];
    for (let i = 0; i <= segs; i += 1) {
      const a = (i / segs) * Math.PI * 2;
      puntos.push(
        new THREE.Vector3(
          orbita.semiEje * Math.cos(a),
          orbita.semiEje * Math.sin(a) * Math.sin(orbita.inclinacion ?? 0),
          orbita.semiEje * Math.sin(a) * Math.cos(orbita.inclinacion ?? 0),
        ),
      );
    }
    const geo = new THREE.BufferGeometry().setFromPoints(puntos);
    const mat = new THREE.LineBasicMaterial({ color: 0x335577, transparent: true, opacity: 0.5 });
    return new THREE.LineLoop(geo, mat);
  }

  _posicionMundo(nodo, t) {
    const base = posicionOrbita(nodo.cuerpo, t);
    if (nodo.padreId) {
      const padre = this._nodos.get(nodo.padreId);
      if (padre) {
        const p = padre.mesh.position;
        return { x: p.x + base.x, y: p.y + base.y, z: p.z + base.z };
      }
    }
    return base;
  }

  _bucle() {
    const t = ((performance.now() - this._inicio) / 1000) * this.velocidad;

    for (const nodo of this._nodos.values()) {
      const pos = this._posicionMundo(nodo, t);
      nodo.mesh.position.set(pos.x, pos.y, pos.z);
      nodo.mesh.rotation.y += 0.01;
    }
    // La luz de la estrella sigue a la estrella (cuerpo en el origen si no orbita).
    const estrella = [...this._nodos.values()].find((n) => n.cuerpo.tipo === "estrella");
    if (estrella) this._luzEstrella.position.copy(estrella.mesh.position);

    // Suaviza el objetivo de la cámara (click-para-enfocar).
    this.controls.target.lerp(this._objetivo, 0.12);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this._raf = requestAnimationFrame(this._bucle);
  }

  _manejarClick(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this._raycaster = this._raycaster ?? new THREE.Raycaster();
    this._raycaster.setFromCamera({ x: nx, y: ny }, this.camera);
    const golpes = this._raycaster.intersectObjects(this._mallas, false);
    if (golpes.length === 0) return;
    const id = golpes[0].object.userData.id;
    this.enfocar(id);
  }

  // Lleva la cámara y el objetivo al cuerpo indicado por id.
  enfocar(id) {
    const nodo = this._nodos.get(id);
    if (!nodo) return;
    const p = nodo.mesh.position;
    this._objetivo.set(p.x, p.y, p.z);
    const radio = radioVisual(nodo.cuerpo);
    const distancia = Math.max(radio * 4, 2.5);
    const dir = normalizar({
      x: this.camera.position.x - p.x,
      y: this.camera.position.y - p.y,
      z: this.camera.position.z - p.z,
    });
    this.camera.position.set(p.x + dir.x * distancia, p.y + dir.y * distancia + radio, p.z + dir.z * distancia);
  }

  _ajustarTamano() {
    const ancho = this.contenedor.clientWidth || 640;
    const alto = this.contenedor.clientHeight || 480;
    this.camera.aspect = ancho / alto;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(ancho, alto);
  }

  // Libera recursos GPU y listeners. Llamar al quitar el visor de la página.
  dispose() {
    cancelAnimationFrame(this._raf);
    this.renderer.domElement.removeEventListener("pointerdown", this._onClick);
    window.removeEventListener("resize", this._onResize);
    for (const nodo of this._nodos.values()) {
      nodo.mesh.geometry?.dispose?.();
      nodo.mesh.material?.dispose?.();
      nodo.orbitaMalla?.geometry?.dispose?.();
      nodo.orbitaMalla?.material?.dispose?.();
    }
    this.controls.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.contenedor) {
      this.contenedor.removeChild(this.renderer.domElement);
    }
    this._nodos.clear();
  }
}

// Helper de arranque: monta el visor en el elemento con el id dado.
// Devuelve la instancia para poder llamar a dispose() más tarde.
export function montarEnElemento(id, opciones = {}) {
  return new VisorSistema3D(id, opciones);
}
