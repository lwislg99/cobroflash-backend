// tests/scrum1500-el-cotejo-contra-el-master.test.mjs — SCRUM-1500
//
// EL CENSO DE COMENTARIOS DEL ESQUEMA COMPARABA EL COMENTARIO CONTRA EL CÓDIGO, Y NUNCA CONTRA EL
// MÁSTER. Si el código se salía del máster y el comentario lo acompañaba, salía «coincide».
//
// Lo que se sujeta aquí es EL CRITERIO del instrumento nuevo
// (`docs/master/evidencias/scrum1500/cotejo.cjs`), sobre casos fabricados: tres conjuntos —lo que
// dice el comentario (C), lo que decide el código (D) y lo que fija el máster (M)— y un veredicto.
//
// SCRUM-1500b · DESDE AQUÍ TAMBIÉN CORRE EL INSTRUMENTO SOBRE EL ÁRBOL, en la tanda normal. Lo decidió
// el orquestador de Javier en Jira (SCRUM-1500, comentario 18831, 8-oct-2026): un fichero de test, no
// un workflow, y extendiendo este instrumento, no escribiendo otro. Hasta entonces este fichero decía
// que no lo corría, porque el instrumento localizaba cada comentario por su número de línea y habría
// caído con cualquier cambio del esquema; ahora lo localiza por modelo y campo.
//
// 🔴 LO QUE SE VIGILA ES QUE LA PREGUNTA SIGA SIENDO «¿CÓDIGO = MÁSTER?» Y NO «¿COMENTARIO = CÓDIGO?».
//    Por eso el control no es que salga verde: es que CAIGA un comentario que coincide con el código
//    y no con el máster (los casos «CAE»), y que NO se nombre el que sí coincide con el máster.
//
// LOS TRES PARADOS (`QuoteRequest.status`, `ParteTrabajo.estado`, `TeamMember.status`) esperan al
// fundador (regla 27) y no ponen el CI en rojo; su excepción vive en `PARADOS`, dentro del
// instrumento, con motivo, quién la retira y dónde consta. Aquí se prueba que no es un agujero.
//
// QUÉ NO HACE: no coteja los campos del esquema que no están en la tabla del instrumento (los
// cuenta y los nombra en su salida), ni las transiciones, ni nada contra una base.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  veredicto, censoViejo, valoresDeLista, valoresDelMaster, esEstado,
  CAMPOS, PARADOS, cotejar, juzgar, pintaJuicio,
} = require('../docs/master/evidencias/scrum1500/cotejo.cjs');

const S = (...v) => new Set(v);
const base = { existe: true, masterDeclarado: true, masterMotivo: null, campo: 'Modelo.status' };

test('SCRUM-1500 · EL CONTROL QUE LO SEPARA DE SU PADRE: comentario y código iguales, máster distinto → NO sale «coincide»', () => {
  // Es `QuoteRequest.status` tal cual: el censo viejo lo daba por bueno.
  const C = S('pending', 'read', 'done');
  const D = S('pending', 'read', 'done');
  const M = S('new', 'seen', 'converted', 'discarded');
  assert.equal(censoViejo(C, D), 'coincide', 'el censo viejo tiene que seguir diciendo «coincide»: es el defecto');
  const v = veredicto({ ...base, C, D, M });
  assert.equal(v.veredicto, 'CODIGO_FUERA_DEL_MASTER');
  assert.deepEqual(v.sobran, ['done', 'pending', 'read']);
  assert.deepEqual(v.faltan, ['converted', 'discarded', 'new', 'seen']);
});

test('SCRUM-1500 · la otra mitad del control: comentario, código y máster iguales → «coincide con el máster»', () => {
  const C = S('borrador', 'emitido', 'firmado');
  const v = veredicto({ ...base, C, D: S('borrador', 'emitido', 'firmado'), M: S('firmado', 'emitido', 'borrador') });
  assert.equal(censoViejo(C, S('borrador', 'emitido', 'firmado')), 'coincide');
  assert.equal(v.veredicto, 'COINCIDE_CON_EL_MASTER');
});

test('SCRUM-1500 · los dos cajones de en medio: comentario atrasado, y máster que manda lo que nadie escribe', () => {
  const D = S('a', 'b');
  assert.equal(veredicto({ ...base, C: S('a'), D, M: S('a', 'b') }).veredicto, 'COMENTARIO_ATRASADO');
  const falta = veredicto({ ...base, C: D, D, M: S('a', 'b', 'c') });
  assert.equal(falta.veredicto, 'MASTER_SIN_ESCRIBIR');
  assert.deepEqual(falta.faltan, ['c']);
  // Un valor de más en el código pesa más que uno de menos: es el que la regla 27 prohíbe.
  assert.equal(veredicto({ ...base, C: D, D: S('a', 'x'), M: S('a', 'b') }).veredicto, 'CODIGO_FUERA_DEL_MASTER');
});

