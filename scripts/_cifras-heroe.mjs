// scripts/_cifras-heroe.mjs — SCRUM-331 (F4) · toda cifra del héroe, con su procedencia escrita.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ EXISTE
//
// El héroe es la frase más importante del producto, y es donde una cifra inventada hace más
// daño: quien la lee no tiene forma de saber que nadie la midió. El ticket de F4 llegó con una
// («un visitante decide en noventa segundos») y se retiró antes de escribir código.
//
// Pero al medir el héroe PUBLICADO apareció otra, ya viva: **«Listo en 5 minutos»**. Y no es que
// esté sin medir: **D0 (SCRUM-310) midió que ese número no se puede medir hoy** —
//
//   «Los segundos no son medibles desde el árbol y no se estiman: dependen de la latencia de
//    Resend y del filtro de spam del destinatario, que no están en el repo.»
//
// — y además el camino de alta cruza **la bandeja de entrada del usuario** (magic link), que no
// controlamos. No se toca aquí: es copy publicado y el copy de la landing ES el máster (A22,
// regla 30). Lo que se hace es **declararlo y que no pueda crecer**.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LA REGLA
//
// Toda cifra de la COPIA del héroe está en el censo de abajo con su procedencia. Una cifra nueva
// sin entrada pone la suite en rojo nombrándola. Y las que están SIN FUENTE no pueden aumentar:
// hoy hay una, y su sitio es una decisión del fundador, no un olvido.
//
// ⚠️ LA DECORACIÓN NO ENTRA, y la distinción es deliberada. Dentro de `.stage` hay una escena
// animada con un presupuesto de ejemplo (cliente «José Luis Martín», 961,95 €). Eso es un
// mockup rotulado como demostración, no una afirmación sobre el mundo: censarlo obligaría a
// documentar la procedencia de un decorado y acabaría diluyendo el censo de lo que sí afirma.
// Lo que se vigila de la escena es OTRA cosa, y va en el test: que no se cuele ahí un testimonio.

/**
 * El bloque crudo del héroe, tal cual está en el fichero.
 *
 * ⚠️ SCRUM-546: se buscaba `<section class="hero">` con el `>` PEGADO, y eso ataba el extractor a
 * que la etiqueta no tuviera ni un atributo más. SCRUM-543 le añadió `aria-labelledby` al héroe
 * —para que la sección llegue como región con nombre— y este extractor dejó de encontrarlo: los
 * cuatro tests de SCRUM-331 cayeron declarándose CIEGOS, que es lo que su suelo tenía que hacer.
 * Se busca sin el `>`, así que un atributo nuevo ya no lo rompe. Sigue devolviendo el PRIMER
 * héroe del fichero, que es el publicado; el `id="heroe-f4"` de la variante en propuesta va
 * después y no se toca.
 */
export function bloqueHeroe(html) {
  const i = String(html).indexOf('<section class="hero"');
  if (i === -1) return null;
  const j = String(html).indexOf('</section>', i);
  return j === -1 ? null : String(html).slice(i, j + 10);
}

/**
 * El texto que el héroe AFIRMA: lo publicado, sin comentarios y **sin la escena decorativa**.
 *
 * Se quita `.stage` entera por lo dicho arriba. Si algún día la escena deja de estar ahí, este
 * extractor devuelve el texto igual y el censo sigue funcionando: no depende de que exista.
 */
export function textoDeCopia(bloque) {
  let s = String(bloque ?? '');
  s = s.replace(/<!--[\s\S]*?-->/g, ' ');
  // La escena: desde `<div class="stage"` hasta el final del bloque (es lo último del héroe).
  const st = s.indexOf('<div class="stage"');
  if (st !== -1) s = s.slice(0, st);
  s = s.replace(/<[^>]+>/g, ' ');
  return s.replace(/[ \t\r\n]+/g, ' ').trim();
}

/** Las cifras de la copia, en el orden en que se leen. */
export function cifrasDeCopia(texto) {
  return String(texto ?? '').match(/[0-9][0-9.,]*\s*(?:%|€|segundos|minutos|días|dias|horas)?/g) || [];
}

/**
 * EL CENSO. Cada cifra de la copia del héroe, con de dónde sale.
 *
 * `fuente` = se puede ir a mirar. `sinFuente` = nadie la midió, y se dice con esas palabras.
 */
