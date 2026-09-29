// tests/scrum1179d-herramientas-no-red.test.mjs — SCRUM-1179 (parte D)
//
// Seis comandos de la casa son HERRAMIENTAS MANUALES: nada los corre sobre el árbol para juzgarlo.
// Su cabecera lo dice («HERRAMIENTA MANUAL, NO RED»), porque citar como red algo que no corre es lo
// que dejó los botones de cobro sin vigilar en SCRUM-1172. Este test mantiene esa cabecera CIERTA
// en las dos direcciones:
//   · la marca no puede desaparecer de la cabecera;
//   · si alguien empieza a correr una de ellas en `test`/`pretest` o en un workflow, la marca pasa a
//     ser FALSA y esto se pone rojo: entonces sí es una red y la cabecera tiene que decirlo.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MARCA = 'HERRAMIENTA MANUAL, NO RED';
const HERRAMIENTAS = [
  'censo:vias-de-cobro',
  'censo:conflictos-package',
  'cr:censo',
  'cr:tecnica',
  'cr:limpiar',
  'topologia',
];
const SCRIPTS = JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8')).scripts;

function ficheroDe(nombre) {
  const m = /scripts\/[\w.-]+\.mjs/.exec(String(SCRIPTS[nombre] || ''));
  return m ? m[0] : null;
}

/** ¿Este texto (un comando de npm o un workflow) EJECUTA la herramienta? Los comentarios YAML no cuentan. */
function laEjecuta(texto, nombre, fichero) {
  const vivo = String(texto).split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`npm run ${esc(nombre)}(?![\\w:-])`).test(vivo) || (fichero !== null && vivo.includes(fichero));
}

test('SCRUM-1179-D · las seis herramientas existen y cada fichero lleva la marca en su cabecera', () => {
  for (const h of HERRAMIENTAS) {
    const f = ficheroDe(h);
    assert.ok(f && fs.existsSync(path.join(RAIZ, f)), `🔴 CIEGO: \`${h}\` no está en package.json o su fichero no existe.`);
    const cabecera = fs.readFileSync(path.join(RAIZ, f), 'utf8').split('\n').slice(0, 6).join('\n');
    assert.ok(cabecera.includes(MARCA),
      `🔴 ${f} (\`${h}\`) ha perdido «${MARCA}» de su cabecera. Sin ella, el próximo que retire un guard\n`
      + '  puede citarla como red, y no corre en ningún sitio.');
  }
});

test('SCRUM-1179-D · ninguna se corre en test/pretest ni en un workflow (si no, la marca miente)', () => {
  const dir = path.join(RAIZ, '.github', 'workflows');
  const workflows = fs.readdirSync(dir).filter((n) => /\.ya?ml$/.test(n));
  assert.ok(workflows.length > 0, '🔴 CIEGO: no encuentro ningún workflow que leer.');
  const fuentes = [
    ['package.json · test', SCRIPTS.test],
    ['package.json · pretest', SCRIPTS.pretest],
    ...workflows.map((n) => [`.github/workflows/${n}`, fs.readFileSync(path.join(dir, n), 'utf8')]),
  ];
  for (const h of HERRAMIENTAS) {
    for (const [donde, texto] of fuentes) {
      assert.equal(laEjecuta(texto, h, ficheroDe(h)), false,
        `🔴 \`${h}\` se ejecuta en ${donde}: YA ES una red, y su cabecera dice «${MARCA}».\n`
        + '  Quita la marca de su cabecera, di qué vigila y sácala de la lista HERRAMIENTAS de este test.');
    }
  }
});

test('SCRUM-1179-D · el detector ve una ejecución y no confunde un comentario ni un nombre parecido', () => {
  assert.equal(laEjecuta('      - run: npm run cr:censo', 'cr:censo', 'scripts/censo-cr-en-disco.mjs'), true);
  assert.equal(laEjecuta('run: node scripts/censo-cr-en-disco.mjs --tecnica x', 'cr:tecnica', 'scripts/censo-cr-en-disco.mjs'), true);
  assert.equal(laEjecuta('      # npm run cr:censo lo contaba', 'cr:censo', 'scripts/censo-cr-en-disco.mjs'), false);
  assert.equal(laEjecuta('npm run censo:vias-de-cobro-extra', 'censo:vias-de-cobro', null), false);
});
