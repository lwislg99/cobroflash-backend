// tests/scrum515-aviso-bizum-render.test.mjs — SCRUM-515.
//
// ── QUÉ CUBRE ESTE FICHERO, Y QUÉ NO ─────────────────────────────────────────────────────────
// El COMPORTAMIENTO del aviso —que se pinta, que sigue pintado al final del render, que no sale
// a quien no toca— lo mide `scripts/guard-aviso-bizum.mjs` EN NAVEGADOR, sobre el DOM vivo. No
// puede medirse aquí: `npm test` no arranca un navegador (misma decisión que `guard:contraste`,
// SCRUM-368, y `guard:caja-avisos`, SCRUM-469).
//
// Aquí se vigilan las DOS cosas que el navegador no puede ver, y que hoy no vigila nadie:
//
//   1. EL `||` AGUAS ARRIBA — que `/admin/me` siga pasando los DOS teléfonos POR SEPARADO. Si
//      alguien «simplifica» esa llamada a `bizumPhone || whatsappPhone`, la guarda del dominio
//      queda MUERTA Y PARECIENDO VIVA. Y no es una figura retórica: está medido abajo.
//   2. QUE LA MEDICIÓN NO DESAPAREZCA EN SILENCIO — el guard existe y está cableado en
//      `package.json`. Un guard que se borra sin que salte nada nos devuelve al punto de partida:
//      el control negativo se pidió CINCO veces y nunca se hizo, porque dependía de que alguien
//      se acordara.
//
// La DECISIÓN (`decidirAvisoBizum`, los tres estados y el suelo) ya la cubre
// `tests/scrum328-aviso-bizum-sin-telefono.test.mjs`. No se duplica aquí.
//
// ── POR QUÉ IMPORTA HOY ──────────────────────────────────────────────────────────────────────
// `BIZUM_MANUAL_ENABLED` está ENCENDIDO en producción desde el 13-ago-2026. Censo de ese día
// sobre los 13 merchants reales: 2 con `bizumPhone`, 6 con `whatsappPhone`, SIETE sin ninguno de
// los dos. El aviso existe para esos siete y hasta hoy nunca se había visto funcionar.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { soloEjecutable } from './_guard-texto.mjs';
import { decidirAvisoBizum, hayQueAvisar } from '../dist/modules/billing/domain/avisoBizumSinTelefono.js';

const RAIZ = path.resolve(import.meta.dirname, '..');
const leer = (p) => {
  try {
    return fs.readFileSync(path.join(RAIZ, p), 'utf8');
  } catch (e) {
    assert.fail(`🔴 no se pudo leer ${p} (${e && e.code ? e.code : e}). «Está bien» y «no supe `
      + 'mirar» son el mismo verde, y aquí el verde equivocado dice que nadie está desprotegido.');
  }
};

// ── 1 · EL `||` AGUAS ARRIBA ─────────────────────────────────────────────────────────────────

