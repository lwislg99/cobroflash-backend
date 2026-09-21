#!/usr/bin/env node
// SCRUM-612 (borrador de enmienda) — censo por CONTENIDO de lo que el máster y CLAUDE.md dicen sobre
// el justificante, el interruptor INVOICING_ES_ENABLED y COBRAR antes de facturar.
//
// Solo lectura. Lee los ficheros de un SHA concreto con `git show <ref>:<ruta>` (no del árbol de
// trabajo, que puede ir por detrás), y declara la población antes que el resultado (A3).
//
// Uso:  node docs/master/evidencias/SCRUM-612/censo-enmienda-612.mjs <repo> [ref] [--lineas]
//   <repo>    ruta del repositorio
//   [ref]     por defecto origin/main
//   --lineas  además del recuento, imprime cada línea casada con su sección y un recorte
//
// Salida: población (líneas y bytes de cada fichero), recuento de líneas por familia, controles
// positivos (frases que SABEMOS que están, y que la búsqueda tiene que encontrar) y EXIT=.

import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const repo = args.find((a) => !a.startsWith('--')) || '.';
const ref = args.filter((a) => !a.startsWith('--'))[1] || 'origin/main';
const conLineas = args.includes('--lineas');

const git = (...a) => execFileSync('git', ['-C', repo, ...a], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const sha = git('rev-parse', ref).trim();

const FICHEROS = ['docs/YAQU_MASTER.md', 'CLAUDE.md'];

// Familias por CONTENIDO. Cada una es una pregunta distinta; una línea puede casar varias.
// «cobroflash» (el nombre viejo del repo) se quita ANTES de buscar la familia COBRO: no es cobrar.
const FAMILIAS = {
  JUSTIFICANTE: /justificante|\bJUST\b|`J-|«J-|\bJ-…|\bJ-\d/i,
  INTERRUPTOR: /INVOICING_ES_ENABLED/,
  SENAL: /señal|anticipo|dep[oó]sito|por adelantado|prepago/i,
  ENLACE_PAGO: /enlace de pago|link de pago|payment[ _-]?link|\/pay\/|bot[oó]n (de )?pag|«Pagar»|payment_request/i,
  COBRO: /\bcobr(o|os|ar|a|an|ado|ada|ados|adas|anza|ando|amos|arle|arlo|able)\b/i,
  MEDIOS: /stripe|bizum|transferencia|connect\b|mercado ?pago|\bPSP\b|pasarela/i,
  RECORDATORIO: /recordatorio|reminder/i,
  RECIBO: /\brecibo\b|\/recibo/i,
  FLUJO: /presupuesto[^.|]{0,80}(firma|acepta)[^.|]{0,80}(cobr|pag|señal)/i,
};

// Controles positivos: frases que están HOY en el máster (leídas a mano antes de escribir esto) y que
// la familia indicada tiene que ver. Si no las ve, el instrumento está ciego y lo dice.
const CONTROLES = [
  // Literal con comillas rectas, tal como está en la fila de la Parte P. La primera versión de este
  // control decía «vuelve a justificante» (sin comillas, copiado de un traspaso) y FALLÓ: el control
  // de una frase se escribe con la frase leída, no recordada.
  { fichero: 'docs/YAQU_MASTER.md', familia: 'JUSTIFICANTE', frase: 'vuelve a "justificante"' },
  { fichero: 'docs/YAQU_MASTER.md', familia: 'INTERRUPTOR', frase: 'INVOICING_ES_ENABLED' },
  { fichero: 'docs/YAQU_MASTER.md', familia: 'SENAL', frase: 'señal' },
  { fichero: 'CLAUDE.md', familia: 'SENAL', frase: 'cobro de señal/total' },
];

// Control NEGATIVO: una frase inventada que no puede estar. Si «casa», la familia casa con todo.
const NEGATIVO = 'zzq cobroflash zzq';

// HISTORIAL: registro de trabajo hecho (bloque «>» o «✅ SCRUM-…»). No se reescribe (AA1.7: «✅ con
// motivo; nunca borrar»). Todo lo demás es CANDIDATA y se clasifica A MANO, línea a línea, abajo.
const esHistorial = (t) => /^\s*>/.test(t) || /✅\s*\**\s*SCRUM-\d+/.test(t) || /^\s*\**\s*✅/.test(t);

// CLASIFICACIÓN A MANO de cada candidata (leída entera). El instrumento compara CONJUNTOS: si una
// candidata no tiene clase, o una clase nombra una línea que no es candidata, FALLA (A3).
//   CAMBIA        · el borrador propone texto (§2 del expediente, SCRUM-612b)
//   COMERCIAL     · choca con B en el argumentario/venta: se señala y NO se redacta (E-5/E-6)
//   ABIERTA       · choca, y no es de J1: se deja como pregunta (§7)
//   CUBIERTA      · describe el cobro cuando existe; la regla 24 nueva la acota sin cambiarle el texto
//   OTRO_SENTIDO  · «señal» = indicio, «recordatorio» de mantenimiento o de visita
//   HISTORIA      · registro de trabajo hecho que el filtro automático no reconoce
//   NO_CHOCA      · otra fase o país, investigación, suscripción de YaQu, diseño, seguridad, tooling
const CLASIFICACION = {
  'docs/YAQU_MASTER.md': {
    CAMBIA: [31, 39, 40, 41, 42, 51, 100, 197, 243, 245, 397, 405, 415, 429, 463, 571, 956, 977, 985, 1044, 1622],
    COMERCIAL: [52, 78, 90, 214, 225, 226, 227, 231, 234, 437, 1634, 1839],
    ABIERTA: [423],
    CUBIERTA: [59, 124, 125, 133, 136, 165, 166, 177, 178, 241, 244, 293, 294, 295, 299, 319, 375, 384, 386,
      399, 408, 414, 425, 426, 435, 444, 445, 446, 447, 455, 465, 466, 467, 575, 576, 580, 602, 971, 982,
      1046, 1047, 1048, 1049, 1051, 1621, 1625, 1627, 1628, 1636, 1681],
    OTRO_SENTIDO: [352, 600, 643, 981, 1666],
    HISTORIA: [978, 984],
    NO_CHOCA: [37, 63, 68, 72, 79, 91, 95, 102, 107, 110, 154, 175, 193, 200, 202, 215, 247, 292, 404, 407,
      422, 475, 487, 542, 621, 664, 861, 864, 867, 983, 1041, 1061, 1064, 1633, 1694, 1706, 1707, 1722,
      1724, 1725, 1726, 1728, 1734, 1736, 1737, 1751, 1777, 1782, 1800, 1827, 1833, 1836, 1860, 1863,
      1864, 1865, 1866, 1869, 1876, 1879, 1880],
  },
  'CLAUDE.md': {
    CAMBIA: [6, 7, 89, 90, 91, 92],
    NO_CHOCA: [44, 65, 147, 151, 167],
  },
};
// Líneas clasificadas que NO son candidatas, declaradas con su motivo (si no, el conjunto no cuadra):
const EXTRAS = {
  'docs/YAQU_MASTER.md': { 956: 'es historial (resumen «>» de VALIDA-0) pero el borrador lo anota: V0-0 cambia' },
  'CLAUDE.md': { 90: 'segunda línea de la regla 7; no casa ninguna familia pero el borrador la cambia' },
};

// CITAS: cada «hoy dice» del borrador, con su fichero y su línea medida. Se comprueba que el literal
// SIGUE en esa línea en el SHA medido; si no, se dice dónde está ahora (o que ya no está).
const CITAS = [
  ['docs/YAQU_MASTER.md', 31, '**Hasta entonces, la beta vende presupuestos, firma y cobro con justificante no fiscal: nunca "facturación" ni claims fiscales** (reglas 17, 24, 26).'],
  ['docs/YAQU_MASTER.md', 39, '  → se genera justificante no fiscal — o factura VeriFactu si INVOICING_ES_ENABLED (post SIF-1)'],
  ['docs/YAQU_MASTER.md', 40, '  → cliente paga señal/total (tarjeta Connect · Bizum manual · transferencia)'],
  ['docs/YAQU_MASTER.md', 41, '  → merchant recibe confirmación por WhatsApp; factura/justificante al cliente por email'],
  ['docs/YAQU_MASTER.md', 42, '  → recordatorios automáticos persiguen lo pendiente (24h / 7d / 14d)'],
  ['docs/YAQU_MASTER.md', 51, '**con el gate fiscal cerrado (SIF-1, regla 24) la factura VeriFactu se emite sola — antes de SIF-1 el flujo entrega justificante no fiscal.**'],
  ['docs/YAQU_MASTER.md', 51, 'paga la señal sin salir de la conversación'],
  ['docs/YAQU_MASTER.md', 51, 'Los recordatorios persiguen al moroso automáticamente'],
  ['docs/YAQU_MASTER.md', 52, '"Cobra la señal antes de empezar y no persigas a nadie nunca más."'],
  ['docs/YAQU_MASTER.md', 292, '| `quote_decision_es` | ✅ | Envío de presupuesto + recordatorio 24h |'],
  ['docs/YAQU_MASTER.md', 466, 'seguro: se oculta'],
  ['docs/YAQU_MASTER.md', 467, 'seguro: se oculta'],
  ['docs/YAQU_MASTER.md', 78, '**% de cobros del merchant vía plataforma** (instrumentar desde el día 1)'],
  ['docs/YAQU_MASTER.md', 90, 'Competencia "gratis" Kit Digital → vender cobro, no factura'],
  ['docs/YAQU_MASTER.md', 100, 'Hasta entonces, cobros reales SOLO transferencia/Bizum manual; tarjeta limitada a demo/test (regla 18).'],
  ['docs/YAQU_MASTER.md', 197, '**Gates:** SIF-1 = gate de venta fuerte, de TODO claim fiscal y de `INVOICING_ES_ENABLED`. CONNECT-1 = gate solo de tarjeta real. Conflicto un día dado → gana SIF-1 SIEMPRE.'],
  ['docs/YAQU_MASTER.md', 214, 'categoría = "herramienta para presupuestar, firmar y cobrar señales por WhatsApp"'],
  ['docs/YAQU_MASTER.md', 214, 'por eso la beta es de presupuestos y cobros'],
  ['docs/YAQU_MASTER.md', 225, 'te paga la señal antes de que empieces'],
  ['docs/YAQU_MASTER.md', 226, 'señal cobrada antes de empezar y recordatorios que persiguen al que no paga'],
  ['docs/YAQU_MASTER.md', 227, 'señal cobrada antes de empezar'],
  ['docs/YAQU_MASTER.md', 231, 'no cobra la señal y no persigue al moroso solo'],
  ['docs/YAQU_MASTER.md', 234, '"¿Cuántas señales has dejado de cobrar este mes?"'],
  ['docs/YAQU_MASTER.md', 243, '18) Tarjeta para clientes reales SOLO con Connect activo en ese merchant; mientras, transferencia/Bizum manual.'],
  ['docs/YAQU_MASTER.md', 244, '23) Prohibido procesar pagos de clientes finales en la cuenta Stripe de plataforma: PSP = cuenta conectada del merchant o nada.'],
  ['docs/YAQU_MASTER.md', 245, '24) `INVOICING_ES_ENABLED=false` para merchants ES reales hasta SIF-1 v2 completo; facturas demo con marca de agua SIEMPRE.'],
  ['docs/YAQU_MASTER.md', 245, '25) Cobro a founding pre-SIF exige alcance por escrito (`docs/legal/ALCANCE_BETA.md`).'],
  ['docs/YAQU_MASTER.md', 245, 'el gancho comercial nº1 es la MOROSIDAD/el cobro'],
  ['docs/YAQU_MASTER.md', 247, '33) Onboarding bloquea facturación ES a domicilios forales (PV/Navarra) con aviso digno; TicketBAI = cajón F3.'],
  ['docs/YAQU_MASTER.md', 299, 'copy neutro **"tu documento de cobro"** (válido para factura y justificante)'],
  ['docs/YAQU_MASTER.md', 397, 'factura(s) según paymentTerms; WA al pro; PDF'],
  ['docs/YAQU_MASTER.md', 405, '`terminado` → CTA "Cobrar el resto" si hay tramo pendiente; `cerrado` = todo cobrado o decisión del pro.'],
  ['docs/YAQU_MASTER.md', 415, 'Cobro → sin `charge_ready`, modal inline "Añade tu IBAN o tu Bizum para que te puedan pagar".'],
  ['docs/YAQU_MASTER.md', 415, 'sin ellos el documento post-pago es **"justificante de cobro"** (sin numeración de factura, sin QR) — el copy NUNCA dice "factura".'],
  ['docs/YAQU_MASTER.md', 423, '("Señal del 50 % al aceptar · resto al terminar")'],
  ['docs/YAQU_MASTER.md', 429, '"Descargar factura (PDF)" (o "justificante"), fecha/método.'],
  ['docs/YAQU_MASTER.md', 435, '"Pagar [importe]"'],
  ['docs/YAQU_MASTER.md', 437, '**"El ERP por WhatsApp para los oficios · Del presupuesto al cobro, sin salir de WhatsApp"**'],
  ['docs/YAQU_MASTER.md', 463, '| `INVOICING_ES_ENABLED` | país ES / merchant | **OFF** | admin tras SIF-1 v2 8/8 | factura fiscal ES a reales | SIF-1 + datos fiscales | seguro: vuelve a "justificante" |'],
  ['docs/YAQU_MASTER.md', 465, 'seguro: transfer/Bizum'],
  ['docs/YAQU_MASTER.md', 475, 'Gates que NO son flags:'],
  ['docs/YAQU_MASTER.md', 487, '`INVOICING_ES_ENABLED` sigue estando **off para merchants reales**.'],
  ['docs/YAQU_MASTER.md', 571, '- **E2E crítico (release blocker):** registro→onboarding→producto→quote→WA→landing→firma→factura/justificante→pago (cada método)→estados BD esperados (status, paidAt, paid_via, eventos)→confirmaciones WA/email→PDF.'],
  ['docs/YAQU_MASTER.md', 956, 'V0-0 ✅ (`INVOICING_ES_ENABLED` off + justificante `J-` + watermark DEMO)'],
  ['docs/YAQU_MASTER.md', 977, '- **V0-0 · Flag de facturación ES:** `INVOICING_ES_ENABLED=false` para merchants ES reales no-demo hasta SIF-1 (flag por merchant/país). Demo conserva facturas con marca de agua "DEMO — no válida fiscalmente" en PDF y pantalla. Done: imposible emitir factura fiscal a un real. Rollback: flag.'],
  ['docs/YAQU_MASTER.md', 985, '"presupuestos+firma+cobro; la facturación VeriFactu se activa al cerrar la certificación, sin cambio de precio"'],
  ['docs/YAQU_MASTER.md', 985, '40-52s paga la seña'],
  ['docs/YAQU_MASTER.md', 1044, '**Solo con 8/8 ✅:** claim VeriFactu + `INVOICING_ES_ENABLED` a reales + GTM-1 etapa 2.'],
  ['docs/YAQU_MASTER.md', 1622, 'Pre-SIF: señal con recibo no fiscal (coherente con flag). Post-SIF: implementar el dictamen (regla 32).'],
  ['docs/YAQU_MASTER.md', 1634, 'cobros todos los métodos'],
  ['docs/YAQU_MASTER.md', 1839, 'Héroe con la promesa de cobro ("¿Cuántas señales has dejado de cobrar este mes?")'],
  ['CLAUDE.md', 6, '**YaQu** — cobro por WhatsApp para oficios en España: presupuesto en 30s → WhatsApp con botones →'],
  ['CLAUDE.md', 7, 'firma del cliente → cobro de señal/total → (post SIF-1) factura VeriFactu. España-first.'],
  ['CLAUDE.md', 89, '7. **Cero claims fiscales hasta SIF-1 8/8** (reglas 17/24/26): `INVOICING_ES_ENABLED=OFF` para'],
  ['CLAUDE.md', 90, '   merchants ES reales; demo con marca de agua; la pregunta VeriFactu se responde SOLO con el guion H2.'],
  ['CLAUDE.md', 91, '8. **Tarjeta real solo con Stripe Connect activo en ese merchant** (reglas 18/23). PROHIBIDO'],
  ['CLAUDE.md', 92, '   procesar pagos de clientes finales en la cuenta Stripe de plataforma. Mientras: transferencia/Bizum manual.'],
  ['.claude/skills/verifactu/SKILL.md', 38, '1. Decide qué documento corresponde (factura / justificante / ninguno)'],
  ['.claude/skills/verifactu/SKILL.md', 271, '- 🔴 **`INVOICING_ES_ENABLED` = off para merchants reales.** Sin excepción.'],
  // La frase sigue en la línea 6 («bueno del asesor»): la primera versión la citaba entera en la 5 y FALLÓ.
  ['docs/legal/ALCANCE_BETA.md', 5, 'NO usar con clientes hasta el visto'],
  ['docs/legal/ALCANCE_BETA.md', 21, '- **Cobro integrado**: tu cliente paga desde el móvil; recordatorios automáticos de cobro.'],
  ['docs/legal/ALCANCE_BETA.md', 22, '- **Justificantes de cobro** por cada pago recibido (documento no fiscal).'],
  ['docs/legal/PREGUNTAS_ASESOR.md', 67, 'que cobrar la beta antes de tener facturación fiscal sea correcto.'],
  ['docs/legal/PREGUNTAS_ASESOR.md', 187, '## G. El presupuesto ADICIONAL cuando aparece trabajo en obra'],
  ['docs/legal/PREGUNTAS_ASESOR.md', 419, '| Merchant **español real** (bandera OFF) | **Justificante de cobro**, serie `J-…`'],
  ['docs/legal/PREGUNTAS_ASESOR.md', 648, '**P16.1 · El justificante.**'],
  ['tests/scrum302-rotulos-completos.test.mjs', 78, 'const MICROCOPY_BLOQUEADA = {'],
  ['tests/scrum302-rotulos-completos.test.mjs', 79, "btnConvertirFactura: { documento: 'docs/legal/PREGUNTAS_ASESOR.md', seccion: '## G.' },"],
  ['src/modules/invoicing/domain/emission.service.ts', 39, "if (isDemoMerchant(m)) return 'demo';"],
  ['src/modules/invoicing/domain/emission.service.ts', 40, "return isFlagEnabled('INVOICING_ES_ENABLED', { merchant: m }) ? 'fiscal' : 'receipt';"],
  ['public/dashboard/js/app.js', 44, "Son TRES valores —'factura' | 'justificante' | 'no'—"],
  ['public/dashboard/js/invoicesView.js', 208, "if (window.appDocumentoSuelto !== 'no') {"],
  ['public/dashboard/js/invoicesView.js', 217, 'NO se acompaña de ningún texto que explique POR QUÉ sale un justificante'],
  ['public/dashboard/js/invoicesView.js', 223, "? '+ Nuevo justificante'"],
  ['public/dashboard/js/settingsView.js', 39, "receipt: 'Se emiten justificantes de cobro',"],
  ['public/dashboard/js/settingsView.js', 44, "receipt: 'Cada cobro genera un justificante para tu cliente, con su propia referencia. No es una factura y no consume tu serie de facturación.',"],
  ['public/dashboard/js/settingsView.js', 1287, "koText: 'Sin ellos, el documento tras el pago es un justificante de cobro',"],
  ['src/modules/jobs/app/routes/albaranes.routes.ts', 1224, "message: 'La facturación por partes no está disponible en este modo.'"],
  ['src/modules/jobs/app/routes/albaranes.routes.ts', 1319, "message: 'La facturación por partes no está disponible en este modo.'"],
  ['src/modules/jobs/app/routes/albaranes.routes.ts', 1333, '`facturacion_no_disponible` (las dos, ésta y la de `facturar-parcial`) — PARADO por lo que'],
  ['src/modules/jobs/app/routes/albaranes.routes.ts', 1434, "error: 'facturacion_no_disponible', message: MICROCOPY_PENDIENTE_290"],
  ['src/modules/jobs/app/routes/albaranes.routes.ts', 1626, "error: 'facturacion_no_disponible', message: MICROCOPY_PENDIENTE_290"],
];

const encabezado = (lineas, i) => {
  for (let k = i; k >= 0; k--) if (/^#{1,4} /.test(lineas[k])) return lineas[k].replace(/^#+ /, '').slice(0, 70);
  return '(antes del primer título)';
};
const recorte = (texto, re) => {
  const m = texto.match(re);
  const i = m ? m.index : 0;
  const a = Math.max(0, i - 90);
  return (a > 0 ? '…' : '') + texto.slice(a, i + 150).replace(/\s+/g, ' ') + (i + 150 < texto.length ? '…' : '');
};

let fallos = 0;
console.log(`# censo-enmienda-612 · ref ${ref} = ${sha}`);
console.log(`# FORCE_COLOR ${process.env.FORCE_COLOR === undefined ? 'ausente' : 'PRESENTE (' + process.env.FORCE_COLOR + ')'}`);

const resultado = {};
for (const f of FICHEROS) {
  const texto = git('show', `${sha}:${f}`);
  const lineas = texto.split(/\r?\n/);
  if (lineas.length && lineas[lineas.length - 1] === '') lineas.pop();
  console.log(`\n## POBLACIÓN ${f}: ${lineas.length} líneas · ${Buffer.byteLength(texto)} bytes`);
  const porFamilia = Object.fromEntries(Object.keys(FAMILIAS).map((k) => [k, []]));
  lineas.forEach((l, i) => {
    const limpia = l.replace(/cobroflash/gi, '');
    for (const [k, re] of Object.entries(FAMILIAS)) if (re.test(limpia)) porFamilia[k].push(i + 1);
  });
  const union = new Set(Object.values(porFamilia).flat());
  for (const [k, ls] of Object.entries(porFamilia)) console.log(`${k.padEnd(13)} ${String(ls.length).padStart(4)} líneas`);
  console.log(`UNIÓN         ${String(union.size).padStart(4)} líneas distintas de ${lineas.length}`);
  resultado[f] = { lineas, porFamilia };
  if (conLineas) {
    console.log(`\n### LÍNEAS de ${f} (número · familias · sección · recorte)`);
    for (const n of [...union].sort((a, b) => a - b)) {
      const fams = Object.keys(FAMILIAS).filter((k) => porFamilia[k].includes(n));
      const re = FAMILIAS[fams[0]];
      console.log(`L${n} [${fams.join(',')}] §${encabezado(lineas, n - 1)}\n    ${recorte(lineas[n - 1].replace(/cobroflash/gi, ''), re)}`);
    }
  }
}

console.log('\n## CONTROLES');
for (const c of CONTROLES) {
  const { lineas, porFamilia } = resultado[c.fichero];
  const donde = lineas.map((l, i) => (l.includes(c.frase) ? i + 1 : 0)).filter(Boolean);
  const vistas = donde.filter((n) => porFamilia[c.familia].includes(n));
  const ok = donde.length > 0 && vistas.length === donde.length;
  if (!ok) fallos++;
  console.log(`${ok ? 'OK ' : 'FALLA'} ${c.fichero} · «${c.frase}» en ${donde.length} línea(s) · la familia ${c.familia} ve ${vistas.length}`);
}
for (const [k, re] of Object.entries(FAMILIAS)) {
  if (re.test(NEGATIVO.replace(/cobroflash/gi, ''))) { fallos++; console.log(`FALLA negativo: ${k} casa con «${NEGATIVO}»`); }
}
console.log(`negativo: ninguna familia casa con «${NEGATIVO}» salvo las listadas arriba`);

console.log('\n## CLASIFICACIÓN (conjuntos: candidatas = casadas − historial; clasificadas = unión de clases)');
for (const [f, clases] of Object.entries(CLASIFICACION)) {
  const { lineas, porFamilia } = resultado[f];
  const casadas = new Set(Object.values(porFamilia).flat());
  const historial = [...casadas].filter((n) => esHistorial(lineas[n - 1]));
  const candidatas = new Set([...casadas].filter((n) => !esHistorial(lineas[n - 1])));
  const extras = Object.keys(EXTRAS[f] || {}).map(Number);
  const vistas = new Map();
  for (const [c, ls] of Object.entries(clases)) for (const n of ls) {
    if (vistas.has(n)) { fallos++; console.log(`FALLA ${f} L${n} está en dos clases: ${vistas.get(n)} y ${c}`); }
    vistas.set(n, c);
  }
  const esperadas = new Set([...candidatas, ...extras]);
  const sinClase = [...esperadas].filter((n) => !vistas.has(n)).sort((a, b) => a - b);
  const sobran = [...vistas.keys()].filter((n) => !esperadas.has(n)).sort((a, b) => a - b);
  if (sinClase.length) { fallos++; console.log(`FALLA ${f} candidatas SIN clase: ${sinClase.join(' ')}`); }
  if (sobran.length) { fallos++; console.log(`FALLA ${f} clasificadas que NO son candidatas ni extras declaradas: ${sobran.join(' ')}`); }
  const cuenta = Object.entries(clases).map(([c, ls]) => `${c} ${ls.length}`).join(' · ');
  console.log(`${sinClase.length || sobran.length ? 'FALLA' : 'OK '} ${f}: casadas ${casadas.size} = historial ${historial.length} + candidatas ${candidatas.size} · extras declaradas ${extras.length} · ${cuenta}`);
}

console.log('\n## CITAS (cada literal del borrador, en su línea, en el SHA medido)');
const cache = new Map();
const leer = (f) => {
  if (!cache.has(f)) cache.set(f, git('show', `${sha}:${f}`).split(/\r?\n/));
  return cache.get(f);
};
let citasOk = 0;
for (const [f, n, literal] of CITAS) {
  const ls = leer(f);
  if ((ls[n - 1] || '').includes(literal)) { citasOk++; continue; }
  fallos++;
  const ahora = ls.map((l, i) => (l.includes(literal) ? i + 1 : 0)).filter(Boolean);
  console.log(`FALLA ${f}:${n} no contiene «${literal.slice(0, 70)}…» · ahora en: ${ahora.length ? ahora.join(', ') : 'NINGUNA línea'}`);
}
console.log(`${citasOk === CITAS.length ? 'OK ' : 'FALLA'} citas: ${citasOk} de ${CITAS.length} en su línea`);
console.log(`\nEXIT=${fallos ? 1 : 0} · controles fallidos: ${fallos}`);
process.exitCode = fallos ? 1 : 0;
