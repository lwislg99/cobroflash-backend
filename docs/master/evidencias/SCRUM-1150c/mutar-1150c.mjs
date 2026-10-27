// mutar-1150c.mjs <raíz ABSOLUTA del árbol> <m1|m2> — mutantes del arreglo de SCRUM-1150c.
//   m1 · el cerrojo se toma, pero el grupo NO se relee detrás: se usa lo decidido antes.
//   m2 · el grupo se relee dentro de la transacción, pero SIN cerrojo.
// (El mutante m0, «el fichero de main», se pone con `git restore --source=<sha>`.)
import fs from 'node:fs';
import path from 'node:path';

const [raiz, cual] = process.argv.slice(2);
const f = path.join(raiz, 'src', 'modules', 'system', 'quoteAdmin.ts');
let t = fs.readFileSync(f, 'utf8');
const antes = t;
const cambiar = (de, a) => {
  if (!t.includes(de)) { console.error(`🔴 no encuentro el punto a mutar: ${de}`); process.exit(2); }
  t = t.replace(de, a);
};
if (cual === 'm1') {
  cambiar('  await decidirRevisionDe(prisma, merchantId, id);\n', '  const previo = await decidirRevisionDe(prisma, merchantId, id);\n');
  cambiar('= await decidirRevisionDe(tx, merchantId, id);', '= previo;');
} else if (cual === 'm2') {
  cambiar('    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${REVISION_LOCK_NS}::int, ${merchantId}::int)`;\n', '');
} else { console.error('uso: mutar-1150c.mjs <raíz> <m1|m2>'); process.exit(2); }
if (t === antes) { console.error('🔴 la mutación no cambió nada'); process.exit(2); }
fs.writeFileSync(f, t);
console.log(`MUTANTE ${cual} puesto en ${f}`);
