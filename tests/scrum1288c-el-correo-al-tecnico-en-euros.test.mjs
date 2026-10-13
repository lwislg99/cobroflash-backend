// SCRUM-1288c · El correo «presupuesto aprobado» al técnico dice el total en es-ES.
//
// Decía «1234.50 EUR»: quien llama (`quotesAdmin.routes.ts`) le pasaba `toFixed(2)` y la plantilla
// pegaba ese texto a la moneda. Ahora llega el NÚMERO y lo formatea el formateador de la casa.
//
// Se lee el correo QUE SALE: `sendTechQuoteApprovedEmail` real, de `dist/`, con sólo el emisor
// doblado (`enviarCorreo`). ⛔ Ni un byte de red, ni una base.
//
// Lo que NO mide: el camino entero por la ruta (aprobar → correo), que pide base. El lado de quien
// llama lo ata el tipo (`total: number`: con el `toFixed(2)` de antes no compila) y el trinquete de
// `tests/scrum1288b-el-importe-pegado-a-la-moneda.test.mjs`, que exige que esta entrada siga retirada.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';

const RAIZ = path.resolve(import.meta.dirname, '..');
const requiere = createRequire(import.meta.url);
const rutaDe = (r) => requiere.resolve(path.join(RAIZ, r));

const enviados = [];
{
  const f = rutaDe('dist/integrations/enviarCorreo.js');
  requiere.cache[f] = {
    id: f, filename: f, loaded: true,
    exports: {
      enviarCorreo: async (a) => { enviados.push(a); return { enviado: true, proveedor: 'doble' }; },
      resultadoSinDestino: () => ({ enviado: false, motivo: 'sin_destino' }),
    },
  };
  delete requiere.cache[rutaDe('dist/modules/messaging/domain/merchantNotifications.js')];
}
const { sendTechQuoteApprovedEmail } = requiere(path.join(RAIZ, 'dist/modules/messaging/domain/merchantNotifications.js'));

async function correoCon(total, currency = 'EUR') {
  enviados.length = 0;
  await sendTechQuoteApprovedEmail({
    merchantId: 7, techEmail: 'tec@example.invalid', techName: 'Técnico QA',
    quoteId: 41, customerName: 'Cliente QA', total, currency,
  });
  assert.equal(enviados.length, 1, '🔴 CIEGO: el doble no ha visto el correo, así que no se mide nada');
  return enviados[0].html;
}

// La fila «Total» del correo, sin etiquetas: lo que lee el técnico.
function totalDe(html) {
  const m = /Total<\/span>\s*<span[^>]*>([^<]*)<\/span>/.exec(html);
  assert.ok(m, '🔴 CIEGO: el correo ya no lleva su fila «Total»; este test no sabe dónde mirar');
  return m[1];
}

test('SCRUM-1288c · 🔴 un total con miles sale «1.234,50 €», no «1234.50 EUR»', async () => {
  const total = totalDe(await correoCon(1234.5));
  assert.match(total, /^1\.234,50\s€$/, `🔴 el total del correo al técnico no está en es-ES: «${total}»`);
  assert.ok(!total.includes('1234.5'), `🔴 sigue saliendo el número en crudo: «${total}»`);
  assert.ok(!total.includes('EUR'), `🔴 sigue saliendo el código de la moneda en vez del símbolo: «${total}»`);
});

test('SCRUM-1288c · CONTROL: dos importes distintos salen distintos (el formateador no devuelve siempre lo mismo)', async () => {
  const a = totalDe(await correoCon(99));
  const b = totalDe(await correoCon(1500));
  assert.match(a, /^99,00\s€$/, `«${a}»`);
  assert.match(b, /^1\.500,00\s€$/, `«${b}»`);
  assert.notEqual(a, b);
});

test('SCRUM-1288c · la moneda la decide el presupuesto: fuera del euro no se pinta «€»', async () => {
  const total = totalDe(await correoCon(1500, 'MXN'));
  assert.ok(total.includes('1.500,00'), `🔴 fuera del euro se pierde el formato del número: «${total}»`);
  assert.ok(!total.includes('€'), `🔴 un presupuesto en MXN sale en euros: «${total}»`);
});

test('SCRUM-1288c · el resto del correo no cambia: asunto, saludo y cliente siguen donde estaban', async () => {
  const html = await correoCon(1234.5);
  assert.equal(enviados[0].subject, '✅ Tu presupuesto #41 fue aprobado');
  assert.ok(html.includes('Hola Técnico QA'), '🔴 el correo se ha quedado sin su saludo');
  assert.ok(html.includes('Cliente QA'), '🔴 el correo se ha quedado sin el nombre del cliente');
});
