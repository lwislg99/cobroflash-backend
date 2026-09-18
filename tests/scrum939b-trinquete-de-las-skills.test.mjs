// tests/scrum939b-trinquete-de-las-skills.test.mjs — SCRUM-939b
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// LAS SKILLS OBLIGATORIAS NO GANAN NI UNA AFIRMACIÓN FALSA MÁS. EL NÚMERO SÓLO BAJA.
//
// Una skill obligatoria no es documentación: es una instrucción que se ejecuta sin que nadie la
// revise. `cerebro-yaqu` —que se carga SIEMPRE— decía que `gh` está en una ruta que no existe, y
// una sesión se lo creyó. SCRUM-939 midió las cuatro obligatorias (docs/master/SCRUM-939.md):
// 49 afirmaciones comprobables, 42 ciertas, TRES falsas, cuatro no comprobables.
//
// ── POR QUÉ ES UN TRINQUETE Y NO UNA PROHIBICIÓN ─────────────────────────────────────────────
// Un guard que exigiera «cero falsas» nacería ROJO: dos de las tres son `.xsd` cuya duda no la
// resuelve el árbol (ver su `duda` abajo). Y un guard que nace rojo lo apaga alguien en una hora.
// Así que se sujeta lo que sí se puede sostener desde hoy:
//
//   · CENSO DECLARADO .... las tres de hoy, cada una con su motivo y con quién la retira;
//   · SÓLO BAJA .......... cae si aparece una falsa que no está declarada, Y cae si una declarada
//                          deja de salir sin que nadie la quite de aquí — el hueco que se queda en
//                          un censo es un permiso para que vuelva;
//   · SUELO .............. si falta una de las cuatro obligatorias, o no hay árbol, CIEGO: no verde;
//   · LOS CONTROLES ...... los tres de la fase a, corriendo en cada pasada, y el que decide:
//                          una falsa sembrada en una COPIA de una skill sube el número y lo tumba.
//
// Se compara por IDENTIDAD —skill, tipo y valor—, nunca por línea: editar una skill mueve las
// líneas, y un censo anclado a la línea 79 caducaría con cualquier párrafo nuevo encima.
//
// ── LO QUE ESTE FICHERO NO VE, DICHO ─────────────────────────────────────────────────────────
// 🔴 Cuenta sólo lo COMPROBABLE: el 89 % de las líneas de las skills es criterio y proceso, y ahí
//    no hay nada que el árbol pueda decir. Un verde aquí no dice que las skills sean ciertas: dice
//    que las rutas, comandos y reglas que citan no han empeorado.
// 🔴 Las NO COMPROBABLES no entran en el trinquete y siguen del lado malo. Tres de las cuatro de
//    hoy NIEGAN («no existe X, cítese Y»): la skill acierta y el censo no lee polaridad. Ponerlas
//    en el trinquete haría caer la tanda por una frase correcta; contarlas como ciertas sería
//    fiarse de una lectura que el censo no hace. Se quedan contadas en contra, que marca por dónde
//    tiene que crecer el instrumento.
// 🔴 La ruta de `gh` es de DISCO. En CI (ubuntu) cualquier `C:\…` no existe por construcción, así
//    que allí sale FALSA igual que en Windows pero sin discriminar. Lo razona el propio censo junto
//    a su verificador de RUTA_ABS: resolverlo exige leer la plataforma y eso sube un tope ajeno.
// 🔴 Las skills se LEEN del disco (así se puede sembrar en una copia); el árbol contra el que se
//    verifica es el ÍNDICE de git. Una carpeta de skill sin añadir la leería aquí y no en CI.
//
// ⛔ Ninguna skill se toca desde aquí. Su contenido es gobierno: su cambio lo prepara la S0 y lo
//    firma el fundador (docs/equipo/orquestador.md, §11bis), y algunas obligan sobre materia fiscal.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { temporal } from './_temporal.mjs';
import {
  censar, controles, afirmacionesDe, verificar, OBLIGATORIAS_CONOCIDAS,
} from '../scripts/censo-afirmaciones-de-skills.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const DIR_SKILLS = path.join(RAIZ, '.claude', 'skills');

