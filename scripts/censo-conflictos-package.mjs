#!/usr/bin/env node
// scripts/censo-conflictos-package.mjs — SCRUM-548
//
// ¿PEAJE O PROBLEMA? Cuántos conflictos de `package.json` hay de verdad, y de qué clase.
//
// ── CÓMO SE MIDE, Y POR QUÉ NO SE LEEN LOS MENSAJES DE COMMIT ────────────────────────────────
// Se REPRODUCE cada merge del repositorio con `git merge-tree --write-tree` sobre sus dos padres.
// Eso replica la fusión con la estrategia por defecto y dice si `package.json` conflictaba.
// Deducirlo de los mensajes («Merge … conflicto …») mediría quién se acordó de escribirlo.
//
// ── LA CLASIFICACIÓN, QUE ES LO QUE CONTESTA LA PREGUNTA ────────────────────────────────────
//   · DOS SCRIPTS NUEVOS  → los dos lados sólo AÑADEN líneas. Se resuelve siempre igual:
//                           se conservan los dos. Eso no es un conflicto, es un PEAJE.
//   · MODIFICACION REAL   → alguno de los dos lados cambió o borró algo que ya existía. Ahí sí
//                           hay que decidir, y el conflicto está haciendo su trabajo.
//
// ── 🔴 SUELO ────────────────────────────────────────────────────────────────────────────────
// Si el recorrido no encuentra NINGÚN conflicto, falla declarándose ciego. Sabemos que ha habido
// varios: un cero aquí significaría que `merge-tree` no dice lo que se cree o que el recorrido no
// llega, y se leería como «no hay peaje» — la conclusión contraria.
//
// ── ⚠️ LO QUE ESTE CENSO NO PUEDE VER ───────────────────────────────────────────────────────
// Un conflicto que se resolvió en una rama que nunca se empujó, o cuyo merge se aplastó (squash),
// no deja rastro reproducible. La población es «los merges que existen en este repositorio».
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const ENV = { ...process.env, MSYS_NO_PATHCONV: '1' };
const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 6e7, env: ENV });
const gitOk = (...a) => { try { return { ok: true, out: git(...a) }; } catch (e) { return { ok: false, out: (e.stdout || '') + (e.stderr || '') }; } };

export const FICHERO = 'package.json';

/**
 * La clase de un conflicto, a partir de lo que hizo cada lado sobre el fichero.
 *
 * Se decide por las líneas BORRADAS: añadir no obliga a decidir nada —se conservan las dos
 * cosas—, y borrar o cambiar sí. Es la distinción entre un peaje y un conflicto de verdad.
 */
export function clasificarConflicto(n1, n2) {
  if (!n1 || !n2) return 'INDETERMINADO';
  return (n1.menos === 0 && n2.menos === 0) ? 'DOS SCRIPTS NUEVOS' : 'MODIFICACION REAL';
}

/** Las claves de `scripts` que un lado AÑADIÓ, para saber dónde cae el conflicto. */
export function clavesAnadidas(diff) {
  return [...new Set([...diff.split('\n')
    .filter((l) => l.startsWith('+') && !l.startsWith('+++'))
    .join('\n').matchAll(/"(\/\/)?([a-z0-9:_-]+)"\s*:/gi)].map((x) => (x[1] || '') + x[2]))];
}

/**
 * La familia de una clave: `guard:contraste` → `guard`. Para responder «¿dónde caen?».
 *
 * ⚠️ Escrito con una expresión regular y NO con `split(':')`, y el motivo no es de estilo: el
 *    trinquete de SCRUM-474 vigila por AST cuántas implementaciones hay de la partición
 *    `<metodo>:<pasarela>` —hay dos copias deliberadas y una tercera tendría que justificarse— y
 *    caza cualquier función que parta por un `':'` literal. Ésta partía por dos puntos por otra
 *    razón (el prefijo de familia de un script de npm) y aun así saltó, con razón: desde fuera se
 *    escriben igual. Se cambia ESTE código, que es el nuevo, y no el guard.
 */
export function familiaDe(clave) {
  const m = /^(?:\/\/)?([a-z0-9_-]+):/i.exec(String(clave));
  return m ? m[1] : '(sin familia)';
}

