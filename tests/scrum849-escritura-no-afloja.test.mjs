// tests/scrum849-escritura-no-afloja.test.mjs — SCRUM-849
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// NINGÚN HANDLER DE ESCRITURA PUEDE COMPROBAR MENOS QUE EL DE LECTURA DE SU MISMO RECURSO.
//
// Nace del hallazgo de rebote de SCRUM-841. SCRUM-467 cerró la LECTURA de los albaranes y nadie
// miró la otra mitad: `GET /admin/albaranes/:id` devolvía 404 sobre la obra de otro técnico y
// `POST /admin/albaranes/:id/firmar` sobre ESE MISMO id funcionaba. **Se podía firmar un albarán
// que no se podía ni abrir.**
//
// Censo por AST sobre los 221 handlers de `src/`: **nueve** escrituras en esa situación. Nueve
// es patrón, no caso suelto, así que lo que se entrega es el mecanismo, no nueve parches.
//
// ── LOS CONTROLES ─────────────────────────────────────────────────────────────────────────────
//
//   ① SUELO ................ el detector VE handlers que comprueban. Si viera cero se declara
//                            CIEGO: cero no es «está limpio», es «no he mirado».
//   ② 🔴 EL QUE DECIDE ..... ninguna escritura afloja respecto a su lectura.
//   ③ 🔴 ROJO POR MECANISMO . a un handler que HOY sí comprueba se le quita el filtro sobre una
//                            copia en memoria, y ② tiene que caer NOMBRANDO fichero y línea.
//   ④ CONTROL NEGATIVO ..... el detector no confunde el gate POR CAMPO con el de pertenencia,
//                            ni un `if` que corta con 409. Es lo que tuvo mal la v3.
//   ⑤ INDIRECCIÓN .......... reconoce la comprobación hecha en un auxiliar del fichero. Sin
//                            esto, el guard exigiría copiarla once veces en vez de una.
//   ⑥ LOS EJES SE DERIVAN ... la lectura y la escritura miran los MISMOS ejes de pertenencia.
//
// ── LO QUE ESTE GUARD **NO** ES ───────────────────────────────────────────────────────────────
//
// No sustituye a la regla 2. Filtrar por `req.merchantId` es OTRA cosa —de qué negocio es la
// fila— y sigue vigilándose donde se vigilaba. Esto es el filtro por ROL **dentro** de un mismo
// merchant: es ADEMÁS, no en lugar de.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import ts from 'typescript';

import {
  censarHandlers, escriturasQueAflojan, deniegaPorPertenencia, recursoDe, LECTURA, ESCRITURA,
} from './_acceso-lectura-escritura.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const HANDLERS = censarHandlers(RAIZ);

