// scripts/equipo/panel/generar-panel.mjs — SCRUM-1870 · el panel de versiones, GENERADO y no a mano
//
//   node scripts/equipo/panel/generar-panel.mjs <panel.data.json> --salida <pagina.html> [--tokens <tokens.css>]
//
// Lee los datos (contrato: panel.schema.json, en este directorio) y escribe el HTML COMPLETO del panel.
// Lo que promete (pieza A3 con el equipo J, SCRUM-1835 c.22778): «panel generado, no a mano, con
// números CALCULADOS y "medido a las" por fila».
//
//   · Ningún número del panel viene de los datos. El % de cada versión es Dentro ÷ total de SU tabla;
//     cada KPI es una cuenta de filas; la hora de la cabecera es el intervalo de los «medidoA» de las
//     filas. No hay reloj: los mismos datos dan los mismos bytes.
//   · Si los datos traen una cifra escrita a mano (una clave «pct», un «33 %» en un texto) o una fila
//     sin «medidoA», el generador PARA, dice dónde, y NO escribe nada (salida 1).
//   · El panel es PÚBLICO. Un correo, un teléfono o un importe en cualquier texto PARA el generador.
//   · Los colores salen de public/tokens.css, que se lee al generar: si le falta --brand o --logo-cyan,
//     PARA (salida 2) en vez de pintar con un color que no es de la casa.
//
// Salidas: 0 escrito · 1 datos inválidos · 2 no pude leer (datos, tokens o argumentos).
// Lo atan tests/scrum1870-generador-panel.test.mjs y sus MUTACIONES_QUE_ME_TUMBAN.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..', '..');
export const TOKENS_POR_DEFECTO = path.join(RAIZ, 'public', 'tokens.css');

