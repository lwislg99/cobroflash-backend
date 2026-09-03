// tests/scrum650d-pantalla-asignar.test.mjs — SCRUM-650 (T1) · LA PANTALLA DE ASIGNAR A VARIOS
//
// «ISRAEL, MIGUEL Y JESÚS.L» — TRES NOMBRES EN LA MISMA LÍNEA DEL PARTE DE PAPEL.
//
// El motor (`asignacionDeTrabajo.ts`), la tabla (`job_assignees`) y el filtro de los tres ejes ya
// estaban en producción. Lo que faltaba era la pantalla, y lo que estos tests fijan es lo que la
// pantalla tiene que conseguir: que asignar a tres se NOTE en lo que cada uno de los tres ve, y
// que quitar a uno se note SOLO en el que se quitó.
//
// Sin gate: funciones puras + un DOM de juguete + un doble de transacción. Ni BD, ni red, ni
// navegador — el patrón de SCRUM-229/500/655.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { escribirAsignados, loVe, principalDe, normalizarAsignados }
  from '../dist/modules/jobs/domain/asignacionDeTrabajo.js';
import { soloCodigo, literalesDe } from './_solo-codigo.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// El módulo del front es un script clásico: se evalúa y publica en el objeto que reciba. Así se
// prueba COMPORTAMIENTO y no la forma del `.js`.
const front = {};
const FUENTE_FRONT = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/jobAsignados.js'), 'utf8');
new Function('window', FUENTE_FRONT)(front);

// Los tres del parte de papel de Tecnosel.
const ISRAEL = 11, MIGUEL = 12, JESUS = 13;
const EQUIPO = [
  { id: null, name: 'Tecnosel (propietario)', isOwner: true, status: 'active' },
  { id: ISRAEL, name: 'Israel', role: 'tecnico', status: 'active' },
  { id: MIGUEL, name: 'Miguel', role: 'tecnico', status: 'active' },
  { id: JESUS, name: 'Jesús.L', role: 'tecnico', status: 'active' },
];

/** DOM de juguete: lo justo que usa el módulo, a la vista, para medir el ÁRBOL que sale. */
function documentoDeJuguete() {
  const crear = (tag) => ({
    tag, className: '', textContent: '', hijos: [], attrs: {}, style: {},
    appendChild(n) { this.hijos.push(n); return n; },
    setAttribute(k, v) { this.attrs[k] = v; },
  });
  return { createElement: crear };
}
const todos = (n, out = []) => { out.push(n); (n.hijos || []).forEach((h) => todos(h, out)); return out; };

