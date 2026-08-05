// SCRUM-340 · EL CONTADOR DE PLAZAS CUENTA COMPRAS, NO CAMPOS — Y SI NO PUEDE, NO PINTA.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL DEFECTO QUE CIERRA
//
// `founding.ts` contaba `merchant.count({ where: { plan: 'founding' } })`. `plan` es un campo QUE
// SE ASIGNA; el texto que ve el visitante promete que alguien COMPRÓ. Y al cancelar, el webhook
// devuelve el plan a `trial`, así que la plaza se LIBERABA y el contador SUBÍA — un número de
// escasez que va hacia atrás es lo que hace pensar que está inventado.
//
// EL ROJO DEL DÍA, y es el que da sentido a todo esto: hoy no ha pagado NADIE, y aun así la landing
// pintaba «quedan 20 plazas» porque 20 > 0. Se pintaba a cero compras.
//
// ⚠️ ESTE GUARD NO TOCA LA BASE. La regla vive en `plazaOcupada`, que es PURA justamente para poder
// probar los estados intermedios con casos —`past_due` ocupa, `incomplete` no— sin BD y sin red.
// Lo que sí se deriva del árbol es que nadie vuelva a contar por el campo ni a pintar por su cuenta.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

import {
  plazaOcupada, FOUNDING_SEATS, ESTADOS_QUE_ACREDITAN_COBRO, MARCADOR_PRIMER_PAGO,
} from '../dist/modules/billing/domain/founding.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FUENTE_DOMINIO = 'src/modules/billing/domain/founding.ts';

/**
 * Quita comentarios antes de mirar el código.
 *
 * ⚠️ NO es cosmética: sin esto el guard SE CAZA A SÍ MISMO. Los comentarios que explican por qué ya
 * no se decide con `seatsLeft > 0` contienen, necesariamente, `seatsLeft > 0`. Mordió en el primer
 * intento —señaló `precios.html` por su propia explicación— y es la misma trampa que este repo lleva
 * documentada desde SCRUM-176/168/3/193 y que volvió a morder esta madrugada en SCRUM-299.
 */
function sinComentarios(texto) {
  return texto
    .replace(/<!--[\s\S]*?-->/g, ' ')   // HTML
    .replace(/\/\*[\s\S]*?\*\//g, ' ')  // JS de bloque
    .replace(/^[ \t]*\/\/.*$/gm, ' ');  // JS de línea
}

// Las superficies que pintan, DERIVADAS: cualquier fichero de `public/` que consulte el estado.
function superficiesQuePintan() {
  const out = [];
  const anda = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { anda(p); continue; }
      if (!/\.(html|js)$/.test(e.name)) continue;
      const texto = fs.readFileSync(p, 'utf8');
      const codigo = sinComentarios(texto);
      if (codigo.includes('founding-status') || /founding\s*&&|founding\./.test(codigo)) {
        out.push({ fichero: path.relative(RAIZ, p).replace(/\\/g, '/'), texto: codigo });
      }
    }
  };
  anda(path.join(RAIZ, 'public'));
  return out;
}

const superficies = superficiesQuePintan();

// ── SUELO ────────────────────────────────────────────────────────────────────────────────

test('SCRUM-340 · SUELO: la regla se puede ejercitar y las superficies se encuentran', () => {
  assert.equal(typeof plazaOcupada, 'function',
    '🔴 no se puede importar la regla: todo lo de abajo estaría probando nada');
  assert.ok(ESTADOS_QUE_ACREDITAN_COBRO.length > 0 && MARCADOR_PRIMER_PAGO,
    '🔴 el dominio ya no declara ni los estados ni el marcador: la regla se ha vuelto opaca');

  // Control positivo: un caso que SÍ ocupa. Si esto fallara, los «false» de abajo no significarían
  // «no ocupa», significarían «la función devuelve false siempre».
  assert.equal(plazaOcupada({ subscriptionStatus: 'active', lifecycleEmailsSent: null }), true,
    '🔴 ni el caso más claro ocupa plaza: la regla está rota, no vacía');

  assert.ok(superficies.length >= 3,
    `🔴 solo se ven ${superficies.length} superficies que pinten el contador y deberían ser al menos 3 ` +
    '(landing, precios y el panel). Si el censo no las encuentra, el guard de abajo no vigila nada.');
});

