// scripts/vigia-pasada.mjs — la pasada del vigía, fuera del YAML.
//
// POR QUÉ NO VIVE DENTRO DEL WORKFLOW: la primera versión metía cuatro bloques de JavaScript
// entre comillas dentro de un `run:` de YAML. Eso ya me costó un fallo en esta misma tanda
// —una bandera de node colocada donde no era bandera— y habría costado más: comillas, saltos
// de línea y `$` que el shell expande antes de que node los vea. Aquí se puede LEER y se
// puede EJECUTAR en la tanda, que es la diferencia entre un guard y una intención.
//
// ENTRADA (las produce el workflow con `gh`, porque `gh` no existe dentro de node):
//   · prs.json          salida de `gh pr list --json …`
//   · estados.txt       una línea por PR:
//                       `numero|mergeStateStatus|nº de check-runs|minutos desde el push|sonda`
//   · checks/<N>.json   el payload de check-runs del head de cada PR (SCRUM-839b)
//   · reglas.json       `GET /repos/…/rules/branches/main` — de ahí salen los obligatorios
//   · $ANTES            la memoria de la pasada anterior, leída del cuerpo del issue
//   · $DUENO            a quién se menciona en el aviso (el dueño del repositorio), y sólo cuando
//                       toca: `main` parado o un PR que cruza 72 h (SCRUM-1458)
//   · `origin/main`     (SCRUM-1458) la fecha de su último commit, leída con `git log`. El
//                       workflow ya lo trae con historia; si no se deja leer, la pasada lo DICE
//
// SALIDA:
//   · cuerpo.md       el cuerpo del issue, ya comprobado contra la mención
//   · aviso.md        SOLO si la lista empeora: el comentario, también comprobado
//   · veredicto.json  { empeora, nuevos, cambiados, envejecidos, atascados } — `main` parado
//                     viaja en `nuevos` y `envejecidos` con el número 0; `atascados` cuenta sólo PR
//   · avisos-pr.json  SCRUM-1270: [{ numero, marca, cuerpo }] de los PR mudos ≥3 h, comprobados
//   · exit 0 normal · exit 1 si el suelo no reconoce su cebo o si un texto a publicar
//     despertaría a alguien. Las dos son «esta pasada no vale», no «no hay atascados».
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import {
  esAsuntoDelVigia, causaDelAtasco, haEmpeorado, sueloDeLaPasada, horasDesde,
  checksObligatoriosDeReglas, umbralDeEdad, UMBRALES_HORAS, avisoEnElPR, UMBRAL_AVISO_EN_PR_HORAS,
  filaDeMain, llevaMencion, NUMERO_DE_MAIN, MARCA_DE_MAIN_PARADO, UMBRAL_MAIN_PARADO_HORAS, UMBRAL_MENCION_HORAS,
} from './vigia-atascados.mjs';
import { cuerpoNoDebeDespertar } from './puerta-avisador-rojo.mjs';

// ── EL SUELO, ANTES DE MIRAR NADA ─────────────────────────────────────────────────────────
// Si el clasificador no reconoce sus propios cebos, un cero de esta pasada no significa «no hay
// atascados»: significa «no sé mirar». Y esas dos cosas no pueden dar la misma salida.
const suelo = sueloDeLaPasada();
console.log(suelo.detalle);
if (!suelo.ok) {
  console.log('::error::El suelo del vigía no reconoce su cebo. Esta pasada NO puede afirmar nada.');
  process.exit(1);
}

/** Un fichero que falta o no se lee es `null` — «no lo sé» —, nunca un objeto vacío. */
function leerJson(ruta) {
  try { return JSON.parse(fs.readFileSync(ruta, 'utf8')); } catch { return null; }
}

const prs = JSON.parse(fs.readFileSync('prs.json', 'utf8'));

// La lista de obligatorios, de las reglas VIVAS de main. `null` si no se pudo leer: entonces un
// rojo sale como ROJO-SIN-LISTA, que es decir «no lo sé» en vez de «está esperando».
const obligatorios = checksObligatoriosDeReglas(leerJson('reglas.json'));
console.log(obligatorios
  ? `checks obligatorios (reglas de main): ${obligatorios.join(', ')}`
  : '⚠️ no se pudo leer la lista de checks obligatorios: un rojo saldrá como ROJO-SIN-LISTA');

