// SCRUM-162 — «tus conceptos más usados» solo se enseñan cuando son verdad.
//
// Lo que este test protege no es una función: es una PROMESA al usuario. SCRUM-139 F6 se negó
// a construir esto porque, sin señal real, «los más usados» habría sido una lista arbitraria
// disfrazada de historial del pro. La señal existe (`Quote.lines`) pero solo para algunos
// merchants — medido en producción el 27-jul-2026: tres la superan, cinco no. El umbral es lo
// que impide que a esos cinco se les enseñe algo inventado, así que es lo primero que se prueba.
//
// Sin gate y sin BD: la decisión vive en una función pura. La consulta (y su filtro por
// merchantId) vive en la ruta y se comprueba aparte, leyéndola como texto.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  conceptosFrecuentes, MIN_USOS, MIN_CONCEPTOS, TOP, VENTANA_DIAS,
} from '../dist/modules/products/domain/frequentConcepts.js';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const DIA = 24 * 60 * 60 * 1000;

/** Un presupuesto de hace `dias` con estos conceptos (una línea por concepto). */
const q = (dias, ...conceptos) => ({
  createdAt: new Date(Date.now() - dias * DIA),
  lines: conceptos.map((c) => ({ concept: c, qty: 1, price: 10, tax: 0.21 })),
});

test('SCRUM-162: con señal de sobra, devuelve los más usados con su recuento', () => {
  const items = conceptosFrecuentes([
    q(1, 'Mano de obra', 'Desplazamiento', 'Material'),
    q(2, 'Mano de obra', 'Desplazamiento', 'Material'),
    q(3, 'Mano de obra', 'Desplazamiento', 'Material'),
    q(4, 'Mano de obra'),
  ]);
  assert.equal(items.length, 3);
  assert.deepEqual(items[0], { concepto: 'Mano de obra', usos: 4 }, 'el más usado va primero, con su cuenta real');
  assert.ok(items.every((i) => i.usos >= MIN_USOS), 'nada por debajo del mínimo se cuela');
});

test('SCRUM-162: EL UMBRAL — con uno o dos conceptos repetidos NO se enseña nada', () => {
  // Dos conceptos repetidísimos, pero solo dos: eso no es «tus más usados», es una lista
  // corta que parecería un historial. Es el motivo por el que F6 no construyó esto.
  const items = conceptosFrecuentes([
    q(1, 'Mano de obra', 'Desplazamiento'),
    q(2, 'Mano de obra', 'Desplazamiento'),
    q(3, 'Mano de obra', 'Desplazamiento'),
    q(4, 'Mano de obra', 'Desplazamiento'),
  ]);
  assert.deepEqual(items, [],
    `🔴 con menos de ${MIN_CONCEPTOS} conceptos frecuentes hay que devolver VACÍO: el front pinta ` +
    'lo que llegue, así que devolver "lo que haya" es exactamente la lista inventada que este ' +
    'ticket vino a NO construir.');
});

test('SCRUM-162: un concepto repetido DENTRO de un presupuesto cuenta UNA vez', () => {
  // Un presupuesto muy desglosado no puede fabricar un «más usado» él solo.
  const items = conceptosFrecuentes([
    q(1, 'Mano de obra', 'Mano de obra', 'Mano de obra', 'Mano de obra', 'Mano de obra'),
    q(2, 'Material', 'Material', 'Material'),
    q(3, 'Desplazamiento', 'Desplazamiento', 'Desplazamiento'),
  ]);
  assert.deepEqual(items, [], 'contando por línea, estos tres presupuestos habrían inventado tres conceptos frecuentes');
});

test('SCRUM-162: la ventana deja fuera lo viejo', () => {
  const dentro = conceptosFrecuentes([
    q(1, 'A', 'B', 'C'), q(2, 'A', 'B', 'C'), q(3, 'A', 'B', 'C'),
  ]);
  assert.equal(dentro.length, 3, 'precondición: dentro de la ventana sí hay señal');

  const fuera = conceptosFrecuentes([
    q(VENTANA_DIAS + 1, 'A', 'B', 'C'),
    q(VENTANA_DIAS + 2, 'A', 'B', 'C'),
    q(VENTANA_DIAS + 3, 'A', 'B', 'C'),
  ]);
  assert.deepEqual(fuera, [],
    `lo anterior a ${VENTANA_DIAS} días no cuenta: quien dejó de hacer calderas no quiere calderas arriba para siempre`);
});

