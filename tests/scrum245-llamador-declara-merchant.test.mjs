// SCRUM-245 · TODA LLAMADA A UNA VÍA DE ENVÍO DE WHATSAPP DECLARA SU MERCHANT.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ HACE FALTA OTRO GUARD SI YA ESTÁ EL DE SCRUM-227
//
// El de 227 mira el lado de la DEFINICIÓN: enumera las funciones `sendWhatsApp*` y comprueba
// que el cuerpo de cada una menciona `recordWaMessage`. Es correcto y no sobra. Pero ese
// `recordWaMessage` vive dentro de `logFailure`, que abre así:
//
//     const logFailure = (reason: string) => {
//       if (!params.merchantId) return;      // ← aquí se apaga el rastro, desde FUERA
//
// O sea que **el guard de 227 está en verde justo mientras la escritura está desactivada para
// 21 llamadores**. Su verde significa «la función contiene el código», no «queda rastro». No es
// un fallo suyo: declara sus límites («una vía con otro nombre queda fuera»), pero no podía
// declarar éste, porque el defecto no vive en lo que él mira.
//
// Es la familia de SCRUM-239 y SCRUM-235: **el medidor mira un sitio y el defecto vive en otro.**
// Por eso este guard mira el LLAMADOR, que es donde se decide si habrá rastro o no.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LA REGLA, Y POR QUÉ ES UN RATCHET Y NO UN ROJO HOY
//
// La regla final es: toda llamada pasa `merchantId` **o declara** por qué no hay ninguno. Pero
// hoy había 32 llamadas sin declarar, y arreglarlas de golpe habría bloqueado las tres tandas de
// todo el mundo — un guard que nace rojo acaba apagado en una tarde, que es como mueren los
// guards de esta casa. Por eso nació con tope y hoy el tope es 0.
//
// Así que nace como RATCHET: el número de pendientes **no puede subir**. Una llamada nueva sin
// declarar cae inmediatamente; las 32 conocidas están contadas, no listadas. **Sin allowlist**:
// no hay ni un `fichero:línea` escrito a mano al que alguien pueda añadir la suya.
//
// ⚠️ RATCHET MANUAL — NO BAJA SOLO. Cuando la FASE 3 arregle las 21, este número tiene que
// bajarse A MANO, y el test lo exige (falla también si el censo baja sin actualizarlo). Es la
// misma cifra-a-mano que `SUELO_TOTAL`, con el mismo aviso: envejece, y se declara.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * PENDIENTES DE DECLARAR. Censados en 32 el 31-jul-2026 contra `origin/main` = `e9aa4bd`, y
 * bajados a 27 en la FASE 2 al DECLARAR los 5 legítimos con su `sinMerchant`.
 *
 * Y a 6 en la FASE 3, al pasar el `merchantId` en las 21 respuestas del bot con su
 * `exentoDelDemo` declarado. **Y a CERO** al resolver los 6 que faltaban (2-ago-2026): se borró
 * la rama legacy inalcanzable, se resolvió `handleTemplateButtonReply` con su consulta, los dos
 * multi-negocio se RAMIFICARON (uno solo → su merchant; varios → declarado) y los dos avisos al
 * PRO pasan su merchant SIN eximirse.
 *
 * ⚠️ EN CERO ESTO YA NO ES UN RATCHET, ES UN GUARD: cualquier llamada nueva sin declarar cae
 * inmediatamente, sin margen. El aviso de «no baja solo» se queda porque el mecanismo sigue
 * siendo el mismo — pero ya no hay deuda que bajar, y volver a subirlo sería aceptar deuda nueva
 * a propósito, no heredarla. El desglose vive en SCRUM-245; aquí solo
 * vive el número, a propósito: una lista de `fichero:línea` sería una allowlist, y una allowlist
 * es el sitio donde se apunta la excepción siguiente.
 */
const TOPE_PENDIENTES = 0;

/** Suelo del escáner: hoy hay 62 llamadas. Si el análisis devuelve 0, no ha mirado. */
const SUELO_LLAMADAS = 50;

/** Las vías de envío se enumeran POR SU NOMBRE, igual que en SCRUM-227: no hay lista a mano. */
const ES_VIA_DE_ENVIO = /^sendWhatsApp\w*$/;

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

/**
 * Censo de llamadas a vías de envío. AST y no `grep`: hay que saber si el ARGUMENTO lleva la
 * propiedad, y una línea de texto no distingue `merchantId: x` de la palabra en un comentario.
 *
 * @returns {{total: number, pendientes: Array<{ruta,linea,fn,motivo}>}}
 */
