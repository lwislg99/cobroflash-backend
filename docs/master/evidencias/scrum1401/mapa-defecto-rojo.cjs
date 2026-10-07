// SCRUM-1401 parte 5 - EL ROJO: se fabrica la clave heredada de Object.prototype y se EJECUTA
// el codigo real (dist/ compilado del arbol exportado, o las lineas exactas de src/ transpiladas).
// Uso: node mapa-defecto-rojo.cjs <raiz con dist/, src/ y node_modules/>
// Los numeros de linea son los de main 6536e63e: si el fichero se mueve, los bancos 9, 10 y 11 LANZAN
// (comprueban que la linea sigue siendo la del censo) y los demas se quedan sin esa comprobacion.
// Solo LEE y llama funciones puras. No abre base ni red.
const path = require('path');
const fs = require('fs');
const raiz = path.resolve(process.argv[2] || '.');
const ts = require(path.join(raiz, 'node_modules', 'typescript'));
const HEREDADAS = Object.getOwnPropertyNames(Object.prototype);
const pinta = (v) => {
  if (typeof v === 'function') return 'FUNCION ' + (v.name || '(anonima)');
  if (v === Object.prototype) return 'Object.prototype';
  try { const s = JSON.stringify(v); return s === undefined ? String(v) : s.slice(0, 110); } catch { return String(v); }
};
const igual = (a, b) => { try { return JSON.stringify(a) === JSON.stringify(b) && typeof a === typeof b; } catch { return false; } };
let nCasos = 0;
const resumen = [];

