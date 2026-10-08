// docs/master/evidencias/scrum1500c/sonda-escrituras.cjs — SCRUM-1500c
//
// PRIMERA PASADA, sin cierres declarados: qué literales escribe `src/` en cada uno de los campos de
// estado que el cotejo de SCRUM-1500 NOMBRA y no coteja. La población no se escribe aquí: sale de
// `estadosFueraDeLaTabla` del propio instrumento. Sirve para saber dónde mirar; el cotejo es
// `cotejo-once.cjs`.
//
//     node docs/master/evidencias/scrum1500c/sonda-escrituras.cjs
const { cotejar } = require('../scrum1500/cotejo.cjs');

const base = cotejar();
const once = base.poblacion.estadosFueraDeLaTabla;
const delegado = (m) => m[0].toLowerCase() + m.slice(1);
const campos = once.map((c) => {
  const [m, f] = c.split('.');
  return { campo: c, comentario: 'cola', cierre: null, escribe: [delegado(m), f], master: null };
});
// Control POSITIVO: un campo que el instrumento ya mide y del que se sabe qué se escribe.
campos.push({ campo: 'TeamMember.status', comentario: 'cola', cierre: null, escribe: ['teamMember', 'status'], master: null });
// Control de CERO: un delegado que no existe.
campos.push({ campo: 'Merchant.status', etiqueta: 'CONTROL delegado inventado', comentario: 'cola', cierre: null, escribe: ['delegadoQueNoExiste', 'status'], master: null });

const r = cotejar({ campos, controles: [] });
console.log(`POBLACION: ${once.length} campos fuera de la tabla · ${r.poblacion.ficheros} ficheros .ts (${r.poblacion.sinParsear} sin parsear)`);
for (const f of r.filas) {
  console.log(`\n=== ${f.campo} (esquema línea ${f.campoEn}) @default ${f.defecto ?? '—'}`);
  console.log(`    comentario C : ${f.C && f.C.length ? f.C.join(' | ') : '(no enumera)'}`);
  console.log(`    escritos     : ${f.escritos.join(' | ') || '(ningún literal)'}`);
  for (const s of f.sitios) console.log(`        ${s}`);
  for (const s of f.noLiterales) console.log(`        (no literal) ${s}`);
}
