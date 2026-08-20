// tests/scrum565-encargo-completo.test.mjs — SCRUM-565
//
// UN ENCARGO CORTADO NO PARECE CORTADO: PARECE MÁS CORTO.
//
// El 20-ago-2026 uno llegó con el punto 3 a media frase y las prohibiciones acabando en un «⛔»
// vacío. Se supo porque la sesión lo declaró — disciplina, no mecanismo. Y como lo que se pierde
// es el FINAL, y ahí van las restricciones de seguridad, **un encargo truncado es un encargo sin
// las prohibiciones**.
//
// ── LO QUE ESTE FICHERO NO PUEDE DECIR ─────────────────────────────────────────────────────
// 🔴 NO puede decir que una SESIÓN pare. Eso es comportamiento del modelo, no código: lo único
//    verificable aquí es que el mecanismo da el veredicto correcto y que la regla que manda
//    usarlo está escrita donde se carga siempre. La parte que falta está declarada en
//    `docs/master/SCRUM-565.md`.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { comprobar, MARCADOR, seccion, RECUENTOS } from '../scripts/comprobar-encargo.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKILL = fs.readFileSync(path.join(RAIZ, '.claude', 'skills', 'cerebro-yaqu', 'SKILL.md'), 'utf8');
const PKG = JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8'));

/**
 * Un encargo de mentira con la MISMA forma que los de verdad, incluida la cita del marcador en
 * la cabecera — que es justo lo que rompió la primera versión del comprobador.
 */
function encargo({ alcance = 4, prohibiciones = 4, suelos = 1, seguridad = 3, cierre = true } = {}) {
  const p = [];
  p.push(`📋 ESTE ENCARGO TIENE: ${alcance} puntos de alcance · ${prohibiciones} prohibiciones · `
    + `${suelos} suelo · 1 bloque de restricciones de seguridad con ${seguridad} líneas.`);
  p.push(`   Si no ves «${MARCADOR}» al final, PARA Y DILO. No trabajes sobre el trozo.`);
  p.push('', 'SCRUM-000 · un encargo de prueba.', '');
  p.push('## ALCANCE', '');
  for (let i = 1; i <= alcance; i += 1) p.push(`${i}. ⬜ Un punto de alcance.`);
  p.push('');
  for (let i = 0; i < suelos; i += 1) p.push('## SUELO', '', 'Si sale cero, se declara ciego.', '');
  p.push('## 🛑 LO QUE NO SE HACE', '');
  for (let i = 0; i < prohibiciones; i += 1) p.push('⛔ Una prohibición.');
  p.push('');
  p.push('## 🛑 RESTRICCIONES DE SEGURIDAD — VERBATIM, NO NEGOCIABLES', '');
  for (let i = 0; i < seguridad; i += 1) p.push('- Una restricción.');
  p.push('  ⚠️ Y una continuación sangrada, que NO es una restricción aparte.');
  p.push('', 'CARRIL: proceso.', '');
  if (cierre) p.push(MARCADOR);
  return p.join('\n');
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// ① EL CASO QUE ORIGINÓ EL TICKET · se corta, y hay que parar
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-565 · 🔴 sin el marcador final y CON cabecera: TRUNCADO y hay que parar', () => {
  const r = comprobar(encargo({ cierre: false }));
  assert.equal(r.veredicto, 'TRUNCADO');
  assert.equal(r.parar, true,
    '🔴 no manda parar. Trabajar sobre el trozo es exactamente lo que este ticket viene a evitar.');
  assert.match(r.mensaje, /restricciones de seguridad/,
    '🔴 el aviso no dice QUÉ se pierde al cortar. «Falta texto» y «faltan las prohibiciones»\n'
    + '  piden urgencias distintas.');
});

