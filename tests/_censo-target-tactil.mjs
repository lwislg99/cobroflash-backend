// tests/_censo-target-tactil.mjs — SCRUM-352: simula la cascada de `min-height` para cada
// combinación de clases de botón, a un ancho dado. Puro: recibe el CSS, devuelve alturas.
//
// ── QUÉ PREGUNTA CONTESTA ────────────────────────────────────────────────────
// `styles.css:376-377` promete por escrito que `.btn-primary` y compañía «también funcionan
// solas». La promesa se comprueba de una sola forma: **midiendo lo mismo con y sin la base**.
// Por eso este censo NO afirma «todos los botones miden 44» —que sería falso y además no es lo
// que dice DESIGN.md— sino la promesa literal: para CADA combinación, sola == con `.btn`.
//
// Esa formulación es la que hace visible el error que casi se cuela: llevar el bump a las
// variantes SIN `:not(.btn-sm)` hacía que `btn-primary btn-sm` midiera 44 y su gemelo
// `btn btn-primary btn-sm` siguiera en 30. Un guard escrito como «todos ≥ 44» habría dado verde
// a esa asimetría; uno escrito como «sola == con base» la caza.
//
// ── LO QUE NO SE MIDE AQUÍ ───────────────────────────────────────────────────
// El escritorio a 36 px NO es un defecto: DESIGN.md pide «≥44 px EN MÓVIL», y con ratón 36
// cumple. Por eso el umbral de 44 solo se exige por debajo del breakpoint.
import { parsearReglas, compuestos, analizarCompuesto, especificidad, mayor, censarClasesDeBoton }
  from './_censo-anillo-foco.mjs';

/** Clases citadas dentro de `:not(...)` en un compuesto. */
function clasesNegadas(comp) {
  return [...comp.matchAll(/:not\(([^)]*)\)/g)]
    .flatMap((m) => [...m[1].matchAll(/\.([-\w]+)/g)].map((x) => x[1]));
}

/** Clases exigidas por un compuesto, sin contar las que van dentro de `:not(...)`. */
function clasesExigidas(comp) {
  return analizarCompuesto(comp.replace(/:not\([^)]*\)/g, '')).clases;
}

/**
 * ¿Este compuesto casa un elemento con exactamente el conjunto de clases `tiene`?
 * Estado en reposo: se descartan las reglas que exigen `:hover`, `:focus`, `:disabled`…
 */
function casa(comp, tiene) {
  const limpio = comp.replace(/:not\([^)]*\)/g, '');
  const x = analizarCompuesto(limpio);
  if (x.ids.length || x.atributos.length || x.pseudoElems.length || x.pseudos.length) return false;
  if (x.tag && x.tag !== 'button' && x.tag !== 'a') return false;
  if (!x.clases.length) return false;
  if (!clasesExigidas(comp).every((c) => tiene.includes(c))) return false;
  return !clasesNegadas(comp).some((c) => tiene.includes(c));
}

/** ¿La condición `@media` aplica a este ancho? Solo se interpretan las de ancho. */
function mediaAplica(cond, ancho) {
  if (/prefers-|print|hover|pointer/.test(cond)) return false;
  let ok = true;
  for (const m of cond.matchAll(/\(\s*(max|min)-width\s*:\s*(\d+)px\s*\)/g)) {
    ok = ok && (m[1] === 'max' ? ancho <= Number(m[2]) : ancho >= Number(m[2]));
  }
  return ok;
}

/**
 * Altura mínima que gana para un conjunto de clases a un ancho dado.
 * Solo se consideran los selectores de UN compuesto (sin ancestros): un botón suelto.
 */
export function minHeightDe(reglas, clases, ancho) {
  let ganador = null;
  for (const r of reglas) {
    const mh = r.decls.get('min-height');
    if (mh === undefined) continue;
    if (!r.medias.every((c) => mediaAplica(c, ancho))) continue;
    for (const sel of r.selectores) {
      const partes = compuestos(sel);
      if (partes.length !== 1) continue;
      if (!casa(partes[0], clases)) continue;
      const esp = especificidad(sel);
      if (!ganador || mayor(esp, ganador.esp) || (!mayor(ganador.esp, esp) && r.orden >= ganador.orden)) {
        ganador = { esp, orden: r.orden, valor: mh, selector: sel };
      }
    }
  }
  return ganador ? { px: parseFloat(ganador.valor), selector: ganador.selector } : null;
}

/**
 * DERIVA modificadores y variantes del CSS.
 * - modificador: clase que el CSS escribe pegada a la base (`.btn.btn-sm`) — un ajuste de tamaño.
 * - variante: el resto de clases de botón (`.btn-primary`, `.btn-secondary`…).
 */
export function derivarFamilias(reglas) {
  const clases = censarClasesDeBoton(reglas);
  const modificadores = new Set();
  for (const r of reglas) {
    for (const sel of r.selectores) {
      for (const comp of compuestos(sel)) {
        const cs = clasesExigidas(comp);
        if (cs.length === 2 && cs.includes('btn')) modificadores.add(cs.find((c) => c !== 'btn'));
      }
    }
  }
  return {
    variantes: clases.filter((c) => !modificadores.has(c)),
    modificadores: [...modificadores].sort(),
    todas: clases,
  };
}

/**
 * Censo: para cada variante × modificador, la altura CON y SIN la base, al ancho pedido.
 */
export function censarTargetTactil(cssCrudo, ancho) {
  const reglas = parsearReglas(cssCrudo);
  const { variantes, modificadores } = derivarFamilias(reglas);
  const filas = [];
  for (const v of variantes) {
    for (const mod of [null, ...modificadores]) {
      const sinBase = [v, ...(mod ? [mod] : [])];
      const conBase = ['btn', ...sinBase];
      const a = minHeightDe(reglas, sinBase, ancho);
      const b = minHeightDe(reglas, conBase, ancho);
      filas.push({
        combinacion: sinBase.join(' '),
        variante: v,
        modificador: mod,
        solaPx: a ? a.px : null,
        conBasePx: b ? b.px : null,
        solaSelector: a ? a.selector : null,
        conBaseSelector: b ? b.selector : null,
        simetrica: (a ? a.px : null) === (b ? b.px : null),
      });
    }
  }
  return { ancho, variantes, modificadores, filas };
}