// `numero|mergeStateStatus|nº de check-runs|minutos desde el push|sonda de conflicto`
// La sonda llega como 'true' | 'false' | 'null'. `null` es «no se pudo medir», y NO es
// «no hay conflicto»: por eso se conserva como null y no se convierte a false.
const estados = new Map(
  fs.readFileSync('estados.txt', 'utf8').split('\n').filter(Boolean).map((l) => {
    const [n, e, c, min, sonda] = l.split('|');
    return [Number(n), {
      estado: e,
      checks: Number(c),
      minutosDesdePush: min === '' || min === undefined ? undefined : Number(min),
      sondaConflicto: sonda === 'true' ? true : sonda === 'false' ? false : null,
    }];
  }),
);

const ahora = Date.now();
const filas = [];
const descartados = [];
for (const p of prs) {
  const v = esAsuntoDelVigia({
    autor: p.author && p.author.login,
    draft: p.isDraft,
    etiquetas: (p.labels || []).map((l) => l.name),
    autoMerge: !!p.autoMergeRequest,
  });
  if (!v.vigilar) { descartados.push(`#${p.number} · ${v.porque}`); continue; }
  // Sin observación no se inventa una: `sondaConflicto: null` es «no se midió», que el
  // clasificador distingue de «no hay conflicto».
  const o = estados.get(p.number) || { estado: 'UNKNOWN', checks: 0, sondaConflicto: null };
  const payload = leerJson(`checks/${p.number}.json`);
  const checkRuns = payload && Array.isArray(payload.check_runs) ? payload.check_runs : undefined;
  const c = causaDelAtasco({ ...o, checkRuns, obligatorios, autoMerge: !!p.autoMergeRequest });

  // `RECIEN-EMPUJADO` NO es un atasco: es un «todavía no». Si entrara en la lista, cada push
  // haría «empeorar» el conjunto y dispararía un comentario, y el vigía se silenciaría el
  // primer día por su propio ruido. Se descarta DICIENDO por qué, que es distinto de callarlo.
  if (c.causa === 'RECIEN-EMPUJADO') { descartados.push(`#${p.number} · ${c.detalle}`); continue; }

  // La edad del atasco se mide desde el ÚLTIMO PUSH. Sin esa fecha, desde la apertura, y se
  // nota en la tabla porque las dos columnas coinciden.
  const sinPush = Number.isFinite(o.minutosDesdePush)
    ? Math.round((o.minutosDesdePush / 60) * 10) / 10
    : horasDesde(p.createdAt, ahora);

  filas.push({
    numero: p.number, causa: c.causa, detalle: c.detalle,
    horas: horasDesde(p.createdAt, ahora), sinPush, umbral: umbralDeEdad(sinPush),
    titulo: String(p.title || '').slice(0, 60), autor: p.author && p.author.login,
  });
}
filas.sort((a, b) => (b.sinPush || 0) - (a.sinPush || 0));