// 🔴 MUTACIONES_QUE_ME_TUMBAN · SCRUM-745. Cinco, todas sobre el CENSO, cada una contra el caso
// que la tiene que ver.
//
// ⚠️ Y DOS QUE NO ESTÁN, dicho: las que mutan ESTE fichero —`juzgar` sin apuntar las nuevas, y una
// declarada cambiada— se vieron caer a mano sobre una copia hermana (docs/master/SCRUM-939.md,
// SCRUM-939b). Declararlas aquí pondría su ancla DOS veces en el mismo fichero, y acertar la
// buena dependería del orden de las líneas, no de un contrato.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'scripts/censo-afirmaciones-de-skills.mjs',
    de: 'const ok = arbol.ficheros.has(rel) || arbol.dirs.has(rel);',
    a: 'const ok = true;',
    cae: 'EL QUE DECIDE',
  },
  {
    fichero: 'scripts/censo-afirmaciones-de-skills.mjs',
    de: '  if (faltan.length) {',
    a: '  if (false) {',
    cae: 'SUELO en la copia',
  },
  {
    fichero: 'scripts/censo-afirmaciones-de-skills.mjs',
    de: "{ out.push({ tipo: 'RUTA_ABS', valor: t.replace(/^\"|\"$/g, '') }); continue; }",
    a: '{ continue; }',
    cae: 'los tres controles',
  },
  {
    fichero: 'scripts/censo-afirmaciones-de-skills.mjs',
    de: 'const ok = Object.prototype.hasOwnProperty.call(SCRIPTS, a.valor);',
    a: 'const ok = false;',
    cae: 'los tres controles',
  },
  {
    fichero: 'scripts/censo-afirmaciones-de-skills.mjs',
    de: "out.push({ tipo: 'REGLA', valor: m[1] });",
    a: "out.push({ tipo: 'REGLA', valor: m[1] }); if (linea.trim()) out.push({ tipo: 'PROSA', valor: linea });",
    cae: 'los tres controles',
  },
];

/**
 * EL CENSO DECLARADO. Medido el 17-sep-2026 (SCRUM-939) y vuelto a medir el 18-sep-2026 sobre
 * `origin/main` = 41bad7c8: las mismas tres.
 *
 * 🔴 Una entrada se BORRA cuando su falsa deja de salir: el trinquete cae hasta que se quita, y
 * así baja. Una entrada NUEVA sube el trinquete — eso no se hace para que la tanda pase: se
 * arregla la skill, o se avisa al orquestador con el motivo, en el mismo commit y a la vista.
 */
const FALSAS_DECLARADAS = Object.freeze([
  {
    skill: 'cerebro-yaqu',
    tipo: 'RUTA_ABS',
    valor: 'C:\\Program Files\\GitHub CLI\\gh.exe',
    motivo: 'la skill que se carga SIEMPRE dice que `gh` está en esa ruta, y no existe: en estas '
      + 'máquinas no hay `gh`, y es a propósito. Una sesión que se la crea intenta abrir el PR con él. '
      + 'Es el defecto que abrió SCRUM-939.',
    laRetira: 'quien gobierna la skill: la S0 prepara el cambio y lo firma el fundador.',
  },
  {
    skill: 'verifactu',
    tipo: 'RUTA',
    valor: 'EventosSIF.xsd',
    motivo: 'la skill lo lista bajo «Ficheros:» junto a otros que SÍ están en el árbol, y éste no está.',
    duda: 'puede ser el nombre de un esquema oficial de la AEAT que nunca se descargó: entonces la '
      + 'skill cita el catálogo oficial, no el árbol. Es materia VeriFactu y este censo NO la '
      + 'resuelve; sacarla del numerador sería opinión, así que cuenta con su duda escrita.',
    laRetira: 'quien gobierna la skill `verifactu`, con la duda decidida por el fundador (materia fiscal).',
  },
  {
    skill: 'verifactu',
    tipo: 'RUTA',
    valor: 'RespuestaValRegistNoVeriFactu.xsd',
    motivo: 'la skill lo lista bajo «Ficheros:» junto a otros que SÍ están en el árbol, y éste no está.',
    duda: 'la misma que la de arriba: puede ser un nombre oficial de la AEAT nunca descargado. '
      + 'Materia VeriFactu; no la resuelve este censo.',
    laRetira: 'quien gobierna la skill `verifactu`, con la duda decidida por el fundador (materia fiscal).',
  },
]);

