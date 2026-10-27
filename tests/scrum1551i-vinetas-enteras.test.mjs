// tests/scrum1551i-vinetas-enteras.test.mjs — SCRUM-1551i
//
// /legal/alcance-beta servía 5 viñetas partidas: `mdToHtml` pintaba cada línea de continuación
// (la línea sangrada que sigue a un «- …») como un `<p>` suelto, fuera de la lista. Una de ellas
// es R4, firmada (SCRUM-1551 c.20208): «…Hasta» | «entonces YaQu no cobra por ti…». El fundador
// eligió arreglar el renderizador y no tocar el documento (SCRUM-1551 c.21020, salida A de la
// fila 9 de c.20632).
//
// Este guard pasa ALCANCE_BETA.md por el readLegalDoc REAL de dist (el que sirve la página y
// calcula su versión) y exige que cada viñeta del .md salga en UN `<li>`, con todas sus palabras.
// El positivo se SIEMBRA en un docs/legal de usar y tirar, con la salida exacta escrita aquí, para
// que el día que el documento real deje de tener viñetas largas el guard no se quede mudo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// Lo que tiene que tumbar a este fichero (las corre el meta-guard, `aplicarUna`): quitar la regla
// de la línea de continuación devuelve el `<p>` suelto, y caen los dos casos.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'src/modules/system/app/routes/legalPages.routes.ts',
    de: 'if (inList && /^\\s+\\S/.test(line))',
    a: 'if (false && inList && /^\\s+\\S/.test(line))',
    cae: 'SCRUM-1551i · cada viñeta de /legal/alcance-beta se sirve en UN <li>, con todas sus palabras',
  },
  {
    fichero: 'src/modules/system/app/routes/legalPages.routes.ts',
    de: 'if (inList && /^\\s+\\S/.test(line))',
    a: 'if (false && inList && /^\\s+\\S/.test(line))',
    cae: 'SCRUM-1551i · control sembrado: una viñeta de dos líneas sale entera, y lo que no es viñeta no cambia',
  },
];

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const MODULO = require.resolve(path.join(RAIZ, 'dist', 'modules', 'system', 'app', 'routes', 'legalPages.routes.js'));

// El módulo fija LEGAL_DIR con process.cwd() AL CARGARSE (lo mismo que hace scrum534r).
function servirDesde(raiz) {
  const antes = process.cwd();
  process.chdir(raiz);
  try {
    delete require.cache[MODULO];
    return require(MODULO).readLegalDoc('ALCANCE_BETA.md');
  } finally {
    process.chdir(antes);
    delete require.cache[MODULO];
  }
}

// Palabras de un trozo, sin etiquetas, sin asteriscos (la negrita no es una palabra) y con los
// espacios normalizados. La etiqueta se quita sin dejar espacio: `<strong>VERI</strong>FACTU` es
// una palabra, igual que `**VERI*****FACTU` en el .md.
function palabras(s) {
  return s.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/\*/g, '').replace(/\s+/g, ' ').trim();
}

// Las viñetas del .md, leídas aquí y no en el renderizador: «- …» más las líneas sangradas que
// la siguen sin línea en blanco.
function vinetasDelMd(md) {
  const out = [];
  let actual = null;
  for (const linea of md.split(/\r?\n/)) {
    if (/^\s*>/.test(linea)) { actual = null; continue; }
    const li = linea.match(/^\s*[-*]\s+(.*)$/);
    if (li && !/^---+$/.test(linea.trim())) { actual = [li[1]]; out.push(actual); continue; }
    if (actual && /^\s+\S/.test(linea)) { actual.push(linea.trim()); continue; }
    actual = null;
  }
  return out.map((ls) => ({ lineas: ls.length, texto: palabras(ls.join(' ')) }));
}

test('SCRUM-1551i · cada viñeta de /legal/alcance-beta se sirve en UN <li>, con todas sus palabras', () => {
  const md = fs.readFileSync(path.join(RAIZ, 'docs', 'legal', 'ALCANCE_BETA.md'), 'utf8');
  const vinetas = vinetasDelMd(md);
  const largas = vinetas.filter((v) => v.lineas > 1).length;
  // SUELO: hoy son 9 viñetas, 5 de ellas de más de una línea (c.20632). Si el documento deja de
  // tener viñetas largas, este caso no prueba nada y lo dice; el sembrado de abajo sigue probando.
  assert.ok(vinetas.length >= 1 && largas >= 1,
    `🔴 CIEGO: ALCANCE_BETA.md tiene ${vinetas.length} viñetas y ${largas} de más de una línea`);
  const doc = servirDesde(RAIZ);
  assert.ok(doc && doc.html.length > 500, `🔴 no se pudo servir ALCANCE_BETA.md: ${JSON.stringify(doc)?.slice(0, 80)}`);
  const servidos = [...doc.html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((m) => palabras(m[1]));
  assert.deepEqual(servidos, vinetas.map((v) => v.texto),
    '🔴 las viñetas servidas no son las del documento: alguna sale partida (una línea de continuación '
    + 'fuera de su <li>)');
});

test('SCRUM-1551i · control sembrado: una viñeta de dos líneas sale entera, y lo que no es viñeta no cambia', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1551i-'));
  try {
    fs.mkdirSync(path.join(tmp, 'docs', 'legal'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'docs', 'legal', 'ALCANCE_BETA.md'), [
      '## Sembrado 1551i',
      '- **uno** sigue',
      '  en la segunda línea',
      '- dos',
      '',
      'Párrafo suelto',
      'otro párrafo pegado',
      '',
    ].join('\n'));
    const doc = servirDesde(tmp);
    assert.ok(!doc.html.includes('Founding'), `🔴 el control leyó el documento REAL, no el sembrado: «${doc.html.slice(0, 120)}»`);
    assert.equal(doc.html, [
      '<h2>Sembrado 1551i</h2>',
      '<ul>',
      '<li><strong>uno</strong> sigue en la segunda línea</li>',
      '<li>dos</li>',
      '</ul>',
      '<p>Párrafo suelto</p>',
      '<p>otro párrafo pegado</p>',
    ].join('\n'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
