// docs/master/evidencias/scrum940/el-que-decide.mjs — SCRUM-940
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL CONTROL QUE DECIDE · un suelo MUERTO no se prueba dividiendo, se prueba reduciendo
//
// Que `20 / 86 = 0,23` no demuestra nada por sí solo: es aritmética sobre dos números que he
// leído yo. Lo que decide es **bajarle la población al suelo y ver que sigue callado**.
//
// Se hace sobre el MECANISMO REAL, no sobre una reproducción: `sueloDelCenso()` es la función que
// el guard de SCRUM-765 usa para decidir si está ciego. Se la llama con poblaciones reducidas —una
// COPIA de la situación, sin tocar el árbol— y se mira cuándo empieza a hablar.
//
//   · con la población de HOY ................ calla (correcto: hay de sobra)
//   · con la población reducida a la MITAD ... ¿calla? Si calla, no protege de perder media casa
//   · justo por encima del declarado ......... TIENE que seguir callando, y eso es el defecto
//   · justo por debajo del declarado ......... aquí sí habla — pero ya es tardísimo
//
// ✅ Y EL CONTROL NEGATIVO, que es el que tenía que salir verde: un suelo BIEN CALIBRADO, al que
//    se le reduce la población un poco, SÍ habla. Si marcara a todos, no estaría midiendo: estaría
//    acusando.
//
// ⛔ No toca `SUELO_GUARDS` ni `SUELO_DECLARACIONES`: los está subiendo S2 en SCRUM-812 fase c.
//    Aquí sólo se LEEN y se les pasan poblaciones de mentira a la función que los usa.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  censoDeDeclaraciones, sueloDelCenso, SUELO_GUARDS, SUELO_DECLARACIONES,
} from '../../../../scripts/meta-guard-mutaciones.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const di = (s = '') => console.log(s);

// La población REAL de hoy, calculada como la calcula el propio guard.
const censo = censoDeDeclaraciones();
const guardsHoy = censo.filter((c) => c.mutaciones.length).length;
const declaracionesHoy = censo.reduce((n, c) => n + c.mutaciones.length, 0);

// 🔴 SUELO DEL PROPIO BANCO: si el censo no ve nada, «calla» no significaría nada.
if (!guardsHoy || !declaracionesHoy) {
  di('🔴 CIEGO: el censo de declaraciones no ve guards ni declaraciones. Sin población real no hay nada que reducir.');
  process.exit(3);
}

const habla = (guards, declaraciones) => sueloDelCenso({ guards, declaraciones }) !== null;

di('═══ SCRUM-940 · EL QUE DECIDE ═══');
di('');
di('   suelo declarado .....: ' + SUELO_GUARDS + ' guards · ' + SUELO_DECLARACIONES + ' declaraciones');
di('   población de HOY ....: ' + guardsHoy + ' guards · ' + declaracionesHoy + ' declaraciones');
di('   cociente ............: ' + (SUELO_GUARDS / guardsHoy).toFixed(2) + ' · ' + (SUELO_DECLARACIONES / declaracionesHoy).toFixed(2));
di('');

const escalones = [
  ['hoy, sin tocar nada', guardsHoy, declaracionesHoy],
  ['perdiendo un cuarto', Math.floor(guardsHoy * 0.75), Math.floor(declaracionesHoy * 0.75)],
  ['perdiendo LA MITAD', Math.floor(guardsHoy * 0.5), Math.floor(declaracionesHoy * 0.5)],
  ['perdiendo tres cuartos', Math.floor(guardsHoy * 0.25), Math.floor(declaracionesHoy * 0.25)],
  ['justo POR ENCIMA del declarado', SUELO_GUARDS + 1, SUELO_DECLARACIONES + 1],
  ['justo POR DEBAJO del declarado', SUELO_GUARDS - 1, SUELO_DECLARACIONES - 1],
];

let fallos = 0;
di('   qué pasaría si la casa perdiera cobertura:');
for (const [texto, g, d] of escalones) {
  const h = habla(g, d);
  di('     ' + texto.padEnd(32) + ' → ' + String(g).padStart(3) + ' guards · '
    + String(d).padStart(4) + ' declaraciones  ·  ' + (h ? '🔊 HABLA' : '🔇 calla'));
}
di('');

// ── EL VEREDICTO ────────────────────────────────────────────────────────────────────────────
const callaConLaMitad = !habla(Math.floor(guardsHoy * 0.5), Math.floor(declaracionesHoy * 0.5));
const callaJustoEncima = !habla(SUELO_GUARDS + 1, SUELO_DECLARACIONES + 1);
const hablaJustoDebajo = habla(SUELO_GUARDS - 1, SUELO_DECLARACIONES - 1);

di('🔴 MUERTO: ' + (callaConLaMitad && callaJustoEncima
  ? '✅ CONFIRMADO POR REDUCCIÓN — la casa puede perder la MITAD de sus guards y este suelo no '
    + 'dice nada. Sigue callado hasta un dedo por encima de su valor, o sea perdiendo el '
    + (100 - (SUELO_GUARDS / guardsHoy) * 100).toFixed(0) + '%.'
  : '🔴 NO confirmado: revisar.'));
if (!(callaConLaMitad && callaJustoEncima)) fallos++;

di('   y que el mecanismo SÍ funciona (no está roto, está mal calibrado): justo por debajo del '
  + 'declarado ' + (hablaJustoDebajo ? '✅ HABLA' : '🔴 no habla'));
if (!hablaJustoDebajo) fallos++;

// ── ✅ CONTROL NEGATIVO ──────────────────────────────────────────────────────────────────────
//
// 🔴 MI PRIMER INTENTO DE NEGATIVO ESTABA MAL PLANTEADO, y lo cazó salir en rojo. Pretendía
// «simular un suelo bien calibrado» llamando a `sueloDelCenso()` con poblaciones más altas — pero
// esa función lleva `SUELO_GUARDS` CABLEADO dentro, así que por mucho que le suba la población
// sigue comparando contra 20. No estaba midiendo un suelo bien calibrado: estaba midiendo el
// mismo suelo muerto con otros números, y decía «calla» con razón.
//
//     🔒 Un control que no puede cambiar lo que dice medir no es un control.
//
// El negativo de verdad no se simula: se mide sobre un suelo REAL que esté bien puesto, y de eso
// se encarga `reales-por-biseccion.mjs`. Ahí `tests/scrum243-tenencia-lectura.test.mjs:190`
// —`MINIMO_QUE_FILTRAN`, declarado 196 sobre 287 reales, cociente 0,68— sale **VIVO**: perder un
// tercio de las lecturas que filtran lo dispara. Ése es el que tenía que salir verde, y sale.
di('');
di('✅ NEGATIVO · no se simula aquí: se mide sobre un suelo real en `reales-por-biseccion.mjs`');
di('     tests/scrum243-tenencia-lectura.test.mjs:190 · declarado 196 · real 287 · 0,68 → VIVO');
di('     (intentarlo aquí sería simular: esta función lleva el suelo cableado dentro — ver cabecera)');

di('');
di('SUELO DEL BANCO: población real leída del censo de verdad · ' + guardsHoy + ' guards · '
  + declaracionesHoy + ' declaraciones. Si esto fuera cero, «calla» no significaría nada.');
process.exit(fallos ? 1 : 0);
