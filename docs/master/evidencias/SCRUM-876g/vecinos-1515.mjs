// SCRUM-876g: ¿quién corre AL LADO de scrum1515 en la tanda entera, y a qué distancia quedan los cuatro de T4?
// node --test reparte los ficheros en el orden en que se los dan (el del glob de la shell) con un fondo de N.
// Uso: node vecinos-1515.mjs <raíz del árbol>
import fs from 'node:fs';
import path from 'node:path';

const raiz = process.argv[2];
const dir = path.join(raiz, 'tests');
const todos = fs.readdirSync(dir).filter((f) => f.endsWith('.test.mjs'));
// Dos órdenes posibles del glob: bytes (LC_ALL=C) y el de `en_US.UTF-8` (ignora guiones y mayúsculas en primera pasada).
const ordenes = {
  bytes: [...todos].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
  locale: [...todos].sort((a, b) => a.localeCompare(b, 'en', { numeric: false })),
};
const cuatro = ['scrum47-enviar-albaran-wa.test.mjs', 'scrum49-firma-remota.test.mjs', 'scrum50-bot-albaranes.test.mjs', 'scrum68-evidencias-firma.test.mjs'];
const el1515 = 'scrum1515-nuestra-puerta-de-alta.test.mjs';
const usaBanco = (f) => /LIBRO_PG_URL/.test(fs.readFileSync(path.join(dir, f), 'utf8'));
const creaMerchant = (f) => /merchant\.(create|createMany|upsert|delete|deleteMany)\b|registerMerchant|crearMerchant|sembrar/i.test(fs.readFileSync(path.join(dir, f), 'utf8'));

console.log(`POBLACION · ficheros de test = ${todos.length} · con LIBRO_PG_URL = ${todos.filter(usaBanco).length} · de ésos, que nombran crear/borrar merchant = ${todos.filter((f) => usaBanco(f) && creaMerchant(f)).length}`);
for (const [nombre, lista] of Object.entries(ordenes)) {
  const i = lista.indexOf(el1515);
  if (i < 0) { console.log(`🔴 CIEGO: ${el1515} no está en la lista (${nombre})`); process.exit(2); }
  console.log(`\n── orden «${nombre}» · scrum1515 en la posición ${i + 1} de ${lista.length}`);
  for (const c of cuatro) {
    const j = lista.indexOf(c);
    console.log(`   ${c.padEnd(40)} posición ${j < 0 ? 'AUSENTE' : j + 1} · distancia ${j < 0 ? '-' : Math.abs(j - i)} ficheros`);
  }
  const vecinos = lista.slice(Math.max(0, i - 12), i + 13).filter((f) => f !== el1515);
  const delBanco = vecinos.filter((f) => usaBanco(f));
  console.log(`   vecinos a ±12 = ${vecinos.length} · con LIBRO_PG_URL = ${delBanco.length} · que además nombran crear/borrar merchant = ${delBanco.filter(creaMerchant).length}`);
  for (const f of delBanco) console.log(`     ${String(lista.indexOf(f) - i).padStart(3)} · ${f}${creaMerchant(f) ? ' · CREA/BORRA merchant' : ''}`);
}
