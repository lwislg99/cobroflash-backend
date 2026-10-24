// SCRUM-1310 · re-medición de solo lectura: ¿qué claves ajenas implica `prisma/schema.prisma` en una ref
// y cuáles tienen DDL en las migraciones congeladas o en docs/sql? Lee con `git show`/`git grep`.
// Uso: node medir-fk.mjs <ref o sha> [--sin-semilla]   (sin la semilla, el control positivo dice CIEGO)
// No conecta a ninguna base. Límite: compara por el nombre de restricción que el esquema implica.
import { execFileSync } from 'node:child_process';

const REF = process.argv[2];
if (!REF || REF.startsWith('--')) { console.error('falta la ref: node medir-fk.mjs <ref o sha>'); process.exit(2); }
const SEMBRAR = !process.argv.includes('--sin-semilla');
const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 64 << 20 });

const schema = git('show', `${REF}:prisma/schema.prisma`);

// ── 1. modelos → tabla y columnas
const modelos = {};
for (const m of schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
  const [, nombre, cuerpo] = m;
  const map = cuerpo.match(/@@map\("([^"]+)"\)/);
  const cols = {};
  const rels = [];
  for (const linea of cuerpo.split('\n')) {
    const l = linea.replace(/\/\/.*$/, '').trim();
    const f = l.match(/^(\w+)\s+(\w+)(\[\])?(\?)?\s*(.*)$/);
    if (!f || l.startsWith('@@')) continue;
    const [, campo, tipo, , opcional, resto] = f;
    const cm = resto.match(/@map\("([^"]+)"\)/);
    cols[campo] = cm ? cm[1] : campo;
    const r = resto.match(/@relation\(([^)]*)\)/);
    if (r && /fields\s*:/.test(r[1])) {
      const campos = r[1].match(/fields\s*:\s*\[([^\]]*)\]/)[1].split(',').map(s => s.trim());
      const od = r[1].match(/onDelete\s*:\s*(\w+)/);
      const mp = r[1].match(/map\s*:\s*"([^"]+)"/);
      rels.push({ campo, tipo, opcional: !!opcional, campos, onDelete: od ? od[1] : null, map: mp ? mp[1] : null });
    }
  }
  modelos[nombre] = { tabla: map ? map[1] : nombre, cols, rels };
}

// control independiente: recuento a mano de @relation con fields: (por texto, sin parser de modelos)
const recuentoTexto = (schema.replace(/\/\/.*$/gm, '').match(/@relation\([^)]*fields\s*:/g) || []).length;

const fks = [];
for (const [nombre, m] of Object.entries(modelos)) {
  for (const r of m.rels) {
    const colsDb = r.campos.map(c => m.cols[c] ?? c);
    fks.push({
      modelo: nombre, tabla: m.tabla, columnas: colsDb, opcional: r.opcional,
      onDeleteEsquema: r.onDelete,
      restriccion: r.map ?? `${m.tabla}_${colsDb.join('_')}_fkey`,
    });
  }
}

// ── 2. fuentes de DDL: congeladas + docs/sql (la población del ticket)
const lista = git('ls-tree', '-r', '--name-only', REF, '--',
  'docs/historico/prisma-migrations-frozen-2026-03', 'docs/sql').split('\n').filter(Boolean);
const fuentes = lista.map(p => ({ ruta: p, texto: git('show', `${REF}:${p}`) }));
const SEMILLA = 'zz_semilla_1310_padre_fkey';
if (SEMBRAR) {
  fuentes.push({ ruta: '<semilla>', texto: `ALTER TABLE "zz_semilla_1310" ADD CONSTRAINT "${SEMILLA}" FOREIGN KEY ("padre") REFERENCES "zz"("id") ON DELETE CASCADE ON UPDATE CASCADE;` });
  // las tres formas de CREATE TABLE que hay en el árbol: con esquema, entre comillas, con IF NOT EXISTS
  // (sin la primera, el 1-oct `customers` salió «sin CREATE TABLE» y no lo era)
  fuentes.push({ ruta: '<semilla-create>', texto: 'CREATE TABLE "public"."zz_s1" (\nCREATE TABLE "zz_s2" (\nCREATE TABLE IF NOT EXISTS "zz_s3" (' });
  fks.push({ modelo: '<semilla>', tabla: 'zz_semilla_1310', columnas: ['padre'], opcional: false, onDeleteEsquema: 'Cascade', restriccion: SEMILLA });
}
// control cero derivado: un nombre que no puede estar en ningún fichero
const CERO = `zz_${Date.now().toString(36)}_cero_fkey`;
fks.push({ modelo: '<cero>', tabla: 'zz_cero', columnas: ['x'], opcional: false, onDeleteEsquema: null, restriccion: CERO });

