// Mutador de dist/ para los rojos de SCRUM-876g (T4: scrum47, 49, 50 y 68). NUNCA toca src/. Uso:
//   node mutar-dist-876g.mjs <raíz del árbol> poner <id>   → aplica UNA mutación (exige casar 1 vez) y guarda el original
//   node mutar-dist-876g.mjs <raíz del árbol> quitar <id>  → restaura y comprueba por hash que volvió a ser el de antes
// Las copias van FUERA del árbol (junto a este fichero, en `copias/`).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');

const MUTACIONES = {
  // scrum47 · `findAlbaran` deja de recortar por el dueño del Trabajo: un técnico envía el albarán de otro.
  'tecnico-sin-recorte': {
    fichero: 'dist/modules/jobs/app/routes/albaranes.routes.js',
    busca: /^ {4}if \(\(0, roleCapabilities_1\.seesOnlyOwnJobs\)\(req\.userRole\)\) \{/gm,
    pon: '    if (false) {',
  },
  // scrum49 · la firma pública deja de mirar qué versión vio el cliente (SCRUM-361).
  'firma-sin-version': {
    fichero: 'dist/modules/jobs/app/routes/albaranPublic.routes.js',
    busca: /^ {8}if \(!mismaVersion\.ok\) \{/gm,
    pon: '        if (false) {',
  },
  // scrum68 · la evidencia de una firma REMOTA se sella como si fuera presencial.
  'evidencia-otro-canal': {
    fichero: 'dist/modules/jobs/app/routes/albaranPublic.routes.js',
    busca: /^ {12}canal: 'remoto',/gm,
    pon: "            canal: 'presencial',",
  },
  // scrum50 · al «Recibido» del cliente se le contesta otra cosa.
  'acuse-otro-texto': {
    fichero: 'dist/modules/whatsappBot/app/routes/whatsappIncoming.routes.js',
    busca: /^ {12}text: '¡Gracias por confirmar! 🙌 Tu profesional ya lo sabe\.',/gm,
    pon: "            text: 'Vale.',",
  },
  // Los cuatro · la bandera dice «en seco» y AUN ASÍ sale una llamada: un POST suelto, sin esperar,
  // por fuera del punto único. El envío sigue contestando ok y en seco. (La misma de SCRUM-876f.)
  'fuga-en-seco': {
    fichero: 'dist/integrations/whatsapp.js',
    busca: /^const isDryRun = \(\) => process\.env\.WHATSAPP_DRY_RUN === '1';/gm,
    pon: "const isDryRun = () => { const seco = process.env.WHATSAPP_DRY_RUN === '1'; if (seco) axios_1.default.post(BASE_URL + '/0/messages', {}).catch(() => { }); return seco; };",
  },
};

const [, , WT, orden, id] = process.argv;
const m = MUTACIONES[id];
if (!WT || !m || !['poner', 'quitar'].includes(orden)) { console.error('uso: <raíz> poner|quitar <id> · ids: ' + Object.keys(MUTACIONES).join(', ')); process.exit(2); }
const COPIAS = path.join(path.dirname(fileURLToPath(import.meta.url)), 'copias');
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
