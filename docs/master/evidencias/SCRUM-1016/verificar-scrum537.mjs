// docs/master/evidencias/SCRUM-1016/verificar-scrum537.mjs — SCRUM-1016j
//
// Verificación PURA (no toca public/index.html) de los dos candidatos de
// docs/master/SCRUM-1016.md (apéndice SCRUM-1016i) contra un CUARTO guard que
// scripts/verificar-candidatos.mjs no cubre: SCRUM-537 (afirmaciones fiscales falsas).
// Importa la función real y le pasa el HTML candidato como string.
//
// Uso: node docs/master/evidencias/SCRUM-1016/verificar-scrum537.mjs   (desde la raíz del repo)
import { afirmacionesFalsas } from '../../../../scripts/_guard-afirmacion-fiscal.mjs';

const CANDIDATOS = {
  'CANDIDATO 1 · Eje A con matiz citado (H2) en el subtítulo': {
    h1: 'Del presupuesto a la firma, <span class="hl">sin salir de WhatsApp.</span>',
    sub: 'Crea el presupuesto en 30 segundos y tu cliente lo firma desde el móvil por WhatsApp. Hoy generamos cada registro de facturación con el formato oficial de la AEAT; la remisión a Hacienda todavía no está construida, y los founding la estrenaréis sin cambio de precio.',
    title: 'YaQu — Del presupuesto a la firma, sin salir de WhatsApp',
  },
  'CANDIDATO 2 · Sin nombrar términos regulados (más cerca de 26b)': {
    h1: 'Del presupuesto a la firma, <span class="hl">sin salir de WhatsApp.</span>',
    sub: 'Crea el presupuesto en 30 segundos y tu cliente lo firma desde el móvil por WhatsApp. Clientes, gastos y trabajos en un mismo sitio — sin post-its ni Excel.',
    title: 'YaQu — Del presupuesto a la firma, sin salir de WhatsApp',
  },
};

for (const [nombre, { h1, sub, title }] of Object.entries(CANDIDATOS)) {
  const html = `<h1 id="reg-hero">${h1}</h1>\n<p class="sub">${sub}</p>\n<title>${title}</title>`;
  const resultado = afirmacionesFalsas(html, { envioConstruido: false });
  console.log(`\n===== ${nombre} =====`);
  console.log(`SCRUM-537 (afirmacionesFalsas) — hallazgos: ${resultado.length}`);
  for (const r of resultado) console.log(`   🔴 [familia ${r.familia}] «${r.texto}» — ${r.motivo}`);
  if (resultado.length === 0) console.log('   ✅ limpio');
}
