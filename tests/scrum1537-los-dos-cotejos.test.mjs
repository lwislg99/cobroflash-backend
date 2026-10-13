// tests/scrum1537-los-dos-cotejos.test.mjs — SCRUM-1537
//
// DOS INSTRUMENTOS COTEJAN LA PARTE L DEL MÁSTER, Y LOS DOS MEDÍAN MENOS DE LO QUE SU NOMBRE PROMETE.
//
//   · `docs/master/evidencias/scrum1500/cotejo.cjs` (corre en la tanda, desde scrum1500): lee los
//     valores que el código escribe, y de ocho formas de escribir sólo ve tres. Ese límite se queda,
//     DECLARADO (`LIMITE_DEL_LITERAL`). Aquí se sujeta por sus dos lados: qué ve y qué no.
//   · `docs/master/evidencias/scrum1500c/cotejo-once.cjs` (NO corre en la tanda): del máster sólo leía
//     las listas con flecha. Ese límite se QUITÓ. Aquí se sujeta que siga quitado, y que el
//     instrumento siga siendo fiable sobre el árbol: el 13-oct-2026 dejó de serlo al entrar
//     SCRUM-1529c, porque su control positivo era un defecto del árbol que ese día se arregló, y no
//     se enteró nadie hasta que alguien lo corrió a mano.
//
// TODOS LOS CASOS SON SEMBRADOS. Ninguno toma de prueba un defecto que el árbol tenga hoy: el máster
// se cambia en memoria y las escrituras se fabrican en una raíz desechable. El árbol no se toca.
//
// QUÉ NO HACE: no juzga los veredictos de `cotejo-once.cjs` sobre el árbol (los imprime). Que un campo
// suyo salga fuera del máster es una decisión de estado, y ésas no son de este fichero (regla 27).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const once = require('../docs/master/evidencias/scrum1500c/cotejo-once.cjs');
const { cotejar, juzgar, pintaJuicio, LIMITE_DEL_LITERAL, CAMPOS } = require('../docs/master/evidencias/scrum1500/cotejo.cjs');
const siembra = require('../docs/master/evidencias/SCRUM-1537/siembra-literal.cjs');

const MASTER = fs.readFileSync(new URL('../docs/YAQU_MASTER.md', import.meta.url), 'utf8');
const ARBOL = once.cotejarOnce();
const fila = (r, id) => r.filas.find((f) => f.id === id && !f.control);
/** El máster con texto añadido al final de UNA línea, y la comprobación de que el veneno entró. */
function masterCon(n, cola, palabra) {
  const lineas = MASTER.split('\n');
  lineas[n - 1] += cola;
  const texto = lineas.join('\n');
  assert.deepEqual(once.rastro(texto.split('\n'), palabra), [n], `la siembra de «${palabra}» no entró en la línea ${n}`);
  return texto;
}

test('SCRUM-1537 · cotejo-once sigue siendo FIABLE sobre el árbol, y dice sobre cuántos campos', (t) => {
  const { texto, ok } = once.pinta(ARBOL);
  t.diagnostic(texto.split('\n').filter((l) => /^(POBLACION|CONTROLES|RASTRO|EXIT|===|  +\d+  )/.test(l)).join('\n'));
  assert.equal(ok, true, `cotejo-once ya no es fiable:\n${texto.split('\n').filter((l) => /^(CONTROLES|POBLACION)/.test(l)).join('\n')}`);
  const reales = ARBOL.filas.filter((f) => !f.control);
  assert.deepEqual(reales.map((f) => f.id).sort(), [...ARBOL.poblacion].sort(), 'la tabla ONCE y los estados que el otro instrumento deja fuera ya no son los mismos');
  assert.ok(reales.length >= 11, `cotejo-once miraba 11 campos y mira ${reales.length}`);
  // Sus positivos sembrados existen y son más de uno: sin ellos «fiable» sería un cero sin testigo.
  const sembrados = ARBOL.filas.filter((f) => f.control && f.sembrada);
  assert.deepEqual([...new Set(sembrados.map((f) => f.control))].sort(), ['CODIGO_FUERA_DEL_MASTER', 'COINCIDE_CON_EL_MASTER', 'MASTER_SIN_ESCRIBIR']);
  for (const f of sembrados) assert.equal(f.veredicto, f.control, f.campo);
});

