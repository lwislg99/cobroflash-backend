// scripts/_censo-microcopy-sin-marcar.mjs — SCRUM-549 · ¿hay algo publicable sin marcar?
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LA PREGUNTA QUE FALTABA
//
// El bloque F montó un mecanismo bueno: el copy sin aprobar nace `hidden` + marcado, y hay guards
// que impiden publicarlo. **Pero esos guards vigilan lo que está MARCADO.** Nadie vigilaba que
// todo lo publicable estuviera marcado — y lo que se le olvida a alguien marcar se publica sin
// que ningún guard diga nada. Le pasó al titular del bloque de contacto (F7-1): lo cazó el
// extractor de SCRUM-547 por casualidad, no un guard.
//
// Aquí la pregunta es la otra: **¿hay algo publicable sin marcar?**
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LA REGLA, Y ES DERIVADA — no una lista de las cuatro secciones
//
// Se censa **todo elemento con el atributo `hidden`** en la landing y se le exige una explicación,
// de las dos que se pueden derivar del propio fichero:
//
//   ① lleva marcador de microcopy (`data-microcopy` / `data-propuesta`) → está esperando
//      aprobación… **y entonces NINGÚN script puede desocultarlo**, porque desocultarlo es
//      publicar copy sin aprobar. Ésa es la invariante que sostiene todo el mecanismo;
//   ② no lleva marcador y hay un script que lo desoculta → es copy YA aprobado que se enseña
//      cuando hay dato (la barra de anuncio y el banner founding).
//
// Lo que no encaja en ninguna de las dos es el hallazgo: un bloque oculto que nadie ha marcado y
// que nadie desoculta (quedaría muerto), o —el caso que existe— un bloque marcado que un script
// desoculta igual.
//
// 🔴 NO SE BUSCA LA PALABRA «PROPUESTA» EN EL TEXTO, y es deliberado: el propio F5-1 dice
// «PROPUESTA · La diferencia» dentro del copy. Un guard que buscara esa cadena daría rojo
// permanente sobre un texto legítimo — o alguien la excluiría y con ella excluiría a las de
// verdad (aviso de la ficha de SCRUM-549). Aquí se mira la ESTRUCTURA, no el vocabulario.
//
// ⚠️ Y el detector acepta atributos en cualquier orden: es la cuarta vez esta semana que un
// extractor se queda ciego por pedir el `>` pegado a la etiqueta (SCRUM-553).
import fs from 'node:fs';
import path from 'node:path';

export class CensoCiego extends Error {}

export const MARCADORES = ['data-microcopy', 'data-propuesta'];

/**
 * Cuarentena declarada. Cada entrada es un caso REAL que hoy no cumple la regla, con su ticket y
 * su decisión pendiente. No es una excepción: es una deuda con nombre y tope.
 *
 * 🔴 `contacto-publico` está MARCADO y aun así se publica, porque `contacto-publico.js` lo
 * desoculta en cuanto hay UN canal configurado — y `data-email` trae `hola@yaqu.app`. Medido en
 * el navegador el 20-ago-2026: `hidden=false`, `display:block`, con el titular «¿Tienes una duda
 * antes de empezar?» y el enlace de correo VISIBLES. El comentario del HTML dice que el bloque
 * «no aparece» sin `data-whatsapp`, y eso no es lo que hace el código.
 *
 * Lo decide el fundador (alcance 4 de SCRUM-549), y son dos caminos: vaciar `data-email` hasta
 * que el canal esté decidido, o aprobar los textos de F7. **Ninguno lo elige una sesión.**
 */
export const CUARENTENA = {
  'contacto-publico': {
    ticket: 'SCRUM-549',
    motivo: 'marcado como pendiente y aun así se publica: el script lo desoculta porque hay un correo configurado',
    decide: 'el fundador — vaciar `data-email` o aprobar el copy de F7',
  },
};
export const CUARENTENA_MAX = 1;

/** Elementos con `hidden`, con sus atributos, aceptando cualquier orden. */
export function elementosOcultos(html) {
  const out = [];
  const re = /<([a-zA-Z][a-zA-Z0-9]*)((?:\s+[a-zA-Z_:][-a-zA-Z0-9_:.]*(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*\/?>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[2] || '';
    // `hidden` como atributo suelto, en cualquier posición. No se pide que toque al `>`.
    if (!/(^|\s)hidden(\s|=|$)/.test(attrs)) continue;
    const id = (attrs.match(/\sid\s*=\s*"([^"]*)"/) || [])[1] || null;
    out.push({
      tag: m[1],
      id,
      attrs,
      marcado: MARCADORES.some((k) => new RegExp('\\s' + k + '\\s*=').test(attrs)),
      linea: html.slice(0, m.index).split(String.fromCharCode(10)).length,
    });
  }
  return out;
}

/**
 * ¿Algún script de la página desoculta este id? Se mira el HTML entero (el script inline) y los
 * `.js` de `public/js/`, porque el bloque de contacto se desoculta desde un fichero aparte.
 */
export function loDesocultaUnScript(raiz, html, id) {
  if (!id) return false;
  const fuentes = [html];
  const dir = path.join(raiz, 'public', 'js');
  try { for (const f of fs.readdirSync(dir)) if (f.endsWith('.js')) fuentes.push(fs.readFileSync(path.join(dir, f), 'utf8')); } catch { /* sin js sueltos */ }

  for (const src of fuentes) {
    // (a) por id explícito: getElementById('x') … hidden = false
    const porId = new RegExp('getElementById\\(\\s*[\'"]' + id + '[\'"]\\s*\\)[\\s\\S]{0,400}?hidden\\s*=\\s*(false|!1)');
    if (porId.test(src)) return true;
    // (b) el fichero se ancla a ese id en una variable y luego la desoculta.
    const anclaje = new RegExp('(?:querySelector|getElementById)\\(\\s*[\'"]#?' + id + '[\'"]\\s*\\)');
    if (anclaje.test(src) && /hidden\s*=\s*(false|!1)/.test(src)) return true;
  }
  return false;
}

/**
 * El censo. 🔴 SUELO: si no encuentra NI UN elemento oculto, **lanza**: la landing tiene cinco, y
 * un cero significa que el detector dejó de reconocerlos, no que no haya nada que vigilar.
 */
export function censar(raiz) {
  const html = fs.readFileSync(path.join(raiz, 'public', 'index.html'), 'utf8');
  const ocultos = elementosOcultos(html);
  if (ocultos.length === 0) {
    throw new CensoCiego(
      'CIEGO: cero elementos con `hidden` en la landing. Un cero aquí no es «no hay nada ' +
      'pendiente»: es que el detector dejó de reconocerlos, y entonces todo pasa sin mirar.',
    );
  }
  return ocultos.map((e) => {
    const desoculta = loDesocultaUnScript(raiz, html, e.id);
    let clase;
    if (e.marcado && !desoculta) clase = 'marcado-y-oculto';
    else if (e.marcado && desoculta) clase = 'MARCADO-PERO-SE-PUBLICA';
    else if (!e.marcado && desoculta) clase = 'oculto-por-dato';
    else clase = 'OCULTO-SIN-MARCAR-Y-SIN-QUIEN-LO-ENSENE';
    return { ...e, desoculta, clase };
  });
}

/** Los que incumplen la regla y no están en cuarentena declarada. */
export function infracciones(censo) {
  return censo.filter((e) => e.clase !== 'marcado-y-oculto' && e.clase !== 'oculto-por-dato' && !(e.id in CUARENTENA));
}
