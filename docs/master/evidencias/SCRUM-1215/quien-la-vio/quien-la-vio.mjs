// Sonda de SÓLO LECTURA (S4, 13-oct-2026, segunda tanda): de las hojas que el censo 1157 da por
// APROBADO por firma de GRUPO, ¿a cuántas las VIO la firma que las aprueba?
//
// «La vio» se mide en la historia de `main` (primer padre), fichero a fichero: en cada estado que
// tuvo el fichero se corre el censo de HOY (una copia en memoria que además dice el TEXTO de cada
// hoja y la LETRA del comentario que la gobierna) y se mira, para cada hoja de hoy:
//   sT = desde qué estado tiene, sin interrupción, el texto de hoy;
//   sG = desde qué estado la gobierna, sin interrupción, la letra de firma de hoy.
// VISTA   ⇔ la letra de la firma se ESCRIBIÓ en sG (no gobernaba a nadie en el estado anterior) y
//           el texto de hoy ya estaba o llegó con ella (sG ≥ sT).
// NO VISTA en los otros dos casos: la hoja o su texto llegaron DESPUÉS de escrita la firma (sG < sT),
//           o la hoja cayó bajo una firma que YA estaba escrita para otras (sG ≥ sT, la letra existía).
// No escribe en el árbol. Uso: node quien-la-vio.mjs <árbol> [--lab]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { temporal } from '../../../../../tests/_temporal.mjs';

const arbol = path.resolve(process.argv[2]);
const git = (...a) => execFileSync('git', ['-C', arbol, ...a], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });

// ── El censo de HOY, instrumentado en una copia FUERA del árbol ────────────────────────────────
const RUTA_CENSO = path.join(arbol, 'scripts/_censo-convenio-microcopy.mjs');
let fuente = fs.readFileSync(RUTA_CENSO, 'utf8').replace(/\r\n/g, '\n');
function sust(de, a, veces = 1) {
  const n = fuente.split(de).length - 1;
  if (n !== veces) throw new Error(`la sonda esperaba ${veces} vez/veces «${de.slice(0, 60)}…» y hay ${n}: el censo ha cambiado, la sonda no mide`);
  fuente = fuente.split(de).join(a);
}
sust('function contieneTexto(nodo) {', 'function trozosDe(nodo) { const out = []; (function mira(n) { if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) out.push(n.text); else if (ts.isTemplateExpression(n)) { out.push(n.head.text); for (const s of n.templateSpans) { mira(s.expression); out.push(s.literal.text); } return; } ts.forEachChild(n, mira); })(nodo); return out; }\nfunction contieneTexto(nodo) {');
sust('const require_ = createRequire(import.meta.url);', `const require_ = createRequire(${JSON.stringify(pathToFileURL(RUTA_CENSO).href)});`);
sust('function censarObjeto(obj, heredada, rutaBase, limiteHeredado = Infinity) {', 'function censarObjeto(obj, heredada, rutaBase, limiteHeredado = Infinity, firmaHeredada = null) {');
sust('    let actual = heredada;\n', '    let actual = heredada;\n    let firmaActual = firmaHeredada;\n');
sust('        actual = encima;\n', '        actual = encima;\n        firmaActual = bloque(leading[i]);\n');
sust("      const porGrupo = propia === 'APROBADO' && !enSuLinea && !soloEsta;\n",
  "      const porGrupo = propia === 'APROBADO' && !enSuLinea && !soloEsta;\n      const firmaDeEsta = enSuLinea ? bloque(trailing[i]) : soloEsta ? bloque(leading[i]) : (actual ? firmaActual : null);\n");
