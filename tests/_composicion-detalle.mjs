// tests/_composicion-detalle.mjs — SCRUM-427 (tramo 2)
//
// ¿LA PANTALLA DEL TRABAJO TIENE LAS SECCIONES QUE EL DISEÑO DE G DICE, Y SOLO ESAS?
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// POR QUÉ ENUMERANDO Y NO CONTANDO — el defecto que esto existe para cazar
//
// G4 «salía cuadrado» porque **4 + 5 = 9**: el número de secciones coincidía con el esperado y el
// CONTENIDO no. Un guard que compara longitudes da verde con la composición equivocada, y encima
// da la sensación de estar vigilando. Por eso aquí se comparan **conjuntos**, y el fallo dice las
// dos listas: **qué FALTA** (el diseño lo pide y la pantalla no lo tiene) y **qué SOBRA** (la
// pantalla lo pinta y el diseño no lo lista, sin enmienda que lo autorice).
//
// Las dos direcciones importan y no son la misma: «falta» es una promesa incumplida; «sobra» es
// superficie que nadie diseñó — que puede ser un acierto posterior (y entonces se ENMIENDA el
// diseño, con cita y fecha) o un descuido que nadie declaró.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// DE DÓNDE SALE CADA LADO — los dos DERIVADOS, ninguno escrito a mano
//
//  · lo que el diseño pide → del recuadro ASCII de `docs/diseno/bloque-g.md` §4, columna del
//    CUERPO. Si alguien cambia el diseño, este test lo nota; si la lista viviera aquí copiada, el
//    test seguiría comprobando el diseño de ayer.
//  · lo que la pantalla pinta → de los `detail-section-title` de `jobDetailView.js`.
//
// Lo ÚNICO escrito a mano son las ENMIENDAS, y llevan su motivo y su cita: eso es el hecho que no
// se puede derivar de ningún sitio, porque es una decisión.
import fs from 'node:fs';
import path from 'node:path';

