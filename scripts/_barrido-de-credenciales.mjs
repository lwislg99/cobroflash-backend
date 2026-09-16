// scripts/_barrido-de-credenciales.mjs — SCRUM-835
//
// El barrido sobre el repositorio, separado del detector para que el detector se pueda ejercitar
// sin git y el barrido se pueda ejercitar sin inventar credenciales.
//
// 🔴 LEE EN FLUJO. La primera versión lanzaba un `git cat-file blob` por objeto: sobre 10.156
// blobs no terminó en 15 minutos. Con `--batch` y un solo subproceso son ~6,7 s (medido el
// 9-sep-2026). No es una optimización: es la diferencia entre un guard que corre y uno que se
// desactiva.
import { spawn, execFileSync } from 'node:child_process';
import { credencialesEn } from './_credenciales-en-texto.mjs';

/** Por encima de esto son artefactos. Se DECLARAN como no leídos en vez de callarlos. */
export const TOPE_BYTES = 2 * 1024 * 1024;

/**
 * Los blobs ALCANZABLES desde alguna ref — ramas locales, `refs/remotes/origin/*`, etiquetas.
 *
 * ── 🔴 POR QUÉ ALCANZABLES Y NO `--batch-all-objects` (corregido el 9-sep-2026) ─────────────
 * La primera versión leía TODOS los objetos del almacén, «porque un blob suelto también está
 * publicado». **Es falso, y me costó un rojo propio para verlo.**
 *
 * Lo que está publicado es lo que se EMPUJÓ, y eso es lo alcanzable desde una ref. Un objeto
 * suelto de un clon de trabajo es basura LOCAL: un commit enmendado, una rama descartada, un
 * `reset` de hace diez minutos. Nunca salió de esta máquina. Contarlo tiene dos costes y ninguna
 * ventaja:
 *
 *   ① **acusa de publicar algo que no se publicó**, y encima obliga a `git gc --prune=now` para
 *      limpiarlo — sobre un `.git` que aquí COMPARTEN seis worktrees (norma A15);
 *   ② **no es lo que ve CI**, que clona y por tanto sólo recibe lo alcanzable. Un guard que en
 *      local mide otra población que en CI produce rojos que no se reproducen, y ésos se apagan.
 *
 * ⚠️ Lo que este cambio NO pierde, que es el caso del ticket: una clave introducida en un commit
 * y BORRADA en el siguiente **sigue saliendo**, porque el commit que la introdujo sigue siendo
 * alcanzable desde `main`. Está fijado por el control positivo sembrado del guard.
 */
export function blobsDelRepositorio(raiz) {
  const alcanzables = new Set();
  const rl = execFileSync('git', ['rev-list', '--objects', '--all'],
    { cwd: raiz, encoding: 'utf8', maxBuffer: 1 << 30 });
  for (const l of rl.split('\n')) {
    const oid = l.slice(0, 40);
    if (/^[0-9a-f]{40}$/.test(oid)) alcanzables.add(oid);
  }
  const salida = execFileSync('git',
    ['cat-file', '--batch-all-objects', '--batch-check=%(objectname) %(objecttype) %(objectsize)'],
    { cwd: raiz, encoding: 'utf8', maxBuffer: 1 << 30 });
  const out = [];
  for (const l of salida.split('\n')) {
    const [oid, tipo, tam] = l.trim().split(/\s+/);
    if (tipo === 'blob' && alcanzables.has(oid)) out.push({ oid, tam: Number(tam) });
  }
  return out;
}

/**
 * Barre los blobs que se le den y devuelve `{ leidos, saltados, binarios, hallazgos }`.
 * `hallazgos` lleva `{ oid, tipo }` — **jamás el valor**.
 */
export function barrer(raiz, blobs) {
  const aLeer = blobs.filter((b) => b.tam <= TOPE_BYTES);
  const saltados = blobs.length - aLeer.length;
  return new Promise((resolver, rechazar) => {
    if (!aLeer.length) { resolver({ leidos: 0, saltados, binarios: 0, hallazgos: [] }); return; }
    const hijo = spawn('git', ['cat-file', '--batch'], { cwd: raiz });
    hijo.on('error', rechazar);
    hijo.stdin.on('error', () => { /* el hijo puede cerrar antes de tragarse la lista entera */ });
    hijo.stdin.write(aLeer.map((b) => b.oid).join('\n') + '\n');
    hijo.stdin.end();

    let buf = Buffer.alloc(0);
    let cabecera = true;
    let pendiente = 0;
    let oid = null;
    let leidos = 0;
    let binarios = 0;
    const hallazgos = [];

    hijo.stdout.on('data', (d) => {
      buf = Buffer.concat([buf, d]);
      for (;;) {
        if (cabecera) {
          const nl = buf.indexOf(0x0a);
          if (nl < 0) return;
          const cab = buf.subarray(0, nl).toString('utf8').trim().split(/\s+/);
          buf = buf.subarray(nl + 1);
          oid = cab[0];
          pendiente = Number(cab[2]);
          cabecera = false;
        }
        if (buf.length < pendiente + 1) return;
        const cuerpo = buf.subarray(0, pendiente);
        buf = buf.subarray(pendiente + 1); // +1: el salto de línea que git añade
        cabecera = true;
        leidos++;
        // Binario por CONTENIDO (un NUL en los primeros 8 KB), no por extensión: un blob suelto
        // no tiene nombre, así que la extensión no existe a este nivel.
        if (cuerpo.subarray(0, 8192).includes(0)) { binarios++; continue; }
        for (const h of credencialesEn(cuerpo.toString('utf8'))) hallazgos.push({ oid, tipo: h.tipo });
      }
    });
    hijo.on('close', () => resolver({ leidos, saltados, binarios, hallazgos }));
  });
}

/** Dónde vive un blob, para poder decir el fichero sin decir el contenido. */
export function rutasDe(raiz, oids) {
  const buscados = new Set(oids);
  const rutas = new Map();
  const salida = execFileSync('git', ['rev-list', '--all', '--objects'],
    { cwd: raiz, encoding: 'utf8', maxBuffer: 1 << 30 });
  for (const l of salida.split('\n')) {
    const i = l.indexOf(' ');
    if (i > 0) {
      const oid = l.slice(0, i);
      if (buscados.has(oid) && !rutas.has(oid)) rutas.set(oid, l.slice(i + 1));
    }
  }
  return rutas;
}
