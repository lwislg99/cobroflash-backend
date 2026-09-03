// tests/scrum694-los-guards-migrados.test.mjs — SCRUM-694
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LOS NUEVE GUARDS MIGRADOS SIGUEN VIVOS — y el censo de los que aún filtran a mano
//
// Migrar un guard a `soloCodigo()` tiene un riesgo que no se ve: cambiar un filtro malo por un
// **guard MUERTO**. Si al migrar uno deja de saltar nunca, la tanda sale más verde que antes y
// nadie se entera. Por eso lo primero que se fija aquí no es que el filtro funcione —de eso
// responden `scrum693` y `scrum696`— sino que **cada guard conserva la prohibición que le da
// sentido**, y que esa prohibición sigue siendo VISIBLE a través del filtro.
//
// ── EL CASO QUE MOTIVA LA MIGRACIÓN, EN LAS DOS DIRECCIONES ──────────────────────────────
//
//   · una cadena DENTRO de un comentario: el filtro por líneas la conservaba y el guard saltaba
//     por su propia documentación (lo que pasó en SCRUM-693 al documentar un rótulo retirado);
//   · 🔴 un `//` dentro de un LITERAL: el `.replace(/\s*\/\/.*$/,'')` cortaba ahí y se comía el
//     código de después. Ese trozo dejaba de vigilarse y el guard DABA VERDE. «No hay defecto» y
//     «no supe mirar» son el mismo número con significados opuestos.
//
// Aquí se comprueban los dos con la aguja REAL de cada guard, no con una cadena inventada.
//
// ── 🔴 EL CENSO DEL ÁRBOL DICE QUE ESTO NO SE ACABA CON NUEVE ────────────────────────────
//
// El censo de entrada de este ticket hablaba de trece candidatos. Medido sobre el árbol el
// 2-sep-2026, los guards que se fabrican su propio filtro de comentarios son **56**: de ellos
// **27 cortan en cualquier `//`** —la forma que se come código real, no sólo las líneas que
// empiezan por comentario— y **31 hacen el `replace` por cadena vacía**, así que además ENCOGEN
// el texto y descolocan los `slice(indexOf(…))` de quien los use.
//
// Los nueve de este ticket son los que venían censados. El resto se REPORTA, no se migra aquí
// (regla 9). El tope de abajo es un trinquete: mientras se decide qué hacer con ellos, no pueden
// crecer.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { soloCodigo } from './_solo-codigo.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Los NUEVE migrados y LA AGUJA de cada uno: el texto que su prohibición busca en el código.
 *
 * No es documentación. Es lo que hace falta para poder preguntar «¿este guard sigue pudiendo ver
 * lo que vigila?». Si alguien vacía un guard, su aguja desaparece de su fuente y salta el censo.
 */
const MIGRADOS = [
  ['scrum324-aviso-simplificado-ui', 'no puedes deducir el IVA'],
  ['scrum324-cadena-hasta-el-libro', 'no puedes deducir el IVA'],
  ['scrum519-un-solo-criterio-de-cobro', 'bizumPhone'],
  ['scrum574-mismo-cliente-tras-migracion', '.includes'],
  ['scrum574-switch-forma-juridica', 'contact_?kind'],
  ['scrum577-nombre-para-documento', 'nombreParaDocumento('],
  ['scrum593b-superficie-texto-del-documento', 'innerHTML'],
  ['scrum625-formato-importe-pdf', 'toFixed'],
  ['scrum636-sitio-unico-dinero', 'minimumFractionDigits'],
];

/** EL FILTRO VIEJO, el que se retira: corta en el primer `//` sin mirar dónde está. */
const filtroViejo = (fuente) => fuente.split(/\r?\n/)
  .filter((l) => !l.trimStart().startsWith('//'))
  .map((l) => l.replace(/\s*\/\/.*$/, ''))
  .join('\n');

const leerGuard = (g) => fs.readFileSync(path.join(RAIZ, 'tests', g + '.test.mjs'), 'utf8');

/** Un fuente donde la aguja va DETRÁS de una URL en un literal, y en la misma línea. */
const conUrlDelante = (aguja) => "const DOC = 'https://yaqu.app/ayuda'; const X = '" + aguja + "';";

// ═════════════════════════════════════════════════════════════════════════════════════════
// SUELO · un censo que no encuentra nada da el mismo cero que uno que no mira
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-694 · SUELO: los NUEVE guards existen y USAN el mecanismo', () => {
  assert.equal(MIGRADOS.length, 9, '🔴 la lista de migrados ha cambiado de tamaño sin decirlo');
  const sinMecanismo = MIGRADOS
    .map(([g]) => g)
    .filter((g) => !soloCodigo(leerGuard(g), g + '.mjs').includes('_solo-codigo.mjs'));
  assert.deepEqual(sinMecanismo, [],
    '🔴 ' + sinMecanismo.length + ' guard(s) han vuelto a filtrar comentarios por su cuenta: '
    + sinMecanismo.join(', ') + '. Y se mira sobre el CÓDIGO: nombrar el mecanismo en un '
    + 'comentario no es importarlo.');
});