sust('censarObjeto(v, propia, ruta); return; }', 'censarObjeto(v, propia, ruta, Infinity, firmaDeEsta); return; }');
sust("censarObjeto(e, propia, ruta + '[]');", "censarObjeto(e, propia, ruta + '[]', Infinity, firmaDeEsta);");
sust('hojas.push({ id: `${rel} · ${ruta}`, clase: propia, porGrupo });', 'hojas.push({ id: `${rel} · ${ruta}`, clase: propia, porGrupo, texto: valor.getText(sf), firma: firmaDeEsta, trozos: trozosDe(valor) });', 2);
sust("censarObjeto(n, heredada, base, heredada === 'APROBADO' ? cuantosDice(bloque(decl)) : Infinity);",
  "censarObjeto(n, heredada, base, heredada === 'APROBADO' ? cuantosDice(bloque(decl)) : Infinity, heredada ? bloque(decl) : null);");
const dirTmp = temporal('quienlavio');
const copia = path.join(dirTmp, 'censo-instrumentado.mjs');
fs.writeFileSync(copia, fuente);
const inst = await import(pathToFileURL(copia).href);
const orig = await import(pathToFileURL(RUTA_CENSO).href);

const nTexto = (s) => String(s).replace(/\s+/g, ' ').trim();
const nFirma = (s) => s == null ? null : String(s).split('\n').map((l) => l.replace(/^\s*(\/\/+|\/\*+|\*+\/?|\*)?/, '').replace(/\*\/\s*$/, '')).join(' ').replace(/\s+/g, ' ').trim();

/** Estado de un fichero → Map id → { texto, firma, clase, porGrupo } (la primera si el id se repite). */
function hojasDe(rel, texto, ambiguos) {
  const r = inst.censarFuente(rel, texto, ambiguos);
  const sinParsear = r.ciegos.some((c) => c.id === rel && /no parsea/.test(c.motivo));
  if (sinParsear) return null;
  const m = new Map();
  for (const h of r.hojas) if (!m.has(h.id)) m.set(h.id, { texto: nTexto(h.texto), firma: nFirma(h.firma), clase: h.clase, porGrupo: h.porGrupo, trozos: h.trozos });
  return m;
}

/**
 * El veredicto de UNA hoja sobre la lista cronológica de estados de su fichero (el último es hoy).
 * Función pura: es la que se prueba en el laboratorio.
 */
export function veredicto(estados, id) {
  const n = estados.length;
  const hoy = estados[n - 1].hojas.get(id);
  if (!hoy) throw new Error(`«${id}» no está en el último estado`);
  let sT = n - 1; let sG = n - 1; let sA = n - 1;
  while (sA > 0 && estados[sA - 1].hojas.has(id)) sA--;
  while (sT > sA && estados[sT - 1].hojas.get(id).texto === hoy.texto) sT--;
  while (sG > sA && estados[sG - 1].hojas.get(id).firma === hoy.firma) sG--;
  const letraYaEstaba = sG > 0 && [...estados[sG - 1].hojas.values()].some((h) => h.firma === hoy.firma);
  const antes = sT > 0 ? estados[sT - 1].hojas : new Map();
  const mismoTextoAntes = [...antes.entries()].filter(([k, h]) => k !== id && h.texto === hoy.texto);
  let clase; let vista;
  if (sG < sT) {
    vista = false;
    clase = sT === sA ? 'IMPOSIBLE' : 'TEXTO_CAMBIADO_DESPUES';
  } else if (letraYaEstaba) {
    vista = false;
    clase = sG === sA ? 'LLEGO_BAJO_FIRMA_YA_ESCRITA' : 'CAYO_BAJO_FIRMA_YA_ESCRITA';
  } else {
    vista = true;
    clase = sG === 0 ? 'NACIO_CON_EL_FICHERO' : sG === sT ? 'LLEGARON_JUNTAS' : 'FIRMA_ESCRITA_DESPUES';
  }
  const previa = sG > sA ? estados[sG - 1].hojas.get(id) : null;
  const objeto = id.split(' · ')[0] + ' · ' + id.split(' · ')[1].split('.')[0] + '.';
  const objetoYaFirmado = sG > 0 && [...estados[sG - 1].hojas.entries()].some(([k, h]) => k.startsWith(objeto) && h.clase === 'APROBADO');
  return {
    id, vista, clase, sA, sT, sG, objetoYaFirmado, trozos: hoy.trozos,
    shaT: estados[sT].sha, fechaT: estados[sT].fecha, shaG: estados[sG].sha, fechaG: estados[sG].fecha,
    // Para leer a mano: qué la gobernaba justo antes de la letra de hoy, y si el texto ya estaba con otro nombre.
    firmaPrevia: previa ? previa.firma : null, clasePrevia: previa ? previa.clase : null,
    mismoTextoAntes: mismoTextoAntes.map(([k, h]) => `${k} [${h.clase}${h.firma === hoy.firma ? ', MISMA firma' : ''}]`),
    textoAntes: sT > sA ? estados[sT - 1].hojas.get(id).texto : null,
    texto: hoy.texto, firma: hoy.firma,
  };
}