const clave = (f) => `${f.skill} · [${f.tipo}] ${f.valor}`;
const dondeEsta = (f) => `${f.skill}:${f.linea}  [${f.tipo}]  ${f.valor}  → ${f.evidencia}`;

/**
 * EL VEREDICTO DEL TRINQUETE. Una sola función para la tanda y para la copia sembrada: un control
 * que juzgara por otro camino no probaría el camino que importa.
 *
 * Compara CONJUNTOS (con repeticiones), no cuentas: «he perdido una y he ganado otra» deja el
 * número igual y aquí sale en los dos sentidos a la vez.
 */
function juzgar(censo, declaradas) {
  if (censo.ciego) {
    return { ok: false, ciego: censo.ciego, observadas: [], nuevas: [], retiradas: [], mensaje: `🔴 CIEGO: ${censo.ciego}. «Ninguna falsa» y «no he mirado» serían el mismo verde.` };
  }
  const observadas = censo.filas.filter((f) => f.veredicto === 'FALSA');
  const quedan = new Map();
  for (const d of declaradas) quedan.set(clave(d), (quedan.get(clave(d)) || 0) + 1);
  const nuevas = [];
  for (const f of observadas) {
    const k = clave(f);
    if (quedan.get(k) > 0) quedan.set(k, quedan.get(k) - 1);
    else nuevas.push(f);
  }
  const retiradas = [];
  for (const d of declaradas) {
    const k = clave(d);
    if (quedan.get(k) > 0) { retiradas.push(d); quedan.set(k, quedan.get(k) - 1); }
  }
  const partes = [];
  if (nuevas.length) {
    // Con el mismo número también es una nueva: una falsa cambiada por otra deja la cuenta igual,
    // y decir «SUBE: 3 → 3» sería mentir en el rótulo justo en el caso que se compara por conjunto.
    const cabeza = observadas.length > declaradas.length
      ? `🔴 EL TRINQUETE SUBE: ${declaradas.length} declaradas → ${observadas.length} falsas.`
      : `🔴 UNA FALSA NUEVA CON EL MISMO NÚMERO: ${declaradas.length} declaradas → ${observadas.length} falsas, `
        + 'pero no son las mismas (se compara por identidad, no por cuenta).';
    partes.push(`${cabeza} ${nuevas.length} nueva(s) en una skill obligatoria:\n`
      + nuevas.map((f) => `     ${dondeEsta(f)}`).join('\n')
      + '\n  Una skill obligatoria se ejecuta sin que nadie la revise. El arreglo va en la SKILL (lo'
      + '\n  prepara la S0 y lo firma el fundador), no en este fichero. Declararla aquí SUBE el'
      + '\n  trinquete: eso se avisa al orquestador con su motivo, no se hace para que la tanda pase.');
  }
  if (retiradas.length) {
    partes.push(`🔴 EL TRINQUETE TIENE QUE BAJAR: ${retiradas.length} declarada(s) ya no sale(n) FALSA(S):\n`
      + retiradas.map((d) => `     ${clave(d)}`).join('\n')
      + '\n  Bórrala(s) de FALSAS_DECLARADAS en el mismo commit. Un hueco que se queda en el censo es'
      + '\n  un permiso para que la misma falsa vuelva sin que nada caiga.');
  }
  return { ok: !partes.length, ciego: null, observadas, nuevas, retiradas, mensaje: partes.join('\n\n') };
}

