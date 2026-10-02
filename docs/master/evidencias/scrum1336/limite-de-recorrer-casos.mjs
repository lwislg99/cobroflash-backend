// limite-de-recorrer-casos.mjs — SCRUM-1336 · UN LÍMITE DE `recorrerCasos`, MEDIDO Y NO ARREGLADO.
//
//   node docs/master/evidencias/scrum1336/limite-de-recorrer-casos.mjs
//
// `recorrerCasos(casos, juzgarCaso)` suma lo que DEVUELVE cada caso. Si un caso apunta un hallazgo
// en una lista suya y DESPUÉS lanza, no llega a devolverla: el recorrido apunta el ciego y el
// hallazgo se pierde. Con un solo caso así, el veredicto sale 2 («no supe medir») habiendo
// encontrado un defecto: un hallazgo real convertido en ciego.
//
// Los siete guards de SCRUM-1336 no caen ahí: los que acumulan hallazgos dentro de un caso los
// apuntan en listas del MÓDULO, que sobreviven al `throw`. Es un límite de la pieza común, que es
// de SCRUM-1327: aquí se enseña y se declara, no se toca.
import { recorrerCasos, veredictoDe } from '../../../../scripts/_hallazgos-y-ciegos.mjs';

const CASOS = ['390 px'];

// ① La forma en que se pierde: la lista es del caso.
const enLaMano = await recorrerCasos(CASOS, async (caso) => {
  const suyas = { hallazgos: [], ciegos: [] };
  suyas.hallazgos.push(caso + ': la nota no cabe');
  throw new Error('Execution context was destroyed');
});
const v1 = veredictoDe(enLaMano);

// ② La forma en que no se pierde: la lista es del módulo, y el caso devuelve vacío.
const hallazgos = [];
const delModulo = await recorrerCasos(CASOS, async (caso) => {
  hallazgos.push(caso + ': la nota no cabe');
  throw new Error('Execution context was destroyed');
});
const v2 = veredictoDe({ hallazgos, ciegos: delModulo.ciegos });

console.log('POBLACIÓN: 1 caso que apunta UN hallazgo y después lanza');
console.log('① lista del CASO   → ' + v1.linea + '   (hallazgos que llegan: ' + enLaMano.hallazgos.length + ')');
console.log('② lista del MÓDULO → ' + v2.linea + '   (hallazgos que llegan: ' + hallazgos.length + ')');
const visto = v1.codigo === 2 && enLaMano.hallazgos.length === 0 && v2.codigo === 1 && hallazgos.length === 1;
console.log(visto ? 'EL LÍMITE EXISTE: con la lista en la mano, el hallazgo se pierde y sale 2.' : 'NO SE REPRODUCE: la pieza ya no pierde el hallazgo (o el banco está mal).');
console.log('EXIT=' + (visto ? 0 : 1));
process.exitCode = visto ? 0 : 1;
