// SCRUM-472 · UN SCRIPT NO FABRICA FIRMAS NI DOCUMENTOS FIRMADOS.
//
// Sin gate: AST sobre `scripts/`. Ni BD, ni red.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 EL DEFECTO
//
// `scripts/seed-video.mjs` escribía un `Albaran` con **`estado: 'firmado'`**, `firmadoAt` y una
// `signatureUrl` de **118 caracteres — un PNG de 1×1 px** (`SAMPLE_SIGNATURE`), directamente contra
// la BD. Las dos rutas legítimas de firma exigen `data:image/(png|jpeg);base64,` **y construyen el
// sobre de evidencias**; el script no pasaba por ninguna de las dos.
//
// En producción esa fila existe: `albaranes.id = 5`, merchant 22, `firmado_at` 2026-06-16.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ ES UN TICKET SIN VÍCTIMA, Y AUN ASÍ URGENTE
//
// Hoy todos los datos de producción son de prueba. Pero **la ventana de detección de este defecto
// es ANTES de que haya una víctima**: en cuanto exista un albarán firmado de verdad, una firma
// fabricada es indistinguible de una real —misma columna, mismo formato, mismo estado— y ya no hay
// forma de auditarla hacia atrás. El expediente legal del proyecto hace depender la fortaleza
// probatoria de la integridad de la firma.
//
// ⚠️ Lo único que señalaba a la semilla era **la coincidencia exacta de longitud**: el prefijo
// `data:image/png;base64,iVBORw0K` es la cabecera PNG y sale igual en las cuatro filas firmadas.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ UN CENSO NUEVO Y NO EL DE SCRUM-462
//
// `tests/_censo-escrituras-albaran.mjs` recorre **solo `.ts`** y **solo ficheros con
// `albaran.update`**: `scripts/*.mjs` le es invisible, y sus `create` también. Ampliarlo sería
// repetir el error que su propia cabecera documenta —al ensancharlo «por completitud» cambió el
// significado del guard de SCRUM-361 y empezó a acusar a quien hacía lo correcto—.
//
// **`scripts/` estaba fuera de todos los censos del árbol.** Ése es el hueco, y es el corpus nuevo.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';
import { escriturasDeAlbaran, funcionQueContiene } from './_censo-escrituras-albaran.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEED = 'scripts/seed-video.mjs';

/**
 * TODA escritura de Prisma en `scripts/`, con el texto de su `data:`, DERIVADA DEL AST.
 *
 * No por texto: un `where: { estado: 'firmado' }` es una LECTURA y se escribe igual que la
 * escritura, y el comentario que explique la prohibición se caza a sí mismo (`_guard-texto.mjs`).
 */
function escriturasDeScripts() {
  const escrituras = [];
  let ficheros = 0;
  const dir = path.join(RAIZ, 'scripts');

  const visitarDir = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { visitarDir(p); continue; }
      if (!/\.(mjs|js|ts)$/.test(e.name)) continue;
      ficheros += 1;
      const src = fs.readFileSync(p, 'utf8');
      const rel = path.relative(RAIZ, p).replace(/\\/g, '/');
      const sf = ts.createSourceFile('x.ts', src, ts.ScriptTarget.Latest, true);
      const visitar = (n) => {
        // `algo.<modelo>.create|update|upsert|updateMany|createMany({ data: … })`
        if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
          const metodo = n.expression.name.text;
          const sujeto = n.expression.expression;
          if (/^(create|update|upsert|updateMany|createMany)$/.test(metodo)
              && ts.isPropertyAccessExpression(sujeto)) {
            const modelo = sujeto.name.text;
            const arg = n.arguments[0];
            if (arg && ts.isObjectLiteralExpression(arg)) {
              const data = arg.properties.find(
                (p2) => p2.name && p2.name.getText(sf) === 'data',
              );
              const { line } = sf.getLineAndCharacterOfPosition(n.getStart(sf));
              // ⚠️ PROPIEDADES DEL AST, no el texto del `data`. `getText()` de un objeto trae sus
              // COMENTARIOS dentro, así que un guard que buscara «signatureUrl» ahí se cazaría a sí
              // mismo en el comentario que explica por qué no debe estar — pasó al escribir esto,
              // y es la lección de `_guard-texto.mjs` un piso más abajo.
              const props = {};
              if (data && ts.isPropertyAssignment(data)
                  && ts.isObjectLiteralExpression(data.initializer)) {
                for (const p3 of data.initializer.properties) {
                  if (ts.isPropertyAssignment(p3) && p3.name) {
                    props[p3.name.getText(sf)] = p3.initializer.getText(sf);
                  }
                }
              }
              escrituras.push({ fichero: rel, linea: line + 1, modelo, metodo, props });
            }
          }
        }
        ts.forEachChild(n, visitar);
      };
      visitar(sf);
    }
  };
  visitarDir(dir);
  return { escrituras, ficheros };
}

