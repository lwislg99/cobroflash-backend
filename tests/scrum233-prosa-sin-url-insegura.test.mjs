// SCRUM-233 · NINGÚN DOCUMENTO ENSEÑA A PASAR UNA URL DE BD POR `--from-url` / `--to-url`.
//
// POR QUÉ HACE FALTA, y es la mitad que SCRUM-226 declaró fuera de su alcance:
//
// El guard de 226 (`tests/scrum226-url-credencial-en-argv.test.mjs`) recorre el repo pero solo
// mira CÓDIGO — su `CODE_EXT` es `.ts/.js/.mjs/.cjs`. Ningún `.md` entra en su barrido. Eso no es
// una omisión, está declarado ahí: la prosa quedaba fuera.
//
// Y la prosa es donde más duele, porque **un runbook es un comando que teclea un humano**. Las dos
// fugas de credenciales de esta semana vinieron de comandos ad-hoc de sesión, no de ficheros del
// repo — y el motivo de fondo de 226 era «sesiones copiando formas». Un documento es el sitio
// donde más se copian formas. Un guard que protege el código y deja el runbook enseñando la forma
// insegura protege el sitio por donde el fallo NO llegó.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LA REGLA, y por qué no es «que no aparezca el flag»
//
// El flag se puede NOMBRAR legítimamente: hay una nota en el runbook que explica que en Prisma 7
// `--from-url` **ya no existe**. Prohibir la palabra haría rojo un texto que avisa de un problema
// real, y un guard que estorba en prosa correcta acaba desactivado.
//
// Lo que se prohíbe es la FORMA PELIGROSA: el flag **seguido de algo que sea una URL de verdad o
// una variable que la contenga**. Un flag nombrado a secas, o seguido de un marcador evidente
// (`<url>`, `…`), no dispara. Esa distinción es todo el guard.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL AUTO-CAZADO, resuelto por RUTA y no por contenido
//
// Este fichero está lleno de los literales que vigila, y el ticket que lo pidió también. La
// solución NO es una allowlist de contenido —que se convierte en «apaga el guard donde molesta»—
// sino excluir RUTAS explícitas. Hoy la lista está VACÍA y es lo correcto: este guard es `.mjs`,
// así que el barrido de `.md` no lo alcanza, y ningún documento del repo necesita excepción.
// Una lista vacía es la única creíble: una que nace poblada enseña a poblarla (lección de
// SCRUM-211).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * RUTAS excluidas, explícitas y con motivo. **Vacía a propósito.**
 * Si alguna vez hay que añadir una, va con su ticket al lado y su fecha de caducidad — nunca
 * «porque molesta». Un documento que de verdad necesita enseñar la forma insegura no existe:
 * la forma segura (`--from-schema-datasource`) hace lo mismo sin exponer la credencial.
 */
const RUTAS_EXCLUIDAS = [];

/** Los flags cuyo siguiente token es una URL de conexión. Son los que 226 vigila en el argv. */
const FLAGS = ['--from-url', '--to-url'];

/**
 * Marcadores que NO son una URL real: un hueco que el lector rellena. Se permiten porque un
 * runbook necesita poder describir la forma de un comando sin escribir una credencial.
 */
const ES_MARCADOR = /^(<[^>]*>|\[[^\]]*\]|\.{3}|…|"…"|'…'|\{\{[^}]*\}\}|\$\{?URL\}?|URL)$/i;

