// SCRUM-318 (G3) · EL CONTENIDO DEL RAIL DEL TRABAJO.
//
// Sin gate: los constructores son PUROS y se importan directamente; el render y el CSS se leen por
// texto. Ni BD, ni red, ni navegador.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL BLOQUE ESTRELLA DEL TICKET NO SE PINTA, Y ESO ES LA MEDICIÓN
//
// «DÓNDE» con su enlace a mapa era la ventaja que ningún facturador tiene: la dirección de la
// OBRA, no la fiscal del cliente. **No hay dato.** Medido dos veces:
//
//   · `Job.direccion` es campo propio y **nadie lo escribe** — en todo `src/` no hay un solo
//     create/update que lo rellene; la única aparición fuera de un `select` es una lectura.
//   · El modelo `Customer` **no tiene dirección**: ni `address`, ni `city`, ni `postal`.
//
// Así que la trampa de «rellénalo con la del cliente» es doblemente imposible: ni sería la de la
// obra, ni existe. Sin dato no hay bloque y no hay enlace — **un enlace a mapa que lleva al sitio
// equivocado es peor que no tenerlo, porque el que no existe no se sigue.**
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { soloEjecutable } from './_guard-texto.mjs';
// SCRUM-262: los teléfonos de los datos de prueba van en el RANGO IMPOSIBLE (`340…`). Un móvil
// español empieza por 6 o 7, así que `34600000000` —lo primero que escribí— puede ser de alguien
// de verdad. Se deriva del helper, no se inventa un literal parecido.
import { telefonoDePrueba } from '../scripts/_telefonos-prueba.mjs';
// SCRUM-917e · la parte del contrato que se mudó a la franja se mide sobre el DOM montado.
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const require_ = createRequire(import.meta.url);
const leer = (p) => fs.readFileSync(path.join(RAIZ, p), 'utf8');

const VISTA = soloEjecutable(leer('public/dashboard/js/jobDetailView.js'), { almohadillaEsComentario: false });
const CSS = leer('public/dashboard/css/styles.css');
const BLOQUES = require_(path.join(RAIZ, 'public/dashboard/js/jobRailBlocks.js'));
const REGISTRO = require_(path.join(RAIZ, 'public/dashboard/js/jobActionsRegistry.js'));

const TEL = telefonoDePrueba(1);                       // 34000000001
// Cómo lo teclearía un pro: mismos dígitos, con espacios. Una sola fuente para los dos.
const TEL_ESPACIADO = TEL.replace(/^(\d{2})(\d{3})(\d{3})(\d{3})$/, '$1 $2 $3 $4');
// Suelo del propio fixture: si el formateo no casara, `TEL_ESPACIADO` sería igual que `TEL` y el
// test de normalización pasaría sin normalizar nada.
if (TEL_ESPACIADO === TEL) throw new Error('fixture roto: el teléfono espaciado salió sin espacios');

const fmt = (n, cur) => `${Number(n).toFixed(2)} ${cur || 'EUR'}`;
const fechaCorta = () => '24 jun';

/** Un Trabajo COMPLETO: el control positivo del que salen los cinco bloques menos DÓNDE. */
const trabajoLleno = () => ({
  id: 7,
  direccion: null, // como en producción: nadie la escribe
  customer: { name: 'Francisco Jiménez', phone: TEL },
  totalAceptado: 853.05, totalCobrado: 400,
  quote: { id: 2, number: 2, total: 853.05, currency: 'EUR' },
  createdAt: '2026-06-24T10:00:00.000Z',
});

const ctx = { fmtMoney: fmt, fechaCorta, responsableName: 'Fontanería Torres' };
const construir = (job, c) => BLOQUES.construirBloquesRail(job, { ...ctx, ...(c || {}) }).filter(Boolean);

// ── EL DOM MONTADO, para la parte del contrato que desde SCRUM-917e vive en la FRANJA ─────
// Es el mismo banco que usa `scrum817`: fake DOM, sin red y sin navegador, así que el fichero
// sigue sin gate. Se monta porque el principio de este ticket ya no se puede leer en un
// constructor puro: la franja la pinta la vista.
const JOB_FRANJA = {
  id: 7, status: 'en_curso', createdAt: '2026-09-01T09:00:00Z', titulo: 'Revisión anual',
  customer: { id: 3, name: 'Francisco Jiménez' }, asignados: [], operario: null,
  albaranes: [], gastos: [], notes: '', quote: { currency: 'EUR' }, direccion: null, invoices: [],
};