test('SCRUM-1537 · cotejo-once ve un valor sembrado en la Parte L CON flecha y también SIN ella (el límite que se quitó)', () => {
  const flechas = once.ONCE.filter((c) => c.master && c.master.modo === 'flechas');
  assert.ok(flechas.length >= 7, `los campos leídos en modo flechas eran 7 y son ${flechas.length}`);
  let semilla = 'sembrado_scrum1537';
  while (MASTER.includes(semilla)) semilla += '_x';
  const vistos = { conFlecha: [], sinFlecha: [] };
  for (const c of flechas) {
    const f0 = fila(ARBOL, c.campo);
    const casos = {
      conFlecha: ` · \`${f0.M[0]} → ${semilla}\``,
      sinFlecha: ` \`${semilla}\`: valor de la máquina, sin transiciones fijadas aquí.`,
    };
    for (const [clave, cola] of Object.entries(casos)) {
      const f = fila(once.cotejarOnce({ textoMaster: masterCon(f0.lineaMaster, cola, semilla) }), c.campo);
      if (f.M.includes(semilla) && f.faltan.includes(semilla)) vistos[clave].push(c.campo);
    }
  }
  const todos = flechas.map((c) => c.campo);
  assert.deepEqual(vistos.conFlecha, todos, 'un valor sembrado CON flecha tiene que verse en todos');
  assert.deepEqual(vistos.sinFlecha, todos, 'un valor sembrado SIN flecha tiene que verse en todos: es el límite que SCRUM-1537 quitó');
});

test('SCRUM-1537 · cotejo-once: un valor que cambia de «con flecha» a «sin flecha» sigue siendo del máster', () => {
  const f0 = fila(ARBOL, 'Job.status');
  assert.equal(f0.veredicto, 'COINCIDE_CON_EL_MASTER');
  const lineas = MASTER.split('\n');
  const antes = lineas[f0.lineaMaster - 1];
  lineas[f0.lineaMaster - 1] = `${antes.replace(' → cerrado`', '`')} \`cerrado\`: valor de la máquina, sin transiciones fijadas aquí.`;
  assert.notEqual(lineas[f0.lineaMaster - 1], antes, 'la transformación del máster no se aplicó');
  assert.equal(lineas[f0.lineaMaster - 1].includes('→ cerrado'), false);
  assert.equal(antes.includes('→ cerrado'), true, 'la línea de Job.status ya no acaba su flecha en `cerrado`: el caso hay que fabricarlo con otro valor');
  const f = fila(once.cotejarOnce({ textoMaster: lineas.join('\n') }), 'Job.status');
  assert.deepEqual(f.M, f0.M);
  assert.equal(f.veredicto, 'COINCIDE_CON_EL_MASTER');
  // Y quitarlo de verdad de la línea sí lo saca del máster: el caso de arriba no pasa por ciego.
  lineas[f0.lineaMaster - 1] = antes.replace(' → cerrado`', '`').replace(/`cerrado`/g, 'cerrado');
  const sin = fila(once.cotejarOnce({ textoMaster: lineas.join('\n') }), 'Job.status');
  assert.equal(sin.veredicto, 'CODIGO_FUERA_DEL_MASTER');
  assert.deepEqual(sin.sobran, ['cerrado']);
});

test('SCRUM-1537 · cotejo-once: lo que sigue sin leer del máster está DECLARADO y se cuenta', () => {
  // Un valor sin flecha con algo más dentro de las mismas comillas no es una palabra sola: no entra
  // en M, y sale en «sin leer». Es el límite que queda, y se imprime por campo.
  const f0 = fila(ARBOL, 'Job.status');
  const f = fila(once.cotejarOnce({ textoMaster: masterCon(f0.lineaMaster, ' `sembrado_dos palabras`.', 'sembrado_dos') }), 'Job.status');
  assert.deepEqual(f.M, f0.M);
  assert.deepEqual(f.sinLeer.filter((x) => x.includes('sembrado_dos')), ['sembrado_dos palabras']);
  // Una palabra declarada en `noSonValores` que deja de estar en la línea ciega el campo: no caduca en silencio.
  const spec = once.ONCE.find((c) => c.campo === 'Charge.status').master;
  const sinRefund = once.leerMaster(MASTER.split('\n').map((l) => l.replace(/`Refund`/g, 'Refund')), spec);
  assert.equal(sinRefund.valores, null);
  assert.match(sinRefund.motivo, /noSonValores Refund/);
  assert.ok(once.leerMaster(MASTER.split('\n'), spec).valores.size > 0, 'el control: con el máster sin tocar, la lista de Charge se lee');
});

test('SCRUM-1537 · cotejo.cjs · EL LÍMITE DEL LITERAL, sembrado: qué formas de escribir ve, de cuáles avisa y ante cuáles calla', (t) => {
  const { texto, salida, formas } = siembra.medir();
  t.diagnostic(texto);
  assert.equal(salida, 0, `la siembra no se pudo medir:\n${texto}`);
  assert.equal(formas.length, siembra.FORMAS.length);
  const de = (zona) => formas.filter((f) => f.zona === zona).map((f) => f.forma).sort();
  // Si este reparto cambia, el instrumento ve más o ve menos: se actualiza LIMITE_DEL_LITERAL en el
  // mismo PR. Una forma que pase de «calla» a «ve» es una buena noticia que también se escribe.
  assert.deepEqual(de('ve'), ['constante', 'literal', 'ternario']);
  assert.deepEqual(de('avisa'), ['funcion', 'importada']);
  assert.deepEqual(de('calla'), ['derrame', 'objeto', 'sql']);
  // Lo que ve, lo nombra por lo que es; de lo que avisa, ya no coincide en silencio: dice que no lo sabe.
  for (const f of formas) {
    const esperado = { ve: ['CODIGO_FUERA_DEL_MASTER'], avisa: ['ESCRITURA_SIN_LEER'], calla: [] }[f.zona];
    assert.deepEqual(f.nombrado, esperado, `${f.forma} (${f.zona})`);
  }
});

