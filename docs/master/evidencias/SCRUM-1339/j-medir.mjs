// docs/master/evidencias/SCRUM-1339/j-medir.mjs — SCRUM-1339j · ¿POR QUÉ CIEGA `scrum859`?
//
// Ejecuta el meta-guard DE LA CASA (`correr` y `aplicarUna` de scripts/meta-guard-mutaciones.mjs,
// sin copiar su lógica) sobre un guard y cada una de sus mutaciones declaradas, y al lado mide lo
// que el instrumento no enseña: los bytes que el hijo manda al padre, evento a evento.
//
//   node j-medir.mjs <raíz del árbol> <carpeta de FUERA del árbol> <guard.test.mjs> [pasadas=1]
//
// Variables: J_TUBERIA=no-bloqueante (la sonda `j-sonda-tuberia.mjs` cargada por NODE_OPTIONS).
// ⚠️ MUTA el árbol (lo hace `aplicarUna`, que restaura en su `finally`). Al acabar se comprueban
// los bytes de cada fichero mutado contra los de antes.
import fs from 'node:fs';
import path from 'node:path';
import v8 from 'node:v8';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const [RAIZ, FUERA, GUARD, pasadasTxt = '1'] = process.argv.slice(2);
if (!RAIZ || !FUERA || !GUARD) { console.error('uso: node j-medir.mjs <raíz> <carpeta de fuera> <guard> [pasadas]'); process.exit(2); }
const PASADAS = Number(pasadasTxt);
fs.mkdirSync(FUERA, { recursive: true });
const M = await import(pathToFileURL(path.join(RAIZ, 'scripts/meta-guard-mutaciones.mjs')).href);
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex').slice(0, 12);

/** Trocea el canal hijo→padre (`child-v8`): [0xFF 0x0F][tamaño, 4 B BE][valor]. */
export function trocear(buf) {
  const ev = []; let i = 0; let resto = 0;
  while (i + 6 <= buf.length) {
    if (buf[i] !== 0xFF || buf[i + 1] !== 0x0F) { resto = buf.length - i; break; }
    const n = buf.readUInt32BE(i + 2);
    if (i + 6 + n > buf.length) { resto = buf.length - i; break; }
    let item = null;
    // El valor trae su propia cabecera v8 (medido: `ff 0f 00 00 01 89 ff 0f 6f …`).
    try { item = v8.deserialize(buf.subarray(i + 6, i + 6 + n)); } catch { /* se cuenta como ilegible */ }
    ev.push({ desde: i, bytes: 6 + n, tipo: item?.type ?? '(ilegible)', nombre: item?.data?.name ?? null, nesting: item?.data?.nesting ?? null });
    i += 6 + n;
  }
  if (i < buf.length && !resto) resto = buf.length - i;
  return { ev, resto };
}

/** El hijo, lanzado como lo lanza `run({ forceExit: true })`, con su salida capturada entera. */
function hijo(guard, testigo) {
  return new Promise((ok) => {
    const env = { ...process.env, NODE_TEST_CONTEXT: 'child-v8' };
    if (testigo) env.J_TESTIGO = testigo; else delete env.J_TESTIGO;
    const h = spawn(process.execPath, ['--test-force-exit', path.join(RAIZ, 'tests', guard)], { cwd: RAIZ, env, stdio: ['ignore', 'pipe', 'pipe'] });
    const trozos = []; let err = 0;
    h.stdout.on('data', (d) => trozos.push(d));
    h.stderr.on('data', (d) => { err += d.length; });
    h.on('close', (codigo) => ok({ buf: Buffer.concat(trozos), err, codigo }));
  });
}

function tablaDeEventos(buf, cae, rotulo) {
  const { ev, resto } = trocear(buf);
  const veredictos = ev.filter((e) => (e.tipo === 'test:pass' || e.tipo === 'test:fail') && e.nesting === 0);
  console.log(`  ${rotulo}: ${buf.length} B hacia el padre · ${ev.length} mensajes enteros · ${resto} B de resto sin trocear · veredictos de primer nivel ${veredictos.length}`);
  const porTipo = {};
  for (const e of ev) { porTipo[e.tipo] ??= { n: 0, b: 0 }; porTipo[e.tipo].n += 1; porTipo[e.tipo].b += e.bytes; }
  console.log('    por tipo: ' + Object.entries(porTipo).sort((a, b) => b[1].b - a[1].b).map(([t, x]) => `${t} ×${x.n} = ${x.b} B`).join(' · '));
  let k = 0;
  for (const e of veredictos) {
    k += 1;
    const marca = cae && e.nombre?.includes(cae) ? '  ← EL DECLARADO' : '';
    console.log(`    ${String(k).padStart(2)} ${e.tipo === 'test:pass' ? 'pasa' : 'CAE '} · empieza en el byte ${String(e.desde).padStart(8)} · ${String(e.bytes).padStart(7)} B · faltan ${String(buf.length - e.desde - e.bytes).padStart(7)} B detrás · «${String(e.nombre).slice(0, 58)}»${marca}`);
  }
  return { total: buf.length, veredictos };
}