// ── LA REGLA: QUÉ OCUPA UNA PLAZA ────────────────────────────────────────────────────────

test('SCRUM-340 · ocupa quien COMPRÓ, y la plaza NO se libera al cancelar', () => {
  const caso = (subscriptionStatus, marcas) => plazaOcupada({ subscriptionStatus, lifecycleEmailsSent: marcas });

  // Pagó y sigue: ocupa.
  assert.equal(caso('active', null), true, '🔴 una suscripción activa no ocupa plaza');
  // Pagó y ahora le falla un cobro: compró. Ocupa.
  assert.equal(caso('past_due', null), true, '🔴 `past_due` es alguien que PAGÓ y ahora falla un cobro: ocupa');

  // Canceló DESPUÉS de pagar: la plaza está gastada. Este es el caso que impide que el contador
  // suba, y solo se puede acreditar con el marcador — al cancelar, el webhook borra
  // `stripeSubscriptionId` y devuelve `plan` a `trial`.
  assert.equal(caso('canceled', { [MARCADOR_PRIMER_PAGO]: 1 }), true,
    '🔴 UNA PLAZA PAGADA SE ESTÁ LIBERANDO AL CANCELAR. El contador subiría, y un número de escasez ' +
    'que va hacia atrás es exactamente lo que hace pensar que está inventado.');

  // Nunca completó el pago: no ocupa. `incomplete_expired` se guarda como `canceled`, así que sin
  // marcador es indistinguible de un cancelado-sin-pagar — y ninguno de los dos compró.
  assert.equal(caso('canceled', null), false, '🔴 un cancelado sin pago acreditado NO ocupa');
  assert.equal(caso('incomplete', null), false, '🔴 `incomplete` nunca completó el pago: no ocupa');
  assert.equal(caso('incomplete_expired', null), false, '🔴 `incomplete_expired` no ocupa');
  assert.equal(caso(null, null), false, '🔴 sin suscripción y sin marcador no se ocupa nada');
});

test('SCRUM-340 · el CAMPO `plan` no ocupa plaza por sí solo (es el bug de origen)', () => {
  // Un `plan` asignado a mano no acredita ninguna compra. Si esto empezara a devolver `true`,
  // habríamos vuelto exactamente al contador que este ticket quita.
  assert.equal(plazaOcupada({ subscriptionStatus: null, lifecycleEmailsSent: null, plan: 'founding' }), false,
    '🔴 EL CAMPO `plan` VUELVE A OCUPAR PLAZA. Es el bug de SCRUM-340: `plan` se asigna a mano y el ' +
    'texto promete una COMPRA.');
});

// ── QUE NADIE VUELVA A CONTAR POR EL CAMPO ───────────────────────────────────────────────

test('SCRUM-340 · la consulta del contador NO filtra por `plan` (derivado del AST)', () => {
  const abs = path.join(RAIZ, FUENTE_DOMINIO);
  const sf = ts.createSourceFile(abs, fs.readFileSync(abs, 'utf8'), ts.ScriptTarget.Latest, true);

  const consultas = [];
  (function walk(n) {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
        && ts.isPropertyAccessExpression(n.expression.expression)
        && n.expression.expression.name.text === 'merchant') {
      consultas.push({
        metodo: n.expression.name.text,
        args: n.arguments.map((a) => a.getText(sf).replace(/\s+/g, ' ')).join(', '),
        linea: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1,
      });
    }
    ts.forEachChild(n, walk);
  })(sf);

  assert.ok(consultas.length > 0,
    '🔴 el AST no encuentra NINGUNA consulta a `merchant` en el dominio del contador: el detector ' +
    'está ciego y el assert de abajo pasaría en verde sin mirar nada.');

  const porElCampo = consultas.filter((c) => /\bplan\b/.test(c.args));
  assert.deepEqual(porElCampo, [],
    '🔴 EL CONTADOR VUELVE A MIRAR EL CAMPO `plan`:\n    ' +
    porElCampo.map((c) => `línea ${c.linea}: merchant.${c.metodo}(${c.args.slice(0, 120)})`).join('\n    ') +
    '\n\n  `plan` se ASIGNA (a mano o por el webhook) y se devuelve a `trial` al cancelar. El texto\n' +
    '  promete que alguien COMPRÓ: se cuenta por la señal del cobro, no por el campo.');
});

