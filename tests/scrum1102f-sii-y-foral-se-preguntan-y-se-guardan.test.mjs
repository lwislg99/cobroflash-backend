// tests/scrum1102f-sii-y-foral-se-preguntan-y-se-guardan.test.mjs — SCRUM-1102f
//
// DOS COLUMNAS QUE EXISTÍAN EN LA BASE Y QUE NADIE PREGUNTABA.
//
// `merchants.lleva_libros_por_sii` y `merchants.domicilio_fiscal_foral` se aplicaron el 25-sep-2026
// (docs/sql/scrum-1102-sii-y-domicilio-foral.sql) y no estaban ni en `prisma/schema.prisma` ni en
// ninguna pantalla. Este ticket las PREGUNTA en Configuración y las GUARDA. Nada más: ninguna
// puerta las lee todavía (eso es otro ticket, y toca el camino de emisión).
//
// Lo que se mide, por efecto y de punta a punta:
//   ① el esquema declara lo que el DDL creó: anulables y sin valor por defecto (NULL no es false);
//   ② el viaje por donde entra el PUT (esquema de validación → base) y vuelve por el GET, con los
//      TRES estados de cada columna saliendo distintos;
//   ③ la PANTALLA montada en el banco: pinta lo que hay guardado, y al guardar devuelve lo mismo;
//   ④ los textos: los dos enunciados firmados, tal cual, y las opciones con su propia firma.
// ⛔ Sin red ni base.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import mapa from '../public/dashboard/js/settingsSubmenus.js';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { aprobacionesDeMicrocopy } from './_microcopy-aprobada.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const moduloPrisma = await import('../dist/core/db/prisma.js');
const { merchantProfileUpdateSchema } = await import('../dist/core/validation/schemas.js');
const { getMerchantProfile, updateMerchantProfile } = await import('../dist/modules/system/merchantAdmin.js');

/** Los dos campos: la clave que viaja, la columna de la base y el enunciado FIRMADO (c.17709). */
const CAMPOS = [
  {
    clave: 'llevaLibrosPorSii',
    columna: 'lleva_libros_por_sii',
    pregunta: '¿Llevas los libros de IVA por el SII?',
  },
  {
    clave: 'domicilioFiscalForal',
    columna: 'domicilio_fiscal_foral',
    pregunta: '¿Tienes el domicilio fiscal en el País Vasco o en Navarra?',
  },
];
/** Los tres estados, con lo que la pantalla enseña en cada uno. */
const ESTADOS = [
  { guardado: null, opcion: '' },
  { guardado: true, opcion: 'si' },
  { guardado: false, opcion: 'no' },
];

// ── ① EL ESQUEMA ─────────────────────────────────────────────────────────────────────────────

test('SCRUM-1102f · ① el esquema declara las columnas que el DDL creó: anulables y SIN valor por defecto', () => {
  const sql = fs.readFileSync(path.join(RAIZ, 'docs/sql/scrum-1102-sii-y-domicilio-foral.sql'), 'utf8')
    .split(/\r?\n/).filter((l) => !l.trimStart().startsWith('--')).join('\n');
  const delDdl = [...sql.matchAll(/ADD COLUMN "(\w+)" BOOLEAN\b(?! NOT NULL| DEFAULT)/g)].map((m) => m[1]).sort();
  assert.deepEqual(delDdl, CAMPOS.map((c) => c.columna).sort(),
    '🔴 CIEGO: el DDL de SCRUM-1102 ya no crea exactamente estas dos columnas anulables');

  const schema = fs.readFileSync(path.join(RAIZ, 'prisma/schema.prisma'), 'utf8');
  const merchant = schema.match(/model\s+Merchant\s*\{([\s\S]*?)\n\}/);
  assert.ok(merchant, '🔴 CIEGO: no encuentro `model Merchant` en el esquema');
  const lineas = merchant[1].split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('//'));
  assert.ok(lineas.length > 50, `🔴 CIEGO: solo leo ${lineas.length} líneas del modelo Merchant`);
  for (const c of CAMPOS) {
    const suyas = lineas.filter((l) => l.split(/\s+/)[0] === c.clave);
    assert.equal(suyas.length, 1, `🔴 \`${c.clave}\` no está declarada una vez en Merchant`);
    const [, tipo, ...resto] = suyas[0].split(/\s+/);
    assert.equal(tipo, 'Boolean?', `🔴 \`${c.clave}\` no es anulable: «no consta» se guardaría como «no»`);
    assert.ok(resto.join(' ').startsWith(`@map("${c.columna}")`), `🔴 \`${c.clave}\` no apunta a la columna ${c.columna}`);
    assert.ok(!suyas[0].includes('@default'), `🔴 \`${c.clave}\` lleva valor por defecto, y la columna de la base no`);
  }
});

// ── ② EL VIAJE POR EL SERVIDOR ───────────────────────────────────────────────────────────────

