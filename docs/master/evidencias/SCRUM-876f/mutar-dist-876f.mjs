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
  // ── SCRUM-876f ──
  // La bandera, congelada al cargar el sender: ponerla después ya no hace nada.
  'seco-congelado': {
    fichero: 'dist/integrations/whatsapp.js',
    busca: /^const isDryRun = \(\) => process\.env\.WHATSAPP_DRY_RUN === '1';/gm,
    pon: "const secoAlCargar = process.env.WHATSAPP_DRY_RUN === '1'; const isDryRun = () => secoAlCargar;",
  },
  // La bandera dice «en seco» y AUN ASÍ sale una llamada: un POST suelto, sin esperar, por fuera
  // del punto único. El envío sigue contestando ok y en seco.
  'fuga-en-seco': {
    fichero: 'dist/integrations/whatsapp.js',
    busca: /^const isDryRun = \(\) => process\.env\.WHATSAPP_DRY_RUN === '1';/gm,
    pon: "const isDryRun = () => { const seco = process.env.WHATSAPP_DRY_RUN === '1'; if (seco) axios_1.default.post(BASE_URL + '/0/messages', {}).catch(() => { }); return seco; };",
  },
  // El test deja de ponerse la bandera en el destino banco (la aserción se queda).
  'a55-sin-ponerse-la-bandera': {
    fichero: 'tests/a55-window-quote.test.mjs',
    busca: /^if \(CON_BANCO\) process\.env\.WHATSAPP_DRY_RUN = '1';/gm,
    pon: 'void CON_BANCO;',
  },
  // bot-suite, paso 11 · al cliente NO se le confirma la baja con el texto firmado.
  'baja-otra-confirmacion': {
    fichero: 'dist/modules/whatsappBot/app/routes/whatsappIncoming.routes.js',
    busca: /^ {8}text: 'Hecho ✅ No te enviaremos más mensajes por WhatsApp\./gm,
    pon: "        text: 'Vale.' + 'x'.slice(1) + ' (mutado) ",
  },
  // bot-suite, paso 11 · el profesional NO se entera de la baja de su cliente.
  'baja-sin-aviso-al-pro': {
    fichero: 'dist/modules/whatsappBot/app/routes/whatsappIncoming.routes.js',
    busca: /^ {12}action: 'se ha dado de baja de WhatsApp',/gm,
    pon: "            action: 'se ha dado de baja de WhatsApp', merchantPhone: null, freeText: undefined, __mutado: true,",
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
