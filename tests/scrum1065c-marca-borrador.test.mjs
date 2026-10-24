// tests/scrum1065c-marca-borrador.test.mjs — SCRUM-1065c · la marca firmada de los borradores.
//
// El fundador firmó «Borrador para tu asesor» (SCRUM-1064 c.20780, T2) como marca de los
// borradores del 303, 130, 347 y 390 (SCRUM-1065 c.20813), y la amplió al 111/115 (c.20820).
// Sustituye al aviso pendiente que viajaba en `avisoObligatorio`. Es UNA constante
// (`AVISO_ORIENTATIVO`, `modelo303.ts`) que importan los demás: medido el 24-oct-2026, el marcador
// estaba una sola vez en `src/modules/fiscal/`, no una por modelo.
//
// Lo que fija este fichero:
//   ① el literal, letra a letra;
//   ② que los cinco módulos que construyen borradores la CABLEAN a `avisoObligatorio`, y que
//      ninguno trae un texto propio;
//   ③ que en sus carpetas no queda ningún marcador de microcopy pendiente — con su población
//      declarada y un positivo SEMBRADO (no tomado del árbol: el día que alguien arregla el
//      defecto prestado, el control se queda mudo).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { censar } from '../scripts/censo-marcadores.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { AVISO_ORIENTATIVO } = await import('../dist/modules/fiscal/modelo303/modelo303.js');

export const MUTACIONES_QUE_ME_TUMBAN = [
  { fichero: 'src/modules/fiscal/modelo303/modelo303.ts', de: "export const AVISO_ORIENTATIVO = 'Borrador para tu asesor';",
    a: "export const AVISO_ORIENTATIVO = 'Borrador para el asesor';",
    cae: 'SCRUM-1065c · la marca es el literal firmado' },
  { fichero: 'src/modules/fiscal/retenciones/retencionesPracticadas.ts', de: '    avisoObligatorio: AVISO_ORIENTATIVO,',
    a: "    avisoObligatorio: 'Resumen orientativo',",
    cae: 'SCRUM-1065c · los cinco módulos cablean la marca' },
];

/** Copiado de SCRUM-1064 c.20780 (T2), leído en Jira por la API el 24-oct-2026. */
const LITERAL_FIRMADO = 'Borrador para tu asesor';

// Las carpetas de los borradores y, en cada una, el fichero que construye el resultado.
const CARPETAS = [
  'src/modules/fiscal/modelo303',
  'src/modules/fiscal/modelo130',
  'src/modules/fiscal/modelo347',
  'src/modules/fiscal/modelo390',
  'src/modules/fiscal/retenciones',
];
const CONSUMIDORES = [
  'src/modules/fiscal/modelo130/modelo130.ts',
  'src/modules/fiscal/modelo347/modelo347.ts',
  'src/modules/fiscal/modelo390/modelo390.ts',
  'src/modules/fiscal/retenciones/retencionesPracticadas.ts',
];

// Se compone para que este fichero no lleve el marcador escrito entero.
const MARCADOR = '[' + 'PENDIENTE';
const PENDIENTE_MICROCOPY = 'PENDIENTE' + ' microcopy';

/** Los `.ts` de las carpetas, bajo `raiz`, con su ruta relativa. */
function poblacion(raiz) {
  const out = [];
  for (const c of CARPETAS) {
    const dir = path.join(raiz, c);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) if (f.endsWith('.ts')) out.push(`${c}/${f}`);
  }
  return out;
}

/** Lo que el barrido encuentra bajo `raiz`: el censo de la casa y la subcadena del encargo. */
function barrido(raiz) {
  const ficheros = poblacion(raiz);
  const enCarpetas = (f) => CARPETAS.some((c) => f.startsWith(c + '/'));
  const marcas = censar(raiz).marcas.filter((m) => enCarpetas(m.fichero)).map((m) => `${m.fichero}:${m.linea ?? '?'}`);
  const subcadena = ficheros.filter((f) => fs.readFileSync(path.join(raiz, f), 'utf8').includes(PENDIENTE_MICROCOPY));
  return { ficheros, marcas, subcadena };
}

test('SCRUM-1065c · la marca es el literal firmado', () => {
  assert.equal(AVISO_ORIENTATIVO, LITERAL_FIRMADO,
    '🔴 la marca de los borradores no es la que firmó el fundador (SCRUM-1065 c.20813 y c.20820).');
});

test('SCRUM-1065c · los cinco módulos cablean la marca, y ninguno trae un texto suyo', () => {
  const fuente303 = fs.readFileSync(path.join(RAIZ, 'src/modules/fiscal/modelo303/modelo303.ts'), 'utf8');
  assert.match(fuente303, /^\s*avisoObligatorio: AVISO_ORIENTATIVO,$/m, 'el 303 no viaja con la marca');
  for (const f of CONSUMIDORES) {
    const fuente = fs.readFileSync(path.join(RAIZ, f), 'utf8');
    assert.match(fuente, /^import \{[^}]*\bAVISO_ORIENTATIVO\b[^}]*\} from '\.\.\/modelo303\/modelo303';$/m,
      `🔴 ${f} no importa la marca del 303`);
    // Las asignaciones (`campo: valor,`), no la declaración del tipo (`avisoObligatorio: string;`).
    const asignaciones = [...fuente.matchAll(/^\s*avisoObligatorio:\s*([^;\n]+?),\s*$/gm)].map((m) => m[1]);
    assert.deepEqual(asignaciones, ['AVISO_ORIENTATIVO'],
      `🔴 ${f} rellena \`avisoObligatorio\` con otra cosa que la marca firmada: ${JSON.stringify(asignaciones)}`);
  }
});

test('SCRUM-1065c · 🔴 ningún marcador de microcopy pendiente en las carpetas de los borradores', () => {
  const r = barrido(RAIZ);
  // Población declarada: si el barrido no ve los ficheros que construyen los borradores, un cero no dice nada.
  for (const f of ['src/modules/fiscal/modelo303/modelo303.ts', ...CONSUMIDORES]) {
    assert.ok(r.ficheros.includes(f), `CIEGO: el barrido no ve ${f} (ve ${r.ficheros.length} ficheros)`);
  }
  assert.deepEqual(r.marcas, [], '🔴 quedan marcadores pendientes en los borradores');
  assert.deepEqual(r.subcadena, [], `🔴 queda «${PENDIENTE_MICROCOPY}» en los borradores`);
});

test('SCRUM-1065c · 🔵 CONTROL POSITIVO: el barrido ve un marcador sembrado, y sin él no ve nada', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1065c-'));
  try {
    const dir = path.join(tmp, 'src/modules/fiscal/modelo130');
    fs.mkdirSync(dir, { recursive: true });
    const sembrado = path.join(dir, 'sembrado.ts');
    fs.writeFileSync(sembrado, `export const X = '${MARCADOR} microcopy oficial] Texto sin firmar.';\n`);
    const con = barrido(tmp);
    assert.deepEqual(con.ficheros, ['src/modules/fiscal/modelo130/sembrado.ts']);
    assert.equal(con.marcas.length, 1, `el censo no ve el marcador sembrado: ${JSON.stringify(con.marcas)}`);
    assert.deepEqual(con.subcadena, ['src/modules/fiscal/modelo130/sembrado.ts']);

    fs.writeFileSync(sembrado, `export const X = '${LITERAL_FIRMADO}';\n`);
    const sin = barrido(tmp);
    assert.equal(sin.ficheros.length, 1);
    assert.deepEqual([sin.marcas, sin.subcadena], [[], []]);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