test('SCRUM-1500 · lo que no se pudo mirar NUNCA sale «coincide»: campo inventado, código vacío, ancla o cierre que no aparecen', () => {
  const C = S('a', 'b');
  const casos = [
    [{ ...base, existe: false, C: null, D: S(), M: null }, 'NO_EXISTE'],
    [{ ...base, C, D: S(), M: S('a', 'b') }, 'CIEGO'],
    [{ ...base, C, D: S('a', 'b'), M: null, masterMotivo: 'el ancla casa 0 veces' }, 'CIEGO'],
    [{ ...base, C, D: S('a', 'b'), M: S('a', 'b'), cierreRoto: 'x.ts (no encontrado: Y)' }, 'CIEGO'],
  ];
  for (const [entrada, esperado] of casos) assert.equal(veredicto(entrada).veredicto, esperado);
  // Y el control de que la lista de arriba no pasa por vacía: los mismos conjuntos, sin el defecto.
  assert.equal(veredicto({ ...base, C, D: S('a', 'b'), M: S('a', 'b') }).veredicto, 'COINCIDE_CON_EL_MASTER');
});

test('SCRUM-1500 · si el máster no trae lista, se dice: «no lo fija» o «estado sin máquina», nunca un verde', () => {
  const C = S('a', 'b');
  const sinMaster = { existe: true, C, D: S('a', 'b'), M: null, masterDeclarado: false, masterMotivo: null };
  assert.equal(veredicto({ ...sinMaster, campo: 'Expense.category' }).veredicto, 'EL_MASTER_NO_LO_FIJA');
  for (const campo of ['TeamMember.status', 'ParteTrabajo.estado', 'BotSession.state', 'Merchant.connectStatus']) {
    assert.equal(esEstado(campo), true, campo);
    assert.equal(veredicto({ ...sinMaster, campo }).veredicto, 'ESTADO_SIN_MAQUINA_EN_EL_MASTER', campo);
  }
  assert.equal(esEstado('Quote.estadoCivilDelCliente'), false);
});

test('SCRUM-1500 · las listas del máster se leen como están escritas: flechas, barras, glosas y comillas', () => {
  assert.deepEqual([...valoresDeLista('new → seen → converted(quoteId) | discarded(reason)')].sort(), ['converted', 'discarded', 'new', 'seen']);
  assert.deepEqual([...valoresDeLista("'none'|'pending'|'active'|'restricted'")].sort(), ['active', 'none', 'pending', 'restricted']);
  assert.deepEqual([...valoresDeLista('NINGUNA | QUINCENAL | MENSUAL')].sort(), ['MENSUAL', 'NINGUNA', 'QUINCENAL']);
});

