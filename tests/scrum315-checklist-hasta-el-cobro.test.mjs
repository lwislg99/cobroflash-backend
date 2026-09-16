// SCRUM-315 (D4) · EL CHECKLIST LLEGA HASTA DONDE LLEGA EL DINERO.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// QUÉ CAMBIA, Y QUÉ NO
//
// El checklist **no se rehace: se amplía**. Lo que ya hacía mejor que nadie —cada paso dice PARA
// QUÉ SIRVE— se conserva, y los tres nuevos lo llevan también. Acababa en «crea tu primer
// presupuesto», que es la mitad del camino: un presupuesto sin firmar no prueba nada, y un
// trabajo sin cobrar no ha terminado.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LA REGLA QUE NO SE RELAJA
//
// Un paso cuyo mecanismo NO EXISTE no se pinta. Ni gris, ni «próximamente», ni tachado: un
// checklist con pasos que no se pueden completar entrena al usuario a ignorarlo entero — y
// entonces deja de servir también para los que sí puede hacer.
//
// Por eso «Carga tus precios» entra **después de comprobarlo**, no porque nos lo digan: hay ruta
// (`/admin/products/load-catalog`) y botón en `productsView`. Medido aquí abajo.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// Y EL CASO QUE DECIDE: SI EL MECANISMO DE COMPROBAR FALLA, EL PASO NO SE MARCA
//
// Un checklist que se marca solo por error le dice al profesional que ya está listo cuando no lo
// está. Entre los dos errores posibles —pedirle algo que ya hizo, o darle por hecho algo que no—
// solo el segundo le hace daño: se va a la calle creyendo que puede cobrar.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (...p) => fs.readFileSync(path.join(RAIZ, ...p), 'utf8');
const homeView = leer('public', 'dashboard', 'js', 'homeView.js');

/** Ejecuta la lista de pasos REAL del dashboard con los datos que se le den. */
function pasosDe(merchant, data) {
  const m = homeView.match(/const steps = (\[[\s\S]*?\n {2}\]);/);
  assert.ok(
    m,
    '🔴 no encuentro la lista de pasos en homeView.js. Si cambió de forma, este fichero dejaría ' +
      'de comprobar nada y pasaría en verde: por eso falla aquí en vez de seguir.',
  );
  return new Function('merchant', 'data', `return ${m[1]};`)(merchant, data);
}

const MERCHANT_COMPLETO = {
  logoUrl: 'x', iban: 'ES00', bizumPhone: null, whatsappPhone: '34600',
  googleReviewUrl: 'x', taxId: 'B1', address: 'c/ x',
};
const DATOS_TODO_HECHO = {
  recentActivity: [{ id: 1 }],
  onboarding: { precios: true, firma: true, cobro: true },
};

const NUEVOS = [
  ['Carga tus precios', 'Para que un presupuesto salga en 30 segundos', 'precios'],
  ['Que tu cliente firme un presupuesto', 'Es tu prueba si luego dice que no lo pidió', 'firma'],
  ['Cobra tu primer trabajo', 'Bizum, tarjeta o transferencia, desde el mismo enlace', 'cobro'],
];

// ═════════════════════════════════════════════════════════════════════════════════════════
// 1 · LOS TRES PASOS NUEVOS, CON SU LÍNEA DE PARA-QUÉ
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-315 · SUELO: la lista de pasos se lee y trae los de siempre MÁS los nuevos', () => {
  const pasos = pasosDe(MERCHANT_COMPLETO, DATOS_TODO_HECHO);
  assert.ok(pasos.length >= 9,
    `🔴 ESCÁNER CIEGO: veo ${pasos.length} pasos y con los tres nuevos son 9. No se está leyendo la lista real.`);
  // El checklist NO se rehace: los de antes siguen ahí.
  for (const viejo of ['Añade tu logo', 'Configura cómo cobras', 'Conecta tu WhatsApp',
    'Completa NIF y dirección', 'Crea tu primer presupuesto']) {
    assert.ok(pasos.some((p) => p.label === viejo), `🔴 ha desaparecido un paso que ya existía: «${viejo}»`);
  }
});

test('SCRUM-315 · los tres nuevos llevan el texto aprobado Y su para-qué (regla 30)', () => {
  const pasos = pasosDe(MERCHANT_COMPLETO, DATOS_TODO_HECHO);
  for (const [label, hint] of NUEVOS) {
    const paso = pasos.find((p) => p.label === label);
    assert.ok(paso, `🔴 falta el paso «${label}»`);
    assert.equal(
      paso.hint, hint,
      `🔴 «${label}» sin su línea de para-qué, o cambiada. Eso es lo que este checklist hace mejor ` +
        'que el del competidor: decir para qué sirve cada paso, no solo mandarlo.',
    );
  }
});