test('SCRUM-694 · 🔴 ningún guard se ha quedado VACÍO: cada uno conserva su aguja', () => {
  // El riesgo real de una migración: dejar el guard corriendo pero sin nada que buscar. Un guard
  // que ya no nombra lo que prohíbe no falla nunca, y su verde no significa nada.
  const vacios = MIGRADOS.filter(([g, aguja]) => !leerGuard(g).includes(aguja)).map(([g]) => g);
  assert.deepEqual(vacios, [],
    '🔴 ' + vacios.length + ' guard(s) ya no nombran lo que prohíben: ' + vacios.join(', ')
    + '. Se habría cambiado un filtro malo por un guard MUERTO, que es peor: da verde siempre.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL INVARIANTE, CON LA AGUJA REAL DE CADA GUARD Y EN LAS DOS DIRECCIONES
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-694 · 🔴 la aguja de cada guard SOBREVIVE al filtro cuando está en CÓDIGO', () => {
  // Y no en cualquier sitio: DETRÁS de un literal con `//` y en la misma línea, que es justo
  // donde el filtro viejo se la comía. Ésta es la dirección cara, la que produce verdes.
  for (const [guard, aguja] of MIGRADOS) {
    assert.ok(soloCodigo(conUrlDelante(aguja)).includes(aguja),
      '🔴 ' + guard + ': su aguja «' + aguja + '» desaparece cuando va detrás de una URL en un '
      + 'literal. El guard dejaría de vigilar ese trozo, y lo haría EN VERDE.');
  }
});

test('SCRUM-694 · 🔴 y DESAPARECE cuando está en un comentario — los tres formatos', () => {
  // La otra dirección: documentar la prohibición no puede hacer saltar el guard. Es el impuesto
  // sobre la claridad que motivó SCRUM-693 — obliga a escribir comentarios vagos justo donde
  // hace falta precisión.
  for (const [guard, aguja] of MIGRADOS) {
    for (const forma of ['// ' + aguja, '/* ' + aguja + ' */', '/** ' + aguja + ' */']) {
      const codigo = forma + '\nconst b = 2;';
      assert.equal(soloCodigo(codigo).includes(aguja), false,
        '🔴 ' + guard + ': su aguja «' + aguja + '» sobrevive dentro de '
        + forma.slice(0, 3).trim() + '. El guard saltaría por su propia documentación.');
    }
  }
});

test('SCRUM-694 · 🔴 CONTROL: el filtro VIEJO sí cegaba — la migración no es cosmética', () => {
  // Sin esto, todo lo de arriba podría pasar igual con el filtro viejo puesto, y la migración no
  // habría arreglado nada. Se comprueba que el filtro que se retira FALLA en el mismo caso.
  const cegadas = MIGRADOS.filter(([, aguja]) => !filtroViejo(conUrlDelante(aguja)).includes(aguja));
  assert.equal(cegadas.length, MIGRADOS.length,
    '🔴 el filtro viejo sólo cegaba ' + cegadas.length + ' de ' + MIGRADOS.length + ' agujas. Si '
    + 'no las cegaba, esta migración no arreglaba nada y el control de arriba no demuestra nada.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL TRINQUETE DEL HALLAZGO: los que aún filtran a mano NO PUEDEN CRECER
// ═════════════════════════════════════════════════════════════════════════════════════════

/** Medido el 2-sep-2026 sobre el árbol. Este número BAJA con motivo; si sube, salta. */
const TOPE_FILTRAN_A_MANO = 56;

/** El corte que define la familia: un `replace` que trocea en `//` hasta el fin de línea. */
const EL_CORTE = String.fromCharCode(92) + '/' + String.fromCharCode(92) + '/.*$';

function censoDeFiltrosAMano() {
  const salida = [];
  for (const dir of ['tests', 'scripts']) {
    for (const nombre of fs.readdirSync(path.join(RAIZ, dir))) {
      if (!nombre.endsWith('.mjs')) continue;
      const rel = dir + '/' + nombre;
      const codigo = soloCodigo(fs.readFileSync(path.join(RAIZ, rel), 'utf8'), nombre);
      if (codigo.includes('_solo-codigo.mjs')) continue;
      if (codigo.includes(EL_CORTE)) salida.push(rel);
    }
  }
  return salida;
}

test('SCRUM-694 · 🔴 SUELO: el censo de filtros a mano VE los que hay', () => {
  // Si devolviera cero, el tope de abajo pasaría siempre sin medir nada. Y aquí un cero sería
  // sospechoso, no una buena noticia: quedan 56 sin migrar y eso se sabe.
  const censo = censoDeFiltrosAMano();
  assert.ok(censo.length > 0,
    '🔴 el censo no encuentra NI UN filtro a mano. O se han migrado los 56 de golpe —y entonces '
    + 'hay que bajar el tope con su motivo— o el detector ha dejado de ver: son el mismo cero '
    + 'con significados opuestos.');
});

test('SCRUM-694 · 🔴 no entra NINGÚN filtro de comentarios nuevo', () => {
  const censo = censoDeFiltrosAMano();
  assert.ok(censo.length <= TOPE_FILTRAN_A_MANO,
    '🔴 hay ' + censo.length + ' guards fabricándose su filtro de comentarios, y el tope es '
    + TOPE_FILTRAN_A_MANO + '. Un filtro por regex falla en los DOS sentidos: deja pasar una '
    + 'cadena escrita dentro de un comentario, y se come código real en cuanto un literal lleva '
    + 'dos barras. Existe tests/_solo-codigo.mjs, y es lo que hay que usar.\n  '
    + censo.slice(0, 8).join('\n  '));
});
