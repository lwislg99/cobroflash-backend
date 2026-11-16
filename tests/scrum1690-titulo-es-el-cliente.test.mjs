// SCRUM-1690 (PILOTO-1, X1 de SCRUM-1686 c.21459) · la ficha del Trabajo deja de titularse
// «Presupuesto #N · cliente».
//
// SCRUM-317 dejó escrita la regla (job.service.ts, bloque «EL TRABAJO YA NO NACE LLAMÁNDOSE
// «Presupuesto #N»»): mientras el profesional no le ponga nombre, la pantalla se titula con el
// CLIENTE y el presupuesto se queda como documento de ORIGEN, no como nombre. Pero
// `tituloDeTrabajo` seguía fabricando «Presupuesto #N · cliente» para todo Trabajo con presupuesto,
// y de ahí bebían la ficha (`serializeJob`), Gastos y el historial del cliente.
//
// Se prueba la FUNCIÓN, no el texto del fuente (SCRUM-651: un guard por texto pasa en verde en
// cuanto alguien reescribe la expresión sin cambiar el defecto). Que la ficha usa esta función lo
// fija ya `scrum917d` por AST sobre el return de `serializeJob`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tituloDeTrabajo } from '../dist/modules/jobs/domain/trabajoDirecto.js';

test('SCRUM-1690 · 🔴 un Trabajo CON presupuesto y sin nombre propio se titula con el CLIENTE', () => {
  // Se le sigue pasando `quote` a propósito: es lo que hacían los tres llamadores, y lo que se
  // fija es que el presupuesto NO entra en el nombre.
  const titulo = tituloDeTrabajo({
    titulo: null,
    quote: { quoteNumber: 34, id: 9 },
    customer: { name: 'Bar Paco' },
    jobId: 12,
  });
  assert.equal(titulo, 'Bar Paco', `🔴 la ficha se titula ${JSON.stringify(titulo)}: el presupuesto es el origen, no el nombre (SCRUM-317)`);
  assert.doesNotMatch(titulo, /Presupuesto/);
});

test('SCRUM-1690 · con presupuesto y SIN cliente, el respaldo es el del Trabajo (#id), no el número del presupuesto', () => {
  const titulo = tituloDeTrabajo({ titulo: null, quote: { quoteNumber: null, id: 9 }, customer: null, jobId: 12 });
  assert.equal(titulo, '#12');
});

test('SCRUM-1690 · el nombre que puso el profesional sigue mandando, haya o no presupuesto', () => {
  assert.equal(
    tituloDeTrabajo({ titulo: 'Avería cocina', quote: { quoteNumber: 34, id: 9 }, customer: { name: 'Bar Paco' }, jobId: 12 }),
    'Avería cocina',
  );
});

test('SCRUM-1690 · CONTROL POSITIVO: sin presupuesto el resultado ya era el cliente (la función responde)', () => {
  assert.equal(tituloDeTrabajo({ titulo: null, quote: null, customer: { name: 'Bar Paco' }, jobId: 12 }), 'Bar Paco');
});
