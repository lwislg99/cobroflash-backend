// tests/scrum1807g-firma-total-del-apartado.test.mjs — SCRUM-1807 (tramo g, S1)
//
// LA PÁGINA DONDE FIRMA EL CLIENTE (`GET /pay/quote/:token`): «Total del apartado» bajo cada apartado
// y, en un apartado AGRUPADO, una sola fila que se despliega para ver sus subpartidas.
//
// Decisiones: SCRUM-1786 c.22269 (literal firmado `Total del apartado`; P3 por apartado; P5 ✅ — en
// agrupado el cliente puede desplegar las subpartidas en la página de firma) y c.22389 («cada vista
// suma como sus líneas»). MEDIDO antes de tocar: la columna «Importe» de esta página es NETA
// —`qty × price`, sin IVA y sin `dto` (`importeDeLinea`)—, así que el total del apartado es la BASE
// de sus líneas (`calcVatBreakdown(...).base`), como en el PDF del presupuesto, y no `calcTotal` como
// en el portal, cuya columna va con IVA. El invariante que se mira es ése: el total de cada apartado
// suma las celdas que el cliente tiene encima.
//
// ⛔ Ningún texto nuevo: el desplegable es un <details> cuyo <summary> es el concepto que escribió el
// profesional y su total. Las tarjetas de opciones (tiers) no se tocan.
//
// El banco es el de scrum1442b: la ruta REAL de `dist/` con `prisma.quote.findUnique` doblado.
import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../dist/core/db/prisma.js';
import { quoteDecisionLandingRouter } from '../dist/modules/system/app/routes/quoteDecisionLanding.routes.js';
import { PRESUPUESTO_FIRMA_CSS } from '../dist/modules/system/app/routes/quoteDecisionEstilo.js';
import { calcTotal } from '../dist/core/utils/utils.js';

/** Mutaciones que este test tiene que tumbar (se aplican con `aplicarUna`, scripts/meta-guard-mutaciones.mjs). */
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // La fila del total desaparece.
    fichero: 'src/modules/system/app/routes/quoteDecisionLanding.routes.ts',
    de: '    return filaDeLinea(cabecera) + delApartado.map(filaDeLinea).join(\'\') + filaDeTotalDelApartado(total);',
    a: '    return filaDeLinea(cabecera) + delApartado.map(filaDeLinea).join(\'\');',
    cae: 'SCRUM-1807g · desglosado: «Total del apartado» bajo cada apartado, en su sitio',
  },
  {
    // El total suma CON IVA (la cifra del portal), y deja de sumar lo que el cliente ve encima.
    fichero: 'src/modules/system/app/routes/quoteDecisionLanding.routes.ts',
    de: '    const total = calcVatBreakdown(delApartado).base;',
    a: '    const total = calcVatBreakdown(delApartado).base + calcVatBreakdown(delApartado).cuota;',
    cae: 'SCRUM-1807g · 🔴 el total de cada apartado suma las celdas que tiene encima (sin IVA, sin dto)',
  },
  {
    // El modo agrupado se ignora: el apartado sale desglosado igual.
    fichero: 'src/modules/system/app/routes/quoteDecisionLanding.routes.ts',
    de: '    if (esAgrupado(cabecera)) return filaDeApartadoAgrupado(cabecera, delApartado, total);',
    a: '',
    cae: 'SCRUM-1807g · agrupado: UNA fila que despliega sus subpartidas, con su total y sin texto nuevo',
  },
  {
    // Agrupado, pero el desplegable no trae las subpartidas (P5 dice que el cliente las ve).
    fichero: 'src/modules/system/app/routes/quoteDecisionLanding.routes.ts',
    de: '${delApartado.map(sublineaAgrupada).join(\'\')}</details>',
    a: '</details>',
    cae: 'SCRUM-1807g · agrupado: UNA fila que despliega sus subpartidas, con su total y sin texto nuevo',
  },
];

const merchant = {
  id: 77, email: 'obra@ejemplo.es', flags: null, name: 'Reformas', legalName: null, logoUrl: null,
  address: null, country: 'ES', brandColor: null, brandAccentColor: null, whatsappPhone: null, timezone: 'Europe/Madrid',
};
// Cabeceras TAL COMO LAS GUARDA EL ESQUEMA: sin `qty` ni `price`, con `tax: 0` por defecto.
const cab = (concept, extra = {}) => ({ concept, tax: 0, apartado: true, ...extra });
const BANO = cab('Baño');
const COCINA = cab('Cocina');
const PLATO = { concept: 'Plato de ducha', qty: 1, price: 320, tax: 0.21 };
const MAMPARA = { concept: 'Mampara', qty: 1, price: 180.5, tax: 0.21 };
const GRIFO = { concept: 'Grifo', qty: 2, price: 45, tax: 0.1 };

