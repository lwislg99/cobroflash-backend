// tests/_censo-anillo-foco.mjs — SCRUM-368: censo DERIVADO de las clases de botón y de si
// cada una enseña un anillo de foco. Puro: recibe el texto del CSS, devuelve el censo.
// Sin BD, sin red, sin navegador.
//
// ── POR QUÉ DERIVADO Y NO A MANO ─────────────────────────────────────────────
// El defecto de SCRUM-368 no es de una pantalla: es de la clase compartida. Una lista de
// clases escrita a mano contesta «¿sigue bien la que arreglé?» y calla sobre la que se añada
// mañana. Aquí las clases de botón se derivan del propio CSS: son las que aparecen AGRUPADAS
// con `.btn` en algún selector. Una variante nueva que se escriba junto a `.btn` entra sola.
//
// ── EL MECANISMO QUE HAY QUE VIGILAR ─────────────────────────────────────────
// `:focus-visible { box-shadow: var(--ring) }` es una regla global de especificidad (0,1,0).
// Cualquier regla de botón que declare `box-shadow` con esa misma especificidad y aparezca
// DESPUÉS en el archivo se la come, y el foco deja de verse sin que nada avise. Eso es lo que
// le pasaba a `.btn-primary` (sombra de reposo en la línea 412) y, con más especificidad
// todavía, a `.qq-modal .modal-footer .btn-primary` (línea 995).
//
// Por eso el censo no busca texto: SIMULA LA CASCADA (especificidad + orden de aparición) para
// un `<button class="btn X">` en `:focus-visible`, y mira quién gana el `box-shadow`. Es la
// misma pregunta que resuelve el navegador, contestada sobre el CSS real.
//
// ── CONTEXTOS ────────────────────────────────────────────────────────────────
// Un botón no vive siempre suelto. Si el CSS le da `box-shadow` dentro de un ancestro concreto
// (`.qq-modal .modal-footer …`), ESE contexto se evalúa aparte: es un sitio real del producto
// donde el botón puede quedarse sin anillo aunque suelto lo tenga. Los contextos también se
// derivan del CSS, no se enumeran.

