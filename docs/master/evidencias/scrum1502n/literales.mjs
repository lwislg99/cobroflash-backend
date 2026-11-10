// SCRUM-1502n · de un solo uso. Por cada marca pedida (o por cada marca de los ficheros pedidos), su
// nivel en el guard y sus literales de prosa, copiados por programa con el mismo marcasDe de 1502h/i.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const [RAIZ, SALIDA] = process.argv.slice(2);
const imp = (p) => import(pathToFileURL(path.join(RAIZ, p)).href);
const { marcasDe } = await imp('tests/_procedencia-aprobacion.mjs');
const { indiceDeFuentes, respaldoDe, esProsaDistintiva } = await imp('tests/_respaldo-de-firma.mjs');
const { loQueSeLee } = await imp('tests/_cita-declarada.mjs');
const MARCA = /(?:aprobad|autorizad|firmad|validad|refrendad)[oa]s?\s+por\s+el\s+fundador|\bel\s+fundador\s+(?:lo\s+|la\s+|los\s+|las\s+|ya\s+|s[ií]\s+)*(?:decide|decidi[oó]|aprueba|aprob[oó]|autoriza|autoriz[oó]|firma|firm[oó]|valida|valid[oó])(?![A-Za-z0-9_áéíóúüñÁÉÍÓÚÜÑ])/i;
const EXCLUIR = /^tests\/(_procedencia-aprobacion|_respaldo-de-firma|_censo-firmas-autorizacion|_microcopy-aprobada|scrum387-|scrum921)/;
const FICHEROS = ['public/dashboard/js/albaranDetailView.js', 'public/dashboard/js/parteDetailView.js', 'public/dashboard/js/jobsView.js'];
const PEDIDAS = new Set(['public/dashboard/js/homeView.js:779', 'public/dashboard/js/quoteMargen.js:64', 'tests/scrum651-trabajo-sin-presupuesto.test.mjs:381', 'tests/scrum320-que-falta-para-cobrar.test.mjs:253', 'public/dashboard/js/quoteActionsRegistry.js:68', 'src/modules/jobs/domain/parteDictado.ts:138', 'tests/scrum283-censo-acciones-factura.test.mjs:118', 'tests/scrum294c-criterio-del-merchant.test.mjs:175', 'src/modules/whatsappBot/domain/botFlow.service.ts:1', 'tests/scrum151-motivo-sin-tramo.test.mjs:53', 'src/modules/jobs/domain/parteDictado.ts:401', 'tests/scrum377-plural-de-programador.test.mjs:72', 'tests/scrum593b-superficie-texto-del-documento.test.mjs:91', 'tests/scrum609b-switch-tipo-articulo.test.mjs:75']);
const marcas = marcasDe(RAIZ, { dirs: ['src', 'public', 'tests', 'scripts'], marca: MARCA, excluir: EXCLUIR, literalesTras: 45 });
const indice = indiceDeFuentes(RAIZ);
const out = [];
let vistas = 0;
for (const b of marcas) {
  const id = `${b.fichero}:${b.linea}`;
  if (!PEDIDAS.has(id) && !FICHEROS.includes(b.fichero)) continue;
  const t = loQueSeLee(b.texto, b.fichero);
  if (!MARCA.test(t)) continue;
  vistas++;
  const r = respaldoDe({ ...b, texto: t }, indice);
  out.push({ id, nivel: r.nivel, comentario: t, prosa: (b.literales ?? []).filter(esProsaDistintiva) });
}
fs.writeFileSync(SALIDA, JSON.stringify(out, null, 1));
console.log(`POBLACION marcas=${marcas.length} pedidas=${PEDIDAS.size} vistas=${vistas} encontradas_de_pedidas=${out.filter((o) => PEDIDAS.has(o.id)).length}`);
for (const o of out) console.log(`${o.id} · ${o.nivel} · prosa=${o.prosa.length}`);
