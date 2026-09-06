// tests/_fixture-alcanzabilidad.mjs — SCRUM-753
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// UN REPOSITORIO SINTÉTICO CON LOS CASOS DE ALCANZABILIDAD, congelado y sin relación con `main`.
//
// 🔴 POR QUÉ NO SE PRUEBA CONTRA `main`: un test que fija el estado actual convierte un defecto en
// un requisito. Si aquí escribiera «SCRUM-161 → FUERA», el día que alguien MERGEE 161 —haciendo
// el trabajo bien— este fichero se pondría rojo exigiendo que 161 siga sin mergearse. Es la regla
// que ya estaba escrita en `tests/_censo-fixture.mjs`, y aquí aplica igual.
//
// ── SE DERIVA, NO SE DUPLICA ─────────────────────────────────────────────────────────────────
// La base es `repoFixture()` de `tests/_censo-fixture.mjs` (SCRUM-388): 106 commits de historia,
// 25+ entradas de máster y el refspec comodín. Todo eso lo necesita el SUELO de este censo, y
// reescribir el `git init` aquí sería la segunda copia de una configuración que ya costó un fallo
// de CI afinar.
//
// Se CLONA en vez de usarse directamente, y por un motivo medido, no por prudencia: `repoFixture()`
// cachea su ruta por proceso y la comparten los tests de SCRUM-388 y SCRUM-738. Añadirle refs
// haría que el censo de aquellos viera ramas que no esperan. El clon aísla las mutaciones y
// conserva la base.
//
// ── LOS CASOS, Y QUÉ IMITA CADA UNO ──────────────────────────────────────────────────────────
// Los números van en el rango 9500+ para que no puedan colisionar nunca con un ticket de verdad
// (ni con los 9000+ del fixture del que se deriva).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { repoFixture } from './_censo-fixture.mjs';

/**
 * Cada caso declara QUÉ imita y QUÉ tiene que dar. La expectativa vive con el caso: un banco cuyo
 * resultado esperado está en otro fichero se desincroniza sin que nadie lo note.
 */
export const CASOS = [
  {
    n: 9501, espera: 'DENTRO', motivo: null,
    imita: 'trabajo mergeado: su rama es ancestro del sha medido y un merge la nombra',
  },
  {
    n: 9502, espera: 'FUERA', motivo: null,
    imita: 'trabajo vivo: la rama tiene commits que NO están en main',
  },
  {
    n: 9503, espera: 'NO_MEDIBLE', motivo: 'sin rama',
    imita: 'entrada de máster y NINGUNA rama — la rama pudo mergearse Y BORRARSE',
  },
  {
    n: 9504, espera: 'NO_MEDIBLE', motivo: 'sin rama ni entrada',
    imita: '🔴 EL HALLAZGO: sin rama y sin entrada NO ESTÁ EN LA POBLACIÓN. Es lo asignable',
  },
  {
    n: 9505, espera: 'NO_MEDIBLE', motivo: 'número compartido',
    imita: 'su entrada existe pero su primer título dice OTRO ticket (SCRUM-388)',
  },
  {
    n: 9506, espera: 'DENTRO', motivo: null, sinCorroborar: true,
    imita: '🔴 EL PUNTO CIEGO: rama PARADA sobre un commit viejo — ancestro TRIVIALMENTE, sin '
      + 'aportar nada. Sale DENTRO porque es lo que git contesta, y la fila lo marca',
  },
  {
    n: 9507, espera: 'NO_MEDIBLE', motivo: 'rama sin objeto en local',
    imita: 'rama cuyo objeto NO existe: git no puede contestar. «No lo sé» no es «no».',
  },
];

let cache = null;

/**
 * Crea (una vez) el repositorio de alcanzabilidad y devuelve su ruta.
 *
 * `origin/main` aquí es una ref real dentro del clon, así que el censo puede congelarla igual que
 * en el árbol de verdad. `traer: false` al llamarlo: el `fetch` de este remoto no aportaría nada
 * y la instantánea ya sabe decir que no ha traído.
 */