/** Los `merchantId:` que escribe el seed, con el TEXTO de su valor. */
function merchantIdsDelSeed() {
  const src = fs.readFileSync(path.join(RAIZ, SEED), 'utf8');
  const sf = ts.createSourceFile('x.ts', src, ts.ScriptTarget.Latest, true);
  const out = [];
  const visitar = (n) => {
    if (ts.isPropertyAssignment(n) && n.name.getText(sf) === 'merchantId') {
      const { line } = sf.getLineAndCharacterOfPosition(n.getStart(sf));
      out.push({ linea: line + 1, valor: n.initializer.getText(sf) });
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return out;
}

// ── SUELO ────────────────────────────────────────────────────────────────────────────────

test('SCRUM-472 · SUELO: el censo ve `scripts/`, o no está diciendo nada', () => {
  const { escrituras, ficheros } = escriturasDeScripts();
  assert.ok(ficheros > 0, '🔴 ESCÁNER CIEGO: cero ficheros recorridos en `scripts/`.');
  assert.ok(
    escrituras.length > 0,
    '🔴 ESCÁNER CIEGO: cero escrituras de Prisma en `scripts/`. «Ningún script escribe» y «no supe ' +
      'mirar» son el mismo verde y significan lo contrario — y sabemos que el seed escribe.',
  );
  // Control positivo del CORPUS: la escritura concreta que abre este ticket tiene que verse.
  const albaranes = escrituras.filter((e) => /^albaran$/i.test(e.modelo));
  assert.ok(
    albaranes.length >= 2,
    `🔴 ESCÁNER CIEGO: ${albaranes.length} escrituras de \`Albaran\` en scripts/. El seed siembra ` +
      'al menos dos (una firmada y un borrador): si no se ven, el guard de abajo pasa por vacío.',
  );
  // Y el suelo de los tres escritores conocidos de firma, que es el que pidió el encargo: dos rutas
  // legítimas en `src/` (que NO se tocan) más el script.
  const rutas = ['src/modules/jobs/app/routes/albaranes.routes.ts',
                 'src/modules/jobs/app/routes/albaranPublic.routes.ts'];
  for (const r of rutas) {
    const t = fs.readFileSync(path.join(RAIZ, r), 'utf8');
    assert.match(
      t, /\^data:image\\\/\(png\|jpeg\);base64,/,
      `🔴 ${r} ha dejado de validar la firma. Las dos rutas legítimas son el suelo de este ticket: ` +
        'si ellas dejan de validar, prohibirle al script escribir firmas no protege nada.',
    );
  }
});

// ── EL VECTOR ────────────────────────────────────────────────────────────────────────────

test('SCRUM-472 · 🔴 ningún script marca un albarán como FIRMADO', () => {
  const { escrituras } = escriturasDeScripts();
  const firmados = escrituras.filter((e) => /'firmado'/.test(e.props.estado || ''));
  assert.deepEqual(
    firmados.map((e) => `${e.fichero}:${e.linea}`), [],
    '🔴 UN SCRIPT ESTÁ FABRICANDO UN DOCUMENTO FIRMADO.\n\n' +
      '  Las dos rutas de firma validan la imagen Y construyen el sobre de evidencias (SCRUM-462).\n' +
      '  Una escritura directa se salta las dos cosas y deja una fila que, mirada en la BD, es\n' +
      '  IDÉNTICA a una firma real: misma columna, mismo formato, mismo estado.\n' +
      '  Si el seed necesita un albarán firmado, tiene que pasar por la ruta.\n' +
      `  Escrituras: ${firmados.map((e) => `${e.fichero}:${e.linea}`).join(', ')}`,
  );
});

test('SCRUM-472 · 🔴 ningún script escribe una firma en `signatureUrl`', () => {
  const { escrituras } = escriturasDeScripts();
  // ALLOWLIST: vacía a propósito. Si algún día hace falta una excepción, se declara AQUÍ con su
  // motivo y su ticket — nunca quitando el assert ni estrechando el patrón en silencio.
  const PERMITIDAS = [];
  // Dos formas de colarla, y las dos se miran: por la clave de firma con algo dentro, y por un
  // data-URI de imagen escrito bajo CUALQUIER clave. `signatureUrl: null` no es escribir una firma.
  const esFirma = (e) => Object.entries(e.props).some(([clave, valor]) => (
    (/signature|firma/i.test(clave) && valor !== 'null' && valor !== 'undefined')
    || /data:image\//.test(valor)
  ));
  const conFirma = escrituras
    .filter(esFirma)
    .filter((e) => !PERMITIDAS.includes(`${e.fichero}:${e.linea}`));
  assert.deepEqual(
    conFirma.map((e) => `${e.fichero}:${e.linea} (${e.modelo})`), [],
    '🔴 UN SCRIPT ESTÁ ESCRIBIENDO UNA FIRMA.\n\n' +
      '  El trazo de un cliente es LA prueba: `Quote.signatureUrl` es de lo que el libro registro\n' +
      '  deriva «presupuesto firmado», y `Albaran.signatureUrl` es lo que sostiene un albarán ante\n' +
      '  quien dice «yo no pedí eso». Una firma inventada por un script no se distingue de una real\n' +
      '  cuando ya está en la columna.\n' +
      `  Escrituras: ${conFirma.map((e) => `${e.fichero}:${e.linea}`).join(', ')}`,
  );
});

test('SCRUM-472 · el seed escribe SOLO en el merchant que él mismo crea', () => {
  const ids = merchantIdsDelSeed();
  assert.ok(
    ids.length >= 15,
    `🔴 ESCÁNER CIEGO: solo ${ids.length} \`merchantId\` leídos del seed; hay del orden de veinte.`,
  );
  const ajenos = ids.filter((x) => x.valor !== 'mid');
  assert.deepEqual(
    ajenos.map((x) => `línea ${x.linea} → ${x.valor}`), [],
    '🔴 EL SEED ESCRIBE EN UN MERCHANT QUE NO ES EL SUYO.\n\n' +
      '  `mid` es el id del merchant que el propio seed acaba de crear en esta ejecución. Cualquier\n' +
      '  otro valor mete datos de mentira en la cuenta de alguien —y en producción no hay forma de\n' +
      '  distinguirlos después de los de verdad.\n' +
      `  Encontrados: ${ajenos.map((x) => `línea ${x.linea} → ${x.valor}`).join(', ')}`,
  );
  // Y que `mid` sea de verdad lo que se cree: el id del merchant recién creado, no una constante.
  const src = fs.readFileSync(path.join(RAIZ, SEED), 'utf8');
  assert.match(
    src, /const mid = merchant\.id;/,
    '🔴 `mid` ya no sale del merchant creado en esta ejecución: el assert de arriba dejaría de ' +
      'significar «su propio merchant».',
  );
  assert.match(
    src, /if \(merchant\.id === 1\) throw new Error/,
    '🔴 el seed ha dejado de negarse a tomar el id=1, reservado al demo (regla 8).',
  );
});

// ── Y EL OTRO LADO: `src/` ───────────────────────────────────────────────────────────────

test('SCRUM-472 · toda escritura de `src/` que marca FIRMADO valida antes la firma', () => {
  // El cierre del ticket: que el script no pueda es la mitad; la otra es que **ninguna ruta** pueda.
  //
  // Se CONSUME el censo de SCRUM-462 (`_censo-escrituras-albaran.mjs`) para una tercera pregunta.
  // No se ensancha: su cabecera cuenta que al ampliarlo «por completitud» cambió el significado del
  // guard de SCRUM-361 y empezó a acusar a quien hacía lo correcto. Aquel exige el SOBRE; éste
  // exige la VALIDACIÓN DE LA IMAGEN — son dos cosas distintas y las dos hacen falta: un sobre
  // impecable alrededor de un lienzo en blanco sigue siendo un albarán que nadie firmó.
  const { escrituras, ficheros } = escriturasDeAlbaran(RAIZ);
  assert.ok(ficheros > 0, '🔴 ESCÁNER CIEGO: el censo de `src/` no ha recorrido ningún fichero.');
  assert.ok(escrituras.length > 0, '🔴 ESCÁNER CIEGO: cero escrituras de `Albaran` en `src/`.');

  const marcanFirmado = escrituras.filter((e) => /estado:\s*'firmado'/.test(e.data));
  // CONTROL POSITIVO: son exactamente DOS, las dos superficies de firma. Con una lista vacía,
  // «todas validan» sería verdad y no significaría nada.
  assert.equal(
    marcanFirmado.length, 2,
    `🔴 se esperaban 2 escrituras que marcan firmado (panel y página pública) y hay ` +
      `${marcanFirmado.length}. Si ha aparecido una tercera superficie de firma, este guard tiene ` +
      'que verla ANTES de que llegue a producción — que es justo para lo que existe.\n  ' +
      marcanFirmado.map((e) => `${e.fichero}:${e.linea}`).join('\n  '),
  );

  for (const e of marcanFirmado) {
    const fn = funcionQueContiene(RAIZ, e.fichero, e.linea);
    assert.ok(
      fn.length > 0,
      `🔴 no se ha podido leer la función que contiene ${e.fichero}:${e.linea}: el guard estaría ` +
        'absolviendo por no saber mirar.',
    );
    assert.match(
      fn, /\^data:image\\\/\(png\|jpeg\);base64,/,
      `🔴 ${e.fichero}:${e.linea} MARCA UN ALBARÁN COMO FIRMADO SIN VALIDAR LA FIRMA.\n\n` +
        '  Sin esa comprobación entra como firma cualquier cosa que llegue en el cuerpo: una cadena\n' +
        '  vacía, un texto, un enlace. Y una vez en la columna no se distingue de una firma real.\n' +
        '  Las dos superficies legítimas validan con esa expresión; una tercera tiene que hacerlo\n' +
        '  también, y no vale «es interna» — la de obra también lo es.',
    );
  }
});

test('SCRUM-472 · CONTROL NEGATIVO: las escrituras que NO firman no caen', () => {
  // Un guard que acusa a quien hace lo correcto se desactiva al primer roce (lección de SCRUM-462).
  const { escrituras } = escriturasDeAlbaran(RAIZ);
  const otras = escrituras.filter((e) => !/estado:\s*'firmado'/.test(e.data));
  assert.ok(
    otras.length >= 4,
    `🔴 solo ${otras.length} escrituras que no firman: sin ellas este control no controla nada.`,
  );
  // Ninguna necesita validar firma, y ninguna la escribe: pdfUrl, token, invoiceId, emitir, PATCH…
  const conFirma = otras.filter((e) => /signatureUrl:/.test(e.data));
  assert.deepEqual(
    conFirma.map((e) => `${e.fichero}:${e.linea}`), [],
    '🔴 hay una escritura que pone `signatureUrl` SIN marcar firmado. Una firma que entra por una ' +
      'puerta que no pasa por la validación es exactamente el defecto de este ticket con otro nombre.',
  );
});

// ── CONTROL NEGATIVO ─────────────────────────────────────────────────────────────────────

test('SCRUM-472 · CONTROL NEGATIVO: el seed sigue sembrando lo mismo', () => {
  // Un seed que deja de sembrar no sirve. Este ticket le quita DOS cosas —el estado firmado y la
  // firma inventada— y no puede llevarse nada más por delante.
  //
  // ⚠️ 🔴 LO QUE ESTE CONTROL NO PRUEBA, Y LO DIGO YO ANTES QUE NADIE.
  //
  // Esto es un INVENTARIO DEL CÓDIGO, no una ejecución: el seed escribe en una BD y crea un
  // merchant, así que no se ha corrido contra ninguna. **Lo descubrió su propio rojo**: al
  // desactivar el bloque de albaranes con `if (false && …)` este test siguió VERDE, porque las
  // llamadas seguían en el árbol. Un censo por AST no sabe qué se ejecuta.
  //
  // Se tapa el hueco por donde se cuela de verdad —el bloque desactivado— con el assert de
  // condiciones constantes de abajo. Lo que quedaría por hacer para tener la prueba entera es
  // correr el seed contra una BD desechable y contar filas; hace falta un Postgres local, y el
  // portable que había en la máquina está incompleto (sin `share/`, `initdb` no arranca).
  const { escrituras } = escriturasDeScripts();
  const delSeed = escrituras.filter((e) => e.fichero === SEED);
  const modelos = [...new Set(delSeed.map((e) => e.modelo))].sort();
  for (const debe of ['albaran', 'customer', 'customerEvent', 'invoice', 'job', 'merchant',
                      'provider', 'quote', 'teamMember']) {
    assert.ok(
      modelos.includes(debe),
      `🔴 EL SEED HA DEJADO DE SEMBRAR \`${debe}\`. El arreglo de SCRUM-472 quita la firma ` +
        `fabricada, no el contenido del vídeo.\n  Siembra hoy: ${modelos.join(', ')}`,
    );
  }
  // Los DOS albaranes del trabajo «aseo» siguen ahí: el que se firmaba y el borrador.
  assert.ok(
    delSeed.filter((e) => e.modelo === 'albaran').length >= 2,
    '🔴 el seed ya no siembra los dos albaranes: el vídeo se queda sin la pantalla de albaranes.',
  );
  const src = fs.readFileSync(path.join(RAIZ, SEED), 'utf8');
  assert.match(
    src, /Retirada de aparatos y demolición de alicatado/,
    '🔴 han desaparecido las líneas del albarán sembrado: eso es contenido del vídeo, no la firma.',
  );

  // Y el hueco que destapó el rojo: un bloque puede seguir en el árbol y no ejecutarse nunca.
  const sf = ts.createSourceFile('x.ts', src, ts.ScriptTarget.Latest, true);
  const apagados = [];
  // ⚠️ Por TIPO DE NODO, no por texto. El primer intento buscaba `false|0` con una expresión
  // regular y acusó a `merchantCount === 0`, `p.cost > 0` y `(i % 2 === 0)`: salía rojo con el
  // árbol limpio, y un guard que acusa a los inocentes se desactiva al primer roce.
  const esConstanteFalsa = (e) => e.kind === ts.SyntaxKind.FalseKeyword
    || (ts.isNumericLiteral(e) && e.text === '0');
  const apagadoPor = (cond) => {
    if (esConstanteFalsa(cond)) return true;
    return ts.isBinaryExpression(cond)
      && cond.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
      && esConstanteFalsa(cond.left);
  };
  const visitar = (n) => {
    const cond = ts.isIfStatement(n) ? n.expression
      : ts.isConditionalExpression(n) ? n.condition : null;
    if (cond && apagadoPor(cond)) {
      apagados.push(`línea ${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}: ${cond.getText(sf).slice(0, 60)}`);
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  assert.deepEqual(
    apagados, [],
    '🔴 HAY UN BLOQUE DEL SEED DESACTIVADO CON UNA CONDICIÓN CONSTANTE.\n\n' +
      '  El código sigue ahí y no se ejecuta nunca: para el inventario de arriba «sigue sembrando»,\n' +
      '  y en la BD no aparece nada. Es la forma en que este control negativo se queda ciego, y por\n' +
      '  eso se mira aparte.\n' +
      `  ${apagados.join('\n  ')}`,
  );
});