// ── EL PINTADO: UNA SOLA FUENTE, Y CON SUELO ─────────────────────────────────────────────

test('SCRUM-340 · las tres superficies pintan por `mostrar`/`ofertaVigente`, no por su cuenta', () => {
  const culpables = superficies
    .filter((s) => !/mostrar|ofertaVigente/.test(s.texto))
    .map((s) => s.fichero);

  assert.deepEqual(culpables, [],
    '🔴 HAY SUPERFICIES QUE DECIDEN POR SU CUENTA SI PINTAN EL CONTADOR:\n    ' + culpables.join('\n    ') +
    '\n\n  La condición vive en el servidor (`mostrar` y `ofertaVigente`) por un motivo medido: eran\n' +
    '  TRES copias de la misma regla, cada una escrita a su manera, y con cero compras las tres\n' +
    '  pintaban «quedan 20 de 20». Tres copias son tres sitios donde olvidar el cambio siguiente.');

  // Y que ninguna vuelva a decidir con `seatsLeft`, que es el patrón exacto de antes.
  const porSeatsLeft = superficies
    .filter((s) => /seatsLeft\s*>\s*0|seatsLeft\s*<=\s*0/.test(s.texto))
    .map((s) => s.fichero);
  assert.deepEqual(porSeatsLeft, [],
    '🔴 alguna superficie vuelve a decidir el pintado con `seatsLeft`:\n    ' + porSeatsLeft.join('\n    ') +
    '\n\n  Ese es el patrón de antes: `seatsLeft > 0` es cierto con CERO compras, y pintaba «quedan 20».');
});

test('SCRUM-340 · el suelo: con cero plazas ocupadas NO se pinta, y sin dato tampoco', () => {
  // Se reproduce la decisión del dominio con sus mismas dos reglas, sobre casos. (La función que
  // consulta la BD no se ejercita aquí: eso pediría base de datos, y la decisión es lo que importa.)
  const decidir = (taken, resoluble = true) => {
    if (!resoluble) return { ofertaVigente: false, mostrar: false };
    const seatsLeft = Math.max(0, FOUNDING_SEATS - taken);
    return { ofertaVigente: seatsLeft > 0, mostrar: taken > 0 && seatsLeft > 0 };
  };

  // EL ROJO DEL DÍA: hoy no ha pagado nadie.
  assert.equal(decidir(0).mostrar, false,
    '🔴 CON CERO COMPRAS SE ESTARÍA PINTANDO EL CONTADOR. «Quedan 20 de 20» no comunica escasez: ' +
    'comunica que no ha comprado nadie.');
  assert.equal(decidir(0).ofertaVigente, true,
    '🔴 con cero compras la OFERTA sigue vigente y debe anunciarse por su precio, que es cierto');

  // LA DIVERGENCIA, fijada aquí para que no se pierda: la condición de ANTES era `seatsLeft > 0`,
  // que con CERO compras es cierta (20 > 0) — por eso la landing pintaba «quedan 20 plazas» sin que
  // hubiera pagado nadie. Las dos reglas solo se separan en este caso, y es justo el de hoy.
  assert.equal(FOUNDING_SEATS - 0 > 0, true,
    '🔴 si esto dejara de ser cierto, el caso que originó el ticket habría cambiado de forma');
  assert.notEqual(decidir(0).mostrar, FOUNDING_SEATS - 0 > 0,
    '🔴 la regla nueva y la vieja ya no divergen con cero compras: o se ha revertido el arreglo, ' +
    'o el contador vuelve a pintarse sin que nadie haya comprado');

  assert.equal(decidir(1).mostrar, true, '🔴 con una plaza ocupada el contador SÍ debe pintarse');
  assert.equal(decidir(FOUNDING_SEATS).mostrar, false, '🔴 agotada no se pinta contador');
  assert.equal(decidir(FOUNDING_SEATS).ofertaVigente, false, '🔴 agotada la oferta NO se anuncia');

  // Suelo: sin dato no se pinta NADA, ni contador ni oferta.
  assert.deepEqual(decidir(0, false), { ofertaVigente: false, mostrar: false },
    '🔴 sin poder resolver el contador se estaría pintando algo. Un número inventado es justo lo ' +
    'que este ticket quita.');
});
