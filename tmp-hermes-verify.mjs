import assert from 'node:assert/strict';
import { repartirBotes } from './foundry-module/scripts/minijuegos/pozos.mjs';

function runTest(name, fn) {
  try {
    fn();
    console.log(`\u2705 ${name}`);
  } catch (e) {
    console.error(`\u274c ${name}: ${e.message}`);
    process.exit(1);
  }
}

runTest('simple pot', () => {
  const jugadores=[{userId:'a',apostadoTotal:100,retirado:false},{userId:'b',apostadoTotal:100,retirado:false}];
  const evaluaciones=new Map([['a',1],['b',0]]);
  const {ganancias}=repartirBotes(jugadores,evaluaciones);
  assert.equal(ganancias.get('a'),200);
  assert.equal(ganancias.get('b'),0);
});

runTest('side pot', () => {
  const jugadores=[{userId:'a',apostadoTotal:100,retirado:false},{userId:'b',apostadoTotal:200,retirado:false},{userId:'c',apostadoTotal:50,retirado:false}];
  const evaluaciones=new Map([['a',0],['b',2],['c',1]]);
  const {ganancias}=repartirBotes(jugadores,evaluaciones);
  const totalBet=jugadores.reduce((s,j)=>s+j.apostadoTotal,0);
  const totalWin=Array.from(ganancias.values()).reduce((s,v)=>s+v,0);
  assert.equal(totalWin,totalBet);
  for(const j of jugadores){assert(ganancias.get(j.userId)<=j.apostadoTotal);}
});

runTest('tie', () => {
  const jugadores=[{userId:'a',apostadoTotal:100,retirado:false},{userId:'b',apostadoTotal:100,retirado:false}];
  const evaluaciones=new Map([['a',2],['b',2]]);
  const {ganancias}=repartirBotes(jugadores,evaluaciones);
  assert.equal(ganancias.get('a'),100);
  assert.equal(ganancias.get('b'),100);
});

console.log('All ad-hoc tests passed');
