// src/core/config/contacto.ts — SCRUM-406
//
// LA DIRECCIÓN DE CONTACTO DE YaQu, EN UN SOLO SITIO.
//
// Estaba escrita a mano en SEIS: `privacidad.html` ×3, `terminos.html`, `tutorial.js` y
// `libroRegistroView.js`. El comentario de este último ya avisaba de lo que pasa:
//
// > «el día que cambie hay que cambiarlo en todos, y el que se olvide deja un canal muerto sin que
// > nadie se entere»
//
// Un canal de contacto muerto no da error: el profesional escribe, el correo rebota o cae en una
// dirección que ya no mira nadie, y **desde dentro del producto todo parece correcto**.
//
// ⚠️ LAS DOS PÁGINAS LEGALES SIGUEN CON EL LITERAL, Y ES DELIBERADO. Son HTML estático: sustituir
// ahí el texto por algo que rellena JavaScript significaría que un fallo de JS deja una página
// legal **sin la vía de contacto que el RGPD exige que esté**. Cambiar seis literales por cinco más
// una dependencia de JS en la página legal no es una mejora.
//
// Lo que impide la divergencia es el guard: `tests/scrum406-escribenos.test.mjs` compara TODAS las
// apariciones del árbol contra esta constante y cae nombrando la que se salga.
export const CONTACTO_YAQU = 'hola@yaqu.app';

/**
 * A dónde llega lo que el profesional escribe desde «Escríbenos».
 *
 * Por defecto, la misma dirección que el producto enseña en todas partes: si el pro lee
 * `hola@yaqu.app` en la guía y en las legales, es donde tiene que aterrizar su mensaje. `SOPORTE_EMAIL`
 * solo sirve para desviarlo a un buzón interno distinto sin tocar lo que se enseña.
 *
 * 🔴 NUNCA vacío. Un destino vacío convertiría el formulario en lo único peor que el `mailto:`: algo
 * que dice «enviado» y no va a ningún sitio. Por eso el valor por defecto es una constante y no una
 * variable de entorno a secas — una env que falta se lee igual que una cadena vacía.
 */
export function destinoSoporte(env: NodeJS.ProcessEnv = process.env): string {
  const configurado = (env.SOPORTE_EMAIL || '').trim();
  return configurado || CONTACTO_YAQU;
}
