// node paso.mjs <ancho> <hash> <nombre> <acciones.mjs>
// acciones.mjs exporta default async (s, h) => {...}; h = helpers del banco.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as h from './lib.mjs';
const [ancho, hash, nombre, acc] = process.argv.slice(2);
const w = Number(ancho);
const s = await h.abrir(w, w < 600 ? 844 : 800);
const notas = [];
s.nota = (t) => { notas.push(t); console.log('·', t); };
s.mide = async (sub) => {
  const n = `${nombre}${sub ? '-' + sub : ''}`;
  await h.foto(s, n);
  const inv = await h.inventario(s.page, 'body');
  const des = await h.desbordes(s.page);
  const peq = (await h.pequenos(s.page)).filter((x) => !/228x34|«Salir»/.test(x));
  const texto = await s.page.evaluate(() => document.body.innerText.slice(0, 6000));
  h.guardar(`${n}-${w}.txt`, [`URL ${s.page.url()}`, '--- TEXTO', texto, '--- PULSABLES', ...inv, '--- DESBORDES', ...des, '--- <44px', ...peq, '--- LOG', ...s.log, '--- NOTAS', ...notas].join('\n'));
  console.log(`${n}@${w}: ${inv.length} pulsables · ${des.length} desbordes · ${peq.length} <44 · log ${s.log.length}`);
};
try {
  await h.ir(s.page, hash);
  const mod = await import(pathToFileURL(path.resolve(acc)).href);
  await mod.default(s, h);
} catch (e) {
  console.log('FALLO', String(e).slice(0, 500));
  await h.foto(s, nombre + '-FALLO');
} finally {
  if (s.log.length) console.log(s.log.join('\n'));
  await s.browser.close();
}
