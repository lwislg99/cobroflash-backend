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
  TOKENS, UMBRAL_NO_TEXTUAL, PARES, contraste, tokensDeColor, bloquesDeTema, censar, linea,
} from '../scripts/_contraste-de-tokens.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** El valor con el que `--border` nació y que NO se veía. Es la sonda del control rojo. */
const EL_QUE_NO_SE_VEIA = '#e7e9e5';

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // Devolver el token a su valor invisible: el guard tiene que cazarlo.
    fichero: 'public/tokens.css',
    de: '  --border: #8d8f8b;',
    a: '  --border: #e7e9e5;',
    cae: 'SCRUM-691 · 🔴 todo par declarado llega a 3,00 de contraste',
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
  const incumplen = PARES.filter((p) => contraste(tokens.get(p.de), tokens.get(p.contra)) < UMBRAL_NO_TEXTUAL);
  assert.equal(incumplen.length, PARES.length,
    `🔴 CON EL TOKEN DEVUELTO A SU VALOR INVISIBLE, el guard sólo acusa ${incumplen.length} de `
    + `${PARES.length} pares. Entonces no está mirando la propiedad que dice mirar.`);
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
