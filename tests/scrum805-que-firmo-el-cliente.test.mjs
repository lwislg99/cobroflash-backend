// tests/scrum805-que-firmo-el-cliente.test.mjs — SCRUM-805
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// QUÉ FIRMÓ EL CLIENTE.
//
// Un presupuesto firmado guardaba `signatureUrl` y `acceptedAt`. Medido CORRIENDO contra dev el
// 7-sep-2026 07:12 UTC: tras firmar, ninguna columna de la fila identifica qué documento estaba
// delante del cliente; y cambiando una línea de 85 € a 385 € DESPUÉS de firmar, el total pasa a
// 511,34 €, el trazo sigue ahí y no queda nada en la fila que pueda desmentirlo.
//
// ⛔ ESTO NO ES VERIFACTU y no se rotula como tal. La huella fiscal es la de la FACTURA
// —encadenada, sellada y con QR— y a ésa no se le añade nada (regla 24). Esto certifica un
// documento NO FISCAL que el cliente firma, igual que el albarán.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = pathToFileURL(path.join(RAIZ, 'dist')).href + '/';

const SELLO = await import(DIST + 'modules/quotes/domain/presupuestoSello.js');
const {
  computePresupuestoContentHash, buildFirmaEvidenciaPresupuesto, verificarEvidenciaPresupuesto,
  PRESUPUESTO_CONTENIDO_VERSION_ACTUAL,
} = SELLO;

// 🔴 MUTACIONES_QUE_ME_TUMBAN · SCRUM-745. Cada una imita el defecto que su test promete cazar.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'src/modules/quotes/domain/presupuestoSello.ts',
    de: '      total: importe(params.total),',
    a: '      total: null,',
    cae: 'EL QUE DECIDE: cada campo del contenido mueve el hash',
  },
  {
    fichero: 'src/modules/quotes/app/routes/quotes.routes.ts',
    de: '          ...(evidenciaFirma ? { evidenciaFirma: evidenciaFirma as any } : {}),',
    a: '',
    cae: 'un presupuesto firmado SIN evidencia no puede pasar',
  },
  {
    fichero: 'src/modules/invoicing/infra/pdf/pdf.service.ts',
    de: "text('Certificado de evidencias de la firma', CONTENT_X, boxY)",
    a: "text('Certificado de evidencias', CONTENT_X, boxY)",
    cae: 'los literales del PDF son BYTE A BYTE los del albarán',
  },
];

// ═════════════════════════════════════════════════════════════════════════════════════════
// ① 🔴 EL CONTROL QUE DECIDE · ¿el canónico sella lo que dice sellar?
// ═════════════════════════════════════════════════════════════════════════════════════════

const CONGELADO = { cliente: 'Talleres Ruiz, S.L.', emisor: 'Fontanería García', emisorNif: 'B12345678' };

const CONTENIDO = {
  numero: 41,
  fecha: new Date('2026-09-01T08:00:00.000Z'),
  moneda: 'EUR',
  lineas: [
    { description: 'Sustituir grifo monomando', quantity: 1, unitPrice: 85, taxRate: 21, discount: null },
    { description: 'Tubo cobre 15 mm', quantity: 3.5, unitPrice: 12.4, taxRate: 21, discount: null },
  ],
  total: '148.34',
  descuentoGlobal: null,
  ivaModo: 'sumar',
  validUntil: new Date('2026-10-01T08:00:00.000Z'),
  paymentTerms: 'FIFTY_FIFTY',
  clausulasExcluidas: ['garantia'],
  docHeaderText: 'Gracias por su confianza.',
  docFooterText: 'Precios sujetos a revisión.',
  direccionObraModo: 'personalizada',
  direccionObra: 'C/ Mayor 3, Getafe',
  contenidoCongelado: CONGELADO,
};

/**
 * Un valor DISTINTO para cada campo, sin lista de casos escrita a mano: se deriva del valor que
 * el campo tiene hoy. Así, si mañana el canónico gana un campo, este test lo muta también —
 * no hay nada que acordarse de añadir.
 */
function otroValor(v) {
  if (v === null || v === undefined) return 'X';
  if (typeof v === 'number') return v + 1;
  if (typeof v === 'string') return `${v}!`;
  if (v instanceof Date) return new Date(v.getTime() + 86400000);
  if (Array.isArray(v)) return [...v, 'X'];
  return { ...v, x: 1 };
}