/** Corre `fn(clave)` con: una clave conocida, una desconocida (define el DEFECTO) y las 12 heredadas. */
function banco(nombre, fn, conocida, opciones = {}) {
  console.log(`\n=== ${nombre}`);
  const llama = (k) => { try { return { v: fn(k) }; } catch (e) { return { lanza: `${e.constructor.name}: ${String(e.message).slice(0, 90)}` }; } };
  const rc = llama(conocida), rd = llama('clave_que_no_existe_zzz');
  console.log(`  control conocida   [${conocida}] -> ${rc.lanza || pinta(rc.v)}`);
  console.log(`  control desconocida [zzz]  -> ${rd.lanza || pinta(rd.v)}   (este es el DEFECTO)`);
  if (!rc.lanza && !rd.lanza && igual(rc.v, rd.v) && !opciones.conocidaIgualAlDefecto) console.log('  !! el control conocido da lo mismo que el defecto: banco CIEGO');
  const vivas = [];
  for (const k of HEREDADAS) {
    nCasos++;
    const r = llama(k);
    const comoDefecto = !r.lanza && !rd.lanza && igual(r.v, rd.v);
    if (!comoDefecto) { vivas.push(k); console.log(`  VIVA  [${k}] -> ${r.lanza || pinta(r.v)}`); }
  }
  console.log(`  ${vivas.length} de ${HEREDADAS.length} heredadas NO caen al defecto` + (vivas.length ? `: ${vivas.join(', ')}` : ''));
  resumen.push({ nombre, vivas: vivas.length });
}
const carga = (rel) => require(path.join(raiz, 'dist', rel));
/** Lineas a..b de un fichero de src/, transpiladas tal cual (solo se quitan los tipos). */
function trozo(rel, a, b) {
  const lineas = fs.readFileSync(path.join(raiz, 'src', rel), 'utf8').split(/\r?\n/).slice(a - 1, b).join('\n');
  return { fuente: lineas, js: ts.transpileModule(lineas, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText };
}

console.log(`POBLACION: ${HEREDADAS.length} nombres propios de Object.prototype: ${HEREDADAS.join(', ')}`);

// 1 · whatsappLog.service.ts:118-119 — STATUS_RANK[current] ?? -1 / STATUS_RANK[next] ?? -1
const wa = carga('modules/messaging/domain/whatsappLog.service.js');
banco('STATUS_RANK[next] (whatsappLog.service.ts:119) · shouldApplyStatus("sent", next) · next lo pone Meta', (k) => wa.shouldApplyStatus('sent', k), 'delivered');
banco('STATUS_RANK[current] (whatsappLog.service.ts:118) · shouldApplyStatus(current, "sent") · current sale de nuestra base', (k) => wa.shouldApplyStatus(k, 'sent'), 'read');

// 2 · ai.service.ts:195 — SINONIMOS_UNIDAD[clave] ?? 'ud'
const ai = carga('modules/ai/domain/ai.service.js');
banco('SINONIMOS_UNIDAD[clave] (ai.service.ts:195) · normalizarUnidad(bruto) · bruto lo pone el modelo', (k) => ai.normalizarUnidad(k), 'horas');
banco('  aguas abajo: sanearLineasAlbaran([{concepto, unidad}], SIN_VALORAR) pasado por JSON', (k) => JSON.parse(JSON.stringify(ai.sanearLineasAlbaran([{ concepto: 'x', cantidad: 1, unidad: k }], 'SIN_VALORAR'))), 'horas');

// 3 · parteDictado.ts:313 — BLOQUES[clave] ?? BLOQUES[sin _] ?? null
const pd = carga('modules/jobs/domain/parteDictado.js');
banco('BLOQUES[clave] x2 (parteDictado.ts:313) · sanearDictadoDelParte([{descripcion, bloque}]) · bloque lo pone el modelo', (k) => {
  const s = pd.sanearDictadoDelParte([{ descripcion: 'cambiar grifo', bloque: k }], 'cambiar grifo');
  return { mano_obra: s.mano_obra.length, materiales: s.materiales.length, sinBloque: s.sinBloque.length };
}, 'materiales');

// 4 · tradeCatalogs.ts:141 — TRADE_CATALOGS[`${t}_${c}`] ?? TRADE_CATALOGS[`${t}_es`] ?? []
const tc = carga('core/data/tradeCatalogs.js');
banco('TRADE_CATALOGS (tradeCatalogs.ts:141) · getTradeCatalog(trade, "es") · trade lo manda el profesional', (k) => (tc.getTradeCatalog(k, 'es') || 'no-array').length, 'electricista');
banco('  la unica via: getTradeCatalog("_", pais) con el PAIS fabricado', (k) => { const r = tc.getTradeCatalog('_', k.replace(/^__/, '')); return Array.isArray(r) ? r.length : pinta(r); }, 'es', { conocidaIgualAlDefecto: true });

// 5 · locales.ts:39 — LOCALES[(country ?? '').toUpperCase()] ?? DEFAULT_LOCALE
const loc = carga('core/i18n/locales.js');
banco('LOCALES (locales.ts:39) · getLocale(country).currency', (k) => loc.getLocale(k).currency, 'CO');

// 6 · job.service.ts:31 — (TRANSITIONS[from] || []).includes(to)
const js = carga('modules/jobs/domain/job.service.js');
banco('TRANSITIONS[from] (job.service.ts:31) · canTransition(from, "agendado") · from sale de nuestra base', (k) => js.canTransition(k, 'agendado'), 'pendiente_agendar');

// 7 · publicProfile.service.ts:52 — TRADE_LABELS[merchant.trade] ?? null
const pp = carga('modules/system/domain/publicProfile.service.js');
banco('TRADE_LABELS (publicProfile.service.ts:52) · buildPublicProfileHtml({trade}) · que sale en la pagina publica', (k) => {
  const html = pp.buildPublicProfileHtml({ name: 'N', logoUrl: null, trade: k, profileZones: [], profileYears: null, whatsappPhone: null, googleReviewUrl: null, country: 'ES', brandColor: null }, { slug: 's', src: 'profile' });
  return { nativo: /native code/.test(html), objeto: /\[object Object\]/.test(html), fontanero: /Fontanero/.test(html) };
}, 'fontanero');

// 8 · customerPortal.routes.ts:35-36 — STATUS_LABELS[status] ?? status ; STATUS_COLOR[status] ?? {...}
{
  const t = trozo('modules/system/app/routes/customerPortal.routes.ts', 20, 38);
  const pill = new Function('esc', t.js + '\nreturn pill;')((s) => String(s));
  banco('STATUS_LABELS / STATUS_COLOR (customerPortal.routes.ts:35-36) · pill(status), lineas 20-38 tal cual · status sale de nuestra base', (k) => {
    const h = pill(k); return { undefinedEnElColor: /undefined/.test(h), nativo: /native code/.test(h) };
  }, 'paid', { conocidaIgualAlDefecto: true });
}

// 9 · quoteDecisionLanding.routes.ts:911 — REASON_LABELS[String(reason)] || String(reason)
{
  const t = trozo('modules/system/app/routes/quoteDecisionLanding.routes.ts', 905, 911);
  if (!/REASON_LABELS\[String\(reason\)\] \|\| String\(reason\)/.test(t.fuente)) throw new Error('las lineas 905-911 ya no son las del censo');
  const etiqueta = new Function('reason', t.js + '\nreturn reasonLabel;');
  banco('REASON_LABELS (quoteDecisionLanding.routes.ts:911, pagina PUBLICA) · reasonLabel · reason lo manda el cliente final', (k) => etiqueta(k), 'price');
  // lo que la ruta reenvia a la API (linea 933: JSON.stringify({ decision, reason: reasonLabel || undefined, ... }))
  // y lo que la API hace con ello (quotes.routes.ts:354: req.body?.reason ? String(req.body.reason) : undefined)
  banco('  aguas abajo: lo que llega a rejectionReason tras el JSON de la linea 933 y el String() de quotes.routes.ts:354', (k) => {
    const cuerpo = JSON.parse(JSON.stringify({ decision: 'reject', reason: etiqueta(k) || undefined }));
    return cuerpo.reason ? String(cuerpo.reason) : null;
  }, 'price');
}

// 10 · metrics.service.ts:315 — reasonCount[reason] = (reasonCount[reason] || 0) + 1
{
  const t = trozo('modules/metrics/domain/metrics.service.ts', 312, 320);
  if (!/reasonCount\[reason\] = \(reasonCount\[reason\] \|\| 0\) \+ 1/.test(t.fuente)) throw new Error('las lineas 312-320 ya no son las del censo');
  const embudo = new Function('rejectedRows', t.js + '\nreturn rejectionReasons;');
  banco('reasonCount (metrics.service.ts:315) · lineas 312-320 tal cual, con DOS rechazos de ese motivo y tres de «precio» · el motivo lo escribe el cliente final por la API publica', (k) => {
    const filas = [k, k, 'precio', 'precio', 'precio'].map((r) => ({ rejectionReason: r }));
    return embudo(filas).map((x) => ({ reason: x.reason.slice(0, 22), count: typeof x.count === 'number' ? x.count : `NO-NUMERO(${typeof x.count}): ${String(x.count).slice(0, 44)}` }));
  }, 'caro', { conocidaIgualAlDefecto: true });
}

// 11 · payMp.routes.ts:98 y :107 — CHARGE_STATUS_A_RESULTADO[charge.status] || 'pending' ; statusMap[status] || statusMap.pending
{
  const f = 'modules/billing/app/routes/payMp.routes.ts';
  const cuerpo = trozo(f, 84, 89).js + '\n' + trozo(f, 98, 98).js + '\n' + trozo(f, 100, 107).js;
  if (!/CHARGE_STATUS_A_RESULTADO\[charge\.status\] \|\| 'pending'/.test(trozo(f, 98, 98).fuente)) throw new Error('la linea 98 ya no es la del censo');
  const pagina = new Function('charge', cuerpo + '\nreturn { status: typeof status === "string" ? status : "NO-CADENA:" + typeof status, titulo: s && s.title };');
  banco('CHARGE_STATUS_A_RESULTADO y statusMap (payMp.routes.ts:98 y :107) · lineas 84-89, 98 y 100-107 · charge.status sale de nuestra base', (k) => pagina({ status: k }), 'paid');
}

// 12 · receipt.routes.ts:267 — SH[ch.status] || SH.pending
{
  const t = trozo('modules/billing/app/routes/receipt.routes.ts', 261, 267);
  const heroe = new Function('ch', t.js + '\nreturn { title: sh && sh.title, cls: sh && sh.cls };');
  banco('SH (receipt.routes.ts:267) · lineas 261-267 · ch.status sale de nuestra base', (k) => heroe({ status: k }), 'paid');
}

// 13 · botFlow.service.ts:630 — CONTEXT_LABEL[String(lastAction || '')] || 'estaba en el menu'
{
  const t = trozo('modules/whatsappBot/domain/botFlow.service.ts', 625, 630);
  const ctx = new Function('session', t.js + '\nreturn context;');
  banco('CONTEXT_LABEL (botFlow.service.ts:630) · lineas 625-630 · lastAction lo escribe nuestro bot', (k) => ctx({ data: { lastAction: k } }), 'pay');
}

console.log(`\nTOTAL: ${resumen.length} bancos · ${nCasos} casos con clave heredada`);
for (const r of resumen) console.log(`  ${String(r.vivas).padStart(2)} vivas · ${r.nombre.trim().slice(0, 120)}`);
console.log('EXIT=0');
