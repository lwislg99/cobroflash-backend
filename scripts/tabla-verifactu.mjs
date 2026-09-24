// scripts/tabla-verifactu.mjs — SCRUM-524b · LA TABLA DE COMPROBACIÓN, CALCULADA CADA VEZ.
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// POR QUÉ EXISTE
//
// El 17-sep-2026 SCRUM-524 publicó una tabla: cuántas de las 41 restricciones del catálogo
// oficial de VERI*FACTU comprueba el árbol. Era un DOCUMENTO: si nadie la vuelve a medir, en un
// mes es un acta fechada que describe un árbol que ya no existe — el defecto de SCRUM-927.
//
// Esto la convierte en una cifra que el repo calcula solo. Las anclas de cada código viven en
// `_tabla-verifactu-catalogo.mjs`; aquí se MIDEN contra `src/` por AST, y
// `tests/scrum524b-trinquete-de-la-tabla.test.mjs` impide que la cifra baje.
//
// ── QUÉ NO HACE ────────────────────────────────────────────────────────────────────────────────
// No arregla nada, no escribe nada y no toca el camino de emisión: LEE `src/` (regla 38). No
// habla con ningún cliente (regla 26). No inventa estados (regla 27).
//
// ── LAS TRES SALIDAS, Y POR QUÉ SON TRES ───────────────────────────────────────────────────────
//   0 · todas las comprobadas siguen vivas y todas las ausencias declaradas siguen ausentes
//   1 · algo se ha ROTO — y se nombra: qué código, qué ancla, qué falta
//   2 · CIEGO — no hay `src/`, no encuentra NINGUNA de las comprobadas o no ve el canario.
//       Un «0 comprobadas» por no haber mirado y uno medido son la misma frase con consecuencias
//       opuestas, y aquí la consecuencia es un incumplimiento tributario.
//
// Uso:  node scripts/tabla-verifactu.mjs [--raiz <dir>] [--json]
// ═════════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { ejecutadoDirectamente } from './_puerta-de-entrada.mjs';
import {
  FUENTE, POBLACION, CATEGORIAS, CLASES_NO_COMPROBADA, CANARIO_AUSENCIA, CATALOGO, FUERA_DEL_CATALOGO,
} from './_tabla-verifactu-catalogo.mjs';

export const RAIZ_REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ── EL CATÁLOGO, ANTES QUE NADA ────────────────────────────────────────────────────────────────

/**
 * Lo que tiene que cumplir el catálogo para que la cifra signifique algo. Devuelve la lista de
 * problemas; vacía es sano. Compara CONJUNTOS, no cuentas: 41 entradas con una repetida y una que
 * falta también suman 41.
 */
export function validarCatalogo(catalogo = CATALOGO, poblacion = POBLACION) {
  const problemas = [];
  const codigos = catalogo.map((e) => e.codigo);
  const repetidos = codigos.filter((c, i) => codigos.indexOf(c) !== i);
  if (repetidos.length) problemas.push(`códigos repetidos en el catálogo: ${[...new Set(repetidos)].join(', ')}`);
  if (new Set(poblacion).size !== poblacion.length) problemas.push('la POBLACIÓN declarada tiene códigos repetidos');
  const faltan = poblacion.filter((c) => !codigos.includes(c));
  const sobran = codigos.filter((c) => !poblacion.includes(c));
  if (faltan.length) problemas.push(`de la población, sin entrada en el catálogo: ${faltan.join(', ')}`);
  if (sobran.length) problemas.push(`en el catálogo y fuera de la población del ticket: ${sobran.join(', ')}`);
  for (const e of catalogo) {
    if (!CATEGORIAS.includes(e.categoria)) problemas.push(`${e.codigo}: categoría desconocida «${e.categoria}»`);
    if (e.categoria === 'comprobada' && !(e.anclas?.length)) problemas.push(`${e.codigo}: comprobada SIN anclas`);
    if (e.categoria !== 'comprobada' && e.anclas) problemas.push(`${e.codigo}: tiene anclas y no es comprobada`);
    if (e.categoria === 'no-comprobada') {
      if (!CLASES_NO_COMPROBADA[e.clase]) problemas.push(`${e.codigo}: no comprobada sin clase válida`);
      if (!e.porque) problemas.push(`${e.codigo}: no comprobada sin su porqué`);
      if (e.clase === 'por-ausencia' && !e.ausente) problemas.push(`${e.codigo}: por ausencia, pero no dice de qué`);
    }
    if (e.categoria === 'fuera-de-alcance' && !e.motivo) problemas.push(`${e.codigo}: fuera de alcance SIN motivo`);
  }
  return problemas;
}

