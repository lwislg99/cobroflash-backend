// CONTROL NEGATIVO del banco: una mutacion INERTE (cambia bytes, no comportamiento) tiene que
// salir MUDA. Si sale VIVA o CIEGA, el banco no sabe decir MUDA y su cero no vale nada.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const RAIZ = process.argv[2];
const mod = await import(pathToFileURL(path.join(RAIZ, 'scripts/meta-guard-mutaciones.mjs')).href);
const { correr, aplicarUna } = mod;
const GUARD = 'scrum859-identidad-y-motivo-cerrado.test.mjs';
const INERTE = {
  fichero: 'tests/scrum267-ancla-de-medicion.test.mjs',
  de: 'const TOPE_INVISIBLE_HASTA_859 = 5;',
  a: 'const TOPE_INVISIBLE_HASTA_859 = 5; // inerte: mismos bytes de comportamiento',
  cae: 'SCRUM-859 · 🔴 `INVISIBLE_HASTA_859` está cerrado en CINCO',
};
const limpia = await correr(GUARD);
console.log(`limpia: pass=${limpia.pasados.length} fail=${limpia.caidos.length} skip=${limpia.saltados.length} movidos=${limpia.movidos.length}`);
const r = await aplicarUna(INERTE, GUARD, limpia);
const v = r.ok ? 'VIVA' : (r.muerto ? 'MUERTA' : (r.mudo ? 'MUDA' : 'CIEGA'));
console.log('VEREDICTO DEL CONTROL INERTE:', v);
console.log((r.mudo || r.ciego || r.muerto || '(sin mensaje)').toString().slice(0, 900));
console.log(v === 'MUDA' ? '\nOK: el banco SI sabe decir MUDA.' : '\n🔴 EL BANCO NO SABE DECIR MUDA: su cero no vale.');
