// docs/master/evidencias/scrum1502/interroga.mjs — SCRUM-1502
//
// LE HACE AL GUARD LAS PREGUNTAS QUE DEBERÍA SABER CONTESTAR, mutando el árbol y deshaciendo.
//
// ⛔ MUTA FICHEROS SEGUIDOS. Se corre en un árbol DESECHABLE (un `git worktree add --detach`),
// nunca en el de trabajo. Cada caso restaura lo que tocó y lo comprueba byte a byte; al acabar,
// `git status --porcelain` de ese árbol tiene que salir vacío, y eso se mira aparte.
//
// Uso:  node docs/master/evidencias/scrum1502/interroga.mjs <carpeta temporal>
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const RAIZ = path.resolve(import.meta.dirname, '..', '..', '..', '..');
const TMP = process.argv[2];
if (!TMP) { console.error('falta la carpeta temporal'); process.exit(2); }

const FRASE = 'Esta factura todavía no está registrada. Se reintenta solo; si sigue así, avísanos.';
const COBAYA = 'docs/master/_cobaya-scrum1502.md';
const HELPER = 'tests/_respaldo-de-firma.mjs';
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');

/** Corre la lista en un proceso aparte y con el entorno limpio; devuelve lo que el guard dice. */
function medir() {
  const salida = path.join(TMP, 'medida.json');
  fs.rmSync(salida, { force: true });
  const env = { ...process.env };
  for (const k of ['NODE_TEST_CONTEXT', 'NODE_OPTIONS', 'FORCE_COLOR']) delete env[k];
  const r = spawnSync(process.execPath, [path.join(RAIZ, 'docs/master/evidencias/scrum1502/lista.mjs'), salida],
    { cwd: RAIZ, env, encoding: 'utf8' });
  if (!fs.existsSync(salida)) return { ciego: true, stderr: (r.stderr || '').slice(0, 300) };
  const j = JSON.parse(fs.readFileSync(salida, 'utf8'));
  const rojos = (r.stdout || '').split('\n').filter((l) => /^✖ /.test(l)).map((l) => l.replace(/\s*\(\d[\d.]*ms\)\s*$/, '').slice(2));
  return { sin: j.porNivel['sin-respaldo'], documental: j.porNivel.documental, lista: j.filas.map((f) => f.donde), rojos: [...new Set(rojos)] };
}

/** Aplica unas mutaciones, mide, y deshace comprobando los bytes. */
function caso(nombre, mutaciones) {
  const antes = [];
  for (const m of mutaciones) {
    const p = path.join(RAIZ, m.fichero);
    const existia = fs.existsSync(p);
    const original = existia ? fs.readFileSync(p) : null;
    antes.push({ p, existia, original });
    if (m.crear !== undefined) {
      if (existia) throw new Error(`${m.fichero} ya existe: no es una cobaya`);
      fs.writeFileSync(p, m.crear);
    } else {
      const texto = original.toString('utf8');
      const veces = texto.split(m.busca).length - 1;
      if (veces !== 1) throw new Error(`${nombre}: «${m.busca}» aparece ${veces} veces en ${m.fichero}, no 1`);
      fs.writeFileSync(p, texto.replace(m.busca, m.pon));
      if (sha(fs.readFileSync(p)) === sha(original)) throw new Error(`${nombre}: la mutación no cambió ${m.fichero}`);
    }
  }
  let medida;
  try { medida = medir(); } finally {
    // 🔴 EN ORDEN INVERSO. Dos mutaciones sobre el MISMO fichero guardan cada una su «antes», y el
    // de la segunda ya lleva la primera puesta: deshaciendo en el orden de ida, la última escritura
    // devuelve el fichero a medio mutar y cada comprobación suelta sale bien. Pasó en la primera
    // pasada de este guion (casos F y G ciegos) y lo cazó el `git status` del árbol desechable.
    for (const a of antes.reverse()) {
      if (a.existia) fs.writeFileSync(a.p, a.original); else fs.rmSync(a.p, { force: true });
      const ok = a.existia ? sha(fs.readFileSync(a.p)) === sha(a.original) : !fs.existsSync(a.p);
      if (!ok) throw new Error(`NO RESTAURADO: ${a.p}`);
    }
  }
  return { nombre, ...medida };
}

const doc = (cuerpo) => `# Cobaya de SCRUM-1502\n\nUn registro cualquiera, con una decisión del fundador sobre otra cosa.\n\n${cuerpo}\n`;
const quitarSin = { fichero: 'public/dashboard/js/homeView.js', busca: 'APROBADO por el fundador el 30-jul-2026', pon: 'APROBADO por el equipo el 30-jul-2026' };
const quitarCon = { fichero: 'src/modules/whatsappBot/domain/botFlow.service.ts', busca: 'aprobado por el fundador (5-jul-2026)', pon: 'aprobado por el equipo (5-jul-2026)' };
const citaAPelo = { fichero: COBAYA, crear: doc(`El código dice: «${FRASE}»`) };
const citaDeclarada = { fichero: COBAYA, crear: doc(`El código dice: [[cita]]«${FRASE}»[[/cita]]`) };
// La propuesta del punto ⑤, puesta SÓLO aquí para medirla: el índice de fuentes lee sin lo citado.
const propuesta = [
  { fichero: HELPER, busca: "import fs from 'node:fs';", pon: "import fs from 'node:fs';\nimport { sinCitas } from './_cita-declarada.mjs';" },
  { fichero: HELPER, busca: "const texto = fs.readFileSync(path.join(raiz, ruta), 'utf8');", pon: "const texto = sinCitas(fs.readFileSync(path.join(raiz, ruta), 'utf8'));" },
];

const base = { nombre: '0 · base, sin mutar', ...medir() };
if (base.ciego) { console.error('CIEGO en la base', base.stderr); process.exit(2); }
const filas = [
  base,
  caso('A · se le quita la marca a una SIN respaldo (homeView)', [quitarSin]),
  caso('B · se le quita la marca a una CON respaldo documental (botFlow, menú K1)', [quitarCon]),
  caso('C · un registro nuevo copia la frase del 409 a pelo', [citaAPelo]),
  caso('D · el mismo registro, con la frase entre [[cita]]', [citaDeclarada]),
  caso('E · la propuesta puesta, sin cobaya', propuesta),
  caso('F · la propuesta + la frase a pelo', [...propuesta, citaAPelo]),
  caso('G · la propuesta + la frase entre [[cita]]', [...propuesta, citaDeclarada]),
];

const enBase = new Set(base.lista);
for (const f of filas) {
  if (f.ciego) { console.log(`${f.nombre}\n    CIEGO: ${f.stderr}`); continue; }
  const salen = base.lista.filter((d) => !f.lista.includes(d));
  const entran = f.lista.filter((d) => !enBase.has(d));
  console.log(`${f.nombre}\n    sin-respaldo=${f.sin} documental=${f.documental}`
    + ` · salen: ${salen.join(', ') || '—'} · entran: ${entran.join(', ') || '—'}`
    + `\n    casos del guard en rojo (${f.rojos.length}): ${f.rojos.join(' | ') || '—'}`);
}
console.log(`POBLACION casos=${filas.length} ciegos=${filas.filter((f) => f.ciego).length}`);
