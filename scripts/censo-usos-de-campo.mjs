// scripts/censo-usos-de-campo.mjs — SCRUM-615
//
// ¿QUIÉN LEE UN CAMPO, QUIÉN LO ESCRIBE, Y QUÉ HACE CON EL NULL?
//
//   node scripts/censo-usos-de-campo.mjs tipoDestinatario
//   node scripts/censo-usos-de-campo.mjs providerId        # calibración
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ AST Y NO `grep`
//
// `grep` cuenta APARICIONES; aquí hace falta saber si cada una LEE o ESCRIBE, y eso es una
// propiedad de la POSICIÓN del nodo en el árbol, no del texto. `x.campo = 1` y `if (x.campo)`
// son la misma cadena y cosas opuestas. Un censo de lectores hecho con `grep` mezcla las dos y
// después alguien concluye «lo lee mucha gente» sobre una lista que son todo escrituras.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 LAS GRAFÍAS, QUE ES POR DONDE ESTO YA FALLÓ UNA VEZ
//
// En SCRUM-574 un guard buscaba `/tipoDestinatario/` literal y NO VIO la mezcla real, porque en
// los formularios la variable se llama `fieldTipoDestinatario`, con T mayúscula. El mismo concepto
// vive en el árbol con al menos tres grafías:
//
//     tipo_destinatario        la columna de Postgres
//     tipoDestinatario         el campo del modelo y del `z.enum`
//     fieldTipoDestinatario    la variable del formulario
//
// Así que la comparación es sobre una forma NORMALIZADA (minúsculas, sin guiones bajos) y por
// CONTENCIÓN, no por igualdad. Buscar el nombre exacto es exactamente el error que ya se cometió.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LO QUE NO SABE, LO DICE
//
// Todo uso que no encaje en una regla sale como `NO_CLASIFICADO` y se imprime. Un censo que mete
// lo que no entiende en el cubo grande miente en la dirección cómoda; éste prefiere que se le vea
// el hueco. Y si el total de usos es CERO, lo declara como posible ceguera en vez de como dato.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Dónde se busca. `dist/` NO: es la compilación del mismo código y duplicaría cada hallazgo.
const CARPETAS = ['src', 'public', 'tests', 'scripts', 'prisma'];
const EXT_AST = new Set(['.ts', '.js', '.mjs', '.cjs']);
const EXT_TEXTO = new Set(['.prisma']); // sin AST: se censa por línea y SE DICE

export const LECTURA = 'LECTURA';
export const ESCRITURA = 'ESCRITURA';
export const DECLARACION = 'DECLARACION';
export const NO_CLASIFICADO = 'NO_CLASIFICADO';

/** Minúsculas y sin guiones bajos: `tipo_destinatario`, `tipoDestinatario` y `fieldTipoDestinatario` colapsan. */
export function normalizar(s) {
  return String(s).toLowerCase().replace(/_/g, '');
}

/**
 * ¿El identificador `nombre` se refiere al campo `campo`? Por CONTENCIÓN sobre la forma
 * normalizada — es lo que hace falta para que `fieldTipoDestinatario` cuente.
 */
export function esElCampo(nombre, campo) {
  const n = normalizar(nombre);
  const c = normalizar(campo);
  return n.length > 0 && c.length > 0 && n.includes(c);
}

/**
 * 🔴 UN LITERAL DE CADENA SOLO CUENTA SI ES UN TOKEN, NO UNA FRASE.
 *
 * Medido al calibrar con `providerId`: la contención metía en el censo mensajes de test como
 * «…sin él, el `UPDATE … WHERE provider_id` no actualiza nada» — PROSA que menciona el campo,
 * no un uso de él. Inflaba el total y habría inflado igual el del campo real.
 *
 * La asimetría con los identificadores es deliberada: en un identificador la contención es
 * necesaria (`fieldTipoDestinatario`), pero en una cadena lo que indica uso es que la cadena SEA
 * el nombre —`'tipo_destinatario'` en una consulta o en una lista de columnas—, no que lo
 * mencione. Se exige por tanto que el literal entero sea un token de identificador.
 */
const TOKEN = /^[A-Za-z_][A-Za-z0-9_]*$/;
export function literalEsElCampo(texto, campo) {
  return TOKEN.test(texto) && esElCampo(texto, campo);
}

function ficheros(dir, out = []) {
  let entradas;
  try {
    entradas = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entradas) {
    if (e.name === 'node_modules' || e.name === 'dist' || e.name === '.git') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) ficheros(p, out);
    else if (EXT_AST.has(path.extname(e.name)) || EXT_TEXTO.has(path.extname(e.name))) out.push(p);
  }
  return out;
}

