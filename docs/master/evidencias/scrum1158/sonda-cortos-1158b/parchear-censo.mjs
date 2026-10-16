// Uso: node parchear-censo.mjs <arbol extraído> <node_modules de donde sacar puppeteer-core>
// Copia el censo táctil del árbol a scripts/__censo-volcado.mjs DENTRO de ese árbol extraído (que es
// una copia en tmp, no un worktree) con dos cambios, sin tocar el árbitro:
//  · cada ficha lleva sus atributos identificadores (id, data-*, aria-label, href, onclick)
//  · al acabar, vuelca a $VOLCADO los cortos por pantalla y anchura (JSON).
import fs from 'node:fs';
import path from 'node:path';

const [arbol, modulos] = process.argv.slice(2);
const src = path.join(arbol, 'scripts', 'censo-objetivo-tactil-panel.mjs');
let t = fs.readFileSync(src, 'utf8');
const cambios = [
  ["import puppeteer from 'puppeteer-core';",
    "import { createRequire } from 'node:module';\nconst puppeteer = (await import('file:///' + createRequire(" + JSON.stringify(path.join(modulos, 'x.js')) + ").resolve('puppeteer-core').replace(/\\\\/g, '/'))).default;"],
  ["texto: (el.textContent",
    "attrs: [...el.attributes].filter((a) => a.name === 'id' || a.name.startsWith('data-') || a.name === 'aria-label' || a.name === 'href' || a.name === 'type').map((a) => a.name + '=' + a.value).join(' '), texto: (el.textContent"],
  ['srv.close();',
    "srv.close();\nfs.writeFileSync(process.env.VOLCADO, JSON.stringify(resultados.map((r) => ({ fn: r.fn, ancho: r.ancho, medidos: r.medidos.length, cortos: r.medidos.filter((m) => !m.cumple) })), null, 1));"],
];
for (const [a, b] of cambios) {
  const n = t.split(a).length - 1;
  if (n !== 1) { console.error(`🔴 el ancla «${a}» aparece ${n} veces (se esperaba 1): no parcheo`); process.exit(2); }
  t = t.replace(a, b);
}
const dst = path.join(arbol, 'scripts', '__censo-volcado.mjs');
fs.writeFileSync(dst, t);
console.log('parcheado: ' + dst);