test('SCRUM-805 · 🔴 EL QUE DECIDE: cada campo del contenido mueve el hash', () => {
  const base = computePresupuestoContentHash(CONTENIDO);

  // 🔴 SUELO. Un recorrido que mute CERO campos pasaría en verde sin comprobar nada: «no falló
  // ninguno» y «no probé ninguno» son el mismo verde con significados opuestos.
  const campos = Object.keys(CONTENIDO).filter((k) => k !== 'contenidoCongelado');
  assert.ok(campos.length >= 14,
    `🔴 CIEGO: sólo voy a mutar ${campos.length} campos y el contenido del presupuesto tiene 15. `
    + 'Si el objeto de prueba encogió, este test mide un documento que no es el que se sella.');

  const mudos = [];
  let probados = 0;
  for (const campo of campos) {
    const mutado = { ...CONTENIDO, [campo]: otroValor(CONTENIDO[campo]) };
    probados += 1;
    if (computePresupuestoContentHash(mutado) === base) mudos.push(campo);
  }
  assert.equal(probados, campos.length, '🔴 CIEGO: no se han probado todos los campos');
  assert.deepEqual(
    mudos, [],
    '🔴 HAY CAMPOS DEL DOCUMENTO QUE EL SELLO NO CUBRE: ' + mudos.join(', ') + '\n\n'
    + '  Se pueden cambiar DESPUÉS de firmar y el hash sigue cuadrando: la evidencia diría que el\n'
    + '  documento está intacto cuando no lo está. Es peor que no tener sello, porque promete.',
  );

  // Y los cuatro que el fundador nombró, UNO A UNO y con su nombre, para que el rojo diga cuál.
  for (const [campo, nuevo] of [
    ['total', '511.34'],
    ['validUntil', new Date('2027-01-01T00:00:00.000Z')],
    ['paymentTerms', 'FULL_UPFRONT'],
    ['clausulasExcluidas', ['garantia', 'transporte']],
  ]) {
    assert.notEqual(
      computePresupuestoContentHash({ ...CONTENIDO, [campo]: nuevo }), base,
      `🔴 cambiar «${campo}» NO mueve el hash. El canónico del albarán tampoco lo sellaba, y ésa `
      + 'fue la razón entera de escribir uno propio: si no cubre esto, el ticket no está hecho.',
    );
  }

  // El precio de UNA línea: el caso del rojo medido en dev (85 € → 385 €).
  const conOtroPrecio = {
    ...CONTENIDO,
    lineas: [{ ...CONTENIDO.lineas[0], unitPrice: 385 }, CONTENIDO.lineas[1]],
  };
  assert.notEqual(computePresupuestoContentHash(conOtroPrecio), base,
    '🔴 cambiar el precio de una línea no mueve el hash: es EL caso que abrió el ticket.');
});

test('SCRUM-805 · ✅ POSITIVO: dos presupuestos idénticos dan el MISMO hash', () => {
  // Sin esto no se sabe si el instrumento DISTINGUE o si simplemente siempre dice «distinto».
  // Se construye un objeto EQUIVALENTE pero nuevo, no el mismo por referencia.
  const gemelo = JSON.parse(JSON.stringify(CONTENIDO));
  gemelo.fecha = new Date(CONTENIDO.fecha);
  gemelo.validUntil = new Date(CONTENIDO.validUntil);
  assert.equal(computePresupuestoContentHash(gemelo), computePresupuestoContentHash(CONTENIDO),
    '🔴 el mismo contenido da dos hashes distintos: entonces el sello acusaría de alteración a '
    + 'todo documento que se vuelva a leer, y un verificador que grita siempre se apaga.');

  // ✅ CONTROL NEGATIVO del encargo: el importe da igual cómo venga tipado. `Decimal` de Prisma
  // llega como objeto, la fila como string y un cálculo como number: si los tres no producen el
  // MISMO texto, verificar daría «no coincide» según por dónde se leyó la fila.
  const comoNumero = { ...CONTENIDO, total: 148.34 };
  const comoTexto = { ...CONTENIDO, total: '148.34' };
  const comoDecimal = { ...CONTENIDO, total: { toString: () => '148.34' } };
  const h = computePresupuestoContentHash(comoTexto);
  assert.equal(computePresupuestoContentHash(comoNumero), h, '🔴 un total `number` da otro hash');
  assert.equal(computePresupuestoContentHash(comoDecimal), h, '🔴 un total `Decimal` da otro hash');
});