// ── LABORATORIO: el control positivo de la propia sonda (historia fabricada) ───────────────────
function laboratorio() {
  const F = 'public/x.js';
  const cab = '// Textos APROBADOS por el fundador el 4-sep-2026 (SCRUM-720).\n';
  const cab2 = '// Textos APROBADOS por el fundador el 9-oct-2026 (SCRUM-999), los cuatro.\n';
  const v = (c, cuerpo) => `${c}const T = {\n${cuerpo}};\n`;
  const fuentes = [
    v(cab, "  uno: 'Primero',\n  dos: 'Segundo',\n"),
    v(cab, "  uno: 'Primero',\n  dos: 'Segundo',\n  tres: 'Llega tarde',\n"),
    v(cab, "  uno: 'Primero',\n  dos: 'Segundo cambiado',\n  tres: 'Llega tarde',\n"),
    v(cab, "  uno: 'Primero',\n  dos: 'Segundo cambiado',\n  tres: 'Llega tarde',\n  otra: 'Primero',\n"),
  ];
  const est = (lista) => lista.map((t, i) => ({ sha: 'lab' + i, fecha: 'lab', hojas: hojasDe(F, t, {}) }));
  const e1 = est(fuentes);
  const espera1 = { 'T.uno': 'NACIO_CON_EL_FICHERO', 'T.dos': 'TEXTO_CAMBIADO_DESPUES', 'T.tres': 'LLEGO_BAJO_FIRMA_YA_ESCRITA', 'T.otra': 'LLEGO_BAJO_FIRMA_YA_ESCRITA' };
  let mal = 0;
  for (const [k, c] of Object.entries(espera1)) {
    const r = veredicto(e1, `${F} · ${k}`);
    const ok = r.clase === c;
    if (!ok) mal++;
    console.log(`  LAB1 ${k.padEnd(8)} → ${r.clase.padEnd(30)} ${ok ? 'como se esperaba' : '✗ SE ESPERABA ' + c}${r.mismoTextoAntes.length ? ' · mismo texto antes: ' + r.mismoTextoAntes.join(', ') : ''}`);
  }
  // La firma se REESCRIBE con las cuatro delante: todas pasan a vistas.
  const e2 = est([...fuentes, v(cab2, "  uno: 'Primero',\n  dos: 'Segundo cambiado',\n  tres: 'Llega tarde',\n  otra: 'Primero',\n")]);
  for (const k of Object.keys(espera1)) {
    const r = veredicto(e2, `${F} · ${k}`);
    const ok = r.vista && r.clase === 'FIRMA_ESCRITA_DESPUES';
    if (!ok) mal++;
    console.log(`  LAB2 ${k.padEnd(8)} → ${r.clase.padEnd(30)} ${ok ? 'como se esperaba' : '✗ SE ESPERABA FIRMA_ESCRITA_DESPUES'}`);
  }
  // Firma CON CUENTA y una hoja que SUBE a un hueco: la letra ya estaba, no la vio.
  const cab3 = '// Los dos textos están APROBADOS por el fundador el 4-sep-2026 (SCRUM-720).\n';
  const e3 = est([
    v(cab3, "  uno: 'Primero',\n  dos: 'Segundo',\n"),
    v(cab3, "  uno: 'Primero',\n  dos: 'Segundo',\n  tres: 'Sin firma',\n"),
    v(cab3, "  tres: 'Sin firma',\n  uno: 'Primero',\n  dos: 'Segundo',\n"),
  ]);
  const r3 = veredicto(e3, `${F} · T.tres`);
  const ok3 = !r3.vista && r3.clase === 'CAYO_BAJO_FIRMA_YA_ESCRITA';
  if (!ok3) mal++;
  console.log(`  LAB3 T.tres   → ${r3.clase.padEnd(30)} ${ok3 ? 'como se esperaba' : '✗ SE ESPERABA CAYO_BAJO_FIRMA_YA_ESCRITA'} (clase del censo hoy: ${e3[2].hojas.get(F + ' · T.tres').clase})`);
  console.log(`LABORATORIO: 9 casos · ${mal} mal`);
  return mal;
}