async function montarDetalle(job) {
  const banco = cargarDashboard(RAIZ);
  banco.ctx.apiRequest = async (u) => {
    if (/\/admin\/team/.test(u)) return [];
    if (/\/admin\/merchant/.test(u)) return { name: 'Epipe' };
    if (/\/admin\/partes/.test(u)) return { partes: [] };
    if (/gastos/.test(u)) return [];
    return job;
  };
  banco.ctx.appUserRole = 'admin';
  const r = await pintarVista(banco, 'renderJobDetailView');
  assert.equal(r.error, null, `🔴 SUELO: la vista no monta (${r.error && r.error.message}). «No está» y «no se pintó nada» son el mismo verde.`);
  return r;
}

const conClase = (r, clase) => todos(r.contenedor).filter((n) => String(n.className || '').split(/\s+/).includes(clase));

/** Los rótulos DERIVADOS de la franja: «Te falta por cobrar» / «Cobrado del todo». */
const rotulosDeLaFranja = (r) => conClase(r, 'detail-dinero__rotulo').map((n) => String(n.textContent || '').trim());

/**
 * Los datos MEDIDOS de la franja, como pares [etiqueta, cifra].
 * 🔴 La cifra se queda en dígitos y coma A PROPÓSITO: `Intl.NumberFormat` mete un espacio fino
 * inseparable (U+202F) delante del €, y comparar contra un literal tecleado a mano da «0
 * apariciones» de algo que está en pantalla (trampa medida en el PASO 0 de SCRUM-917).
 */
function cifrasDeLosLados(r) {
  return conClase(r, 'detail-dinero__lado').map((lado) => {
    const partes = lado.hijos.map((h) => String(h.textContent || '').trim()).filter(Boolean);
    return [partes[0] || '', (partes[partes.length - 1] || '').replace(/[^\d,]/g, '')];
  });
}

test('SCRUM-318 · SUELO: el derivador encuentra bloques y los cinco ids están declarados', () => {
  const bloques = construir(trabajoLleno());
  assert.ok(
    bloques.length > 0,
    '🔴 ESCÁNER CIEGO: con un Trabajo COMPLETO no sale ni un bloque. Todos los tests de «no se ' +
      'pinta vacío» de abajo pasarían por vacío, que es el verde que significa lo contrario de lo ' +
      'que parece.',
  );
  // Los ids que produce el contenido (G3) tienen que ser los que declaró la estructura (G1). Si
  // divergen, hay un bloque construido que la rejilla no conoce, o un hueco declarado sin quien lo
  // llene — y las dos cosas se ven igual en pantalla: nada.
  const declarados = REGISTRO.JOB_RAIL_BLOQUES;
  const construibles = ['cliente', 'donde', 'dinero', 'presupuesto', 'responsable'];
  assert.deepEqual(
    [...construibles].sort(), [...declarados].sort(),
    '🔴 los bloques que G3 construye no son los que G1 declaró.',
  );
  for (const b of bloques) assert.ok(declarados.includes(b.id), `🔴 el bloque «${b.id}» no está declarado en la estructura`);
});

// ── LA REGLA DEL HUECO ──────────────────────────────────────────────────────────────────

test('SCRUM-318 · NINGÚN bloque se pinta vacío: sin dato, no hay bloque', () => {
  // Un Trabajo pelado: sin cliente, sin dinero, sin presupuesto, sin responsable.
  const pelado = { id: 1, direccion: null, customer: null, totalAceptado: 0, totalCobrado: 0, quote: null };
  const bloques = BLOQUES.construirBloquesRail(pelado, { fmtMoney: fmt, fechaCorta, responsableName: null });
  assert.deepEqual(
    bloques.filter(Boolean), [],
    '🔴 un Trabajo sin ningún dato produce bloques. La regla del hueco es: o está el dato, o no ' +
      'está el bloque. Nada de «—», ni «Sin datos», ni un título con el cuerpo vacío.',
  );

  // Y por línea, no solo por bloque: sin teléfono, el bloque CLIENTE existe pero SIN línea de
  // teléfono. Un «Teléfono: —» es peor que la ausencia: ocupa sitio para decir que no sabe.
  const sinTel = BLOQUES.bloqueCliente({ customer: { name: 'Ana', phone: null } });
  assert.ok(sinTel, '🔴 con nombre y sin teléfono debería haber bloque CLIENTE');
  assert.equal(sinTel.lineas.length, 1, '🔴 se pintó una línea de teléfono sin teléfono');
  assert.ok(!sinTel.lineas.some((l) => l.href), '🔴 hay un enlace en un bloque sin teléfono');
});

