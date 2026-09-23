// Sonda SCRUM-1018: corre la MISMA expresion que customerPortal.routes.ts (copiada verbatim de las
// lineas 422-436 del fichero real, no reescrita de memoria), contra casos fabricados, usando la
// funcion REAL zonaDelMerchant compilada. No toca ninguna base de datos: no hay credencial en esta
// maquina (comprobado, 0 DATABASE_URL* en el entorno) — asi que esto verifica la FORMATEACION y el
// literal, no la consulta Prisma (esa la valido `npm run build` con tsc contra el schema real).
// Uso: node probar-visita-1018.mjs [raiz-del-worktree]  (por defecto, la raiz de este repo)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const RAIZ = process.argv[2] || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const { zonaDelMerchant } = require(path.join(RAIZ, 'dist/core/zonaDelMerchant.js'));
const { esc } = require(path.join(RAIZ, 'dist/core/utils/utils.js'));

function visitaHtml(proximoJob, nombreTecnico, m) {
  // ── copiado verbatim de customerPortal.routes.ts:422-436 ──
  if (!proximoJob?.scheduledAt) return '';
  const zona = zonaDelMerchant(m);
  const inicio = new Date(proximoJob.scheduledAt);
  const fin = new Date(inicio.getTime() + 60 * 60 * 1000);
  const fmtHora = (d) => new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit', timeZone: zona }).format(d);
  const franja = `entre las ${fmtHora(inicio)} y las ${fmtHora(fin)}`;
  const linea = nombreTecnico ? `${esc(nombreTecnico)} · ${franja}` : franja;
  return `<div class="pf-section">
      <div class="pf-section-title">Tu visita</div>
      <div class="pf-card"><div class="pf-card-body">
        <div class="pf-card-title" style="margin-bottom:0">${linea}</div>
      </div></div>
    </div>`;
}

const casos = [
  { nombre: 'A: con técnico, con hora (peninsular)', proximoJob: { scheduledAt: '2026-09-24T14:00:00.000Z' }, nombreTecnico: 'Marcos Ruiz', m: { timezone: 'Europe/Madrid' } },
  { nombre: 'B: SIN técnico (assignedUserId y JobAssignee vacíos), con hora', proximoJob: { scheduledAt: '2026-09-24T14:00:00.000Z' }, nombreTecnico: null, m: { timezone: 'Europe/Madrid' } },
  { nombre: 'C: SIN hora agendada (proximoJob null → sección entera fuera)', proximoJob: null, nombreTecnico: null, m: { timezone: 'Europe/Madrid' } },
  { nombre: 'D: con técnico con nombre "peligroso" (XSS), con hora', proximoJob: { scheduledAt: '2026-09-24T14:00:00.000Z' }, nombreTecnico: '<script>alert(1)</script>', m: { timezone: 'Europe/Madrid' } },
  { nombre: 'E: con técnico, con hora, merchant CANARIO (zona distinta)', proximoJob: { scheduledAt: '2026-09-24T14:00:00.000Z' }, nombreTecnico: 'Marcos Ruiz', m: { timezone: 'Atlantic/Canary' } },
  { nombre: 'F: merchant sin timezone declarada (cae a UTC por defecto)', proximoJob: { scheduledAt: '2026-09-24T14:00:00.000Z' }, nombreTecnico: 'Marcos Ruiz', m: { timezone: null } },
];

for (const c of casos) {
  const out = visitaHtml(c.proximoJob, c.nombreTecnico, c.m);
  console.log('── ' + c.nombre + ' ──');
  console.log(out === '' ? '(cadena vacía: la sección NO se pinta)' : out);
  console.log('');
}
