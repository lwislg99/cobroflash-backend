// ═════════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-525d · «¿El ancla apunta a lo que dice?» — el criterio, en un solo sitio.
//
// EL PROBLEMA QUE RESUELVE, dicho antes que el código:
// una coordenada `fichero.ts:NN` que RESUELVE (el fichero existe, la línea está dentro) puede
// apuntar perfectamente a otra cosa. Y entonces es PEOR que una rota: la rota se ve, y ésta se
// lee coherente y se cree. Medido en SCRUM-525b sobre la auditoría fiscal: 44 coordenadas
// resolvían, y 15 apuntaban a otro sitio. `prisma/schema.prisma:102-103` afirmaba
// `vf_hash`/`vf_prev_hash` y caía en un comentario sobre husos horarios, a 763 líneas.
//
// 🔴 POR QUÉ HACE FALTA UN TESTIGO ESCRITO, y no se puede deducir:
// para saber si una coordenada apunta a lo que dice hay que saber QUÉ dice, y eso vive en la
// prosa. Deducirlo es adivinar la intención de la frase — y adivinarla es exactamente lo que
// produjo un verde falso en SCRUM-525b (se declaró el token `emisor` para una fila que afirmaba
// «certificado de evidencias», y pasó por buena). Así que el testigo NO se infiere: se EXIGE
// escrito, con la notación que la propia auditoría ya usaba antes de este guard:
//
//     `src/modules/invoicing/domain/selladoEstado.ts:116` (`sellarTrasEmision`)
//      └─────────────── coordenada ───────────────┘        └───── testigo ─────┘
//
// El guard no inventa convención: hace cumplir la que hay.
//
// LO QUE ESTE CRITERIO **NO** HACE, y conviene que conste:
//   · No juzga si el testigo es el CORRECTO para la afirmación. Un testigo presente pero mal
//     elegido pasa. Eso es criterio del fundador, y él se lo reservó explícitamente.
//   · No ve las coordenadas SIN testigo más allá de comprobar que resuelven. Por eso el censo
//     declara SIEMPRE las dos cifras — cuántas coordenadas hay y cuántas llevan testigo —: decir
//     «0 desfasadas» sin decir «de cuántas comprobadas» es una frase, no una medida.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';

/** Dónde se mira. Se empieza por donde un ancla equivocada es más cara (reglas 38 y 40). */
export const POBLACION = 'docs/legal';

const EXT = '(?:ts|tsx|mjs|cjs|js|md|yml|yaml|sql|json|prisma)';
/** `ruta/fichero.ext:NN` o `:NN-MM`, siempre entre backticks. */
const RE_LARGA = new RegExp('`([\\w./-]+\\.' + EXT + '):(\\d+)(?:-(\\d+))?`', 'g');
/** `:NN` a secas — la forma abreviada que usa la auditoría para una segunda cita del MISMO fichero. */
const RE_CORTA = /`:(\d+)(?:-(\d+))?`/g;
/** Un paréntesis que contiene al menos un `token` entre backticks. Ése es el testigo. */
const RE_TESTIGO = /\(([^()]*`[^`]+`[^()]*)\)/g;
/** Texto tachado. Una coordenada tachada está DECLARADA muerta por su propia tipografía. */
const RE_TACHADO = /~~[\s\S]*?~~/g;

const lineaDe = (txt, i) => txt.slice(0, i).split('\n').length;

/**
 * Saca de un markdown sus coordenadas, cada una con su testigo si lo lleva.
 *
 * Se recorre el texto ENTERO por desplazamiento, no línea a línea, por dos motivos medidos:
 * un tachado puede abrir en una línea y cerrar en la siguiente, y una coordenada abreviada
 * (`:236`) hereda el fichero de la coordenada larga que la precede.
 */
export function coordenadasDe(txt) {
  const tachados = [...txt.matchAll(RE_TACHADO)].map((m) => [m.index, m.index + m[0].length]);
  const estaTachada = (i) => tachados.some(([a, b]) => i >= a && i < b);

  const marcas = [];
  for (const m of txt.matchAll(RE_LARGA)) marcas.push({ tipo: 'larga', i: m.index, ruta: m[1], a: +m[2], b: +(m[3] || m[2]) });
  for (const m of txt.matchAll(RE_CORTA)) marcas.push({ tipo: 'corta', i: m.index, a: +m[1], b: +(m[2] || m[1]) });
  for (const m of txt.matchAll(RE_TESTIGO)) {
    // 🔴 UN TESTIGO NO PUEDE SER UNA COORDENADA. Medido: en `PREGUNTAS_ASESOR.md` hay paréntesis
    // que contienen `` `:229` `` —otra cita, no un símbolo— y se estaban contando como testigo.
    // Eso regala cobertura: la coordenada quedaba «comprobada» contra un número de línea.
    const tokens = [...m[1].matchAll(/`([^`]+)`/g)].map((t) => t[1])
      .filter((t) => !/^:\d/.test(t) && !new RegExp('^[\\w./-]+\\.' + EXT + ':\\d').test(t));
    if (tokens.length) marcas.push({ tipo: 'testigo', i: m.index, tokens });
  }
  marcas.sort((x, y) => x.i - y.i);

  const fuera = [];
  let ultimaRuta = null;
  let pendientes = [];
  let lineaAbierta = -1;
  const cerrar = () => { fuera.push(...pendientes); pendientes = []; };

  for (const m of marcas) {
    const linea = lineaDe(txt, m.i);
    // El testigo sólo alcanza a coordenadas de SU misma línea: un paréntesis de dos párrafos más
    // abajo no testifica nada, y dejarlo alcanzar sería regalar cobertura.
    if (linea !== lineaAbierta) { cerrar(); lineaAbierta = linea; ultimaRuta = null; }

    if (m.tipo === 'testigo') {
      for (const c of pendientes) if (!c.testigo) c.testigo = m.tokens;
      cerrar();
      continue;
    }
    if (m.tipo === 'larga') ultimaRuta = m.ruta;
    const ruta = m.tipo === 'larga' ? m.ruta : ultimaRuta;
    // 🔴 MEDIDO: un `:NN` sólo hereda de una coordenada de SU MISMA LÍNEA. Al dejar que la
    // herencia cruzara líneas, una tabla de `PREGUNTAS_ASESOR.md` cuyas filas son `` `:377` ``
    // —líneas de OTRO fichero— se colgó de un `src/core/flags.ts` de dos líneas más arriba, y
    // salieron cinco «fuera de rango» que no existían. Eran mías, no del árbol.
    if (!ruta) continue; // un `:NN` suelto sin fichero delante no es una coordenada
    pendientes.push({ ruta, a: m.a, b: m.b, linea, testigo: null, tachada: estaTachada(m.i) });
  }
  cerrar();
  return fuera;
}

