#!/usr/bin/env node
// scripts/trinquete-de-zona.mjs — SCRUM-813 · el trinquete de zona horaria, por la línea de órdenes.
//
//   npm run trinquete:zona                    → la tanda entera en las dos zonas extremas
//   npm run trinquete:zona -- --zonas UTC,Pacific/Midway
//   npm run trinquete:zona -- --solo-canarios → sólo el autocontrol (segundos, sin tocar la tanda)
//   npm run trinquete:zona -- --sin-confirmar → sin la repesca fichero a fichero
//
// EL MOTIVO ENTERO ESTÁ EN `scripts/_trinquete-de-zona.mjs`. Aquí sólo está el orden de las cosas
// y cómo se cuenta lo que salió.
//
// ── POR QUÉ FUERA DE `npm test` ─────────────────────────────────────────────────────────────
// Una pasada de la tanda cuesta minutos, y esto son DOS. Dentro de `npm test` nadie lo correría
// dos veces al día: se convertiría en el comando que la gente aprende a saltarse. Vive donde vive
// `meta:mutaciones` — job propio del CI, en paralelo con la tanda, sin alargar el PR.
//
// Y para que el instrumento no se pudra entre pasada y pasada, su DETECTOR sí corre en cada
// `npm test`: `tests/scrum813-trinquete-de-zona.test.mjs` mide los cuatro canarios por este mismo
// camino en segundos. Lo caro es barrer 800 ficheros; comprobar que el aparato ve, no.
//
// SALIDAS: 0 nada nuevo · 1 HABLA (hay una nueva) · 2 CIEGO · 3 una CENSADA se apagó.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';   // SCRUM-730: `pathname` no decodifica el espacio

import {
  CANARIOS, CENSADAS, RAIZ, SALIDA_CIEGO, ZONAS,
  arbolQuieto, cambianDeVeredicto, escribirCanarios, ficherosDeLaTanda, juzgarCanarios,
  marcaDelArbol, medirEnZona, sondaDeZona, veredicto,
} from './_trinquete-de-zona.mjs';

const AQUI = fileURLToPath(import.meta.url);
if (!process.argv[1] || path.resolve(process.argv[1]) !== AQUI) process.exit(0);

const args = process.argv.slice(2);
const opcion = (nombre) => {
  const i = args.indexOf(nombre);
  return i >= 0 ? args[i + 1] : null;
};
const zonas = (opcion('--zonas') || '').split(',').map((z) => z.trim()).filter(Boolean);
const ZONAS_USADAS = zonas.length ? zonas : ZONAS;
const soloCanarios = args.includes('--solo-canarios');
const sinConfirmar = args.includes('--sin-confirmar');

const raya = (c = '═') => console.log(c.repeat(94));
const salir = (codigo) => process.exit(codigo);

raya();
console.log('TRINQUETE DE ZONA HORARIA · ¿ha crecido la familia de tests que miden la máquina?');
raya();
console.log(`  árbol ......... ${RAIZ}`);
console.log(`  zonas ......... ${ZONAS_USADAS.join('  ·  ')}`);
console.log(`  censadas ...... ${CENSADAS.length} (las que HOY dependen de la zona, a propósito)`);
console.log(`  alcance ....... ${soloCanarios ? 'SÓLO CANARIOS (autocontrol)' : 'la tanda entera + los 4 canarios'}`);

// ── ① dist/ ─────────────────────────────────────────────────────────────────────────────────
// Media tanda importa de `dist/`. Sin compilar, esos ficheros mueren AL CARGAR en las dos zonas
// por igual — o sea que NO cambian de veredicto y el censo saldría en un cero limpio habiendo
// medido nada. Es exactamente el falso verde que este instrumento existe para no dar.
if (!soloCanarios && !fs.existsSync(path.join(RAIZ, 'dist'))) {
  console.error('\n🔴 CIEGO · no hay `dist/`. Compila antes (`npm run build`): sin él media tanda');
  console.error('   muere al cargar EN LAS DOS ZONAS, no cambia de veredicto, y el cero sería falso.\n');
  salir(SALIDA_CIEGO);
}

