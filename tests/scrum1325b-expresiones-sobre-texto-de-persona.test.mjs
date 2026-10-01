// tests/scrum1325b-expresiones-sobre-texto-de-persona.test.mjs — SCRUM-1325
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// EL GUARD QUE IMPIDE LA SIGUIENTE. En una noche salieron cuatro sitios donde una tilde cambiaba lo
// que el bot entendía, y ninguno se estaba buscando. La clase no es «`\b`»: es
//
//     una expresión con letras, comparada con texto de persona SIN normalizar.
//
// Así que aquí no se busca un carácter: se censan TODAS las expresiones de `src/` y cada una que
// pueda tener el agujero tiene que estar declarada, por identidad, en
// `tests/_expresiones-de-texto.json`:
//   · `maquina`  — no mira lenguaje (un formato, un XML, un identificador, un literal nuestro).
//   · `persona`  — mira lo que escribe alguien: va en ASCII y se aplica a `sinTildes(texto)`.
//   · `persona-sin-normalizar` — la excepción, visible y contada aquí abajo.
//
// 🔴 CUANDO NO SABE, LO DICE. Una expresión nueva sin declarar no pasa: «no sé si mira texto de
// persona». Una de persona cuyo texto no puede seguir hasta el normalizador tampoco: «no sé
// decidir». Un instrumento que calla cuando no entiende no vigila nada (SCRUM-1321).
//
// El motor es `tests/_censo-expresiones-de-texto.mjs`, y el árbol real y los casos fabricados de
// aquí pasan por la MISMA función. Sólo lee `src/`: ni `dist/`, ni BD, ni red.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { juzgar, rasgosDelPatron, CLASES } from './_censo-expresiones-de-texto.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const CATALOGO = JSON.parse(fs.readFileSync(path.join(RAIZ, 'tests/_expresiones-de-texto.json'), 'utf8')).expresiones;

function fuentesDeSrc() {
  const fuentes = new Map();
  (function entrar(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) entrar(p);
      else if (/\.ts$/.test(e.name) && !/\.d\.ts$/.test(e.name)) fuentes.set(path.relative(RAIZ, p).split(path.sep).join('/'), fs.readFileSync(p, 'utf8'));
    }
  })(path.join(RAIZ, 'src'));
  return fuentes;
}
const pintar = (hs) => hs.map((h) => `\n  [${h.tipo}] ${h.fichero}${h.linea ? ':' + h.linea : ''}  ${h.fuente}\n      ${h.detalle}`).join('');
const tipos = (r) => r.hallazgos.map((h) => h.tipo).sort();

// ── 1 · El árbol real ──────────────────────────────────────────────────────────────────────────

test('🔴 SCRUM-1325 · ninguna expresión de src/ mira texto de persona sin normalizar, y ninguna está sin declarar', () => {
  const r = juzgar(fuentesDeSrc(), CATALOGO);
  const p = r.poblacion;
  console.log(`# SCRUM-1325 · POBLACIÓN: ${p.ficheros} ficheros .ts de src/ · ${p.expresiones} expresiones · `
    + `${p.fueraPorConstruccion} sin letras ni \\b ni \\w (fuera por construcción) · ${p.sensibles} declaradas: `
    + CLASES.map((c) => `${p.porClase[c]} ${c}`).join(', '));
  // Suelo: «0 hallazgos» sobre nada no es un verde.
  assert.ok(p.ficheros > 0 && p.expresiones > 0 && p.sensibles > 0 && p.fueraPorConstruccion > 0,
    `🔴 CIEGO: no he mirado nada (${JSON.stringify(p)})`);
  assert.ok(p.porClase.persona > 0 && p.porClase.maquina > 0, `🔴 CIEGO: una clase entera está vacía (${JSON.stringify(p.porClase)})`);
  assert.equal(p.sensibles, CLASES.reduce((a, c) => a + p.porClase[c], 0) + r.hallazgos.filter((h) => h.tipo === 'sin-declarar').length,
    'CIEGO: las declaradas más las que faltan no suman las que pueden tener el agujero');
  assert.deepEqual(r.hallazgos, [], `🔴 ${r.hallazgos.length} hallazgo(s):${pintar(r.hallazgos)}\n`);
});

