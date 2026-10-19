// Sonda (S3): los dos guards de TEXTO de la landing que no nombran `hidden`, ¿qué hacen con una
// afirmación dentro de una sección oculta? Y su veredicto sobre el árbol real.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const raiz = process.argv[2];
const imp = (r) => import(pathToFileURL(path.join(raiz, r)).href);
const conf = await imp('scripts/_guard-conformidad-landing.mjs');
const fisc = await imp('scripts/_guard-afirmacion-fiscal.mjs');

const FRASE = 'Facturación VeriFactu en certificación, estamos certificados.';
const visible = `<main><section id="a"><p>${FRASE}</p></section></main>`;
const oculta = `<main><section id="a" hidden><p>${FRASE}</p></section></main>`;
const control = '<main><section id="a"><p>Presupuestos por WhatsApp.</p></section></main>';
for (const [nombre, f] of [['conformidad (SCRUM-400) afirmacionesDeConformidad', conf.afirmacionesDeConformidad], ['fiscal (SCRUM-537) afirmacionesFalsas', fisc.afirmacionesFalsas]]) {
  const n = (h) => { const r = f(h); return Array.isArray(r) ? r.length : JSON.stringify(r).length; };
  console.log(`${nombre} · visible ${n(visible)} · DENTRO DE hidden ${n(oculta)} · control sin afirmación ${n(control)}`);
}
for (const [nombre, m] of [['conformidad', conf], ['fiscal', fisc]]) {
  const r = m.comprobarEnDisco(raiz);
  console.log(`${nombre} sobre el árbol: ${JSON.stringify(r).slice(0, 300)}`);
}
