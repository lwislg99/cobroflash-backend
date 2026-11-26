// docs/master/evidencias/scrum1502u/censo-docs.mjs — SCRUM-1502u (S0, 26-nov-2026)
//
// Las marcas de firma que viven en docs/ (no en código): cuántas hay, cuáles citan una
// constancia VERIFICABLE (comentario de Jira c.N o acta con fecha) y cuáles no.
//
// NO es un censo nuevo: la población la da `censarFirmas` (tests/_censo-firmas-autorizacion.mjs,
// el de SCRUM-921), restringido a `docs/`, con la marca canónica de tests/scrum921-…test.mjs.
// Lo único que añade es el criterio de la clase, que es más estricto que `procedencia`:
// `procedencia` se conforma con un SCRUM-<n> o una ruta docs/ en el bloque (o en el NOMBRE
// del fichero, así que todo docs/master/SCRUM-<n>.md la tiene gratis).
//
// Uso:  node docs/master/evidencias/scrum1502u/censo-docs.mjs [raiz] [salida.json]
//   1. imprime la POBLACIÓN y la lista ENTERA (fichero:línea) antes de clasificar;
//   2. luego la clase de cada una.
// Excluye, declarado y contado, lo que escribe este mismo tramo (se cazaría a sí mismo).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const RAIZ = path.resolve(process.argv[2] || '.');
const SALIDA = process.argv[3];
const { censarFirmas } = await import(pathToFileURL(path.join(RAIZ, 'tests/_censo-firmas-autorizacion.mjs')).href);

