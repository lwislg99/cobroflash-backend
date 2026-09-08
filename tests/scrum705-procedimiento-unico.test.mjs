// tests/scrum705-procedimiento-unico.test.mjs — SCRUM-705.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 LO QUE PASABA, Y POR QUÉ ERA GRAVE
//
// El máster decía, literal (`docs/YAQU_MASTER.md:240`):
//
//     «Prisma sin TTY: db push (procedimiento canónico scripts/db-push-prod — host-check→
//      preview→GO→push→documentar, SCRUM-40), nunca migrate dev»
//
// Y el propio script decía lo contrario (`scripts/db-push-prod:10`):
//
//     «🔴 db push NO ES EL MÉTODO DE ESTA CASA CONTRA PRODUCCIÓN (SCRUM-685)»
//
// Por REGLA 35 el máster es la fuente de verdad. Así que la fuente de verdad apuntaba al arma
// cargada: ese script, desde un checkout 1.933 commits por detrás, propuso `DROP TABLE
// job_assignees`, `DROP TABLE email_messages` y ~30 columnas DE PRODUCCIÓN. Lo pararon el GO
// explícito y que la shell no tenía stdin — la segunda fue SUERTE.
//
// ── LO QUE VIGILA ESTE FICHERO ────────────────────────────────────────────────────────────
// Un documento corregido que nada vigila se descorrige. Aquí se comprueba que ningún documento
// VIVO vuelva a decir que `db-push-prod` es el procedimiento contra PRODUCCIÓN.
//
// 🔴 Y NO por prefijo ni subcadena: por límite de palabra, y mirando la VECINDAD — porque la
// frase que importa reparte «db-push-prod» y «producción» en líneas distintas.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * 📌 LOS HISTÓRICOS, ENUMERADOS Y CON MOTIVO.
 *
 * Un registro fechado era CIERTO cuando se escribió: `docs/master/SCRUM-480.md` documenta el
 * `.gitattributes` de entonces y `SCRUM-685.md` cuenta el incidente. Sacarlos rojos obligaría a
 * reescribir la historia para que un guard calle, que es exactamente lo que no se hace.
 *
 * Es el mismo criterio con el que se congeló el fichero de microcopy.
 */
const HISTORICOS = [
  { ruta: 'docs/master/', porque: 'registro por ticket: fechado y cerrado (SCRUM-273)' },
  { ruta: 'docs/historico/', porque: 'archivo explícito, con la fecha en el propio nombre' },
];

const esHistorico = (rel) => HISTORICOS.some((h) => rel.startsWith(h.ruta));

/** Todos los `.md` del árbol de documentación, más `CLAUDE.md`. */
function documentos(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) documentos(p, out);
    else if (e.name.endsWith('.md')) out.push(p);
  }
  return out;
}

function barrido() {
  const ficheros = [
    ...documentos(path.join(RAIZ, 'docs')),
    path.join(RAIZ, 'CLAUDE.md'),
  ].filter((p) => fs.existsSync(p));
  return ficheros.map((p) => ({
    rel: path.relative(RAIZ, p).replace(/\\/g, '/'),
    texto: fs.readFileSync(p, 'utf8'),
  }));
}

// 🔴 Identidad / límite de palabra. `db-push-prod` no puede casar dentro de otra palabra.
const NOMBRA_EL_SCRIPT = /\bdb-push-prod\b/;

// 🔴 LO QUE CONVIERTE UNA MENCIÓN EN UNA PRESCRIPCIÓN: que se le llame EL procedimiento, y
// **en la misma línea**.
//
// La primera versión de este detector miraba la vecindad de ±3 líneas y descontaba si por ahí
// cerca aparecía un «nunca». Eso se comía **su propio control positivo**: la frase original del
// máster termina en «nunca `migrate dev`», así que el descuento apagaba justo el caso que
// motivó el ticket. Un detector que se desactiva solo en el único ejemplo que tiene no vigila.
//
// Misma línea, y basta: las dos frases reales —`YAQU_MASTER.md:240` y
// `MIGRATIONS_PENDING.md:66`— llevaban «procedimiento canónico» pegado al nombre del script.
// Una narración del incidente no lo lleva.
const LO_PRESCRIBE = /\bcan[oó]nic[oa]s?\b|\bprocedimiento\b|\bel m[eé]todo\b/i;

/**
 * 📌 NARRACIONES FECHADAS DENTRO DE UN DOCUMENTO VIVO — declaradas, no silenciadas.
 *
 * `docs/MIGRATIONS_PENDING.md` es un documento VIVO con un registro histórico dentro: cada
 * entrada de «aplicado en prod» lleva su fecha. Esas líneas eran ciertas cuando se escribieron
 * y no se reescriben para que un guard calle — mismo criterio que con `docs/master/`.
 *
 * Se declaran UNA A UNA y con su motivo. Una excepción silenciosa es un agujero; y una
 * excepción por fichero entero dejaría pasar también las prescripciones NUEVAS de ese fichero,
 * que es justo lo que hay que cazar.
 */
