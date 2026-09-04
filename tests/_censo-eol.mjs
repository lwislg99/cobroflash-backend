// tests/_censo-eol.mjs — SCRUM-480: censo de finales de línea DE LOS BLOBS.
//
// ── LA POBLACIÓN, DECLARADA ───────────────────────────────────────────────────────────────
//
//   FICHEROS:   todos los rastreados por git (`git ls-files -z`).
//   QUÉ SE LEE: el BLOB del índice (`git cat-file --batch`), NUNCA el fichero del disco.
//   MIDE:       qué guarda el repositorio.
//
// 🔴 POR QUÉ NO SE MIRA EL ÁRBOL DE TRABAJO. En Windows con `core.autocrlf=true` —que es lo que
// hay aquí, a nivel *system*— el disco tiene CRLF en casi todo lo pida el repo o no. Un censo
// sobre el disco devuelve «casi todos» y no es un dato: así salió el 57 que abrió este ticket,
// que no era un recuento de ficheros con CRLF sino el tamaño de la carpeta.
//
// 🔴 Y POR QUÉ NO SE USA `git ls-files --eol`. Lo intenté y contó 2 donde había 11: git informa
// `i/-text` —o sea «binario, no clasifico»— de cualquier fichero con UN CR SUELTO, y ocho de los
// nueve afectados tienen uno. Un instrumento que no ve lo que busca da un cero muy creíble.
//
// ── QUÉ ES «TEXTO» AQUÍ, Y POR QUÉ NO HAY LISTA DE BINARIOS ───────────────────────────────
//
// Un blob es texto si **no contiene ningún byte NUL**. Medido sobre los 1.700 del árbol, ese
// criterio deja fuera los ~213 PNG/PDF/iconos que contienen CR por casualidad **y también**
// `estructura.txt` y `estructura-completa.txt`, que son UTF-16LE (BOM FF FE, salida de
// PowerShell) y por eso van llenos de NUL. Cero acusaciones en falso sin enumerar nada — y una
// lista de extensiones envejece en silencio, que es lo que este ticket viene a impedir.
import { execFileSync, spawnSync } from 'node:child_process';
import { soloEjecutable } from './_guard-texto.mjs';
import fs from 'node:fs';
import path from 'node:path';

/**
 * EXCEPCIONES DECLARADAS Y VISIBLES, nunca silenciosas.
 *
 * Ficheros de TEXTO que pueden llevar CR en el blob, con su motivo. Cualquier otro es un defecto.
 */
export const CR_PERMITIDO = Object.freeze({
  'docs/legal/fuentes/aeat-errores.properties':
    'SCRUM-201b: la fuente oficial de la AEAT se guarda BYTE A BYTE (ISO-8859-1 con CRLF) porque '
    + 'su SHA-256 está citado en un documento. Si git le normaliza los saltos, el sello deja de '
    + 'casar. Lo protege su regla `-text` en `.gitattributes`.',
});

/** Cuenta CR de un blob y decide si es texto. Pura: recibe bytes, devuelve números. */
export function clasificarBlob(cuerpo) {
  if (cuerpo.indexOf(0) !== -1) return { texto: false, crlf: 0, crSuelto: 0 };
  let crlf = 0;
  let crSuelto = 0;
  for (let k = 0; k < cuerpo.length; k++) {
    if (cuerpo[k] !== 13) continue;
    if (cuerpo[k + 1] === 10) { crlf++; k++; } else crSuelto++;
  }
  return { texto: true, crlf, crSuelto };
}

/**
 * El censo completo. Devuelve la población medida además del resultado: un recuento sin
 * población no es un dato, y quien lo lea tiene que poder ver que el instrumento vio algo.
 */
export function censoEol(raiz) {
  const rutas = execFileSync('git', ['ls-files', '-z'], {
    cwd: raiz, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024,
  }).split('\0').filter(Boolean);
  if (rutas.length === 0) throw new Error('🔴 CIEGO: `git ls-files` no devolvió ningún fichero');

  const res = spawnSync('git', ['cat-file', '--batch'], {
    cwd: raiz, input: rutas.map((r) => `:${r}`).join('\n') + '\n', maxBuffer: 1024 * 1024 * 1024,
  });
  if (res.error || res.status !== 0) throw new Error('🔴 CIEGO: `git cat-file --batch` falló');
  const buf = res.stdout;

  const conCR = [];
  let textos = 0;
  let pos = 0;
  for (const ruta of rutas) {
    const nl = buf.indexOf(0x0a, pos);
    const cab = buf.subarray(pos, nl).toString('utf8').split(' ');
    if (cab[1] !== 'blob') throw new Error(`🔴 CIEGO: cabecera inesperada «${cab.join(' ')}»`);
    const tam = Number(cab[2]);
    const cuerpo = buf.subarray(nl + 1, nl + 1 + tam);
    pos = nl + 1 + tam + 1;

    const c = clasificarBlob(cuerpo);
    if (!c.texto) continue;
    textos += 1;
    if (c.crlf || c.crSuelto) conCR.push({ ruta, ...c });
  }
  return { poblacion: rutas.length, textos, conCR };
}

