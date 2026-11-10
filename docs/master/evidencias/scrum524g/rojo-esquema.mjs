// Corre el test de esquema de scrum524g contra copias MUTADAS de prisma/schema.prisma (en tmp),
// sin tocar el esquema real: sustituye la ruta que lee el test por la copia.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const raiz = process.cwd();
const tmp = process.argv[2];
const original = fs.readFileSync(path.join(raiz, 'prisma/schema.prisma'), 'utf8');
const test = fs.readFileSync(path.join(raiz, 'tests/scrum524g-numero-instalacion-por-comercio.test.mjs'), 'utf8');
const MUT = [
  ['sana', (s) => s],
  ['Merchant.email sin @unique', (s) => s.replace('  email     String? @unique', '  email     String?')],
  ['taxId lista', (s) => s.replace('  taxId     String? @map("tax_id")', '  taxId     String[] @map("tax_id")')],
  ['TeamMember.merchantId lista', (s) => s.replace(/(model TeamMember \{[\s\S]*?  merchantId Int)( @map)/, '$1[]$2')],
  ['TeamMember con dos relaciones a Merchant', (s) => s.replace(/(model TeamMember \{\r?\n)/, '$1  otro Merchant @relation("x", fields: [otroId], references: [id])\n')],
  ['TeamMember.email sin @unique', (s) => s.replace(/(model TeamMember \{[\s\S]*?  email  String) @unique/, '$1')],
];
for (const [nombre, f] of MUT) {
  const s = f(original);
  if (nombre !== 'sana' && s === original) { console.log(`CIEGO ${nombre}: la mutación no cambió nada`); continue; }
  const esq = path.join(tmp, 'schema.prisma');
  fs.writeFileSync(esq, s);
  const t = test.replace("path.join(RAIZ, 'prisma', 'schema.prisma')", JSON.stringify(esq))
    .replaceAll("'../dist/", JSON.stringify(path.join(raiz, 'dist')).slice(0, -1).replaceAll('\\\\', '/') + "/").replaceAll('/"', "/'")
  const ft = path.join(tmp, 'copia-524g.test.mjs');
  fs.writeFileSync(ft, t.replaceAll(`"${path.join(raiz, 'dist').replaceAll('\\', '/')}/`, `'file:///${path.join(raiz, 'dist').replaceAll('\\', '/')}/`));
  const r = spawnSync(process.execPath, ['--test', '--test-name-pattern=una cuenta', ft], { encoding: 'utf8' });
  const pasa = /# pass (\d+)/.exec(r.stdout)?.[1]; const cae = /# fail (\d+)/.exec(r.stdout)?.[1];
  console.log(`${nombre}: status=${r.status} pass=${pasa} fail=${cae}`);
}
