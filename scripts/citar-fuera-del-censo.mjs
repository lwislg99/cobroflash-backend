#!/usr/bin/env node
// scripts/citar-fuera-del-censo.mjs — SCRUM-561
//
// Genera `docs/MICROCOPY_FUERA_DEL_ESQUEMA.md`: los nodos de texto de las secciones de propuesta
// que el esquema `h1|h2|h3|p|li` del censo de anclas NO alcanza, citados uno a uno con su
// identificador derivado y su texto literal.
//
//   node scripts/citar-fuera-del-censo.mjs           → escribe el documento
//   node scripts/citar-fuera-del-censo.mjs --pantalla → lo imprime sin tocar el disco
//
// El documento NO se escribe a mano: se deriva del marcado. Escribirlo a mano sería copiar
// veinte textos con tildes y flechas, y una copia a mano caduca el día siguiente sin avisar.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  citar, textosDelDocumento, enElDocumento, SECCIONES, DOC_APROBACION, IDENTIDAD, CONDICION,
} from './_citar-fuera-del-censo.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DESTINO = 'docs/MICROCOPY_FUERA_DEL_ESQUEMA.md';

const NATURALEZA_DICE = {
  GLIFO: 'símbolo, sin ninguna letra',
  ROTULO: 'rótulo de sección o cabecera de columna',
  ETIQUETA_DE_ACCION: 'lo que se lee dentro del botón o el enlace',
  PROSA: 'frase corrida',
};

