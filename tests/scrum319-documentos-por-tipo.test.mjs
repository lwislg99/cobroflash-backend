// SCRUM-319 (G4) · DOCUMENTOS SE PARTE POR TIPO.
//
// Sin gate: el reparto es puro y se importa; los tipos se DERIVAN del AST de la vista. Ni BD, ni
// red, ni navegador.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL CENSO SE DERIVA PORQUE LA LISTA ESCRITA A MANO YA FALLÓ
//
// El ticket enumeraba cuatro tipos y esa lista salía de una captura. Derivados del código son
// CINCO, y ni son esos cuatro ni están todos: `gastos` no existe en esta vista, y `factura` y
// `rectificativa` sí y el ticket no las nombra. Por eso aquí no hay ninguna lista de tipos escrita
// a mano: se sacan del AST y se cruzan con la tabla de destinos.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { soloEjecutable } from './_guard-texto.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const require_ = createRequire(import.meta.url);
const leer = (p) => fs.readFileSync(path.join(RAIZ, p), 'utf8');

const VISTA_TXT = leer('public/dashboard/js/jobDetailView.js');
const VISTA = soloEjecutable(VISTA_TXT, { almohadillaEsComentario: false });
const REPARTO = require_(path.join(RAIZ, 'public/dashboard/js/jobDocsReparto.js'));
const RAIL = require_(path.join(RAIZ, 'public/dashboard/js/jobRailBlocks.js'));

