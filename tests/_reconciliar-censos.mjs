// tests/_reconciliar-censos.mjs — SCRUM-476
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// DOS CENSOS DEL MISMO ÁRBOL DIJERON COSAS DISTINTAS, Y NADIE SABÍA POR QUÉ
//
// El 11-ago-2026, con 3 h 50 m de diferencia, entraron a `main` dos instrumentos que miran el
// mismo objeto —`node_modules`— y publicaron números irreconciliables: «200 árboles · 91 por
// junction» (SCRUM-471) y «cuatro árboles · cero enlaces» (SCRUM-351).
//
// **Ninguno de los dos se equivocaba.** Contestan a preguntas DISTINTAS, y además se midieron
// sobre poblaciones distintas. Pero eso no estaba escrito en ningún sitio, así que la siguiente
// sesión que leyera los dos tenía que elegir cuál creer — y elegir no es medir.
//
// Lo que este fichero añade no es un tercer número: es **la obligación de que los dos se puedan
// EXPLICAR**. Difieran o no.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// QUÉ CUENTA CADA UNO — y son preguntas ortogonales, no dos intentos de lo mismo
//
//   TOPOLOGÍA (351) → IDENTIDAD.  ¿A qué directorio REAL llega este árbol, y quién más llega al
//                                 mismo? Se responde con `realpath`. NO mira lo que hay dentro.
//   DESFASE   (471) → CONTENIDO.  ¿Lo instalado coincide con lo que pide SU `package-lock.json`?
//                                 Se responde leyendo versiones. NO mira por dónde llega.
//
// Un árbol puede estar al día y compartido, o aislado y desfasado: las cuatro combinaciones son
// posibles y ninguna es contradictoria.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL INVARIANTE QUE SÍ LOS ATA, Y ES EL QUE DECIDE
//
// Dos árboles que la topología pone en el MISMO grupo comparten el directorio **físicamente**:
// es el mismo `node_modules`. Entonces el veredicto de contenido de los dos **tiene que salir
// igual**… salvo que sus `package-lock.json` no exijan lo mismo, porque el directorio es uno pero
// la vara de medir es de cada árbol.
//
//   · veredictos distintos + exigencias distintas → **EXPLICADA**. Los dos aciertan, y el informe
//     dice cuál cuenta qué.
//   · veredictos distintos + exigencias IGUALES   → 🔴 **SIN EXPLICAR**. Uno miente. Es
//     exactamente el resultado que este ticket existe para no dejar pasar en silencio.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL SUELO
//
// «Cero» y «no supe mirar» nunca son el mismo número, y aquí hay DOS formas de quedarse ciego —
// una por censo—. Un árbol que la topología resuelve pero cuyo lock no aparece **no es un árbol
// al día**: es un árbol que el censo de contenido no ha podido mirar, y el informe lo dice con
// ese nombre. Con población vacía no se reconcilia nada: se declara ciego y punto.
//
// 🔴 Y NO SE ESCRIBE NINGÚN RECUENTO ESPERADO. Exigir «cuatro árboles» aquí sería plantar la
// premisa falsa del mes que viene — literalmente el defecto del que nace este ticket. Lo que se
// exige es que el número sea > 0 y que el árbol donde corre la suite esté dentro (control
// positivo derivado, no literal).
import fs from 'node:fs';
import path from 'node:path';
import { topologia } from '../scripts/topologia-node-modules.mjs';
import { diagnosticar, exigidasPorElLock } from './_desfase-node-modules.mjs';

/** Lo que cada censo cuenta, en una frase. Va DENTRO del aviso: si difieren, se lee ahí mismo. */
export const QUE_CUENTA = {
  topologia:
    'TOPOLOGÍA (SCRUM-351, `npm run topologia`) cuenta ÁRBOLES y los agrupa por el directorio ' +
    '`node_modules` REAL al que llega cada uno (`fs.realpathSync.native`). Contesta IDENTIDAD: ' +
    'quién acaba usando el mismo directorio que quién. NO mira lo que hay dentro.',
  desfase:
    'DESFASE (SCRUM-471, `tests/_desfase-node-modules.mjs`) cuenta, ÁRBOL POR ÁRBOL, si las ' +
    'versiones instaladas coinciden con las que pide SU `package-lock.json`. Contesta CONTENIDO. ' +
    'NO mira por qué camino se llega al directorio.',
};