test('SCRUM-1500 · el ancla del máster tiene que casar UNA vez: con cero o con dos no hay lista, hay motivo', () => {
  const master = ['**Cosa:** `a → b`.', 'otra línea', '**Doble:** `x | y`', '**Doble:** `x | z`'];
  const una = valoresDelMaster(master, { ancla: /^\*\*Cosa:\*\*/, lista: /^\*\*Cosa:\*\* `([^`]+)`/ });
  assert.deepEqual([...una.valores].sort(), ['a', 'b']);
  assert.equal(una.linea, 1);
  const cero = valoresDelMaster(master, { ancla: /^\*\*NoEsta:\*\*/, lista: /`([^`]+)`/ });
  assert.equal(cero.valores, null);
  assert.match(cero.motivo, /casa 0 veces/);
  const dos = valoresDelMaster(master, { ancla: /^\*\*Doble:\*\*/, lista: /`([^`]+)`/ });
  assert.equal(dos.valores, null);
  assert.match(dos.motivo, /casa 2 veces/);
});

// ───────────────────────── SCRUM-1500b · el instrumento, sobre el árbol ─────────────────────────

const ARBOL = cotejar();
const texto = (ruta) => require('node:fs').readFileSync(ruta, 'utf8');
const MASTER = ARBOL.ciego ? '' : texto(ARBOL.poblacion.master);
const ESQUEMA = ARBOL.ciego ? '' : texto(require('node:path').join(ARBOL.poblacion.master, '..', '..', 'prisma', 'schema.prisma'));
const nombrados = (j) => [...new Set(j.hallazgos.map((h) => h.campo))].sort();
const clases = (j) => [...new Set(j.hallazgos.map((h) => h.clase))].sort();
const fila = (r, id) => r.filas.find((f) => f.id === id && !f.control);

/** El máster con UNA línea cambiada: a la lista del campo se le quita su último valor. */
function masterSinElUltimoValor(id) {
  const spec = CAMPOS.find((c) => c.campo === id).master;
  const lineas = MASTER.split(/\r?\n/);
  const n = fila(ARBOL, id).lineaMaster - 1;
  const m = spec.lista.exec(lineas[n]);
  const desde = lineas[n].indexOf(m[1], m.index);
  const corte = Math.max(m[1].lastIndexOf('|'), m[1].lastIndexOf('→'));
  assert.ok(corte > 0, `la lista de ${id} en el máster tiene un solo valor: no hay qué quitar`);
  const nueva = lineas[n].slice(0, desde) + m[1].slice(0, corte) + lineas[n].slice(desde + m[1].length);
  assert.notEqual(nueva, lineas[n], 'la mutación del máster no se aplicó');
  lineas[n] = nueva;
  return lineas.join('\n');
}

test('SCRUM-1500b · EL ÁRBOL: ningún comentario de la tabla se sale del máster, y el instrumento dice qué miró y qué no', (t) => {
  assert.equal(ARBOL.ciego, undefined, `el instrumento no arrancó: ${ARBOL.ciego}`);
  const j = juzgar(ARBOL);
  t.diagnostic(pintaJuicio(ARBOL, j));
  const p = ARBOL.poblacion;
  // El suelo: los 19 que midió SCRUM-1500. Añadir un campo a la tabla no lo mueve; quitar uno sí, y
  // entonces se baja AQUÍ, en el mismo PR y diciendo por qué.
  assert.ok(p.campos >= 19, `la tabla tiene ${p.campos} campos y SCRUM-1500 midió 19: se ha perdido alguno`);
  assert.ok(p.ficheros > 0 && p.sinParsear === 0, `leí ${p.ficheros} ficheros de src/ y ${p.sinParsear} no se dejaron parsear`);
  assert.equal(j.fiable, true);
  assert.deepEqual(j.hallazgos, [], `\n${pintaJuicio(ARBOL, j)}\n`);
  // Cada campo cae en un cajón y sólo en uno: lo que no se nombra tampoco se pierde.
  assert.equal(j.coinciden.length + j.sinCotejar.length + j.esperan.length, p.campos);
  // EL POSITIVO: hay comentarios que SÍ coinciden con el máster, y no se nombran. Un instrumento
  // que avisara de todo también pasaría los casos «CAE».
  assert.ok(j.coinciden.length > 0, 'ningún campo coincide con el máster: el positivo no existe');
  assert.ok(j.coinciden.includes('Albaran.estado'));
});

test('SCRUM-1500b · CAE: un comentario que coincide con el CÓDIGO y no con el MÁSTER sale nombrado, uno por uno', (t) => {
  const j0 = juzgar(ARBOL);
  const coinciden = ARBOL.filas.filter((f) => !f.control && f.veredicto === 'COINCIDE_CON_EL_MASTER');
  const porLinea = new Map();
  for (const f of coinciden) porLinea.set(f.lineaMaster, [...(porLinea.get(f.lineaMaster) || []), f.id]);
  assert.ok(porLinea.size > 0, 'no hay ninguna línea del máster que mover');
  t.diagnostic(`líneas del máster movidas, una cada vez: ${porLinea.size} (${[...porLinea.keys()].join(', ')}), que sujetan ${coinciden.length} comentarios`);
  for (const [linea, ids] of porLinea) {
    const r = cotejar({ textoMaster: masterSinElUltimoValor(ids[0]) });
    const j = juzgar(r);
    const esperados = [...new Set(coinciden.filter((f) => ids.includes(f.id)).map((f) => f.campo))].sort();
    assert.deepEqual(nombrados(j), esperados, `al mover la línea ${linea} del máster`);
    assert.deepEqual(clases(j), ['CODIGO_FUERA_DEL_MASTER']);
    for (const id of new Set(ids)) {
      // El comentario SIGUE coincidiendo con el código: el censo viejo lo daría por bueno. Es el defecto.
      assert.equal(fila(r, id).viejo, 'coincide', `${id}: el caso fabricado ya no es «comentario = código»`);
      assert.deepEqual(fila(r, id).C, fila(r, id).D);
    }
    // Y sólo cae el suyo: los demás que coinciden siguen sin nombrarse.
    assert.equal(j.coinciden.length, j0.coinciden.length - esperados.length);
  }
});

test('SCRUM-1500b · LOS TRES PARADOS no son un agujero: sin su excepción caen los tres, y sólo esos tres', () => {
  const sin = juzgar(ARBOL, []);
  assert.deepEqual(
    sin.hallazgos.map((h) => `${h.campo} · ${h.clase}`).sort(),
    ['ParteTrabajo.estado · ESTADO_SIN_MAQUINA_EN_EL_MASTER', 'QuoteRequest.status · CODIGO_FUERA_DEL_MASTER', 'TeamMember.status · ESTADO_SIN_MAQUINA_EN_EL_MASTER'],
  );
  // `QuoteRequest.status` es el caso que abrió el ticket, vivo en el árbol: comentario = código ≠ máster.
  assert.equal(fila(ARBOL, 'QuoteRequest.status').viejo, 'coincide');
  const con = juzgar(ARBOL);
  assert.deepEqual(con.esperan.map((e) => e.campo).sort(), PARADOS.map((e) => e.campo).sort());
  for (const e of PARADOS) {
    for (const k of ['motivo', 'retira', 'consta', 'desde']) assert.ok(String(e[k] || '').trim().length > 0, `${e.campo}: la excepción no dice «${k}»`);
    assert.match(e.desde, /^\d{4}-\d{2}-\d{2}$/);
  }
  // «Sigue montada», por AST y en esta pasada: sus valores salen de un cierre o de una escritura de src/.
  for (const e of con.esperan) assert.ok(e.montadaEn.length > 0, `${e.campo}: no encuentro dónde sigue montado`);
});

test('SCRUM-1500b · la excepción cubre lo que se le llevó al fundador y nada más: si cambia, cae', () => {
  const copia = () => structuredClone(ARBOL);
  const tras = (toca, parados = PARADOS) => { const r = copia(); toca(r); return juzgar(r, parados); };
  // El control de la copia: sin tocar nada, la copia juzga igual que el original.
  assert.deepEqual(tras(() => {}).hallazgos, []);
  // ① el código gana un estado más: la excepción no lo ampara.
  const masEstados = tras((r) => { fila(r, 'QuoteRequest.status').D = ['archived', 'done', 'pending', 'read']; });
  assert.deepEqual(masEstados.hallazgos.map((h) => `${h.campo} · ${h.clase}`), ['QuoteRequest.status · EXCEPCION_QUE_YA_NO_DESCRIBE']);
  assert.match(masEstados.hallazgos[0].texto, /archived/);
  // ② el máster cambia su lista.
  const otroMaster = tras((r) => { fila(r, 'QuoteRequest.status').M = ['discarded', 'new', 'seen']; });
  assert.deepEqual(clases(otroMaster), ['EXCEPCION_QUE_YA_NO_DESCRIBE']);
  // ②bis sigue parado, pero por OTRA cosa que la que se le llevó al fundador.
  const otroVeredicto = tras((r) => { Object.assign(fila(r, 'QuoteRequest.status'), { veredicto: 'MASTER_SIN_ESCRIBIR' }); });
  assert.deepEqual(otroVeredicto.hallazgos.map((h) => `${h.campo} · ${h.clase}`), ['QuoteRequest.status · EXCEPCION_QUE_YA_NO_DESCRIBE']);
  // ③ el campo deja de estar parado: la excepción sobra, y se dice.
  const resuelto = tras((r) => { Object.assign(fila(r, 'TeamMember.status'), { veredicto: 'COINCIDE_CON_EL_MASTER' }); });
  assert.deepEqual(resuelto.hallazgos.map((h) => `${h.campo} · ${h.clase}`), ['TeamMember.status · EXCEPCION_SOBRANTE']);
  // ④ ya no queda en src/ ni el cierre ni una escritura: sólo el @default.
  const desmontado = tras((r) => { Object.assign(fila(r, 'ParteTrabajo.estado'), { cierre: [], sitios: [] }); });
  assert.deepEqual(desmontado.hallazgos.map((h) => `${h.campo} · ${h.clase}`), ['ParteTrabajo.estado · EXCEPCION_QUE_YA_NO_DESCRIBE']);
  // ⑤ una excepción de un campo que no está en la tabla, y una a la que le falta quién la retira.
  const huerfana = juzgar(ARBOL, [...PARADOS, { ...PARADOS[0], campo: 'Modelo.queNoEsta' }]);
  assert.deepEqual(huerfana.hallazgos.map((h) => `${h.campo} · ${h.clase}`), ['Modelo.queNoEsta · EXCEPCION_HUERFANA']);
  const sinPapeles = juzgar(ARBOL, PARADOS.map((e, i) => (i === 0 ? { ...e, retira: ' ' } : e)));
  assert.deepEqual(sinPapeles.hallazgos.map((h) => `${h.campo} · ${h.clase}`), ['QuoteRequest.status · EXCEPCION_SIN_PAPELES']);
  // ⑥ un control que deja de salir como tiene que salir: el instrumento ya no es fiable.
  const controlRoto = tras((r) => { r.filas.find((f) => f.control).veredicto = 'COINCIDE_CON_EL_MASTER'; });
  assert.equal(controlRoto.fiable, false);
  assert.deepEqual(clases(controlRoto), ['CONTROL_ROTO']);
});

test('SCRUM-1500b · «el máster no lo fija» lo declara la tabla, y no se cree a ciegas: una línea nueva que junte los valores cae', () => {
  // Una máquina para el parte, escrita en el máster sin tocar la tabla ni la excepción.
  const conMaquina = juzgar(cotejar({ textoMaster: `${MASTER}\n**Parte de trabajo:** \`borrador → firmado → facturado\`.\n` }));
  assert.deepEqual(conMaquina.hallazgos.map((h) => `${h.campo} · ${h.clase}`), ['ParteTrabajo.estado · EXCEPCION_QUE_YA_NO_DESCRIBE']);
  assert.match(conMaquina.hallazgos[0].texto, /puede ser su máquina/);
  // Y una lista para un campo que no es un estado.
  const conLista = juzgar(cotejar({ textoMaster: `${MASTER}\nEl tipo de sesión es \`magic_link | session\`.\n` }));
  assert.deepEqual(conLista.hallazgos.map((h) => `${h.campo} · ${h.clase}`), ['AuthSession.type · POSIBLE_LISTA_EN_EL_MASTER']);
  // El control: una línea añadida que no junta los valores de nadie no nombra a nadie.
  assert.deepEqual(juzgar(cotejar({ textoMaster: `${MASTER}\nUna línea cualquiera, con \`magic_link\` solo.\n` })).hallazgos, []);
});

