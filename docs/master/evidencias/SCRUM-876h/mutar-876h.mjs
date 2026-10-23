// Mutador para los rojos de SCRUM-876h (scrum17-recapitulativa al banco). NUNCA toca src/. Uso:
//   node mutar-876h.mjs <raíz del árbol> poner <id>   → aplica UNA mutación (exige casar 1 vez) y guarda el original
//   node mutar-876h.mjs <raíz del árbol> quitar <id>  → restaura y comprueba por hash que volvió a ser el de antes
// Las copias van FUERA del árbol (junto a este fichero, en `copias/`).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');

const MUTACIONES = {
  // La ruta deja de romper por mes natural: todo lo seleccionado va a UNA factura.
  'una-sola-factura': {
    fichero: 'dist/modules/jobs/app/routes/jobs.routes.js',
    busca: /^ {8}const grupos = \(0, albaran_service_1\.groupByRotura\)\(consolidables\);/gm,
    pon: "        const grupos = [{ mesKey: '2026-03', mesLabel: 'marzo 2026', albaranes: consolidables }];",
  },
  // La factura sale sin decir de qué albaranes viene.
  'refs-vacias': {
    fichero: 'dist/modules/jobs/domain/recapitulativa.service.js',
    busca: /^ {12}const albaranRefs = g\.albaranes\.map\(\(a\) => \(\{ albaranId: a\.id, numero: a\.numero, fecha: a\.fecha \}\)\);/gm,
    pon: '            const albaranRefs = [];',
  },
  // El albarán no queda marcado como facturado: se podría facturar otra vez.
  'sin-marcar-facturado': {
    fichero: 'dist/modules/jobs/domain/recapitulativa.service.js',
    busca: /^ {16}data: \{ invoiceId: invoice\.id \},/gm,
    pon: '                data: { numero: undefined },',
  },
  // Al emitir sale una llamada hacia fuera, suelta y sin esperar. La respuesta de la ruta no cambia.
  'salida-al-emitir': {
    fichero: 'dist/modules/jobs/domain/recapitulativa.service.js',
    busca: /^ {12}out\.push\(\{ id: invoice\.id, number: invoice\.number, mesLabel: g\.mesLabel, total \}\);/gm,
    pon: "            out.push({ id: invoice.id, number: invoice.number, mesLabel: g.mesLabel, total }); require('axios').default.post('https://fuera-876h.invalid/registro', {}).catch(() => { });",
  },
  // El TEST con la comprobación de antes del 7-sep: lo que tenía en main mientras estuvo gateado.
  'asercion-de-antes': {
    fichero: 'tests/scrum17-recapitulativa.test.mjs',
    busca: /^ {4}assert\.match\(fMar\.number, \/\^F\\d\{6\}\$\/, 'número de serie FISCAL \(no J-\)'\);/gm,
    pon: "    assert.match(fMar.number, /^\\d{4}-/, 'número de serie FISCAL (no J-)');",
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
