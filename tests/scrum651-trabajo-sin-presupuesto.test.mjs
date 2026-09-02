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
import { datosDeTrabajoDirecto, filaDeTrabajoDirecto, tituloDeTrabajo } from '../dist/modules/jobs/domain/trabajoDirecto.js';
import { TIPOS_INTERVENCION, esTipoIntervencion } from '../dist/modules/jobs/domain/tipoIntervencion.js';
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
  // 🔴 ESTO SE PRUEBA POR COMPORTAMIENTO, Y NO COMPARANDO EL FUENTE. La primera version miraba
  // si la expresion vieja seguia escrita: al inyectar el defecto de otra forma **paso en verde**.
  // Un guard atado a la FORMA del codigo no vigila el HECHO.
  const sinQuote = tituloDeTrabajo({ titulo: null, quote: null, customer: { name: 'Bar Paco' }, jobId: 12 });
  assert.equal(sinQuote, 'Bar Paco',
    `🔴 UN TRABAJO SIN PRESUPUESTO SE PRESENTA COMO "${sinQuote}".` + String.fromCharCode(10) + String.fromCharCode(10)
    + '  Si ahi sale «Presupuesto #12», la pantalla nombra un documento que NO EXISTE y le pone el' + String.fromCharCode(10)
    + '  ID del Trabajo como si fuera el numero del presupuesto. Es fingir que hay presupuesto detras.');
  assert.ok(!/Presupuesto/.test(sinQuote), '🔴 la palabra «Presupuesto» no puede aparecer si no hay ninguno.');

  // Sin cliente tampoco se inventa un documento: queda el id del Trabajo, que si es suyo.
  assert.equal(tituloDeTrabajo({ titulo: null, quote: null, customer: null, jobId: 12 }), '#12');

  // CONTROL POSITIVO: con presupuesto, el titulo es EXACTAMENTE el de siempre.
  assert.equal(
    tituloDeTrabajo({ titulo: null, quote: { quoteNumber: 34, id: 9 }, customer: { name: 'Bar Paco' }, jobId: 12 }),
    'Presupuesto #34 · Bar Paco',
    '🔴 el titulo del Trabajo que viene de un presupuesto ha cambiado: el camino de siempre no se toca.');
  assert.equal(
    tituloDeTrabajo({ titulo: null, quote: { quoteNumber: null, id: 9 }, customer: null, jobId: 12 }),
    'Presupuesto #9',
    '🔴 sin numero de presupuesto se cae a su id, como siempre.');

  // Y el nombre que puso el profesional manda sobre todo lo demas.
  assert.equal(tituloDeTrabajo({ titulo: 'Averia cocina', quote: null, customer: { name: 'Bar Paco' }, jobId: 12 }), 'Averia cocina');
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

test('SCRUM-651 · 🔴 el Trabajo directo guarda QUIEN LO ABRE, o su autor lo pierde de vista', () => {
  // EL FALLO MUDO QUE ESTE TICKET PUDO METER. Medido: un tecnico solo ve los Trabajos donde es
  // `operarioId` **o** `assignedUserId` (SCRUM-467). Con `operarioId` en null, un tecnico abriria
  // la averia y **dejaria de verla en el mismo instante** — sin error y sin aviso.
  const datos = datosDeTrabajoDirecto({ customerId: 7 }).datos;
  assert.equal(filaDeTrabajoDirecto(9, datos, 42).operarioId, 42,
    '🔴 EL TRABAJO NO GUARDA QUIEN LO ABRIO. Su autor lo pierde de vista en cuanto lo crea: el '
    + 'listado del tecnico filtra por autoria o asignacion, y este Trabajo no tendria ninguna.');
  // Y el propietario sigue siendo `null`, la convencion de siempre: un admin lo ve todo igual.
  assert.equal(filaDeTrabajoDirecto(9, datos, null).operarioId, null,
    '🔴 se ha inventado un operario donde el propietario va en null (misma convencion que Quote).');
});

test('SCRUM-651 · la ruta le pasa el AUTOR de verdad, no un null fijo', () => {
  // El nucleo puede estar bien y la ruta pasarle `null` siempre: entonces el guard de arriba
  // seguiria verde y el fallo mudo estaria igualmente en produccion.
  const rutas = soloEjecutable(leer(RUTAS));
  assert.match(rutas, /filaDeTrabajoDirecto\(req\.merchantId, entrada\.datos, req\.teamMemberId \?\? null\)/,
    '🔴 la ruta ya no pasa quien abre el Trabajo. El nucleo lo guardaria bien y daria igual: '
    + 'llegaria null de todos modos y el tecnico perderia de vista su propia averia.');
});

