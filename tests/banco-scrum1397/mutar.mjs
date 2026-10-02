// Mutaciones de SCRUM-1397 sobre la puerta de las facturas y las tres rutas que pasan por ella.
// Cada una: se aplica al FUENTE (y se comprueba que se aplicó), se transpila ESE fichero a su
// sitio en `dist/`, se corre el test contra el banco desechable, se apunta qué caso cae y qué
// dice, y se restauran fuente y `dist` byte a byte. Al final se comprueba por CONTENIDO (sha256)
// que los seis ficheros han vuelto a ser los que eran.
//
// Por qué transpila un fichero en vez de `npm run build`: son 18 pasadas, y un `tsc` entero por
// cada una es media hora de máquina. La pasada «T0» demuestra que el camino vale: transpila los
// tres ficheros SIN mutar y el test sigue en verde, así que un rojo de después es de la mutación
// y no del transpilado.
//
// Se lanza a mano, con el árbol comiteado y `dist/` recién construido (`npm run build`), y
// mientras corre no se mide nada más en este árbol:
//   LIBRO_PG_URL=<banco desechable> node tests/banco-scrum1397/mutar.mjs <carpeta FUERA del árbol>
// En una máquina sin Postgres el banco se levanta aparte; si hace falta uno nuevo por pasada,
// `BANCO_1397_ANTES` es una orden de node (ruta a un .mjs) que se ejecuta antes de cada una.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';

const RAIZ = path.resolve(import.meta.dirname, '../..');
const TEST = 'tests/scrum1397-el-tecnico-ve-sus-facturas.test.mjs';
const LANZADOR = 'tests/banco-scrum1397/lanzar.mjs';
const RUTAS = 'src/modules/system/app/routes/invoicesAdmin.routes.ts';
const LISTA = 'src/modules/system/invoiceAdmin.ts';
const PUERTA = 'src/core/documentos/accesoALaFactura.ts';

