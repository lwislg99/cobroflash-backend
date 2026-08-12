// tests/scrum285-pantalla-cobros.test.mjs — SCRUM-285 (B4)
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL TEST QUE DECIDE: **un cobro marcado A MANO aparece en la lista.**
//
// Un cobro por transferencia o efectivo NO crea `Charge` — medido: `invoiceAdmin.ts` marca
// `paidAt` en la Invoice y no toca `Charge`. Una pantalla de Cobros que listara solo `Charge`
// escondería justo el dinero que el profesional marca a mano, que es el que más necesita repasar.
// Eso no es una pantalla incompleta: **es una pantalla que miente por omisión.**
//
// Se comprueba dos veces y por sitios distintos, porque se puede romper por los dos:
//   · en el SERVIDOR, que la consulta de facturas sin charge siga existiendo;
//   · en la PANTALLA, que un cobro sin método sobreviva a los filtros.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { entradasDeLaBarra, vistasDelRouter, AUSENCIAS_CONOCIDAS } from './_barra-lateral.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SERVICIO = fs.readFileSync(
  path.join(RAIZ, 'src/modules/billing/domain/cobros.service.ts'), 'utf8');

/** Un cobro con Charge (tarjeta) y uno marcado A MANO (sin charge, sin método). */
const COBROS = [
  {
    origen: 'charge', id: 1, fecha: '2026-08-01T10:00:00.000Z', cliente: 'Con pasarela',
    concepto: 'Reforma', importe: '100.00', moneda: 'EUR', metodo: 'card', estado: 'paid',
    referencia: null, numero: null, tipo: null, invoiceId: null, chargeId: 1,
  },
  {
    origen: 'invoice', id: 2, fecha: '2026-08-02T10:00:00.000Z', cliente: 'A mano',
    concepto: null, importe: '250.00', moneda: 'EUR', metodo: null, estado: 'paid',
    referencia: null, numero: 'J-20260802-AB12', tipo: null, invoiceId: 2, chargeId: null,
  },
  {
    origen: 'invoice', id: 3, fecha: '2026-07-01T10:00:00.000Z', cliente: 'Me debe',
    concepto: null, importe: '80.00', moneda: 'EUR', metodo: null, estado: 'pending',
    referencia: null, numero: 'F-2026-0007', tipo: null, invoiceId: 3, chargeId: null,
  },
];

const textos = (n) => todos(n).map((x) => x.textContent).filter(Boolean);
const botonesFiltro = (n) => todos(n)
  .filter((x) => x.tagName === 'BUTTON' && x.dataset && x.dataset.filtroCobro);

// ═══ SUELOS ═══════════════════════════════════════════════════════════════════════════════

test('SCRUM-285 · SUELO: la pantalla pinta y el escáner la ve', async () => {
  const banco = cargarDashboard(RAIZ, { datos: COBROS });
  const r = await pintarVista(banco, 'renderCobrosView');
  assert.equal(r.error, null, `🔴 la pantalla de Cobros revienta: ${r.error && r.error.message}`);
  assert.ok(r.nodos > 5,
    `🔴 ESCÁNER CIEGO: la vista pintó ${r.nodos} nodos. Una pantalla vacía y un escáner roto dan ` +
    'el mismo verde, y aquí lo vacío significaría «no le deben nada a nadie».');
  assert.ok(botonesFiltro(r.contenedor).length >= 5,
    '🔴 no se ven los filtros: si el detector no los encuentra, lo de abajo no mide nada.');
});

// ═══ ① EL POSITIVO QUE SEPARA ESTA PANTALLA DE LA QUE ESCONDE DINERO ═════════════════════

test('SCRUM-285 · ① un cobro por transferencia (SIN Charge) APARECE en la lista', async () => {
  const banco = cargarDashboard(RAIZ, { datos: COBROS });
  const r = await pintarVista(banco, 'renderCobrosView');
  const pintado = textos(r.contenedor).join(' | ');
  assert.match(pintado, /A mano/,
    '🔴 el cobro marcado A MANO no se pinta. Es el que no pasa por pasarela —transferencia y ' +
    'efectivo no crean `Charge`— y es justo el que el profesional necesita repasar. Una pantalla ' +
    'que lo esconde miente por omisión.');
  assert.match(pintado, /Con pasarela/, 'suelo: el de pasarela sí sale, así que el filtro no está vacío.');
});