/** Una base que recuerda y respeta el `select`: lo que no se pide, no sale. */
function baseQueRecuerda(inicial = {}) {
  const fila = { id: 7, email: 'pro@example.invalid', timezone: null, flags: null, ...inicial };
  moduloPrisma.prisma.merchant = {
    findUnique: async ({ select }) => Object.fromEntries(
      Object.keys(select).filter((k) => select[k]).map((k) => [k, k in fila ? fila[k] : null]),
    ),
    update: async ({ data }) => Object.assign(fila, structuredClone(data)),
  };
  moduloPrisma.prisma.invoice = { findMany: async () => [] };
  return fila;
}
const originales = { merchant: moduloPrisma.prisma.merchant, invoice: moduloPrisma.prisma.invoice };
test.after(() => Object.assign(moduloPrisma.prisma, originales));

/** El PUT tal y como lo hace `app.ts`: esquema primero, y a la base solo lo que sobrevive. */
async function putComoApp(body) {
  const parsed = merchantProfileUpdateSchema.safeParse(structuredClone(body));
  if (!parsed.success) return { status: 400 };
  await updateMerchantProfile(7, parsed.data);
  return { status: 200 };
}

test('🔴 SCRUM-1102f · ② los TRES estados de cada respuesta entran por el PUT y vuelven por el GET', async () => {
  for (const c of CAMPOS) {
    const vueltas = [];
    for (const e of ESTADOS) {
      // La fila empieza con OTRO valor: uno igual aprobaría aunque no se escribiera nada.
      const fila = baseQueRecuerda({ [c.clave]: e.guardado === true ? false : true });
      assert.equal((await putComoApp({ [c.clave]: e.guardado })).status, 200);
      assert.equal(fila[c.clave], e.guardado, `🔴 ${c.clave}: mando ${e.guardado} y en la base queda ${fila[c.clave]}`);
      const perfil = await getMerchantProfile(7);
      assert.ok(c.clave in perfil, `🔴 ${c.clave} se guarda y no vuelve: el siguiente guardado lo borraría`);
      vueltas.push(perfil[c.clave]);
    }
    assert.deepEqual(vueltas, [null, true, false], `🔴 ${c.clave}: los tres estados no vuelven distintos`);
  }
});

test('SCRUM-1102f · ② una respuesta no toca la otra, y un guardado que no las manda no las borra', async () => {
  const fila = baseQueRecuerda({ llevaLibrosPorSii: true, domicilioFiscalForal: false });
  assert.equal((await putComoApp({ name: 'Otro nombre' })).status, 200);
  assert.deepEqual([fila.llevaLibrosPorSii, fila.domicilioFiscalForal], [true, false], '🔴 un guardado ajeno las ha tocado');
  assert.equal((await putComoApp({ domicilioFiscalForal: null })).status, 200);
  assert.deepEqual([fila.llevaLibrosPorSii, fila.domicilioFiscalForal], [true, null], '🔴 guardar una ha movido la otra');
});

test('SCRUM-1102f · ② NEGATIVO: lo que no es sí, no o «no consta» se rechaza y no escribe', async () => {
  for (const c of CAMPOS) {
    for (const malo of ['si', 'no', '', 1, 0, 'true']) {
      const fila = baseQueRecuerda({ [c.clave]: true });
      assert.equal((await putComoApp({ [c.clave]: malo })).status, 400, `🔴 ${c.clave} acepta ${JSON.stringify(malo)}`);
      assert.equal(fila[c.clave], true, 'un 400 no escribe');
    }
    // POSITIVO, con el mismo banco: lo válido SÍ escribe (si no, el 400 de arriba no mediría nada).
    const fila = baseQueRecuerda({ [c.clave]: true });
    assert.equal((await putComoApp({ [c.clave]: false })).status, 200);
    assert.equal(fila[c.clave], false);
  }
});

// ── ③ LA PANTALLA ────────────────────────────────────────────────────────────────────────────

/** Lo mínimo que Configuración exige para dejar guardar. */
const PERFIL = { name: 'Fontanería QA', legalName: 'Fontanería QA SL', taxId: 'B00000000', address: 'C/ Mayor 1', whatsappPhone: '34000000027' };
const respiro = async () => { for (let i = 0; i < 10; i++) await new Promise((res) => setImmediate(res)); };

/** Monta Configuración con ese perfil guardado. Devuelve los nodos y los PUT que haga la pantalla. */
async function montarConfiguracion(guardado) {
  const puts = [];
  const banco = cargarDashboard(RAIZ, {
    datos: (url, opts) => {
      if (!/\/admin\/merchant$/.test(url)) return [];
      if (opts && opts.method === 'PUT') { puts.push(JSON.parse(opts.body)); return {}; }
      return { ...PERFIL, ...guardado };
    },
  });
  const r = await pintarVista(banco, 'renderSettingsView');
  assert.equal(r.error, null, `🔴 CIEGO: Configuración no se monta: ${r.error && r.error.message}`);
  assert.equal(r.noMedida, null, `🔴 CIEGO: ${r.noMedida}`);
  const nodos = todos(r.contenedor);
  const selector = (clave) => {
    const s = nodos.filter((n) => n.tagName === 'SELECT' && n.name === clave);
    assert.equal(s.length, 1, `🔴 la pantalla no tiene UN selector name="${clave}" (tiene ${s.length})`);
    return s[0];
  };
  const guardar = async () => {
    const form = nodos.find((n) => n._oyentes && (n._oyentes.submit || []).length);
    assert.ok(form, '🔴 CIEGO: no encuentro el formulario de Configuración');
    await form._oyentes.submit[0]({ preventDefault() {} });
    await respiro();
    assert.equal(puts.length, 1, '🔴 CIEGO: pulsar guardar no ha mandado un PUT');
    return puts.pop();
  };
  return { nodos, selector, guardar };
}

