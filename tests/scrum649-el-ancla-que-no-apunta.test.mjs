// tests/scrum649-el-ancla-que-no-apunta.test.mjs — SCRUM-649
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LOS CONTROLES DE «EL SHA EXISTE», Y EL QUE DECIDE
//
// `RE_ANCLA` comprueba que el sha tenga FORMA de sha. Un ancla inventada tiene esa forma y
// pasaba en verde. Medido antes de tocar nada, sobre `SCRUM-16.md:3`: cambiar UN dígito del sha
// —manteniendo los 40 hexadecimales— dejaba el guard en **0 rojos**.
//
// Aquí no se re-prueba lo que ya prueba `scrum267`: se prueba que el arreglo distingue, que no
// tumba anclas buenas, y que lo que cerró SCRUM-859 sigue cerrado.
//
// ⚠️ NOTA DE TANDA: este fichero importa del guard —es donde viven `trocearEntradas` y
// `sondaDeExistencia`—, e importar un fichero de tests EJECUTA sus tests. Los 14 de
// `scrum267` corren también dentro de éste y el total de la tanda sube en 14. Se dice.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { trocearEntradas, sondaDeExistencia } from './scrum267-ancla-de-medicion.test.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GUARD = path.join(RAIZ, 'tests/scrum267-ancla-de-medicion.test.mjs');
const DIR = path.join(RAIZ, 'docs/master');

/** Lo que el meta-guard de la casa EJECUTA contra este fichero. */
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'tests/scrum267-ancla-de-medicion.test.mjs',
    de: "  const muertas = conAncla",
    a: "  const muertas = [].concat(conAncla).slice(0, 0)",
    cae: 'SCRUM-649 · 🔴 EL QUE DECIDE: un sha bien formado e INEXISTENTE hace caer el guard',
  },
];

const git = (args, input) =>
  execFileSync('git', args, { cwd: RAIZ, encoding: 'utf8', input, stdio: 'pipe' });

const resuelve = (sha) => /\bcommit\b/.test(git(['cat-file', '--batch-check'], sha + '\n'));

// ═════════════════════════════════════════════════════════════════════════════════════════
// SUELO
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-649 · SUELO: hay anclas que mirar, y la sonda pasa su control', () => {
  const s = sondaDeExistencia((args, input) => git(args, input));
  assert.equal(s.vale, true, `🔴 CIEGO: ${s.motivo}`);

  const anclas = anclasDelRegistro();
  assert.ok(anclas.length > 300,
    `🔴 CIEGO: sólo ${anclas.length} anclas censadas. Un verde sobre eso no significa nada.`);
});

