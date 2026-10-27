// Sonda de SÓLO LECTURA (S4, 13-oct-2026, tercera tanda). Cierra las «dudosas» de la cifra de
// SCRUM-1215 c.19332: hojas aprobadas por firma de GRUPO cuyo literal NO está en ningún acta de
// `docs/microcopy/`, pero cuya letra cita un comentario de Jira.
//
// Los comentarios se ABRIERON el 13-oct-2026 y sus textos firmados van TRANSCRITOS abajo, literales,
// con el número del comentario. La sonda no lee Jira: compara cada hoja de hoy con lo transcrito.
// Lee `quien-la-vio.json` (lo escribe `quien-la-vio.mjs` a su lado) y pregunta el papel al oráculo
// de la casa, `tests/_microcopy-aprobada.mjs`. No escribe nada.
// Uso: node firmadas-en-jira.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const j = JSON.parse(fs.readFileSync(path.join(aqui, 'quien-la-vio.json'), 'utf8'));

// ── Lo que dicen los comentarios, transcrito ───────────────────────────────────────────────────
const FIRMADOS = [
  // SCRUM-916 c.17251 · orquestador de Luis, por delegación, 27-sep-2026
  ['SCRUM-916 c.17251', 'Horas y desplazamiento'],
  ['SCRUM-916 c.17251', 'Ahora'],
  ['SCRUM-916 c.17251', 'Tiempo en la obra'],
  ['SCRUM-916 c.17251', 'Revisa las horas'],
  ['SCRUM-916 c.17251', 'La salida es antes que la entrada'],
  ['SCRUM-916 c.17251', 'km'],
  ['SCRUM-916 c.17251', 'Datos del parte'],
  ['SCRUM-916 c.17251', 'Obra y referencia'],
  ['SCRUM-916 c.17251', 'Tu referencia interna, si usas alguna'],
  ['SCRUM-916 c.17251', 'Sin elegir'],
  ['SCRUM-916 c.17251', 'Sin notas'],
  ['SCRUM-916 c.17251', 'Lo que haya que dejar dicho.'],
  // SCRUM-916 c.17273 · los cuatro que sustituyen a los retirados
  ['SCRUM-916 c.17273', 'Dónde se ha hecho el trabajo'],
  ['SCRUM-916 c.17273', 'Sin dirección ni referencia'],
  ['SCRUM-916 c.17273', 'Sin técnicos'],
  ['SCRUM-916 c.17273', 'Quién ha estado en la obra'],
  // SCRUM-1216 c.17347 · Javier en persona, transcrito por su orquestador, 28-sep-2026
  ['SCRUM-1216 c.17347', '¿Ya has emitido facturas en 2026?'],
  ['SCRUM-1216 c.17347', 'Si vienes de otro programa, de una plantilla o del papel, cuenta igual.'],
  ['SCRUM-1216 c.17347', '¿Cuál fue el número de tu última factura de 2026?'],
  ['SCRUM-1216 c.17347', 'YaQu empezará en el siguiente, para que no repitas un número que ya has usado.'],
  // SCRUM-1216 c.17349 · orquestador de Javier, por delegación, 28-sep-2026
  ['SCRUM-1216 c.17349', 'Escribe el número de tu última factura. Por ejemplo: 41.'],
  ['SCRUM-1216 c.17349', 'Tiene que ser un número entero, del 1 en adelante. Por ejemplo: 41.'],
  ['SCRUM-1216 c.17349', 'Ese número es demasiado alto. Revisa el número de tu última factura.'],
];
// Firmado CON CONDICIÓN (c.17251: «NO FIRMO tal cual»; vale si sólo se pinta cuando el campo es selector).
const CONDICIONADOS = [['SCRUM-916 c.17251', 'La hora se elige, no se escribe.']];
// Firmados y luego RETIRADOS: no pueden estar pintados.
const RETIRADOS = [
  ['SCRUM-916 c.17255', 'horas'],
  ['SCRUM-916 c.17255', 'Sin las dos firmas el parte no se cierra.'],
  ['SCRUM-916 c.17273', 'La del trabajo, si no pones otra'],
  ['SCRUM-916 c.17273', 'Los del trabajo'],
  ['SCRUM-916 c.17273', 'Solo tú'],
  ['SCRUM-916 c.17273', 'Quién más ha estado en la obra'],
];
const OBJETOS_ABIERTOS = new Set(['parteDetailView.js · TEXTOS', 'puertaSerie.js · SERIE_TEXTOS']);
// Su letra dice «por el ASESOR, a la espera del fundador» (c.19332, grupo B).
const A_LA_ESPERA = new Set(['filtroClientes.js · TEXTOS_ETIQUETAS', 'filtroClientes.js · TEXTOS_SELECCION', 'quoteDireccionObra.js · TEXTOS']);
// Ticket citado ABIERTO (SCRUM-656, sus 2 comentarios) y sus literales no están en él.
const ABIERTO_SIN_HALLAR = new Set(['settingsView.js · TX']);

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const objetoDe = (r) => `${path.basename(r.f)} · ${r.id.split(' · ')[1].split('.')[0]}`;
function casa(trozos, literal) {
  if (!trozos || trozos.length === 0) return null;
  if (trozos.length === 1) return trozos[0] === literal ? 'IGUAL' : null;
  const m = new RegExp('^' + trozos.map(esc).join('(.+)') + '$').exec(literal);
  return m ? `CON_HUECO(${m.slice(1).join(',')})` : null;
}
function busca(lista, trozos) {
  for (const [donde, literal] of lista) { const c = casa(trozos, literal); if (c) return { donde, como: c }; }
  return null;
}

