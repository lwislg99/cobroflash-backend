// scripts/_invocaciones-de-la-tanda.mjs — SCRUM-850
//
// ════════════════════════════════════════════════════════════════════════════════════════════
// ¿DÓNDE SE INVOCA LA TANDA, Y CUÁNTAS DE ESAS INVOCACIONES SE COMEN SU CÓDIGO DE SALIDA?
//
// ── EL DEFECTO, MEDIDO ──────────────────────────────────────────────────────────────────────
//
// En una tubería el código de salida es el del ÚLTIMO comando. `npm test | tail` devuelve el de
// `tail`, que es 0 pase lo que pase. El 15-sep-2026 tres sesiones distintas se lo encontraron el
// mismo día sin buscarlo, y DOS estuvieron a punto de entregar un rojo como verde:
//
//     EXIT=1               <- el de npm test
//     [exited with code 0] <- el del envoltorio
//
// Un `exit 1` se ve. Un `exit 0` que debería ser `1` no se ve nunca.
//
// ── ⛔ ESTO MIRA CÓMO SE INVOCA LA TANDA, NO QUÉ MIDE ────────────────────────────────────────
//
// La regla 41 prohíbe cambiar lo que un guard EXIGE para que el código pase. Aquí no se toca
// ningún guard ni ningún test: se mira la FORMA de la invocación. Un `| tail` se quita del
// comando, no del guard que lo denuncia.
//
// ── LA POBLACIÓN, Y POR QUÉ SON CINCO SUPERFICIES Y NO CUATRO ────────────────────────────────
//
// El ticket nombra cuatro (package.json, workflows, scripts, hooks). Se añade una quinta,
// declarada: los ficheros que PRESCRIBEN una invocación —`CLAUDE.md`, `docs/`—, porque una
// instrucción que manda teclear `npm test | grep …` produce exactamente el mismo verde falso que
// un script que lo hace solo, y encima lo produce en todas las sesiones a la vez.
//
// ⛔ SIN `grep` PARA CONTAR (SCRUM-766 / SCRUM-850 punto 4): aquí no se cuenta ningún carácter
// de control con `grep`. Todo lo que cuenta este fichero se cuenta en JavaScript.
// ════════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

/** Cómo se reconoce una invocación de la tanda. Por PALABRA, nunca por subcadena. */
export const INVOCA_LA_TANDA = [
  /\bnpm\s+test\b/,
  /\bnpm\s+run\s+test(:[\w:-]+)?\b/,
  /\bnode\s+(--[\w=.-]+\s+)*--test\b/,
];

/**
 * Los verbos que NO propagan el código de salida del comando que tienen delante.
 *
 * 🔴 SCRUM-850b · `SEGUNDO_PLANO` entra MEDIDO, no por simetría. Una tanda lanzada con `&` no
 * devuelve su veredicto: el shell devuelve el suyo, que es 0 siempre. Reproducido el
 * 15-sep-2026 con una tanda de dos tests, uno rojo a propósito:
 *
 *     node --test rojo.test.mjs verde.test.mjs        -> exit 1   (honesto)
 *     node --test rojo.test.mjs verde.test.mjs &      -> exit 0   🔴
 *
 * El censo lo daba por SANO porque `segmentar` no partía por `&` — sólo por `&&`. Es el mismo
 * criterio que ya aplicaba a `|` y a `;`, extendido al separador que faltaba: no es una
 * prohibición nueva, es el mismo «este separador se come el veredicto».
 */
export const VEREDICTOS = {
  SANO: 'SANO', TUBERIA: 'TUBERIA', SECUENCIA: 'SECUENCIA', SEGUNDO_PLANO: 'SEGUNDO_PLANO',
};

const esInvocacion = (s) => INVOCA_LA_TANDA.some((r) => r.test(s));

/**
 * Trocea una línea de shell en segmentos, conservando el separador que va DETRÁS de cada uno.
 * Respeta comillas simples y dobles: un `|` dentro de una cadena no es una tubería.
 */
