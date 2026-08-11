// SCRUM-406 · «ESCRÍBENOS»: QUE EL MENSAJE LLEGUE A ALGUIEN, Y QUE ÉL SE ENTERE SI NO LLEGA.
//
// Sin gate: ejecuta la parte pura y deriva el resto por AST. Ni BD, ni red.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// QUÉ ARREGLA
//
// La medición del 10-ago (`docs/master/SCRUM-406.md`) encontró que el producto **no tenía el otro
// extremo**: 24 modelos y ninguno de soporte, ningún destinatario interno en todo `src/`, y un
// `mailto:` que abre el cliente de correo del móvil y se lleva el hilo fuera del producto. El botón
// ya no faltaba —SCRUM-416 puso el «?» en las 25 cabeceras de modal—; faltaba dónde aterrizar.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 EL SUELO ES EL QUE MANDA AQUÍ
//
// Un formulario que se traga el error y dice «enviado» es **peor que el `mailto:` que sustituye**:
// el `mailto:` al menos deja el correo escrito delante del profesional. Por eso la confirmación
// aprobada solo puede pintarse cuando el servidor dice `sent: true`, y por eso se comprueban los
// tres sitios donde eso se puede romper: el envío, la ruta y la pantalla.
//
// ⚠️ NO SE LLAMA A `enviarCorreo()` EN NINGÚN TEST. `.env` de esta casa apunta a PRODUCCIÓN y
// puede traer `RESEND_API_KEY`: invocarlo para «comprobar que envía» mandaría un correo de verdad
// desde la suite. Su comportamiento se deriva de su fuente, y queda declarado que eso es lo que es.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';
import { leerFuente } from './_guard-texto.mjs';
import { construirCorreoSoporte, entornoLegible, exigirMensaje } from '../dist/modules/system/domain/soporte.js';
import { CONTACTO_YAQU, destinoSoporte } from '../dist/core/config/contacto.js';
import { SEND_FAILURE_MESSAGES } from '../dist/lib/sendOutcome.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (p) => fs.readFileSync(path.join(RAIZ, p), 'utf8');
const RUTA = 'src/modules/system/app/routes/soporteAdmin.routes.ts';
const FRONT = 'public/dashboard/js/tutorial.js';

const CTX = {
  merchantId: 22,
  merchantEmail: 'pro@example.com',
  merchantNombre: 'Fontanería Torres S.L.',
  teamMemberId: 7,
  pantalla: '#/trabajos/12',
  instaladaPwa: true,
};

// ── CONTROL POSITIVO · el contexto viaja, o esto no vale más que el mailto ────────────────

test('SCRUM-406 · 🔴 el mensaje llega con QUIÉN lo manda y DESDE DÓNDE', () => {
  const c = construirCorreoSoporte('No me deja firmar el albarán', CTX);
  const todo = c.subject + ' ' + c.html;

  const debe = {
    'el merchant': String(CTX.merchantId),
    'su nombre': CTX.merchantNombre,
    'su email': CTX.merchantEmail,
    'el operario': String(CTX.teamMemberId),
    'la pantalla': CTX.pantalla,
    'el entorno': 'instalada',
    'el mensaje': 'No me deja firmar el albarán',
  };
  for (const [que, valor] of Object.entries(debe)) {
    assert.ok(
      todo.includes(valor),
      `🔴 EL CORREO NO LLEVA ${que.toUpperCase()} («${valor}»).\n\n` +
        '  Sin contexto, un «no me funciona» desde una obra no se puede atender, y este formulario\n' +
        '  no vale más que el `mailto:` que sustituye — que es justo lo que vino a arreglar.',
    );
  }
  // Y se puede CONTESTAR, que es la mitad de «te contestamos por correo».
  assert.equal(
    c.replyTo, CTX.merchantEmail,
    '🔴 el correo no trae `replyTo`: contestarle exigiría copiar su dirección a mano.',
  );
});

test('SCRUM-406 · el entorno sale de los TRES estados de SCRUM-360, sin inventar un cuarto', () => {
  assert.equal(entornoLegible(true), 'instalada');
  assert.equal(entornoLegible(false), 'pestaña');
  assert.equal(entornoLegible(null), 'desconocido',
    '🔴 «no se pudo saber» se está convirtiendo en otra cosa. Es el defecto que la fase 1 de ' +
    'SCRUM-360 cerró: `NO_SE_SABE` no es `NO_PERSISTENTE`.');
  // Y el contexto que falta se dice, no se disfraza de dato.
  const c = construirCorreoSoporte('x', { ...CTX, pantalla: null, merchantEmail: null });
  assert.match(c.html, /sin identificar/, '🔴 una pantalla desconocida no se declara como tal.');
  assert.equal(c.replyTo, null, '🔴 sin email no puede haber replyTo inventado.');
});

