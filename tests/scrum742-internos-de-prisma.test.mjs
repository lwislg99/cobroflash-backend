// tests/scrum742-internos-de-prisma.test.mjs — SCRUM-742
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL TRINQUETE DEL CENSO DE INTERNOS DE PRISMA.
//
// El censo (`npm run censo:internos-prisma`) contesta «cuánto de esta casa depende de cosas que
// Prisma no promete». Este fichero no repite el censo: vigila que **siga sabiendo mirar** y que
// la superficie **no crezca sin que nadie lo diga**.
//
// 🔴 POR QUÉ UN TRINQUETE Y NO UN NÚMERO EXACTO. Un guard que exige «exactamente 15» cae con cada
// fichero nuevo que use `PrismaClient` bien y acaba desactivado en una tarde. Lo que importa no
// es el número: es que **añadir una dependencia nueva de un interno obligue a tocar ESTE fichero
// y a explicarlo**. Por eso el tope es un máximo con holgura y el mínimo es un suelo.
//
// 🔴 Y POR QUÉ EL CONTROL NEGATIVO ES LA MITAD DEL VALOR: el censo cuenta a propósito los usos de
// la API PÚBLICA. Si el barrido dejara de verlos, su «cero internos» sería un cero de ceguera —y
// se leería como la mejor noticia posible—. Es el mismo defecto que este ticket vino a evitar en
// su propio instrumento: la primera versión del censo se contaba A SÍ MISMA en cuatro superficies.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SUPERFICIES, DIRECTORIOS, SE_EXCLUYE,
  ficherosDelArbol, superficiesDe, censar, bloquePrismaDePackageJson,
} from '../scripts/censo-internos-de-prisma.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** El censo real del árbol, tal cual lo hace el script (sin contarse a sí mismo). */
function censoDelArbol() {
  const ficheros = ficherosDelArbol(RAIZ, DIRECTORIOS)
    .filter((f) => path.relative(RAIZ, f).replace(/\\/g, '/') !== SE_EXCLUYE);
  const entradas = ficheros.map((f) => ({
    nombre: path.relative(RAIZ, f).replace(/\\/g, '/'),
    texto: fs.readFileSync(f, 'utf8'),
  }));
  return { ficheros, ...censar(entradas) };
}

const usan = (porSuperficie, id) => porSuperficie.get(id).usan;

// ═══ ① SUELOS · SIN ESTO, CUALQUIER CERO DE ABAJO ES UN CERO DE CEGUERA ══════════════════

test('SCRUM-742 · 🔴 SUELO: el barrido ve la población y ve el uso NORMAL de Prisma', () => {
  const { ficheros, porSuperficie } = censoDelArbol();
  assert.ok(ficheros.length > 900,
    `🔴 ESCÁNER CIEGO: la población es de ${ficheros.length} ficheros. Este repo tiene más de mil.`);

  const publicos = usan(porSuperficie, 'api-publica');
  assert.ok(publicos.length > 40,
    `🔴 ESCÁNER CIEGO: sólo ${publicos.length} ficheros usan la API pública de Prisma, y esta casa `
    + 'la usa por todas partes. Si el barrido no ve lo normal, su recuento de lo interno no vale.');
});

test('SCRUM-742 · 🔴 SUELO: el censo NO se cuenta a sí mismo', () => {
  // La primera versión aparecía en CUATRO superficies sin tocar ninguna: sus patrones son
  // literales de regex en código ejecutable. Un instrumento que sale en su propia medición la
  // infla justo donde uno querría creerse el número.
  const propio = path.join(RAIZ, SE_EXCLUYE);
  assert.ok(fs.existsSync(propio), `🔴 SE_EXCLUYE apunta a ${SE_EXCLUYE} y ahí no hay nada: el filtro dejó de aplicarse.`);
  const { toca } = superficiesDe(fs.readFileSync(propio, 'utf8'));
  assert.ok(toca.length >= 3,
    '🔴 el propio censo ya NO casa con sus patrones. O se han aflojado, o el fichero cambió: en '
    + 'cualquier caso la exclusión dejó de ser necesaria y hay que volver a mirar por qué está.');

  const { porSuperficie } = censoDelArbol();
  for (const s of SUPERFICIES) {
    assert.ok(!usan(porSuperficie, s.id).includes(SE_EXCLUYE),
      `🔴 el censo se cuenta a sí mismo en «${s.id}».`);
  }
});