test('SCRUM-515 · 🔴 un `||` aguas arriba dejaría la guarda MUERTA Y PARECIENDO VIVA', () => {
  // Primero se DEMUESTRA el peligro con la función real, y solo después se vigila la forma. Sin
  // esta demostración, el assert estructural de abajo parecería una manía de estilo.
  const wa = '+34000000001';
  const bz = '+34000000002';

  // Las CUATRO filas del ticket dan EXACTAMENTE lo mismo con y sin colapso. Por eso ningún test
  // de comportamiento —ni el del navegador— puede cazar este fallo: es invisible donde miramos.
  for (const [b, w] of [[null, null], [null, wa], [bz, null], [bz, wa]]) {
    const actual = decidirAvisoBizum({ flagBizum: true, bizumPhone: b, whatsappPhone: w });
    const colapsado = decidirAvisoBizum({ flagBizum: true, bizumPhone: (b || w), whatsappPhone: w });
    assert.equal(actual, colapsado,
      '🔴 si las cuatro filas distinguieran el colapso, este test sobraría y bastaría con el '
      + 'guard del navegador. Que NO lo distingan es justo el motivo de que haga falta mirar la '
      + 'forma de la llamada.');
  }

  // Y aquí es donde SÍ diverge: un `bizumPhone` ilegible **y falsy** (`0`, `NaN`, `false`) con un
  // `whatsappPhone` bueno. El colapso se lo traga y lo convierte en «no_aplica» — es decir,
  // APAGA EL AVISO. `no_se_pudo_leer` degradado a «tiene teléfono» es exactamente lo que el
  // dominio se niega a hacer, con el fallo mudo y una capa más de silencio encima.
  assert.equal(decidirAvisoBizum({ flagBizum: true, bizumPhone: 0, whatsappPhone: wa }),
    'no_se_pudo_leer');
  assert.equal(decidirAvisoBizum({ flagBizum: true, bizumPhone: (0 || wa), whatsappPhone: wa }),
    'no_aplica',
    '🔴 el colapso ya no apaga el aviso en el caso ilegible-y-falsy. Si eso ha cambiado, este '
    + 'test hay que rehacerlo — no relajarlo.');

  // LA VIGILANCIA: los dos teléfonos, por separado, tal cual salen del merchant.
  const app = soloEjecutable(leer('src/app.ts'));
  const ancla = 'bizumSinTelefono: decidirAvisoBizum(';
  const desde = app.indexOf(ancla);
  assert.notEqual(desde, -1, '🔴 `/admin/me` ya no calcula `bizumSinTelefono`: sin veredicto del '
    + 'servidor no hay aviso que pintar, y la pantalla se queda muda otra vez.');

  // Se recorta la llamada CASANDO PARÉNTESIS, no buscando un `}),`: dentro hay un
  // `isFlagEnabled(...)` anidado y el primer cierre es el suyo, así que un corte por texto se
  // queda a medias y el guard acabaría mirando un trozo que no contiene lo que vigila.
  let prof = 0, fin = -1;
  for (let i = desde + ancla.length - 1; i < app.length; i++) {
    if (app[i] === '(') prof++;
    else if (app[i] === ')') { prof--; if (prof === 0) { fin = i; break; } }
  }
  assert.notEqual(fin, -1, '🔴 no se pudo delimitar la llamada a `decidirAvisoBizum`: el guard no '
    + 'sabe qué está mirando, y eso NO es «está bien».');
  const cuerpo = app.slice(desde, fin + 1);

  assert.match(cuerpo, /bizumPhone:\s*merchantFull\?\.bizumPhone\s*,/,
    '🔴 `bizumPhone` ya no llega CRUDO a `decidirAvisoBizum`.\n\n'
    + '  Si aquí se escribe `merchantFull?.bizumPhone || merchantFull?.whatsappPhone`, la guarda '
    + 'del dominio deja de poder distinguir las dos fuentes: recibe UNA. Y las cuatro filas del '
    + 'ticket seguirían dando el mismo resultado —lo acabamos de medir— así que el guard del '
    + 'navegador seguiría VERDE mientras el suelo `no_se_pudo_leer` se apaga en silencio.');
  assert.match(cuerpo, /whatsappPhone:\s*merchantFull\?\.whatsappPhone\s*,/,
    '🔴 `whatsappPhone` ya no llega crudo a `decidirAvisoBizum`. Mismo motivo: el dominio necesita '
    + 'las DOS fuentes separadas para poder decir «no se pudo leer» en vez de «tiene teléfono».');
  assert.ok(!/\|\|/.test(cuerpo),
    `🔴 hay un \`||\` dentro de la llamada a \`decidirAvisoBizum\`:\n\n${cuerpo}\n\n`
    + '  Ahí es donde muere la guarda sin que se note. El fallback a `whatsappPhone` es cosa del '
    + 'DOMINIO (`avisoBizumSinTelefono.ts`), que ya lo hace y sabe distinguir «ilegible» de '
    + '«ausente». Colapsarlo antes le quita esa información y no hay forma de recuperarla.');
});

// ── 2 · LA MEDICIÓN NO PUEDE DESAPARECER EN SILENCIO ─────────────────────────────────────────

