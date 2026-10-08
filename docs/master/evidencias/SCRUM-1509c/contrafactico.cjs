// SCRUM-1509c - CONTRAFACTICO EN MEMORIA. No toca `src/` ni `dist/`: cambia el texto de
// `dist/integrations/whatsapp.js` AL CARGARLO en este proceso, y corre `medir.cjs` encima.
// NO ES UN ARREGLO NI UNA PROPUESTA DE CODIGO: es la pregunta «si se hiciera X, que casos cambian».
//
// Uso: node contrafactico.cjs <dist> <variante>
//   lectura-cerrada   el `catch` de la lectura del tope BLOQUEA en vez de dejar pasar
//   escritura-esperada el registro del envio que SALIO se espera (`await`) antes de volver
// Cada variante exige un numero EXACTO de sustituciones; si no lo encuentra, sale 2 sin medir.
const Module = require('module');
const variante = process.argv[3];
const VARIANTES = {
  'lectura-cerrada': {
    de: "console.error('[WhatsApp] Error comprobando topes A3.2 (no se bloquea):', err?.message || err);",
    a: "console.error('[WhatsApp] Error comprobando topes A3.2 (no se bloquea):', err?.message || err); return { ok: false, reason: 'tope_no_comprobable' };",
    veces: 1,
  },
  'escritura-esperada': {
    // las dos filas `status: 'sent'` de la plantilla (la de dry-run y la de Meta): se esperan
    de: /(\n\s+)(\(0, whatsappLog_service_1\.recordWaMessage\)\(\{\s+merchantId: params\.merchantId,\s+customerId: params\.log\?\.customerId \?\? null,\s+type: 'template',\s+templateName: params\.templateName,\s+waMessageId: [^\n]+\n\s+status: 'sent',)/g,
    a: '$1await $2',
    veces: 2,
  },
};
const v = VARIANTES[variante];
if (!v) { console.log('variante desconocida: ' + variante + '. Las que hay: ' + Object.keys(VARIANTES).join(', ')); process.exit(2); }
const original = Module.prototype._compile;
let hechas = null;
Module.prototype._compile = function compilar(fuente, fichero) {
  if (/[\\/]integrations[\\/]whatsapp\.js$/.test(fichero)) {
    const n = typeof v.de === 'string' ? fuente.split(v.de).length - 1 : (fuente.match(v.de) || []).length;
    hechas = n;
    if (n !== v.veces) { process.stdout.write('CIEGO: sustituciones ' + n + ', esperadas ' + v.veces + '. No se mide.\n'); process.exit(2); }
    fuente = typeof v.de === 'string' ? fuente.split(v.de).join(v.a) : fuente.replace(v.de, v.a);
    // por stdout directo: `medir.cjs` ya ha silenciado `console.log` cuando esto se carga
    process.stdout.write('CONTRAFACTICO ' + variante + ': ' + n + ' sustitucion(es) de ' + v.veces + ' en ' + fichero.replace(/\\/g, '/').split('/').slice(-3).join('/') + '\n');
  }
  return original.call(this, fuente, fichero);
};
process.on('exit', () => { if (hechas === null) process.stdout.write('CIEGO: whatsapp.js no llego a cargarse\n'); });
require('./medir.cjs');
