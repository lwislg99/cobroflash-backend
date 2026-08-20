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

/** El bloque crudo del héroe, tal cual está en el fichero. */
export function bloqueHeroe(html) {
  const i = String(html).indexOf('<section class="hero">');
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
