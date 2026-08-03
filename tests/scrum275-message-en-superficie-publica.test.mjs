// SCRUM-275 · TRINQUETE: cuántas respuestas de error de superficie PÚBLICA no llevan `message`.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ ESTE GUARD ES DISTINTO DEL DE SCRUM-264, Y NO SU COPIA
//
// El de 264 vigila **la pantalla**: que cuando llega un `message`, se pinte ese y no el código.
// Éste vigila **el servidor**: cuántas respuestas ni siquiera mandan uno. Son dos defectos, y
// por eso hicieron falta dos censos — arreglar solo el primero fue **necesario y no suficiente**.
//
// La medida que lo demuestra: tras SCRUM-264 la landing ya prefiere `message`, pero **solo 4 de
// las 21 respuestas de error de `/quote/*` mandan uno**. En las otras 17 el cliente sigue leyendo
// `quote_not_found` o `already_accepted` — ahora por el camino de reserva, que es correcto pero
// no es un texto.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ UN TRINQUETE Y NO UNA PROHIBICIÓN
//
// Prohibir «ninguna respuesta pública sin `message`» pondría hoy la suite en rojo por 27 sitios,
// y un guard que nace rojo se desactiva en una tarde. El trinquete deja el número donde está y
// **impide que suba**: el que añada una respuesta nueva la escribe con su texto.
//
// 🔑 Y BAJAR TAMBIÉN FALLA, igual que en SCRUM-243 y SCRUM-273. No es una manía: si bajar pasara
// en silencio, la mejora no quedaría escrita en ningún sitio y el número perdería su significado
// — nadie sabría si 22 es «hemos arreglado cinco» o «el escáner ve menos». Al fallar, cada
// arreglo obliga a bajar la constante en el mismo commit, y el trinquete **es su propio
// registro**. Por eso no hay un ticket para «cerrar los 27»: el incentivo vive aquí, y le toca a
// quien pase por esas rutas.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// A QUÉ SE PARECE UN ACIERTO
//
// `albaranPublic.routes.ts` va **5 de 5**: todas sus respuestas de error llevan su texto. No hay
// que inventar el patrón para bajar este número — hay que extender ése.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LAS SUPERFICIES SE DERIVAN, NO SE LISTAN
//
// De `publicAccessDeclarations.ts` (qué rutas son públicas y de qué clase) cruzado con los
// montajes de `app.ts` (qué router sirve cada prefijo). Así, **un fichero de rutas públicas
// nuevo entra solo en el censo** el día que se monte, sin que nadie se acuerde de añadirlo — que
// es justo el fallo que dejó fuera la quinta ruta en SCRUM-263/264.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (...p) => fs.readFileSync(path.join(RAIZ, ...p), 'utf8');

/**
 * EL TRINQUETE. No puede subir; y si baja, este test falla para que la bajada se anote aquí.
 * Medido el 3-ago-2026 sobre `origin/main` = 5cd6387 (re-verificado tras rebasar).
 *
 * ⚠️ SON 28 Y EL CENSO A MANO DIJO 27, y la diferencia merece quedarse escrita porque es la
 * misma lección de SCRUM-264: aquel censo se hizo sobre una lista de ficheros escrita a mano y
 * se dejó `health.routes.ts` fuera. Al derivar las superficies de las declaraciones + los
 * montajes, `/health` entra sola. **Una lista a mano no avisa de lo que le falta.**
 *
 * `/health` la lee un monitor, no una persona, así que su respuesta sin texto no es deuda real;
 * se cuenta igual porque **excluir por ruta abriría una lista a mano dentro del guard que la
 * evita**. Las únicas exclusiones son por CLASE declarada (ver `CLASES_FUERA`).
 */
export const SIN_MESSAGE = 28;

/** Suelo del escáner: si ve menos respuestas que esto, dejó de mirar y su cuenta no vale. */
const SUELO_RESPUESTAS = 30;

/**
 * Clases que NO entran, con su motivo — son las que no lee una persona.
 * Se declaran en vez de omitirse: una ausencia sin explicación es indistinguible de un olvido.
 */
const CLASES_FUERA = {
  'signed-webhook': 'lo consume Stripe/Meta/MP, no una persona: un texto en español no lo lee nadie',
  internal: 'requiere secreto interno — tráfico entre nuestros propios procesos',
};

// ── Derivación 1: qué rutas son públicas y de qué clase ──────────────────────────────────

function declaracionesPublicas() {
  const src = leer('src', 'core', 'http', 'publicAccessDeclarations.ts');
  const entradas = [...src.matchAll(/path:\s*'([^']+)',?\s*\n?\s*kind:\s*'([^']+)'/g)]
    .map(([, ruta, clase]) => ({ ruta, clase }));
  return entradas.filter((d) => !CLASES_FUERA[d.clase]);
}

// ── Derivación 2: qué fichero sirve cada prefijo montado ─────────────────────────────────

function montajes() {
  const app = leer('src', 'app.ts');
  const importados = new Map(
    [...app.matchAll(/import\s+(\w+)\s+from\s+'(\.[^']+)'/g)].map(([, nombre, rel]) => [nombre, rel]),
  );
  const out = [];
  for (const [, prefijo, args] of app.matchAll(/app\.use\('([^']+)'\s*,([^;]*)\)/g)) {
    // El router es el ÚLTIMO identificador de los argumentos (los previos son middlewares).
    const ids = [...args.matchAll(/\b(\w+)\b/g)].map((m) => m[1]);
    for (let i = ids.length - 1; i >= 0; i--) {
      if (importados.has(ids[i])) { out.push({ prefijo, fichero: `${importados.get(ids[i])}.ts` }); break; }
    }
  }
  return out;
}

