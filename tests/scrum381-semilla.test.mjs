// tests/scrum381-semilla.test.mjs — SCRUM-381
//
// DOS GUARDS QUE ENTRAN CON EL VALOR `semilla`, Y EL SEGUNDO IMPORTA MÁS QUE EL VALOR.
//
// Contexto: `allocateInvoiceNumber` exige `camino` y `actor` desde SCRUM-207, y los dos
// sembradores se los pasaban VACÍOS. Un número sembrado quedaba en el AuditLog indistinguible de
// una emisión real. Decisión del asesor (6-ago-2026): se amplía `ActorTipo` con `semilla` y NO se
// toca `CaminoEmision` — `camino` contesta POR QUÉ VÍA se emitió, y un número sembrado sí sale por
// una vía real; lo distinto es QUIÉN LO PIDIÓ, y ése es el eje de `actor`.
//
//   ① NINGUNA RUTA REAL PUEDE ESCRIBIR `semilla`. Si mañana alguien lo usa para salir de un
//      apuro, el valor deja de significar nada y volvemos al punto de partida con más ruido.
//
//   ② EL SEMBRADOR SE NIEGA A ARRANCAR CONTRA PRODUCCIÓN. Ésta es la protección de verdad: el
//      problema de fondo nunca fue la etiqueta, era que un script de siembra pudiera escribir en
//      el AuditLog de una base real. La etiqueta hace DISTINGUIBLE el daño; esto lo impide.
//
// AST, no `grep`: un guard de texto se caza a sí mismo en la prosa que explica la prohibición —
// esta cabecera misma escribe `semilla` una docena de veces.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { DESTINOS_SEMBRABLES, PROD_HOST, STAGING_HOST, destinoSembrable } from '../scripts/_db-guard.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(RAIZ, 'src');

/** Todos los `.ts` del backend. El árbol, no una lista escrita a mano que se queda corta. */
function ficherosTs(dir = SRC, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) ficherosTs(p, acc);
    else if (e.name.endsWith('.ts')) acc.push(p);
  }
  return acc;
}

/**
 * Los `tipo: '<x>'` que ESCRIBE un fichero — propiedades de objeto, que es como se construye un
 * `ActorAudit`. NO cuenta la declaración del tipo (`type ActorTipo = … | 'semilla'`), que es un
 * literal de tipo y no un valor escrito: si la contara, el guard fallaría por su propia
 * definición y habría que exceptuarla, que es como se estropean estos guards.
 */
