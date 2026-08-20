// scripts/_navegador.mjs — SCRUM-522
//
// DÓNDE ESTÁ EL NAVEGADOR, para que los guards puedan correr en CI y no sólo en el portátil.
//
// ── POR QUÉ HACÍA FALTA ──────────────────────────────────────────────────────────────────────
// Los nueve guards de navegador llevaban la MISMA línea, byte a byte:
//
//     const EDGE = process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/…/msedge.exe';
//
// Una ruta de Windows como valor por defecto. En el runner de CI —Ubuntu— eso no existe, así que
// los nueve figuraban como cobertura y no podían ejecutarse donde de verdad hacía falta.
//
// ── LO QUE ESTO NO HACE ──────────────────────────────────────────────────────────────────────
// 🔴 NO relaja nada, y ésa es la diferencia entre resolver y esconder: si no encuentra ningún
//    navegador, NO devuelve una ruta plausible ni deja que el guard siga. Cada guard conserva su
//    propia comprobación de ceguera, y aquí, si no hay ninguno, se falla NOMBRANDO los sitios en
//    los que se ha mirado.
// 🔴 Y si `EDGE_PATH` está puesta pero apunta a algo que no existe, NO se cae hacia atrás a un
//    candidato. Alguien la puso a propósito: taparlo con otro navegador es medir en un sitio
//    distinto del que se pidió, y el informe diría lo que no es.
//
// ── EL ORDEN DE LOS CANDIDATOS ES DELIBERADO ─────────────────────────────────────────────────
// Edge primero, porque es sobre el que se midió todo lo que hay escrito en la casa. Chrome y
// Chromium después: comparten motor, así que un veredicto suyo vale, pero conviene saber cuál
// contestó — por eso `rutaDelNavegador` devuelve también QUIÉN es.
// Comprobado el 20-ago-2026 en la documentación de la imagen `ubuntu-latest`: trae Edge, Chrome
// y Chromium preinstalados.
import fs from 'node:fs';

/** Dónde se mira, en orden. Cada entrada dice de quién es, para poder decirlo en el informe. */
export const CANDIDATOS = [
  { quien: 'Edge (Windows)', ruta: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' },
  { quien: 'Edge (Windows, 64)', ruta: 'C:/Program Files/Microsoft/Edge/Application/msedge.exe' },
  { quien: 'Edge (Linux)', ruta: '/usr/bin/microsoft-edge' },
  { quien: 'Edge (Linux, stable)', ruta: '/usr/bin/microsoft-edge-stable' },
  { quien: 'Edge (macOS)', ruta: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge' },
  { quien: 'Chrome (Linux)', ruta: '/usr/bin/google-chrome' },
  { quien: 'Chrome (Linux, stable)', ruta: '/usr/bin/google-chrome-stable' },
  { quien: 'Chromium (Linux)', ruta: '/usr/bin/chromium' },
  { quien: 'Chromium (Linux, browser)', ruta: '/usr/bin/chromium-browser' },
];

/**
 * Resuelve el ejecutable. Devuelve `{ ok, ruta, quien, motivo }` — no lanza, para que quien
 * llama decida cómo cantarlo.
 *
 * `existe` se inyecta para poder probar la decisión sin depender de qué haya instalado en la
 * máquina que corre los tests: sin eso, este resolutor sólo se ejercitaría en un sistema
 * operativo y las otras ramas no las miraría nadie.
 */
export function resolverNavegador(env = process.env, existe = fs.existsSync) {
  const pedido = env.EDGE_PATH;
  if (pedido) {
    return existe(pedido)
      ? { ok: true, ruta: pedido, quien: 'EDGE_PATH' }
      : { ok: false, motivo: 'EDGE_PATH apunta a `' + pedido + '` y ahí no hay nada. No se busca otro: '
          + 'si alguien la puso, medir en otro navegador sería medir otra cosa.' };
  }
  for (const c of CANDIDATOS) if (existe(c.ruta)) return { ok: true, ruta: c.ruta, quien: c.quien };
  return {
    ok: false,
    motivo: 'no hay navegador en ninguno de los ' + CANDIDATOS.length + ' sitios conocidos:\n'
      + CANDIDATOS.map((c) => '        · ' + c.ruta + '   (' + c.quien + ')').join('\n')
      + '\n      Pon `EDGE_PATH` apuntando al tuyo.',
  };
}

/**
 * La ruta, o se para. Es lo que usan los guards: un guard que no encuentra navegador NO puede
 * seguir y NO puede pasar — «no hay defectos» y «no supe mirar» son el mismo verde.
 */
export function rutaDelNavegador() {
  const r = resolverNavegador();
  if (r.ok) return r.ruta;
  console.error('🔴 NO SUPE MIRAR: ' + r.motivo);
  process.exit(2);
}