test('SCRUM-285 · ① y NO desaparece al filtrar: tiene su propio cubo', async () => {
  // Sin cubo para «no consta», el cobro a mano se esconde en cuanto tocas cualquier filtro: la
  // misma mentira, colándose por otro sitio.
  const banco = cargarDashboard(RAIZ, { datos: COBROS });
  const r = await pintarVista(banco, 'renderCobrosView');
  const claves = botonesFiltro(r.contenedor).map((b) => b.dataset.filtroCobro);
  assert.ok(claves.includes('sin-metodo'),
    '🔴 no hay cubo para los cobros SIN método registrado. `Invoice` no guarda método —medido en ' +
    'el esquema— así que sin este cubo el dinero marcado a mano desaparece al filtrar.');
  assert.equal(banco.ctx.cuboDeMetodo(null), 'sin-metodo',
    '🔴 un cobro sin método no cae en su cubo: caería en «otro», que es inventarse el dato.');
});

test('SCRUM-285 · ① el SERVIDOR sigue leyendo LAS DOS poblaciones', () => {
  // El otro sitio por donde se rompe: que alguien «simplifique» el servicio a solo charges.
  assert.match(SERVICIO, /prisma\.charge\.findMany/,
    '🔴 el servicio ya no lee `Charge`: falta la mitad que sí pasa por pasarela.');
  assert.match(SERVICIO, /prisma\.invoice\.findMany/,
    '🔴 el servicio ya no lee `Invoice`: se ha quedado en la mitad que ESCONDE el dinero marcado ' +
    'a mano. Es exactamente el defecto que este ticket existe para no cometer.');
  assert.match(SERVICIO, /chargeId:\s*null/,
    '🔴 la consulta de facturas ya no filtra por `chargeId: null`: sin eso, las que sí tienen ' +
    'charge se cuentan DOS veces.');
});

// ═══ ② LA ENTRADA Y SU PANTALLA, EN EL MISMO SITIO ═══════════════════════════════════════

test('SCRUM-285 · ② la entrada `Cobros` lleva a una pantalla que existe y que ABRE', async () => {
  const barra = entradasDeLaBarra(path.join(RAIZ, 'public/dashboard/index.html'));
  const entrada = barra.entradas.find((e) => e.vista === 'cobros');
  assert.ok(entrada, '🔴 no hay entrada `Cobros` en la barra.');
  assert.equal(entrada.rotulo, 'Cobros',
    '🔴 el rótulo aprobado es «Cobros», literal del diseño §B1.');
  assert.equal(entrada.grupo, 'Venta',
    '🔴 `Cobros` va en VENTA: cierra el ciclo Presupuestos → Albaranes → Facturas → Cobros.');
  assert.ok(vistasDelRouter(path.join(RAIZ, 'public/dashboard/js/app.js')).has('cobros'),
    '🔴 la entrada existe y el router no conoce la vista: promesa rota.');

  // Y que ABRE, que es lo que el `case` no dice.
  const banco = cargarDashboard(RAIZ, { datos: COBROS });
  const r = await pintarVista(banco, 'renderCobrosView');
  assert.equal(r.error, null, '🔴 la entrada lleva a una pantalla que revienta al abrirse.');
});

test('SCRUM-285 · ② la declaración de AUSENCIA ha desaparecido', () => {
  assert.ok(!('cobros' in AUSENCIAS_CONOCIDAS),
    '🔴 `Cobros` sigue declarada como ausente y ya está construida. Un hueco declarado sobre algo ' +
    'que existe manda a la siguiente sesión a hacer trabajo hecho.');
});

// ═══ ③ LA DEUDA, y su fecha ══════════════════════════════════════════════════════════════

test('SCRUM-285 · ③ la antigüedad es de lo NO cobrado, y se mide desde que se pidió', () => {
  const banco = cargarDashboard(RAIZ, { datos: COBROS });
  const pendiente = COBROS[2];
  const cobrado = COBROS[1];
  const ahora = new Date('2026-07-31T10:00:00.000Z');
  assert.equal(banco.ctx.diasDeDeudaCobro(pendiente, ahora), 30,
    '🔴 la antigüedad de la deuda no sale de la fecha en que se pidió el cobro. Es la única ' +
    'fiable: `paidAt` y `updatedAt` son la fecha de REGISTRO, nunca la del ingreso (hallazgo E0).');
  assert.equal(banco.ctx.diasDeDeudaCobro(cobrado, ahora), null,
    '🔴 un cobro YA COBRADO no tiene antigüedad de deuda: no se debe nada.');
});

