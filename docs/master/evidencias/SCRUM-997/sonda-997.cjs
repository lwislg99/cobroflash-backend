// SCRUM-997 · S0 · sonda de SOLO LECTURA sobre getEmissionMode (dist/ del worktree que se le pasa).
// uso: node sonda-997.cjs <raiz del worktree>
// No toca base ni red. Llama a la funcion compilada con comercios fabricados y un espia de propiedades.
const path = require('node:path');
if (!process.argv[2]) { console.error('falta la raiz'); process.exit(2); }
// Absoluta: con una raiz relativa, `require` la toma por nombre de paquete y no arranca.
const raiz = path.resolve(process.argv[2]);
// Con un tercer argumento, la salida va TAMBIEN a ese fichero, escrita por node: la consola de
// PowerShell 5.1 estropea lo que no es ASCII al capturarla.
const salida = [];
const decir = console.log.bind(console);
console.log = (linea) => { salida.push(String(linea)); decir(linea); };
process.on('exit', () => {
  if (process.argv[3]) require('node:fs').writeFileSync(path.resolve(process.argv[3]), salida.join('\n') + '\n');
});
const { getEmissionMode } = require(path.join(raiz, 'dist/modules/invoicing/domain/emission.service.js'));
const { FLAG_DEFAULTS } = require(path.join(raiz, 'dist/core/flags.js'));

function espia(obj, leidas) {
  return new Proxy(obj, { get(t, p) { if (typeof p === 'string') leidas.add(p); return t[p]; } });
}
const COMERCIOS = [
  ['Madrid', { id: 101, email: 'a@x.test', country: 'ES', domicilioFiscalForal: false, timezone: 'Europe/Madrid', address: 'Madrid' }],
  ['Bizkaia, foral SI', { id: 102, email: 'b@x.test', country: 'ES', domicilioFiscalForal: true, timezone: 'Europe/Madrid', address: 'Bilbao' }],
  ['Gipuzkoa, foral SI', { id: 103, email: 'c@x.test', country: 'ES', domicilioFiscalForal: true, timezone: 'Europe/Madrid', address: 'Donostia' }],
  ['Navarra, foral SI', { id: 104, email: 'd@x.test', country: 'ES', domicilioFiscalForal: true, timezone: 'Europe/Madrid', address: 'Pamplona' }],
  ['Alava, sin contestar', { id: 105, email: 'e@x.test', country: 'ES', domicilioFiscalForal: null, timezone: 'Europe/Madrid', address: 'Vitoria' }],
  ['Las Palmas', { id: 106, email: 'f@x.test', country: 'ES', domicilioFiscalForal: false, timezone: 'Atlantic/Canary', address: 'Las Palmas' }],
  ['S.C. Tenerife', { id: 107, email: 'g@x.test', country: 'ES', domicilioFiscalForal: false, timezone: 'Atlantic/Canary', address: 'Santa Cruz' }],
];
const VIAS = [
  ['por defecto (sin variable, sin override)', () => { delete process.env.INVOICING_ES_ENABLED; }, () => undefined],
  ['variable de entorno = false', () => { process.env.INVOICING_ES_ENABLED = 'false'; }, () => undefined],
  ['variable de entorno = true', () => { process.env.INVOICING_ES_ENABLED = 'true'; }, () => undefined],
  ['override del comercio = true (sin variable)', () => { delete process.env.INVOICING_ES_ENABLED; }, () => ({ INVOICING_ES_ENABLED: true })],
  ['override del comercio = false, variable = true', () => { process.env.INVOICING_ES_ENABLED = 'true'; }, () => ({ INVOICING_ES_ENABLED: false })],
];
console.log(`POBLACION: ${COMERCIOS.length} comercios x ${VIAS.length} vias = ${COMERCIOS.length * VIAS.length} llamadas · FLAG_DEFAULTS.INVOICING_ES_ENABLED = ${FLAG_DEFAULTS.INVOICING_ES_ENABLED}`);
const leidasTotal = new Set();
let llamadas = 0;
for (const [via, prepara, flags] of VIAS) {
  prepara();
  const cuenta = {};
  const filas = [];
  for (const [nombre, m] of COMERCIOS) {
    const leidas = new Set();
    const modo = getEmissionMode(espia({ ...m, flags: flags() }, leidas));
    llamadas++;
    for (const p of leidas) leidasTotal.add(p);
    cuenta[modo] = (cuenta[modo] ?? 0) + 1;
    filas.push(`${nombre}=${modo}`);
  }
  console.log(`VIA ${via}: ${JSON.stringify(cuenta)} · ${filas.join(' | ')}`);
}
delete process.env.INVOICING_ES_ENABLED;
console.log(`LLAMADAS: ${llamadas} · PROPIEDADES LEIDAS (union): ${[...leidasTotal].sort().join(', ')}`);
console.log(`NO LEIDAS de las que llevaba el comercio: ${['domicilioFiscalForal', 'timezone', 'address'].filter((p) => !leidasTotal.has(p)).join(', ') || '(ninguna)'}`);

// CONTROLES
const c1 = getEmissionMode({ id: 201, email: 'h@x.test', country: 'MX' });
const c2 = getEmissionMode({ id: 1, email: 'x@x.test', country: 'ES' });
process.env.INVOICING_ES_ENABLED = 'true';
const c3 = getEmissionMode({ id: 202, email: 'i@x.test', country: 'MX', flags: { INVOICING_ES_ENABLED: false } });
delete process.env.INVOICING_ES_ENABLED;
const l4 = new Set();
const e4 = espia({ timezone: 'Atlantic/Canary', domicilioFiscalForal: true }, l4);
void e4.timezone; void e4.domicilioFiscalForal;
console.log(`CONTROL pais MX -> ${c1} (se espera fiscal) · CONTROL id demo -> ${c2} (se espera demo) · CONTROL MX con override false -> ${c3} (se espera fiscal: el pais no pasa por el flag)`);
console.log(`CONTROL del espia: leyendo timezone y domicilioFiscalForal apunta -> ${[...l4].sort().join(', ')} (se esperan las dos)`);
const ok = c1 === 'fiscal' && c2 === 'demo' && c3 === 'fiscal' && l4.has('timezone') && l4.has('domicilioFiscalForal');
console.log(`CONTROLES: ${ok ? 'los cuatro como se esperaba' : 'ALGUNO NO SALIO COMO SE ESPERABA: la sonda no vale'}`);
console.log(`EXIT=${ok ? 0 : 1}`);
process.exit(ok ? 0 : 1);
