// tests/scrum811c-skill-ui-declarada.test.mjs — SCRUM-811
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// UNA SKILL «OBLIGATORIA» QUE NADIE CARGA NO ES UNA REGLA: ES UN DOCUMENTO
//
// Medido en SCRUM-811 (comentario 15828, S1/S6): `yaqu-premium-ui` se declara obligatoria
// «antes de tocar UI» en `CLAUDE.md` y en su propio fichero, y de 222 registros que tocaban
// `public/` sólo 2 la mencionan (0,9 %). La comparación que decide el diseño de este guard:
//
//   | obligación                | mecanismo | cumplimiento |
//   | -------------------------- | --------- | ------------- |
//   | ancla `**Medido contra:**` | GUARD     | 572/574 · 99,7 % |
//   | `yaqu-premium-ui`          | prosa     | 2/222 · 0,9 %  |
//
// **La distancia no la explica la disciplina: la explica el guard.** Decisión del fundador
// (comentario 16268, 21-sep-2026): «guard de entrada que exija "skill cargada / por qué no"
// en registros que toquen public/ (mide declaración, no carga)». Este fichero es eso.
//
// ── QUÉ SE PUEDE MEDIR DESDE EL REPO, Y QUÉ NO ────────────────────────────────────────────
// Que una sesión CARGÓ la skill no es comprobable desde git (la carga no toca el árbol). Lo
// que SÍ se puede exigir, igual que `**Medido contra:**`, es la DECLARACIÓN estructural: un
// campo fijo en el encabezado de la entrada. Mide declaración, no carga — tal cual pide el
// encargo. Que alguien escriba `**Skill UI:** cargada` sin haberla abierto es posible, y es
// el mismo límite que ya acepta `**Medido contra:**` (nadie comprueba que el sha se copió de
// verdad de un `git rev-parse`). No es un guard peor: es el mismo tipo de guard.
//
// ── TROCEADOR REUTILIZADO, NO DUPLICADO ───────────────────────────────────────────────────
// `entradasTroceadas()` viene de `scrum267-ancla-de-medicion.test.mjs`, igual que ya hacen
// `scrum649` y `scrum859`: parte cada fichero de `docs/master/` en sus entradas reales
// (incluye apéndices, SCRUM-532) y no depende de un troceador propio que pueda divergir.
//
// ── LA RUTA public/ SE BUSCA EN TODO EL CUERPO, NO SÓLO EN «## Ficheros» ──────────────────
// SCRUM-391 ya midió que la sección «## Ficheros» sólo la usan 58 de 104 entradas: acotar el
// detector a esa sección cegaría a las otras 46. Se busca la ruta en el cuerpo entero, igual
// que SCRUM-391 busca `tests/*.test.mjs` en el cuerpo entero. Falso positivo aceptado (una
// entrada que sólo MENCIONA `public/` en prosa, sin tocarlo) por el mismo motivo que allí: es
// mejor pedir una declaración de más que quedarse ciego en el 44 % de los casos.
//
// ── EL CORTE POR FECHA, Y POR QUÉ NO SE EXIGE A LO YA ESCRITO ─────────────────────────────
// 222 entradas ya tocan `public/` sin este campo — exigírselo retroactivamente castigaría a
// quien siguió el formato vigente cuando lo escribió (el mismo argumento del README para las
// tres anclas exentas de SCRUM-267: SCRUM-231, 244, 264). El campo se exige sólo a partir de
// `CORTE`, que es la fecha en que este guard entra en `main` — así lo dice la propia fecha en
// el campo `**Fecha:**` de cada entrada, sin necesidad de mantener una lista de excepciones.
// Si estás escribiendo una entrada NUEVA que toca `public/`, esto te afecta: pon el campo.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import { entradasTroceadas } from './scrum267-ancla-de-medicion.test.mjs';

// El corte: entradas fechadas EN o ANTES de este día quedan exentas (formato vigente cuando
// se escribieron no exigía el campo). A partir del día siguiente, se exige.
const CORTE_AAAAMMDD = '2026-09-22';

const MESES = {
  ene: '01', feb: '02', mar: '03', abr: '04', may: '05', jun: '06',
  jul: '07', ago: '08', sep: '09', oct: '10', nov: '11', dic: '12',
};

/** `**Fecha:** 22-sep-2026` → `'2026-09-22'`, o `null` si no hay campo reconocible. */
export function fechaDeEntrada(cuerpo) {
  const m = /\*\*Fecha:\*\*\s*(\d{1,2})-([a-z]{3})-(\d{4})/i.exec(cuerpo);
  if (!m) return null;
  const mes = MESES[m[2].toLowerCase()];
  if (!mes) return null;
  return `${m[3]}-${mes}-${String(m[1]).padStart(2, '0')}`;
}

/** ¿El cuerpo nombra una ruta real bajo `public/`? Toda la entrada, no sólo «## Ficheros». */
export function tocaPublic(cuerpo) {
  return /public\/[A-Za-z0-9_./-]+\.(js|css|html)/.test(cuerpo);
}