/** `ruta:NN` o `ruta:NN-MM` — la IDENTIDAD de una coordenada. Nunca su número de línea en el doc. */
export const identidad = (c) => `${c.ruta}:${c.a}${c.b !== c.a ? `-${c.b}` : ''}`;

/**
 * Veredicto de UNA coordenada contra el árbol.
 *   SIN_RUTA · la cita da sólo el basename, sin ruta      ← no resuelve por diseño, no por rotura
 *   AUSENTE  · el fichero citado no existe
 *   FUERA    · la línea no está dentro del fichero        ← lo que un guard de «resuelve» ya veía
 *   SIN      · resuelve, pero no lleva testigo             ← no se puede comprobar, se declara
 *   DESFASADA· lleva testigo y el testigo NO está ahí      ← lo que este guard añade
 *   FIRME    · lleva testigo y el testigo está ahí
 */
export function veredictoDe(c, raiz, cache = new Map()) {
  // 🔴 Una cita por basename (`flags.ts:16`, sin ruta) NO es un fichero que falta: es una cita que
  // hoy resuelve por SUERTE, porque ningún basename está repetido. El día que haya dos `flags.ts`
  // deja de ser coordenada y pasa a ser pista. Se cuenta aparte — llamarla AUSENTE sería decir que
  // el fichero no existe, que es falso, y mandaría a quien lo lea a buscar lo que no falta.
  if (!c.ruta.includes('/')) return { ...c, estado: 'SIN_RUTA' };
  const abs = path.join(raiz, c.ruta);
  if (!cache.has(c.ruta)) cache.set(c.ruta, fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8').split(/\r?\n/) : null);
  const L = cache.get(c.ruta);
  if (!L) return { ...c, estado: 'AUSENTE' };
  if (c.b > L.length) return { ...c, estado: 'FUERA', tiene: L.length };
  if (!c.testigo) return { ...c, estado: 'SIN' };
  const trozo = L.slice(c.a - 1, c.b).join('\n');
  const faltan = c.testigo.filter((t) => !trozo.includes(t));
  if (!faltan.length) return { ...c, estado: 'FIRME' };
  // Dónde está hoy, para que el rojo diga a dónde ir y no sólo que algo va mal.
  const donde = {};
  for (const t of faltan) {
    const n = [];
    L.forEach((l, i) => { if (l.includes(t) && n.length < 4) n.push(i + 1); });
    donde[t] = n;
  }
  return { ...c, estado: 'DESFASADA', faltan, donde };
}

/** Los `.md` de la población, en orden estable. */
export function ficherosDe(raiz) {
  const dir = path.join(raiz, POBLACION);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort()
    .map((f) => `${POBLACION}/${f}`);
}

/** El censo entero. Devuelve TODAS las cifras: quien lea sólo una, que sepa que hay más. */
export function analizar(raiz, ficheros = ficherosDe(raiz)) {
  const cache = new Map();
  const todas = [];
  for (const rel of ficheros) {
    const txt = fs.readFileSync(path.join(raiz, rel), 'utf8');
    for (const c of coordenadasDe(txt)) todas.push({ ...c, doc: rel });
  }
  const vivas = todas.filter((c) => !c.tachada);
  const juzgadas = vivas.map((c) => veredictoDe(c, raiz, cache));
  const de = (e) => juzgadas.filter((c) => c.estado === e);
  return {
    ficheros,
    total: todas.length,
    tachadas: todas.filter((c) => c.tachada).length,
    vivas: vivas.length,
    conTestigo: vivas.filter((c) => c.testigo).length,
    firmes: de('FIRME'),
    desfasadas: de('DESFASADA'),
    sinTestigo: de('SIN'),
    sinRuta: de('SIN_RUTA'),
    noResuelven: [...de('AUSENTE'), ...de('FUERA')],
    juzgadas,
  };
}

/** Las dos cifras, siempre juntas. */
export const dosCifras = (r) => `${r.vivas} coordenadas vivas · ${r.conTestigo} con testigo`;
