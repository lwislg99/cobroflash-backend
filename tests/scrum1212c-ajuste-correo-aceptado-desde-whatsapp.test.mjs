// tests/scrum1212c-ajuste-correo-aceptado-desde-whatsapp.test.mjs — SCRUM-1212 (texto del ajuste)
//
// El ajuste «Recibir email cuando un cliente acepta un presupuesto» decía «Te notificamos cuando el
// cliente firma y acepta desde su portal.», y era falso: el correo solo sale por el BOT de WhatsApp,
// que acepta por texto, sin portal y sin firma. Texto firmado por Luis el 28-sep (c.17355), y
// Javier el 29-sep: «Nos alineamos» (c.17558): NO se conecta ningún correo nuevo, así que la web
// (`/decision`) no lo manda y el texto dice «desde WhatsApp».
//
// 🔴 LA MITAD QUE IMPORTA: el texto es verdad SOLO mientras el bot sea el único que llama al emisor.
// Si mañana alguien engancha el correo en otro camino (p. ej. `/decision`), esto se pone ROJO: el
// ajuste pasaría a mentir por omisión, y además es la decisión de c.17558 la que se estaría
// deshaciendo. Se mide por AST (llamadas de código, nunca comentarios) sobre `src/`.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const RAIZ = path.resolve(import.meta.dirname, '..');
const EMISOR = 'sendMerchantQuoteAcceptedEmail';
const BOT = 'src/modules/whatsappBot/app/routes/whatsappIncoming.routes.ts';
const AJUSTE = path.join(RAIZ, 'public/dashboard/js/settingsView.js');
const TEXTO = 'Te avisamos por correo cuando un cliente acepte un presupuesto desde WhatsApp.';

function ficherosTs(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...ficherosTs(p));
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

/** Ficheros de `src/` con una LLAMADA al emisor (la declaración y los comentarios no cuentan). */
function ficherosQueLlaman() {
  const out = new Set();
  for (const f of ficherosTs(path.join(RAIZ, 'src'))) {
    const texto = fs.readFileSync(f, 'utf8');
    if (!texto.includes(EMISOR)) continue;
    const sf = ts.createSourceFile(f, texto, ts.ScriptTarget.Latest, true);
    const ver = (n) => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === EMISOR) {
        out.add(path.relative(RAIZ, f).replace(/\\/g, '/'));
      }
      ts.forEachChild(n, ver);
    };
    ver(sf);
  }
  return [...out].sort();
}

test('SCRUM-1212 · el ajuste dice el texto firmado (c.17355) y no el del portal', () => {
  const src = fs.readFileSync(AJUSTE, 'utf8');
  assert.ok(src.includes(TEXTO), '🔴 falta el texto firmado del ajuste');
  assert.ok(!src.includes('desde su portal'), '🔴 vuelve «desde su portal»: el correo no sale por ningún portal');
  assert.ok(!src.includes('firma y acepta'), '🔴 vuelve «firma y acepta»: el bot acepta por texto, sin firma');
});

test('🔴 SCRUM-1212 · el correo «presupuesto aceptado» sale SOLO por el bot de WhatsApp', () => {
  const llaman = ficherosQueLlaman();
  // Control positivo: el detector VE la llamada del bot. Sin esto, un [] también «cumpliría».
  assert.ok(llaman.includes(BOT), `🔴 CIEGO: no veo la llamada del bot en ${BOT}; lo de abajo no mediría nada`);
  assert.deepEqual(llaman, [BOT],
    '🔴 otro camino manda el correo «presupuesto aceptado». El ajuste dice «desde WhatsApp» y la '
    + 'decisión de c.17558 es que NO se conecta ningún correo nuevo: vuelve a SCRUM-1212 antes.');
});
