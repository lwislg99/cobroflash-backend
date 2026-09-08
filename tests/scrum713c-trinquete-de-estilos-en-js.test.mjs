// tests/scrum713c-trinquete-de-estilos-en-js.test.mjs — SCRUM-713c
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA REGLA 4 DICE «NI UN ESTILO EN LÍNEA», Y `style.cssText` CUENTA.
//
// Escribirlo en el HTML o escribirlo desde JavaScript acaba siendo **el mismo atributo en el mismo
// nodo**: la regla no distingue por dónde entra. Y por esa puerta lateral entraron cientos.
//
// ── POR QUÉ ES UN TRINQUETE DE CUENTA Y NO UNA LIMPIEZA ─────────────────────────────────────
// Son cientos, repartidos por casi todo el panel — el número exacto lo DERIVA este mismo guard
// (`TECHO`, abajo, con su fecha y su sha), y por eso no se repite aquí: una cifra escrita en un
// comentario deja de ser cierta el día que alguien limpia uno, y entonces el comentario miente
// mientras el guard acierta. Es lo que caza SCRUM-737, y me cazó a mí escribiendo esta línea.
//
// Un guard que los prohibiera nacería con todas ellas como excepción —o sea, congelándolas para
// siempre— o bloquearía todo el trabajo del dashboard.
// Y una limpieza de todos ellos —repartidos por decenas de ficheros— es un conflicto garantizado
// contra las sesiones que están tocando esos mismos ficheros ahora mismo.
//
// Un trinquete de CUENTA no permite ninguna nueva y no bloquea a nadie: baja cuando alguien limpia
// —y entonces hay que apretar el número, que es lo que impide que la holgura se acumule— y sube
// sólo si alguien añade uno, y entonces cae nombrando fichero y línea.
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔒 LO QUE ESTE GUARD **NO** CUBRE — dicho aquí y REPETIDO EN SU ROJO
//
// Un guard que promete más de lo que hace es peor que uno que promete poco: quien lo lea dejará de
// mirar donde el guard no llega.
//
//   · NO mira `el.style.setProperty(...)` ni `el.style.width = ...` — sólo `cssText`. Son otra
//     forma de lo mismo y no están vigiladas aquí.
//   · NO mira los atributos `style=` escritos a mano en HTML estático. Eso es otro eje y ya tiene
//     quien lo mire.
//   · NO mira fuera de `public/dashboard/`. La landing, los correos y los PDF no entran.
//   · NO dice nada sobre si el estilo es correcto: cuenta, no juzga.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { soloCodigo } from './_solo-codigo.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(RAIZ, 'public', 'dashboard', 'js');

/** Lo que este guard vigila, en una constante para que SALGA EN EL ROJO y no sólo aquí arriba. */
const COBERTURA = [
  'SÍ cubre  · `X.style.cssText = …` en public/dashboard/js/**.js',
  'NO cubre  · `style.setProperty(…)` ni `style.width = …` (otra forma de lo mismo, sin vigilar)',
  'NO cubre  · atributos `style=` en HTML estático (otro eje, ya vigilado aparte)',
  'NO cubre  · nada fuera de public/dashboard/ (landing, correos, PDF)',
].join('\n    ');

/**
 * Cuenta `cssText` **sobre el código**, no sobre el fichero.
 *
 * 🔴 Sin esto el guard se caza a sí mismo: los comentarios que explican la prohibición contienen
 * la palabra prohibida, y un `grep` a pelo los cuenta. Ya pasó al medir esto la primera vez — la
 * cuenta subió de 19 a 20 al añadir el comentario que decía por qué había 19.
 */
export function contarEnFuente(fuente) {
  return (soloCodigo(fuente).match(/\.style\.cssText\s*=/g) || []).length;
}

/** Todos los ficheros del panel, con su cuenta y las líneas donde está. */
function censo() {
  const filas = [];
  for (const f of fs.readdirSync(DIR).filter((n) => n.endsWith('.js')).sort()) {
    const fuente = fs.readFileSync(path.join(DIR, f), 'utf8');
    const n = contarEnFuente(fuente);
    if (!n) continue;
    // Las líneas, para que el rojo diga DÓNDE y no sólo cuántos.
    const lineas = [];
    soloCodigo(fuente).split('\n').forEach((l, i) => {
      if (/\.style\.cssText\s*=/.test(l)) lineas.push(i + 1);
    });
    filas.push({ fichero: f, n, lineas });
  }
  return filas;
}