test('SCRUM-1537 · cotejo.cjs · el límite está DECLARADO con sus papeles, y el juicio dice a qué campos alcanza', () => {
  for (const k of ['motivo', 'retira', 'consta', 'prueba', 'desde']) assert.ok(String(LIMITE_DEL_LITERAL[k] || '').trim().length > 0, `al límite declarado le falta «${k}»`);
  assert.ok(fs.existsSync(new URL(`../${LIMITE_DEL_LITERAL.prueba}`, import.meta.url)), 'la prueba que el límite declara no existe');
  assert.match(LIMITE_DEL_LITERAL.consta, /SCRUM-1537/);
  const r = cotejar();
  const j = juzgar(r);
  const sinCierre = CAMPOS.filter((c) => !c.cierre).map((c) => c.etiqueta || c.campo);
  assert.ok(sinCierre.length > 0, 'ya ningún campo de la tabla está sin cierre: el límite no alcanza a ningún veredicto y LIMITE_DEL_LITERAL se puede retirar');
  const linea = pintaJuicio(r, j).split('\n').find((l) => l.includes('SIN CIERRE'));
  assert.ok(linea, 'el juicio ya no dice qué campos sacan su lista sólo de las escrituras');
  for (const campo of sinCierre) assert.ok(linea.includes(campo), `el juicio no nombra ${campo} entre los campos sin cierre`);
  // Sobre el árbol, hoy, ninguno de esos campos tiene una escritura que no se deje leer.
  assert.deepEqual(j.hallazgos.filter((h) => h.clase === 'ESCRITURA_SIN_LEER'), []);
  // …y si la tuviera caería: la misma pasada, con una escritura no literal puesta en un campo sin cierre.
  const copia = structuredClone(r);
  const tocada = copia.filas.find((f) => !f.control && !f.cierreDe);
  // La escritura que se le pone NO se escribe a mano: es la que el propio instrumento saca de la raíz
  // sembrada para la forma «funcion» (`data: { funcion: calcula() }` en su `src/escribe.ts`). Se cita
  // por lo que ES —el fichero sembrado y la llamada—, no por la línea en que cae (scrum710b).
  const deLaSiembra = siembra.medir().formas.find((f) => f.forma === 'funcion').noLiterales;
  assert.equal(deLaSiembra.length, 1, 'la forma «funcion» de la siembra ya no deja exactamente una escritura sin leer');
  assert.match(deLaSiembra[0], /^src\/escribe\.ts:\d+ calcula\(\)$/, 'la escritura sembrada ya no es la llamada a calcula() de src/escribe.ts');
  tocada.noLiterales = deLaSiembra;
  // El aviso lo lee alguien con el CI en rojo: tiene que decirle que no es su código y qué hacer.
  const aviso = juzgar(copia).hallazgos.find((h) => h.clase === 'ESCRITURA_SIN_LEER').texto;
  assert.match(aviso, /NO es un defecto de tu código/, 'el aviso ya no dice que el rojo no es un defecto del código de quien lo recibe');
  assert.match(aviso, /límite declarado de este instrumento \(LIMITE_DEL_LITERAL/, 'el aviso ya no dice que es un límite declarado del instrumento');
  assert.ok(aviso.includes(`\`cierre\` de ${tocada.campo}`), 'el aviso ya no dice en qué entrada de CAMPOS se pone el cierre');
  assert.ok(aviso.includes(deLaSiembra[0]), 'el aviso ya no nombra la escritura que no supo leer');
  assert.deepEqual(juzgar(copia).hallazgos.map((h) => `${h.campo} · ${h.clase}`), [`${tocada.campo} · ESCRITURA_SIN_LEER`]);
  // Un `null` no es un valor que se esconda: no cae por él.
  const conNull = deLaSiembra.map((x) => x.replace(/ calcula\(\)$/, ' null'));
  assert.match(conNull[0], /^src\/escribe\.ts:\d+ null$/, 'el control: la misma escritura sembrada, ahora poniendo null');
  tocada.noLiterales = conNull;
  assert.deepEqual(juzgar(copia).hallazgos, []);
  // Y en un campo CON cierre la misma escritura no cae: su lista la cierra la constante.
  const conCierre = structuredClone(r);
  conCierre.filas.find((f) => !f.control && f.cierreDe && f.veredicto === 'COINCIDE_CON_EL_MASTER').noLiterales = deLaSiembra;
  assert.deepEqual(juzgar(conCierre).hallazgos, []);
});
