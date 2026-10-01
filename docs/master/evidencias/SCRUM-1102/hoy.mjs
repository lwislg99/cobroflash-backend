// QUE HACE HOY EL CODIGO con las dos respuestas (SII / foral) · solo lectura, sobre dist/ compilado.
//   node hoy.mjs <raiz de un arbol COMPILADO>
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const RAIZ = path.resolve(process.argv[2]);
const dist = (p) => import(pathToFileURL(path.join(RAIZ, 'dist', p)).href);
delete process.env.INVOICING_ES_ENABLED;
const { getEmissionMode } = await dist('modules/invoicing/domain/emission.service.js');
const { isFlagEnabled } = await dist('core/flags.js');
const { merchantProfileUpdateSchema } = await dist('core/validation/schemas.js');
const { cambiarFlagFiscal } = await dist('modules/system/domain/flagFiscal.service.js');
let testigos = 0;

console.log('① getEmissionMode · ¿cambia con la respuesta del SII?  (merchant ES real, id 7)');
const SII = [['No consta', null], ['Si', true], ['No', false]];
const FLAGS = [['sin override', null], ['override ON', { INVOICING_ES_ENABLED: true }], ['override OFF', { INVOICING_ES_ENABLED: false }]];
for (const env of [undefined, 'true']) {
  if (env === undefined) delete process.env.INVOICING_ES_ENABLED; else process.env.INVOICING_ES_ENABLED = env;
  for (const [nf, flags] of FLAGS) {
    const modos = SII.map(([ns, sii]) => { testigos++; return `${ns}→${getEmissionMode({ id: 7, email: 'pro@ejemplo.es', country: 'ES', flags, llevaLibrosPorSii: sii, domicilioFiscalForal: sii })}`; });
    console.log(`   env=${String(env).padEnd(9)} · ${nf.padEnd(12)} · ${modos.join('   ')}`);
  }
}
delete process.env.INVOICING_ES_ENABLED;
console.log('   CONTROL (el instrumento ve cambiar el modo cuando cambia lo que SI se lee): '
  + `flags null→${getEmissionMode({ id: 7, country: 'ES', flags: null })} · override ON→${getEmissionMode({ id: 7, country: 'ES', flags: { INVOICING_ES_ENABLED: true } })}`
  + ` · demo(id 1)→${getEmissionMode({ id: 1, country: 'ES', flags: null })} · pais MX→${getEmissionMode({ id: 7, country: 'MX', flags: null })}`
  + ` · pais null + override ON→${getEmissionMode({ id: 7, country: null, flags: { INVOICING_ES_ENABLED: true } })}`);

console.log('\n② PUT /admin/merchant · ¿puede el esquema dejar pasar `flags`? ¿y distingue los tres estados?');
const p = (o) => { const r = merchantProfileUpdateSchema.safeParse(o); testigos++; return r.success ? JSON.stringify(r.data) : 'RECHAZADO'; };
console.log('   {flags:{INVOICING_ES_ENABLED:true}, name:"x"}  →', p({ flags: { INVOICING_ES_ENABLED: true }, name: 'x' }));
console.log('   {llevaLibrosPorSii:null}                        →', p({ llevaLibrosPorSii: null }));
console.log('   {llevaLibrosPorSii:false}                       →', p({ llevaLibrosPorSii: false }));
console.log('   {llevaLibrosPorSii:true}                        →', p({ llevaLibrosPorSii: true }));
console.log('   {} (ausente)                                    →', p({}));
console.log('   {country:"MX", name:"x"} (¿puede cambiarse el PAIS?)   →', p({ country: 'MX', name: 'x' }));
console.log('   {llevaLibrosPorSii:"si"} (control: algo que NO debe pasar) →', p({ llevaLibrosPorSii: 'si' }));

console.log('\n③ cambiarFlagFiscal · ¿se niega a ENCENDER segun la respuesta?  (cliente doblado, sin base)');
for (const [ns, sii] of SII) {
  const fila = { id: 7, email: 'pro@ejemplo.es', country: 'ES', flags: null, llevaLibrosPorSii: sii, domicilioFiscalForal: sii };
  const auditorias = [];
  const cliente = {
    merchant: { findUnique: async () => ({ ...fila }), update: async ({ data }) => { Object.assign(fila, data); return fila; } },
    auditLog: { create: async ({ data }) => { auditorias.push(data); return data; } },
    $transaction: async (fn) => fn(cliente),
  };
  let salida;
  try { const r = await cambiarFlagFiscal({ merchantId: 7, flag: 'INVOICING_ES_ENABLED', valorNuevo: true, confirmacion: 'pro@ejemplo.es', actor: { tipo: 'sistema', teamMemberId: null, ref: 'sonda' } }, cliente); salida = `ENCENDIDO (${r.anterior}→${r.nuevo}) · filas de auditoria ${auditorias.length} · efectivo despues: ${isFlagEnabled('INVOICING_ES_ENABLED', { merchant: fila })}`; }
  catch (e) { salida = `NEGADO: ${e.codigo || e.message}`; }
  testigos++;
  console.log(`   SII y foral = ${ns.padEnd(9)} → ${salida}`);
}
{
  const cliente = { merchant: { findUnique: async () => ({ id: 7, email: 'pro@ejemplo.es', country: 'ES', flags: null }), update: async () => { throw new Error('no debia escribir'); } }, auditLog: { create: async () => ({}) }, $transaction: async (fn) => fn(cliente) };
  let salida; try { await cambiarFlagFiscal({ merchantId: 7, flag: 'INVOICING_ES_ENABLED', valorNuevo: true, confirmacion: 'otro@ejemplo.es', actor: { tipo: 'sistema', teamMemberId: null, ref: 'sonda' } }, cliente); salida = 'ENCENDIDO'; } catch (e) { salida = `NEGADO: ${e.codigo || e.message}`; }
  console.log(`   CONTROL (esta puerta SI sabe negarse: confirmacion equivocada) → ${salida}`);
}
console.log(`\nTESTIGOS: ${testigos} mediciones ejecutadas · EXIT=0`);