test('SCRUM-162: mismo concepto con otras mayúsculas o espacios es el MISMO, y gana la grafía más tecleada', () => {
  const items = conceptosFrecuentes([
    q(1, 'MANO DE OBRA', 'Material', 'Desplazamiento'),
    q(2, 'Mano de obra', 'Material', 'Desplazamiento'),
    q(3, '  mano   de obra ', 'Material', 'Desplazamiento'),
    q(4, 'Mano de obra', 'Material', 'Desplazamiento'),
  ]);
  const manoDeObra = items.find((i) => i.concepto.toLowerCase().replace(/\s+/g, ' ') === 'mano de obra');
  assert.ok(manoDeObra, 'las cuatro variantes tienen que agruparse en un solo concepto');
  assert.equal(manoDeObra.usos, 4, 'y sumar los cuatro presupuestos, no quedarse en uno por variante');
  assert.equal(manoDeObra.concepto, 'Mano de obra', 'se muestra como lo escribe él más veces, no la primera que se vio');
});

test('SCRUM-162: entradas raras no rompen ni ensucian la lista', () => {
  const items = conceptosFrecuentes([
    { createdAt: new Date(), lines: null },
    { createdAt: new Date(), lines: [{ qty: 1 }, { concept: '' }, { concept: '   ' }, { concept: 42 }] },
    { createdAt: 'no es una fecha', lines: [{ concept: 'X' }] },
    q(1, 'A', 'B', 'C'), q(2, 'A', 'B', 'C'), q(3, 'A', 'B', 'C'),
  ]);
  assert.equal(items.length, 3, 'líneas sin concepto, vacías, no-texto o con fecha ilegible se ignoran sin reventar');
  assert.ok(items.every((i) => i.concepto.trim().length > 0), 'nunca se devuelve un concepto en blanco');
});

test('SCRUM-162: nunca devuelve más de TOP', () => {
  const muchos = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const items = conceptosFrecuentes([q(1, ...muchos), q(2, ...muchos), q(3, ...muchos)]);
  assert.equal(items.length, TOP, `la fila de fichas no puede crecer sin límite (TOP=${TOP})`);
});

test('SCRUM-162: `plantillasRotulo` se declara ANTES de que nadie la lea (el TDZ que mataba el render)', () => {
  // Este guard no es de mi funcionalidad: es del fallo que la destapó. `recalcTotals()` lee
  // `plantillasRotulo` a través de `refrescarRotuloPlantillas()` en el primer `addLine()` del
  // render. Con el `let` declarado 1.700 líneas más abajo, esa lectura caía en su zona muerta
  // (TDZ) y el `ReferenceError` ABORTABA el resto del render: ni fila de plantillas de F6, ni
  // listener de «Usar plantilla», ni fichas de conceptos. Y en silencio — la página cargaba.
  const js = fs.readFileSync(path.join(DIR, '..', 'public', 'dashboard', 'js', 'quotesView.js'), 'utf8');
  const declaracion = js.indexOf('let plantillasRotulo');
  const primeraLectura = js.indexOf('refrescarRotuloPlantillas();');

  // GUARDA DEL DETECTOR: si se renombra la variable o la función, esto pasaría en vacío.
  assert.ok(declaracion > 0 && primeraLectura > 0,
    '🔴 DETECTOR CIEGO: no se encuentran `plantillasRotulo` o `refrescarRotuloPlantillas()` en quotesView.js. Si se renombraron, ACTUALIZA este guard en vez de borrarlo.');

  assert.ok(declaracion < primeraLectura,
    '\n\n🔴 TDZ: `plantillasRotulo` se declara DESPUÉS de la primera llamada a\n' +
    '`refrescarRotuloPlantillas()`. Esa llamada ocurre dentro de `recalcTotals()`, que corre en\n' +
    'el primer `addLine()` del render — o sea ANTES. El ReferenceError aborta el resto del\n' +
    'render y la pantalla se queda a medias SIN dar error visible al usuario.\n' +
    'Arreglo: la declaración vive junto a su contenedor (`.quote-plantillas`), arriba.\n');
});

test('SCRUM-162: la ruta acota al TENANT y a la ventana (regla 2)', () => {
  const fuente = fs.readFileSync(
    path.join(DIR, '..', 'src', 'modules', 'products', 'app', 'routes', 'products.routes.ts'), 'utf8',
  );
  const i = fuente.indexOf("router.get('/frequent-concepts'");

  // GUARDA DEL DETECTOR: si la ruta se renombra o se mueve, este test pasaría en vacío.
  assert.ok(i > 0, '🔴 DETECTOR CIEGO: no se encuentra la ruta /frequent-concepts en products.routes.ts');

  const cuerpo = fuente.slice(i, i + 1600);
  assert.match(cuerpo, /merchantId:\s*req\.merchantId/,
    '🔴 FUGA MULTI-TENANT: la consulta de conceptos debe filtrar por `req.merchantId` — son los ' +
    'presupuestos de UN merchant, y sin ese filtro el pro vería los conceptos de otros negocios.');
  assert.match(cuerpo, /createdAt:\s*\{\s*gte:\s*desde\s*\}/,
    'la ventana también se aplica en la consulta: no se trae el histórico entero a memoria');
});