/**
 * EL MISMO CENSO, PERO SOBRE EL DISCO — que es lo que leen los guards.
 *
 * 🔴 POR QUÉ HACE FALTA ADEMÁS DEL DE BLOBS, Y ES EL AGUJERO DE LA FASE 2 DE ESTE TICKET. Un
 * guard no abre el repositorio: hace `readFileSync` del árbol de trabajo. Y con
 * `core.autocrlf=true` el checkout mete `\r` en ficheros cuyo blob lleva en LF desde siempre —
 * medido: `src/app.ts`, `public/dashboard/js/app.js`, `scripts/_db-guard.mjs`. O sea que
 * **renormalizar los blobs no quita ni un `\r` de lo que un guard lee**. Eso lo hace `eol=lf`.
 *
 * Y no es incomodidad de merges: **ciega guards en silencio**. `soloEjecutable(linea)`
 * sobre una línea que arrastra `\r` NO HACE NADA —sin `m`, `$` exige fin de cadena y el `\r` está
 * en medio—, así que un guard que promete «miro el código, no los comentarios» acaba mirando
 * también los comentarios. Le pasó al de SCRUM-409 durante semanas, y solo en Windows.
 */
export function censoArbolDeTrabajo(raiz, extensiones) {
  const rutas = execFileSync('git', ['ls-files', '-z'], {
    cwd: raiz, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024,
  }).split('\0').filter(Boolean);
  if (rutas.length === 0) throw new Error('🔴 CIEGO: `git ls-files` no devolvió ningún fichero');

  const conCR = [];
  let textos = 0;
  let leidos = 0;
  // 🔴 SCRUM-517: `binarios` y `sinCR` se CUENTAN en su rama del bucle, no se derivan restando.
  // Derivados (`leidos - textos`) la suma cerraría siempre y la comprobación de cuadratura del
  // test sería una identidad algebraica disfrazada de assert: verde pasara lo que pasara. Como
  // contadores propios, el día que alguien añada un `continue` que no incremente nada, la suma
  // deja de cerrar y el censo lo dice en vez de publicar un total que no es de nadie.
  let binarios = 0;
  let sinCR = 0;
  for (const ruta of rutas) {
    // La población es EXACTAMENTE la que `.gitattributes` promete tener en LF. Ni más —acusaría a
    // ficheros que nadie dijo que fueran a estar en LF— ni menos. Y la lista se DERIVA del propio
    // `.gitattributes`: una copia a mano aquí se separaría de las reglas sin que nadie lo viera.
    if (extensiones && !extensiones.has(path.extname(ruta).toLowerCase())) continue;
    let cuerpo;
    try { cuerpo = fs.readFileSync(path.join(raiz, ruta)); } catch { continue; } // no está en disco
    leidos += 1;
    const c = clasificarBlob(cuerpo);
    if (!c.texto) { binarios += 1; continue; }
    textos += 1;
    if (c.crlf || c.crSuelto) conCR.push({ ruta, ...c }); else sinCR += 1;
  }
  return { poblacion: rutas.length, leidos, textos, binarios, sinCR, conCR };
}

/** Las extensiones que `.gitattributes` promete en LF, leídas de él mismo. */
export function extensionesConEolLf(contenidoGitattributes) {
  const out = new Set();
  for (const l of contenidoGitattributes.split(/\r?\n/)) {
    const t = l.trim().replace(/\s+/g, ' ');
    if (!t || t.startsWith('#')) continue;
    const [patron, ...attrs] = t.split(' ');
    if (!attrs.includes('eol=lf')) continue;
    if (!patron.startsWith('*.')) continue;      // `scripts/db-push-prod` no tiene extensión
    out.add(patron.slice(1).toLowerCase());       // `*.js` → `.js`
  }
  return out;
}

/**
 * ¿Producen el MISMO blob el mismo contenido guardado con CRLF y con LF, para esa ruta?
 *
 * 🔴 `-c core.autocrlf=false` NO ES OPCIONAL. Esta máquina lo tiene en `true` a nivel system, así
 * que sin neutralizarlo la igualdad la produce **el ordenador** y no las reglas del repositorio —
 * y quitar de en medio la configuración de cada máquina es el ticket entero. Con esto, lo único
 * que puede hacer coincidir los dos blobs es `.gitattributes`.
 *
 * Por `--stdin`: no escribe ni un fichero, ni en el repo ni fuera.
 */
