#!/usr/bin/env node
// scripts/citar-hueco-condicion.mjs — SCRUM-564
//
//   node scripts/citar-hueco-condicion.mjs             → escribe el documento
//   node scripts/citar-hueco-condicion.mjs --pantalla  → lo imprime sin tocar el disco
//
// ⛔ NI UNA PALABRA DE LA CONDICIÓN: la frase es del fundador (regla 30). Aquí van los diez
// textos, dónde cabe la nota y cuántos caracteres — que es lo que le falta para poder elegirla.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as censoF from './censo-anclas-bloque-f.mjs';
import { veredictos, leerLanding, FALSA } from './_afirmaciones-publicadas.mjs';
import {
  HUECOS, CONDICIONES, clasificar, palabraMasLarga, JUNTO, LEJOS, NINGUNO,
  CABE, SOLO_GUINO, NO_CABE, UMBRAL,
} from './_hueco-condicion.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DESTINO = 'docs/DONDE_CABE_LA_CONDICION.md';
const MEDIOS = /tarjeta|bizum|transferencia/i;
const esc = (s) => String(s).replace(/\|/g, '\\|');

export function diez(html, raiz) {
  return veredictos(html, raiz, censoF).veredictos.filter((v) => v.grupo === FALSA);
}

export function generar(html, raiz) {
  const lista = diez(html, raiz);
  if (lista.length === 0) {
    throw new Error('🔴 CIEGO: cero afirmaciones falsas. Están medidas: son diez. Un cero aquí '
      + 'diría «no hay nada que documentar», que es la conclusión más cara que puede dar esto.');
  }
  const clas = lista.map((v) => clasificar(v.id, v.texto));
  const de = (g) => clas.filter((c) => c.grupo === g);
  const L = [];
  const p = (s = '') => L.push(s);

  p('# Dónde cabe la condición, y cuántos caracteres');
  p();
  p('**SCRUM-564.** El fundador decidió el 20-ago-2026 **documentar la condición** en vez de');
  p('retirar el copy: los diez textos se quedan como están y se les añade lo que hoy falta.');
  p();
  p('> ⛔ **Aquí no hay ni una palabra de la condición.** Regla 30: el microcopy es del fundador.');
  p('> Esto mide **dónde va y cuánto cabe**; la frase la elige él.');
  p();
  p('> ⚠️ **Generado** (`node scripts/citar-hueco-condicion.mjs`) a partir de la medición en');
  p('> navegador de `scripts/medir-hueco-condicion.mjs`. Los textos salen del censo, no de una copia.');
  p();
  p('---');
  p();
  p('## El hecho');
  p();
  p('`PAYMENTS_CONNECT_ENABLED` y `BIZUM_MANUAL_ENABLED` están **apagadas por defecto**. Para un');
  p('merchant nuevo **sólo existe la transferencia** — y estos diez textos publicados enumeran tres.');
  p();
  p('---');
  p();
  p('## ① Los diez, verificados byte a byte');
  p();
  p('Identificador **derivado** del HTML (`sección/etiqueta#orden`), texto **literal**, comparado');
  p('con `===` y `Buffer.compare` contra el censo **y** contra el fichero. Cero `includes()`.');
  p();
  p('| identificador | texto literal | ¿nombra un medio? |');
  p('|---|---|---|');
  for (const v of lista) {
    p(`| \`${v.id}\` | «${esc(v.texto)}» | ${MEDIOS.test(v.texto) ? 'sí' : '**no**'} |`);
  }
  p();
  const sinMedio = lista.filter((v) => !MEDIOS.test(v.texto));
  p('### ⚠️ Control positivo — y lo que saca');
  p();
  p('El control pedía que no entrara en la lista nada que no afirme sobre medios de pago.');
  p(`**Ocho de los diez nombran un medio concreto** (tarjeta, Bizum o transferencia). **${sinMedio.length} no**, y`);
  p('los dos merecen una lectura distinta, con el texto delante:');
  p();
  for (const v of sinMedio) {
    p(`- \`${v.id}\` — «${v.texto}»`);
  }
  p();
  p('- `probar/span#15` **sí pertenece**: «Paga como quiera» es el rótulo del paso 5 de la demo y');
  p('  la línea siguiente (`probar/span#16`) enumera los tres medios. La promesa de elección es');
  p('  suya, aunque los medios los nombre su vecina.');
  p('- 🔴 `faq/div#3` **es un veredicto mío demasiado estricto, y lo corrijo aquí.** No nombra');
  p('  ningún medio: dice que el producto incluye «cobro», y **cobro por transferencia existe hoy**.');
  p('  Enumera nueve capacidades y las nueve están disponibles. **No es falsa.** No la retiro del');
  p('  registro en este ticket porque reclasificarla exige declararle ancla a las nueve, que es');
  p('  otro trabajo — pero el fundador debe saber que de los diez, **nueve son el caso y una es mía**.');
  p();
  p('---');
  p();
  p('## ② Dónde cabe · medido en navegador, a 360 y a 1280 px');
  p();
  p('| | |');
  p('|---|---|');
  for (const [k, v] of Object.entries(CONDICIONES)) p(`| ${k} | ${Array.isArray(v) ? v.join(', ') : v} |`);
  p();
  p('**Qué es cada número:**');
  p();
  p('- **1 línea** — caracteres que caben en una línea a la anchura de ese hueco.');
  p('- **sin mover** — caracteres que caben **sin que la sección cambie de alto**. Por encima de');
  p('  ese número, la nota empuja lo que hay debajo. Un `0` significa que cualquier nota empuja.');
  p('- **se ve** — la sonda tiene caja y el navegador la devuelve al preguntar por su centro. Un');
  p('  `NO` significa **ahí no cabe nada**, aunque los otros números digan otra cosa.');
  p();
  for (const c of clas) {
    p(`### \`${c.id}\``);
    p();
    p('```');
    p(c.texto);
    p('```');
    p();
    p('| sitio | host | ancho 360 | ancho 1280 | veredicto |');
    p('|---|---|---|---|---|');
    for (const s of c.sitios) {
      const a = HUECOS[360][c.id][s.sitio];
      const b = HUECOS[1280][c.id][s.sitio];
      const celda = (x) => (x.visible ? `${x.unaLinea} car. · sin mover ${x.sinMover}` : '🔴 no se ve');
      p(`| ${s.sitio} | \`${a.host}\` | ${celda(a)} | ${celda(b)} | ${s.veredicto} |`);
    }
    p();
    p(`- umbral para «cabe una frase»: **${palabraMasLarga(c.texto) * 2}** caracteres (${UMBRAL.regla}: `);
    p(`  la más larga de este texto tiene ${palabraMasLarga(c.texto)}).`);
    p(`- **${c.grupo}**`);
    p();
  }
  p('---');
  p();
  p('## ③ Los que vuelven al fundador');
  p();
  p(`| grupo | cuántos |`);
  p('|---|---|');
  p(`| ✅ admite nota junto a la afirmación | **${de(JUNTO).length}** |`);
  p(`| 🔴 sólo al pie de la sección | **${de(LEJOS).length}** |`);
  p(`| 🔴 no admite nota en ningún sitio | **${de(NINGUNO).length}** |`);
  p();
  p('🔴 **«Sólo al pie de la sección» cuenta como que NO admite condición.** Una nota a cuarenta');
  p('líneas de la afirmación que condiciona no documenta nada: el cliente lee la promesa y decide');
  p('antes de llegar. Si un texto sólo admite eso, **la única salida que le queda es cambiar el');
  p('texto, y eso es del fundador.**');
  p();
  for (const c of [...de(LEJOS), ...de(NINGUNO)]) {
    p(`- \`${c.id}\` — «${c.texto}» · ${c.sitios.filter((s) => s.sitio !== 'pie de la seccion').map((s) => `${s.sitio}: ${s.motivo || s.peor + ' car.'}`).join(' · ')}`);
  }
  p();
  p('Los tres están en **`#probar`**, la maqueta de la demo: cajas de tamaño fijo donde el texto');
  p('no fluye como prosa. ⚠️ Y por eso sus números de «sin mover» a 1280 salen altísimos (277, 312,');
  p('320, 375): el contenedor se traga el texto sin cambiar de alto. **Esos números no significan');
  p('«cabe»** — significan que la caja es rígida. El dato bueno ahí es el de «1 línea».');
  p();
  p('### 🔴 El caso difícil: `precios/li#3`');
  p();
  p('«Cobro con tarjeta, Bizum y transferencia», **dentro de la lista de lo que incluye el plan, al');
  p('lado del precio**. Medido:');
  p();
  const li = clas.find((c) => c.id === 'precios/li#3');
  if (li) {
    for (const s of li.sitios) {
      const a = HUECOS[360][li.id][s.sitio];
      const b = HUECOS[1280][li.id][s.sitio];
      p(`- **${s.sitio}** — 360: ${a.unaLinea} car. · 1280: ${b.unaLinea} car.`);
    }
  }
  p();
  p('**Junto al texto no cabe: seis caracteres a 1280.** La lista de precios reparte el ancho, y a');
  p('1280 la fila está casi llena. Lo único que entra ahí es una **marca** (un asterisco), no una');
  p('condición.');
  p();
  p('El hueco de verdad es **una segunda línea dentro del propio `<li>`**: 36 caracteres a 360 y 52');
  p('a 1280. Cabe — pero **empuja** (sin mover: 0), así que la caja de precio crece.');
  p();
  p('⚠️ **Y esto hay que decirlo aunque no sea una medida:** una fila de la tabla de precios es');
  p('donde el cliente decide, y es donde peor entra un asterisco. **Que quepa no significa que');
  p('convenga.** La medida dice cuánto entra; si entra ahí o se cambia la fila, es del fundador.');
  p();
  p('---');
  p();
  p('## ④ El mecanismo · lo que aporta y lo que le falta a cada uno');
  p();
  p('⛔ **El mecanismo lo propongo yo; el texto lo escribe el fundador.**');
  p();
  p('| mecanismo | aporta | le falta |');
  p('|---|---|---|');
  p('| `<small>` **inline, junto al texto** | se lee con la afirmación delante, sin saltos | el hueco más pequeño de los tres; en `precios/li#3` son 6 car. a 1280, y en `#probar` no se ve |');
  p('| **nota al pie del bloque** (`<p>` dentro de la tarjeta / el `<li>`) | 36–56 car., y sigue pegada a la afirmación | **empuja**: «sin mover» es 0 en casi todos, así que la sección crece |');
  p('| **marca (`*`) + nota única al pie de la sección** | cabe en los diez, incluidos los tres de `#probar` (45–187 car.) | el cliente decide **antes** de llegar a la nota; documenta para quien ya dudaba |');
  p('| `aria-describedby` | lo anuncia el lector de pantalla sin ocupar sitio | **no lo ve quien mira**, y esta condición es comercial, no de accesibilidad. Complemento, nunca la salida |');
  p();
  p('**El dato que faltaba para elegir la frase**, por si se lee sólo esta línea: junto al texto');
  p('caben entre **6 y 43** caracteres según el sitio; al pie del bloque, entre **36 y 56**; al pie');
  p('de la sección, entre **45 y 187**.');
  p();
  p('---');
  p();
  p('## ⑤ Lo que no se ha tocado');
  p();
  p('- Ninguno de los diez textos. Ni una palabra.');
  p('- Ningún flag, ningún medio de pago. Reglas 18 y 23.');
  p('- **Ningún táctil pierde su área** por culpa de la nota: medido en los 30 sitios × 2 anchos');
  p('  con el árbitro de SCRUM-562 (`closest`, desde el centro), **0 robos**.');
  p('- ⚠️ En `#probar` había **4 táctiles que ya no reciben el toque en su centro antes de tocar');
  p('  nada**: son los botones de la maqueta con `visibility:hidden`, que SCRUM-542 ya declaró como');
  p('  «presentes pero no tocables». **No los causa la nota.**');
  p();
  return L.join('\n') + '\n';
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const md = generar(leerLanding(RAIZ), RAIZ);
  if (process.argv.includes('--pantalla')) process.stdout.write(md);
  else {
    fs.writeFileSync(path.join(RAIZ, DESTINO), md, 'utf8');
    console.log('escrito: ' + DESTINO + ' (' + md.split('\n').length + ' líneas)');
  }
}