// `cae`: trozo del NOMBRE del caso que tiene que caer. `dice`: trozo del mensaje del fallo.
const MUTACIONES = [
  { id: 'M01 la lista no le pasa el recorte a la consulta', f: RUTAS,
    de: 'listInvoicesAdmin(req.merchantId, status, search, dateFrom, dateTo, recorte)', a: 'listInvoicesAdmin(req.merchantId, status, search, dateFrom, dateTo)',
    cae: 'ya NO reconstruye', dice: '1050 = 1050' },
  { id: 'M02 la ficha no pregunta a la puerta', f: RUTAS,
    de: "    if (!(await puedeVerLaFactura(quienPide(req), id))) {\n      return res.status(404).json({ error: 'not_found' });\n    }\n", a: '',
    cae: 'SIGUE viendo cada factura suya', dice: 'abre por URL la FICHA de una factura ajena: AJENA-AUTOR-BLAS' },
  { id: 'M03 el PDF no pregunta a la puerta', f: RUTAS,
    de: "    if (!(await puedeVerLaFactura(quienPide(req), id))) return res.status(404).json({ error: 'not_found' });\n", a: '',
    cae: 'SIGUE viendo cada factura suya', dice: 'abre por URL el PDF de una factura ajena: AJENA-AUTOR-BLAS' },
  { id: 'M04 la consulta de la lista ignora el recorte que recibe', f: LISTA,
    de: 'if (recorte) where.AND = [recorte];', a: '',
    cae: 'ya NO reconstruye', dice: '1050 = 1050' },
  { id: 'M05 el recorte va en OR: pisa la búsqueda', f: LISTA,
    de: 'if (recorte) where.AND = [recorte];', a: 'if (recorte) where.OR = [recorte];',
    cae: 'SIGUE viendo cada factura suya', dice: 'buscando por número, el Técnico encuentra facturas ajenas' },
  { id: 'M06 la puerta no recorta a nadie', f: PUERTA,
    de: 'if (seesAllJobs(quien.userRole)) return null;', a: 'if (seesAllJobs(quien.userRole) || true) return null;',
    cae: 'ya NO reconstruye', dice: '1050 = 1050' },
  { id: 'M07 sin identidad se devuelve «sin recorte»', f: PUERTA,
    de: 'if (persona == null) return { id: { in: [] } };', a: 'if (persona == null) return null;',
    cae: 'sin identidad no casa nada', dice: '' },
  { id: 'M08 se pierde el eje del AUTOR', f: PUERTA,
    de: '    { quote: { teamMemberId: persona } },\n', a: '',
    cae: 'SIGUE viendo cada factura suya', dice: 'ha dejado de ver una factura SUYA en la lista: SUYA-AUTORA' },
  { id: 'M09 se pierde el eje de la ASIGNADA AL DOCUMENTO', f: PUERTA,
    de: '    { asignados: { some: { teamMemberId: persona } } },\n', a: '',
    cae: 'SIGUE viendo cada factura suya', dice: 'ha dejado de ver una factura SUYA en la lista: SUYA-ASIGNADA-AL-DOCUMENTO' },
  { id: 'M10 se pierde el presupuesto que abrió el Trabajo', f: PUERTA,
    de: '    { quoteId: { in: presupuestoIds } },', a: '',
    cae: 'SIGUE viendo cada factura suya', dice: 'ha dejado de ver una factura SUYA en la lista: SUYA-TRABAJO-OPERARIO' },
  { id: 'M11 se pierde el adicional del Trabajo', f: PUERTA,
    de: '    { quote: { jobId: { in: trabajoIds } } },', a: '',
    cae: 'SIGUE viendo cada factura suya', dice: 'ha dejado de ver una factura SUYA en la lista: SUYA-TRABAJO-ADICIONAL' },
  { id: 'M12 se pierden las facturas de albarán', f: PUERTA,
    de: '    { id: { in: porAlbaran } },', a: '',
    cae: 'SIGUE viendo cada factura suya', dice: 'ha dejado de ver una factura SUYA en la lista: SUYA-ALBARAN-PARCIAL' },
  { id: 'M13 no se mira el libro de líneas facturadas (la parcial)', f: PUERTA,
    de: '    ...libro.map((l) => l.invoiceId),\n', a: '',
    cae: 'SIGUE viendo cada factura suya', dice: 'ha dejado de ver una factura SUYA en la lista: SUYA-ALBARAN-PARCIAL' },
  { id: 'M14 no se mira `Albaran.invoiceId` (la recapitulativa)', f: PUERTA,
    de: '    ...albaranes.flatMap((a) => (a.invoiceId == null ? [] : [a.invoiceId])),\n', a: '',
    cae: 'SIGUE viendo cada factura suya', dice: 'ha dejado de ver una factura SUYA en la lista: SUYA-ALBARAN-ENTERO' },
  { id: 'M15 la rectificativa de una suya deja de ser suya', f: PUERTA,
    de: 'return { OR: [...suya, { rectifies: { OR: suya } }] };', a: 'return { OR: suya };',
    cae: 'SIGUE viendo cada factura suya', dice: 'ha dejado de ver una factura SUYA en la lista: SUYA-RECTIFICATIVA' },
  { id: 'M16 el Trabajo se mira por un solo eje (operario), no por los tres de la casa', f: PUERTA,
    de: '...whereSuyoElTrabajo(persona) }, // regla 2', a: 'operarioId: persona }, // regla 2',
    cae: 'se le PIDEN a `whereSuyoElTrabajo`', dice: '' },
  { id: 'M17 preguntar por UNA contesta siempre que sí', f: PUERTA,
    de: 'return fila != null;', a: 'return true;',
    cae: 'SIGUE viendo cada factura suya', dice: 'abre por URL la FICHA de una factura ajena: AJENA-AUTOR-BLAS' },
  { id: 'M18 el PDF pregunta a la puerta DESPUÉS de generarlo', f: RUTAS,
    de: "    if (!(await puedeVerLaFactura(quienPide(req), id))) return res.status(404).json({ error: 'not_found' });\n\n    // Genera el PDF bajo demanda si falta (helper compartido) y lo sirve.\n    const { diskPath, number } = await ensureInvoicePdf(id, prisma);\n",
    a: "    const { diskPath, number } = await ensureInvoicePdf(id, prisma);\n    if (!(await puedeVerLaFactura(quienPide(req), id))) return res.status(404).json({ error: 'not_found' });\n",
    cae: 'antes de leer la factura', dice: 'DESPUÉS de ensureInvoicePdf' },
];

