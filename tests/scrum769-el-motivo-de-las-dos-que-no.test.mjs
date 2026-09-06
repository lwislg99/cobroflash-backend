// tests/scrum769-el-motivo-de-las-dos-que-no.test.mjs — SCRUM-769
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA FIRMA DEL FUNDADOR, SUJETA: DOS LISTAS LLEVAN «N» Y DOS NO, Y LAS DOS QUE NO LLEVAN SU MOTIVO.
//
//   · Trabajos → SÍ. Rótulo «Nuevo trabajo»
//   · Gastos   → SÍ. Rótulo «Nuevo gasto»
//   · Productos y Proveedores → NO, y su rótulo NO se toca.
//
// El motivo, con las palabras del fundador (6-sep-2026):
//
//     «Colgar N de un botón que confirma es atar una tecla a un guardado. N abre, no guarda.»
//
// 🔴 POR QUÉ ESTE FICHERO EXISTE: sin el motivo escrito EN LAS DOS PANTALLAS, el siguiente que
// pase ve dos listas con botón primario y sin atajo, lo lee como un hueco y lo «arregla». Este
// guard sujeta las dos mitades: que el motivo esté, y que las dos sigan SIN registrar.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { aprobacionesDeMicrocopy, constaAprobado } from './_microcopy-aprobada.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR_JS = path.join(RAIZ, 'public/dashboard/js');
const leer = (f) => fs.readFileSync(path.join(DIR_JS, f), 'utf8');

const DATOS = (url) => {
  const u = String(url || '');
  if (u.includes('/admin/merchant')) return { id: 1, name: 'QA' };
  if (/\/admin\/products\b/.test(u)) return { ok: true, items: [{ id: 1, name: 'Grifo', price: 100, cost: 60, description: '', providerId: null, itemKind: null, active: true }] };
  if (/\/admin\/providers\b/.test(u)) return { ok: true, items: [{ id: 1, name: 'Prov QA', phone: '', email: '', notes: '' }] };
  return [];
};

async function montar(fn) {
  const banco = cargarDashboard(RAIZ, { datos: DATOS });
  const r = await pintarVista(banco, fn);
  assert.equal(r.error, null, `🔴 ${fn} no monta: ${r.error && r.error.message}`);
  return {
    registradas: banco.ctx.atajoNuevo.vistasConAtajo(),
    teclas: todos(r.contenedor).filter((n) => n.tagName === 'KBD').length,
  };
}

// ═══ ① LOS DOS RÓTULOS FIRMADOS, CARÁCTER A CARÁCTER ════════════════════════════════════════

test('SCRUM-769 · los dos rótulos son EXACTAMENTE los firmados', () => {
  const FIRMA = { jobs: 'Nuevo trabajo', expenses: 'Nuevo gasto' };
  const lineas = leer('atajoNuevo.js').split('\n');
  for (const [clave, firmado] of Object.entries(FIRMA)) {
    const l = lineas.find((x) => x.trim().startsWith(clave + ':'));
    assert.ok(l, `🔴 la ranura «${clave}» ya no está en TEXTOS.`);
    const t = l.slice(l.indexOf('"') + 1, l.lastIndexOf('"'));
    assert.equal(t, firmado,
      `🔴 el rótulo de «${clave}» ya no es el firmado. Es ${JSON.stringify(t)} y la firma dice `
      + `${JSON.stringify(firmado)}. El microcopy lo aprueba el fundador (regla 30): no se retoca `
      + '«de paso».');
  }
  // Y la cuenta, para que un espacio de más no pase por igual.
  assert.equal([...FIRMA.jobs].length, 13, '🔴 «Nuevo trabajo» son 13 caracteres.');
  assert.equal([...FIRMA.expenses].length, 11, '🔴 «Nuevo gasto» son 11 caracteres.');
});