const clase = (r) => (r.ok ? 'VIVA' : r.ciego ? 'CIEGO' : r.muerto ? 'FICHERO MUERTO' : r.mudo ? 'MUDA' : `(sin clasificar: ${Object.keys(r).join(',')})`);
const cuenta = (r) => `${r.pasados.length} pasados · ${r.caidos.length} caídos · ${r.saltados.length} saltados`;

const fuente = fs.readFileSync(path.join(RAIZ, 'tests', GUARD), 'utf8');
const muts = M.mutacionesDeclaradas(fuente, GUARD);
console.log(`node ${process.version} ${process.platform} · tubería del hijo: ${process.env.J_TUBERIA || 'la de la plataforma'} · sonda en NODE_OPTIONS: ${/j-sonda-tuberia/.test(process.env.NODE_OPTIONS || '') ? 'sí' : 'no'}`);
console.log(`POBLACIÓN: ${GUARD} · ${muts.length} mutación(es) declaradas · ${PASADAS} pasada(s) de cada una`);
const antes = new Map(muts.map((m) => [m.fichero, sha(fs.readFileSync(path.join(RAIZ, m.fichero)))]));

const recuento = {};
for (let p = 1; p <= PASADAS; p += 1) {
  const limpia = await M.correr(GUARD);
  if (p === 1) {
    console.log(`\n── LIMPIA (por \`correr\` del meta-guard): ${cuenta(limpia)} · árbol movido: ${limpia.movidos.length}`);
    const b = await hijo(GUARD, path.join(FUERA, 'testigo-limpia.jsonl'));
    tablaDeEventos(b.buf, null, 'LIMPIA, canal crudo');
    console.log(`    el hijo salió con ${b.codigo}`);
  }
  let k = 0;
  for (const mut of muts) {
    k += 1;
    const r = await M.aplicarUna(mut, GUARD, limpia);
    const c = clase(r);
    recuento[k] ??= {}; recuento[k][c] = (recuento[k][c] || 0) + 1;
    if (p === 1 || c !== 'VIVA') {
      console.log(`\n── pasada ${p} · MUTACIÓN ${k} · ${mut.fichero} · cae: «${mut.cae}»`);
      console.log(`   VEREDICTO DEL META-GUARD (\`aplicarUna\`): ${c}`);
      const texto = r.ciego || r.muerto || r.mudo;
      if (texto) console.log('   lo que dice: ' + String(texto).replace(/\s+/g, ' ').slice(0, 700));
    }
    if (p === 1) {
      // El canal crudo de la MISMA mutación, aplicada a mano como la aplica `aplicarUna` (primera
      // ocurrencia) y devuelta en un `finally` con los bytes comprobados.
      const abs = path.join(RAIZ, mut.fichero);
      const ORIGINAL = fs.readFileSync(abs);
      let b;
      try {
        fs.writeFileSync(abs, ORIGINAL.toString('utf8').replace(mut.de, mut.a));
        b = await hijo(GUARD, path.join(FUERA, `testigo-mut${k}.jsonl`));
      } finally {
        fs.writeFileSync(abs, ORIGINAL);
        if (Buffer.compare(fs.readFileSync(abs), ORIGINAL) !== 0) { console.error(`🔴 NO RESTAURADO ${abs}`); process.exit(3); }
      }
      tablaDeEventos(b.buf, mut.cae, `MUTADA ${k}, canal crudo`);
      console.log(`    el hijo salió con ${b.codigo}`);
    }
  }
}
console.log('\n── RECUENTO DE VEREDICTOS por mutación, sobre ' + PASADAS + ' pasada(s):');
for (const [k, x] of Object.entries(recuento)) console.log(`   mutación ${k}: ` + Object.entries(x).map(([c, n]) => `${c} ${n}`).join(' · '));
let sucio = 0;
for (const [f, h] of antes) { const ahora = sha(fs.readFileSync(path.join(RAIZ, f))); if (ahora !== h) { sucio += 1; console.log(`🔴 ${f} NO está como estaba (${h} → ${ahora})`); } }
console.log(`ÁRBOL: ${antes.size} fichero(s) mutados comprobados por sha256 · distintos de antes: ${sucio}`);
for (const t of ['testigo-limpia.jsonl', 'testigo-mut1.jsonl', 'testigo-mut2.jsonl']) {
  const f = path.join(FUERA, t);
  if (fs.existsSync(f)) console.log(`TESTIGO ${t}: ${fs.readFileSync(f, 'utf8').trim().split('\n').at(-1)}`);
}
console.log(`EXIT=${sucio ? 3 : 0}`);
process.exit(sucio ? 3 : 0);
