// SCRUM-1528 · El `reason` de una ruta pública es prosa, y la prosa no falla cuando deja de ser verdad.
//
// `POST /auth/register` se cerró en SCRUM-1515 (contesta siempre el mismo 409) y su declaración en
// `publicAccessDeclarations.ts` siguió diciendo «mismo diseño anti-enumeración que /auth/login»:
// una defensa contra un ataque que esa ruta ya no puede sufrir. Nadie lo iba a releer.
//
// Lo que se ata aquí son las dos afirmaciones que el `reason` nuevo hace sobre el handler, leídas
// del handler por AST: que no lee la petición y que contesta `registration_closed`. El día que el
// alta se reabra, el handler volverá a leer la petición y esto caerá pidiendo otro motivo.
//
// LÍMITE: no comprueba el `kind`, ni que la frase esté bien escrita. Sólo que lo que afirma del
// handler se sigue pudiendo leer en el handler.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';

const requiere = createRequire(import.meta.url);
const RAIZ = path.resolve(import.meta.dirname, '..');
const { PUBLIC_ACCESS_DECLARED } = requiere('../dist/core/http/publicAccessDeclarations.js');
const F_RUTAS = path.join(RAIZ, 'src/modules/auth/app/routes/auth.routes.ts');

/** Lo que se puede leer del handler de `router.post('<ruta>', …)`: null si no existe. */
function handlerDe(fuente, ruta) {
  const sf = ts.createSourceFile('x.ts', fuente, ts.ScriptTarget.Latest, true);
  let visto = null;
  const visita = (n) => {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
      && n.expression.name.text === 'post' && n.arguments.length >= 2
      && ts.isStringLiteralLike(n.arguments[0]) && n.arguments[0].text === ruta) {
      const fn = n.arguments[n.arguments.length - 1];
      if (ts.isArrowFunction(fn) || ts.isFunctionExpression(fn)) {
        const peticion = fn.parameters[0] && ts.isIdentifier(fn.parameters[0].name) ? fn.parameters[0].name.text : null;
        let usos = 0;
        const literales = [];
        const dentro = (m) => {
          if (peticion && ts.isIdentifier(m) && m.text === peticion) usos += 1;
          if (ts.isStringLiteralLike(m)) literales.push(m.text);
          ts.forEachChild(m, dentro);
        };
        dentro(fn.body);
        visto = { peticion, leeLaPeticion: usos > 0, literales };
      }
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return visto;
}

/** Qué afirmaciones del `reason` NO se sostienen en el handler. Vacío = cuadra. */
function loQueNoCuadra(reason, handler) {
  const no = [];
  if (/anti-enumeraci/i.test(reason) && !handler.leeLaPeticion) {
    no.push('dice «anti-enumeración» y el handler no lee la petición: no hay nada que enumerar');
  }
  if (/sin leer la petici/i.test(reason) && handler.leeLaPeticion) {
    no.push('dice «sin leer la petición» y el handler la lee');
  }
  if (/registration_closed/.test(reason) && !handler.literales.includes('registration_closed')) {
    no.push('nombra `registration_closed` y el handler no lo contesta');
  }
  return no;
}

test('SCRUM-1528 · el motivo declarado de POST /auth/register dice lo que su handler hace', () => {
  const fuente = fs.readFileSync(F_RUTAS, 'utf8');
  const declaradas = PUBLIC_ACCESS_DECLARED.filter((d) => d.method === 'POST' && d.path === '/auth/register');
  assert.equal(declaradas.length, 1, `población: ${declaradas.length} declaraciones de POST /auth/register (se espera 1)`);
  const [{ reason }] = declaradas;

  // Control del lector: ve un handler que SÍ lee la petición. Sin esto, «no la lee» no diría nada.
  const login = handlerDe(fuente, '/login');
  assert.ok(login, 'el lector no encuentra router.post(\'/login\'): no está mirando donde cree');
  assert.equal(login.leeLaPeticion, true, 'el lector no ve que /auth/login lee la petición: está ciego');

  const alta = handlerDe(fuente, '/register');
  assert.ok(alta, '🔴 no hay router.post(\'/register\') en auth.routes.ts: la declaración apunta a una ruta que se fue');

  // El motivo tiene que AFIRMAR algo comprobable: un motivo que no dice nada del handler pasaría
  // por lo de abajo en vacío.
  assert.match(reason, /sin leer la petici|registration_closed/,
    `🔴 el motivo de POST /auth/register ya no afirma nada que este test sepa leer en el handler: «${reason}»`);

  assert.deepEqual(loQueNoCuadra(reason, alta), [],
    `🔴 el motivo declarado de POST /auth/register ya no describe a su handler.\n  motivo: «${reason}»\n` +
    '  Si el alta se ha reabierto, el motivo se reescribe en src/core/http/publicAccessDeclarations.ts.');
});

test('SCRUM-1528 · EN ROJO: el motivo caducado y un handler reabierto se notan', () => {
  const cerrado = handlerDe("router.post('/register', (_req, res) => res.status(409).json({ error: 'registration_closed' }));", '/register');
  const abierto = handlerDe("router.post('/register', lim, async (req, res) => { await alta(req.body); res.json({ ok: true }); });", '/register');
  assert.deepEqual([cerrado.leeLaPeticion, abierto.leeLaPeticion], [false, true]);

  // El defecto del ticket, literal: el motivo que había, sobre la ruta cerrada.
  assert.equal(loQueNoCuadra('mismo diseño anti-enumeración que /auth/login', cerrado).length, 1);
  // El día que se reabra: el motivo de hoy, sobre una ruta que vuelve a leer la petición.
  assert.equal(loQueNoCuadra('alta cerrada: responde siempre el mismo 409 registration_closed, sin leer la petición', abierto).length, 2);
  // Y lo que cuadra, cuadra: el mismo motivo sobre la ruta cerrada, y el de /auth/login sobre una que lee.
  assert.deepEqual(loQueNoCuadra('alta cerrada: responde siempre el mismo 409 registration_closed, sin leer la petición', cerrado), []);
  assert.deepEqual(loQueNoCuadra('diseño anti-enumeración propio: 200 idéntico exista o no el email', abierto), []);
  // Una ruta que no está no se confunde con una que no lee.
  assert.equal(handlerDe("router.post('/otra', (req, res) => res.end());", '/register'), null);
});
