// docs/master/evidencias/SCRUM-1446d/huellas.mjs — SCRUM-1446d
//
// Imprime las cuatro huellas que una entrada de `tests/_cambios-autorizados-de-la-factura.mjs`
// necesita: el cuerpo de `generateInvoicePdf` (lo que compara scrum603b) y su ámbito alcanzable
// (lo que compara scrum723), en la BASE de la rama y en el DISCO. Las huellas se COPIAN de aquí;
// no se escriben a mano.
//
//   node docs/master/evidencias/SCRUM-1446d/huellas.mjs
//
// Sale con 2 (CIEGO) si no puede resolver la base o leer el fichero en ella.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { contenidoEnLaBase } from '../../../../tests/_base-de-la-rama.mjs';
import { ambitoDeLaFactura } from '../../../../tests/_ambito-de-la-factura.mjs';
import { huella } from '../../../../tests/_cambios-autorizados-de-la-factura.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const REL = 'src/modules/invoicing/infra/pdf/pdf.service.ts';

// El mismo recorte que `scrum603b`: de la declaración a la siguiente de nivel superior.
const cuerpo = (txt) => {
  const ini = txt.indexOf('export async function generateInvoicePdf');
  if (ini === -1) return null;
  const sig = txt.indexOf('\nexport ', ini + 1);
  return txt.slice(ini, sig === -1 ? txt.length : sig);
};

const { contenido: deLaBase, base } = contenidoEnLaBase(RAIZ, REL);
if (!base || !deLaBase) {
  console.log('CIEGO: no se pudo leer ' + REL + ' en la base de la rama');
  process.exit(2);
}
const deDisco = fs.readFileSync(path.join(RAIZ, REL), 'utf8');

const filas = {
  'cuerpo.de': cuerpo(deLaBase),
  'cuerpo.a': cuerpo(deDisco),
  'ambito.de': ambitoDeLaFactura(deLaBase).texto,
  'ambito.a': ambitoDeLaFactura(deDisco).texto,
};
console.log('base: ' + base.ref + ' @ ' + base.sha);
for (const [k, t] of Object.entries(filas)) {
  if (!t) { console.log('CIEGO: ' + k + ' vacío'); process.exit(2); }
  console.log(k.padEnd(10) + ' ' + huella(t) + '  (' + t.length + ' car.)');
}