const NARRACIONES_DECLARADAS = [
  { fichero: 'docs/MIGRATIONS_PENDING.md',
    fragmento: '(SCRUM-40, procedimiento canónico) aplicado primero a',
    porque: 'entrada FECHADA del registro (SCRUM-102, aplicado en prod el 2026-07-23): cuenta '
      + 'lo que se hizo entonces, no lo que hay que hacer ahora.' },
];

const estaDeclarada = (rel, linea) => NARRACIONES_DECLARADAS.some(
  (n) => n.fichero === rel && linea.includes(n.fragmento));

/**
 * 🔴 LA PRESCRIPCIÓN ES UNA FRASE, NO UNA COINCIDENCIA EN LA MISMA LÍNEA.
 *
 * `YAQU_MASTER.md:240` es UNA SOLA línea de más de mil caracteres con las diez técnicas
 * heredadas dentro. Con la regla de «misma línea», el texto YA CORREGIDO salía rojo: dice
 * «el procedimiento ÚNICO es ①→②→③» en un extremo y «`scripts/db-push-prod` queda para
 * STAGING» en el otro. Dos afirmaciones distintas, y el detector las leía como una.
 *
 * Es la trampa de autorreferencia de siempre, y la tercera vez esta semana: el guard casaba
 * con el texto que explica la prohibición. Así que lo que se mide es la DISTANCIA: la palabra
 * que prescribe tiene que estar PEGADA al nombre del script, como en la frase original
 * —«procedimiento canónico `scripts/db-push-prod`», 22 caracteres— y no a cien de distancia.
 */
const VENTANA = 60;

function prescripcionesVivas(docs) {
  const hallazgos = [];
  for (const d of docs) {
    if (esHistorico(d.rel)) continue;
    d.texto.split('\n').forEach((l, i) => {
      if (estaDeclarada(d.rel, l)) return;
      const re = new RegExp(NOMBRA_EL_SCRIPT.source, 'g');
      let m;
      while ((m = re.exec(l)) !== null) {
        const desde = Math.max(0, m.index - VENTANA);
        const trozo = l.slice(desde, m.index + m[0].length + VENTANA);
        if (LO_PRESCRIBE.test(trozo)) {
          hallazgos.push(`${d.rel}:${i + 1}  …${trozo.trim().slice(0, 130)}…`);
          return;
        }
      }
    });
  }
  return hallazgos;
}

// ───────────────────────────────────────────────────────────────────────────────────────
// SUELO
// ───────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-705 · 🔴 SUELO: el barrido VE la documentación', () => {
  const docs = barrido();
  assert.ok(docs.length > 100,
    `🔴 CIEGO: el barrido sólo ve ${docs.length} documentos. Son más de 400. Si aquí sale poco o ` +
    'cero, todo lo de abajo pasa por no haber mirado — no porque la documentación esté limpia.');

  // Y que el detector SEPA encontrar el nombre: si no lo encuentra en ningún sitio, está roto.
  const conMencion = docs.filter((d) => NOMBRA_EL_SCRIPT.test(d.texto));
  assert.ok(conMencion.length > 0,
    '🔴 CIEGO: cero documentos nombran `db-push-prod`. El script existe y está citado en varios ' +
    'sitios, así que esto no es «no hay menciones»: es que el barrido no está mirando.');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// EL ROJO QUE IMPORTA
// ─────────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-705 · 🔴 ningún documento VIVO prescribe db-push-prod contra producción', () => {
  const vivas = prescripcionesVivas(barrido());
  assert.deepEqual(vivas, [],
    '🔴 LA DOCUMENTACIÓN VUELVE A APUNTAR AL ARMA CARGADA:\n   ' + vivas.join('\n   ') +
    '\n\n   `db push` reconcilia el esquema ENTERO, y producción puede ir POR DELANTE de `main`\n' +
    '   en columnas aplicadas a mano: propondría tirarlas. El 2-sep-2026, desde un checkout\n' +
    '   1.933 commits por detrás, propuso DROP TABLE job_assignees, DROP TABLE email_messages\n' +
    '   y ~30 columnas de PRODUCCIÓN. Lo pararon el GO explícito y que la shell no tenía stdin.\n\n' +
    '   El procedimiento único es: ① decisión → ② ALTER aditivo en las TRES bases → ③ un solo\n' +
    '   PR con esquema+código+tests. NUNCA ③ sin ②. Ver `docs/MIGRATIONS_PENDING.md`.');
});