// La misma que tests/scrum921-firmas-con-respaldo.test.mjs (MARCA_CANONICA). Copiada, no importada:
// importar el .test.mjs correría su suite. Si allí cambia, aquí se ve en el control de abajo.
const MARCA = /(aprobad|autorizad|firmad|validad|refrendad)[oa]s?\s+por\s+(el\s+)?(fundador|asesor|orquestador)/i;
const PROPIOS = [/^docs\/master\/evidencias\/scrum1502u\//];
const PROPIO_REGISTRO = 'docs/master/SCRUM-1502.md'; // sólo se excluye su tramo 1502u, por rango de líneas

// Constancia verificable: un comentario de Jira con número (c.20514, c. 20514, comentario 20514,
// focusedCommentId=20514) o un acta con fecha. Una fecha sola NO (no dice dónde mirar; SCRUM-387).
// «comentarios 20592 y 20598» también (plural): la primera pasada lo leyó como C y era A1 (2 filas).
const RE_COMENTARIO = /\bc\.\s?\d{4,6}\b|\bcomentarios?\s+(?:de\s+Jira\s+)?(?:c\.\s?)?\d{4,6}\b|focusedCommentId=\d{4,6}/i;
const RE_ACTA = /\bacta\b[^\n]{0,80}\b\d{1,2}[-\s](?:ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)[a-z]*[-\s]?(?:20\d\d)?/i;
const RE_TICKET = /\bSCRUM-\d{1,4}[a-z]?\b/i;
const RE_DOC = /\bdocs\/[\w./-]+|\b[A-Z_]{4,}\.md\b/;

const c = censarFirmas(RAIZ, { dirs: ['docs'] });
const inicioTramo = (() => {
  try {
    const l = fs.readFileSync(path.join(RAIZ, PROPIO_REGISTRO), 'utf8').split(/\r?\n/);
    const i = l.findIndex((x) => /^## SCRUM-1502u\b/.test(x));
    return i < 0 ? Infinity : i + 1;
  } catch { return Infinity; }
})();
const esPropio = (f) => PROPIOS.some((re) => re.test(f.fichero)) || (f.fichero === PROPIO_REGISTRO && f.linea >= inicioTramo);

const todasCanonicas = c.candidatos.filter((f) => MARCA.test(f.texto));
const excluidas = todasCanonicas.filter(esPropio);
const marcas = todasCanonicas.filter((f) => !esPropio(f));
const canonicasDescartadas = c.descartes.filter((f) => MARCA.test(f.texto));

console.log('── POBLACIÓN ──');
console.log(JSON.stringify(c.poblacion));
console.log(`bruto ${c.bruto.length} · descartes ${c.descartes.length} · candidatos ${c.candidatos.length}`);
console.log(`con la marca canónica: candidatas ${todasCanonicas.length} (excluidas por ser de este tramo: ${excluidas.length}) · descartadas por el censo ${canonicasDescartadas.length}`);
const porMotivo = {};
for (const d of canonicasDescartadas) porMotivo[d.motivo] = (porMotivo[d.motivo] || 0) + 1;
console.log('descartes canónicos por motivo:', JSON.stringify(porMotivo));

console.log(`\n── LA LISTA ENTERA (${marcas.length}), antes de clasificar ──`);
for (const f of marcas) console.log(`${f.fichero}:${f.linea}`);

// Fecha y canal: «el fundador, en el chat de la S0, el 25-nov» es un ACTA con fecha (dice cuándo y por
// dónde; se puede ir a buscar). Una fecha sin canal, o un canal sin fecha, NO llega a acta.
const RE_FECHA = /\b\d{1,2}[-\s](?:de\s+)?(?:ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)[a-z]*\.?(?:[-\s](?:de\s+)?20\d\d)?\b|\b20\d\d-\d\d-\d\d\b/i;
const RE_CANAL = /\b(?:AskUserQuestion|chat|conversaci[oó]n|reuni[oó]n|acta|mensaje|en\s+sesi[oó]n|llamada|audio|WhatsApp\s+del\s+fundador)\b/i;
// Mención, no uso: la frase va entre comillas/backticks (se HABLA de la marca), o el fichero es una
// salida de instrumento / un banco guardado como texto (docs/evidencias/**.txt|.json, *.mjs.txt).
const esMencion = (f, propia) => {
  if (/^docs\/(?:master\/)?evidencias\/.*\.(?:txt|json)$/i.test(f.fichero)) return 'salida-o-banco';
  const m = propia.match(MARCA);
  if (!m) return null;
  const i = propia.indexOf(m[0]);
  const antes = propia.slice(0, i), despues = propia.slice(i + m[0].length);
  const abre = (a, b) => (antes.split(a).length - 1) > (antes.split(b).length - 1) && despues.includes(b);
  if (abre('«', '»') || (antes.split('`').length - 1) % 2 === 1 || (antes.split('"').length - 1) % 2 === 1) return 'entre-comillas';
  return null;
};

// Clase de cada una, leyendo SU BLOQUE contiguo (la unidad del censo; SCRUM-921).
function clase(f) {
  const lineas = fs.readFileSync(path.join(RAIZ, f.fichero), 'utf8').split(/\r?\n/);
  const bloque = lineas.slice(f.bloque[0] - 1, f.bloque[1]).join('\n');
  const propia = lineas[f.linea - 1];
  const agente = (propia.match(MARCA)?.[3] || '').toLowerCase();
  const mencion = esMencion(f, propia);
  const com = bloque.match(RE_COMENTARIO);
  const acta = bloque.match(RE_ACTA) || (RE_FECHA.test(bloque) && RE_CANAL.test(bloque) ? [`${bloque.match(RE_FECHA)[0]} + ${bloque.match(RE_CANAL)[0]}`] : null);
  const fecha = bloque.match(RE_FECHA);
  const tk = bloque.match(RE_TICKET);
  const doc = bloque.match(RE_DOC);
  let k;
  if (mencion) k = 'M-mencion';
  else if (com) k = 'A1-comentario-jira';
  else if (acta) k = 'A2-acta-con-fecha';
  else if (tk) k = 'C-remite-a-ticket';
  else if (doc) k = 'C-remite-a-doc';
  else if (fecha) k = 'B-fecha-sola';
  else k = 'B-sin-nada';
  return {
    ...f, clase: k, agente, mencion,
    cita: com?.[0] || acta?.[0] || null,
    remite: tk?.[0] || doc?.[0] || null,
    fecha: fecha?.[0] || null,
    lineasBloque: f.bloque[1] - f.bloque[0] + 1,
  };
}
const clasificadas = marcas.map(clase);
const cuenta = {};
for (const x of clasificadas) cuenta[x.clase] = (cuenta[x.clase] || 0) + 1;

console.log('\n── CLASES ──');
console.log(JSON.stringify(cuenta));
for (const x of clasificadas) {
  console.log(`${x.clase}\t${x.fichero}:${x.linea}\tcita=${x.cita ?? '-'}\tremite=${x.remite ?? '-'}\tbloque=${x.lineasBloque}l\t${x.texto.slice(0, 160)}`);
}
if (SALIDA) {
  fs.writeFileSync(SALIDA, JSON.stringify({ poblacion: c.poblacion, excluidas, porMotivo, cuenta, clasificadas }, null, 2));
  console.log(`\nescrito ${SALIDA}`);
}

// ── La tabla del fundador (sólo las de USO con agente «fundador»), con la frase de la marca TAPADA ──
// Tapada a propósito: copiar la marca a un registro la vuelve a meter en el censo (se cazaría a sí
// misma) y un literal en docs/master/ puede absolver otra en scrum921c (tramo 1, §4).
const PESO = (f) => {
  if (/^docs\/(microcopy\/|MICROCOPY_)/.test(f)) return '1-texto-visible';
  if (/^docs\/(MIGRATIONS_PENDING\.md|sql\/)/.test(f)) return '2-esquema-o-bd';
  if (/^docs\/(YAQU_MASTER\.md|equipo\/)/.test(f)) return '3-norma';
  if (/^docs\/master\//.test(f)) return '4-registro';
  return '5-otros';
};
const CURA = {
  'A1-comentario-jira': 'nada en el doc; queda LEER el c.N y ver que es del fundador (forma, no verificado)',
  'A2-acta-con-fecha': 'buscar el mensaje de esa fecha y, si consta en Jira, añadir su c.N al lado',
  'C-remite-a-ticket': 'buscar en ese ticket el comentario del sí y escribir su c.N; si no está → pregunta ✅/❌',
  'C-remite-a-doc': 'seguir el doc: si él cita c.N, copiar la cita; si tampoco → pregunta ✅/❌',
  'B-fecha-sola': 'buscar en Jira ese día; si no aparece → pregunta ✅/❌ o reescribir como «lo dice la sesión X» (tramo 3)',
  'B-sin-nada': 'pregunta ✅/❌ al fundador, o reescribir la atribución como «lo afirma la sesión X» (tramo 3)',
};
const tapar = (t) => t.replace(MARCA, '⟦marca⟧').replace(/\|/g, '\\|').slice(0, 140);
const fund = clasificadas.filter((x) => x.agente === 'fundador' && x.clase !== 'M-mencion')
  .map((x) => ({ ...x, peso: PESO(x.fichero) }))
  .sort((a, b) => a.peso.localeCompare(b.peso) || a.clase.localeCompare(b.clase) || a.fichero.localeCompare(b.fichero) || a.linea - b.linea);
const TABLA = path.join(RAIZ, 'docs/master/evidencias/scrum1502u/tabla-fundador.md');
const filas = fund.map((x) => `| ${x.peso} | \`${x.fichero}:${x.linea}\` | ${tapar(x.texto)} | ${x.clase} | ${(x.cita || x.remite || x.fecha || '—').replace(/\|/g, '\\|')} | ${CURA[x.clase]} |`);
const resumen = {};
for (const x of fund) { resumen[x.peso] ??= {}; resumen[x.peso][x.clase] = (resumen[x.peso][x.clase] || 0) + 1; }
fs.writeFileSync(TABLA, [
  '# SCRUM-1502u · tabla de las marcas de firma DEL FUNDADOR en docs/ (generada)',
  '',
  'Generada por `node docs/master/evidencias/scrum1502u/censo-docs.mjs`; no se edita a mano. La frase de la marca va',
  'tapada como ⟦marca⟧ (motivo en el script). Clase y cura: `docs/master/SCRUM-1502.md`, tramo 1502u.',
  '',
  `Filas: ${fund.length}.`,
  '',
  '| peso | fichero:línea | literal (marca tapada, 140 car.) | clase | lo que cita o a lo que remite | cura propuesta |',
  '|---|---|---|---|---|---|',
  ...filas, '',
].join('\n'));
console.log(`\nTABLA ${fund.length} filas → ${path.relative(RAIZ, TABLA)}`);
console.log('por peso y clase:', JSON.stringify(resumen, null, 1));