/** Clave de agrupamiento. En Windows el sistema de ficheros no distingue mayúsculas. */
function clave(rutaReal) {
  return process.platform === 'win32' ? rutaReal.toLowerCase() : rutaReal;
}

/**
 * La vara de medir de UN árbol: qué le exige su lock, normalizado y ordenado.
 *
 * No es el hash del fichero. Dos locks distintos byte a byte pueden exigir exactamente lo mismo
 * a las dependencias directas, y entonces sus veredictos SÍ tienen que coincidir — usar el hash
 * declararía «explicada» una discrepancia que no lo está.
 *
 * @returns {string|null} `null` si no se ha podido leer (ése es el ciego del censo de contenido).
 */
export function exigenciasDe(raiz) {
  const m = exigidasPorElLock(raiz);
  if (m === null) return null;
  return [...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([n, v]) => `${n}@${v}`).join('\n');
}

/** El veredicto de contenido de un árbol, con el ciego separado del «al día». */
function contenidoDe(raiz, diag) {
  const d = diag(raiz);
  if (d.ciego) return { estado: 'ciego', motivo: d.ciego };
  if (!d.faltan.length && !d.distintas.length) return { estado: 'al-dia', miradas: d.miradas };
  return { estado: 'desfasado', faltan: d.faltan, distintas: d.distintas, miradas: d.miradas };
}

function describirContenido(c) {
  if (c.estado === 'ciego') return `NO SE PUDO MIRAR — ${c.motivo}`;
  if (c.estado === 'al-dia') return `al día (${c.miradas} dependencias directas comprobadas)`;
  const trozos = [];
  if (c.faltan.length) trozos.push(`falta ${c.faltan.map((n) => `\`${n}\``).join(', ')}`);
  for (const x of c.distintas.slice(0, 3)) trozos.push(`\`${x.nombre}\` en ${x.tengo} y el lock pide ${x.pide}`);
  return `DESFASADO — ${trozos.join(' · ')}`;
}

function mensajeMismoDestino(grupo, explicada) {
  const l = [
    explicada
      ? '⚠️ LOS DOS CENSOS DIFIEREN SOBRE ESTOS ÁRBOLES, Y LA DIFERENCIA SE EXPLICA:'
      : '🔴 LOS DOS CENSOS DIFIEREN SOBRE ESTOS ÁRBOLES Y NO SE PUEDE EXPLICAR:',
    '',
    `   destino real compartido → ${grupo.real}`,
    '',
  ];
  for (const f of grupo.filas) {
    l.push(`   · ${f.raiz}`);
    l.push(`        TOPOLOGÍA → ${f.topologia.via}, mismo destino que los demás de este grupo`);
    l.push(`        DESFASE   → ${describirContenido(f.contenido)}`);
  }
  l.push('', `   ${QUE_CUENTA.topologia}`, '', `   ${QUE_CUENTA.desfase}`, '');
  l.push(
    explicada
      ? '   POR QUÉ DIFIEREN: llegan al MISMO directorio, pero sus `package-lock.json` no exigen lo\n' +
        '   mismo. El directorio es uno; la vara de medir es de cada árbol. Los dos aciertan.'
      : '   🔴 SIN EXPLICACIÓN: llegan al mismo directorio Y exigen lo mismo, así que el veredicto de\n' +
        '   contenido TIENE que coincidir. Uno de los dos instrumentos está mintiendo sobre este\n' +
        '   grupo, y «difieren y no sé por qué» es justo lo que este comprobador existe para no dejar.',
  );
  return l.join('\n');
}