function actoresEscritos(fuente, fichero) {
  const sf = ts.createSourceFile(fichero, fuente, ts.ScriptTarget.Latest, true);
  const out = [];

  // ⚠️ Se recogen TODOS los literales del valor, no solo el caso `tipo: 'x'`. El primer intento
  // solo miraba `ts.isStringLiteral(initializer)` y el SUELO lo tumbó: `actorDeRequest` escribe
  // `tipo: t == null ? 'pro_propietario' : 'pro_equipo'`, un ternario, así que el analizador no
  // veía ni un solo `pro_propietario` en todo `src/` y habría dado por bueno «nadie escribe el
  // actor de siembra» sin ver nada. Es la tercera vez que un ternario ciega a un censo en este
  // repo (el de clases de SCRUM-378 fue igual), y aquí lo cazó el suelo, no el guard.
  //
  // Recoger de más es el lado correcto en el que equivocarse: si una rama de un ternario
  // escribiera el actor de siembra, el guard tiene que caer igual.
  //
  // ⚠️ Y el `{ … }` del callback NO es estilo: `ts.forEachChild` PARA en cuanto su callback
  // devuelve algo truthy, y devolver `acc` —un array, siempre truthy— cortaba el recorrido en el
  // primer hijo. Con eso, de `t == null ? 'pro_propietario' : 'pro_equipo'` solo se visitaba la
  // condición y las dos ramas no se veían nunca. El suelo volvió a cazarlo, ya en segunda vuelta.
  const literales = (n, acc = []) => {
    if (ts.isStringLiteral(n)) acc.push(n.text);
    else ts.forEachChild(n, (h) => { literales(h, acc); });
    return acc;
  };

  const visita = (n) => {
    if (ts.isPropertyAssignment(n)) {
      const clave = ts.isIdentifier(n.name) || ts.isStringLiteral(n.name) ? n.name.text : null;
      if (clave === 'tipo') {
        const linea = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
        for (const valor of literales(n.initializer)) out.push({ valor, linea });
      }
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return out;
}

// ── SUELO ────────────────────────────────────────────────────────────────────────────────

test('SCRUM-381 · SUELO: el analizador VE los actores que sí se escriben', () => {
  const vistos = new Map();
  for (const f of ficherosTs()) {
    for (const a of actoresEscritos(fs.readFileSync(f, 'utf8'), f)) {
      vistos.set(a.valor, (vistos.get(a.valor) ?? 0) + 1);
    }
  }
  // Sin esto, «ninguna ruta escribe `semilla`» sería verdad también si el analizador no viera
  // NADA. «No supe mirar» y «no hay» son el mismo número y significan lo contrario.
  for (const esperado of ['pro_propietario', 'cliente_final', 'sistema']) {
    assert.ok((vistos.get(esperado) ?? 0) > 0,
      `🔴 el analizador no ve ni un \`tipo: '${esperado}'\` en src/, y esos SÍ se escriben. ` +
      `No está leyendo el árbol: lo que vio fue ${JSON.stringify([...vistos])}.`);
  }
});

// ── ① EL VALOR NO SE FILTRA A NINGUNA RUTA REAL ──────────────────────────────────────────

test('SCRUM-381 · 🔴 NINGÚN fichero de `src/` escribe el actor `semilla`', () => {
  // Se deriva del árbol entero, no de una lista de rutas: `src/**/*.ts` es un superconjunto
  // estricto de «las rutas reales», así que si algún día la emisión se dispara desde un servicio,
  // un cron o un webhook nuevo, ya está cubierto sin que nadie tenga que acordarse.
  const infractores = [];
  for (const f of ficherosTs()) {
    for (const a of actoresEscritos(fs.readFileSync(f, 'utf8'), f)) {
      if (a.valor === 'semilla') infractores.push(`${path.relative(RAIZ, f).replace(/\\/g, '/')}:${a.linea}`);
    }
  }
  assert.deepEqual(infractores, [],
    '🔴 UNA RUTA REAL ESCRIBE EL ACTOR DE SIEMBRA:\n    ' + infractores.join('\n    ') +
    '\n\n  Ese valor existe para UNA cosa: que un número sembrado se distinga de una emisión real ' +
    'mirando el AuditLog.\n  En cuanto lo escribe código de producto deja de significar eso, y no ' +
    'queda ninguna otra\n  señal que lo sustituya — se vuelve al punto de partida, con más ruido.\n' +
    '  Si hace falta un actor nuevo para este caso, se amplía `ActorTipo` con el suyo.');
});

test('SCRUM-381 · el valor EXISTE y solo lo escriben los sembradores', () => {
  // La otra cara del anterior: «nadie lo escribe» también sería verdad si el valor no existiera.
  const audit = fs.readFileSync(path.join(SRC, 'modules', 'system', 'audit.service.ts'), 'utf8');
  const sf = ts.createSourceFile('audit.ts', audit, ts.ScriptTarget.Latest, true);
  const decl = sf.statements.find((s) => ts.isTypeAliasDeclaration(s) && s.name.text === 'ActorTipo');
  assert.ok(decl, '🔴 no encuentro la declaración de `ActorTipo`');
  const miembros = decl.type.types?.map((t) => t.literal?.text).filter(Boolean) ?? [];
  assert.ok(miembros.includes('semilla'),
    `🔴 \`ActorTipo\` no declara el actor de siembra. Miembros: ${miembros.join(', ')}`);
  assert.ok(miembros.includes('sistema'),
    '🔴 (suelo) falta `sistema`: estaría leyendo mal la unión');

  // Y quien SÍ lo escribe son los dos sembradores, o el valor no lo usa nadie y sobra.
  const escritores = fs.readdirSync(path.join(RAIZ, 'scripts'))
    .filter((f) => f.endsWith('.mjs'))
    .filter((f) => actoresEscritos(fs.readFileSync(path.join(RAIZ, 'scripts', f), 'utf8'), f)
      .some((a) => a.valor === 'semilla'))
    .sort();
  assert.deepEqual(escritores, ['seed-demo.mjs', 'seed-video.mjs'],
    `🔴 los sembradores que declaran el actor de siembra son ${escritores.join(', ') || 'ninguno'}. ` +
    'Si un sembrador dejó de declararlo, sus números vuelven a ser indistinguibles de una emisión real.');
});

test('SCRUM-381 · ningún sembrador llama a `allocateInvoiceNumber` con el sobre vacío', () => {
  // El defecto literal que se arregla: `allocateInvoiceNumber(tx, id, {}, emitAt)`. Compilaba
  // porque los `.mjs` no pasan por `tsc`, así que la obligatoriedad de SCRUM-207 no los alcanzaba.
  const vacias = [];
  for (const f of fs.readdirSync(path.join(RAIZ, 'scripts')).filter((n) => n.endsWith('.mjs'))) {
    const p = path.join(RAIZ, 'scripts', f);
    const sf = ts.createSourceFile(f, fs.readFileSync(p, 'utf8'), ts.ScriptTarget.Latest, true);
    const visita = (n) => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) &&
          n.expression.text === 'allocateInvoiceNumber') {
        const opts = n.arguments[2];
        const vacio = !opts || (ts.isObjectLiteralExpression(opts) && opts.properties.length === 0);
        if (vacio) vacias.push(`${f}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}`);
      }
      ts.forEachChild(n, visita);
    };
    visita(sf);
  }
  assert.deepEqual(vacias, [],
    '🔴 UN SEMBRADOR RESERVA NÚMERO CON EL SOBRE VACÍO:\n    ' + vacias.join('\n    ') +
    '\n\n  `camino` y `actor` son OBLIGATORIOS desde SCRUM-207, pero un `.mjs` no pasa por `tsc`:\n' +
    '  aquí nadie te lo va a impedir al compilar. Ese número entra en el AuditLog sin nada que lo\n' +
    '  separe de una emisión de verdad.');
});

