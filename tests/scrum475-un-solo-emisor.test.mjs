// SCRUM-475 · UN SOLO EMISOR, Y EL ACUSE DEL PROVEEDOR DEJA DE TIRARSE A LA BASURA.
//
// Sin gate: AST sobre `src/`. Ni BD, ni red.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LO MEDIDO ANTES DE TOCAR NADA (PASO 0, 11-ago-2026)
//
//     POST a api.resend.com en src/: 7
//     · descartan la respuesta: 7 de 7
//     · ¿alguien lee el id del acuse?: NADIE
//
// Siete copias del mismo POST, cada una con su timeout y su formato, y **ninguna miraba lo que
// contestaba el proveedor**: la llamada era una sentencia suelta y el valor se perdía. Resend
// devuelve un `id` por envío; sin él no se puede volver a preguntar por un correo concreto, ni
// cruzar «lo mandamos» con «rebotó». Una entrega fallida llegaba igual de callada que una buena.
//
// ⚠️ ESTA FASE NO PERSISTE NADA. El acuse se devuelve y se registra en el log; guardarlo es una
// tabla, y una tabla es decisión de schema, del fundador. Ver el informe.
//
// ⚠️ NO SE LLAMA A NINGÚN EMISOR EN NINGÚN TEST. `.env` apunta a producción y puede traer
// `RESEND_API_KEY`: invocarlos para «comprobar que envían» mandaría correo de verdad desde la suite.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const EMISOR = 'src/integrations/enviarCorreo.ts';

/** Todos los `.post(...)` a la API de Resend del árbol, DERIVADOS del AST. */
function postsAResend() {
  const out = [];
  let ficheros = 0;
  const visitarDir = (dir) => {
    for (const e of fs.readdirSync(path.join(RAIZ, dir), { withFileTypes: true })) {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) { visitarDir(p); continue; }
      if (!e.name.endsWith('.ts')) continue;
      ficheros += 1;
      const src = fs.readFileSync(path.join(RAIZ, p), 'utf8');
      if (!/api\.resend\.com/.test(src)) continue;
      const sf = ts.createSourceFile('x.ts', src, ts.ScriptTarget.Latest, true);
      const visitar = (n) => {
        // ⚠️ Se mira la LLAMADA, no el texto: `api.resend.com` aparece también en el comentario
        // que explica esta misma regla, y un guard de texto se caza a sí mismo ahí.
        if (ts.isCallExpression(n) && /\.post$/.test(n.expression.getText(sf))
            && n.arguments[0] && /api\.resend\.com/.test(n.arguments[0].getText(sf))) {
          const { line } = sf.getLineAndCharacterOfPosition(n.getStart(sf));
          // ¿Qué se hace con lo que devuelve?
          let nodo = n;
          if (nodo.parent && ts.isAwaitExpression(nodo.parent)) nodo = nodo.parent;
          const padre = nodo.parent;
          const descartada = !!padre && ts.isExpressionStatement(padre);
          out.push({ fichero: p, linea: line + 1, descartada });
        }
        ts.forEachChild(n, visitar);
      };
      visitar(sf);
    }
  };
  visitarDir('src');
  return { posts: out, ficheros };
}

// ── SUELO ────────────────────────────────────────────────────────────────────────────────

test('SCRUM-475 · SUELO: el censo recorre el árbol y encuentra el emisor', () => {
  const { posts, ficheros } = postsAResend();
  assert.ok(ficheros > 100, `🔴 ESCÁNER CIEGO: solo ${ficheros} ficheros .ts recorridos en src/.`);
  assert.ok(
    posts.length >= 1,
    '🔴 ESCÁNER CIEGO: CERO llamadas a Resend en todo el árbol. «Ya no hay ninguna» y «el detector ' +
      'no sabe verlas» son el mismo cero — y con cero, el tope de abajo se cumpliría solo.',
  );
});

// ── 🔴 EL VECTOR: UN SOLO EMISOR ─────────────────────────────────────────────────────────

