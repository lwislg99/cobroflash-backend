// docs/master/evidencias/SCRUM-1537/siembra-once.cjs — SCRUM-1537
//
// ¿ES VERDAD QUE `cotejo-once.cjs` SÓLO LEE DEL MÁSTER LAS LISTAS CON FLECHA?
//
//     node docs/master/evidencias/SCRUM-1537/siembra-once.cjs
//
// jv-j3i lo LEYÓ en su código y dijo que no lo había corrido. Aquí se CORRE, y con valores SEMBRADOS:
// no se toma de prueba ningún valor que el árbol ya tenga sin flecha, porque el día que alguien lo
// arregle la prueba se queda muda. El máster no se toca en disco: `cotejarOnce({ textoMaster })`
// recibe el texto cambiado en memoria y recorre el camino entero del instrumento, no un ayudante.
//
// POBLACIÓN: todos los campos de la tabla ONCE cuyo máster se lee en modo 'flechas'. A cada uno se le
// hacen DOS siembras en SU línea de la Parte L, con una palabra derivada que no está en el máster:
//   SIN FLECHA   ` `<semilla>`: valor de la máquina, sin transiciones fijadas aquí.`   (la forma que
//                usó SCRUM-1529c para los valores que entraron el 13-oct-2026)
//   CON FLECHA   ` · `<un valor suyo> → <semilla>``
// Y de cada siembra se miran DOS cosas, por este orden: que el veneno ENTRÓ (la palabra sale como
// palabra entera en esa línea del texto que recibe el instrumento) y si el instrumento la VE (está
// en su M). Un instrumento que leyera la línea entera daría «la ve» en las dos.
//
// Y UN CASO EN LA OTRA DIRECCIÓN, que es el que produce rojos falsos: a un campo que hoy COINCIDE se
// le saca un valor SUYO de la lista con flecha y se le vuelve a escribir en la misma línea sin flecha.
// El máster sigue declarando ese valor; se mira si el instrumento sigue diciendo que coincide.
//
// SALIDA: 0 = las siembras entraron todas y se pudo leer el resultado (sea cual sea) · 2 = alguna
// siembra no entró o el instrumento no devolvió la fila: no hay medición.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const RAIZ = path.resolve(__dirname, '..', '..', '..', '..');
const RUTA_ONCE = path.join(RAIZ, 'docs', 'master', 'evidencias', 'scrum1500c', 'cotejo-once.cjs');
const once = require(RUTA_ONCE);

const MASTER = fs.readFileSync(path.join(RAIZ, 'docs', 'YAQU_MASTER.md'), 'utf8');
const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');

let semilla = 'sembrado_scrum1537';
while (MASTER.includes(semilla)) semilla += '_x';

const fila = (r, id) => r.filas.find((f) => f.id === id && !f.control) || null;
const conLinea = (n, cambia) => { const ls = MASTER.split('\n'); ls[n - 1] = cambia(ls[n - 1]); return ls.join('\n'); };

const out = [];
const di = (s) => out.push(s);
let sinMedir = 0;

const base = once.cotejarOnce();
const flechas = once.ONCE.filter((c) => c.master && c.master.modo === 'flechas');
di(`INSTRUMENTO: docs/master/evidencias/scrum1500c/cotejo-once.cjs · sha256 ${sha(fs.readFileSync(RUTA_ONCE))}`);
di(`MASTER     : ${MASTER.split('\n').length} líneas · sha256 ${sha(MASTER)}`);
di(`SEMILLA    : «${semilla}» · veces que sale en el máster sin sembrar: ${once.rastro(MASTER.split('\n'), semilla).length} (tiene que ser 0)`);
di(`POBLACION  : ${flechas.length} campos de la tabla ONCE leídos en modo 'flechas', de ${once.ONCE.length} (${flechas.map((c) => c.campo).join(', ')})`);
di('');

const cuenta = { sinFlecha: { entro: 0, laVe: 0 }, conFlecha: { entro: 0, laVe: 0 } };
for (const c of flechas) {
  const f0 = fila(base, c.campo);
  if (!f0 || !f0.lineaMaster) { di(`${c.campo}: SIN MEDIR, el instrumento no da su línea del máster`); sinMedir += 1; continue; }
  const n = f0.lineaMaster;
  const suyo = f0.M[0];
  const casos = [
    ['sinFlecha', 'SIN FLECHA', (l) => `${l} \`${semilla}\`: valor de la máquina, sin transiciones fijadas aquí.`],
    ['conFlecha', 'CON FLECHA', (l) => `${l} · \`${suyo} → ${semilla}\``],
  ];
  di(`${c.campo} · línea ${n} del máster · sin sembrar: ${f0.veredicto} · M = ${f0.M.join(' | ')}`);
  for (const [clave, rotulo, cambia] of casos) {
    const texto = conLinea(n, cambia);
    const entro = once.rastro(texto.split('\n'), semilla).join(',') === String(n);
    const f = fila(once.cotejarOnce({ textoMaster: texto }), c.campo);
    if (!entro || !f) { di(`    ${rotulo}: SIN MEDIR (el veneno ${entro ? 'entró' : 'NO entró'}; fila ${f ? 'devuelta' : 'NO devuelta'})`); sinMedir += 1; continue; }
    const laVe = (f.M || []).includes(semilla);
    cuenta[clave].entro += 1;
    if (laVe) cuenta[clave].laVe += 1;
    di(`    ${rotulo}: el veneno entró en la línea ${n} · el instrumento ${laVe ? 'LA VE' : 'NO LA VE'} · veredicto ${f.veredicto}${f.faltan.includes(semilla) ? ' · la nombra en «en el máster y sin fuente en el código»' : ''}`);
  }
}

di('');
di('LA OTRA DIRECCIÓN: un valor que el máster SIGUE declarando, cambiado de «con flecha» a «sin flecha»');
{
  const id = 'Job.status';
  const f0 = fila(base, id);
  const n = f0.lineaMaster;
  const antes = MASTER.split('\n')[n - 1];
  const despues = `${antes.replace(' → cerrado`', '`')} \`cerrado\`: valor de la máquina, sin transiciones fijadas aquí.`;
  const aplicado = despues !== antes && !despues.includes('→ cerrado') && once.rastro([despues], 'cerrado').length === 1;
  const f = fila(once.cotejarOnce({ textoMaster: conLinea(n, () => despues) }), id);
  if (!aplicado || !f) { di(`    ${id}: SIN MEDIR (la transformación ${aplicado ? 'se aplicó' : 'NO se aplicó'})`); sinMedir += 1; } else {
    di(`    ${id} · línea ${n} · sin tocar: ${f0.veredicto}`);
    di(`    con \`cerrado\` fuera de la flecha y todavía en la línea: ${f.veredicto}${f.sobran.length ? ` · dice «en el código y NO en esa línea del máster: ${f.sobran.join(', ')}»` : ''}`);
  }
}

di('');
di(`RESUMEN sobre ${flechas.length} campos:`);
di(`  SIN FLECHA: entró en ${cuenta.sinFlecha.entro} de ${flechas.length} · el instrumento la ve en ${cuenta.sinFlecha.laVe}`);
di(`  CON FLECHA: entró en ${cuenta.conFlecha.entro} de ${flechas.length} · el instrumento la ve en ${cuenta.conFlecha.laVe}`);
di(`  sin medir : ${sinMedir}`);
const salida = sinMedir > 0 ? 2 : 0;
di(`EXIT=${salida}`);
console.log(out.join('\n'));
process.exit(salida);
