// docs/master/evidencias/scrum864c/mutacion.mjs — SCRUM-864c
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 LA MUTACIÓN · ¿tienen dientes las dos piezas que entrega esta tanda?
//
// Un guard que nadie ha visto ponerse rojo es una decoración. Se le quita al árbol lo que el
// guard exige y se comprueba que CAE — y antes de creerse el rojo, que la mutación ENTRÓ de
// verdad: si el texto a sustituir no está, `replace` no cambia nada y el «sigue verde» sería el
// de un árbol intacto.
//
//     🔒 Una mutación que no entró no es un control: es un verde disfrazado.
//
//   ① EL MECANISMO — se le quita a `tests/_temporal.mjs` su `process.on('exit', limpiarTodo)`.
//      La cobaya que revienta debe volver a dejar su directorio tirado.
//   ② EL GUARD — se devuelve `tests/scrum899b` a su forma vieja (`fs.mkdtempSync` a pelo).
//      `scrum864c` debe ponerse ROJO y NOMBRAR ese fichero.
//   ③ EL ENDURECIMIENTO — se devuelve `tests/scrum182` a su forma de FÁBRICA. Las dos de arriba
//      caerían también con el guard flojo; ésta sólo cae con el que juzga `ESCAPA` y `FÁBRICA`,
//      que es lo que esta tanda añade. Sin ella, el endurecimiento sería una afirmación.
//
// Cada fichero se restaura byte a byte y se comprueba por SHA-256 que volvió exactamente a lo
// que era. Si algo falla a mitad, el `finally` restaura igual: un banco que deja el árbol mutado
// es peor que no tener banco.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const di = (s = '') => console.log(s);

/**
 * Sustituye uno o varios literales en un fichero y devuelve cómo deshacerlo. Aborta si alguno no
 * estaba: un `replace` que no encuentra su texto no falla, deja el fichero igual, y entonces el
 * «sigue verde» de después sería el de un árbol intacto.
 *
 * Admite varios pares porque devolver un sitio a su forma vieja puede necesitar más de una línea
 * —la conversión a `temporal()` se llevó por delante el `import os`, que allí ya no se usaba—, y
 * una mutación que deja el fichero sin compilar no reproduce el defecto: reproduce otro.
 */
function mutar(rel, ...pares) {
  const abs = path.join(RAIZ, rel);
  const original = fs.readFileSync(abs);
  const antes = sha(original);
  let texto = original.toString('utf8');
  for (const [de, a] of pares) {
    if (!texto.includes(de)) {
      throw new Error(`🔴 LA MUTACIÓN NO PUEDE ENTRAR en ${rel}: no encuentro el texto a sustituir.\n`
        + `   Buscaba: ${JSON.stringify(de.slice(0, 80))}\n`
        + '   Sin esto, un «sigue verde» sería el de un árbol intacto, no el de un guard que aguanta.');
    }
    texto = texto.replace(de, a);
  }
  fs.writeFileSync(abs, texto);
  const despues = sha(fs.readFileSync(abs));
  return {
    entro: antes !== despues,
    restaurar: () => {
      fs.writeFileSync(abs, original);
      return sha(fs.readFileSync(abs)) === antes;
    },
  };
}

/** Corre un fichero de test y dice si pasó y qué escribió. */
function corre(rel) {
  const r = spawnSync(process.execPath, ['--test', '--test-force-exit', path.join(RAIZ, rel)],
    { encoding: 'utf8', cwd: RAIZ });
  return { paso: r.status === 0, salida: (r.stdout || '') + (r.stderr || '') };
}

let fallos = 0;

// ═══ ① EL MECANISMO ══════════════════════════════════════════════════════════════════════════
di('═══ ① MUTACIÓN AL MECANISMO · `tests/_temporal.mjs` sin su enganche de salida ═══');
{
  const m = mutar('tests/_temporal.mjs',
    ["    process.on('exit', limpiarTodo);", '    /* MUTADO: sin enganche */']);
  di('   ¿ENTRÓ la mutación? ' + (m.entro ? 'sí (contenido distinto)' : '🔴 NO'));
  try {
    const r = spawnSync(process.execPath, [path.join(RAIZ, 'docs/master/evidencias/scrum864c/el-que-decide.mjs')],
      { encoding: 'utf8', cwd: RAIZ });
    const salida = (r.stdout || '') + (r.stderr || '');
    const linea = salida.split('\n').find((l) => l.includes('DESPUÉS (temporal())')) || '(sin línea)';
    di('   la cobaya DESPUÉS ahora: ' + linea.trim());
    const cae = /deja tirados: [1-9]/.test(linea);
    di('   VEREDICTO: ' + (cae
      ? '✅ CAE — sin el enganche vuelve el resto. El mecanismo es lo que limpia.'
      : '🔴 NO CAE — el resto no vuelve: entonces no era ese enganche quien limpiaba.'));
    if (!cae) fallos++;
  } finally {
    di('   restaurado byte a byte: ' + (m.restaurar() ? 'sí' : '🔴 NO'));
  }
}