// ── EL CENSO DERIVADO ───────────────────────────────────────────────────────────────────
//
// Un tipo entra en la pila por un `docs.push({... tipo: X ...})`. Se leen del AST los valores de
// esa propiedad: literales (`'albaran'`) y llamadas (`tipoDeFactura(inv)`, que se expande con los
// valores que esa función puede devolver, también por AST).
function tiposDerivados() {
  const sf = ts.createSourceFile('v.js', VISTA_TXT, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const tipos = new Set();
  let vioPush = 0;

  // Los `return 'literal'` de `tipoDeFactura`, en su propio módulo.
  const sfR = ts.createSourceFile('r.js', leer('public/dashboard/js/jobDocsReparto.js'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const deFactura = new Set();
  const enFuncion = (n, dentro) => {
    const aqui = dentro || (ts.isFunctionDeclaration(n) && n.name && n.name.getText(sfR) === 'tipoDeFactura');
    if (aqui && ts.isReturnStatement(n) && n.expression && ts.isStringLiteral(n.expression)) {
      deFactura.add(n.expression.text);
    }
    ts.forEachChild(n, (h) => enFuncion(h, aqui));
  };
  enFuncion(sfR, false);

  const visita = (n) => {
    if (ts.isCallExpression(n) && /docs\.push$/.test(n.expression.getText(sf))) {
      vioPush++;
      const arg = n.arguments[0];
      if (arg && ts.isObjectLiteralExpression(arg)) {
        for (const p of arg.properties) {
          if (!ts.isPropertyAssignment(p) || p.name.getText(sf) !== 'tipo') continue;
          const v = p.initializer;
          if (ts.isStringLiteral(v)) tipos.add(v.text);
          else if (ts.isCallExpression(v) && /tipoDeFactura$/.test(v.expression.getText(sf))) {
            for (const t of deFactura) tipos.add(t);
          } else tipos.add(`[no derivable: ${v.getText(sf)}]`);
        }
      }
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return { tipos: [...tipos].sort(), vioPush, deFactura: [...deFactura].sort() };
}

test('SCRUM-319 · SUELO del censo: el derivador ve las inserciones y los subtipos', () => {
  const { tipos, vioPush, deFactura } = tiposDerivados();
  assert.ok(
    vioPush >= 3,
    `🔴 ESCÁNER CIEGO: el derivador ve ${vioPush} inserciones en la pila y hay al menos 3 ` +
      '(presupuesto, albaranes, facturas). «No hay tipos» y «no supe mirar» son el mismo número y ' +
      'significan lo contrario.',
  );
  assert.ok(
    deFactura.length >= 3,
    `🔴 ESCÁNER CIEGO: \`tipoDeFactura\` devuelve ${deFactura.length} tipos y debería devolver 3. ` +
      'Si el derivador no los expande, un justificante y una factura contarían como el mismo tipo.',
  );
  assert.ok(tipos.length >= 5, `🔴 solo se derivaron ${tipos.length} tipos: ${tipos.join(', ')}`);
  assert.ok(
    !tipos.some((t) => t.startsWith('[no derivable')),
    `🔴 hay una inserción cuyo tipo no se puede derivar: ${tipos.filter((t) => t.startsWith('[no')).join(', ')}. ` +
      'Un tipo que el guard no ve es un tipo sin sección que nadie va a echar de menos.',
  );
});

test('SCRUM-319 · TODO tipo derivado tiene sección asignada — y falla si aparece uno nuevo', () => {
  const { tipos } = tiposDerivados();
  const sinDestino = tipos.filter((t) => !(t in REPARTO.DESTINO_POR_TIPO));
  assert.deepEqual(
    sinDestino, [],
    `🔴 HAY UN TIPO DE DOCUMENTO EN LA PILA SIN DESTINO EN LA TABLA: ${sinDestino.join(', ')}.\n\n` +
      '  Es el caso que el ticket manda reportar y no colocar por cuenta propia (regla 9): un tipo\n' +
      '  nuevo se cuela en la pantalla y acaba en cualquier sitio, o en ninguno.',
  );
  // Y al revés: un destino declarado que ya no recibe ningún tipo es una sección fantasma.
  const tiposConDestino = new Set(Object.values(REPARTO.DESTINO_POR_TIPO));
  for (const d of tiposConDestino) {
    assert.ok(REPARTO.DESTINOS_DOCUMENTO.includes(d), `🔴 el destino «${d}» no está declarado`);
  }
});

// ── EL TEST QUE MÁS IMPORTA ─────────────────────────────────────────────────────────────

/** La pila TAL Y COMO SE LLENABA ANTES: un descriptor por documento, con su clave estable. */
function pilaOriginal(job) {
  const items = [];
  if (job.quote) items.push({ tipo: 'presupuesto', clave: 'presupuesto:' + job.quote.id });
  for (const alb of job.albaranes || []) items.push({ tipo: 'albaran', clave: 'albaran:' + alb.id });
  for (const inv of job.invoices || []) {
    const t = REPARTO.tipoDeFactura(inv);
    items.push({
      tipo: t, clave: t + ':' + inv.id,
      rectificaClave: inv.rectifiesId != null ? 'factura:' + inv.rectifiesId : null,
    });
  }
  return items;
}

const jobCompleto = () => ({
  id: 7,
  quote: { id: 2, number: 2, currency: 'EUR' },
  albaranes: [{ id: 11 }, { id: 12 }, { id: 13 }],
  invoices: [
    { id: 21, number: 'J-20260629-6981', type: 'JUST' },
    { id: 22, number: 'J-20260701-0002' },          // justificante por el número, sin `type`
    { id: 23, number: '2026-CF-001', type: 'F1' },  // factura
    { id: 24, number: '2026-R1-001', type: 'R1', rectifiesId: 23 }, // rectificativa DE la 23
  ],
  totalAceptado: 853.05, totalCobrado: 853.05,
});

test('SCRUM-319 · NADA SE PIERDE: la unión de las secciones + rail es EXACTAMENTE la pila', () => {
  const job = jobCompleto();
  const antes = pilaOriginal(job);
  assert.ok(
    antes.length >= 5,
    `🔴 ESCÁNER CIEGO: la pila de prueba tiene ${antes.length} documentos. Con una pila casi vacía ` +
      'la comparación de conjuntos es cierta por trivial y no prueba nada.',
  );

  const reparto = REPARTO.repartirDocumentos(antes);
  const despues = REPARTO.clavesRepartidas(reparto);

  const setAntes = [...new Set(antes.map((d) => d.clave))].sort();
  const setDespues = [...new Set(despues)].sort();

  const perdidos = setAntes.filter((c) => !setDespues.includes(c));
  const aparecidos = setDespues.filter((c) => !setAntes.includes(c));

  assert.deepEqual(
    perdidos, [],
    `🔴 SE HAN PERDIDO ${perdidos.length} DOCUMENTO(S) EN EL REPARTO: ${perdidos.join(', ')}.\n\n` +
      '  Es el peor resultado posible de esta tarea, y es MUDO: la pantalla se ve ordenada y el\n' +
      '  documento simplemente ya no está. Nadie lo echa de menos hasta que hace falta.',
  );
  assert.deepEqual(aparecidos, [], `🔴 el reparto INVENTA documentos que no estaban: ${aparecidos.join(', ')}`);
  assert.deepEqual(setDespues, setAntes, '🔴 el conjunto repartido no es exactamente el de la pila');
});

test('SCRUM-319 · un tipo desconocido NO se descarta: se ve y además avisa', () => {
  // La red y el aviso son dos cosas distintas. Si mañana entra un tipo nuevo, el guard tiene que
  // fallar (arriba) PERO la pantalla no puede tragárselo mientras tanto.
  const conRaro = pilaOriginal(jobCompleto()).concat([{ tipo: 'foto-suelta', clave: 'foto:99' }]);
  const reparto = REPARTO.repartirDocumentos(conRaro);
  assert.deepEqual(
    reparto.desconocidos.map((d) => d.clave), ['foto:99'],
    '🔴 un documento de tipo desconocido no llega a `desconocidos` — o se descartó (se perdió) o se ' +
      'coló en una sección que no le corresponde.',
  );
  assert.ok(
    REPARTO.clavesRepartidas(reparto).includes('foto:99'),
    '🔴 el desconocido no aparece entre las claves repartidas: se habría perdido en silencio.',
  );
  // Y la vista los pinta con el resto, no los tira.
  assert.ok(
    /reparto\.facturas\.concat\(reparto\.desconocidos\)/.test(VISTA),
    '🔴 la vista no pinta los desconocidos junto al resto: el guard avisaría y la pantalla, mientras ' +
      'tanto, perdería el documento.',
  );
});

// ── NINGUNA SECCIÓN VACÍA ───────────────────────────────────────────────────────────────

test('SCRUM-319 · ninguna sección se pinta vacía', () => {
  const vacio = REPARTO.repartirDocumentos([]);
  for (const d of REPARTO.DESTINOS_DOCUMENTO) {
    assert.deepEqual(vacio[d], [], `🔴 el destino «${d}» produce contenido con la pila vacía`);
  }
  // La sección de «lo que queda» solo existe si queda algo: sin facturas ni desconocidos no se
  // crea una cabecera huérfana.
  assert.ok(
    /const restantes = [\s\S]{0,200}?if \(restantes\.length\) \{/.test(VISTA),
    '🔴 la sección de documentos restantes se monta sin comprobar que quede alguno: se publicaría ' +
      'un título con nada debajo.',
  );
});

// ── LOS DOS QUE SALEN DE LA PILA ────────────────────────────────────────────────────────

test('SCRUM-319 · los JUSTIFICANTES bajan al bloque DINERO — y las facturas NO', () => {
  const job = jobCompleto();
  const dinero = RAIL.bloqueDinero(job, (n, c) => `${Number(n).toFixed(2)} ${c || 'EUR'}`);
  assert.ok(dinero, '🔴 ESCÁNER CIEGO: no sale bloque DINERO con dinero y justificantes');

  const enlazados = dinero.lineas.filter((l) => l.invoiceId != null).map((l) => l.invoiceId).sort();
  assert.deepEqual(
    enlazados, [21, 22],
    '🔴 los justificantes no bajan al bloque DINERO enlazados (o baja algo que no es justificante). ' +
      'Se esperaban los dos: el que lo declara por `type` y el que solo lo dice en su número.',
  );
  // El criterio de B4, en la otra dirección: una FACTURA aquí sería el mismo error que ese ticket
  // arregló — dos documentos con significados legales distintos compartiendo sitio.
  for (const id of [23, 24]) {
    assert.ok(
      !enlazados.includes(id),
      `🔴 la factura/rectificativa ${id} está en el bloque DINERO junto a los justificantes.`,
    );
  }
});

test('SCRUM-319 · el PRESUPUESTO sale de la pila y vive en el rail', () => {
  assert.equal(REPARTO.DESTINO_POR_TIPO.presupuesto, 'rail-presupuesto');
  const p = RAIL.bloquePresupuesto(jobCompleto(), () => '24 jun');
  assert.ok(p && p.lineas[0].quoteId === 2, '🔴 el rail no enlaza el presupuesto: al salir de la pila ' +
    'se habría perdido el acceso al documento.');
});

// ── LA CLASIFICACIÓN ES UNA SOLA ────────────────────────────────────────────────────────

test('SCRUM-319 · el rótulo y el reparto clasifican con la MISMA función', () => {
  // Antes `jobDetDocLabel` era la única que sabía distinguir un justificante de una factura. Si el
  // reparto se hubiera escrito su propia copia de esa condición, un cambio en una de las dos
  // mandaría el mismo documento a dos sitios — o a ninguno.
  assert.ok(
    /JOBDET_DOC_ROTULO\[typeof tipoDeFactura === 'function' \? tipoDeFactura\(inv\)/.test(VISTA),
    '🔴 `jobDetDocLabel` volvió a clasificar por su cuenta: hay dos condiciones decidiendo lo mismo ' +
      'sobre documentos con significados legales distintos.',
  );
  assert.ok(
    !/inv\.type === 'JUST'/.test(VISTA),
    '🔴 la condición del justificante está DUPLICADA en la vista, además de en el módulo.',
  );
  // Suelo: que la función clasifique de verdad los tres casos.
  assert.equal(REPARTO.tipoDeFactura({ type: 'R1' }), 'rectificativa');
  assert.equal(REPARTO.tipoDeFactura({ number: 'J-1' }), 'justificante');
  assert.equal(REPARTO.tipoDeFactura({ number: '2026-CF-001' }), 'factura');
});

// ── LO QUE NO SE TOCA ───────────────────────────────────────────────────────────────────

test('SCRUM-319 · «Incluir precios en el parte» sigue intacto: ni movido ni renombrado', () => {
  // El ticket lo llamaba «Iniciar precio en el parte» y ese botón NO EXISTE: es una CASILLA, se
  // llama «Incluir precios en el parte» y escribe `modoValoracion` al crear el albarán. No se mueve
  // ni se renombra un control cuyo significado no está medido — esconder no es proteger.
  //
  // ⚠️ LA PRIMERA VERSIÓN DE ESTE TEST NO SALTABA. Comprobaba que el texto apareciera en el
  // fichero, y aparece DOS VECES (la casilla del alta y la del editor del albarán): al renombrar
  // una, la otra mantenía el verde. Un guard que se conforma con «existe en algún sitio» no
  // protege un control concreto — protege la palabra.
  const apariciones = (VISTA_TXT.match(/Incluir precios en el parte/g) || []).length;
  assert.equal(
    apariciones, 2,
    `🔴 la casilla «Incluir precios en el parte» aparece ${apariciones} veces y son 2 (el alta del ` +
      'albarán y su editor). Si una cambió de texto, se renombró un control cuyo significado no ' +
      'está medido — y esconder o renombrar no es lo mismo que entender.',
  );
  assert.ok(
    /valoradoLabel|valoradoCheck/.test(VISTA),
    '🔴 el control de la casilla ya no está donde estaba.',
  );
  // Y que sigue escribiendo lo que escribía: es lo que la hace intocable hasta medirla.
  assert.ok(
    /modoValoracion/.test(VISTA),
    '🔴 la casilla ya no gobierna `modoValoracion`: cambió lo que hace, no solo dónde está.',
  );
});

test('SCRUM-319 · las secciones del cuerpo están declaradas, con GASTOS vacía a propósito', () => {
  const s = REPARTO.SECCIONES_CUERPO;
  assert.ok(s.includes('que-falta-para-cobrar'), '🔴 falta el hueco declarado de G5');
  assert.ok(s.includes('albaranes'), '🔴 falta la sección ALBARANES (lo entregado)');
  assert.ok(s.includes('facturas'), '🔴 falta la sección FACTURAS (lo facturado)');
  // El ORDEN es el ciclo: qué falta → entregado → facturado → gastos. No es decorativo.
  // SCRUM-427 añade `notas` al FINAL. El cambio es deliberado y por eso se toca este contrato en
  // vez de esquivarlo: las cuatro primeras son el ciclo del dinero y `notas` no es un paso de ese
  // ciclo, es contexto — por eso va detrás y no en medio.
  assert.deepEqual(s, ['que-falta-para-cobrar', 'albaranes', 'facturas', 'gastos', 'notas'],
    '🔴 el orden de las secciones ya no es el del ciclo del Trabajo');
  assert.ok(
    s.includes('gastos'),
    '🔴 falta la sección GASTOS. Está declarada y VACÍA a propósito: en esta vista no hay ni un ' +
      'gasto —la pila nunca tuvo ninguno— y llenarla sería construir lo que no hay, no repartir lo ' +
      'que hay.',
  );
  // Y el suelo de esa afirmación: si un día la vista SÍ mete gastos en la pila, esto cae.
  assert.ok(
    !/docs\.push\([^)]*tipo:\s*'gasto/.test(VISTA),
    '🔴 ahora la pila SÍ lleva gastos: la sección GASTOS ya no puede quedarse vacía y este ticket ' +
      'daba por medido que no existían.',
  );
});

// ── LA RECTIFICATIVA, ANCLADA ───────────────────────────────────────────────────────────
//
// Suelta y ordenada por fecha como una fila más es **legalmente ilegible**: no dice a qué factura
// corrige. La normativa exige que una rectificativa identifique la factura rectificada, así que
// enseñarla sin su original no es un problema de maquetación.

test('SCRUM-319 · la RECTIFICATIVA cuelga de su original, nunca suelta', () => {
  const reparto = REPARTO.repartirDocumentos(pilaOriginal(jobCompleto()));

  assert.deepEqual(
    reparto.anclada.map((r) => r.clave), ['rectificativa:24'],
    '🔴 la rectificativa no queda anclada a su factura. Como fila suelta de una lista por fecha no ' +
      'dice a qué factura corrige — y la normativa exige que la identifique.',
  );
  assert.equal(reparto.anclada[0].rectificaClave, 'factura:23', '🔴 se ancló a otra factura');
  assert.ok(
    !reparto.facturas.some((f) => f.clave === 'rectificativa:24'),
    '🔴 la rectificativa está ADEMÁS suelta en la sección: se vería dos veces, y una de ellas mal.',
  );
  assert.deepEqual(reparto.huerfanas, [], '🔴 una rectificativa con original presente no puede ser huérfana');

  // La vista la anida de verdad, no solo la clasifica.
  assert.ok(
    /reparto\.anclada\.filter\(\(r\) => r\.rectificaClave === d\.clave\)/.test(VISTA),
    '🔴 la vista no cuelga las rectificativas de su fila: el reparto las separa y luego se pintan igual.',
  );
});

test('SCRUM-319 · una rectificativa SIN original en el Trabajo se ve igual, y avisa', () => {
  // Perderla sería peor que enseñarla mal: baja a la sección, visible, y queda anotada.
  const items = pilaOriginal(jobCompleto())
    .concat([{ tipo: 'rectificativa', clave: 'rectificativa:99', rectificaClave: 'factura:404' }]);
  const reparto = REPARTO.repartirDocumentos(items);

  assert.deepEqual(reparto.huerfanas.map((r) => r.clave), ['rectificativa:99'], '🔴 la huérfana no se anota');
  assert.ok(
    reparto.facturas.some((f) => f.clave === 'rectificativa:99'),
    '🔴 la rectificativa huérfana no se pinta en ninguna parte: se habría perdido.',
  );
  assert.ok(
    REPARTO.clavesRepartidas(reparto).filter((c) => c === 'rectificativa:99').length === 1,
    '🔴 la huérfana se cuenta dos veces: el test de «nada se pierde» daría rojo por su propia aritmética.',
  );
});

test('SCRUM-319 · el VÍNCULO llega del backend, no se deduce del número', () => {
  // `formatInvoiceNumber` conoce `rectifying`, pero eso es la SERIE del número, no el vínculo.
  // Deducir de «2026-CF-R-001» a qué factura corrige es adivinar.
  const rutas = leer('src/modules/jobs/app/routes/jobs.routes.ts');
  assert.ok(
    /rectifiesId: true/.test(rutas),
    '🔴 el serializer del Trabajo dejó de exponer `rectifiesId`: la pantalla no puede anclar la ' +
      'rectificativa y volvería a pintarla suelta.',
  );
  assert.ok(
    /rectifiesId: inv\.rectifiesId/.test(rutas),
    '🔴 `rectifiesId` se selecciona pero no se mapea a la respuesta: llega a la consulta y no al front.',
  );
  assert.ok(
    /rectificaClave: inv\.rectifiesId != null/.test(VISTA),
    '🔴 la vista no construye el ancla desde `rectifiesId`. Si la dedujera del número, estaría ' +
      'adivinando a qué factura corrige.',
  );
});