/** Un doble de la transacción de Prisma: guarda filas de `job_assignees` en memoria. */
function bancoDeAsignaciones() {
  let filas = [];
  return {
    filas: () => filas.slice(),
    idsDe: (jobId) => filas.filter((f) => f.jobId === jobId).map((f) => f.teamMemberId).sort((a, b) => a - b),
    jobAssignee: {
      async deleteMany({ where }) {
        const antes = filas.length;
        filas = filas.filter((f) => f.jobId !== where.jobId);
        return { count: antes - filas.length };
      },
      async createMany({ data }) {
        data.forEach((d) => filas.push({ jobId: d.jobId, teamMemberId: d.teamMemberId }));
        return { count: data.length };
      },
    },
  };
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// § 0 · SUELO — si las piezas no cargan o el banco no guarda, todo lo de abajo pasa en vacío.
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-650d · SUELO: las piezas del front existen y el banco GUARDA', async () => {
  for (const nombre of ['construirSelectorAsignados', 'tecnicosAsignables', 'nombresDeAsignados', 'cuerpoDeAsignacion']) {
    assert.equal(typeof front[nombre], 'function', `🔴 «${nombre}» no se ha publicado en window`);
  }
  const banco = bancoDeAsignaciones();
  await escribirAsignados(banco, 1, [ISRAEL]);
  assert.deepEqual(banco.idsDe(1), [ISRAEL],
    '🔴 el doble de transacción no guarda nada. Con un banco mudo, «quitar a uno» y «no hacer ' +
    'nada» darían el mismo resultado y todos los verdes de abajo medirían el vacío.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// § 1 · 🔴 EL ROJO QUE IMPORTA: TRES ASIGNADOS, SE QUITA UNO
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-650d · 🔴 quitar a UNO se lo quita SOLO A ÉL: los otros dos lo siguen viendo', async () => {
  const banco = bancoDeAsignaciones();
  const JOB = 77;

  // ① El jefe asigna a los tres del parte: «Israel, Miguel y Jesús.L».
  await escribirAsignados(banco, JOB, normalizarAsignados([ISRAEL, MIGUEL, JESUS]));
  const conTres = { operarioId: null, assignedUserId: principalDe([ISRAEL, MIGUEL, JESUS]), asignados: banco.idsDe(JOB) };

  for (const quien of [ISRAEL, MIGUEL, JESUS]) {
    assert.equal(loVe(conTres, quien), true,
      `🔴 se ha asignado el trabajo a los TRES y ${quien} NO lo ve. Es el caso entero del ticket: ` +
      'en el parte de papel caben tres nombres en una línea, y si la pantalla solo sirve para uno ' +
      'el jefe tiene que elegir a uno y apañarse.');
  }

  // ② Se quita a MIGUEL. Los otros dos NO se tocan.
  await escribirAsignados(banco, JOB, normalizarAsignados([ISRAEL, JESUS]));
  const conDos = { operarioId: null, assignedUserId: principalDe([ISRAEL, JESUS]), asignados: banco.idsDe(JOB) };

  assert.equal(loVe(conDos, MIGUEL), false,
    '🔴 SE HA QUITADO A MIGUEL Y SIGUE VIENDO EL TRABAJO. Quitar a alguien de un trabajo no es ' +
    'cosmético: es dejar de enseñárselo. Si no se cae, la pantalla miente sobre quién lo lleva.');
  assert.equal(loVe(conDos, ISRAEL), true,
    '🔴 al quitar a MIGUEL se ha caído también ISRAEL. Se han caído los tres de golpe: la ' +
    'escritura está borrando el grupo entero en vez de dejar a los que quedan.');
  assert.equal(loVe(conDos, JESUS), true,
    '🔴 al quitar a MIGUEL se ha caído también JESÚS.');
  assert.deepEqual(banco.idsDe(JOB), [ISRAEL, JESUS],
    `🔴 la tabla ha quedado con ${JSON.stringify(banco.idsDe(JOB))} y tenían que quedar Israel y Jesús.`);
});

test('SCRUM-650d · 🔴 Y CAE CON EL MECANISMO VIEJO: la columna sola solo sirve para UNO', () => {
  // La prueba de que la tabla hacía falta. Con la columna de siempre —`assignedUserId`, un
  // escalar— asignar a tres guarda al PRINCIPAL y pierde a los otros dos SIN ERROR.
  const soloColumna = { operarioId: null, assignedUserId: principalDe([ISRAEL, MIGUEL, JESUS]) };

  const losQueVen = [ISRAEL, MIGUEL, JESUS].filter((q) => loVe(soloColumna, q));
  assert.deepEqual(losQueVen, [ISRAEL],
    `🔴 con la columna sola lo ven ${JSON.stringify(losQueVen)}. Si los ve más de uno, la columna ` +
    'vieja ya bastaba y el test de arriba no prueba que la tabla añadiera nada: comprueba qué ha ' +
    'cambiado antes de creerte el verde.');

  // Y el otro lado: quitar a MIGUEL de la columna no cambia NADA, porque nunca estuvo.
  const sinMiguel = { operarioId: null, assignedUserId: principalDe([ISRAEL, JESUS]) };
  assert.equal(loVe(sinMiguel, MIGUEL), false);
  assert.equal(loVe(soloColumna, MIGUEL), false,
    '🔴 con la columna sola MIGUEL veía el trabajo, así que quitarlo sí tendría efecto y el ' +
    'mecanismo viejo aprobaría el test de arriba.');
});

