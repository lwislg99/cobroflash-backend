// docs/master/evidencias/scrum1502b/que-fuentes-lee.mjs — SCRUM-1502, tramo 2
//
// ¿SABE `scrum921c` MIRAR EN JIRA, O SÓLO EN EL ÁRBOL? Se contesta por el DESTINO: se ejecuta el
// trinquete con un espía delante (`espia.mjs`) y se mira qué lee y si sale de la máquina; y se le
// fabrican, en un ESPEJO, marcas cuyo respaldo está en un sitio u otro, para ver cuáles encuentra.
//
// ⛔ MUTA FICHEROS SEGUIDOS DEL ESPEJO. El espejo es un `git worktree add --detach` DESECHABLE,
// nunca el árbol de trabajo. Cada caso restaura lo que tocó y lo comprueba byte a byte; al acabar,
// `git status --porcelain` del espejo tiene que salir vacío, y eso se mira aparte.
//
// Uso:  node que-fuentes-lee.mjs <raíz del espejo> <carpeta temporal> <n de un ticket que NO existe>
//
// El tercer argumento NO se escribe en ningún fichero: es el control de cero de la casa
// (`docs/master/evidencias/scrum1505/control-de-cero.mjs`), y aquí se comprueba otra vez que el
// espejo no lo nombra. Que tampoco existe en Jira se mira a mano, con la herramienta de Jira.
//
// La medida de cada caso la da `docs/master/evidencias/scrum1502/lista.mjs`, que importa
// `congeladas()` y `porNivel()` del propio trinquete: no hay censo nuevo.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const [ESPEJO_ARG, TMP, TICKET_INEXISTENTE] = process.argv.slice(2);
if (!ESPEJO_ARG || !TMP || !/^\d+$/.test(TICKET_INEXISTENTE || '')) {
  console.error('uso: que-fuentes-lee.mjs <raíz del espejo> <carpeta temporal> <n de ticket inexistente>'); process.exit(2);
}
const ESPEJO = path.resolve(ESPEJO_ARG);
const AQUI = import.meta.dirname;
if (AQUI.startsWith(ESPEJO + path.sep)) { console.error('⛔ el espejo no puede ser el árbol de este guion'); process.exit(2); }
const ESPIA = path.join(AQUI, 'espia.mjs');
const SUJETOS = path.join(AQUI, 'sujetos-de-control.mjs');
const GUARD = 'tests/scrum921c-firma-con-respaldo-en-codigo.test.mjs';
const LISTA = 'docs/master/evidencias/scrum1502/lista.mjs';
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const decir = (...l) => console.log(l.join('\n'));
let fallos = 0;
const exigir = (ok, texto) => { decir(`${ok ? 'OK ' : '🔴 '} ${texto}`); if (!ok) fallos += 1; };

