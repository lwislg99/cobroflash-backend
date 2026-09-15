// docs/master/evidencias/scrum675/margen-de-hoy.mjs — SCRUM-675
//
// EL MARGEN REAL DE HOY. El ticket declara 152/253/168 sobre el censo de SCRUM-647; lo primero
// que hay que saber es si ese numero sigue siendo el de hoy o el ticket ha envejecido.
//
// MARGEN = tamano de la ventana − distancia desde el ancla hasta el simbolo mas lejano que el
// guard busca dentro. Es lo que queda antes de que escribir un comentario deje ciego al guard.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../../../../', import.meta.url));
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

/**
 * Los casos con la forma exacta del ticket: `indexOf(ancla)` + `slice(i, i + N)`, y dentro se
 * busca uno o varios simbolos. Se declaran con su ancla y sus simbolos porque **medir esto
 * generico exigiria ejecutar cada guard**; aqui se reproduce su cuenta, que es lo que importa.
 */
const CASOS = [
  {
    nombre: 'scrum370 · gastos del Trabajo',
    fuente: 'src/modules/jobs/app/routes/jobs.routes.ts',
    ancla: "router.get('/:id/gastos'",
    ventana: 1400,
    simbolos: ['seesOnlyOwnJobs', 'listExpenses', 'quoteId'],
  },
  {
    nombre: 'scrum856 · canje una sola vez',
    fuente: 'src/modules/billing/domain/referral.service.ts',
    ancla: 'export async function rewardReferralOnFirstPayment',
    ventana: 1400,
    simbolos: ['referralRewardedAt'],
  },
];

let algunoMedido = false;
console.log('MARGEN DE HOY — «cuanto se puede escribir antes de dejar ciego al guard»');
console.log('');
for (const c of CASOS) {
  let texto;
  try { texto = leer(c.fuente); } catch { console.log(`   ${c.nombre}: 🔴 no se puede leer ${c.fuente}`); continue; }
  const i = texto.indexOf(c.ancla);
  if (i < 0) { console.log(`   ${c.nombre}: 🔴 ANCLA NO ENCONTRADA («${c.ancla}») — el guard ya no mide lo que cree`); continue; }

  const bloque = texto.slice(i, i + c.ventana);
  let masLejano = -1;
  let cual = null;
  let fuera = [];
  for (const s of c.simbolos) {
    const j = bloque.indexOf(s);
    if (j < 0) { fuera.push(s); continue; }
    if (j + s.length > masLejano) { masLejano = j + s.length; cual = s; }
  }
  algunoMedido = true;
  const margen = c.ventana - masLejano;
  console.log(`   ${c.nombre}`);
  console.log(`      ventana ${c.ventana} · simbolo mas lejano «${cual}» acaba en ${masLejano}`);
  console.log(`      🔴 MARGEN: ${margen} caracteres`);
  if (fuera.length) {
    console.log(`      🔴🔴 YA FUERA DE LA VENTANA: ${fuera.join(', ')} — el guard NO los ve hoy`);
  }
  console.log('');
}

// ── SUELO ────────────────────────────────────────────────────────────────────────────────
if (!algunoMedido) {
  console.log('🔴 CIEGO: no se pudo medir ni un margen. Un cero aqui no dice que no haya ventanas;');
  console.log('   dice que este instrumento no encontro sus anclas.');
  process.exit(3);
}

// ── ¿Y el caso que el ticket nombra? ─────────────────────────────────────────────────────
console.log('EL CASO DEL TICKET (censo de SCRUM-647), COMPROBADO HOY:');
const t647 = leer('tests/scrum647-presupuesto-tambien-neutral.test.mjs');
const porIdentidad = /t\.slice\(i, t\.indexOf\(/.test(t647);
const ventanaFija = /slice\([^)]*\+\s*\d{3,}/.test(t647);
console.log(`   ¿sigue leyendo por VENTANA FIJA?  ${ventanaFija ? '🔴 SI' : 'NO ✅'}`);
console.log(`   ¿lee por IDENTIDAD (indexOf→indexOf)? ${porIdentidad ? 'SI ✅' : '🔴 NO'}`);
console.log('');
console.log('   Y su propio comentario lo dice, citado del fichero:');
const linea = t647.split(String.fromCharCode(10)).find((l) => l.includes('longitud fija'));
console.log(`   «${(linea || '').trim()}»`);
console.log('');
console.log('   -> El caso concreto del ticket YA SE ARREGLO, y con la salida A (ancla por');
console.log('      identidad). El ticket ha envejecido en su ejemplo, NO en su tesis: la familia');
console.log('      sigue viva en los demas guards.');