// ── 6 · EL TIPO DE INTERVENCION: VOCABULARIO CERRADO, Y UNA SOLA FUENTE ───────────────────

test('SCRUM-651 · el vocabulario es EXACTAMENTE el aprobado, y en su orden', () => {
  // Aprobado por el fundador el 2-sep-2026 (regla 27). Ni uno mas, ni uno menos, ni reordenado:
  // el orden es el que ve el profesional en el desplegable y el primero es el caso frecuente.
  assert.deepEqual([...TIPOS_INTERVENCION],
    ['REPARACION_ASISTENCIA', 'MANTENIMIENTO', 'INSTALACION'],
    '🔴 el vocabulario cerrado ha cambiado. Ampliarlo o reordenarlo es cambio de master '
    + '(regla 27), no una linea de codigo.');
});

test('SCRUM-651 · 🔴 un valor FUERA DE LOS TRES no entra, y el rojo lo nombra', () => {
  for (const malo of [
    'REPARACION', 'reparacion_asistencia', 'AVERIA', 'OTRO', 'MANTENIMIENTO ', '',
    null, undefined, 3, {}, [], true,
  ]) {
    assert.equal(esTipoIntervencion(malo), false,
      `🔴 «${JSON.stringify(malo)}» SE HA COLADO COMO TIPO DE INTERVENCION.` + String.fromCharCode(10)
      + '  El vocabulario es CERRADO (regla 27): lo que no esta en la lista no existe. Y ojo con los'
      + ' casi-iguales — minusculas, un espacio detras, un sinonimo— que es como se cuela un valor'
      + ' que luego nadie encuentra.');

    // Y la puerta lo rechaza NOMBRANDO el motivo, no en silencio.
    //
    // 🔴 `undefined` NO ENTRA EN ESTA MITAD, Y LA DISTINCION IMPORTA: «no lo he mandado» y «he
    // mandado una palabra que no existe» son dos cosas. El campo es OPCIONAL —en una averia se
    // teclea lo justo—, asi que omitirlo es legitimo y tiene que seguir abriendo el Trabajo.
    // Es la misma disciplina de ausente-contra-cero que el resto de este ticket.
    if (malo === undefined) continue;
    const r = datosDeTrabajoDirecto({ customerId: 7, tipoIntervencion: malo });
    assert.equal(r.ok, false, `🔴 la puerta acepta «${JSON.stringify(malo)}» como tipo de intervencion.`);
    assert.equal(r.error, 'tipo_intervencion_invalido',
      `🔴 se rechaza, pero por el motivo equivocado (${r.error}): quien lo lea no sabra que arreglar.`);
  }

  // AUSENTE NO ES INVALIDO: sin el campo, el Trabajo se abre igual.
  assert.equal(datosDeTrabajoDirecto({ customerId: 7 }).ok, true,
    '🔴 omitir el tipo de intervencion se trata como un error. El campo es opcional: en una averia '
    + 'el pro teclea lo justo y sigue.');
});

test('SCRUM-651 · 🔴 un tipo VALIDO tampoco se traga en silencio mientras no haya columna', () => {
  // La columna es territorio del fundador y todavia no esta (el diff, en docs/master/SCRUM-651.md).
  // Aceptar el dato y no guardarlo seria el fallo mudo de este ticket cometido otra vez: el pro
  // elige «Mantenimiento», el producto contesta 201, y ese dato no existe en ninguna parte.
  for (const bueno of TIPOS_INTERVENCION) {
    const r = datosDeTrabajoDirecto({ customerId: 7, tipoIntervencion: bueno });
    assert.equal(r.ok, false,
      `🔴 SE ACEPTA «${bueno}» Y NO HAY DONDE GUARDARLO. El 201 mentiria: el dato se pierde y nadie`
      + ' se entera. Cuando la columna exista, esto se abre en tres lineas y este test es la lista.');
    assert.equal(r.error, 'tipo_intervencion_sin_columna',
      '🔴 el motivo tiene que decir QUE FALTA, no un generico: es la diferencia entre «arregla el '
      + 'schema» y «revisa tu formulario».');
  }
  // Y sin el campo, el camino de siempre sigue abriendo trabajos.
  assert.equal(datosDeTrabajoDirecto({ customerId: 7 }).ok, true,
    '🔴 el vocabulario nuevo ha roto el alta normal: el campo es opcional.');
});

