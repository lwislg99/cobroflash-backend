// SCRUM-1349 — Con una mutación puesta en el árbol, `guards:entrada` no deja empujar.
//
// El diario de los instrumentos que mutan el árbol YA EXISTÍA (SCRUM-808: la marca en `.cache/`,
// la reparación al arrancar y un test que cae si hay una marca huérfana). Lo que faltaba es dónde
// se mira. Medido el 1-oct-2026 matando `meta:mutaciones` DE VERDAD con una mutación puesta
// (`Stop-Process -Force`, que en Windows no entrega señal y no deja correr ningún `finally`):
//
//     tras matar        → ` M scripts/meta-guard-mutaciones.mjs`, y la marca sigue en disco
//     scrum808 en local → 1 fail de 15 («no hay una marca huérfana»)
//     `--solo-censo`    → «una pasada anterior murió…», devuelto a sus bytes, árbol limpio
//     scrum808 otra vez → 15 de 15
//
// O sea: el diario funciona. Pero ese test sólo cae en la tanda COMPLETA y sólo EN LOCAL —la marca
// vive en `.cache/`, que git ignora y CI no recibe—, así que un `git add -A` y un push con la
// mutación dentro salían verdes en CI. `guards:entrada` es lo que se corre antes de empujar, y es
// el único sitio donde la marca y el árbol que se empuja están en la misma máquina.
//
// Qué se comprueba:
//   ① EL QUE DECIDE: con una marca huérfana delante, el comando de verdad sale ≠ 0, nombra el
//      fichero mutado y NO llega a lanzar los guards.
//   ② no grita por lo que no es: una marca cuyas piezas ya cuadran, y una de un proceso VIVO.
//   ③ la carpeta de más sólo AÑADE: no hay forma de apartar la del árbol desde el entorno.
//
// La mitad POSITIVA del comando —sobre un árbol sin marca sale 0— la lleva `scrum976` ④, que lo
// lanza entero. Aquí no se repite: son 15 s de guards para afirmar lo mismo.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { temporal } from './_temporal.mjs';
import { mutacionesPuestas, avisoDeMutacionPuesta } from '../scripts/guards-entrada.mjs';
import { marcasHuerfanas } from '../scripts/_marca-de-arbol.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(RAIZ, 'scripts', 'guards-entrada.mjs');

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'scripts/guards-entrada.mjs',
    de: 'if (puestas.length) {',
    a: 'if (puestas.length < 0) {',
    // Sin la puerta, el comando corre los guards y sale 0 con una mutación puesta en el árbol.
    cae: 'con una mutación puesta, `guards:entrada` sale',
  },
];

/** Un pid que EXISTIÓ y ya no: el de un hijo que ha terminado. */
function pidMuerto() {
  const r = spawnSync(process.execPath, ['-e', ''], { encoding: 'utf8' });
  assert.equal(r.status, 0, 'el banco no ha podido lanzar el proceso del que toma el pid');
  return r.pid;
}

/**
 * Una carpeta de marcas como la que deja una herramienta: `<cache>/<herramienta>/en-vuelo.json`
 * con una pieza. `mutada` decide si el fichero «del árbol» difiere de su copia original.
 */
function cacheConMarca({ pid, mutada }) {
  const cache = temporal('yaqu-1349-cache-');
  const dir = path.join(cache, 'herramienta-de-prueba');
  fs.mkdirSync(dir);
  const abs = path.join(cache, 'fichero-del-arbol.js');
  const copia = path.join(dir, 'pieza-0.bin');
  fs.writeFileSync(copia, 'const original = 1;\n');
  fs.writeFileSync(abs, mutada ? 'const original = 2; // mutado\n' : 'const original = 1;\n');
  fs.writeFileSync(path.join(dir, 'en-vuelo.json'), JSON.stringify({
    pid, cuando: '2026-10-01T12:28:00.032Z', piezas: [{ ruta: 'public/js/fichero-del-arbol.js', abs, copia }],
  }));
  return cache;
}

test('SCRUM-1349 ① 🔴 con una mutación puesta, `guards:entrada` sale ≠ 0, nombra el fichero y no lanza nada', () => {
  const cache = cacheConMarca({ pid: pidMuerto(), mutada: true });
  // El banco se comprueba ANTES que el sujeto: si la marca fabricada no se ve como huérfana, un
  // «sale 0» de abajo no diría nada del comando.
  assert.equal(marcasHuerfanas(cache).length, 1, 'el banco está mal: la marca fabricada no se ve como huérfana');

  // El entorno se construye a mano: el del runner trae `NODE_OPTIONS` y color, y un laboratorio
  // que le presta su entorno al sujeto mide la suma de los dos.
  const env = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, GUARDS_ENTRADA_CACHE_EXTRA: cache };
  const r = spawnSync(process.execPath, [SCRIPT], { cwd: RAIZ, encoding: 'utf8', env });

  assert.equal(r.status, 1,
    `🔴 con una mutación puesta el comando sale ${r.status}: se puede empujar con ella dentro.\n${r.stderr}`);
  assert.match(r.stderr, /HAY UNA MUTACIÓN PUESTA/, '🔴 sale ≠ 0 pero no dice por qué');
  assert.match(r.stderr, /public\/js\/fichero-del-arbol\.js/, '🔴 no NOMBRA el fichero que quedó mutado');
  assert.match(r.stderr, /herramienta-de-prueba/, '🔴 no dice qué herramienta lo dejó');
  assert.doesNotMatch(r.stdout, /Guards de entrada del registro/,
    '🔴 ha lanzado los guards igualmente: medir sobre un árbol mutado es medir otra cosa');
  assert.match(r.stdout, /^0 guards · /m, '🔴 falta la línea de población: un rojo sin población no se sabe leer');
});

test('SCRUM-1349 ② no grita por lo que no es: piezas que ya cuadran, y una pasada VIVA', () => {
  const restaurada = cacheConMarca({ pid: pidMuerto(), mutada: false });
  assert.deepEqual(marcasHuerfanas(restaurada), [],
    '🔴 una marca cuyas piezas ya coinciden con su copia se da por mutación puesta: una pasada sana gritaría');

  const viva = cacheConMarca({ pid: process.pid, mutada: true });
  assert.deepEqual(marcasHuerfanas(viva), [],
    '🔴 la marca de un proceso VIVO se da por huérfana: pararía a quien empuja mientras otro mide');

  // Y el aviso distingue la marca que no se puede leer: «no sé qué quedó» no es «nada».
  const texto = avisoDeMutacionPuesta([{ herramienta: 'x', ilegible: true, sucias: [] }]);
  assert.match(texto, /no se puede leer/);
});

test('SCRUM-1349 ③ la carpeta de más sólo AÑADE a la del árbol', () => {
  const delArbol = marcasHuerfanas();
  const vacia = temporal('yaqu-1349-vacia-');
  assert.equal(mutacionesPuestas(vacia).length, delArbol.length,
    '🔴 señalar una carpeta vacía cambia lo que se ve del árbol: la puerta se podría apartar desde el entorno');
  const conMarca = cacheConMarca({ pid: pidMuerto(), mutada: true });
  assert.equal(mutacionesPuestas(conMarca).length, delArbol.length + 1,
    '🔴 la carpeta de más no se mira: el caso ① no estaría probando la puerta');
});
