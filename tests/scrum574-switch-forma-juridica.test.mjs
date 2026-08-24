// tests/scrum574-switch-forma-juridica.test.mjs — SCRUM-574 (CONT-01)
//
// EL SWITCH Empresa/Persona: la regla que EJECUTA, y los invariantes que se comprueban leyendo el
// árbol. Los tests del panel no levantan navegador, así que aquí hay de las dos clases y se
// distinguen a propósito:
//
//   · `debeEsconder` se EJECUTA — es una función pura y vive suelta justo para poder probarla.
//   · lo que no se puede ejecutar sin DOM se comprueba por ANÁLISIS DEL FUENTE, y cada uno de
//     esos lleva su SUELO: primero se demuestra que el detector encuentra algo, y solo entonces
//     se le cree cuando dice que no encuentra lo prohibido. Un `match` que no casa nunca pinta
//     verde igual de bien sobre un fichero correcto que sobre uno vacío.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const RAIZ = path.resolve(import.meta.dirname, '..');
const COMPONENTE = path.join(RAIZ, 'public/dashboard/js/switchFormaJuridica.js');
const LISTA = path.join(RAIZ, 'public/dashboard/js/customersView.js');
const FICHA = path.join(RAIZ, 'public/dashboard/js/customerDetailView.js');
const SCHEMAS = path.join(RAIZ, 'src/core/validation/schemas.ts');
const INDEX = path.join(RAIZ, 'public/dashboard/index.html');

const leer = (p) => fs.readFileSync(p, 'utf8');
// Solo el código: quita las líneas de comentario `//`. Sin esto, un guard de texto se caza a sí
// mismo en el comentario que explica la prohibición (cerebro-yaqu) y nunca puede dar verde.
const soloCodigo = (s) => s.split(/\r?\n/).filter((l) => !l.trimStart().startsWith('//')).join('\n');

const require_ = createRequire(import.meta.url);
const mod = require_(COMPONENTE);

// ── LA REGLA, EJECUTADA ──────────────────────────────────────────────────────────────────

test('SCRUM-574 · SUELO: el componente exporta lo que estos tests van a ejercer', () => {
  // Si el módulo no exporta, todo lo de abajo daría `undefined is not a function` — o peor, un
  // `assert` sobre undefined que alguien silenciaría. Se comprueba antes.
  assert.equal(typeof mod.debeEsconder, 'function', '🔴 no se exporta `debeEsconder`');
  assert.deepEqual(mod.VALORES, ['EMPRESA', 'PERSONA'], '🔴 los valores del switch han cambiado');
  assert.deepEqual(mod.SOLO_EMPRESA, ['legalName'], '🔴 ha cambiado qué campos son solo de Empresa');
});

test('SCRUM-574 · el lado PERSONA esconde «razón social» — pero solo si está VACÍA', () => {
  assert.equal(mod.debeEsconder('PERSONA', false), true, '🔴 en Persona y vacía, debería esconderse');
  // Invariante ②: un dato invisible es un dato que nadie corrige y que sigue viajando a la factura.
  assert.equal(mod.debeEsconder('PERSONA', true), false, '🔴 SE ESTÁ ESCONDIENDO UN DATO ESCRITO');
});

test('SCRUM-574 · el lado EMPRESA no esconde nada', () => {
  assert.equal(mod.debeEsconder('EMPRESA', false), false);
  assert.equal(mod.debeEsconder('EMPRESA', true), false);
});

test('SCRUM-574 · 🔴 sin declarar (null) SE ENSEÑA TODO — no se supone que es una persona', () => {
  // Los 15 clientes medidos en el PASO 0 están aquí. Si `null` escondiera, la migración habría
  // hecho desaparecer campos de todas las fichas existentes sin que nadie declarara nada.
  assert.equal(mod.debeEsconder(null, false), false, '🔴 null esconde: se está tratando «sin declarar» como Persona');
  assert.equal(mod.debeEsconder(undefined, false), false, '🔴 undefined esconde');
  assert.equal(mod.debeEsconder('', false), false, '🔴 la cadena vacía esconde');
});

test('SCRUM-574 · 🔴 ROJO: un valor desconocido NO esconde (fail-closed hacia enseñar)', () => {
  // Si alguien mete 'persona' en minúsculas por SQL, o un valor futuro, el control no puede
  // esconder campos por su cuenta. Enseñar de más es recuperable; esconder de más, no.
  assert.equal(mod.debeEsconder('persona', false), false, '🔴 un valor fuera de la lista esconde campos');
  assert.equal(mod.debeEsconder('AUTONOMO', false), false, '🔴 un valor futuro esconde campos');
});

// ── LOS INVARIANTES, LEÍDOS DEL ÁRBOL ────────────────────────────────────────────────────

test('SCRUM-574 · SUELO: los ficheros que se auditan existen y tienen contenido', () => {
  for (const f of [COMPONENTE, LISTA, FICHA, SCHEMAS, INDEX]) {
    assert.ok(leer(f).length > 500, `🔴 ${path.basename(f)} está vacío o no es lo que se cree: el resto de este fichero no mediría nada`);
  }
});

