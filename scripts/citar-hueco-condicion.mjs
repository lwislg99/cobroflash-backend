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
    throw new Error('🔴 CIEGO: cero afirmaciones falsas. Estaban medidas: eran diez el 21-ago-2026 '
      + '(SCRUM-1086 retiró ocho el 23-sep-2026). Un cero aquí diría «no hay nada que documentar», '
      + 'que es la conclusión más cara que puede dar esto.');
  }
  const clas = lista.map((v) => clasificar(v.id, v.texto));
  const de = (g) => clas.filter((c) => c.grupo === g);
  const L = [];
  const p = (s = '') => L.push(s);

  p('# Dónde cabría la condición, y cuántos caracteres — ARCHIVO');
  p();
  p('**SCRUM-564**, archivado por **SCRUM-568**.');
  p();
  p('> 🔴 **LA DECISIÓN CAMBIÓ, Y ESTA MEDIDA ES LA QUE LA CAMBIÓ.** El 20-ago-2026, después de');
  p('> leerla, el fundador decidió **no documentar la condición**: los tres medios se quedan');
  p('> enunciados como están. *«Cuando hagamos el go para empezar a vender, todo será verdad. De');
  p('> momento no pasa nada.»*');
  p('>');
  p('> ⛔ **No se escribe ninguna nota.** Lo que sostiene esa decisión es el mecanismo de');
  p('> **SCRUM-568** —las afirmaciones ancladas con `tras`, cuyo veredicto cambia solo cuando los');
  p('> flags se enciendan—, no una advertencia al visitante.');
  p('>');
  p('> **Entonces ¿por qué sigue esto aquí?** Porque la medida costó dos intentos y tres trampas,');
  p('> y el día que haga falta una nota —si el go llega antes que los flags— el dato ya estará.');
  p('> **Es un archivo, no un plan: hoy no hay que hacer nada con estos números.**');
  p();
  p('> ⚠️ **SCRUM-1086 (23-sep-2026) retiró ocho de los diez textos originales** de `#como`,');
  p('> `#precios` y `#probar` (regla 24). Quedan los dos de abajo, sin tocar el mecanismo ni la');
  p('> decisión — sólo la superficie que medía se ha encogido.');
  p();
  p('> ⛔ **Aquí no hay ni una palabra de la condición.** Regla 30: el microcopy es del fundador.');
  p('> Esto mide **dónde cabría y cuánto**; la frase, si algún día hace falta, la elige él.');
  p();
  p('> ⚠️ **Generado** (`node scripts/citar-hueco-condicion.mjs`) a partir de la medición en');
  p('> navegador de `scripts/medir-hueco-condicion.mjs`. Los textos salen del censo, no de una copia.');
  p();
  p('---');
  p();
  p('## El hecho');
  p();
  p('`PAYMENTS_CONNECT_ENABLED` y `BIZUM_MANUAL_ENABLED` están **apagadas por defecto**. Para un');
  p(`merchant nuevo **sólo existe la transferencia** — y estos ${lista.length} textos publicados quedan sin verificar (uno enumera medios; el detalle, abajo).`);
  p();
  p('---');
  p();
  p(`## ① Los ${lista.length}, verificados byte a byte`);
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
  const verbo = lista.length - sinMedio.length === 1 ? 'nombra' : 'nombran';
  p(`**${lista.length - sinMedio.length} de los ${lista.length} ${verbo} un medio concreto** (tarjeta, Bizum o transferencia). **${sinMedio.length} no**, y`);
  p(sinMedio.length === 1 ? 'se lee aparte, con el texto delante:' : 'se leen aparte, con el texto delante:');
  p();
  for (const v of sinMedio) {
    p(`- \`${v.id}\` — «${v.texto}»`);
  }
  p();
  if (sinMedio.some((v) => v.id === 'faq/div#3')) {
    p('- 🔴 `faq/div#3` **es un veredicto mío demasiado estricto, y lo corrijo aquí.** No nombra');
    p('  ningún medio: dice que el producto incluye «cobro», y **cobro por transferencia existe hoy**.');
    p('  SCRUM-1086 ya quitó «cobro» de la enumeración; lo que queda son ocho capacidades y las ocho');
    p('  están disponibles. **No es falsa.** No la retiro del registro en este ticket porque');
    p('  reclasificarla exige declararle ancla a las ocho, que es otro trabajo.');
    p();
  }
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
  const vuelven = [...de(LEJOS), ...de(NINGUNO)];
  for (const c of vuelven) {
    p(`- \`${c.id}\` — «${c.texto}» · ${c.sitios.filter((s) => s.sitio !== 'pie de la seccion').map((s) => `${s.sitio}: ${s.motivo || s.peor + ' car.'}`).join(' · ')}`);
  }
  if (vuelven.length === 0) {
    p(`Ninguno hoy: los ${de(JUNTO).length} que quedan admiten nota junto al texto (tabla del punto ②).`);
  }
  p();
  p('---');
  p();
  p('## ④ El mecanismo · lo que aporta y lo que le falta a cada uno');
  p();
  p('⛔ **El mecanismo lo propongo yo; el texto lo escribe el fundador.**');
  p();
  p('| mecanismo | aporta | le falta |');
  p('|---|---|---|');
  p('| `<small>` **inline, junto al texto** | se lee con la afirmación delante, sin saltos | el hueco más pequeño de los tres |');
  p('| **nota al pie del bloque** (`<p>`/`<li>` que la contiene) | más caracteres, y sigue pegada a la afirmación | **empuja**: «sin mover» suele ser 0, así que la sección crece |');
  p('| **marca (`*`) + nota única al pie de la sección** | cabe en todos los casos medidos | el cliente decide **antes** de llegar a la nota; documenta para quien ya dudaba |');
  p('| `aria-describedby` | lo anuncia el lector de pantalla sin ocupar sitio | **no lo ve quien mira**, y esta condición es comercial, no de accesibilidad. Complemento, nunca la salida |');
  p();
  const rangos = { 'junto al texto': [], 'pie del bloque': [], 'pie de la seccion': [] };
  for (const c of clas) {
    for (const s of c.sitios) {
      for (const ancho of [360, 1280]) {
        const d = HUECOS[ancho][c.id][s.sitio];
        if (d && d.visible) rangos[s.sitio].push(d.unaLinea);
      }
    }
  }
  const rango = (xs) => (xs.length ? `${Math.min(...xs)} y ${Math.max(...xs)}` : 'sin dato');
  p('**El dato que faltaba para elegir la frase**, por si se lee sólo esta línea: junto al texto');
  p(`caben entre **${rango(rangos['junto al texto'])}** caracteres según el sitio; al pie del bloque, entre`);
  p(`**${rango(rangos['pie del bloque'])}**; al pie de la sección, entre **${rango(rangos['pie de la seccion'])}**.`);
  p();
  p('---');
  p();
  p('## ⑤ Lo que no se ha tocado');
  p();
  p('- Este archivo no escribe ninguna nota: mide, no corrige (regla 30, arriba).');
  p('- Ningún flag, ningún medio de pago. Reglas 18 y 23.');
  p('- ⚠️ El «0 robos» de táctiles y los «30 sitios × 2 anchos» medidos el 21-ago-2026 eran sobre');
  p('  los diez originales, ocho de ellos en `#como`/`#precios`/`#probar` — retirados por');
  p('  SCRUM-1086. Sobre los dos que quedan no hay una medida de táctiles nueva: ninguno de los');
  p('  dos es un elemento pulsable.');
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
