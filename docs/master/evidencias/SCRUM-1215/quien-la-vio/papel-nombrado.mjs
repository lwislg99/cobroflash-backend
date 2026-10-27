// Sonda de SÓLO LECTURA (S4, 13-oct-2026, cuarta tanda). Abre el papel que NOMBRA la letra de cada
// hoja de grupo que el oráculo de la casa no da por firmada, y dice dónde está su literal y en qué
// línea. NO decide quién firma: imprime el sitio para que se LEA.
//
// Tres papeles, y el tercero es el que las sondas anteriores no miraban:
//   1. las fichas de `docs/microcopy/` y el registro congelado (los pregunta el oráculo, por identidad);
//   2. el comentario o la descripción de Jira del ticket que cita la letra;
//   3. el registro del propio ticket, `docs/master/SCRUM-N.md`: en agosto la aprobación se apuntaba ahí.
//
// El ticket de cada grupo sale de dos sitios: los `SCRUM-N` que escribe su letra y el número de la
// rama del merge que la trajo (`git log -1 <shaG>`). Lee `quien-la-vio.json`, que es una foto de
// `main` en el SHA que imprime; el oráculo se lee del árbol de HOY, así que las dos cifras no son del
// mismo instante y la salida lo dice.
//
// Jira no se lee desde aquí: se le pasa un volcado. El del 13-oct salió de
//   key in (SCRUM-713, SCRUM-285, SCRUM-506, SCRUM-469, SCRUM-356, SCRUM-357, SCRUM-303, SCRUM-304,
//           SCRUM-917, SCRUM-318, SCRUM-344, SCRUM-514, SCRUM-284, SCRUM-230)
// con los campos `description` y `comment` (14 tickets, 51 comentarios de 51). El volcado NO se sube:
// sin él la sonda corre igual y sólo mira el repo.
// Uso: node papel-nombrado.mjs [volcado-de-jira.json]
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = process.env.RAIZ_REPO || path.resolve(aqui, '../../../../..');
const j = JSON.parse(fs.readFileSync(path.join(raiz, 'docs/master/evidencias/SCRUM-1215/quien-la-vio/quien-la-vio.json'), 'utf8'));
const { constaAprobado } = await import(pathToFileURL(path.join(raiz, 'tests/_microcopy-aprobada.mjs')).href);
const OBJ_AB = new Set(['parteDetailView.js · TEXTOS', 'puertaSerie.js · SERIE_TEXTOS']);
const objetoDe = (r) => `${path.basename(r.f)} · ${r.id.split(' · ')[1].split('.')[0]}`;
const lee = (rel) => { try { return fs.readFileSync(path.join(raiz, rel), 'utf8'); } catch { return null; } };
const ticketDelGrupo = (sha) => { try { const s = execFileSync('git', ['-C', raiz, 'log', '-1', '--format=%s', sha], { encoding: 'utf8' }); const m = /scrum-0*(\d+)/i.exec(s); return m ? m[1] : null; } catch { return null; } };
const fichasDir = fs.readdirSync(path.join(raiz, 'docs/microcopy')).filter((f) => f.endsWith('.md'));
let jira = new Map();
if (process.argv[2]) { let t = fs.readFileSync(process.argv[2], 'utf8'); if (t.charCodeAt(0) === 0xFEFF) t = t.slice(1); const norm = (s) => String(s || '').replace(/\\/g, '').replace(/[*`_]/g, ''); for (const n of JSON.parse(t).issues.nodes) jira.set(n.key.replace('SCRUM-', ''), [{ d: 'descripción', t: norm(typeof n.fields.description === 'string' ? n.fields.description : JSON.stringify(n.fields.description)) }, ...((n.fields.comment.comments || []).map((c) => ({ d: 'c.' + c.id, t: norm(typeof c.body === 'string' ? c.body : JSON.stringify(c.body)) })))]); }
const pend = j.filas.filter((r) => { const un = r.trozos && r.trozos.length === 1 && r.trozos[0].trim() !== ''; return !(un && constaAprobado(r.trozos[0]).length) && !OBJ_AB.has(objetoDe(r)); });
const enAbiertos = j.filas.filter((r) => { const un = r.trozos && r.trozos.length === 1 && r.trozos[0].trim() !== ''; return !(un && constaAprobado(r.trozos[0]).length) && OBJ_AB.has(objetoDe(r)); }).length;
console.log(`POBLACION: ${j.filas.length} hojas de grupo · foto de main ${j.main} · el oráculo da ${j.filas.length - pend.length - enAbiertos} · no da ${pend.length} que se miran aquí y ${enAbiertos} de los dos objetos ya abiertos en firmadas-en-jira.mjs · volcado de Jira: ${jira.size} ticket(s)`);
// control positivo: una hoja con papel conocido tiene que hallarse; un literal inventado, no
const hallar = (trozos, texto) => trozos.length > 0 && trozos.every((z) => texto.includes(z));
const ctrlTxt = lee('docs/master/SCRUM-303.md') || '';
console.log(`CONTROL: «Crear albarán» en docs/master/SCRUM-303.md → ${hallar(['Crear albarán'], ctrlTxt)} (tiene que ser true) · un inventado → ${hallar(['Texto que nadie ha firmado jamás'], ctrlTxt)} (tiene que ser false)`);
if (!hallar(['Crear albarán'], ctrlTxt) || hallar(['Texto que nadie ha firmado jamás'], ctrlTxt)) { console.log('la sonda no ve lo que tiene que ver\nEXIT=1'); process.exit(1); }
const porObj = new Map();
for (const r of pend) { const o = objetoDe(r); if (!porObj.has(o)) porObj.set(o, []); porObj.get(o).push(r); }
let n = 0, conPapel = 0, sinTrozo = 0, sinPapel = 0;
for (const [obj, rs] of [...porObj].sort()) {
  const grupos = new Map(); for (const r of rs) { const k = r.shaG + '|' + r.firma; if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(r); }
  for (const [, g] of grupos) {
    const letra = g[0].firma || '';
    const nums = new Set([...letra.matchAll(/SCRUM-(\d+)/g)].map((m) => m[1])); const tg = ticketDelGrupo(g[0].shaG); if (tg) nums.add(tg);
    const rutas = new Set([...letra.matchAll(/docs\/[\w\-./]+\.md/g)].map((m) => m[0]));
    for (const k of nums) { rutas.add(`docs/master/SCRUM-${k}.md`); for (const f of fichasDir) if (new RegExp(`SCRUM-${k}-`).test(f)) rutas.add('docs/microcopy/' + f); const p = `docs/prototipos/SCRUM-${k}/textos-propuestos.md`; if (lee(p)) rutas.add(p); }
    const quien = (/Aprobad[oa]s?\s+por\s+el\s+orquestador\s+por\s+delegaci|FIRMADOS? por el orquestador por delegaci/i.test(letra) ? 'orquestador por delegación' : /fundador/i.test(letra) && /aprob|firm/i.test(letra) ? 'nombra al fundador' : /asesor/i.test(letra) ? 'nombra al asesor' : 'no nombra a nadie');
    console.log(`\n══ ${obj} · ${g.length} hoja(s) · grupo ${String(g[0].fechaG).slice(0, 10)} · ticket del grupo SCRUM-${tg} · la letra ${quien} · papeles nombrados: ${rutas.size} · tickets en Jira volcados: ${[...nums].filter((k) => jira.has(k)).join(',') || '—'}`);
    for (const r of g) {
      n++;
      const trozos = (r.trozos || []).map((z) => z.trim()).filter((z) => z.length > 1 && !/^(es-ES|numeric|short|2-digit)$/.test(z));
      const clave = r.id.split(' · ')[1].split('.').slice(1).join('.');
      if (!trozos.length) { sinTrozo++; console.log(`  · ${clave} = «${(r.trozos || []).join('{…}').slice(0, 60)}» → SIN TROZO BUSCABLE`); continue; }
      const sitios = [];
      for (const rel of [...rutas].sort()) { const t = lee(rel); if (!t) continue; const ls = t.split(/\r?\n/); const largo = [...trozos].sort((a, b) => b.length - a.length)[0]; const prosa = t.replace(/\s+/g, ' '); if (!trozos.every((z) => prosa.includes(z))) continue; let i = ls.findIndex((l) => l.includes(largo)); if (i < 0) i = ls.findIndex((l) => l.includes(largo.split(' ').slice(0, 3).join(' '))); sitios.push(`${rel}:${i + 1}`); }
      for (const k of nums) for (const s of (jira.get(k) || [])) if (trozos.every((z) => s.t.replace(/\s+/g, ' ').includes(z))) sitios.push(`Jira SCRUM-${k} ${s.d}`);
      if (sitios.length) conPapel++; else sinPapel++;
      console.log(`  · ${clave} = «${trozos.join('{…}').slice(0, 70)}» → ${sitios.length ? sitios.slice(0, 5).join(' · ') + (sitios.length > 5 ? ` · y ${sitios.length - 5} más` : '') : 'EN NINGÚN PAPEL NOMBRADO'}`);
    }
  }
}
console.log(`\nRECUENTO: ${n} hojas · en algún papel que nombra su letra ${conPapel} · en ninguno ${sinPapel} · sin trozo buscable ${sinTrozo}`);
console.log(n === pend.length ? 'EXIT=0' : 'EXIT=1'); process.exit(n === pend.length ? 0 : 1);