// ── EL NÚMERO. Medido el 8-sep-2026 sobre `origin/main` = 0e8c589a, con ESTE mismo contador ──
//
// Baja siempre que alguien limpie: entonces se aprieta AQUÍ, y el guard lo exige. No se pone un
// número «con holgura» a propósito — la holgura es sitio para que vuelva a subir sin que caiga.
const TECHO = 351;

test('SCRUM-713c · SUELO: el contador VE lo que tiene que ver, y NO se caza a sí mismo', () => {
  // 🔴 El suelo que no caduca: se prueba contra cadenas fabricadas aquí, así que sigue probando
  // algo el día que el árbol esté limpio. Un suelo que depende de que el defecto exista deja de
  // probar nada justo cuando se arregla — y entonces el guard se vuelve decorativo sin ponerse rojo.
  assert.equal(contarEnFuente('el.style.cssText = "a:b";'), 1,
    '🔴 el contador NO ve un `style.cssText` escrito delante de sus narices. Entonces «no hay '
    + 'ninguno» significa «no sé mirar», y el número de abajo es un verde vacío.');
  assert.equal(contarEnFuente('// aquí iba un el.style.cssText = "a:b";'), 0,
    '🔴 el contador cuenta COMENTARIOS. Se cazaría a sí mismo y a los párrafos que explican la '
    + 'prohibición: la trampa de auto-referencia de SCRUM-203, que en esta casa ya mordió cuatro '
    + 'veces. Ya pasó midiendo ESTO: la cuenta subió de 19 a 20 al escribir el comentario que '
    + 'explicaba por qué había 19.');
  assert.ok(censo().length >= 10,
    '🔴 CIEGO: el censo encuentra menos de diez ficheros con estilos en JS, y están repartidos por '
    + 'decenas. El barrido no está leyendo el panel — y entonces el techo de abajo no mide nada.');
});

test('SCRUM-713c · 🔴 EL TRINQUETE: los estilos escritos desde JS no SUBEN', () => {
  const filas = censo();
  const total = filas.reduce((a, f) => a + f.n, 0);

  if (total > TECHO) {
    // El rojo nombra fichero Y línea: un guard que sólo da un número obliga a buscar a mano.
    const detalle = filas.map((f) => `${f.fichero}: ${f.n}  (líneas ${f.lineas.join(', ')})`).join('\n     ');
    assert.fail(
      `🔴 HAN SUBIDO LOS ESTILOS EN LÍNEA ESCRITOS DESDE JS: ${total} y el techo es ${TECHO}.\n\n`
      + '  La regla 4 dice «ni un estilo en línea», y `style.cssText` cuenta: escribirlo desde\n'
      + '  JavaScript acaba siendo el mismo atributo en el mismo nodo.\n\n'
      + '  Lo que hay que hacer NO es subir este número: es sacar ese estilo a `styles.css` con su\n'
      + '  clase. Si de verdad no se puede, dilo aquí con su motivo y quién lo retira.\n\n'
      + `  QUÉ VIGILA ESTE GUARD:\n    ${COBERTURA}\n\n`
      + `  El censo completo:\n     ${detalle}`,
    );
  }

  assert.ok(total <= TECHO);
  assert.equal(total, TECHO,
    `🔴 HAN BAJADO (enhorabuena): ${total} frente al techo ${TECHO}. Aprieta el número aquí — un\n`
    + '  techo por encima de la realidad es holgura para que vuelva a subir sin que esto caiga, y\n'
    + '  entonces el trinquete deja de serlo.');
});

test('SCRUM-713c · 🔴 el guard DECLARA lo que no cubre, y lo dice en su rojo', () => {
  // Que la cobertura viva en una constante no basta: tiene que llegar al mensaje. Si alguien la
  // saca del rojo, quien lea el fallo volverá a creer que esto cubre todos los estilos en línea.
  for (const trozo of ['setProperty', 'HTML estático', 'public/dashboard/']) {
    assert.ok(COBERTURA.includes(trozo),
      `🔴 la declaración de cobertura ya no menciona «${trozo}». Un guard que promete más de lo que `
      + 'hace es peor que uno que promete poco: quien lo lea dejará de mirar donde no llega.');
  }
});
