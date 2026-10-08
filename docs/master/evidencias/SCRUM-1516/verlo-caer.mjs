// SCRUM-1516 · «Con el positivo sembrado QUITADO, el instrumento tiene que DECIR QUE ESTÁ CIEGO.»
//
// Rompe el censo de SCRUM-1390 de una manera cada vez, en una COPIA fuera del árbol, y apunta con qué
// código sale. No toca el fichero del censo ni `dist/`. Cada rotura es una sustitución de texto que
// tiene que casar EXACTAMENTE una vez: si casa 0 o 2, la fila sale NO-APLICADA y el banco sale 2
// (una mutación que no se aplicó se lee igual que una que el censo no cazó).
//
// Uso: node verlo-caer.mjs <raiz del arbol, con dist/>
// Sale 0 si las dos corridas sin romper salen 0 Y cada rotura sale con el código que se espera.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const raiz = process.argv[2];
if (!raiz || !fs.existsSync(path.join(raiz, 'dist', 'app.js'))) { console.log('CIEGO: falta la raiz del arbol, con dist/'); console.log('EXIT=2'); process.exit(2); }
const aqui = path.dirname(fileURLToPath(import.meta.url));
const CENSO = path.join(aqui, '..', '..', '..', 'evidencias', 'scrum1390', 'censo-que-ve-el-tecnico.mjs.txt');
const fuente = fs.readFileSync(CENSO, 'utf8');

const COM = ['--eje=comercio'];
const ROTURAS = [
  // ── sin romper: el control de cero del banco
  { n: 'sin romper · eje del rol', eje: [], espera: 0 },
  { n: 'sin romper · eje del comercio', eje: COM, espera: 0 },
  // ── quitar la siembra, que es lo que pide el ticket: CIEGO
  { n: 'comercio · se quita el montaje de la sembrada que cruza', eje: COM, espera: 2,
    de: 'app.post(SEMBRADAS.cruza.path, async', a: '((...x) => x)(SEMBRADAS.cruza.path, async' },
  { n: 'rol · se quita el montaje de la sembrada que no distingue', eje: [], espera: 2,
    de: 'app.get(SEMBRADAS.noDistingue.path, async', a: '((...x) => x)(SEMBRADAS.noDistingue.path, async' },
  { n: 'comercio · la bandera --sin-sembrar', eje: [...COM, '--sin-sembrar'], espera: 2 },
  { n: 'rol · la bandera --sin-sembrar', eje: ['--sin-sembrar'], espera: 2 },
  // ── la siembra está, pero el censo ha dejado de ver: los controles tienen que salir en falso
  { n: 'comercio · alguien «arregla» la sembrada que cruza', eje: COM, espera: 1,
    de: 'prisma.invoice.findUnique({ where: { id: Number(req.params.id) } })', a: 'prisma.invoice.findFirst({ where: { id: Number(req.params.id), merchantId: req.merchantId } })' },
  { n: 'comercio · el doble da todo por atado (ve filtrar siempre)', eje: COM, espera: 1,
    de: 'if (SORDO) return true;', a: 'return true;' },
  { n: 'comercio · el doble no da nada por atado (ve cruzar siempre)', eje: COM, espera: 1,
    de: 'if (SORDO) return true;', a: 'return false;' },
  { n: 'comercio · el veredicto no mira las consultas sueltas', eje: COM, espera: 1,
    de: "if (sueltas.length) v = pasa ? 'CRUZA'", a: "if (sueltas.length > 999) v = pasa ? 'CRUZA'" },
  { n: 'comercio · el doble de Meta no apunta el envío', eje: COM, espera: 1,
    de: 'aMeta.push({ tipo:', a: '[].push({ tipo:' },
  { n: 'rol · la firma de la consulta es siempre la misma (no ve recortes)', eje: [], espera: 1,
    de: ".map((a) => a.modelo + '.' + a.op + ' ' + canon(a.where)).join(' | ');", a: ".map((a) => a.modelo + '.' + a.op).join(' | ');" },
  { n: 'rol · la firma de la consulta no se repite nunca (todo es recorte)', eje: [], espera: 1,
    de: ".map((a) => a.modelo + '.' + a.op + ' ' + canon(a.where)).join(' | ');", a: ".map((a) => a.modelo + '.' + a.op + ' ' + canon(a.where) + Math.random()).join(' | ');" },
  { n: 'rol · no se mira si al técnico se le niega el ajeno', eje: [], espera: 1,
    de: 'const niegaB = [403, 404].includes(r.Btecnico.estado)', a: 'const niegaB = false && [403, 404].includes(r.Btecnico.estado)' },
];

const veces = (s, t) => s.split(t).length - 1;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1516-'));
const entorno = { ...process.env }; for (const k of ['NODE_TEST_CONTEXT', 'NODE_OPTIONS', 'FORCE_COLOR']) delete entorno[k];
const filas = [];
try {
  let i = 0;
  for (const r of ROTURAS) {
    i += 1;
    const casa = r.de ? veces(fuente, r.de) : null;
    if (r.de && casa !== 1) { filas.push({ ...r, sale: 'NO-APLICADA (casa ' + casa + ')', dice: '' }); continue; }
    const f = path.join(tmp, 'censo-' + i + '.mjs');
    fs.writeFileSync(f, r.de ? fuente.replace(r.de, r.a) : fuente);
    const out = spawnSync(process.execPath, [f, raiz, ...r.eje], { encoding: 'utf8', env: entorno, maxBuffer: 64 * 1024 * 1024 });
    const lineas = String(out.stdout || '').split('\n').filter(Boolean);
    const dice = lineas.find((l) => l.startsWith('CIEGO')) || lineas.find((l) => l.startsWith('¿')) || '(sin línea de veredicto)';
    filas.push({ ...r, sale: out.status, dice: dice.slice(0, 96), bytes: String(out.stdout || '').length });
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true }); // pase lo que pase: un temporal que queda es un rojo ajeno
}

console.log('CENSO: ' + path.relative(raiz, CENSO).split(path.sep).join('/') + ' · ' + fuente.length + ' caracteres');
console.log('POBLACION: ' + ROTURAS.length + ' corridas · ' + ROTURAS.filter((r) => !r.de && r.espera === 0).length + ' sin romper · '
  + ROTURAS.filter((r) => r.espera === 2).length + ' que quitan la siembra · ' + ROTURAS.filter((r) => r.espera === 1).length + ' que ciegan el motor');
let ok = true;
for (const f of filas) {
  const bien = f.sale === f.espera; if (!bien) ok = false;
  console.log((bien ? '  ✓ ' : '  ✗ ') + 'sale ' + f.sale + ' (se espera ' + f.espera + ') · ' + f.n);
  console.log('        ' + f.dice + (f.bytes !== undefined ? '  [' + f.bytes + ' B de salida]' : ''));
}
const noAplicadas = filas.filter((f) => typeof f.sale === 'string').length;
console.log('como se esperaba: ' + filas.filter((f) => f.sale === f.espera).length + ' de ' + filas.length + ' · no aplicadas: ' + noAplicadas
  + ' · temporal borrado: ' + !fs.existsSync(tmp));
const fin = noAplicadas ? 2 : ok ? 0 : 1;
console.log('EXIT=' + fin); process.exit(fin);
