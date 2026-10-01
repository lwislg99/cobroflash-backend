// tests/_censo-fixture.mjs — SCRUM-388
//
// UN REPOSITORIO SINTÉTICO PARA PROBAR EL CENSO, congelado y sin relación con `main`.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// POR QUÉ NO SE PRUEBA CONTRA `main` DIRECTAMENTE
//
// La primera versión del banco fijaba los veredictos de cuatro tickets REALES (298, 293, 294,
// 354). Funcionaba, y estaba mal por un motivo que es regla de la casa:
//
// > **Un test que fija el estado actual convierte un defecto en un requisito.**
//
// El test de A9 decía «SCRUM-354 → NADA». El día que alguien CONSTRUYA A9 —haciendo el trabajo
// bien— ese test se pondría rojo, y el siguiente que lo mire tiene delante un test que le exige
// que A9 siga sin construirse. Ya nos pasó con el test que falló cuando el import se ARREGLÓ.
//
// Aquí los cuatro casos se REPRODUCEN con commits, entradas y ramas fabricadas. Prueban que el
// censo sabe CLASIFICAR, que es lo que hay que sostener, y no pueden caer porque el mundo cambie.
//
// Los números van en el rango 9000+ para que no puedan colisionar nunca con un ticket de verdad.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { temporal } from './_temporal.mjs';

// ═════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-1281 · EL INTERMITENTE DEL CHECK OBLIGATORIO
//
// 4 rojos de `build + tests` desde el 24-sep con la misma firma: git se queda sin un fichero bajo
// `.git/objects` A MITAD de una operación, siempre en esta familia (`repoFixture`, el clon de
// `scrum775` y el de `_fixture-alcanzabilidad`). Aislada no cae nunca (J6: 0 de 600, dos brazos);
// dentro de la tanda (todos los ficheros de test en paralelo) cae ~0,3 % de los montajes. Causa sin nombrar.
//
// Dos pasos baratos, antes que un vigía con inotify (decisión del orquestador):
//  (b) La familia deja de compartir sitio: en CI vive bajo `$RUNNER_TEMP`, no en `/tmp` con todo lo
//      demás. Si la causa es algo que actúa sobre `/tmp`, el contador de (a) baja a cero.
//  (a) Cuando una operación de la familia cae con la firma, se imprime `FIRMA_1281` en una línea
//      propia. Así «¿era el intermitente?» es un DATO que el CI puede leer (la detección es de S5),
//      no un juicio sobre un log. SIN reintento: un reintento a secas esconde el problema.
// ═════════════════════════════════════════════════════════════════════════════════════════

/** Marcador fijo, una línea, para que el CI lo busque tal cual. No cambiarlo sin avisar a S5. */
export const FIRMA_1281 = '[SCRUM-1281-FIRMA]';

/** Los textos con que git ha caído en los casos medidos (y el del control, que es el mismo). */
const FIRMA_GIT = /(failed to copy file to .*[\\/]\.git[\\/]objects[\\/].*No such file or directory|unable to create temporary file: No such file or directory|failed to write commit object)/;

/** ¿Este error de git es el del intermitente? */
export function esFirma1281(texto) {
  return FIRMA_GIT.test(String(texto || ''));
}

/** Raíz propia de las fixtures de git: fuera de la `/tmp` compartida cuando corre en CI. */
export function raizDeFixturesGit(entorno = process.env) {
  if (entorno.YAQU_RAIZ_FIXTURES_GIT) return entorno.YAQU_RAIZ_FIXTURES_GIT;
  if (entorno.RUNNER_TEMP) return path.join(entorno.RUNNER_TEMP, 'yaqu-fixtures-git');
  return path.join(os.tmpdir(), 'yaqu-fixtures-git');
}

/** Un directorio temporal de la familia, en su raíz propia. */
export function temporalDeFixtureGit(prefijo) {
  return temporal(prefijo, { dentroDe: raizDeFixturesGit() });
}

/**
 * `git` para la familia de 1281. Igual que `execFileSync('git', …)`, salvo que si cae con la firma
 * lo DICE en una línea propia de stderr (y en el mensaje del error, que es lo que imprime el runner).
 */
export function gitDeFixture(args, opciones = {}) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opciones });
  } catch (e) {
    const salida = `${e.stderr || ''}\n${e.message || ''}`;
    if (esFirma1281(salida)) {
      const sub = args.find((a, i) => !a.startsWith('-') && args[i - 1] !== '-c') || args[0];
      const linea = `${FIRMA_1281} git ${sub} perdió un fichero bajo .git/objects (cwd ${opciones.cwd || process.cwd()}): ${[...new Set(salida.split('\n').map((l) => l.trim()).filter((l) => esFirma1281(l)))].join(' | ')}`.trim();
      process.stderr.write(`\n${linea}\n`);
      e.message = `${linea}\n${e.message}`;
    }
    throw e;
  }
}