// ── ② la sonda ──────────────────────────────────────────────────────────────────────────────
console.log('\nSONDA · ¿llega de verdad la zona al proceso hijo?\n');
const sondas = ZONAS_USADAS.map(sondaDeZona);
for (const s of sondas) {
  console.log(`   ${s.ok ? '✔' : '🔴'} ${s.zona.padEnd(22)} el hijo ve: ${s.vista || '(nada)'}`);
}
if (sondas.some((s) => !s.ok)) {
  console.error('\n🔴 CIEGO · la zona NO llega al hijo. Todas las pasadas medirían la misma zona y el');
  console.error('   censo devolvería un cero perfecto que no significa nada. No se mide.\n');
  salir(SALIDA_CIEGO);
}

// ── ③ canarios + tanda ──────────────────────────────────────────────────────────────────────
const dirTrabajo = fs.mkdtempSync(path.join(os.tmpdir(), 'trinquete-zona-'));
const canarios = escribirCanarios(path.join(dirTrabajo, 'canarios'));
const deLaTanda = soloCanarios ? [] : ficherosDeLaTanda(RAIZ);
const ficheros = [...deLaTanda, ...canarios.map((c) => c.ruta)];
console.log(`\n   ${deLaTanda.length} ficheros de la tanda + ${canarios.length} canarios = ${ficheros.length}\n`);

// 🔴 LA MARCA DEL ÁRBOL, ANTES DE LA PRIMERA PASADA. El diferencial compara dos pasadas: si el
// árbol cambia entre ellas, un guard que LEE ficheros da distinto por eso y no por la zona. Pasó
// mientras se construía este instrumento.
const marcaAntes = marcaDelArbol(RAIZ);
if (!marcaAntes.ok) {
  console.log(`\n⚠️ SIN MARCA DEL ÁRBOL (${marcaAntes.porque}). Se mide igual —esta marca protege`);
  console.log('   contra un hallazgo falso, no forma parte de la medida— pero si algo edita el');
  console.log('   árbol durante las dos pasadas, nadie se va a enterar.');
}

const medidas = [];
for (const zona of ZONAS_USADAS) {
  process.stdout.write(`   midiendo en ${zona.padEnd(22)} … `);
  const m = medirEnZona({ zona, ficheros, raiz: RAIZ, salida: path.join(dirTrabajo, `${zona.replace(/\W/g, '_')}.json`) });
  medidas.push(m);
  if (!m.ok) console.log(`🔴 ${m.porque}`);
  else console.log(`${String(m.veredictos.size).padStart(5)} pruebas · ${m.segundos.toFixed(0)} s · el hijo vio ${m.zonaVista}`);
}

const quieto = arbolQuieto(marcaAntes, marcaDelArbol(RAIZ));
console.log(`\n   árbol ${quieto.medible ? (quieto.cambios.length ? '🔴 SE MOVIÓ durante la medición' : 'quieto durante las dos pasadas ✔') : '(sin marca: no se pudo comprobar)'}`);

let cambian = medidas.every((m) => m.ok) ? cambianDeVeredicto(medidas) : [];

