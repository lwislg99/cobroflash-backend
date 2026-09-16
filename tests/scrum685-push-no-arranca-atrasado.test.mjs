// tests/scrum685-push-no-arranca-atrasado.test.mjs — SCRUM-685.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL DÍA QUE ESTO NO EXISTÍA
//
// 2-sep-2026: `scripts/db-push-prod` se ejecutó **sin modificar** desde el checkout compartido,
// que estaba **1.933 commits detrás de `origin/main`**. Su preview propuso, contra PRODUCCIÓN:
//
//     DROP TABLE job_assignees · DROP TABLE email_messages · ~30 DROP COLUMN
//
// El script no falló. Comparó producción contra un esquema fósil y produjo el SQL correcto para
// esa entrada. **Lo que estaba mal era el árbol.**
//
// Lo pararon dos cosas y sólo una es diseño: el GO explícito —que protege si alguien LEE el
// diff— y que aquel shell no tenía stdin, así que `read` recibió EOF. **La segunda es suerte.**
//
// Este fichero prueba que ya no hace falta suerte.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  estadoDelArbol, borradosDelPreview, informeDeBorrado,
  AL_DIA, ATRASADO, ADELANTADO_PUBLICADO, ADELANTADO_SIN_PUBLICAR, SUCIO, CIEGO,
} from '../scripts/_guard-arbol-y-borrado.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Un `git` de mentira. Por defecto: al día, limpio, publicado y con `fetch` que funciona. */
function gitFalso(cambios = {}) {
  return Object.assign({
    fetch: () => ({ ok: true }),
    detras: () => 0,
    delante: () => 0,
    sucioSchema: () => false,
    enElRemoto: () => true,
  }, cambios);
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// EL SUELO — el corazón del ticket
// ─────────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-685 · 🔴 SUELO: si `git fetch` FALLA, se declara CIEGO y NO se sigue', () => {
  const r = estadoDelArbol(gitFalso({ fetch: () => ({ ok: false, error: 'host inalcanzable' }) }));

  assert.equal(r.estado, CIEGO,
    '🔴 un `git fetch` que falla se ha leído como «estoy al día». «No pude comprobar» y «estoy ' +
    'al día» NO son el mismo verde: sin saber si el árbol está atrasado, el preview puede ' +
    'proponer borrar lo que otros añadieron.');
  assert.equal(r.puedeSeguir, false, '🔴 y aun así deja seguir');
  assert.match(r.motivo, /host inalcanzable/,
    '🔴 el rojo no dice POR QUÉ no se pudo comprobar: quien lo lea no puede arreglarlo');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// EL ROJO QUE IMPORTA
// ─────────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-685 · 🔴 UN ÁRBOL ATRASADO NO PASA, y el rojo dice cuántos commits', () => {
  const r = estadoDelArbol(gitFalso({ detras: () => 1933 }));

  assert.equal(r.estado, ATRASADO);
  assert.equal(r.puedeSeguir, false,
    '🔴 un árbol 1.933 commits atrasado llega al preview. Es EXACTAMENTE el estado del 2-sep.');
  assert.match(r.motivo, /1933/,
    '🔴 el rojo no dice cuántos commits faltan. «Estás atrasado» sin número no se puede actuar.');
  assert.match(r.motivo, /merge origin\/main|worktree al día/,
    '🔴 el rojo prohíbe y no dice qué hacer en su lugar.');
  // Y basta UNO: no hay margen de tolerancia, porque un solo commit puede ser el que añade la
  // columna que el diff propondría borrar.
  assert.equal(estadoDelArbol(gitFalso({ detras: () => 1 })).puedeSeguir, false,
    '🔴 con 1 commit de retraso pasa. Un solo commit basta para que el diff borre una columna.');
});