async function pagina(lines, extra = {}) {
  const quote = {
    id: 9, quoteNumber: 1, currency: 'EUR', total: calcTotal(lines, extra.discountGlobalAmount ?? null), status: 'sent',
    createdAt: new Date('2026-11-20T10:00:00Z'), validUntil: null, paymentTerms: 'FULL', customBillingPlan: null,
    discountGlobalAmount: null, acceptedAt: null, rejectedAt: null, merchant, customer: { name: 'Cliente' },
    lines, tiers: null, ...extra,
  };
  const original = prisma.quote.findUnique;
  const originalCount = prisma.quote.count;
  prisma.quote.findUnique = async () => quote;
  prisma.quote.count = async () => 0; // SCRUM-1302p: ninguna versión más reciente
  const capa = quoteDecisionLandingRouter.stack.find((l) => l.route?.path?.includes?.('/quote/:token'));
  assert.ok(capa, '🔴 CIEGO: no encuentro GET /quote/:token');
  let html = '';
  const res = { setHeader() { return res; }, status() { return res; }, send(b) { html = String(b); return res; }, redirect() { return res; } };
  try { await capa.route.stack[0].handle({ params: { token: 'abcdef0123456789abcdef0123456789' }, query: {}, headers: {} }, res); }
  finally { prisma.quote.findUnique = original; prisma.quote.count = originalCount; }
  return html;
}

