// SCRUM-1473 · LA MÁQUINA: cuánto disco queda y qué ocupa lo del equipo. Lo usa el latido (sección DISCO).
//
// POR QUÉ EXISTE. El 6-oct-2026 la unidad donde viven los transcripts se quedó a 79 MB libres de 465 GB. Se
// supo porque a una sesión le reventó una escritura con ENOSPC a mitad de tanda: una sesión que no puede
// escribir su transcript muere sin avisar. El latido miraba el CI, el despliegue, las sesiones, el vigía y
// la cuenta QA, y no miraba el disco donde corre todo.
//
// LO QUE SE MIDIÓ ANTES DE ELEGIR UN UMBRAL (6-oct-2026, las cifras completas en `docs/master/SCRUM-1473.md`):
//   · En la unidad de la casa (perfil, transcripts, temporales) se escribieron 4,78 GB en el día, con 15
//     sesiones. Sólo 0,65 GB eran de las cuatro carpetas del equipo; el resto, de programas que se
//     actualizan y del navegador. LAS SESIONES NO LLENAN EL DISCO: las 15 sumaban 39 MB de `tmp`.
//   · En la unidad de los árboles de git, 1,26 GB en el día (un árbol nuevo son 119 MB).
//   · Lo del equipo en la unidad de la casa sumaba 4,1 GB de 414 ocupados. Barrerlo ENTERO no devuelve más
//     que eso: por eso la sección dice cuánto es nuestro y cuánto no.
//
// LA TRAMPA QUE ESTO NO REPITE. La medición a mano de ese día llevaba «ignora los errores»: dijo 6,5 GB y se
// liberaron 50, porque las rutas largas de Windows fallaban calladas. Aquí cada carpeta que no se puede
// recorrer se CUENTA y se enseña, y un tamaño con carpetas sin recorrer se llama SUELO, no tamaño.
//
// Y LOS ENLACES NO SE SIGUEN, junctions incluidas: un recorrido que entra por un enlace mide (o, en el
// barrido, borra) lo que hay al otro lado.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const GB = 1024 ** 3;

/** GB que se escriben en un día en cada unidad, por lo que vive en ella. MEDIDO el 6-oct-2026 (ver arriba). */
export const GB_AL_DIA = { casa: 4.8, arboles: 1.3 };
/**
 * Días de margen que tiene que quedar cuando salta el aviso. El latido sólo habla cuando alguien lo corre, y
 * el hueco más largo medido sin que nadie corriera nada es de 136 h (5,7 días: del 9 al 15-sep-2026, sin un
 * merge en `main`; el segundo, 88,5 h, del 2 al 6-oct). Seis días cubren los dos.
 */
export const DIAS_DE_MARGEN = 6;

/** El umbral de una unidad NO es un número: es lo que se escribe en ella al día por los días de margen. */
export function umbralGB(papeles) {
  // Redondeado a la décima: 1,3 × 6 en coma flotante es 7,800000000000001, y «7,8 libres» saldría por debajo.
  return Math.round(papeles.reduce((a, p) => a + (GB_AL_DIA[p] || 0), 0) * DIAS_DE_MARGEN * 10) / 10;
}

/**
 * Cuánto ocupa una carpeta, SIN seguir enlaces y contando lo que no pudo recorrer.
 * @param {(ruta:string, st:fs.Stats)=>void} [visita]  se llama por cada fichero
 * @returns {{existe:boolean, esEnlace:boolean, bytes:number, ficheros:number, carpetas:number, enlaces:number, noRecorridas:{codigo:string, ruta:string}[]}}
 */
export function recorrer(raiz, visita) {
  const r = { existe: true, esEnlace: false, bytes: 0, ficheros: 0, carpetas: 0, enlaces: 0, noRecorridas: [] };
  let st0;
  try { st0 = fs.lstatSync(raiz); } catch (e) {
    if (e.code === 'ENOENT') return { ...r, existe: false };
    r.noRecorridas.push({ codigo: String(e.code || e.name), ruta: raiz });
    return r;
  }
  // La raíz que es ella misma un enlace no se abre: lo que hay detrás no es de esta carpeta.
  if (st0.isSymbolicLink()) return { ...r, esEnlace: true, enlaces: 1 };
  const pila = [raiz];
  while (pila.length) {
    const d = pila.pop();
    let ents;
    try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { r.noRecorridas.push({ codigo: String(e.code || e.name), ruta: d }); continue; }
    r.carpetas++;
    for (const e of ents) {
      const p = path.join(d, e.name);
      // En Windows una junction responde `isSymbolicLink()`: ni se entra ni se suma.
      if (e.isSymbolicLink()) { r.enlaces++; continue; }
      if (e.isDirectory()) { pila.push(p); continue; }
      let st;
      try { st = fs.lstatSync(p); } catch (err) { r.noRecorridas.push({ codigo: String(err.code || err.name), ruta: p }); continue; }
      r.bytes += st.size; r.ficheros++;
      if (visita) visita(p, st);
    }
  }
  return r;
}

