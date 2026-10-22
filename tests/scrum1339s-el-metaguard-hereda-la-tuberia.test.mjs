// tests/scrum1339s-el-metaguard-hereda-la-tuberia.test.mjs — SCRUM-1339 (tramo 1339s) · S3
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 LA SALIDA C DE SCRUM-1405 NO LLEGABA AL META-GUARD
// ═════════════════════════════════════════════════════════════════════════════════════════════
//
// SCRUM-1405c puso BLOQUEANTE la tubería de salida de cada hijo de la tanda
// (`scripts/tuberia-bloqueante.mjs`, cargado con `--import` en el script `test`). Su registro dejó
// escrito el hueco: las copias del flag que lanzan hijos con `run()` de `node:test` «siguen
// perdiendo», porque la autorización era para el script `test` y no las cubre. Javier aprobó
// extenderla (SCRUM-1339 c.20219). Este tramo cubre SÓLO la del meta-guard, que es la de la S3; las
// otras dos (`_trinquete-de-zona-hijo.mjs`, `censo-guards-gateados.mjs`) no tienen dueño declarado
// y esperan a que la S0 se lo ponga (orquestador, 22-oct-2026).
//
// Lo que se comprueba es el EFECTO, no el texto: `correr()` lanza un fichero de fuera del árbol que
// sólo pasa si el módulo se cargó en SU proceso. Y el control positivo demuestra que esa cobaya
// discrimina: lanzada por el mismo `run()` sin el `--import`, cae.
//
// ── LO QUE ESTE FICHERO NO PUEDE DECIR ─────────────────────────────────────────────────────
// 🔴 NO dice que el meta-guard haya dejado de perder informes en Linux. Dice que su hijo carga el
//    módulo que, medido en SCRUM-1405 (0 de 12 tandas, 0 de 4 pasadas en el obligatorio de #2429),
//    hace que no se pierdan. En Windows la tubería ya es bloqueante y no hay rojo que ver.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { run } from 'node:test';
import { correr, paso, cayo } from '../scripts/meta-guard-mutaciones.mjs';

// ⚠️ MUTACIONES DECLARADAS (SCRUM-745): las ejecuta `npm run meta:mutaciones` en CI.
export const MUTACIONES_QUE_ME_TUMBAN = [
  { fichero: 'scripts/meta-guard-mutaciones.mjs',
    de: '    execArgv: [`--import=${TUBERIA_BLOQUEANTE}`],',
    a: '    execArgv: [], // sin la tuberia bloqueante, a proposito',
    cae: 'SCRUM-1339s · 🔴 el hijo que lanza correr() carga la tubería bloqueante' },
];

const NOMBRE_COBAYA = 'cobaya 1339s: el módulo de la tubería está cargado en este proceso';
const COBAYA = `import test from 'node:test';
import assert from 'node:assert/strict';
test(${JSON.stringify(NOMBRE_COBAYA)}, () => {
  assert.ok(globalThis[Symbol.for('yaqu.scrum1405c.tuberiaBloqueante')], 'el módulo NO se cargó en el hijo');
});
`;

function conCobaya(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1339s-'));
  const fichero = path.join(dir, 'cobaya.test.mjs');
  fs.writeFileSync(fichero, COBAYA);
  return Promise.resolve(fn(fichero)).finally(() => fs.rmSync(dir, { recursive: true, force: true }));
}

test('SCRUM-1339s · 🔴 el hijo que lanza correr() carga la tubería bloqueante', async () => {
  await conCobaya(async (fichero) => {
    const r = await correr(fichero);
    // Población: la cobaya tiene UN test. Si no llega ninguno, no se ha medido nada.
    const llegaron = r.pasados.length + r.caidos.length + r.saltados.length;
    assert.ok(llegaron >= 1, `NO PUDE MIRAR: de la cobaya no llegó ningún test (${JSON.stringify(r)})`);
    assert.ok(paso(r, NOMBRE_COBAYA),
      `el hijo de correr() NO cargó scripts/tuberia-bloqueante.mjs: pasados ${JSON.stringify(r.pasados)} · caídos ${JSON.stringify(r.caidos)}`);
  });
});

test('SCRUM-1339s · control positivo: sin el --import, la MISMA cobaya cae', async () => {
  await conCobaya(async (fichero) => {
    const pasados = [];
    const caidos = [];
    for await (const ev of run({ files: [fichero], forceExit: true, timeout: 60000 })) {
      if (ev.type === 'test:pass' && !ev.data.skip) pasados.push(ev.data.name);
      else if (ev.type === 'test:fail') caidos.push(ev.data.name);
    }
    assert.ok(cayo({ caidos }, NOMBRE_COBAYA),
      `la cobaya NO discrimina: sin el módulo también pasa (pasados ${JSON.stringify(pasados)}). `
      + 'Un verde del caso de arriba no probaría nada.');
  });
});