test('SCRUM-685 · 🔴 con el esquema SIN COMMITEAR tampoco se aplica', () => {
  const r = estadoDelArbol(gitFalso({ sucioSchema: () => true }));
  assert.equal(r.estado, SUCIO);
  assert.equal(r.puedeSeguir, false,
    '🔴 se aplica un esquema que no existe en ningún commit: mañana nadie puede decir qué se aplicó.');
  assert.match(r.motivo, /SHA/, '🔴 el rojo no explica que el problema es no poder nombrarlo');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// CONTROL NEGATIVO · estar POR DELANTE no es estar detrás
// ─────────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-685 · ✅ CONTROL NEGATIVO: ir por DELANTE y publicado SÍ pasa', () => {
  // Una rama de esquema en revisión es el caso normal, y su commit se puede nombrar por su SHA.
  // Tratarla igual que un árbol atrasado sería prohibir el trabajo legítimo para atajar el otro.
  const r = estadoDelArbol(gitFalso({ delante: () => 3, enElRemoto: () => true }));
  assert.equal(r.estado, ADELANTADO_PUBLICADO);
  assert.equal(r.puedeSeguir, true,
    '🔴 una rama de esquema publicada y por delante de main no puede aplicar. Eso no es lo que ' +
    'pasó el 2-sep: aquello era ATRÁS, y son cosas distintas.');
});

test('SCRUM-685 · 🔴 por delante pero SIN PUBLICAR: no pasa', () => {
  const r = estadoDelArbol(gitFalso({ delante: () => 3, enElRemoto: () => false }));
  assert.equal(r.estado, ADELANTADO_SIN_PUBLICAR);
  assert.equal(r.puedeSeguir, false,
    '🔴 se aplicaría un esquema que sólo existe en este disco: nadie podría reconstruir después ' +
    'contra qué se aplicó.');
});

