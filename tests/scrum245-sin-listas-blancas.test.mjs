// SCRUM-245 · NINGÚN ENVÍO SE DECIDE COMPARANDO EL DESTINO CONTRA UNA LISTA.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL REQUISITO, y está en el máster (J0) porque se perdió TRES veces:
//
//   «El producto debe poder enviar WhatsApp a cualquier número que el profesional introduzca
//    como cliente. Las listas blancas de teléfonos están prohibidas.»
//
// Las tres veces se pidió y las tres se mantuvo el freno contrario, no por decisión del
// fundador sino por inercia: el requisito vivía en una conversación y el mecanismo que lo
// contradecía vivía en el código. Gana lo que está escrito, y esto es lo que lo escribe en
// forma ejecutable.
//
// QUÉ SE RETIRÓ Y POR QUÉ FUE SEGURO (2-ago-2026). `demoSendBlocked` (V0-2) bloqueaba todo
// envío del merchant demo cuyo destino no estuviera en `DEMO_SAFE_NUMBERS`. Su razón de ser era
// que un tercero abusara de la cuenta demo pública, y esa premisa se MIDIÓ y era falsa: no hay
// contraseña (auth solo por magic link), el catch-all del dominio está desactivado y no hay
// regla para `demo@yaqu.app` —así que nadie puede recibir su enlace mágico—, las variables
// `E2E_TEST_LOGIN_*` no están en producción (leído en el panel, no en el runbook), `/register`
// siempre crea un merchant nuevo y todo `/admin/*` va tras `requireAuth`. El freno no protegía
// a nadie de nada.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ ESTE GUARD NO PROHÍBE UN NOMBRE
//
// Prohibir el literal `demoSendBlocked` o `DEMO_SAFE_NUMBERS` no valdría: renombrarlo lo
// esquiva, y quien reintroduzca esto de aquí a un año no va a copiar el nombre viejo — va a
// escribir `NUMEROS_PERMITIDOS` creyendo que hace algo distinto. Así que se vigila **la FORMA**:
// una función que recibe una colección de teléfonos y devuelve un booleano de bloqueo, una env
// que parte por comas una lista de números, y un envío que se aborta mirando el destino.
//
// Es la lección de SCRUM-233 aplicada aquí: lo que se prohíbe es la forma peligrosa, no la
// palabra — y la propia prosa que lo explica no puede hacer caer al guard, por eso se lee el
// fuente SIN comentarios (`leerFuente`, SCRUM-193).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';
import { leerFuente } from './_guard-texto.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Ficheros `.ts` de `src/`. */
function fuentes() {
  const out = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) walk(f);
      else if (e.name.endsWith('.ts')) out.push(f);
    }
  })(path.join(RAIZ, 'src'));
  return out;
}

const rel = (p) => path.relative(RAIZ, p).split(path.sep).join('/');

/** Nombres que delatan que un identificador contiene teléfonos. */
const HUELE_A_TELEFONOS = /(phone|telefono|teléfono|numbers|numeros|números|movil|móvil|msisdn)/i;

/**
 * ① UNA FUNCIÓN QUE DECIDE UN BLOQUEO COMPARANDO EL DESTINO CONTRA UNA COLECCIÓN.
 *
 * La forma, no el nombre: devuelve `boolean` y en su cuerpo hay un `.includes(...)` o
 * `.some(...)` sobre algo que se llama como una lista de teléfonos. Así cae igual si se llama
 * `demoSendBlocked`, `estaPermitido` o `numeroEnLaLista`.
 */
