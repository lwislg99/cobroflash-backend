// tests/_censo-aviso-vs-bloqueo.mjs — SCRUM-337
//
// DOS CENSOS DERIVADOS, uno por cada cara de la misma promesa:
//
//   A · LO QUE EL PRODUCTO DICE — los avisos que manda el evaluador diario del ciclo de vida.
//   B · LO QUE EL PRODUCTO HACE al vencer la prueba — dónde está montado `requireActivePlan`.
//
// Viven juntos a propósito: el defecto de SCRUM-337 es que las dos caras divergieron **en
// silencio**, y dos censos en ficheros distintos vuelven a permitirlo.
//
// ⚠️ AST, NUNCA `grep`. Este fichero está lleno de las palabras que vigila —`requireActivePlan`,
// «panel», los nombres de los avisos— porque son las que hay que escribir para explicar qué mide.
// Un guard de texto se cazaría a sí mismo en su propia explicación (SCRUM-176/168/3/193/254).
//
// ⚠️ Y NUNCA UNA LISTA A MANO. Las cuatro rutas gateadas están escritas a mano en al menos un
// sitio más del repo (`tests/_merchant-fixture.mjs`), y una lista a mano no avisa de lo que le
// falta: es exactamente la clase de lista que ha derivado dos de dos veces en este proyecto.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import ts from 'typescript';

export const FICHERO_AVISOS = 'src/modules/messaging/domain/lifecycle.service.ts';
export const EVALUADOR_DIARIO = 'runLifecycleEmails';
export const GATE_DEL_VENCIMIENTO = 'requireActivePlan';

const METODOS_ESCRITURA = ['post', 'put', 'patch', 'delete'];

function ficherosTs(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) ficherosTs(p, out);
    else if (e.name.endsWith('.ts')) out.push(p);
  }
  return out;
}

/**
 * Huella del bloque de un aviso.
 *
 * ⚠️ SE NORMALIZAN LOS ESPACIOS a propósito. Sin esto, un reindentado o un `prettier` pondrían en
 * rojo los cinco avisos a la vez con un mensaje que habla de promesas incumplidas — y un guard que
 * grita cuando no pasa nada se acaba puenteando igual que uno que no grita nunca. Lo que tiene que
 * disparar es que cambie lo que el aviso DICE o CUÁNDO se manda, no cómo está sangrado.
 */
const huella = (s) => crypto.createHash('sha256').update(s.replace(/\s+/g, ' ').trim()).digest('hex').slice(0, 16);