function mensajeAlcance(soloTopologia, soloDesfase) {
  const l = ['⚠️ LOS DOS CENSOS NO HAN PODIDO CONTAR LOS MISMOS ÁRBOLES:', ''];
  for (const f of soloTopologia) {
    l.push(`   · ${f.raiz}`);
    l.push('        TOPOLOGÍA → lo cuenta');
    l.push(`        DESFASE   → CIEGO: ${f.contenido.motivo}`);
  }
  for (const f of soloDesfase) {
    l.push(`   · ${f.raiz}`);
    l.push(`        TOPOLOGÍA → CIEGO: ${f.topologia.motivo}`);
    l.push('        DESFASE   → lo cuenta');
  }
  l.push('', `   ${QUE_CUENTA.topologia}`, '', `   ${QUE_CUENTA.desfase}`, '');
  l.push(
    '   POR QUÉ DIFIEREN LOS TOTALES: no es que uno se deje árboles, es que las dos preguntas\n' +
      '   necesitan cosas distintas para poder contestarse — una necesita resolver la ruta, la otra\n' +
      '   necesita un `package-lock.json`. Un árbol que solo cuenta uno de los dos NO está «bien»:\n' +
      '   está a medio medir, y el total de cada censo se lee sabiendo eso.',
  );
  return l.join('\n');
}

/**
 * Los dos censos sobre la MISMA población, y la explicación de en qué difieren.
 *
 * @param {{raices?: string[], cwd?: string, censoTopologia?: Function, censoDesfase?: Function}} o
 *        `censoTopologia` / `censoDesfase` existen SOLO para poder provocar el rojo del detector:
 *        el caso «mismo directorio, mismas exigencias, veredictos distintos» es físicamente
 *        imposible de montar con directorios de verdad, así que sin inyección esa rama no la
 *        ejercitaría nadie y sería verde permanente (SCRUM-351 se llevó ese susto con su suelo).
 * @returns {{ok:false, motivo:string} | {ok:true, filas, grupos, discrepancias, sinExplicar,
 *           contados:{topologia:number,desfase:number}, ciegos:{topologia,desfase}}}
 */
export function reconciliar({ raices, cwd = process.cwd(), censoTopologia = topologia, censoDesfase = diagnosticar } = {}) {
  const t = censoTopologia(raices ? { raices } : { cwd });
  if (!t.ok) return { ok: false, motivo: t.motivo };
  // Un censo que devuelve cero no ha dicho «no hay nada»: no ha sabido mirar. Aquí se corta.
  if (!t.arboles || t.arboles.length === 0) {
    return { ok: false, motivo: 'la topología no ha devuelto ni un árbol que reconciliar' };
  }

  const filas = t.arboles.map((a) => ({
    raiz: a.raiz,
    topologia: a.ciego ? { estado: 'ciego', motivo: a.ciego } : { estado: 'visto', via: a.via, real: a.real },
    contenido: contenidoDe(a.raiz, censoDesfase),
    exigencias: exigenciasDe(a.raiz),
  }));

  const grupos = new Map();
  for (const f of filas) {
    if (f.topologia.estado !== 'visto' || !f.topologia.real) continue;
    const k = clave(f.topologia.real);
    if (!grupos.has(k)) grupos.set(k, { real: f.topologia.real, filas: [] });
    grupos.get(k).filas.push(f);
  }

  const discrepancias = [];

  // ① El invariante fuerte: mismo directorio ⇒ mismo veredicto, salvo que las exigencias difieran.
  for (const g of grupos.values()) {
    if (g.filas.length < 2) continue;
    const estados = new Set(g.filas.map((f) => f.contenido.estado));
    if (estados.size === 1) continue;
    const exigencias = new Set(g.filas.map((f) => f.exigencias));
    const explicada = exigencias.size > 1;
    discrepancias.push({
      tipo: 'mismo-destino-veredictos-distintos',
      explicada,
      real: g.real,
      raices: g.filas.map((f) => f.raiz),
      mensaje: mensajeMismoDestino(g, explicada),
    });
  }

  // ② El alcance: un árbol que solo uno de los dos ha sabido contar. Legítimo, pero se DICE.
  const soloTopologia = filas.filter((f) => f.topologia.estado === 'visto' && f.contenido.estado === 'ciego');
  const soloDesfase = filas.filter((f) => f.topologia.estado === 'ciego' && f.contenido.estado !== 'ciego');
  if (soloTopologia.length || soloDesfase.length) {
    discrepancias.push({
      tipo: 'alcance-distinto',
      explicada: true,
      raices: [...soloTopologia, ...soloDesfase].map((f) => f.raiz),
      mensaje: mensajeAlcance(soloTopologia, soloDesfase),
    });
  }

  return {
    ok: true,
    filas,
    grupos: [...grupos.values()],
    discrepancias,
    sinExplicar: discrepancias.filter((d) => !d.explicada),
    contados: {
      topologia: filas.filter((f) => f.topologia.estado === 'visto').length,
      desfase: filas.filter((f) => f.contenido.estado !== 'ciego').length,
    },
    ciegos: {
      topologia: filas.filter((f) => f.topologia.estado === 'ciego'),
      desfase: filas.filter((f) => f.contenido.estado === 'ciego'),
    },
  };
}