test('SCRUM-475 · 🔴 hay EXACTAMENTE UN POST a Resend, y vive en el emisor', () => {
  const { posts } = postsAResend();
  // Igualdad, no `<=`: si mañana desaparece, el emisor habrá dejado de enviar y eso también se sabe.
  assert.equal(
    posts.length, 1,
    `🔴 HAY ${posts.length} LLAMADAS A RESEND Y TIENE QUE HABER UNA.\n\n` +
      '  Antes de SCRUM-475 eran SIETE, cada una con su timeout, su formato y su manera de tratar\n' +
      '  el error — y las siete tiraban el acuse del proveedor. Un emisor nuevo suelto vuelve a\n' +
      '  abrir esa puerta: el día que haya que cambiar algo del envío (un reintento, una cabecera,\n' +
      '  el registro del id) habrá que acordarse de todos, y el que se olvide no dará error.\n' +
      `  Llamadas: ${posts.map((p) => `${p.fichero}:${p.linea}`).join(', ')}\n\n` +
      `  Si necesitas enviar desde otro sitio, llama a \`${EMISOR}\`.`,
  );
  assert.equal(
    posts[0].fichero, EMISOR,
    `🔴 el único POST a Resend ya no está en ${EMISOR} sino en ${posts[0].fichero}.`,
  );
});

test('SCRUM-475 · 🔴 el emisor NO descarta lo que contesta el proveedor', () => {
  const { posts } = postsAResend();
  const descartadas = posts.filter((p) => p.descartada);
  assert.deepEqual(
    descartadas.map((p) => `${p.fichero}:${p.linea}`), [],
    '🔴 LA RESPUESTA DEL PROVEEDOR SE ESTÁ TIRANDO.\n\n' +
      '  Era el estado de las SIETE llamadas antes de este ticket: la llamada como sentencia suelta\n' +
      '  y el valor perdido. Resend devuelve un `id` por envío; sin guardarlo no se puede volver a\n' +
      '  preguntar por ese correo, y un envío que rebota queda igual de callado que uno que llega.',
  );
});

// ── 🔴 EL ACUSE LLEGA A QUIEN LO PIDIÓ ───────────────────────────────────────────────────