const tabla = (html) => {
  const t = html.split('class="lines-table"')[1];
  assert.ok(t, '🔴 CIEGO: la página no trae la tabla del presupuesto');
  return (t.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/) || [])[1];
};
/** Las filas de la tabla principal, en orden, cada una desde su `<tr`. Un <details> no lleva <tr> dentro. */
const filas = (html) => tabla(html).split(/(?=<tr\b)/).slice(1).map((f) => f.split('</tr>')[0]);
const texto = (trozo) => trozo.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const celdas = (fila) => [...fila.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map((m) => texto(m[1]));
/** «1.234,56 €» → 1234.56 (con o sin espacio duro). */
const euros = (s) => Number(String(s).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.'));
const esFilaDeTotal = (f) => /class="apartado-total"/.test(f);

test('SCRUM-1807g · SUELO: sin apartados no aparece nada nuevo', async () => {
  const html = await pagina([PLATO, GRIFO]);
  assert.equal(filas(html).length, 2, 'SUELO: dos líneas, dos filas');
  assert.ok(!html.includes('Total del apartado'), '🔴 un presupuesto sin apartados pinta un total de apartado');
  assert.ok(!/<details\b/.test(tabla(html)), '🔴 un presupuesto sin apartados pinta un desplegable');
});

test('SCRUM-1807g · desglosado: «Total del apartado» bajo cada apartado, en su sitio', async () => {
  const fs = filas(await pagina([BANO, PLATO, MAMPARA, COCINA, GRIFO]));
  const quien = fs.map((f) => (esFilaDeTotal(f) ? `T ${celdas(f)[2]}` : celdas(f)[0].replace(/^\S+\s/, '')));
  assert.deepEqual(quien.map((q) => q.replace(/ /g, ' ')),
    ['Baño', 'Plato de ducha', 'Mampara', 'T 500,50 €', 'Cocina', 'Grifo', 'T 90,00 €'],
    '🔴 el total no está bajo la última línea de cada apartado, o no suma lo que tiene encima');
  for (const f of fs.filter(esFilaDeTotal)) assert.equal(celdas(f)[0], 'Total del apartado', '🔴 el rótulo no es el literal firmado');
});

test('SCRUM-1807g · 🔴 el total de cada apartado suma las celdas que tiene encima (sin IVA, sin dto)', async () => {
  // Con `dto` de línea y céntimos: la columna no aplica el dto (es qty × price) y el total tampoco.
  const conDto = { concept: 'Azulejo', qty: 3, price: 33.33, tax: 0.21, dto: 10 };
  const lineas = [{ concept: 'Suelto', qty: 1, price: 10, tax: 0.21 }, BANO, PLATO, conDto, COCINA, GRIFO, cab('Vacío')];
  const fs = filas(await pagina(lineas));
  let encima = null; // null = todavía no hay apartado abierto
  let totales = 0;
  for (const f of fs) {
    const [concepto, , importe] = celdas(f);
    if (esFilaDeTotal(f)) {
      assert.ok(encima !== null, '🔴 un total sin apartado: las líneas de antes de la primera cabecera no llevan total');
      assert.equal(euros(importe), Math.round(encima * 100) / 100, `🔴 el total (${importe}) no suma las celdas de encima (${encima})`);
      totales += 1;
      encima = null;
    } else if (importe === '') {
      encima = 0; // una cabecera abre apartado
      assert.ok(concepto, 'SUELO: una cabecera sin concepto');
    } else if (encima !== null) {
      encima += euros(importe);
    }
  }
  assert.equal(totales, 3, '🔴 tres apartados (uno vacío) tienen que dar tres totales');
  assert.equal(euros(celdas(fs.filter(esFilaDeTotal)[2])[2]), 0, 'un apartado vacío pinta 0,00, como el PDF');
});

test('SCRUM-1807g · agrupado: UNA fila que despliega sus subpartidas, con su total y sin texto nuevo', async () => {
  const html = await pagina([cab('Baño', { agrupado: true }), PLATO, MAMPARA, COCINA, GRIFO]);
  const fs = filas(html);
  assert.equal(fs.length, 1 + 1 + 1 + 1, '🔴 agrupado: Baño (1 fila) + Cocina, Grifo y su total (3 filas)');
  const agrupada = fs[0];
  assert.match(agrupada, /<details\b[^>]*>\s*<summary\b/, '🔴 el apartado agrupado no se despliega');
  const resumen = agrupada.split('<summary')[1].split('</summary>')[0];
  // icono + concepto + total (la base de sus líneas: 320 + 180,50).
  assert.match(texto(`<x${resumen}`).replace(/ /g, ' '), /^\S+ Baño 500,50 €$/u,
    '🔴 el resumen no es «concepto + total», o el total no es la base de sus líneas');
  const detalle = agrupada.split('</summary>')[1];
  for (const [l, imp] of [[PLATO, '320,00'], [MAMPARA, '180,50']]) {
    assert.ok(detalle.includes(l.concept), `🔴 desplegado no se ve «${l.concept}» (P5: el cliente ve las subpartidas)`);
    assert.ok(detalle.includes(imp), `🔴 desplegado no se ve el importe de «${l.concept}»`);
  }
  // Sin texto nuevo: quitando conceptos, cantidades, importes e icono, no queda nada.
  let resto = texto(agrupada);
  for (const s of ['Baño', 'Plato de ducha', 'Mampara', '500,50', '320,00', '180,50', '€']) resto = resto.split(s).join(' ');
  resto = resto.replace(/[\d\s ]/g, '').replace(/[•🔧📦🚚🔍]/gu, '');
  assert.equal(resto, '', `🔴 el apartado agrupado pinta texto que nadie ha firmado: «${resto}»`);
  assert.ok(!texto(agrupada).includes('Total del apartado'), 'agrupado: el total va en su fila, no en otra');
  // El otro apartado, desglosado como siempre.
  assert.equal(celdas(fs[3])[0], 'Total del apartado');
  assert.equal(euros(celdas(fs[3])[2]), 90);
  // Cada clase nueva tiene su regla en la hoja (la página no lleva style=, SCRUM-1646d).
  for (const k of ['apartado-total', 'apartado-agrupado', 'apartado-detalle', 'apartado-resumen', 'apartado-sublinea']) {
    assert.ok(PRESUPUESTO_FIRMA_CSS.includes(`.${k} {`), `🔴 la clase ${k} no tiene regla en la hoja de la firma`);
  }
});

test('SCRUM-1807g · lo que escribe el profesional sale escapado, también en el desplegable', async () => {
  const html = await pagina([cab('<img src=x onerror=alert(1)>', { agrupado: true }), { ...PLATO, concept: '<script>alert(2)</script>' }]);
  const t = tabla(html);
  assert.ok(!t.includes('<img src=x'), '🔴 el concepto de la cabecera agrupada sale sin escapar');
  assert.ok(!/<script[^>]*>alert\(2\)/.test(t),'🔴 el concepto de una subpartida sale sin escapar');
  assert.ok(t.includes('&lt;script&gt;'), 'SUELO: la subpartida no aparece');
});
