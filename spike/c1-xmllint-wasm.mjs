import fs from 'node:fs';
import path from 'node:path';
import { validateXML } from 'xmllint-wasm';

const XSD = path.join('..', 'src', 'modules', 'fiscal', 'verifactu', 'xsd');
const leer = (f) => fs.readFileSync(path.join(XSD, f), 'utf8');

// El XSD de la AEAT importa xmldsig por URL REMOTA. Sin red en WASM hay que reescribir
// ese schemaLocation al fichero local vendorizado (equivalente al XmlResolver=$null del .ps1).
const info = leer('SuministroInformacion.xsd').replace(
  'schemaLocation="http://www.w3.org/TR/xmldsig-core/xmldsig-core-schema.xsd"',
  'schemaLocation="xmldsig-core-schema.xsd"',
);

const preload = [
  { fileName: 'SuministroInformacion.xsd', contents: info },
  { fileName: 'xmldsig-core-schema.xsd', contents: leer('xmldsig-core-schema.xsd') },
];

async function valida(fichero) {
  const r = await validateXML({
    xml: [{ fileName: fichero, contents: fs.readFileSync(fichero, 'utf8') }],
    schema: [leer('SuministroLR.xsd')],
    preload,
  });
  return r;
}

for (const f of ['valido.xml', 'invalido.xml']) {
  const r = await valida(f);
  console.log('--- ' + f + ' ---');
  console.log('  valid: ' + r.valid);
  for (const e of r.errors ?? []) console.log('  ' + (e.rawMessage || e.message || JSON.stringify(e)).trim());
  console.log('');
}