/** Una copia de los `SKILL.md` en un temporal fuera del árbol. El original no se toca nunca. */
function copiaDeLasSkills() {
  const copia = temporal('scrum939b-');
  for (const nombre of fs.readdirSync(DIR_SKILLS)) {
    const origen = path.join(DIR_SKILLS, nombre, 'SKILL.md');
    if (!fs.existsSync(origen)) continue;
    fs.mkdirSync(path.join(copia, nombre));
    fs.copyFileSync(origen, path.join(copia, nombre, 'SKILL.md'));
  }
  return copia;
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ① SUELO · el censo mira lo que dice mirar
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-939b · 🔴 SUELO: el censo ve las cuatro obligatorias y tiene afirmaciones que verificar', (t) => {
  const censo = censar();
  assert.equal(censo.ciego, null, `🔴 CIEGO: ${censo.ciego}.\n  Sin esto el trinquete daría verde sin haber mirado.`);
  for (const n of OBLIGATORIAS_CONOCIDAS) {
    assert.ok(censo.obligatorias.some((s) => s.nombre === n), `🔴 el censo no ve la obligatoria «${n}».`);
  }
  const falsas = censo.filas.filter((f) => f.veredicto === 'FALSA').length;
  const nc = censo.filas.filter((f) => f.veredicto === 'NO COMPROBABLE').length;
  t.diagnostic(`población: ${censo.carpetas} carpetas de skill · ${censo.obligatorias.length} obligatorias · `
    + `${censo.lineasTotales} líneas · ${censo.lineasConAfirmacion} con algo comprobable · `
    + `${censo.filas.length} afirmaciones · ${falsas} FALSAS · ${nc} NO COMPROBABLES (del lado malo)`);
});