// ─────────────────────────────────────────────────────────────────────────────────────────
// CENSO A · LOS AVISOS DEL EVALUADOR DIARIO
//
// QUÉ ES UN AVISO, derivado y no elegido: cada `markSent(…, 'clave')` que vive DENTRO de
// `runLifecycleEmails`. Los correos de bienvenida y de primer pago quedan fuera **solos**, sin
// lista de exclusión, porque los mandan otras funciones — el límite lo pone la estructura.
//
// LA HUELLA ES DEL BLOQUE `if` ENTERO, y eso incluye la condición (`age >= 12`), el asunto, el
// cuerpo y el botón. Es deliberado: cualquiera de esas cuatro cosas cambia lo que el usuario
// entiende que va a pasarle, y este censo NO interpreta el texto —no puede, es microcopy del
// fundador (regla 30)—, así que la única medida honesta es «cambió / no cambió».
// ─────────────────────────────────────────────────────────────────────────────────────────
export function censarAvisos(codigo) {
  const sf = ts.createSourceFile('lifecycle.service.ts', codigo, ts.ScriptTarget.Latest, true);

  let evaluador = null;
  (function buscar(n) {
    if (!evaluador && ts.isFunctionDeclaration(n) && n.name && n.name.text === EVALUADOR_DIARIO) {
      evaluador = n; return;
    }
    if (!evaluador) ts.forEachChild(n, buscar);
  })(sf);
  if (!evaluador) return { evaluadorEncontrado: false, avisos: [] };

  const linea = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  const marcas = [];
  (function walk(n) {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'markSent'
        && n.arguments.length >= 3 && ts.isStringLiteralLike(n.arguments[2])) {
      marcas.push({ clave: n.arguments[2].text, nodo: n });
    }
    ts.forEachChild(n, walk);
  })(evaluador);

  const avisos = marcas.map(({ clave, nodo }) => {
    // El bloque del aviso = el `if` MÁS CERCANO que contiene exactamente UNA plantilla de correo.
    // Si contiene cero o dos, la estructura ha cambiado y el emparejamiento ya no es fiable:
    // se devuelve el motivo y el guard falla. Emparejar «a ojo» sería inventarse el censo.
    let bloque = null, envolturas = 0;
    for (let p = nodo.parent; p && p.getStart(sf) >= evaluador.getStart(sf); p = p.parent) {
      if (!ts.isIfStatement(p)) continue;
      envolturas++;
      const wraps = [];
      (function contar(n) {
        if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'wrap') wraps.push(n);
        ts.forEachChild(n, contar);
      })(p);
      if (wraps.length === 1) { bloque = p; break; }
      if (wraps.length > 1) break; // subimos demasiado: el `if` de arriba ya abarca varios avisos
    }
    if (!bloque) {
      return { clave, linea: linea(nodo), bloqueEncontrado: false, envolturas, huella: null };
    }
    return {
      clave,
      linea: linea(bloque),
      bloqueEncontrado: true,
      envolturas,
      huella: huella(bloque.getText(sf)),
    };
  });

  return { evaluadorEncontrado: true, avisos };
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// CENSO B · DÓNDE SE EJECUTA EL VENCIMIENTO
//
// Cuenta CUALQUIER sitio donde `requireActivePlan` se pasa como argumento: da igual que sea
// `app.post(...)`, `router.post(...)` o un `.use(...)` global. Lo que identifica a un montaje es
// **fichero + método + ruta**, NUNCA el número de línea: por línea, cualquier edición diez líneas
// más arriba pondría el guard en rojo, y un guard que grita sin motivo se acaba puenteando.
// ─────────────────────────────────────────────────────────────────────────────────────────
export function censarEjecucionDelVencimiento(raizSrc) {
  const montajes = [];
  let rutasDeEscritura = 0;

  for (const abs of ficherosTs(raizSrc)) {
    const rel = path.relative(path.dirname(raizSrc), abs).replace(/\\/g, '/');
    const codigo = fs.readFileSync(abs, 'utf8');
    const sf = ts.createSourceFile(abs, codigo, ts.ScriptTarget.Latest, true);
    const linea = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;

    (function walk(n) {
      if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
        const metodo = n.expression.name.text;
        const objeto = ts.isIdentifier(n.expression.expression) ? n.expression.expression.text : '';
        const esRuta = ['app', 'router'].includes(objeto);
        const ruta = n.arguments.length && ts.isStringLiteralLike(n.arguments[0]) ? n.arguments[0].text : null;

        if (esRuta && METODOS_ESCRITURA.includes(metodo) && ruta !== null) rutasDeEscritura++;

        const gateado = n.arguments.some((a) => ts.isIdentifier(a) && a.text === GATE_DEL_VENCIMIENTO);
        if (gateado) {
          montajes.push({
            fichero: rel,
            linea: linea(n),
            metodo: metodo.toUpperCase(),
            ruta: ruta ?? '(sin ruta literal)',
            // La IDENTIDAD, estable frente a que el fichero se mueva por dentro.
            id: `${rel}::${metodo.toUpperCase()} ${ruta ?? '(sin ruta literal)'}`,
          });
        }
      }
      ts.forEachChild(n, walk);
    })(sf);
  }

  montajes.sort((a, b) => a.id.localeCompare(b.id));
  return { montajes, rutasDeEscritura };
}