/** Corre un sujeto con el espía delante, entorno limpio. */
function espiar(args, { bloquea = false, cwd = ESPEJO } = {}) {
  const salida = path.join(TMP, `espia-${crypto.randomBytes(4).toString('hex')}.json`);
  const env = { ...process.env, ESPIA_SALIDA: salida };
  for (const k of ['NODE_TEST_CONTEXT', 'NODE_OPTIONS', 'FORCE_COLOR', 'ESPIA_BLOQUEA']) delete env[k];
  if (bloquea) env.ESPIA_BLOQUEA = '1';
  const r = spawnSync(process.execPath, ['--import', `file:///${ESPIA.replace(/\\/g, '/')}`, ...args], { cwd, env, encoding: 'utf8' });
  if (!fs.existsSync(salida)) return { ciego: true, status: r.status, stderr: (r.stderr || '').slice(0, 400) };
  const visto = JSON.parse(fs.readFileSync(salida, 'utf8'));
  fs.rmSync(salida, { force: true });
  return { ...visto, status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

// ── 1 · LOS CONTROLES DEL ESPÍA, ANTES DE NADA ───────────────────────────────────────────────
decir('── 1 · controles del espía');
const quieto = espiar([SUJETOS, 'quieto'], { cwd: AQUI });
const sale = espiar([SUJETOS, 'sale'], { cwd: AQUI });
const saleBloqueado = espiar([SUJETOS, 'sale'], { cwd: AQUI, bloquea: true });
const puertas = (v) => [...new Set((v.exterior || []).map((e) => e.split(' ')[0].replace(/\..*/, '')))].sort();
exigir(!quieto.ciego && quieto.exterior.length === 0, `CERO: el sujeto quieto da ${quieto.exterior?.length} salidas (tiene que dar 0)`);
exigir(!quieto.ciego && quieto.leidos.some((p) => p.endsWith('sujetos-de-control.mjs')), 'y el espía SÍ le ve leer su fichero');
exigir(!sale.ciego && ['child_process', 'dns', 'fetch', 'https', 'net'].every((p) => puertas(sale).includes(p)),
  `POSITIVO: el sujeto que sale da ${sale.exterior?.length} salidas por ${puertas(sale).join(', ')}`);
exigir(!sale.ciego && sale.entorno.includes('JIRA_TOKEN_DE_CONTROL'), 'y le ve consultar una variable de entorno por su nombre');
exigir(!saleBloqueado.ciego && saleBloqueado.exterior.length >= 5 && saleBloqueado.bloquea === true,
  `BLOQUEO: con el bloqueo puesto las sigue viendo (${saleBloqueado.exterior?.length}) y el sujeto no muere (salida ${saleBloqueado.status})`);
if (fallos) { decir('⛔ el espía no pasa sus controles: nada de lo que siga vale.'); process.exit(1); }

// ── 2 · EL TRINQUETE, ESPIADO, SOBRE EL ESPEJO SIN MUTAR ─────────────────────────────────────
decir('', '── 2 · el trinquete espiado, espejo sin mutar');
const resultado = (v) => {
  const n = (clave) => Number((v.stdout.match(new RegExp(`^(?:# |ℹ )${clave} (\\d+)`, 'm')) || [])[1] ?? NaN);
  return { tests: n('tests'), pass: n('pass'), fail: n('fail') };
};
const rel = (p) => path.relative(ESPEJO, p).replace(/\\/g, '/');
const dentro = (p) => !rel(p).startsWith('..') && !path.isAbsolute(rel(p));
function clasificar(rutas) {
  const clases = {};
  for (const p of rutas) {
    let c;
    if (!dentro(p)) c = '(fuera del espejo)';
    else {
      const t = rel(p).split('/');
      c = t[0] === 'docs' ? (t.length === 2 ? `docs/${t[1]}` : `docs/${t[1]}/`) : (t.length === 1 ? t[0] : `${t[0]}/`);
    }
    clases[c] = (clases[c] || 0) + 1;
  }
  return clases;
}
const libre = espiar([GUARD]);
const cerrado = espiar([GUARD], { bloquea: true });
if (libre.ciego || cerrado.ciego) { decir(`⛔ CIEGO: ${libre.stderr || cerrado.stderr}`); process.exit(1); }
const rl = resultado(libre); const rc = resultado(cerrado);
decir(`POBLACION  ficheros leídos=${libre.leidos.length} · directorios listados=${libre.listados.length} · casos del trinquete=${rl.tests}`);
decir('leídos, por sitio:');
for (const [c, n] of Object.entries(clasificar(libre.leidos)).sort()) decir(`    ${String(n).padStart(5)}  ${c}`);
const fueraDelEspejo = libre.leidos.filter((p) => !dentro(p));
if (fueraDelEspejo.length) decir(`fuera del espejo: ${fueraDelEspejo.slice(0, 8).join(' · ')}`);
decir(`salidas al exterior (red, nombres, procesos): ${libre.exterior.length}${libre.exterior.length ? ` → ${libre.exterior.join(' | ')}` : ''}`);
decir(`variables de entorno consultadas por nombre: ${libre.entorno.join(', ') || '—'}`);
const huelenAJira = libre.entorno.filter((k) => /JIRA|ATLASSIAN|TOKEN|API_KEY|SECRET/i.test(k));
exigir(rl.tests > 0 && rl.fail === 0 && libre.status === 0, `sin bloqueo: ${rl.pass} de ${rl.tests} pasan, ${rl.fail} fallan (salida ${libre.status})`);
exigir(rc.tests === rl.tests && rc.pass === rl.pass && rc.fail === 0 && cerrado.status === 0,
  `con TODA salida bloqueada: ${rc.pass} de ${rc.tests} pasan, ${rc.fail} fallan (salida ${cerrado.status}) · salidas intentadas ${cerrado.exterior.length}`);
decir(`→ salidas=${libre.exterior.length} · credenciales consultadas=${huelenAJira.length} · leídos fuera del espejo=${fueraDelEspejo.length}`);

// ── 3 · LOS CASOS FABRICADOS ─────────────────────────────────────────────────────────────────
decir('', '── 3 · marcas fabricadas en el espejo');

/** Lo que el trinquete dice, por su propio camino (`lista.mjs`), con toda salida BLOQUEADA. */
function medir() {
  const salida = path.join(TMP, 'medida.json');
  fs.rmSync(salida, { force: true });
  const v = espiar([path.join(ESPEJO, LISTA), salida], { bloquea: true });
  if (v.ciego || !fs.existsSync(salida)) return { ciego: true, stderr: (v.stderr || '').slice(0, 300) };
  const j = JSON.parse(fs.readFileSync(salida, 'utf8'));
  const rojos = v.stdout.split('\n').filter((l) => /^✖ SCRUM|^not ok /.test(l)).map((l) => l.replace(/\s*\(\d[\d.]*ms\)\s*$/, '').replace(/^(✖ |not ok \d+ - )/, ''));
  return { niveles: j.porNivel, lista: j.filas.map((f) => f.donde), rojos: [...new Set(rojos)], exterior: v.exterior.length };
}

function caso(nombre, mutaciones) {
  const antes = [];
  let medida;
  try {
    for (const m of mutaciones) {
      const p = path.join(ESPEJO, m.fichero);
      const existia = fs.existsSync(p);
      const original = existia ? fs.readFileSync(p) : null;
      const dirNueva = !fs.existsSync(path.dirname(p));
      antes.push({ p, existia, original, dirNueva });
      if (m.crear !== undefined) {
        if (existia) throw new Error(`${m.fichero} ya existe: no es una cobaya`);
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, m.crear);
      } else {
        const texto = original.toString('utf8');
        const veces = texto.split(m.busca).length - 1;
        if (veces !== 1) throw new Error(`${nombre}: el ancla de la mutación aparece ${veces} veces en ${m.fichero}, no 1`);
        fs.writeFileSync(p, texto.replace(m.busca, m.busca + m.anade));
        if (sha(fs.readFileSync(p)) === sha(original)) throw new Error(`${nombre}: la mutación no cambió ${m.fichero}`);
      }
    }
    medida = medir();
  } finally {
    for (const a of antes.reverse()) { // en orden INVERSO (cicatriz del tramo 1)
      if (a.existia) fs.writeFileSync(a.p, a.original); else fs.rmSync(a.p, { force: true });
      if (a.dirNueva) fs.rmSync(path.dirname(a.p), { recursive: true, force: true });
      const ok = a.existia ? sha(fs.readFileSync(a.p)) === sha(a.original) : !fs.existsSync(a.p);
      if (!ok) throw new Error(`NO RESTAURADO: ${a.p}`);
    }
  }
  return { nombre, ...medida };
}

// La marca se compone aquí para que este guion no la contenga escrita (lo leen otros censos).
const MARCA = ['aprobado', 'por', 'el', 'fundador'].join(' ');
const NONCE = crypto.randomBytes(6).toString('hex');
const FRASE = `Aviso de espejo ${NONCE}: esta frase no vive en ningún otro sitio del árbol.`;
const COBAYA = 'src/_espejo1502b/aviso.ts';
const DOC = 'docs/master/_espejo-1502b.md';
const marca = (extra = '') => ({ fichero: COBAYA, crear: `// Texto del aviso: ${MARCA} el 8-oct-2026.${extra}\nexport const AVISO = '${FRASE}';\n` });
const docCon = (atribuye) => ({ fichero: DOC, crear: `# Cobaya del espejo\n\n${atribuye ? 'Aquí consta una decisión del fundador.' : 'Aquí no se nombra a nadie.'}\n\nEl texto: «${FRASE}»\n` });

// Control de cero de los casos: ni la frase ni el ticket inexistente están en el espejo, y la
// misma búsqueda SÍ ve algo que está (el ticket de este trabajo).
function vecesEnElArbol(aguja) {
  let n = 0;
  (function andar(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== '.git') andar(p); }
      else if (/\.(ts|js|mjs|md|json)$/.test(e.name) && fs.readFileSync(p, 'utf8').includes(aguja)) n += 1;
    }
  })(ESPEJO);
  return n;
}
const ceroFrase = vecesEnElArbol(NONCE);
const ceroTicket = vecesEnElArbol(`SCRUM-${TICKET_INEXISTENTE}`);
const positivo = vecesEnElArbol('SCRUM-1502');
exigir(ceroFrase === 0, `CERO: la frase fabricada está en ${ceroFrase} ficheros del espejo antes de fabricarla`);
exigir(ceroTicket === 0, `CERO: el ticket inexistente lo nombran ${ceroTicket} ficheros del espejo`);
exigir(positivo > 0, `POSITIVO: la misma búsqueda ve SCRUM-1502 en ${positivo} ficheros`);
if (fallos) process.exit(1);

