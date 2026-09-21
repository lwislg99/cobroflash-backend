// SCRUM-911 · la ficha 360 del cliente es `GET /admin/customers/:id/detail` (customersAdmin.routes.ts:236),
// NO `GET /admin/customers/:id` — esa devuelve la ficha plana y no trae eventos.
import fs from 'node:fs';
import { sesionQA } from './_entorno.mjs';

const { api } = await sesionQA();
const r = await api('GET', '/admin/customers/3927/detail');
const eventos = r.json?.events ?? [];
console.log('GET /admin/customers/3927/detail → status', r.status, '· claves:', Object.keys(r.json ?? {}).join(', '));
const propuestas = eventos.filter((e) => e.type === 'maintenance_proposed');
console.log('eventos maintenance_proposed:', JSON.stringify(propuestas, null, 2));
const R = { fichaDelCliente: propuestas.length ? 'funciona' : `falla (${eventos.length} eventos, ninguno de mantenimiento)` };
fs.writeFileSync('./paso4b.json', JSON.stringify({ propuestas, R }, null, 2));
console.log('VEREDICTO ficha 360:', R);