test('🔴 SCRUM-1325 · las excepciones son ÉSTAS, enteras: añadir una es cambiar esta lista a propósito', () => {
  const excepciones = CATALOGO.filter((c) => c.clase === 'persona-sin-normalizar').map((c) => `${c.fichero} · ${c.fuente}`);
  assert.deepEqual(excepciones, [
    // La baja del canal: palabra clave cerrada, sin forma con tilde. Decidido por el orquestador.
    'src/modules/whatsappBot/app/routes/whatsappIncoming.routes.ts · /^(baja|stop)[.!]?$/i',
  ]);
});

// ── 2 · El detector: qué puede tener el agujero ────────────────────────────────────────────────

test('SCRUM-1325 · el detector separa lo que puede tener el agujero de lo que no', () => {
  const sensible = (p) => rasgosDelPatron(p).sensible;
  const si = ['s[ií]\\b', 'caldera', '^[a-z0-9]+$', '\\w+', 'a\\/?a\\b', '^data:image\\/\\w+;base64,', '&lt;', '\\.\\d{3}Z$'];
  const no = ['\\D', '\\s+', '[.\\s]', '^\\d{4}-\\d{2}-\\d{2}$', '[\\p{L}\\p{N}]+', '\\p{M}', '[,.;:!¡()\\n]+', '[?¿]', '"',
    '(?<anio>\\d{4})', '\\u0301', '\\x1b', '[^\\d,.]'];
  assert.deepEqual(si.filter((p) => !sensible(p)), [], '🔴 un patrón con letras, \\b o \\w se da por inofensivo');
  assert.deepEqual(no.filter((p) => sensible(p)), [], 'un patrón sin letras se toma por sensible (el catálogo se llenaría de ruido)');
  // El que no se puede leer no se da por bueno.
  assert.equal(rasgosDelPatron(null).sensible, true, '🔴 un patrón armado en ejecución se da por inofensivo');
  assert.equal(rasgosDelPatron('ba\xf1o').letraNoAscii, true, '🔴 no ve la conEnie dentro del patrón');
  assert.equal(rasgosDelPatron('s[i\xed]').letraNoAscii, true, '🔴 no ve la tilde dentro del patrón');
  assert.equal(rasgosDelPatron('hola|\u{1F44B}').letraNoAscii, false, 'un emoji no es una letra con tilde');
});

// ── 3 · Casos fabricados, por la MISMA función que el árbol real ───────────────────────────────

const IMPORTA = "import { sinTildes } from '../../core/texto/sinTildes';\n";
const F = 'src/modules/x/caso.ts';
const caso = (fuente, declaradas) => juzgar(new Map([[F, fuente]]),
  declaradas.map(([expresion, clase = 'persona']) => ({ fichero: F, fuente: expresion, clase, motivo: 'caso fabricado para el guard' })));

test('🔴 SCRUM-1325 · una expresión NUEVA con letras, sin declarar, no pasa: «no sé si mira texto de persona»', () => {
  const r = caso('export const f = (t: string) => /^(vale|ok)$/.test(t);', []);
  assert.deepEqual(tipos(r), ['sin-declarar'], pintar(r.hallazgos));
  assert.match(r.hallazgos[0].detalle, /NO SÉ si mira texto escrito por una persona/);
  // Editar una declarada la convierte en otra: la vieja sobra y la nueva está sin declarar.
  const editada = caso('export const f = (t: string) => /^(vale|ok|venga)$/.test(t);', [['/^(vale|ok)$/', 'maquina']]);
  assert.deepEqual(tipos(editada), ['sin-declarar', 'sobra'], pintar(editada.hallazgos));
  // Y el `RegExp(` cuyo patrón no se puede leer, igual.
  const armada = caso('export const f = (p: string, t: string) => new RegExp(p).test(t);', []);
  assert.deepEqual(tipos(armada), ['sin-declarar'], pintar(armada.hallazgos));
});