/** Los cuatro casos del banco, reproducidos. Cada uno declara qué imita y qué debe dar. */
export const CASOS = [
  {
    n: 9001, espera: 'ENTERO',
    imita: 'SCRUM-298: entregado y conectado, con commit, entrada de máster y rama',
    doc: '# SCRUM-9001\n\n> ENTREGA PARCIAL Y DECLARADA, por decisión del fundador.\n\nSe construye la visibilidad y está en uso.\n',
    asunto: 'feat(x): la cosa visible (SCRUM-9001)',
    rama: 'scrum-9001-la-cosa',
  },
  {
    n: 9002, espera: 'PARCIAL',
    imita: 'SCRUM-293: dominio con tests y SIN LLAMADORES, esperando campos de schema',
    doc: '# SCRUM-9002\n\nSe entrega el cálculo, aislado y probado, sin llamadores — un hueco estructurado.\n',
    asunto: 'feat(x): el calculo aislado (SCRUM-9002)',
    rama: null,
  },
  {
    n: 9003, espera: 'PARCIAL',
    imita: 'SCRUM-294: igual que el anterior, pero con la frase PARTIDA entre líneas de blockquote',
    // 🔴 EL CASO QUE CASI SE ESCAPA, congelado aquí para siempre. En `SCRUM-294.md` real la frase
    // cruza dos líneas de blockquote: colapsar espacios sin quitar el «>» deja «sin > llamadores»
    // y el censo daba ENTERO a una entrega que se declara incompleta.
    doc: '# SCRUM-9003\n\n> ENTREGA PARCIAL: se entrega el cálculo, aislado, probado y sin\n> llamadores. Enchufarlo toca lo que se sella.\n',
    asunto: 'feat(x): recargo calculado aparte (SCRUM-9003)',
    rama: null,
  },
  {
    n: 9004, espera: 'NADA',
    imita: 'SCRUM-354: nada construido — y un mecanismo PARECIDO en el repo que no es suyo',
    doc: null,
    asunto: null,
    rama: null,
  },
];

/**
 * Trampas que el censo NO puede morder. Van en el mismo repo sintético a propósito: si estuvieran
 * aparte, el banco probaría un mundo más limpio que el real.
 */
export const TRAMPAS = [
  // El parecido: un mecanismo entero, con su commit y su entrada, que NO es del 9004. Es A15/MANT-1
  // frente a A9 — comparten el modelo y no el objeto.
  { tipo: 'mecanismo parecido', asunto: 'feat(mant): ciclo de planes con cron y anti-spam (SCRUM-9100)' },
  // La referencia cruzada: un commit de OTRO ticket que menciona al 9004 en su cuerpo.
  { tipo: 'referencia cruzada', asunto: 'docs(master): SCRUM-9100 — notas', cuerpo: 'Relacionado con SCRUM-9004, que sigue sin empezar.' },
];

/** Ramas ajenas cuyo nombre CONTIENE un número que no es el suyo (`-rebasada-2`, `-v2`). */
export const RAMAS_TRAMPA = ['scrum-9100-algo-rebasada-2', 'codeowners-zona-roja-v2', 'scrum-90011-otro'];

let cache = null;

/** Crea (una vez) el repo sintético y devuelve su ruta. */
export function repoFixture() {
  if (cache && fs.existsSync(cache)) return cache;
  const raiz = temporalDeFixtureGit('censo-fixture-');
  const g = (...args) => gitDeFixture(args, { cwd: raiz });

  g('init', '-q', '-b', 'main');
  g('config', 'user.email', 'fixture@yaqu.test');
  g('config', 'user.name', 'Fixture');
  g('config', 'commit.gpgsign', 'false');
  // ⚠️ El remoto con refspec COMODÍN, y no es decorado: `capacidadDeMedir` lo usa para saber si
  // este clon puede ver TODAS las ramas o solo una (SCRUM-388, el fallo de CI). Sin él, el propio
  // fixture se declararía incapaz de mirar ramas — y tendría razón. Un repositorio sintético que
  // no reproduce la configuración del real prueba un mundo más fácil que el que hay.
  g('remote', 'add', 'origin', raiz);
  g('config', 'remote.origin.fetch', '+refs/heads/*:refs/remotes/origin/*');
  fs.mkdirSync(path.join(raiz, 'docs', 'master'), { recursive: true });

  // Relleno: el suelo del censo exige un historial y una carpeta de máster con fondo. Sin esto el
  // fixture haría saltar el propio suelo que este banco necesita en verde para medir otra cosa.
  for (let i = 0; i < 25; i++) {
    fs.writeFileSync(path.join(raiz, 'docs', 'master', `SCRUM-${8000 + i}.md`), `# SCRUM-${8000 + i}\n\nrelleno\n`);
  }
  fs.writeFileSync(path.join(raiz, 'LEEME.md'), 'fixture\n');
  g('add', '-A'); g('commit', '-q', '-m', 'chore: relleno del fixture');
  for (let i = 0; i < 105; i++) {
    fs.writeFileSync(path.join(raiz, 'LEEME.md'), `fixture ${i}\n`);
    g('add', '-A'); g('commit', '-q', '-m', `chore: relleno ${i}`);
  }

  for (const c of CASOS) {
    if (c.doc) fs.writeFileSync(path.join(raiz, 'docs', 'master', `SCRUM-${c.n}.md`), c.doc);
    if (c.asunto) {
      fs.writeFileSync(path.join(raiz, `f${c.n}.txt`), 'x');
      g('add', '-A'); g('commit', '-q', '-m', c.asunto);
    }
  }
  for (const t of TRAMPAS) {
    fs.writeFileSync(path.join(raiz, `t${Math.random().toString(36).slice(2, 7)}.txt`), 'x');
    g('add', '-A');
    g('commit', '-q', '-m', t.asunto, ...(t.cuerpo ? ['-m', t.cuerpo] : []));
  }

  // Las ramas se crean como `refs/remotes/origin/...` porque es de donde el censo las lee.
  const ramas = [...CASOS.filter((c) => c.rama).map((c) => c.rama), ...RAMAS_TRAMPA];
  const sha = g('rev-parse', 'HEAD').trim();
  for (const r of ramas) g('update-ref', `refs/remotes/origin/${r}`, sha);
  g('update-ref', 'refs/remotes/origin/main', sha);

  cache = raiz;
  return raiz;
}
