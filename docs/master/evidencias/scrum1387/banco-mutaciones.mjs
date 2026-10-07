// SCRUM-1387 ② · el guard visto en ROJO. Toma las mutaciones del propio test (el catálogo): no trae lista propia.
//
// USO (desde la raíz del árbol, con el árbol limpio):  node docs/master/evidencias/scrum1387/banco-mutaciones.mjs
//
//   BASE      sin tocar nada, el guard pasa entero.
//   M1..Mn    cada entrada de MUTACIONES_QUE_ME_TUMBAN: se aplica, se comprueba que SE APLICÓ, cae el
//             caso que nombra, y se restaura comparando el contenido.
//   NUEVO     un banco con lista propia fabricado en `docs/master/evidencias/`: el caso del árbol cae
//             y el rojo NOMBRA la carpeta y el guion.
//   SIN GUION al fabricado se le quita el guion y se le deja sólo una salida: deja de estar fuera y el
//             caso vuelve a pasar. (La mitad «sobra» sobre el árbol real no se prueba aquí: pediría
//             tocar la lista. La prueba el caso fabricado del test y su mutación M3.)
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mutacionesDeclaradas } from '../../../../scripts/meta-guard-mutaciones.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const TEST = 'tests/scrum1387-banco-nuevo-va-al-catalogo.test.mjs';
// Las MISMAS que lee el meta-guard, con su lector (no se importa el test: importarlo lo ejecutaría aquí).
const MUTACIONES_QUE_ME_TUMBAN = mutacionesDeclaradas(fs.readFileSync(path.join(RAIZ, TEST), 'utf8'), TEST);
const DEL_ARBOL = 'en el árbol: ningún banco de mutación nuevo queda fuera del catálogo';

function correr() {
  const env = { ...process.env };
  for (const k of ['FORCE_COLOR', 'NODE_TEST_CONTEXT', 'NODE_OPTIONS', 'NO_COLOR']) delete env[k];
  const tap = path.join(os.tmpdir(), 'scrum1387-banco-' + process.pid + '.tap');
  fs.rmSync(tap, { force: true });
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', '--test-reporter-destination=' + tap, TEST], { cwd: RAIZ, env, encoding: 'utf8' });
  const texto = fs.existsSync(tap) ? fs.readFileSync(tap, 'utf8') : '';
  fs.rmSync(tap, { force: true });
  const lineas = texto.split(/\r?\n/);
  return {
    exit: r.status,
    pasados: lineas.filter((l) => /^ok \d+ - /.test(l)).map((l) => l.replace(/^ok \d+ - /, '')),
    caidos: lineas.filter((l) => /^not ok \d+ - /.test(l)).map((l) => l.replace(/^not ok \d+ - /, '')),
    texto,
  };
}

let mal = 0;
const fila = (rotulo, vale, detalle) => { if (!vale) mal += 1; console.log((vale ? '  ✔ ' : '  ✖ ') + rotulo + ' · ' + detalle); };

console.log('BANCO SCRUM-1387 · ' + MUTACIONES_QUE_ME_TUMBAN.length + ' mutaciones tomadas del test');
const base = correr();
fila('BASE', base.exit === 0 && base.caidos.length === 0 && base.pasados.length > 0, `pasados ${base.pasados.length} · caídos ${base.caidos.length} · exit ${base.exit}`);

MUTACIONES_QUE_ME_TUMBAN.forEach((m, i) => {
  const abs = path.join(RAIZ, m.fichero);
  const ORIGINAL = fs.readFileSync(abs, 'utf8');
  const veces = ORIGINAL.split(m.de).length - 1;
  let r = null;
  try {
    fs.writeFileSync(abs, ORIGINAL.replace(m.de, m.a));
    const aplicada = fs.readFileSync(abs, 'utf8') !== ORIGINAL;
    r = correr();
    const cayo = r.caidos.some((n) => n.includes(m.cae));
    fila('M' + (i + 1), veces === 1 && aplicada && cayo, `ancla ${veces} vez · aplicada ${aplicada} · cae «${m.cae}»: ${cayo} · caídos ${r.caidos.length} de ${r.caidos.length + r.pasados.length}`);
  } finally {
    fs.writeFileSync(abs, ORIGINAL);
  }
  fila('M' + (i + 1) + ' restaurada', fs.readFileSync(abs, 'utf8') === ORIGINAL, 'el fichero vuelve a ser el de antes, por contenido');
});

const CARPETA = path.join(RAIZ, 'docs', 'master', 'evidencias', 'scrum9999-banco-fabricado');
const GUION = path.join(CARPETA, 'mutar.mjs');
try {
  fs.mkdirSync(CARPETA, { recursive: true });
  fs.writeFileSync(GUION, '// fabricado por el banco de SCRUM-1387\nconst LISTA = [{ de: "x", a: "y" }];\n');
  const r = correr();
  const cayo = r.caidos.some((n) => n.includes(DEL_ARBOL));
  const nombra = r.texto.includes('docs/master/evidencias/scrum9999-banco-fabricado') && r.texto.includes('scrum9999-banco-fabricado/mutar.mjs');
  fila('NUEVO', cayo && nombra && r.caidos.length === 1, `el caso del árbol cae: ${cayo} · el rojo nombra carpeta y guion: ${nombra} · caídos ${r.caidos.length}`);
  fs.rmSync(GUION);
  fs.writeFileSync(path.join(CARPETA, 'salida-mut.txt'), 'sin guion\n');
  const s = correr();
  fila('SIN GUION', s.exit === 0 && s.caidos.length === 0, `con sólo salidas no es un banco fuera: caídos ${s.caidos.length} · exit ${s.exit}`);
} finally {
  fs.rmSync(CARPETA, { recursive: true, force: true });
}
fila('NUEVO retirado', !fs.existsSync(CARPETA), 'la carpeta fabricada ya no existe');
const fin = correr();
fila('BASE otra vez', fin.exit === 0 && fin.caidos.length === 0 && fin.pasados.length === base.pasados.length, `pasados ${fin.pasados.length} · caídos ${fin.caidos.length}`);

console.log(mal ? `\n🔴 ${mal} fila(s) no dan lo esperado` : '\ntodas las filas dan lo esperado');
console.log('EXIT=' + (mal ? 1 : 0));
process.exitCode = mal ? 1 : 0;