export const CENSO = {
  '30 segundos': {
    fuente: 'docs/YAQU_MASTER.md · A1 y PROJECT BRIEF: «crea la cotización en 30 segundos». ' +
      'Es la promesa del máster, no una medición de laboratorio — pero tiene dueño y sitio.',
  },
  '14 días': {
    fuente: 'Código: `registerMerchant` fija `planExpiresAt` a +14 días (auth.service.ts) · ' +
      'máster H1: «Trial 14 días sin tarjeta».',
  },
  '5 minutos': {
    sinFuente:
      'NADIE LA MIDIÓ. D0 (SCRUM-310) midió que no se puede: «Los segundos no son medibles desde ' +
      'el árbol y no se estiman: dependen de la latencia de Resend y del filtro de spam del ' +
      'destinatario». Y el alta cruza la bandeja de entrada (magic link de 15 min), que no ' +
      'controlamos. Publicado hoy en «Listo en 5 minutos».',
    decide: 'el fundador (copy publicado = máster, A22 + regla 30)',
  },
};

/** Cuántas cifras del héroe están hoy SIN FUENTE. Es un trinquete: no puede subir. */
export const SIN_FUENTE_MAX = 1;

/** Normaliza una cifra a la clave del censo (colapsa espacios). */
export function claveDeCifra(cifra) {
  return String(cifra).replace(/[ \t\r\n]+/g, ' ').trim();
}

/**
 * Contrasta las cifras publicadas contra el censo.
 *
 * 🔴 SUELO: devuelve `ciego: true` si no encuentra NI UNA cifra en un héroe que sí tiene texto.
 * «El héroe no tiene cifras» y «el extractor dejó de reconocerlas» son la misma lista vacía y
 * consecuencias opuestas: con la segunda, el trinquete pasa en verde sin mirar nada.
 */