// ── ④ LA REPESCA · fichero a fichero, para no confundir zona con parpadeo ──────────────────
//
// Un test intermitente cambia de veredicto entre dos pasadas sin que la zona tenga nada que ver, y
// un trinquete que confunde parpadeo con dependencia de zona grita en falso — y un guard que
// grita en falso se apaga. Cada candidato se vuelve a medir con SU FICHERO SOLO, en las mismas
// zonas. Cuesta segundos porque son pocos ficheros.
//
// ⚠️ LÍMITE DECLARADO: una dependencia de zona que sólo se manifieste EN COMPAÑÍA de otros
// ficheros no se confirmaría, y aquí saldría como «no confirmada» en vez de como hallazgo. No se
// ha visto ningún caso así; se escribe porque no se ha demostrado que no pueda existir.
const noConfirmadas = [];
if (cambian.length && !sinConfirmar) {
  const porFichero = new Map();
  for (const c of cambian) {
    const abs = path.isAbsolute(c.fichero) ? c.fichero : path.join(RAIZ, c.fichero);
    if (!porFichero.has(abs)) porFichero.set(abs, []);
    porFichero.get(abs).push(c);
  }
  console.log(`\nREPESCA · ${porFichero.size} fichero(s) con candidatos, medidos a solas\n`);
  const confirmadas = new Set();
  for (const [abs] of porFichero) {
    const solo = ZONAS_USADAS.map((zona) => medirEnZona({
      zona, ficheros: [abs], raiz: RAIZ,
      salida: path.join(dirTrabajo, `solo-${path.basename(abs)}-${zona.replace(/\W/g, '_')}.json`),
    }));
    const otra = solo.every((m) => m.ok) ? cambianDeVeredicto(solo) : [];
    for (const c of otra) confirmadas.add(c.clave);
    console.log(`   ${path.basename(abs).padEnd(46)} confirma ${otra.length} de ${porFichero.get(abs).length}`);
  }
  for (const c of cambian) if (!confirmadas.has(c.clave)) noConfirmadas.push(c);
  cambian = cambian.filter((c) => confirmadas.has(c.clave));
}

// ── ⑤ los canarios juzgan al instrumento ANTES de que el instrumento juzgue al árbol ───────
//
// 🔴 SE SEPARAN POR SU RUTA EXACTA, no por el nombre del fichero. Los canarios viven fuera del
// árbol, así que su ruta relativa empieza por `../`; un fichero de `tests/` no puede coincidir con
// eso ni llamándose igual. Comparar por `basename` habría dejado abierta la puerta a que un test
// del árbol se colara como canario —y con ello a que el autocontrol se diera por bueno sin serlo.
const rutasCanario = new Set(canarios.map((c) => c.rutaClave));
const esCanario = (c) => rutasCanario.has(c.fichero);
const controles = juzgarCanarios(cambian, canarios);
const enElArbol = cambian.filter((c) => !esCanario(c));

console.log('\nAUTOCONTROL · los cuatro canarios, por el mismo camino y en las mismas zonas\n');
for (const c of canarios) {
  const visto = cambian.some((x) => x.fichero === c.rutaClave);
  const esperado = c.clase === 'dependiente';
  console.log(`   ${visto === esperado ? '✔' : '🔴'} ${c.clase.toUpperCase().padEnd(12)} ${c.fichero.padEnd(34)} `
    + `${visto ? 'DENUNCIADO' : 'no denunciado'} (se esperaba ${esperado ? 'que lo fuera' : 'que no'})`);
}

// ── ⑥ el veredicto ──────────────────────────────────────────────────────────────────────────
//
// 🔴 CON `--solo-canarios` NO SE JUZGA EL ÁRBOL, Y ESO NO ES UNA CONCESIÓN. Ese modo no mide ni un
// fichero de `tests/`, así que su «cambian 0» es un no-he-mirado, no un no-hay. Juzgar las
// censadas con esa medida diría «se apagaron las tres» sobre una tanda que nunca corrió — el
// falso hallazgo es tan dañino como el falso verde. Lo que sí juzga ese modo es el INSTRUMENTO:
// los cuatro canarios corren enteros y siguen decidiendo CIEGO.
const v = veredicto({
  cambianEnElArbol: enElArbol,
  censadas: soloCanarios ? [] : CENSADAS,
  medidas,
  controles,
  quieto,
});

console.log(soloCanarios
  ? '\n\nEL ÁRBOL NO SE HA MIRADO (`--solo-canarios`): esto NO es un «cambian 0».\n'
  : `\n\nCAMBIAN DE VEREDICTO EN EL ÁRBOL: ${enElArbol.length}  (censadas: ${CENSADAS.length})\n`);
