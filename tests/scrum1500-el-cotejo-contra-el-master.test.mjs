// tests/scrum1500-el-cotejo-contra-el-master.test.mjs — SCRUM-1500
//
// EL CENSO DE COMENTARIOS DEL ESQUEMA COMPARABA EL COMENTARIO CONTRA EL CÓDIGO, Y NUNCA CONTRA EL
// MÁSTER. Si el código se salía del máster y el comentario lo acompañaba, salía «coincide».
//
// Lo que se sujeta aquí es EL CRITERIO del instrumento nuevo
// (`docs/master/evidencias/scrum1500/cotejo.cjs`), sobre casos fabricados: tres conjuntos —lo que
// dice el comentario (C), lo que decide el código (D) y lo que fija el máster (M)— y un veredicto.
//
// 🔴 QUÉ NO HACE ESTE FICHERO: no corre el instrumento sobre el árbol real. El instrumento localiza
//    cada comentario por su número de línea en `prisma/schema.prisma`, y un guard así caería con
//    cualquier cambio del esquema que moviera líneas. El resultado sobre el árbol está en
//    `docs/master/evidencias/scrum1500/cotejo-salida.txt`, con su fecha y su sha.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { veredicto, censoViejo, valoresDeLista, valoresDelMaster, esEstado } = require('../docs/master/evidencias/scrum1500/cotejo.cjs');

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
