// docs/master/evidencias/scrum927/censar.mjs — SCRUM-927 · EL ACTA DE ESTA TANDA.
//
// ⚠️ ESTE FICHERO ES UN ACTA, NO UN INSTRUMENTO, y lo dice él mismo para no ser lo que mide: el
// instrumento vivo es `scripts/_censo-de-censos.mjs`, al que un test le pone delante un caso
// conocido en cada tanda. Esto sólo lo corre a mano quien quiera reproducir las cifras del
// registro. Se declara por la misma razón que existe el ticket.
//
// ⛔ No ejecuta nada de lo que censa. Sólo lee y parsea.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  censarCensos, censarExcepciones, motivosParaNoFiarse, RAICES_FUERA_DEL_ARBOL,
} from '../../../../scripts/_censo-de-censos.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const di = (s = '') => console.log(s);
const pct = (n, total) => total ? ' (' + Math.round((n / total) * 100) + '%)' : '';

const c = censarCensos(RAIZ);
const motivos = motivosParaNoFiarse(c);
if (motivos.length) {
  di('🔴 CIEGO: ' + motivos.join(' · '));
  process.exit(3);
}

di('═══ SCRUM-927 · ① LAS DOS CIFRAS, JUNTAS ═══');
di('');
di('   población mirada (ficheros ejecutables de docs/ y scripts/): ' + c.poblacion);
di('   de ellos, CONTIENEN UNA MEDICIÓN ..........................: ' + c.mediciones.length);
di('');
di('   de esas ' + c.mediciones.length + ' mediciones:');
di('     ✅ LAS EJECUTA ALGO (tanda, CI o hook) ...: ' + c.ejecutadas.length + pct(c.ejecutadas.length, c.mediciones.length));
di('     ⚠️  invocables A MANO (npm, nadie las llama): ' + c.aMano.length + pct(c.aMano.length, c.mediciones.length));
di('     🔴 NO LAS CORRE NADIE .....................: ' + c.nadie.length + pct(c.nadie.length, c.mediciones.length));
di('     ' + '-'.repeat(52));
const suma = c.ejecutadas.length + c.aMano.length + c.nadie.length;
di('     suman: ' + suma + ' de ' + c.mediciones.length + (suma === c.mediciones.length ? '  ✅ cuadra' : '  🔴 NO CUADRA'));
di('');
di('   semillas por raíz: ' + [...c.raices].map(([k, v]) => k + '=' + v).join(' · '));
for (const [f, motivo] of RAICES_FUERA_DEL_ARBOL) di('   raíz declarada fuera del árbol: ' + f + ' — ' + motivo);

// ── ② POR QUÉ NO CORREN ────────────────────────────────────────────────────────────────────
di('');
di('═══ ② POR QUÉ NO CORREN · tres formas, tres remedios ═══');
di('');
const dormidas = [...c.nadie, ...c.aMano];
const enDocs = dormidas.filter((f) => f.fichero.startsWith('docs/'));
const enScripts = dormidas.filter((f) => f.fichero.startsWith('scripts/'));
const reproducibles = dormidas.filter((f) => f.reproducible);
di('   (a) NUNCA SE PENSÓ QUE CORRIERAN — actas de un ticket, en docs/master/evidencias/: ' + enDocs.length);
di('       Remedio: ninguno. Un acta fechada es un dato, y está bien que lo sea.');
di('   (b) CORREN PERO NADIE MIRA SU SALIDA — invocables por npm que CI no lanza: ' + c.aMano.length);
di('       Remedio: o las lanza CI y su salida decide, o se admite que son de consulta.');
di('   (c) SE PUEDEN VOLVER A CORRER Y NADIE LO HACE — en scripts/, reproducibles: '
  + enScripts.filter((f) => f.reproducible).length);
di('       Remedio: candidatas a guard. Son las únicas que lo son (ver ④).');
di('');
di('   de las ' + dormidas.length + ' dormidas, REPRODUCIBLES sobre el árbol solo: ' + reproducibles.length
  + ' · atadas a algo efímero (argumento, ruta absoluta, red, base, navegador): ' + (dormidas.length - reproducibles.length));

// ── ③ LAS EXCEPCIONES APARCADAS ────────────────────────────────────────────────────────────
const e = censarExcepciones(RAIZ);
di('');
di('═══ ③ LAS EXCEPCIONES APARCADAS ═══');
di('');
di('   listas de excepción declaradas ..................: ' + e.listas.length);
di('     ✅ VIGILADAS · algo AFIRMA sobre ellas; si cambian, salta: ' + e.vigiladas.length);
di('     ⚠️  SÓLO AVISAN · su consecuencia acaba en un console.log : ' + e.soloAvisan.length);
di('     🔴 APARCADAS · sólo sirven para excluir; nada las mira ...: ' + e.aparcadas.length);
di('     · vacías (no dejan a nadie fuera) ........................: ' + e.vacias.length);
di('   elementos fuera de los números, en listas no vigiladas .....: ' + e.elementosAparcados);
di('   listas sin un motivo escrito al lado ........................: ' + e.sinMotivo.length);
di('');
di('   ⚠️ LAS QUE SÓLO AVISAN (el hallazgo: contar no es avisar)');
for (const l of [...e.soloAvisan].sort((a, b) => b.elementos - a.elementos)) {
  di('      ' + String(l.elementos).padStart(4) + '  ' + l.nombre.padEnd(32) + l.fichero + ':' + l.linea);
}
di('');
di('   🔴 APARCADAS con más elementos');
for (const l of [...e.aparcadas].sort((a, b) => b.elementos - a.elementos).slice(0, 12)) {
  di('      ' + String(l.elementos).padStart(4) + '  ' + l.nombre.padEnd(32) + l.fichero + ':' + l.linea
    + (l.conMotivo ? '' : '  [SIN MOTIVO ESCRITO]'));
}
di('');
di('   🔴 SIN MOTIVO ESCRITO (una excepción sin causa convierte un fallo en una característica)');
for (const l of e.sinMotivo) {
  di('      ' + l.nombre.padEnd(32) + l.fichero + ':' + l.linea + '  (' + l.elementos + ' elem · '
    + (l.vigilada ? 'vigilada' : l.soloAvisa ? 'sólo avisa' : 'APARCADA') + ')');
}