/** Todas las anclas del registro, con su sha, fichero y línea. */
function anclasDelRegistro() {
  const out = [];
  for (const f of fs.readdirSync(DIR).filter((x) => /^SCRUM-\d+\.md$/.test(x))) {
    const lineas = fs.readFileSync(path.join(DIR, f), 'utf8').split('\n');
    for (let i = 0; i < lineas.length; i++) {
      if (!/\*\*Medido contra:\*\*/.test(lineas[i])) continue;
      const sha = (/`([0-9a-f]{40})`/.exec(lineas.slice(i, i + 2).join('\n')) || [])[1];
      if (sha) out.push({ f, linea: i + 1, sha });
    }
  }
  return out;
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL QUE DECIDE · un sha bien formado e INEXISTENTE cae, nombrando fichero y línea
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-649 · 🔴 EL QUE DECIDE: un sha bien formado e INEXISTENTE hace caer el guard', () => {
  // Se toma un ancla REAL del árbol, se le cambia un dígito del sha manteniendo la forma, y se
  // corre el guard de verdad. El fichero se restaura byte a byte pase lo que pase.
  const real = anclasDelRegistro().find((a) => resuelve(a.sha));
  assert.ok(real, '🔴 CIEGO: no encuentro ningún ancla cuyo sha resuelva.');

  const inventado = (real.sha[0] === '0' ? '1' : '0') + real.sha.slice(1);
  assert.match(inventado, /^[0-9a-f]{40}$/, 'el sustituto tiene que tener la MISMA forma');
  assert.equal(resuelve(inventado), false,
    '🔴 CONTROL ROTO: el sha inventado resuelve. Con eso, lo de abajo no probaría nada.');

  const abs = path.join(DIR, real.f);
  const original = fs.readFileSync(abs, 'utf8');
  let salida = '';
  let code = 0;
  try {
    const l = original.split('\n');
    l[real.linea - 1] = l[real.linea - 1].replace(real.sha, inventado);
    const mutado = l.join('\n');
    // 🔴 Y SE COMPRUEBA QUE LA MUTACIÓN ENTRÓ: si no, el rojo de abajo sería de otra cosa.
    assert.notEqual(mutado, original, '🔴 la mutación no ha cambiado nada.');
    assert.ok(mutado.includes(inventado), '🔴 el sha inventado no está en el fichero mutado.');
    fs.writeFileSync(abs, mutado);
    // 🔴 `NODE_TEST_CONTEXT` SE QUITA DEL HIJO, y no es cosmética: `node --test` marca así a sus
    // hijos y, si la ve, SE NIEGA a ejecutar («run() is being called recursively… skipping
    // running files») **y sale con 0**. La primera versión de este control leía ese 0 como «el
    // guard pasa» y daba por vivo un defecto ya arreglado. Es la familia de SCRUM-850 dentro del
    // instrumento escrito para cazarla, y por eso abajo se exige ver el NOMBRE del fichero en la
    // salida: sin eso, un 0 no se distingue de un runner que no corrió.
    const entorno = { ...process.env };
    delete entorno.NODE_TEST_CONTEXT;
    try {
      salida = execFileSync(process.execPath,
        ['--test', '--test-force-exit', '--test-reporter=tap', 'tests/scrum267-ancla-de-medicion.test.mjs'],
        { cwd: RAIZ, encoding: 'utf8', stdio: 'pipe', env: entorno });
    } catch (e) { code = e.status ?? -1; salida = String(e.stdout || ''); }
    assert.doesNotMatch(salida, /skipping running files/,
      '🔴 el runner hijo NO ejecutó nada: lo de abajo mediría un proceso que no corrió.');
  } finally {
    fs.writeFileSync(abs, original);
  }
  assert.equal(fs.readFileSync(abs, 'utf8'), original, '🔴 el fichero NO quedó restaurado.');

  assert.notEqual(code, 0,
    '🔴 el guard sigue en VERDE con un ancla que no apunta a ningún sitio. Eso es exactamente '
    + 'el defecto de SCRUM-649.');
  assert.match(salida, new RegExp(real.f.replace('.', '\\.')),
    `🔴 el guard cae pero NO NOMBRA el fichero (${real.f}): un rojo que no dice dónde cuesta la `
    + 'vuelta entera.');
  assert.match(salida, new RegExp(inventado),
    '🔴 el guard cae pero no nombra el SHA que no resuelve.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ✅ POSITIVO · las anclas reales siguen pasando. TODAS.
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-649 · ✅ POSITIVO: TODAS las anclas reales resuelven — ni un rojo intermitente', () => {
  // Si el arreglo tumbara anclas buenas porque no sabe resolverlas, habría fabricado un rojo
  // intermitente y alguien lo relajaría. Se comprueba una por una, no «en general».
  const anclas = anclasDelRegistro();
  const shas = [...new Set(anclas.map((a) => a.sha))];
  const vivo = new Set(git(['cat-file', '--batch-check'], shas.join('\n') + '\n')
    .trim().split('\n').filter((l) => /\bcommit\b/.test(l)).map((l) => l.split(' ')[0]));

  // La lista declarada de las que NO resuelven, leída del guard (no copiada aquí).
  const declaradas = new Set([...fs.readFileSync(GUARD, 'utf8')
    .matchAll(/'(SCRUM-\d+\.md)#[^']*':\s*SHA_NO_RESUELVE,/g)].map((m) => m[1]));

  const rotas = anclas.filter((a) => !vivo.has(a.sha) && !declaradas.has(a.f))
    .map((a) => `${a.f}:${a.linea} — ${a.sha}`);
  assert.deepEqual(rotas, [],
    `🔴 hay anclas buenas que este guard no sabe resolver:\n  ${rotas.join('\n  ')}\n`
    + '  Eso no es un ancla mala: es un guard que no sabe mirar, y se relaja en dos semanas.');

  assert.equal(shas.length - vivo.size, declaradas.size,
    `🔴 no resuelven ${shas.length - vivo.size} shas y hay ${declaradas.size} declarados. `
    + 'Los números tienen que cuadrar o el censo no describe el árbol.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ✅ NEGATIVO · lo que cerró SCRUM-859 sigue cerrado
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-649 · ✅ NEGATIVO: SCRUM-859 sigue cerrado — tope de 5 e identidad', () => {
  const fuente = fs.readFileSync(GUARD, 'utf8');
  assert.match(fuente, /TOPE_INVISIBLE_HASTA_859 = 5;/,
    '🔴 el tope de INVISIBLE_HASTA_859 ha dejado de ser 5.');
  const usos = [...fuente.matchAll(/:\s*INVISIBLE_HASTA_859,/g)].length;
  assert.equal(usos, 5, `🔴 hay ${usos} usos de INVISIBLE_HASTA_859 y el motivo está cerrado en 5.`);
  assert.match(fuente, /identidadDeEntrada\(e\.tituloCompleto\)/,
    '🔴 la clave ha vuelto a ser posicional: referenciar por posición caduca.');

  // Y ejercido, no sólo leído: insertar una entrada no puede mover una clave.
  const texto = fs.readFileSync(path.join(DIR, 'SCRUM-244.md'), 'utf8');
  const titulos = (t) => trocearEntradas(t).map((e) => e.tituloCompleto);
  const l = texto.split('\n');
  const corte = l.findIndex((x, i) => i > 0 && /^# /.test(x));
  const conNueva = [...l.slice(0, corte),
    '# SCRUM-244 · insertada por el control de SCRUM-649', '',
    '**Medido contra:** `origin/main` = `' + 'a'.repeat(40) + '` · 2026-09-15T12:00:00+02:00', '',
    ...l.slice(corte)].join('\n');
  const antes = titulos(texto);
  const despues = titulos(conNueva);
  assert.deepEqual(antes.filter((t) => !despues.includes(t)), [],
    '🔴 insertar una entrada ha hecho desaparecer títulos: la identidad ya no es estable.');
});