export function segmentar(linea) {
  const out = [];
  let buf = '', comilla = null;
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i], sig = linea[i + 1];
    if (comilla) { buf += c; if (c === comilla) comilla = null; continue; }
    if (c === '"' || c === "'" || c === '`') { comilla = c; buf += c; continue; }
    if (c === '|' && sig === '|') { out.push({ texto: buf, sep: '||' }); buf = ''; i++; continue; }
    if (c === '&' && sig === '&') { out.push({ texto: buf, sep: '&&' }); buf = ''; i++; continue; }
    // SCRUM-850b · un `&` SOLO —no `&&`— manda el comando al segundo plano, y entonces el
    // código que sale es el del shell, no el de la tanda. Se parte igual que por `|` o `;`.
    // Ojo al orden: esta rama va DESPUÉS de la de `&&`, o partiría `&&` por la mitad.
    //
    // 🔴 Y NO TODO `&` ES SEGUNDO PLANO: en `2>&1`, `>&2` y `&>log` es una REDIRECCIÓN. La
    // primera versión de esto marcaba `npm test > salida.txt 2>&1` —que es la forma SANA, la
    // que la casa recomienda— como si se comiera el veredicto. Lo cazó el banco de formas al
    // medir: un guard que marca de más se acaba apagando, y habría apagado el bueno.
    // El criterio es de forma, no una lista: es redirección si pega con un `>`/`<` por
    // cualquiera de los dos lados.
    if (c === '&' && sig !== '&') {
      const izq = buf.trimEnd().slice(-1);
      const esRedireccion = izq === '>' || izq === '<' || sig === '>' || sig === '<';
      if (!esRedireccion) { out.push({ texto: buf, sep: '&' }); buf = ''; continue; }
    }
    if (c === '|') { out.push({ texto: buf, sep: '|' }); buf = ''; continue; }
    if (c === ';') { out.push({ texto: buf, sep: ';' }); buf = ''; continue; }
    buf += c;
  }
  out.push({ texto: buf, sep: null });
  return out;
}

/**
 * El veredicto de UNA línea de shell. Devuelve [] si no invoca la tanda.
 *
 * · TUBERIA   — la invocación va seguida de `|`: el código de salida es el del último tramo.
 * · SECUENCIA — va seguida de `;` y hay algo detrás: el compuesto devuelve el del último.
 * · SANO      — es el último tramo, o va encadenada con `&&` / `||`, que SÍ propagan el rojo.
 *
 * `&&` no se marca: `A && B` falla si A falla. `||` tampoco: enmascara el rojo A PROPÓSITO y se
 * usa para eso (`comando || true`), así que marcarlo llenaría el censo de ruido legítimo.
 */
export function veredictoDeLinea(linea) {
  const segs = segmentar(linea);
  const hallazgos = [];
  for (let i = 0; i < segs.length; i++) {
    if (!esInvocacion(segs[i].texto)) continue;
    const sep = segs[i].sep;
    const haySiguiente = i + 1 < segs.length && segs[i + 1].texto.trim() !== '';
    let v = VEREDICTOS.SANO;
    if (sep === '|') v = VEREDICTOS.TUBERIA;
    // SCRUM-850b · el `&` se come el veredicto HAYA O NO algo detrás: `npm test &` a secas ya
    // sale 0. Por eso, al revés que `;`, no se pide `haySiguiente`.
    else if (sep === '&') v = VEREDICTOS.SEGUNDO_PLANO;
    else if (sep === ';' && haySiguiente) v = VEREDICTOS.SECUENCIA;
    hallazgos.push({ veredicto: v, comando: segs[i].texto.trim(), linea });
  }
  return hallazgos;
}

/** Quita comentarios de shell/YAML (`#` fuera de comillas). No toca `#` dentro de una cadena. */
export function sinComentario(linea) {
  let comilla = null;
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (comilla) { if (c === comilla) comilla = null; continue; }
    if (c === '"' || c === "'" || c === '`') { comilla = c; continue; }
    if (c === '#' && (i === 0 || /\s/.test(linea[i - 1]))) return linea.slice(0, i);
  }
  return linea;
}

