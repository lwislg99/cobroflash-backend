import fs from 'node:fs';
import path from 'node:path';
import { XmlDocument, XsdValidator, xmlRegisterInputProvider } from 'libxml2-wasm';

const XSD = path.join('..', 'src', 'modules', 'fiscal', 'verifactu', 'xsd');
const leer = (f) => fs.readFileSync(path.join(XSD, f), 'utf8');

// Proveedor de recursos: resuelve los imports (incluida la URL remota de xmldsig) contra
// los XSD vendorizados. Sin salir a la red — el equivalente al XmlResolver=$null del .ps1.
const mapa = new Map([
  ['SuministroInformacion.xsd', leer('SuministroInformacion.xsd')],
  ['http://www.w3.org/TR/xmldsig-core/xmldsig-core-schema.xsd', leer('xmldsig-core-schema.xsd')],
  ['xmldsig-core-schema.xsd', leer('xmldsig-core-schema.xsd')],
]);
const buffers = new Map();
let sig = 0;
xmlRegisterInputProvider({
  match: (url) => mapa.has(url) || mapa.has(path.basename(url)),
  open: (url) => {
    const c = mapa.get(url) ?? mapa.get(path.basename(url));
    if (!c) return undefined;
    const fd = ++sig;
    buffers.set(fd, { buf: Buffer.from(c, 'utf8'), pos: 0 });
    return fd;
  },
  read: (fd, buf) => {
    const s = buffers.get(fd); if (!s) return -1;
    const n = Math.min(buf.byteLength, s.buf.length - s.pos);
    if (n <= 0) return 0;
    buf.set(s.buf.subarray(s.pos, s.pos + n)); s.pos += n; return n;
  },
  close: (fd) => buffers.delete(fd),
});

const schemaDoc = XmlDocument.fromString(leer('SuministroLR.xsd'), { url: 'SuministroLR.xsd' });
const validator = XsdValidator.fromDoc(schemaDoc);

for (const f of ['valido.xml', 'invalido.xml']) {
  const doc = XmlDocument.fromString(fs.readFileSync(f, 'utf8'));
  console.log('--- ' + f + ' ---');
  try { validator.validate(doc); console.log('  valid: true'); }
  catch (e) {
    console.log('  valid: false');
    for (const d of (e.details ?? [{ message: e.message }])) console.log('  ' + String(d.message).trim());
  }
  doc.dispose();
  console.log('');
}
validator.dispose(); schemaDoc.dispose();