// ═══ ④ CONTROL NEGATIVO ══════════════════════════════════════════════════════════════════

test('SCRUM-285 · ④ NEGATIVO: un método conocido NO cae en el cubo de «no consta»', async () => {
  // Sin esto, el cubo podría tragárselo todo y el test ① pasaría por avería.
  const banco = cargarDashboard(RAIZ, { datos: COBROS });
  await pintarVista(banco, 'renderCobrosView');
  assert.equal(banco.ctx.cuboDeMetodo('card'), 'card');
  assert.equal(banco.ctx.cuboDeMetodo('transfer'), 'transfer');
  assert.equal(banco.ctx.cuboDeMetodo('cash'), 'cash');
});

test('SCRUM-285 · ④ los dos Bizum caen en UN filtro, y la fila conserva cuál es', async () => {
  // El diseño nombra cuatro métodos porque el profesional piensa en cuatro. `bizum_auto` y
  // `bizum_manual` es una distinción nuestra: filtrar por cuatro, leer los cinco.
  const banco = cargarDashboard(RAIZ, { datos: COBROS });
  const r = await pintarVista(banco, 'renderCobrosView');
  assert.equal(banco.ctx.cuboDeMetodo('bizum_auto'), 'bizum');
  assert.equal(banco.ctx.cuboDeMetodo('bizum_manual'), 'bizum');
  const claves = botonesFiltro(r.contenedor).map((b) => b.dataset.filtroCobro);
  assert.ok(!claves.includes('bizum_auto') && !claves.includes('bizum_manual'),
    '🔴 la barra de filtros expone la distinción interna: le añade al profesional un concepto ' +
    'que no tiene. Se lee en la fila, no se filtra por ella.');

  // 🔴 SCRUM-481 · Y LA SEGUNDA MITAD DEL TÍTULO, QUE HASTA HOY NO SE COMPROBABA. «La fila conserva
  // cuál es» era una promesa que este test no medía: comprobaba los cubos y los botones, y no lo
  // que la fila dice. Mientras tanto la columna pintaba el valor CRUDO, y con el arreglo a medias
  // habría pasado a decir «Bizum» dos veces sin que cayera nada. Se endurece: los dos rótulos de
  // fila tienen que existir y ser DISTINTOS (`paidVia.ts:17` — persona frente a webhook).
  const leidos = ['bizum_auto', 'bizum_manual'].map((v) => banco.ctx.rotuloDeMetodo(v));
  assert.deepEqual(leidos, ['Bizum · automático', 'Bizum · manual'],
    `🔴 la fila lee ${JSON.stringify(leidos)}: o no distingue los dos Bizum —y entonces la ` +
    'distinción de evidencia no se lee en ningún sitio— o usa una microcopy sin aprobar.');
});

// ═══ ⑤ MICROCOPY (regla 30) ══════════════════════════════════════════════════════════════

test('SCRUM-285 · ⑤ los rótulos son los APROBADOS, carácter a carácter', async () => {
  const banco = cargarDashboard(RAIZ, { datos: COBROS });
  const r = await pintarVista(banco, 'renderCobrosView');
  const rotulos = botonesFiltro(r.contenedor).map((b) => b.textContent);
  assert.deepEqual(rotulos,
    ['Todos', 'Bizum', 'tarjeta', 'transferencia', 'efectivo', 'Método no registrado'],
    '🔴 los filtros no dicen exactamente el texto aprobado (asesor, 10-ago-2026). Los cuatro ' +
    'métodos son literales del diseño §B4; «Todos» y «Método no registrado» los aprobó él.');
  assert.match(textos(r.contenedor).join(' | '), /(^|\| )Cobros( \||$)/,
    '🔴 el título de la pantalla no es «Cobros».');
});