// ── EL AST ─────────────────────────────────────────────────────────────────────────────────────

const LITERALES = new Set([
  ts.SyntaxKind.StringLiteral, ts.SyntaxKind.NoSubstitutionTemplateLiteral,
  ts.SyntaxKind.TemplateHead, ts.SyntaxKind.TemplateMiddle, ts.SyntaxKind.TemplateTail,
]);

function desenvolver(n) {
  while (n && (ts.isParenthesizedExpression(n) || ts.isAsExpression(n) || ts.isTypeAssertionExpression(n)
    || ts.isNonNullExpression(n) || (ts.isSatisfiesExpression && ts.isSatisfiesExpression(n)))) n = n.expression;
  return n;
}

/** El texto de un nodo sin espacios: que un reformateo no rompa un ancla. */
const norm = (n, sf) => n.getText(sf).replace(/\s+/g, '');

function descendientes(raiz, fn) {
  const visitar = (n) => { fn(n); ts.forEachChild(n, visitar); };
  ts.forEachChild(raiz, visitar);
}

function nombreDeDeclaracion(n) {
  if ((ts.isFunctionDeclaration(n) || ts.isMethodDeclaration(n)) && n.name) return n.name.getText();
  if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer
    && (ts.isArrowFunction(desenvolver(n.initializer)) || ts.isFunctionExpression(desenvolver(n.initializer)))) {
    return n.name.text;
  }
  return null;
}

/** El ámbito por NOMBRE, y tiene que ser único: una identidad que casa con dos no es una identidad. */
function ambito(sf, nombre) {
  if (!nombre) return { nodo: sf };
  const hallados = [];
  descendientes(sf, (n) => { if (nombreDeDeclaracion(n) === nombre) hallados.push(n); });
  if (hallados.length === 0) return { error: `no encuentro el ámbito «${nombre}»` };
  if (hallados.length > 1) return { error: `el ámbito «${nombre}» es ambiguo (${hallados.length})` };
  return { nodo: hallados[0] };
}

function dentroDe(nodo, ancestro) {
  for (let p = nodo; p; p = p.parent) if (p === ancestro) return true;
  return false;
}

function nombreLlamado(call) {
  const e = desenvolver(call.expression);
  if (ts.isIdentifier(e)) return e.text;
  if (ts.isPropertyAccessExpression(e)) return e.name.text;
  return null;
}

function valorLiteral(n) {
  n = desenvolver(n);
  if (!n) return undefined;
  if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) return n.text;
  if (ts.isNumericLiteral(n)) return Number(n.text.replace(/_/g, ''));
  return undefined;
}

function textosLiterales(nodo) {
  const textos = [];
  const mirar = (n) => { if (LITERALES.has(n.kind)) textos.push({ nodo: n, texto: n.text }); };
  mirar(nodo);
  descendientes(nodo, mirar);
  return textos;
}

function asignadoA(n) {
  let p = n.parent;
  while (p && ts.isParenthesizedExpression(p)) p = p.parent;
  return p && ts.isVariableDeclaration(p) && ts.isIdentifier(p.name) ? p.name.text : null;
}

const CONDICIONANTES = (n) => ts.isConditionalExpression(n) || ts.isIfStatement(n)
  || (ts.isBinaryExpression(n) && [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken,
    ts.SyntaxKind.QuestionQuestionToken].includes(n.operatorToken.kind));

// ── LOS TIPOS DE ANCLA ─────────────────────────────────────────────────────────────────────────
// Cada uno devuelve `null` si el ancla se cumple, o el MOTIVO por el que no. El motivo es lo que
// el trinquete imprime al caer: tiene que decir qué falta, no sólo que algo falla.