const buscar = (nombre) => {
  const hits = [];
  for (const f of fuentes) {
    const lineas = f.texto.split('\n');
    lineas.forEach((l, i) => {
      if (new RegExp(`(^|[^\\w])"?${nombre}"?([^\\w]|$)`).test(l)) {
        const trozo = lineas.slice(i, i + 4).join(' ');
        const od = trozo.match(/ON DELETE (SET NULL|SET DEFAULT|NO ACTION|RESTRICT|CASCADE)/i);
        hits.push({ ruta: f.ruta, linea: i + 1, onDelete: od ? od[1].toUpperCase() : null });
      }
    });
  }
  return hits;
};
const tieneCreate = (tabla) => fuentes.filter(f => new RegExp(`CREATE TABLE (IF NOT EXISTS )?("?public"?\.)?"?${tabla}"?\\s*\\(`, 'i').test(f.texto)).map(f => f.ruta);

// ── 3. resto del repo: ¿aparece el nombre en ALGÚN fichero fuera de esas dos carpetas?
const enRepo = (nombre) => {
  try {
    return git('grep', '-l', '-F', nombre, REF, '--').split('\n').filter(Boolean)
      .map(s => s.slice(REF.length + 1))
      .filter(p => !p.startsWith('docs/historico/prisma-migrations-frozen-2026-03/') && !p.startsWith('docs/sql/'));
  } catch { return []; }
};

const filas = fks.map(fk => {
  const hits = buscar(fk.restriccion);
  return { ...fk, hits, create: tieneCreate(fk.tabla), otros: hits.length ? [] : enRepo(fk.restriccion) };
});

const reales = filas.filter(f => !f.modelo.startsWith('<'));
const con = reales.filter(f => f.hits.length), sin = reales.filter(f => !f.hits.length);
const tablas = new Set(reales.map(f => f.tabla));
const tablasSin = new Set(sin.map(f => f.tabla));
const semilla = filas.find(f => f.modelo === '<semilla>');
const cero = filas.find(f => f.modelo === '<cero>');

console.log(`REF ${REF} = ${git('rev-parse', REF).trim()}`);
console.log(`POBLACION · fuentes DDL leídas=${lista.length} (bytes=${fuentes.reduce((a, f) => a + f.texto.length, 0)}) · modelos=${Object.keys(modelos).length}`);
console.log(`FK parser=${reales.length} · recuento texto @relation(fields:)=${recuentoTexto} · ${reales.length === recuentoTexto ? 'CASAN' : 'NO CASAN'}`);
console.log(`tablas con FK=${tablas.size} · con DDL=${con.length} · SIN fuente=${sin.length} · tablas afectadas=${tablasSin.size}`);
if (SEMBRAR) console.log(`CONTROL+ CREATE TABLE sembrados: ${['zz_s1', 'zz_s2', 'zz_s3'].filter(t => tieneCreate(t).length).length} de 3 vistos${['zz_s1', 'zz_s2', 'zz_s3'].every(t => tieneCreate(t).length) ? '' : ' → CIEGO para la lista de tablas'}`);
console.log(`CONTROL+ semilla: ${SEMBRAR ? (semilla.hits.length && semilla.hits[0].onDelete === 'CASCADE' ? 'VISTA (CASCADE)' : 'NO VISTA → CIEGO') : 'QUITADA → CIEGO: sin semilla nada demuestra que el instrumento ve un DDL'}`);
console.log(`CONTROL0 ${CERO}: ${cero.hits.length === 0 && cero.otros.length === 0 ? 'cero (bien)' : 'VISTO → instrumento roto'}`);
console.log('\n--- SIN fuente en congeladas ni docs/sql ---');
for (const f of sin) console.log(`${f.restriccion} · ${f.opcional ? 'opcional' : 'obligatoria'} · onDelete esquema=${f.onDeleteEsquema ?? '(implícito)'} · CREATE TABLE ${f.create.length ? f.create.join(',') : 'NINGUNO'} · nombre en otro fichero: ${f.otros.length ? f.otros.join(', ') : 'ninguno'}`);
console.log('\n--- CON fuente ---');
for (const f of con) {
  const od = [...new Set(f.hits.map(h => h.onDelete))].join('/');
  const esq = f.onDeleteEsquema ? f.onDeleteEsquema.replace(/([a-z])([A-Z])/g, '$1 $2').toUpperCase() : '(implícito)';
  console.log(`${f.restriccion} · ddl=${od} · esquema=${esq} · ${f.hits.map(h => `${h.ruta.split('/').slice(-2).join('/')}:${h.linea}`).join(' ; ')}`);
}
console.log('\n--- tablas SIN ningún CREATE TABLE en esas fuentes ---');
console.log([...tablas].filter(t => !tieneCreate(t).length).join(', ') || '(ninguna)');