/** Ficheros que sirven al menos una ruta pública, y las rutas que no casan con ningún montaje. */
function superficiePublica() {
  const monta = montajes();
  const ficheros = new Set();
  const sinResolver = [];
  for (const { ruta } of declaracionesPublicas()) {
    const candidatos = monta.filter((m) => ruta === m.prefijo || ruta.startsWith(`${m.prefijo}/`));
    if (!candidatos.length) { sinResolver.push(ruta); continue; }
    for (const c of candidatos) ficheros.add(c.fichero);
  }
  return { ficheros: [...ficheros], sinResolver: [...new Set(sinResolver)] };
}

// ── El censo: `res.status(4xx|5xx).json({...})` con y sin `message` ──────────────────────

function censo() {
  const { ficheros, sinResolver } = superficiePublica();
  const respuestas = [];

  for (const rel of ficheros) {
    // Los imports de `app.ts` son relativos a `src/`, no a la raíz del repo.
    const abs = path.join(RAIZ, 'src', rel.replace(/^\.\//, ''));
    if (!fs.existsSync(abs)) continue;
    const arbol = ts.createSourceFile(abs, fs.readFileSync(abs, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

    const visitar = (n) => {
      if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'json') {
        const receptor = n.expression.expression;
        let codigo = null;
        if (ts.isCallExpression(receptor) && ts.isPropertyAccessExpression(receptor.expression)
            && receptor.expression.name.text === 'status' && receptor.arguments.length === 1
            && ts.isNumericLiteral(receptor.arguments[0])) {
          codigo = Number(receptor.arguments[0].text);
        }
        if (codigo !== null && codigo >= 400) {
          const obj = n.arguments[0];
          const props = obj && ts.isObjectLiteralExpression(obj) ? obj.properties : [];
          const nombre = (p) => (p.name && ts.isIdentifier(p.name) ? p.name.text : null);
          respuestas.push({
            fichero: rel.split('/').pop(),
            linea: arbol.getLineAndCharacterOfPosition(n.getStart()).line + 1,
            estado: codigo,
            conMessage: props.some((p) => nombre(p) === 'message'),
          });
        }
      }
      ts.forEachChild(n, visitar);
    };
    ts.forEachChild(arbol, visitar);
  }
  return { respuestas, sinResolver, ficheros };
}

// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-275 · el escáner sigue viendo la superficie pública (suelo)', () => {
  const { respuestas, ficheros } = censo();
  assert.ok(
    ficheros.length >= 8,
    `🔴 ESCÁNER CIEGO: solo resuelvo ${ficheros.length} fichero(s) de rutas públicas. Si cambió la ` +
      'forma de `app.use` o de las declaraciones, el censo de abajo estaría contando sobre nada.',
  );
  assert.ok(
    respuestas.length >= SUELO_RESPUESTAS,
    `🔴 ESCÁNER CIEGO: veo ${respuestas.length} respuestas de error y conozco ${SUELO_RESPUESTAS}+. ` +
      'Un censo que encuentra menos de lo que hay da un trinquete falsamente bueno.',
  );
});

test('SCRUM-275 · TRINQUETE: las respuestas públicas sin `message` no pueden aumentar', () => {
  const { respuestas } = censo();
  const sin = respuestas.filter((r) => !r.conMessage);
  const detalle = sin.map((r) => `    ${r.fichero}:${r.linea}  ${r.estado}`).join('\n');

  assert.ok(
    sin.length <= SIN_MESSAGE,
    `🔴 HAY ${sin.length} RESPUESTAS PÚBLICAS SIN TEXTO HUMANO y el tope es ${SIN_MESSAGE}.\n\n` +
      '  Una respuesta sin `message` acaba enseñándole al usuario un identificador interno: es\n' +
      '  lo que leía quien se equivocaba al teclear su correo («invalid_email») antes de 275.\n' +
      '  Añade `message` a la respuesta nueva — el texto lo aprueba el fundador (regla 30).\n\n' +
      `  A qué se parece un acierto: \`albaranPublic.routes.ts\` va 5 de 5.\n\n${detalle}`,
  );

  assert.ok(
    sin.length >= SIN_MESSAGE,
    `✅ BIEN, y hay que anotarlo: quedan ${sin.length} y el tope decía ${SIN_MESSAGE}.\n\n` +
      `  Baja \`SIN_MESSAGE\` a ${sin.length} en este mismo commit. Este test falla al bajar A\n` +
      '  PROPÓSITO (igual que SCRUM-243 y SCRUM-273): si la bajada pasara en silencio, la mejora\n' +
      '  no quedaría escrita en ningún sitio y el número dejaría de significar nada — nadie\n' +
      '  sabría si es que se arregló algo o es que el escáner ve menos.',
  );
});

test('SCRUM-275 · las rutas públicas que no resuelven a un fichero se DICEN, no se callan', () => {
  // Son las servidas fuera de un `app.use` con router (estáticos, `app.get` suelto en app.ts).
  // No entran en el censo, y por eso tienen que estar a la vista: un censo que descarta en
  // silencio se lee como si hubiera cubierto más de lo que cubrió.
  const { sinResolver } = censo();
  assert.ok(
    sinResolver.length <= 8,
    `🔴 ${sinResolver.length} rutas públicas declaradas no resuelven a ningún fichero de rutas: ` +
      `${sinResolver.join(', ')}. Si son muchas, el trinquete está midiendo una parte pequeña.`,
  );
  console.log(`   ℹ SCRUM-275 · fuera del censo por no tener router propio: ${sinResolver.join(', ') || '—'}`);
});