export function auditarCifras(html) {
  const bloque = bloqueHeroe(html);
  if (!bloque) return { ciego: true, motivo: 'no se encontró `<section class="hero">`' };
  const texto = textoDeCopia(bloque);
  if (texto.length < 40) return { ciego: true, motivo: 'la copia del héroe salió casi vacía: el extractor no está leyendo' };

  const cifras = cifrasDeCopia(texto).map(claveDeCifra);
  const sinCenso = cifras.filter((c) => !(c in CENSO));
  const sinFuente = Object.entries(CENSO).filter(([, v]) => v.sinFuente).map(([k]) => k);
  return { ciego: false, texto, cifras, sinCenso, sinFuente };
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// REGLA 26 ENMENDADA (SCRUM-1016, comentario de Jira 16432) — el matiz en la MISMA unidad visible
//
// La regla vieja era lista negra absoluta: cualquier mención de VeriFactu/AEAT/Hacienda en el
// héroe caía, sin excepción. La enmienda la sustituye por (a)+(b)+(c): (a) cita literal de una
// frase YA FIRMADA en el máster, (b) la afirmación y su matiz en la MISMA unidad visible —sin que
// el lector tenga que bajar a otro bloque—, (c) ticket con la firma sobre ESE literal exacto.
// Aquí se comprueba (b): que toda mención tenga su matiz en el contenedor HTML MÁS PEQUEÑO que la
// agrupa (el `<span>`/`<h1>`/`<p>` inmediato, y si ninguno de esos lo lleva, se escala UN nivel al
// `<div>` que los envuelve — nunca a la sección `hero` entera). (a) y (c) no se pueden comprobar
// por código (no hay forma barata de leer Jira desde aquí): quedan como checklist humano en el PR
// (PR #1668 §5A, propuesta de J4).

/** Quita el CONTENIDO de los comentarios HTML sin mover ni un índice (los rellena de espacios). */
export function sinComentariosHtml(bloqueHtml) {
  return String(bloqueHtml).replace(/<!--[\s\S]*?-->/g, (m) => ' '.repeat(m.length));
}

const TAG_RE = /<(\/?)([a-zA-Z][\w-]*)([^>]*)>/g;

/**
 * Todos los elementos COMPLETOS (abre+cierra) de un bloque de HTML, con su rango de índices sobre
 * ESE MISMO bloque. Tolera etiquetas vacías sin cierre (`<br>`, `<img>`…) sin romper el resto: al
 * cerrar una etiqueta se busca la más cercana del MISMO nombre y se descarta lo que quedara
 * abierto por encima sin emparejar — nunca se emparejan etiquetas de nombre distinto.
 */
function elementosDe(bloqueHtml) {
  const pila = [];
  const elementos = [];
  TAG_RE.lastIndex = 0;
  let m;
  while ((m = TAG_RE.exec(bloqueHtml)) !== null) {
    const [tagCompleto, cierre, nombre, attrs] = m;
    if (!cierre) {
      if (/\/\s*$/.test(attrs)) continue; // autocierre (svg <path/>, etc.): no agrupa nada
      pila.push({ nombre: nombre.toLowerCase(), inicio: m.index });
    } else {
      for (let i = pila.length - 1; i >= 0; i--) {
        if (pila[i].nombre === nombre.toLowerCase()) {
          const quitados = pila.splice(i, pila.length - i);
          elementos.push({ nombre: quitados[0].nombre, inicio: quitados[0].inicio, fin: m.index + tagCompleto.length });
          break;
        }
      }
    }
  }
  return elementos;
}

const CONTENEDORES_CANDIDATOS = new Set(['span', 'p', 'h1', 'div']);
const MATIZ_RE = /a[uú]n no|en camino|no est[aá] construid[ao]|no est[aá] cerrad[ao]|pendiente|se activa(r[aá])? con|sin certificaci[oó]n/i;

/**
 * ¿El texto en `[desde, hasta)` de `bloqueOriginal` cae dentro de un `<span>/<h1>/<p>/<div>` que
 * TAMBIÉN lleva el matiz? Prueba primero el contenedor más pequeño que lo agrupa; si no lo lleva,
 * escala al siguiente candidato que lo envuelve — nunca hace falta llegar a `<section class="hero">`
 * para que esto encuentre un matiz que SÍ está en el mismo bloque visible (ver AUTOPRUEBA abajo).
 */
export function tieneMatizEnElMismoBloque(bloqueOriginal, desde, hasta) {
  const saneado = sinComentariosHtml(bloqueOriginal);
  const candidatos = elementosDe(saneado)
    .filter((e) => CONTENEDORES_CANDIDATOS.has(e.nombre) && e.inicio <= desde && e.fin >= hasta)
    .sort((a, b) => (a.fin - a.inicio) - (b.fin - b.inicio));
  for (const c of candidatos) {
    if (MATIZ_RE.test(textoDeCopia(bloqueOriginal.slice(c.inicio, c.fin)).replace(/\s+/g, ' '))) {
      return { ok: true, contenedor: c.nombre };
    }
  }
  return { ok: false };
}

/** La misma detección de fiscalidad que el héroe (regla 26), reutilizada para el `<head>`. */
export const FISCAL_RE = /veri\s*\*?\s*factu|aeat|hacienda|rrsif|declaraci[oó]n\s*responsable/i;

// ─────────────────────────────────────────────────────────────────────────────────────────
// EL <head> — nadie lo auditaba (SCRUM-1016, hallazgo de J4 en el comentario 16432)
//
// `<title>`, `og:title` y `twitter:title` CIRCULAN SUELTOS: pestaña, resultado de Google,
// previsualización de WhatsApp/Twitter. Nunca arrastran el subtítulo que los acota, así que aquí
// NO existe «matiz en el mismo bloque»: un campo de ~60 caracteres no tiene sitio para llevarlo
// pegado sin reventar el límite (medido por J4: 6 variantes de 77-96 con el matiz DESPUÉS de
// «VeriFactu» se cortaban a 50-60 sin él). La única vía verde es una lista CERRADA de literales
// firmados, carácter a carácter — nunca un patrón: un patrón de matiz en ~60 caracteres es fácil
// de burlar sin darse cuenta, y aquí sí compensa el coste de mantener una lista.
export const LITERALES_CABECERA_FIRMADOS = [
  {
    literal: 'YaQu — Presupuesto y firma; tu factura VeriFactu, en camino',
    firma: 'SCRUM-1016, comentario de Jira 16513 (Javier Pereira, 22-sep-2026): «Elijo la 3».',
  },
];

/**
 * Audita `<title>`, `og:title` y `twitter:title`.
 *
 * 🔴 SUELO: si no encuentra los tres campos se declara CIEGO — un extractor roto que no lee nada
 * se leería igual que «no hay fiscalidad en la cabecera», y son consecuencias opuestas.
 */
export function auditarCabecera(html) {
  const saca = (re) => {
    const m = String(html).match(re);
    return m ? m[1] : null;
  };
  const campos = {
    title: saca(/<title[^>]*>([\s\S]*?)<\/title>/),
    'og:title': saca(/<meta\s+property="og:title"\s+content="([^"]*)"\s*\/?>/),
    'twitter:title': saca(/<meta\s+name="twitter:title"\s+content="([^"]*)"\s*\/?>/),
  };
  const faltantes = Object.entries(campos).filter(([, v]) => v === null).map(([k]) => k);
  if (faltantes.length > 0) {
    return { ciego: true, motivo: 'no se encontraron estos campos del <head>: ' + faltantes.join(', ') };
  }

  const firmados = new Set(LITERALES_CABECERA_FIRMADOS.map((l) => l.literal));
  const problemas = Object.entries(campos)
    .filter(([, valor]) => FISCAL_RE.test(valor) && !firmados.has(valor))
    .map(([campo, valor]) => ({ campo, valor }));
  return { ciego: false, campos, problemas };
}