// ═══ ② EL MÉTODO: DISTINGUIR CÓDIGO DE COMENTARIO, Y DEMOSTRARLO ═════════════════════════

test('SCRUM-742 · 🔴 el censo distingue USAR de NOMBRAR EN UN COMENTARIO', () => {
  // Es la razón entera de no usar `grep`, y se demuestra con el caso real que lo destapó:
  // `_pares-del-schema.mjs` explica en su cabecera de dónde saca el censo el OTRO camino, y ahí
  // escribe `Prisma.dmmf` — sin tocarlo nunca.
  const { porSuperficie } = censoDelArbol();
  const dmmf = porSuperficie.get('dmmf');
  assert.ok(!dmmf.usan.includes('scripts/_pares-del-schema.mjs'),
    '🔴 se cuenta `_pares-del-schema.mjs` como usuario del DMMF, y sólo lo nombra en un comentario.');
  assert.ok(dmmf.soloNombran.includes('scripts/_pares-del-schema.mjs'),
    '🔴 ni siquiera se detecta la mención: el censo ha dejado de saber que ahí pone `Prisma.dmmf`, '
    + 'así que su «no lo usa» ya no es una decisión, es ceguera.');

  // AUTOPRUEBA sobre fuente sintético: las dos direcciones, o el detector no sabe decir que no.
  const enComentario = superficiesDe('// esto habla de Prisma.dmmf y nada más\nconst x = 1;\n');
  assert.deepEqual(enComentario.toca, [], '🔴 un comentario cuenta como uso.');
  assert.deepEqual(enComentario.soloEnComentario, ['dmmf'], '🔴 no ve la mención en el comentario.');

  const enCodigo = superficiesDe('const m = Prisma.dmmf.datamodel.models;\n');
  assert.ok(enCodigo.toca.includes('dmmf'), '🔴 no ve un uso REAL del DMMF.');
});

// ═══ ③ EL TRINQUETE ══════════════════════════════════════════════════════════════════════

/**
 * Los topes. Son MÁXIMOS con holgura, no espejos: subir uno es una decisión que se toma tocando
 * este fichero, que es exactamente el punto. Medido el 4-sep-2026 contra `prisma` 6.18.0.
 */
const TOPES = Object.freeze({
  dmmf: 11,                  // hoy 9
  'fichero-del-cliente': 3,  // hoy 1
  'paquete-interno': 1,      // hoy 0 — que suba a 1 significa una dependencia NUEVA (regla 36)
  'ruta-del-cli': 7,         // hoy 5
  'cli-invocado': 6,         // hoy 4
});

test('SCRUM-742 · 🔴 la superficie interna no crece sin que nadie lo diga', () => {
  const { porSuperficie } = censoDelArbol();
  const excedidos = [];
  for (const [id, tope] of Object.entries(TOPES)) {
    const n = usan(porSuperficie, id).length;
    if (n > tope) excedidos.push(`${id}: ${n} > ${tope}\n       ${usan(porSuperficie, id).join('\n       ')}`);
  }
  assert.deepEqual(excedidos, [],
    '🔴 HAY MÁS SITIOS APOYADOS EN INTERNOS DE PRISMA que la última vez que alguien miró:\n    '
    + excedidos.join('\n    ')
    + '\n\n  No es «arréglalo»: es «dilo». Sube el tope AQUÍ, con su motivo, y actualiza\n'
    + '  `docs/CENSO_INTERNOS_PRISMA.md` — que es la lista con la que el fundador decide si se\n'
    + '  sube de versión. Una superficie que crece en silencio hace esa decisión con datos viejos.');
});