test('SCRUM-285 · ⑤ «Método no registrado» y NO «Otro» — y la fila lo dice igual que la pestaña', async () => {
  // «Otro» AFIRMA que hubo un método distinto. Aquí no consta ninguno, y esa es exactamente la
  // distinción que obligó a crear el cubo: si el rótulo miente, el cubo deja de servir para nada.
  //
  // 🔸 SCRUM-481 (11-ago-2026) · ANTES ESTA FILA DECÍA «No registrado», que era un SEGUNDO nombre
  // para lo mismo: la pestaña de al lado ya decía «Método no registrado». Dos rótulos para el
  // mismo hecho en la misma pantalla, que es el defecto que 481 vino a quitar. La microcopy nueva
  // (asesor + fundador) unifica en el rótulo de la pestaña. **No se afloja la comprobación**: se
  // exige el literal EXACTO en vez de una subcadena, que es más estricto que antes.
  const banco = cargarDashboard(RAIZ, { datos: COBROS });
  const r = await pintarVista(banco, 'renderCobrosView');
  const todo = textos(r.contenedor).join(' | ');
  assert.ok(!/\bOtro\b/.test(todo),
    '🔴 la pantalla dice «Otro» en algún sitio. «Otro» afirma un método distinto; lo que pasa es ' +
    'que NO CONSTA ninguno.');
  const celdas = textos(r.contenedor).filter((t) => /registrado/i.test(t));
  assert.ok(celdas.length >= 2 && celdas.every((t) => t === 'Método no registrado'),
    `🔴 el cobro sin método no dice «Método no registrado» en su fila: ${JSON.stringify(celdas)}. ` +
    'Se esperan al menos dos apariciones —la pestaña y la fila— y todas con el MISMO texto: si la ' +
    'columna y el filtro vuelven a divergir, la pantalla vuelve a hablar dos idiomas.');
});

test('SCRUM-285 · ⑤ los días de deuda: DOS formas, y las dos con singular', async () => {
  // En tabla la columna ya se llama «Sin cobrar», así que la celda pone solo el número: repetir la
  // etiqueta en cada fila es ruido, y lo que se hace aquí es BARRER buscando el más viejo. Fuera de
  // la tabla no hay cabecera que lo explique, así que va la frase entera.
  const banco = cargarDashboard(RAIZ, { datos: COBROS });
  await pintarVista(banco, 'renderCobrosView');
  const C = banco.ctx.COBROS_COPY;
  assert.equal(C.diasEnTabla(30), '30 días');
  assert.equal(C.diasEnTabla(1), '1 día',
    '🔴 con un solo día, «1 días». Un plural mal puesto en la pantalla del dinero se lee como ' +
    'descuido, y aquí todo lo demás está medido.');
  assert.equal(C.diasSinCobrar(30), 'Sin cobrar desde hace 30 días');
  assert.equal(C.diasSinCobrar(1), 'Sin cobrar desde hace 1 día');
});

test('SCRUM-285 · ⑤ las dos frases están ATADAS: la larga contiene a la corta', async () => {
  // 🔴 Se pintan LAS DOS a la vez en la misma celda —una para la tabla, otra para la card— y dos
  // copias de un texto aprobado que pueden divergir son microcopy esperando a romperse: alguien
  // arregla el singular en una y la otra dice «1 días» justo donde de verdad se mira.
  //
  // Hoy no PUEDEN divergir, porque la larga se deriva de la corta. Este test existe para que el
  // día que alguien las separe se entere por un rojo y no por una captura.
  const vista = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/cobrosView.js'), 'utf8');
  assert.match(vista, /diasSinCobrar: function \(n\) \{ return '[^']*' \+ COBROS_COPY\.diasEnTabla\(n\); \}/,
    '🔴 la frase larga ha dejado de derivarse de la corta. Ahora son dos textos independientes y ' +
    'nada impide que digan cosas distintas: derívala otra vez, o ata las dos con un test propio.');
  const banco = cargarDashboard(RAIZ, { datos: COBROS });
  await pintarVista(banco, 'renderCobrosView');
  const C = banco.ctx.COBROS_COPY;
  for (const n of [1, 2, 30, 100]) {
    assert.ok(C.diasSinCobrar(n).endsWith(C.diasEnTabla(n)),
      `🔴 con n=${n} la frase larga no termina en la corta: «${C.diasSinCobrar(n)}» vs ` +
      `«${C.diasEnTabla(n)}». Han divergido.`);
  }
});