const TIPOS = {
  constante(a, sf) {
    const decl = [];
    descendientes(sf, (n) => { if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === a.nombre) decl.push(n); });
    if (decl.length !== 1) return `la constante «${a.nombre}» aparece ${decl.length} veces (se esperaba 1)`;
    const ini = desenvolver(decl[0].initializer);
    if ('valor' in a) {
      const v = valorLiteral(ini);
      return v === a.valor ? null : `«${a.nombre}» vale ${JSON.stringify(v)}, no ${JSON.stringify(a.valor)}`;
    }
    let elems = null;
    if (ini && ts.isArrayLiteralExpression(ini)) elems = ini.elements;
    else if (ini && ts.isNewExpression(ini) && ini.expression.getText(sf) === 'Set'
      && ini.arguments?.[0] && ts.isArrayLiteralExpression(desenvolver(ini.arguments[0]))) {
      elems = desenvolver(ini.arguments[0]).elements;
    }
    if (!elems) return `«${a.nombre}» no es una lista literal`;
    const valores = elems.map(valorLiteral);
    if (a.contiene) {
      const faltan = a.contiene.filter((x) => !valores.includes(x));
      return faltan.length ? `a «${a.nombre}» le faltan ${JSON.stringify(faltan)}` : null;
    }
    const iguales = valores.length === a.exactamente.length && a.exactamente.every((x) => valores.includes(x));
    return iguales ? null : `«${a.nombre}» es ${JSON.stringify(valores)}, no ${JSON.stringify(a.exactamente)}`;
  },

  referencia(a, sf, esc) {
    let n = 0;
    descendientes(esc, (x) => {
      if (ts.isIdentifier(x) && x.text === a.identificador
        && !(x.parent && (ts.isVariableDeclaration(x.parent) || ts.isFunctionDeclaration(x.parent)) && x.parent.name === x)) n++;
    });
    return n ? null : `«${a.dentroDe}» ya no usa «${a.identificador}»`;
  },

  llamada(a, sf, esc) {
    const hallada = [];
    descendientes(esc, (x) => { if (ts.isCallExpression(x) && nombreLlamado(x) === a.llamada) hallada.push(x); });
    if (!hallada.length) return `no hay ninguna llamada a «${a.llamada}»${a.dentroDe ? ` dentro de «${a.dentroDe}»` : ''}`;
    if (a.primerArgumento && !hallada.some((c) => c.arguments[0] && norm(c.arguments[0], sf) === a.primerArgumento)) {
      return `«${a.llamada}» ya no recibe «${a.primerArgumento}»`;
    }
    return null;
  },

  lanza(a, sf, esc) {
    const throws = [];
    descendientes(esc, (x) => { if (ts.isThrowStatement(x)) throws.push(x); });
    if (!throws.length) return `«${a.dentroDe}» ya no lanza nada`;
    const cumple = throws.some((t) => {
      if (a.mensaje) {
        const lits = textosLiterales(t.expression).map((l) => l.texto);
        if (!lits.includes(a.mensaje)) return false;
      }
      if (!a.cuando) return true;
      for (let p = t.parent; p && p !== esc.parent; p = p.parent) {
        if (!ts.isIfStatement(p) || !dentroDe(t, p.thenStatement)) continue;
        let casa = norm(p.expression, sf) === a.cuando;
        descendientes(p.expression, (y) => { if (!casa && norm(y, sf) === a.cuando) casa = true; });
        if (casa) return true;
      }
      return false;
    });
    return cumple ? null
      : `«${a.dentroDe}» ya no lanza cuando «${a.cuando ?? ''}»${a.mensaje ? ` con «${a.mensaje}»` : ''}`;
  },

  condicional(a, sf, esc) {
    const cands = [];
    descendientes(esc, (x) => { if (ts.isConditionalExpression(x) && norm(x.condition, sf) === a.condicion) cands.push(x); });
    const donde = a.asignadaA ? ` asignada a «${a.asignadaA}»` : '';
    if (!cands.length) return `no hay ninguna condición «${a.condicion} ? … : …»${donde}`;
    const ok = cands.some((c) => {
      if (a.asignadaA && asignadoA(c) !== a.asignadaA) return false;
      if (a.siVerdad?.llamada) {
        const v = desenvolver(c.whenTrue);
        if (!(ts.isCallExpression(v) && nombreLlamado(v) === a.siVerdad.llamada)) return false;
      }
      if (a.siVerdad?.contiene && !textosLiterales(c.whenTrue).some((l) => l.texto.includes(a.siVerdad.contiene))) return false;
      if (a.siFalso && norm(c.whenFalse, sf) !== a.siFalso) return false;
      return true;
    });
    if (ok) return null;
    const que = a.siVerdad?.llamada ? `llama a «${a.siVerdad.llamada}»`
      : a.siVerdad?.contiene ? `escribe «${a.siVerdad.contiene}»` : a.siFalso ? `da «${a.siFalso}» en el otro lado` : 'está donde estaba';
    return `la condición «${a.condicion}»${donde} ya no ${que}`;
  },

  declaracion(a, sf, esc) {
    const decl = [];
    descendientes(esc, (x) => { if (ts.isVariableDeclaration(x) && ts.isIdentifier(x.name) && x.name.text === a.nombre) decl.push(x); });
    if (!decl.length) return `no se declara «${a.nombre}» dentro de «${a.dentroDe}»`;
    return decl.some((d) => d.initializer && norm(d.initializer, sf) === a.valor) ? null
      : `«${a.nombre}» ya no es «${a.valor}» (es «${decl[0].initializer ? norm(decl[0].initializer, sf) : '—'}»)`;
  },

  expresion(a, sf, esc) {
    let ok = false;
    descendientes(esc, (x) => {
      if (!ok && (ts.isBinaryExpression(x) || ts.isPrefixUnaryExpression(x)) && norm(x, sf) === a.texto) ok = true;
    });
    return ok ? null : `«${a.dentroDe}» ya no evalúa «${a.texto}»`;
  },

  propiedad(a, sf, esc) {
    const props = [];
    descendientes(esc, (x) => {
      if (ts.isPropertyAssignment(x) && (ts.isIdentifier(x.name) || ts.isStringLiteral(x.name)) && x.name.text === a.nombre) props.push(x);
    });
    if (!props.length) return `«${a.dentroDe}» ya no pone «${a.nombre}»`;
    const casan = props.filter((p) => norm(p.initializer, sf) === a.valor);
    if (a.todas) {
      return casan.length === props.length ? null
        : `en «${a.dentroDe}», ${props.length - casan.length} de ${props.length} «${a.nombre}» no son «${a.valor}»`;
    }
    return casan.length ? null : `en «${a.dentroDe}», «${a.nombre}» ya no es «${a.valor}»`;
  },

  // «si SI está presente en un objeto, ENTONCES esa misma propiedad vale esto» — a diferencia de
  // `propiedad` (que mira cada propiedad del ámbito por separado, sin atarla a sus hermanas), ésta
  // exige que las dos vivan en el MISMO objeto literal. Nace de SCRUM-524b: con una sola rama,
  // «TODAS las `calificacion` del ámbito son S1» y «`cuota` sólo con `calificacion`=S1» eran la
  // misma frase; con dos ramas (S1/S2) dejan de serlo, y la primera es un atajo que ya no expresa
  // la segunda, que es la regla real (código AEAT 1207).
  propiedadLigada(a, sf, esc) {
    const buscaProp = (lit, nombre) => lit.properties.find((p) => ts.isPropertyAssignment(p)
      && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) && p.name.text === nombre);
    const literales = [];
    descendientes(esc, (x) => { if (ts.isObjectLiteralExpression(x)) literales.push(x); });
    const conSi = literales.filter((lit) => buscaProp(lit, a.si));
    if (!conSi.length) return `«${a.dentroDe}» ya no escribe «${a.si}» en ningún objeto`;
    const violacion = conSi.find((lit) => {
      const p = buscaProp(lit, a.entonces.nombre);
      return !p || norm(p.initializer, sf) !== a.entonces.valor;
    });
    return violacion ? `en «${a.dentroDe}», un objeto escribe «${a.si}» sin que «${a.entonces.nombre}» sea «${a.entonces.valor}»`
      : null;
  },

  elementoFijo(a, sf, esc) {
    const abre = `<sum1:${a.elemento}>`;
    const fijo = `${a.valor}</sum1:${a.elemento}>`;
    let total = 0; let fijos = 0;
    for (const { texto } of textosLiterales(esc)) {
      for (let i = texto.indexOf(abre); i !== -1; i = texto.indexOf(abre, i + 1)) {
        total++;
        if (texto.startsWith(fijo, i + abre.length)) fijos++;
      }
    }
    if (!total) return `«${a.dentroDe}» ya no escribe «${abre}»`;
    return fijos === total ? null
      : `en «${a.dentroDe}», ${total - fijos} de ${total} «${abre}» ya no llevan «${a.valor}» fijo`;
  },

  elementoSiempre(a, sf, esc) {
    const abre = `<sum1:${a.elemento}>`;
    const donde = textosLiterales(esc).filter((l) => l.texto.includes(abre));
    if (!donde.length) return `«${a.dentroDe}» ya no escribe «${abre}»`;
    const condicionado = donde.some(({ nodo }) => {
      for (let p = nodo.parent; p && p !== esc; p = p.parent) if (CONDICIONANTES(p)) return true;
      return false;
    });
    return condicionado ? `en «${a.dentroDe}», «${abre}» ya se escribe sólo bajo una condición` : null;
  },
};