test('SCRUM-939b · los tres controles de la fase a, dentro, en cada pasada', () => {
  // POSITIVO (la ruta de `gh` sale FALSA por el eje de la RUTA, no por mencionar «gh») · NEGATIVO
  // (una afirmación cierta sale CIERTA: si todo sale falso, no verifica, acusa) · SEGUNDO NEGATIVO
  // (una frase de criterio no entra en el censo: si entrara, el porcentaje de falsas bajaría solo).
  // Van congelados en literales dentro del censo: si midieran la línea 79 de la skill de verdad,
  // morirían el día que alguien la arregle.
  assert.deepEqual(controles(), [], '🔴 un control del censo ha caído: el instrumento no es de fiar y el trinquete no vale.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ② EL TRINQUETE · sobre las skills de verdad
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-939b · 🔴 EL TRINQUETE: ninguna falsa nueva en las skills obligatorias, y el número sólo baja', () => {
  const v = juzgar(censar(), FALSAS_DECLARADAS);
  assert.ok(v.ok, v.mensaje);
});

test('SCRUM-939b · el censo declarado lleva su motivo y quién la retira, y las del .xsd su duda', () => {
  for (const d of FALSAS_DECLARADAS) {
    assert.ok(d.motivo && d.motivo.length > 20, `🔴 «${clave(d)}» entra sin motivo. Una excepción sin causa es un permiso.`);
    assert.ok(d.laRetira && d.laRetira.length > 10, `🔴 «${clave(d)}» no dice quién la retira.`);
    if (d.valor.endsWith('.xsd')) {
      assert.ok(d.duda && d.duda.length > 20, `🔴 «${clave(d)}» es un .xsd y no lleva su duda escrita.`);
    }
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ③ EL QUE DECIDE · sembrado en una COPIA, nunca en el original
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-939b · 🔴 EL QUE DECIDE: una falsa sembrada en una COPIA de una skill sube el trinquete y lo tumba', () => {
  const original = path.join(DIR_SKILLS, 'cerebro-yaqu', 'SKILL.md');
  const antes = fs.readFileSync(original);

  // Gemela sin sembrar: la copia sola no añade ni quita nada. Sin esto, un rojo en la sembrada
  // podría venir de copiar mal y no de la siembra.
  const limpia = juzgar(censar({ dirSkills: copiaDeLasSkills() }), FALSAS_DECLARADAS);
  assert.ok(limpia.ok, `🔴 la COPIA sin sembrar no da lo mismo que el original:\n${limpia.mensaje}`);

  const copia = copiaDeLasSkills();
  const sembrada = path.join(copia, 'cerebro-yaqu', 'SKILL.md');
  fs.appendFileSync(sembrada, '\n- El lanzador de relevos vive en `scripts/cebo-del-trinquete-939b.mjs`.\n');

  const v = juzgar(censar({ dirSkills: copia }), FALSAS_DECLARADAS);
  assert.equal(v.ok, false, '🔴 una falsa sembrada NO tumba el trinquete: no vigila nada.');
  assert.equal(v.observadas.length, limpia.observadas.length + 1,
    `🔴 el número no ha SUBIDO en uno: ${limpia.observadas.length} → ${v.observadas.length}.`);
  assert.deepEqual(v.nuevas.map(clave), ['cerebro-yaqu · [RUTA] scripts/cebo-del-trinquete-939b.mjs'],
    `🔴 cae, pero no por la sembrada:\n${v.mensaje}`);
  assert.deepEqual(v.retiradas, [], `🔴 sembrar una ha hecho desaparecer otra:\n${v.mensaje}`);
  assert.match(v.mensaje, /EL TRINQUETE SUBE/);

  assert.deepEqual(fs.readFileSync(original), antes, '🔴 el ORIGINAL ha cambiado: la siembra tenía que ir en la copia.');
});

test('SCRUM-939b · 🔴 SÓLO BAJA: una declarada que ya no sale tumba el trinquete hasta que se borra', () => {
  // Fabricado a mano, sin leer ninguna skill: si dependiera de que la falsa real siga en la skill,
  // este caso moriría el día que alguien la arregle — que es justo el día que tiene que hablar.
  const declarada = { skill: 'x', tipo: 'RUTA', valor: 'docs/YAQU_MASTER.md' };
  const sinElla = { ciego: null, filas: [] };
  const conElla = { ciego: null, filas: [{ ...declarada, linea: 1, veredicto: 'FALSA', evidencia: 'fabricada' }] };

  const baja = juzgar(sinElla, [declarada]);
  assert.equal(baja.ok, false, '🔴 una declarada que ya no sale no tumba nada: el hueco quedaría como permiso.');
  assert.deepEqual(baja.retiradas.map(clave), [clave(declarada)]);
  assert.match(baja.mensaje, /TIENE QUE BAJAR/);

  assert.ok(juzgar(conElla, [declarada]).ok, '🔴 con la declarada presente y nada más, tiene que estar verde.');
  // Repetida: la misma falsa dos veces con una sola declaración es una NUEVA, no la misma.
  const dos = juzgar({ ciego: null, filas: [conElla.filas[0], { ...conElla.filas[0], linea: 2 }] }, [declarada]);
  assert.equal(dos.ok, false, '🔴 la misma falsa copiada dos veces pasa con una sola declaración.');
  assert.equal(dos.nuevas.length, 1);
});

test('SCRUM-939b · 🔴 SUELO en la copia: sin una de las cuatro obligatorias sale CIEGO, no verde', () => {
  const copia = copiaDeLasSkills();
  fs.rmSync(path.join(copia, 'yaqu-premium-ui'), { recursive: true, force: true });
  const censo = censar({ dirSkills: copia });
  assert.match(String(censo.ciego), /yaqu-premium-ui/, '🔴 falta una obligatoria y el censo no se declara ciego.');
  const v = juzgar(censo, FALSAS_DECLARADAS);
  assert.equal(v.ok, false, '🔴 un censo ciego da verde en el trinquete.');
  assert.match(v.mensaje, /CIEGO/);
});

test('SCRUM-939b · las NO COMPROBABLES siguen del lado malo: una línea que niega no sale ni cierta ni falsa', () => {
  // Congelado en un literal, como los controles de la fase a. Si alguien enseña al censo a leer la
  // polaridad, este caso cae y hay que decidir A LA VISTA qué pasa con las tres de hoy.
  const linea = 'No existe `scripts/cebo-negado-939b.mjs`: cítese `docs/YAQU_MASTER.md`.';
  const afs = afirmacionesDe(linea);
  assert.equal(afs.length, 2, `🔴 se esperaban 2 afirmaciones y salen ${afs.length}.`);
  for (const a of afs) {
    assert.equal(verificar(a, linea).veredicto, 'NO COMPROBABLE',
      `🔴 «${a.valor}», en una línea que NIEGA, ya no sale NO COMPROBABLE.`);
  }
});
