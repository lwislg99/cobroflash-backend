// tests/scrum931-un-solo-importe-de-plantilla.test.mjs — SCRUM-931
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// EL IMPORTE QUE VA A UNA PLANTILLA SALE DE UNA FUNCIÓN, Y LA PUERTA LA CIERRA EL TIPO.
//
// `whatsappTemplates.ts` nació —lo dice su propia cabecera— para que ningún call-site construyera
// los componentes por su cuenta «y se desincronicen». Centralizó el NÚMERO DE VARIABLES, que es lo
// que Meta comprueba (#132000), y dejó a cada llamante el FORMATO DEL IMPORTE, que Meta NO
// comprueba. El defecto vive exactamente ahí: en lo único que se delegó porque nadie de fuera lo
// iba a rechazar.
//
// ── LO MEDIDO, Y ES LO QUE DA FORMA A ESTE BANCO ────────────────────────────────────────────────
//
// El importe ya formateado viaja por DOS propiedades con nombre: `totalWithCurrency` y
// `amountWithCurrency`. Declaradas `: string` en 6 sitios (4 builders + 2 envoltorios) y
// construidas A MANO en los SIETE productores. Por eso el arreglo NO es formatear en siete sitios:
// es que esas dos propiedades dejen de aceptar una cadena.
//
//     amount: number + currency: string  →  el compilador rechaza `${n.toFixed(2)} ${cur}`.
//
// Un guard que cuenta `toFixed` por fichero vigila ESE fichero y nunca ve el octavo (SCRUM-577).
// Un TIPO no tiene octavo: no hay forma de llamar al builder sin pasar por él.
//
// ── Y LA FUNCIÓN ÚNICA NO SE INVENTA: YA TIENE NOMBRE ───────────────────────────────────────────
//
// `formatMoneyEs` es la forma de la casa para dinero CLIENT-FACING, y su propio comentario (A6.6,
// `core/utils/utils.ts`) dice literalmente «nunca "2383.70 EUR"» — que es el defecto de este
// ticket, escrito como regla años antes de que se abriera. No entra una CUARTA forma: entra la
// llamada que faltaba. Por eso los trinquetes de SCRUM-636 y SCRUM-743 —que cuentan las formas
// exportadas de `utils.ts` por AST y exigen que sean TRES— siguen verdes sin tocarlos.
//
// ⚠️ POR QUÉ EL SÍMBOLO `€` NO ES UN RIESGO SIN MEDIR: `disputes.service.ts:111` ya manda hoy la
// salida de `formatMoneyEs` —con `€` y su espacio DURO (U+00A0)— como variable {{3}} de
// `merchant_alert_es`, una plantilla APROBADA, en producción. No es inferencia sobre la doc de
// Meta: es un envío que ya se hace. Y las muestras aprobadas de `merchant_alert_es` («450,00 € ·
// Factura F-2026-014») llevan el símbolo dentro.
//
// ── LA TRAMPA DEL ROJO, HEREDADA DE SCRUM-743 ───────────────────────────────────────────────────
//
// Un rojo con 117 o con 12.345 no prueba nada: `es-ES` ya agrupa a partir de cinco cifras y con
// tres no hay nada que agrupar. **El caso de cuatro cifras enteras es obligatorio**, porque por
// CLDR `es-ES` NO agrupa 1234 — y es el tramo del importe corriente de un trabajo.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

import {
  buildQuoteDecision,
  buildPaymentRequest,
  buildPaymentConfirmation,
  buildPaymentConfirmationInvoice,
  validateTemplateComponents,
} from '../dist/integrations/whatsappTemplates.js';
import { formatMoneyEs } from '../dist/core/utils/utils.js';

const RAIZ = path.resolve(import.meta.dirname, '..');
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

/** Los espacios de `Intl` son DUROS (U+00A0). Se normalizan para comparar a ojo, nunca para asertar. */
const vis = (s) => String(s).replace(/ /g, ' ');

/** La forma VIEJA, la que estaba escrita a mano en los siete productores. Sin ella no hay contraste. */
const COMO_ESTABA = (n, cur) => `${Number(n).toFixed(2)} ${cur}`;

