// src/core/texto/sinTildes.ts
// SCRUM-1325 · EL IDIOMA DE LA CASA para comparar una expresión con texto que ha escrito una persona.
//
// Es el que eligió SCRUM-1322 en `decisionPorTexto.ts`, sacado aquí para que sea UNO: el texto se
// pasa a minúsculas y sin tildes ANTES de compararlo, y la expresión se escribe en ASCII.
//
// POR QUÉ, medido el 1-oct-2026: en JavaScript `\b`, `\w` y `[a-z]` sólo conocen las letras ASCII,
// y ni la bandera `u` ni la `v` lo cambian. Sobre texto sin normalizar, eso da dos fallos opuestos:
//   · «sí» no casa con `s[ií]\b`: detrás de la «í» no hay frontera de palabra.
//   · «síntoma» SÍ casa con `s[ií]\b`: entre la «í» y la «n» hay una frontera que no existe.
// Y una expresión con las letras sin tilde no entiende la grafía correcta («edítalo»).
// Sobre lo que devuelve esta función, `\b`, `\w` y `[a-z]` vuelven a ser fiables.
//
// ⚠️ LO QUE CUESTA, y se dice: quita TODAS las marcas, así que la «ñ» sale «n» y la «ü», «u».
// «baño» se compara como «bano». Una expresión que lleve una eñe se escribe con «n» y se ANCLA
// (`\bbano`), o casará dentro de «urbano».
//
// Que una expresión nueva sobre texto de persona no nazca sin pasar por aquí lo vigila
// `tests/scrum1325b-expresiones-sobre-texto-de-persona.test.mjs`.

/** El texto en minúsculas y sin tildes ni diéresis, en cualquiera de las dos formas en que lleguen. */
export function sinTildes(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}
