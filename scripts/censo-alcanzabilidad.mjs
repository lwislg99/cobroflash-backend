#!/usr/bin/env node
// scripts/censo-alcanzabilidad.mjs — SCRUM-753
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// ¿EL TRABAJO DE UN TICKET ESTÁ **DENTRO** DE `main`? — POR ALCANZABILIDAD, NO POR EL NOMBRE.
//
//   node scripts/censo-alcanzabilidad.mjs 602 625 749     → pregunta por esos tickets
//   node scripts/censo-alcanzabilidad.mjs                 → barre la población derivable
//   node scripts/censo-alcanzabilidad.mjs --json          → el censo entero, para otro programa
//
// ⛔ NO ES EL CENSO DE SCRUM-738 (`censo-tablero-vs-arbol.mjs`), y la diferencia es el ticket.
// Aquél pregunta «¿hay evidencia que NOMBRE el ticket?» —commits, entrada de máster, EXISTENCIA
// de una rama—. Éste pregunta **¿es alcanzable?**: `git merge-base --is-ancestor`.
//
// Que exista una rama con el número no dice que se haya mergeado, y ése es el falso positivo que
// costó dinero: el 4-sep-2026 un barrido que comparaba IDENTIFICADORES dio **27 ramas «con
// trabajo perdido»**; con `--is-ancestor` eran **13**, y doce llevaban muertas desde agosto.
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴🔴 LÉELO ANTES DE USAR LA SALIDA: **EL CENSO DECIDE QUÉ NO ASIGNAR, NO QUÉ ASIGNAR.**
//
// Ninguna de sus señales distingue «se construyó» de «se construyó LO QUE PEDÍAS». Medido el
// 5-sep-2026: un ticket salió ENTERO de fachada y estaba PARCIAL, y otro entero **con el alcance
// invertido**. Un `DENTRO` es un motivo para MIRAR antes de encargar, nunca un motivo para cerrar.
//
// 🔴🔴 Y LO QUE ESTE INSTRUMENTO ES: **NO PUEDE VER LO ASIGNABLE.** Un ticket sin rama y sin
// entrada no entra en la población — y lo asignable es exactamente lo que no tiene evidencia.
// El conjunto que este censo no puede enumerar es, punto por punto, el conjunto que querrías
// repartir. Por eso acepta números sueltos: a lo que NOMBRAS se le puede contestar.
//
// ⛔ ESTO PROPONE, NUNCA ACTÚA. No cierra tickets, no toca el tablero y no borra ramas.
//
// ── EL PROCEDIMIENTO, EJECUTADO Y NO RECOMENDADO ─────────────────────────────────────────────
//   ① `git fetch origin +refs/heads/*:refs/remotes/origin/*`  ← lo hace ESTE script, siempre.
//   ② se CONGELA el sha de `origin/main` y todo se mide contra ese objeto.
//   ③ se leen las refs YA TRAÍDAS (`refs/remotes/origin/`) UNA vez.
//
// El ① no es una nota en la cabecera porque los worktrees COMPARTEN refs (R10 de
// `docs/ERRORES_ASESOR.md`): tu `refs/remotes/origin/*` se mueve cuando trae otra sesión. Con
// `--sin-traer` se puede medir sin red, y entonces la salida lo DICE.
//
// SALIDAS: 0 medido · 2 no supe medir (suelo).
// ═════════════════════════════════════════════════════════════════════════════════════════════
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  instantanea, censar, resumenDe, motivosParaNoFiarse, titularConSalvedad, ESTADOS, MOTIVOS,
} from './_censo-alcanzabilidad.mjs';

// ⚠️ `fileURLToPath` y NO `new URL(...).pathname`: esta ruta tiene un ESPACIO («Javier Pereira»)
// y el `pathname` lo devuelve percent-codificado, así que la comparación falla EN SILENCIO y el
// CLI no imprime nada. Es el defecto de SCRUM-730, y ya mordió al censo de SCRUM-738.
const AQUI = fileURLToPath(import.meta.url);
const RAIZ = path.join(path.dirname(AQUI), '..');

export const SALIDA_NO_SUPE_MEDIR = 2;

