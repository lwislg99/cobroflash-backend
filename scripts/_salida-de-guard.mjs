// scripts/_salida-de-guard.mjs — SCRUM-554 (rebote) · qué significa el número con el que
// terminó un guard de navegador, y —lo único que importa— SI ESE NÚMERO LO ELIGIÓ ÉL.
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 «CAYÓ» Y «LO MATARON» SE LEEN IGUAL EN UN NÚMERO
// ═══════════════════════════════════════════════════════════════════════════════════════════
//
// El 16-sep-2026 `censo-guards-navegador.mjs` imprimió `guard:caja-documento-suelto  rojo(143)`
// y ese renglón se reportó como hallazgo: «hay un rojo vivo que nadie ve». NO LO HABÍA. Corrido
// solo, ese guard da rc=0 en 7 s. El 143 lo puso un `timeout` externo que envolvía al censo
// entero y se llevó por delante al cuarto hijo.
//
// El censo no se equivocó al leer el número: se equivocó al ASUMIR QUE ERA DEL GUARD. Cualquier
// código distinto de 0 y 2 lo pintaba `rojo(N)`, que es la frase «este guard midió y encontró un
// defecto». Y un rojo falso que nadie quita no es inofensivo: enseña a relanzar la tanda, y el
// día que el rojo sea de verdad también se relanzará.
//
// ── LO QUE UN GUARD DE NAVEGADOR PUEDE ELEGIR ──────────────────────────────────────────────
// No es una lista inventada aquí: ya está escrita, y se IMPORTA en vez de copiarse.
//   0 verde · 1 hallazgo · 2 CIEGO · 3 NO ARRANCA · 4 SIN SERVIDOR
// Los tres últimos son cegueras, no defectos — y el censo los pintaba `rojo(3)` y `rojo(4)`
// igual que un hallazgo. Ése es el MISMO error que el del 143, sólo que con números que sí
// existen: confundir «no llegué a mirar» con «miré y hay algo».
//
// ── ⚠️ EL LÍMITE, MEDIDO EN ESTA MÁQUINA Y NO SUPUESTO ─────────────────────────────────────
// La corrección obvia sería mirar `r.signal`. NO SIRVE AQUÍ, y se comprobó antes de escribir
// esto (win32, `spawnSync`, tres hijos):
//
//     hijo que hace process.kill(self,'SIGTERM') → status=1    signal=null
//     hijo que hace process.exit(143)            → status=143  signal=null
//     hijo matado por el `timeout` de spawnSync  → status=null  signal='SIGTERM'  (ETIMEDOUT)
//
// O sea: en Windows un kill externo llega como UN ESTADO NORMAL, sin señal. `r.signal` sólo
// aparece en el caso del tope, que ya tenía rama propia. Por eso aquí NO se pregunta «¿hubo
// señal?» sino «¿es un número de los que este guard sabe decir?», que es lo que sí se puede
// medir en las dos plataformas.
//
// Y de ahí el nombre de la etiqueta. NO dice `MATADO`: en win32 un 143 elegido a propósito y un
// 143 impuesto son indistinguibles, y afirmar la causa sería inventarse la mitad que no se ve.
// Dice lo que consta: el número está FUERA DEL VOCABULARIO, así que no es un veredicto.
//
// ── POR QUÉ AQUÍ Y NO EN `guards-visuales.mjs` ─────────────────────────────────────────────
// 🔴 Esa puerta hace lo contrario A PROPÓSITO —código desconocido cuenta como DEFECTO— y lleva
// su motivo escrito: es la que BLOQUEA EL MERGE en CI, y ahí leer un defecto como ceguera lo
// convierte en «cosa de infraestructura», se relanza el job y el defecto mergea. Fail-closed en
// la dirección que importa. AQUÍ no aplica: este censo no tiene salida de fallo —sus únicos
// `process.exit` son su propio suelo y `--solo-censo`—, no gatea nada, y su único producto es
// una tabla que lee una persona. Sin puerta que cerrar no hay nada que dejar abierto: lo único
// que se juega es si esa persona sale a buscar un defecto que no existe.
import { VOCABULARIO } from './guards-visuales.mjs';

/** Un guard es CIEGO/NO ARRANCA/SIN SERVIDOR: no llegó a medir. Distinto de «midió y hay algo». */
export function estadoDeLaSalida(r) {
  if (r && r.error && r.error.code === 'ETIMEDOUT') return 'TOPE';
  if (r && r.signal) return 'MATADO(' + r.signal + ') · NO MEDIDO';
  const v = VOCABULARIO.get(r ? r.status : undefined);
  if (!v) return 'FUERA DEL VOCABULARIO(' + (r ? r.status : r) + ') · NO MEDIDO';
  if (!v.midio) return v.etiqueta;
  return r.status === 0 ? 'verde' : 'rojo(' + r.status + ')';
}

/** ¿Ese estado significa que el guard llegó a medir y dio un veredicto suyo? */
export function esVeredictoDelGuard(estado) {
  return estado === 'verde' || /^rojo\(/.test(estado);
}
