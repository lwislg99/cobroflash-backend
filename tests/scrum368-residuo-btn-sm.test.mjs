// tests/scrum368-residuo-btn-sm.test.mjs — SCRUM-368 · TRINQUETE del botón primario pequeño.
//
// NINGÚN `btn-primary btn-sm` USA EL VERDE DE MARCA DE FONDO.
//
// ── DE QUÉ ERA ESTE TEST Y EN QUÉ SE HA CONVERTIDO ───────────────────────────
// Nació contando un residuo aceptado: los `btn-primary btn-sm` daban 3,30:1 (blanco sobre
// --brand, umbral 4,5) y se iban a aceptar por escrito, así que al menos había que contarlos —un
// residuo aceptado sin contador se convierte en un residuo creciente.
//
// Ya no hay residuo. La variante pequeña usa `--brand-tint-ink` de fondo: **5,48:1**, que cumple
// AA por la vía NORMAL, sin excepción de tipografía. Así que el test deja de contar y pasa a ser
// un TRINQUETE: afirma la propiedad, no el número.
//
// ── Y NO ES SOLO CONTRASTE ───────────────────────────────────────────────────
// Con el pequeño y el grande en el mismo verde y el mismo peso, competían: la tarjeta tenía dos
// voces y ninguna mandaba. DESIGN.md ya lo prohibía por escrito —«una pantalla = un botón verde
// primario», la Regla de Una Sola Voz— y se incumplía en 35 sitios. El defecto de contraste y el
// de jerarquía eran EL MISMO defecto y se arreglan con el mismo cambio.
//
// Por eso el trinquete vigila el FONDO y no el ratio: si alguien devuelve un primario pequeño al
// verde de marca, rompe las dos cosas a la vez.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fuentesDeFront, censarUsosDeBoton } from './_censo-clases-de-boton.mjs';
import { parsearReglas, censarClasesDeBoton, compuestos, analizarCompuesto } from './_censo-anillo-foco.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');
const RUTA_CSS = path.join(RAIZ, 'public/dashboard/css/styles.css');
const HOJA = fs.readFileSync(RUTA_CSS, 'utf8');

const REGLAS = parsearReglas(HOJA);
const CLASES = censarClasesDeBoton(REGLAS);
const FUENTES = fuentesDeFront(fs, path, RAIZ);
const CENSO = censarUsosDeBoton(FUENTES, CLASES);

/** Sitios del front que escriben la combinación primario + pequeño. */
const PRIMARIOS_PEQUEÑOS = CENSO.conjuntos.filter(
  (c) => c.clases.includes('btn-primary') && c.clases.includes('btn-sm'),
);

/**
 * Simula la cascada de `background` para `<button class="btn btn-primary btn-sm">`.
 * Devuelve el valor ganador — la misma pregunta que resuelve el navegador.
 */
function fondoDelPrimarioPequeño() {
  const tiene = ['btn', 'btn-primary', 'btn-sm'];
  let ganador = null;
  for (const r of REGLAS) {
    const bg = r.decls.get('background') ?? r.decls.get('background-color');
    if (bg === undefined) continue;
    for (const sel of r.selectores) {
      const partes = compuestos(sel);
      if (partes.length !== 1) continue;
      const x = analizarCompuesto(partes[0].replace(/:not\([^)]*\)/g, ''));
      if (x.pseudos.length || x.ids.length || x.pseudoElems.length) continue;   // estado, no reposo
      if (!x.clases.length || !x.clases.every((c) => tiene.includes(c))) continue;
      const negadas = [...partes[0].matchAll(/:not\(([^)]*)\)/g)]
        .flatMap((m) => [...m[1].matchAll(/\.([-\w]+)/g)].map((y) => y[1]));
      if (negadas.some((c) => tiene.includes(c))) continue;
      const esp = x.clases.length;
      if (!ganador || esp > ganador.esp || (esp === ganador.esp && r.orden >= ganador.orden)) {
        ganador = { esp, orden: r.orden, valor: bg, selector: sel };
      }
    }
  }
  return ganador;
}

// ── SUELOS ──────────────────────────────────────────────────────────────────

test('SUELO: el censo del front sigue viendo botones', () => {
  assert.ok(CENSO.conjuntos.length > 50,
    `el censo vio ${CENSO.conjuntos.length} conjuntos: está ciego y cualquier cero no significaría nada`);
  assert.ok(CLASES.includes('btn-primary') && CLASES.includes('btn-sm'),
    `faltan clases derivadas del CSS: ${CLASES.join(', ')}`);
  assert.ok(PRIMARIOS_PEQUEÑOS.length > 0,
    'no hay ni un `btn-primary btn-sm` en el front: el trinquete no estaría vigilando nada');
});

