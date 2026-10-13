// SCRUM-1511d · CUANTOS LITERALES PINTADOS HOY TIENEN COMO UNICO RESPALDO UNA FIRMA DELEGADA.
//
// SOLO LEE. No escribe en el arbol, no sale de la maquina, no toca ninguna ficha ni ninguna marca.
//
//   node docs/master/evidencias/scrum1511d/censo-firma-delegada.mjs            (resumen)
//   node docs/master/evidencias/scrum1511d/censo-firma-delegada.mjs --fichas   (+ una fila por ficha)
//   node docs/master/evidencias/scrum1511d/censo-firma-delegada.mjs --textos   (+ cada literal, RECORTADO)
//
// QUE MIDE, Y CON QUE:
//   · QUIEN FIRMA lo dice el lector de la casa, `tests/_microcopy-aprobada.mjs` (no se reescribe):
//     'fundador' si la ficha lleva «Aprobado por el fundador» fuera de cita; 'orquestador' si lleva la
//     firma delegada completa. El registro congelado es 'fundador' entero, por construccion del lector.
//   · QUE TEXTOS lleva una ficha: toda linea de cita, con las mismas tres cajas que usa el cruce de
//     `tests/scrum514-aprobado-y-aplicado.test.mjs` (corta < 4 · plantilla con {hueco} · cruce).
//     Esa funcion no se exporta: aqui va copiada, y la segunda sonda de abajo la vigila.
//   · PINTADO HOY: el literal aparece tal cual en `public/**/*.{js,ts,html}` o `src/**/*.ts`, en al
//     menos una linea que NO es comentario. Es el mismo corpus de scrum514, con un filtro mas.
//
// LO QUE NO MIDE, DICHO AQUI Y EN LA SALIDA:
//   · que el comentario de Jira que la ficha nombra diga lo que la ficha dice (no sale a la red);
//   · textos firmados en Jira que NO tienen ficha (no estan en esta poblacion);
//   · que una linea de codigo que contiene el literal llegue de verdad a una pantalla;
//   · las plantillas con hueco: el codigo las compone y no aparecen tal cual. Se cuentan aparte.
//
// Los literales se imprimen RECORTADOS a proposito: una salida que copie entero un literal al lado
// de la palabra que nombra al firmante se convierte en respaldo para el trinquete de firmas.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const lector = await import(pathToFileURL(path.join(RAIZ, 'tests', '_microcopy-aprobada.mjs')).href);
const VER_FICHAS = process.argv.includes('--fichas');
const VER_TEXTOS = process.argv.includes('--textos');

// ── las citas de una ficha, con su caja (copia de `citasDeFicha` de scrum514) ──────────────────
function citasDeFicha(md) {
  const out = [];
  for (const linea of md.split('\n')) {
    if (/^#{1,6}\s+(.*)$/.test(linea.trimEnd())) continue;
    const m = /^>\s?(.+)$/.exec(linea.trim());
    if (!m || m[1].trim() === '') continue;
    const texto = m[1].trim();
    if (texto.length < 4) { out.push({ texto, caja: 'corta' }); continue; }
    if (/{[^}]+}/.test(texto)) { out.push({ texto, caja: 'plantilla' }); continue; }
    out.push({ texto, caja: 'cruce' });
  }
  return out;
}

// ── TODAS las unidades de una ficha: sus lineas de cita Y las celdas de la columna «Texto aprobado»
// de sus tablas. Las segundas las da el lector (su campo "literales"); scrum514 NO las cruza (solo
// citas), y 20 fichas delegadas escriben sus textos SOLO en tabla: sin esto salian con cero.
const TILDE = String.fromCharCode(96);
function desnudo(s) {
  // lo mismo que hace el lector con una cita: quita el adorno de Markdown que la envuelve
  let t = String(s).trim();
  for (let i = 0; i < 4; i++) {
    const antes = t;
    if (t.length > 1 && t.startsWith(TILDE) && t.endsWith(TILDE)) t = t.slice(1, -1);
    t = t.replace(/^\*\*(.*)\*\*$/s, '$1').replace(/^\*(.*)\*$/s, '$1').trim();
    if (t === antes) break;
  }
  return t;
}
function unidadesDeFicha(a) {
  const out = citasDeFicha(a.texto).map((c) => ({ ...c, via: 'cita' }));
  const ya = new Set(out.map((c) => desnudo(c.texto)));
  for (const t of a.literales) {
    // el lector devuelve tambien las citas, ya desnudas: esas ya estan contadas
    if (ya.has(t)) continue;
    ya.add(t);
    const caja = t.length < 4 ? 'corta' : (/{[^}]+}/.test(t) ? 'plantilla' : 'cruce');
    out.push({ texto: t, caja, via: 'tabla' });
  }
  return out;
}