console.log('== LABORATORIO (historia fabricada)');
const malLab = laboratorio();
if (malLab) { console.log('EXIT=3'); process.exit(3); }
if (process.argv.includes('--lab')) { console.log('EXIT=0'); process.exit(0); }

// ── EL ÁRBOL REAL ──────────────────────────────────────────────────────────────────────────────
const declarados = orig.leerDeclarados(arbol);
const ambiguos = declarados.ambiguos || {};
const rOrig = orig.censar({ raiz: arbol });
if (rOrig.estado !== 'OK') { console.log('CIEGO: el censo original no está OK'); console.log('EXIT=2'); process.exit(2); }
const head = git('rev-parse', 'HEAD').trim();
const main = git('rev-parse', 'origin/main').trim();
console.log(`\n== ÁRBOL REAL · HEAD ${head} · origin/main ${main}${head === main ? '' : '  ⚠ HEAD NO ES origin/main'}`);
const idsGrupo = rOrig.porGrupo.map((h) => h.id);
const porFichero = new Map();
for (const id of idsGrupo) {
  const f = id.split(' · ')[0];
  if (!porFichero.has(f)) porFichero.set(f, []);
  porFichero.get(f).push(id);
}
console.log(`POBLACION: ${idsGrupo.length} identidades aprobadas por grupo (${rOrig.porGrupo.reduce((s, h) => s + h.n, 0)} hojas) en ${porFichero.size} ficheros · APROBADO en total ${rOrig.hojas.filter((h) => h.clase === 'APROBADO').reduce((s, h) => s + h.n, 0)}`);

const filas = [];
let estadosLeidos = 0; let estadosSinParsear = 0;
for (const [f, ids] of [...porFichero].sort()) {
  const log = git('log', '--first-parent', '--reverse', '--format=%H %cI', main, '--', f).trim().split('\n').filter(Boolean);
  const estados = [];
  for (const l of log) {
    const [sha, fecha] = l.split(' ');
    let texto;
    try { texto = git('show', `${sha}:${f}`); } catch { continue; } // el fichero no existe en ese estado (borrado)
    const hojas = hojasDe(f, texto.replace(/\r\n/g, '\n'), ambiguos);
    estadosLeidos++;
    if (!hojas) { estadosSinParsear++; continue; }
    estados.push({ sha, fecha, hojas });
  }
  // El último estado de la historia tiene que SER el fichero de hoy: si no, la historia no acaba donde miro.
  const hoy = hojasDe(f, fs.readFileSync(path.join(arbol, f), 'utf8').replace(/\r\n/g, '\n'), ambiguos);
  const ult = estados[estados.length - 1];
  const iguales = ult && hoy.size === ult.hojas.size && [...hoy].every(([k, h]) => { const o = ult.hojas.get(k); return o && o.texto === h.texto && o.firma === h.firma && o.clase === h.clase; });
  if (!iguales) { console.log(`CIEGO: el último estado de la historia de ${f} no es el fichero del árbol`); console.log('EXIT=2'); process.exit(2); }
  // Y la copia instrumentada tiene que clasificar como el censo original.
  for (const id of ids) {
    const h = hoy.get(id);
    if (!h || h.clase !== 'APROBADO' || !h.porGrupo) { console.log(`CIEGO: la copia instrumentada no da «${id}» por aprobada por grupo`); console.log('EXIT=2'); process.exit(2); }
    filas.push({ f, estados: estados.length, ...veredicto(estados, id) });
  }
}
console.log(`HISTORIA: ${estadosLeidos} estados de fichero leídos de main (primer padre) · ${estadosSinParsear} que no parsean (saltados)`);