test('🔴 SCRUM-1325 · el defecto del ticket, tal cual estaba: de persona y aplicada al texto crudo', () => {
  // `NO_ZONE_RE` como estaba en main (e9e71cab), con su tilde enumerada y su `\b`.
  const comoEstaba = "const NO_ZONE_RE = /^(no lo s[e\xe9]|no s[e\xe9])\\b/i;\n"
    + "export function isValidZone(text: string) { const t = (text || '').trim(); return NO_ZONE_RE.test(t); }";
  const r = caso(comoEstaba, [['/^(no lo s[e\xe9]|no s[e\xe9])\\b/i']]);
  assert.deepEqual(tipos(r), ['letra-con-tilde', 'sin-normalizar'], pintar(r.hallazgos));

  // Las otras formas de aplicarla sin normalizar.
  for (const [nombre, fuente, expresion] of [
    ['literal.test(crudo)', 'export const f = (t: string) => /^(si|vale)\\b/.test(t.trim().toLowerCase());', '/^(si|vale)\\b/'],
    ['crudo.match(literal)', 'export const f = (t: string) => t.toLowerCase().match(/^(si|vale)\\b/);', '/^(si|vale)\\b/'],
    ['crudo.replace(literal)', "export const f = (t: string) => String(t).toLowerCase().replace(/[^a-z0-9]/g, '');", '/[^a-z0-9]/g'],
    ['en una propiedad', 'const S = [{ match: /caldera/i }];\nexport const f = (c: string) => S.some((s) => s.match.test(c.trim()));', '/caldera/i'],
    ['minúsculas no es sin tildes', 'export const f = (t: string) => { const c = String(t).toLowerCase(); return /(revisi|diagn)/.test(c); };', '/(revisi|diagn)/'],
    ['sólo normalize, sin quitar las marcas', "export const f = (t: string) => /^(si|vale)\\b/.test(t.normalize('NFD'));", '/^(si|vale)\\b/'],
  ]) {
    const x = caso(fuente, [[expresion]]);
    // Si el texto crudo es un parámetro, el veredicto es «no sé»; si se ve que no pasa por el
    // helper, «sin normalizar». Las dos son rojo, y tiene que ser UNO: el de esta expresión.
    assert.equal(x.hallazgos.length, 1, `🔴 «${nombre}» pasa sin normalizar:${pintar(x.hallazgos)}`);
    assert.ok(['sin-normalizar', 'no-se-decidir'].includes(x.hallazgos[0].tipo), `«${nombre}»:${pintar(x.hallazgos)}`);
  }
});

test('🔴 SCRUM-1325 · cuando no puede seguir el texto hasta el normalizador, dice «no sé decidir» y no pasa', () => {
  for (const [nombre, fuente, expresion] of [
    ['el texto es un parámetro', 'export const f = (t: string) => /^(si|vale)\\b/.test(t);', '/^(si|vale)\\b/'],
    ['el texto es un `let`', IMPORTA + 'export function f(x: string) { let t = sinTildes(x); t = x; return /^(si|vale)\\b/.test(t); }', '/^(si|vale)\\b/'],
    ['la expresión se pasa a otra función', 'const RE = /^(si|vale)\\b/;\nexport const f = (t: string, casa: (r: RegExp, t: string) => boolean) => casa(RE, t);', '/^(si|vale)\\b/'],
    ['la expresión se exporta y no se usa aquí', 'export const RE = /^(si|vale)\\b/;', '/^(si|vale)\\b/'],
    ['la propiedad no se aplica en su fichero', 'export const S = [{ match: /caldera/i }];', '/caldera/i'],
    ['una función que se llama sinTildes y no lo hace', 'function sinTildes(s: string) { return s.toLowerCase(); }\nexport function f(x: string) { return /^(si|vale)\\b/.test(sinTildes(x)); }', '/^(si|vale)\\b/'],
  ]) {
    const x = caso(fuente, [[expresion]]);
    assert.ok(x.hallazgos.length >= 1 && x.hallazgos.every((h) => h.tipo === 'no-se-decidir' || h.tipo === 'sin-normalizar'),
      `🔴 «${nombre}» pasa en silencio:${pintar(x.hallazgos)}`);
    assert.ok(x.hallazgos.some((h) => /NO SÉ/.test(h.detalle) || h.tipo === 'sin-normalizar'), `«${nombre}» no dice que no lo sabe`);
  }
  // El caso del nombre: reconocer el normalizador por su NOMBRE dejaría pasar a éste.
  const impostor = caso('function sinTildes(s: string) { return s.toLowerCase(); }\nexport function f(x: string) { return /^(si|vale)\\b/.test(sinTildes(x)); }',
    [['/^(si|vale)\\b/']]);
  assert.deepEqual(tipos(impostor), ['sin-normalizar'], `🔴 un normalizador se reconoce por su nombre y no por lo que hace:${pintar(impostor.hallazgos)}`);
});