test('SCRUM-1500b · el comentario se localiza por modelo y campo: mover las líneas del esquema no cambia ningún veredicto', () => {
  const foto = (r) => r.filas.map((f) => `${f.campo} → ${f.veredicto} · C ${(f.C || []).join('|')} · D ${f.D.join('|')} · M ${(f.M || []).join('|')}`);
  const movido = cotejar({ textoEsquema: `// uno\n// dos\n\n${ESQUEMA}` });
  assert.deepEqual(foto(movido), foto(ARBOL));
  assert.deepEqual(juzgar(movido).hallazgos, []);
  // Y se movieron de verdad: cada comentario está tres líneas más abajo.
  for (const f of ARBOL.filas.filter((x) => !x.control)) assert.equal(fila(movido, f.id) && movido.filas[ARBOL.filas.indexOf(f)].linea, f.linea + 3, f.campo);
  // Un campo que desaparece del esquema no se queda en silencio.
  const sinCampo = juzgar(cotejar({ textoEsquema: ESQUEMA.replace(/^(\s+)connectStatus(\s)/m, '$1connectEstadoNuevo$2') }));
  assert.deepEqual(sinCampo.hallazgos.map((h) => `${h.campo} · ${h.clase}`), ['Merchant.connectStatus · NO_EXISTE']);
  // Un comentario que deja de enumerar tampoco: o lo dice la tabla (`sinLista`), o cae.
  const sinLista = ESQUEMA.replace('// none|pending|active|restricted', '// lo escribe el webhook de Connect');
  assert.notEqual(sinLista, ESQUEMA, 'la sustitución del comentario no se aplicó');
  assert.deepEqual(juzgar(cotejar({ textoEsquema: sinLista })).hallazgos.map((h) => `${h.campo} · ${h.clase}`), ['Merchant.connectStatus · COMENTARIO_CAMBIO_DE_FORMA']);
  const declarado = CAMPOS.map((c) => (c.campo === 'Merchant.connectStatus' ? { ...c, sinLista: true } : c));
  assert.deepEqual(juzgar(cotejar({ textoEsquema: sinLista, campos: declarado })).hallazgos, []);
  // …y la otra mitad: declararlo sin que sea verdad también cae.
  assert.deepEqual(clases(juzgar(cotejar({ campos: declarado }))), ['COMENTARIO_CAMBIO_DE_FORMA']);
});