// ── 🔴 EL ROJO POR EL MECANISMO · sin destinatario, no hay a dónde ir ─────────────────────

test('SCRUM-406 · 🔴 el mensaje SIEMPRE tiene a dónde ir', () => {
  assert.ok(
    CONTACTO_YAQU && CONTACTO_YAQU.includes('@'),
    '🔴 NO HAY DIRECCIÓN DE CONTACTO. El formulario no tiene a dónde mandar nada y diría «Lo hemos ' +
      'recibido» sobre un correo que no sale de la máquina.',
  );
  assert.ok(
    destinoSoporte({}) === CONTACTO_YAQU,
    '🔴 SIN `SOPORTE_EMAIL` NO HAY DESTINO. El destino por defecto tiene que ser la misma dirección ' +
      'que el producto enseña: una variable de entorno que falta se lee igual que una cadena vacía, ' +
      'y un destino vacío convierte esto en un formulario que no llega a ninguna parte.',
  );
  assert.equal(
    destinoSoporte({ SOPORTE_EMAIL: ' interno@yaqu.app ' }), 'interno@yaqu.app',
    '🔴 no se puede desviar a un buzón interno sin tocar lo que se enseña.',
  );
  const c = construirCorreoSoporte('x', CTX);
  assert.ok(c.to && c.to.includes('@'), `🔴 el correo se construye SIN destinatario (to=«${c.to}»)`);
});

test('SCRUM-406 · un mensaje vacío no gasta el único canal que hay', () => {
  assert.equal(exigirMensaje('   ').ok, false, '🔴 se aceptaría un correo en blanco.');
  assert.equal(exigirMensaje('a'.repeat(9000)).ok, false, '🔴 se aceptaría un cuerpo sin fondo.');
  assert.equal(exigirMensaje('  hola  ').mensaje, 'hola', '🔴 no se normaliza el mensaje.');
});

// ── 🔴 EL SUELO · si no sale, el profesional se entera ────────────────────────────────────