test('SCRUM-574 · la lista del switch y el z.enum del backend NO pueden divergir', () => {
  const ts = leer(SCHEMAS);
  const m = ts.match(/contactKind:\s*z\.enum\(\[([^\]]*)\]\)/);
  assert.ok(m, '🔴 no encuentro `contactKind: z.enum([...])` en schemas.ts — o se ha ido, o cambió de forma');
  const delBackend = m[1].split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
  assert.deepEqual(
    delBackend, mod.VALORES,
    `🔴 DIVERGEN: el backend admite [${delBackend}] y el switch ofrece [${mod.VALORES}]. Uno de los dos manda y el otro miente.`,
  );
});

test('SCRUM-574 · 🔴 contactKind NO se deriva de tipoDestinatario en ningún formulario', () => {
  // LA PROHIBICIÓN DEL FUNDADOR (24-ago-2026), y la lección entera del ticket: forma jurídica ≠
  // capacidad fiscal. Un autónomo es PERSONA y EMPRESARIO a la vez, así que deducir uno del otro
  // rompe justo al cliente que abrió esto. Lo que se busca es una línea que MENCIONE los dos.
  for (const f of [LISTA, FICHA, COMPONENTE]) {
    const lineas = soloCodigo(leer(f)).split(/\r?\n/);
    const mezcladas = lineas.filter((l) => /contactKind/.test(l) && /tipoDestinatario/.test(l));
    assert.deepEqual(
      mezcladas, [],
      `🔴 ${path.basename(f)} MEZCLA los dos campos en una línea:\n   ${mezcladas.join('\n   ')}`,
    );
  }
});

test('SCRUM-574 · SUELO del guard anterior: el detector SÍ sabe encontrar una mezcla', () => {
  // Sin esto, el test de arriba pasaría verde aunque el patrón no casara nunca — que es como se
  // ven los guards muertos. Se le da una línea que SÍ es una mezcla y se exige que la vea.
  const trampa = 'const k = c.tipoDestinatario === "EMPRESARIO" ? "EMPRESA" : null; c.contactKind = k;';
  const lineas = soloCodigo(trampa).split(/\r?\n/);
  const mezcladas = lineas.filter((l) => /contactKind/.test(l) && /tipoDestinatario/.test(l));
  assert.equal(mezcladas.length, 1, '🔴 EL DETECTOR ESTÁ CIEGO: no ve una mezcla evidente');
});

test('SCRUM-574 · los dos formularios llevan el switch, y sale del MISMO componente', () => {
  // «El switch, en el ALTA y en la EDICIÓN. Los dos sitios.» Se comprueba que ninguno se lo montó
  // por su cuenta: los dos llaman a la pieza compartida.
  for (const f of [LISTA, FICHA]) {
    const codigo = soloCodigo(leer(f));
    assert.match(codigo, /switchFormaJuridica\(/, `🔴 ${path.basename(f)} no construye el switch`);
    assert.match(codigo, /contactKind:\s*switchForma\.leer\(\)/, `🔴 ${path.basename(f)} no envía contactKind al guardar`);
    assert.match(codigo, /switchFormaJuridica\.aplicarLado\(/, `🔴 ${path.basename(f)} no aplica la regla de campos por lado`);
  }
  assert.match(leer(INDEX), /switchFormaJuridica\.js/, '🔴 el componente no está cargado en index.html: los dos formularios petarían');
});

test('SCRUM-574 · 🔴 NADIE escribe microcopy: las tres etiquetas van con el marcador oficial', () => {
  // Regla 30: la pregunta y las dos etiquetas son del fundador. Salen con marca + palabra de
  // trabajo, que es el patrón que `scripts/censo-marcadores.mjs` cuenta como legible.
  const codigo = soloCodigo(leer(COMPONENTE));
  assert.equal(mod.MARCADOR, '[PENDIENTE microcopy oficial]', '🔴 el marcador no es el oficial del repo');
  const conMarca = (codigo.match(/MARCADOR \+ '/g) || []).length;
  assert.ok(
    conMarca >= 2,
    `🔴 solo ${conMarca} rótulo(s) llevan el marcador: la pregunta y las dos etiquetas tienen que llevarlo`,
  );
});

test('SCRUM-574 · 🔴 el switch NUNCA cae a un lado por defecto', () => {
  // Un `|| 'EMPRESA'` o un `|| 'PERSONA'` en el camino de guardado convertiría «sin declarar» en
  // una declaración, y se escribiría en la BD al guardar la ficha por cualquier otro motivo.
  for (const f of [COMPONENTE, LISTA, FICHA]) {
    const codigo = soloCodigo(leer(f));
    const caidas = codigo.match(/\|\|\s*['"](EMPRESA|PERSONA)['"]/g) || [];
    assert.deepEqual(
      caidas, [],
      `🔴 ${path.basename(f)} cae a un lado por defecto: ${caidas.join(', ')} — eso DECLARA por el profesional`,
    );
  }
});