test('SCRUM-805 · ✅ NEGATIVO: se sella el CONTENIDO, no el binario del PDF', () => {
  // Regenerar el PDF no toca el contenido, así que no puede mover el hash. Es la prueba de que
  // se sella lo que se firmó y no una representación suya — §1.3 de la investigación.
  // Se ejercita llamando DOS VECES con el mismo contenido, que es exactamente lo que hace una
  // regeneración: el papel se rehace, el contenido no.
  const a = computePresupuestoContentHash(CONTENIDO);
  const b = computePresupuestoContentHash(CONTENIDO);
  assert.equal(a, b);
  // Y lo que NO entra: el trazo y la ruta del PDF no son contenido del documento.
  assert.equal(
    computePresupuestoContentHash({ ...CONTENIDO, signatureUrl: 'data:image/png;base64,OTRO', pdfUrl: '/otro' }),
    a,
    '🔴 el hash cambia por campos que NO son el contenido firmado: regenerar el papel rompería '
    + 'el sello de un documento intacto.',
  );
});

test('SCRUM-805 · una versión desconocida se DICE, no se aproxima', () => {
  // Un verificador que «hace lo que puede» con una versión futura devolvería «no coincide» sobre
  // un documento intacto, y eso se lee como una falsificación que no ha ocurrido.
  assert.throws(() => computePresupuestoContentHash(CONTENIDO, 99), /version_desconocida:99/);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ② EL SOBRE · las nueve claves, y la versión DENTRO
// ═════════════════════════════════════════════════════════════════════════════════════════

const CLAVES_DEL_SOBRE = ['v', 'canal', 'firmadoAt', 'ip', 'ua', 'tokenId', 'firmante', 'hashAlg', 'contentHash'];

test('SCRUM-805 · 🔴 la evidencia lleva las NUEVE claves del sobre, y la versión DENTRO', () => {
  const firmadoAt = new Date('2026-09-07T10:00:00.000Z');
  const ev = buildFirmaEvidenciaPresupuesto({
    contenido: CONTENIDO, contenidoCongelado: CONGELADO,
    canal: 'remoto', ip: '203.0.113.7', ua: 'Mozilla/5.0', tokenId: 'tok_abc', firmadoAt,
  });

  const faltan = CLAVES_DEL_SOBRE.filter((k) => !(k in ev));
  assert.deepEqual(faltan, [], `🔴 al sobre le faltan claves: ${faltan.join(', ')}`);
  const vacias = CLAVES_DEL_SOBRE.filter((k) => ev[k] === null || ev[k] === undefined || ev[k] === '');
  assert.deepEqual(vacias, [],
    `🔴 estas claves salen VACÍAS del camino real: ${vacias.join(', ')}. Un hueco en la evidencia `
    + 'no es un detalle: es la parte de la prueba que no existe el día que haga falta.');

  assert.equal(ev.v, PRESUPUESTO_CONTENIDO_VERSION_ACTUAL,
    '🔴 la versión no viaja DENTRO de la evidencia. Una evidencia que no dice con qué versión de '
    + 'canónico se selló es imposible de verificar dentro de dos años.');
  assert.equal(ev.hashAlg, 'sha256');
  assert.equal(ev.firmadoAt, firmadoAt.toISOString(),
    '🔴 el sello temporal no es el que puso el servidor');
  assert.equal(ev.firmante, CONGELADO.cliente);
  assert.match(ev.contentHash, /^[0-9a-f]{64}$/, '🔴 el contentHash no es un SHA-256');
});

test('SCRUM-805 · 🔴 el bloque congelado hace verificable el documento sin datos vivos', () => {
  // El albarán llegó aquí por las malas: sus v:1 y v:2 recalculaban desde las filas vivas, así
  // que CORREGIR la razón social de un cliente hacía que el verificador dijera «no coincide»
  // sobre un documento intacto (SCRUM-431 → v:3 en SCRUM-438). El presupuesto nace ya congelado.
  const ev = buildFirmaEvidenciaPresupuesto({
    contenido: CONTENIDO, contenidoCongelado: CONGELADO,
    canal: 'remoto', ip: null, ua: null, tokenId: 't', firmadoAt: new Date(),
  });

  assert.equal(verificarEvidenciaPresupuesto({ evidencia: ev, contenido: CONTENIDO }), true,
    '🔴 la evidencia recién sellada no se verifica contra su propio contenido');

  // El cliente corrige su razón social DESPUÉS de firmar: el documento no ha cambiado.
  assert.equal(
    verificarEvidenciaPresupuesto({ evidencia: ev, contenido: CONTENIDO }), true,
    '🔴 una corrección de datos vivos rompe el sello de un documento intacto',
  );

  // Y lo que SÍ tiene que romperlo: cambiar el contenido.
  assert.equal(
    verificarEvidenciaPresupuesto({ evidencia: ev, contenido: { ...CONTENIDO, total: '511.34' } }), false,
    '🔴 EL VERIFICADOR NO DETECTA UNA ALTERACIÓN DEL TOTAL. Es el caso del ticket.',
  );
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ③ 🔴 EL GUARD · un presupuesto firmado SIN evidencia no puede pasar
// ═════════════════════════════════════════════════════════════════════════════════════════

const RUTA_QUOTES = 'src/modules/quotes/app/routes/quotes.routes.ts';

/** Las escrituras de `quote` que guardan el TRAZO, y qué más guardan. Por AST, nunca por grep. */
function escriturasQueFirman(rel) {
  const src = fs.readFileSync(path.join(RAIZ, rel), 'utf8');
  const sf = ts.createSourceFile(path.basename(rel), src, ts.ScriptTarget.Latest, true);
  const out = [];
  (function v(n) {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
        && /^(update|updateMany|create|upsert)$/.test(n.expression.name.text)
        && /(^|\.)quote$/.test(n.expression.expression.getText(sf))) {
      const arg = n.arguments[0];
      if (arg && ts.isObjectLiteralExpression(arg)) {
        for (const pr of arg.properties) {
          if (!ts.isPropertyAssignment(pr) || pr.name.getText(sf) !== 'data') continue;
          // 🔴 SE MIRA DENTRO DE LOS SPREADS CONDICIONALES. El camino real escribe
          // `...(signatureData ? { signatureUrl } : {})`, así que un lector que sólo mire las
          // claves de primer nivel NO VE la firma y da el fichero por limpio — un cero que en
          // realidad es «no miré». Lo aprendí midiendo: mi primer censo se lo tragó.
          const claves = [];
          (function claves2(x) {
            if (ts.isObjectLiteralExpression(x)) {
              for (const q of x.properties) {
                if (q.name) claves.push(q.name.getText(sf).replace(/['"]/g, ''));
                if (ts.isSpreadAssignment(q)) claves2(q.expression);
              }
              return;
            }
            ts.forEachChild(x, claves2);
          })(pr.initializer);
          if (claves.includes('signatureUrl')) {
            out.push({ linea: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1, claves });
          }
        }
      }
    }
    ts.forEachChild(n, v);
  })(sf);
  return out;
}

test('SCRUM-805 · 🔴 un presupuesto firmado SIN evidencia no puede pasar', () => {
  const firmas = escriturasQueFirman(RUTA_QUOTES);

  // SUELO: si el lector no encuentra NINGUNA escritura de firma, lo de abajo pasaría en verde
  // sobre un fichero donde no miró nada.
  assert.ok(firmas.length > 0,
    `🔴 ESCÁNER CIEGO: no encuentro ninguna escritura de \`quote\` que guarde el trazo en `
    + `${RUTA_QUOTES}. ¿Se movió el camino de firma? Sin esto el guard no vigila nada.`);

  const sinSellar = firmas.filter((f) => !f.claves.includes('evidenciaFirma'));
  assert.deepEqual(
    sinSellar.map((f) => f.linea), [],
    '🔴 HAY UNA FIRMA DE PRESUPUESTO QUE NO SELLA LA EVIDENCIA (líneas '
    + `${sinSellar.map((f) => f.linea).join(', ')}).\n\n`
    + '  Se guarda el trazo del cliente y no queda constancia de QUÉ documento tenía delante.\n'
    + '  Es exactamente el defecto que este ticket cierra, reabierto por otro camino.',
  );
});

test('SCRUM-805 · el sello sale del contenido FINAL, no del anterior al tramo', () => {
  // 🔴 Esta ruta reescribe `total` y `lines` cuando el cliente elige un tramo. Si la evidencia se
  // construyera desde la fila de ANTES, certificaría el presupuesto que el cliente NO eligió.
  // Es el defecto de SCRUM-734 un paso más abajo: allí el papel enseñaba el total viejo.
  const src = fs.readFileSync(path.join(RAIZ, RUTA_QUOTES), 'utf8');
  const sf = ts.createSourceFile('q.ts', src, ts.ScriptTarget.Latest, true);
  let texto = null;
  (function v(n) {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)
        && n.expression.text === 'buildFirmaEvidenciaPresupuesto') texto = n.getText(sf);
    if (!texto) ts.forEachChild(n, v);
  })(sf);
  assert.ok(texto, '🔴 ESCÁNER CIEGO: no encuentro la llamada al sellador en el camino de firma');
  assert.match(texto, /tierTotal\s*\?\?\s*quote\.total/,
    '🔴 el sello NO usa el total del tramo elegido: certificaría el presupuesto que el cliente no eligió');
  assert.match(texto, /selectedLines\s*\?\?\s*quote\.lines/,
    '🔴 el sello NO usa las líneas del tramo elegido');
  assert.match(texto, /firmadoAt:\s*now/,
    '🔴 el sello temporal no sale del reloj del SERVIDOR. Una marca de tiempo que pone quien '
    + 'firma no es una marca de tiempo: es una afirmación suya.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ④ ✅ POSITIVO · lo ya firmado NO se rompe ni se marca como inválido
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-805 · ✅ POSITIVO: lo firmado ANTES (sin evidencia) no se rompe', async () => {
  // La columna es nullable por esto: `null` es «se firmó antes de que esto existiera», que NO es
  // «firma inválida». El PDF de esos presupuestos tiene que salir exactamente como salía.
  const { Prisma } = await import('@prisma/client');
  const quote = Prisma.dmmf.datamodel.models.find((m) => m.name === 'Quote');
  const campo = quote.fields.find((f) => f.name === 'evidenciaFirma');
  assert.ok(campo, '🔴 no existe `Quote.evidenciaFirma` en el modelo');
  assert.equal(campo.isRequired, false,
    '🔴 la columna NO es nullable: entonces la migración rompe todos los presupuestos ya firmados, '
    + 'que es exactamente lo que el control positivo del encargo prohíbe.');
  assert.equal(campo.hasDefaultValue, false,
    '🔴 la columna tiene default: un default convierte «no se sabe» en «se decidió», y aquí son '
    + 'cosas distintas.');

  // Y el PDF: sin `contentHash` no se pinta bloque. Se comprueba sobre el código, que es donde
  // vive la decisión — montar un PDF entero aquí sería otra dependencia (regla 36).
  const pdf = fs.readFileSync(path.join(RAIZ, 'src/modules/invoicing/infra/pdf/pdf.service.ts'), 'utf8');
  assert.match(pdf, /if \(params\.evidencia && params\.evidencia\.contentHash\)/,
    '🔴 el bloque de evidencias se pintaría sin evidencia: un certificado vacío en un documento '
    + 'firmado hace un año dice algo que nadie ha comprobado.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ⑤ 🔴 LOS LITERALES · byte a byte contra el fichero de origen, no contra mi memoria
// ═════════════════════════════════════════════════════════════════════════════════════════

/**
 * Los literales de cadena de un fichero, por AST. Un `grep` casaría el comentario que los cita.
 *
 * 🔴 RESUELVE LAS CONCATENACIONES, y no es un adorno: lo cazó este mismo guard la primera vez que
 * corrió. El párrafo largo está escrito en el albarán como TRES literales unidos por `+`, así que
 * un lector que sólo recoja nodos sueltos NO ENCUENTRA el texto completo y declara «ya no está en
 * el albarán» sobre un fichero que lo tiene entero. O sea: comparar contra mi memoria del texto
 * en vez de contra el fichero, que es exactamente lo que este test existe para impedir.
 */
function literalesDe(rel) {
  const src = fs.readFileSync(path.join(RAIZ, rel), 'utf8');
  const sf = ts.createSourceFile(path.basename(rel), src, ts.ScriptTarget.Latest, true);
  const out = new Set();
  const resolver = (n) => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) return n.text;
    if (ts.isParenthesizedExpression(n)) return resolver(n.expression);
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      const a = resolver(n.left);
      const b = resolver(n.right);
      return a !== null && b !== null ? a + b : null;
    }
    return null;
  };
  (function v(n) {
    const t = resolver(n);
    if (t !== null) out.add(t);
    ts.forEachChild(n, v);
  })(sf);
  return out;
}

test('SCRUM-805 · 🔴 los literales del PDF son BYTE A BYTE los del albarán', () => {
  const delAlbaran = literalesDe('src/modules/jobs/infra/albaranPdf.service.ts');
  const delPresupuesto = literalesDe('src/modules/invoicing/infra/pdf/pdf.service.ts');

  // Se DERIVAN del fichero de origen: no hay una copia escrita aquí que pudiera divergir de los
  // dos. Si el albarán deja de tener uno, este guard se entera (escáner ciego) en vez de seguir
  // comparando contra una constante fantasma.
  const EXIGIDOS = [
    'Certificado de evidencias de la firma',
    'Documento sin validez fiscal. No es una factura.',
    'El hash certifica la integridad del contenido firmado (no del archivo PDF). YaQu conserva '
    + 'evidencias técnicas adicionales asociadas a esta firma, disponibles a requerimiento legal. '
    + 'La valoración de su fuerza probatoria corresponde a la autoridad competente.',
    'Firma remota (enlace por WhatsApp)',
    'Firma presencial (in situ)',
  ];

  for (const lit of EXIGIDOS) {
    assert.ok(delAlbaran.has(lit),
      `🔴 ESCÁNER CIEGO: «${lit.slice(0, 40)}…» ya no está en el PDF del albarán. Si cambió allí, `
      + 'este guard dejó de comparar con el original y hay que mirar los dos.');
    assert.ok(delPresupuesto.has(lit),
      `🔴 EL LITERAL DEL PRESUPUESTO NO ES EL APROBADO, byte a byte:\n     «${lit}»\n\n`
      + '  Un literal aprobado que se «mejora» al copiarlo es un literal NUEVO, y todo texto que\n'
      + '  lee el cliente pasa por el fundador (regla 30).');
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ⑥ 🔴 EL CENSO · ¿qué documentos se firman, y cuáles no tienen sello?
// ═════════════════════════════════════════════════════════════════════════════════════════

/**
 * ¿Este fichero alcanza `crypto.createHash`? El ancla NO es un nombre que yo elija: es la
 * primitiva de Node. Se sigue un salto por los imports del propio proyecto.
 *
 * 🔴 POR QUÉ NO SE MIRA EL NOMBRE DE LA COLUMNA: mi primera versión buscaba nombres que
 * casaran /evidencia|contentHash|sello/ y **clasificó el parte de trabajo como SIN sello**,
 * cuando lo tiene desde SCRUM-652 — se llama `contenidoHash` y no casaba. Un censo que
 * pregunta por nombres devuelve un número más bajo en vez de declararse ciego.
 */
function alcanzaCryptoHash(abs, profundidad = 2, vistos = new Set()) {
  if (profundidad < 0 || vistos.has(abs) || !fs.existsSync(abs)) return false;
  vistos.add(abs);
  const src = fs.readFileSync(abs, 'utf8');
  const sf = ts.createSourceFile(path.basename(abs), src, ts.ScriptTarget.Latest, true);
  let hay = false;
  const imports = [];
  (function v(n) {
    if (ts.isCallExpression(n) && /createHash$/.test(n.expression.getText(sf))) hay = true;
    if (ts.isImportDeclaration(n) && ts.isStringLiteralLike(n.moduleSpecifier)
        && n.moduleSpecifier.text.startsWith('.')) imports.push(n.moduleSpecifier.text);
    ts.forEachChild(n, v);
  })(sf);
  if (hay) return true;
  for (const rel of imports) {
    const cand = path.resolve(path.dirname(abs), `${rel}.ts`);
    if (alcanzaCryptoHash(cand, profundidad - 1, vistos)) return true;
  }
  return false;
}

/** Las escrituras de CUALQUIER modelo que guarden algo de firma, por AST, en todo `src/`. */
function censoDeFirmas() {
  const porModelo = new Map();
  let ficheros = 0;
  (function rec(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { rec(p); continue; }
      if (!e.name.endsWith('.ts')) continue;
      ficheros += 1;
      const src = fs.readFileSync(p, 'utf8');
      if (!/\.(update|create|upsert)\(/.test(src)) continue;
      const sf = ts.createSourceFile(e.name, src, ts.ScriptTarget.Latest, true);
      (function v(n) {
        if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
            && /^(update|updateMany|create|upsert)$/.test(n.expression.name.text)) {
          const modelo = n.expression.expression.getText(sf).split('.').pop();
          const arg = n.arguments[0];
          if (arg && ts.isObjectLiteralExpression(arg)) {
            for (const pr of arg.properties) {
              if (!ts.isPropertyAssignment(pr) || pr.name.getText(sf) !== 'data') continue;
              const claves = [];
              (function c2(x) {
                if (ts.isObjectLiteralExpression(x)) {
                  for (const q of x.properties) {
                    if (q.name) claves.push(q.name.getText(sf).replace(/['"]/g, ''));
                    if (ts.isSpreadAssignment(q)) c2(q.expression);
                  }
                  return;
                }
                ts.forEachChild(x, c2);
              })(pr.initializer);
              // FIRMA = se guarda el trazo del cliente, o la marca de que firmó.
              if (!claves.some((k) => /^(signatureUrl|firmadoAt)$/.test(k))) continue;
              const prev = porModelo.get(modelo) ?? { modelo, sitios: [], sella: false };
              prev.sitios.push(`${path.relative(RAIZ, p).replace(/\\/g, '/')}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}`);
              // SELLA = el fichero que escribe la firma alcanza `crypto.createHash`.
              prev.sella = prev.sella || alcanzaCryptoHash(p);
              porModelo.set(modelo, prev);
            }
          }
        }
        ts.forEachChild(n, v);
      })(sf);
    }
  })(path.join(RAIZ, 'src'));
  return { ficheros, documentos: [...porModelo.values()] };
}

test('SCRUM-805 · 🔴 EL CENSO: qué documentos se firman, y cuáles sellan lo firmado', () => {
  const { ficheros, documentos } = censoDeFirmas();

  // SUELO + población declarada. Un censo sin población es un cero que no se puede leer.
  assert.ok(ficheros > 200,
    `🔴 ESCÁNER CIEGO: sólo he leído ${ficheros} ficheros .ts de src/ (medidos 271 el 7-sep-2026)`);
  assert.ok(documentos.length >= 3,
    `🔴 CIEGO: el censo encuentra ${documentos.length} documentos que se firman y hay AL MENOS `
    + 'TRES medidos: albaran, quote y parteTrabajo. Si baja, el detector dejó de ver.');

  // ✅ CONTROL POSITIVO: el albarán TIENE sello. Sin esto, «ninguno sella» y «no supe mirar el
  // sello» serían el mismo verde con significados opuestos.
  const albaran = documentos.find((d) => d.modelo === 'albaran');
  assert.ok(albaran, '🔴 ESCÁNER CIEGO: el censo no ve la firma del albarán');
  assert.equal(albaran.sella, true,
    '🔴 el censo dice que el ALBARÁN no sella, y sella desde SCRUM-68. El detector está roto: '
    + 'todo lo que diga sobre los demás documentos vale lo mismo que esto.');

  // El presupuesto, que es lo que cierra este ticket.
  const quote = documentos.find((d) => d.modelo === 'quote');
  assert.ok(quote, '🔴 ESCÁNER CIEGO: el censo no ve la firma del presupuesto');
  assert.equal(quote.sella, true,
    '🔴 el PRESUPUESTO firma sin sellar el contenido. Es el defecto del ticket.');

  // 🔴 Y LOS QUE NO SELLEN, CON NOMBRE. Se DECLARAN, no se construyen aquí.
  const sinSello = documentos.filter((d) => !d.sella).map((d) => `${d.modelo} (${d.sitios.join(', ')})`);
  assert.deepEqual(
    sinSello, [],
    '🔴 HAY UN DOCUMENTO QUE SE FIRMA Y NO SELLA QUÉ SE FIRMÓ:\n      ' + sinSello.join('\n      ')
    + '\n\n  El fundador firmó esto «como estándar para todos los docs que se firmen». Si aparece\n'
    + '  uno nuevo, se DECLARA y se le abre ticket propio — no se construye de paso.',
  );
});