export function repoAlcanzabilidad() {
  if (cache && fs.existsSync(cache)) return cache;
  const base = repoFixture();
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'alcanzabilidad-'));
  fs.rmSync(raiz, { recursive: true, force: true });

  const gEn = (cwd) => (...args) =>
    execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  execFileSync('git', ['clone', '--quiet', base, raiz], { stdio: ['ignore', 'pipe', 'pipe'] });
  const g = gEn(raiz);
  g('config', 'user.email', 'fixture@yaqu.test');
  g('config', 'user.name', 'Fixture');
  g('config', 'commit.gpgsign', 'false');
  // El refspec comodín: sin él el propio suelo declararía —con razón— que este clon no puede ver
  // todas las ramas. Un fixture que no reproduce la configuración del real prueba un mundo fácil.
  g('config', 'remote.origin.fetch', '+refs/heads/*:refs/remotes/origin/*');

  const commit = (mensaje) => {
    fs.writeFileSync(path.join(raiz, `f${Math.random().toString(36).slice(2, 9)}.txt`), 'x');
    g('add', '-A');
    g('commit', '-q', '-m', mensaje);
    return g('rev-parse', 'HEAD').trim();
  };
  const escribirEntrada = (n, contenido) =>
    fs.writeFileSync(path.join(raiz, 'docs', 'master', `SCRUM-${n}.md`), contenido);

  // 🔴 EL COMMIT VIEJO se guarda ANTES de nada: es la punta de la rama parada del 9506, y tiene
  // que ser anterior a todo lo demás para que su ancestría sea trivial de verdad.
  const viejo = g('rev-parse', 'HEAD').trim();

  /**
   * Fabrica una rama con un commit propio y la mergea con `--no-ff` y el asunto de la casa, para
   * que el merge caiga en la CADENA FIRST-PARENT nombrando la rama. Devuelve la punta de la rama.
   *
   * Sin `--no-ff` git haría fast-forward y no habría commit de merge que nombrara nada: la señal
   * de corroboración que este banco tiene que ejercitar desaparecería sin dar error.
   */
  const mergearNombrando = (rama, asuntoDelCommit, pr) => {
    const desde = g('rev-parse', 'HEAD').trim();
    g('checkout', '-q', '-b', `tmp-${rama}`, desde);
    const punta = commit(asuntoDelCommit);
    g('checkout', '-q', 'main');
    g('merge', '--no-ff', '-q', '-m', `Merge pull request #${pr} from lwislg99/${rama}`, `tmp-${rama}`);
    g('branch', '-D', `tmp-${rama}`);
    return punta;
  };

  // ── 9501 · mergeado: commit propio + merge que nombra su rama ────────────────────────────────
  escribirEntrada(9501, '# SCRUM-9501\n\nEntregado.\n');
  commit('docs(master): entrada del 9501 (SCRUM-9501)');
  const punta9501 = mergearNombrando('scrum-9501-lo-mergeado', 'feat(x): lo del 9501 (SCRUM-9501)', 1);

  // ── 9503 · entrada de máster, y NINGUNA rama (mergeada y borrada, o nunca ramificada) ────────
  escribirEntrada(9503, '# SCRUM-9503\n\nEntregado y la rama se borró.\n');
  commit('docs(master): entrada del 9503 (SCRUM-9503)');
  mergearNombrando('scrum-9503-rama-borrada', 'feat(x): lo del 9503 (SCRUM-9503)', 3);

  // ── 9505 · NÚMERO COMPARTIDO: el fichero se llama 9505 y su título dice 9599 ─────────────────
  escribirEntrada(9505, '# SCRUM-9599\n\n> Dos sesiones se inventaron el mismo número.\n');
  commit('docs(master): entrada con el numero cruzado (SCRUM-9505)');

  const puntaMain = g('rev-parse', 'HEAD').trim();
  g('update-ref', 'refs/remotes/origin/main', puntaMain);
  g('update-ref', 'refs/remotes/origin/scrum-9501-lo-mergeado', punta9501);
  g('update-ref', 'refs/remotes/origin/scrum-9505-numero-cruzado', puntaMain);

  // ── 9502 · FUERA: dos commits que NO están en main ───────────────────────────────────────────
  escribirEntrada(9502, '# SCRUM-9502\n\nEn curso.\n');
  g('checkout', '-q', '-b', 'viva9502', puntaMain);
  commit('feat(x): primero del 9502 (SCRUM-9502)');
  const punta9502 = commit('feat(x): segundo del 9502 (SCRUM-9502)');
  g('checkout', '-q', 'main');
  g('branch', '-D', 'viva9502');
  g('update-ref', 'refs/remotes/origin/scrum-9502-viva', punta9502);

  // ── 9506 · 🔴 LA RAMA PARADA: apunta a un commit VIEJO de main. Ancestro trivialmente ────────
  // No hay ni entrada ni commit que la nombre, así que su corroboración es 0 y la fila tiene que
  // marcar `sinCorroborar`. Es el falso «DENTRO» que la alcanzabilidad sola no sabe distinguir.
  g('update-ref', 'refs/remotes/origin/scrum-9506-parada', viejo);

  // ── 9507 · 🔴 LA REF ROTA: apunta a un objeto que NO existe ──────────────────────────────────
  // Se escribe el fichero de ref a mano porque `git update-ref` se niega —con razón— a apuntar a
  // un objeto ausente. Es la única forma de PROVOCAR el tercer valor: una garantía sobre un caso
  // que no se ha provocado es una predicción.
  const dirRef = path.join(raiz, '.git', 'refs', 'remotes', 'origin');
  fs.mkdirSync(dirRef, { recursive: true });
  fs.writeFileSync(path.join(dirRef, 'scrum-9507-fantasma'),
    'dead0000dead0000dead0000dead0000dead0000\n');

  // ── 9504 · no se crea NADA. Ésa es la prueba: no está en la población ────────────────────────

  cache = raiz;
  return raiz;
}