test('SCRUM-1325 · positivo: las formas correctas pasan, y pasan por lo que HACEN', () => {
  // Sin esto, «todo lo malo da rojo» podría ser «todo da rojo».
  for (const [nombre, fuente, expresion] of [
    ['el helper, directo', IMPORTA + 'export const f = (t: string) => /^(si|vale)\\b/.test(sinTildes(t));', '/^(si|vale)\\b/'],
    ['el helper y luego trim', IMPORTA + "export const f = (t: string) => /^(si|vale)\\b/.test(sinTildes(t || '').trim());", '/^(si|vale)\\b/'],
    ['por una constante', IMPORTA + "export function f(x: string) { const t = sinTildes(x || '').trim(); return /^(si|vale)\\b/.test(t); }", '/^(si|vale)\\b/'],
    ['expresión en un const', IMPORTA + 'const RE = /^(si|vale)\\b/;\nexport const f = (t: string) => RE.test(sinTildes(t));', '/^(si|vale)\\b/'],
    ['en una propiedad', IMPORTA + 'const S = [{ match: /caldera/i }];\nexport const f = (c: string) => S.some((s) => s.match.test(sinTildes(c)));', '/caldera/i'],
    ['el helper con otro nombre al importar', "import { sinTildes as plano } from '../../core/texto/sinTildes';\nexport const f = (t: string) => /^(si|vale)\\b/.test(plano(t));", '/^(si|vale)\\b/'],
    ['un normalizador propio, reconocido por su cuerpo', "function miNormalizador(s: string) { return String(s).toLowerCase().normalize('NFD').replace(/\\p{M}/gu, ''); }\n"
      + 'export function f(x: string) { const t = miNormalizador(x); return new RegExp(`(?<![a-z])dos(?![a-z])`).test(t); }', 'new RegExp(`(?<![a-z])dos(?![a-z])`)'],
    ['la cadena escrita en el sitio', "export const f = (s: string) => String(s).trim().toLowerCase().normalize('NFD').replace(/\\p{M}/gu, '').replace(/[^a-z0-9]/g, '');", '/[^a-z0-9]/g'],
  ]) {
    const x = caso(fuente, [[expresion]]);
    assert.deepEqual(x.hallazgos, [], `«${nombre}» da rojo siendo correcta:${pintar(x.hallazgos)}`);
    assert.equal(x.poblacion.porClase.persona, 1, `CIEGO: «${nombre}» no llegó a juzgarse como de persona`);
  }
  // Y lo que no es de persona, ni se mira: declarada `maquina`, cruda, pasa.
  const maquina = caso('export const f = (t: string) => /^#[0-9a-f]{6}$/.test(t);', [['/^#[0-9a-f]{6}$/', 'maquina']]);
  assert.deepEqual(maquina.hallazgos, []);
});

test('SCRUM-1325 · el catálogo no puede mentir: sin motivo, con clase inventada, repetido o con la cuenta mal', () => {
  const fuente = 'export const f = (t: string) => /^#[0-9a-f]{6}$/.test(t) || /^#[0-9a-f]{6}$/.test(t.trim());';
  const con = (entradas) => juzgar(new Map([[F, fuente]]), entradas);
  const buena = { fichero: F, fuente: '/^#[0-9a-f]{6}$/', veces: 2, clase: 'maquina', motivo: 'color hexadecimal de la marca' };
  assert.deepEqual(con([buena]).hallazgos, [], 'la entrada buena da rojo');
  assert.deepEqual(tipos(con([{ ...buena, veces: 1 }])), ['sobra'], 'una cuenta que no cuadra pasa');
  assert.deepEqual(tipos(con([{ ...buena, motivo: 'porque sí' }])), ['catalogo-mal'], 'una entrada sin motivo pasa');
  assert.deepEqual(tipos(con([{ ...buena, clase: 'da-igual' }])), ['catalogo-mal'], 'una clase inventada pasa');
  assert.deepEqual(tipos(con([buena, buena])), ['catalogo-mal'], 'una entrada repetida pasa');
  assert.deepEqual(tipos(con([buena, { ...buena, fuente: '/ya-no-existe/' }])), ['sobra'], 'una entrada de algo que ya no está pasa');
});

// ── 4 · Venenos sobre el fuente REAL (en memoria: no se escribe nada en disco) ──────────────────

/** El árbol real con UN fichero cambiado. Falla si el cambio no se aplicó: un veneno que no entra da verde. */
function envenenado(fichero, de, a) {
  const fuentes = fuentesDeSrc();
  const original = fuentes.get(fichero);
  assert.ok(original, `CIEGO: no existe ${fichero}`);
  assert.equal(original.split(de).length - 1, 1, `CIEGO: el ancla «${de}» aparece ${original.split(de).length - 1} veces en ${fichero}`);
  fuentes.set(fichero, original.replace(de, a));
  return juzgar(fuentes, CATALOGO);
}

