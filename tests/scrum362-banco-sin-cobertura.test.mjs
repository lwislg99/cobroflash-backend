// tests/scrum362-banco-sin-cobertura.test.mjs — SCRUM-362 (H7)
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL SUELO DEL BLOQUE H: que «sin cobertura» se pueda REPRODUCIR en la tanda.
//
// Sin esto, cualquier cosa que se construya en H1, H2, H3 o H5 sale verde sin significar nada.
// No hay víctima directa; lo que hay es un bloque entero apoyado en una prueba que no existía.
//
// 🔴 Y EL CORAZÓN ES EL SUELO, no las aserciones: **«el producto aguanta sin cobertura» y «no supe
// cortar la red» dan el mismo verde y significan lo contrario.** Por eso cada escenario cuenta las
// peticiones que le llegan, y si el producto no pidió nada el test se declara CIEGO en vez de dar
// por buena una pantalla que nunca llegó a intentarlo.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { redNormal, portalCautivo, aceptaYNoEntrega, corteAMediaSubida, ESCENARIOS } from './_banco-red.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * La operación bajo prueba: abrir **Cobros**, que pide `/admin/cobros` por `apiRequest` → `fetch`.
 * Se elige porque toca la red al abrirse y porque su copy está aprobado, así que se puede afirmar
 * qué debería decir sin inventar microcopy.
 */
async function abrirCobrosCon(red) {
  const banco = cargarDashboard(RAIZ, { red });
  const r = await pintarVista(banco, 'renderCobrosView');
  const texto = r.contenedor ? todos(r.contenedor).map((n) => n.textContent).filter(Boolean).join(' | ') : '';
  return { banco, r, texto, red };
}

/** El suelo, en una línea: si el escenario no se ejerció, nada de lo demás significa nada. */
function exigirQueSeEjercio(red, r) {
  assert.ok(red.seEjercio(),
    `🔴 BANCO CIEGO: el escenario «${red.nombre}» NO se ha ejercido — el producto no llegó a pedir ` +
    `nada (${red.describir()}). «Aguanta sin cobertura» y «no supe cortar la red» dan el mismo ` +
    'verde: si la pantalla no toca la red, este test no está midiendo el escenario.');
  assert.equal(r.error, null,
    `🔴 la pantalla revienta en «${red.nombre}»: ${r.error && r.error.message}`);
}

// ═══ SUELO DEL BANCO ══════════════════════════════════════════════════════════════════════

test('SCRUM-362 · SUELO: los CUATRO escenarios se montan y se ejercen de verdad', async () => {
  const sinEjercer = [];
  for (const [nombre, fabricar] of Object.entries(ESCENARIOS)) {
    const red = fabricar();
    const { r } = await abrirCobrosCon(red);
    if (!red.seEjercio() || r.error) sinEjercer.push(`${nombre} → ${red.describir()}`);
  }
  assert.deepEqual(sinEjercer, [],
    '🔴 hay escenarios que NO se han podido montar. Un escenario que no se ejerce es un test que ' +
    'pasa sin haber probado nada:\n   · ' + sinEjercer.join('\n   · '));
});

test('SCRUM-362 · SUELO: un escenario que nadie usa se declara CIEGO', () => {
  // El suelo probado contra sí mismo: sin peticiones, `seEjercio()` es falso y el mensaje lo dice.
  const red = portalCautivo();
  assert.equal(red.seEjercio(), false,
    '🔴 un escenario recién fabricado, sin que nadie le pida nada, se declara ejercido. Entonces ' +
    'el suelo no distingue «lo probé» de «no lo probé».');
  assert.match(red.describir(), /^0 petición/);
});

// ═══ CONTROL POSITIVO — y es EL test ══════════════════════════════════════════════════════