test('SCRUM-650d · 🔴 CONTROL POSITIVO: con UN solo asignado todo sigue exactamente igual', async () => {
  // El 99% de los trabajos. Añadir el camino nuevo y romper el viejo da el mismo verde en los
  // tests del nuevo, así que este control va con los otros y no de adorno.
  const banco = bancoDeAsignaciones();
  await escribirAsignados(banco, 5, normalizarAsignados([ISRAEL]));
  const uno = { operarioId: null, assignedUserId: principalDe([ISRAEL]), asignados: banco.idsDe(5) };

  assert.equal(loVe(uno, ISRAEL), true, '🔴 con UN asignado, el asignado ya no ve su trabajo');
  assert.equal(loVe(uno, MIGUEL), false, '🔴 con UN asignado, otro técnico ve un trabajo que no es suyo');
  assert.equal(uno.assignedUserId, ISRAEL,
    '🔴 la columna vieja ha dejado de guardar al principal. El filtro todavía la lee (paso A) y ' +
    'sin ella un técnico dejaría de ver su trabajo el día del despliegue.');
  assert.deepEqual(banco.idsDe(5), [ISRAEL]);

  // Y la autoría sigue siendo un eje aparte: el que redactó el presupuesto lo ve aunque no ejecute.
  const soloAutoria = { operarioId: JESUS, assignedUserId: ISRAEL, asignados: [ISRAEL] };
  assert.equal(loVe(soloAutoria, JESUS), true,
    '🔴 el AUTOR del presupuesto ha dejado de ver su trabajo. `operarioId` es un eje propio ' +
    '(SCRUM-52) y esta pantalla no lo toca — pero tampoco puede apagarlo.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// § 2 · 🔴 EL SUELO DE CEGUERA DEL SELECTOR
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-650d · 🔴 CERO empleados NO es «no hay empleados»: es que no se ha leído nada', () => {
  for (const [caso, valor] of [['una lista vacía', []], ['algo que no es lista', null], ['undefined', undefined]]) {
    assert.throws(
      () => front.tecnicosAsignables(valor),
      (e) => {
        assert.equal(e.name, 'EquipoCiego',
          `🔴 con ${caso} el selector se pinta igual. Todo merchant tiene al menos su propietario ` +
          '(`getTeamOverview` lo sintetiza siempre), así que un cero aquí es que la petición a ' +
          '/admin/team falló o devolvió otra forma. Y el jefe leería «no tengo a quien asignar» ' +
          'de un negocio que tiene tres empleados.');
        return true;
      },
    );
  }
  // Y el contraste: con equipo de verdad, contesta.
  assert.equal(front.tecnicosAsignables(EQUIPO).length, 3);
});

test('SCRUM-650d · 🔴 el PROPIETARIO no se ofrece: no tiene fila que referenciar', () => {
  const ids = front.tecnicosAsignables(EQUIPO).map((m) => m.id);
  assert.equal(ids.includes(null), false,
    '🔴 el propietario aparece como asignable. `getTeamOverview` lo sintetiza con `id: null` ' +
    'porque NO tiene fila en `team_members`, así que asignárselo revienta la clave ajena de ' +
    '`job_assignees` y el PATCH responde `invalid_assignee`. Sería un clic que siempre falla.');
  assert.deepEqual(ids, [ISRAEL, MIGUEL, JESUS]);

  // Un empleado dado de baja tampoco: asignarle trabajo a quien ya no está es prometer una obra.
  const conBaja = EQUIPO.concat([{ id: 99, name: 'Antiguo', status: 'inactive' }]);
  assert.equal(front.tecnicosAsignables(conBaja).some((m) => m.id === 99), false,
    '🔴 un empleado inactivo sale como asignable');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// § 3 · 🔴 LA PANTALLA: LO QUE SE PINTA Y LO QUE SE MANDA
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-650d · 🔴 el selector marca a los YA asignados, y devuelve lo marcado', () => {
  const sel = front.construirSelectorAsignados(documentoDeJuguete(), {
    miembros: EQUIPO,
    asignados: [{ id: ISRAEL, name: 'Israel' }, { id: JESUS, name: 'Jesús.L' }],
    puedeEditar: true,
  });

  assert.equal(sel.casillas.length, 3,
    `🔴 se han pintado ${sel.casillas.length} casillas y los asignables son 3.`);
  assert.deepEqual(sel.idsMarcados(), [ISRAEL, JESUS],
    '🔴 el selector no llega marcando a quien YA está asignado. El jefe abriría el trabajo, vería ' +
    'todo sin marcar, y el primer clic BORRARÍA a los que había.');

  // Se marca a Miguel: entra sin sacar a nadie.
  sel.casillas.find((c) => c.teamMemberId === MIGUEL).checked = true;
  assert.deepEqual(sel.idsMarcados(), [ISRAEL, MIGUEL, JESUS],
    '🔴 marcar a uno más no lo añade, o saca a otro. Son tres nombres en la misma línea.');

  // Y se quita a Miguel: salen los otros dos, no cero.
  sel.casillas.find((c) => c.teamMemberId === MIGUEL).checked = false;
  assert.deepEqual(sel.idsMarcados(), [ISRAEL, JESUS]);
});

test('SCRUM-650d · 🔴 el cuerpo del PATCH manda LA LISTA, y jamás `operarioId`', () => {
  const cuerpo = front.cuerpoDeAsignacion([ISRAEL, MIGUEL, JESUS]);
  assert.deepEqual(Object.keys(cuerpo), ['assignedUserIds'],
    `🔴 el PATCH manda ${JSON.stringify(Object.keys(cuerpo))}. Esta pantalla habla de QUIÉN ` +
    'EJECUTA (SCRUM-10). `operarioId` es AUTORÍA congelada al aceptar el presupuesto (SCRUM-52), ' +
    'y escribirla desde aquí le cambiaría a alguien quién redactó su presupuesto.');
  assert.deepEqual(cuerpo.assignedUserIds, [ISRAEL, MIGUEL, JESUS]);
  assert.equal('assignedUserId' in cuerpo, false,
    '🔴 se manda también el escalar. El backend mira `assignedUserIds` PRIMERO, así que mandar ' +
    'los dos deja una segunda fuente que un día ganará y guardará a uno solo.');

  // Sin nadie: la lista vacía es un valor, no una omisión. Un trabajo puede quedarse sin nadie.
  assert.deepEqual(front.cuerpoDeAsignacion([]), { assignedUserIds: [] });
});

test('SCRUM-650d · 🔴 el módulo de la pantalla no NOMBRA `operarioId` en su código', () => {
  // ⚠️ Se lee el código SIN COMENTARIOS: la cabecera EXPLICA que no se toca `operarioId`, y un
  // guard por texto se cazaría a sí mismo en la explicación (la trampa que ya mordió en SCRUM-118).
  //
  // Y el filtro NO se fabrica aquí (SCRUM-693/694): `soloCodigo` tokeniza con el scanner de
  // TypeScript, así que ni se come una línea de código con `https://` dentro de una cadena ni deja
  // pasar un texto escrito dentro de un bloque `/* */`. Mi primera versión era un regex por líneas
  // y tenía las dos averias.
  const sinComentarios = soloCodigo(FUENTE_FRONT, 'jobAsignados.js');
  assert.equal(/operarioId|operario_id/.test(sinComentarios), false,
    '🔴 el código del selector nombra `operarioId`. Es AUTORÍA (SCRUM-52), no quién ejecuta ' +
    '(SCRUM-10): el backfill de `job_assignees` alimentó la tabla SOLO desde `assigned_user_id` y ' +
    'tiene un test que exige que su SQL no lo mencione. Esta pantalla no puede contradecirlo.');
  // SUELO del guard: sin comentarios el fichero sigue teniendo código, no se ha vaciado.
  assert.ok(sinComentarios.includes('assignedUserIds'),
    '🔴 al quitar los comentarios se ha quedado sin código: el guard de arriba pasaría en vacío.');
});

test('SCRUM-650d · los nombres se leen como en el parte de papel', () => {
  const tres = [{ id: ISRAEL, name: 'Israel' }, { id: MIGUEL, name: 'Miguel' }, { id: JESUS, name: 'Jesús.L' }];
  assert.equal(front.nombresDeAsignados(tres), 'Israel, Miguel y Jesús.L',
    '🔴 el campo «Técnico» del parte dice literalmente «Israel, Miguel y Jesús.L».');
  assert.equal(front.nombresDeAsignados([tres[0]]), 'Israel');
  assert.equal(front.nombresDeAsignados([]), '',
    '🔴 sin nadie devuelve texto. Quien pinta decide si eso es un hueco o una frase; esta función ' +
    'no puede decidir microcopy por su cuenta.');
});

test('SCRUM-650d · al TÉCNICO se le enseña quién ejecuta, y por qué no puede cambiarlo', () => {
  // La norma de SCRUM-89: un gate no deja UI huérfana. Ni casillas muertas, ni bloque escondido.
  const sel = front.construirSelectorAsignados(documentoDeJuguete(), {
    miembros: EQUIPO,
    // TRES, que es el caso del parte. Con dos la lista se lee «Israel y Miguel» —sin coma, que es
    // lo correcto en castellano— y escribí el assert esperando la coma: lo dijo el rojo.
    asignados: [{ id: ISRAEL, name: 'Israel' }, { id: MIGUEL, name: 'Miguel' }, { id: JESUS, name: 'Jesús.L' }],
    puedeEditar: false,
  });
  assert.equal(sel.casillas.length, 0, '🔴 al técnico se le pintan casillas que no puede usar');
  const textos = todos(sel.elemento).map((n) => n.textContent).filter(Boolean);
  assert.ok(textos.some((t) => t === 'Israel, Miguel y Jesús.L'),
    `🔴 el técnico no ve QUIÉN ejecuta: ${JSON.stringify(textos)}`);
  assert.ok(textos.some((t) => t === front.TEXTOS_ASIGNADOS.soloAdmin),
    '🔴 no se dice por qué no puede cambiarlo: un bloque sin acción y sin explicación se lee como ' +
    'una pantalla rota.');
});

test('SCRUM-650d · equipo de UNA persona: se dice, no se pinta una lista vacía', () => {
  // Solo el propietario. NO es ceguera —hay un miembro— y por eso no lanza: lo dice.
  const sel = front.construirSelectorAsignados(documentoDeJuguete(), {
    miembros: [EQUIPO[0]],
    asignados: [],
    puedeEditar: true,
  });
  assert.equal(sel.casillas.length, 0);
  const textos = todos(sel.elemento).map((n) => n.textContent).filter(Boolean);
  assert.ok(textos.includes(front.TEXTOS_ASIGNADOS.sinEquipo),
    `🔴 con un equipo de una sola persona se pinta un selector vacío: ${JSON.stringify(textos)}. ` +
    'Un desplegable sin opciones no se distingue de uno que no cargó.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// § 3b · 🔴 EL CABLE DE LECTURA, POR AST
//
// LO ENCONTRÓ UN ROJO DE ESTA MISMA TANDA. Retirado `asignados` de las salidas de
// `serializeJobDetail`, la suite entera seguía VERDE: 4567 tests, 0 fallos. O sea que el dato del
// que vive la pantalla podía dejar de viajar sin que nada lo dijera — y la pantalla enseñaría «no
// lo ejecuta nadie» en TODOS los trabajos, sin ningún error.
//
// Se comprueba por AST y no por texto: `grep` encuentra la palabra `asignados` en cualquier
// comentario (y esta cabecera es uno). Lo que se mide son las PROPIEDADES de los objetos que la
// función devuelve — y **TODAS** sus salidas, que es lo que importa: el detalle tiene una salida
// temprana para el Trabajo sin presupuesto, y añadir una tercera sin el campo es exactamente cómo
// se rompe esto sin que nadie se entere.
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-650d · 🔴 TODAS las salidas de `serializeJobDetail` llevan `asignados`', async () => {
  const ts = (await import('typescript')).default;
  const ruta = path.join(RAIZ, 'src/modules/jobs/app/routes/jobs.routes.ts');
  const sf = ts.createSourceFile(ruta, fs.readFileSync(ruta, 'utf8'), ts.ScriptTarget.Latest, true);

  let fn = null;
  const buscar = (n) => {
    if (ts.isFunctionDeclaration(n) && n.name && n.name.text === 'serializeJobDetail') fn = n;
    ts.forEachChild(n, buscar);
  };
  buscar(sf);
  assert.ok(fn, '🔴 no se encuentra `serializeJobDetail`: el guard mediría el vacío.');

  // Las salidas: cada `return` con un objeto literal. Las funciones anidadas no cuentan.
  const salidas = [];
  const recorrer = (n) => {
    if (n !== fn && (ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n))) return;
    if (ts.isReturnStatement(n) && n.expression && ts.isObjectLiteralExpression(n.expression)) {
      const props = n.expression.properties.map((pr) => (pr.name && pr.name.text)
        || (ts.isSpreadAssignment(pr) ? '...' + pr.expression.getText() : '?'));
      salidas.push({ linea: sf.getLineAndCharacterOfPosition(n.getStart()).line + 1, props });
    }
    ts.forEachChild(n, recorrer);
  };
  ts.forEachChild(fn, recorrer);

  // SUELO: si el recorrido no ve salidas, «todas la llevan» sería verdad sin significar nada.
  assert.ok(salidas.length >= 2,
    `🔴 solo se han visto ${salidas.length} salidas de \`serializeJobDetail\` y tiene al menos DOS ` +
    '(la temprana del Trabajo sin presupuesto y la normal). El recorrido no está mirando bien.');

  const sinAsignados = salidas.filter((s) => !s.props.includes('asignados'));
  assert.deepEqual(sinAsignados.map((s) => s.linea), [],
    '🔴 UNA SALIDA DEL DETALLE NO LLEVA `asignados`:\n' +
    sinAsignados.map((s) => `    jobs.routes.ts:${s.linea} → ${JSON.stringify(s.props)}`).join('\n') +
    '\n  Sin ese campo el selector de QUIÉN EJECUTA se pinta vacío en esos Trabajos, y lo hace SIN\n' +
    '  FALLAR: el jefe lee «no lo ejecuta nadie» de un trabajo que tiene tres técnicos. La salida\n' +
    '  temprana es la del Trabajo manual sin presupuesto — la avería, que es justo el caso que más\n' +
    '  se reparte entre varios.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// § 3c · 🔴 LO QUE SE PINTA TIENE ESTILO (AB6)
//
// LO ENCONTRÉ EN MI PROPIO TRABAJO: el módulo pintaba `job-asignados-*` y esas clases no existían
// en ninguna hoja. El selector salía sin caja, sin separación y sin objetivo táctil — y nada
// fallaba, porque una clase inventada no da error: simplemente no aplica nada.
//
// La lista de clases se DERIVA del módulo (sus literales, por el scanner), no se escribe a mano:
// una clase nueva sin estilo entra en el guard sola.
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-650d · 🔴 toda clase que pinta el selector EXISTE en la hoja, y la fila mide 44 px', () => {
  const css = fs.readFileSync(path.join(RAIZ, 'public/dashboard/css/styles.css'), 'utf8');
  const clases = [...new Set(literalesDe(FUENTE_FRONT, 'jobAsignados.js')
    .filter((s) => /^job-asignados/.test(s)))];

  // SUELO: si no se ve ninguna clase, «todas tienen estilo» sería verdad sin significar nada.
  assert.ok(clases.length >= 5,
    `🔴 solo se han visto ${clases.length} clases del selector (${JSON.stringify(clases)}). ` +
    'El extractor no está leyendo el módulo y el guard mediría el vacío.');

  // 🔴 Anclado a PRINCIPIO DE LÍNEA: sin eso, `.job-asignados-fila:hover` bastaría para dar por
  // estilada una clase que solo aparece colgando de otra regla.
  const sinEstilo = clases.filter((c) => !new RegExp('^[.]' + c + '\\b', 'm').test(css));
  assert.deepEqual(sinEstilo, [],
    `🔴 EL SELECTOR PINTA CLASES QUE NO EXISTEN EN LA HOJA: ${sinEstilo.join(', ')}.\n`
    + '  Una clase inventada no da error: no aplica nada. El bloque sale sin caja, sin separación y\n'
    + '  sin objetivo táctil, y la pantalla parece rota sin que nada falle.');

  // AB6: se marca de pie, en la obra. El número vive en la HOJA y aquí se comprueba que sigue ahí.
  const fila = /^\.job-asignados-fila\s*\{[^}]*\}/m.exec(css);
  assert.ok(fila, '🔴 no se encuentra la regla de `.job-asignados-fila` en la hoja.');
  assert.match(fila[0], /min-height:\s*44px/,
    '🔴 la fila del selector ha dejado de declarar 44 px de alto (AB6). Se marca de pie, en una ' +
    'obra y con guantes: por debajo de eso se falla el toque y se asigna a quien no era.');
});
// ═════════════════════════════════════════════════════════════════════════════════════════
// § 4 · REGLA 30 · EL TEXTO NO LO APRUEBO YO
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-650d · 🔴 todo texto de pantalla lleva el marcador, y sale de UNA constante', () => {
  const textos = Object.entries(front.TEXTOS_ASIGNADOS);
  assert.ok(textos.length >= 4, `🔴 solo hay ${textos.length} textos declarados: el censo mediría poco`);
  for (const [clave, texto] of textos) {
    assert.ok(texto.startsWith('[PENDIENTE'),
      `🔴 el texto «${clave}» se pinta SIN marcador: «${texto}». El microcopy lo aprueba el ` +
      'fundador (regla 30), y una frase plausible sin marcar es texto que nadie ha firmado ' +
      'llegándole a un profesional.');
  }
  // Y salen de UNA sola constante: aprobar el copy los apaga de golpe, y por eso el censo de
  // SCRUM-402 cuenta 1 para este fichero y no cuatro.
  const literalesConMarca = (FUENTE_FRONT.match(/'\[PENDIENTE[^']*'/g) || []);
  assert.equal(literalesConMarca.length, 1,
    `🔴 hay ${literalesConMarca.length} literales con marcador en el fichero y tiene que haber ` +
    'UNO. Con el marcador repetido, aprobar el copy obliga a tocar cada texto por separado y el ' +
    'censo de SCRUM-402 deja de poder contar 1.');
});