/** El informe en palabras. Nunca dice «reconciliado» sobre un conjunto que no ha sabido mirar. */
export function informe(r) {
  if (!r.ok) {
    return [
      '',
      '🔴 NO SUPE MIRAR: no se puede reconciliar nada.',
      '',
      `   ${r.motivo}.`,
      '',
      '   Esto NO es «los dos censos coinciden». Un fallo de lectura contado como acuerdo es el',
      '   mismo cambiazo que los dos instrumentos que esto reconcilia vinieron a matar.',
      '',
    ].join('\n');
  }

  const l = ['', 'RECONCILIACIÓN DE LOS DOS CENSOS DE `node_modules` (SCRUM-476)', ''];
  l.push(`Población: ${r.filas.length} árbol(es) — la MISMA lista para los dos censos.`);
  l.push(`   TOPOLOGÍA contó ${r.contados.topologia} · DESFASE contó ${r.contados.desfase}`);
  l.push('');
  for (const f of r.filas) {
    l.push(`   · ${f.raiz}`);
    l.push(`        TOPOLOGÍA → ${f.topologia.estado === 'ciego' ? `NO SE PUDO MIRAR — ${f.topologia.motivo}` : `${f.topologia.via}${f.topologia.real ? ` → ${f.topologia.real}` : ''}`}`);
    l.push(`        DESFASE   → ${describirContenido(f.contenido)}`);
  }
  l.push('');

  for (const d of r.discrepancias) l.push(d.mensaje, '');

  if (r.sinExplicar.length) {
    l.push(`🔴 ${r.sinExplicar.length} discrepancia(s) SIN EXPLICAR. No se cierra así.`);
  } else if (r.ciegos.topologia.length || r.ciegos.desfase.length) {
    l.push('⚠️ Entre lo que SÍ se ha podido medir, los dos censos son coherentes o su diferencia');
    l.push('   está explicada arriba. Esto NO es «todo cuadra»: falta(n) árboles por medir.');
  } else {
    l.push('✔ RECONCILIADOS: los dos censos han contado la misma población y todo lo que difiere');
    l.push('   está explicado por lo que cada uno cuenta.');
  }
  l.push('');
  return l.join('\n');
}

/**
 * El censo de HOY sobre este disco, derivado. Es lo que sustituye a un número escrito a mano:
 * un puntero al método no caduca, un recuento sí.
 */
export function censoDeDirectoriosNodeModules(raices) {
  let total = 0;
  let enlaces = 0;
  const ilegibles = [];
  const visitar = (dir, prof) => {
    let entradas;
    try {
      entradas = fs.readdirSync(dir, { withFileTypes: true });
    } catch (err) {
      if (err.code !== 'ENOENT') ilegibles.push(`${dir}: ${err.code || err.message}`);
      return;
    }
    for (const e of entradas) {
      if (!e.isDirectory() && !e.isSymbolicLink()) continue;
      const p = path.join(dir, e.name);
      let st;
      try {
        st = fs.lstatSync(p);
      } catch (err) {
        ilegibles.push(`${p}: ${err.code || err.message}`);
        continue;
      }
      if (st.isSymbolicLink()) enlaces++;
      if (e.name === 'node_modules') total++;
      if (prof < 12) visitar(p, prof + 1);
    }
  };
  for (const r of raices) visitar(r, 0);
  return { directoriosNodeModules: total, enlaces, ilegibles };
}
