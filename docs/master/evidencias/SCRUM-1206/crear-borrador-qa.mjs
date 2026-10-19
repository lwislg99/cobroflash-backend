// SCRUM-1206b · UNA escritura en la cuenta QA: un albarán NUEVO en BORRADOR, en el Trabajo #76 (el
// de pruebas QA), con cabecera y observaciones. No se emite, no se firma, no se envía.
// Antes de escribir: comprueba que la sesión es la de QA y apunta los albaranes que ya hay.
// Uso: node crear-borrador-qa.mjs
import fs from 'node:fs';
const cookie = fs.readFileSync('C:/Users/Admin/.yaqu-qa-sesion.txt', 'utf8').trim().split(';')[0];
const BASE = 'https://yaqu.app';
const h = { cookie, 'content-type': 'application/json' };

const me = await (await fetch(`${BASE}/admin/me`, { headers: h })).json();
// `/admin/me` no trae el email: el cerrojo es el negocio. El 46 es la cuenta QA (SCRUM-1268); el 1, la demo.
if (me.merchantId !== 46) { console.log(JSON.stringify({ PARADO: 'la sesión no es la de QA (merchant 46)', merchantId: me.merchantId })); process.exit(2); }

const antes = await (await fetch(`${BASE}/admin/albaranes`, { headers: h })).json();
console.log(JSON.stringify({ ANTES: (antes.filas || []).map((f) => ({ id: f.id, numero: f.numero, estado: f.estado, jobId: f.jobId })) }));

const cuerpo = {
  docHeaderText: '[QA S4 16-oct] Cabecera de pruebas (SCRUM-1206b).\nNo es un cliente real.',
  notas: '[QA S4 16-oct] Observaciones de pruebas (SCRUM-1206b).',
};
const r = await fetch(`${BASE}/admin/jobs/76/albaranes`, { method: 'POST', headers: h, body: JSON.stringify(cuerpo) });
const d = await r.json().catch(() => null);
console.log(JSON.stringify({ POST: r.status, id: d && (d.id ?? (d.albaran && d.albaran.id)), numero: d && (d.numero ?? (d.albaran && d.albaran.numero)), estado: d && (d.estado ?? (d.albaran && d.albaran.estado)), error: d && d.error }));