export function generar(html, delDoc) {
  const r = citar(html);
  const L = [];
  const p = (s = '') => L.push(s);

  // ── SUELO ────────────────────────────────────────────────────────────────────────────────
  if (r.fuera.length === 0) {
    throw new Error('🔴 CIEGO: cero nodos fuera del esquema. Están medidos: son 20 (16 en '
      + '#heroe-f4 y #gremios, 4 en #comparativa). Un cero aquí es el instrumento roto, no una '
      + 'landing limpia — y el cero se leería como «no falta nada por aprobar».');
  }

  const conDoc = r.fuera.map((n) => ({ n, doc: enElDocumento(n, delDoc) }));
  const ineditos = conDoc.filter((x) => !x.doc);
  const afirman = r.fuera.filter((n) => n.afirma.length > 0);

  p('# Los textos que el censo del bloque F no mira');
  p();
  p('**SCRUM-561** · derivado de la medición de SCRUM-555. **Este documento no aprueba nada y no');
  p('propone ninguna redacción:** pone delante los textos que quedaron fuera del esquema con el');
  p('que se extrajeron los que sí se aprobaron.');
  p();
  p('> ⚠️ **Generado, no escrito a mano** (`node scripts/citar-fuera-del-censo.mjs`). Los textos');
  p('> salen del marcado y se verifican byte a byte; no se retocan ni se reordenan.');
  p();
  p('---');
  p();

  // ── LO PRIMERO, LA CORRECCIÓN DE LA PREMISA ─────────────────────────────────────────────
  p('## Antes de la lista: sí se le pusieron delante');
  p();
  p('El motivo del ticket dice que a estos textos no los vio nadie. **Medido, no es así.**');
  p();
  p('| | |');
  p('|---|---|');
  p(`| nodos fuera del esquema | **${r.fuera.length}** |`);
  p(`| de ellos, presentes en \`${DOC_APROBACION}\` | **${conDoc.length - ineditos.length}** |`);
  p(`| inéditos (en ningún documento) | **${ineditos.length}** |`);
  p();
  if (ineditos.length === 0) {
    p('**Ninguno es inédito.** El documento de aprobación del bloque F los recoge todos — tiene');
    p('**51** textos, y el esquema del censo ve **38**. El hueco no está entre el marcado y el');
    p('documento: está entre el **documento (51)** y lo que la aprobación cubrió.');
    p();
    p('🔴 **Y eso último no se puede verificar desde el repositorio:** no hay ningún fichero que');
    p('registre qué textos se aprobaron. La aprobación existe en la conversación, no en el árbol.');
    p('Mientras siga así, «¿está este texto aprobado?» no tiene respuesta comprobable.');
  }
  p();
  p('Lo que sí es cierto del motivo del ticket, y sigue siéndolo: **ninguno de estos textos pasa');
  p('por el censo de anclas**. Si uno afirma algo del producto, nadie comprueba que sea verdad.');
  p();
  p('---');
  p();

  // ── LOS QUE AFIRMAN ─────────────────────────────────────────────────────────────────────
  p('## ① Los que afirman algo sobre el producto');
  p();
  p('Estos necesitan **ancla además de aprobación**: son los que pueden hacer daño.');
  p();
  for (const n of afirman) {
    p(`### \`${n.id}\` · ${n.afirma.join(' + ')}`);
    p();
    p('```');
    p(n.texto);
    p('```');
    p();
    const d = enElDocumento(n, delDoc);
    p(`- **en el documento:** ${d ? `${d.num} (${d.via})` : '🔴 inédito'}`);
    p(`- **naturaleza:** ${n.naturaleza} — ${NATURALEZA_DICE[n.naturaleza]}`);
    p(`- **marcado:** \`${n.apertura.replace(/`/g, "'")}\``);
    if (n.afirma.includes('IDENTIDAD')) {
      p('- 🔴 **dice qué ES el producto, no qué hace.** Es la afirmación más fuerte de la página');
      p('  y no la sostiene ningún ancla. **El posicionamiento lo decide el fundador:** aquí no se');
      p('  propone ninguna alternativa.');
    }
    if (n.afirma.includes('CONDICION')) {
      p('- afirma una **condición comercial**. El ancla que hoy existe para «gratis» es');
      p('  `src/modules/auth/domain/auth.service.ts::planExpiresAt` (14 días).');
    }
    p();
  }
  p('---');
  p();

  // ── LA LISTA COMPLETA, POR SECCIÓN ──────────────────────────────────────────────────────
  p('## ② La lista completa, sección por sección');
  p();
  for (const id of SECCIONES) {
    const s = r.secciones[id];
    if (!s) { p(`### \`#${id}\` · 🔴 no aparece en el HTML`); p(); continue; }
    p(`### \`#${id}\``);
    p();
    p(`Nodos de texto: **${s.total}** · los ve el esquema: **${s.cubiertos.length}** · **fuera: ${s.fuera.length}**`);
    p();
    p('| identificador derivado | texto literal | naturaleza | afirma | en el documento |');
    p('|---|---|---|---|---|');
    for (const n of s.fuera) {
      const d = enElDocumento(n, delDoc);
      const texto = n.texto.replace(/\|/g, '\\|');
      const doble = n.tambienDentro ? ' ⚠️' : '';
      p(`| \`${n.id}\` | «${texto}»${doble} | ${n.naturaleza} | ${n.afirma.join(' + ') || '—'} | ${d ? d.num : '🔴 inédito'} |`);
    }
    const dobles = s.fuera.filter((n) => n.tambienDentro);
    if (dobles.length) {
      p();
      p(`⚠️ ${dobles.length === 1 ? 'Ese texto existe' : 'Esos textos existen'} **dos veces** en el`);
      p('marcado: aquí como cabecera de columna, y otra vez **dentro** de cada fila, donde el');
      p('esquema sí los ve. No son inéditos ni son otros: son la misma cadena en dos sitios, y por');
      p('eso el identificador derivado dice cuál de los dos es.');
    }
    p();
  }
  p('---');
  p();

  // ── EL CRITERIO, ESCRITO ────────────────────────────────────────────────────────────────
  p('## ③ ¿Y en `#comparativa`? El mecanismo de F5 tampoco los alcanza');
  p();
  p('`#comparativa` no la censa el censo de anclas: la vigila `tests/scrum332-comparativa-anclas.test.mjs`,');
  p('con otra unidad — la **fila**, no la frase. La pregunta es si esa otra unidad los cubre.');
  p();
  p('**Medido: no.** El registro de F5 tiene **6 claves**, y las seis son valores de `data-fila`');
  p('(`firma`, `cobro-pendiente`, `presupuesto-sin-respuesta`, `historial-cliente`, `margen-mes`,');
  p('`catalogo-precios`). Los cuatro nodos citados arriba están **antes de la primera fila**: son');
  p('el rótulo de la sección y las tres cabeceras de columna. **No pertenecen a ninguna fila, así');
  p('que ninguna ancla los alcanza.**');
  p();
  p('Es el mismo hueco con otra sección: cada censo mira su unidad, y lo que no es esa unidad no');
  p('lo mira nadie.');
  p();
  p('---');
  p();
  p('## ④ Con qué criterio está hecha cada columna');
  p();
  p('**Naturaleza** — el encargo pedía separar «texto de usuario» de «mecanismo (clase, id,');
  p('atributo de datos)». Esa separación **no hace falta aquí, y decirlo es más honesto que');
  p('fabricarla**: este censo sólo produce **nodos de texto**, lo que hay entre `>` y `<`. Una');
  p('clase o un `data-*` no son nodos de texto y no pueden salir de esta lista. Los');
  p(`${r.fuera.length} citados son, los ${r.fuera.length}, texto que un visitante lee. Lo que sí se deriva del marcado`);
  p('es de qué tipo:');
  p();
  for (const [k, v] of Object.entries(NATURALEZA_DICE)) p(`- \`${k}\` — ${v}`);
  p();
  p('**Afirma** — tres señales léxicas, cada una con consecuencia distinta:');
  p();
  p(`- \`IDENTIDAD\` — un sustantivo de **categoría** que dice qué ES el producto: \`${IDENTIDAD.source}\`.`);
  p('  ⚠️ Son sustantivos de categoría, **no el nombre del producto**: «Con YaQu» nombra a YaQu y');
  p('  no afirma nada de él. Meter «yaqu» en la lista daría un falso positivo.');
  p(`- \`CONDICION\` — una condición comercial: \`${CONDICION.source}\`.`);
  p('- `CAPACIDAD` — `MARCAS_CAPACIDAD`, el contraste que ya existe en el censo de anclas.');
  p();
  p('🔴 **Este criterio es un suelo, no un techo.** SCRUM-555 midió que el léxico de capacidad se');
  p('deja **una de cada tres** promesas. Por eso la lista se entrega con el **texto literal**');
  p('delante: para que quien la lea no dependa del léxico.');
  p();
  p('**En el documento** — cruce con `' + DOC_APROBACION + '` usando `===` y `Buffer.compare`,');
  p('nunca `includes()`. Se prueba con tres formas: el nodo suelto, el texto entero de su');
  p('elemento, y el del enlace que lo envuelve — porque el documento juntó el enlace con su');
  p('flecha en una sola entrada, y sin esa tercera forma seis nodos parecerían inéditos.');
  p();
  return L.join('\n') + '\n';
}

// En Windows `file://${argv[1]}` da DOS barras y `import.meta.url` trae TRES: comparados a mano
// no coinciden nunca y el script se queda sin hacer nada, en silencio y con exit 0.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const html = fs.readFileSync(path.join(RAIZ, 'public/index.html'), 'utf8');
  const md = generar(html, textosDelDocumento(RAIZ));
  if (process.argv.includes('--pantalla')) process.stdout.write(md);
  else {
    fs.writeFileSync(path.join(RAIZ, DESTINO), md, 'utf8');
    console.log('escrito: ' + DESTINO + ' (' + md.split('\n').length + ' líneas)');
  }
}