// ── EL BARRIDO ─────────────────────────────────────────────────────────────────────────────────

function listarTs(dir) {
  const salida = [];
  const andar = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) andar(p);
      else if (e.isFile() && e.name.endsWith('.ts')) salida.push(p);
    }
  };
  if (fs.existsSync(dir)) andar(dir);
  return salida;
}

function lectorDeDisco(raiz) {
  return (rel) => {
    try { return fs.readFileSync(path.join(raiz, rel), 'utf8'); } catch { return null; }
  };
}

/** Apariciones de `<sum1:E>` / `<sum:E>` en LITERALES de `src/`: un comentario no escribe XML. */
function aparicionesDeElemento(elemento, ficheros, leer, parsear) {
  const marcas = [`<sum1:${elemento}>`, `<sum:${elemento}>`];
  const donde = [];
  for (const rel of ficheros) {
    const texto = leer(rel);
    if (!texto || !texto.includes(elemento)) continue; // filtro barato; decide el AST de abajo
    const sf = parsear(rel);
    if (!sf) continue;
    for (const { nodo, texto: t } of textosLiterales(sf)) {
      if (marcas.some((m) => t.includes(m))) {
        donde.push(`${rel}:${sf.getLineAndCharacterOfPosition(nodo.getStart(sf)).line + 1}`);
      }
    }
  }
  return donde;
}