// ── Control positivo y negativo, sobre casos fabricados ────────────────────────────────────────
const lab = [
  [busca(FIRMADOS, ['Ahora']), true, 'un literal firmado se encuentra'],
  [busca(FIRMADOS, ['¿Ya has emitido facturas en ', '?']), true, 'una plantilla con hueco casa con su literal firmado'],
  [busca(FIRMADOS, ['Texto que nadie ha firmado']), false, 'un literal inventado NO se encuentra'],
  [busca(FIRMADOS, ['Solo tú']), false, 'un retirado NO sale como firmado'],
  [busca(RETIRADOS, ['Solo tú']), true, 'un retirado sale como retirado'],
  [busca(FIRMADOS, []), false, 'una hoja sin literal NO casa con nada'],
];
let mal = 0;
for (const [r, esperado, que] of lab) { const ok = !!r === esperado; if (!ok) mal++; console.log(`  LAB ${ok ? 'bien' : 'MAL '} · ${que}`); }
console.log(`LABORATORIO: ${lab.length} casos · ${mal} mal`);
if (mal) { console.log('EXIT=1'); process.exit(1); }

// ── Las 173 ────────────────────────────────────────────────────────────────────────────────────
// El PAPEL se pregunta al oráculo de la casa (`constaAprobado`, tests/_microcopy-aprobada.mjs): por
// IDENTIDAD del literal, mirando QUIÉN firma, y en los DOS sitios (`docs/microcopy/` y el registro
// congelado `docs/MICROCOPY_APROBADA_SIN_APLICAR.md`). El campo `papel` del JSON es de la sonda
// vieja, que sólo miraba `docs/microcopy/` y por subcadena: aquí sólo se usa para decir cuánto falla.
const raiz = path.resolve(aqui, '../../../../..');
const { constaAprobado, aprobacionesDeMicrocopy } = await import(pathToFileURL(path.join(raiz, 'tests/_microcopy-aprobada.mjs')).href);
const todas = aprobacionesDeMicrocopy();
console.log(`\nORÁCULO: ${todas.length} aprobaciones leídas · ${todas.filter((a) => a.aprobada).length} con firma que cuenta · ${todas.filter((a) => a.ruta.includes('SIN_APLICAR')).length} del registro congelado`);
// Controles: uno por sitio. El del registro congelado es fijo; el de `docs/microcopy/` se toma de la
// primera ficha a la que el oráculo SÍ le lee literales, y tiene que devolver esa misma ficha.
const fichaCtrl = todas.find((a) => a.aprobada && a.ruta.startsWith('docs/microcopy/') && a.literales.length > 0);
const ctrlFicha = fichaCtrl ? constaAprobado(fichaCtrl.literales[0]).includes(fichaCtrl.ruta) : false;
const mudas = todas.filter((a) => a.ruta.startsWith('docs/microcopy/') && a.literales.length === 0);
console.log(`  fichas de docs/microcopy/ a las que el oráculo NO les lee ningún literal: ${mudas.length} de ${todas.filter((a) => a.ruta.startsWith('docs/microcopy/')).length}`);
const ctrlSi = ctrlFicha ? constaAprobado('Añadir condición') : [];
let ctrlNo = [];
try { ctrlNo = constaAprobado('Texto que nadie ha firmado jamás'); } catch (e) { ctrlNo = ['ERROR ' + e.message]; }
console.log(`  control: un literal de ${fichaCtrl ? fichaCtrl.ruta : '(ninguna ficha)'} ${ctrlFicha ? 'devuelve su ficha' : 'NO devuelve su ficha'} · «Añadir condición» consta en ${ctrlSi.length} sitio(s) · un literal inventado consta en ${ctrlNo.length}`);
if (ctrlSi.length === 0 || ctrlNo.length !== 0) { console.log('el oráculo no ve lo que tiene que ver, o ve lo que no hay: la sonda no mide\nEXIT=1'); process.exit(1); }

