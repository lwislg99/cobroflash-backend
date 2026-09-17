// docs/master/evidencias/scrum940/censar.mjs — SCRUM-940 · el acta del censo.
// ⚠️ ACTA, no instrumento: el instrumento vivo es `scripts/_censo-de-suelos.mjs`, al que un test
// le pone un caso conocido delante. Esto lo corre a mano quien quiera reproducir las cifras.
// ⛔ Sólo lee. No toca ningún suelo.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { censarSuelos, motivosParaNoFiarse } from '../../../../scripts/_censo-de-suelos.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const c = censarSuelos(RAIZ);
const motivos = motivosParaNoFiarse(c);
if (motivos.length) { console.log('🔴 CIEGO: ' + motivos.join(' · ')); process.exit(3); }
const di = (s = '') => console.log(s);
const pct = (n, t) => (t ? ' (' + Math.round((n / t) * 100) + '%)' : '');
const MAG = /\.(length|size|poblacion|total|ficheros|modulos|count|filas|lineas|casos|vistos|mirados)$/;

di('═══ SCRUM-940 · ① LAS DOS CIFRAS ═══');
di('');
di('   ficheros de tests/ y scripts/ mirados .....: ' + c.ficheros);
di('   de ellos, INSTRUMENTOS ....................: ' + c.instrumentos);
di('     · con al menos un suelo ..................: ' + c.conSuelo + pct(c.conSuelo, c.instrumentos));
di('     · 🔴 DESNUDOS (ningún suelo) .............: ' + c.desnudos.length + pct(c.desnudos.length, c.instrumentos));
di('');
di('   SUELOS hallados ...........................: ' + c.suelos.length);
di('     · con un mínimo concreto (>0) ...........: ' + c.conMinimoConcreto.length);
di('     · sólo exigen «que haya alguno» (>0) ....: ' + c.soloExigenAlguno.length);
di('     · sin valor resoluble ...................: ' + c.sinValorResoluble.length);
const sujeto = c.conMinimoConcreto.filter((s) => MAG.test(s.magnitud) || s.porNombre);
di('     · de POBLACIÓN CENSADA (los que envejecen): ' + sujeto.length);
di('');
di('   cómo se reconocieron (una señal basta, y ninguna es el nombre a solas):');
di('     por el NOMBRE del tope ..: ' + c.suelos.filter((s) => s.porNombre).length);
di('     por el MENSAJE de ceguera: ' + c.suelos.filter((s) => s.porMensaje).length);
di('     por ABORTAR (throw/exit) : ' + c.suelos.filter((s) => s.porAborto).length);