export function funcionesQueFiltranPorTelefono(ficheros) {
  const hallazgos = [];
  for (const fich of ficheros) {
    const texto = leerFuente(fich); // sin comentarios: la prosa que lo explica no cuenta
    const src = ts.createSourceFile(fich, texto, ts.ScriptTarget.Latest, true);
    const visit = (n) => {
      if (ts.isFunctionDeclaration(n) && n.name) {
        const params = n.parameters.map((p) => p.name.getText(src));
        const tieneLista = params.some((p) => HUELE_A_TELEFONOS.test(p));
        const cuerpo = n.body ? n.body.getText(src) : '';
        const compara = /\.(includes|some|indexOf|has)\s*\(/.test(cuerpo);
        const devuelveBool = /:\s*boolean/.test(n.getText(src).slice(0, n.getText(src).indexOf('{')));
        if (tieneLista && compara && devuelveBool) {
          hallazgos.push(`${rel(fich)}:${src.getLineAndCharacterOfPosition(n.getStart(src)).line + 1} → ${n.name.text}(${params.join(', ')})`);
        }
      }
      ts.forEachChild(n, visit);
    };
    visit(src);
  }
  return hallazgos;
}

/** ② UNA VARIABLE DE ENTORNO QUE PARTE POR COMAS UNA LISTA DE TELÉFONOS. */
export function envsConListaDeTelefonos(textoEnv) {
  const src = ts.createSourceFile('env.ts', textoEnv, ts.ScriptTarget.Latest, true);
  const out = [];
  const visit = (n) => {
    if (ts.isPropertyAssignment(n)) {
      const clave = n.name.getText(src);
      const valor = n.initializer.getText(src);
      if (HUELE_A_TELEFONOS.test(clave) && /\.split\(\s*['"],['"]\s*\)/.test(valor)) {
        out.push(clave);
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(src);
  return out;
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL SUELO · sin esto, «0 hallazgos» no se distingue de «no he mirado»
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-245 · SUELO: el análisis ve las vías de envío y el fichero de config', () => {
  const f = fuentes();
  assert.ok(f.length >= 100, `🔴 ESCÁNER CIEGO: solo ${f.length} ficheros .ts en src/`);

  const wa = leerFuente(path.join(RAIZ, 'src', 'integrations', 'whatsapp.ts'));
  const vias = [...wa.matchAll(/export async function (sendWhatsApp\w+)\s*\(/g)].map((m) => m[1]);
  assert.ok(vias.length >= 8,
    `🔴 solo veo ${vias.length} vías sendWhatsApp*: el guard estaría mirando un fichero que no es`);

  assert.ok(fs.existsSync(path.join(RAIZ, 'src', 'core', 'config', 'env.ts')),
    '🔴 no encuentro env.ts: la comprobación de las variables no estaría mirando nada');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// LAS TRES REGLAS
// ═════════════════════════════════════════════════════════════════════════════════════════

const MENSAJE = (detalle) =>
  '🔴 HA VUELTO UNA LISTA BLANCA DE TELÉFONOS:\n' + detalle + '\n\n' +
  '  Requisito de producto, máster J0 (y va en el máster porque se perdió TRES veces):\n' +
  '    «El producto debe poder enviar WhatsApp a cualquier número que el profesional\n' +
  '     introduzca como cliente. Las listas blancas de teléfonos están prohibidas.»\n\n' +
  '  Y OJO al error opuesto, que es el que invita a esto: una lista blanca VACÍA no\n' +
  '  significa «manda a todos», significa «NO MANDA A NADIE». Vaciarla para «abrir» apaga\n' +
  '  el canal entero. Lo que no puede existir es la lista, no su contenido.\n\n' +
  '  Si lo que quieres es acotar el abuso, hay dos formas que NO curan teléfonos: un tope de\n' +
  '  envíos por cuenta y día (el mecanismo ya existe, `WA_DAILY_TEMPLATE_CAP`) o una clave de\n' +
  '  acceso a la cuenta demo. Las dos son decisión del fundador.';

test('SCRUM-245 · ninguna función decide un bloqueo comparando el destino contra una lista', () => {
  const hallazgos = funcionesQueFiltranPorTelefono(fuentes());
  assert.deepEqual(hallazgos, [], MENSAJE(hallazgos.map((h) => `    ${h}`).join('\n')));
});

test('SCRUM-245 · ninguna variable de entorno contiene una lista de teléfonos', () => {
  const env = leerFuente(path.join(RAIZ, 'src', 'core', 'config', 'env.ts'));
  const hallazgos = envsConListaDeTelefonos(env);
  assert.deepEqual(hallazgos, [], MENSAJE(hallazgos.map((h) => `    src/core/config/env.ts → ${h}`).join('\n')));
});

test('SCRUM-245 · ningún envío se aborta por quién es el destinatario', () => {
  // La tercera forma: sin función aparte y sin env, abortando en línea dentro del sender.
  const wa = leerFuente(path.join(RAIZ, 'src', 'integrations', 'whatsapp.ts'));
  const src = ts.createSourceFile('whatsapp.ts', wa, ts.ScriptTarget.Latest, true);
  const malos = [];
  const visit = (n) => {
    if (ts.isIfStatement(n)) {
      const cond = n.expression.getText(src);
      const cuerpo = n.thenStatement.getText(src);
      const miraDestino = /params\.to\b/.test(cond);
      const aborta = /return\s*\{\s*ok:\s*false/.test(cuerpo);
      // ⚠️ EL MATIZ QUE SEPARA ESTO DE J3, y sin él este guard sería un falso rojo permanente:
      // `isWaOptedOut` también aborta mirando `params.to`, pero bloquea porque **el propio
      // destinatario pidió no recibir** —estado por cliente en BD, y obligación legal—, no
      // porque falte de una lista configurada. Lo prohibido es la PERTENENCIA A UNA COLECCIÓN,
      // así que la condición tiene que consultar `config.*` o comprobar `.includes`/`.some`.
      const porPertenencia = /\bconfig\.|\.(includes|some|indexOf|has)\s*\(/.test(cond);
      if (miraDestino && aborta && porPertenencia) {
        malos.push(`    whatsapp.ts:${src.getLineAndCharacterOfPosition(n.getStart(src)).line + 1} → if (${cond.slice(0, 70)})`);
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(src);
  assert.deepEqual(malos, [], MENSAJE(malos.join('\n')));
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// CONTROLES · que el detector sepa dar rojo, y que no grite sobre lo legítimo
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-245 · CONTROL POSITIVO: caza el patrón aunque se llame de otra forma', () => {
  // Renombrar no puede esquivarlo: aquí no aparece ni `demoSendBlocked` ni `DEMO_SAFE_NUMBERS`.
  const tmp = process.env.TMPDIR || process.env.TEMP || '.';
  const ruta = path.join(tmp, `scrum245-sonda-${process.pid}.ts`);
  fs.writeFileSync(ruta, [
    'import { normalizePhone } from "./utils";',
    'export function envioPermitido(cuenta: number, destino: string, numerosAutorizados: readonly string[]): boolean {',
    '  const d = normalizePhone(destino);',
    '  return !numerosAutorizados.map((n) => normalizePhone(n)).includes(d);',
    '}',
  ].join('\n'));
  try {
    assert.equal(funcionesQueFiltranPorTelefono([ruta]).length, 1,
      '🔴 renombrar la función esquiva el guard: entonces no vigila la FORMA, vigila un nombre');
  } finally {
    fs.unlinkSync(ruta);
  }

  assert.deepEqual(
    envsConListaDeTelefonos("const c = { NUMEROS_AUTORIZADOS: (process.env.X || '').split(',') };"),
    ['NUMEROS_AUTORIZADOS'],
    '🔴 una env con otro nombre esquiva el guard',
  );
});

test('SCRUM-245 · CONTROL NEGATIVO: lo legítimo no dispara', () => {
  // `normalizePhone`, los topes por día y cualquier función que toque teléfonos SIN decidir un
  // bloqueo por pertenencia a una lista tienen que seguir pasando. Un guard que grita sobre
  // código sano se desactiva en una tarde.
  assert.deepEqual(funcionesQueFiltranPorTelefono([path.join(RAIZ, 'src', 'core', 'utils', 'utils.ts')]), []);
  assert.deepEqual(envsConListaDeTelefonos("const c = { DEMO_SAFE_HOSTS: (process.env.X || '').split(',') };"), [],
    'una lista que NO es de teléfonos (hosts, emails) no es asunto de este guard');
});