for (const c of enElArbol) {
  const censada = CENSADAS.find((x) => x.clave === c.clave);
  console.log(`   ${censada ? '·' : '🔴 NUEVA'} ${c.prueba}`);
  console.log(`        ${c.fichero}`);
  console.log(`        ${c.porZona.map((p) => `${p.zona} → ${p.veredicto}`).join('   ·   ')}`);
  if (censada) console.log(`        censada: ${censada.parado_en}`);
}
if (!enElArbol.length) console.log('   (ninguna)');

if (noConfirmadas.length) {
  console.log(`\n⚠️ NO CONFIRMADAS a solas · ${noConfirmadas.length} — parpadeo, o dependencia que sólo`);
  console.log('   sale en compañía. NO cuentan para el veredicto, y por eso se imprimen aquí.\n');
  for (const c of noConfirmadas) console.log(`   · ${c.clave}`);
}

console.log('');
raya();
if (v.estado === 'OK' && soloCanarios) {
  console.log('✔ EL INSTRUMENTO VE · los cuatro canarios se han comportado.');
  console.log('  🔴 Y ESO ES TODO LO QUE DICE. Este modo NO mira `tests/`: no sabe si la familia ha');
  console.log('  crecido ni si las censadas siguen ahí. Para eso, `npm run trinquete:zona` entero.');
} else if (v.estado === 'OK') {
  console.log(`✔ TRINQUETE EN VERDE · la familia no ha crecido, y las ${CENSADAS.length} censadas siguen ahí.`);
  console.log('  Esto NO dice que el árbol no tenga defectos de zona: dice que ninguno CAMBIA DE');
  console.log(`  VEREDICTO entre ${ZONAS_USADAS.join(' y ')}. Un borde que caiga fuera de esas dos no se ve.`);
} else if (v.estado === 'CIEGO') {
  console.log('🔴 CIEGO · NO se emite veredicto sobre el árbol:');
  for (const m of v.motivos) console.log(`     · ${m}`);
  if (v.cieloRaso) {
    console.log('\n   Si de verdad se han arreglado —SCRUM-643 §2·A decidido—, lo que toca es borrar');
    console.log('   sus entradas de `CENSADAS` en `scripts/_trinquete-de-zona.mjs` en el mismo commit');
    console.log('   que las arregla, y escribir la decisión al lado. Con la lista vacía este suelo');
    console.log('   deja de aplicar y el instrumento sigue vigilado por sus cuatro canarios.');
  }
} else if (v.estado === 'HABLA') {
  console.log('🔴 EL TRINQUETE HABLA · hay pruebas que dependen de la zona de la máquina y NO estaban');
  console.log('   censadas. Han entrado con este cambio o con uno reciente.\n');
  for (const n of v.nuevas) console.log(`     · ${n.clave}`);
  console.log('\n   QUÉ HACER, y en este orden:');
  console.log('     ① Arreglar el TEST fijando su zona a mano — y la zona que se fija es la de la');
  console.log('        máquina donde ESE código corre de verdad: front → la del profesional;');
  console.log('        servidor → UTC, que es lo que corre en Railway.');
  console.log('     ② Si además está mal EL PRODUCTO, eso es otro ticket y NO se arregla fijando el');
  console.log('        test: fijarlo esconde el defecto. Se mide, se escribe y se para.');
  console.log('     ③ Meterlo en `CENSADAS` sólo si se decide NO arreglarlo, con el motivo escrito.');
} else if (v.estado === 'APAGADA') {
  console.log('🔴 UNA CENSADA SE APAGÓ · dejó de cambiar de veredicto y nadie lo ha declarado:\n');
  for (const a of v.apagadas) {
    console.log(`     · ${a.clave}`);
    console.log(`       estaba parada en: ${a.parado_en}`);
  }
  console.log('\n   Quedan otras cambiando, así que el instrumento SÍ ha medido: lo que hay que');
  console.log('   mirar es qué le pasó a ésta. Si el arreglo es deliberado —SCRUM-643 §2·A');
  console.log('   decidido—, borra su entrada de `CENSADAS` en `scripts/_trinquete-de-zona.mjs`');
  console.log('   y escribe la decisión en el commit.');
}
raya();
console.log('');

salir(v.salida);
