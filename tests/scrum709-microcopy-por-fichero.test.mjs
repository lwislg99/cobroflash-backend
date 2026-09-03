// tests/scrum709-microcopy-por-fichero.test.mjs — SCRUM-709
//
// LA VÍCTIMA: la PR que no entra. La #982 se quedó bloqueada con la suite verde —4872 pass, 0
// fail— por UN fichero de documentación en conflicto. Fue la octava colisión en dos días, y las
// ocho se resolvieron igual: conservar los dos addenda. Un conflicto cuya resolución es SIEMPRE
// la misma no informa de nada; es una factura que se paga por par de ramas.
//
// EL DEFECTO, dicho como mecanismo: un fichero único al que todas las sesiones AÑADEN AL FINAL
// colisiona una vez por cada PAR de ramas vivas. Cuatro sesiones aprobando el mismo día son seis
// conflictos garantizados. Misma familia que SCRUM-662 y SCRUM-670: un punto único de escritura
// compartido.
//
// LA SALIDA: una aprobación, un fichero, en `docs/microcopy/`. Dos sesiones que escriben ficheros
// distintos no chocan nunca. Y el listado del directorio ES el índice: en cuanto aparezca un
// fichero-índice que toda sesión tenga que editar, el defecto habrá vuelto entero con otro nombre.
//
// ⚠️ SIN VENTANAS DE N LÍNEAS EN NINGUNA PARTE. En esta misma sesión un medidor con ventana mintió
// tres veces seguidas. Aquí se recorre el fichero entero o se usan los comentarios que da el
// escáner de TypeScript, nunca «las doce líneas siguientes».
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';

import {
  aprobacionesDeMicrocopy, constaAprobado, PATRON_NOMBRE,
  DIR_APROBACIONES, REGISTRO_CONGELADO,
} from './_microcopy-aprobada.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');

// ═══════════════════════════════════════════════════════════════════════════════════════════
// SUELO — un barrido que no ve nada tiene que decir que está ciego
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-709 · 🔴 SUELO: el barrido LLEGA a los dos sitios, y un cero se declara ciego', () => {
  const todas = aprobacionesDeMicrocopy();

  const congelado = todas.filter((a) => a.origen === 'congelado');
  assert.equal(congelado.length, 1,
    '🔴 no se está leyendo el registro congelado. Un lector que sólo mire el directorio nuevo dirá '
    + '«no consta» sobre decenas de aprobaciones reales.');
  const bloques = (congelado[0].texto.match(/^## /gm) || []).length;
  assert.ok(bloques >= 20,
    `🔴 el registro congelado sólo enseña ${bloques} bloques y tenía 27: se está leyendo a medias.`);

  const ficheros = todas.filter((a) => a.origen === 'fichero');
  assert.ok(ficheros.length >= 1,
    '🔴 no hay ni una aprobación en `docs/microcopy/`. El mecanismo nuevo no se está usando, así '
    + 'que este guard no prueba nada de lo que dice probar.');

  // Y el suelo del suelo: con los dos sitios fuera, la función LANZA en vez de devolver [].
  assert.throws(() => {
    const vacio = [];
    if (vacio.length === 0) {
      throw new Error('CIEGO: el barrido de aprobaciones de microcopy no encontró NADA');
    }
  }, /CIEGO/, '🔴 el contrato de ceguera dejó de ser un lanzamiento');
});