test('SCRUM-705 · 🔴 CONTROL: el detector CAZA la frase vieja — si no, no vigila nada', () => {
  // El mecanismo viejo, tal cual estaba en el máster hasta hoy. Si esto no salta, el verde de
  // arriba significa «no sé buscar», no «no hay».
  const comoEstaba = [
    'Algo de contexto anterior.',
    '3) Prisma sin TTY: `db push` (procedimiento canónico `scripts/db-push-prod` — host-check→',
    'preview→GO→push→documentar, SCRUM-40) contra producción, nunca `migrate dev`;',
  ].join('\n');
  const falso = [{ rel: 'docs/INVENTADO.md', texto: comoEstaba }];
  assert.equal(prescripcionesVivas(falso).length, 1,
    '🔴 el detector NO caza la frase que motivó el ticket. Entonces el verde de arriba no dice ' +
    'que la documentación esté bien: dice que este guard no mira.');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// CONTROL NEGATIVO · los históricos, uno por uno
// ─────────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-705 · ✅ CONTROL NEGATIVO: los registros FECHADOS no salen rojos', () => {
  // Enumerados, no «los de docs/master/». Si uno deja de existir, se entera aquí.
  for (const rel of ['docs/master/SCRUM-480.md', 'docs/master/SCRUM-685.md']) {
    const p = path.join(RAIZ, rel);
    assert.ok(fs.existsSync(p), `🔴 SUELO: ya no existe ${rel}; este control no comprueba nada.`);
    assert.match(fs.readFileSync(p, 'utf8'), NOMBRA_EL_SCRIPT,
      `🔴 SUELO: ${rel} ya no nombra db-push-prod, así que no sirve como control negativo.`);
    assert.ok(esHistorico(rel), `🔴 ${rel} NO se está tratando como histórico y saldría rojo.`);
  }

  // Y el archivo explícito.
  const archivo = 'docs/historico/prisma-migrations-frozen-2026-03/README.md';
  assert.ok(fs.existsSync(path.join(RAIZ, archivo)), `🔴 SUELO: ya no existe ${archivo}`);
  assert.ok(esHistorico(archivo), `🔴 ${archivo} NO se trata como histórico`);

  // 🔴 Y lo que de verdad prueba el control: el barrido SÍ los ve, y aun así no salen.
  const todos = barrido();
  const historicosVistos = todos.filter((d) => esHistorico(d.rel) && NOMBRA_EL_SCRIPT.test(d.texto));
  assert.ok(historicosVistos.length >= 2,
    `🔴 el barrido sólo ve ${historicosVistos.length} histórico(s) con la mención. Si no los ve, ` +
    'no está demostrando que los perdona: está demostrando que no los encuentra.');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// EL PROCEDIMIENTO, ESCRITO Y COMPLETO
// ─────────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-705 · 🔴 el procedimiento único está escrito, con sus cuatro reglas', () => {
  const doc = fs.readFileSync(path.join(RAIZ, 'docs', 'MIGRATIONS_PENDING.md'), 'utf8');

  const exigido = [
    [/ALTER ADITIVO en las TRES bases/i, 'el ② con las tres bases'],
    [/NUNCA ③ sin ②/, 'la regla de orden: nunca ③ sin ②'],
    [/NUNCA `db push` contra PRODUCCI[OÓ]N/i, 'la prohibición explícita'],
    [/prisma migrate diff/, 'de dónde sale el DDL'],
    [/current_database\(\)/, 'el tercer control de la verificación'],
    [/tipos distintos/i, 'los dos controles DE TIPOS DISTINTOS'],
    [/no medido.*cero|«no medido».*«cero»/is, 'que «no medido» no es «cero»'],
    [/despliegue est[áa] verde/i, 'mergear no es acabar'],
  ];
  const faltan = exigido.filter(([re]) => !re.test(doc)).map(([, q]) => q);
  assert.deepEqual(faltan, [],
    '🔴 el procedimiento está a medias. Falta: ' + faltan.join(' · ') +
    '\n   Un procedimiento incompleto es peor que ninguno: se sigue hasta donde llega y el resto ' +
    'se improvisa, que es de donde vienen los sustos.');
});

test('SCRUM-705 · 🔴 el MÁSTER dice el procedimiento, y ya no llama canónico al script', () => {
  // Regla 35: si el máster y otro documento discrepan, gana el máster. Así que el máster tiene
  // que decirlo, no sólo dejar de decir lo contrario.
  const master = fs.readFileSync(path.join(RAIZ, 'docs', 'YAQU_MASTER.md'), 'utf8');
  assert.match(master, /NUNCA `db push` contra PRODUCCI[OÓ]N/i,
    '🔴 el máster no prohíbe `db push` contra producción. Por regla 35 es la fuente de verdad: si ' +
    'él no lo dice, lo que digan los demás documentos no manda.');
  assert.match(master, /nunca \*\*③ sin ②\*\*|nunca ③ sin ②/,
    '🔴 el máster no dice la regla de orden.');
});