/** ¿Este token es (o contiene) una URL de conexión de verdad, o una variable que la lleva? */
function esUrlPeligrosa(token) {
  if (!token) return false;
  const t = token.replace(/^[`'"(]+|[`'",)]+$/g, ''); // quita comillas, backticks y paréntesis
  if (!t) return false;
  if (ES_MARCADOR.test(t)) return false;
  if (/^(postgres|postgresql|mysql|mongodb):\/\//i.test(t)) return true;  // una URL escrita
  if (/\$\{?[A-Z_][A-Z0-9_]*\}?/.test(t)) return true;                    // $VAR / ${VAR}
  if (/%[A-Z_][A-Z0-9_]*%/.test(t)) return true;                          // %VAR% (Windows)
  if (/DATABASE_URL/i.test(t)) return true;                               // el nombre de la var
  return false;
}

const rel = (p) => path.relative(RAIZ, p).split(path.sep).join('/');

/** Todos los `.md` bajo `docs/` más los de la raíz. */
function markdowns() {
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { walk(full); continue; }
      if (e.name.endsWith('.md')) out.push(full);
    }
  };
  const docs = path.join(RAIZ, 'docs');
  if (fs.existsSync(docs)) walk(docs);
  for (const e of fs.readdirSync(RAIZ, { withFileTypes: true })) {
    if (!e.isDirectory() && e.name.endsWith('.md')) out.push(path.join(RAIZ, e.name));
  }
  return out.filter((p) => !RUTAS_EXCLUIDAS.includes(rel(p)));
}

/** Infracciones en un texto markdown: el flag seguido de una URL real. */
export function infraccionesEnProsa(texto, ruta = 'ficticio.md') {
  const out = [];
  texto.split(/\r?\n/).forEach((linea, i) => {
    for (const flag of FLAGS) {
      let desde = 0;
      for (;;) {
        const idx = linea.indexOf(flag, desde);
        if (idx === -1) break;
        desde = idx + flag.length;
        // El siguiente token: lo que va tras el flag, saltando espacios y un `=` opcional.
        const resto = linea.slice(desde).replace(/^[=\s]+/, '');
        const token = resto.split(/[\s`]+/)[0] || '';
        if (esUrlPeligrosa(token)) {
          out.push({ ruta, linea: i + 1, flag, token, texto: linea.trim().slice(0, 100) });
        }
      }
    }
  });
  return out;
}

function escanear() {
  const out = [];
  for (const p of markdowns()) {
    out.push(...infraccionesEnProsa(fs.readFileSync(p, 'utf8'), rel(p)));
  }
  return out;
}

// ── 1 · SUELO · que el barrido tenga algo real que mirar ──────────────────────────────────
// Sin esto, un `docs/` mal resuelto devuelve lista vacía y el guard pasa en VERDE sin haber
// leído un documento. Verde hueco: el peor resultado posible en un guard de credenciales.
test('SCRUM-233 · SUELO: el barrido alcanza los .md de docs/ y de la raíz', () => {
  const vistos = markdowns().map(rel);
  assert.ok(vistos.length >= 30, `🔴 ESCÁNER CIEGO: solo ${vistos.length} ficheros .md`);
  assert.ok(
    vistos.includes('docs/QA/SUITE_REGRESION.md'),
    '🔴 el barrido no ve el runbook de db push — justo el documento que motivó este ticket',
  );
  assert.ok(vistos.includes('CLAUDE.md'), '🔴 el barrido no llega a los .md de la raíz');
});

// ── 2 · CONTROL POSITIVO · que el detector sepa dar rojo ──────────────────────────────────
// «0 hallazgos» tiene que poder distinguir «docs limpios» de «detector ciego».
test('SCRUM-233 · detecta la forma insegura en sus variantes reales', () => {
  const casos = [
    'npx prisma migrate diff --from-url "$DATABASE_URL" --script',
    '`prisma migrate diff --from-url postgresql://user:pass@host/db`',
    'prisma migrate diff --to-url ${DATABASE_URL_STAGING}',
    'prisma migrate diff --from-url=%DATABASE_URL%',
  ];
  for (const c of casos) {
    assert.equal(infraccionesEnProsa(c).length, 1, `🔴 no detecta: ${c}`);
  }
});

// ── 3 · CONTROLES NEGATIVOS · lo legítimo no dispara ──────────────────────────────────────
// Si esto fallara, el guard daría rojo sobre prosa correcta y alguien lo desactivaría — que es
// la forma más silenciosa de perder un guard.
test('SCRUM-233 · nombrar el flag en prosa NO dispara (el caso real del runbook)', () => {
  // Línea REAL de docs/QA/SUITE_REGRESION.md: avisa de que en Prisma 7 el flag desapareció.
  const real = 'el junction de `node_modules`, `npx` se baja **Prisma 7** del registro, y ahí `--from-url`';
  assert.deepEqual(infraccionesEnProsa(real), [],
    '🔴 caza una nota que AVISA del flag: prohibir la palabra haría rojo un texto correcto');
});

test('SCRUM-233 · un marcador evidente NO dispara', () => {
  for (const c of ['prisma migrate diff --from-url <url>', '--to-url […]', '--from-url {{URL}}']) {
    assert.deepEqual(infraccionesEnProsa(c), [], `🔴 marcador tratado como URL real: ${c}`);
  }
});

test('SCRUM-233 · la forma SEGURA no dispara', () => {
  assert.deepEqual(
    infraccionesEnProsa('prisma migrate diff --from-schema-datasource prisma/schema.prisma --script'),
    [],
    '🔴 marca la forma segura: sería ruido, no protección',
  );
});

// ── 4 · EL MECANISMO DE EXCLUSIÓN es por RUTA, y está vacío ───────────────────────────────
test('SCRUM-233 · las exclusiones son por RUTA y la lista está vacía', () => {
  assert.ok(Array.isArray(RUTAS_EXCLUIDAS), 'debe existir el mecanismo de exclusión por ruta');
  assert.deepEqual(
    RUTAS_EXCLUIDAS, [],
    '🔴 la lista de exclusiones ha dejado de estar vacía. Cada entrada necesita su ticket y su ' +
      'motivo al lado — y ojo: una allowlist que nace poblada enseña a poblarla (SCRUM-211). ' +
      'Ningún documento necesita enseñar la forma insegura: `--from-schema-datasource` hace lo ' +
      'mismo sin exponer la credencial.',
  );
});

// ── 5 · EL GUARD ─────────────────────────────────────────────────────────────────────────
test('SCRUM-233 · ningún .md enseña a pasar una URL de BD por --from-url/--to-url', () => {
  const hallazgos = escanear();
  assert.deepEqual(
    hallazgos.map((h) => `${h.ruta}:${h.linea} [${h.flag} ${h.token}]`),
    [],
    '🔴 UN DOCUMENTO ENSEÑA A PONER LA CREDENCIAL EN EL COMANDO:\n' +
      hallazgos.map((h) => `    ${h.ruta}:${h.linea}\n      ${h.texto}`).join('\n') +
      '\n\n  Un runbook es un comando que TECLEA UN HUMANO, y la forma que enseña se copia. Las dos\n' +
      '  fugas de credenciales de esta semana salieron de comandos ad-hoc, no de ficheros — y el\n' +
      '  motivo de fondo de SCRUM-226 era «sesiones copiando formas».\n\n' +
      '  Forma segura, la que ya usa el repo:\n' +
      '    prisma migrate diff --from-schema-datasource prisma/schema.prisma …\n' +
      '  La conexión viaja por el ENTORNO (`DATABASE_URL`), no en el comando — así no queda en el\n' +
      '  historial de la shell ni en el argv que ve `ps`.\n\n' +
      '  ⚠️ ALCANCE: esto mira DOCUMENTOS. Un comando tecleado en una shell y no escrito en ningún\n' +
      '  fichero sigue con cobertura CERO, igual que declara SCRUM-226. Verde aquí reduce el vector\n' +
      '  «lo copié del runbook», no el vector «me lo inventé sobre la marcha».',
  );
});