test('SCRUM-406 · 🔴 SUELO: la confirmación SOLO se pinta si el servidor dice que salió', () => {
  const front = leer(FRONT);
  const APROBADA = 'Lo hemos recibido. Te contestamos por correo.';
  assert.ok(front.includes(APROBADA), `🔴 no está la confirmación aprobada: «${APROBADA}»`);

  // Se deriva el `if` que la pinta y se exige que su condición sea `sent === true` — no `ok`, no
  // «no ha lanzado». `ok` es 200 también cuando el correo NO ha salido (SCRUM-126).
  const sf = ts.createSourceFile('x.js', front, ts.ScriptTarget.Latest, true);
  let condicion = null;
  const visitar = (n) => {
    if (ts.isIfStatement(n) && /SOPORTE_OK|Lo hemos recibido/.test(n.thenStatement.getText(sf))) {
      condicion = n.expression.getText(sf);
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  assert.ok(condicion, '🔴 no se encuentra la rama que pinta la confirmación: el guard está ciego.');
  assert.match(
    condicion, /\.sent === true/,
    `🔴 LA CONFIRMACIÓN SE PINTA SIN COMPROBAR \`sent\` (condición: «${condicion}»).\n\n` +
      '  El servidor responde 200 también cuando el correo NO ha salido — `sent` es la única\n' +
      '  verdad (SCRUM-126). Decir «Lo hemos recibido» sin haberlo recibido es peor que el\n' +
      '  `mailto:` que esto sustituye: aquel al menos le dejaba el texto delante.',
  );
});

test('SCRUM-406 · 🔴 SUELO: la ruta no dice que salió cuando no salió', () => {
  const ruta = leer(RUTA);
  const sf = ts.createSourceFile('x.ts', ruta, ts.ScriptTarget.Latest, true);
  let fallo = false;
  let exito = false;
  const visitar = (n) => {
    if (ts.isIfStatement(n) && /!\s*r\.enviado/.test(n.expression.getText(sf))
        && /sendFailureBody/.test(n.thenStatement.getText(sf))) fallo = true;
    if (ts.isCallExpression(n) && n.expression.getText(sf) === 'sendSuccessBody') exito = true;
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  assert.ok(
    fallo,
    '🔴 LA RUTA NO DEVUELVE UN FALLO CUANDO EL CORREO NO SALE. Sin esa rama responde éxito ' +
      'siempre, y la pantalla pinta la confirmación sobre un correo que no existe.',
  );
  assert.ok(exito, '🔴 la ruta no responde éxito nunca: el control de arriba pasaría por vacío.');
});

test('SCRUM-406 · 🔴 SUELO: «sin transporte» NO se cuenta como enviado', () => {
  // ⚠️ Derivado de la fuente A PROPÓSITO: llamar a `enviarCorreo()` aquí mandaría un correo de
  // verdad si `.env` trae `RESEND_API_KEY` — y el `.env` de esta casa apunta a producción.
  const env = leer('src/integrations/enviarCorreo.ts');
  const sf = ts.createSourceFile('x.ts', env, ts.ScriptTarget.Latest, true);
  const retornos = [];
  const visitar = (n) => {
    if (ts.isReturnStatement(n) && n.expression) retornos.push(n.expression.getText(sf).replace(/\s+/g, ' '));
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  assert.ok(retornos.length >= 4, `🔴 solo ${retornos.length} retornos leídos: el guard está ciego.`);
  assert.ok(
    retornos.some((r) => /sin_transporte/.test(r) && /enviado: false/.test(r)),
    '🔴 SIN RESEND NI SMTP NO SE DEVUELVE UN FALLO.\n\n' +
      '  `createMailer()` cae a `streamTransport`, que escribe el correo en un buffer en memoria y ' +
      'resuelve BIEN.\n  Un `sendMail` que triunfa contra un buffer es la forma que tiene «no ' +
      'configurado» de disfrazarse de «enviado».',
  );
  // Y ningún `enviado: true` fuera de las dos ramas configuradas.
  const exitos = retornos.filter((r) => /enviado: true/.test(r));
  assert.equal(
    exitos.length, 2,
    `🔴 hay ${exitos.length} retornos con \`enviado: true\` y las vías configuradas son dos ` +
      '(Resend y SMTP). Uno de más es un éxito que alguien devuelve sin haber enviado.',
  );
});

test('SCRUM-406 · el texto del fallo NO es copy nuevo: es el de sendOutcome', () => {
  const front = leer(FRONT);
  const canonico = SEND_FAILURE_MESSAGES.email_send_failed;
  assert.ok(
    front.includes(canonico),
    `🔴 el front no usa el texto canónico del fallo.\n  Canónico: «${canonico}»\n` +
      '  Copy aprobada duplicada es copy que acaba divergiendo: si aquí hace falta, tiene que ser ' +
      'LA MISMA cadena, y este assert es lo que lo mantiene.',
  );
});

// ── LA CONSTANTE · el canal muerto que avisaba libroRegistroView ──────────────────────────

test('SCRUM-406 · 🔴 `hola@yaqu.app` no diverge en ningún sitio del árbol', () => {
  // El comentario de `libroRegistroView.js` lo avisaba: «el día que cambie hay que cambiarlo en
  // todos, y el que se olvide deja un canal muerto sin que nadie se entere». Un canal muerto NO da
  // error: el profesional escribe y no llega, y desde dentro todo parece correcto.
  // ⚠️ Solo PUNTOS DE CONTACTO REALES, y sobre código sin comentarios. La primera versión buscaba
  // cualquier `…@yaqu.app` en el árbol y salió roja contra `env.ts:82`, un COMENTARIO que pone
  // «Ej: "luis@yaqu.app,otro@yaqu.app"». El guard de texto se caza a sí mismo en la frase que
  // explica el asunto — es la lección de `_guard-texto.mjs`, y van siete.
  const sitios = [];
  const visitar = (dir) => {
    for (const e of fs.readdirSync(path.join(RAIZ, dir), { withFileTypes: true })) {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) { if (!/node_modules|\.git|dist/.test(e.name)) visitar(p); continue; }
      if (!/\.(html|js|ts|mjs)$/.test(e.name)) continue;
      const abs = path.join(RAIZ, p);
      // El HTML se lee crudo (su `mailto:` ES el contenido); el código, sin comentarios.
      const t = /\.html$/.test(e.name) ? fs.readFileSync(abs, 'utf8') : leerFuente(abs);
      // Un punto de contacto es un `mailto:` o la constante que lo alimenta. Una dirección suelta
      // en una cadena de ejemplo o en un dato de prueba no es un canal.
      const patrones = [/mailto:([A-Za-z0-9._%+-]+@yaqu\.app)/g, /CONTACTO_YAQU\s*=\s*'([^']+)'/g];
      for (const re of patrones) for (const m of t.matchAll(re)) sitios.push({ p, dir: m[1] });
    }
  };
  visitar('public');
  visitar('src');

  assert.ok(
    sitios.length >= 6,
    `🔴 ESCÁNER CIEGO: solo ${sitios.length} direcciones @yaqu.app encontradas, y se midieron SEIS ` +
      'apariciones de contacto (privacidad ×3, términos, tutorial, libro registro). Con cero, ' +
      '«ninguna diverge» sería verdad sin haber mirado nada.',
  );
  // Se excluyen las que NO son la de contacto (el demo de la regla 8 es otra cosa).
  const contacto = sitios.filter((s) => !/^demo@/.test(s.dir));
  const distintas = [...new Set(contacto.map((s) => s.dir))];
  assert.deepEqual(
    distintas, [CONTACTO_YAQU],
    `🔴 HAY MÁS DE UNA DIRECCIÓN DE CONTACTO VIVA: ${distintas.join(', ')}\n\n` +
      '  La que manda es `src/core/config/contacto.ts` → ' + CONTACTO_YAQU + '\n' +
      '  Una divergencia aquí deja un canal muerto sin que nadie se entere: el profesional escribe ' +
      'a la dirección vieja y desde dentro del producto todo parece correcto.\n' +
      `  Sitios: ${contacto.map((s) => s.p).filter((v, i, a) => a.indexOf(v) === i).join(', ')}`,
  );
});

// ── CONTROL NEGATIVO · lo de antes sigue funcionando ─────────────────────────────────────

test('SCRUM-406 · CONTROL NEGATIVO: las legales y la guía siguen como estaban', () => {
  // Las páginas legales NO pasan a depender de JavaScript: su contacto es obligación legal y un
  // fallo de JS no puede dejarlas sin él.
  for (const legal of ['public/privacidad.html', 'public/terminos.html']) {
    const t = leer(legal);
    assert.ok(
      t.includes(`mailto:${CONTACTO_YAQU}`),
      `🔴 ${legal} ha perdido su enlace de contacto. Es HTML estático a propósito: sustituirlo por ` +
        'algo que rellena JS significaría que un fallo de JavaScript deja una página legal sin la ' +
        'vía de contacto que el RGPD exige.',
    );
  }
  const front = leer(FRONT);
  // La guía sigue siendo la guía: acordeones y cierre.
  for (const pieza of ['tut-acc', 'tut-guide-close', 'openHelpGuide']) {
    assert.ok(front.includes(pieza), `🔴 la guía ha perdido «${pieza}»: esto no tocaba el panel.`);
  }
  // Y el `mailto:` NO desaparece: es la salida cuando el envío no sale.
  assert.match(
    front, /mailto:/,
    '🔴 se ha quitado el `mailto:` de la guía. Sigue siendo la salida cuando el correo no sale — ' +
      'quitarlo dejaría al profesional sin ninguna vía justo en el caso que este ticket teme.',
  );
  // El FAB y su ocultación con modal abierta: decisión del 6-jul, intacta (SCRUM-416).
  assert.match(
    leer('public/dashboard/css/styles.css'),
    /body:has\(\.modal-overlay\) #tut-help-btn \{ display: none !important; \}/,
    '🔴 se ha tocado la ocultación del FAB con modal abierta. Es decisión del fundador del 6-jul y ' +
      'no es de este ticket.',
  );
});

test('SCRUM-406 · los CUATRO textos aprobados están literales', () => {
  const front = leer(FRONT);
  for (const t of ['Escríbenos', '¿Qué ha pasado?', 'Enviar', 'Lo hemos recibido. Te contestamos por correo.']) {
    assert.ok(front.includes(t), `🔴 falta el texto aprobado «${t}» (regla 30: no se reescribe).`);
  }
  // Y NO se promete plazo: es deliberado, «en 24 h» no hay quien lo sostenga hoy.
  assert.doesNotMatch(
    front.slice(front.indexOf('SOPORTE_OK')), /24\s*h|24 horas|en menos de/i,
    '🔴 la confirmación ha empezado a prometer un plazo. La aprobada no lo hace a propósito.',
  );
});
