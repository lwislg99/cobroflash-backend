// tests/scrum651-trabajo-sin-presupuesto.test.mjs — SCRUM-651 (T2)
//
// SE PUEDE CREAR UN TRABAJO SIN PRESUPUESTO, Y ES UN TRABAJO DE PRIMERA CLASE.
//
// ── LO MEDIDO EN EL PASO 0, que es lo que da forma a este fichero ─────────────────────────
//   · `Job.quoteId` YA era `Int?`, e `Invoice` ni siquiera tiene `jobId`. **La exigencia del
//     presupuesto no estaba en el esquema: estaba DE HECHO** — el único creador de Trabajos era
//     `ensureJobForQuote`, que arranca en `quote → accepted`. No había `POST /jobs`.
//   · El camino de LECTURA ya contemplaba el Trabajo sin presupuesto (SCRUM-51 lo nombra,
//     SCRUM-363 construyó el eje que puede faltar). Lo que faltaba era la puerta de ESCRITURA.
//
// ── 🔴 LO QUE ESTE TRABAJO NO TIENE, Y NO SE FINGE ────────────────────────────────────────
// Un Trabajo sin presupuesto **no tiene la red de seguridad de los demás**. El contraste
// «presupuestaste 10 m, llevas 7, quedan 3» NO PUEDE EXISTIR: no hay contra qué contrastar. Y con
// él se caen «te has pasado del presupuesto», el importe pendiente, el plan de tramos y el
// semáforo de cobro. La pantalla NO debe fingir que sí, y por eso aquí se prueba tanto lo que
// aparece como **lo que tiene que estar AUSENTE**.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { soloEjecutable } from './_guard-texto.mjs';
import { datosDeTrabajoDirecto, filaDeTrabajoDirecto } from '../dist/modules/jobs/domain/trabajoDirecto.js';
import { estadoCobroFor, importeDeReferencia } from '../dist/modules/jobs/domain/job.service.js';

const RAIZ = path.resolve(import.meta.dirname, '..');
const RUTAS = 'src/modules/jobs/app/routes/jobs.routes.ts';
const SERVICIO = 'src/modules/jobs/domain/job.service.ts';
const DETALLE = 'public/dashboard/js/jobDetailView.js';

const leer = (p) => {
  try {
    return fs.readFileSync(path.join(RAIZ, p), 'utf8');
  } catch (e) {
    assert.fail(`🔴 no se pudo leer ${p} (${e && e.code ? e.code : e}). «No está» y «no supe mirar» son el mismo verde.`);
  }
};

/** Las rutas declaradas en un fichero de Express, por AST: `router.<método>('<ruta>'`. */
function rutasDe(fichero) {
  const sf = ts.createSourceFile('r.ts', leer(fichero), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const rutas = [];
  (function anda(n) {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
      && n.expression.expression.getText(sf) === 'router'
      && n.arguments.length && ts.isStringLiteral(n.arguments[0])) {
      rutas.push(`${n.expression.name.getText(sf).toUpperCase()} ${n.arguments[0].text}`);
    }
    ts.forEachChild(n, anda);
  })(sf);
  return rutas;
}

// ── 1 · SUELO DE CEGUERA, PRIMERO ─────────────────────────────────────────────────────────