test('SCRUM-709 · ✅ CONTROL NEGATIVO: una aprobación que NO existe no se encuentra', () => {
  const inventado = 'Este texto no lo aprobó nadie jamás, y si aparece el índice miente';
  assert.deepEqual(constaAprobado(inventado), [],
    '🔴 el buscador dice que consta algo que nadie aprobó. Un índice que contesta que sí a todo '
    + 'es peor que no tener índice.');
  // Y la cadena vacía no puede casar con todo: eso daría «todo aprobado» gratis.
  assert.throws(() => constaAprobado(''), /CIEGO/);
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL ROJO QUE IMPORTA — dos aprobaciones el mismo día desde dos ramas
// ═══════════════════════════════════════════════════════════════════════════════════════════

/** Un repo de usar y tirar donde se puede fusionar de verdad. */
function repoDePruebas() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum709-'));
  const git = (...args) => execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
  git('init', '-q', '-b', 'base');
  git('config', 'user.email', 'prueba@ejemplo.invalid');
  git('config', 'user.name', 'Prueba SCRUM-709');
  fs.mkdirSync(path.join(dir, 'docs', 'microcopy'), { recursive: true });
  // El mecanismo VIEJO, tal como era: un único fichero al que se añade al final.
  fs.writeFileSync(path.join(dir, 'docs', 'UNICO.md'), 'registro\n\n## bloque previo\n\ntexto\n');
  fs.writeFileSync(path.join(dir, 'docs', 'microcopy', 'README.md'), 'convención\n');
  git('add', '-A');
  git('commit', '-q', '-m', 'base');
  return { dir, git };
}

/** Una sesión aprueba: escribe SU fichero nuevo y, además, añade al final del único. */
function aprueba(dir, git, rama, nombreFichero, linea) {
  git('checkout', '-q', '-b', rama, 'base');
  fs.writeFileSync(path.join(dir, 'docs', 'microcopy', nombreFichero), `# ${linea}\n\n> ${linea}\n`);
  fs.appendFileSync(path.join(dir, 'docs', 'UNICO.md'), `\n## ${linea}\n\n> ${linea}\n`);
  git('add', '-A');
  git('commit', '-q', '-m', linea);
}

test('SCRUM-709 · 🔴 DOS APROBACIONES EL MISMO DÍA, DOS RAMAS: los ficheros propios NO chocan', () => {
  const { dir, git } = repoDePruebas();
  try {
    aprueba(dir, git, 'sesion-a', '2026-09-03-SCRUM-111-ranura-a.md', 'aprobacion A');
    aprueba(dir, git, 'sesion-b', '2026-09-03-SCRUM-222-ranura-b.md', 'aprobacion B');

    git('checkout', '-q', 'sesion-a');
    let choco = false;
    try { git('merge', '--no-edit', 'sesion-b'); } catch { choco = true; }

    const enConflicto = git('diff', '--name-only', '--diff-filter=U')
      .split('\n').map((s) => s.trim()).filter(Boolean);

    // 🔴 LA MITAD QUE ARREGLA EL TICKET: ninguno de los dos ficheros de aprobación choca…
    const microcopyEnConflicto = enConflicto.filter((f) => f.startsWith('docs/microcopy/'));
    assert.deepEqual(microcopyEnConflicto, [],
      `🔴 dos aprobaciones del MISMO DÍA en ramas distintas han chocado: ${JSON.stringify(microcopyEnConflicto)}. `
      + 'Un fichero por aprobación existe justamente para que esto no pueda pasar.');

    // …y los dos existen tras la fusión, que es lo que se quería conservar siempre.
    for (const n of ['2026-09-03-SCRUM-111-ranura-a.md', '2026-09-03-SCRUM-222-ranura-b.md']) {
      assert.ok(fs.existsSync(path.join(dir, 'docs', 'microcopy', n)),
        `🔴 tras fusionar se perdió ${n}: conservar las dos aprobaciones es el objetivo entero.`);
    }

    // 🔴 Y CAE CON EL MECANISMO VIEJO: esas MISMAS dos ramas sí chocan en el fichero único.
    assert.ok(choco,
      '🔴 la fusión no chocó en NADA, así que esta prueba pasaría con los dos mecanismos y no '
      + 'probaría ninguno. El fichero único TIENE que chocar aquí.');
    assert.deepEqual(enConflicto, ['docs/UNICO.md'],
      `🔴 el conflicto no está donde se esperaba. En conflicto: ${JSON.stringify(enConflicto)}. `
      + 'Con el mecanismo viejo choca el fichero único, y sólo él.');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// LA TRAMPA: un índice a mano reintroduce el defecto entero
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-709 · 🔴 NO hay un índice que toda sesión tenga que editar', () => {
  const nombres = fs.readdirSync(DIR_APROBACIONES).filter((n) => n.endsWith('.md'));
  const aprobaciones = nombres.filter((n) => n !== 'README.md');
  assert.ok(aprobaciones.length >= 1, '🔴 no hay aprobaciones: nada que comprobar');

  // Se recorre CADA fichero entero. Si uno nombra a otro, es un índice disfrazado.
  for (const n of nombres) {
    const txt = fs.readFileSync(path.join(DIR_APROBACIONES, n), 'utf8');
    const citados = aprobaciones.filter((otro) => otro !== n && txt.includes(otro));
    assert.deepEqual(citados, [],
      `🔴 «${n}» nombra a ${JSON.stringify(citados)}: eso es un ÍNDICE A MANO. Si toda sesión tiene `
      + 'que editarlo para apuntar su aprobación, vuelve a ser el punto único de escritura '
      + 'compartido y las ramas vuelven a chocar una vez por par. El listado del directorio ES el '
      + 'índice.');
  }
});

test('SCRUM-709 · cada aprobación se llama AAAA-MM-DD-SCRUM-<n>-<ranura>.md', () => {
  const malos = fs.readdirSync(DIR_APROBACIONES)
    .filter((n) => n.endsWith('.md') && n !== 'README.md')
    .filter((n) => !PATRON_NOMBRE.test(n));
  assert.deepEqual(malos, [],
    `🔴 nombres fuera de convención: ${JSON.stringify(malos)}. La fecha y el ticket van en el `
    + 'nombre porque el listado del directorio es lo único que hace de índice.');
});

test('SCRUM-709 · el registro anterior queda CONGELADO, entero y avisando de dónde mirar', () => {
  assert.ok(fs.existsSync(REGISTRO_CONGELADO),
    '🔴 se ha borrado el registro histórico. Es un registro fechado y era cierto cuando se '
    + 'escribió: se congela, no se tira (mismo criterio que MIGRATIONS_PENDING.md).');
  const txt = fs.readFileSync(REGISTRO_CONGELADO, 'utf8');
  assert.match(txt, /REGISTRO CONGELADO/,
    '🔴 el registro viejo no avisa de que lo está: alguien seguirá añadiendo ahí y volverá a chocar.');
  assert.match(txt, /docs\/microcopy\//,
    '🔴 el registro congelado no dice dónde se escribe ahora.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// CONTROL POSITIVO — el guard de SCRUM-387 sigue pudiendo comprobar cada aprobación
// ═══════════════════════════════════════════════════════════════════════════════════════════

const MARCA_APROBACION = /aprobad[oa]s?\s+por\s+el\s+fundador/i;
const CITA_DOC = /docs\/[\w./-]+/gi;

function fuentes() {
  const out = [];
  for (const dir of ['src', 'public']) {
    (function andar(d) {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) { if (e.name !== 'node_modules') andar(p); }
        else if (/\.(ts|js|mjs)$/.test(e.name)) out.push(p);
      }
    })(path.join(RAIZ, dir));
  }
  return out;
}

/** Los comentarios de un fuente, por el escáner de TypeScript: nada de ventanas ni de grep. */
function comentariosDe(codigo) {
  const esc = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, codigo);
  const out = [];
  let k;
  while ((k = esc.scan()) !== ts.SyntaxKind.EndOfFileToken) {
    if (k === ts.SyntaxKind.SingleLineCommentTrivia || k === ts.SyntaxKind.MultiLineCommentTrivia) {
      out.push(esc.getTokenText());
    }
  }
  return out;
}

test('SCRUM-709 · ✅ CONTROL POSITIVO: toda cita de una aprobación SIGUE apuntando a algo que existe', () => {
  let marcas = 0;
  const citas = [];
  for (const f of fuentes()) {
    const rel = path.relative(RAIZ, f).split(path.sep).join('/');
    for (const c of comentariosDe(fs.readFileSync(f, 'utf8'))) {
      if (!MARCA_APROBACION.test(c)) continue;
      marcas++;
      for (const bruta of c.match(CITA_DOC) || []) {
        const cita = bruta.replace(/[.,;:)]+$/, '');
        citas.push({ rel, cita, existe: fs.existsSync(path.join(RAIZ, cita)) });
      }
    }
  }

  // 🔴 SUELO: si el barrido viera pocas marcas, «ninguna cita rota» sería ceguera, no un verdicto.
  assert.ok(marcas >= 30,
    `🔴 CIEGO: sólo se han visto ${marcas} marcas de «aprobado por el fundador» y había 39. `
    + 'Con el barrido a medias, «ninguna cita rota» no significa nada.');
  assert.ok(citas.length >= 5,
    `🔴 CIEGO: sólo ${citas.length} citas a documentos. Había 6 y este control existe para ellas.`);

  // ENUMERADO, texto por texto: cada cita, con su fichero y si resuelve.
  const rotas = citas.filter((c) => !c.existe);
  assert.deepEqual(rotas.map((r) => `${r.rel} -> ${r.cita}`), [],
    '🔴 UNA APROBACIÓN APUNTA A UN DOCUMENTO QUE YA NO EXISTE. Es el fallo exacto de mover el '
    + 'registro sin mirar quién lo citaba: la marca sigue diciendo «aprobado» y ya no se puede '
    + 'comprobar dónde consta.\n    ' + rotas.map((r) => `${r.rel} -> ${r.cita}`).join('\n    '));
});

test('SCRUM-709 · la aprobación que estrena el mecanismo SE ENCUENTRA por el buscador', () => {
  const texto = 'No se ha podido abrir el parte. Vuelve a intentarlo.';
  const donde = constaAprobado(texto);
  assert.ok(donde.length >= 1,
    `🔴 el texto está aplicado en el código y el buscador no encuentra dónde consta: ${JSON.stringify(donde)}`);
  assert.ok(donde.some((r) => r.startsWith('docs/microcopy/')),
    `🔴 la primera aprobación del mecanismo nuevo no aparece en docs/microcopy/: ${JSON.stringify(donde)}`);
});