test('SCRUM-285 · ⑤ la celda pinta LAS DOS formas: la card es la pantalla, no una degradación', async () => {
  // A ≤640 px el `thead` desaparece y la tabla es una pila de cards. Este producto se usa desde una
  // furgoneta: un «3 días» sin cabecera que lo explique se queda SIN REFERENTE justo donde de
  // verdad se mira. El CSS elige cuál se ve; la vista pinta las dos.
  const banco = cargarDashboard(RAIZ, { datos: COBROS });
  const r = await pintarVista(banco, 'renderCobrosView');
  const celda = todos(r.contenedor).find((n) => n.className === 'cell-status' && n.hijos.length);
  assert.ok(celda, '🔴 ninguna celda de deuda tiene contenido: el cobro pendiente no pinta nada.');

  const corta = celda.hijos.find((h) => h.className === 'solo-tabla');
  const larga = celda.hijos.find((h) => h.className === 'solo-card');
  assert.ok(corta && larga,
    '🔴 la celda no pinta las dos formas. Sin `solo-card`, en la furgoneta se lee un número suelto ' +
    'sin nada que diga de qué son esos días.');
  assert.match(corta.textContent, /^\d+ días?$/, '🔴 en tabla va solo el número.');
  assert.match(larga.textContent, /^Sin cobrar desde hace \d+ días?$/,
    '🔴 en la card va la frase entera, que es la que el asesor aprobó para fuera de la tabla.');
  assert.ok(larga.textContent.endsWith(corta.textContent),
    '🔴 las dos frases pintadas en la MISMA celda no coinciden entre sí.');

  const cssCard = fs.readFileSync(path.join(RAIZ, 'public/dashboard/css/styles.css'), 'utf8');
  assert.match(cssCard, /\.solo-card \{ display: none; \}/,
    '🔴 sin la regla por defecto, en la TABLA se verían las dos frases a la vez.');
  assert.match(cssCard, /\.table--cards-mobile \.solo-tabla \{ display: none; \}/,
    '🔴 sin la regla de la card, en móvil se verían las dos.');
});

test('SCRUM-285 · ⑤ un cobro cobrado deja la celda VACÍA de verdad, sin spans', async () => {
  // Con un span vacío dentro, `td:empty` deja de aplicar y la celda ocuparía sitio en la card
  // hablando de una deuda que no existe.
  const banco = cargarDashboard(RAIZ, { datos: [COBROS[0], COBROS[1]] }); // los dos pagados
  const r = await pintarVista(banco, 'renderCobrosView');
  const celdas = todos(r.contenedor).filter((n) => n.className === 'cell-status');
  assert.equal(celdas.length, 2, 'suelo: una celda de deuda por fila.');
  for (const c of celdas) {
    assert.equal(c.hijos.length, 0, '🔴 la celda de un cobro cobrado lleva algo dentro.');
    assert.equal(c.textContent, '', '🔴 la celda de un cobro cobrado no está vacía.');
  }
});

test('SCRUM-285 · ⑤ las SEIS cabeceras son las aprobadas, y ninguna necesita una «y»', async () => {
  // La regla que trajo la sexta columna: **una cabecera que necesita una «y» son dos columnas**.
  // La quinta se llamaba «documento y deuda» y estaba diciendo sola que ahí cabían dos hechos.
  const banco = cargarDashboard(RAIZ, { datos: COBROS });
  const r = await pintarVista(banco, 'renderCobrosView');
  // ⚠️ `[...]` y no la referencia: el array vive en el contexto del banco (otro realm), y
  // `deepEqual` estricto compara prototipos. Sin copiarlo, el rojo sería del banco, no del código.
  const cabeceras = [...banco.ctx.COBROS_COPY.cabeceras];
  assert.deepEqual(cabeceras, ['Fecha', 'Cliente', 'Importe', 'Método', 'Documento', 'Sin cobrar'],
    '🔴 las cabeceras no son las seis aprobadas por el asesor el 10-ago-2026.');
  const conY = cabeceras.filter((h) => / y /i.test(h));
  assert.deepEqual(conY, [],
    '🔴 una cabecera con «y» son dos columnas metidas en una: ' + conY.join(', '));

  // Y que la tabla las PINTA, leídas del marcado que la vista escribió. No se cuentan los `<th>`
  // como nodos: el mini-DOM solo representa las etiquetas con `class`/`id`/`data-`, así que
  // contarlos mediría el banco. Se mira el marcado, que es lo que el navegador recibe.
  const thead = todos(r.contenedor).find((n) => n.tagName === 'THEAD');
  assert.ok(thead, 'suelo: la tabla no tiene cabecera.');
  for (const h of cabeceras) {
    assert.ok(thead.innerHTML.includes('>' + h + '<'),
      `🔴 la cabecera «${h}» está aprobada y la tabla no la pinta.`);
  }
  assert.equal((thead.innerHTML.match(/<th/g) || []).length, 6,
    '🔴 la tabla no pinta seis columnas.');
});

