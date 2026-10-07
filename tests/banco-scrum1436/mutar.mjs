// tests/banco-scrum1436/mutar.mjs — SCRUM-1436 · el banco de mutaciones de los dos tests.
//
// Muta `dist/` (nunca `src/`), corre el test de esa mutación en un proceso hijo con el entorno
// limpio y restaura el fichero en un `finally`. Uso, con `dist/` recién construido:
//
//     node tests/banco-scrum1436/mutar.mjs .
//
// Cada fila dice si la mutación se APLICÓ, cuántos casos corrieron (0 = CIEGA) y cuáles caen.
// Las dos C0 son la base sin mutar: tienen que salir VIVA con 0 caídas.
//
// M5 sale VIVA y es EQUIVALENTE, no un hueco: sin esa guarda, `invoice.quoteId` sobre `null`
// lanza DENTRO del `try` de `presupuestoFirmadoDe` y el `catch` devuelve lo mismo (`false`).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const raiz = process.argv[2];
const D = path.join(raiz, 'dist/modules/payments/disputes.service.js');
const W = path.join(raiz, 'dist/integrations/whatsapp.js');
const T1 = 'tests/scrum1436-disputa-firmado-solo-con-firma.test.mjs';
const T2 = 'tests/scrum1436-ventana-abierta-envio-fallido.test.mjs';

const MUT = [
  ['C0 base sin mutar (disputa)', D, null, null, T1],
  ['C0 base sin mutar (ventana)', W, null, null, T2],
  ['M1 sin filtro de negocio', D, 'where: { id: invoice.quoteId, merchantId }', 'where: { id: invoice.quoteId }', T1],
  ['M2 firmado = signatureUrl no nulo (sin trazo)', D, '(0, firmaConTrazo_1.firmaTieneTrazo)(quote?.signatureUrl)', '(quote?.signatureUrl != null)', T1],
  ['M3 firmado siempre', D, "firmado ? 'Tranquilo", "true ? 'Tranquilo", T1],
  ['M4 nunca firmado', D, "firmado ? 'Tranquilo", "false ? 'Tranquilo", T1],
  ['M5 sin factura no corta', D, 'if (!invoice || invoice.quoteId == null)', 'if (false)', T1],
  ['M6 se pierde el motivo propio', W, "falloEnVentana.reason ?? 'whatsapp_send_failed'", "'whatsapp_send_failed'", T2],
  ['M7 el fallo en ventana no se mira', W, 'if (falloEnVentana) {', 'if (false) {', T2],
  ['M8 fallo en ventana siempre', W, 'if (falloEnVentana) {', 'if (true) {', T2],
  ['M9 no se guarda el fallo', W, 'falloEnVentana = text;', ';', T2],
];

const entorno = { ...process.env };
for (const k of ['NODE_TEST_CONTEXT', 'NODE_OPTIONS', 'FORCE_COLOR']) delete entorno[k];

for (const [nombre, fichero, de, a, test] of MUT) {
  const original = fs.readFileSync(fichero, 'utf8');
  let aplicada = 'n/a';
  if (de !== null) {
    const veces = original.split(de).length - 1;
    if (veces !== 1) { console.log(`CIEGA  ${nombre} :: el ancla casa ${veces} veces`); continue; }
    fs.writeFileSync(fichero, original.replace(de, a));
    aplicada = fs.readFileSync(fichero, 'utf8') !== original ? 'si' : 'NO';
  }
  let r;
  try {
    r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', test], { cwd: raiz, env: entorno, encoding: 'utf8' });
  } finally {
    fs.writeFileSync(fichero, original);
  }
  const lineas = (r.stdout || '').split(/\r?\n/);
  const total = lineas.filter((l) => /^(not )?ok \d+/.test(l)).length;
  const caen = lineas.filter((l) => /^not ok \d+/.test(l)).map((l) => l.replace(/^not ok /, ''));
  const restaurado = fs.readFileSync(fichero, 'utf8') === original;
  console.log(`${total === 0 ? 'CIEGA ' : caen.length ? 'CAE   ' : 'VIVA  '} ${nombre} :: aplicada=${aplicada} casos=${total} caen=${caen.length} restaurado=${restaurado}`);
  for (const c of caen) console.log(`         - ${c.slice(0, 110)}`);
}
