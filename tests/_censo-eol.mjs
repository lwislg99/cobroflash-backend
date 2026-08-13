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
 * Y no es incomodidad de merges: **ciega guards en silencio**. `linea.replace(/\/\/.*$/, '')`
 * sobre una línea que arrastra `\r` NO HACE NADA —sin `m`, `$` exige fin de cadena y el `\r` está
 * en medio—, así que un guard que promete «miro el código, no los comentarios» acaba mirando
 * también los comentarios. Le pasó al de SCRUM-409 durante semanas, y solo en Windows.
 */
export function censoArbolDeTrabajo(raiz) {
  const rutas = execFileSync('git', ['ls-files', '-z'], {
    cwd: raiz, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024,
  }).split('\0').filter(Boolean);
  if (rutas.length === 0) throw new Error('🔴 CIEGO: `git ls-files` no devolvió ningún fichero');

  const conCR = [];
  let textos = 0;
  let leidos = 0;
  for (const ruta of rutas) {
    let cuerpo;
    try { cuerpo = fs.readFileSync(path.join(raiz, ruta)); } catch { continue; } // no está en disco
    leidos += 1;
    const c = clasificarBlob(cuerpo);
    if (!c.texto) continue;
    textos += 1;
    if (c.crlf || c.crSuelto) conCR.push({ ruta, ...c });
  }
  return { poblacion: rutas.length, leidos, textos, conCR };
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
