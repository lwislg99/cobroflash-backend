// tests/scrum850-la-poblacion-del-instrumento.test.mjs — SCRUM-850
//
// ════════════════════════════════════════════════════════════════════════════════════════════
// NINGUNA INVOCACIÓN DE LA TANDA PUEDE COMERSE SU CÓDIGO DE SALIDA
//
// El 15-sep-2026 tres sesiones distintas se encontraron el mismo modo de fallo sin buscarlo, y
// DOS estuvieron a punto de entregar un rojo como verde. En una tubería el código de salida es el
// del ÚLTIMO tramo: `npm test | tail` devuelve el de `tail`, que es 0 pase lo que pase.
//
//     EXIT=1               <- el de npm test
//     [exited with code 0] <- el del envoltorio
//
// Un `exit 1` se ve. Un `exit 0` que debería ser `1` no se ve nunca. Es el defecto 3 de la casa
// —el instrumento no mide lo que dice medir— aplicado al instrumento que valida a los demás.
//
// ── 🔒 LA REGLA QUE ESTO SUJETA, Y ES LA ENTREGA PRINCIPAL DEL TICKET ────────────────────────
//
//     UN INSTRUMENTO DECLARA SU POBLACIÓN, NO SÓLO SU RESULTADO.
//     «0 fail» sin «sobre cuántos» no es un verde: es una frase.
//
// Y este fichero se la aplica a sí mismo: no basta con que el censo diga «0 que se coman el
// código», tiene que decir ADEMÁS sobre cuántas invocaciones y de cuántas superficies. Cero
// invocaciones no es «está limpio», es «no he mirado» — y aquí sale CIEGO.
//
// La regla vale la pena porque ya se cobró una pieza: la primera versión del censo dijo
// `scripts: 0`, y era falso. La casa no lanza la tanda por cadena de shell sino por ARGUMENTOS
// (`spawnSync(process.execPath, ['--test', …])`), que el detector no miraba. Lo destapó exigirle
// la población, no leer el resultado — que era perfectamente creíble.
//
// ── ⛔ ESTO NO ES LA REGLA 41 ────────────────────────────────────────────────────────────────
// No se toca ningún guard ni se relaja lo que ningún test exige. Se mira cómo se INVOCA la tanda.
// Un `| grep` se quita del comando, nunca del guard que lo denuncia.
// ════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  censar, veredictoDeLinea, segmentar, sinComentario, deUnFicheroJs, VEREDICTOS,
} from '../scripts/_invocaciones-de-la-tanda.mjs';

const RAIZ = path.join(import.meta.dirname, '..');
const CENSO = censar(RAIZ);

/** El arnés de SCRUM-745: estas mutaciones tienen que TUMBAR este fichero. */
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'scripts/_invocaciones-de-la-tanda.mjs',
    de: "    if (sep === '|') v = VEREDICTOS.TUBERIA;",
    a: '    if (false) v = VEREDICTOS.TUBERIA;',
    cae: 'el detector ve cada forma que se come el código',
  },
  {
    fichero: 'scripts/_invocaciones-de-la-tanda.mjs',
    de: "    if (k.startsWith('//')) continue;",
    a: '    if (false) continue;',
    cae: 'ninguna invocación de la tanda descarta su código de salida',
  },
  {
    fichero: 'scripts/_invocaciones-de-la-tanda.mjs',
    de: "    if (c === '#' && (i === 0 || /\\s/.test(linea[i - 1]))) return linea.slice(0, i);",
    a: '    if (false) return linea.slice(0, i);',
    cae: 'el último tramo y los comentarios NO se marcan',
  },
];

// ── ✅ CONTROL POSITIVO DEL DETECTOR: las formas que TIENE que ver ───────────────────────────
test('SCRUM-850 · ✅ CONTROL POSITIVO: el detector ve cada forma que se come el código', () => {
  const casos = [
    ['npm test | tail', VEREDICTOS.TUBERIA],
    ['npm test | tail -20', VEREDICTOS.TUBERIA],
    ['npm run test:staging:gated | head -5', VEREDICTOS.TUBERIA],
    ['node --test --test-force-exit tests/*.test.mjs | grep "# SKIP"', VEREDICTOS.TUBERIA],
    ['npm test; echo listo', VEREDICTOS.SECUENCIA],
    ['npm test ; ls', VEREDICTOS.SECUENCIA],
  ];
  for (const [linea, esperado] of casos) {
    const h = veredictoDeLinea(linea);
    assert.equal(h.length, 1, `no vio la invocación en: ${linea}`);
    assert.equal(h[0].veredicto, esperado, `veredicto equivocado en: ${linea}`);
  }
});

// ── 🔴 CONTROL NEGATIVO: lo que NO puede marcar, o el censo se llena de ruido ────────────────
test('SCRUM-850 · 🔴 CONTROL NEGATIVO: `&&`, el último tramo y los comentarios NO se marcan', () => {
  const sanas = [
    'npm test',
    'npm run build && npm test',
    'npm test && echo listo',
    'npm ci && npm run build && node --test tests/*.test.mjs',
    'cat fichero | npm test',            // la tanda ES el último tramo: su código es el que sale
  ];
  for (const l of sanas) {
    const h = veredictoDeLinea(l);
    assert.ok(h.length > 0, `debería VER la invocación en: ${l}`);
    assert.equal(h[0].veredicto, VEREDICTOS.SANO, `marcada de más: ${l}`);
  }
  // un comentario no es una invocación
  assert.equal(veredictoDeLinea(sinComentario('# npm test | tail')).length, 0);
  assert.equal(veredictoDeLinea(sinComentario('  # ojo: npm test | grep x')).length, 0);
  // una tubería DENTRO de comillas no es una tubería
  assert.equal(segmentar(`echo "a | b"`).length, 1);
  // y por AST: un //comentario de un .mjs tampoco
  assert.equal(deUnFicheroJs('// execSync("npm test | tail")\nconst x = 1;', 'x.mjs').length, 0);
  assert.equal(deUnFicheroJs('execSync("npm test | tail");', 'x.mjs')[0].veredicto, VEREDICTOS.TUBERIA);
});