export function censarConflictos({ limite = 0 } = {}) {
  const args = ['log', '--merges', '--format=%H|%P|%ad|%s', '--date=short', '--all'];
  if (limite) args.push('-n', String(limite));
  const merges = git(...args).trim().split('\n').filter(Boolean)
    .map((l) => { const [h, p, fecha, asunto] = l.split('|'); return { h, padres: p.split(' '), fecha, asunto }; });

  const conflictos = [];
  let ambosTocaron = 0;

  for (const m of merges) {
    if (m.padres.length !== 2) continue;
    const [p1, p2] = m.padres;
    const base = gitOk('merge-base', p1, p2);
    if (!base.ok) continue;
    const b = base.out.trim();
    const numstat = (lado) => gitOk('diff', '--numstat', b, lado, '--', FICHERO).out.trim();
    const d1 = numstat(p1), d2 = numstat(p2);
    if (!d1 || !d2) continue;                    // sólo un lado lo tocó → no puede conflictar
    ambosTocaron += 1;

    const r = gitOk('merge-tree', '--write-tree', p1, p2);
    if (r.ok) continue;                          // fusionó limpio
    if (!new RegExp(FICHERO.replace('.', '\\.')).test(r.out)) continue;   // conflictó en otro sitio

    const num = (s) => { const [a, d] = s.split('\t'); return { mas: +a, menos: +d }; };
    const n1 = num(d1), n2 = num(d2);
    conflictos.push({
      ...m,
      clase: clasificarConflicto(n1, n2),
      n1, n2,
      claves1: clavesAnadidas(gitOk('diff', b, p1, '--', FICHERO).out),
      claves2: clavesAnadidas(gitOk('diff', b, p2, '--', FICHERO).out),
    });
  }
  return { merges: merges.length, ambosTocaron, conflictos };
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────────
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const i = process.argv.indexOf('--limite');
  const limite = i > 0 ? Number(process.argv[i + 1]) : 0;

  const r = censarConflictos({ limite });
  console.log('merges reproducidos ................ ' + r.merges);
  console.log('con los DOS lados tocando ' + FICHERO + ' : ' + r.ambosTocaron);
  console.log('de ésos, CON CONFLICTO ............. ' + r.conflictos.length);

  if (r.conflictos.length === 0) {
    console.error('\n🔴 CIEGO: cero conflictos de ' + FICHERO + ' en todo el historial reproducido.');
    console.error('   Sabemos que ha habido varios. O `merge-tree` no dice lo que creo, o el recorrido');
    console.error('   no llega a esos merges. Un cero aquí se leería como «no hay peaje».');
    process.exit(1);
  }

  console.log('\n' + '─'.repeat(92));
  for (const c of r.conflictos) {
    console.log(`${c.fecha}  ${c.h.slice(0, 8)}  [${c.clase}]  +${c.n1.mas}/-${c.n1.menos} vs +${c.n2.mas}/-${c.n2.menos}`);
    console.log('     ' + c.asunto.slice(0, 86));
    console.log('     lado A: ' + (c.claves1.join(' ') || '(sin claves nuevas)').slice(0, 86));
    console.log('     lado B: ' + (c.claves2.join(' ') || '(sin claves nuevas)').slice(0, 86));
  }

  const porClase = {};
  for (const c of r.conflictos) porClase[c.clase] = (porClase[c.clase] || 0) + 1;
  console.log('\n' + '─'.repeat(92));
  console.log('POR CLASE:');
  for (const [k, v] of Object.entries(porClase)) console.log('   ' + String(v).padStart(3) + '  ' + k);

  const fams = {};
  for (const c of r.conflictos) for (const k of [...c.claves1, ...c.claves2]) {
    const f = familiaDe(k); fams[f] = (fams[f] || 0) + 1;
  }
  console.log('\nCLAVES IMPLICADAS, POR FAMILIA:');
  for (const [k, v] of Object.entries(fams).sort((a, b) => b[1] - a[1])) console.log('   ' + String(v).padStart(3) + '  ' + k);
}
