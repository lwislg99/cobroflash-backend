// tests/scrum390-puerta-cliente-real.test.mjs — SCRUM-390 · la cláusula deja de ser prosa.
//
// «El día que entre el primer cliente real» era una condición escrita en un documento que **nadie
// evalúa**. Un aviso no impide nada, y el día que llegue nadie va a releer el máster.
//
// Aquí hay dos mitades:
//   ① el CENSO de las cláusulas, derivado de los documentos — si no encuentra ninguna, FALLA;
//   ② el EVALUADOR de las dos señales, probado con datos sintéticos (no necesita base).
//
// La tercera pieza —leer el padrón real— vive en `scripts/puerta-cliente-real.mjs`, porque exige
// una base y esto corre en `npm test`.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  evaluarPuerta, textoDelAviso, CUENTAS_DE_PRUEBA_DECLARADAS,
} from '../dist/modules/system/domain/puertaClienteReal.js';

const RAIZ = path.resolve(import.meta.dirname, '..');

/** Las cláusulas, DERIVADAS de los documentos: fichero + línea + el texto que las nombra. */
const PATRON = /(CADUCA con el primer cliente real|el día que entre el primer cliente real|caduca con el primer cliente real|primer cliente real)/i;
const DOCUMENTOS = ['docs/YAQU_MASTER.md', 'docs/MIGRATIONS_PENDING.md'];

function censarClausulas() {
  const out = [];
  for (const rel of DOCUMENTOS) {
    const p = path.join(RAIZ, rel);
    if (!fs.existsSync(p)) continue;
    fs.readFileSync(p, 'utf8').split('\n').forEach((linea, i) => {
      if (PATRON.test(linea)) out.push({ ruta: rel, linea: i + 1 });
    });
  }
  return out;
}

const CLAUSULAS = censarClausulas();

// ── SUELO ────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-390 · SUELO: el censo ENCUENTRA cláusulas', () => {
  assert.ok(CLAUSULAS.length >= 1,
    '🔴 el censo no ha encontrado ninguna cláusula. **«No quedan cláusulas» y «no supe leerlas» ' +
    'dan el mismo verde**, y el segundo deja el proyecto sin la única señal de que ese día llegó.\n\n' +
    '  Si de verdad se han reescrito todas, este guard sobra y hay que retirarlo DICIÉNDOLO — no ' +
    'dejarlo pasando en verde sobre cero.');
  assert.ok(CLAUSULAS.every((c) => DOCUMENTOS.includes(c.ruta)));
});

test('SCRUM-390 · SUELO: sin documentos, el censo no dice «todo bien»', () => {
  // El detector no puede devolver cero tranquilizador cuando no encuentra dónde mirar.
  const original = DOCUMENTOS.slice();
  const inexistentes = ['docs/NO_EXISTE_1.md'];
  const antes = CLAUSULAS.length;
  DOCUMENTOS.length = 0; DOCUMENTOS.push(...inexistentes);
  const vacio = censarClausulas();
  DOCUMENTOS.length = 0; DOCUMENTOS.push(...original);
  assert.equal(vacio.length, 0);
  assert.ok(antes > 0, '🔴 y con los documentos de verdad sí encuentra: si no, el test de arriba no vale.');
});

// ── EL EVALUADOR · las dos señales ───────────────────────────────────────────────────────────

/**
 * Los merchants que HAY hoy en producción, medido (no derivado de la constante).
 *
 * ⚠️ VA COMO LITERAL A PROPÓSITO. La primera versión de este control usaba
 * `CUENTAS_DE_PRUEBA_DECLARADAS` en los dos lados, así que **se movía con la constante y no podía
 * fallar nunca**: bajé el tope a 12 para probar el rojo de la señal ② y el test siguió verde. Un
 * guard medido contra sí mismo no mide nada.
 */
const MERCHANTS_HOY = 13;

test('SCRUM-390 · CONTROL NEGATIVO: el estado de HOY deja la puerta cerrada', () => {
  const v = evaluarPuerta({ total: MERCHANTS_HOY, conSuscripcion: 0 }, CLAUSULAS.map(String));
  assert.equal(v.abierta, false, `🔴 con ${MERCHANTS_HOY} merchants y ninguno pagando la puerta se abre. O ha entrado alguien, o el tope (${CUENTAS_DE_PRUEBA_DECLARADAS}) ya no corresponde a la realidad medida.`);
  assert.deepEqual(v.motivos, []);
  assert.equal(textoDelAviso(v), '', '🔴 con la puerta cerrada no se avisa de nada.');
});