/** La unidad de una ruta, tal como la nombra el sistema: `C:` en Windows, `/` en lo demás. */
export function unidadDe(ruta) {
  const raiz = path.parse(path.resolve(ruta)).root;
  return raiz.replace(/[\\/]+$/, '') || raiz;
}

/** @returns {{libre:number, total:number}|{motivo:string}} nunca un cero por no haber podido leer */
export function espacioDe(unidad) {
  try {
    const s = fs.statfsSync(/^[A-Za-z]:$/.test(unidad) ? `${unidad}\\` : unidad);
    const libre = Number(s.bavail) * Number(s.bsize); const total = Number(s.blocks) * Number(s.bsize);
    if (!Number.isFinite(libre) || !Number.isFinite(total) || total <= 0) return { motivo: 'el sistema devolvió un tamaño que no es un número' };
    return { libre, total };
  } catch (e) { return { motivo: String((e && (e.code || e.message)) || e) }; }
}

/** Las cuatro carpetas del equipo en la unidad de la casa. Lo demás de esa unidad no es nuestro y no se mide. */
export function zonasDelEquipo({ casa = os.homedir(), temporales = os.tmpdir(), env = process.env } = {}) {
  return [
    { nombre: '.claude/jobs', ruta: path.join(casa, '.claude', 'jobs') },
    { nombre: '.claude/projects', ruta: path.join(casa, '.claude', 'projects') },
    { nombre: 'Temp', ruta: temporales },
    { nombre: 'npm-cache', ruta: env.npm_config_cache || (env.LOCALAPPDATA ? path.join(env.LOCALAPPDATA, 'npm-cache') : path.join(casa, '.npm')) },
  ];
}

const gb = (b) => (b / GB).toFixed(b / GB >= 10 ? 0 : b / GB >= 1 ? 1 : 2);

/**
 * @param {{
 *   unidades:{unidad:string, papeles:string[], libre?:number, total?:number, motivo?:string}[],
 *   zonas:{nombre:string, ruta:string, unidad:string, medida:ReturnType<typeof recorrer>}[],
 *   barrible?:{bytes:number, trabajos:number, horas:number}|null,
 * }} e
 * `barrible`: lo que el barrido de `tmp` de trabajos devolvería hoy · `null`/`undefined` = no se pudo calcular (se dice).
 */
