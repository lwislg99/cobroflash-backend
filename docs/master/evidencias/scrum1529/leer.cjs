// docs/master/evidencias/scrum1529/leer.cjs — SCRUM-1529
//
// Corre los DOS instrumentos de SCRUM-1500 (cotejo.cjs y cotejo-once.cjs) sobre el árbol que se le
// diga y devuelve, en JSON y por stdout, lo que dicen de los SIETE campos. No mide nada por su
// cuenta: los instrumentos son los de J5, sin tocar. Lo usa siete.cjs, una vez por árbol, porque
// cotejo-once.cjs fija su raíz al cargarse y no se le puede cambiar desde fuera.
//
//     node docs/master/evidencias/scrum1529/leer.cjs <raíz del árbol>
const path = require('node:path');

const raiz = path.resolve(process.argv[2] || path.resolve(__dirname, '..', '..', '..', '..'));
const base = require(path.join(raiz, 'docs', 'master', 'evidencias', 'scrum1500', 'cotejo.cjs'));
const once = require(path.join(raiz, 'docs', 'master', 'evidencias', 'scrum1500c', 'cotejo-once.cjs'));

const SIETE = ['QuoteRequest.status', 'ParteTrabajo.estado', 'TeamMember.status', 'Quote.status', 'Invoice.status', 'Charge.status', 'WhatsAppMessage.status'];

const r1 = base.cotejar({ raiz });
if (r1.ciego) { console.log(JSON.stringify({ ciego: r1.ciego })); process.exit(2); }
const r2 = once.cotejarOnce();

const campos = {};
for (const f of r1.filas.filter((x) => !x.control && SIETE.includes(x.id))) {
  campos[f.id] = {
    instrumento: 'scrum1500/cotejo.cjs', lineaEsquema: f.campoEn, veredicto: f.veredicto, defecto: f.defecto,
    D: f.D, M: f.M, lineaMaster: f.lineaMaster, cierre: f.cierre, cierreDe: f.cierreDe,
    literales: f.sitios, noLiterales: f.noLiterales,
  };
}
for (const f of r2.filas.filter((x) => !x.control && SIETE.includes(x.id))) {
  campos[f.id] = {
    instrumento: 'scrum1500c/cotejo-once.cjs', lineaEsquema: f.campoEn, veredicto: f.veredicto, defecto: f.defecto,
    D: f.D, M: f.M, lineaMaster: f.lineaMaster, sobran: f.sobran, faltan: f.faltan,
    fuentes: f.fuentes.map((x) => ({ de: x.de, valores: [...x.valores].sort(), sitios: x.sitios || [], noLiterales: x.noLit || x.noLiterales || [], ciego: x.ciego || null })),
  };
}
console.log(JSON.stringify({
  raiz,
  poblacion: { ficheros: r1.poblacion.ficheros, sinParsear: r1.poblacion.sinParsear, lineasEsquema: r1.poblacion.lineasEsquema, lineasMaster: r1.poblacion.lineasMaster, escriturasVistas: r2.B.escriturasVistas },
  campos,
}));