// ── ② EL SEMBRADOR NO ARRANCA CONTRA PRODUCCIÓN ──────────────────────────────────────────

test('SCRUM-381 · 🔴 producción NO es un destino sembrable, y no puede llegar a serlo', () => {
  assert.ok(!DESTINOS_SEMBRABLES.includes(PROD_HOST),
    '🔴 EL HOST DE PRODUCCIÓN ESTÁ EN LA ALLOWLIST DE SIEMBRA. Da igual lo bien que se llame la ' +
    'fila del AuditLog: un sembrador BORRA y recrea datos.');
  assert.ok(DESTINOS_SEMBRABLES.includes(STAGING_HOST),
    '🔴 (suelo) staging no está en la allowlist: entonces esto no es la lista que creo que es');

  const prod = destinoSembrable(`postgresql://u:p@${PROD_HOST}:5432/railway`);
  assert.equal(prod.ok, false, '🔴 una URL de producción se acepta como destino de siembra');
  assert.match(prod.motivo, /PRODUCCIÓN/, '🔴 el rechazo no dice que el motivo sea producción');
});

test('SCRUM-381 · 🔴 un host DESCONOCIDO también se rechaza (allowlist, no lista negra)', () => {
  // Es el defecto que SCRUM-118 quitó de este mismo fichero: comprobar `host !== PROD_HOST` deja
  // pasar cualquier cosa que no se llame así — una prod rotada, un pooler, una IP, un alias.
  const desconocido = destinoSembrable('postgresql://u:p@monkfish.proxy.rlwy.net:5432/railway');
  assert.equal(desconocido.ok, false,
    '🔴 UN HOST DESCONOCIDO PASA. Eso es una lista negra disfrazada: el día que producción cambie ' +
    'de host, el guard la aprueba.');

  // Y una URL ilegible tampoco es "probablemente segura".
  assert.equal(destinoSembrable('esto no es una url').ok, false, '🔴 una URL ilegible se acepta');
  assert.equal(destinoSembrable('').ok, false, '🔴 una URL vacía se acepta');

  // Los destinos legítimos sí pasan, o el guard sería inútil y alguien lo quitaría.
  for (const bueno of [`postgresql://u:p@${STAGING_HOST}:5432/railway`, 'postgresql://u:p@localhost:5432/yaqu']) {
    assert.equal(destinoSembrable(bueno).ok, true, `🔴 un destino legítimo se rechaza: ${bueno.replace(/:[^:@]+@/, ':***@')}`);
  }
});

test('SCRUM-381 · 🔴 el rechazo NUNCA imprime la URL ni la contraseña', () => {
  // R7: una credencial se protege impidiendo que el error salga, no redactando mensajes a mano.
  // Lo que el sembrador enseña es lo que devuelve esto, así que se comprueba AQUÍ.
  const PASS = 'pAssw0rd-secretisima';
  const URL_PROD = `postgresql://postgres:${PASS}@${PROD_HOST}:5432/railway`;
  const r = destinoSembrable(URL_PROD);
  const todo = `${r.etiqueta} ${r.motivo}`;

  assert.equal(todo.includes(PASS), false, '🔴 LA CONTRASEÑA SALE EN EL MENSAJE DE ABORTO');
  assert.equal(todo.includes(URL_PROD), false, '🔴 la URL completa sale en el mensaje de aborto');
  assert.equal(todo.includes('postgres:'), false, '🔴 sale el usuario con el separador de la contraseña');
  assert.equal(todo.includes('://'), false, '🔴 sale un esquema de URL: eso es la cadena, no una etiqueta');

  // Y sí dice lo que hace falta para saber dónde ibas a sembrar: host y base.
  assert.equal(r.etiqueta, `${PROD_HOST}/railway`,
    '🔴 la etiqueta ya no es `host/base`: sin eso, «destino no sembrable» no dice CUÁL era');
});

