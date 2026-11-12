// node paso2.mjs <ancho> <hash> <nombre> <acciones.mjs>      ROL=tecnico → operario simulado (ver rol.mjs)
// Es `paso.mjs` del banco de SCRUM-1658 (mismas acciones aNN-*.mjs, mismos helpers) + el rol + las cuentas.
// Sale con código 1 si la acción FALLA: un paso que no corrió no puede leerse como un paso limpio.
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { vestir, cuentas, COPIADO_DE } from './rol.mjs';
// El banco de SCRUM-1658 es su vecino en el repo (docs/master/evidencias/SCRUM-1658/banco): se reutiliza, no se copia.
const BANCO = process.env.BANCO_1658 || fileURLToPath(new URL('../../SCRUM-1658/banco', import.meta.url));
const h = await import(pathToFileURL(path.join(BANCO, 'lib.mjs')).href);
const [ancho, hash, nombre, acc] = process.argv.slice(2);
const w = Number(ancho);
const ROL = process.env.ROL || 'admin';
const s = await h.abrir(w, w < 600 ? 844 : 800);
await vestir(s, ROL);
const notas = [];
let fallo = 0;
s.nota = (t) => { notas.push(t); console.log('·', t); };
s.mide = async (sub) => {
  const n = `${nombre}${sub ? '-' + sub : ''}-${ROL}`;
  await h.foto(s, n);
  const inv = await h.inventario(s.page, 'body');
  const des = await h.desbordes(s.page);
  const peq = (await h.pequenos(s.page)).filter((x) => !/228x34|«Salir»/.test(x));
  const vista = await s.page.evaluate(() => ({
    rol: window.appUserRole,
    texto: (document.querySelector('#view-container, .view-container, main') || document.body).innerText,
    modal: [...document.querySelectorAll('.modal-overlay')].filter((m) => m.getBoundingClientRect().width > 0).map((m) => m.innerText).join('\n'),
  }));
  const c = cuentas(vista.texto + '\n' + vista.modal);
  h.guardar(`${n}-${w}.txt`, [`URL ${s.page.url()}`, `ROL pedido=${ROL} · en la página=${vista.rol} · recorte copiado de ${COPIADO_DE}`,
    '--- CUENTAS', JSON.stringify(c), '--- TEXTO', vista.texto.slice(0, 8000), '--- MODAL', vista.modal.slice(0, 3000), '--- PULSABLES', ...inv,
    '--- DESBORDES', ...des, '--- <44px', ...peq, '--- ESCRITURAS', ...s.escrituras, '--- RECORTES', ...s.recortes, '--- LOG', ...s.log, '--- NOTAS', ...notas].join('\n'));
  console.log(`${n}@${w}: rol=${vista.rol} · ${inv.length} pulsables · ${des.length} desbordes · ${peq.length} <44 · log ${s.log.length} · ${JSON.stringify(c)}`);
  if (ROL !== 'admin' && vista.rol !== ROL) { fallo = 1; console.log(`CIEGO: se pidió rol ${ROL} y la página dice ${vista.rol}`); }
  return { ...vista, cuentas: c };
};
try {
  await h.ir(s.page, hash);
  const mod = await import(pathToFileURL(path.resolve(acc)).href);
  await mod.default(s, h);
} catch (e) {
  fallo = 1;
  console.log('FALLO', String(e).slice(0, 600));
  await h.foto(s, `${nombre}-${ROL}-FALLO`);
} finally {
  if (s.escrituras.length) console.log('ESCRITURAS\n' + s.escrituras.join('\n'));
  if (s.log.length) console.log('LOG\n' + s.log.join('\n'));
  fs.appendFileSync(path.join(h.OUT, 'bitacora.txt'), `${new Date().toISOString()} ${ROL} ${w} ${hash} ${nombre} ${acc} fallo=${fallo} escrituras=[${s.escrituras.join(' ; ')}]\n`);
  await s.browser.close();
}
process.exit(fallo);
