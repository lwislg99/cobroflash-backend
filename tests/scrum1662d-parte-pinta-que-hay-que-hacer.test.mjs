// SCRUM-1662 (d) · LA HOJA DEL PARTE DICE «QUÉ HAY QUE HACER».
//
// La última pieza de la aceptación de SCRUM-1662: el operario abre el parte y lee la tarea que el jefe
// escribió en el trabajo, sin tener que volver a la ficha. El dato lo trae el SERVIDOR en el mismo
// `GET /admin/partes/:id` (pieza (c), `tests/scrum1662c-parte-que-hay-que-hacer-get.test.mjs`; decisión
// en SCRUM-1662 comentario 21964): la pantalla NO pide el trabajo — hacerlo tumbaba `scrum1697` ①bis y
// `scrum366` (medido, comentario 21962).
//
// FIRMA: el rótulo «Qué hay que hacer» es el de SCRUM-1662 comentario 21548, y que vale dentro del
// parte, el comentario 21956. Ficha: `docs/microcopy/2026-11-11-SCRUM-1662-que-hay-que-hacer-en-el-parte.md`.
//
// Lo que se fija aquí:
//   ① el literal firmado, letra a letra, y que es el MISMO de la ficha del trabajo;
//   ② con tarea, la hoja la pinta UNA vez, justo debajo de la cabecera, en sus dos estados;
//   ③ SIN TAREA NO HAY LÍNEA (comentario 21801): ni bloque, ni rótulo, ni un «Sin tarea» inventado;
//   ④ es de SOLO LECTURA: dentro no hay nada que se escriba ni se pulse;
//   ⑤ la tarea es TEXTO: lo que el jefe escribió se lee tal cual, con sus saltos, y no se interpreta;
//   ⑥ el bloque tiene su regla en la hoja de estilos y la firma, su ficha.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, todos, clasesDeLasHojas } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIRMADO = 'Qué hay que hacer';
const FICHA = path.join(RAIZ, 'docs', 'microcopy', '2026-11-11-SCRUM-1662-que-hay-que-hacer-en-el-parte.md');
const TAREA = 'Cambiar el termo del baño.\nLlevar llave de paso de 1/2.';

const BASE = Object.freeze({
  id: 23, numero: 'PT-2026-015', clienteNombre: 'Cliente de pruebas', jobId: 84,
  fecha: '2026-11-16T08:00:00.000Z', obra: null, referencia: null,
  entrada: '09:10', salida: '11:40', desplazamientos: 2, kilometros: 8,
  tecnicos: [], tipo: null,
  lineas: [{ bloque: 'mano_obra', unds: 1, descripcion: 'Revisión' }],
  notas: null,
});
const BORRADOR = Object.freeze({
  ...BASE, estado: 'borrador', firmoElCliente: false, firmoElTecnico: false,
  puedeEditarContenido: { ok: true, motivo: null }, puedeEditarPrecios: { ok: true, motivo: null },
});
const YA_FIRMADO = Object.freeze({
  ...BASE, estado: 'firmado', firmoElCliente: true, firmoElTecnico: true,
  puedeEditarContenido: { ok: false, motivo: 'firmado' }, puedeEditarPrecios: { ok: true, motivo: null },
});

const conClase = (n, clase) => String(n.className || '').split(/\s+/).includes(clase);
const textoDe = (n) => todos(n).map((x) => x._texto || '').join('');
const esElBloque = (n) => !!n.getAttribute && n.getAttribute('data-parte-tarea') === '1';

/** Pinta el parte y devuelve la hoja. El SUELO va dentro: si la vista no pinta, no hay nada que mirar. */
function pintar(parte) {
  const b = cargarDashboard(RAIZ);
  const c = b.mk('div');
  assert.equal(b.ctx.renderParte(c, parte), true, '🔴 SUELO: la vista se negó a pintar el parte');
  assert.ok(
    c.hijos.length >= 3 && c.hijos[0].tagName === 'HEADER' && conClase(c.hijos[0], 'parte-cabecera'),
    '🔴 SUELO: la hoja ya no empieza por `header.parte-cabecera` (¿cambió `renderParte`?)',
  );
  return { c, bloques: todos(c).filter(esElBloque) };
}