/**
 * La CLAVE DE PRISMA que envuelve a este nodo, si hay alguna. Es lo que separa una proyección de
 * una escritura: `select: { campo: true }` LEE y `data: { campo: x }` ESCRIBE, y las dos son un
 * `PropertyAssignment` idéntico visto de cerca.
 */
function claveDePrismaEnvolvente(nodo) {
  let n = nodo.parent;
  while (n) {
    if (ts.isPropertyAssignment(n) && n.name && ts.isIdentifier(n.name)) {
      const k = n.name.text;
      if (k === 'select' || k === 'where' || k === 'orderBy' || k === 'include' || k === 'omit') return k;
      if (k === 'data' || k === 'create' || k === 'update') return k;
    }
    n = n.parent;
  }
  return null;
}

const CLAVES_LECTURA = new Set(['select', 'where', 'orderBy', 'include', 'omit']);
const CLAVES_ESCRITURA = new Set(['data', 'create', 'update']);

/** ¿Este nodo es el lado IZQUIERDO de una asignación? Entonces se escribe. */
function esDestinoDeAsignacion(nodo) {
  const acceso = ts.isPropertyAccessExpression(nodo.parent) ? nodo.parent : nodo;
  const p = acceso.parent;
  if (!p) return false;
  if (ts.isBinaryExpression(p) && p.left === acceso) {
    const k = p.operatorToken.kind;
    return k === ts.SyntaxKind.EqualsToken
      || k === ts.SyntaxKind.BarBarEqualsToken
      || k === ts.SyntaxKind.QuestionQuestionEqualsToken;
  }
  return false;
}

function clasificar(nodo) {
  const p = nodo.parent;

  // Declaraciones: el campo se DEFINE aquí, no se usa.
  if (p && (ts.isPropertySignature(p) || ts.isPropertyDeclaration(p) || ts.isParameter(p)
    || ts.isVariableDeclaration(p) || ts.isEnumMember(p) || ts.isTypeAliasDeclaration(p))
    && p.name === nodo) {
    return DECLARACION;
  }

  // `{ campo: valor }` — una propiedad a la que se le DA un valor.
  if (p && ts.isPropertyAssignment(p) && p.name === nodo) {
    const clave = claveDePrismaEnvolvente(nodo);
    if (clave && CLAVES_LECTURA.has(clave)) return LECTURA;   // proyección o filtro
    if (clave && CLAVES_ESCRITURA.has(clave)) return ESCRITURA;

    // 🔴 DOS FORMAS QUE EL PASEO DE ANTEPASADOS NO PUEDE VER, y las dos salían mal clasificadas
    // como ESCRITURA en la primera pasada. Se reconocen por la FORMA DEL VALOR, no por el nombre
    // de la variable — un criterio por nombre se rompe en cuanto alguien renombra.
    //
    // ① `campo: true` → es una PROYECCIÓN de Prisma. Aparece en constantes sueltas como
    //    `const CUSTOMER_SELECT_NO_TOKEN = { … }`, que luego se pasan como `select:`. El paseo
    //    hacia arriba no llega hasta ese `select:` porque está en OTRA expresión.
    if (p.initializer && p.initializer.kind === ts.SyntaxKind.TrueKeyword) return LECTURA;

    // ② `campo: z.…` → es una DECLARACIÓN de esquema (Zod), no una escritura del dato.
    let v = p.initializer;
    while (v && (ts.isCallExpression(v) || ts.isPropertyAccessExpression(v))) {
      v = ts.isCallExpression(v) ? v.expression : v.expression;
    }
    if (v && ts.isIdentifier(v) && v.text === 'z') return DECLARACION;

    // Fuera de eso: meter el campo en un objeto con un valor es construir el dato.
    // Es lo que hacen los formularios al armar el `payload` que se envía.
    return ESCRITURA;
  }

  // `{ campo }` en un patrón de desestructuración: se saca el valor → se lee.
  if (p && (ts.isShorthandPropertyAssignment(p) || ts.isBindingElement(p))) return LECTURA;

  // `x.campo`
  if (p && ts.isPropertyAccessExpression(p) && p.name === nodo) {
    return esDestinoDeAsignacion(nodo) ? ESCRITURA : LECTURA;
  }

  // `x['campo']` y literales de cadena sueltos (p. ej. una lista de columnas).
  if (ts.isStringLiteral(nodo) || ts.isNoSubstitutionTemplateLiteral(nodo)) {
    if (p && ts.isElementAccessExpression(p) && p.argumentExpression === nodo) {
      return esDestinoDeAsignacion(p) ? ESCRITURA : LECTURA;
    }
    return NO_CLASIFICADO;
  }

  // Un identificador suelto que no es ni propiedad ni declaración: normalmente una variable
  // local o un import. Se lee.
  if (ts.isIdentifier(nodo)) return LECTURA;

  return NO_CLASIFICADO;
}