test('SCRUM-362 · CONTROL POSITIVO: con red normal la operación FUNCIONA', async () => {
  // Un banco que falla siempre no prueba nada: solo que está roto. Sin este, los tres de abajo
  // podrían estar pasando porque la pantalla no funciona en ningún caso.
  const COBRO = {
    origen: 'invoice', id: 1, fecha: '2026-08-02T10:00:00.000Z', cliente: 'Paca la fontanera',
    concepto: null, importe: '250.00', moneda: 'EUR', metodo: null, estado: 'paid',
    referencia: null, numero: 'J-20260802-AB12', tipo: 'JUST', invoiceId: 1, chargeId: null,
  };
  const red = redNormal([COBRO]);
  const { r, texto } = await abrirCobrosCon(red);
  exigirQueSeEjercio(red, r);

  assert.match(texto, /Paca la fontanera/,
    '🔴 con red NORMAL la pantalla no pinta el cobro. Si esto falla, los escenarios de abajo no ' +
    'prueban que el producto aguante nada: prueban que el banco está roto.');
  assert.match(texto, /J-20260802-AB12/);
  assert.ok(!/No hemos podido cargar/.test(texto),
    '🔴 con red normal la pantalla dice que no ha podido cargar.');
});

// ═══ ① PORTAL CAUTIVO ═════════════════════════════════════════════════════════════════════

test('SCRUM-362 · ① PORTAL CAUTIVO: `200` con el HTML del router, y la pantalla NO se lo traga', async () => {
  // Lo peor de este escenario es que PARECE que ha ido bien: `res.ok` es true, hay cuerpo, y
  // `onLine` dice que sí. Ya mordió una vez en las descargas (SCRUM-405).
  const red = portalCautivo();
  const { r, texto } = await abrirCobrosCon(red);
  exigirQueSeEjercio(red, r);

  assert.match(texto, /No hemos podido cargar los cobros/,
    '🔴 con un portal cautivo la pantalla no avisa. La wifi del bar respondió 200 con su pantalla ' +
    'de acceso y el profesional se queda sin saber que lo que ve no son sus datos.');
  assert.ok(!/Todavía no hay cobros registrados/.test(texto),
    '🔴 con un portal cautivo la pantalla dice «todavía no hay cobros». Eso le AFIRMA al ' +
    'profesional que no le deben nada, cuando lo que pasa es que ni siquiera ha hablado con ' +
    'nosotros. En la pantalla del dinero eso no es impreciso: es falso.');
});

// ═══ ② ACEPTA Y NO ENTREGA ════════════════════════════════════════════════════════════════

test('SCRUM-362 · ② ACEPTA Y NO ENTREGA: la petición sale, no vuelve, y `onLine` MIENTE', async () => {
  const red = aceptaYNoEntrega();
  const { banco, r, texto } = await abrirCobrosCon(red);
  exigirQueSeEjercio(red, r);

  // El escenario reproducido: salió y sigue en el aire.
  assert.equal(red.reg.colgadas, 1,
    `🔴 la petición no se ha quedado colgada (${red.describir()}): esto no es «acepta y no ` +
    'entrega», es otra cosa.');
  assert.equal(red.reg.resueltas, 0, '🔴 la petición ha resuelto: el escenario no se ha montado.');

  // 🔴 Y LA MITAD QUE DEFINE EL ESCENARIO: el navegador dice que HAY red.
  assert.equal(banco.ctx.navigator.onLine, true,
    '🔴 `onLine` dice que no hay red. Entonces esto es el toggle de DevTools, no una obra: en una ' +
    'LAN sin salida el móvil está conectadísimo… al router del bar.');

  // Lo que sí se puede afirmar hoy sin tocar producto: no ha pintado datos que no tiene.
  assert.ok(!/Paca la fontanera|J-2026/.test(texto),
    '🔴 la pantalla pinta datos con la petición todavía en el aire: se los ha inventado.');

  // ⚠️ HALLAZGO, y no se convierte en aserción aquí — ver la entrada de máster. Con la petición
  // colgada la pantalla dice HOY «Todavía no hay cobros registrados.», que es afirmarle al
  // profesional que no le deben nada mientras la respuesta no ha llegado. Este ticket **no toca
  // producto**, y aseverar el texto actual lo fijaría como requisito — el error que ya se corrigió
  // tres veces hoy. Se reporta.
});