export function seccionDisco({ unidades, zonas = [], barrible }) {
  const ciega = (motivo) => ({ nombre: 'DISCO', pudo: false, motivo, alertas: [], poblacion: null });
  if (!Array.isArray(unidades) || unidades.length === 0) return ciega('no sé en qué unidades vive el equipo: NO SÉ si hay sitio');
  const sinLeer = unidades.filter((u) => !Number.isFinite(u.libre) || !Number.isFinite(u.total));
  // Lo del equipo, por unidad. Un tamaño con carpetas sin recorrer es un SUELO, y se llama así.
  const deLaUnidad = (u) => zonas.filter((z) => z.unidad === u.unidad);
  const sinRecorrer = zonas.flatMap((z) => z.medida.noRecorridas.map((n) => ({ ...n, zona: z.nombre })));
  const textoDeZona = (z) => {
    if (!z.medida.existe) return `${z.nombre} NO EXISTE`;
    if (z.medida.esEnlace) return `${z.nombre} es un ENLACE (no se sigue: no se mide)`;
    if (z.medida.carpetas === 0) return `${z.nombre} NO SE PUDO RECORRER (${z.medida.noRecorridas[0] ? z.medida.noRecorridas[0].codigo : 'sin motivo'})`;
    return `${z.nombre} ${gb(z.medida.bytes)} GB${z.sub ? ` (de ellos \`${z.sub.nombre}\` ${gb(z.sub.bytes)})` : ''}`;
  };
  const loNuestro = (u) => {
    const zs = deLaUnidad(u);
    if (!zs.length) return '';
    const suma = zs.reduce((a, z) => a + z.medida.bytes, 0);
    const suelo = zs.some((z) => z.medida.noRecorridas.length || z.medida.esEnlace);
    const ocupado = u.total - u.libre;
    const parte = Number.isFinite(ocupado) && ocupado > 0 ? ` de los ${gb(ocupado)} ocupados (${(100 * suma / ocupado).toFixed(1)} %)` : '';
    return `lo del EQUIPO en ${u.unidad} suma ${suelo ? 'AL MENOS ' : ''}${gb(suma)} GB${parte}: ${zs.map(textoDeZona).join(' · ')} · lo demás de ${u.unidad} NO es del equipo y no se mide aquí: barrer TODO lo nuestro no devuelve más que esos ${gb(suma)} GB`;
  };
  const delBarrido = barrible === null || barrible === undefined
    ? 'no pude calcular cuánto devolvería el barrido de `tmp` de trabajos (`node scripts/equipo/barrer-jobs.mjs` lo dice)'
    : `el barrido de \`tmp\` de trabajos sin actividad en ${barrible.horas} h devolvería ${gb(barrible.bytes)} GB (${barrible.trabajos} trabajo(s)) → node scripts/equipo/barrer-jobs.mjs (pasada en seco: no borra)`;
  const alertas = [];
  for (const u of unidades) {
    if (sinLeer.includes(u)) continue;
    const umbral = umbralGB(u.papeles);
    if (u.libre / GB >= umbral) continue;
    const dias = u.papeles.reduce((a, p) => a + (GB_AL_DIA[p] || 0), 0);
    alertas.push({
      unidad: u.unidad,
      linea: `${u.unidad} · quedan ${gb(u.libre)} GB libres de ${gb(u.total)} (${(100 * u.libre / u.total).toFixed(1)} %), por debajo de ${umbral.toFixed(1)} GB (${DIAS_DE_MARGEN} días de lo que se escribe en ella: ${dias.toFixed(1)} GB al día, medido el 6-oct-2026) · al ritmo medido, ${(u.libre / GB / dias).toFixed(1)} día(s)${u.papeles.includes('casa') ? ' · aquí viven los transcripts: una sesión que no puede escribir MUERE SIN AVISAR, y una escritura que falle con ENOSPC es esto' : ''}${deLaUnidad(u).length ? ` · ${loNuestro(u)} · ${delBarrido}` : ''}`,
    });
  }
  const filaDe = (u) => (sinLeer.includes(u) ? `${u.unidad} NO SE PUDO LEER` : `${u.unidad} ${gb(u.libre)} GB libres de ${gb(u.total)} (aviso por debajo de ${umbralGB(u.papeles).toFixed(1)}: ${u.papeles.join(' + ')})`);
  const poblacion = `${unidades.map(filaDe).join(' · ')}`
    + unidades.filter((u) => !sinLeer.includes(u) && deLaUnidad(u).length).map((u) => ` · ${loNuestro(u)}`).join('')
    + (zonas.length ? ` · ${delBarrido}` : '')
    + (sinRecorrer.length ? ` · ⚠️ ${sinRecorrer.length} carpeta(s) o fichero(s) SIN RECORRER (${sinRecorrer.slice(0, 3).map((n) => `${n.codigo}: ${n.ruta}`).join(' · ')}${sinRecorrer.length > 3 ? ' …' : ''}): los tamaños de arriba son un SUELO` : '')
    + ` · ${zonas.reduce((a, z) => a + z.medida.ficheros, 0)} ficheros medidos, ${zonas.reduce((a, z) => a + z.medida.enlaces, 0)} enlace(s) sin seguir`;
  // Fail-closed: sin el espacio libre de UNA unidad no se dice «hay sitio» de ninguna manera.
  if (sinLeer.length) {
    return { nombre: 'DISCO', pudo: false, alertas, poblacion: null, motivo: `no se pudo leer el espacio libre de ${sinLeer.map((u) => `${u.unidad} (${u.motivo || 'sin motivo'})`).join(' ni de ')}: NO SÉ si hay sitio. Debajo va SOLO lo que sí pude leer: ${poblacion}` };
  }
  return { nombre: 'DISCO', pudo: true, alertas, poblacion };
}

/**
 * Lo único que toca el mundo: las unidades donde vive el equipo (la de la casa y la de los árboles; si son la
 * misma, una sola con los dos papeles) y el tamaño de las cuatro carpetas del equipo.
 */
export function medirDisco({ casa = os.homedir(), arboles, temporales = os.tmpdir(), env = process.env } = {}) {
  const papeles = new Map();
  for (const [papel, ruta] of [['casa', casa], ['arboles', arboles]]) {
    if (!ruta) continue;
    const u = unidadDe(ruta);
    papeles.set(u, [...(papeles.get(u) || []), papel]);
  }
  const unidades = [...papeles.entries()].map(([unidad, ps]) => ({ unidad, papeles: ps, ...espacioDe(unidad) }));
  const zonas = zonasDelEquipo({ casa, temporales, env }).map((z) => {
    const medida = recorrer(z.ruta);
    const fila = { ...z, unidad: unidadDe(z.ruta), medida };
    // De `.claude/jobs` se dice aparte lo que son carpetas `tmp` de sondas: el 6-oct eran el 99 % de sus 4,94 GB.
    if (z.nombre === '.claude/jobs' && medida.existe && !medida.esEnlace) {
      let bytes = 0;
      for (const e of (() => { try { return fs.readdirSync(z.ruta, { withFileTypes: true }); } catch { return []; } })()) {
        if (e.isDirectory() && !e.isSymbolicLink()) bytes += recorrer(path.join(z.ruta, e.name, 'tmp')).bytes;
      }
      fila.sub = { nombre: 'tmp', bytes };
    }
    return fila;
  });
  return { unidades, zonas };
}