export const ESTADOS_VERSION = ['terminada', 'en-obra', 'arrancada', 'propuesta'];
export const ESTADOS_PIEZA = ['dentro', 'robot', 'obra', 'cola'];
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;
const TICKET = /^SCRUM-\d+[a-z]?$/;
const REF = /^(#\d+|c\.\d+)$/;
const REF_DE_EJEMPLO = /^(#0+|c\.0+)$/;
const ID_VERSION = /^\d+\.\d+$/;
const PUESTO = /^[SJ]\d$/;

// Claves que, si aparecen, son una cifra escrita a mano: se nombran como tal, no como «clave desconocida».
const CLAVE_DE_CIFRA = /^(pct|porcentaje|progreso|percent|percentage|total|cifra|valor|n|numero|número|cuantas|cuántas|hechas|dentro)$/i;
// Un porcentaje dentro de un texto: «33 %», «33%», «33 por ciento».
const PORCENTAJE_EN_TEXTO = /\d\s*(%|por\s*ciento)/i;
// Lo que nunca puede salir en un panel público.
const PUBLICO = [
  { re: /[^\s@<>()]+@[^\s@<>()]+\.[a-z]{2,}/i, que: 'un correo' },
  { re: /(\d[\d.,]*\s*(€|eur\b|euros?\b))|(€\s*\d)/i, que: 'un importe' },
  { re: /(\+\d{2}[\s-]?\d[\d\s-]{7,})|\b[6-9]\d{2}[\s-]?\d{3}[\s-]?\d{3}\b/, que: 'un teléfono' },
];

const CLAVES = {
  raiz: ['ejemplo', 'versiones', 'kpis'],
  version: ['id', 'nombre', 'estado', 'ficha', 'objetivo', 'terminadaEl', 'piezas'],
  pieza: ['ticket', 'titulo', 'detalle', 'quien', 'estado', 'ref', 'medidoA'],
  quien: ['equipo', 'puesto'],
  kpi: ['etiqueta', 'version', 'cuenta'],
};
export const OBLIGATORIAS = {
  raiz: ['versiones', 'kpis'],
  version: ['id', 'nombre', 'estado', 'ficha', 'objetivo', 'piezas'],
  pieza: ['ticket', 'titulo', 'quien', 'estado', 'ref', 'medidoA'],
  quien: ['equipo', 'puesto'],
  kpi: ['etiqueta', 'version', 'cuenta'],
};

const esObjeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const esTexto = (v) => typeof v === 'string' && v.trim().length > 0;
const instante = (v) => typeof v === 'string' && ISO.test(v) && !Number.isNaN(Date.parse(v));
const refsDe = (ref) => (ref === null || ref === undefined ? [] : Array.isArray(ref) ? ref : [ref]);

function revisarClaves(obj, tipo, donde, errores) {
  for (const k of Object.keys(obj)) {
    if (CLAVES[tipo].includes(k)) continue;
    if (CLAVE_DE_CIFRA.test(k)) {
      errores.push(`${donde}: «${k}» es una cifra escrita a mano. El panel la CALCULA de las filas; quítala de los datos.`);
    } else {
      errores.push(`${donde}: clave «${k}» que no está en panel.schema.json.`);
    }
  }
  for (const k of OBLIGATORIAS[tipo]) {
    if (!(k in obj)) errores.push(`${donde}: falta «${k}» (obligatoria en panel.schema.json).`);
  }
}

// Todos los textos, con su ruta, para las dos reglas que valen en cualquier campo.
function* textos(v, ruta) {
  if (typeof v === 'string') yield [ruta, v];
  else if (Array.isArray(v)) for (let i = 0; i < v.length; i++) yield* textos(v[i], `${ruta}[${i}]`);
  else if (esObjeto(v)) for (const [k, x] of Object.entries(v)) yield* textos(x, ruta ? `${ruta}.${k}` : k);
}

/**
 * Devuelve la lista de errores de los datos; vacía = válidos. No lanza.
 */
export function validarPanel(datos) {
  const errores = [];
  if (!esObjeto(datos)) return ['los datos no son un objeto JSON.'];
  revisarClaves(datos, 'raiz', 'raíz', errores);
  const ejemplo = 'ejemplo' in datos;
  if (ejemplo && !esTexto(datos.ejemplo)) errores.push('raíz: «ejemplo», si está, es un texto que dice que los datos son inventados.');

  for (const [ruta, t] of textos(datos, '')) {
    if (PORCENTAJE_EN_TEXTO.test(t)) {
      errores.push(`${ruta}: porcentaje escrito a mano («${t}»). Los % los calcula el panel de las filas.`);
    }
    for (const p of PUBLICO) {
      if (p.re.test(t)) errores.push(`${ruta}: lleva ${p.que} y el panel es PÚBLICO («${t}»).`);
    }
  }

  const versiones = Array.isArray(datos.versiones) ? datos.versiones : [];
  if ('versiones' in datos && (!Array.isArray(datos.versiones) || datos.versiones.length === 0)) {
    errores.push('raíz: «versiones» es una lista con al menos una versión.');
  }
  const ids = new Set();
  versiones.forEach((v, i) => {
    const dv = `versiones[${i}]${esObjeto(v) && v.id ? ` (${v.id})` : ''}`;
    if (!esObjeto(v)) { errores.push(`${dv}: no es un objeto.`); return; }
    revisarClaves(v, 'version', dv, errores);
    if (!(typeof v.id === 'string' && ID_VERSION.test(v.id))) errores.push(`${dv}: «id» con forma 1.1.`);
    else if (ids.has(v.id)) errores.push(`${dv}: «id» repetido.`);
    else ids.add(v.id);
    if ('nombre' in v && !esTexto(v.nombre)) errores.push(`${dv}: «nombre» vacío.`);
    if ('objetivo' in v && !esTexto(v.objetivo)) errores.push(`${dv}: «objetivo» vacío.`);
    if ('estado' in v && !ESTADOS_VERSION.includes(v.estado)) errores.push(`${dv}: «estado» es uno de ${ESTADOS_VERSION.join(' · ')}.`);
    if ('ficha' in v && !(typeof v.ficha === 'string' && TICKET.test(v.ficha))) errores.push(`${dv}: «ficha» es un SCRUM-N.`);
    if (v.estado === 'terminada' && !instante(v.terminadaEl)) errores.push(`${dv}: terminada sin «terminadaEl» (ISO con zona).`);
    if (v.estado !== 'terminada' && 'terminadaEl' in v) errores.push(`${dv}: «terminadaEl» sólo en una versión terminada.`);
    if ('piezas' in v && !Array.isArray(v.piezas)) { errores.push(`${dv}: «piezas» es una lista.`); return; }
    const piezas = v.piezas || [];
    if (v.estado === 'terminada') {
      if (piezas.length === 0) errores.push(`${dv}: terminada SIN piezas. Una versión vacía no se da por terminada.`);
      if (piezas.some((p) => esObjeto(p) && p.estado !== 'dentro')) errores.push(`${dv}: terminada con piezas que no están «dentro».`);
    }
    piezas.forEach((p, j) => {
      const dp = `${dv} · piezas[${j}]${esObjeto(p) && esTexto(p.titulo) ? ` («${p.titulo}»)` : ''}`;
      if (!esObjeto(p)) { errores.push(`${dp}: no es un objeto.`); return; }
      revisarClaves(p, 'pieza', dp, errores);
      if ('ticket' in p && p.ticket !== null && !(typeof p.ticket === 'string' && TICKET.test(p.ticket))) errores.push(`${dp}: «ticket» es SCRUM-N o null.`);
      if ('titulo' in p && !esTexto(p.titulo)) errores.push(`${dp}: «titulo» vacío.`);
      if ('detalle' in p && !esTexto(p.detalle)) errores.push(`${dp}: «detalle», si está, no va vacío.`);
      if ('estado' in p && !ESTADOS_PIEZA.includes(p.estado)) errores.push(`${dp}: «estado» es uno de ${ESTADOS_PIEZA.join(' · ')}.`);
      if ('medidoA' in p && !instante(p.medidoA)) errores.push(`${dp}: «medidoA» no es un instante ISO con zona («${p.medidoA}»).`);
      if ('quien' in p) {
        if (!Array.isArray(p.quien)) errores.push(`${dp}: «quien» es una lista (vacía = sin asignar).`);
        else p.quien.forEach((q, k) => {
          const dq = `${dp} · quien[${k}]`;
          if (!esObjeto(q)) { errores.push(`${dq}: no es un objeto.`); return; }
          revisarClaves(q, 'quien', dq, errores);
          if ('equipo' in q && !['S', 'J'].includes(q.equipo)) errores.push(`${dq}: «equipo» es S o J.`);
          if ('puesto' in q && !(typeof q.puesto === 'string' && PUESTO.test(q.puesto))) errores.push(`${dq}: «puesto» con forma S2 o J1.`);
          else if (typeof q.puesto === 'string' && q.puesto[0] !== q.equipo) errores.push(`${dq}: el puesto ${q.puesto} no es del equipo ${q.equipo}.`);
        });
      }
      if ('ref' in p) {
        const rs = refsDe(p.ref);
        const forma = p.ref === null || (typeof p.ref === 'string') || (Array.isArray(p.ref) && p.ref.length > 0);
        if (!forma || rs.some((r) => !(typeof r === 'string' && REF.test(r)))) {
          errores.push(`${dp}: «ref» es #PR o c.N (o una lista de ellos, o null).`);
        } else {
          if ((p.estado === 'dentro' || p.estado === 'robot') && !rs.some((r) => r.startsWith('#'))) {
            errores.push(`${dp}: «${p.estado}» sin #PR. Lo que dice estar en main o en el robot se tiene que poder comprobar.`);
          }
          if (ejemplo && rs.some((r) => !REF_DE_EJEMPLO.test(r))) errores.push(`${dp}: datos de ejemplo con una ref real (${rs.join(' ')}): en el ejemplo, #0000 o c.0.`);
          if (!ejemplo && rs.some((r) => REF_DE_EJEMPLO.test(r))) errores.push(`${dp}: ref de ejemplo (${rs.join(' ')}) en datos que no se declaran «ejemplo».`);
        }
      }
    });
  });

  const kpis = Array.isArray(datos.kpis) ? datos.kpis : [];
  if ('kpis' in datos && !Array.isArray(datos.kpis)) errores.push('raíz: «kpis» es una lista.');
  kpis.forEach((k, i) => {
    const dk = `kpis[${i}]`;
    if (!esObjeto(k)) { errores.push(`${dk}: no es un objeto.`); return; }
    revisarClaves(k, 'kpi', dk, errores);
    if ('etiqueta' in k && !esTexto(k.etiqueta)) errores.push(`${dk}: «etiqueta» vacía.`);
    if ('version' in k && !ids.has(k.version)) errores.push(`${dk}: la versión «${k.version}» no está en «versiones».`);
    if ('cuenta' in k && !(Array.isArray(k.cuenta) && k.cuenta.length > 0 && k.cuenta.every((e) => ESTADOS_PIEZA.includes(e))
      && new Set(k.cuenta).size === k.cuenta.length)) errores.push(`${dk}: «cuenta» es una lista sin repetidos de ${ESTADOS_PIEZA.join(' · ')}.`);
  });
  return errores;
}

/** El bloque :root de tokens.css, sin comentarios. PARA si faltan los dos tokens de marca. */
export function leerTokens(css) {
  const sin = String(css).replace(/\/\*[\s\S]*?\*\//g, '');
  const m = sin.match(/:root\s*\{([^}]*)\}/);
  if (!m) throw new Error('tokens.css sin bloque :root');
  const cuerpo = m[1].split('\n').map((l) => l.trim()).filter(Boolean).join('\n  ');
  for (const t of ['--brand', '--logo-cyan']) {
    if (!new RegExp(`${t}\\s*:`).test(cuerpo)) throw new Error(`tokens.css sin ${t}`);
  }
  return `:root{\n  ${cuerpo}\n}`;
}

// ── Cálculos: TODO número del panel sale de aquí ────────────────────────────────────────────────
export function cuentaDe(version, estados) {
  return (version.piezas || []).filter((p) => estados.includes(p.estado)).length;
}
export function porcentajeDe(version) {
  const total = (version.piezas || []).length;
  if (total === 0) return null; // sin filas no hay porcentaje: un cero no es «0 %»
  return Math.round((cuentaDe(version, ['dentro']) * 100) / total);
}

const MADRID = 'Europe/Madrid';
const fmtHora = new Intl.DateTimeFormat('es-ES', { timeZone: MADRID, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const fmtDia = new Intl.DateTimeFormat('es-ES', { timeZone: MADRID, day: 'numeric', month: 'short' });
const fmtClaveDia = new Intl.DateTimeFormat('en-CA', { timeZone: MADRID, year: 'numeric', month: '2-digit', day: '2-digit' });
export const horaMadrid = (iso) => fmtHora.format(new Date(iso));
const diaMadrid = (iso) => fmtDia.format(new Date(iso)).replace('.', '');
const claveDia = (iso) => fmtClaveDia.format(new Date(iso));

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const JIRA = 'https://yaqu.atlassian.net/browse/';
const PR = 'https://github.com/lwislg99/cobroflash-backend/pull/';

function enlaceRef(r, ticket, ejemplo) {
  if (ejemplo) return `<span>${esc(r)}</span>`;
  if (r.startsWith('#')) return `<a href="${PR}${r.slice(1)}">${esc(r)}</a>`;
  if (ticket) return `<a href="${JIRA}${esc(ticket)}?focusedCommentId=${r.slice(2)}">${esc(r)}</a>`;
  return `<span>${esc(r)}</span>`;
}

const CHIP_PIEZA = { dentro: ['c-ok', 'Dentro'], robot: ['c-robot', 'Robot'], obra: ['c-obra', 'Obra'], cola: ['c-cola', 'Cola'] };

function chipVersion(v) {
  const pct = porcentajeDe(v);
  if (v.estado === 'terminada') return '<span class="chip c-ok">Terminada</span>';
  if (v.estado === 'en-obra') return `<span class="chip c-obra">En obra${pct === null ? '' : ` · ${pct} %`}</span>`;
  if (v.estado === 'arrancada') return '<span class="chip c-obra">Arrancada</span>';
  return '<span class="chip c-next">Propuesta</span>';
}

function sellos(quien) {
  if (!quien.length) return '<span class="sello nadie" title="sin asignar">¿?</span>';
  return quien.map((q) => `<span class="sello ${q.equipo === 'S' ? 'eq-s' : 'eq-j'}">${esc(q.puesto)}</span>`).join('·');
}

function filaPieza(p, diaDelPanel, ejemplo, conEstado) {
  const rs = refsDe(p.ref);
  const ref = rs.length ? rs.map((r) => enlaceRef(r, p.ticket, ejemplo)).join(' · ') : '—';
  const ticket = p.ticket
    ? (ejemplo ? `<span class="tk">${esc(p.ticket)}</span>` : `<a class="tk" href="${JIRA}${esc(p.ticket)}">${esc(p.ticket)}</a>`)
    : '<span class="tk">sin ticket</span>';
  const dia = claveDia(p.medidoA) === diaDelPanel ? '' : ` del ${diaMadrid(p.medidoA)}`;
  const [cls, txt] = CHIP_PIEZA[p.estado];
  return `<tr><td class="p">${ticket}<b>${esc(p.titulo)}</b>${p.detalle ? ` — ${esc(p.detalle)}` : ''}</td>`
    + `<td class="q">${sellos(p.quien)}</td>`
    + (conEstado ? `<td class="e"><span class="chip ${cls}">${txt}</span></td>` : '')
    + `<td class="r">${ref}</td>`
    + `<td class="m"><time datetime="${esc(p.medidoA)}">a las ${horaMadrid(p.medidoA)}${dia}</time></td></tr>`;
}

function tabla(v, diaDelPanel, ejemplo, conEstado) {
  return `<div class="tw"><table>
      <thead><tr><th>Pieza</th><th>Quién</th>${conEstado ? '<th>Estado</th>' : ''}<th>Ref.</th><th>Medido</th></tr></thead>
      <tbody>
        ${v.piezas.map((p) => filaPieza(p, diaDelPanel, ejemplo, conEstado)).join('\n        ')}
      </tbody>
    </table></div>`;
}

function barra(v) {
  const pct = porcentajeDe(v);
  if (pct === null) return '';
  const dentro = cuentaDe(v, ['dentro']);
  return `<div class="prog"><div class="barra" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Progreso de la versión ${esc(v.id)}"><span style="--w:${pct}%"></span></div><span class="pct">${pct} %</span></div>
    <p class="calc">${dentro} de ${v.piezas.length} ${v.piezas.length === 1 ? 'pieza' : 'piezas'} dentro: Dentro ÷ total de esta tabla, calculado al generar.</p>`;
}

function tarjeta(v, diaDelPanel, ejemplo) {
  const ficha = ejemplo
    ? `<span class="fx">Ficha ${esc(v.ficha)}</span>`
    : `<a href="${JIRA}${esc(v.ficha)}">${v.estado === 'terminada' ? `Terminada el ${diaMadrid(v.terminadaEl)} · ` : 'Ficha '}${esc(v.ficha)} ↗</a>`;
  let cuerpo = '';
  if (!v.piezas.length) cuerpo = '<p class="vacia">Sin piezas en la tabla todavía.</p>';
  else if (v.estado === 'terminada') {
    cuerpo = `<details>
      <summary>${v.piezas.length === 1 ? 'Ver la pieza' : `Ver las ${v.piezas.length} piezas`}</summary>
      ${tabla(v, diaDelPanel, ejemplo, false)}
    </details>`;
  } else cuerpo = tabla(v, diaDelPanel, ejemplo, true);
  return `<section class="card">
    <div class="cab"><h2>${esc(v.id)} · ${esc(v.nombre)}</h2>${ficha}</div>
    <p class="obj">${esc(v.objetivo)}</p>
    ${barra(v)}
    ${cuerpo}
  </section>`;
}

function cabeceraDeMedida(datos) {
  const todos = datos.versiones.flatMap((v) => v.piezas.map((p) => p.medidoA)).sort((a, b) => Date.parse(a) - Date.parse(b));
  if (!todos.length) return { texto: 'Sin filas medidas', dia: '' };
  const [a, z] = [todos[0], todos[todos.length - 1]];
  const dia = claveDia(z);
  const desde = claveDia(a) === dia ? horaMadrid(a) : `${horaMadrid(a)} del ${diaMadrid(a)}`;
  const texto = horaMadrid(a) === horaMadrid(z) && claveDia(a) === dia
    ? `Filas medidas contra GitHub y Jira a las ${horaMadrid(z)} del ${diaMadrid(z)}`
    : `Filas medidas contra GitHub y Jira entre las ${desde} y las ${horaMadrid(z)} del ${diaMadrid(z)}`;
  return { texto, dia };
}

const OSCURO = `--ink:#e8efe9; --body:#b7c0ba; --muted:#8b958e; --bg:#0c120e; --surface:#141b16; --border:#56605a; --linea-suave:#263029;
    --brand:#34d399; --brand-700:#6ee7b7; --brand-tint:#0c261b; --brand-tint-ink:#6ee7b7;
    --eq-j:#c4b5fd; --eq-j-tint:#241a3d; --robot:#7dd3fc; --robot-tint:#0b2536;
    --obra:#fbbf24; --obra-tint:#2b2108; --cola:#8b958e; --cola-tint:#1b221d; --bar-bg:#263029; --sombra:none;`;

/** El HTML completo. LANZA si los datos no son válidos: no hay camino que pinte datos sin validar. */
export function generarPanel(datos, tokensCss) {
  const errores = validarPanel(datos);
  if (errores.length) {
    const e = new Error(`datos inválidos: ${errores.length} error(es)`);
    e.errores = errores;
    throw e;
  }
  const raiz = leerTokens(tokensCss);
  const ejemplo = 'ejemplo' in datos;
  const { texto, dia } = cabeceraDeMedida(datos);
  const porId = new Map(datos.versiones.map((v) => [v.id, v]));
  const kpis = datos.kpis.map((k) => `<div class="kpi"><div class="n">${cuentaDe(porId.get(k.version), k.cuenta)}</div><div class="l">${esc(k.etiqueta)}</div></div>`);
  const tren = datos.versiones.map((v) => `<div class="paso"><div class="v">${esc(v.id)}</div><div class="n">${esc(v.nombre)}</div>${chipVersion(v)}</div>`);
  const fichas = datos.versiones.map((v) => (ejemplo ? esc(v.id) : `<a href="${JIRA}${esc(v.ficha)}">${esc(v.id)}</a>`)).join(' · ');
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="generator" content="scripts/equipo/panel/generar-panel.mjs (SCRUM-1870)">
<title>YaQu · Versiones</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
/* Tokens de la casa: copiados AL GENERAR de public/tokens.css (DESIGN.md). No se editan aquí. */
${raiz}
/* Capa del panel: lo que tokens.css no tiene (estados de pieza, equipo J) y el modo oscuro. */
:root{
  --linea-suave:#e3e6e2; --eq-j:#6d28d9; --eq-j-tint:#f1ebfd; --robot:#0369a1; --robot-tint:#e0f2fe;
  --obra:#b45309; --obra-tint:#fdf3e3; --cola:#6a746e; --cola-tint:#eef0ee; --bar-bg:#e6e9e5; --sombra:var(--shadow-md);
}
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]){
    ${OSCURO}
  }
}
:root[data-theme="dark"]{
    ${OSCURO}
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--body);font:14.5px/1.55 Inter,system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}
main{max-width:960px;margin:0 auto;padding:34px 16px 60px}
a{color:var(--brand-700);text-decoration:none;font-weight:600}
a:focus-visible{outline:none;box-shadow:var(--ring);border-radius:4px}
.topbar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:8px}
.marca{display:flex;align-items:center;gap:10px}
.logo{width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,var(--brand-bright),var(--logo-cyan));display:grid;place-items:center;color:var(--brand-ink);font-weight:800;font-size:16px}
.marca .t{font-size:19px;font-weight:800;color:var(--ink);letter-spacing:-.01em}
.marca .s{display:block;font-size:12px;font-weight:600;color:var(--muted);letter-spacing:.08em;text-transform:uppercase}
.foto{font-size:12.5px;color:var(--muted)}
h1{position:absolute;left:-9999px}
.aviso{margin:14px 0 4px;padding:10px 14px;border-radius:var(--r-md);background:var(--obra-tint);color:var(--obra);font-weight:700;font-size:13px}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:18px 0 14px}
.kpi{background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);box-shadow:var(--sombra);padding:12px 14px}
.kpi .n{font-size:22px;font-weight:800;color:var(--ink);line-height:1.1}
.kpi .l{font-size:12px;color:var(--muted);font-weight:600}
.tren{display:flex;margin:10px 0 26px;border:1px solid var(--border);border-radius:var(--r-lg);background:var(--surface);box-shadow:var(--sombra);overflow:hidden}
.paso{flex:1;min-width:0;padding:13px 16px 11px;border-left:1px solid var(--linea-suave)}
.paso:first-child{border-left:none}
.paso .v{font-size:11.5px;font-weight:800;color:var(--muted);letter-spacing:.08em}
.paso .n{font-weight:700;font-size:14px;color:var(--ink);margin:1px 0 7px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.chip{display:inline-block;font-size:11px;font-weight:700;padding:3px 9px;border-radius:var(--r-full);letter-spacing:.02em;white-space:nowrap}
.c-ok{background:var(--brand-tint);color:var(--brand-tint-ink)}
.c-obra{background:var(--obra-tint);color:var(--obra)}
.c-robot{background:var(--robot-tint);color:var(--robot)}
.c-cola{background:var(--cola-tint);color:var(--cola)}
.c-next{background:var(--eq-j-tint);color:var(--eq-j)}
section.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);box-shadow:var(--sombra);padding:20px 22px 16px;margin-bottom:18px}
.cab{display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap}
.cab h2{margin:0;font-size:17px;font-weight:800;color:var(--ink);letter-spacing:-.01em}
.cab a,.cab .fx{font-size:12.5px}
.cab .fx{color:var(--muted);font-weight:600}
.obj{margin:4px 0 12px;font-size:13.5px;color:var(--muted)}
.calc{margin:-8px 0 12px;font-size:12px;color:var(--muted)}
.vacia{margin:0 0 6px;font-size:13px;color:var(--muted)}
.prog{display:flex;align-items:center;gap:12px;margin:2px 0 14px}
.barra{flex:1;height:9px;border-radius:var(--r-full);background:var(--bar-bg);overflow:hidden}
.barra>span{display:block;height:100%;width:var(--w);border-radius:var(--r-full);background:linear-gradient(90deg,var(--brand),var(--brand-bright));animation:llenar 1.1s cubic-bezier(.25,.9,.3,1) both}
@keyframes llenar{from{width:0}to{width:var(--w)}}
@media (prefers-reduced-motion:reduce){.barra>span{animation:none}}
.pct{font-weight:800;color:var(--ink);min-width:44px;text-align:right;font-size:14.5px}
.tw{overflow-x:auto;margin:0 -6px}
table{width:100%;border-collapse:collapse;min-width:600px}
th{font-size:11px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--muted);text-align:left;padding:8px 10px;border-bottom:1px solid var(--border)}
td{padding:9px 10px;border-bottom:1px solid var(--linea-suave);font-size:13.5px;vertical-align:top}
tr:last-child td{border-bottom:none}
td.p{color:var(--ink)}
td.p b{font-weight:600}
td.p .tk{display:block;font-size:11.5px;font-weight:600;color:var(--muted)}
td.p a.tk{color:var(--muted)}
td.q,td.e{white-space:nowrap}
td.r,td.m{color:var(--muted);font-size:12px;white-space:nowrap}
td.r{text-align:right}
.sello{display:inline-grid;place-items:center;min-width:26px;height:20px;padding:0 5px;border-radius:6px;font-size:11px;font-weight:800}
.sello.eq-s{background:var(--brand-tint);color:var(--brand-tint-ink)}
.sello.eq-j{background:var(--eq-j-tint);color:var(--eq-j)}
.sello.nadie{background:var(--robot-tint);color:var(--robot)}
details{margin-top:4px}
details summary{cursor:pointer;color:var(--brand-700);font-weight:600;font-size:13px;padding:4px 0}
.leyenda{display:flex;gap:14px;flex-wrap:wrap;margin:0 0 22px;font-size:12px;color:var(--muted);align-items:center}
footer{color:var(--muted);font-size:12.5px;margin-top:24px;line-height:1.7}
@media (max-width:640px){ .tren{flex-wrap:wrap} .paso{flex:1 1 50%;border-top:1px solid var(--linea-suave)} .paso:nth-child(-n+2){border-top:none} }
</style>
</head>
<body>
<main>
  <h1>YaQu · Panel de versiones</h1>
  <div class="topbar">
    <div class="marca"><div class="logo" aria-hidden="true">Y</div><div><span class="t">YaQu</span><span class="s">Panel de versiones</span></div></div>
    <div class="foto">${esc(texto)}</div>
  </div>
