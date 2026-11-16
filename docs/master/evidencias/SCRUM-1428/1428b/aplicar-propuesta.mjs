// SCRUM-1428 · aplica la PROPUESTA (opción a) sobre una COPIA desechable, nunca sobre el repo.
// Uso: node aplicar-propuesta.mjs <raíz de la copia>
// Sale ≠ 0 si una sola sustitución no casa EXACTAMENTE una vez (no se aplica a medias).
import fs from 'node:fs';
import path from 'node:path';

const raiz = process.argv[2];
if (!raiz || !fs.existsSync(path.join(raiz, 'public/dashboard/js/libroRegistroView.js'))) {
  console.error('CIEGO: falta la raíz de la copia o no tiene libroRegistroView.js'); process.exit(2);
}
if (fs.existsSync(path.join(raiz, '.git'))) { console.error('CIEGO: la raíz tiene .git: no es una copia'); process.exit(2); }

const REG = 'docs/MICROCOPY_APROBADA_SIN_APLICAR.md';
// clave → [línea del registro congelado, addendum]
const MARCAS = {
  titulo: [362, 'addendum'],
  recuento: [364, 'addendum'],
  error: [432, 'tanda final'],
  vacioDeVerdad: [433, 'tanda final'],
  colNumero: [365, 'addendum'],
  colFecha: [366, 'addendum'],
  colTipo: [367, 'addendum'],
  colBase: [368, 'addendum'],
  colCuota: [369, 'addendum'],
  colTotal: [370, 'addendum'],
  colEstado: [371, 'addendum'],
  trazaPresupuestoFirmado: [402, 'segunda tanda'],
  trazaPresupuestoSinFirmar: [403, 'segunda tanda'],
  trazaAlbaran: [435, 'tanda final'],
  trazaCobro: [372, 'addendum'],
};
const marca = (k) => `// APROBADA (fundador, 19-ago-2026): ${REG}:${MARCAS[k][0]} (SCRUM-709)`;

const vista = path.join(raiz, 'public/dashboard/js/libroRegistroView.js');
let src = fs.readFileSync(vista, 'utf8');
const eol = src.includes('\r\n') ? '\r\n' : '\n';

function sustituir(viejo, nuevo, rotulo) {
  const n = src.split(viejo).length - 1;
  if (n !== 1) { console.error(`NO CASA (${n} veces): ${rotulo}`); process.exit(1); }
  src = src.replace(viejo, nuevo);
}

// Las 15 líneas, cada una con su marca DETRÁS (regla 1 del censo: sólo a ella).
const LINEAS = {
  titulo: "    titulo: 'Libro registro de facturas expedidas',",
  recuento: "    recuento: (n) => n === 1 ? '1 factura' : n + ' facturas',",
  error: "    error: 'No se ha podido cargar el libro. Vuelve a intentarlo.',",
  vacioDeVerdad: "    vacioDeVerdad: 'Todavía no has emitido ninguna factura.',",
  colNumero: "    colNumero: 'Número',",
  colFecha: "    colFecha: 'Fecha',",
  colTipo: "    colTipo: 'Tipo',",
  colBase: "    colBase: 'Base',",
  colCuota: "    colCuota: 'IVA',",
  colTotal: "    colTotal: 'Total',",
  colEstado: "    colEstado: 'Estado',",
  trazaPresupuestoFirmado: "    trazaPresupuestoFirmado: 'Presupuesto firmado',",
  trazaPresupuestoSinFirmar: "    trazaPresupuestoSinFirmar: 'Presupuesto sin firmar',",
  trazaAlbaran: "    trazaAlbaran: 'Albarán',",
  trazaCobro: "    trazaCobro: 'Cobro',",
};
for (const [k, linea] of Object.entries(LINEAS)) sustituir(linea + eol, `${linea} ${marca(k)}${eol}`, k);

// La cabecera falsa (:25-32): «Ni un rótulo de esta pantalla está aprobado».
const CAB_VIEJA = [
  '// MICROCOPY: TODAS LAS RANURAS VAN MARCADAS (regla 30)',
  '//',
  '// Ni un rótulo de esta pantalla está aprobado. Cada uno sale con `[PENDIENTE microcopy oficial]`',
  '// DELANTE del texto, no en vez de él: con el marcador solo, «no tienes facturas» y «el libro no',
].join(eol);
const CAB_NUEVA = [
  '// MICROCOPY: CADA RANURA DICE SU ESTADO EN SU LÍNEA (regla 30)',
  '//',
  '// 17 rótulos de esta pantalla los aprobó el fundador el 19-ago-2026, en tres addenda del registro',
  '// congelado de SCRUM-709 (`docs/MICROCOPY_…_SIN_APLICAR.md` :355, :396 y :425), y cada uno lleva la',
  '// cita en su línea (SCRUM-1428). `menu` no tiene aprobación (se retiró el 19-ago, registro :414) y',
  '// `cargando` es la cadena común del panel (SCRUM-1428 c.18325). Los que esperan al asesor salen',
  '// con `[PENDIENTE microcopy oficial]`',
  '// DELANTE del texto, no en vez de él: con el marcador solo, «no tienes facturas» y «el libro no',
].join(eol);
sustituir(CAB_VIEJA, CAB_NUEVA, 'cabecera :25-28');
fs.writeFileSync(vista, src);

// El JSON: las 15 salen de «acusadas» y entran en «retiradas» con su motivo (lo que pide el censo, :523).
const jpath = path.join(raiz, 'scripts/_censo-convenio-microcopy-declarados.json');
let jtxt = fs.readFileSync(jpath, 'utf8');
const jeol = jtxt.includes('\r\n') ? '\r\n' : '\n';
const j = JSON.parse(jtxt);
const ids = Object.keys(MARCAS).map((k) => `public/dashboard/js/libroRegistroView.js · COPY.${k}`);
for (const id of ids) {
  if (!j.acusadas[id]) { console.error(`NO ESTÁ en acusadas: ${id}`); process.exit(1); }
  delete j.acusadas[id];
  const k = id.split('COPY.')[1];
  j.retiradas.push({
    id,
    motivo: `SCRUM-1428: firmada por el fundador el 19-ago-2026 en el registro congelado (SCRUM-709), ${REG}:${MARCAS[k][0]} (${MARCAS[k][1]}); la marca va ya en su misma línea. Acusada en falso desde el censo inicial: la firma vivía en el registro y no en el fuente.`,
  });
}
let salida = JSON.stringify(j, null, 2) + '\n';
if (jeol === '\r\n') salida = salida.replace(/\n/g, '\r\n');
fs.writeFileSync(jpath, salida);
console.log(`APLICADO: 15 marcas + cabecera en la vista; 15 de «acusadas» → «retiradas» en el JSON (${ids.length})`);
