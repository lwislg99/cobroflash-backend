#!/usr/bin/env node
// scripts/registro-de-lo-aprobado.mjs — SCRUM-563
//
//   node scripts/registro-de-lo-aprobado.mjs                 → escribe el documento legible
//   node scripts/registro-de-lo-aprobado.mjs --pantalla      → lo imprime sin tocar el disco
//   node scripts/registro-de-lo-aprobado.mjs --estado "..."  → ¿aprobado, pendiente, o ninguno?
//   node scripts/registro-de-lo-aprobado.mjs --revisar       → ¿ha caducado alguna aprobación?
//
// El documento es la VISTA. La fuente es `scripts/_registro-de-lo-aprobado.mjs`, que es lo que
// leen los tests: un documento no lo comprueba nadie.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  REGISTRO, estadoDe, revisar, reconstruir, leerLanding, DOC_PROPUESTA,
  APROBADO, PENDIENTE, NI_UNA_COSA_NI_OTRA,
} from './_registro-de-lo-aprobado.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DESTINO = 'docs/REGISTRO_DE_MICROCOPY_APROBADA.md';

export function generar(html, raiz) {
  if (REGISTRO.length === 0) {
    throw new Error('🔴 CIEGO: el registro está vacío. Son 41 textos. Un registro vacío diría '
      + '«no hay nada aprobado», que es la conclusión más cara que puede dar este fichero.');
  }
  const r = revisar(html);
  const rec = reconstruir(raiz);
  const L = [];
  const p = (s = '') => L.push(s);

  p('# Registro de microcopy APROBADA — bloque F');
  p();
  p('**SCRUM-563.** Qué texto, con qué identificador, en qué fecha y por quién. **Guarda el texto');
  p('LITERAL**, no una descripción: la pregunta que tiene que contestar es *«¿este texto de hoy es');
  p('el que se aprobó?»*, y ésa se contesta con `Buffer.compare`, no leyendo.');
  p();
  p('> ⚠️ **Generado** (`node scripts/registro-de-lo-aprobado.mjs`). La fuente es');
  p('> `scripts/_registro-de-lo-aprobado.mjs`, que es lo que leen los tests. Este documento es la');
  p('> vista para leer; **no lo edites a mano** — se regenera y perderías el cambio.');
  p();
  p('> ⛔ **Esto no aprueba nada.** Registra lo ya decidido.');
  p();
  p('---');
  p();
  p('## Estado de hoy');
  p();
  p('| | |');
  p('|---|---|');
  p(`| textos registrados como aprobados | **${r.total}** |`);
  p(`| **vigentes** (el texto de hoy es el aprobado) | **${r.vigentes.length}** |`);
  p(`| 🔴 **caducados** (alguien reescribió la frase) | **${r.caducadas.length}** |`);
  p(`| 🟠 sin anclaje (el identificador ya no existe) | **${r.sinAnclaje.length}** |`);
  p();
  if (r.caducadas.length) {
    p('### 🔴 Aprobaciones caducadas');
    p();
    for (const c of r.caducadas) {
      p(`- \`${c.id}\` — aprobado el **${c.fecha}** por ${c.quien}`);
      p(`  - se aprobó: «${c.texto}»`);
      p(`  - hoy dice: «${c.ahora}»`);
    }
    p();
  }
  p('**La aritmética, porque el encargo decía 42:** son «los 38 del esquema» + «los 4 de F7», pero');
  p('**uno de los cuatro de F7 ya está entre los 38** (`contacto-publico/h2#1` es un `<h2>`, o sea');
  p('unidad del esquema). Los otros tres viven en atributos. **38 + 3 = 41.** No falta ninguno:');
  p('sobraba un recuento.');
  p();
  p('---');
  p();
  p('## 🔴 Lo que el documento de propuesta propone y NINGUNA aprobación cubre');
  p();
  p(`Cruce con \`${DOC_PROPUESTA}\` (**${rec.doc.length}** entradas), con \`===\` y \`Buffer.compare\`:`);
  p();
  p('| | |');
  p('|---|---|');
  p(`| cubiertas exactamente por el registro | **${rec.cubierto.length}** |`);
  p(`| las mismas palabras, **partidas de otra manera** | **${rec.partidoDistinto.length}** |`);
  p(`| 🔴 **sin cubrir por ninguna aprobación** | **${rec.sinCubrir.length}** |`);
  p();
  p('### 🔴 Las que no cubre nadie');
  p();
  p('Éstas son las que hay que mirar. Ninguna es una frase larga: son **rótulos, etiquetas de');
  p('botón y cabeceras de columna** — justo lo que el esquema `h1|h2|h3|p|li` no alcanza');
  p('(SCRUM-561). Y una de ellas dice qué **es** el producto.');
  p();
  p('| nº en el documento | texto literal |');
  p('|---|---|');
  for (const d of rec.sinCubrir) p(`| \`${d.num}\` | «${d.texto.replace(/\|/g, '\\|')}» |`);
  p();
  p('### Las que están, pero partidas de otra manera');
  p();
  p('**No son aprobaciones que falten.** Las palabras están aprobadas dentro de una unidad más');
  p('larga: el documento las separó y el extractor las junta (territorio de SCRUM-553). Se listan');
  p('para que nadie las cuente dos veces ni las dé por inéditas.');
  p();
  p('| nº | texto del documento | vive dentro de |');
  p('|---|---|---|');
  for (const d of rec.partidoDistinto) {
    p(`| \`${d.num}\` | «${d.texto.replace(/\|/g, '\\|')}» | \`${d.dentroDe}\` |`);
  }
  p();
  p('---');
  p();
  p('## Los tres estados');
  p();
  p('Dado un texto cualquiera de la landing, el registro contesta una de tres cosas. **La tercera');
  p('es la que no existía**, y es la que ha hecho equivocarse tres veces en un día:');
  p();
  p(`- \`${APROBADO}\` — su texto literal está en el registro, byte a byte.`);
  p(`- \`${PENDIENTE}\` — vive dentro de una sección con marcador de pendiente. ⚠️ El marcador es de`);
  p('  la **sección**, así que alcanza a todo lo que hay dentro, no sólo a las unidades del');
  p('  esquema: por eso «Tu oficio», que es un `<span>`, sale `PENDIENTE` y no «ni una cosa ni otra».');
  p(`- \`${NI_UNA_COSA_NI_OTRA}\` — ni registrado ni dentro de una sección marcada. **La mayor`);
  p('  parte del copy PUBLICADO está aquí** (`#como`, `#todo`, `#precios`, `#probar`, `#faq`):');
  p('  nadie lo aprobó y nadie lo marcó como pendiente. No es un fallo nuevo — es que hasta hoy');
  p('  no había dónde decirlo.');
  p();
  p('```');
  p('node scripts/registro-de-lo-aprobado.mjs --estado "Seis herramientas. Una sola app."');
  p('  → NI_UNA_COSA_NI_OTRA');
  p('```');
  p();
  p('---');
  p();
  p('## Los ' + r.total + ' textos registrados');
  p();
  p('| identificador | texto literal | vía | fecha | quién |');
  p('|---|---|---|---|---|');
  for (const e of REGISTRO) {
    p(`| \`${e.id}\` | «${e.texto.replace(/\|/g, '\\|')}» | ${e.via} | ${e.fecha} | ${e.quien} |`);
  }
  p();
  return L.join('\n') + '\n';
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const html = leerLanding(RAIZ);
  const i = process.argv.indexOf('--estado');
  if (i !== -1) {
    const texto = process.argv[i + 1];
    if (!texto) { console.error('🔴 falta el texto: --estado "…"'); process.exit(2); }
    const r = estadoDe(texto, html);
    console.log(r.estado + (r.id ? ' · ' + r.id : '') + (r.seccion ? ' · #' + r.seccion : '')
      + (r.fecha ? ' · aprobado el ' + r.fecha + ' por ' + r.quien : ''));
    process.exit(0);
  }
  if (process.argv.includes('--revisar')) {
    const r = revisar(html);
    console.log(`registrados ${r.total} · vigentes ${r.vigentes.length} · caducados ${r.caducadas.length} · sin anclaje ${r.sinAnclaje.length}`);
    for (const c of r.caducadas) {
      console.log(`🔴 CADUCADA · ${c.id} — aprobado el ${c.fecha} por ${c.quien}`);
      console.log(`   se aprobó: «${c.texto}»`);
      console.log(`   hoy dice : «${c.ahora}»`);
    }
    for (const s of r.sinAnclaje) console.log(`🟠 SIN ANCLAJE · ${s.id} — el identificador ya no existe`);
    process.exit(r.caducadas.length || r.sinAnclaje.length ? 1 : 0);
  }
  const md = generar(html, RAIZ);
  if (process.argv.includes('--pantalla')) process.stdout.write(md);
  else {
    fs.writeFileSync(path.join(RAIZ, DESTINO), md, 'utf8');
    console.log('escrito: ' + DESTINO + ' (' + md.split('\n').length + ' líneas)');
  }
}