export function mismoBlobEnLasDosPlataformas(raiz, ruta) {
  const hash = (contenido) => execFileSync(
    'git', ['-c', 'core.autocrlf=false', 'hash-object', '--stdin', `--path=${ruta}`],
    { cwd: raiz, input: contenido, encoding: 'utf8' },
  ).trim();
  const windows = hash('const a = 1;\r\nconst b = 2;\r\n');
  const linux = hash('const a = 1;\nconst b = 2;\n');
  return { igual: windows === linux, windows, linux };
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// SCRUM-533 · LO QUE TOCA LA RAMA, QUE ES LO ÚNICO QUE EL AUTOR PUEDE ARREGLAR
//
// El censo del árbol entero acusa al ENTORNO: en un árbol veterano son ~1.350 ficheros, todos
// de commits ajenos y antiguos, y ninguno se arregla editándolo. Un rojo así no se arregla, se
// aprende a ignorar — y el día que cace un `\r` de verdad ya nadie lo mirará.
//
// Esto devuelve la otra población: los ficheros que ESTA rama toca. Ahí un `\r` sí es del autor,
// sí se arregla, y el rojo vuelve a significar algo.

/** El punto de partida de la rama, o `null` si no se puede resolver (CI con checkout somero). */
export function baseDeLaRama(raiz) {
  for (const ref of ['origin/main', 'origin/HEAD', 'main']) {
    try {
      const sha = execFileSync('git', ['merge-base', 'HEAD', ref], {
        cwd: raiz, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
      if (sha) return { sha, ref };
    } catch { /* esa referencia no existe aquí; se prueba la siguiente */ }
  }
  return null;
}

/**
 * Rutas que la rama toca: lo COMMITEADO desde su base + lo que hay sin commitear (modificado o
 * sin rastrear). Las dos, porque el `\r` puede entrar en cualquiera de los dos momentos y el
 * autor es el mismo.
 *
 * `base` puede ser `null` — en un checkout somero no hay con qué comparar. En ese caso se
 * devuelve SOLO lo no commiteado y se DICE (`baseResuelta: false`), en vez de devolver un
 * conjunto recortado que se lea como completo.
 */
export function ficherosDeLaRama(raiz) {
  const base = baseDeLaRama(raiz);
  const rutas = new Set();

  if (base) {
    const salida = execFileSync(
      'git', ['diff', '--name-only', '--diff-filter=ACMR', '-z', `${base.sha}..HEAD`],
      { cwd: raiz, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
    );
    for (const r of salida.split('\0')) if (r) rutas.add(r);
  }

  // Sin commitear. `--porcelain=v1 -z` no escapa rutas, así que no hay que desentrecomillar nada;
  // los renombrados traen DOS campos (destino y origen) y hay que consumir el segundo o se leería
  // como una ruta suelta más.
  //
  // 🔴 LO SIN RASTREAR (`??`) QUEDA FUERA, Y NO ES UN DESCUIDO. El censo del árbol entero mira
  // `git ls-files`, o sea SOLO lo rastreado: incluir aquí un fichero que todavía no está en el
  // repo haría este caso más estricto que aquel en una dimensión que `.gitattributes` nunca
  // prometió, y lo pondría rojo por el borrador que alguien dejó en su árbol. En cuanto se hace
  // `git add` pasa a `A ` y entra: desde ese momento es del autor y va a viajar en el commit.
  const est = execFileSync('git', ['status', '--porcelain=v1', '-z'], {
    cwd: raiz, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  }).split('\0');
  for (let i = 0; i < est.length; i++) {
    const linea = est[i];
    if (!linea) continue;
    const xy = linea.slice(0, 2);
    const ruta = linea.slice(3);
    if (xy[0] === 'R' || xy[0] === 'C' || xy[1] === 'R' || xy[1] === 'C') i += 1; // el origen
    if (xy === '??') continue;                              // borrador, todavía no es del repo
    if (xy === 'D ' || xy === ' D' || xy === 'DD') continue; // borrado: no hay disco que mirar
    if (ruta) rutas.add(ruta);
  }

  return { base, baseResuelta: !!base, rutas: [...rutas] };
}

/** Censo del DISCO restringido a una lista de rutas. Misma clasificación que el censo entero. */
export function censoDeRutas(raiz, rutas, extensiones) {
  const conCR = [];
  let leidos = 0, textos = 0, binarios = 0, sinCR = 0, fueraDeAlcance = 0;
  for (const ruta of rutas) {
    if (extensiones && !extensiones.has(path.extname(ruta).toLowerCase())) { fueraDeAlcance += 1; continue; }
    let cuerpo;
    try { cuerpo = fs.readFileSync(path.join(raiz, ruta)); } catch { continue; }
    leidos += 1;
    const c = clasificarBlob(cuerpo);
    if (!c.texto) { binarios += 1; continue; }
    textos += 1;
    if (c.crlf || c.crSuelto) conCR.push({ ruta, ...c }); else sinCR += 1;
  }
  return { candidatas: rutas.length, fueraDeAlcance, leidos, textos, binarios, sinCR, conCR };
}