test('SCRUM-769 · 🔴 el registro de microcopy declara firmados EXACTAMENTE los dos', () => {
  // ═════════════════════════════════════════════════════════════════════════════════════════
  // 🔴 EL DEFECTO QUE ESTO SUJETA, y que ya ocurrió: al corregir el registro para decir que el
  // fundador RETIRÓ tres firmas, la cabecera de su tabla dejó de llamarse «Texto aprobado». El
  // extractor de `_microcopy-aprobada.mjs` sólo lee ESA columna, así que se llevó por delante a
  // los DOS que sí siguen firmados —y `constaAprobado('Nuevo trabajo')` pasó a contestar «no».
  // Nadie lo habría notado: ningún guard preguntaba por estos dos.
  //
  // La forma correcta es la que hay hoy: DOS tablas. La de los firmados encabeza «Texto
  // aprobado»; la de los retirados, NO —y por eso no cuentan, que es lo que dejaron de ser—.
  // ═════════════════════════════════════════════════════════════════════════════════════════
  const NOMBRE = '2026-09-06-SCRUM-769-las-cinco-pantallas.md';
  const reg = aprobacionesDeMicrocopy().find((a) => a.nombre === NOMBRE);
  assert.ok(reg, `🔴 CIEGO: el registro «${NOMBRE}» no aparece en el barrido de microcopy.`);

  assert.equal(reg.firmante, 'fundador',
    '🔴 el registro ha dejado de llevar la firma del fundador FUERA de las citas (regla 30). '
    + 'SCRUM-726 lo tumba entero, y con razón: sin esa línea sus literales no cuentan.');

  assert.deepEqual(reg.literales, ['Nuevo trabajo', 'Nuevo gasto'],
    '🔴 el registro ya no declara EXACTAMENTE los dos rótulos firmados.\n'
    + '  · Si FALTAN: la corrección de la firma se ha llevado por delante a los que sí lo están.\n'
    + '  · Si SOBRAN: los tres RETIRADOS han vuelto a la tabla de «Texto aprobado» por la puerta\n'
    + '    de atrás, o una cita `>` de prosa se está leyendo como un literal firmado.');

  // Y el cruce, por si la lista de arriba cambiara de forma: quién consta y quién no.
  for (const t of ['Nuevo trabajo', 'Nuevo gasto']) {
    assert.ok(constaAprobado(t).includes(`docs/microcopy/${NOMBRE}`),
      `🔴 «${t}» está FIRMADO y ya no consta aprobado en su propio registro.`);
  }
  for (const t of ['Nuevo producto', 'Nuevo proveedor', 'Nuevo albarán']) {
    assert.deepEqual(constaAprobado(t), [],
      `🔴 «${t}» consta APROBADO y el fundador RETIRÓ su firma el 6-sep-2026. Un registro que `
      + 'dice «aprobado» sobre un texto sin firma es justo lo que este directorio existe para '
      + 'impedir.');
  }
});

// ═══ ② QUIÉN REGISTRA Y QUIÉN NO — sobre las vistas REALES ══════════════════════════════════