test('SCRUM-515 · 🔴 el control negativo del DOM sigue existiendo y cableado', () => {
  const guard = leer('scripts/guard-aviso-bizum.mjs');

  // Que mida el DOM VIVO y no el fuente. Es LA distinción del ticket: el aviso del 13-ago-2026
  // estaba en el fichero y no en la pantalla, y su test seguía verde por leer el fichero.
  assert.match(guard, /puppeteer-core/,
    '🔴 el control negativo ya no abre navegador. Si vuelve a medirse leyendo el `.js`, vuelve a '
    + 'ser el test que dio verde con el aviso borrado: mide que el FICHERO cambió, no que el '
    + 'COMPORTAMIENTO cambió.');
  assert.match(guard, /renderSettingsView\(/,
    '🔴 el guard ya no RENDERIZA la pantalla. Sin render no hay DOM que medir.');

  // Los cuatro casos, por separado. Sin el positivo, «avisa cuando falta» y «avisa siempre» dan
  // el mismo verde; sin las dos vías, no se sabe cuál de los dos teléfonos sostiene el aviso.
  for (const via of [
    /sin bizumPhone · sin whatsappPhone/, /sin bizumPhone · con whatsappPhone/,
    /con bizumPhone · sin whatsappPhone/, /con bizumPhone · con whatsappPhone/,
  ]) {
    assert.match(guard, via, `🔴 falta el caso ${via} en el control negativo. Los cuatro van, y `
      + 'por separado: `bizumPhone` y `whatsappPhone` son DOS fuentes.');
  }

  // El suelo del propio guard: tiene que saber declararse ciego. Un cero aquí se leería como
  // «ningún merchant desprotegido», y son siete.
  assert.match(guard, /NO SUPO MIRAR/,
    '🔴 el guard ya no sabe declararse ciego. Si no encuentra la ranura del aviso y contesta «0 '
    + 'desprotegidos», está mintiendo en la dirección más cara posible.');
  assert.match(guard, /calSabeDecirNo|calSabeDecirSi/,
    '🔴 el guard perdió la CALIBRACIÓN. Un detector que no demuestra que sabe cambiar de '
    + 'respuesta —ver el aviso cuando está y dejar de verlo cuando no— da un verde que no '
    + 'significa nada.');

  // ── LA COPIA ACOTADA DEL PREDICADO ──────────────────────────────────────────────────────
  // El guard NO importa `hayQueAvisar`: `scripts/` declarado en `package.json` ES entrada viva
  // para los censos de alcance (SCRUM-411/493), así que importarlo desde ahí lo sacaría de
  // `_huerfanos-declarados.mjs` y abriría una discrepancia que el comparador no sabe clasificar.
  // Arreglar ese comparador es SU ticket, no éste (regla 9).
  //
  // El precio de esa decisión es una copia del predicado dentro del guard — y una copia que
  // nadie vigila es exactamente cómo dos reglas del mismo hecho acaban discrepando. Así que se
  // PINCHA aquí, contra la función de verdad, para TODOS los estados que exporte el dominio:
  // si mañana aparece un cuarto estado, o `hayQueAvisar` cambia de criterio, esto cae y nombra
  // el fichero que hay que tocar. No se entera nadie por un verde hueco.
  assert.match(guard, /veredicto !== 'no_aplica'/,
    '🔴 el guard ya no deriva «se espera aviso» como `veredicto !== no_aplica`. Si ha cambiado la '
    + 'forma de la copia, este pinchazo hay que rehacerlo — no borrarlo.');
  const ESTADOS = ['no_aplica', 'falta_telefono', 'no_se_pudo_leer'];
  for (const estado of ESTADOS) {
    assert.equal(estado !== 'no_aplica', hayQueAvisar(estado),
      `🔴 la copia del guard y \`hayQueAvisar\` DISCREPAN en «${estado}».\n\n`
      + '  `scripts/guard-aviso-bizum.mjs` lleva su propia copia del predicado. Si el dominio '
      + 'cambia la regla y la copia no, el control negativo mediría la regla VIEJA y daría verde '
      + 'sobre la pantalla nueva: el verde hueco otra vez, y esta vez en el instrumento.');
  }
  // Y que el dominio no haya estrenado un estado a espaldas de la copia.
  for (const inventado of ['tiene_telefono', 'pendiente', '']) {
    assert.equal(hayQueAvisar(inventado), false,
      `🔴 \`hayQueAvisar\` ha empezado a avisar en «${inventado}», un estado que la copia del `
      + 'guard trataría como «avisa» (todo lo que no es `no_aplica`). Los dos criterios ya no '
      + 'coinciden: o se importa el predicado de verdad, o se actualiza la copia.');
  }

  // Y que se pueda lanzar sin conocer la ruta: si no está en `package.json`, no lo corre nadie.
  const pkg = JSON.parse(leer('package.json'));
  assert.equal(pkg.scripts['guard:aviso-bizum'], 'node scripts/guard-aviso-bizum.mjs',
    '🔴 `npm run guard:aviso-bizum` ya no existe. Un guard que hay que descubrir leyendo '
    + '`scripts/` es un guard que no se ejecuta — y volvemos a que el control negativo dependa de '
    + 'que alguien se acuerde, que es justo lo que este ticket vino a quitar.');
});