test('SCRUM-565 · 🔴 cortar por CUALQUIER sitio del cuerpo se detecta', () => {
  // Se corta el mismo encargo por seis sitios, incluido el punto donde se cortó el de verdad.
  const entero = encargo();
  const puntos = [
    ['justo antes del bloque de seguridad', entero.indexOf('## 🛑 RESTRICCIONES')],
    ['a media lista de restricciones', entero.indexOf('- Una restricción.') + 20],
    ['en las prohibiciones', entero.indexOf('⛔') + 5],
    ['a media frase del alcance', entero.indexOf('2. ⬜') + 6],
    ['un carácter antes del marcador', entero.lastIndexOf(MARCADOR)],
    ['a la mitad del marcador', entero.lastIndexOf(MARCADOR) + 10],
  ];
  for (const [donde, i] of puntos) {
    assert.ok(i > 0, `🔴 el corpus sintético no tiene el punto «${donde}»: el corte no se probaría.`);
    const r = comprobar(entero.slice(0, i));
    assert.equal(r.veredicto, 'TRUNCADO', `🔴 cortado ${donde} → dijo ${r.veredicto}`);
    assert.equal(r.parar, true, `🔴 cortado ${donde} → no manda parar`);
  }
});

test('SCRUM-565 · 🔴 el marcador tiene que SER el final, no aparecer en algún sitio', () => {
  // 🔴 EL DEFECTO QUE CAZÓ EL CONTROL, y conviene que quede escrito: la primera versión buscaba
  //    el marcador en todo el texto, y la CABECERA LO CITA. Encontraba el de la cita —carácter
  //    144 de 5.130— y daba por completo un encargo cortado. O sea: aprobaba cualquier encargo
  //    truncado del formato nuevo, que son todos los que traen cabecera.
  const cortado = encargo({ cierre: false });
  assert.ok(cortado.includes(MARCADOR),
    '🔴 el corpus ya no cita el marcador en la cabecera, así que este caso no prueba nada.');
  assert.equal(comprobar(cortado).veredicto, 'TRUNCADO',
    '🔴 ha vuelto a dar por bueno un encargo cortado que sólo CITA el marcador arriba.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ② ✅ CONTROL POSITIVO · un encargo entero NO puede mandar parar
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-565 · ✅ un encargo ENTERO y bien contado sale COMPLETO', () => {
  const r = comprobar(encargo());
  assert.equal(r.veredicto, 'COMPLETO',
    `🔴 dijo ${r.veredicto} sobre un encargo íntegro: ${JSON.stringify(r.desajustes)}`);
  assert.equal(r.parar, false);
});

test('SCRUM-565 · ✅ los cuatro recuentos se derivan del cuerpo, no se dan por buenos', () => {
  // Si `cuenta` devolviera siempre el número de la cabecera, todo saldría COMPLETO y el
  // contraste no existiría. Se mueve CADA uno por separado y tiene que salir su desajuste.
  const CASOS = [
    [{ alcance: 5 }, 'puntos de alcance'],
    [{ prohibiciones: 7 }, 'prohibiciones'],
    [{ suelos: 2 }, 'bloques de SUELO'],
    [{ seguridad: 9 }, 'líneas de restricciones'],
  ];
  for (const [cambio, que] of CASOS) {
    // El cuerpo lleva el número nuevo y la cabecera se queda con el viejo: eso es un desajuste.
    const cuerpo = encargo(cambio);
    const conCabeceraVieja = cuerpo.replace(/📋 ESTE ENCARGO TIENE:[^\n]*/, encargo().split('\n')[0]);
    const r = comprobar(conCabeceraVieja);
    assert.equal(r.veredicto, 'DISCREPANCIA', `🔴 moviendo «${que}» dijo ${r.veredicto}`);
    assert.ok(r.desajustes.some((d) => d.que.includes(que.split(' ')[0])),
      `🔴 no señala «${que}»: ${JSON.stringify(r.desajustes)}`);
  }
});

test('SCRUM-565 · 🔴 una DISCREPANCIA no se confunde con un truncamiento', () => {
  // Es lo que pasó de verdad en el estreno del formato: cabecera 4, cuerpo 5, encargo COMPLETO.
  // Un comprobador que llamara truncamiento a eso habría mandado parar un encargo entero — una
  // falsa alarma en su primer uso, y una alarma que salta sin motivo es la que alguien apaga.
  const r = comprobar(encargo({ prohibiciones: 5 }).replace(/· 5 prohibiciones/, '· 4 prohibiciones'));
  assert.equal(r.veredicto, 'DISCREPANCIA');
  assert.equal(r.parar, false,
    '🔴 manda parar un encargo COMPLETO. Contar a mano falla; eso no es que falte texto.');
  assert.match(r.mensaje, /NO es prueba de truncamiento/);
  assert.match(r.mensaje, /PREGUNTA/, '🔴 no dice qué hacer: declarar y preguntar, no adivinar.');
});

test('SCRUM-565 · el formato ANTERIOR no se marca como truncado', () => {
  // Los encargos de antes de hoy no llevan ni cabecera ni marcador y están enteros. Llamarlos
  // truncados sería una falsa alarma en cada uno de ellos.
  const viejo = 'SCRUM-000 · un encargo del formato anterior.\n\n## ALCANCE\n\n1. Hacer algo.\n';
  const r = comprobar(viejo);
  assert.equal(r.veredicto, 'SIN_CIERRE');
  assert.equal(r.parar, false, '🔴 manda parar un encargo del formato viejo, que está entero.');
  assert.match(r.mensaje, /NO es «está completo»/,
    '🔴 tampoco puede decir que esté completo: no hay con qué comprobarlo.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ③ EL EXTRACTOR DE SECCIONES · si no discrimina, los recuentos no valen
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-565 · la sección se corta en el siguiente encabezado', () => {
  const t = '## UNO\n\nlínea a\nlínea b\n\n## DOS\n\nlínea c\n';
  assert.match(seccion(t, /^##\s+UNO\s*$/m), /línea a/);
  assert.ok(!seccion(t, /^##\s+UNO\s*$/m).includes('línea c'),
    '🔴 la sección se come la siguiente: contaría elementos de otro bloque.');
  assert.equal(seccion(t, /^##\s+TRES\s*$/m), '',
    '🔴 devuelve algo para una sección que no existe: contaría sobre texto ajeno.');
});

test('SCRUM-565 · las continuaciones sangradas NO cuentan como restricciones', () => {
  // El bloque real lleva un `⚠️` sangrado bajo una viñeta. Contarlo inflaría el número y haría
  // saltar la alarma en un encargo íntegro.
  const r = comprobar(encargo({ seguridad: 3 }));
  assert.equal(r.veredicto, 'COMPLETO',
    '🔴 la continuación sangrada se está contando como una restricción más.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ④ LA REGLA VIVE DONDE SE CARGA SIEMPRE, Y EL COMANDO EXISTE
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-565 · 🔴 la regla está en cerebro-yaqu, que se carga sin invocarla', () => {
  // Una skill que hay que INVOCAR no le sirve a quien recibe un encargo truncado: el encargo
  // cortado no pide que se invoque nada. Por eso va en la que se carga siempre.
  assert.match(SKILL, /=== FIN DEL ENCARGO ===/,
    '🔴 `cerebro-yaqu` no nombra el marcador. Sin la regla escrita donde se lee siempre, el\n'
    + '  comprobador existe y no lo llama nadie — que es como estábamos.');
  for (const [trozo, porque] of [
    ['PARA', 'que hay que parar, no trabajar sobre el trozo'],
    ['ÚLTIMA línea', 'que el marcador tiene que SER el final, no aparecer (la cabecera lo cita)'],
    ['no es prueba', 'que un desajuste de recuento NO es un corte'],
    ['adivines', 'que no se rellenan huecos de contexto'],
    ['comprobar:encargo', 'con qué comprobarlo'],
  ]) {
    assert.ok(SKILL.includes(trozo), `🔴 la regla no dice ${porque} (falta «${trozo}»).`);
  }
});

test('SCRUM-565 · el comando está declarado con su //comentario', () => {
  assert.equal(PKG.scripts['comprobar:encargo'], 'node scripts/comprobar-encargo.mjs');
  assert.ok(String(PKG.scripts['//comprobar:encargo'] || '').length > 200,
    '🔴 falta el //comentario. Un comando sin explicación se borra el día que estorba.');
});

test('SCRUM-565 · 🔴 SUELO: el comprobador ve las cuatro clases de recuento', () => {
  assert.equal(RECUENTOS.length, 4,
    `🔴 el comprobador declara ${RECUENTOS.length} recuentos y la cabecera trae cuatro. Si uno\n`
    + '  deja de contrastarse, su desajuste pasa sin que nadie lo vea.');
  for (const r of RECUENTOS) {
    assert.equal(typeof r.cuenta, 'function', `🔴 «${r.clave}» no sabe contar en el cuerpo.`);
  }
});
