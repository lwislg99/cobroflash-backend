// tests/scrum1466-sembrar-qa-compara-sin-orden.test.mjs — SCRUM-1466
//
// `sembrar-qa perfil` guarda el perfil de la cuenta QA y lo RELEE para cazar pérdida de datos. Comparaba
// con `JSON.stringify(a) === JSON.stringify(b)`, que depende del orden de las claves: el mismo perfil con
// las claves en otro orden salía «🔴 DISTINTO» o «🔴 CAMBIÓ SIN ENVIARSE». Lo midió S2 el 29-sep-2026
// (SCRUM-1268 c.17523). Aquí, sin red (un `fetch` falso que devuelve las claves en otro orden en cada
// lectura, como un `jsonb`, que no guarda el orden):
//   ① `diferencia`: igual sin orden de claves (también anidado y dentro de listas); la lista SÍ con orden.
//   ② el perfil releído con las claves en otro orden: cero rojos.
//   ③ control positivo: lo que cambia de verdad sigue saliendo, y dice QUÉ clave y QUÉ valor.
//   ④ dos cláusulas en otro orden no son el mismo perfil.
import test from 'node:test';
import assert from 'node:assert/strict';
import { diferencia, guardarPerfil, MERCHANT_QA } from '../scripts/qa/sembrar-qa.mjs';

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // Vuelve la comparación de antes, por texto: el orden de las claves vuelve a contar.
    fichero: 'scripts/qa/sembrar-qa.mjs',
    de: 'export function diferencia(a, b) {\n  const norm',
    a: "export function diferencia(a, b) {\n  if (JSON.stringify(a ?? null) !== JSON.stringify(b ?? null)) return { ruta: '', a, b };\n  return null;\n  const norm",
    cae: 'SCRUM-1466 ② el perfil releído con las claves en otro orden: cero rojos',
  },
  {
    // El rojo deja de decir DÓNDE: «DISTINTO» a secas, que es lo que había.
    fichero: 'scripts/qa/sembrar-qa.mjs',
    de: 'const donde = (d, k) => (d && d.ruta',
    a: 'const donde = (d, k) => (false',
    cae: 'SCRUM-1466 ③ control positivo: lo que cambia de verdad sale, con su clave y su valor',
  },
];

const COOKIE = 'pf_session=tok1466abcdef';
const resp = (status, cuerpo) => ({ status, headers: new Headers(), text: async () => JSON.stringify(cuerpo) });
const invertir = (v) => (Array.isArray(v) ? v.map(invertir)
  : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).reverse().map(([k, x]) => [k, invertir(x)])) : v);

/** Un panel con el perfil. Cada lectura alterna el orden de las claves. `alGuardar` decide qué guarda el PUT. */
function panel(alGuardar = (m, cuerpo) => ({ ...m, ...cuerpo })) {
  let merchant = {
    name: 'PruebaQA',
    homePrefs: { a: 1, b: { c: 1, d: 2 } },
    clausulas: [{ id: 1, texto: 'uno' }, { id: 2, texto: 'dos' }],
    ajustes: { x: 1, y: 2 },
  };
  let lecturas = 0;
  const fetchFn = async (url, init = {}) => {
    const u = new URL(url);
    const clave = `${init.method || 'GET'} ${u.pathname}`;
    if (clave === 'GET /admin/me') return resp(200, { merchantId: MERCHANT_QA, isOwner: true, merchantName: 'PruebaQA' });
    if (clave === 'GET /admin/merchant') { lecturas += 1; return resp(200, lecturas % 2 ? invertir(merchant) : merchant); }
    if (clave === 'PUT /admin/merchant') { merchant = alGuardar(structuredClone(merchant), JSON.parse(init.body)); return resp(200, {}); }
    return resp(404, { error: 'ruta no simulada' });
  };
  return { fetchFn, lecturas: () => lecturas };
}
const ENVIADO = { homePrefs: { b: { d: 2, c: 1 }, a: 1 }, clausulas: [{ texto: 'uno', id: 1 }, { texto: 'dos', id: 2 }] };