// ═══ ③ CORTE A MEDIA SUBIDA ═══════════════════════════════════════════════════════════════

test('SCRUM-362 · ③ CORTE A MEDIA SUBIDA: salió, pudo llegar, y no se finge que terminó', async () => {
  const red = corteAMediaSubida();
  const { r, texto } = await abrirCobrosCon(red);
  exigirQueSeEjercio(red, r);

  // La diferencia con «no hay red» es la que importa para H: **la petición SALIÓ**, así que el
  // servidor pudo recibirla. El registro lo demuestra en vez de suponerlo.
  assert.equal(red.reg.peticiones.length, 1,
    '🔴 la petición no llegó a salir: entonces esto es «sin red», no «corte a media subida», y el ' +
    'producto podría dar por perdido algo que el servidor sí recibió.');
  assert.equal(red.reg.fallidas, 1);

  assert.match(texto, /No hemos podido cargar los cobros/,
    '🔴 tras un corte a media subida la pantalla no avisa de nada.');
  assert.ok(!/Todavía no hay cobros registrados/.test(texto),
    '🔴 tras el corte la pantalla afirma que no hay cobros. Lo que quedó a medias no puede quedar ' +
    'en un estado que parezca terminado.');
});

// ═══ CONTROL NEGATIVO ═════════════════════════════════════════════════════════════════════

test('SCRUM-362 · NEGATIVO: los escenarios NO se confunden entre sí', async () => {
  // Si los cuatro produjeran lo mismo, el banco tendría un solo escenario con cuatro nombres — y
  // «el producto aguanta los tres» no significaría nada.
  const huellas = {};
  for (const [nombre, fabricar] of Object.entries(ESCENARIOS)) {
    const red = fabricar();
    await abrirCobrosCon(red);
    huellas[nombre] = `${red.reg.resueltas}/${red.reg.fallidas}/${red.reg.colgadas}`;
  }
  assert.equal(new Set(Object.values(huellas)).size, 3,
    '🔴 los escenarios no se distinguen entre sí por lo que le hacen a la red:\n   ' +
    JSON.stringify(huellas) + '\n  (se esperan TRES huellas: resuelta, fallida y colgada — el ' +
    'portal cautivo resuelve igual que la red normal, y por eso su diferencia está en el CUERPO.)');
  assert.notEqual(huellas.redNormal, huellas.corteAMediaSubida);
  assert.notEqual(huellas.redNormal, huellas.aceptaYNoEntrega);
});

test('SCRUM-362 · NEGATIVO: el portal cautivo se distingue de la red normal por el CUERPO', async () => {
  // Su huella de red es idéntica a la de una red sana —200, resuelta— y esa es justo su trampa.
  // Lo que los separa es lo que devuelven, y hay que comprobarlo o el escenario ① sería un duplicado.
  const sana = redNormal({ hola: 'mundo' });
  const portal = portalCautivo();
  const rSana = await sana.fetch('/admin/cobros', {});
  const rPortal = await portal.fetch('/admin/cobros', {});
  assert.equal(rSana.ok, rPortal.ok, 'suelo: los dos responden `ok`, que es la trampa del portal.');
  assert.match(rPortal.headers.get('content-type'), /text\/html/,
    '🔴 el portal cautivo no devuelve HTML: entonces no es un portal cautivo.');
  await assert.rejects(() => rPortal.json(),
    '🔴 pedirle `json()` a la pantalla de un router tiene que reventar, como en la obra.');
  assert.deepEqual(await rSana.json(), { hola: 'mundo' });
});