// Los CUATRO builders con importe CLIENT-FACING, y en qué posición del body cae la variable.
// `merchant_alert_es` NO está: va al PROFESIONAL, y el alcance decidido deja fuera lo que ve el pro
// (igual que los `CustomerEvent` del panel). Queda medido y dicho en el expediente, no arreglado aquí.
const BUILDERS = [
  {
    nombre: 'buildQuoteDecision',
    plantilla: 'quote_decision_es',
    idx: 3,
    llamar: (amount, currency) => buildQuoteDecision({
      customerName: 'María', businessName: 'Fontanería García', quoteNumber: 128,
      amount, currency, decisionToken: 'b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5',
    }),
  },
  {
    nombre: 'buildPaymentRequest',
    plantilla: 'payment_request_es',
    idx: 3,
    llamar: (amount, currency) => buildPaymentRequest({
      customerName: 'María', businessName: 'Fontanería García', invoiceNumber: 'F-2026-014',
      amount, currency, urlToken: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
    }),
  },
  {
    nombre: 'buildPaymentConfirmation',
    plantilla: 'payment_confirmation_es',
    idx: 1,
    llamar: (amount, currency) => buildPaymentConfirmation({
      customerName: 'María', invoiceNumber: 'F-2026-014', businessName: 'Fontanería García',
      amount, currency,
    }),
  },
  {
    nombre: 'buildPaymentConfirmationInvoice',
    plantilla: 'payment_confirmation_invoice_es',
    idx: 1,
    llamar: (amount, currency) => buildPaymentConfirmationInvoice({
      customerName: 'María', documentNumber: 'F-2026-014', businessName: 'Fontanería García',
      amount, currency, urlToken: 'c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6',
    }),
  },
];

const textosDelBody = (msg) => {
  const body = msg.components.find((c) => c.type === 'body');
  assert.ok(body, '🔴 el payload no trae componente `body`');
  return body.parameters.map((p) => p.text);
};

// ═════════════════════════════════════════════════════════════════════════════════════════
// SUELO — si esto no mide, lo de abajo no significa nada (SCRUM-413: un guard sabe decir
// «NO PUEDO MIRAR» en vez de dar un verde vacío).
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-931 · 🔴 SUELO: el importe de 419,87 EUR distingue las dos formas', () => {
  // Si la forma vieja y la nueva coincidieran, todo este banco sería un verde vacío.
  assert.notEqual(vis(formatMoneyEs(419.87, 'EUR')), COMO_ESTABA(419.87, 'EUR'),
    '🔴 SUELO: la forma de la casa y la forma vieja dan lo mismo; este banco no podría ver el defecto.');
  assert.ok(vis(formatMoneyEs(419.87, 'EUR')).includes('419,87'),
    `🔴 SUELO: «${vis(formatMoneyEs(419.87, 'EUR'))}» no lleva la coma decimal española.`);
  assert.equal(COMO_ESTABA(419.87, 'EUR'), '419.87 EUR',
    '🔴 SUELO: la forma vieja ya no reproduce el importe del enunciado.');
});