/**
 * Mide la tabla contra un árbol. `raiz` es la carpeta que contiene `src/`; `leer(rel)` se deja
 * inyectar para medir una COPIA mutada sin tocar el disco.
 */
export function evaluarTabla({ raiz = RAIZ_REPO, leer = null, catalogo = CATALOGO, extras = FUERA_DEL_CATALOGO } = {}) {
  const lector = leer ?? lectorDeDisco(raiz);
  const cache = new Map();
  const parsear = (rel) => {
    if (cache.has(rel)) return cache.get(rel);
    const texto = lector(rel);
    const sf = texto == null ? null : ts.createSourceFile(rel, texto, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    cache.set(rel, sf);
    return sf;
  };

  const evaluarAnclas = (anclas) => anclas.map((ancla) => {
    const sf = parsear(ancla.fichero);
    if (!sf) return { ancla, fallo: `no encuentro ${ancla.fichero}` };
    const esc = ambito(sf, ancla.dentroDe);
    if (esc.error) return { ancla, fallo: `${ancla.fichero}: ${esc.error}` };
    const tipo = TIPOS[ancla.tipo];
    if (!tipo) return { ancla, fallo: `tipo de ancla desconocido «${ancla.tipo}»` };
    const fallo = tipo(ancla, sf, esc.nodo);
    return { ancla, fallo: fallo ? `${ancla.fichero}: ${fallo}` : null };
  });

  const ficherosTs = listarTs(path.join(raiz, 'src')).map((p) => path.relative(raiz, p).split(path.sep).join('/'));
  const ficherosAnclados = [...new Set([...catalogo, ...extras].flatMap((e) => (e.anclas ?? []).map((a) => a.fichero)))];

  const comprobadas = catalogo.filter((e) => e.categoria === 'comprobada').map((e) => {
    const anclas = evaluarAnclas(e.anclas);
    return { codigo: e.codigo, que: e.que, capa: e.capa, hueco: e.hueco ?? null, anclas, viva: anclas.every((x) => !x.fallo) };
  });
  const fuera = extras.map((e) => {
    const anclas = evaluarAnclas(e.anclas);
    return { id: e.id, que: e.que, capa: e.capa, anclas, viva: anclas.every((x) => !x.fallo) };
  });

  const canario = aparicionesDeElemento(CANARIO_AUSENCIA, ficherosTs, lector, parsear);
  const ausencias = catalogo.filter((e) => e.ausente).map((e) => ({
    codigo: e.codigo, elemento: e.ausente, apariciones: aparicionesDeElemento(e.ausente, ficherosTs, lector, parsear),
  }));

  const vivas = comprobadas.filter((c) => c.viva).map((c) => c.codigo);
  const rotas = comprobadas.filter((c) => !c.viva).map((c) => ({ codigo: c.codigo, fallos: c.anclas.filter((x) => x.fallo).map((x) => x.fallo) }));
  const fueraRotas = fuera.filter((c) => !c.viva).map((c) => ({ id: c.id, fallos: c.anclas.filter((x) => x.fallo).map((x) => x.fallo) }));
  const ausenciasRotas = ausencias.filter((a) => a.apariciones.length);

  let ciego = null;
  if (ficherosTs.length === 0) ciego = `no hay ningún .ts bajo ${path.join(raiz, 'src')}`;
  else if (comprobadas.length && vivas.length === 0) ciego = `ninguna de las ${comprobadas.length} comprobadas aparece: el barrido no ve el árbol`;
  else if (canario.length === 0) ciego = `no veo el canario «${CANARIO_AUSENCIA}», así que los ceros de las ausencias no valen nada`;

  return {
    fuente: FUENTE,
    poblacion: {
      declarada: POBLACION.length, catalogadas: catalogo.length, ficherosTs: ficherosTs.length,
      ficherosAnclados: ficherosAnclados.length,
      anclas: comprobadas.reduce((s, c) => s + c.anclas.length, 0) + fuera.reduce((s, c) => s + c.anclas.length, 0),
    },
    catalogoRoto: validarCatalogo(catalogo),
    comprobadas, vivas, rotas,
    noComprobadas: catalogo.filter((e) => e.categoria === 'no-comprobada')
      .map((e) => ({ codigo: e.codigo, que: e.que, clase: e.clase, porque: e.porque, ausente: e.ausente ?? null })),
    fueraDeAlcance: catalogo.filter((e) => e.categoria === 'fuera-de-alcance')
      .map((e) => ({ codigo: e.codigo, que: e.que, motivo: e.motivo })),
    fueraDelCatalogo: fuera, fueraRotas,
    canario: { elemento: CANARIO_AUSENCIA, apariciones: canario.length },
    ausencias, ausenciasRotas,
    ciego,
  };
}

export function codigoDeSalida(r) {
  if (r.ciego) return 2;
  return (r.rotas.length || r.fueraRotas.length || r.ausenciasRotas.length || r.catalogoRoto.length) ? 1 : 0;
}

// ── LA SALIDA: LAS TRES CATEGORÍAS JUNTAS, SIEMPRE ─────────────────────────────────────────────

export function informe(r) {
  const L = [];
  const n = r.poblacion.declarada;
  L.push(`TABLA DE COMPROBACIÓN VERI*FACTU · SCRUM-524 · ${new Date().toISOString()}`);
  L.push(`Población: ${n} códigos · ${r.fuente}`);
  L.push(`Barrido: ${r.poblacion.ficherosTs} ficheros .ts de src/ · ${r.poblacion.anclas} anclas en ${r.poblacion.ficherosAnclados} ficheros`);
  if (r.ciego) {
    L.push('', `⚫ CIEGO — ${r.ciego}.`, 'No hay veredicto: un cero de no haber mirado no se publica.');
    return L.join('\n');
  }
  const conHueco = r.comprobadas.filter((c) => c.viva && c.hueco).length;
  L.push('', `✅ COMPROBADAS · ${r.vivas.length} de ${n}  (${conHueco} con hueco declarado)`);
  for (const c of r.comprobadas) {
    L.push(`   ${c.viva ? '✓' : '✗'} ${c.codigo}  [${c.capa}]  ${c.que}  · ${c.anclas.filter((x) => !x.fallo).length}/${c.anclas.length} anclas`);
    if (c.hueco) L.push(`        hueco: ${c.hueco}`);
    for (const x of c.anclas.filter((y) => y.fallo)) L.push(`        🔴 ${x.fallo}`);
  }
  L.push('', `🔴 NO COMPROBADAS · ${r.noComprobadas.length} de ${n}  (todas cuentan del lado malo)`);
  for (const clase of Object.keys(CLASES_NO_COMPROBADA)) {
    const deEsta = r.noComprobadas.filter((e) => e.clase === clase);
    if (!deEsta.length) continue;
    L.push(`   ${clase} (${deEsta.length}) — ${CLASES_NO_COMPROBADA[clase]}`);
    for (const e of deEsta) L.push(`      ${e.codigo}  ${e.que} — ${e.porque}`);
  }
  L.push('', `⬜ FUERA DE ALCANCE · ${r.fueraDeAlcance.length} de ${n}`);
  for (const e of r.fueraDeAlcance) L.push(`      ${e.codigo}  ${e.que} — ${e.motivo}`);
  const suma = r.comprobadas.length + r.noComprobadas.length + r.fueraDeAlcance.length;
  L.push('', `   ${r.comprobadas.length} + ${r.noComprobadas.length} + ${r.fueraDeAlcance.length} = ${suma} de ${n}`);
  L.push('', `➕ FUERA DEL CATÁLOGO (vigiladas, no cuentan en «de ${n}») · ${r.fueraDelCatalogo.filter((c) => c.viva).length} de ${r.fueraDelCatalogo.length} vivas`);
  for (const c of r.fueraDelCatalogo) {
    L.push(`   ${c.viva ? '✓' : '✗'} ${c.id}  ${c.que}`);
    for (const x of c.anclas.filter((y) => y.fallo)) L.push(`        🔴 ${x.fallo}`);
  }
  L.push('', `Ausencias vigiladas: ${r.ausencias.length} · canario «${r.canario.elemento}»: ${r.canario.apariciones} apariciones`);
  for (const a of r.ausenciasRotas) L.push(`   🔴 ${a.codigo}: «${a.elemento}» YA SE ESCRIBE (${a.apariciones.join(', ')}) — la tabla dice que no; revísala`);
  for (const p of r.catalogoRoto) L.push(`   🔴 catálogo: ${p}`);
  L.push('');
  const s = codigoDeSalida(r);
  L.push(s === 0 ? `VEREDICTO: ${r.vivas.length} de ${n} comprobadas, todas vivas.`
    : `VEREDICTO: ROTO — ${[...r.rotas.map((x) => x.codigo), ...r.fueraRotas.map((x) => x.id)].join(', ') || 'ver arriba'}.`);
  return L.join('\n');
}

if (ejecutadoDirectamente(import.meta.url)) {
  const args = process.argv.slice(2);
  const i = args.indexOf('--raiz');
  const raiz = i !== -1 && args[i + 1] ? path.resolve(args[i + 1]) : RAIZ_REPO;
  const r = evaluarTabla({ raiz });
  if (args.includes('--json')) process.stdout.write(`${JSON.stringify(r, null, 2)}\n`);
  else process.stdout.write(`${informe(r)}\n`);
  process.exitCode = codigoDeSalida(r);
}