// ── Entradas y suelos ────────────────────────────────────────────────────────────────────────
const fin = (codigo, linea) => { if (linea) console.log(linea); console.log(`EXIT=${codigo}`); process.exit(codigo); };
const carpeta = process.argv[2];
const url = process.env.LIBRO_PG_URL || '';
if (!carpeta) fin(2, 'CIEGO: falta la carpeta de salida (fuera del árbol)');
if (path.resolve(carpeta).startsWith(RAIZ + path.sep)) fin(2, 'CIEGO: la carpeta de salida va FUERA del árbol');
if (!url) fin(2, 'CIEGO: sin LIBRO_PG_URL no corre ningún caso con base y toda mutación saldría «muda»');
fs.mkdirSync(carpeta, { recursive: true });

const sucio = spawnSync('git', ['status', '--porcelain', '--', 'src', 'tests'], { cwd: RAIZ, encoding: 'utf8' }).stdout.trim();
if (sucio) fin(2, 'CIEGO: hay cambios sin comitear en src/ o tests/; el banco muta ficheros y restaura por contenido:\n' + sucio);

const FICHEROS = [RUTAS, LISTA, PUERTA];
const enDist = (f) => path.join(RAIZ, f.replace(/^src\//, 'dist/').replace(/\.ts$/, '.js'));
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const original = new Map(FICHEROS.map((f) => [f, { src: fs.readFileSync(path.join(RAIZ, f)), dist: fs.readFileSync(enDist(f)) }]));
// SUELO: el `dist` es de ESTE fuente. Si es más viejo, todo lo de abajo mide otra cosa.
for (const f of FICHEROS) {
  if (fs.statSync(enDist(f)).mtimeMs < fs.statSync(path.join(RAIZ, f)).mtimeMs) fin(2, `CIEGO: ${enDist(f)} es más viejo que su fuente: npm run build antes`);
}

const opciones = ts.parseJsonConfigFileContent(
  ts.readConfigFile(path.join(RAIZ, 'tsconfig.json'), ts.sys.readFile).config, ts.sys, RAIZ,
).options;
const transpilar = (f, fuente) => fs.writeFileSync(enDist(f), ts.transpileModule(fuente, { compilerOptions: opciones, fileName: f }).outputText);
const restaurar = () => { for (const f of FICHEROS) { fs.writeFileSync(path.join(RAIZ, f), original.get(f).src); fs.writeFileSync(enDist(f), original.get(f).dist); } };

const entorno = {};
for (const k of ['PATH', 'Path', 'SystemRoot', 'TEMP', 'TMP', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'HOME', 'ComSpec', 'PATHEXT', 'windir']) {
  if (process.env[k] !== undefined) entorno[k] = process.env[k];
}
function correr(etiqueta) {
  if (process.env.BANCO_1397_ANTES) {
    const antes = spawnSync(process.execPath, [process.env.BANCO_1397_ANTES], { cwd: RAIZ, env: entorno, encoding: 'utf8' });
    if (antes.status !== 0) return { ciego: `la orden de antes de la pasada salió con ${antes.status}: ${(antes.stdout || '') + (antes.stderr || '')}` };
  }
  const tap = path.join(carpeta, `${etiqueta}.tap`);
  const r = spawnSync(process.execPath, [LANZADOR, url, tap, TEST], { cwd: RAIZ, env: entorno, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (!fs.existsSync(tap)) return { ciego: 'el lanzador no dejó TAP: ' + (r.stdout || '') + (r.stderr || '') };
  const texto = fs.readFileSync(tap, 'utf8');
  if (!/^# tests \d+$/m.test(texto)) return { ciego: 'TAP sin resumen final' };
  const casos = [...texto.matchAll(/^(not ok|ok) \d+ - (.*)$/gm)].map((m) => ({ ok: m[1] === 'ok', nombre: m[2] }));
  return { casos, caen: casos.filter((c) => !c.ok).map((c) => c.nombre), saltos: casos.filter((c) => /# SKIP/.test(c.nombre)).length, texto };
}

// ── BASE, y el control del transpilado ───────────────────────────────────────────────────────
console.log(`POBLACION: ${MUTACIONES.length} mutaciones sobre ${FICHEROS.length} ficheros de src/ · test: ${TEST}`);
const base = correr('base');
if (base.ciego) fin(2, 'CIEGO en la BASE: ' + base.ciego);
console.log(`BASE: casos=${base.casos.length} caen=${base.caen.length} saltos=${base.saltos}`);
if (base.caen.length || base.saltos || base.casos.length === 0) fin(2, 'CIEGO: la base no está en verde y sin saltos; nada de lo que siga se puede leer');
for (const m of MUTACIONES) {
  if (!base.casos.some((c) => c.nombre.includes(m.cae))) fin(2, `CIEGO: «${m.cae}» no es trozo del nombre de ningún caso (${m.id})`);
}

try {
  for (const f of FICHEROS) transpilar(f, original.get(f).src.toString('utf8'));
  const t0 = correr('T0-transpilado-sin-mutar');
  if (t0.ciego) fin(2, 'CIEGO en T0: ' + t0.ciego);
  console.log(`T0 (los ${FICHEROS.length} ficheros transpilados SIN mutar): casos=${t0.casos.length} caen=${t0.caen.length}`);
  if (t0.caen.length) fin(2, 'CIEGO: transpilar sin mutar ya pone el test en rojo; el camino del banco no vale');
} finally {
  restaurar();
}

// ── Las mutaciones ───────────────────────────────────────────────────────────────────────────
let vivas = 0;
let ciegas = 0;
let n = 0;
for (const m of MUTACIONES) {
  n += 1;
  const fuente = original.get(m.f).src.toString('utf8');
  const veces = fuente.split(m.de).length - 1;
  if (veces !== 1) { ciegas += 1; console.log(`${m.id} → CIEGA: el ancla aparece ${veces} veces en ${m.f} (tiene que ser 1)`); continue; }
  const mutado = fuente.replace(m.de, () => m.a);
  let r;
  try {
    fs.writeFileSync(path.join(RAIZ, m.f), mutado);
    transpilar(m.f, mutado);
    const aplicada = sha(fs.readFileSync(path.join(RAIZ, m.f))) !== sha(original.get(m.f).src) && sha(fs.readFileSync(enDist(m.f))) !== sha(original.get(m.f).dist);
    if (!aplicada) { ciegas += 1; console.log(`${m.id} → CIEGA: la mutación no cambió el fuente o no cambió el dist`); continue; }
    r = correr(`M${String(n).padStart(2, '0')}`);
  } finally {
    restaurar();
  }
  if (r.ciego) { ciegas += 1; console.log(`${m.id} → CIEGA: ${r.ciego}`); continue; }
  const cayo = r.caen.some((c) => c.includes(m.cae));
  const loDice = m.dice === '' || r.texto.includes(m.dice);
  if (cayo && loDice) console.log(`${m.id} → CAE (${r.caen.length} caso(s)): «${m.cae}»${m.dice ? ` · dice «${m.dice}»` : ''}`);
  else { vivas += 1; console.log(`${m.id} → VIVA: caen [${r.caen.join(' | ')}]; se esperaba «${m.cae}»${cayo ? ` y que dijera «${m.dice}»` : ''}`); }
}

// ── Post-condición de CONTENIDO ──────────────────────────────────────────────────────────────
let intacto = true;
for (const f of FICHEROS) {
  if (sha(fs.readFileSync(path.join(RAIZ, f))) !== sha(original.get(f).src)) { intacto = false; console.log(`🔴 ${f} NO ha vuelto a ser el que era`); }
  if (sha(fs.readFileSync(enDist(f))) !== sha(original.get(f).dist)) { intacto = false; console.log(`🔴 ${enDist(f)} NO ha vuelto a ser el que era`); }
}
console.log(`RESULTADO: ${MUTACIONES.length - vivas - ciegas} caen de ${MUTACIONES.length} · vivas=${vivas} · ciegas=${ciegas} · árbol intacto=${intacto}`);
fin(vivas || ciegas || !intacto ? 1 : 0);
