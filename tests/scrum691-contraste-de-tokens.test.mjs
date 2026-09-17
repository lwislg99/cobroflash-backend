// tests/scrum691-contraste-de-tokens.test.mjs — SCRUM-691b
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// UN CONTORNO QUE ESTÁ AHÍ Y NO SE VE ES UN CONTORNO QUE NO ESTÁ.
//
// S5 midió `--border` a **1,14** sobre el lienzo. WCAG 1.4.11 pide **3,00** para el límite visual
// de un componente. El matiz que decide todo, y que es suyo:
//
//   >>> No es que las superficies no lleven contorno — es que el contorno que llevan no se ve. <<<
//
// Por eso este ticket **sube el valor y no reescribe la norma**: la Regla Plano-por-Defecto de
// DESIGN.md (el borde hace el trabajo, la sombra responde a estado) estaba bien. El token no.
//
// ── 🔴 POR QUÉ ESTE GUARD VIGILA TOKENS Y NO SUPERFICIES ───────────────────────────────────
//
// La pregunta natural sería «¿tiene contorno cada superficie?». **No se puede contestar con un
// guard**, y no por pereza: lo midió S5. Depende del anidamiento del DOM, y **42 ficheros de
// `public/dashboard/js/` construyen su marcado con `innerHTML` en ejecución**. Un guard que lo
// adivinara le daría rojo a la cabecera de un modal, que no necesita contorno porque ya está
// dentro de una superficie contorneada.
//
//   >>> El contraste de un TOKEN es un número y no depende del DOM. Eso sí se vigila. <<<
//
// Lo que este guard NO cubre queda dicho, no escondido: **no sabe si una superficie concreta usa
// el token**. Un `border: 1px solid #ddd` escrito a pelo se le escapa. Vigila que el valor
// compartido sea visible, no que todos lo usen.
// ═══════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  TOKENS, UMBRAL_NO_TEXTUAL, PARES, contraste, tokensDeColor, bloquesDeTema, censar, linea, lineaDeReparto,
} from '../scripts/_contraste-de-tokens.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** El valor con el que `--border` nació y que NO se veía. Es la sonda del control rojo. */
const EL_QUE_NO_SE_VEIA = '#e7e9e5';

/** El valor en el que `--input-border` se quedaba cuando `--border` subio: la jerarquia invertida. */
const EL_CAMPO_QUE_SE_QUEDABA_ATRAS = '#cdd2cb';

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // Devolver el token a su valor invisible: el guard tiene que cazarlo.
    fichero: 'public/tokens.css',
    de: '  --border: #8d8f8b;',
    a: '  --border: #e7e9e5;',
    cae: 'SCRUM-691 · 🔴 todo par declarado llega a 3,00 de contraste',
  },
  {
    // Dejar el campo donde estaba: es la jerarquía invertida, no un incumplimiento cualquiera.
    fichero: 'public/tokens.css',
    de: '  --input-border: #797e77;',
    a: '  --input-border: #cdd2cb;',
    cae: 'SCRUM-691c · 🔴 el borde del CAMPO se ve MÁS que el de su tarjeta, y no al revés',
  },
];

// ═══ PATA 1 · 🔴 ROJO REAL: con el valor de hoy, el guard salta ══════════════════════════════

test('SCRUM-691 · 🔴 ROJO REAL: con el `--border` que no se veía, el guard SALTA', () => {
  const css = fs.readFileSync(path.join(RAIZ, TOKENS), 'utf8');
  const tokens = tokensDeColor(css);
  const bg = tokens.get('--bg');
  const surface = tokens.get('--surface');
  assert.ok(bg && surface, '🔴 no se leen `--bg` ni `--surface`: el control no puede medir.');

  // El valor viejo, contra los dos fondos. Los dos tienen que quedar POR DEBAJO del umbral.
  const viejoVsBg = contraste(EL_QUE_NO_SE_VEIA, bg);
  const viejoVsSurface = contraste(EL_QUE_NO_SE_VEIA, surface);
  assert.ok(viejoVsBg < UMBRAL_NO_TEXTUAL,
    `🔴 EL CONTROL ROJO NO ES ROJO: el valor viejo da ${viejoVsBg.toFixed(2)} sobre \`--bg\` y el `
    + `umbral es ${UMBRAL_NO_TEXTUAL}. Si el viejo ya cumplía, este guard no mide lo que dice.`);
  assert.ok(viejoVsSurface < UMBRAL_NO_TEXTUAL,
    `🔴 el valor viejo da ${viejoVsSurface.toFixed(2)} sobre \`--surface\`, que ya cumple.`);

  // Y el que aprieta es `--bg`, COMPROBADO y no supuesto. Si dejara de serlo, el valor elegido
  // podría cumplir contra el fondo equivocado y este guard lo daría por bueno.
  assert.ok(viejoVsBg < viejoVsSurface,
    '🔴 HA DEJADO DE APRETAR `--bg`. El valor de `--border` se eligió como el primero que cumple '
    + 'contra el lienzo, por ser el más oscuro de los dos fondos. Si `--surface` pasa a ser el '
    + 'exigente, hay que volver a elegir el valor, no dar por bueno el de ahora.');
});