test('SCRUM-685 · ✅ al día, limpio y publicado: pasa', () => {
  const r = estadoDelArbol(gitFalso());
  assert.equal(r.estado, AL_DIA);
  assert.equal(r.puedeSeguir, true, '🔴 el caso bueno tampoco pasa: el guard bloquea todo');
  assert.equal(r.motivo, null);
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// LA SEGUNDA PUERTA · el borrado
// ─────────────────────────────────────────────────────────────────────────────────────────

/** El preview REAL del 2-sep, recortado. Lo importante es la FORMA en que Prisma lo escribe. */
const PREVIEW_DEL_DESASTRE = `-- DropForeignKey
ALTER TABLE "public"."job_assignees" DROP CONSTRAINT "job_assignees_job_id_fkey";

-- AlterTable
ALTER TABLE "merchants" DROP COLUMN "retencion_irpf_declarada",
DROP COLUMN "retencion_irpf_tipo";

-- DropTable
DROP TABLE "public"."email_messages";
`;

/** El preview REAL y ADITIVO de SCRUM-674: los seis cambios que sí tenían que pasar. */
const PREVIEW_ADITIVO_674 = `-- AlterTable
ALTER TABLE "merchants" ADD COLUMN     "clausulas_presupuesto" JSONB;

-- AlterTable
ALTER TABLE "quotes" ADD COLUMN     "clausulas_excluidas" JSONB,
ADD COLUMN     "iva_modo" TEXT,
ADD COLUMN     "revision" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "jobs" ADD COLUMN     "tipo_intervencion" TEXT;

-- CreateTable
CREATE TABLE "partes_trabajo" (
    "id" SERIAL NOT NULL,
    "merchant_id" INTEGER NOT NULL,
    "numero" TEXT NOT NULL,

    CONSTRAINT "partes_trabajo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "partes_trabajo_merchant_id_fecha_idx" ON "partes_trabajo"("merchant_id", "fecha");
`;

test('SCRUM-685 · 🔴 EL PREVIEW DEL 2-SEP ABORTA, y nombra lo que borraría', () => {
  const r = borradosDelPreview(PREVIEW_DEL_DESASTRE);
  assert.equal(r.hayBorrado, true,
    '🔴 el diff que proponía borrar dos tablas de producción pasaría al GO. Es el ticket entero.');

  const texto = informeDeBorrado(r);
  assert.match(texto, /email_messages/, '🔴 el rojo no nombra la tabla que se borraría');
  assert.match(texto, /retencion_irpf/, '🔴 el rojo no nombra las columnas fiscales que se borrarían');
  assert.match(texto, /QUÉ RAMA FALTA/,
    '🔴 el rojo no dice la pregunta correcta. Ante un borrado, la primera pregunta no es «¿lo ' +
    'apruebo?» sino «¿qué rama falta por entrar?»: producción puede ir por delante de main.');
});

test('SCRUM-685 · 🔴 caza el DROP COLUMN DENTRO de un ALTER TABLE, que es como lo escribe Prisma', () => {
  const r = borradosDelPreview('ALTER TABLE "quotes" ADD COLUMN "x" TEXT,\nDROP COLUMN "doc_header_text";');
  assert.equal(r.hayBorrado, true,
    '🔴 un `DROP COLUMN` escondido dentro de un `ALTER TABLE` que además AÑADE ha pasado. Es la ' +
    'forma exacta en la que Prisma escribe los borrados.');
});

test('SCRUM-685 · 🔴 NO es un `grep DROP`: la palabra en un comentario NO aborta', () => {
  // El propio `_clasificador-sql.mjs` cuenta que un auditor improvisado se cazó a sí mismo con la
  // palabra «DROPs» en su comentario. Éste desnuda comentarios antes de clasificar.
  const conComentario = '-- ojo: este fichero NO lleva ningún DROP TABLE ni DROP COLUMN\n' +
    'ALTER TABLE "jobs" ADD COLUMN "tipo_intervencion" TEXT;\n';
  const r = borradosDelPreview(conComentario);
  assert.equal(r.hayBorrado, false,
    '🔴 se ha cazado a sí mismo: la palabra estaba en un COMENTARIO. Un `grep DROP` habría ' +
    'abortado un push perfectamente aditivo.');

  // Y una cadena de texto que contenga la palabra tampoco.
  const enCadena = `INSERT INTO t (nota) VALUES ('DROP COLUMN x');`;
  assert.equal(borradosDelPreview(enCadena).hayBorrado, false,
    '🔴 la palabra dentro de una cadena de texto ha abortado el push');
});

test('SCRUM-685 · ✅ CONTROL POSITIVO: el preview REAL de SCRUM-674 pasa entero', () => {
  const r = borradosDelPreview(PREVIEW_ADITIVO_674);
  assert.equal(r.hayBorrado, false,
    '🔴 los seis cambios aditivos de SCRUM-674 no pasan. Un guard que bloquea también lo bueno ' +
    'se desactiva a la semana, y entonces no protege de nada.\n   Rechazadas: ' +
    JSON.stringify(r.borrados.map((s) => s.forma)));
  assert.deepEqual(r.otrasNoAditivas.map((s) => s.forma), [],
    '🔴 y además marca como no aditivo algo que sí lo es');
});

test('SCRUM-685 · 🔴 «no supe leer el SQL» NO es «no hay borrados»', () => {
  // Un fichero que el clasificador no puede parsear se trata como peligroso. Es el mismo suelo
  // que el `git fetch`: la duda no puede salir por la línea del verde.
  const r = borradosDelPreview("ALTER TABLE 'sin cerrar la comilla");
  assert.equal(r.hayBorrado, true,
    '🔴 un SQL que no se pudo parsear ha pasado como limpio.');
  assert.match(informeDeBorrado(r), /NO SE PUDO PARSEAR|no supe/i);
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// EL SCRIPT LO USA DE VERDAD
// ─────────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-685 · 🔴 `db-push-prod` llama a las dos puertas, y ANTES del GO', () => {
  const sh = fs.readFileSync(path.join(RAIZ, 'scripts', 'db-push-prod'), 'utf8');
  // Sin comentarios: el script explica lo que hace, y el guard no puede casar con su explicación.
  const codigo = sh.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');

  assert.match(codigo, /estadoDelArbol/,
    '🔴 el script no usa la puerta del árbol: se puede volver a ejecutar desde un checkout fósil.');
  assert.match(codigo, /borradosDelPreview/,
    '🔴 el script no usa la puerta del borrado.');

  const iArbol = codigo.indexOf('estadoDelArbol');
  const iPreview = codigo.indexOf('prisma migrate diff');
  const iBorrado = codigo.indexOf('borradosDelPreview');
  const iGo = codigo.indexOf('read -r REPLY');

  assert.ok(iArbol > -1 && iPreview > -1 && iArbol < iPreview,
    '🔴 la puerta del árbol va DESPUÉS del preview. Tiene que abortar ANTES de enseñar SQL: un ' +
    'plan de destrucción impreso ya es una invitación a aprobarlo.');
  assert.ok(iBorrado > -1 && iGo > -1 && iBorrado < iGo,
    '🔴 la puerta del borrado va DESPUÉS del GO. Cuando se pregunta, ya es tarde.');
});

test('SCRUM-685 · el script imprime la PROCEDENCIA del esquema que compara', () => {
  const sh = fs.readFileSync(path.join(RAIZ, 'scripts', 'db-push-prod'), 'utf8');
  const codigo = sh.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
  assert.match(codigo, /rev-parse", "HEAD:prisma\/schema\.prisma"|HEAD:prisma\/schema\.prisma/,
    '🔴 no imprime el SHA del fichero de esquema. Sin procedencia, quien lea el diff no sabe de ' +
    'qué árbol salió, y después nadie puede auditar contra qué se aplicó.');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// SUELO DEL PROPIO FICHERO
// ─────────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-685 · 🔴 SUELO: el clasificador que se reutiliza RESPONDE', () => {
  // Si `_clasificador-sql.mjs` dejara de reconocer sentencias, `borradosDelPreview` devolvería
  // «no hay borrados» para todo y los tests de arriba pasarían por el motivo equivocado.
  const r = borradosDelPreview('DROP TABLE "x";');
  assert.equal(r.hayBorrado, true,
    '🔴 el clasificador no reconoce ni un `DROP TABLE` pelado: no está clasificando nada, y ' +
    'entonces ningún verde de este fichero significa nada.');
});

// ────────────────────────────────────────────────────────────────────────────────────
// EL MÉTODO DE LA CASA, DICHO DONDE SE LEE
// ────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-685 · 🔴 el script DICE que `db push` no es el método, y lo dice DOS veces', () => {
  // Un aviso en un ticket se olvida. Uno en la cabecera lo lee quien mantiene el script; uno en la
  // SALIDA lo lee quien lo ejecuta, que es el que está a punto de equivocarse.
  const sh = fs.readFileSync(path.join(RAIZ, 'scripts', 'db-push-prod'), 'utf8');

  const cabecera = sh.split('\n').slice(0, 60).join('\n');
  assert.match(cabecera, /NO ES EL MÉTODO DE ESTA CASA/i,
    '🔴 la cabecera no avisa de que `db push` no es el método contra producción.');

  // 🔴 ATADO AL BLOQUE, NO AL FICHERO (autorreferencia): se exige que el aviso salga por
  // `echo`, o sea que se IMPRIMA — no basta con que la frase exista en un comentario del fichero.
  const echos = sh.split('\n').filter((l) => /^\s*echo /.test(l)).join('\n');
  assert.match(echos, /NO es el metodo de esta casa/i,
    '🔴 el aviso está en un comentario pero NO se imprime. Quien ejecuta el script no lee sus ' +
    'comentarios: lee su salida.');
  assert.match(echos, /ALTER aditivo en las TRES bases/,
    '🔴 la salida no dice cuál ES el método. Prohibir sin decir la alternativa deja al operador ' +
    'en el mismo sitio.');
  assert.match(echos, /NUNCA 3\) sin 2\)/,
    '🔴 la salida no dice el orden: ③ (el PR) nunca va sin ② (el ALTER en las tres bases). Es el ' +
    'error concreto que se cometió con SCRUM-674.');
});

test('SCRUM-685 · ✅ CONTROL POSITIVO: el SQL de la PARTE A pasa el clasificador ENTERO', () => {
  // El fichero que Javier va a aplicar a las tres bases. Si este guard lo rechazara, el guard
  // estaría bloqueando justo el método bueno.
  const sql = fs.readFileSync(path.join(RAIZ, 'docs', 'sql', 'scrum-674-aditivo.sql'), 'utf8');
  const r = borradosDelPreview(sql);
  assert.equal(r.hayBorrado, false,
    '🔴 el SQL aditivo de SCRUM-674 se ha marcado como destructivo: ' +
    JSON.stringify(r.borrados.map((x) => x.forma)));
  assert.deepEqual(r.otrasNoAditivas.map((x) => x.forma), [],
    '🔴 y además marca alguna sentencia como no aditiva');
});