test('SCRUM-390 · ① SEÑAL «PAGA»: un merchant con suscripción abre la puerta', () => {
  const v = evaluarPuerta({ total: CUENTAS_DE_PRUEBA_DECLARADAS, conSuscripcion: 1 }, ['docs/YAQU_MASTER.md:1472']);
  assert.equal(v.abierta, true, '🔴 alguien está pagando y la puerta sigue cerrada.');
  assert.deepEqual(v.motivos, ['paga']);
  // 17-ago-2026 · el MOTIVO se comprueba donde ahora vive: en el mensaje que se ENVÍA.
  // `textoDelAviso` pasó a devolver solo las cláusulas, porque el marco depende de si es apertura o
  // recordatorio — y con el marco dentro las dos formas eran imposibles. El hecho no desaparece:
  // cambia de sitio, y el guard lo sigue.
  assert.match(mensajeParaElFundador(v, { diasDesdeApertura: 0 }), /suscripción de Stripe/);
  assert.match(textoDelAviso(v), /YAQU_MASTER\.md:1472/,
    '🔴 el aviso no NOMBRA las cláusulas que dependían de que no hubiera cliente real. Avisar sin ' +
    'decir de qué es otro aviso que nadie atiende.');
});

test('SCRUM-390 · ② SEÑAL «SON MÁS DE LOS NUESTROS»: un merchant de más abre la puerta', () => {
  // Ésta existe porque la ① no basta: un cliente real EN TRIAL, que aún no ha pagado, no dispara
  // la primera. Fue la objeción que motivó las dos señales.
  const v = evaluarPuerta({ total: CUENTAS_DE_PRUEBA_DECLARADAS + 1, conSuscripcion: 0 }, ['docs/YAQU_MASTER.md:1472']);
  assert.equal(v.abierta, true,
    '🔴 hay más merchants que cuentas de prueba declaradas y la puerta sigue cerrada: un cliente ' +
    'real en trial pasaría sin que nadie se entere.');
  assert.deepEqual(v.motivos, ['mas_de_los_nuestros']);
  assert.match(mensajeParaElFundador(v, { diasDesdeApertura: 0 }), /más merchants que cuentas de prueba/);
});

test('SCRUM-390 · las dos señales a la vez se declaran las dos', () => {
  const v = evaluarPuerta({ total: 99, conSuscripcion: 3 }, ['x']);
  assert.deepEqual(v.motivos, ['paga', 'mas_de_los_nuestros']);
});

test('SCRUM-390 · SUELO del evaluador: un padrón ILEGIBLE no es «no ha entrado nadie»', () => {
  for (const malo of [{}, { total: 'trece', conSuscripcion: 0 }, { total: 13 }, null]) {
    const v = evaluarPuerta(malo, ['x']);
    assert.equal(v.abierta, true,
      `🔴 el padrón ${JSON.stringify(malo)} se ha leído como «no ha entrado nadie». Eso autoriza a ` +
      'seguir tratando los datos de producción como desechables sin haber comprobado nada.');
    assert.match(v.detalle, /no lo sé|no se ha podido leer/);
  }
});