test('SCRUM-769 · 🔴 Trabajos y Gastos registran la «N», por el MISMO mecanismo', async () => {
  for (const [fn, vista] of [['renderJobsView', 'jobs'], ['renderExpensesView', 'expenses']]) {
    const m = await montar(fn);
    assert.deepEqual(m.registradas, [vista],
      `🔴 ${fn} ya no registra destino para la «N»: el atajo no abriría nada ahí.`);
    assert.equal(m.teclas, 1,
      `🔴 ${fn} pinta ${m.teclas} teclas y debía pintar UNA. El atajo funcionaría y el `
      + 'profesional no se enteraría de que existe.');
  }
  // Y que sea EL MISMO mecanismo, no un segundo: las dos pasan por la pieza.
  for (const f of ['jobsView.js', 'expensesView.js']) {
    const src = leer(f);
    assert.match(src, /window\.atajoNuevo\.registrar\(/, `🔴 ${f} ya no usa \`registrar\` de la pieza.`);
    assert.match(src, /window\.atajoNuevo\.etiquetar\(/,
      `🔴 ${f} ya no usa \`etiquetar\`: si monta su propia tecla, el día que la pieza cambie de `
      + 'forma esta pantalla se queda atrás. Es el defecto que SCRUM-768 quitó de `invoicesView`.');
  }
});

test('SCRUM-769 · 🔴 Productos y Proveedores NO registran, y es a propósito', async () => {
  for (const fn of ['renderProductsView', 'renderProvidersView']) {
    const m = await montar(fn);
    assert.deepEqual(m.registradas, [],
      `🔴 ${fn} HA REGISTRADO la «N». La firma del fundador dice que NO: su botón primario no `
      + 'ABRE un alta, la CONFIRMA — el formulario está siempre visible y ese botón es su envío. '
      + 'Atar la tecla ahí haría que la «N» intentara crear con lo que hubiera escrito.');
    assert.equal(m.teclas, 0, `🔴 ${fn} pinta una tecla «N» y no tiene atajo: promete lo que no hace.`);
  }
});

// ═══ ③ EL MOTIVO, ESCRITO EN LAS DOS PANTALLAS ══════════════════════════════════════════════

test('SCRUM-769 · 🔴 las dos que NO lo llevan dicen POR QUÉ, en su propio fichero', () => {
  // La frase del fundador, sujeta literal: es la que explica la decisión, y sin ella el comentario
  // se queda en «no lo lleva» — que es justo lo que el siguiente lee como hueco.
  const FRASE = 'N abre, no guarda';
  for (const f of ['productsView.js', 'providersView.js']) {
    const src = leer(f);
    assert.match(src, /NO\*\* LLEVA EL ATAJO|NO LLEVA EL ATAJO/,
      `🔴 ${f} ya no dice que NO lleva el atajo «N». Sin ese aviso, quien pase lo ve como un hueco `
      + 'y lo «arregla»: le cuelga la tecla a un botón que guarda.');
    assert.ok(src.includes(FRASE),
      `🔴 ${f} ha perdido el motivo del fundador («…${FRASE}»). Un «no lo lleva» sin porqué no `
      + 'sobrevive a la siguiente sesión.');
    assert.match(src, /SCRUM-769/, `🔴 ${f} ya no cita el ticket donde vive la decisión.`);
  }
});

// ═══ ④ CONTROL POSITIVO · las que ya lo tenían lo siguen teniendo ═══════════════════════════

test('SCRUM-769 · CONTROL POSITIVO: las CUATRO que ya tenían «N» la conservan', async () => {
  for (const [fn, vista] of [
    ['renderQuotesListView', 'quotes-list'],
    ['renderInvoicesView', 'invoices'],
    ['renderCustomersView', 'customers'],
    ['renderAlbaranesView', 'albaranes'],
  ]) {
    const m = await montar(fn);
    assert.ok(m.registradas.includes(vista),
      `🔴 «${vista}» ha perdido su atajo. Este ticket AÑADE dos; no puede quitar ninguna.`);
  }
});

// ═══ ⑤ EL RESPALDO DE `app.js`, CARACTERIZADO — no juzgado ══════════════════════════════════

test('SCRUM-769 · 🔴 en una vista SIN atajo la «N» NO se queda quieta: cae al respaldo', () => {
  // ═════════════════════════════════════════════════════════════════════════════════════════
  // 🔴 ESTO ES UNA CARACTERIZACIÓN, NO UNA APROBACIÓN, y por eso está escrito aquí.
  //
  // El encargo de SCRUM-769 daba por hecho que «pulsar N en Productos y en Proveedores NO HACE
  // NADA». MEDIDO con teclado real ejecutando el despacho de `app.js`: **abre la cotización
  // rápida**. No hace nada DE ESA PANTALLA, pero hace algo.
  //
  // No es un defecto nuevo: es el respaldo que SCRUM-599 dejó a propósito —«quitarlo sería
  // retirarle un atajo a quien ya lo usa»— y afecta a TODA vista sin destino registrado, no sólo
  // a estas dos. Retirarlo es una decisión de producto que no es de este ticket.
  //
  // Se fija aquí para que el día que se decida, alguien tenga que venir a cambiar este test —y no
  // pueda cambiarse el comportamiento en silencio.
  // ═════════════════════════════════════════════════════════════════════════════════════════
  const app = fs.readFileSync(path.join(DIR_JS, 'app.js'), 'utf8');
  const i = app.indexOf("document.addEventListener('keydown'");
  assert.ok(i >= 0, '🔴 CIEGO: no encuentro el manejador del atajo en `app.js`.');
  assert.equal(app.indexOf("document.addEventListener('keydown'", i + 1), -1,
    '🔴 hay MÁS DE UN manejador de keydown en `app.js`: el ticket exige UN mecanismo, no dos.');
  const bloque = app.slice(i, app.indexOf('\n  });', i));
  assert.match(bloque, /openQuickQuoteModal/,
    '🔴 el respaldo de la cotización rápida ha desaparecido del despacho.\n'
    + '  Si ha sido una decisión, bien: entonces la «N» en una vista sin atajo ya NO hace nada, y\n'
    + '  hay que reescribir esta caracterización diciendo quién lo decidió y cuándo.\n'
    + '  Si no lo ha sido, se le acaba de quitar el atajo a quien lo usaba desde antes de SCRUM-599.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 LAS MUTACIONES QUE ME TUMBAN (contrato de SCRUM-745)
// ═════════════════════════════════════════════════════════════════════════════════════════════
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // Se le cuelga la «N» al botón que CONFIRMA — el defecto que la firma prohíbe.
    fichero: 'public/dashboard/js/providersView.js',
    de: '    const createBtn = form.querySelector("#pf-create-provider");',
    a: '    const createBtn = form.querySelector("#pf-create-provider");\n    if (window.atajoNuevo) window.atajoNuevo.registrar("providers", () => createBtn.click());',
    cae: 'Productos y Proveedores NO registran, y es a propósito',
  },
  {
    // La puerta de atrás: los tres RETIRADOS vuelven a «Texto aprobado» con un cambio de cabecera.
    fichero: 'docs/microcopy/2026-09-06-SCRUM-769-las-cinco-pantallas.md',
    de: '| Ranura | Rótulo que se queda | Texto que se propuso | por qué se retira |',
    a: '| Ranura | Rótulo que se queda | Texto aprobado | por qué se retira |',
    cae: 'el registro de microcopy declara firmados EXACTAMENTE los dos',
  },
  {
    // Alguien borra el motivo por «limpieza»: el hueco vuelve a parecer un hueco.
    fichero: 'public/dashboard/js/productsView.js',
    de: '    //     «Colgar N de un botón que confirma es atar una tecla a un guardado. N abre, no guarda.»',
    a: '    //',
    cae: 'las dos que NO lo llevan dicen POR QUÉ, en su propio fichero',
  },
];