// ── EL TRINQUETE ────────────────────────────────────────────────────────────

test('TRINQUETE: el fondo del btn-primary pequeño NO es el verde de marca', () => {
  const g = fondoDelPrimarioPequeño();
  assert.ok(g, 'ninguna regla da `background` a `btn btn-primary btn-sm`: el simulador está ciego');
  assert.match(
    g.valor, /var\(--brand-tint-ink/,
    `el fondo de \`btn-primary btn-sm\` lo gana \`${g.selector}\` con \`${g.valor}\`.\n\n` +
    '  Debe ser `var(--brand-tint-ink)`. Con `--brand` pasan DOS cosas a la vez:\n' +
    '   · blanco sobre --brand da 3,30:1 y el umbral del texto pequeño es 4,5 → NO cumple AA;\n' +
    '   · y el pequeño vuelve a competir con el primario grande, que es justo lo que la Regla\n' +
    '     de Una Sola Voz de DESIGN.md prohíbe («una pantalla = un botón verde primario»).\n\n' +
    `  ${PRIMARIOS_PEQUEÑOS.length} sitios del front dependen de esta regla:\n    ` +
    [...new Set(PRIMARIOS_PEQUEÑOS.map((c) => `${c.fichero}:${c.linea}`))].sort().join('\n    '),
  );
  assert.ok(!/var\(--brand\)/.test(g.valor), `el ganador usa --brand: ${g.valor}`);
});

test('el primario NORMAL y el grande siguen con el verde de marca', () => {
  // La otra cara: la enmienda es SOLO para la variante pequeña. Si alguien la extendiera al
  // primario normal, estaría cambiando la identidad del producto sin decirlo.
  const base = REGLAS.find((r) => r.selectores.includes('.btn-primary') && r.decls.has('background'));
  assert.ok(base, 'no está la regla base de .btn-primary');
  assert.match(base.decls.get('background'), /var\(--brand\)/,
    `.btn-primary debe seguir con el verde de marca; vale: ${base.decls.get('background')}`);
});

test('CONTROL NEGATIVO: las otras variantes pequeñas NO cambian de color', () => {
  // Hoy `btn-sm` es puramente dimensional para secondary/ghost/danger: cambia tamaño y padding,
  // nunca color. La enmienda hace del primario la única excepción, y eso está declarado en
  // DESIGN.md. Si alguien se la aplicara a otra variante, ya no sería una excepción declarada.
  for (const v of ['btn-secondary', 'btn-ghost', 'btn-danger']) {
    const conSm = REGLAS.filter((r) => r.selectores.some(
      (s) => s.includes(v) && s.includes('btn-sm') && (r.decls.has('background') || r.decls.has('background-color')),
    ));
    assert.deepEqual(conSm.map((r) => r.selectores.join(',')), [],
      `${v} pequeño ha recibido un fondo propio: \`btn-sm\` debe seguir siendo dimensional salvo ` +
      'en el primario, que es la única excepción y está escrita en DESIGN.md.');
  }
});

// ── LA OTRA CARA, que sigue valiendo aunque cambie su motivo ────────────────

test('el cambio no toca lo que ve un desconocido', () => {
  // Cuando esto contaba un residuo, este test era la razón por la que se podía aceptar.
  // Ahora afirma otra cosa: que la enmienda se queda detrás del login y no altera el aspecto
  // de la cara pública del producto.
  const publicos = PRIMARIOS_PEQUEÑOS.filter((c) => !c.fichero.includes('public/dashboard/'));
  assert.deepEqual(
    publicos.map((c) => `${c.fichero}:${c.linea}`), [],
    'un botón primario pequeño ha aparecido FUERA del dashboard, o sea en superficie pública. ' +
    'La enmienda se aplicó sabiendo que ninguno lo estaba: con éste, el cambio pasa a verse ' +
    'también en el landing y eso es otra decisión.',
  );
});

test('DESIGN.md declara la variante pequeña, y por token', () => {
  // El hex escrito a mano en la especificación es una segunda fuente de verdad esperando a
  // derivar — es justo lo que obligó a enmendar el documento en este ticket.
  const design = fs.readFileSync(path.join(RAIZ, 'DESIGN.md'), 'utf8');
  assert.match(design, /button-primary-sm:/,
    'DESIGN.md no declara el componente `button-primary-sm`: el CSS iría por delante del sistema.');
  assert.match(design, /\{colors\.brand-tint-ink\}/,
    'el fondo de la variante pequeña debe escribirse por TOKEN, no con el hex a mano.');
});
