// docs/master/evidencias/SCRUM-917/mutar-917g.mjs — SCRUM-917g
//
// AUDITAR POR MUTACIÓN: ¿los tests y el guard que vigilan «El trabajo» plegable caen cuando lo que
// vigilan se rompe DE VERDAD? Cada mutación rompe UNA cosa del producto (o de sus registros), corre
// SÓLO las suites que deben notarlo, y restaura. Una suite que no cae ante su mutación no vigila nada.
//
// Cómo se usa (desde la raíz del repo, con el árbol LIMPIO y todo comiteado):
//     node docs/master/evidencias/SCRUM-917/mutar-917g.mjs
//
// 🔒 LAS TRES TRAMPAS QUE ESTE INSTRUMENTO YA CONOCE (00-normas-comunes A3, A21, A23):
//   1. PRIMERO LA BASE, sin mutar: sin ella un test inestable que cae se lee como un mutante que
//      muere. Si la base no da verde, no se muta nada.
//   2. UNA MUTACIÓN QUE NO SE APLICÓ SE LEE IGUAL QUE UNA QUE NO SE NOTÓ. Cada una comprueba que su
//      cadena aparece EXACTAMENTE una vez, que el fichero cambió, y deja escrito el
//      `git diff --numstat` al lado de su veredicto.
//   3. UN INSTRUMENTO SIN POBLACIÓN NO ES UN HALLAZGO. Cada veredicto lleva `tests`/`pass`/`fail` (o
//      las comprobaciones del guard); si no salen números, la fila es CIEGA, no un rojo.
//
// Restaura con `git restore --source=HEAD --staged --worktree` y exige `git status --porcelain`
// vacío tras CADA mutación: un `git checkout -- f` se llevaría un arreglo sin comitear. Los tests leen
// `public/` y `tests/` directamente (no `dist/`), así que no hace falta `npm run build` entre
// inyecciones (A23·10 vale para lo que corre contra `dist/`, y esto no).
import { spawnSync, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..', '..', '..', '..');
const git = (...a) => execFileSync('git', ['-C', RAIZ, ...a], { encoding: 'utf8' });

/** El entorno del sujeto se construye a mano: ni el color del chat ni NODE_OPTIONS entran (A21). */
function entorno() {
  const e = { ...process.env };
  delete e.FORCE_COLOR;
  delete e.NODE_OPTIONS;
  return e;
}

function correrTests(ficheros) {
  const tap = path.join(os.tmpdir(), `mut917g-${process.pid}-${Date.now()}.tap`);
  const r = spawnSync(process.execPath, [
    '--test', '--test-force-exit', '--test-reporter=tap', `--test-reporter-destination=${tap}`, ...ficheros,
  ], { cwd: RAIZ, env: entorno(), encoding: 'utf8', maxBuffer: 1 << 26 });
  const txt = fs.existsSync(tap) ? fs.readFileSync(tap, 'utf8') : '';
  fs.rmSync(tap, { force: true });
  const n = (k) => { const m = new RegExp(`^# ${k} (\\d+)`, 'm').exec(txt); return m ? Number(m[1]) : NaN; };
  return {
    exit: r.status, tests: n('tests'), pass: n('pass'), fail: n('fail'),
    caen: [...txt.matchAll(/^not ok \d+ - (.+)$/gm)].map((m) => m[1]),
  };
}

function correrGuard() {
  const r = spawnSync(process.execPath, ['scripts/guard-detalle-trabajo-917.mjs'], {
    cwd: RAIZ, env: entorno(), encoding: 'utf8', maxBuffer: 1 << 26,
  });
  const out = r.stdout || '';
  const pobl = /población: (\d+) comprobaciones/.exec(out);
  const malas = out.split(/\r?\n/).filter((l) => /^\s*❌/.test(l));
  return {
    exit: r.status, comprobaciones: pobl ? Number(pobl[1]) : NaN, malas: malas.length,
    primeras: malas.slice(0, 2).map((l) => l.trim().slice(0, 110)),
  };
}

/** La cadena tiene que aparecer EXACTAMENTE una vez, o la mutación no se aplica. */
function unaVez(src, cadena) {
  const n = src.split(cadena).length - 1;
  if (n !== 1) throw new Error(`la cadena aparece ${n} veces (debe ser 1): ${cadena.slice(0, 80)}`);
}
const sustituir = (desde, hasta) => (s) => { unaVez(s, desde); return s.replace(desde, () => hasta); };

const MODULO = 'public/dashboard/js/jobTrabajoPlegable.js';
const VISTA = 'public/dashboard/js/jobDetailView.js';
const T = {
  nuevo: 'tests/scrum917g-el-trabajo-plegable.test.mjs',
  o817: 'tests/scrum817-orden-del-detalle-del-trabajo.test.mjs',
  comp427: 'tests/scrum427-composicion-detalle.test.mjs',
  notas427: 'tests/scrum427-notas-internas-detalle.test.mjs',
  t317: 'tests/scrum317-trabajo-por-su-nombre.test.mjs',
  t319: 'tests/scrum319-documentos-por-tipo.test.mjs',
  t713c: 'tests/scrum713c-trinquete-de-estilos-en-js.test.mjs',
  t662: 'tests/scrum662-lista-de-scripts.test.mjs',
  colision: 'tests/dashboard-colision-declaraciones.test.mjs',
  t274: 'tests/scrum274-shell-alineado.test.mjs',
};
const TODAS = Object.values(T);
const ARRAY = '[lineaTipo, lineaDatos, lineaQuien, lineaNotas, lineaGastos]';

const MUTACIONES = [
  { id: 'M01', que: '«1 gasto» pasa a «1 gastos» (el plural firmado se cuela en el singular)',
    fichero: MODULO, aplicar: sustituir("unGasto: '1 gasto',", "unGasto: '1 gastos',"), suites: [T.nuevo], guard: true },
  { id: 'M02', que: '«No tienes equipo» nunca se dice (sinEquipo se ignora: siempre «Sin asignar»)',
    fichero: MODULO, suites: [T.nuevo], guard: true,
    aplicar: sustituir('return op.sinEquipo === true ? TEXTOS_EL_TRABAJO.sinEquipo : TEXTOS_EL_TRABAJO.sinAsignar;', 'return TEXTOS_EL_TRABAJO.sinAsignar;') },
  { id: 'M03', que: 'se quita `sinCuerpo()` cuando el equipo es ilegible (la línea vuelve a ser un control vacío)',
    fichero: VISTA, aplicar: sustituir('        lineaQuien.sinCuerpo();', '        void 0;'), suites: [], guard: true },
  { id: 'M04', que: 'el técnico ve las tarjetas para CAMBIAR el tipo (se quita la puerta `!isTecnico`)',
    fichero: VISTA, aplicar: sustituir('  if (!isTecnico) tipoSec.appendChild(tipoExpanded);', '  tipoSec.appendChild(tipoExpanded);'), suites: [], guard: true },
  { id: 'M05', que: 'la cabecera de cada línea pierde su `min-height: 44px` (zona de toque)',
    fichero: 'public/dashboard/css/styles.css', aplicar: sustituir('  min-height: 44px; padding: 6px 0;', '  padding: 6px 0;'), suites: [], guard: true },
  { id: 'M06', que: 'el script del módulo carga DESPUÉS de `jobDetailView.js` en el índice',
    fichero: 'public/dashboard/index.html', suites: [T.nuevo, T.t662, T.colision],
    aplicar: (s) => {
      const tag = '<script src="./js/jobTrabajoPlegable.js"></script>';
      const ancla = '<script src="./js/jobDetailView.js"></script>';
      unaVez(s, tag); unaVez(s, ancla);
      return s.replace(tag, () => '').replace(ancla, () => `${ancla}\n${tag}`);
    } },
  { id: 'M07', que: 'vuelve una casilla «Incluir precios en el parte» FUERA de la hoja de alta (en la barra de Documentos)',
    fichero: VISTA, aplicar: sustituir("valoradoHint.textContent = 'El parte sigue sin ser una factura.';", "valoradoHint.textContent = 'Incluir precios en el parte';"),
    suites: [T.t319, T.o817], guard: true },
  { id: 'M08', que: 'la llamada que pinta las notas se COMENTA (la función queda declarada y nadie la llama)',
    fichero: VISTA, aplicar: sustituir('  pintarNotasInternas(lineaNotas.cuerpo, job);', '  // pintarNotasInternas(lineaNotas.cuerpo, job);'),
    suites: [T.notas427], guard: true },
  { id: 'M09', que: 'la línea de gastos se construye pero NO se cuelga de la tarjeta',
    fichero: VISTA, aplicar: sustituir(ARRAY, '[lineaTipo, lineaDatos, lineaQuien, lineaNotas]'),
    suites: [T.comp427, T.o817], guard: true },
  { id: 'M10', que: 'se intercambian «Quién lo ejecuta» y «Notas internas» (orden distinto al del prototipo)',
    fichero: VISTA, aplicar: sustituir(ARRAY, '[lineaTipo, lineaDatos, lineaNotas, lineaQuien, lineaGastos]'),
    suites: [T.comp427, T.o817], guard: true },
  { id: 'M11', que: 'el módulo escribe un `style.cssText` (sube el trinquete de estilos desde JS)',
    fichero: MODULO, aplicar: sustituir("  det.className = 'detail-plega';", "  det.className = 'detail-plega';\n  det.style.cssText = 'display:block';"),
    suites: [T.t713c, T.nuevo], guard: false },
  { id: 'M12', que: 'el marcador del nombre vuelve al viejo «Ej. Reforma baño» (sin firma)',
    fichero: MODULO, aplicar: sustituir("marcadorNombre: 'Por ejemplo: cambio de cuadro en el 3º B',", "marcadorNombre: 'Ej. Reforma baño',"),
    suites: [T.t317, T.nuevo], guard: false },
  { id: 'M13', que: 'el rótulo de las notas vuelve a llevar emoji («📝 Notas internas»)',
    fichero: MODULO, aplicar: sustituir("rotuloNotas: 'Notas internas',", "rotuloNotas: '📝 Notas internas',"),
    suites: [T.comp427, T.notas427, T.nuevo], guard: false },
  { id: 'M14', que: '«Nombre y dirección» vuelve a llamarse «Datos» (rótulo sin firma; la enmienda deja de casar)',
    fichero: MODULO, aplicar: sustituir("rotuloDatos: 'Nombre y dirección',", "rotuloDatos: 'Datos',"),
    suites: [T.comp427, T.o817, T.nuevo], guard: false },
  { id: 'M15', que: 'el marcador de las notas vuelve al de Presupuestos (dos marcadores en la pantalla)',
    fichero: MODULO, aplicar: sustituir("marcadorNotas: 'Lo que necesites recordar de este trabajo.',", "marcadorNotas: 'Anota detalles del trabajo, acuerdos verbales, recordatorios…',"),
    suites: [T.notas427, T.nuevo], guard: false },
  // 🔒 M16 TUVO UNA PRIMERA VERSIÓN QUE ERA UN MUTANTE EQUIVALENTE, y se deja escrito porque el
  // fallo es de este instrumento y no del test. La primera mutó `valor: nombresAsignados || …` —el
  // valor INICIAL de la línea, antes de leer el equipo— a `valor: ''`, y pasó en verde en las suites y
  // en el guard F. No era un agujero: la línea recibe su valor DEFINITIVO más abajo, en
  // `lineaQuien.poner(resumenDeQuien({ nombres: nombresAsignados, … }))`, cuando ya se leyó el equipo, y
  // los dos instrumentos miden el estado ASENTADO. Un mutante que no cambia lo observable no prueba
  // que falte un test: prueba que se mutó el sitio equivocado. Lo que NO se mide, y se declara: el
  // valor inicial (los ~100 ms antes de que llegue el equipo, para que no parpadee).
  { id: 'M16', que: 'la línea «Quién lo ejecuta» CERRADA deja de decir los nombres una vez leído el equipo (hay que abrirla)',
    fichero: VISTA, aplicar: sustituir('          nombres: nombresAsignados,\n          sinEquipo: sel.editable', "          nombres: '',\n          sinEquipo: sel.editable"),
    suites: [T.o817], guard: true },
  { id: 'M17', que: 'las tarjetas del tipo pierden `aria-pressed` (ya no hay función detrás de «Cambiar»)',
    fichero: VISTA, aplicar: sustituir("card.setAttribute('aria-pressed', String(c.value === tipoActual));", "card.setAttribute('aria-selected', String(c.value === tipoActual));"),
    suites: [T.o817], guard: false },
  { id: 'M18', que: 'la explicación del nombre se escribe a mano en la vista (literal duplicado, sin fuente única)',
    fichero: VISTA, aplicar: sustituir('nombreAyuda.textContent = textosTrabajo.ayudaNombre;', "nombreAyuda.textContent = 'Si lo dejas vacío, se usa el del cliente.';"),
    suites: [T.nuevo], guard: false },
  { id: 'M19', que: 'el módulo desaparece del SHELL del service worker',
    fichero: 'public/sw.js', aplicar: sustituir("'/dashboard/js/jobTrabajoPlegable.js',", ''),
    suites: [T.nuevo, T.t274], guard: false },
];

function fila(m, numstat, t, g) {
  const partes = [`${m.id} · ${m.que}`, `   diff --numstat: ${numstat.replace(/\s+/g, ' ')}`];
  let rojo = false;
  if (t) {
    const ciega = Number.isNaN(t.tests);
    partes.push(`   tests: ${ciega ? 'CIEGO (sin población)' : `${t.tests} tests · ${t.pass} pass · ${t.fail} fail`} · exit ${t.exit}`
      + (t.caen.length ? `\n   caen: ${t.caen.slice(0, 4).join(' ‖ ')}${t.caen.length > 4 ? ` (+${t.caen.length - 4})` : ''}` : ''));
    if (ciega) return { texto: partes.join('\n') + '\n   ⇒ ⚠️ CIEGO: no cuenta como rojo', ciego: true };
    if (t.fail > 0) rojo = true;
  }
  if (g) {
    const ciega = Number.isNaN(g.comprobaciones);
    partes.push(`   guard F: exit ${g.exit} · ${ciega ? 'sin población' : `${g.comprobaciones} comprobaciones`} · ${g.malas} ❌`
      + (g.primeras.length ? `\n   caen: ${g.primeras.join(' ‖ ')}` : ''));
    if (ciega) return { texto: partes.join('\n') + '\n   ⇒ ⚠️ CIEGO: no cuenta como rojo', ciego: true };
    if (g.exit !== 0) rojo = true;
  }
  return { texto: partes.join('\n') + `\n   ⇒ ${rojo ? '🔴 CAZADA (el rojo salió)' : '🟢 NO CAZADA — la mutación pasó en verde: algo no vigila lo que dice'}`, rojo };
}

/** `--solo=M16,M03` corre sólo esas (la BASE se corre siempre). Sin la opción, las 19. */
const SOLO = (process.argv.find((a) => a.startsWith('--solo=')) || '').slice(7).split(',').filter(Boolean);

function main() {
  const lista = SOLO.length ? MUTACIONES.filter((m) => SOLO.includes(m.id)) : MUTACIONES;
  if (SOLO.length && lista.length !== SOLO.length) {
    console.log(`ABORTO: --solo pide ${SOLO.join(',')} y sólo existen ${lista.map((m) => m.id).join(',') || 'ninguna'}.`);
    process.exit(2);
  }
  if (git('status', '--porcelain').trim()) {
    console.log('ABORTO: el árbol no está limpio. Se comitea TODO antes de inyectar (A23·9).');
    process.exit(3);
  }
  const cabecera = git('rev-parse', 'HEAD').trim();
  console.log(`HEAD ${cabecera} · ${lista.length} mutaciones${SOLO.length ? ` (--solo=${SOLO.join(',')})` : ''} · suites: ${TODAS.length} ficheros · guard F: scripts/guard-detalle-trabajo-917.mjs`);

  // ── LA BASE, sin mutar ──────────────────────────────────────────────────────────────────
  const baseT = correrTests(TODAS);
  const baseG = correrGuard();
  console.log(`BASE sin mutar · tests: ${baseT.tests} tests · ${baseT.pass} pass · ${baseT.fail} fail · exit ${baseT.exit}`
    + ` · guard F: exit ${baseG.exit} · ${baseG.comprobaciones} comprobaciones · ${baseG.malas} ❌`);
  if (baseT.exit !== 0 || baseG.exit !== 0 || Number.isNaN(baseT.tests) || Number.isNaN(baseG.comprobaciones)) {
    console.log('ABORTO: la BASE no da verde con población. Sin ella un rojo no significa nada.');
    process.exit(4);
  }

  const resumen = { cazadas: 0, noCazadas: [], ciegas: [], noAplicadas: [] };
  for (const m of lista) {
    console.log('');
    const ruta = path.join(RAIZ, m.fichero);
    let numstat = '';
    try {
      const antes = fs.readFileSync(ruta, 'utf8');
      const despues = m.aplicar(antes);
      if (despues === antes) throw new Error('el fichero no cambió');
      fs.writeFileSync(ruta, despues);
      numstat = git('diff', '--numstat', '--', m.fichero).trim();
      if (!numstat) throw new Error('git diff --numstat vacío: la inyección no se aplicó');
    } catch (e) {
      console.log(`${m.id} · ${m.que}\n   ⇒ ⚠️ NO APLICADA (${e.message}). No cuenta ni como rojo ni como verde.`);
      resumen.noAplicadas.push(m.id);
      git('restore', '--source=HEAD', '--staged', '--worktree', '--', m.fichero);
      continue;
    }
    let t = null;
    let g = null;
    try {
      if (m.suites.length) t = correrTests(m.suites);
      if (m.guard) g = correrGuard();
    } finally {
      git('restore', '--source=HEAD', '--staged', '--worktree', '--', m.fichero);
    }
    const restos = git('status', '--porcelain').trim();
    if (restos) { console.log(`ABORTO: tras restaurar ${m.id} el árbol no está limpio:\n${restos}`); process.exit(5); }
    const f = fila(m, numstat, t, g);
    console.log(f.texto);
    if (f.ciego) resumen.ciegas.push(m.id);
    else if (f.rojo) resumen.cazadas++;
    else resumen.noCazadas.push(m.id);
  }

  console.log('');
  console.log(`RESUMEN: ${resumen.cazadas} de ${lista.length} cazadas · no cazadas: ${resumen.noCazadas.join(', ') || '—'}`
    + ` · ciegas: ${resumen.ciegas.join(', ') || '—'} · no aplicadas: ${resumen.noAplicadas.join(', ') || '—'}`);
  console.log(`ÁRBOL FINAL: git status --porcelain ${git('status', '--porcelain').trim() ? 'SUCIO' : 'vacío'} · HEAD ${git('rev-parse', 'HEAD').trim()}`);
  process.exit(resumen.noCazadas.length || resumen.ciegas.length || resumen.noAplicadas.length ? 1 : 0);
}

main();