test('🔴 SCRUM-1102f · ③ la pantalla pinta lo guardado y, al guardar sin tocar nada, lo devuelve igual', async () => {
  for (const c of CAMPOS) {
    for (const e of ESTADOS) {
      const p = await montarConfiguracion({ [c.clave]: e.guardado });
      assert.equal(p.selector(c.clave).value, e.opcion,
        `🔴 ${c.clave} guardado como ${e.guardado} se pinta «${p.selector(c.clave).value}»`);
      const enviado = await p.guardar();
      assert.ok(c.clave in enviado, `🔴 la pantalla no manda ${c.clave} al guardar`);
      assert.equal(enviado[c.clave], e.guardado,
        `🔴 ${c.clave}: estaba ${e.guardado} y guardar sin tocarlo manda ${enviado[c.clave]}`);
    }
  }
});

test('SCRUM-1102f · ③ un perfil que no trae la respuesta se pinta «no consta» y se guarda NULL, no false', async () => {
  const p = await montarConfiguracion({});
  const enviado = await p.guardar();
  for (const c of CAMPOS) {
    assert.equal(p.selector(c.clave).value, '');
    assert.equal(enviado[c.clave], null, `🔴 ${c.clave}: «no consta» viaja como ${enviado[c.clave]}`);
  }
});

test('SCRUM-1102f · ③ lo que el profesional elige es lo que se manda, y cada selector manda lo suyo', async () => {
  const p = await montarConfiguracion({ llevaLibrosPorSii: null, domicilioFiscalForal: null });
  p.selector('llevaLibrosPorSii').value = 'si';
  p.selector('domicilioFiscalForal').value = 'no';
  const enviado = await p.guardar();
  assert.deepEqual([enviado.llevaLibrosPorSii, enviado.domicilioFiscalForal], [true, false]);
});

// ── ④ LOS TEXTOS ─────────────────────────────────────────────────────────────────────────────

test('SCRUM-1102f · ④ cada selector lleva SU enunciado firmado, en Empresa, y nada que explique', async () => {
  const p = await montarConfiguracion({});
  const ficha = aprobacionesDeMicrocopy().find((a) => a.ticket === 'SCRUM-1102' && a.ranura === 'sii-y-domicilio-foral');
  assert.ok(ficha && ficha.aprobada, '🔴 no hay ficha firmada de los dos enunciados en docs/microcopy/');
  for (const c of CAMPOS) {
    const sel = p.selector(c.clave);
    const caja = p.nodos.find((n) => n.hijos.includes(sel));
    const rotulos = caja.hijos.filter((h) => h.tagName === 'LABEL').map((h) => h.textContent);
    assert.deepEqual(rotulos, [c.pregunta], `🔴 el rótulo de ${c.clave} no es el enunciado firmado`);
    assert.ok(ficha.literales.includes(c.pregunta), `🔴 «${c.pregunta}» no consta en su ficha`);
    // Regla 7: se pregunta el hecho y no se le dice qué le corresponde. La caja es rótulo + selector.
    assert.deepEqual(caja.hijos.map((h) => h.tagName), ['LABEL', 'SELECT'],
      `🔴 la caja de ${c.clave} lleva algo más que la pregunta y su selector`);
    assert.equal(mapa.submenuDeCampo(c.clave), mapa.submenuDeCampo('criterioCaja'),
      `🔴 ${c.clave} ya no vive en la pestaña del criterio de caja`);
  }
});

test('SCRUM-1102f · ④ las opciones son la terna de tres estados, y sus rótulos constan firmados', async () => {
  const p = await montarConfiguracion({});
  const ficha = aprobacionesDeMicrocopy().find((a) => a.ticket === 'SCRUM-1102' && a.ranura === 'opciones-si-y-no');
  assert.ok(ficha && ficha.aprobada,
    '🔴 los rótulos «Sí» y «No» de los dos selectores no tienen ficha firmada (regla 39): '
    + 'docs/microcopy/…-SCRUM-1102-opciones-si-y-no.md');
  for (const c of CAMPOS) {
    const opciones = p.selector(c.clave).hijos.filter((h) => h.tagName === 'OPTION');
    assert.deepEqual(opciones.map((o) => o.value), ESTADOS.map((e) => e.opcion),
      `🔴 ${c.clave} no ofrece los tres estados, en su orden`);
    assert.deepEqual(opciones.map((o) => o.textContent), ['No consta', 'Sí', 'No']);
    for (const o of opciones) {
      assert.ok(ficha.literales.includes(o.textContent), `🔴 la opción «${o.textContent}» no consta en su ficha`);
    }
  }
});