// ═══ PATA 2 · ✅ VERDE REAL: con el valor nuevo NO salta ═════════════════════════════════════

test('SCRUM-691 · ✅ VERDE REAL: el valor de hoy cumple los DOS pares, no uno', () => {
  const c = censar(RAIZ);
  assert.deepEqual(c.noMedibles, [],
    `🔴 hay pares que no se pueden medir: ${c.noMedibles.map((f) => `${f.de} vs ${f.contra}`).join(', ')}. `
    + 'Un par sin medida no es un par que cumpla.');
  for (const f of c.filas) {
    assert.ok(f.razon >= UMBRAL_NO_TEXTUAL,
      `🔴 \`${f.de}\` (${f.valorDe}) da ${f.razon.toFixed(2)} sobre \`${f.contra}\` (${f.valorContra}) `
      + `y el umbral es ${UMBRAL_NO_TEXTUAL}. Cumplir contra un fondo y no contra el otro es medio `
      + 'arreglo con nombre de arreglo entero.');
  }
});

// ═══ PATA 3 · 🔴 SUELO: sin tokens de color, CIEGO ══════════════════════════════════════════

test('SCRUM-691 · 🔴 SUELO: sin tokens de color aborta CIEGO, no informa «0 incumplimientos»', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum691-'));
  try {
    fs.mkdirSync(path.join(dir, 'public'), { recursive: true });
    // Una hoja con tokens que NO son color: radios y sombras. Cero colores.
    fs.writeFileSync(path.join(dir, TOKENS),
      ':root {\n  --r-md: 12px;\n  --shadow-sm: 0 1px 2px rgba(16,24,40,.04);\n}\n');
    const c = censar(dir);
    assert.equal(c.tokensDeColor, 0, '🔴 inventa tokens de color donde no los hay.');
    assert.equal(c.noMedibles.length, PARES.length,
      `🔴 con CERO tokens de color, los ${PARES.length} pares tendrían que salir NO MEDIBLES, y `
      + `salen ${c.noMedibles.length}. «0 incumplimientos» y «no he podido medir» se leen igual, y `
      + 'una de las dos lecturas es falsa.');
    assert.deepEqual(c.incumplen, [],
      '🔴 acusa de incumplir a un par que ni siquiera ha podido medir.');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ═══ PATA 4 · 🔴 MUTACIÓN, y se comprueba que MUTÓ ══════════════════════════════════════════

test('SCRUM-691 · 🔴 MUTACIÓN: devolver el token a su valor invisible, y ENTRA', () => {
  const fuente = fs.readFileSync(path.join(RAIZ, TOKENS), 'utf8');
  const DE = '  --border: #8d8f8b;';
  const veces = fuente.split(DE).length - 1;
  assert.equal(veces, 1,
    `🔴 LA MUTACIÓN NO PUEDE ENTRAR: el ancla «${DE}» aparece ${veces} veces y debe aparecer `
    + 'exactamente 1. Una mutación que no entra y un guard que no detecta dan la misma salida.');
  const mutado = fuente.replace(DE, `  --border: ${EL_QUE_NO_SE_VEIA};`);
  assert.notEqual(mutado, fuente, '🔴 la sustitución no ha cambiado el texto: no ha mutado nada.');

  // Y el censo, leído del texto mutado, tiene que ACUSAR.
  const tokens = tokensDeColor(mutado);
  assert.equal(tokens.get('--border'), EL_QUE_NO_SE_VEIA,
    '🔴 el texto mutó pero el lector sigue viendo el valor viejo: no está leyendo esa declaración.');
  // ⚠️ SE CUENTAN LOS PARES DE ESE TOKEN, NO TODOS, y el matiz lo cazó la fase c: al añadir los dos
  // pares de `--input-border` esta pata empezó a fallar exigiendo que cayeran los cuatro. No caen,
  // y no deben: mutar `--border` no tiene por qué tumbar al campo. Un control que exige de más
  // acaba relajándose entero; uno que dice exactamente qué debe caer sobrevive a que crezca el
  // censo.
  const suyos = PARES.filter((p) => p.de === '--border');
  const incumplen = suyos.filter((p) => contraste(tokens.get(p.de), tokens.get(p.contra)) < UMBRAL_NO_TEXTUAL);
  assert.equal(incumplen.length, suyos.length,
    `🔴 CON EL TOKEN DEVUELTO A SU VALOR INVISIBLE, el guard sólo acusa ${incumplen.length} de `
    + `${suyos.length} pares de \`--border\`. Entonces no está mirando la propiedad que dice mirar.`);
  // Y los del campo NO se tocan: si cayeran, esta mutación estaría moviendo algo que no muta.
  const delCampo = PARES.filter((p) => p.de === '--input-border')
    .filter((p) => contraste(tokens.get(p.de), tokens.get(p.contra)) < UMBRAL_NO_TEXTUAL);
  assert.deepEqual(delCampo, [],
    '🔴 mutar `--border` ha tumbado también los pares de `--input-border`: la mutación no está '
    + 'aislada y su rojo no prueba nada sobre el token que dice mutar.');
});

// ═══ FASE c · 🔴 LA JERARQUÍA, COMO NÚMERO Y NO COMO COMENTARIO ══════════════════════════════

test('SCRUM-691c · 🔴 el borde del CAMPO se ve MÁS que el de su tarjeta, y no al revés', () => {
  const c = censar(RAIZ);
  assert.ok(c.jerarquia.length > 0,
    '🔴 CIEGO: no hay ninguna relación de jerarquía declarada. Sin ella, dos tokens pueden '
    + 'invertirse sin que nada lo note — que es exactamente lo que pasó al subir `--border`.');
  for (const j of c.jerarquia) {
    assert.ok(j.cumple === true,
      `🔴 JERARQUÍA INVERTIDA sobre \`${j.fondo}\`: \`${j.mas}\` da ${j.razonMas?.toFixed(2)} y `
      + `\`${j.que}\` da ${j.razonQue?.toFixed(2)}. La hoja declara el primero como «mas visible», `
      + `y ${j.porque}. Un contorno de campo más flojo que el de la tarjeta que lo contiene se lee `
      + 'al revés de lo que promete su propio comentario.');
  }
});

test('SCRUM-691c · 🔴 CONTROL: la jerarquía se INVIERTE si el campo se queda en el valor de ayer', () => {
  const fuente = fs.readFileSync(path.join(RAIZ, TOKENS), 'utf8');
  const DE = '  --input-border: #797e77;';
  const veces = fuente.split(DE).length - 1;
  assert.equal(veces, 1,
    `🔴 LA MUTACIÓN NO PUEDE ENTRAR: el ancla «${DE}» aparece ${veces} veces y debe aparecer 1.`);
  const mutado = fuente.replace(DE, `  --input-border: ${EL_CAMPO_QUE_SE_QUEDABA_ATRAS};`);
  assert.notEqual(mutado, fuente, '🔴 la sustitución no ha cambiado el texto: no ha mutado nada.');

  const tokens = tokensDeColor(mutado);
  assert.equal(tokens.get('--input-border'), EL_CAMPO_QUE_SE_QUEDABA_ATRAS,
    '🔴 el texto mutó pero el lector sigue viendo el valor nuevo: no lee esa declaración.');

  // Con el valor de ayer, el campo queda POR DEBAJO de la tarjeta: la inversión que motivó la fase.
  for (const fondo of ['--bg', '--surface']) {
    const campo = contraste(tokens.get('--input-border'), tokens.get(fondo));
    const tarjeta = contraste(tokens.get('--border'), tokens.get(fondo));
    assert.ok(campo < tarjeta,
      `🔴 EL CONTROL NO ES CONTROL: con el valor de ayer (${EL_CAMPO_QUE_SE_QUEDABA_ATRAS}) el campo `
      + `da ${campo.toFixed(2)} sobre \`${fondo}\` y la tarjeta ${tarjeta.toFixed(2)}, o sea que NO `
      + 'se invierte. Entonces esta pata no prueba lo que dice probar.');
    assert.ok(campo < UMBRAL_NO_TEXTUAL,
      `🔴 y además ya cumplía el umbral (${campo.toFixed(2)}): la fase c no haría falta.`);
  }
});

// ═══ FASE c · 🔴 EL REPARTO: a cuántos tokens APLICA 1.4.11 ══════════════════════════════════

test('SCRUM-691c · 🔴 el censo DECLARA a cuántos tokens aplica 1.4.11, y a cuántos no sabe', (t) => {
  const c = censar(RAIZ);
  t.diagnostic(lineaDeReparto(c));
  for (const x of [...c.clases].sort((a, b) => a.clase.localeCompare(b.clase))) {
    t.diagnostic(`  ${x.clase.padEnd(15)} ${x.token.padEnd(17)} usos:${String(x.usos).padStart(3)} · ${x.motivo}`);
  }

  // 🔴 SUELO del reparto: si nada se clasifica, el reparto no dice nada.
  assert.equal(c.clases.length, c.aplica.length + c.noAplica.length + c.noClasificados.length,
    '🔴 las clases no suman: el reparto pierde tokens.');
  assert.ok(c.aplica.length > 0,
    '🔴 CIEGO: a NINGÚN token le aplicaría 1.4.11, y la hoja tiene dos tokens de borde. El criterio '
    + 'se deriva del uso en las hojas: si no ve ningún `border`, no está leyendo las hojas.');

  // 🔴 Y los DOS que este guard vigila tienen que estar entre los que APLICAN. Si uno saliera de
  // ahí, el guard estaría vigilando un token al que ya no le corresponde el criterio.
  for (const tk of ['--border', '--input-border']) {
    assert.ok(c.aplica.some((x) => x.token === tk),
      `🔴 \`${tk}\` ya no se clasifica como límite visual, y sin embargo se le sigue exigiendo `
      + '3,00. O dejó de pintarse en un borde, o el criterio dejó de verlo.');
  }
});

// ═══ EL GUARD DEL ÁRBOL REAL, con su población declarada ════════════════════════════════════

test('SCRUM-691 · 🔴 todo par declarado llega a 3,00 de contraste', (t) => {
  const c = censar(RAIZ);
  t.diagnostic(linea(c));
  for (const f of c.filas) {
    t.diagnostic(`  ${f.de} (${f.valorDe}) vs ${f.contra} (${f.valorContra}) = `
      + `${f.razon === null ? 'NO MEDIBLE' : f.razon.toFixed(2)} · ${f.porque}`);
  }

  // 🔴 SUELO: cero tokens de color es ceguera, no salud.
  assert.ok(c.tokensDeColor > 0,
    '🔴 CIEGO: no se ha encontrado NINGÚN token de color en la hoja. «0 incumplimientos» y «no he '
    + 'mirado» se leen igual.');

  // 🔴 Y EL MODO OSCURO. Hoy no existe —medido el 17-sep-2026: cero `prefers-color-scheme`, cero
  // `data-theme`, cero `color-scheme` en todo `public/`—. El día que alguien lo añada, este guard
  // seguiría midiendo sólo `:root` y daría verde sobre la mitad del producto. Así que no calla:
  // si aparece un tema, el veredicto NO se emite hasta que se le enseñe a medirlo.
  assert.equal(c.temasExtra, 0,
    `🔴 HAY ${c.temasExtra} bloque(s) de tema alternativo en la hoja y este guard sólo mide el de `
    + 'base. Un token que cumple en claro y no en oscuro es medio arreglo con nombre de arreglo '
    + 'entero. Enséñale a medir el otro tema antes de volver a fiarte de este verde.');

  const malos = [...c.incumplen, ...c.noMedibles];
  assert.deepEqual(malos.map((f) => `${f.de} vs ${f.contra}`), [],
    `🔴 HAY PARES POR DEBAJO DE ${UMBRAL_NO_TEXTUAL.toFixed(2)}:\n    `
    + malos.map((f) => `${f.de} (${f.valorDe}) vs ${f.contra} (${f.valorContra}) = `
      + `${f.razon === null ? 'NO MEDIBLE' : f.razon.toFixed(2)} — ${f.porque}`).join('\n    ')
    + '\n\n  WCAG 1.4.11 pide 3,00 para el límite visual de un componente, y un contorno de 1px\n'
    + '  que separa una tarjeta de su lienzo es exactamente eso.\n\n'
    + '  🔴 SE ARREGLA SUBIENDO EL TOKEN, NO BAJANDO ESTE UMBRAL (regla 41). Y el fondo que\n'
    + '  aprieta es el más OSCURO de los dos: un valor elegido contra `--surface` se queda\n'
    + '  corto contra `--bg`.');
});