// ── EL ENLACE A MAPA ────────────────────────────────────────────────────────────────────

test('SCRUM-318 · CONTROL NEGATIVO: sin dirección no hay bloque DÓNDE ni enlace a mapa', () => {
  for (const direccion of [null, undefined, '', '   ']) {
    const b = BLOQUES.bloqueDonde({ direccion });
    assert.equal(
      b, null,
      `🔴 con direccion=${JSON.stringify(direccion)} se construye el bloque DÓNDE. Un enlace a ` +
        'mapa vacío abre el mapa en ninguna parte y parece un fallo del móvil, no nuestro.',
    );
  }
  // Y en la vista real, con el Trabajo tal y como llega hoy de producción.
  const ids = construir(trabajoLleno()).map((b) => b.id);
  assert.ok(
    !ids.includes('donde'),
    '🔴 el bloque DÓNDE aparece con `Job.direccion` a null. O alguien lo rellenó con la dirección ' +
      'del cliente —que ni existe en el modelo ni sería la de la obra—, o se pintó vacío.',
  );
});

test('SCRUM-318 · el href del mapa se construye con el MISMO dato que se pinta', () => {
  // El día que alguien escriba `Job.direccion`, el bloque aparece solo. Esto prueba que cuando
  // aparezca, lo que se lee y adonde se conduce serán lo mismo.
  const direccion = 'Av. Rey Juan Carlos 145, 28919 Leganés (Madrid)';
  const b = BLOQUES.bloqueDonde({ direccion });
  assert.ok(b, '🔴 ESCÁNER CIEGO: con dirección de verdad tampoco sale el bloque — entonces el ' +
    'control negativo de arriba pasaba porque este constructor no funciona, no porque no haya dato.');

  const pintado = b.lineas.map((l) => l.texto).join(' ');
  assert.equal(pintado, direccion, '🔴 lo que se pinta no es la dirección');
  assert.equal(
    b.enlace.href, `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pintado)}`,
    '🔴 el `href` del mapa NO sale del texto que se pinta. Si un día divergen, el usuario lee una ' +
      'cosa y conduce a otra — y no se entera hasta llegar.',
  );
  assert.equal(b.enlace.desde, pintado, '🔴 el bloque declara otro origen del que usa');

  // Control de que el enlace se rompería si alguien lo armara de otra fuente.
  assert.ok(
    !b.enlace.href.includes('undefined') && !b.enlace.href.endsWith('query='),
    '🔴 el href queda vacío o con `undefined`',
  );
});

// ── LOS CUATRO QUE SÍ TIENEN DATO ───────────────────────────────────────────────────────

