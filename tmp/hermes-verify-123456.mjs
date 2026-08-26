import assert from 'node:assert/strict';
import { repartirBotes } from '../foundry-module/scripts/minijuegos/pozos.mjs';
// simple pot
const jugadores=[{userId:'a',apostadoTotal:100,retirado:false},{userId:'b',apostadoTotal:100,retirado:false}];
const evaluaciones=new Map([['a',1],['b',0]]);
const {ganancias}=repartirBotes(jugadores,evaluaciones);
assert.equal(ganancias.get('a'),200); assert.equal(ganancias.get('b'),0);
console.log('ok');