const cuenta = (pred) => filas.filter(pred).length;
const clases = [...new Set(filas.map((r) => r.clase))].sort();
console.log(`\nVISTAS por la firma que las aprueba: ${cuenta((r) => r.vista)} de ${filas.length}`);
console.log(`NO VISTAS:                          ${cuenta((r) => !r.vista)} de ${filas.length}`);
for (const c of clases) console.log(`  ${String(cuenta((r) => r.clase === c)).padStart(4)}  ${c}`);
const sinVer = Object.keys(declarados.porGrupoSinVer || {});
console.log(`\nCONTROL CON LO YA SABIDO («porGrupoSinVer», ${sinVer.length}):`);
for (const id of sinVer) { const r = filas.find((x) => x.id === id); console.log(`  ${r ? (r.vista ? '✗ la sonda la da por VISTA' : 'NO VISTA, como consta') : '✗ no está entre las de grupo'}  ${id}${r ? ' · ' + r.clase : ''}`); }

console.log('\nPOR OBJETO (no vistas / total):');
const porObj = new Map();
for (const r of filas) {
  const o = r.id.replace('public/dashboard/js/', '').split(' · ').map((p, i) => i ? p.split('.')[0] : p).join(' · ');
  const a = porObj.get(o) || { t: 0, nv: 0 };
  a.t++; if (!r.vista) a.nv++;
  porObj.set(o, a);
}
for (const [o, a] of [...porObj].sort()) console.log(`  ${String(a.nv).padStart(3)} / ${String(a.t).padStart(3)}  ${o}`);

const corto = (s, n = 110) => s == null ? '—' : (s.length > n ? s.slice(0, n) + '…' : s);

// ── LA ZONA BLANDA de «llegaron juntas»: la hoja entra en un objeto que YA tenía firma y el mismo
//    commit retoca la letra. La letra la vio, pero quien la retocó fue quien añadió la hoja.
console.log('\nDE LAS «LLEGARON_JUNTAS», las que entraron en un objeto que YA tenía hojas aprobadas (el commit retocó la letra):');
const blandas = filas.filter((x) => x.clase === 'LLEGARON_JUNTAS' && x.objetoYaFirmado);
console.log(`  ${blandas.length} de ${cuenta((r) => r.clase === 'LLEGARON_JUNTAS')}`);
const evB = new Map();
for (const r of blandas) {
  const k = `${r.f} @ ${r.shaG.slice(0, 9)} ${r.fechaG.slice(0, 10)}`;
  if (!evB.has(k)) evB.set(k, []);
  evB.get(k).push(r.id.split(' · ')[1]);
}
for (const [k, v] of evB) console.log(`  ${v.length} · ${k} · ${v.join(', ')}`);