// ── 🔴 EL SUELO: cero no es «limpio», es «no he mirado» ──────────────────────────────────────
test('SCRUM-850 · 🔴 SUELO: el censo DECLARA su población, y una población vacía es CIEGO', () => {
  assert.ok(CENSO.poblacion > 0,
    'CIEGO: el censo no ha encontrado NI UNA invocación de la tanda en todo el árbol. '
    + 'Vacío y no-medido se leen igual y significan lo contrario.');

  // Control positivo ENUMERADO: estas superficies tienen invocaciones conocidas HOY. Si alguna
  // se queda en cero, el detector ha dejado de ver una familia entera — que es justo lo que pasó
  // con `scripts` antes de mirar los arrays de argumentos.
  for (const s of ['package.json', 'workflows', 'scripts', 'instrucciones']) {
    assert.ok(CENSO.superficies[s] > 0,
      `CIEGO en la superficie «${s}»: 0 invocaciones. Población por superficie: `
      + JSON.stringify(CENSO.superficies));
  }
});

// ── 🔴 EL QUE DECIDE ─────────────────────────────────────────────────────────────────────────
test('SCRUM-850 · 🔴 ninguna invocación de la tanda descarta su código de salida', () => {
  const malas = CENSO.comeElCodigo;
  const detalle = malas.map((h) => `\n    ${h.veredicto}  ${h.fichero}:${h.donde}\n      ${h.comando}`).join('');
  assert.equal(malas.length, 0,
    `${malas.length} invocación(es) de la tanda se comen su código de salida, sobre una población `
    + `de ${CENSO.poblacion} en ${Object.keys(CENSO.superficies).length} superficies `
    + `(${JSON.stringify(CENSO.superficies)}):${detalle}\n`
    + '  Una tubería devuelve el código del ÚLTIMO tramo: la tanda puede estar en ROJO y salir 0.\n'
    + '  Se arregla el COMANDO (TAP a fichero y leerlo en un segundo comando), nunca este guard.');
});

// ── 🔴 EL CONTROL QUE DE VERDAD PRUEBA: cada FORMA, con una tanda que falla de verdad ────────
//
// «Que el detector las clasifique» no es prueba de nada: hay que ver que una tanda EN ROJO sale
// en rojo por cada camino de invocación que existe, uno por uno y no «en general».
//
// Se prueba la FORMA, no el comando entero: la invocación se sustituye por un proceso que sale
// con 1, y los tramos de detrás por algo inofensivo. Así no se ejecuta ninguna tanda de verdad y
// no hay que esquivar las interpolaciones `${{ }}` de los workflows.
test('SCRUM-850 · 🔴 CONTROL POR CAMINO: una tanda EN ROJO sale en rojo por CADA forma que existe', () => {
  const FALLA = `"${process.execPath}" -e "process.exit(1)"`;
  const salida = (cmd) => {
    try { execFileSync(process.env.SHELL || 'bash', ['-c', cmd], { stdio: 'pipe' }); return 0; }
    catch (e) { return e.status ?? -1; }
  };

  // El suelo del propio control: el sustituto tiene que fallar, o todo lo de abajo es tautología.
  assert.notEqual(salida(FALLA), 0, 'el sustituto no falla: este control no probaría nada');
  assert.equal(salida(`"${process.execPath}" -e "process.exit(0)"`), 0, 'el shell no propaga el 0');

  const deShell = CENSO.invocaciones.filter((h) => !h.sinShell);
  assert.ok(deShell.length > 0, 'CIEGO: ninguna forma de shell que probar');

  const rojos = [];
  for (const h of deShell) {
    // reconstruir la FORMA: la invocación cae, y detrás va lo que hubiera
    const segs = segmentar(h.linea);
    const i = segs.findIndex((s) => s.texto.includes(h.comando.slice(0, 20)));
    const trozos = segs.map((s, k) => {
      const relleno = s.sep === '|' || (k > 0 && segs[k - 1].sep === '|') ? 'cat > /dev/null' : 'true';
      return { texto: k === i ? FALLA : relleno, sep: s.sep };
    });
    const forma = trozos.map((s, k) => s.texto + (s.sep ? ` ${s.sep} ` : '')).join('').trim();
    const code = salida(forma);
    if (code === 0) rojos.push(`${h.fichero}:${h.donde} → «${forma}» salió 0 con la tanda en rojo`);
  }
  assert.deepEqual(rojos, [],
    `Hay caminos de invocación por los que una tanda EN ROJO sale VERDE:\n  ${rojos.join('\n  ')}`);
});

// ── La superficie que el censo NO puede ver, dicha en vez de callada ─────────────────────────
test('SCRUM-850 · las invocaciones por ARGUMENTOS se cuentan y se declaran sin shell', () => {
  const sinShell = CENSO.invocaciones.filter((h) => h.sinShell);
  assert.ok(sinShell.length > 0,
    'CIEGO: la casa lanza la tanda por `spawnSync(node, [\'--test\', …])` y el censo no ve ninguna');
  for (const h of sinShell) {
    assert.equal(h.veredicto, VEREDICTOS.SANO,
      'una invocación sin shell no puede estar en una tubería: si sale otra cosa, el censo miente');
  }
});