// La marca REAL cuyo respaldo sólo está en Jira (SCRUM-1502 comentario 18835): se referencia por
// fichero y por un trozo de su COMENTARIO, nunca por la frase que gobierna.
const REAL = 'src/modules/system/app/routes/invoicesAdmin.routes.ts';
const ANCLA_REAL = 'PROFESIONAL al pulsar «Abrir PDF» de una factura cuyo sellado falló.';
const alComentarioReal = (linea) => ({ fichero: REAL, busca: ANCLA_REAL, anade: `\n        // ${linea}` });

const base = { nombre: '0 · base, espejo sin mutar', ...medir() };
if (base.ciego) { decir(`⛔ CIEGO en la base: ${base.stderr}`); process.exit(1); }
const filas = [
  base,
  caso('A · marca nueva, sin respaldo en NINGÚN sitio', [marca()]),
  caso('B · marca nueva, respaldo en el ÁRBOL (un docs/master que atribuye y lleva la frase)', [marca(), docCon(true)]),
  caso('B′ · lo mismo, pero el documento no atribuye a nadie', [marca(), docCon(false)]),
  caso('C · marca nueva cuyo comentario cita «ticket + comentario» de un ticket que NO EXISTE en Jira', [marca(` Consta en SCRUM-${TICKET_INEXISTENTE} comentario 99999.`)]),
  caso('C′ · marca nueva cuyo comentario sólo nombra ese ticket inexistente', [marca(` Ver SCRUM-${TICKET_INEXISTENTE}.`)]),
  caso('E1 · la REAL (respaldo sólo en Jira) + «SCRUM-1502 comentario 18835» en SU comentario', [alComentarioReal('Consta en SCRUM-1502 comentario 18835.')]),
  caso('E2 · la REAL + sólo «SCRUM-1502» en su comentario', [alComentarioReal('Reconocida en SCRUM-1502.')]),
  caso('E3 · la REAL + «c.18835» sin el ticket (la forma en que lo escribimos en Jira)', [alComentarioReal('Reconocida el 8-oct, c.18835.')]),
  caso('E4 · la REAL + «comentario 18835» sin el ticket', [alComentarioReal('Reconocida el 8-oct, comentario 18835.')]),
];