test('SCRUM-390 · el tope de cuentas de prueba está declarado y es un número', () => {
  assert.equal(typeof CUENTAS_DE_PRUEBA_DECLARADAS, 'number');
  assert.ok(CUENTAS_DE_PRUEBA_DECLARADAS > 0 && CUENTAS_DE_PRUEBA_DECLARADAS < 100,
    '🔴 el tope no es un número de cuentas plausible: si sube sin motivo, la segunda señal deja de ' +
    'cazar a nadie.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL ENGANCHE · dónde avisa, y que no pueda tumbar lo que vigila
// ═════════════════════════════════════════════════════════════════════════════════════════

const { debeAvisar, CADENCIA_RECORDATORIO_DIAS, mensajeParaElFundador } =
  await import('../dist/modules/system/domain/puertaClienteReal.js');
const { avisarSiEntroClienteReal, CLAUSULAS_DEPENDIENTES } =
  await import('../dist/modules/system/domain/avisoPuerta.service.js');

/** Un `db` de mentira: dos `count` y un `findFirst`. */
const baseFalsa = (o = {}) => ({
  merchant: {
    count: async (args) => (args?.where?.stripeSubscriptionId ? (o.conSuscripcion ?? 0) : (o.total ?? 13)),
    findFirst: async () => (o.desde ? { createdAt: o.desde } : null),
  },
});

test('SCRUM-390 · la cadencia: día 0 avisa, día 3 no, día 7 recuerda', () => {
  const abierta = { abierta: true, motivos: ['paga'], clausulas: [], detalle: '' };
  assert.equal(debeAvisar(abierta, { diasDesdeApertura: 0 }).avisa, true, '🔴 el día de la apertura no suena');
  assert.equal(debeAvisar(abierta, { diasDesdeApertura: 3 }).avisa, false, '🔴 spamea todos los días');
  assert.equal(debeAvisar(abierta, { diasDesdeApertura: CADENCIA_RECORDATORIO_DIAS }).avisa, true,
    '🔴 no hay recordatorio: un día perdido enterraría el aviso para siempre');
  assert.equal(debeAvisar({ ...abierta, abierta: false }, { diasDesdeApertura: 0 }).avisa, false,
    '🔴 avisa con la puerta cerrada');
});

test('SCRUM-390 · sin fecha de apertura NO se calla', () => {
  // La señal ② (un merchant de más, sin suscripción) no deja fecha. Un aviso de más es barato;
  // uno de menos es el ticket entero.
  const r = debeAvisar({ abierta: true, motivos: ['mas_de_los_nuestros'], clausulas: [], detalle: '' }, { diasDesdeApertura: null });
  assert.equal(r.avisa, true);
  assert.match(r.motivo, /no se sabe desde cuándo/);
});

test('SCRUM-390 · con la puerta cerrada no se manda NADA', async () => {
  let enviados = 0;
  const r = await avisarSiEntroClienteReal({
    db: baseFalsa({ total: 13, conSuscripcion: 0 }), enviar: async () => { enviados++; }, telefono: '34600000000',
  });
  assert.equal(r.abierta, false);
  assert.equal(enviados, 0, '🔴 se ha mandado un WhatsApp con la puerta cerrada: eso es spam al fundador.');
});

test('SCRUM-390 · con la puerta abierta avisa al FUNDADOR, y a nadie más', async () => {
  const mandados = [];
  const r = await avisarSiEntroClienteReal({
    db: baseFalsa({ total: 13, conSuscripcion: 1, desde: new Date() }),
    enviar: async (p) => { mandados.push(p); },
    telefono: '34600000000',
  });
  assert.equal(r.avisado, true, `🔴 la puerta está abierta y no ha avisado (${r.motivo} · ${r.fallo ?? ''})`);
  assert.equal(mandados.length, 1, '🔴 o no manda, o manda más de un mensaje.');
  assert.equal(mandados[0].to, '34600000000');
  assert.equal(mandados[0].merchantId, undefined,
    '🔴 el aviso lleva merchantId: es un mensaje INTERNO, no puede colgar de ningún merchant (regla 28).');
  assert.match(mandados[0].text, /YAQU_MASTER|MIGRATIONS_PENDING/,
    '🔴 el aviso no NOMBRA las cláusulas que quedan sin cumplir.');
  // 17-ago-2026 · APROBADO. Protegía que el texto NO se presentara como aprobado sin estarlo —«la
  // regla 30 no tiene excepción por destinatario»—, y eso es justo lo que se cumplió: pasó por el
  // fundador. El guard no se borra; pasa a exigir la FORMA aprobada, y con ella lo que el marcador
  // nunca pudo vigilar: que apertura y recordatorio digan cosas DISTINTAS.
  assert.match(mandados[0].text, /^🔴 (HA ENTRADO EL PRIMER CLIENTE REAL|LA PUERTA DE CLIENTE REAL SIGUE ABIERTA)/,
    `🔴 el aviso no empieza por ninguna de las dos formas aprobadas. Dice: «${mandados[0].text.slice(0, 60)}…»`);
  assert.ok(!mandados[0].text.includes('[PENDIENTE'),
    '🔴 ha vuelto el marcador al aviso interno.');
});

test('SCRUM-390 · 🔴 si el aviso FALLA, el paso no lanza: devuelve el fallo', async () => {
  // Un vigilante que rompe lo que vigila es peor que no tenerlo: si esto lanzara, tumbaría el
  // cron de mantenimientos y dejaríamos de proponer a los clientes por vigilar una puerta.
  const r = await avisarSiEntroClienteReal({
    db: baseFalsa({ total: 13, conSuscripcion: 1, desde: new Date() }),
    enviar: async () => { throw new Error('meta caída'); },
    telefono: '34600000000',
  });
  assert.equal(r.avisado, false);
  assert.match(r.fallo ?? '', /meta caída/, '🔴 el fallo no se devuelve: se ha perdido.');
});

test('SCRUM-390 · sin teléfono configurado, lo DICE en vez de callar', async () => {
  const r = await avisarSiEntroClienteReal({
    db: baseFalsa({ total: 13, conSuscripcion: 1, desde: new Date() }), enviar: async () => {}, telefono: '',
  });
  assert.equal(r.avisado, false);
  assert.match(r.fallo ?? '', /ALERTA_FUNDADOR_TELEFONO/,
    '🔴 sin número el paso se calla: la puerta abierta quedaría sin avisar y sin decir por qué.');
});

test('SCRUM-390 · 🔴 EL DEFECTO DEL TICKET: la puerta tiene que estar ENGANCHADA a un disparador', () => {
  // Sin esto, el mecanismo entero vuelve a ser lo que vino a arreglar: una condición que nadie
  // evalúa. Si alguien quita el paso del cron, este test cae nombrándolo.
  const cron = fs.readFileSync(path.join(RAIZ, 'src/core/cron/cron.ts'), 'utf8');
  assert.match(cron, /avisarSiEntroClienteReal\(/,
    '🔴 LA PUERTA EXISTE Y NADIE LA EVALÚA. El evaluador está construido y ningún disparador lo ' +
    'llama, que es exactamente el defecto que SCRUM-390 vino a cerrar: una condición sin quien la ' +
    'mire es prosa. Vuelve a engancharlo al cron diario, como paso aparte que no bloquea.');
  assert.ok(CLAUSULAS_DEPENDIENTES.length >= 4,
    '🔴 la lista de cláusulas que el aviso nombra se ha quedado corta.');
  assert.ok(CLAUSULAS_DEPENDIENTES.some((c) => /SCRUM-242/.test(c)),
    '🔴 falta la cláusula de la COPIA DE SEGURIDAD. Medido: cero copias del proveedor, cero propias ' +
    'y ningún camino de restauración. Hoy no urge porque los datos son desechables; el día que la ' +
    'puerta se abra es letal, y además incumplimiento fiscal — es exactamente el tipo de condición ' +
    'que este mecanismo existe para no olvidar.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 LAS DOS FORMAS TIENEN QUE DECIR COSAS DISTINTAS (SCRUM-514, 17-ago-2026)
//
// Este guard nace de su propio rojo: al inyectar «que las dos formas pinten lo mismo», los tests
// de arriba **siguieron en verde** — porque aceptaban CUALQUIERA de las dos formas. Aceptar una u
// otra no es lo mismo que exigir que sean distintas, y la diferencia es todo el ticket: hasta hoy
// el día de la apertura y el recordatorio de la octava semana mandaban EL MISMO mensaje.
//
// Se comprueba sobre el RESULTADO —lo que devuelve la función—, no sobre el fuente: los dos textos
// pueden estar enteros en el `.ts` y aun así salir el mismo por el hilo.
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-514 · 🔴 apertura y recordatorio NO dicen lo mismo, y el recordatorio lleva su día', () => {
  const v = { abierta: true, motivos: ['paga'], clausulas: ['una', 'dos', 'tres', 'cuatro'] };
  const apertura = mensajeParaElFundador(v, { diasDesdeApertura: 0 });
  const recordatorio = mensajeParaElFundador(v, { diasDesdeApertura: 14 });

  assert.notEqual(apertura, recordatorio,
    '🔴 LA APERTURA Y EL RECORDATORIO MANDAN EL MISMO MENSAJE. Es el defecto que SCRUM-514 cerró: ' +
    'al mes, «ha entrado el primer cliente real» se lee como que ha entrado OTRO, y lo que de ' +
    'verdad pasa —que sigue abierta y nadie ha revisado nada— no se dice en ninguna parte.');
  assert.match(apertura, /^🔴 HA ENTRADO EL PRIMER CLIENTE REAL/,
    `🔴 la forma de APERTURA no es la aprobada: «${apertura.split('\n')[0]}»`);
  assert.match(recordatorio, /^🔴 LA PUERTA DE CLIENTE REAL SIGUE ABIERTA — día 14 —/,
    `🔴 la forma de RECORDATORIO no es la aprobada, o ha perdido su día: «${recordatorio.split('\n')[0]}»`);

  // Sin fecha de apertura NO se inventa un número: se dice el hecho sin él. «día null» sería peor
  // que no decirlo, y un 0 diría que acaba de abrirse — justo lo contrario.
  const sinFecha = mensajeParaElFundador(v, { diasDesdeApertura: null });
  assert.match(sinFecha, /^🔴 LA PUERTA DE CLIENTE REAL SIGUE ABIERTA — hay/,
    `🔴 sin fecha de apertura el aviso inventa un día o cambia de forma: «${sinFecha.split('\n')[0]}»`);
  assert.ok(!/día null|día NaN|día undefined/.test(sinFecha), '🔴 el aviso pinta un día que no consta.');

  // Y las cuatro cláusulas viajan en las DOS: son lo que hay que revisar, no un adorno del marco.
  for (const [nombre, texto] of [['apertura', apertura], ['recordatorio', recordatorio]]) {
    for (const c of v.clausulas) {
      assert.ok(texto.includes('  · ' + c), `🔴 la forma de ${nombre} no nombra la cláusula «${c}».`);
    }
  }
});