test('SCRUM-651 · 🔴 SUELO: si no se encuentra el camino del PRESUPUESTO, esto se declara ciego', () => {
  // Todo lo de abajo compara el camino nuevo contra el viejo. Si el instrumento no encuentra el
  // viejo, «no he roto nada» significaría «no supe mirar» — y ese verde es el más caro de todos,
  // porque lo que se estaría afirmando sin mirar es que el camino de siempre sigue entero.
  const servicio = soloEjecutable(leer(SERVICIO));
  assert.match(servicio, /prismaClient\.job\.create\(/,
    '🔴 EL INSTRUMENTO NO ENCUENTRA LA CREACIÓN DESDE PRESUPUESTO. Sin ella no se puede afirmar '
    + 'que el camino de siempre siga en pie: lo que sigue mediría otra cosa.');
  assert.match(servicio, /quoteId: quote\.id/,
    '🔴 no se encuentra el emparejamiento Trabajo↔presupuesto: el control positivo no vale.');

  const rutas = rutasDe(RUTAS);
  assert.ok(rutas.length > 5,
    `🔴 el lector de rutas por AST solo ha encontrado ${rutas.length}: está ciego, y «no hay POST /» `
    + 'sería indistinguible de «no supe leer el fichero».');
});

// ── 2 · CONTROL POSITIVO: el camino DESDE PRESUPUESTO, ENUMERADO ──────────────────────────

test('SCRUM-651 · 🔴 CONTROL POSITIVO: el Trabajo que nace de un presupuesto sigue igual que hoy', () => {
  // Añadir un camino y romper el viejo da el mismo verde en los tests del camino nuevo. Por eso
  // esto no dice «sigue funcionando»: enumera QUÉ tiene que seguir escribiendo, campo a campo.
  const servicio = soloEjecutable(leer(SERVICIO));
  for (const [campo, patron, porque] of [
    ['quoteId', /quoteId: quote\.id/, 'sin él, el Trabajo deja de saber de qué presupuesto viene'],
    ['totalAceptado', /totalAceptado: quote\.total/, 'es el EJE contra el que su cobro significa algo'],
    ['operarioId', /operarioId: quote\.teamMemberId/, 'es la autoría congelada en el accept (SCRUM-52)'],
    ['customerId', /customerId: quote\.customerId/, 'el Trabajo es de un cliente, y sale del presupuesto'],
  ]) {
    assert.match(servicio, patron,
      `🔴 EL CAMINO DE SIEMPRE HA PERDIDO \`${campo}\`: ${porque}.\n\n`
      + '  Este ticket AÑADE una puerta; no toca la que ya había. Romper la vieja daría igualmente\n'
      + '  verde en los tests de la nueva, y por eso el camino viejo se enumera aquí.');
  }
  // Y el sentido nuevo de la pertenencia (SCRUM-195) sigue anotándose.
  assert.match(servicio, /quote\.update\(\{ where: \{ id: quote\.id \}, data: \{ jobId: job\.id \} \}\)/,
    '🔴 el Trabajo ya no anota la pertenencia en `Quote.jobId`: vuelve el Trabajo duplicado de SCRUM-195.');
});

test('SCRUM-651 · CONTROL POSITIVO: con presupuesto, el titular del dinero SE SIGUE PINTANDO', () => {
  // La guarda nueva del detalle no puede apagar el caso de siempre. Mira `!= null`, no `> 0`: un
  // presupuesto aceptado por 0 € es raro, pero es un dato que CONSTA y se sigue enseñando.
  const detalle = soloEjecutable(leer(DETALLE));
  assert.match(detalle, /if \(job\.totalAceptado != null\) \{/,
    '🔴 la guarda del titular ya no es `!= null`. Con `> 0` se ocultaría también un presupuesto '
    + 'aceptado por 0 € —un dato que existe— y eso sí cambia el camino de siempre.');
});

// ── 3 · LA PUERTA NUEVA ───────────────────────────────────────────────────────────────────

test('SCRUM-651 · 🔴 existe la puerta: `POST /` crea un Trabajo sin presupuesto', () => {
  const rutas = rutasDe(RUTAS);
  assert.ok(rutas.includes('POST /'),
    `🔴 NO HAY \`POST /\` EN LOS TRABAJOS. Rutas encontradas: ${JSON.stringify(rutas.slice(0, 12))}.\n\n`
    + '  Sin ella, el único creador vuelve a ser el accept de un presupuesto: una AVERÍA —el caso\n'
    + '  más frecuente del primer cliente real— no cabe en el producto, y el parte no tiene dónde\n'
    + '  colgarse. Es la condición de cierre entera del ticket.');
});

test('SCRUM-651 · el cliente es obligatorio, y es lo ÚNICO obligatorio', () => {
  for (const malo of [undefined, null, {}, { customerId: 0 }, { customerId: -3 }, { customerId: 'a' }, { customerId: 1.5 }]) {
    const r = datosDeTrabajoDirecto(malo);
    assert.equal(r.ok, false, `🔴 se acepta un Trabajo sin cliente (${JSON.stringify(malo)}): no sería de nadie.`);
    assert.equal(r.error, 'customer_required');
  }
  // Y con SOLO el cliente ya se puede abrir: en una urgencia se teclea lo justo y se completa luego.
  const r = datosDeTrabajoDirecto({ customerId: 7 });
  assert.equal(r.ok, true,
    '🔴 se exige algo más que el cliente. En una avería el pro escribe lo mínimo y sigue; la '
    + 'dirección y la descripción se añaden después con el PATCH que ya existe.');
  assert.deepEqual(r.datos, { customerId: 7, direccion: null, descripcion: null, titulo: null });
});

test('SCRUM-651 · 🔴 por esta puerta NO entra un `quoteId`', () => {
  // Dejarlo entrar abriría un SEGUNDO escritor del emparejamiento Trabajo↔presupuesto, en
  // paralelo a `ensureJobForQuote`, que mantiene los dos sentidos (SCRUM-195). Dos escritores para
  // el mismo hecho discrepan, y aquí discrepar es un Trabajo duplicado con el dinero repartido.
  for (const cuerpo of [{ customerId: 7, quoteId: 3 }, { customerId: 7, quote_id: 3 }]) {
    const r = datosDeTrabajoDirecto(cuerpo);
    assert.equal(r.ok, false, `🔴 se ha aceptado un \`quoteId\` (${JSON.stringify(cuerpo)}) por la puerta del Trabajo directo.`);
    assert.equal(r.error, 'quote_id_no_admitido');
  }
});

test('SCRUM-651 · los textos se recortan, y vacío es `null` (un solo estado para «sin dato»)', () => {
  const r = datosDeTrabajoDirecto({ customerId: 7, direccion: '  Calle Mayor 3  ', descripcion: '   ', titulo: '' });
  assert.equal(r.datos.direccion, 'Calle Mayor 3');
  assert.equal(r.datos.descripcion, null, '🔴 una descripción en blanco tiene que ser `null`, no `""`.');
  assert.equal(r.datos.titulo, null, '🔴 un título vacío tiene que ser `null`: si no, «sin nombre» son dos estados.');
});

// ── 4 · CONTROL NEGATIVO: LO QUE DEPENDE DEL PRESUPUESTO NO SE PINTA ──────────────────────

test('SCRUM-651 · 🔴 CONTROL NEGATIVO: el Trabajo directo NACE SIN `totalAceptado`. Ni cero.', () => {
  const fila = filaDeTrabajoDirecto(9, datosDeTrabajoDirecto({ customerId: 7 }).datos, null);
  assert.ok(!('totalAceptado' in fila),
    '🔴 SE ESTÁ ESCRIBIENDO UN `totalAceptado` EN UN TRABAJO SIN PRESUPUESTO.\n\n'
    + '  Si vale 0, la pantalla afirma «presupuestaste cero» — una afirmación, y falsa. Y no se\n'
    + '  queda ahí: el 0 viaja al semáforo de cobro y a la barra de progreso, que pasan a hablar\n'
    + '  del dinero de alguien contra un eje inventado. AUSENTE Y CERO NO SON LO MISMO.');
  assert.ok(!('quoteId' in fila), '🔴 el Trabajo directo no puede nacer emparejado a un presupuesto.');
  assert.equal(fila.status, 'pendiente_agendar', '🔴 tiene que arrancar en el MISMO estado de la FSM (Parte L).');
});

test('SCRUM-651 · 🔴 sin eje, el semáforo de cobro NO afirma nada', () => {
  // La cadena entera del control negativo, ejercitada: `totalAceptado` null → el serializador pasa
  // 0 como aceptado y 0 como facturado → sin eje → `null` → la pantalla no pinta chip.
  assert.equal(importeDeReferencia(0, 0), null,
    '🔴 se ha inventado un eje donde no hay ninguno: todo lo que cuelgue de él será una afirmación falsa.');
  assert.equal(estadoCobroFor(0, 0, 0), null,
    '🔴 SIN PRESUPUESTO NI FACTURA, EL SEMÁFORO AFIRMA ALGO. «Pendiente» es una afirmación sobre el '
    + 'dinero de alguien; sin eje contra el que compararlo, no se puede sostener.');
  // Y el que SÍ tiene eje sigue contestando: el control negativo no puede apagar el caso normal.
  assert.equal(estadoCobroFor(0, 500, 0), 'Pendiente', '🔴 con presupuesto, el semáforo tiene que seguir hablando.');
});

test('SCRUM-651 · 🔴 un Trabajo sin presupuesto NO se llama «Presupuesto #N»', () => {
  // El respaldo del título metía el ID DEL TRABAJO donde va el número del presupuesto: una avería
  // se presentaba como «Presupuesto #12», un documento que no existe con un número que es de otra
  // cosa. Es la pantalla fingiendo que hay presupuesto detrás.
  const rutas = soloEjecutable(leer(RUTAS));
  assert.doesNotMatch(rutas, /Presupuesto #\$\{quote \? \(quote\.quoteNumber \?\? quote\.id\) : job\.id\}/,
    '🔴 HA VUELTO EL TÍTULO QUE LLAMA «Presupuesto #<id del Trabajo>» a un Trabajo sin presupuesto.');
  assert.match(rutas, /: \(customer\?\.name \?\? `#\$\{job\.id\}`\)\)/,
    '🔴 sin presupuesto, el título tiene que salir del CLIENTE — que siempre existe—, como dejó '
    + 'escrito SCRUM-317. Inventar un número de documento es peor que no tener nombre.');
});

test('SCRUM-651 · 🔴 el titular «Total aceptado» NO se pinta si no consta', () => {
  const detalle = soloEjecutable(leer(DETALLE));
  const i = detalle.indexOf('detail-total-label');
  assert.ok(i > 0, '🔴 no se encuentra el titular del dinero: el instrumento no vale.');
  const antes = detalle.slice(Math.max(0, i - 400), i);
  assert.match(antes, /if \(job\.totalAceptado != null\)/,
    '🔴 «TOTAL ACEPTADO 0,00 €» VUELVE A PINTARSE EN UN TRABAJO SIN PRESUPUESTO.\n\n'
    + '  Va a 2,2 rem, es el titular del dinero de la pantalla, y se lee como «presupuestaste\n'
    + '  cero». No hay presupuesto: lo que corresponde es no decir nada, no decir cero.');
});

// ── 5 · LA PUERTA EN LA PANTALLA ──────────────────────────────────────────────────────────

test('SCRUM-651 · 🔴 el boton de «trabajo nuevo» se pinta ANTES del estado vacio', () => {
  // Con CERO trabajos es justo cuando mas falta hace poder abrir el primero. `renderJobsView`
  // hace `return` en el estado vacio, asi que colgar el boton despues lo dejaria invisible para
  // un merchant nuevo — que es el unico que ve esa pantalla.
  const vista = soloEjecutable(leer('public/dashboard/js/jobsView.js'));
  const boton = vista.indexOf('abrirModalTrabajoNuevo');
  const vacio = vista.indexOf('empty-state-icon');
  assert.ok(boton > 0, '🔴 la lista de Trabajos ya no ofrece abrir uno nuevo: la puerta no existe en la pantalla.');
  assert.ok(vacio > 0, '🔴 no se encuentra el estado vacio: el instrumento no vale para decir que el boton va antes.');
  assert.ok(boton < vacio,
    '🔴 EL BOTON SE PINTA DESPUES DEL `return` DEL ESTADO VACIO. Un merchant sin trabajos —el '
    + 'unico que ve esa pantalla— no puede abrir el primero, y encima se le dice que espere a que '
    + 'alguien acepte un presupuesto. Queda encerrado.');
});

test('SCRUM-651 · 🔴 el modal NO manda `quoteId`, ni tiene por donde', () => {
  const modal = soloEjecutable(leer('public/dashboard/js/jobNuevoModal.js'));
  assert.match(modal, /method: 'POST'/, '🔴 el modal ya no crea nada: el instrumento no vale.');
  assert.ok(!/quoteId|quote_id/.test(modal),
    '🔴 el modal del Trabajo DIRECTO manda un `quoteId`. Emparejar Trabajo y presupuesto es cosa de '
    + '`ensureJobForQuote`, que mantiene los dos sentidos de la pertenencia (SCRUM-195); un segundo '
    + 'escritor acaba discrepando, y discrepar aqui es un Trabajo duplicado con el dinero repartido.');
});

test('SCRUM-651 · la microcopy sin aprobar sale de UNA sola constante (regla 30)', () => {
  const modal = leer('public/dashboard/js/jobNuevoModal.js');
  assert.equal((modal.match(/'\[PENDIENTE microcopy oficial\]'/g) || []).length, 1,
    '🔴 los textos sin aprobar tienen que salir de UNA constante. Repartidos en literales sueltos, '
    + 'aprobar el copy obliga a cazarlos uno a uno y el censo de SCRUM-402 cuenta ocho en vez de uno.');
  assert.ok(modal.includes('MARCA_651'), '🔴 ha desaparecido la constante del marcador.');
});