// ── LAS CINCO SUPERFICIES ───────────────────────────────────────────────────────────────────

/** ① `package.json`: los scripts de verdad. Las claves que empiezan por `//` son comentarios. */
export function dePackageJson(raiz) {
  const f = path.join(raiz, 'package.json');
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  const out = [];
  for (const [k, v] of Object.entries(j.scripts || {})) {
    if (k.startsWith('//')) continue;
    for (const h of veredictoDeLinea(String(v))) out.push({ ...h, fichero: 'package.json', donde: `scripts.${k}` });
  }
  return out;
}

/** ② Los `run:` de los workflows. Se leen línea a línea y se les quita el comentario. */
export function deWorkflows(raiz) {
  const dir = path.join(raiz, '.github', 'workflows');
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const nombre of fs.readdirSync(dir).filter((x) => /\.ya?ml$/.test(x))) {
    const texto = fs.readFileSync(path.join(dir, nombre), 'utf8');
    const lineas = texto.split('\n');
    let dentroDeRun = false, sangriaRun = 0;
    for (let i = 0; i < lineas.length; i++) {
      const cruda = lineas[i];
      const sangria = cruda.length - cruda.trimStart().length;
      const limpia = sinComentario(cruda);
      const m = /^\s*(-\s+)?run:\s*(\|-?|>-?)?\s*(.*)$/.exec(limpia);
      if (m) {
        dentroDeRun = !!m[2]; sangriaRun = sangria;
        if (m[3].trim()) for (const h of veredictoDeLinea(m[3])) out.push({ ...h, fichero: `.github/workflows/${nombre}`, donde: `línea ${i + 1}` });
        continue;
      }
      if (dentroDeRun) {
        if (cruda.trim() && sangria <= sangriaRun) { dentroDeRun = false; continue; }
        for (const h of veredictoDeLinea(limpia)) out.push({ ...h, fichero: `.github/workflows/${nombre}`, donde: `línea ${i + 1}` });
      }
    }
  }
  return out;
}

/**
 * ③ Los `.mjs` de `scripts/`: las cadenas que se le pasan a un ejecutor de shell.
 * 🔴 POR AST, NUNCA POR `grep` (SCRUM-203): un `npm test | tail` escrito en un //comentario
 * —y este repositorio los tiene a puñados explicando justo esto— no es una invocación.
 */
export const EJECUTORES = new Set(['execSync', 'exec', 'spawnSync', 'spawn', 'execFileSync', 'execFile']);

export function deUnFicheroJs(codigo, nombre) {
  const sf = ts.createSourceFile(nombre, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const out = [];
  const literales = (n, acc = []) => {
    if (!n) return acc;
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) acc.push(n.text);
    else if (ts.isTemplateExpression(n)) {
      acc.push(n.head.text);
      for (const sp of n.templateSpans) acc.push(sp.literal.text);
    }
    return acc;
  };
  const linea = (n) => sf.getLineAndCharacterOfPosition(n.getStart()).line + 1;
  const visita = (n) => {
    if (ts.isCallExpression(n)) {
      const c = n.expression;
      const nom = ts.isIdentifier(c) ? c.text : (ts.isPropertyAccessExpression(c) ? c.name.text : null);
      if (nom && EJECUTORES.has(nom) && n.arguments.length) {
        for (const t of literales(n.arguments[0])) {
          for (const h of veredictoDeLinea(t)) out.push({ ...h, donde: `línea ${linea(n)}` });
        }
      }
    }
    // 🔴 EL PUNTO CIEGO QUE CASI DEJA EL CENSO EN «scripts: 0», y lo destapó DECLARAR LA POBLACIÓN.
    // La casa no lanza la tanda por cadena de shell: la lanza por ARGUMENTOS —
    // `spawnSync(process.execPath, ['--test', …])`, y `test-staging-gated.mjs` con un `args: [...]`
    // en una tabla. Sin shell no puede haber tubería, así que son SANAS por construcción; pero
    // dejarlas fuera hacía que el censo dijera CERO sobre una superficie que tiene dos.
    if (ts.isArrayLiteralExpression(n)) {
      const trozos = n.elements.filter((e) => ts.isStringLiteral(e)).map((e) => e.text);
      if (trozos.some((t) => /^--test\b/.test(t))) {
        out.push({
          veredicto: VEREDICTOS.SANO, sinShell: true,
          comando: `node ${trozos.join(' ')}`.slice(0, 120),
          linea: '(por argumentos)', donde: `línea ${linea(n)}`,
        });
      }
    }
    n.forEachChild(visita);
  };
  visita(sf);
  return out;
}

