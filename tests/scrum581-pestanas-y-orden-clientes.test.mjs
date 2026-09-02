// tests/scrum581-pestanas-y-orden-clientes.test.mjs — SCRUM-581 (CONT-08)
//
// Las pestañas Todos|Empresas|Personas y el orden de la lista de clientes.
//
// 🔴 POR QUÉ SE PRUEBA AQUÍ Y NO CON UN GUARD DE NAVEGADOR: los nueve guards de navegador NO
// cubren el dashboard — lo midió S3 y está abierto como SCRUM-628. Por eso la DECISIÓN vive en
// `filtroClientes.js` sin DOM: para que esta pantalla tenga red en `npm test`, que es donde la
// hay. Los guards de navegador sólo valen aquí como no-regresión de la landing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const FC = require(path.join(RAIZ, 'public/dashboard/js/filtroClientes.js'));

/**
 * EL CASO REAL DE HOY, medido en el PASO 0: 15 filas y `contact_kind` NULL en todas. Se añaden
 * dos declaradas para poder ejercitar también el caso de mañana; el de hoy son las NULL.
 */
const HOY = [
  { id: 1, name: 'Zorrilla', contactKind: null },
  { id: 2, name: 'álvarez', contactKind: null },
  { id: 3, name: 'Álvarez', contactKind: null },
  { id: 4, name: 'Bermúdez', contactKind: undefined },
];
const MANANA = [
  { id: 5, name: 'Acme SL', contactKind: 'EMPRESA' },
  { id: 6, name: 'Chus', contactKind: 'PERSONA' },
];

test('SCRUM-581 · 🔴 CONTROL NEGATIVO: «Todos» sin tocar el orden es EXACTAMENTE la lista de hoy', () => {
  // El defecto es `createdAt desc` y lo pone el servidor (`listCustomers`). Aquí eso se traduce
  // en: no se reordena y no se quita nada. Si esto cambia, es una REGRESIÓN, no una mejora.
  const lote = HOY.concat(MANANA);
  const visto = FC.aplicar(lote, FC.POR_DEFECTO.pestana, FC.POR_DEFECTO.orden);
  assert.deepEqual(visto.map((c) => c.id), lote.map((c) => c.id),
    '🔴 con «Todos» y sin tocar el orden, la lista ha cambiado respecto a la que mandó el servidor.\n'
    + '  El defecto tiene que seguir siendo el de hoy: quien abre la pantalla y no toca nada ve\n'
    + '  exactamente lo mismo que antes de este ticket.');
  assert.equal(FC.POR_DEFECTO.orden, 'RECIENTES', '🔴 el orden por defecto ha dejado de ser el del servidor.');
  assert.equal(FC.POR_DEFECTO.pestana, 'TODOS', '🔴 la pestaña por defecto ha dejado de ser «Todos».');
});

test('SCRUM-581 · 🔴 EL CASO DE HOY: 15 NULL → «Todos» los enseña, las otras dos salen VACÍAS', () => {
  // Es el caso real medido: 0 filas con valor, 15 en NULL. Una pestaña que enseñara algo aquí
  // estaría inventando una clasificación que nadie ha declarado.
  const soloNull = HOY;
  assert.equal(FC.filtrarPorPestana(soloNull, 'TODOS').length, soloNull.length,
    '🔴 «Todos» ha dejado de enseñar las filas sin clasificar.');
  assert.deepEqual(FC.filtrarPorPestana(soloNull, 'EMPRESA'), [],
    '🔴 una fila con `contactKind` NULL ha aparecido en «Empresas».\n'
    + '  NULL no «es» nada: es «nadie lo ha declarado». Meterla en un lado por comodidad es\n'
    + '  exactamente `resolveTipoDestinatario` otra vez (SCRUM-615).');
  assert.deepEqual(FC.filtrarPorPestana(soloNull, 'PERSONA'), [],
    '🔴 una fila con `contactKind` NULL ha aparecido en «Personas». Ver el mensaje de arriba.');
});