test('SCRUM-651 · 🔴 UNA sola fuente del vocabulario, no dos listas', () => {
  // El parte de trabajo (SCRUM-652) usa EXACTAMENTE estos valores. Si cada uno declara su lista,
  // se separan el dia que alguien anada uno — y entonces un parte afirma sobre un Trabajo una
  // palabra que el Trabajo no admite. Ya paso con un rotulo que vivia en dos ranuras.
  const raiz = RAIZ;
  const sospechosos = [];
  const anda = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (['node_modules', '.git', 'dist', 'docs'].includes(e.name)) continue;
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) { anda(abs); continue; }
      if (!/\.(ts|mjs|js)$/.test(e.name)) continue;
      const rel = path.relative(raiz, abs).split(path.sep).join('/');
      if (rel.endsWith('src/modules/jobs/domain/tipoIntervencion.ts')) continue;   // LA fuente
      if (rel === `tests/${path.basename(import.meta.filename)}`) continue;        // este test
      const txt = soloEjecutable(fs.readFileSync(abs, 'utf8'));
      if (/REPARACION_ASISTENCIA/.test(txt) && /MANTENIMIENTO/.test(txt) && /INSTALACION/.test(txt)) {
        sospechosos.push(rel);
      }
    }
  };
  anda(raiz);
  assert.deepEqual(sospechosos, [],
    `🔴 LOS TRES VALORES APARECEN JUNTOS FUERA DE SU FUENTE: ${JSON.stringify(sospechosos)}.`
    + String.fromCharCode(10)
    + '  Eso es una SEGUNDA lista del mismo vocabulario. Se importa de'
    + ' `src/modules/jobs/domain/tipoIntervencion.ts`, no se copia: dos listas para el mismo hecho'
    + ' se separan, y la que se quede corta hara que un documento afirme algo que el otro no admite.');

  // SUELO: si el barrido no encuentra NI la propia fuente, no esta midiendo nada.
  const fuente = fs.readFileSync(path.join(raiz, 'src/modules/jobs/domain/tipoIntervencion.ts'), 'utf8');
  assert.ok(/REPARACION_ASISTENCIA/.test(fuente) && /INSTALACION/.test(fuente),
    '🔴 el instrumento no encuentra el vocabulario ni en su propio fichero: el cero de arriba seria ciego.');
});

// ── 7 · LA TRAZA Y EL COPY APROBADO ──────────────────────────────────────────────────────

test('SCRUM-651 · el Trabajo abierto sin presupuesto DEJA TRAZA', () => {
  // Un registro de auditoria con un agujero es peor que no tenerlo: quien lo lee lo cree completo.
  const rutas = soloEjecutable(leer(RUTAS));
  assert.match(rutas, /action: 'trabajo_creado'/,
    '🔴 abrir un Trabajo sin presupuesto ha dejado de registrarse. El camino del presupuesto si '
    + 'deja traza, asi que el registro quedaria con un agujero justo en el camino nuevo.');
  const audit = soloEjecutable(leer('src/modules/system/audit.service.ts'));
  assert.match(audit, /'trabajo_creado'/,
    '🔴 la accion ya no esta declarada en el conjunto CERRADO de AuditAction.');
});

test('SCRUM-651 · el copy APROBADO esta puesto, y sin marcador', () => {
  const vista = leer('public/dashboard/js/jobsView.js');
  assert.ok(vista.includes('Tus trabajos: los que vienen de un presupuesto aceptado, y los que abres tú.'),
    '🔴 el subtitulo aprobado el 2-sep-2026 ha cambiado. Decia que un Trabajo nace de un '
    + 'presupuesto aceptado, y con esta puerta eso era media verdad.');
  assert.ok(vista.includes('Todavía no tienes ningún trabajo. Se crean solos cuando un cliente acepta un presupuesto, o los abres tú desde aquí.'),
    '🔴 el estado vacio aprobado ha cambiado. El viejo mandaba ESPERAR a un presupuesto mientras '
    + 'tenia al lado el boton para abrir uno: la pantalla se contradecia a si misma.');
});
