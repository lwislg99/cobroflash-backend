// tests/scrum767-portal-token.test.mjs — SCRUM-767
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// `customer.portalToken`: quién lo escribe, quién lo lee sin curarlo, y si la cura aguanta
//
// El censo de SCRUM-761 declaró el hueco y **no lo arregló a propósito**, porque no había
// víctima viva: «el alta real lo escribe; el sembrador no; lo cura `ensurePortalToken` bajo
// demanda». Este fichero comprueba las dos mitades de esa frase.
//
// ── 🔴 LA VÍCTIMA EXISTE, Y ESTÁ MEDIDA ─────────────────────────────────────────────────
//
// En `yaqu_dev_javier` el 6-sep-2026, **sólo lectura**: 14 clientes, **11 sin `portalToken`
// (79 %)** — y los SIETE del merchant demo entre ellos.
//
// Y las dos pantallas del mismo cliente NO se comportan igual:
//   · LISTA (`customersView.js:600`): el botón «Portal» se pinta SIEMPRE y al pulsarlo llama a
//     `GET /admin/customers/:id/portal-url`, que **cura** con `ensurePortalToken`.
//   · FICHA 360 (`customerDetailView.js:76`): el botón «🔗 Portal» se pinta **sólo si
//     `portalUrl`**, que sale de `GET /admin/customers/:id/detail` leyendo la columna EN CRUDO.
//     Sin token, el botón **no existe** — y en el demo eso es en los siete clientes.
//
// ── LO QUE ARREGLA ESTE TICKET, Y LO QUE NO ─────────────────────────────────────────────
// Arregla el SEMBRADOR: pasa a dar de alta por el camino real (`createCustomer`), escalón 1,
// igual que SCRUM-761 con el catálogo. **NO se rellena el campo a mano**: eso sería una segunda
// copia del alta y volvería a quedarse corta a la siguiente columna derivada.
//
// ⚠️ Y NO CIERRA EL AGUJERO ENTERO — medido abajo: hay **dos caminos de PRODUCCIÓN** que también
// crean clientes sin token. Se DECLARAN aquí y no se tocan (fuera del alcance de este encargo).
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url'; // NUNCA `new URL().pathname`: no decodifica (SCRUM-730)
import ts from 'typescript';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(RAIZ, 'src');
const CURA = 'ensurePortalToken';

const fuentesTs = (d, out = []) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) fuentesTs(p, out);
    else if (e.name.endsWith('.ts')) out.push(p);
  }
  return out;
};
const rel = (p) => path.relative(RAIZ, p).split(path.sep).join('/');

// ═════════════════════════════════════════════════════════════════════════════════════════
// 1 · EL CENSO · ¿quién toca `portalToken`, y pasa por la cura?
//
// Derivado por AST, no leído a ojo. Cada aparición se clasifica por **dónde vive**, no por el
// fichero: la misma columna es una cosa en un `where` (buscar POR el token) y otra en un
// `select` (leer EL token de un cliente), y confundirlas daría un censo que no dice nada.
// ═════════════════════════════════════════════════════════════════════════════════════════

/** La función que envuelve a un nodo, o `null`. Para saber si la aparición vive DENTRO de la cura. */
function funcionEnvolvente(n, sf) {
  for (let p = n.parent; p; p = p.parent) {
    if (ts.isFunctionDeclaration(p) && p.name) return p.name.getText(sf);
    if (ts.isVariableDeclaration(p) && p.name && ts.isIdentifier(p.name)) return p.name.text;
  }
  return null;
}

/** La clave de Prisma bajo la que cuelga la aparición: `select`, `where`, `data`… o `null`. */
function claveDePrisma(n, sf) {
  for (let p = n.parent; p; p = p.parent) {
    if (ts.isPropertyAssignment(p) && p.name) {
      const k = p.name.getText(sf);
      if (['select', 'where', 'data', 'omit'].includes(k)) return k;
    }
  }
  return null;
}

/**
 * Cada aparición de `portalToken` en `src/`, clasificada.
 *
 * `clase`:
 *   · `cura`      — vive dentro de `ensurePortalToken`. Es el CONTROL POSITIVO del censo.
 *   · `escritura` — cuelga de un `data:`. Escribe el token.
 *   · `busqueda`  — cuelga de un `where:`. Busca POR el token; un cliente sin token simplemente
 *                   no se encuentra, que es lo correcto: no tiene portal.
 *   · `lectura`   — todo lo demás: LEE el token de un cliente **sin curarlo**. Candidato a víctima.
 *   · `ilegible`  — no se supo clasificar. NO se da por buena: el censo falla declarándose ciego.
 */