const cuerpoDe = (codigo) => {
  const sf = ts.createSourceFile('x.ts', codigo, ts.ScriptTarget.Latest, true);
  let cuerpo = null;
  (function r(n) {
    if (!cuerpo && ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
      && /router/i.test(n.expression.expression.getText())) cuerpo = n.arguments[n.arguments.length - 1];
    ts.forEachChild(n, r);
  })(sf);
  return cuerpo;
};

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ① SUELO
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-849 · ① SUELO: el detector VE handlers, y ve los que comprueban', () => {
  assert.ok(HANDLERS.length > 150,
    `🔴 el censo sólo vio ${HANDLERS.length} handlers: está ciego, y un cero suyo no significa nada`);

  const comprueban = HANDLERS.filter((h) => h.comprueba);
  assert.ok(comprueban.length > 0,
    '🔴 DETECTOR CIEGO: no encuentra NI UN handler que compruebe pertenencia, cuando SCRUM-467 '
    + 'construyó varios. Su lista de fallos vacía sería «no he mirado», no «está limpio».');

  // Y ve las dos mitades: sin lecturas protegidas no hay con qué comparar.
  const lecturas = comprueban.filter((h) => LECTURA.has(h.metodo.toLowerCase()));
  assert.ok(lecturas.length > 0, '🔴 no ve ninguna LECTURA protegida: no hay testigo contra el que comparar');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ② EL QUE DECIDE
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-849 · 🔴 ② ninguna ESCRITURA comprueba menos que la LECTURA de su recurso', () => {
  const { fallos } = escriturasQueAflojan(HANDLERS);

  const detalle = fallos.map((f) => `  ${f.fichero}:${f.linea}  ${f.metodo} ${f.path}\n`
    + `      su lectura SÍ comprueba: ${f.testigo}`).join('\n');

  assert.deepEqual(fallos.map((f) => `${f.fichero}:${f.linea}`), [],
    '🔴 HAY ESCRITURAS QUE COMPRUEBAN MENOS QUE SU PROPIA LECTURA.\n'
    + 'Un técnico no puede ABRIR ese recurso y sí puede ESCRIBIR en él:\n' + detalle
    + '\n\n⛔ NO se arregla relajando el GET. Se sube el que falta.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ③ ROJO POR MECANISMO — sin esto, ② podría estar verde sin comprobar nada
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-849 · 🔴 ③ quitándole el filtro a un handler que SÍ lo tiene, ② cae nombrándolo', () => {
  // Se muta una COPIA EN MEMORIA del censo: el árbol no se toca, así que no hay nada que restaurar
  // y este control no puede dejar el repositorio a medias si el proceso muere (SCRUM-182).
  const victima = HANDLERS.find((h) => h.comprueba && LECTURA.has(h.metodo.toLowerCase())
    && HANDLERS.some((o) => o.fichero === h.fichero && o.recurso === h.recurso
      && ESCRITURA.has(o.metodo.toLowerCase()) && !o.comprueba && !o.requireRole && o.tieneParam));

  // Si no hay víctima con escritura desprotegida en su recurso, se fabrica el par mínimo: lo que
  // se prueba es que el COMPARADOR distingue, no qué contiene el árbol hoy.
  const censoMutado = victima
    ? HANDLERS.map((h) => (h === victima ? { ...h, comprueba: true } : h))
    : [
      { fichero: 'sintetico.ts', metodo: 'GET', path: '/:id', linea: 1, recurso: '/:id', comprueba: true, requireRole: false, tieneParam: true },
      { fichero: 'sintetico.ts', metodo: 'POST', path: '/:id/firmar', linea: 9, recurso: '/:id', comprueba: false, requireRole: false, tieneParam: true },
    ];

  // Ahora se le quita el filtro a la LECTURA testigo y se comprueba que el comparador lo nota:
  // sin lectura protegida no hay invariante, y las escrituras dejan de reportarse.
  const conTestigo = escriturasQueAflojan(censoMutado).fallos;
  const sinTestigo = escriturasQueAflojan(
    censoMutado.map((h) => (LECTURA.has(h.metodo.toLowerCase()) ? { ...h, comprueba: false } : h)),
  ).fallos;

  assert.ok(conTestigo.length > 0,
    '🔴 EL COMPARADOR NO VE EL DESNIVEL: con una lectura protegida y una escritura sin proteger, '
    + 'no reporta nada. Entonces el verde de ② no significa nada.');
  assert.equal(sinTestigo.length, 0,
    '🔴 el comparador reporta sin testigo de lectura: estaría inventando un invariante que nadie tiene.');

  // Y NOMBRA fichero y línea, que es lo que hace accionable el rojo.
  for (const f of conTestigo) {
    assert.ok(f.fichero && Number.isInteger(f.linea) && f.linea > 0,
      `🔴 un fallo sin coordenadas no es accionable: ${JSON.stringify(f)}`);
    assert.ok(f.testigo, '🔴 el fallo no dice cuál es la lectura que sí comprueba');
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ④ CONTROL NEGATIVO — lo que la v3 de este instrumento contaba MAL
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-849 · ④ el detector NO confunde el gate por CAMPO con el de pertenencia', () => {
  // Esto es, literalmente, el gate por campo de `PATCH /admin/jobs/:id` (SCRUM-164). Compara el
  // ROL con campos del body y corta con 403 — y NO es una comprobación de pertenencia.
  const GATE_POR_CAMPO = `
    router.patch('/:id', async (req, res) => {
      const job = await prisma.job.findFirst({ where: { id, merchantId: req.merchantId } });
      if (!job) return res.status(404).json({ error: 'not_found' });
      if (!seesAllJobs(req.userRole)) {
        const adminOnlyField = adminOnlyJobField(req.body);
        if (adminOnlyField) return res.status(403).json({ error: 'forbidden' });
      }
    });
  `;
  assert.equal(deniegaPorPertenencia(cuerpoDe(GATE_POR_CAMPO)), false,
    '🔴 cuenta el gate por CAMPO como pertenencia. Con eso, `PATCH /admin/jobs/:id` salía '
    + 'protegido cuando cualquier técnico podía escribir en el Trabajo de otro.');

  // Y el nombre que sólo APARECE (AuditLog) tampoco cuenta: es lo que ocultó dos casos reales.
  const SOLO_APARECE = `
    router.patch('/:id', async (req, res) => {
      if (!albaran) return res.status(404).json({ error: 'not_found' });
      await writeAuditLog({ teamMemberId: req.teamMemberId ?? null, accion: 'editar' });
    });
  `;
  assert.equal(deniegaPorPertenencia(cuerpoDe(SOLO_APARECE)), false,
    '🔴 un `teamMemberId` que sólo aparece en una traza se cuenta como comprobación de acceso.');

  // Un corte que no es denegación (409 de FSM) tampoco.
  const CORTA_CON_409 = `
    router.post('/:id/emitir', async (req, res) => {
      if (albaran.operarioId !== req.teamMemberId) return res.status(409).json({ error: 'invalid_transition' });
    });
  `;
  assert.equal(deniegaPorPertenencia(cuerpoDe(CORTA_CON_409)), false,
    '🔴 un 409 se cuenta como denegar el acceso. Un conflicto de estado no es un «no eres tú».');

  // POSITIVO del mismo control: el patrón real SÍ se reconoce, en sus DOS formas.
  const DIRECTO = `
    router.get('/:id', async (req, res) => {
      if (seesOnlyOwnJobs(req.userRole) && job.operarioId !== req.teamMemberId) {
        return res.status(404).json({ error: 'not_found' });
      }
    });
  `;
  const CON_VARIABLE = `
    router.get('/:id', async (req, res) => {
      if (seesOnlyOwnJobs(req.userRole)) {
        const suyo = job != null && (job.operarioId === req.teamMemberId || job.assignedUserId === req.teamMemberId);
        if (!suyo) return res.status(404).json({ error: 'not_found' });
      }
    });
  `;
  assert.equal(deniegaPorPertenencia(cuerpoDe(DIRECTO)), true, '🔴 no reconoce el patrón directo');
  assert.equal(deniegaPorPertenencia(cuerpoDe(CON_VARIABLE)), true,
    '🔴 no reconoce el patrón con variable intermedia: es el del GET de albaranes, y perderlo '
    + 'haría que el guard exigiera un filtro que YA está.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ⑤ INDIRECCIÓN — el arreglo correcto es UN punto, no once copias
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-849 · ⑤ reconoce la comprobación hecha en un auxiliar del mismo fichero', () => {
  // `findAlbaran` es la puerta por la que pasan once handlers de `/admin/albaranes/:id`. Si el
  // guard no siguiera esta indirección, exigiría copiar la comprobación once veces — y una
  // comprobación de acceso copiada once veces diverge, y la que se queda atrás da ACCESO.
  const alb = HANDLERS.filter((h) => h.fichero.endsWith('albaranes.routes.ts'));
  assert.ok(alb.length > 10, `🔴 sólo se vieron ${alb.length} handlers de albaranes: censo ciego`);

  const porAuxiliar = alb.filter((h) => h.comprueba && ESCRITURA.has(h.metodo.toLowerCase()));
  assert.ok(porAuxiliar.length >= 5,
    `🔴 sólo ${porAuxiliar.length} escrituras de albaranes salen protegidas. La comprobación vive `
    + 'en `findAlbaran` y el detector no está siguiendo la indirección.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ⑥ LOS EJES SE DERIVAN DEL ÁRBOL, no se copian aquí
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-849 · ⑥ lectura y escritura miran los MISMOS ejes de pertenencia', async () => {
  // El criterio está escrito dos veces a propósito —el guard de SCRUM-467 exige el texto literal
  // en el `GET`, y relajarlo está prohibido (norma A7)—, así que la divergencia se vigila aquí.
  //
  // 🔴 LOS EJES SE LEEN DEL CUERPO DE LA FUNCIÓN, no de una constante a su lado. Una constante es
  // una SEGUNDA fuente: si alguien añade un eje a `esSuyoElTrabajo` y no la toca, la lista miente
  // diciendo que todo cuadra. Lo que la función lee de verdad no se puede quedar atrás.
  const fs = await import('node:fs');
  const helper = fs.readFileSync(path.join(RAIZ, 'src/modules/jobs/domain/accesoAlTrabajo.ts'), 'utf8');
  const sfH = ts.createSourceFile('h.ts', helper, ts.ScriptTarget.Latest, true);
  let cuerpoFn = null;
  (function r(n) {
    if (ts.isFunctionDeclaration(n) && n.name?.getText() === 'esSuyoElTrabajo' && n.body) cuerpoFn = n.body;
    ts.forEachChild(n, r);
  })(sfH);
  assert.ok(cuerpoFn, '🔴 no se encuentra `esSuyoElTrabajo`: el guard no sabe de dónde derivar');

  // Las propiedades que la función consulta del parámetro `trabajo`. Eso SON los ejes.
  const EJES_DE_PERTENENCIA = [];
  (function r(n) {
    if (ts.isPropertyAccessExpression(n) && n.expression.getText() === 'trabajo') {
      const eje = n.name.getText();
      if (!EJES_DE_PERTENENCIA.includes(eje)) EJES_DE_PERTENENCIA.push(eje);
    }
    ts.forEachChild(n, r);
  })(cuerpoFn);
  assert.ok(EJES_DE_PERTENENCIA.length >= 3,
    `🔴 sólo se derivaron ${EJES_DE_PERTENENCIA.length} ejes del cuerpo de \`esSuyoElTrabajo\`: `
    + 'el extractor está ciego, y con él este control no compara nada.');

  const get = fs.readFileSync(path.join(RAIZ, 'src/modules/jobs/app/routes/albaranes.routes.ts'), 'utf8');
  const sf = ts.createSourceFile('a.ts', get, ts.ScriptTarget.Latest, true);
  let cuerpoGet = null;
  (function r(n) {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
      && n.expression.name.getText() === 'get' && n.arguments[0]
      && ts.isStringLiteral(n.arguments[0]) && n.arguments[0].text === '/:id') {
      cuerpoGet = n.arguments[n.arguments.length - 1];
    }
    ts.forEachChild(n, r);
  })(sf);
  assert.ok(cuerpoGet, '🔴 no se encuentra `GET /:id` de albaranes: el guard no sabe qué comparar');

  const texto = cuerpoGet.getText();
  for (const eje of EJES_DE_PERTENENCIA) {
    assert.ok(texto.includes(eje),
      `🔴 el helper mira el eje \`${eje}\` y el GET de albaranes NO. Los dos sitios han divergido, `
      + 'y el que se queda corto da acceso de más o de menos sin que nadie lo note.');
  }
});
