// docs/master/evidencias/scrum927b/la-regla.mjs — SCRUM-927b
//
// ¿Qué distingue una lista que debe acabar en `assert` de una que legítimamente sólo informa?
// El criterio propuesto es de tres, y aquí se comprueba contra las 7 medidas en la fase a.
//
//   ① ¿está EN LA TANDA?                      — medido: su fichero, ¿lo alcanza `tests/`?
//   ② ¿es comprobable SIN NADA EXTERNO?       — medido: `reproducible` (sin red, base, navegador
//                                                ni ruta que alguien tenga que pasarle)
//   ③ ¿su rotura tiene VÍCTIMA HOY?           — NO es derivable: es juicio, y va declarado.
//
// ⛔ Sólo lee. No convierte nada.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { censarCensos, censarExcepciones } from '../../../../scripts/_censo-de-censos.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const e = censarExcepciones(RAIZ);
const c = censarCensos(RAIZ);

/**
 * Las SIETE que midió la fase a, por (nombre, fichero). El suelo no es «que haya 7 avisando»: eso
 * lo rompió esta misma fase al convertir una — y que lo rompiera es la prueba de que el cambio
 * hizo algo. El suelo es que las siete SIGAN LOCALIZABLES y que **exactamente una** haya pasado
 * a vigilada: la que se convirtió.
 */
const LAS_SIETE = [
  ['PARES_SIN_TESTIGO_CONGELADOS', 'scripts/_anclas-sin-testigo.congelado.mjs'],
  ['CONOCIDOS', 'docs/master/evidencias/SCRUM-863/censo-region-863.mjs'],
  ['CONOCIDOS', 'scripts/guard-contraste.mjs'],
  ['SIN_DTO', 'scripts/guard-descuentos-en-el-detalle.mjs'],
  ['CONOCIDOS', 'scripts/censo-bancos-fijados.mjs'],
  ['EXCLUIDAS', 'docs/master/evidencias/SCRUM-523/censo-523.mjs'],
  ['EXCLUIDAS', 'docs/master/evidencias/SCRUM-863/censo-region-863.mjs'],
];
const hallada = (n, f) => e.listas.find((x) => x.nombre === n && x.fichero === f);
const perdidas = LAS_SIETE.filter(([n, f]) => !hallada(n, f));
if (perdidas.length) {
  console.log('🔴 CIEGO: de las 7 medidas en la fase a no encuentro ' + perdidas.length + ': '
    + perdidas.map(([n, f]) => n + '@' + f).join(', ')
    + '\n   Están en `main` y medidas por mí. Si no se ven, la regla se estaría comprobando contra otra cosa.');
  process.exit(3);
}
const convertidas = LAS_SIETE.filter(([n, f]) => hallada(n, f).vigilada);
if (convertidas.length !== 1) {
  console.log(`🔴 CIEGO: esperaba EXACTAMENTE UNA convertida a vigilada y veo ${convertidas.length}`
    + ` (${convertidas.map(([n]) => n).join(', ') || 'ninguna'}).`
    + '\n   Una sola es el encargo: las otras seis no se tocan.');
  process.exit(3);
}
console.log('SUELO ✅ las 7 de la fase a siguen localizables · convertida exactamente 1: '
  + convertidas[0][0] + '\n');

/** ③ no se puede derivar del código: se declara, con su motivo, por cada una. */
const VICTIMA_HOY = new Map([
  ['PARES_SIN_TESTIGO_CONGELADOS', ['SÍ', 'perdona una deuda que ya no existe; el trinquete tomaría por vieja una cita nueva sin testigo']],
  ['CONOCIDOS@docs/master/evidencias/SCRUM-863/censo-region-863.mjs', ['no', 'acta fechada de un ticket cerrado: su valor es histórico']],
  ['EXCLUIDAS@docs/master/evidencias/SCRUM-863/censo-region-863.mjs', ['no', 'acta fechada']],
  ['EXCLUIDAS@docs/master/evidencias/SCRUM-523/censo-523.mjs', ['no', 'acta fechada']],
  ['CONOCIDOS@scripts/guard-contraste.mjs', ['?', 'no se puede saber sin arrancar Edge y medirlo']],
  ['SIN_DTO@scripts/guard-descuentos-en-el-detalle.mjs', ['?', 'idem']],
  ['CONOCIDOS@scripts/censo-bancos-fijados.mjs', ['no', 'nadie lo corre: su rotura no la vería nadie igual']],
]);

const enLaTanda = (fichero) => (c.filas.find((f) => f.fichero === fichero)?.ejecutadoPor === 'TANDA');
const reproducible = (fichero) => {
  const f = c.filas.find((x) => x.fichero === fichero);
  // Lo que vive en docs/evidencias no se juzga por esto: es un acta por su sitio.
  return f ? f.reproducible : null;
};

console.log('LA REGLA DE TRES, CONTRA LAS 7 QUE SÓLO AVISAN');
console.log('');
console.log('elem  lista                          ①tanda ②sin-externo ③víctima  veredicto');
console.log('-'.repeat(100));
const filas = LAS_SIETE.map(([n, f]) => hallada(n, f)).sort((a, b) => b.elementos - a.elementos);
for (const l of filas) {
  const clave = VICTIMA_HOY.has(l.nombre) ? l.nombre : l.nombre + '@' + l.fichero;
  const [victima, motivo] = VICTIMA_HOY.get(clave) || ['?', 'sin declarar'];
  const t = enLaTanda(l.fichero);
  const r = reproducible(l.fichero);
  const veredicto = t && r && victima === 'SÍ' ? 'CONVERTIR'
    : l.fichero.startsWith('docs/') ? 'acta fechada — no se toca'
      : !t && r && victima === 'no' ? 'los DOS defectos a la vez'
        : victima === '?' ? 'fuera de alcance: no se puede medir aquí' : 'no convertir';
  console.log(String(l.elementos).padStart(4) + '  ' + l.nombre.padEnd(30)
    + String(t).padEnd(7) + String(r).padEnd(13) + String(victima).padEnd(10) + veredicto);
  console.log('      ' + l.fichero + '  ·  ③: ' + motivo);
}
console.log('');
console.log('¿SOSTIENE? Los tres criterios NO son independientes: ③ depende de ①.');
console.log('Si nadie la corre, su rotura no tiene víctima hoy — no porque la propiedad no importe,');
console.log('sino porque nadie se enteraría igual. El caso puro es `censo-bancos-fijados.mjs`:');
console.log('sólo avisa Y no lo corre nadie, o sea los dos defectos del ticket en el mismo fichero.');
