#!/usr/bin/env node
// scripts/citar-afirmaciones-publicadas.mjs — SCRUM-564
//
//   node scripts/citar-afirmaciones-publicadas.mjs             → escribe el documento
//   node scripts/citar-afirmaciones-publicadas.mjs --pantalla  → lo imprime sin tocar el disco
//
// Genera la cita de las 28 afirmaciones del copy publicado con su veredicto. No se escribe a
// mano: 28 textos con tildes copiados a mano caducan al día siguiente sin avisar.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as censoF from './censo-anclas-bloque-f.mjs';
import {
  veredictos, censar, leerLanding, SECCIONES_PUBLICADAS, FUERA_DE_ALCANCE,
  CON_ANCLA, ANCLA_A_DECLARAR, FALSA, DESCARTADA, SIN_DECLARAR, ANCLAS_564, DESCARTADAS,
} from './_afirmaciones-publicadas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DESTINO = 'docs/AFIRMACIONES_DEL_COPY_PUBLICADO.md';

const esc = (s) => s.replace(/\|/g, '\\|');

export function generar(html, raiz) {
  const c = censar(html);
  if (c.afirman.length === 0) {
    throw new Error('🔴 CIEGO: cero afirmaciones en el copy publicado. Están medidas: son 28. Un '
      + 'cero aquí se leería como «no hay nada que revisar», que es la conclusión más cara.');
  }
  const r = veredictos(html, raiz, censoF);
  const de = (g) => r.veredictos.filter((v) => v.grupo === g);
  const L = [];
  const p = (s = '') => L.push(s);

  p('# Las afirmaciones del copy publicado');
  p();
  p('**SCRUM-564.** De los ' + c.todas.length + ' textos de `#como`, `#todo`, `#precios`, `#probar`');
  p('y `#faq` —que SCRUM-563 midió como *ni aprobados ni marcados*—, **' + c.afirman.length + ' afirman algo del');
  p('producto**. Decisión del fundador: se revisan sólo ésos. **Los que afirman pueden ser FALSOS;');
  p('los otros ' + (c.todas.length - c.afirman.length) + ' sólo pueden ser feos.**');
  p();
  p('> ⚠️ **Generado** (`node scripts/citar-afirmaciones-publicadas.mjs`). La fuente es');
  p('> `scripts/_afirmaciones-publicadas.mjs`, que es lo que leen los tests.');
  p();
  p('> ⛔ **Este documento no corrige ni reescribe nada.** Mide y cita.');
  p();
  p('---');
  p();
  p('## El reparto');
  p();
  p('| grupo | cuántas | qué se hace |');
  p('|---|---|---|');
  p(`| ✅ verdad hoy, **con ancla viva y alcanzable** | **${de(CON_ANCLA).length}** | queda anclada y registrada |`);
  p(`| 🟡 verdad hoy, **sin ancla de código** | **${de(ANCLA_A_DECLARAR).length}** | se declara el ancla |`);
  p(`| 🔴 **falsa o no verificable** | **${de(FALSA).length}** | **esto es lo que va delante del fundador** |`);
  p(`| ⚪ descartadas (falso positivo del léxico) | **${de(DESCARTADA).length}** | no son afirmaciones |`);
  p();
  p('El veredicto **se deriva del mecanismo**, no lo escribo yo en cada entrada: el símbolo tiene');
  p('que existir (`anclaViva`, SCRUM-551) **y** un merchant nuevo tiene que llegar a él');
  p('(`alcanzabilidad`, SCRUM-558). Si la etiqueta la escribiera a mano, el día que alguien');
  p('encienda un flag seguiría diciendo lo de ayer.');
  p();
  p('---');
  p();

  // ── EL GRUPO URGENTE ────────────────────────────────────────────────────────────────────
  const falsas = de(FALSA);
  p('## 🔴 Falsa o no verificable — ' + falsas.length);
  p();
  if (falsas.length === 0) {
    p('**Ninguna. El tercer grupo está vacío.**');
  } else {
    p('**Todas por la misma puerta.** `PAYMENTS_CONNECT_ENABLED` y `BIZUM_MANUAL_ENABLED` están');
    p('**apagadas por defecto** en `src/core/flags.ts`, así que para un merchant nuevo el único');
    p('medio de cobro disponible es la **transferencia**. Es exactamente lo que hizo descartar la');
    p('fila del cobro con tarjeta en la comparativa de F5 (SCRUM-332) — reglas 18 y 23 del máster.');
    p();
    p('⚠️ Y llevan meses publicadas. **Un cambio precipitado sobre copy vivo es peor que la');
    p('afirmación**: aquí no se toca ni una palabra, se pone delante.');
    p();
    for (const v of falsas) {
      p(`### \`${v.id}\``);
      p();
      p('```');
      p(v.texto);
      p('```');
      p();
      p(`- **sección:** \`#${v.seccion}\` · **señales:** ${v.afirma.join(' + ')}`);
      p(`- **promete:** ${v.promete}`);
      p();
    }
  }
  p('---');
  p();

  // ── LOS OTROS GRUPOS ────────────────────────────────────────────────────────────────────
  p('## ✅ Verdad hoy, con ancla viva y alcanzable — ' + de(CON_ANCLA).length);
  p();
  p('| identificador | texto literal | anclas |');
  p('|---|---|---|');
  for (const v of de(CON_ANCLA)) {
    p(`| \`${v.id}\` | «${esc(v.texto)}» | ${v.anclas.map((a) => '`' + a + '`').join('<br>')} |`);
  }
  p();
  p('## 🟡 Verdad hoy, sin ancla de código — ' + de(ANCLA_A_DECLARAR).length);
  p();
  for (const v of de(ANCLA_A_DECLARAR)) {
    p(`- \`${v.id}\` — «${v.texto}» · **${v.recuento}**`);
    if (v.nota) p(`  - ${v.nota}`);
  }
  p();
  p('## ⚪ Descartadas — ' + de(DESCARTADA).length);
  p();
  p('El léxico es **suelo, no techo**: marca por palabras y se equivoca en las dos direcciones');
  p('(medido en SCRUM-555: se le escapa una de cada tres promesas del bloque F). Éstas las marca y');
  p('**no son afirmaciones del producto**. Se descartan con su motivo, revisadas con el texto');
  p('literal delante — no se toca el léxico para que dejen de aparecer.');
  p();
  for (const v of de(DESCARTADA)) {
    p(`- \`${v.id}\` — «${v.texto}»`);
    p(`  - ${v.motivo}`);
  }
  p();
  const sd = de(SIN_DECLARAR);
  if (sd.length) {
    p('## 🔴 Sin declarar — ' + sd.length);
    p();
    p('Afirmaciones publicadas que nadie ha mirado. **Una afirmación sin declarar y una verdadera');
    p('se leen igual.**');
    p();
    for (const v of sd) p(`- \`${v.id}\` — «${v.texto}»`);
    p();
  }
  p('---');
  p();
  p('## Lo que queda fuera de alcance');
  p();
  p(`**${c.todas.length - c.afirman.length} textos** de las cinco secciones. ${FUERA_DE_ALCANCE.motivo}.`);
  p();
  p('Se cuentan, no se callan: «no revisado» y «no existe» se leen igual si nadie escribe la');
  p('diferencia.');
  p();
  p('| sección | textos | de ellos afirman | fuera de alcance |');
  p('|---|---|---|---|');
  for (const id of SECCIONES_PUBLICADAS) {
    const u = c.secciones[id] || [];
    const a = u.filter((x) => x.afirma.length).length;
    p(`| \`#${id}\` | ${u.length} | ${a} | ${u.length - a} |`);
  }
  p(`| **TOTAL** | **${c.todas.length}** | **${c.afirman.length}** | **${c.todas.length - c.afirman.length}** |`);
  p();
  p('⚠️ **Por qué el extractor de aquí no es el del bloque F:** aquél mira `h1|h2|h3|p|li` y en');
  p('estas cinco secciones eso ve 37 de los textos. En `#faq` es casi ciego —las preguntas van en');
  p('`<details>/<summary>`— y **las 5 afirmaciones de `#faq` y las 9 de `#probar` caen todas');
  p('fuera**. Contar 28 y medir 12 habría sido peor que no medir, así que aquí la unidad es');
  p('**cualquier elemento que contenga texto directamente**, con el mismo esquema de');
  p('identificadores derivados.');
  p();
  return L.join('\n') + '\n';
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const html = leerLanding(RAIZ);
  const md = generar(html, RAIZ);
  if (process.argv.includes('--pantalla')) process.stdout.write(md);
  else {
    fs.writeFileSync(path.join(RAIZ, DESTINO), md, 'utf8');
    console.log('escrito: ' + DESTINO + ' (' + md.split('\n').length + ' líneas)');
  }
}
