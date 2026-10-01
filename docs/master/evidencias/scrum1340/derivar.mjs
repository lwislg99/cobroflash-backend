// derivar.mjs — SCRUM-1340: la lista de heredadas, DERIVADA con el motor del guard.
// Uso: node derivar.mjs <raiz> <salida.json> [<censo.json del primer instrumento, para cruzar>]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [, , RAIZ, SALIDA, CENSO] = process.argv;
const imp = (rel) => import(pathToFileURL(path.join(RAIZ, rel)).href);
const motor = await imp('tests/_skill-ui-por-efecto.mjs');
const m267 = await imp('tests/scrum267-ancla-de-medicion.test.mjs');
const m811 = await imp('tests/scrum811c-skill-ui-declarada.test.mjs');

const CORTE_INSTANTE = '2026-09-22T22:00:00Z';   // las 00:00 del 23-sep en Madrid
const t0 = Date.now();
const u = motor.leerUnidades(RAIZ, CORTE_INSTANTE);
const ms = Date.now() - t0;
if (u.ciego) { console.log('DERIVAR CIEGO ' + u.ciego); process.exit(2); }

const entradas = m267.entradasTroceadas();
const porFichero = motor.agruparPorFichero(entradas);
const filas = u.historia.map((x) => ({ ...x, v: motor.veredictoDeUnidad(x, porFichero, m811.declaraSkillUi) }));
const cuenta = {};
for (const f of filas) cuenta[f.v.veredicto] = (cuenta[f.v.veredicto] || 0) + 1;
const sinDeclarar = filas.filter((f) => f.v.veredicto === 'SIN_DECLARAR');

console.log('DERIVAR base=' + u.base.sha + ' (' + u.base.ref + ') · ms=' + ms);
console.log('DERIVAR unidades tras el corte=' + filas.length + ' · ' + JSON.stringify(cuenta));
console.log('DERIVAR atribucion de las de interfaz: ' + JSON.stringify(filas.filter((f) => f.ui.length).reduce((a, f) => { const k = f.v.como || 'ninguna'; a[k] = (a[k] || 0) + 1; return a; }, {})));
console.log('DERIVAR pendiente=' + (u.pendiente ? JSON.stringify({ ui: u.pendiente.ui, registros: [...u.pendiente.registros.keys()] }) : 'null'));
for (const f of filas.filter((x) => x.v.veredicto === 'NO_SE')) console.log('DERIVAR NO_SE ' + f.id + ' ' + f.v.motivo);

// la lista, de la más vieja a la más nueva, una por línea
const lista = [...sinDeclarar].reverse().map((f) => ({ sha: f.id, instante: f.instante, registros: [...new Set(f.v.entradas.map((c) => c.split('#')[0]))], como: f.v.como }));
for (const l of lista) console.log("LISTA   '" + l.sha + "', // " + l.instante.slice(0, 10) + ' · ' + l.registros.join(', ') + (l.como === 'tocadas' ? ' (sólo tocadas)' : ''));

// el criterio por TEXTO con la fecha sacada de git: entradas NACIDAS tras el corte que nombran
// una ruta public/ y no declaran, y que la vía del efecto NO cubre
const nacidasTrasElCorte = new Map();
for (const f of filas) {
  const { entradas: es, como } = motor.entradasDeLaUnidad(f, porFichero);
  if (como !== 'nacidas') continue;
  for (const e of es) nacidasTrasElCorte.set(e.clave, f);
}
const deInterfazPorEfecto = new Set(filas.filter((f) => f.ui.length).flatMap((f) => f.v.entradas));
const porTexto = entradas.filter((e) => nacidasTrasElCorte.has(e.clave) && m811.tocaPublic(e.cuerpo));
const porTextoSinEfecto = porTexto.filter((e) => !deInterfazPorEfecto.has(e.clave));
console.log('DERIVAR entradas nacidas tras el corte=' + nacidasTrasElCorte.size
  + ' · nombran ruta public/=' + porTexto.length
  + ' · de ellas fuera de la via del efecto=' + porTextoSinEfecto.length
  + ' · y de esas sin declarar=' + porTextoSinEfecto.filter((e) => !m811.declaraSkillUi(e.cuerpo)).length
  + ' · con Fecha>corte (las que 811 ya exige)=' + porTextoSinEfecto.filter((e) => (m811.fechaDeEntrada(e.cuerpo) || '') > '2026-09-22').length);
for (const e of porTextoSinEfecto.filter((x) => !m811.declaraSkillUi(x.cuerpo))) console.log('TEXTO   ' + e.clave.slice(0, 120));

// cruce de CONJUNTOS con el primer instrumento (otra implementación, misma pregunta)
if (CENSO) {
  const j = JSON.parse(fs.readFileSync(CENSO, 'utf8'));
  const a = new Set(j.unidades.filter((x) => !x.declara).map((x) => x.sha));
  const b = new Set(sinDeclarar.map((f) => f.id));
  console.log('CRUCE primer instrumento=' + a.size + ' · motor=' + b.size
    + ' · solo en el primero=' + JSON.stringify([...a].filter((x) => !b.has(x)))
    + ' · solo en el motor=' + JSON.stringify([...b].filter((x) => !a.has(x))));
}
fs.writeFileSync(SALIDA, JSON.stringify({ base: u.base, cuenta, lista }, null, 1));
console.log('DERIVAR EXIT=0');