test('SCRUM-318 · CLIENTE: el teléfono es PULSABLE, y `tel:` y WhatsApp salen del mismo número', () => {
  const b = BLOQUES.bloqueCliente({ customer: { name: 'Francisco Jiménez', phone: TEL_ESPACIADO } });
  const tel = b.lineas.find((l) => String(l.href || '').startsWith('tel:'));
  const wa = b.lineas.find((l) => String(l.href || '').includes('wa.me'));
  assert.ok(tel, '🔴 el teléfono no es pulsable. Como texto plano es un número que hay que copiar ' +
    'a mano con las manos sucias; pulsable es una llamada.');
  assert.ok(wa, '🔴 falta el enlace de WhatsApp');
  assert.equal(tel.href, `tel:${TEL}`, '🔴 el `tel:` no normaliza los espacios');
  assert.equal(wa.href, `https://wa.me/${TEL}`, '🔴 WhatsApp usa un número distinto que `tel:`');
  assert.equal(tel.texto, TEL_ESPACIADO, '🔴 se pinta el número normalizado en vez del que guardó el pro');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 RE-ANCLADO EN SCRUM-917e (corte D), 20-sep-2026. EL PRINCIPIO NO SE TOCA; SE MUDA.
//
// QUÉ SUPERFICIE DESAPARECIÓ: el bloque DINERO del rail ya no lleva «Cobrado» ni «Pendiente».
// Los trajo este ticket cuando el cuerpo sólo tenía el titular «Total aceptado»; desde que el
// cuerpo tiene la franja del dinero, esta columna repetía dos de sus tres cifras — medido en el
// PASO 0: «590,00 €» se leía SIETE veces en la misma pantalla.
//
// QUÉ PRINCIPIO SOBREVIVE: **sin importe de referencia no se afirma NADA del dinero.** Es la
// regla de SCRUM-363, y lo que este test protegía no era la palabra «Pendiente»: era que la
// pantalla dijera lo MEDIDO (lo cobrado) y callara lo DERIVADO cuando no hay eje.
//
// DÓNDE VIVE AHORA: en la franja (`.detail-dinero`, `jobDetailView.js`). Y al mudarlo se vio que
// la franja LO ROMPÍA: medido hoy, con `totalAceptado: 0` y 300 € cobrados pintaba «Cobrado del
// todo · 0,00 €» justo encima de «Cobrado 300,00 €». Un contrato que se borra porque su
// superficie desapareció es una decisión perdida; éste, re-anclado, acaba de cazar el defecto que
// el corte D había metido. Arreglado en el mismo cambio: el eje manda sobre el FOCO (lo derivado),
// no sobre los lados (lo medido).
test('SCRUM-318 · DINERO: el rail ya no repite el dinero, y la FRANJA no afirma sin eje', async () => {
  // ── a) el rail: la columna no vuelve a traerse las cifras de la franja ──────────────────
  const conJustificante = BLOQUES.bloqueDinero(
    { totalAceptado: 853.05, totalCobrado: 400, invoices: [{ id: 9, number: 'J-1', status: 'paid' }] }, fmt,
  );
  assert.ok(conJustificante, '🔴 SUELO: el bloque DINERO no sale ni con un justificante — lo de abajo no mediría nada.');
  assert.deepEqual(
    conJustificante.lineas.filter((l) => l.etiqueta).map((l) => l.etiqueta), [],
    '🔴 EL RAIL HA VUELTO A PINTAR IMPORTES. «Cobrado», «Pendiente» o «Aceptado» aquí son la ' +
      'misma verdad dicha dos veces: ya están en la franja del cuerpo, a cuatro centímetros.',
  );
  assert.equal(BLOQUES.bloqueDinero({ totalAceptado: 853.05, totalCobrado: 400 }, fmt), null,
    '🔴 el bloque DINERO se pinta sin ningún justificante: un título con el cuerpo vacío.');

  // ── b) la franja, que es donde el principio vive ahora. Sobre el DOM MONTADO ────────────
  const sinEje = await montarDetalle({ ...JOB_FRANJA, totalAceptado: 0, totalCobrado: 300 });
  assert.deepEqual(
    rotulosDeLaFranja(sinEje), [],
    '🔴 LA FRANJA AFIRMA ALGO DEL DINERO SIN EJE CONTRA EL QUE MEDIRLO. Con `totalAceptado` 0 y ' +
      '300 € cobrados no hay «Te falta por cobrar» ni «Cobrado del todo» que sostener: el primero ' +
      'es falso y el segundo se lee encima de un «Cobrado 300,00 €» que lo contradice. Es el ' +
      'mismo defecto que SCRUM-363 quitó del chip de cobro, reintroducido en la franja.',
  );
  // Lo MEDIDO sí se dice: el principio calla lo derivado, no esconde los datos.
  assert.deepEqual(
    cifrasDeLosLados(sinEje), [['Aceptado', '0,00'], ['Cobrado', '300,00']],
    '🔴 al callar lo derivado se han perdido los dos datos medidos. El rail sí los decía.',
  );

  // ── c) CONTROL POSITIVO: con eje, la franja sigue afirmando exactamente lo de siempre ───
  const conEje = await montarDetalle({ ...JOB_FRANJA, totalAceptado: 853.05, totalCobrado: 400 });
  assert.deepEqual(
    rotulosDeLaFranja(conEje), ['Te falta por cobrar'],
    '🔴 con importe de referencia la franja ha dejado de decir lo que falta: el arreglo del caso ' +
      'sin eje se ha llevado por delante el caso normal, que es el de todos los días.',
  );
  assert.deepEqual(cifrasDeLosLados(conEje), [['Aceptado', '853,05'], ['Cobrado', '400,00']]);
});

test('SCRUM-318 · PRESUPUESTO y RESPONSABLE: existen con dato y desaparecen sin él', () => {
  const p = BLOQUES.bloquePresupuesto({ quote: { id: 2, number: 2 }, createdAt: '2026-06-24' }, fechaCorta);
  assert.equal(p.lineas[0].texto, '#2 · 24 jun');
  assert.equal(p.lineas[0].quoteId, 2, '🔴 el enlace del presupuesto no lleva su id');
  assert.equal(BLOQUES.bloquePresupuesto({ quote: null }, fechaCorta), null, '🔴 bloque PRESUPUESTO sin presupuesto');

  assert.ok(BLOQUES.bloqueResponsable('Fontanería Torres'));
  assert.equal(BLOQUES.bloqueResponsable(''), null, '🔴 bloque RESPONSABLE vacío');
  assert.equal(BLOQUES.bloqueResponsable(null), null, '🔴 bloque RESPONSABLE nulo');
});

// ── EL RAIL NO EDITA ────────────────────────────────────────────────────────────────────

test('SCRUM-318 · el rail es de SOLO LECTURA: ningún control suyo escribe', () => {
  // El rail es contexto de SOLO LECTURA en el patrón B2. Aquí es donde más tienta romperlo: «ya que está el teléfono, que se
  // pueda cambiar». Se mira el CUERPO de `pintarBloqueRail`, que es lo único que crea el rail.
  const i = VISTA.indexOf('function pintarBloqueRail');
  const j = VISTA.indexOf('\nfunction ', i + 1);
  assert.ok(i >= 0 && j > i, '🔴 ESCÁNER CIEGO: no se encuentra `pintarBloqueRail` — el guard ' +
    'estaría midiendo un trozo de fichero que no es el rail. ¿Se renombró?');
  const cuerpo = VISTA.slice(i, j);

  for (const prohibido of ["createElement('input')", "createElement('select')", "createElement('textarea')", "createElement('button')"]) {
    assert.ok(
      !cuerpo.includes(prohibido),
      `🔴 el rail crea un \`${prohibido}\`: es contexto de SOLO LECTURA en el patrón B2.`,
    );
  }
  for (const escritura of ['apiRequest(', "method: 'POST'", "method: 'PATCH'", "method: 'PUT'", "method: 'DELETE'"]) {
    assert.ok(
      !cuerpo.includes(escritura),
      `🔴 el rail contiene \`${escritura}\`: escribe. La columna derecha no escribe nunca.`,
    );
  }
  // Suelo: que el recorte sea el de verdad y no una cadena vacía que hace pasar todo lo de arriba.
  assert.ok(
    cuerpo.includes('detail-rail-bloque') && cuerpo.length > 400,
    `🔴 ESCÁNER CIEGO: el cuerpo recortado mide ${cuerpo.length} caracteres y no menciona el ` +
      'bloque del rail. Un recorte vacío hace pasar TODAS las prohibiciones de arriba.',
  );
});

// ── MÓVIL: EL CASO DE USO REAL ──────────────────────────────────────────────────────────

test('SCRUM-318 · en móvil el rail va ARRIBA, no debajo de la pila de documentos', () => {
  // Si en móvil vuelve a quedar debajo, esta tarea no ha arreglado nada: el defecto era
  // exactamente que cliente y dirección estaban al final de una lista que crece con el trabajo.
  const m = CSS.match(/@media \(max-width: 720px\) \{[\s\S]*?\n\}/);
  assert.ok(m, '🔴 ESCÁNER CIEGO: no hay media query de móvil para el rail');
  const movil = m[0];
  assert.ok(
    /\.detail-rail\s*\{[^}]*order:\s*-1/.test(movil),
    '🔴 el rail NO se adelanta en móvil (`order:-1`). Debajo del cuerpo vuelve a quedar detrás de ' +
      'la pila de documentos — que es el defecto que este ticket corrige, y el móvil es el caso de ' +
      'uso real: el pro abre esta pantalla yendo a la obra.',
  );
  assert.ok(
    /grid-template-columns:\s*1fr/.test(movil),
    '🔴 en móvil siguen siendo dos columnas: 220 px al lado del cuerpo deja las dos ilegibles.',
  );
});

test('SCRUM-318 · la vista pinta el rail desde los constructores, no a mano', () => {
  assert.ok(
    /construirBloquesRail\(job, \{/.test(VISTA),
    '🔴 la vista ya no llama a los constructores: habría vuelto a decidir por su cuenta qué bloque ' +
      'tiene dato, y esa decisión es la que este guard puede probar sin navegador.',
  );
  assert.ok(
    /\.filter\(Boolean\)/.test(VISTA),
    '🔴 no se filtran los bloques nulos: se pintarían los que el constructor dio por vacíos.',
  );
  // Y que el script esté cargado y precacheado — si no, `construirBloquesRail` no existe en el
  // navegador y el rail desaparece entero sin un solo error visible.
  assert.ok(
    leer('public/dashboard/index.html').includes('./js/jobRailBlocks.js'),
    '🔴 `jobRailBlocks.js` no se carga en el dashboard',
  );
  assert.ok(
    leer('public/sw.js').includes('/dashboard/js/jobRailBlocks.js'),
    '🔴 `jobRailBlocks.js` no está en el SHELL del service worker (addAll es atómico)',
  );
});