/** Quita comentarios /* … *​/ conservando la longitud del resto del texto. */
function sinComentarios(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * Trocea el CSS en reglas planas `{ selectores[], decls, orden }`.
 * Entra en los `@media` (sus reglas participan en la cascada como cualquier otra) y descarta
 * las at-rules que no contienen reglas de estilo aplicables (`@keyframes`).
 */
export function parsearReglas(cssCrudo) {
  const css = sinComentarios(cssCrudo);
  const reglas = [];
  let i = 0;
  let orden = 0;

  const bloque = (desde, hasta, dentroDeKeyframes) => {
    let p = desde;
    while (p < hasta) {
      const llave = css.indexOf('{', p);
      if (llave === -1 || llave >= hasta) break;
      const cabecera = css.slice(p, llave).trim();
      // buscar el cierre equilibrado
      let nivel = 1, q = llave + 1;
      while (q < hasta && nivel > 0) {
        if (css[q] === '{') nivel++;
        else if (css[q] === '}') nivel--;
        q++;
      }
      const cuerpo = css.slice(llave + 1, q - 1);
      if (cabecera.startsWith('@')) {
        // at-rule con bloque: @media/@supports aportan reglas; @keyframes no.
        const esKeyframes = /^@(-\w+-)?keyframes\b/.test(cabecera);
        bloque(llave + 1, q - 1, esKeyframes);
      } else if (!dentroDeKeyframes && cabecera) {
        const decls = new Map();
        for (const trozo of cuerpo.split(';')) {
          const dosPuntos = trozo.indexOf(':');
          if (dosPuntos === -1) continue;
          const prop = trozo.slice(0, dosPuntos).trim();
          const valor = trozo.slice(dosPuntos + 1).trim();
          if (prop && !prop.startsWith('@')) decls.set(prop, valor);
        }
        if (decls.size) {
          reglas.push({
            selectores: cabecera.split(',').map((s) => s.trim()).filter(Boolean),
            decls,
            orden: orden++,
          });
        }
      }
      p = q;
    }
  };

  bloque(0, css.length, false);
  return reglas;
}

/** Parte un selector en compuestos por combinadores. El último es el SUJETO. */
function compuestos(sel) {
  return sel.split(/\s*[>+~]\s*|\s+/).filter(Boolean);
}

/** Descompone un compuesto en `{ clases, pseudos, tag, ids, atributos }`. */
function analizarCompuesto(c) {
  const clases = [...c.matchAll(/\.([-\w]+)/g)].map((m) => m[1]);
  const ids = [...c.matchAll(/#([-\w]+)/g)].map((m) => m[1]);
  const atributos = [...c.matchAll(/\[[^\]]*\]/g)].map((m) => m[0]);
  // pseudo-clases de primer nivel (con su argumento si lo llevan)
  const pseudos = [...c.matchAll(/(?<!:):([-\w]+)(\([^)]*\))?/g)].map((m) => m[1] + (m[2] || ''));
  const pseudoElems = [...c.matchAll(/::([-\w]+)/g)].map((m) => m[1]);
  const tag = /^[a-zA-Z]/.test(c) ? c.match(/^[a-zA-Z][-\w]*/)[0] : null;
  return { clases, ids, atributos, pseudos, pseudoElems, tag };
}

/** Especificidad CSS como terna comparable [ids, clases+pseudos+attrs, tags+pseudoelems]. */
function especificidad(sel) {
  let a = 0, b = 0, c = 0;
  for (const comp of compuestos(sel)) {
    const x = analizarCompuesto(comp);
    a += x.ids.length;
    b += x.clases.length + x.atributos.length + x.pseudos.length;
    c += (x.tag ? 1 : 0) + x.pseudoElems.length;
  }
  return [a, b, c];
}

const mayor = (p, q) => (p[0] !== q[0] ? p[0] > q[0] : p[1] !== q[1] ? p[1] > q[1] : p[2] > q[2]);

// Pseudo-clases compatibles con «el elemento está enfocado por teclado». Cualquier otra
// (`:hover`, `:active`, `:disabled`…) describe OTRO estado: esa regla no decide este.
const PSEUDOS_DE_FOCO = new Set(['focus', 'focus-visible', 'focus-within']);
const PSEUDOS_NEUTRAS = new Set(['root', 'first-child', 'last-child', 'only-child']);

/**
 * ¿El compuesto SUJETO casa un `<button class="btn X">` enfocado por teclado?
 *
 * Acepta a propósito los compuestos SIN clases cuyas pseudo-clases son de foco: `:focus-visible`
 * a secas es la regla global que da el anillo a todo el dashboard y es, literalmente, la que
 * pierde la cascada en el defecto que este censo vigila. Si no casara, el analizador vería a
 * `.btn-secondary` «sin ninguna regla» y la marcaría ciega — al revés de lo que hace el
 * navegador, que es el árbitro (medido con Tab real: .btn-secondary SÍ enseña anillo).
 */
function sujetoCasa(comp, clase) {
  const x = analizarCompuesto(comp);
  if (x.ids.length || x.atributos.length || x.pseudoElems.length) return false;
  if (x.tag && x.tag !== 'button' && x.tag !== 'a' && x.tag !== '*') return false;
  const pseudosCompatibles = x.pseudos.every((p) => {
    const nombre = p.replace(/\(.*/, '');
    return PSEUDOS_DE_FOCO.has(nombre) || PSEUDOS_NEUTRAS.has(nombre);
  });
  if (!pseudosCompatibles) return false;
  if (!x.clases.length) {
    // sin clases: solo cuenta si describe el ESTADO de foco (`:focus-visible`), no cualquier cosa
    return x.pseudos.some((p) => PSEUDOS_DE_FOCO.has(p.replace(/\(.*/, '')));
  }
  // con clases: todas deben estar en el elemento que simulamos
  if (!x.clases.every((k) => k === 'btn' || k === clase)) return false;
  return x.clases.includes(clase) || x.clases.includes('btn');
}

/**
 * DERIVA las clases de botón: las que comparten selector-list con `.btn`.
 * Sin lista escrita a mano — una variante nueva escrita junto a `.btn` entra sola.
 */
export function censarClasesDeBoton(reglas) {
  const clases = new Set();
  for (const r of reglas) {
    const sujetos = r.selectores.map((s) => compuestos(s).at(-1));
    const hayBase = sujetos.some((c) => {
      const x = analizarCompuesto(c);
      return x.clases.length === 1 && x.clases[0] === 'btn';
    });
    if (!hayBase) continue;
    for (const c of sujetos) {
      const x = analizarCompuesto(c);
      if (x.clases.length === 1 && x.clases[0] !== 'btn') clases.add(x.clases[0]);
    }
  }
  return [...clases].sort();
}

/**
 * ¿Este valor de `box-shadow` dibuja un anillo perceptible?
 *
 * Un anillo es una capa con SPREAD (4ª longitud) de al menos 2px: eso es lo que rodea el botón
 * y se ve. La sombra de reposo del primario —`0 1px 2px rgba(…)`— tiene tres longitudes y
 * spread 0: no se ve al enfocar, que es justo el defecto. Se miden las longitudes en vez de
 * casar un patrón porque en CSS el cero va sin unidad (`0 0 0 3px`) y un patrón con `px`
 * obligatorio da un falso negativo silencioso.
 */
export function esAnillo(valor) {
  if (!valor) return false;
  const v = valor.toLowerCase().trim();
  if (!v || v === 'none') return false;
  if (v.includes('var(--ring')) return true;

  // fuera las funciones (`rgba(…)`, `color(…)`): sus números no son longitudes
  const plano = v.replace(/[-\w]*\([^()]*\)/g, ' ');
  for (const capa of plano.split(',')) {
    const largos = [...capa.matchAll(/(^|\s)(-?[\d.]+)(px|rem|em)?(?=\s|$)/g)]
      .map((m) => (m[3] === 'rem' || m[3] === 'em' ? Number(m[2]) * 16 : Number(m[2])));
    if (largos.length >= 4 && largos[3] >= 2) return true;
  }
  return false;
}

/** Contextos de ancestro que el CSS declara para esta clase (además del contexto raso). */
function contextosDe(reglas, clase) {
  const ctxs = new Set(['']);
  for (const r of reglas) {
    if (!r.decls.has('box-shadow')) continue;
    for (const sel of r.selectores) {
      const partes = compuestos(sel);
      if (partes.length < 2) continue;
      if (sujetoCasa(partes.at(-1), clase)) ctxs.add(partes.slice(0, -1).join(' '));
    }
  }
  return [...ctxs];
}

/**
 * Simula la cascada del `box-shadow` para `<button class="btn X">` en `:focus-visible`,
 * en cada contexto de ancestro que el CSS declare. Devuelve el veredicto por clase.
 */
export function censarAnilloDeFoco(cssCrudo) {
  const reglas = parsearReglas(cssCrudo);
  const clases = censarClasesDeBoton(reglas);

  const filas = [];
  for (const clase of clases) {
    for (const ctx of contextosDe(reglas, clase)) {
      let ganador = null;
      for (const r of reglas) {
        const bs = r.decls.get('box-shadow');
        if (bs === undefined) continue;
        for (const sel of r.selectores) {
          const partes = compuestos(sel);
          if (!sujetoCasa(partes.at(-1), clase)) continue;
          const prefijo = partes.slice(0, -1).join(' ');
          // el contexto raso solo ve reglas sin ancestros; un contexto concreto ve las suyas
          if (prefijo && prefijo !== ctx) continue;
          const esp = especificidad(sel);
          if (!ganador || mayor(esp, ganador.esp) || (!mayor(ganador.esp, esp) && r.orden >= ganador.orden)) {
            ganador = { esp, orden: r.orden, valor: bs, selector: sel };
          }
        }
      }
      filas.push({
        clase,
        contexto: ctx,
        selectorGanador: ganador ? ganador.selector : null,
        valor: ganador ? ganador.valor : null,
        tieneAnillo: ganador ? esAnillo(ganador.valor) : false,
      });
    }
  }

  // La regla global existe? Si no, NADIE tiene anillo y el censo no debe decir «todo bien».
  const hayReglaGlobal = reglas.some(
    (r) => r.decls.has('box-shadow') && r.selectores.some((s) => s.trim() === ':focus-visible'),
  );

  return { clases, filas, hayReglaGlobal };
}