export function deScripts(raiz) {
  const dir = path.join(raiz, 'scripts');
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const nombre of fs.readdirSync(dir).filter((x) => x.endsWith('.mjs'))) {
    const codigo = fs.readFileSync(path.join(dir, nombre), 'utf8');
    for (const h of deUnFicheroJs(codigo, nombre)) out.push({ ...h, fichero: `scripts/${nombre}` });
  }
  return out;
}

/** ④ Los hooks: `.sh` línea a línea, `.mjs` por AST. */
export function deHooks(raiz) {
  const dirs = ['.claude/hooks', '.husky'].map((d) => path.join(raiz, d)).filter((d) => fs.existsSync(d));
  const out = [];
  for (const dir of dirs) {
    for (const nombre of fs.readdirSync(dir)) {
      const abs = path.join(dir, nombre);
      if (!fs.statSync(abs).isFile()) continue;
      const rel = path.relative(raiz, abs).split(path.sep).join('/');
      const codigo = fs.readFileSync(abs, 'utf8');
      if (nombre.endsWith('.mjs') || nombre.endsWith('.js')) {
        for (const h of deUnFicheroJs(codigo, nombre)) out.push({ ...h, fichero: rel });
      } else {
        codigo.split('\n').forEach((l, i) => {
          for (const h of veredictoDeLinea(sinComentario(l))) out.push({ ...h, fichero: rel, donde: `línea ${i + 1}` });
        });
      }
    }
  }
  return out;
}

/**
 * ⑤ Lo que PRESCRIBE una invocación: los bloques de código de `CLAUDE.md` y `docs/`.
 * Una instrucción que manda teclear `npm test | grep …` produce el mismo verde falso que un
 * script que lo hace solo — y lo produce en todas las sesiones a la vez.
 * `docs/master/` queda FUERA: es el registro de lo ya hecho, no una instrucción a seguir.
 */
export function deInstrucciones(raiz, ficheros = ['CLAUDE.md', 'docs/RUNBOOKS.md', 'docs/equipo/00-normas-comunes.md']) {
  const out = [];
  for (const rel of ficheros) {
    const abs = path.join(raiz, rel);
    if (!fs.existsSync(abs)) continue;
    const lineas = fs.readFileSync(abs, 'utf8').split('\n');
    let dentro = false;
    for (let i = 0; i < lineas.length; i++) {
      if (/^\s*```/.test(lineas[i])) { dentro = !dentro; continue; }
      if (!dentro) continue;
      for (const h of veredictoDeLinea(sinComentario(lineas[i]))) out.push({ ...h, fichero: rel, donde: `línea ${i + 1}` });
    }
  }
  return out;
}

/** El censo entero, con su población declarada. */
export function censar(raiz) {
  const superficies = {
    'package.json': dePackageJson(raiz),
    'workflows': deWorkflows(raiz),
    'scripts': deScripts(raiz),
    'hooks': deHooks(raiz),
    'instrucciones': deInstrucciones(raiz),
  };
  const todas = Object.values(superficies).flat();
  return {
    superficies: Object.fromEntries(Object.entries(superficies).map(([k, v]) => [k, v.length])),
    poblacion: todas.length,
    invocaciones: todas,
    comeElCodigo: todas.filter((h) => h.veredicto !== VEREDICTOS.SANO),
  };
}