${ejemplo ? `  <div class="aviso" role="note">DATOS DE EJEMPLO · ${esc(datos.ejemplo)}</div>\n` : ''}
  <div class="kpis">
    ${kpis.join('\n    ')}
  </div>

  <nav class="tren" aria-label="Cadena de versiones">
    ${tren.join('\n    ')}
  </nav>

  <div class="leyenda">
    <span><span class="sello eq-s">S2</span> puesto del equipo S</span>
    <span><span class="sello eq-j">J2</span> puesto del equipo J</span>
    <span><span class="chip c-ok">Dentro</span> mergeado en main</span>
    <span><span class="chip c-robot">Robot</span> PR con CI corriendo</span>
    <span><span class="chip c-obra">Obra</span> construyéndose</span>
    <span><span class="chip c-cola">Cola</span> decidida, sin empezar</span>
  </div>

  ${datos.versiones.map((v) => tarjeta(v, dia, ejemplo)).join('\n\n  ')}

  <footer>
    Generado por <code>scripts/equipo/panel/generar-panel.mjs</code>: cada porcentaje es Dentro ÷ total de su tabla y cada cifra de arriba es una cuenta de filas, calculados al generar; ninguno se escribe a mano. Cada fila dice a qué hora (de Madrid) se midió.<br>
    Fichas: ${fichas}
  </footer>
