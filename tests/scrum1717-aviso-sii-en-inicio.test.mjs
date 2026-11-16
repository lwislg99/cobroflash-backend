// tests/scrum1717-aviso-sii-en-inicio.test.mjs — SCRUM-1717 (mitad S2)
//
// Sin gate: monta el Inicio en el banco de vistas con la red doblada. Ni BD, ni red real.
//
// Con el flag fiscal puesto y el SII en «Sí» o «No consta», el modo es `receipt` —igual que con el
// flag apagado— y el panel escondía Facturas y Cobros sin decir por qué. Desde #3120 el servidor
// manda el motivo (`/admin/me` → `motivoSinEmision`: 'sii_declarado' | 'sii_no_consta' | null), y
// `app.js` lo guarda en `window.appMotivoSinEmision`. Esto pinta el Inicio y LEE el texto pintado:
// no busca la cadena en el fuente (la regla de SCRUM-1390: por efecto, con sesión de cada rol).
//
// Los dos literales, copiados de su firma — J1 en SCRUM-1585 c.20539, y el fundador (Luis) en
// SCRUM-1717 c.21705, que cubre literales Y colocación en Inicio. Si alguien los cambia sin otra
// firma, cae. El «›» es U+203A.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

// El catálogo del meta-guard (`scripts/meta-guard-mutaciones.mjs`, SCRUM-1387).
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'public/dashboard/js/homeView.js',
    de: "  pintarAvisoSiiSinEmision(container);\n",
    a: '\n',
    cae: 'SCRUM-1717 ① ·',
  },
  {
    fichero: 'public/dashboard/js/homeView.js',
    de: "  if (window.appUserRole !== 'admin') return;\n  const texto = AVISO_SII_SIN_EMISION",
    a: "  const texto = AVISO_SII_SIN_EMISION",
    cae: 'SCRUM-1717 ③ ·',
  },
  {
    fichero: 'public/dashboard/js/app.js',
    de: "['sii_declarado', 'sii_no_consta'].includes(me.motivoSinEmision) ? me.motivoSinEmision : null",
    a: 'me.motivoSinEmision || null',
    cae: 'SCRUM-1717 ④ ·',
  },
];

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SII_SI = 'Has indicado en Configuración › Empresa que llevas los libros de IVA por el SII. Con esa respuesta, YaQu no emite facturas ni cobra por ti. Si no es así, cámbiala allí.';
const SII_NO_CONSTA = 'Para emitir facturas, contesta en Configuración › Empresa si llevas los libros de IVA por el SII.';

const respirar = async () => { for (let i = 0; i < 12; i++) await new Promise((r) => setImmediate(r)); };

/** Monta el Inicio con `rol` y `motivo` y devuelve el aviso (o null) y el texto entero del Inicio. */
async function montar(rol, motivo) {
  const fetch = async (url) => {
    const u = String(url);
    let cuerpo = [];
    if (/\/admin\/metrics\/(home|inicio)$/.test(u)) cuerpo = { pendingCount: 0, quotesAwaiting: 0, pendingRequests: 0, weekly: {}, sparkline: [], recentActivity: [] };
    else if (/\/admin\/merchant/.test(u)) cuerpo = { id: 1, name: 'Taller', defaultCurrency: 'EUR', country: 'ES' };
    else if (/\/admin\/metrics\/(team|actividad-equipo)$/.test(u)) cuerpo = { hasTeam: false, members: [], inactive: [], sinAsignar: null, totalCollected: 0 };
    return {
      ok: true, status: 200,
      headers: { get: () => 'application/json' },
      json: async () => cuerpo, text: async () => JSON.stringify(cuerpo),
    };
  };
  const b = cargarDashboard(RAIZ, {
    rol,
    red: { navigator: { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } }, fetch },
  });
  b.ctx.appMerchantId = 1;
  b.ctx.appDocumentoSuelto = 'no';
  b.ctx.appModoEmision = 'receipt';
  b.ctx.appMotivoSinEmision = motivo;
  b.ctx.renderAppView = () => {};
  for (const id of ['req-badge', 'nav-quotes-badge', 'nav-invoices-badge']) {
    const g = b.mk('span');
    g.id = id;
    b.ctx.document.body.appendChild(g);
  }
  const v = await pintarVista(b, 'renderHomeView');
  if (v.error || v.noMedida) throw new Error(`el Inicio no monta con rol ${rol}: ${(v.error && v.error.message) || v.noMedida}`);
  await respirar();
  const saludo = v.contenedor.querySelector('.home-greeting');
  assert.ok(saludo, `🔴 NO PUDE MIRAR: con rol ${rol} el Inicio no tiene saludo (.home-greeting) contra el que colocar el aviso.`);
  const texto = todos(v.contenedor).map((n) => String(n.textContent || '')).join(' ');
  return { aviso: v.contenedor.querySelector('#home-aviso-sii'), texto, saludo };
}