// ═══ ② EL GUARD ══════════════════════════════════════════════════════════════════════════════
di('');
di('═══ ② MUTACIÓN AL ÁRBOL · `tests/scrum899b` vuelve a `fs.mkdtempSync` a pelo ═══');
{
  const m = mutar('tests/scrum899b-arranque-de-la-tanda.test.mjs',
    ["import { temporal } from './_temporal.mjs';", "import os from 'node:os';"],
    ["  const dir = temporal('scrum899b-');", "  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum899b-'));"]);
  di('   ¿ENTRÓ la mutación? ' + (m.entro ? 'sí (contenido distinto)' : '🔴 NO'));
  try {
    const r = corre('tests/scrum864c-el-temporal-no-vuelve.test.mjs');
    const nombrado = r.salida.includes('tests/scrum899b-arranque-de-la-tanda.test.mjs');
    di('   ¿el guard se pone ROJO? ' + (r.paso ? '🔴 NO, sigue verde' : 'sí'));
    di('   ¿NOMBRA al fichero mutado? ' + (nombrado ? 'sí' : '🔴 NO'));
    const cae = !r.paso && nombrado;
    di('   VEREDICTO: ' + (cae
      ? '✅ CAE — el guard caza la regresión y dice cuál es, sin que nadie tenga que buscarla.'
      : '🔴 NO CAE — el guard no protege lo que dice proteger.'));
    if (!cae) fallos++;
  } finally {
    di('   restaurado byte a byte: ' + (m.restaurar() ? 'sí' : '🔴 NO'));
  }
}

// ═══ ③ EL ENDURECIMIENTO ═════════════════════════════════════════════════════════════════════
//
// Las dos mutaciones de arriba caerían también con el guard flojo, el que no juzgaba `ESCAPA` ni
// `FÁBRICA`. Ésta sólo cae con el endurecido: devuelve `scrum182` a su forma de FÁBRICA, que es
// exactamente la que dejó 6.678 restos y a la que SCRUM-864 no acusaba.
di('');
di('═══ ③ MUTACIÓN AL ÁRBOL · `tests/scrum182` vuelve a ser una FÁBRICA sin dueño ═══');
{
  const m = mutar('tests/scrum182-arbol-movido.test.mjs',
    ["import { temporal } from './_temporal.mjs';", "import os from 'node:os';"],
    ["const tmp = () => temporal('yaqu-182-');", "const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'yaqu-182-'));"]);
  di('   ¿ENTRÓ la mutación? ' + (m.entro ? 'sí (contenido distinto)' : '🔴 NO'));
  try {
    const r = corre('tests/scrum864c-el-temporal-no-vuelve.test.mjs');
    const nombrado = r.salida.includes('tests/scrum182-arbol-movido.test.mjs');
    const porFabrica = r.salida.includes('[FABRICA]');
    di('   ¿el guard se pone ROJO? ' + (r.paso ? '🔴 NO, sigue verde' : 'sí'));
    di('   ¿lo NOMBRA y dice la categoría? ' + (nombrado && porFabrica ? 'sí, como [FABRICA]' : '🔴 NO'));
    const cae = !r.paso && nombrado && porFabrica;
    di('   VEREDICTO: ' + (cae
      ? '✅ CAE — la categoría que SCRUM-864 no juzgaba ya no pasa. Es la parte nueva del guard.'
      : '🔴 NO CAE — el endurecimiento no está haciendo nada.'));
    if (!cae) fallos++;
  } finally {
    di('   restaurado byte a byte: ' + (m.restaurar() ? 'sí' : '🔴 NO'));
  }
}

// ═══ POST-CONDICIÓN ══════════════════════════════════════════════════════════════════════════
di('');
di('═══ POST-CONDICIÓN · el árbol quedó como estaba ═══');
const post = corre('tests/scrum864c-el-temporal-no-vuelve.test.mjs');
di('   el guard vuelve a VERDE: ' + (post.paso ? 'sí ✅' : '🔴 NO — el árbol no se restauró bien'));
if (!post.paso) fallos++;
process.exit(fallos ? 1 : 0);