// ── SEGUNDA SONDA, INDEPENDIENTE: el PAPEL. ¿El literal consta en `docs/microcopy/` (el registro
//    de firmas, A7)? No mira git: mira si el texto está escrito en algún acta.
const dirPapel = path.join(arbol, 'docs/microcopy');
const actas = fs.readdirSync(dirPapel).filter((n) => n.endsWith('.md'));
const llanoPapel = (s) => s.replace(/[`*_\\]/g, '').replace(/\s+/g, ' ');
const papel = actas.map((n) => ({ n, t: llanoPapel(fs.readFileSync(path.join(dirPapel, n), 'utf8')) }));
console.log(`\n== SEGUNDA SONDA (el papel) · POBLACION: ${actas.length} actas .md en docs/microcopy/`);
const testigo = papel.some((p) => p.t.includes('Cobrar ahora'));
console.log(`  control: «Cobrar ahora» (firmado en SCRUM-984, con acta) ${testigo ? 'SÍ consta' : '✗ NO consta: la sonda del papel está ciega'}`);
if (!testigo) { console.log('EXIT=2'); process.exit(2); }
for (const r of filas) {
  const tz = [...new Set(r.trozos.map((t) => llanoPapel(t).trim()).filter((t) => t.length >= 3 && /\p{L}/u.test(t)))];
  const si = tz.filter((t) => papel.some((p) => p.t.includes(t)));
  r.papel = !tz.length ? 'SIN_TROZOS' : si.length === tz.length ? 'ENTERO' : si.length ? 'PARTE' : 'NADA';
  r.papelFalta = tz.filter((t) => !si.includes(t));
}
const cruz = {};
for (const r of filas) { const k = `${r.vista ? 'VISTA   ' : 'NO VISTA'} × papel ${r.papel}`; cruz[k] = (cruz[k] || 0) + 1; }
for (const k of Object.keys(cruz).sort()) console.log(`  ${String(cruz[k]).padStart(4)}  ${k}`);
console.log('  las VISTAS por git que NO constan enteras en ningún acta (la discrepancia es el dato):');
for (const r of filas.filter((x) => x.vista && x.papel !== 'ENTERO')) console.log(`    ${r.papel.padEnd(10)} ${r.id.replace('public/dashboard/js/', '')} · ${r.clase} · falta: ${r.papelFalta.map((t) => '«' + corto(t, 60) + '»').join(' ')}`);
console.log('  las NO VISTAS por git, y su papel:');
for (const r of filas.filter((x) => !x.vista)) console.log(`    ${r.papel.padEnd(10)} ${r.id.replace('public/dashboard/js/', '')}${r.papelFalta.length ? ' · falta: ' + r.papelFalta.map((t) => '«' + corto(t, 60) + '»').join(' ') : ''}`);
console.log('\nLAS NO VISTAS, una a una:');
for (const r of filas.filter((x) => !x.vista)) {
  console.log(`  ${r.clase} · ${r.id}`);
  console.log(`      texto de hoy desde ${r.fechaT.slice(0, 10)} ${r.shaT.slice(0, 9)} · firma de hoy la gobierna desde ${r.fechaG.slice(0, 10)} ${r.shaG.slice(0, 9)}`);
  console.log(`      texto: ${corto(r.texto)}`);
  if (r.textoAntes) console.log(`      antes: ${corto(r.textoAntes)}`);
  if (r.mismoTextoAntes.length) console.log(`      el MISMO texto ya estaba como: ${r.mismoTextoAntes.join(' | ')}`);
  console.log(`      firma: ${corto(r.firma, 160)}`);
}
console.log('\nLAS VISTAS POR UNA FIRMA ESCRITA DESPUÉS (para leer: ¿firma nueva o sólo se retocó la letra?):');
const ev = new Map();
for (const r of filas.filter((x) => x.clase === 'FIRMA_ESCRITA_DESPUES')) {
  const k = `${r.f} @ ${r.shaG.slice(0, 9)} ${r.fechaG.slice(0, 10)}`;
  if (!ev.has(k)) ev.set(k, { n: 0, firma: r.firma, previa: new Set() });
  const e = ev.get(k); e.n++; e.previa.add(`[${r.clasePrevia}] ${corto(r.firmaPrevia, 140)}`);
}
for (const [k, e] of ev) { console.log(`  ${e.n} hoja(s) · ${k}\n      firma hoy:  ${corto(e.firma, 160)}`); for (const p of e.previa) console.log(`      antes:      ${p}`); }

fs.writeFileSync(path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), 'quien-la-vio.json'), JSON.stringify({ head, main, filas: filas.map(({ estados, ...r }) => r) }, null, 1));
console.log('\nEXIT=0');