/** Cuántas veces sale el rótulo en TODA la hoja, esté donde esté. */
const vecesElRotulo = (c) => todos(c).filter((n) => (n._texto || '').trim() === FIRMADO).length;

test('SCRUM-1662d ① el rótulo es el firmado, literal, y el mismo que el de la ficha del trabajo', () => {
  const { ctx } = cargarDashboard(RAIZ);
  assert.equal(ctx.PARTE_TEXTOS.queHayQueHacer, FIRMADO);
  assert.equal(ctx.ROTULO_TAREA, FIRMADO, '🔴 SUELO: la ficha del trabajo ya no expone su rótulo (`ROTULO_TAREA`)');
});

function laTareaSePinta(parte) {
  const { c, bloques } = pintar({ ...parte, queHayQueHacer: TAREA });
  assert.equal(bloques.length, 1, '🔴 con tarea, la hoja pinta UN bloque `[data-parte-tarea]`');
  const bloque = bloques[0];
  assert.equal(c.hijos[1], bloque, '🔴 el bloque va justo debajo de la cabecera: es lo primero que se lee');
  assert.equal(vecesElRotulo(bloque), 1, '🔴 el bloque lleva el rótulo firmado');
  assert.equal(vecesElRotulo(c), 1, 'el rótulo sale una sola vez en la hoja');
  const parrafos = todos(bloque).filter((n) => n.tagName === 'P' && conClase(n, 'detail-tarea'));
  assert.equal(parrafos.length, 1, '🔴 la tarea va en UN párrafo `.detail-tarea` (el que conserva los saltos)');
  assert.equal(textoDe(parrafos[0]), TAREA, '🔴 la tarea se lee tal cual la escribió el jefe, con sus saltos');
}

// Dos tests de nombre LITERAL, no un bucle con el nombre construido (SCRUM-1415).
test('SCRUM-1662d ② el parte en BORRADOR pinta la tarea, una vez, justo debajo de la cabecera', () => {
  laTareaSePinta(BORRADOR);
});

test('SCRUM-1662d ② el parte FIRMADO pinta la tarea, una vez, justo debajo de la cabecera', () => {
  laTareaSePinta(YA_FIRMADO);
});

function sinTareaNoHayLinea(parte) {
  // Lo que el servidor manda sin tarea es `null`; `undefined` es un servidor anterior a la pieza (c).
  // El resto no debería llegar nunca, y por eso mismo no puede pintar un rótulo sobre nada.
  const vacios = [
    ['null', null], ['sin la clave', undefined], ['cadena vacía', ''], ['solo espacios', '  \n\t '],
    ['un número', 7], ['un objeto', { texto: TAREA }], ['una lista', [TAREA]], ['true', true],
  ];
  for (const [nombre, valor] of vacios) {
    const dato = valor === undefined ? { ...parte } : { ...parte, queHayQueHacer: valor };
    const { c, bloques } = pintar(dato);
    assert.equal(bloques.length, 0, `🔴 sin tarea (${nombre}) no hay bloque`);
    assert.equal(vecesElRotulo(c), 0, `🔴 sin tarea (${nombre}) el rótulo no se pinta sobre nada`);
    assert.equal(
      todos(c).filter((n) => conClase(n, 'detail-tarea')).length, 0,
      `🔴 sin tarea (${nombre}) no queda un párrafo vacío`,
    );
  }
  // CONTROL POSITIVO: la misma función, con tarea, SÍ ve el bloque. Sin esto, los ceros de arriba
  // podrían ser de un buscador que no encuentra nada nunca.
  assert.equal(pintar({ ...parte, queHayQueHacer: TAREA }).bloques.length, 1, '🔴 CONTROL: con tarea el buscador no ve el bloque');
}

test('SCRUM-1662d ③ sin tarea no hay línea — parte en BORRADOR', () => {
  sinTareaNoHayLinea(BORRADOR);
});

test('SCRUM-1662d ③ sin tarea no hay línea — parte FIRMADO', () => {
  sinTareaNoHayLinea(YA_FIRMADO);
});

