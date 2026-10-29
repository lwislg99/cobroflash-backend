// Sonda 3: la frase de cada condición de texto, contada en TRES versiones del código:
// la producción congelada (fe65a8b7, servida del 20-oct 15:35Z hasta el deshielo del 23-oct), el main de ayer
// (808af5b44, el de 1554f) y HEAD (= lo que sirve hoy yaqu.app). Uso: node frases.mjs <repo>
import { execFileSync } from 'node:child_process';
const [repo] = process.argv.slice(2);
const show = (c, f) => { try { return execFileSync('git', ['-C', repo, 'show', `${c}:${f}`], { maxBuffer: 1 << 26 }).toString('utf8'); } catch { return null; } };
const commits = ['fe65a8b7f', '808af5b44', 'HEAD'];
const sondas = [
  ['2 R1 «Cobro integrado»', 'docs/legal/ALCANCE_BETA.md', 'Cobro integrado'],
  ['2 R2 «Justificantes de cobro»', 'docs/legal/ALCANCE_BETA.md', 'Justificantes de cobro'],
  ['2 R3 soporte «email y WhatsApp»', 'docs/legal/ALCANCE_BETA.md', 'email y WhatsApp'],
  ['2 R5 «mientras tanto»', 'docs/legal/ALCANCE_BETA.md', 'ientras tanto'],
  ['2 R4 «no emite» (debe estar)', 'docs/legal/ALCANCE_BETA.md', 'no emite'],
  ['3 D1 aviso de borrador servido (debe estar)', 'docs/legal/ALCANCE_BETA.md', '\nBorrador pendiente de revisión legal'],
  ['3 «[REVISAR ASESOR» (todas, también las de la cita)', 'docs/legal/ALCANCE_BETA.md', '[REVISAR ASESOR'],
  ['7 terminos:48 «emitir facturas y gestionar cobros»', 'public/terminos.html', 'emitir facturas y gestionar cobros'],
  ['7 terminos:80 «cotización y factura»', 'public/terminos.html', 'cotización y factura'],
  ['11 «Tarjeta, Bizum o transferencia»', 'public/index.html', 'Tarjeta, Bizum o transferencia'],
  ['12 aria «de presupuesto a cobro»', 'public/index.html', 'de presupuesto a cobro'],
  ['13 «sin perseguir presupuestos»', 'public/index.html', 'sin perseguir presupuestos'],
  ['14 héroe viejo «gastos y facturas»', 'public/index.html', 'gastos y facturas'],
  ['14 héroe nuevo (debe estar)', 'public/index.html', 'Y llevas clientes, gastos y albaranes'],
  ['14 espejo «te paga — con tarjeta» (#heroe-f4, hidden)', 'public/index.html', 'te paga — con tarjeta'],
  ['15 bot «Estás al día! No tienes ningún pago pendiente con»', 'src/modules/whatsappBot/domain/botFlow.service.ts', 'No tienes ningún pago pendiente con'],
  ['20 connect «Error creando el onboarding»', 'src/modules/payments/connect/connect.routes.ts', 'Error creando el onboarding'],
];
const filas = sondas.map(([q, f, frase]) => [q, f, ...commits.map((c) => { const t = show(c, f); return t === null ? 'SIN FICHERO' : String(t.split(frase).length - 1); })]);
console.log(['condición', 'fichero', ...commits].join(' | '));
for (const r of filas) console.log(r.join(' | '));