test('SCRUM-931 · 🔴 SUELO: cuatro cifras enteras SÍ se agrupan (el defecto de CLDR)', () => {
  // La razón de que esto tenga que estar: `es-ES` NO agrupa 1234 por CLDR, y cuatro tickets
  // (A18.2, 436, 636, 739) se rompieron por copiarse el formato sin `useGrouping: 'always'`.
  assert.ok(vis(formatMoneyEs(1234.5, 'EUR')).startsWith('1.234,50'),
    `🔴 SUELO: «${vis(formatMoneyEs(1234.5, 'EUR'))}» no agrupa el millar; el caso de abajo no probaría nada.`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// LO QUE MIDE LA ARITMÉTICA DEL FORMATO — los cuatro builders, con el importe del enunciado
// ═════════════════════════════════════════════════════════════════════════════════════════

for (const b of BUILDERS) {
  test(`SCRUM-931 · ${b.plantilla}: el importe sale de \`formatMoneyEs\`, no de \`toFixed\``, () => {
    const msg = b.llamar(419.87, 'EUR');
    const vars = textosDelBody(msg);
    const salida = vars[b.idx];

    assert.equal(salida, formatMoneyEs(419.87, 'EUR'),
      `🔴 ${b.nombre}: la variable {{${b.idx + 1}}} de ${b.plantilla} vale «${vis(salida)}» y tiene que ser `
      + `exactamente «${vis(formatMoneyEs(419.87, 'EUR'))}», la forma de la casa (A6.6). `
      + 'Si vale «undefined», el builder todavía espera el importe YA formateado: la puerta sigue abierta.');

    assert.ok(!String(salida).includes('419.87'),
      `🔴 ${b.nombre}: sigue saliendo el formato extranjero «419.87» en ${b.plantilla}. Es el importe `
      + 'que el cliente lee en su móvil, y el punto es su separador de MILES.');
  });

  test(`SCRUM-931 · ${b.plantilla}: agrupa el millar (1.234,50), que es donde CLDR falla`, () => {
    const salida = textosDelBody(b.llamar(1234.5, 'EUR'))[b.idx];
    assert.equal(salida, formatMoneyEs(1234.5, 'EUR'),
      `🔴 ${b.nombre}: «${vis(salida)}» en vez de «${vis(formatMoneyEs(1234.5, 'EUR'))}».`);
    assert.ok(!vis(salida).startsWith('1234'),
      `🔴 ${b.nombre}: «${vis(salida)}» no agrupa el millar. Es el tramo del importe corriente de un trabajo.`);
  });

  test(`SCRUM-931 · ${b.plantilla}: fuera del euro sale el CÓDIGO, no un € impostado`, () => {
    // A6.6 dice «1.500,00 MXN» fuera del euro. Formatear dentro del builder no puede convertir
    // en euros un cobro que no lo es: eso sería un defecto peor que el que se viene a arreglar.
    const salida = textosDelBody(b.llamar(1500, 'MXN'))[b.idx];
    assert.equal(salida, formatMoneyEs(1500, 'MXN'),
      `🔴 ${b.nombre}: «${vis(salida)}» no es la forma de la casa para MXN.`);
    assert.ok(!String(salida).includes('€'),
      `🔴 ${b.nombre}: ha colado un «€» en un importe en MXN: «${vis(salida)}».`);
  });

  test(`SCRUM-931 · ${b.plantilla}: sigue pasando el validador de Meta (no se ha movido la estructura)`, () => {
    // Formatear NO puede cambiar el nº de variables ni el botón: eso es lo que Meta sí rechaza
    // (#132000/#132001). Este es el «esto no se ha movido» del ticket.
    const msg = b.llamar(419.87, 'EUR');
    assert.equal(validateTemplateComponents(msg.templateName, msg.components), null,
      `🔴 ${b.nombre}: el payload ha dejado de cumplir la spec aprobada en Meta.`);
    assert.equal(msg.templateName, b.plantilla);
    assert.equal(msg.languageCode, 'es');
  });
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// LA PUERTA — por TIPO. Esto es lo que impide el octavo sitio.
// ═════════════════════════════════════════════════════════════════════════════════════════

/**
 * Las propiedades del OBJETO DE PARÁMETROS de cada función exportada (y de cada interfaz), leídas
 * del AST y no por expresión regular.
 *
 * ⚠️ La primera versión de esto era un `matchAll` de `nombre: string;` sobre el texto entero de la
 * función, y su propio suelo la tumbó: no veía `customerName?: string | null` —opcional y con
 * unión— y además habría contado cualquier `const x: string = …` del CUERPO como si fuera un
 * parámetro. Se deja escrito porque es la lección: el suelo cazó al instrumento, que es para lo
 * que está.
 */
function propiedadesDeclaradas(rel) {
  const fuente = leer(rel);
  const sf = ts.createSourceFile(path.basename(rel), fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const out = [];
  const miembros = (nombre, tipo) => {
    if (!tipo || !ts.isTypeLiteralNode(tipo)) return;
    for (const m of tipo.members) {
      if (!ts.isPropertySignature(m) || !m.name) continue;
      out.push({
        fn: nombre,
        prop: m.name.getText(sf),
        tipo: m.type ? m.type.getText(sf).replace(/\s+/g, ' ').trim() : '(sin tipo)',
        opcional: !!m.questionToken,
      });
    }
  };
  const visitar = (n) => {
    if (ts.isFunctionDeclaration(n) && n.name) {
      for (const p of n.parameters) miembros(n.name.text, p.type);
    }
    if (ts.isInterfaceDeclaration(n) && n.name) {
      for (const m of n.members) {
        if (!ts.isPropertySignature(m) || !m.name) continue;
        out.push({
          fn: n.name.text,
          prop: m.name.getText(sf),
          tipo: m.type ? m.type.getText(sf).replace(/\s+/g, ' ').trim() : '(sin tipo)',
          opcional: !!m.questionToken,
        });
      }
    }
    n.forEachChild(visitar);
  };
  visitar(sf);
  return out;
}

const FICHEROS_DE_LA_PUERTA = [
  'src/integrations/whatsappTemplates.ts',
  'src/integrations/whatsappNotifications.ts',
];

test('SCRUM-931 · 🔴 SUELO: el lector de tipos VE las propiedades que ya existen', () => {
  for (const rel of FICHEROS_DE_LA_PUERTA) {
    const props = propiedadesDeclaradas(rel);
    assert.ok(props.length >= 8,
      `🔴 SUELO: en ${rel} el lector solo ve ${props.length} propiedades declaradas. `
      + 'Cero o casi cero es «no supe mirar», y el trinquete de abajo sería un verde vacío.');
    assert.ok(props.some((p) => p.prop === 'customerName'),
      `🔴 SUELO: el lector no ve \`customerName\` en ${rel}, que existe. Su cuenta no significa nada.`);
  }
});

test('SCRUM-931 · 🔴 LA PUERTA: ninguna plantilla acepta el importe YA formateado', () => {
  const culpables = [];
  for (const rel of FICHEROS_DE_LA_PUERTA) {
    for (const p of propiedadesDeclaradas(rel)) {
      if (/WithCurrency$/.test(p.prop)) culpables.push(`${rel} · ${p.fn}.${p.prop}: ${p.tipo}`);
    }
  }
  assert.deepEqual(culpables, [],
    '🔴 queda una propiedad que recibe el importe YA FORMATEADO:\n  '
    + culpables.join('\n  ')
    + '\n  Mientras el tipo sea `string`, formatear es una COSTUMBRE del llamante, y el octavo sitio\n'
    + '  la romperá sin que nada caiga. Tiene que ser `amount: number` + `currency: string`, y el\n'
    + '  formato salir de `formatMoneyEs` DENTRO. Entonces el compilador cierra la puerta.');
});

test('SCRUM-931 · 🔴 LA PUERTA: el importe entra como NÚMERO en los cuatro builders', () => {
  const props = propiedadesDeclaradas('src/integrations/whatsappTemplates.ts');
  for (const b of BUILDERS) {
    const amount = props.find((p) => p.fn === b.nombre && p.prop === 'amount');
    assert.ok(amount, `🔴 ${b.nombre} no declara \`amount\`: el importe sigue llegando de otra forma.`);
    assert.equal(amount.tipo, 'number',
      `🔴 ${b.nombre}.amount es \`${amount.tipo}\` y tiene que ser \`number\`. Una cadena vuelve a `
      + 'dejar el formato en manos del llamante, que es el defecto entero.');
    const currency = props.find((p) => p.fn === b.nombre && p.prop === 'currency');
    assert.ok(currency, `🔴 ${b.nombre} no declara \`currency\`: sin divisa, formatear dentro adivina.`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// Y QUE NADIE SE LA SALTE — los SIETE productores + el correo
// ═════════════════════════════════════════════════════════════════════════════════════════

// Los siete que construían la cadena a mano, medidos por AST el 17-sep-2026, más el correo, que es
// el TERCER canal y entra en el alcance. Se escribe a mano y NO se deriva de un grep: una lista
// derivada del defecto desaparece sola cuando el defecto se arregla, y entonces el guard dejaría de
// vigilar los sitios que acaba de limpiar (criterio de SCRUM-645).
const PRODUCTORES = [
  'src/modules/quotes/domain/sendQuote.service.ts',
  'src/modules/quotes/domain/reminder.service.ts',
  'src/modules/billing/domain/invoiceWhatsApp.service.ts',
  'src/modules/billing/domain/invoiceReminder.service.ts',
  'src/modules/system/app/routes/invoicesAdmin.routes.ts',
  'src/modules/billing/app/routes/psp.routes.ts',
  'src/modules/billing/app/routes/mpWebhook.routes.ts',
];

// 🔴 EL CORREO VA APARTE, Y NO ES UN DESCUIDO. Es el TERCER canal y entra en el alcance, pero NO
// tiene builder de plantilla al que ponerle un tipo: su importe se interpola en el HTML del correo
// (`renderEmailLayout`), y la llamada se llama `enviarPorResend`. El lector de arriba —que busca
// `build*`/`notify*`/`send*`— NO LO VE, y su suelo lo dijo en rojo en vez de dar un verde vacío.
// Por eso el correo lleva su propia comprobación: aquí la puerta no la puede cerrar el compilador,
// así que la cierra este guard, y se dice en voz alta que es una garantía MÁS DÉBIL que la del tipo.
const CORREO = 'src/modules/messaging/domain/email.service.ts';

/** Toda llamada a un `build*`/`notify*`/`send*` con un objeto literal, y sus propiedades con su texto. */
function argumentosDePlantilla(rel) {
  const fuente = leer(rel);
  const sf = ts.createSourceFile(path.basename(rel), fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const out = [];
  const visitar = (n) => {
    if (ts.isCallExpression(n)) {
      const callee = n.expression.getText(sf);
      if (/^(build|notify|send)[A-Z]/.test(callee.replace(/^.*\./, ''))) {
        for (const arg of n.arguments) {
          if (!ts.isObjectLiteralExpression(arg)) continue;
          for (const pr of arg.properties) {
            if (!pr.name) continue;
            out.push({ callee, prop: pr.name.getText(sf), texto: pr.getText(sf), linea:
              sf.getLineAndCharacterOfPosition(pr.getStart(sf)).line + 1 });
          }
        }
      }
    }
    n.forEachChild(visitar);
  };
  visitar(sf);
  return out;
}

/** Un `template: buildX({…})` YA se cuenta en la visita a ese `buildX`. Sin esto, el mismo sitio
 *  sale dos veces y el informe del guard deja de ser un censo. */
const NOMBRES_DE_BUILDER = /\bbuild(QuoteDecision|PaymentRequest|PaymentConfirmationInvoice|PaymentConfirmation)\s*\(/;

test('SCRUM-931 · 🔴 SUELO: el lector encuentra la llamada de plantilla en los siete productores', () => {
  // Sin este suelo, un fichero renombrado dejaría el trinquete de abajo en verde por no ver nada.
  for (const rel of PRODUCTORES) {
    const args = argumentosDePlantilla(rel);
    assert.ok(args.length > 0,
      `🔴 SUELO: en ${rel} el lector no ve ninguna llamada a un \`build*\`/\`notify*\`/\`send*\` con `
      + 'objeto literal. O el fichero cambió de forma, o el lector está ciego: en los dos casos su '
      + 'verde no vale.');
  }
});

test('SCRUM-931 · 🔴 TRINQUETE: ningún productor formatea el importe por su cuenta', () => {
  const culpables = [];
  for (const rel of PRODUCTORES) {
    for (const a of argumentosDePlantilla(rel)) {
      // Solo el ARGUMENTO de la llamada, no el fichero entero: los `CustomerEvent` del panel
      // siguen con su `toFixed` a propósito (alcance decidido) y no son de este ticket.
      if (NOMBRES_DE_BUILDER.test(a.texto)) continue; // ya contado en su propia visita
      if (/toFixed|WithCurrency/.test(a.texto)) {
        culpables.push(`${rel}:${a.linea} · ${a.callee}({ ${a.prop} })`);
      }
    }
  }
  assert.deepEqual(culpables, [],
    '🔴 hay productores que siguen escribiendo el importe a mano camino de una plantilla:\n  '
    + culpables.join('\n  ')
    + '\n  Cada uno es una aritmética del formato propia, y es así como el mismo presupuesto sale\n'
    + '  «419,87 €» por texto libre y «419.87 EUR» por plantilla, al mismo cliente y el mismo día.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL TERCER CANAL — el correo, que el ticket no contemplaba y entra en el alcance
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-931 · 🔴 SUELO: el correo se está leyendo de verdad', () => {
  const fuente = leer(CORREO);
  assert.ok(fuente.length > 2000, `🔴 SUELO: ${CORREO} son ${fuente.length} bytes: no se está leyendo.`);
  assert.ok(fuente.includes('renderEmailLayout'),
    `🔴 SUELO: ${CORREO} ya no arma el correo con \`renderEmailLayout\`; este guard mira otra cosa.`);
  assert.ok(/quote\.total/.test(fuente),
    `🔴 SUELO: ${CORREO} ya no toca \`quote.total\`; su importe salió de aquí y este guard está ciego.`);
});

test('SCRUM-931 · 🔴 el correo manda el importe en la forma de la casa', () => {
  const fuente = leer(CORREO);
  const aMano = [...fuente.matchAll(/^.*\.toFixed\(2\)\}\s*\$\{[^}]*currency[^}]*\}.*$/gm)].map((m) => m[0].trim());
  assert.deepEqual(aMano, [],
    '🔴 el correo sigue componiendo el importe a mano:\n  ' + aMano.join('\n  ')
    + `\n  Es el mismo presupuesto y el mismo cliente que en WhatsApp: si el correo dice «419.87 EUR»\n`
    + '  y la plantilla dice «419,87 €», el arreglo solo ha movido la divergencia de canal.');
  assert.ok(/formatMoneyEs\s*\(/.test(fuente),
    `🔴 ${CORREO} no llama a \`formatMoneyEs\`: su importe no sale de la función única.`);
});