test('🔴 SCRUM-1325 · veneno en el fuente real: quitar `sinTildes(` de cada sitio arreglado da rojo', () => {
  const BOT = 'src/modules/whatsappBot/domain/botFlow.service.ts';
  const venenos = [
    // [fichero, ancla, lo que se pone, cuántas expresiones dependen de ese sitio]
    [BOT, "GREETING_ONLY_RE.test(sinTildes(text || '').trim())", "GREETING_ONLY_RE.test((text || '').trim())", 1],
    [BOT, "CANCEL_RE.test(sinTildes(text || '').trim())", "CANCEL_RE.test((text || '').trim())", 1],
    [BOT, "NO_ZONE_RE.test(sinTildes(text || '').trim())", "NO_ZONE_RE.test((text || '').trim())", 1],
    [BOT, "const t = sinTildes(text || '').trim();", "const t = (text || '').trim().toLowerCase();", 2],
    [BOT, '.test(sinTildes(text))) {', '.test(text)) {', 1],
    ['src/modules/maintenance/domain/maintenance.service.ts', 'seed.match.test(sinTildes(concept))', 'seed.match.test(concept)', 9],
    ['src/modules/system/app/routes/quoteDecisionLanding.routes.ts', "const c = sinTildes(String(concept || ''));", "const c = String(concept || '').toLowerCase();", 4],
  ];
  let total = 0;
  for (const [fichero, de, a, cuantas] of venenos) {
    const r = envenenado(fichero, de, a);
    const rojos = r.hallazgos.filter((h) => h.fichero === fichero && (h.tipo === 'sin-normalizar' || h.tipo === 'no-se-decidir'));
    assert.equal(rojos.length, cuantas, `🔴 quitar «${de}» debía dejar ${cuantas} expresión(es) en rojo y deja ${rojos.length}:${pintar(r.hallazgos)}`);
    assert.equal(r.hallazgos.length, cuantas, `el veneno de «${de}» salpica a otras expresiones:${pintar(r.hallazgos)}`);
    total += cuantas;
  }
  // Los venenos cubren todo lo que este ticket pasó por el helper (lo demás ya comparaba sin tildes).
  assert.equal(total, 19, 'los venenos no cubren las 19 expresiones que SCRUM-1325 pasó por el helper');
});

test('🔴 SCRUM-1325 · veneno en el fuente real: devolver la tilde al patrón, o colar una expresión nueva, da rojo', () => {
  const conEnie = envenenado('src/modules/maintenance/domain/maintenance.service.ts', '/reforma|obra|\\bbano|cocina/i', '/reforma|obra|ba\xf1o|cocina/i');
  assert.deepEqual(tipos(conEnie), ['sin-declarar', 'sobra'], `devolver la conEnie al patrón pasa:${pintar(conEnie.hallazgos)}`);

  const nueva = envenenado('src/modules/whatsappBot/domain/botFlow.service.ts',
    'function isCancel(text: string)', "function esGracias(text: string): boolean { return /^(gracias|muchas gracias)\\b/i.test(text); }\nfunction isCancel(text: string)");
  assert.deepEqual(tipos(nueva), ['sin-declarar'], `una expresión nueva en el bot pasa sin declarar:${pintar(nueva.hallazgos)}`);

  // El helper de la casa: si deja de quitar las marcas, quien lo importa sigue «pasando» por el
  // nombre. Eso NO lo ve este guard (mira quién llama, no qué hace el helper): lo ven por efecto
  // `tests/scrum1325-una-tilde-no-rompe-lo-que-entiende.test.mjs` y el de SCRUM-1322. Aquí se fija
  // sólo que el helper sigue siendo la cadena que este guard da por buena en cualquier otro sitio.
  const helper = fs.readFileSync(path.join(RAIZ, 'src/core/texto/sinTildes.ts'), 'utf8');
  const comoLocal = juzgar(new Map([[F, helper + '\nexport const f = (t: string) => /^(si|vale)\\b/.test(sinTildes(t));']]),
    [{ fichero: F, fuente: '/^(si|vale)\\b/', clase: 'persona', motivo: 'caso fabricado para el guard' }]);
  assert.deepEqual(comoLocal.hallazgos, [], `🔴 el helper de la casa ya no es la cadena normalizadora:${pintar(comoLocal.hallazgos)}`);
});