// ── `main`, QUE NO ES UN PR (SCRUM-1458) ──────────────────────────────────────────────────
// La fecha del último commit de `origin/main`. Si `git` falla o no devuelve una fecha, es `null`
// —«no lo sé»—, y eso NO es «`main` está al día»: se dice en el cuerpo.
function fechaDeMain() {
  try {
    return execFileSync('git', ['log', '-1', '--format=%cI', 'origin/main'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null;
  } catch { return null; }
}
const antes = JSON.parse(process.env.ANTES || '[]');
const main = filaDeMain({ fecha: fechaDeMain(), ahora });
// La memoria: los PR y, delante, la fila de `main` si está parado. Si esta pasada no pudo leer
// `main`, se CONSERVA lo que la memoria decía de él: sin eso, al volver a leerlo entraría como
// nuevo y el aviso —con su mención— saldría dos veces por el mismo parón.
const memoriaDeMain = main.leido
  ? (main.parado ? [{ numero: main.fila.numero, causa: main.fila.causa, umbral: main.fila.umbral }] : [])
  : antes.filter((p) => p.numero === NUMERO_DE_MAIN);
const memoria = [...memoriaDeMain, ...filas.map((f) => ({ numero: f.numero, causa: f.causa, umbral: f.umbral }))];
console.log(!main.leido
  ? '⚠️ no se pudo leer la fecha del último commit de origin/main: esta pasada NO dice que main esté al día'
  : `main: último commit hace ${main.horas} h (${main.fecha})${main.parado ? ' → MAIN-PARADO' : ''}`);

// ── EL CUERPO ─────────────────────────────────────────────────────────────────────────────
// La columna «h. quieto» (updatedAt) se sustituye por «h. sin push»: `updatedAt` lo mueve
// cualquier comentario —incluido el del avisador— y hacía parecer quieto lo que no se movía.
const sello = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
let b = 'Reescrito por el vigía en cada pasada. **No arregla nada: avisa.**\n\n';
b += `Última pasada: ${sello}\n\n`;
if (!main.leido) {
  b += '⚠️ **No se pudo leer la edad de `main`.** Esta pasada NO dice que `main` esté al día: no lo sabe.\n\n';
} else if (main.parado) {
  b += `🛑 **${MARCA_DE_MAIN_PARADO}: ${main.horas} h sin un merge** (el último, el ${main.fecha}). Se avisa desde las ${UMBRAL_MAIN_PARADO_HORAS} h.\n\n`;
} else {
  b += `\`main\`: último merge hace ${main.horas} h (${main.fecha}). Se avisa desde las ${UMBRAL_MAIN_PARADO_HORAS} h.\n\n`;
}
if (filas.length === 0) {
  b += '**Ningún PR atascado.**\n\n';
  b += 'Y el suelo de esta pasada dio OK, así que este cero es un cero MEDIDO: los cebos '
     + 'sintéticos sí salen marcados. Un cero sin esa línea al lado no se distingue de un '
     + 'instrumento ciego.\n';
} else {
  b += '| PR | causa | h. sin push | h. abierto | autor | título |\n|---|---|---|---|---|---|\n';
  for (const f of filas) {
    b += `| #${f.numero} | **${f.causa}** | ${f.sinPush} | ${f.horas} | ${f.autor} | ${f.titulo} |\n`;
  }
  b += '\n';
  for (const c of [...new Set(filas.map((f) => f.causa))]) {
    b += `- **${c}** — ${filas.find((f) => f.causa === c).detalle}\n`;
  }
}
b += `\n<details><summary>Descartados a propósito (${descartados.length})</summary>\n\n`;
b += descartados.length ? descartados.map((d) => `- ${d}`).join('\n') : '- (ninguno)';
b += '\n\n</details>\n';
b += `\n<!-- vigia-atascados:estado ${JSON.stringify(memoria)} -->\n`;

// ── EL ESPEJO DE LA REGLA DEL AVISADOR ────────────────────────────────────────────────────
// Éste despierta a una PERSONA. Si el cuerpo llevara la mención despertaría además a una
// sesión que nadie llamó — y el cuerpo lleva TÍTULOS DE PR dentro, o sea texto que escribe
// otra persona. Basta un PR titulado con la mención. Se comprueba aquí, no en un README.
if (!cuerpoNoDebeDespertar(b)) {
  console.log('::error::El cuerpo del vigía contiene la mención que despierta a Claude. No se publica.');
  process.exit(1);
}

fs.writeFileSync('cuerpo.md', b);

const r = haEmpeorado(antes, memoria);

// ── EL AVISO, SOLO SI EMPEORA ─────────────────────────────────────────────────────────────
// Se compone aquí y no en bash por lo mismo que el cuerpo: se puede leer y probar. No lleva
// títulos —texto ajeno—, solo números, causas y edades. Pasa igualmente la comprobación de la
// mención: una regla que solo se aplica al texto que parece peligroso no es una regla.
//
// LA MENCIÓN AL DUEÑO, con sus dos fechas (el detalle, en la cabecera de `vigia-atascados.mjs`):
// desde el 15-sep-2026 iba en todo aviso; desde el 6-oct-2026 va sólo si `main` entra parado o
// cruza un umbral, o si un PR cruza 72 h. Lo decide `llevaMencion`, no este fichero.
const DUENO = String(process.env.DUENO || '').trim();
const m = llevaMencion(r, memoria);
if (r.empeora) {
  const fila = new Map(filas.map((f) => [f.numero, f]));
  const previo = new Map(antes.map((p) => [p.numero, p]));
  const esPR = (n) => n !== NUMERO_DE_MAIN;
  const cruceDeMain = r.envejecidos.find((e) => !esPR(e.numero));
  const hayPR = r.nuevos.some(esPR) || r.cambiados.some(esPR) || r.envejecidos.some((e) => esPR(e.numero));
  let a = m.mencion && DUENO ? `@${DUENO} ` : '';
  if (m.porMain) {
    a += `🛑 **${MARCA_DE_MAIN_PARADO}: ${main.horas} h sin un merge** (el último, el ${main.fecha})`
       + `${cruceDeMain ? ` · cruza ${cruceDeMain.umbral} h` : ''}.\n\n`;
  }
  if (hayPR) {
    a += 'la lista de PR atascados ha **EMPEORADO**. El detalle completo está en el cuerpo del issue.\n\n';
  }
  for (const n of r.nuevos.filter(esPR)) {
    const f = fila.get(n);
    a += `- **#${n} entra** como **${f.causa}** (${f.sinPush} h sin push)\n`;
  }
  for (const n of r.cambiados.filter(esPR)) {
    a += `- **#${n} cambia de causa**: ${previo.get(n).causa} → **${fila.get(n).causa}**\n`;
  }
  for (const e of r.envejecidos.filter((x) => esPR(x.numero))) {
    const f = fila.get(e.numero);
    a += `- **#${e.numero} cruza ${e.umbral} h** sin moverse (${f.sinPush} h sin push, ${f.causa})\n`;
  }
  a += '\nEste aviso solo sale cuando un PR entra o pasa a una causa que no se arregla esperando, '
     + `o cuando cruza un umbral de edad (${UMBRALES_HORAS.join(' h, ')} h y después cada semana); `
     + `y cuando \`main\` lleva ${UMBRAL_MAIN_PARADO_HORAS} h sin un merge. `
     + 'Entre medias el issue se reescribe sin notificar. '
     + `La mención queda para \`main\` parado y para un PR que cruza ${UMBRAL_MENCION_HORAS} h o más.\n`;

  if (!cuerpoNoDebeDespertar(a)) {
    console.log('::error::El aviso del vigía contiene la mención que despierta a Claude. No se publica.');
    process.exit(1);
  }
  fs.writeFileSync('aviso.md', a);
}

// ── SCRUM-1270 · EL PR MUDO ≥3 h, AVISADO DENTRO DEL PR ────────────────────────────────────
// Lo publica el workflow, una vez por cabeza (la marca). Aquí se compone y se comprueba.
const avisosPR = [];
for (const f of filas) {
  const p = prs.find((x) => x.number === f.numero);
  const payload = leerJson(`checks/${f.numero}.json`);
  const checkRuns = payload && Array.isArray(payload.check_runs) ? payload.check_runs : undefined;
  const a = avisoEnElPR({ fila: f, sha: p && p.headRefOid, checkRuns, obligatorios });
  if (!a) continue;
  if (!cuerpoNoDebeDespertar(a.cuerpo)) {
    console.log(`::error::El aviso de PR mudo de #${a.numero} contiene la mención que despierta a Claude. No se publica.`);
    process.exit(1);
  }
  avisosPR.push(a);
}
fs.writeFileSync('avisos-pr.json', JSON.stringify(avisosPR));
console.log(`PR mudos ≥${UMBRAL_AVISO_EN_PR_HORAS} h con aviso en el PR: ${avisosPR.map((a) => '#' + a.numero).join(', ') || 'ninguno'}`);

fs.writeFileSync('veredicto.json', JSON.stringify({ ...r, atascados: filas.length }));
console.log(`atascados ${filas.length} · descartados ${descartados.length} · empeora ${r.empeora}`
  + ` · nuevos ${r.nuevos.length} · cambian ${r.cambiados.length} · envejecen ${r.envejecidos.length}`
  + ` · mención ${r.empeora && m.mencion ? 'SÍ' : 'no'}`);