test('SCRUM-381 · 🔴 los dos sembradores comprueban el destino ANTES de confirmarlo', () => {
  // El orden es el guard. Con la confirmación primero, escribir el hostname de producción seguía
  // siendo suficiente para sembrar en producción: la ceremonia estaba, la prohibición no.
  for (const [f, confirm] of [['seed-demo.mjs', 'SEED_DEMO_CONFIRM'], ['seed-video.mjs', 'SEED_VIDEO_CONFIRM']]) {
    const src = fs.readFileSync(path.join(RAIZ, 'scripts', f), 'utf8');
    const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true);

    let posGuard = -1;
    let posConfirm = -1;
    const visita = (n) => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) &&
          n.expression.text === 'destinoSembrable' && posGuard < 0) posGuard = n.getStart(sf);
      // `process.env.SEED_*_CONFIRM`, leído del AST y no del texto.
      if (ts.isPropertyAccessExpression(n) && n.name.text === confirm && posConfirm < 0) posConfirm = n.getStart(sf);
      ts.forEachChild(n, visita);
    };
    visita(sf);

    assert.ok(posGuard >= 0, `🔴 ${f} NO comprueba el destino con \`destinoSembrable\`: puede sembrar en producción.`);
    assert.ok(posConfirm >= 0, `🔴 ${f} ya no exige \`${confirm}\`: se perdió la confirmación explícita.`);
    assert.ok(posGuard < posConfirm,
      `🔴 ${f} CONFIRMA ANTES DE COMPROBAR. Nombrar la base contesta «¿es la que querías?», no ` +
      '«¿se puede sembrar ahí?»: en ese orden, teclear el hostname de prod abre producción.');
  }
});

test('SCRUM-381 · 🔴 ningún SEMBRADOR parsea una URL de BD a mano', () => {
  // SCRUM-223: `new URL(dbUrl)` no redacta — su error lleva la cadena ENTERA dentro, y basta un
  // `console.error(e)` para publicar la contraseña (incidente #14). `seed-video.mjs` conservaba
  // esa forma; sobrevivió porque nadie miró los dos sembradores a la vez.
  //
  // ⚠️ ALCANCE: `seed-*.mjs`, derivado del árbol y no una lista escrita aquí. Se probó primero
  // sobre TODOS los scripts y salió rojo señalando cinco más. Medidos uno a uno, NO son el mismo
  // caso y no se tocan en este ticket (carril distinto, ninguno bloquea):
  //   · `backfill-quote-jobid:46`, `conciliar-auditoria-fiscal:95`, `preflight-schema-drift:78`
  //     → SÍ es el mismo defecto: parsean `DATABASE_URL` a mano. Reportados como hallazgo.
  //   · `guard-contraste:194` → `new URL(req.url, …)`: una petición HTTP, no una credencial.
  //   · `backup-dump:167`     → extrae la contraseña A PROPÓSITO para `pg_dump`, y pasa adelante
  //                             la URL sin ella. Es el único que legítimamente la necesita.
  // Ampliar el alcance sin arreglarlos dejaría la suite en rojo por ficheros de otro carril.
  const aMano = [];
  for (const f of fs.readdirSync(path.join(RAIZ, 'scripts')).filter((n) => /^seed-.*\.mjs$/.test(n))) {
    const p = path.join(RAIZ, 'scripts', f);
    const sf = ts.createSourceFile(f, fs.readFileSync(p, 'utf8'), ts.ScriptTarget.Latest, true);
    const visita = (n) => {
      if (ts.isNewExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'URL') {
        const arg = n.arguments?.[0];
        // Una URL literal (`new URL('https://…')`) no lleva credenciales de BD: lo que se persigue
        // es parsear una VARIABLE, que es por donde entra `DATABASE_URL`.
        if (arg && !ts.isStringLiteral(arg)) {
          aMano.push(`${f}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}`);
        }
      }
      ts.forEachChild(n, visita);
    };
    visita(sf);
  }
  assert.deepEqual(aMano, [],
    '🔴 UN SEMBRADOR PARSEA UNA URL A MANO:\n    ' + aMano.join('\n    ') +
    '\n\n  Usa `parseBDSegura` de `_db-guard.mjs`, que no tiene forma de devolver la cadena.\n' +
    '  Una credencial se protege impidiendo que el error salga, no acordándose de envolver en try.');
});
