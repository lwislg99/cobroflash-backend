// scripts/_vistas-del-barrido.mjs — SCRUM-821
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// QUÉ PANTALLAS FOTOGRAFÍA EL BARRIDO VISUAL — DERIVADO, NO ESCRITO A MANO.
//
// 🔒 LA LISTA QUE DECIDE QUÉ SE MIRA ERA LA ÚNICA QUE NADIE MIRABA.
//
// `capture-demo.mjs` llevaba `AUTH_VIEWS` a mano: **la cuarta lista mantenida a mano de este
// árbol, y la que decide qué entra en el barrido visual**. `HASH_VIEWS` tiene cinco ficheros de
// tests vigilándola; ésta tenía CERO. Medido el 7-sep-2026:
//
//   el menú OFRECE ....... 17 pantallas
//   el barrido FOTOGRAFÍA. 12 (once del menú + `quotes-new`)
//   ────────────────────────────────────────────────────────────────
//   fuera del barrido .... jobs · albaranes · partes-oficina · cobros · libro-registro · plans
//
// Son la cadena Tecnosel entera —trabajo, albarán, parte por valorar, cobro, libro de registro—:
// el recorrido del único usuario real que tiene el producto.
//
// 🔴 Y ESO EXPLICA SCRUM-720, que costó un día: la pantalla del parte llegó a producción sin CSS
// y con 26 marcadores a la vista **con el recorrido diciendo 8/8**. Con seis pantallas fuera del
// barrido, ese 8/8 no podía haber sido otra cosa.
//
// ⚠️ Y contra `HASH_VIEWS` faltaban DOS MÁS que el hallazgo original no nombraba: `export` y
// `templates`. **Ocho, no seis.** Por eso la derivación sale de `HASH_VIEWS` y no de la barra: la
// barra son las que el menú ofrece; `HASH_VIEWS` son todas las que se pueden abrir por URL, que es
// exactamente lo que el barrido visita.
//
// ⛔ `HASH_VIEWS` y sus cinco tests no se tocan: funcionan, y son el ejemplo que se copia.
// ═════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';

/**
 * Las vistas navegables por hash, leídas de `app.js`.
 *
 * 🔴 SUELO: si no se puede leer la lista, LANZA. Devolver `[]` haría que el barrido no fotografiara
 * nada y que el guard de abajo dijera «no falta ninguna» — las dos cosas verdes y las dos huecas.
 */
export function vistasNavegablesPorHash(raiz) {
  const js = fs.readFileSync(path.join(raiz, 'public/dashboard/js/app.js'), 'utf8');
  const m = js.match(/const HASH_VIEWS = \[([\s\S]*?)\]/);
  if (!m) {
    throw new Error('[barrido] CIEGO: no encuentro `HASH_VIEWS` en app.js. Si cambió de forma hay '
      + 'que enseñarle la nueva ANTES de fiarse de esto, no devolver una lista vacía.');
  }
  const vistas = [...m[1].matchAll(/'([a-z-]+)'/g)].map((x) => x[1]);
  if (vistas.length < 15) {
    throw new Error(`[barrido] CIEGO: sólo ${vistas.length} vistas en \`HASH_VIEWS\` (se esperan 20). `
      + 'Con esa población, «no falta ninguna» significaría que no he mirado.');
  }
  return vistas;
}

/**
 * Las vistas que el MENÚ ofrece. Es la población que un usuario puede alcanzar pulsando.
 *
 * 🔴 SUELO: menos de 17 y se declara ciego.
 */
export function vistasDelMenu(raiz) {
  const html = fs.readFileSync(path.join(raiz, 'public/dashboard/index.html'), 'utf8');
  const vistas = [...new Set([...html.matchAll(/data-view="([^"]+)"/g)].map((x) => x[1]))];
  if (vistas.length < 17) {
    throw new Error(`[barrido] CIEGO: sólo ${vistas.length} destinos en el menú (mínimo 17). `
      + 'Un «ninguna sin fotografiar» sobre tres botones diría que no he mirado.');
  }
  return vistas;
}

/**
 * Pantallas que NO se pueden fotografiar, con su motivo. **Hoy ninguna.**
 *
 * 🔴 EXISTE VACÍO A PROPÓSITO, y es la mitad del ticket: si mañana una pantalla no se puede
 * barrer —porque necesita datos que el barrido no siembra, o un estado que no se puede montar—
 * eso NO es «no se puede»: es un HUECO, y va aquí con su razón. **Un hueco declarado se ve; uno
 * callado no**, y un callado es exactamente lo que dejó seis pantallas fuera durante meses.
 *
 * Se escribe `vista: 'por qué'`, y el guard lo cuenta como conocido en vez de callarlo.
 */
export const HUECOS_DECLARADOS = Object.freeze({});

/**
 * LO QUE EL BARRIDO FOTOGRAFÍA. Derivado de `HASH_VIEWS`, menos los huecos declarados.
 *
 * El nombre del fichero lleva su posición y su vista (`03-customers`): la posición ordena la
 * carpeta y el nombre dice qué es. Ninguno de los dos se mantiene a mano — salen de la lista.
 */
export function vistasDelBarrido(raiz) {
  const vistas = vistasNavegablesPorHash(raiz).filter((v) => !(v in HUECOS_DECLARADOS));
  return vistas.map((vista, i) => ({
    vista,
    nombre: `${String(i + 1).padStart(2, '0')}-${vista}`,
    url: `/dashboard/#${vista}`,
  }));
}

/**
 * El cotejo de las dos poblaciones. **Por CONJUNTOS, no por cuenta.**
 *
 * 🔴 Un número igual no prueba que sean las mismas: es la lección de SCRUM-727. Doce y doce puede
 * ser doce aciertos o seis y seis. Aquí se devuelven los NOMBRES de los que faltan por cada lado,
 * que es lo único accionable.
 *
 * Pura a propósito —recibe las dos listas, no las lee— para poder ponerla en rojo con poblaciones
 * inventadas sin tocar el árbol. Un guard que sólo se puede probar con el repo entero no se
 * prueba.
 */
export function cotejarPoblaciones(delMenu, fotografiadas, huecos = HUECOS_DECLARADOS) {
  const foto = new Set(fotografiadas);
  const sinFoto = delMenu.filter((v) => !foto.has(v) && !(v in huecos)).sort();
  const huecosVigentes = Object.keys(huecos).filter((v) => delMenu.includes(v) && !foto.has(v)).sort();
  const huecosCaducados = Object.keys(huecos).filter((v) => foto.has(v)).sort();
  return { sinFoto, huecosVigentes, huecosCaducados };
}
