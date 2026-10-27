// SCRUM-1536 · que hace HOY el codigo con un comercio de las seis provincias.
// Uso: node sonda.cjs <dist>. Solo LEE: carga cuatro modulos puros ya compilados y los llama.
// No toca base ni red. El entorno del sujeto se limpia a mano (los dos flags fiscales fuera).
const path = require('node:path');
const dist = process.argv[2];
delete process.env.INVOICING_ES_ENABLED;
delete process.env.SIF_ENABLED;
const { zonaDeAlta } = require(path.join(dist, 'modules/auth/domain/zonaDeLaProvincia.js'));
const { getEmissionMode } = require(path.join(dist, 'modules/invoicing/domain/emission.service.js'));
const { invalidTipoIva } = require(path.join(dist, 'core/validation/fiscalInput.js'));
const { isFlagEnabled } = require(path.join(dist, 'core/flags.js'));

const SEIS = ['Álava', 'Bizkaia', 'Gipuzkoa', 'Navarra', 'Las Palmas', 'Santa Cruz de Tenerife'];
const intenta = (fn) => { try { return fn(); } catch (e) { return 'LANZA ' + (e.code || e.message); } };

console.log('## A · el alta: que devuelve zonaDeAlta (lo UNICO que la provincia produce)');
let todas = [];
try { zonaDeAlta('ES', ''); } catch (e) { todas = e.provincias; }
const porZona = {};
for (const p of todas) { const z = zonaDeAlta('ES', p); (porZona[z] ??= []).push(p); }
console.log('POBLACION provincias de la tabla =', todas.length, '· por zona:', Object.entries(porZona).map(([z, l]) => `${z}=${l.length}`).join(' · '));
for (const p of SEIS) console.log('  ', p.padEnd(24), '→', intenta(() => zonaDeAlta('ES', p)), '· esta en la tabla:', todas.includes(p));
console.log('   control de cero (provincia inventada «Qwzx») →', intenta(() => zonaDeAlta('ES', 'Qwzx')));
console.log('   control positivo («Madrid») →', intenta(() => zonaDeAlta('ES', 'Madrid')));
console.log('   tipo de lo devuelto para Bizkaia:', typeof zonaDeAlta('ES', 'Bizkaia'), '— una cadena de zona, sin provincia ni regimen dentro');
console.log('   Bizkaia y Madrid dan el MISMO valor:', zonaDeAlta('ES', 'Bizkaia') === zonaDeAlta('ES', 'Madrid'));

console.log('\n## B · la puerta de emision: que propiedades del comercio LEE getEmissionMode (Proxy que apunta cada lectura)');
function espiado(base) {
  const leidas = new Set();
  const p = new Proxy(base, {
    get(t, k) { if (typeof k === 'string') leidas.add(k); return t[k]; },
    has(t, k) { if (typeof k === 'string') leidas.add('in:' + k); return k in t; },
    ownKeys(t) { leidas.add('<enumera todas>'); return Reflect.ownKeys(t); },
  });
  return { p, leidas };
}
const BASE = { id: 4242, email: 'sonda-1536@example.invalid', country: 'ES', flags: null, address: 'Gran Vía 1, 48001 Bilbao', nif: 'B00000000' };
const CASOS = [
  ['Madrid · no foral', { timezone: 'Europe/Madrid', domicilioFiscalForal: false }],
  ['Bizkaia · dijo SI a domicilio foral', { timezone: 'Europe/Madrid', domicilioFiscalForal: true }],
  ['Navarra · dijo SI a domicilio foral', { timezone: 'Europe/Madrid', domicilioFiscalForal: true }],
  ['Alava · no consta', { timezone: 'Europe/Madrid', domicilioFiscalForal: null }],
  ['Gipuzkoa · dijo SI', { timezone: 'Europe/Madrid', domicilioFiscalForal: true }],
  ['Las Palmas', { timezone: 'Atlantic/Canary', domicilioFiscalForal: false }],
  ['Santa Cruz de Tenerife', { timezone: 'Atlantic/Canary', domicilioFiscalForal: false }],
];
const union = new Set();
for (const [flagTxt, flags] of [['flag OFF (como hoy)', null], ['flag ON por override del comercio', { INVOICING_ES_ENABLED: true }]]) {
  console.log('  ·', flagTxt);
  const vistos = new Set();
  for (const [nombre, extra] of CASOS) {
    const { p, leidas } = espiado({ ...BASE, ...extra, flags });
    const modo = getEmissionMode(p);
    vistos.add(modo);
    leidas.forEach((k) => union.add(k));
    console.log('     ', nombre.padEnd(38), '→', modo);
  }
  console.log('      resultados distintos entre los', CASOS.length, 'casos:', vistos.size, [...vistos].join(','));
}
console.log('   PROPIEDADES LEIDAS (union de', CASOS.length * 2, 'llamadas):', [...union].sort().join(', '));
for (const k of ['timezone', 'domicilioFiscalForal', 'address', 'nif']) console.log('     ¿lee', k + '?', union.has(k));
// controles: la puerta SI cambia con lo que si lee
console.log('   control positivo 1 (country MX) →', getEmissionMode({ ...BASE, country: 'MX' }), '(tiene que ser fiscal)');
console.log('   control positivo 2 (id 1, demo) →', getEmissionMode({ ...BASE, id: 1 }), '(tiene que ser demo)');
console.log('   control del espia: una funcion que SI lee timezone la apunta →', (() => { const { p, leidas } = espiado({ timezone: 'x' }); void p.timezone; return leidas.has('timezone'); })());
console.log('   isFlagEnabled sin override ni env →', isFlagEnabled('INVOICING_ES_ENABLED', { merchant: BASE }), '· env INVOICING_ES_ENABLED en este proceso:', process.env.INVOICING_ES_ENABLED);

console.log('\n## C · los tipos: que acepta la unica regla (invalidTipoIva)');
const fila = (n, lista) => { let ok = 0; for (const t of lista) { const m = invalidTipoIva(t / 100); if (!m) ok++; console.log('     ', n, String(t).padStart(4), '% →', m ? 'RECHAZA' : 'acepta'); } return ok; };
const IGIC = [0, 3, 7, 9.5, 15, 20];
const okIgic = fila('IGIC', IGIC);
const IVA = [21, 10, 4];
const okIva = fila('IVA ', IVA);
console.log('   IGIC aceptados', okIgic, 'de', IGIC.length, '· IVA aceptados', okIva, 'de', IVA.length, '(control positivo: 3 de 3)');
console.log('EXIT=0');