test('SCRUM-285 · ⑤ la celda de «Sin cobrar» va VACÍA si está cobrado, y sola si no', async () => {
  const banco = cargarDashboard(RAIZ, { datos: COBROS });
  const r = await pintarVista(banco, 'renderCobrosView');
  const celdas = todos(r.contenedor).filter((n) => n.className === 'cell-status');
  assert.equal(celdas.length, 3, 'suelo: una celda de deuda por fila.');
  // El texto vive en los dos `<span>` (tabla y card), así que se mira el contenido de la celda por
  // sus hijos y no por su `textContent`: el mini-DOM no concatena, y leerlo así daría siempre ''.
  const conTexto = celdas
    .map((c) => (c.hijos.find((h) => h.className === 'solo-tabla') || {}).textContent)
    .filter(Boolean);
  assert.equal(conTexto.length, 1,
    '🔴 de los tres cobros solo UNO está pendiente, así que solo uno pinta antigüedad. Los ' +
    'cobrados van VACÍOS: ni guion ni cero — y en la card `td:empty` los hace desaparecer, que es ' +
    'lo que se quiere: un cobro cobrado no ocupa sitio hablando de una deuda que no existe.');
  // ⚠️ La FORMA, no el número: la vista cuenta contra `new Date()`, así que fijar «30 días» sería
  // un test que se pone rojo mañana por el calendario. Lo que importa aquí es que sea la forma
  // CORTA de tabla —el número solo— y no la frase larga, que es de fuera de la tabla.
  assert.match(conTexto[0], /^\d+ días?$/,
    `🔴 la celda dice «${conTexto[0]}». En tabla va la forma corta: la columna ya se llama «Sin ` +
    'cobrar», y repetir la etiqueta en cada fila impide barrer la columna con la vista.');
});

test('SCRUM-285 · ⑤ un cobro YA COBRADO no pinta etiqueta de deuda: nada, ni guion ni cero', async () => {
  const banco = cargarDashboard(RAIZ, { datos: [COBROS[0], COBROS[1]] }); // los dos pagados
  const r = await pintarVista(banco, 'renderCobrosView');
  assert.ok(!/Sin cobrar desde hace/.test(textos(r.contenedor).join(' | ')),
    '🔴 se pinta antigüedad de deuda sobre cobros ya cobrados. No se debe nada: la etiqueta no va.');
});

// ═══ ⑥ LOS DOS ESTADOS VACÍOS — y confundirlos es el defecto ═════════════════════════════

test('SCRUM-285 · ⑥ SIN NINGÚN COBRO: «Todavía no hay cobros registrados.»', async () => {
  const banco = cargarDashboard(RAIZ, { datos: [] });
  const r = await pintarVista(banco, 'renderCobrosView');
  const vacio = todos(r.contenedor).find((n) => n.dataset && n.dataset.vacio);
  assert.ok(vacio, '🔴 no se pinta ningún estado vacío con la lista a cero.');
  assert.equal(vacio.dataset.vacio, 'sin-cobros');
  assert.equal(vacio.textContent, 'Todavía no hay cobros registrados.');
});

test('SCRUM-285 · ⑥ HAY COBROS PERO EL FILTRO LOS ESCONDE: es OTRO texto', async () => {
  // 🔴 EL DEFECTO QUE ESTE PAR EVITA: decir «no hay cobros» cuando lo que pasa es que el propio
  // profesional ha filtrado. En la pantalla del dinero eso no es un texto impreciso — le contesta
  // «no te deben nada» a la pregunta que vino a hacer.
  const banco = cargarDashboard(RAIZ, { datos: COBROS }); // hay tres, ninguno con tarjeta… salvo uno
  const r = await pintarVista(banco, 'renderCobrosView');
  const botonCash = botonesFiltro(r.contenedor).find((b) => b.dataset.filtroCobro === 'cash');
  assert.ok(botonCash, 'suelo: sin el filtro de efectivo no se puede provocar el caso.');
  botonCash.dispararClick();

  const vacio = todos(r.contenedor).find((n) => n.dataset && n.dataset.vacio);
  assert.ok(vacio, '🔴 con el filtro puesto y cero resultados no se pinta nada.');
  assert.equal(vacio.dataset.vacio, 'filtro',
    '🔴 con cobros en la lista y un filtro que no casa, la pantalla dice «no hay cobros». Eso le ' +
    'afirma al profesional que no le deben nada, y es falso: los ha escondido su propio filtro.');
  assert.equal(vacio.textContent, 'Ningún cobro coincide con este filtro.');
});