const NIVELES = ['sin-respaldo', 'anclado', 'rastreable', 'documental'];
const enBase = new Set(base.lista);
for (const f of filas) {
  if (f.ciego) { decir(`${f.nombre}\n    CIEGO: ${f.stderr}`); continue; }
  const salen = base.lista.filter((d) => !f.lista.includes(d));
  const entran = f.lista.filter((d) => !enBase.has(d));
  const delta = NIVELES.map((n) => { const d = (f.niveles[n] || 0) - (base.niveles[n] || 0); return `${n}=${f.niveles[n] || 0}${d ? ` (${d > 0 ? '+' : ''}${d})` : ''}`; }).join(' · ');
  decir(`${f.nombre}`, `    ${delta}`, `    salen: ${salen.join(', ') || '—'} · entran: ${entran.join(', ') || '—'}`,
    `    casos del trinquete en rojo (${f.rojos.length}): ${f.rojos.join(' | ') || '—'} · salidas al exterior: ${f.exterior}`);
}
const D = base.lista.filter((d) => d.startsWith(`${REAL}:`));
const punteros = vecesEnElArbol('SCRUM-1502 comentario 18835');
decir('', `D · la REAL, sin tocar: acusada en la base = ${D.join(', ') || 'NO'} · ficheros del espejo que YA escriben «SCRUM-1502 comentario 18835» = ${punteros}`);
const ciegos = filas.filter((f) => f.ciego).length;
decir(`POBLACION casos=${filas.length} ciegos=${ciegos} · salidas al exterior sumadas=${filas.reduce((s, f) => s + (f.exterior || 0), 0)}`);
process.exit(fallos || ciegos ? 1 : 0);