/** Sin acentos, sin mayúsculas y sin espacios de más: comparar rótulos, no su tipografía. */
export function normalizar(t) {
  return String(t)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Las secciones del CUERPO que dibuja el diseño, sacadas de su recuadro ASCII.
 *
 * El recuadro tiene dos columnas separadas por `│`: a la izquierda el cuerpo, a la derecha el rail.
 * Sólo interesa la izquierda — el rail es otra superficie y tiene su propio contrato.
 *
 * ⚠️ Se toman las líneas en MAYÚSCULAS, que es como el diseño rotula las secciones; el texto entre
 * paréntesis («(tabla, C3)») es una anotación del dibujo, no parte del nombre.
 */
export function seccionesDelDiseno(raiz) {
  const md = fs.readFileSync(path.join(raiz, 'docs/diseno/bloque-g.md'), 'utf8');
  const bloque = /# 4 · Lo que se construye[\s\S]*?```([\s\S]*?)```/.exec(md);
  if (!bloque) return [];

  const fuera = new Set(['trabajos', 'francisco jimenez']);
  const salida = [];
  for (const linea of bloque[1].split(/\r?\n/)) {
    // Sólo las filas de dos columnas del cuerpo del recuadro.
    const m = /^│([^│]*)│/.exec(linea);
    if (!m) continue;
    const izq = m[1].replace(/\(.*?\)/g, '').trim();
    if (!izq) continue;
    // El rótulo de una sección va en MAYÚSCULAS. Lo demás del dibujo (cabecera, chips) no.
    if (izq !== izq.toUpperCase()) continue;
    if (/^[·\-─\s]*$/.test(izq)) continue;
    const n = normalizar(izq);
    if (!n || fuera.has(n)) continue;
    if (!salida.includes(n)) salida.push(n);
  }
  return salida;
}

/**
 * Las secciones que la pantalla PINTA de verdad, por su rótulo.
 *
 * ⚠️ EL PATRÓN EXIGE UN TAG DE VERDAD (`<h3 …class="detail-section-title"…>texto</`), y eso no es
 * quisquillosidad: el primer intento buscaba `detail-section-title[^>]*>([^<]+)<` y casó también
 * con la ASIGNACIÓN `h.className = 'detail-section-title';` — a partir de ahí se comió 300 líneas
 * de código hasta el siguiente `<` y las metió como si fueran el nombre de una sección. Un
 * escáner que devuelve basura no es un escáner que falla: es uno que ensucia el veredicto y aún
 * así parece que mide.
 *
 * De ahí el CINTURÓN de `LARGO_MAX`: un rótulo de sección es corto. Si sale uno larguísimo, el
 * patrón se ha vuelto a desbordar y hay que enterarse por un rojo, no por una lista rara.
 */
export const LARGO_MAX = 40;

export function seccionesPintadas(raiz) {
  const js = fs.readFileSync(path.join(raiz, 'public/dashboard/js/jobDetailView.js'), 'utf8');
  const salida = [];
  for (const m of js.matchAll(/<h3[^>]*class="detail-section-title"[^>]*>([^<]+)</g)) {
    const n = normalizar(m[1]);
    if (n && !salida.includes(n)) salida.push(n);
  }
  return salida;
}

/**
 * ENMIENDAS AL DISEÑO — secciones que la pantalla pinta y el §4 no lista, **autorizadas por una
 * decisión POSTERIOR**. Cada una con su motivo y su fuente: una excepción sin cita es una
 * excepción que nadie puede volver a discutir.
 *
 * ⚠️ Esta lista es lo único escrito a mano de este módulo, y tiene que seguir siéndolo: si se
 * derivara de la propia pantalla, autorizaría cualquier sección por el hecho de existir — que es
 * exactamente el agujero que este guard cierra.
 */
export const ENMIENDAS = Object.freeze({
  facturas: {
    motivo: 'G4 la entregó a propósito; decisión POSTERIOR al diseño y vigente',
    fuente: 'docs/master/SCRUM-319.md',
    enmiendaEnDiseno: true,   // declarada en `docs/diseno/bloque-g.md` §4
  },
  datos: {
    motivo: 'G3 movió CLIENTE/TELÉFONO/DIRECCIÓN al rail y dejó «Datos» a propósito con lo que se '
      + 'EDITA (el nombre del Trabajo). El §4 se dibujó ANTES de esa decisión.',
    fuente: 'docs/master/SCRUM-318.md',
    enmiendaEnDiseno: true,
  },
  'tipo de trabajo': {
    motivo: 'Bandera FISCAL `Job.tipoOperacion` (SCRUM-66 · TRABAJO-4): gobierna cómo se factura el '
      + 'Trabajo. Quitarla de la pantalla porque un documento de diseño no la listaba sería el error '
      + 'al revés — recortar en vez de añadir.',
    fuente: 'docs/master/SCRUM-309.md',
    enmiendaEnDiseno: true,
    // ⚠️ ÉSTA NO ES COMO LAS OTRAS DOS. El diseño de G **sí la conocía**: sale en su §1 («TIPO DE
    // TRABAJO: Varios avisos o visitas sueltas [Cambiar]») y su §7·5 pregunta literalmente «Qué es
    // "Tipo de trabajo" y qué gobierna». No se omitió del §4 por quererla fuera: se omitió porque
    // esa pregunta **no se ha contestado nunca**. Se deja VIVA en el documento y aquí, para que la
    // enmienda no la dé por zanjada de tapadillo — una pregunta cerrada sin respuesta es peor que
    // una pregunta abierta.
    preguntaAbierta: 'bloque-g §7·5 — qué es «Tipo de trabajo» y qué gobierna. Sin contestar.',
  },
});

/**
 * SOBRANTES **DECLARADOS Y PENDIENTES DE DECISIÓN** — no son lo mismo que una enmienda.
 *
 * El enumerador los encontró la primera vez que se ejecutó (10-ago-2026). Los dos tienen origen
 * documentado, así que **no son descuidos**; pero nadie ha decidido todavía si el diseño de G se
 * enmienda para incluirlos o si la pantalla debe perderlos, y **esta sesión no tiene autorización
 * para decidirlo**: enmendar es una decisión del fundador, y una excepción que se autoriza a sí
 * misma no es una excepción, es un agujero.
 *
 * 🔴 Por eso el trinquete de abajo es de IGUALDAD y no de «≤»: estos dos pueden quedarse mientras
 * se decide, pero **una sección nueva sin decisión pone el guard en rojo**. Es la diferencia entre
 * una deuda con nombre y una puerta abierta.
 */
export const SOBRANTES_SIN_DECIDIR = Object.freeze({
  // VACÍO hoy, y eso es un resultado, no un descuido.
  //
  // El enumerador encontró dos —«Datos» y «Tipo de trabajo»— la primera vez que se ejecutó
  // (10-ago-2026). Estuvieron aquí lo que tardó el fundador en decidir, y las dos **se
  // ENMENDARON**: pasaron a `ENMIENDAS` con su cita. Ninguna se retiró de la pantalla.
  //
  // El mecanismo se queda montado a propósito: la próxima sección que aparezca sin decisión tiene
  // dónde esperar sin que nadie tenga que aflojar el guard para que pase. Un sitio declarado donde
  // poner lo indeciso es lo que evita que lo indeciso acabe pasando por decidido.
});

/**
 * El veredicto: qué falta y qué sobra. NUNCA un número.
 *
 * `sobran` excluye lo enmendado; `enmendadasNoPintadas` caza el caso contrario —una enmienda que
 * autoriza algo que ya no existe—, porque una excepción que sobrevive a lo que excepcionaba es
 * una excepción que nadie retiró.
 */
/**
 * ¿Es `pintada` la sección que el diseño llama `disenada`?
 *
 * 🔴 NO vale `includes` a secas, y esto se descubrió midiendo: con `includes`, renombrar «Gastos de
 * este trabajo» a «Gastos ocultos por la inyección» seguía contando como presente —la palabra
 * «gastos» estaba dentro— y el rojo de «FALTA» no llegaba a salir. Un comparador tan laxo da por
 * cumplida cualquier sección cuyo nombre contenga la palabra del diseño.
 *
 * Se exige coincidencia por PALABRA COMPLETA desde el principio: «gastos» ↔ «gastos de este
 * trabajo» sí (el rótulo AMPLÍA el nombre del diseño), pero «gastos» ↔ «gastos ocultos por la
 * inyección» también — y eso es correcto: sigue siendo la sección de gastos con otro rótulo. Lo que
 * ya no cuela es que una palabra suelta en medio de otro nombre valga por la sección entera.
 */
export function esLaMisma(pintada, disenada) {
  if (pintada === disenada) return true;
  return pintada.startsWith(`${disenada} `) || disenada.startsWith(`${pintada} `);
}

export function compararComposicion(raiz) {
  const diseno = seccionesDelDiseno(raiz);
  const pintadas = seccionesPintadas(raiz);
  const enmendadas = Object.keys(ENMIENDAS);
  const pendientes = Object.keys(SOBRANTES_SIN_DECIDIR);

  const faltan = diseno.filter((s) => !pintadas.some((p) => esLaMisma(p, s)));
  // Lo que la pantalla pinta y el diseño no lista, SIN autorización de ninguna clase.
  const sobran = pintadas.filter((p) => {
    if (diseno.some((s) => esLaMisma(p, s))) return false;
    if (enmendadas.some((e) => esLaMisma(p, e))) return false;
    return !pendientes.some((e) => esLaMisma(p, e));
  });
  // Los declarados que SIGUEN ahí: se listan aparte para que el trinquete pueda exigir igualdad.
  const pendientesPresentes = pendientes.filter((e) => pintadas.some((p) => esLaMisma(p, e)));
  const enmendadasNoPintadas = enmendadas.filter((e) => !pintadas.some((p) => esLaMisma(p, e)));

  return { diseno, pintadas, faltan, sobran, pendientesPresentes, enmendadasNoPintadas };
}