test('SCRUM-315 · el orden acaba en el cobro', () => {
  // No es estético: el último paso es el mensaje. Acabar en «crea un presupuesto» dice que el
  // producto termina ahí.
  const pasos = pasosDe(MERCHANT_COMPLETO, DATOS_TODO_HECHO);
  assert.equal(pasos[pasos.length - 1].label, 'Cobra tu primer trabajo');
  assert.ok(
    pasos.findIndex((p) => p.label === 'Que tu cliente firme un presupuesto')
      > pasos.findIndex((p) => p.label === 'Crea tu primer presupuesto'),
    '🔴 firmar va DESPUÉS de crear: es el orden del oficio',
  );
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 2 · EL CASO QUE DECIDE · un fallo del mecanismo NO marca el paso
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-315 · si la señal NO llega, el paso se pinta como NO hecho', () => {
  // Las cuatro formas de que el mecanismo falle: sin bloque, bloque vacío, valor nulo, y valor
  // que no es booleano (una respuesta a medias, un endpoint viejo, un cálculo roto).
  const rotos = [
    ['sin bloque onboarding', { recentActivity: [{ id: 1 }] }],
    ['bloque vacío', { recentActivity: [{ id: 1 }], onboarding: {} }],
    ['valores nulos', { recentActivity: [{ id: 1 }], onboarding: { precios: null, firma: null, cobro: null } }],
    ['valores que no son booleanos', { recentActivity: [{ id: 1 }], onboarding: { precios: 'sí', firma: 1, cobro: {} } }],
  ];
  for (const [caso, data] of rotos) {
    const pasos = pasosDe(MERCHANT_COMPLETO, data);
    for (const [label] of NUEVOS) {
      const paso = pasos.find((p) => p.label === label);
      assert.equal(
        paso.done, false,
        `🔴 «${label}» se marca como HECHO con ${caso}. Un checklist que se marca solo por error le ` +
          'dice al profesional que ya está listo cuando no lo está — y se va a la calle creyendo ' +
          'que puede cobrar.',
      );
    }
  }
});

test('SCRUM-315 · CONTROL: con la señal en true, el paso SÍ se marca', () => {
  // El otro lado: sin esto, «no marcar nunca» pasaría los tests de arriba y el checklist no
  // se completaría jamás.
  const pasos = pasosDe(MERCHANT_COMPLETO, DATOS_TODO_HECHO);
  for (const [label] of NUEVOS) {
    assert.equal(pasos.find((p) => p.label === label).done, true, `🔴 «${label}» no se marca ni estando hecho`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 3 · LOS MECANISMOS EXISTEN · un paso que no se puede completar no se pinta
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-315 · «Carga tus precios» tiene mecanismo REAL (medido, no supuesto)', () => {
  // La condición que el fundador puso para que este paso entre. Se comprueba aquí en vez de
  // creerlo: si mañana desaparece la carga de catálogo, este paso pasa a ser inalcanzable y el
  // checklist entero pierde crédito.
  assert.match(leer('public', 'dashboard', 'js', 'productsView.js'), /\/admin\/products\/load-catalog/,
    '🔴 no hay forma de cargar precios desde la interfaz: entonces ese paso NO se puede pintar');
  assert.match(leer('src', 'modules', 'products', 'app', 'routes', 'products.routes.ts'), /load-catalog/,
    '🔴 la ruta de carga de catálogo no existe en el backend');
});

test('SCRUM-315 · las tres señales se MIDEN en el backend, y con el criterio correcto', () => {
  const metrics = leer('src', 'modules', 'metrics', 'domain', 'metrics.service.ts');
  assert.match(metrics, /onboarding: \{ precios: .*firma: .*cobro: /,
    '🔴 el backend no manda las señales del checklist');
  // Firmar NO es aceptar: el valor del paso está en la firma, que es la prueba.
  assert.match(metrics, /signatureUrl: \{ not: null \}/,
    '🔴 «que tu cliente firme» se está midiendo con otra cosa que no es la firma');
  assert.match(metrics, /status: 'paid'/, '🔴 «cobra tu primer trabajo» no se mide con un cobro pagado');
  assert.match(metrics, /prisma\.product\.count/, '🔴 «carga tus precios» no se mide con los productos del merchant');
});

test('SCRUM-315 · cada paso nuevo lleva a una vista que existe', () => {
  // Un paso que no se puede completar porque su botón no lleva a ninguna parte es el mismo
  // defecto con otra cara.
  const pasos = pasosDe(MERCHANT_COMPLETO, DATOS_TODO_HECHO);
  const vistas = leer('public', 'dashboard', 'js', 'app.js');
  for (const [label] of NUEVOS) {
    const { action } = pasos.find((p) => p.label === label);
    assert.ok(action, `🔴 «${label}» no tiene destino`);
    assert.ok(vistas.includes(`'${action}'`) || vistas.includes(`"${action}"`),
      `🔴 «${label}» apunta a la vista «${action}», que no está registrada en el router del dashboard`);
  }
});
