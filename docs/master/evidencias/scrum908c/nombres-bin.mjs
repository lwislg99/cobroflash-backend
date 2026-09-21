// Pone nombre a los mensajes que el Deserializer por defecto no sabe leer (los que llevan un Error):
// busca en sus bytes el título de cada test, en latin1 y en UTF-16LE (V8 usa uno u otro).
import { readFileSync } from 'node:fs';
import v8 from 'node:v8';
const T = process.env.J6_908C_DIR || '.'; // directorio de trabajo del banco (fuera del árbol)
const etq = process.argv[2];
const buf = readFileSync(`${T}/sonda-${etq}.bin`);
const msgs = JSON.parse(readFileSync(`${T}/sonda-${etq}.json`, 'utf8'));
const titulos = [...new Set(msgs.filter((m) => m.name && m.type === 'test:start').map((m) => m.name))];
console.log(`POBLACION mensajes=${msgs.length} titulos=${titulos.length}`);
for (const m of msgs.filter((x) => !x.type)) {
  const seg = buf.subarray(m.off, m.off + m.bytes);
  const hits = titulos.filter((t) => seg.includes(Buffer.from(t, 'latin1')) || seg.includes(Buffer.from(t, 'utf16le')));
  const tipo = ['test:fail', 'test:complete'].filter((t) => seg.includes(Buffer.from(t, 'latin1')));
  console.log(`${String(m.off).padStart(8)} ${String(m.bytes).padStart(7)}B ${tipo.join('|') || '?'} :: ${hits.map((h) => h.slice(0, 70)).join(' // ') || 'SIN TITULO'}`);
}