const filas = j.filas;
console.log(`\nPOBLACION: ${filas.length} hojas de grupo · foto de main ${j.main}`);
const reparto = {};
const suma = (k) => { reparto[k] = (reparto[k] || 0) + 1; };
const detalle = [];
const pintadosRetirados = [];
const cruce = {};
const sinPapel = {};
for (const r of filas) {
  const obj = objetoDe(r);
  const ret = busca(RETIRADOS, r.trozos);
  if (ret && OBJETOS_ABIERTOS.has(obj)) pintadosRetirados.push(`${r.id} · ${ret.donde}`);
  const unLiteral = r.trozos && r.trozos.length === 1 && r.trozos[0].trim() !== '';
  const fichas = unLiteral ? constaAprobado(r.trozos[0]) : [];
  const enCongelado = fichas.some((x) => x.includes('SIN_APLICAR'));
  const enFicha = fichas.some((x) => x.startsWith('docs/microcopy/'));
  const f = busca(FIRMADOS, r.trozos);
  const c = busca(CONDICIONADOS, r.trozos);
  let clase;
  if (enFicha) clase = '1 · CONSTA firmada en una ficha de docs/microcopy/ (oráculo, por identidad)';
  else if (enCongelado) clase = '2 · CONSTA firmada en el registro congelado, anterior al 3-sep (oráculo, por identidad)';
  else if (OBJETOS_ABIERTOS.has(obj) && (f || c)) clase = '3 · el oráculo no la da; firma HALLADA en el comentario de Jira que cita';
  else if (A_LA_ESPERA.has(obj)) clase = '4 · su letra dice «asesor, a la espera del fundador»';
  else if (r.papel === 'ENTERO') clase = '5 · el oráculo no la da, pero su literal aparece en algún acta de docs/microcopy/ (subcadena: cota)';
  else if (!unLiteral) clase = '6 · no se puede buscar: plantilla con huecos, o sin literal';
  else clase = String(r.fechaG).slice(0, 10) < '2026-09-03' ? '7 · NO APARECE en ningún papel ni se ha abierto su Jira · letra anterior al 3-sep' : '8 · NO APARECE en ningún papel ni se ha abierto su Jira · letra posterior al 3-sep';
  suma(clase);
  const k = `sonda vieja ${r.papel === 'ENTERO' ? '«con acta»' : '«sin acta»'} × oráculo ${fichas.length ? 'CONSTA' : unLiteral ? 'no consta' : 'no puede buscar'}`;
  cruce[k] = (cruce[k] || 0) + 1;
  if (clase[0] === '6' || clase[0] === '7' || clase[0] === '8') (sinPapel[`${clase[0]} · ${obj}`] = sinPapel[`${clase[0]} · ${obj}`] || []).push(r.id.split(' · ')[1].split('.').slice(1).join('.'));
  if (OBJETOS_ABIERTOS.has(obj)) detalle.push(`  ${clase.slice(0, 1)} · ${(f ? 'FIRMADA_EN_JIRA' + (f.como === 'IGUAL' ? '' : '_' + f.como) : c ? 'FIRMADA_CON_CONDICION' : 'NO_ESTA_EN_EL_COMENTARIO').padEnd(32)} · ${(f || c || {}).donde || '—'} · ${r.id.split(' · ')[1]} · «${(r.trozos || []).join('{…}')}»`);
}
console.log('\nLOS DOS OBJETOS ABIERTOS, hoja a hoja (el número es su fila del reparto):');
for (const l of detalle.sort()) console.log(l);
console.log(`\nRETIRADOS que siguen pintados en esos objetos: ${pintadosRetirados.length}`);
for (const l of pintadosRetirados) console.log('  ' + l);
console.log('\nREPARTO de las ' + filas.length + ':');
let total = 0;
for (const k of Object.keys(reparto).sort()) { total += reparto[k]; console.log(`  ${String(reparto[k]).padStart(3)}  ${k.slice(4)}`); }
console.log(`  ${String(total).padStart(3)}  suma (tiene que ser la población)`);
console.log('\nCUÁNTO FALLABA LA SONDA VIEJA DEL PAPEL (sólo docs/microcopy/, por subcadena):');
for (const k of Object.keys(cruce).sort()) console.log(`  ${String(cruce[k]).padStart(3)}  ${k}`);
console.log('\nLAS QUE NO CONSTAN O NO SE PUEDEN BUSCAR, por objeto (fila · objeto · claves):');
for (const k of Object.keys(sinPapel).sort()) console.log(`  ${k} · ${sinPapel[k].length} · ${sinPapel[k].join(', ')}`);
console.log(total === filas.length ? 'EXIT=0' : 'EXIT=1');
process.exit(total === filas.length ? 0 : 1);