test('SCRUM-1466 ① diferencia: sin orden de claves, también anidado y dentro de listas; la lista SÍ con orden', () => {
  assert.equal(diferencia({ a: 1, b: 2 }, { b: 2, a: 1 }), null);
  assert.equal(diferencia({ a: { x: 1, y: [{ p: 1, q: 2 }] } }, { a: { y: [{ q: 2, p: 1 }], x: 1 } }), null);
  assert.equal(diferencia(null, undefined), null, 'null y undefined sueltos valían lo mismo, y siguen valiendo');
  assert.equal(diferencia({ a: 1, b: undefined }, { a: 1 }), null, 'una clave undefined cae, como en JSON.stringify');
  assert.deepEqual(diferencia({ a: { x: 1 } }, { a: { x: 2 } }), { ruta: 'a.x', a: 1, b: 2 });
  assert.deepEqual(diferencia([{ id: 1 }, { id: 2 }], [{ id: 2 }, { id: 1 }]), { ruta: '[0].id', a: 1, b: 2 });
  assert.deepEqual(diferencia({ a: 1 }, { a: 1, b: 2 }), { ruta: 'b', a: undefined, b: 2 });
  assert.deepEqual(diferencia([1], [1, 2]), { ruta: '[1]', a: undefined, b: 2 });
  assert.deepEqual(diferencia(1, '1'), { ruta: '', a: 1, b: '1' });
});

test('SCRUM-1466 ② el perfil releído con las claves en otro orden: cero rojos', async () => {
  const p = panel();
  const lineas = await guardarPerfil(p.fetchFn, COOKIE, ENVIADO);
  assert.equal(p.lecturas(), 2, 'el banco está mal: tenía que leer antes y después');
  const texto = lineas.join('\n');
  assert.doesNotMatch(texto, /🔴/, `🔴 rojos falsos por el orden de las claves:\n${texto}`);
  assert.match(texto, /OK\s+homePrefs/);
  assert.match(texto, /OK\s+clausulas/);
  assert.match(texto, /resumen: 2 enviados · 0 no se releen igual · 0 cambiaron sin enviarse/);
});

test('SCRUM-1466 ③ control positivo: lo que cambia de verdad sale, con su clave y su valor', async () => {
  // Un servidor que pisa una cláusula enviada y toca un ajuste que nadie envió.
  const p = panel((m, cuerpo) => {
    const g = { ...m, ...cuerpo };
    g.clausulas = g.clausulas.map((c) => (c.id === 2 ? { ...c, texto: 'DOS' } : c));
    g.ajustes = { ...g.ajustes, y: 3 };
    return g;
  });
  const texto = (await guardarPerfil(p.fetchFn, COOKIE, ENVIADO)).join('\n');
  assert.match(texto, /🔴 DISTINTO\s+clausulas: .* · difiere en clausulas\[1\]\.texto: "dos" ≠ "DOS"/, texto);
  assert.match(texto, /🔴 CAMBIÓ SIN ENVIARSE ajustes: .* · difiere en ajustes\.y: 2 ≠ 3/, texto);
  assert.match(texto, /OK\s+homePrefs/, 'lo que no cambió sigue saliendo OK');
  assert.match(texto, /resumen: 2 enviados · 1 no se releen igual · 1 cambiaron sin enviarse/);
});

test('SCRUM-1466 ④ dos cláusulas en otro orden no son el mismo perfil', async () => {
  const p = panel((m, cuerpo) => ({ ...m, ...cuerpo, clausulas: [...cuerpo.clausulas].reverse() }));
  const texto = (await guardarPerfil(p.fetchFn, COOKIE, ENVIADO)).join('\n');
  assert.match(texto, /🔴 DISTINTO\s+clausulas: .* · difiere en clausulas\[0\]\.id: 1 ≠ 2/, texto);
});