function censoPortalToken() {
  const out = [];
  for (const p of fuentesTs(SRC)) {
    const codigo = fs.readFileSync(p, 'utf8');
    if (!codigo.includes('portalToken')) continue;
    const sf = ts.createSourceFile(p, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const visitar = (n) => {
      const esNombre = (ts.isPropertyAssignment(n) && n.name && n.name.getText(sf) === 'portalToken')
        || (ts.isShorthandPropertyAssignment(n) && n.name.getText(sf) === 'portalToken')
        || (ts.isPropertyAccessExpression(n) && n.name.getText(sf) === 'portalToken');
      if (esNombre) {
        const fn = funcionEnvolvente(n, sf);
        const clave = claveDePrisma(n, sf);
        const clase = fn === CURA ? 'cura'
          : clave === 'data' ? 'escritura'
            : clave === 'where' ? 'busqueda'
              : clave === 'select' || ts.isPropertyAccessExpression(n) ? 'lectura'
                : 'ilegible';
        out.push({
          fichero: rel(p),
          linea: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1,
          fn, clave, clase,
        });
      }
      ts.forEachChild(n, visitar);
    };
    ts.forEachChild(sf, visitar);
  }
  return out;
}

test('SCRUM-767 · SUELO + ✅ CONTROL POSITIVO: el censo ENCUENTRA el camino que SÍ cura', () => {
  const c = censoPortalToken();

  assert.ok(
    c.length > 0,
    '🔴 CENSO CIEGO: cero apariciones de `portalToken` en src/. Si la columna cambió de nombre o '
      + '`src/` se movió, este censo dejó de mirar y su «no hay lecturas directas» no vale nada.',
  );
  // El control positivo: tiene que ver la cura. Un censo que no encuentra lo que SÍ existe no
  // puede afirmar nada sobre lo que no.
  const cura = c.filter((x) => x.clase === 'cura');
  assert.ok(
    cura.length >= 2,
    `🔴 CENSO CIEGO: no veo las apariciones dentro de \`${CURA}\` (encontradas: ${cura.length}). `
      + `Clasificadas: ${JSON.stringify(c.map((x) => `${x.fichero}:${x.linea}[${x.clase}]`))}`,
  );
  assert.ok(
    cura.every((x) => x.fichero === 'src/modules/system/customerAdmin.ts'),
    '🔴 la cura ha cambiado de fichero: el censo apuntaba a `customerAdmin.ts`',
  );

  // Y una aparición que no se sepa clasificar NO se da por buena.
  const ilegibles = c.filter((x) => x.clase === 'ilegible').map((x) => `${x.fichero}:${x.linea}`);
  assert.deepEqual(
    ilegibles, [],
    '🔴 CENSO CIEGO: hay apariciones de `portalToken` que no sé clasificar:\n    · '
      + ilegibles.join('\n    · ')
      + '\n\n  No se cuentan como seguras ni como víctimas: no se han podido medir. Enséñale al '
      + 'censo a leerlas — no le bajes el listón.',
  );
});

/**
 * 🔴 LAS LECTURAS DIRECTAS DECLARADAS, con su motivo. Una nueva hace caer el test.
 *
 * `customersAdmin.routes.ts` · `GET /:id/detail` — la ficha 360 lee la columna EN CRUDO y, si
 * está vacía, devuelve `portalUrl: null`. El front entonces **no pinta el botón del portal**
 * (`customerDetailView.js:76`), mientras la LISTA sí lo pinta porque su camino cura.
 *
 * NO se arregla aquí: convertir un `GET` de lectura en una escritura es una decisión de diseño
 * —el árbol ya tiene una ruta aparte para curar— y la alternativa (que la ficha llame a
 * `/portal-url` como hace la lista) es de pantalla. Va con su propuesta en la entrada de máster.
 */
const LECTURAS_DIRECTAS_DECLARADAS = ['src/modules/system/app/routes/customersAdmin.routes.ts'];

test('SCRUM-767 · 🔴 EL CENSO QUE DECIDE: qué lee el token SIN pasar por la cura', () => {
  const directas = censoPortalToken().filter((x) => x.clase === 'lectura');
  const ficheros = [...new Set(directas.map((x) => x.fichero))];

  assert.deepEqual(
    ficheros, LECTURAS_DIRECTAS_DECLARADAS,
    '🔴 HAY UNA LECTURA DIRECTA DE `portalToken` NO DECLARADA:\n    · '
      + directas.map((x) => `${x.fichero}:${x.linea} (en ${x.fn ?? 'nivel superior'})`).join('\n    · ')
      + `\n\n  Quien lee la columna en crudo ve \`null\` en un cliente sin token y degrada en\n`
      + '  silencio; quien pasa por `' + CURA + '` lo cura al vuelo. Dos pantallas del MISMO\n'
      + '  cliente dando respuestas distintas es el defecto de este ticket.\n\n'
      + '  Si tu lectura es legítima, decláralo aquí con su motivo — no lo dejes sin nombre.',
  );
  // Y que siga habiendo alguna: si el día de mañana no hay ninguna, esta lista sobra.
  assert.ok(
    directas.length > 0,
    '🔴 ya no hay lecturas directas: borra `LECTURAS_DIRECTAS_DECLARADAS` en vez de dejar una '
      + 'declaración que no declara nada.',
  );
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 2 · EL OTRO LADO · quién CREA clientes, y quién les pone token
//
// El ticket decía «el alta real lo escribe; EL SEMBRADOR NO». Medido: el sembrador no era el
// único — hay DOS caminos de producción que tampoco.
// ═════════════════════════════════════════════════════════════════════════════════════════

/** Cada `customer.create(...)` de `src/`, y si su `data` pone `portalToken`. */
function censoAltasEnSrc() {
  const out = [];
  for (const p of fuentesTs(SRC)) {
    const codigo = fs.readFileSync(p, 'utf8');
    if (!codigo.includes('customer.create')) continue;
    const sf = ts.createSourceFile(p, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const visitar = (n) => {
      if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
          && n.expression.name.getText(sf) === 'create'
          && /(^|\.)customer$/.test(n.expression.expression.getText(sf))) {
        const arg = n.arguments[0];
        let ponToken = false;
        if (arg && ts.isObjectLiteralExpression(arg)) {
          const data = arg.properties.find((x) => x.name && x.name.getText(sf) === 'data');
          if (data && ts.isPropertyAssignment(data)) ponToken = /portalToken/.test(data.getText(sf));
        }
        out.push({
          fichero: rel(p),
          linea: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1,
          ponToken,
        });
      }
      ts.forEachChild(n, visitar);
    };
    ts.forEachChild(sf, visitar);
  }
  return out;
}

/**
 * 🔴 LOS CAMINOS DE PRODUCCIÓN QUE CREAN CLIENTES **SIN** TOKEN — declarados, no arreglados.
 *
 * Están fuera del alcance de este encargo («si aparece uno nuevo, lo DECLARAS y no lo
 * arreglas»), pero se escriben aquí para que el siguiente que mire no tenga que volver a
 * descubrirlos, y para que uno NUEVO haga caer este test.
 */
const ALTAS_SIN_TOKEN_DECLARADAS = [
  // El bot de WhatsApp, cuando un número desconocido escribe a un merchant con perfil público.
  'src/modules/whatsappBot/domain/botFlow.service.ts',
  // El alta de cliente que viene dentro de una petición de cobro.
  'src/modules/billing/app/routes/charges.routes.ts',
];

test('SCRUM-767 · el alta REAL pone token, y las que no lo ponen están DECLARADAS', () => {
  const altas = censoAltasEnSrc();
  assert.ok(altas.length >= 3, `🔴 CENSO CIEGO: sólo ${altas.length} \`customer.create\` en src/`);

  // ✅ CONTROL POSITIVO: el alta real SÍ lo pone. Si el censo no lo viera, su «éstas no lo
  // ponen» sería indistinguible de «no sé leer el `data`».
  const real = altas.find((x) => x.fichero === 'src/modules/system/customerAdmin.ts');
  assert.ok(real, '🔴 CENSO CIEGO: no encuentro el alta real en `customerAdmin.ts`');
  assert.equal(real.ponToken, true, '🔴 el alta real ha dejado de escribir `portalToken`');

  const sinToken = [...new Set(altas.filter((x) => !x.ponToken).map((x) => x.fichero))].sort();
  assert.deepEqual(
    sinToken, [...ALTAS_SIN_TOKEN_DECLARADAS].sort(),
    '🔴 HAY UN ALTA DE CLIENTE SIN `portalToken` NO DECLARADA:\n    · ' + sinToken.join('\n    · ')
      + '\n\n  Un cliente que nace sin token depende de que alguien pase por `' + CURA + '`\n'
      + '  para tenerlo, y hoy la ficha 360 NO pasa. Si el alta nueva es legítima, decláralo\n'
      + '  aquí; si no, que llame al alta real (`createCustomer`).',
  );
});

test('SCRUM-767 · el SEMBRADOR da de alta por el camino real, no con un `create` a pelo', () => {
  const ruta = path.join(RAIZ, 'scripts/seed-demo.mjs');
  const codigo = fs.readFileSync(ruta, 'utf8');
  const sf = ts.createSourceFile('seed-demo.mjs', codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);

  const llamadas = [];
  const visitar = (n) => {
    if (ts.isCallExpression(n)) llamadas.push(n.expression.getText(sf));
    ts.forEachChild(n, visitar);
  };
  ts.forEachChild(sf, visitar);

  // ✅ SUELO: el censo ve llamadas. Un cero aquí sería «no supe leer», no «no las hay».
  assert.ok(llamadas.length > 20, `🔴 ESCÁNER CIEGO: sólo ${llamadas.length} llamadas en el sembrador`);

  assert.ok(
    llamadas.includes('createCustomer'),
    '🔴 el sembrador no llama a `createCustomer`. Sembrar con un `create` a pelo deja el '
      + 'catálogo de clientes del DEMO sin `portalToken` — y el demo es lo que se le enseña a '
      + 'quien está decidiendo si paga.',
  );
  assert.ok(
    !llamadas.includes('prisma.customer.create'),
    '🔴 ha vuelto el `prisma.customer.create` a pelo en el sembrador. Es el escalón 1 de '
      + 'SCRUM-761: se llama al alta de verdad, no se copia lo que hace.',
  );
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 3 · LAS MUTACIONES · las tres caen sobre el FUENTE, que es lo que estos censos leen
// ═════════════════════════════════════════════════════════════════════════════════════════

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // ① Vuelve el `create` a pelo al sembrador: el defecto de este ticket, otra vez.
    fichero: 'scripts/seed-demo.mjs',
    de: '    customers.push(await createCustomer(DEMO_ID, c));',
    a: '    customers.push(await prisma.customer.create({ data: { merchantId: DEMO_ID, ...c } }));',
    cae: 'SCRUM-767 · el SEMBRADOR da de alta por el camino real, no con un `create` a pelo',
  },
  {
    // ② El alta REAL deja de poner el token. Sin este control, el censo de altas no distinguiría
    // «éstas no lo ponen» de «no sé leer el `data`».
    fichero: 'src/modules/system/customerAdmin.ts',
    de: '    data: { ...normalizarEtiquetas(normalizarIdentificadores(data)), merchantId, portalToken: generatePortalToken() },',
    a: '    data: { ...normalizarEtiquetas(normalizarIdentificadores(data)), merchantId },',
    cae: 'SCRUM-767 · el alta REAL pone token, y las que no lo ponen están DECLARADAS',
  },
  {
    // ③ Nace una lectura directa NUEVA, en un fichero que no está declarado. Es exactamente la
    // forma en que el defecto se extendería sin que nadie se entere.
    fichero: 'src/modules/system/app/routes/customerPortal.routes.ts',
    de: '    where: { portalToken: token },',
    a: '    select: { portalToken: true },',
    cae: 'SCRUM-767 · 🔴 EL CENSO QUE DECIDE: qué lee el token SIN pasar por la cura',
  },
];

test('SCRUM-767 · EL LECTOR OFICIAL me ve: las tres declaraciones, con sus cuatro campos', async () => {
  const { mutacionesDeclaradas } = await import('../scripts/meta-guard-mutaciones.mjs');
  const yo = fileURLToPath(import.meta.url);
  const vistas = mutacionesDeclaradas(fs.readFileSync(yo, 'utf8'), path.basename(yo));

  assert.equal(
    vistas.length, MUTACIONES_QUE_ME_TUMBAN.length,
    `🔴 declaro ${MUTACIONES_QUE_ME_TUMBAN.length} y el lector oficial ve ${vistas.length}. Una `
      + 'declaración que el corredor no lee es una promesa que no comprueba nadie.',
  );
  assert.deepEqual(
    vistas.map((m) => ({ fichero: m.fichero, de: m.de, a: m.a, cae: m.cae })),
    MUTACIONES_QUE_ME_TUMBAN.map((m) => ({ fichero: m.fichero, de: m.de, a: m.a, cae: m.cae })),
    '🔴 el lector oficial lee algo distinto de lo que está escrito aquí',
  );
  for (const m of MUTACIONES_QUE_ME_TUMBAN) {
    assert.ok(
      fs.readFileSync(path.join(RAIZ, m.fichero), 'utf8').includes(m.de),
      `🔴 el ancla ya no está en ${m.fichero}: «${m.de.trim().slice(0, 60)}…»`,
    );
  }
});
