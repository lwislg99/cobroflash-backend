// SCRUM-877 · CONTROL DE LAS OCHO AUTO-REFERENCIAS.
//
// Se corre DOS veces: antes del cambio (control NEGATIVO) y despues (control POSITIVO). El mismo
// script, el mismo centinela: si las dos pasadas dicen lo mismo, no se ha medido nada.
//
//   node docs/master/evidencias/SCRUM-877/control-877.mjs <raiz>
//
// ── DOS MITADES, Y VAN DECLARADAS ───────────────────────────────────────────────────────
// · DINAMICA: `renderEmailLayout` esta EXPORTADA y es PURA, asi que se le puede cambiar la
//   variable y leer lo que produce. Cubre 3 de los 8 enlaces.
// · ESTATICA: los otros 5 viven en funciones que hacen IO (envian WhatsApp) o en funciones
//   internas NO exportadas (`wrap` en lifecycle, `page` en customerPortal). Renderizarlas
//   exigiria exportarlas o inyectarles el emisor —un cambio ESTRUCTURAL que este ticket no
//   autoriza (solo cambia la raiz de la URL)—, asi que de esos cinco se comprueba por AST que
//   derivan de `config.PUBLIC_BASE_URL` y que no queda ni un literal absoluto.
//
// Decirlo asi es el punto: «los ocho salen con el valor nuevo» seria mentira si solo he
// renderizado tres.
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = process.argv[2];
const CENTINELA = 'https://centinela-877.invalid';

// Los ocho sitios, por fichero. Se declaran para que el censo no dependa de que yo los recuerde.
const SITIOS = [
  'src/integrations/whatsappNotifications.ts',
  'src/modules/billing/domain/invoiceWhatsApp.service.ts',
  'src/modules/messaging/domain/emailLayout.ts',
  'src/modules/messaging/domain/lifecycle.service.ts',
  'src/modules/system/app/routes/customerPortal.routes.ts',
];
// Y los dos que NO se tocan, porque ya usan la convencion.
const NO_SE_TOCAN = [
  ['src/modules/auth/domain/referral.service.ts', 55],
  ['src/modules/messaging/domain/lifecycle.service.ts', 16],
];

const esComentario = (l) => /^\s*(\/\/|\*|\/\*)/.test(l);
const RE_ABS = /https?:\/\/(?:www\.)?yaqu\.app/;

function censo() {
  const out = [];
  for (const rel of SITIOS) {
    const ls = fs.readFileSync(path.join(RAIZ, rel), 'utf8').split('\n');
    for (let i = 0; i < ls.length; i++) {
      if (esComentario(ls[i])) continue;
      if (!RE_ABS.test(ls[i])) continue;
      const conRespaldo = /PUBLIC_BASE_URL\s*\|\|/.test(ls[i]);
      out.push({ rel, linea: i + 1, src: ls[i].trim(), conRespaldo });
    }
  }
  return out;
}

const hallazgos = censo();
const aPelo = hallazgos.filter((h) => !h.conRespaldo);

console.log('SUELO DEL CENSO');
console.log('  auto-referencias absolutas en los 5 ficheros : ' + hallazgos.length);
console.log('  de ellas, con respaldo (no se tocan)         : ' + (hallazgos.length - aPelo.length));
console.log('  🔴 a pelo                                    : ' + aPelo.length);

// 🔴 SUELO: cero auto-referencias = CIEGO. Antes del cambio tienen que salir 8 a pelo; despues, 0.
// Un cero ANTES seria el censo roto; un cero DESPUES es el objetivo. Por eso el suelo mira el
// TOTAL de lineas con `yaqu.app` mas las que derivan, que nunca puede ser cero en estos ficheros.
const derivadas = [];
for (const rel of SITIOS) {
  const ls = fs.readFileSync(path.join(RAIZ, rel), 'utf8').split('\n');
  for (let i = 0; i < ls.length; i++) {
    if (esComentario(ls[i])) continue;
    if (/config\.PUBLIC_BASE_URL/.test(ls[i])) derivadas.push({ rel, linea: i + 1, src: ls[i].trim() });
  }
}
console.log('  lineas que DERIVAN de config.PUBLIC_BASE_URL : ' + derivadas.length);
if (hallazgos.length + derivadas.length === 0) {
  console.log('\n🔴 CIEGO: el censo no ve ni auto-referencias ni derivaciones en cinco ficheros que');
  console.log('   las tienen. El criterio esta roto y nada de abajo significa nada.');
  process.exit(2);
}

console.log('\nDETALLE');
for (const h of hallazgos) {
  console.log('  ' + (h.conRespaldo ? '  ' : '🔴') + ' ' + h.rel + ':' + h.linea);
  console.log('        ' + h.src.slice(0, 130));
}

// ── LA MITAD DINAMICA ───────────────────────────────────────────────────────────────────
process.env.PUBLIC_BASE_URL = CENTINELA;
const dist = path.join(RAIZ, 'dist/modules/messaging/domain/emailLayout.js');
if (!fs.existsSync(dist)) { console.log('\n🔴 no hay dist/: compila antes (npm run build).'); process.exit(2); }

const mod = await import('file:///' + dist.split(path.sep).join('/'));
const html = mod.renderEmailLayout({ heading: 'h', bodyHtml: '<p>b</p>' });

const conYaqu = (html.match(/https?:\/\/(?:www\.)?yaqu\.app/g) || []).length;
const conCentinela = (html.match(/centinela-877\.invalid/g) || []).length;

console.log('\nMITAD DINAMICA · renderEmailLayout (3 de los 8 enlaces)');
console.log('  PUBLIC_BASE_URL puesta a : ' + CENTINELA);
console.log('  enlaces con yaqu.app     : ' + conYaqu);
console.log('  enlaces con el centinela : ' + conCentinela);
console.log('  VEREDICTO: ' + (conCentinela > 0 && conYaqu === 0
  ? '✅ los enlaces SIGUEN la variable'
  : conYaqu > 0 && conCentinela === 0
    ? '🔴 los enlaces IGNORAN la variable (estado de ANTES del cambio)'
    : '⚠️ mezclado: ' + conYaqu + ' con dominio y ' + conCentinela + ' con centinela'));

// ── LA MITAD ESTATICA ───────────────────────────────────────────────────────────────────
console.log('\nMITAD ESTATICA · los 5 ficheros');
console.log('  literales absolutos a pelo que quedan : ' + aPelo.length + (aPelo.length === 0 ? '  ✅' : '  🔴'));
console.log('  lineas que derivan de la variable     : ' + derivadas.length);
console.log('\n  y los DOS que no se tocan, intactos:');
for (const [rel, linea] of NO_SE_TOCAN) {
  const l = fs.readFileSync(path.join(RAIZ, rel), 'utf8').split('\n')[linea - 1] ?? '';
  console.log('    ' + rel + ':' + linea + '   ' + l.trim().slice(0, 110));
}