</main>
</body>
</html>
`;
}

// ── Línea de órdenes ───────────────────────────────────────────────────────────────────────────
function argumentos(argv) {
  const a = { datos: null, salida: null, tokens: TOKENS_POR_DEFECTO };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--salida') a.salida = argv[++i];
    else if (argv[i] === '--tokens') a.tokens = argv[++i];
    else if (!a.datos) a.datos = argv[i];
    else return null;
  }
  return a.datos && a.salida ? a : null;
}

export function main(argv) {
  const a = argumentos(argv);
  if (!a) {
    console.error('uso: node scripts/equipo/panel/generar-panel.mjs <panel.data.json> --salida <pagina.html> [--tokens <tokens.css>]');
    return 2;
  }
  let datos, tokens;
  try { datos = JSON.parse(fs.readFileSync(a.datos, 'utf8')); } catch (e) {
    console.error(`🔴 NO PUDE LEER los datos (${a.datos}): ${e.message}. No se escribe nada.`);
    return 2;
  }
  try { tokens = fs.readFileSync(a.tokens, 'utf8'); leerTokens(tokens); } catch (e) {
    console.error(`🔴 NO PUDE LEER los tokens (${a.tokens}): ${e.message}. No se escribe nada.`);
    return 2;
  }
  const errores = validarPanel(datos);
  if (errores.length) {
    console.error(`🔴 PANEL NO GENERADO · ${errores.length} error(es) en ${a.datos}. No se escribe nada:`);
    for (const e of errores) console.error(`   · ${e}`);
    return 1;
  }
  const html = generarPanel(datos, tokens);
  fs.writeFileSync(a.salida, html, 'utf8');
  const piezas = datos.versiones.reduce((n, v) => n + v.piezas.length, 0);
  console.log(`✔ panel escrito en ${a.salida} · ${datos.versiones.length} versiones · ${piezas} piezas · ${Buffer.byteLength(html)} B`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
