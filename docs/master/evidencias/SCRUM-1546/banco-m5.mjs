// Banco M5 (SCRUM-1546): ¿el oráculo de microcopy aprueba una firma «del fundador» FALSA?
// Uso: node banco-m5.mjs <raíz del worktree en origin/main>
// Cada caso = copia REAL de docs/microcopy/ + UNA cobaya. Se cuenta que la cobaya entró antes de preguntar.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const RAIZ = path.resolve(process.argv[2] || '');
const ORACULO = path.join(RAIZ, 'tests', '_microcopy-aprobada.mjs');
const CENSO921 = path.join(RAIZ, 'tests', '_censo-firmas-autorizacion.mjs');
if (!fs.existsSync(ORACULO)) { console.log('CIEGO: no existe ' + ORACULO); process.exit(2); }
const o = await import(pathToFileURL(ORACULO).href);
const c921 = await import(pathToFileURL(CENSO921).href);
// El temporal, con el helper de la casa (SCRUM-864c): se borra al salir el proceso, pase lo que pase.
const { temporal } = await import(pathToFileURL(path.join(RAIZ, 'tests', '_temporal.mjs')).href);

const REAL = path.join(RAIZ, 'docs', 'microcopy');
const reales = fs.readdirSync(REAL).filter((n) => n.endsWith('.md'));
const LIT = 'Cobaya M5: este texto no lo ha firmado nadie.';
const NOMBRE = '2026-10-14-SCRUM-999999-cobaya-m5.md';
const cuerpo = (firma) => ['# Cobaya M5', '', ...(firma ? [firma] : []), '', '## Texto aprobado, literal', '', '> ' + LIT, ''].join('\n');

const CASOS = [
  ['F  firma del fundador INVENTADA, ticket inexistente', '**Aprobado por el fundador** el 14-oct-2026, en **SCRUM-999999**.'],
  ['F2 firma del fundador INVENTADA, sin ticket ninguno', 'Aprobado por el fundador.'],
  ['S  control: la MISMA ficha SIN firma', null],
  ['Q  control: la firma falsa DENTRO de una cita', '> **Aprobado por el fundador** el 14-oct-2026, en **SCRUM-999999**.'],
  ['A  control: «Aprobado por el asesor»', '**Aprobado por el asesor** el 14-oct-2026, en **SCRUM-999999**.'],
  ['D  control: delegada con referencia INVENTADA', 'Aprobado por el orquestador por delegación del fundador · SCRUM-999999 comentario 99999999'],
];

const base = temporal('scrum1546-m5-');
console.log(`POBLACION: ${reales.length} ficheros .md en docs/microcopy (README incluido, que el oráculo no cuenta) · oráculo ${path.relative(RAIZ, ORACULO)}`);
let fallos = 0;
for (const [rotulo, firma] of CASOS) {
  const dir = path.join(base, rotulo.slice(0, 2).trim());
  fs.mkdirSync(dir);
  for (const n of reales) fs.copyFileSync(path.join(REAL, n), path.join(dir, n));
  fs.writeFileSync(path.join(dir, NOMBRE), cuerpo(firma));
  // Testigo (A21): la cobaya ESTÁ antes de preguntar, y el resto es la copia entera.
  const n = fs.readdirSync(dir).filter((x) => x.endsWith('.md')).length;
  if (n !== reales.length + 1 || !fs.readFileSync(path.join(dir, NOMBRE), 'utf8').includes(LIT)) { console.log('CIEGO en ' + rotulo); fallos++; continue; }
  const todas = o.aprobacionesDeMicrocopy({ dir });
  const cob = todas.find((a) => a.nombre === NOMBRE);
  const consta = o.constaAprobado(LIT, { dir });
  const como = o.comoConstaAprobado(LIT, { dir });
  const fichas = todas.filter((a) => a.origen === 'fichero').length;
  console.log(`\n[${rotulo}]\n  fichas leídas=${fichas} · cobaya vista=${!!cob} · firmante=${cob?.firmante} · aprobada=${cob?.aprobada} · estado=${cob?.estado} · noComprobado=${cob?.noComprobado.length}`);
  console.log(`  constaAprobado(literal) → ${JSON.stringify(consta)}`);
  console.log(`  comoConstaAprobado(literal) → ${JSON.stringify(como)}`);
  if (firma) {
    const l = firma;
    const r = c921.clasificarLinea(l, { fichero: 'docs/microcopy/' + NOMBRE, lineas: [l], i: 0 });
    console.log(`  censo 921 clasificarLinea → ${JSON.stringify(r)}`);
  }
}
console.log(`\nEXIT=${fallos ? 2 : 0}`);
process.exit(fallos ? 2 : 0);