export function censarLlamadas(ficheros) {
  let total = 0;
  const pendientes = [];
  const conLlamadas = new Set(); // ficheros donde SÍ se han visto vías de envío

  for (const fich of ficheros) {
    const src = ts.createSourceFile(fich, fs.readFileSync(fich, 'utf8'), ts.ScriptTarget.Latest, true);
    const visit = (n) => {
      if (ts.isCallExpression(n) && ES_VIA_DE_ENVIO.test(n.expression.getText(src))) {
        total += 1;
        conLlamadas.add(rel(fich));
        const arg = n.arguments[0];
        let declara = false;
        let motivo = 'no pasa merchantId ni declara sinMerchant';

        if (arg && ts.isObjectLiteralExpression(arg)) {
          for (const p of arg.properties) {
            // Un spread impide decidir estáticamente qué lleva dentro. Se cuenta como NO
            // declarado: el lado conservador es el que no deja pasar lo que no se puede leer.
            if (ts.isSpreadAssignment(p)) motivo = 'lleva un spread: no se puede leer estáticamente';
            const k = p.name?.getText?.(src);
            if (k === 'merchantId' || k === 'sinMerchant') declara = true;
          }
        } else if (arg) {
          motivo = 'el argumento no es un objeto literal: no se puede leer estáticamente';
        }

        if (!declara) {
          const { line } = src.getLineAndCharacterOfPosition(n.getStart(src));
          pendientes.push({ ruta: rel(fich), linea: line + 1, fn: n.expression.getText(src), motivo });
        }
      }
      ts.forEachChild(n, visit);
    };
    visit(src);
  }
  return { total, pendientes, conLlamadas };
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL SUELO · que el analizador haya mirado de verdad
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-245 · SUELO: el análisis encuentra las vías de envío de verdad', () => {
  // Sin esto, una ruta mal resuelta o una regex rota devuelven 0 llamadas y 0 pendientes, y el
  // ratchet de abajo pasaría en VERDE sin haber leído un fichero. Cero no es «todo declarado»,
  // es «no he mirado» — y en un guard esos dos estados tienen que ser distinguibles.
  const { total, conLlamadas } = censarLlamadas(fuentes());
  assert.ok(total >= SUELO_LLAMADAS,
    `🔴 ESCÁNER CIEGO: solo ${total} llamadas a sendWhatsApp* en src/. ¿Se movió el código o se ` +
    'rompió el recorrido del AST?');
  // Y que vea el bot, que es donde vive el grueso. OJO AL ANCLAJE: hasta la FASE 3 esto se
  // comprobaba sobre los PENDIENTES de `botFlow`, y al declararlos todos el suelo cayó — pedía
  // que siguiera existiendo el problema para creerse que había mirado. El ancla correcta es que
  // el barrido VEA el fichero, no que ese fichero siga estando mal.
  assert.ok(
    conLlamadas.has('src/modules/whatsappBot/domain/botFlow.service.ts'),
    '🔴 el análisis no está viendo el bot de entrada, que es donde vive el grueso de las vías',
  );
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL RATCHET · una llamada nueva sin declarar cae; las conocidas están contadas, no listadas
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-245 · ninguna llamada NUEVA envía WhatsApp sin declarar su merchant', () => {
  const { pendientes } = censarLlamadas(fuentes());

  if (pendientes.length > TOPE_PENDIENTES) {
    const nuevas = pendientes.slice(TOPE_PENDIENTES);
    assert.fail(
      `🔴 HAY ${pendientes.length} LLAMADAS SIN DECLARAR SU MERCHANT y el tope censado es ` +
      `${TOPE_PENDIENTES}. Alguna es nueva:\n` +
      pendientes.map((p) => `    ${p.ruta}:${p.linea}  ${p.fn}  — ${p.motivo}`).join('\n') +
      `\n\n  (las últimas de la lista, por si ayuda: ${nuevas.map((p) => `${p.ruta}:${p.linea}`).join(', ')})\n\n` +
      '  Sin `merchantId` NO QUEDA RASTRO: `recordWaMessage` vive dentro de `logFailure`, que\n' +
      '  hace `return` si no hay merchant. Y además NO SE APLICA LA GUARDA DEMO (`demoSendBlocked`\n' +
      '  compara el merchantId contra el del demo, así que sin él devuelve false y no bloquea).\n\n' +
      '  Si de verdad NO existe un merchant único —remitente desconocido, baja multi-merchant,\n' +
      '  selector de negocio—, DECLÁRALO: `sinMerchant: "<motivo>"`. Omitirlo y olvidarlo tienen\n' +
      '  que dejar de ser indistinguibles.',
    );
  }

  assert.equal(
    pendientes.length, TOPE_PENDIENTES,
    `🔴 quedan ${pendientes.length} pendientes y el tope dice ${TOPE_PENDIENTES}: han BAJADO. ` +
    'Es una buena noticia, pero hay que anotarla — baja TOPE_PENDIENTES a ese número para que el ' +
    'terreno ganado no se pueda volver a perder en silencio (ratchet manual, como SUELO_TOTAL).',
  );
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// CONTROLES DEL ANALIZADOR · que sepa distinguir declarado de no declarado
// ═════════════════════════════════════════════════════════════════════════════════════════

/** Censa un fragmento de TypeScript escrito a mano, sin tocar disco. */
function censarTexto(codigo) {
  const src = ts.createSourceFile('sintetico.ts', codigo, ts.ScriptTarget.Latest, true);
  let total = 0;
  const pendientes = [];
  const visit = (n) => {
    if (ts.isCallExpression(n) && ES_VIA_DE_ENVIO.test(n.expression.getText(src))) {
      total += 1;
      const arg = n.arguments[0];
      let declara = false;
      if (arg && ts.isObjectLiteralExpression(arg)) {
        for (const p of arg.properties) {
          const k = p.name?.getText?.(src);
          if (k === 'merchantId' || k === 'sinMerchant') declara = true;
        }
      }
      if (!declara) pendientes.push(n.expression.getText(src));
    }
    ts.forEachChild(n, visit);
  };
  visit(src);
  return { total, pendientes };
}

test('SCRUM-245 · pasar merchantId cuenta como declarado', () => {
  const r = censarTexto('sendWhatsAppText({ to, text, merchantId: m.id });');
  assert.equal(r.total, 1);
  assert.deepEqual(r.pendientes, []);
});

test('SCRUM-245 · declarar sinMerchant también cuenta (los 5 legítimos)', () => {
  // No hay merchant que pasar —el remitente no es cliente de nadie—, pero el caso queda ESCRITO
  // en el sitio, que es lo que lo separa de un olvido.
  const r = censarTexto("sendWhatsAppText({ to, text, sinMerchant: 'remitente-desconocido' });");
  assert.deepEqual(r.pendientes, []);
});

test('SCRUM-245 · omitirlo NO cuenta como declarado', () => {
  const r = censarTexto('sendWhatsAppText({ to, text });');
  assert.deepEqual(r.pendientes, ['sendWhatsAppText']);
});

test('SCRUM-245 · un spread NO cuela: lo que no se puede leer no se da por bueno', () => {
  // `sendWhatsAppText({ ...opts })` podría llevar merchantId dentro o no. El lado conservador es
  // contarlo como pendiente: un guard que asume lo mejor de lo que no puede leer no guarda nada.
  const r = censarTexto('sendWhatsAppText({ to, ...opts });');
  assert.deepEqual(r.pendientes, ['sendWhatsAppText']);
});

test('SCRUM-245 · las vías se enumeran por NOMBRE, no por una lista escrita a mano', () => {
  // Una vía futura que se llame como toca entra sola. La regla es la misma de SCRUM-227, y su
  // límite también: una vía con OTRO nombre queda fuera de los dos guards.
  const r = censarTexto([
    'sendWhatsAppCtaUrl({ to });',
    'sendWhatsAppLoQueSea({ to });',
    'enviarPorOtroCanal({ to });',
  ].join('\n'));
  assert.equal(r.total, 2, 'las dos sendWhatsApp*; la tercera no es una vía de envío');
  assert.deepEqual(r.pendientes, ['sendWhatsAppCtaUrl', 'sendWhatsAppLoQueSea']);
});

test('SCRUM-245 · `merchantId` en un COMENTARIO no cuenta como declararlo', () => {
  // La trampa de siempre: un guard de texto casaría con el comentario que explica la omisión.
  // El AST no ve comentarios, y este test es lo que impide que alguien lo reescriba con `grep`.
  const r = censarTexto('sendWhatsAppText({ to, text }); // TODO: pasar merchantId algún día');
  assert.deepEqual(r.pendientes, ['sendWhatsAppText'], '🔴 un comentario ha contado como declaración');
});