test('SCRUM-742 · 🔴 CERO ES SOSPECHA: si una superficie baja a cero, se anota', () => {
  // El otro lado del trinquete. Un cero puede ser una buena noticia —alguien quitó la dependencia—
  // o el instrumento roto. Las dos se parecen mucho, así que se obliga a mirar.
  const { porSuperficie } = censoDelArbol();
  assert.ok(usan(porSuperficie, 'dmmf').length > 0,
    '🔴 CERO usos de `Prisma.dmmf`. Si de verdad se han quitado los nueve, es una gran noticia y '
    + 'hay que anotarla en docs/CENSO_INTERNOS_PRISMA.md y bajar el tope. Si no, el filtro se ha '
    + 'comido el fuente y este censo lleva quién sabe cuánto mirando la nada.');
  assert.ok(usan(porSuperficie, 'cli-invocado').length > 0,
    '🔴 CERO invocaciones del CLI, y hay al menos cuatro scripts que lo lanzan.');
});

// ═══ ④ LO QUE TIENE FECHA: EL BLOQUE DE package.json ═════════════════════════════════════

test('SCRUM-742 · 🔴 el aviso de Prisma 7 se cita del CLI INSTALADO, no de memoria', () => {
  // Es la ÚNICA afirmación sobre Prisma 7 que esta máquina puede hacer por sí sola, y por eso se
  // lee del paquete instalado en cada tanda en vez de copiarse a un documento donde caduca.
  const r = bloquePrismaDePackageJson(RAIZ);
  assert.equal(r.existe, true,
    '🔴 ya no hay bloque `prisma` en package.json. Si se ha migrado a `prisma.config.ts`, es una '
    + 'buena noticia: anótalo en docs/CENSO_INTERNOS_PRISMA.md y quita este test.');
  assert.ok(r.avisoDelCli,
    '🔴 NO SUPE LEER el aviso en `@prisma/config`. No se concluye que ya no exista: se concluye '
    + 'que no se pudo comprobar, que es distinto. Puede ser otra versión o otra ruta.');
  assert.match(r.avisoDelCli, /removed in Prisma \d+/,
    `🔴 el aviso del CLI ya no dice lo que decía: «${r.avisoDelCli}». Vuelve a mirar la guía de subida.`);
});

// ═══ ⑤ QUE EL CENSO SEA EJECUTABLE Y ESTÉ DOCUMENTADO ════════════════════════════════════

test('SCRUM-742 · el censo se puede ejecutar y su documento existe', () => {
  // `package.json` es la AUTORIDAD de lo que se puede ejecutar (SCRUM-548): un censo que no está
  // ahí no lo encuentra nadie, y el documento sin el comando envejece sin que se note.
  const pkg = JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8'));
  assert.ok(pkg.scripts['censo:internos-prisma'],
    '🔴 el censo no está en package.json: no se puede ejecutar y nadie lo va a encontrar.');
  assert.ok(fs.existsSync(path.join(RAIZ, SE_EXCLUYE)),
    '🔴 el script del censo no está donde dice package.json.');

  const doc = path.join(RAIZ, 'docs', 'CENSO_INTERNOS_PRISMA.md');
  assert.ok(fs.existsSync(doc), '🔴 falta docs/CENSO_INTERNOS_PRISMA.md, que es donde vive la decisión.');
  const texto = fs.readFileSync(doc, 'utf8');
  assert.match(texto, /censo:internos-prisma/, '🔴 el documento no dice con qué comando se rehace.');
  assert.match(texto, /regla 36/, '🔴 el documento no recuerda que la decisión es del fundador.');

  // Y la forma correcta de lanzar el CLI, donde el próximo la busque.
  const runbooks = fs.readFileSync(path.join(RAIZ, 'docs', 'RUNBOOKS.md'), 'utf8');
  assert.match(runbooks, /prisma[\\/]build[\\/]index\.js/,
    '🔴 los RUNBOOKS ya no explican cómo se lanza el CLI de Prisma desde un script. Es lo que '
    + 'falla SIEMPRE en Windows con `node_modules/.bin/prisma`, y el fallo no habla de Prisma.');
});