// ── el corpus: lineas de codigo, separando las que son comentario ──────────────────────────────
function leerCorpus() {
  const ficheros = [];
  const walk = (d, ext) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist') continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) { walk(p, ext); continue; }
      if (ext.test(e.name)) ficheros.push(p);
    }
  };
  walk(path.join(RAIZ, 'public'), /\.(js|ts|html)$/);
  walk(path.join(RAIZ, 'src'), /\.ts$/);
  let entero = '';
  let sinComentarios = '';
  for (const f of ficheros) {
    const t = fs.readFileSync(f, 'utf8');
    entero += t + '\n';
    let enBloque = false;
    for (const l of t.split(/\r?\n/)) {
      const s = l.trim();
      if (enBloque) { if (s.includes('*/') || s.includes('-->')) enBloque = false; continue; }
      if (s.startsWith('//') || s.startsWith('*')) continue;
      if (s.startsWith('/*') || s.startsWith('<!--')) {
        if (!(s.includes('*/') || s.includes('-->'))) enBloque = true;
        continue;
      }
      sinComentarios += l + '\n';
    }
  }
  return { entero, sinComentarios, cuantos: ficheros.length };
}

const recorte = (t) => (t.length <= 14 ? t.slice(0, 6) + '…' : t.slice(0, 12) + '…') + ` [${t.length} car.]`;

// ═══ LA MEDICION ══════════════════════════════════════════════════════════════════════════════
const todas = lector.aprobacionesDeMicrocopy();
const fichas = todas.filter((a) => a.origen === 'fichero');
const congelado = todas.filter((a) => a.origen === 'congelado');
const corpus = leerCorpus();