/** ¿Lleva `**Skill UI:** cargada` o `**Skill UI:** no cargada · <motivo>`? */
export function declaraSkillUi(cuerpo) {
  return /\*\*Skill UI:\*\*\s*(cargada\b|no cargada\s*·\s*\S)/i.test(cuerpo);
}

/** Entradas que EXIGEN el campo: tocan `public/`, fecha posterior al corte, y no lo llevan. */
export function entradasSinDeclarar(entradas) {
  return entradas.filter((e) => {
    if (!tocaPublic(e.cuerpo)) return false;
    const f = fechaDeEntrada(e.cuerpo);
    if (!f || f <= CORTE_AAAAMMDD) return false; // sin fecha reconocible o pre-corte: exenta
    return !declaraSkillUi(e.cuerpo);
  });
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// SUELO — el detector ve el árbol real, y ve casos de `public/` de verdad (si no, está ciego)
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-811 · SUELO: el troceador ve entradas, y algunas tocan public/ de verdad', () => {
  const entradas = entradasTroceadas();
  assert.ok(entradas.length >= 300,
    `🔴 CIEGO: sólo ${entradas.length} entradas — se midieron 696+ el 15-sep-2026 (SCRUM-859). ` +
    'El troceador no está llegando al árbol.');

  const tocanPublic = entradas.filter((e) => tocaPublic(e.cuerpo));
  assert.ok(tocanPublic.length >= 50,
    `🔴 sólo ${tocanPublic.length} entradas mencionan una ruta public/*.{js,css,html} — se ` +
    'midieron 222 el 17-sep-2026 (SCRUM-811b). Si el detector de rutas está roto, este guard ' +
    'nunca exige nada y su verde no significa «cumple»: significa «no miré».');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// AUTOPRUEBA — sobre texto fabricado, el detector acierta los cuatro casos
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-811 · AUTOPRUEBA: fecha, ruta y declaración se leen bien sobre el cebo', () => {
  assert.equal(fechaDeEntrada('**Fecha:** 22-sep-2026 · **Carril:** A'), '2026-09-22');
  assert.equal(fechaDeEntrada('**Fecha:** 3-ene-2027'), '2027-01-03');
  assert.equal(fechaDeEntrada('sin campo de fecha aquí'), null);

  assert.equal(tocaPublic('Cambios en `public/dashboard/js/app.js` y tests.'), true);
  assert.equal(tocaPublic('Cambios en `src/modules/quotes/service.ts` solamente.'), false);

  assert.equal(declaraSkillUi('**Skill UI:** cargada'), true);
  assert.equal(declaraSkillUi('**Skill UI:** no cargada · no toca componentes visuales, solo el copy de un log'), true);
  assert.equal(declaraSkillUi('**Skill UI:** no cargada'), false, '🔴 «no cargada» SIN motivo no basta: el campo pide el porqué');
  assert.equal(declaraSkillUi('sin ese campo'), false);

  // El caso que decide el guard: toca public/, es POSTERIOR al corte, y no declara → se exige.
  const rojo = [{ cuerpo: '**Fecha:** 23-sep-2026\n\nToca `public/dashboard/js/app.js`.' }];
  assert.equal(entradasSinDeclarar(rojo).length, 1, '🔴 el caso que debía caer no cayó');

  // Y el CONTROL NEGATIVO, en tres variantes que NO deben caer:
  const verdes = [
    // ① declara el campo
    { cuerpo: '**Fecha:** 23-sep-2026\n\nToca `public/dashboard/js/app.js`.\n\n**Skill UI:** cargada' },
    // ② fecha en el corte mismo (exenta: «en o antes» del corte)
    { cuerpo: '**Fecha:** 22-sep-2026\n\nToca `public/dashboard/js/app.js`.' },
    // ③ no toca public/
    { cuerpo: '**Fecha:** 23-sep-2026\n\nToca `src/modules/quotes/service.ts`.' },
  ];
  assert.deepEqual(entradasSinDeclarar(verdes), [],
    '🔴 FALSO POSITIVO sobre un caso que no debía caer — ver los tres del control negativo');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// EL QUE DECIDE — ninguna entrada real, posterior al corte, se salta la declaración
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-811 · toda entrada NUEVA que toca public/ declara si cargó la skill, o por qué no', () => {
  const faltan = entradasSinDeclarar(entradasTroceadas())
    .map((e) => `${e.fichero}#${e.clave ?? e.indice} (${e.tituloCompleto.trim()})`);

  assert.deepEqual(faltan, [],
    `🔴 ${faltan.length} entrada(s) tocan public/ y no declaran \`**Skill UI:**\`:\n\n` +
    faltan.map((f) => `      ${f}`).join('\n') +
    '\n\n  Añade `**Skill UI:** cargada` o `**Skill UI:** no cargada · <motivo>` al encabezado. ' +
    'yaqu-premium-ui se declara obligatoria antes de tocar UI (CLAUDE.md, Parte AB del máster).');
});