export function censar(campo, raiz = RAIZ) {
  const usos = [];
  const noSePudoParsear = [];

  for (const carpeta of CARPETAS) {
    for (const abs of ficheros(path.join(raiz, carpeta))) {
      const rel = path.relative(raiz, abs).split(path.sep).join('/');
      let codigo;
      try {
        codigo = fs.readFileSync(abs, 'utf8');
      } catch {
        noSePudoParsear.push(rel);
        continue;
      }

      // `.prisma` no tiene AST aquí: se censa POR LÍNEA y queda marcado como tal, para que nadie
      // lea esa entrada con la misma confianza que las demás.
      if (EXT_TEXTO.has(path.extname(abs))) {
        codigo.split(/\r?\n/).forEach((linea, i) => {
          const m = linea.match(/[A-Za-z_][A-Za-z0-9_]*/g) || [];
          if (m.some((id) => literalEsElCampo(id, campo))) {
            usos.push({ fichero: rel, linea: i + 1, clase: DECLARACION, porLinea: true, texto: linea.trim() });
          }
        });
        continue;
      }

      let sf;
      try {
        sf = ts.createSourceFile(rel, codigo, ts.ScriptTarget.Latest, true,
          abs.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.JS);
      } catch {
        noSePudoParsear.push(rel); // un fichero que no parsea NO es un fichero sin usos
        continue;
      }

      const visitar = (n) => {
        let nombre = null;
        if (ts.isIdentifier(n)) {
          nombre = esElCampo(n.text, campo) ? n.text : null;
        } else if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
          // Token, no frase: ver `literalEsElCampo`. Es lo que separa un uso de una mención.
          nombre = literalEsElCampo(n.text, campo) ? n.text : null;
        }
        if (nombre !== null) {
          const { line } = sf.getLineAndCharacterOfPosition(n.getStart(sf));
          usos.push({
            fichero: rel,
            linea: line + 1,
            clase: clasificar(n),
            grafia: nombre,
            clavePrisma: claveDePrismaEnvolvente(n),
            texto: codigo.split(/\r?\n/)[line].trim(),
          });
        }
        ts.forEachChild(n, visitar);
      };
      ts.forEachChild(sf, visitar);
    }
  }

  return { campo, usos, noSePudoParsear };
}

// ── Salida por consola ───────────────────────────────────────────────────────────────────

function esInvocacionDirecta() {
  return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (esInvocacionDirecta()) {
  const campo = process.argv[2];
  if (!campo) {
    console.log('uso: node scripts/censo-usos-de-campo.mjs <campoCamelCase>');
    process.exit(2);
  }
  const { usos, noSePudoParsear } = censar(campo);

  console.log(`\nCENSO DE USOS DE \`${campo}\` (AST · grafías normalizadas)\n`);

  if (usos.length === 0) {
    console.log('⛔ CERO USOS. Esto NO es un dato todavía: un cero de un instrumento ciego se lee');
    console.log('   igual que un cero de verdad. Calibra primero:');
    console.log('     node scripts/censo-usos-de-campo.mjs providerId');
    process.exit(1);
  }

  const grafias = [...new Set(usos.map((u) => u.grafia).filter(Boolean))].sort();
  console.log(`GRAFÍAS ENCONTRADAS: ${grafias.join(' · ')}\n`);

  for (const clase of [LECTURA, ESCRITURA, DECLARACION, NO_CLASIFICADO]) {
    const delGrupo = usos.filter((u) => u.clase === clase);
    console.log(`── ${clase} (${delGrupo.length}) ──`);
    for (const u of delGrupo) {
      const extra = u.clavePrisma ? `  [prisma: ${u.clavePrisma}]` : (u.porLinea ? '  [por línea, sin AST]' : '');
      console.log(`   ${u.fichero}:${u.linea}${extra}`);
      console.log(`      ${u.texto.slice(0, 120)}`);
    }
    console.log('');
  }

  console.log(`TOTAL: ${usos.length} usos · ${new Set(usos.map((u) => u.fichero)).size} ficheros`);
  if (noSePudoParsear.length) {
    console.log(`⚠️ NO SE PUDIERON LEER/PARSEAR ${noSePudoParsear.length}: ${noSePudoParsear.join(', ')}`);
    console.log('   Un fichero que no parsea no es un fichero sin usos.');
  }
}
