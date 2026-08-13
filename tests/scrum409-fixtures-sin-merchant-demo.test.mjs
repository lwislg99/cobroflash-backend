// tests/scrum409-fixtures-sin-merchant-demo.test.mjs — SCRUM-409 · fixtures fuera del merchant demo.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL DEFECTO
//
// El merchant 1 es el DEMO, y el producto se comporta distinto con él: `whatsappPolicy` corta por
// `DEMO_MERCHANT_ID`, el PDF lleva marca de agua, la pasarela se desvía. Un fixture que use ese id
// **desactiva comprobaciones sin tocar el guard**, y el test sigue verde diciendo otra cosa.
//
// Aquí el id del demo solo puede aparecer en los ficheros que PRUEBAN ese comportamiento — y esa
// lista **se deriva**, no se escribe: son los que importan `isDemoMerchant` / `DEMO_MERCHANT_ID` /
// `DEMO_SAFE_NUMBERS`, o los que lo declaran a la vista con la marca de abajo.
//
// ⚠️ POR QUÉ HAY DOS SEÑALES Y NO UNA — lo aprendí rompiendo tres tests.
//
// La primera versión derivaba la lista SOLO de los imports, y `scrum207-conciliacion` no importa
// nada del demo: clasifica documentos con un mapa de merchants y su fila 6 **es el cubo del demo**.
// Al cambiarle el id, el test cayó. La derivación por import es necesaria pero no suficiente, así
// que existe una segunda señal EXPLÍCITA y visible en la propia línea:
//
//     merchantId: 1,  // MERCHANT DEMO A PROPOSITO (SCRUM-409): <por qué>
//
// No es una allowlist muda: va pegada al sitio, dice por qué, y quien la lea ve que es deliberada.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.resolve(import.meta.dirname);
const DEMO_ID = 1;
const SENALES_IMPORT = ['isDemoMerchant', 'DEMO_MERCHANT_ID', 'DEMO_SAFE_NUMBERS', 'demoMerchant'];
const MARCA = 'MERCHANT DEMO A PROPOSITO';

// ⚠️ ESTE FICHERO SE EXCLUYE DE SÍ MISMO. Nombra `DEMO_MERCHANT_ID` para poder derivar la lista,
// así que se auto-eximiría — la trampa de auto-referencia de siempre: un guard que se caza (o se
// perdona) a sí mismo en el texto que explica la regla.
const YO = path.basename(new URL(import.meta.url).pathname);
const ficheros = fs.readdirSync(DIR).filter((f) => /\.(mjs|js)$/.test(f) && f !== YO);

/** Ocurrencias de `merchantId: 1` con su línea. Se mira el CÓDIGO, no los comentarios. */
function usosDelDemo(texto) {
  const out = [];
// 13-ago-2026 · SE PARTE POR /\r?\n/ Y NO POR '\n': con CRLF cada linea se quedaba
// con un retorno de carro al final, y entonces el replace del comentario NO CASABA (el punto de
// la regex no incluye ese caracter y el $ sin flag m exige fin de cadena). El comentario entraba
// ENTERO, asi que este guard se cazaba a si mismo en la frase que explica la prohibicion.
// Estuvo ciego en TODO fichero con CRLF. Encontrado con main en rojo por scrum508:76.
  texto.split(/\r?\n/).forEach((linea, i) => {
    const sinComentario = linea.replace(/\/\/.*$/, '');
    if (new RegExp(`merchantId:\\s*${DEMO_ID}\\b`).test(sinComentario)) {
      out.push({ linea: i + 1, texto: linea.trim(), marcada: linea.includes(MARCA) });
    }
  });
  return out;
}

const analisis = ficheros.map((f) => {
  const texto = fs.readFileSync(path.join(DIR, f), 'utf8');
  return {
    fichero: f,
    usos: usosDelDemo(texto),
    // La lista de «prueba el demo» es DERIVADA: sale de lo que el fichero importa.
    pruebaElDemo: SENALES_IMPORT.some((s) => texto.includes(s)),
  };
});

// ── SUELO ────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-409 · SUELO: hay ficheros de test que auditar', () => {
  assert.ok(ficheros.length >= 100,
    `🔴 solo se han encontrado ${ficheros.length} ficheros de test. «Ningún fixture con el demo» y ` +
    '«no supe mirar» dan la misma bandeja: si el detector no lee el directorio, no mide nada.');
});

test('SCRUM-409 · SUELO: el detector RECONOCE un uso del demo (control positivo sintético)', () => {
  // Sin esto, «cero usos» podría significar que el reconocedor está roto.
  const usos = usosDelDemo('const x = { merchantId: 1, nombre: "x" };');
  assert.equal(usos.length, 1, '🔴 el detector no ve un `merchantId: 1` evidente.');
  assert.equal(usos[0].marcada, false);
  // Y no se deja engañar por un comentario que lo mencione.
  assert.equal(usosDelDemo('// aquí NO hay merchantId: 1, es prosa').length, 0,
    '🔴 el detector cuenta menciones en comentarios: un guard de texto cazándose a sí mismo.');
});

// ── EL GUARD ─────────────────────────────────────────────────────────────────────────────────

test('SCRUM-409 · ningún fixture usa el merchant DEMO salvo donde se prueba el demo', () => {
  const infractores = [];
  for (const a of analisis) {
    if (a.pruebaElDemo) continue;               // derivado: importa el mecanismo del demo
    for (const u of a.usos) {
      if (u.marcada) continue;                  // declarado a la vista, con su motivo
      infractores.push(`${a.fichero}:${u.linea}  ${u.texto.slice(0, 70)}`);
    }
  }

  assert.deepEqual(infractores, [],
    `🔴 FIXTURES CON EL MERCHANT DEMO (id ${DEMO_ID}):\n   ${infractores.join('\n   ')}\n\n` +
    '  El demo NO se comporta como un merchant normal: la política de WhatsApp corta por su id, el\n' +
    '  PDF lleva marca de agua y la pasarela se desvía. Un fixture ahí DESACTIVA comprobaciones sin\n' +
    '  tocar ningún guard, y el test sigue verde midiendo otra cosa.\n\n' +
    '  Usa un id inventado (7, 71…). Si de verdad estás probando el comportamiento DEMO, o importas\n' +
    `  su mecanismo, o marcas la línea: \`// ${MARCA} (SCRUM-409): <por qué>\`.`);
});

test('SCRUM-409 · la lista de exentos es DERIVADA, y hoy tiene a quien eximir', (t) => {
  const derivados = analisis.filter((a) => a.pruebaElDemo && a.usos.length > 0).map((a) => a.fichero);
  const marcados = analisis.filter((a) => !a.pruebaElDemo && a.usos.some((u) => u.marcada)).map((a) => a.fichero);
  t.diagnostic(`exentos por import: ${derivados.join(', ') || '—'} · por marca explícita: ${marcados.join(', ') || '—'}`);

  assert.ok(derivados.length + marcados.length > 0,
    '🔴 no hay NINGÚN fichero exento. Si de verdad ya nadie prueba el comportamiento demo, este ' +
    'guard vigila un caso que no existe — y entonces su verde no significa nada. Compruébalo antes ' +
    'de creerlo.');
});