test('SCRUM-581 · 🔴 NINGUNA fila cae en una pestaña que no le corresponde', () => {
  const lote = HOY.concat(MANANA);
  const empresas = FC.filtrarPorPestana(lote, 'EMPRESA');
  const personas = FC.filtrarPorPestana(lote, 'PERSONA');

  for (const c of empresas) {
    assert.equal(c.contactKind, 'EMPRESA',
      `🔴 «Empresas» ha devuelto a #${c.id} («${c.name}»), cuyo contactKind es `
      + `${JSON.stringify(c.contactKind)}. El filtro está enseñando de más.`);
  }
  for (const c of personas) {
    assert.equal(c.contactKind, 'PERSONA',
      `🔴 «Personas» ha devuelto a #${c.id} («${c.name}»), cuyo contactKind es `
      + `${JSON.stringify(c.contactKind)}. El filtro está enseñando de más.`);
  }
  assert.deepEqual(empresas.map((c) => c.id), [5], '🔴 «Empresas» no devuelve exactamente la empresa.');
  assert.deepEqual(personas.map((c) => c.id), [6], '🔴 «Personas» no devuelve exactamente la persona.');

  // 📌 La consecuencia asumida, comprobada: mientras haya NULLs, Empresas + Personas NO suma Todos.
  const todos = FC.filtrarPorPestana(lote, 'TODOS');
  assert.ok(empresas.length + personas.length < todos.length,
    '🔴 Empresas + Personas ya suma Todos: o no quedan NULLs, o algo los está clasificando solo.');
});

test('SCRUM-581 · el orden A-Z pone «Álvarez» y «alvarez» donde el usuario los busca', () => {
  const az = FC.ordenar(HOY, 'AZ').map((c) => c.name);
  // Acentos y mayúsculas juntos, y antes de «Bermúdez» y «Zorrilla». Un sort binario habría
  // puesto «Zorrilla» antes que «álvarez» (mayúsculas primero) y «Álvarez» al final del todo.
  assert.equal(az[0].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''), 'alvarez',
    `🔴 el primero debería ser un «Álvarez»; salió «${az[0]}». Orden binario en vez de localeCompare.`);
  assert.equal(az[1].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''), 'alvarez',
    `🔴 los dos «Álvarez» tienen que quedar juntos; el segundo salió «${az[1]}».`);
  assert.deepEqual(az.slice(2), ['Bermúdez', 'Zorrilla'],
    `🔴 el resto no queda alfabético: ${JSON.stringify(az)}`);
});

test('SCRUM-581 · ordenar NO muta lo que mandó el servidor', () => {
  // Si `sort` mutara el lote, el orden «Más recientes» dejaría de ser el del servidor en cuanto
  // alguien pulsara A-Z una vez — y el control negativo pasaría en la primera carga y fallaría
  // en la segunda, que es la clase de fallo que nadie reproduce.
  const lote = HOY.concat(MANANA);
  const antes = lote.map((c) => c.id);
  FC.ordenar(lote, 'AZ');
  assert.deepEqual(lote.map((c) => c.id), antes, '🔴 `ordenar` ha mutado la lista de entrada.');
});

test('SCRUM-581 · MICROCOPY: los seis rótulos llevan el marcador y UNA sola constante los apaga', () => {
  const ranuras = [...FC.PESTANAS, ...FC.ORDENES, FC.VACIO_PESTANA];
  assert.equal(ranuras.length, 6, '🔴 ha cambiado el número de ranuras con marcador; declara la subida del censo.');
  for (const r of ranuras) {
    assert.ok(FC.etiqueta(r).startsWith(FC.MARCADOR),
      `🔴 el rótulo «${FC.etiqueta(r)}» no lleva el marcador oficial (regla 30).`);
    assert.ok(FC.etiqueta(r).length > FC.MARCADOR.length + 1,
      '🔴 el rótulo lleva SÓLO la marca. Con tres pestañas eso las haría idénticas: va marca + '
      + 'palabra de trabajo, como fija `switchFormaJuridica.js`.');
  }
  assert.equal(FC.MARCADOR, '[PENDIENTE microcopy oficial]', '🔴 el marcador no es el oficial.');
});