if (process.argv[1] && path.resolve(process.argv[1]) === AQUI) {
  const argv = process.argv.slice(2);
  const numeros = argv.filter((a) => /^\d+$/.test(a)).map(Number);
  const traer = !argv.includes('--sin-traer');

  const inst = instantanea({ raiz: RAIZ, traer });

  // 🔴 EL SUELO, EN DOS ETAPAS. ÉSTA VA **ANTES** DE CENSAR NADA.
  //
  // Si el árbol no puede contestar —no se resolvió la referencia, no hay refs, el clon trae una
  // sola rama— no se censa: preguntar 450 veces contra un sha que no existe tarda un minuto y
  // termina en una traza de git. Medido el 6-sep-2026 reproduciendo el checkout por defecto de
  // `actions/checkout`: `rev-parse origin/main^{commit}` sale con status 128.
  //
  // La segunda etapa (¿algún ticket del lote tiene rama?) necesita las filas y va más abajo. Las
  // dos salen por el MISMO código 2: quien lo lee no tiene que distinguirlas para saber que no
  // hay medición.
  const incapacidad = motivosParaNoFiarse(inst, null);
  if (incapacidad.length) {
    console.error('\n🔴 NO SE HA PODIDO MEDIR ALCANZABILIDAD — no se censa nada:\n');
    for (const m of incapacidad) console.error(`   · ${m}`);
    console.error(`\n   árbol: ${inst.raiz}  ·  ref pedida: ${inst.ref}  ·  ${inst.hora}`);
    console.error('   Esto NO significa «no está en `main`». Comprueba el fetch y el refspec.\n');
    process.exit(SALIDA_NO_SUPE_MEDIR);
  }

  const censo = censar(inst, { numeros });
  const resumen = resumenDe(censo.filas);

  if (argv.includes('--json')) {
    console.log(JSON.stringify({
      arbol: inst.raiz, ref: inst.ref, sha: inst.sha, hora: inst.hora, traido: traer,
      poblacion: { ...censo.poblacion, deRamas: undefined, deEntradas: undefined },
      resumen, filas: censo.filas,
      suelo: motivosParaNoFiarse(inst, censo.filas),
      leeme: titularConSalvedad(resumen),
    }, null, 2));
    // El suelo también decide el código de salida en modo JSON: un programa que lea esto tiene que
    // poder distinguir «medido» de «no supe medir» sin parsear prosa.
    process.exit(motivosParaNoFiarse(inst, censo.filas).length ? SALIDA_NO_SUPE_MEDIR : 0);
  }

  // ── LA CABECERA: árbol, sha y hora. Todo recuento lleva su unidad, su árbol y su hora ───────
  console.log(`\n${'═'.repeat(90)}`);
  console.log('CENSO DE ALCANZABILIDAD · ¿está el trabajo DENTRO de la historia de `main`?');
  console.log(`${'═'.repeat(90)}`);
  console.log(`  árbol ......... ${inst.raiz}`);
  console.log(`  ${inst.ref} ... ${inst.sha}   (sha CONGELADO: todo se mide contra este objeto)`);
  console.log(`  hora .......... ${inst.hora}`);
  console.log(`  refs .......... ${censo.poblacion.ramasLeidas} ramas de refs/remotes/origin/`
    + `${traer ? ' (traídas ahora)' : ' 🔴 SIN TRAER: pueden ser de hace horas'}`
    + ` · ${censo.poblacion.entradasLeidas} ficheros en docs/master/`);
  console.log(`  unidad ........ TICKETS en las filas; RAMAS y COMMITS en las columnas.`);

  // 🔴 EL SUELO, ANTES DE ENSEÑAR NINGUNA FILA. Un censo que no ha podido mirar no dice «no hay
  // trabajo perdido»: dice que no supo mirar, y son cosas opuestas escritas igual.
  const motivos = motivosParaNoFiarse(inst, censo.filas);
  if (motivos.length) {
    console.error('\n🔴 NO SE HA PODIDO MEDIR ALCANZABILIDAD — no se informa de nada:\n');
    for (const m of motivos) console.error(`   · ${m}`);
    console.error('\n   Esto NO significa «no está en `main`». Comprueba el fetch y el refspec.\n');
    process.exit(SALIDA_NO_SUPE_MEDIR);
  }

  const orden = { [ESTADOS.FUERA]: 0, [ESTADOS.NO_MEDIBLE]: 1, [ESTADOS.DENTRO]: 2 };
  const filas = [...censo.filas].sort((a, b) => orden[a.estado] - orden[b.estado] || a.numero - b.numero);

  console.log(`\n\n① FUERA · ramas NO alcanzables desde el sha medido — trabajo vivo sin mergear`);
  console.log('   Es la única lista de la que sale «hay trabajo que se puede perder».');
  console.log('   🔴 MIRA LA COLUMNA `merges`: un FUERA con merges ALTO es justo el caso que hace');
  console.log('      falta este censo. SCRUM-161 tiene CINCO merges que nombran ramas suyas y aun');
  console.log('      así su punta está fuera — un barrido por nombre lo habría dado por mergeado.\n');
  const fuera = filas.filter((f) => f.estado === ESTADOS.FUERA);
  if (!fuera.length) console.log('   (ninguno)');
  for (const f of fuera) {
    console.log(`   ${f.ticket.padEnd(12)} merges ${String(f.corroboracion.merges).padStart(3)}`
      + ` · commits ${String(f.corroboracion.commits).padStart(3)}   `
      + f.ramas.filter((r) => r.clase === 'viva').map((r) => `${r.nombre} (+${r.adelanto})`).join(' · '));
  }

  console.log(`\n\n② 🔴 NO MEDIBLE · y CADA UNO CON SU MOTIVO, porque cada uno se acciona distinto`);
  console.log('   ⛔ Esto NO es «no está en `main`». Es «no se ha podido preguntar».\n');
  const nm = filas.filter((f) => f.estado === ESTADOS.NO_MEDIBLE);
  if (!nm.length) console.log('   (ninguno)');
  for (const f of nm) {
    const c = f.corroboracion;
    console.log(`   ${f.ticket.padEnd(12)} ${String(f.motivo).padEnd(24)}`
      + `merges ${String(c.merges).padStart(3)} · commits ${String(c.commits).padStart(3)}`);
  }
  if (nm.some((f) => f.motivo === MOTIVOS.SIN_RAMA)) {
    console.log('\n   ⚠️ «sin rama» con corroboración > 0 es casi siempre una rama MERGEADA Y BORRADA:');
    console.log('      el trabajo está dentro y la ref ya no existe. Con corroboración 0, no se sabe.');
  }

  console.log(`\n\n③ DENTRO · todas sus ramas son alcanzables desde el sha medido`);
  console.log('   ⚠️ NO significa «hecho». Ver la salvedad del final antes de usar esta lista.\n');
  const dentro = filas.filter((f) => f.estado === ESTADOS.DENTRO);
  if (!dentro.length) console.log('   (ninguno)');
  for (const f of dentro) {
    console.log(`   ${f.ticket.padEnd(12)} ${String(f.ramas.length).padStart(2)} rama(s) · `
      + `merges ${String(f.corroboracion.merges).padStart(3)}`
      + (f.sinCorroborar ? '   🔴 SIN CORROBORAR: ningún merge nombra una rama suya' : ''));
  }

  console.log(`\n\n④ CONTROL POSITIVO · ¿sabe este censo decir que NO?`);
  console.log('   Si aquí no hay nadie y ① está vacío, el detector no ha cambiado de respuesta ni');
  console.log('   una vez, y un barrido que sólo sabe decir SI no ha medido nada.\n');
  console.log(`   ramas vivas vistas en el árbol: ${censo.agrupadas.vivas}`
    + ` · ya en main: ${censo.agrupadas.enMain} · indeterminadas: ${censo.agrupadas.indeterminadas}`);

  // 🔴 EL TITULAR SALE DE `titularConSalvedad`, QUE DEVUELVE NÚMERO Y SALVEDAD JUNTOS.
  // Nunca se imprime el recuento por su cuenta: es lo único que impide que «452 de 453» acabe
  // pegado en un informe sin la frase que dice qué NO significa.
  console.log(`\n${'═'.repeat(90)}`);
  console.log(titularConSalvedad(resumen));
  console.log('⛔ Los tickets NO se cierran desde aquí. Esto es una propuesta de qué NO asignar.');
  console.log(`${'═'.repeat(90)}\n`);
}