test('SCRUM-475 · 🔴 el acuse del proveedor VIAJA hasta el llamador', () => {
  const emisor = fs.readFileSync(path.join(RAIZ, EMISOR), 'utf8');
  const sf = ts.createSourceFile('x.ts', emisor, ts.ScriptTarget.Latest, true);

  // ① El emisor lo extrae de la respuesta y lo devuelve.
  const retornos = [];
  const visitar = (n) => {
    if (ts.isReturnStatement(n) && n.expression) retornos.push(n.expression.getText(sf).replace(/\s+/g, ' '));
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  assert.ok(
    retornos.some((r) => /enviado: true/.test(r) && /acuse:\s*\{/.test(r)),
    '🔴 EL EMISOR NO DEVUELVE EL ACUSE. Puede estar leyendo el `id` y no sacarlo: entonces el\n' +
      '  llamador sigue sin poder decir QUÉ envío fue, que es la mitad de este ticket.\n' +
      `  Retornos vistos: ${retornos.join(' | ')}`,
  );

  // ② Y un llamador REAL lo recoge y lo saca hacia fuera. Sin esto, el acuse llegaría hasta el
  //    borde del emisor y se pararía ahí — «lo devuelve» sin que nadie lo reciba.
  const factura = fs.readFileSync(path.join(RAIZ, 'src/modules/messaging/domain/email.service.ts'), 'utf8');
  assert.match(
    factura, /acuseId:\s*r\.acuse\?\.id/,
    '🔴 NINGÚN LLAMADOR RECOGE EL ACUSE. `email.service` es el que manda la factura al cliente: si ' +
      'no saca el id, el acuse muere dentro del emisor y para el resto del sistema es como si no ' +
      'existiera.',
  );
});

test('SCRUM-475 · el acuse se registra en el log de forma ESTRUCTURADA y sin el correo entero', () => {
  const emisor = fs.readFileSync(path.join(RAIZ, EMISOR), 'utf8');
  assert.match(
    emisor, /console\.log\('\[correo\]', JSON\.stringify\(\{[\s\S]*?id,/,
    '🔴 el envío no se registra con su `id` en un log estructurado. Un log en prosa no se puede ' +
      'buscar ni cruzar: el id tiene que salir como campo.',
  );
  // 🔴 Y el destinatario NO va entero: un correo es un dato personal y los logs de Railway los lee
  // cualquiera con acceso al panel.
  assert.match(
    emisor, /to:\s*maskEmail\(/,
    '🔴 EL LOG ESTÁ ESCRIBIENDO EL CORREO DEL DESTINATARIO SIN ENMASCARAR. Es un dato personal y ' +
      'los logs los lee cualquiera con acceso al panel de Railway.',
  );
  assert.doesNotMatch(
    emisor, /console\.log\([^)]*c\.html/,
    '🔴 el cuerpo del correo se está registrando en el log.',
  );
});

// ── EL SUELO QUE YA EXISTÍA, Y QUE NO SE PIERDE ──────────────────────────────────────────

test('SCRUM-475 · SIGUE en pie: sin transporte no se cuenta como enviado (SCRUM-406)', () => {
  // No es un test nuevo: es el suelo de SCRUM-406, que este ticket podía llevarse por delante al
  // reescribir el emisor. `createMailer()` cae a `streamTransport`, que escribe el correo en un
  // buffer en memoria y resuelve BIEN — la forma que tiene «no configurado» de disfrazarse de
  // «enviado». Medido hoy: sigue cayendo ahí.
  const mailer = fs.readFileSync(path.join(RAIZ, 'src/integrations/mailer.ts'), 'utf8');
  assert.match(
    mailer, /streamTransport/,
    '🔴 `createMailer` ya no cae a streamTransport: si ahora falla de otra forma, el motivo ' +
      '`sin_transporte` de abajo puede haber dejado de significar lo que dice.',
  );
  const emisor = fs.readFileSync(path.join(RAIZ, EMISOR), 'utf8');
  const sf = ts.createSourceFile('x.ts', emisor, ts.ScriptTarget.Latest, true);
  const retornos = [];
  const visitar = (n) => {
    if (ts.isReturnStatement(n) && n.expression) retornos.push(n.expression.getText(sf).replace(/\s+/g, ' '));
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  assert.ok(
    retornos.some((r) => /sin_transporte/.test(r) && /enviado: false/.test(r)),
    '🔴 SE HA PERDIDO EL SUELO DE SCRUM-406: sin Resend ni SMTP el emisor tiene que decir que NO ' +
      'salió. Un `sendMail` que triunfa contra un buffer es «no configurado» disfrazado de «enviado».',
  );
  const exitos = retornos.filter((r) => /enviado: true/.test(r));
  assert.equal(
    exitos.length, 2,
    `🔴 hay ${exitos.length} retornos con \`enviado: true\` y las vías son dos (Resend y SMTP).`,
  );
});

// ── CONTROL NEGATIVO ─────────────────────────────────────────────────────────────────────

test('SCRUM-475 · CONTROL NEGATIVO: los emisores migrados siguen teniendo su respaldo', () => {
  // Unificar el POST no puede llevarse por delante lo que cada uno hacía DISTINTO.
  const factura = fs.readFileSync(path.join(RAIZ, 'src/modules/messaging/domain/email.service.ts'), 'utf8');
  assert.match(
    factura, /outboxDir/,
    '🔴 `email.service` ha perdido su salida a `.eml` del outbox de dev (SCRUM-76). Por eso llama a ' +
      '`enviarPorResend` y no a `enviarCorreo`: tiene respaldo propio debajo y no puede delegar la ' +
      'política entera.',
  );
  assert.match(
    factura, /streamTransport/,
    '🔴 se ha perdido el fallback SMTP/stream de `email.service`.',
  );
  const lifecycle = fs.readFileSync(path.join(RAIZ, 'src/modules/messaging/domain/lifecycle.service.ts'), 'utf8');
  assert.match(
    lifecycle, /\(sin RESEND\)/,
    '🔴 se ha perdido el aviso de dev de SCRUM-101 en lifecycle.',
  );

  // 🔴 Y la semántica de FALLO no cambia: los cinco emisores migrados siguen lanzando cuando no
  // sale. Sus llamadores dependen de la excepción —`.catch()` para registrar, y `markSent()` que
  // NO debe correr si el correo no salió—. Convertir eso en un `return` silencioso habría marcado
  // como enviado un correo que no existe: la mentira exacta que este ticket viene a quitar.
  for (const f of ['messaging/domain/lifecycle.service', 'messaging/domain/weeklyDigest.service',
                   'messaging/domain/merchantNotifications', 'auth/domain/auth.service']) {
    const t = fs.readFileSync(path.join(RAIZ, `src/modules/${f}.ts`), 'utf8');
    assert.match(
      t, /if \(!r\.enviado\) throw new Error/,
      `🔴 ${f} ha dejado de lanzar cuando el correo no sale. Sus llamadores detectan el fallo por la ` +
        'EXCEPCIÓN: sin ella, un fallo deja de registrarse y (en lifecycle) el email se marca como ' +
        'enviado sin haberlo estado.',
    );
  }
});