// Lo que consta firmado por el fundador, por identidad de literal: las citas de SUS fichas, y del
// registro congelado todo lo que el lector da por literal mas lo que va entre comillas de codigo en
// la ultima columna (la unidad que cruza scrum514). Se toma la union: en la duda, a favor de «directa».
const directos = new Set();
for (const a of fichas) if (a.firmante === 'fundador') for (const c of unidadesDeFicha(a)) directos.add(c.texto);
for (const a of congelado) {
  for (const l of a.literales) directos.add(l);
  for (const linea of a.texto.split('\n')) {
    const t0 = linea.trim();
    if (!t0.startsWith('|')) continue;
    for (const m of t0.matchAll(/`([^`]+)`/g)) directos.add(m[1].trim());
  }
}

const filas = [];        // una por (ficha, cita)
for (const a of fichas) {
  for (const c of unidadesDeFicha(a)) {
    filas.push({
      ficha: a.nombre,
      firmante: a.firmante,
      referencia: a.delegacion ? a.delegacion.referencia : null,
      texto: c.texto,
      caja: c.caja,
      via: c.via,
      enCodigo: corpus.entero.includes(c.texto),
      pintado: corpus.sinComentarios.includes(c.texto),
    });
  }
}

const delegadas = fichas.filter((a) => a.firmante === 'orquestador');
const delFundador = fichas.filter((a) => a.firmante === 'fundador');
const otras = fichas.filter((a) => a.firmante !== 'orquestador' && a.firmante !== 'fundador');

const filasDeleg = filas.filter((f) => f.firmante === 'orquestador');
const distintos = (lista) => [...new Set(lista.map((f) => f.texto))];

const delegCruce = distintos(filasDeleg.filter((f) => f.caja === 'cruce'));
const estaPintado = (t) => corpus.sinComentarios.includes(t);
const soloDelegada = delegCruce.filter((t) => !directos.has(t));
const tambienDirecta = delegCruce.filter((t) => directos.has(t));
const LA_CIFRA = soloDelegada.filter(estaPintado);
const soloDelegadaSinPintar = soloDelegada.filter((t) => !estaPintado(t));

console.log('SCRUM-1511d · censo de literales con firma delegada · arbol', RAIZ);
console.log('');
console.log('POBLACION');
console.log(`  fichas en docs/microcopy/ ............... ${fichas.length}  (+ ${congelado.length} registro congelado)`);
console.log(`    firma del fundador .................... ${delFundador.length} fichas · ${filas.filter((f) => f.firmante === 'fundador').length} citas`);
console.log(`    firma delegada (orquestador) .......... ${delegadas.length} fichas · ${filasDeleg.length} citas`);
console.log(`    otra firma o ninguna .................. ${otras.length} fichas`);
console.log(`  comentarios de Jira distintos que nombran las delegadas: ${new Set(delegadas.map((a) => a.delegacion && a.delegacion.referencia)).size}`);
console.log(`  de las citas delegadas: por linea de cita ${filasDeleg.filter((f) => f.via === 'cita').length} · por celda de tabla ${filasDeleg.filter((f) => f.via === 'tabla').length}`);
const mudas = delegadas.filter((a) => unidadesDeFicha(a).length === 0);
console.log(`  fichas delegadas SIN ninguna unidad ..... ${mudas.length}${mudas.length ? ' → ' + mudas.map((a) => a.nombre.replace(/\.md$/, '')).join(' · ') : ''}`);
console.log(`  corpus: ${corpus.cuantos} ficheros de public/ y src/ · ${corpus.entero.length} caracteres (${corpus.sinComentarios.length} sin comentarios)`);
console.log(`  delegacion vigente segun limites-del-fundador.md: ${lector.delegacionVigente()}`);
console.log('');
console.log('CITAS DE FICHAS DELEGADAS, POR CAJA (lineas de cita, con repeticiones)');
for (const caja of ['cruce', 'plantilla', 'corta']) console.log(`  ${caja.padEnd(10)} ${filasDeleg.filter((f) => f.caja === caja).length}`);
console.log('');
console.log('LITERALES DISTINTOS DE FICHAS DELEGADAS QUE SE PUEDEN CRUZAR:', delegCruce.length);
console.log(`  el mismo literal consta tambien firmado por el fundador (otra ficha o el congelado): ${tambienDirecta.length}`);
console.log(`  SOLO en fichas delegadas ................................................. ${soloDelegada.length}`);
console.log(`     pintados hoy (fuera de comentario) ..................................... ${LA_CIFRA.length}   ← LA CIFRA`);
console.log(`     no pintados (aparcados, compuestos o notas escritas como cita) ......... ${soloDelegadaSinPintar.length}`);
console.log(`       de ellos, el literal esta en el codigo pero solo en comentarios ..... ${soloDelegadaSinPintar.filter((t) => corpus.entero.includes(t)).length}`);
const plant = distintos(filasDeleg.filter((f) => f.caja === 'plantilla'));
const cortas = distintos(filasDeleg.filter((f) => f.caja === 'corta'));
console.log(`  FUERA DEL CRUCE, sin medir si se pintan: plantillas con hueco ${plant.length} (${plant.filter((t) => !directos.has(t)).length} solo delegadas) · cortas ${cortas.length}`);
console.log('');

// ═══ CONTROLES ════════════════════════════════════════════════════════════════════════════════
let rojo = 0;
const control = (nombre, ok, detalle) => { if (!ok) rojo++; console.log(`  ${ok ? 'OK ' : 'ROJO'} · ${nombre} · ${detalle}`); };
console.log('CONTROLES');

// POSITIVO OBLIGATORIO: dos literales que Jira dice firmados por el fundador EN PERSONA (leidos a
// mano en SCRUM-1511 c.18909: SCRUM-1252 c.17726 y SCRUM-1258 c.17713) tienen que salir «directa»
// Y pintados. Se identifican por su ficha, no copiando aqui el literal.
for (const [ticket, ranura] of [['SCRUM-1252', 'libro-solo-facturas'], ['SCRUM-1258', 'tipo-distinto-del-sellado']]) {
  const a = fichas.find((x) => x.ticket === ticket && x.ranura === ranura);
  const cs = a ? unidadesDeFicha(a).filter((c) => c.caja === 'cruce') : [];
  const pint = cs.filter((c) => estaPintado(c.texto));
  control(`POSITIVO ${ticket}/${ranura}`,
    !!a && a.firmante === 'fundador' && cs.length > 0 && pint.length > 0 && cs.every((c) => directos.has(c.texto)) && !cs.some((c) => LA_CIFRA.includes(c.texto)),
    a ? `firmante=${a.firmante} · citas cruzables ${cs.length} · pintadas ${pint.length} · en LA CIFRA ${cs.filter((c) => LA_CIFRA.includes(c.texto)).length}` : 'LA FICHA NO ESTA');
}
// POSITIVO DEL OTRO LADO: la ficha que SCRUM-915 c.15868 firma por delegacion (leido a mano en
// c.18904) tiene que salir delegada, y aportar literales a LA CIFRA.
{
  const a = fichas.find((x) => x.ticket === 'SCRUM-915' && x.ranura === 'pasos-del-editor');
  const cs = a ? unidadesDeFicha(a).filter((c) => c.caja === 'cruce') : [];
  const dentro = cs.filter((c) => LA_CIFRA.includes(c.texto));
  control('POSITIVO delegada SCRUM-915/pasos-del-editor',
    !!a && a.firmante === 'orquestador' && a.delegacion && a.delegacion.referencia === 'SCRUM-915 comentario 15868' && dentro.length > 0,
    a ? `firmante=${a.firmante} · ref=${a.delegacion && a.delegacion.referencia} · cruzables ${cs.length} · en LA CIFRA ${dentro.length}` : 'LA FICHA NO ESTA');
}
// DE CERO: un literal que no existe, derivado en cada pasada (no es un numero ni un texto fijo).
{
  const semilla = LA_CIFRA.length ? LA_CIFRA[0] : 'vacio';
  const falso = semilla + ' ' + crypto.createHash('sha1').update(corpus.entero).digest('hex').slice(0, 10);
  control('DE CERO: literal derivado que no existe',
    !corpus.entero.includes(falso) && !directos.has(falso) && !delegCruce.includes(falso),
    `en codigo ${corpus.entero.includes(falso)} · directo ${directos.has(falso)} · delegado ${delegCruce.includes(falso)}`);
  // y el mismo cruce SI ve la semilla sin el anadido: el instrumento no esta mudo
  control('POSITIVO del cruce: la semilla sin el anadido', LA_CIFRA.length > 0 && corpus.entero.includes(semilla), `en codigo ${corpus.entero.includes(semilla)}`);
}
// SEGUNDA SONDA de la extraccion: lineas de cita contadas a pelo sobre el directorio.
{
  const dir = path.join(RAIZ, 'docs', 'microcopy');
  const aPelo = fs.readdirSync(dir).filter((n) => n.endsWith('.md') && n !== 'README.md')
    .flatMap((n) => fs.readFileSync(path.join(dir, n), 'utf8').split(/\r?\n/))
    .filter((l) => /^\s*>\s*\S/.test(l)).length;
  const porCita = filas.filter((f) => f.via === 'cita').length;
  control('SEGUNDA SONDA: citas a pelo = citas extraidas', aPelo === porCita, `a pelo ${aPelo} · extraidas por cita ${porCita} · ademas por tabla ${filas.length - porCita}`);
  // y las de tabla contra el lector: toda unidad que el lector da sale aqui, y ninguna de mas
  const delLector = fichas.reduce((n, a) => n + new Set(a.literales).size, 0);
  const mias = fichas.reduce((n, a) => n + new Set(unidadesDeFicha(a).map((u) => desnudo(u.texto))).size, 0);
  control('SEGUNDA SONDA: unidades por ficha = literales del lector', delLector === mias, `lector ${delLector} · aqui ${mias}`);
}
// TAMANO: suelos de la poblacion. Con menos, nada de lo de arriba significa nada.
control('SUELO de poblacion', fichas.length >= 100 && corpus.cuantos >= 200 && directos.size >= 100,
  `fichas ${fichas.length} · ficheros ${corpus.cuantos} · literales directos ${directos.size}`);
control('TODA ficha tiene firmante conocido', otras.length === 0, `otras ${otras.length}`);

if (VER_FICHAS || VER_TEXTOS) {
  console.log('');
  console.log('POR FICHA DELEGADA: referencia · ficha · citas (cruce/plantilla/corta) · literales en LA CIFRA');
  for (const a of delegadas.sort((x, y) => x.nombre.localeCompare(y.nombre))) {
    const cs = unidadesDeFicha(a);
    const n = (caja) => cs.filter((c) => c.caja === caja).length;
    const dentro = [...new Set(cs.map((c) => c.texto))].filter((t) => LA_CIFRA.includes(t));
    console.log(`  ${a.delegacion.referencia.padEnd(28)} ${a.nombre.padEnd(62)} ${n('cruce')}/${n('plantilla')}/${n('corta')} · ${dentro.length}`);
    if (VER_TEXTOS) for (const t of dentro) console.log(`        · ${recorte(t)}`);
  }
  console.log('');
  console.log('POR COMENTARIO DE JIRA: literales distintos en LA CIFRA');
  const porRef = new Map();
  for (const f of filasDeleg) if (LA_CIFRA.includes(f.texto)) {
    if (!porRef.has(f.referencia)) porRef.set(f.referencia, new Set());
    porRef.get(f.referencia).add(f.texto);
  }
  for (const [r, s] of [...porRef].sort((x, y) => y[1].size - x[1].size)) console.log(`  ${String(s.size).padStart(3)} · ${r}`);
  console.log(`  (suma por comentario ${[...porRef.values()].reduce((n, s) => n + s.size, 0)}; un literal en dos comentarios cuenta en los dos)`);
}
if (VER_TEXTOS) {
  console.log('');
  console.log('SOLO DELEGADA Y NO PINTADO:');
  for (const t of soloDelegadaSinPintar) console.log(`  · ${recorte(t)} · ${filasDeleg.filter((f) => f.texto === t).map((f) => f.ficha).join(', ')}`);
  console.log('DELEGADA Y TAMBIEN DIRECTA (mismo literal):');
  for (const t of tambienDirecta) console.log(`  · ${recorte(t)}`);
}
console.log('');
console.log(`POBLACION=${filas.length} citas de ${fichas.length} fichas · CIFRA=${LA_CIFRA.length} · CONTROLES EN ROJO=${rojo}`);
process.exitCode = rojo === 0 ? 0 : 1;