test('SCRUM-1662d ④ es de solo lectura: dentro del bloque no hay nada que se escriba ni se pulse', () => {
  const { c, bloques } = pintar({ ...BORRADOR, queHayQueHacer: TAREA });
  assert.equal(bloques.length, 1);
  const dentro = todos(bloques[0]);
  const INTERACTIVOS = ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A', 'DETAILS', 'SUMMARY'];
  assert.deepEqual(dentro.filter((n) => INTERACTIVOS.includes(n.tagName)).map((n) => n.tagName), []);
  const ATRIBUTOS = ['data-parte-campo', 'data-parte-guardar', 'contenteditable', 'onclick', 'tabindex'];
  assert.deepEqual(
    dentro.flatMap((n) => ATRIBUTOS.filter((a) => n.getAttribute && n.getAttribute(a) !== null)), [],
    '🔴 el bloque lleva un atributo de edición o de acción',
  );
  // CONTROL POSITIVO: el mismo borrador SÍ tiene casillas fuera del bloque; el filtro las ve.
  assert.ok(
    todos(c).filter((n) => n.tagName === 'INPUT').length > 0,
    '🔴 CONTROL: el borrador no tiene ni una casilla (el filtro de interactivos estaría ciego)',
  );
});

test('SCRUM-1662d ⑤ la tarea es texto: las marcas que escriba el jefe se leen, no se interpretan', () => {
  const conMarcas = 'Poner <b>dos</b> manos & rematar "el zócalo"';
  const { bloques } = pintar({ ...BORRADOR, queHayQueHacer: conMarcas });
  assert.equal(bloques.length, 1);
  const p = todos(bloques[0]).filter((n) => conClase(n, 'detail-tarea'));
  assert.equal(p.length, 1);
  assert.deepEqual(todos(bloques[0]).filter((n) => n.tagName === 'B').map((n) => n.tagName), [], '🔴 la marca se convirtió en un elemento');
  // El banco guarda el texto como lo ESCRIBE la vista (escapado); lo que importa es que, deshecho el
  // escape, es exactamente lo que escribió el jefe.
  const leido = textoDe(p[0])
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&amp;/g, '&');
  assert.equal(leido, conMarcas);
});

test('SCRUM-1662d ⑥ el bloque tiene su regla en la hoja de estilos', () => {
  const clases = clasesDeLasHojas(RAIZ); // un Set; lanza si lee menos de 100 clases
  const tiene = (c) => clases.has(c);
  assert.ok(tiene('parte-cabecera'), '🔴 CONTROL: el lector de hojas no ve una clase que SÍ tiene regla');
  assert.ok(!tiene('parte-clase-que-no-existe'), '🔴 CONTROL: el lector de hojas da por buena cualquier clase');
  const { bloques } = pintar({ ...BORRADOR, queHayQueHacer: TAREA });
  assert.equal(bloques.length, 1, '🔴 con tarea, la hoja pinta UN bloque `[data-parte-tarea]`');
  const pintadas = [...new Set(todos(bloques[0]).flatMap((n) => String(n.className || '').split(/\s+/).filter(Boolean)))];
  assert.ok(pintadas.includes('parte-tarea'), '🔴 el bloque no lleva su clase `parte-tarea`');
  assert.deepEqual(pintadas.filter((c) => !tiene(c)), [], '🔴 clase pintada sin regla: se vería desnuda');
});

test('SCRUM-1662d ⑥ la firma tiene su ficha, con el literal y la línea de aprobación', () => {
  assert.ok(fs.existsSync(FICHA), '🔴 falta la ficha de la firma en docs/microcopy/');
  const lineas = fs.readFileSync(FICHA, 'utf8').split(/\r?\n/);
  assert.ok(lineas.includes('> ' + FIRMADO), '🔴 la ficha no cita el literal firmado tal cual, en su propia línea de cita');
  assert.ok(
    lineas.some((l) => l.startsWith('**Aprobado por el fundador**') && l.includes('**SCRUM-1662**')),
    '🔴 la ficha no lleva la línea de firma (docs/microcopy/README.md, punto 3), fuera de cita',
  );
});