test('SCRUM-1717 ① · admin con el SII en «Sí»: el Inicio pinta el primer literal, byte a byte, debajo del saludo', async () => {
  const { aviso, saludo, texto } = await montar('admin', 'sii_declarado');
  assert.ok(aviso, '🔴 con motivo sii_declarado el Inicio del admin no pinta #home-aviso-sii.');
  assert.equal(aviso.textContent, SII_SI);
  // CONTROL POSITIVO de las negaciones de abajo: el MISMO lector del texto del Inicio SÍ ve los dos
  // tokens cuando están. Sin esto, un «no lo contiene» podría ser un lector ciego (SCRUM-237).
  assert.ok(texto.includes('Has indicado en Configuración'), '🔴 NO PUDE MIRAR: el lector no ve el literal pintado');
  assert.ok(texto.includes('libros de IVA por el SII'), '🔴 NO PUDE MIRAR: el lector no ve el literal pintado');
  assert.equal(aviso.dataset.motivo, 'sii_declarado');
  const hermanos = saludo._padre.hijos;
  assert.equal(hermanos.indexOf(aviso), hermanos.indexOf(saludo) + 1, 'el aviso no va justo debajo del saludo');
});

test('SCRUM-1717 ② · admin con el SII en «No consta»: el segundo literal, byte a byte, y NO el primero', async () => {
  const { aviso, texto } = await montar('admin', 'sii_no_consta');
  assert.ok(aviso, '🔴 con motivo sii_no_consta el Inicio del admin no pinta #home-aviso-sii.');
  assert.equal(aviso.textContent, SII_NO_CONSTA);
  assert.ok(!texto.includes('Has indicado en Configuración'), 'con «No consta» se cuela el literal de «Sí»');
});

test('SCRUM-1717 ② · sin motivo (flag apagado, o el SII en «No»): ni aviso ni ninguno de los dos literales', async () => {
  for (const motivo of [null, undefined]) {
    const { aviso, texto } = await montar('admin', motivo);
    assert.equal(aviso, null, `con motivo ${motivo} aparece un aviso del SII`);
    assert.ok(!texto.includes('libros de IVA por el SII'), `con motivo ${motivo} se cuela un literal del SII`);
  }
});

test('SCRUM-1717 ③ · el operario no lo ve: el literal le manda a Configuración, donde no entra', async () => {
  for (const rol of ['tecnico']) {
    for (const motivo of ['sii_declarado', 'sii_no_consta']) {
      const { aviso, texto } = await montar(rol, motivo);
      assert.equal(aviso, null, `rol ${rol} con ${motivo} ve el aviso`);
      assert.ok(!texto.includes('libros de IVA por el SII'), `rol ${rol} con ${motivo} lee un literal del SII`);
    }
  }
});

test('SCRUM-1717 ④ · app.js solo deja pasar los dos valores del contrato: lo demás cae a null (fallar cerrado)', () => {
  const app = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/app.js'), 'utf8');
  const m = app.match(/window\.appMotivoSinEmision =\s*\n?\s*(\[[^\]]*\])\.includes\(me\.motivoSinEmision\) \? me\.motivoSinEmision : null;/);
  assert.ok(m, '🔴 NO PUDE MIRAR: no encuentro en app.js la lista blanca de `appMotivoSinEmision`.');
  assert.deepEqual(JSON.parse(m[1].replace(/'/g, '"')), ['sii_declarado', 'sii_no_consta']);
});
