// Mutador de dist/ para los rojos de SCRUM-876e. NUNCA toca src/. Uso:
//   node mutar.mjs poner <id>     → aplica UNA mutación (exige casar exactamente 1 vez) y guarda el original
//   node mutar.mjs quitar <id>    → restaura y comprueba por hash que dist/ volvió a ser el de antes
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const WT = 'D:/MILLONARIO/cobroFlash/wt-s3-1416';
const COPIAS = 'D:/MILLONARIO/cobroFlash/_banco-s3/copias';
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');

const MUTACIONES = {
  // scrum72 · la tenencia del PDF de factura: sin el filtro por merchant, B descarga la de A.
  'pdf-sin-tenencia': {
    fichero: 'dist/modules/system/app/routes/invoicesAdmin.routes.js',
    busca: /const owned = await prisma_1\.prisma\.invoice\.findFirst\(\{ where: \{ id, merchantId: req\.merchantId \}, select: \{ id: true \} \}\);/g,
    pon: 'const owned = await prisma_1.prisma.invoice.findFirst({ where: { id }, select: { id: true } });',
  },
  // albaran (SCRUM-14) · la tenencia del albarán: `findAlbaran` deja de filtrar por merchant.
  'albaran-sin-tenencia': {
    fichero: 'dist/modules/jobs/app/routes/albaranes.routes.js',
    busca: /^ {4}const albaran = await prisma_1\.prisma\.albaran\.findFirst\(\{ where: \{ id, merchantId: req\.merchantId \} \}\);/gm,
    pon: '    const albaran = await prisma_1.prisma.albaran.findFirst({ where: { id } });',
  },
  // albaran (SCRUM-65) · el candado del modo de valoración: se puede cambiar después de emitir.
  'modo-sin-candado': {
    fichero: 'dist/modules/jobs/app/routes/albaranes.routes.js',
    busca: /^ {12}if \(albaran\.estado !== 'borrador'\) \{/gm,
    pon: '            if (false) {',
  },
};

const [, , orden, id] = process.argv;
const m = MUTACIONES[id];
if (!m || !['poner', 'quitar'].includes(orden)) { console.error('uso: poner|quitar <id> · ids: ' + Object.keys(MUTACIONES).join(', ')); process.exit(2); }
const destino = path.join(WT, m.fichero);
const copia = path.join(COPIAS, id + '.orig');
fs.mkdirSync(COPIAS, { recursive: true });

if (orden === 'poner') {
  if (fs.existsSync(copia)) { console.error('🔴 ya hay una copia de «' + id + '»: la vez anterior no se restauró. Quita primero.'); process.exit(1); }
  const antes = fs.readFileSync(destino);
  const texto = antes.toString('utf8');
  const veces = (texto.match(m.busca) || []).length;
  if (veces !== 1) { console.error(`🔴 «${id}» casa ${veces} veces en ${m.fichero}: tiene que ser exactamente 1. No se muta nada.`); process.exit(1); }
  fs.writeFileSync(copia, antes);
  fs.writeFileSync(destino, texto.replace(m.busca, m.pon));
  const despues = fs.readFileSync(destino);
  if (sha(despues) === sha(antes)) { console.error('🔴 el fichero no cambió'); process.exit(1); }
  console.log(`mutado: ${id} · ${m.fichero} · ${sha(antes).slice(0, 12)} → ${sha(despues).slice(0, 12)}`);
} else {
  if (!fs.existsSync(copia)) { console.error('🔴 no hay copia de «' + id + '»: nada que restaurar'); process.exit(1); }
  const original = fs.readFileSync(copia);
  fs.writeFileSync(destino, original);
  if (sha(fs.readFileSync(destino)) !== sha(original)) { console.error('🔴 la restauración no dejó el original'); process.exit(1); }
  fs.unlinkSync(copia);
  console.log(`restaurado: ${id} · ${m.fichero} · ${sha(original).slice(0, 12)}`);
}
