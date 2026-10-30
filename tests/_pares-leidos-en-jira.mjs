// tests/_pares-leidos-en-jira.mjs — SCRUM-1511h
//
// LA LISTA CONGELADA DE PARES (ticket, comentario) QUE ALGUIEN HA ABIERTO EN JIRA.
//
// `_respaldo-de-firma.mjs` sólo da el nivel «anclado» a una marca cuyos pares `SCRUM-N comentario M`
// están TODOS aquí. Un par que no esté baja la marca a «rastreable», con el motivo «par no leído», y
// `scrum921c` sale en rojo diciendo cómo se añade la fila. Decisión del fundador del 24-oct-2026:
// SCRUM-1511 comentario 20748 («Lista congelada en el árbol», la 3b de c.20743).
//
// ── POR QUÉ UNA LISTA Y NO UNA CONSULTA ─────────────────────────────────────────────────────────
// Hasta aquí «anclado» medía la FORMA de la cita, no que el par existiera: medido en c.20743, una
// marca fabricada con `SCRUM-6604 comentario 99999` (ticket inexistente, 404 recibido) subía las
// ancladas de 33 a 34 con el trinquete en verde. Consultar Jira desde CI pide credencial y da rojos
// cuando Jira no contesta; esta lista funciona sin red.
//
// ── CÓMO SE AÑADE UNA FILA ──────────────────────────────────────────────────────────────────────
// 1. Abres el ticket en Jira y lees el comentario: que exista y que sea DE ESE ticket.
// 2. Añades UNA fila por par, en una línea, con la fecha en que lo leíste (AAAA-MM-DD) y quién lo
//    leyó y dónde consta esa lectura (un comentario de Jira o un tramo de registro).
// 3. En el mismo PR que la marca que lo cita.
//
// ── LO QUE ESTA LISTA NO CAZA, DICHO AQUÍ ────────────────────────────────────────────────────────
// 🔴 Quien inventa la cita puede inventar también la fila. La lista no lee Jira: sólo obliga a que
// el par inventado quede escrito DOS veces, una de ellas en un fichero cuyo único oficio es decir
// «esto lo abrí», con fecha y nombre. Es más difícil de hacer sin querer y más fácil de ver en la
// revisión; no es imposible.
// · No caza el CONTENIDO: un comentario que existe y no es una firma pasa igual (el caso de
//   `scripts/guard-pasos-del-editor.mjs:1`, que citaba SCRUM-915 comentario 15790, una opinión
//   sobre la v1; medido en c.20743).
// · No caza un comentario EDITADO o BORRADO después de su lectura: la fecha dice cuándo constaba,
//   no que siga constando.
// · No caza una fila que nadie cita ya: una fila huérfana no da rojo.
//
// ── DE DÓNDE SALEN LAS FILAS DE HOY ─────────────────────────────────────────────────────────────
// Las 20 primeras, de la medición de jv-j4ac (SCRUM-1511 comentario 20743, tramo 1511g del
// registro): 17 tickets bajados con TODOS sus comentarios, 38 citas, 20 pares, 0 inexistentes. La 21.ª (SCRUM-1502 comentario 20690) la leyó
// jv-j6bo el mismo día: es el ancla del banco de `scrum1502h`. La 22.ª (SCRUM-1511 comentario
// 18924) también, porque a ella se re-ancla `guard-pasos-del-editor.mjs:1` (SCRUM-1511h). La 23.ª
// (SCRUM-769 comentario 14580) la leyó la S4 el 24-oct, con el ticket entero: es la firma de
// `jobsView.js:79` (tramo 1502m del registro de SCRUM-1502). La 24.ª (SCRUM-1502 comentario 20834)
// la leyó jv-j1ca el 24-oct, con el ticket entero: es la firma de seis marcas de `tests/` (tramo
// 1502o). La 25.ª (SCRUM-1502 comentario 20853) la leyó jv-j1cc el 26-oct, con el ticket entero:
// es la firma de las 17 parejas singular/plural que gobierna `scrum377:72` (tramo 1502p).
// La 26.ª (SCRUM-1402 comentario 20866) la leyó jv-j3bo el 26-oct, con el ticket entero: es la firma
// del T3 del 409 `subscription_exists`, anclada en `scrum601` (tramo 1402k).
// La 27.ª (SCRUM-1446 comentario 20917) la leyó jv-j1ck el 26-oct, con el ticket entero: es la firma de la
// cabecera «IMPORTE» del PDF de la factura (tramo 1446e).
// La 28.ª (SCRUM-1446 comentario 20939) la leyó jv-j1co el 26-oct, con el ticket entero: extiende esa
// cabecera «IMPORTE» al PDF del presupuesto (tramo 1446f).
// SCRUM-1251 comentario 20675 lo leyó la S2 el 27-oct, con el ticket entero: es la firma de los ocho
// textos de la tarjeta «Paquete del trimestre» de `exportView.js` (SCRUM-1602).
//
// Una fila por línea (lo pide `tests/scrum710b`): dos tickets que añaden pares no se pisan.

const POR_1511G = 'jv-j4ac · SCRUM-1511 comentario 20743';
const POR_1511H = 'jv-j6bo · SCRUM-1511h';
const POR_1502M = 'S4 · SCRUM-1502m';
const POR_1502O = 'jv-j1ca · SCRUM-1502o';
const POR_1502P = 'jv-j1cc · SCRUM-1502p';
const POR_1402K = 'jv-j3bo · SCRUM-1402k';
const POR_1446E = 'jv-j1ck · SCRUM-1446e';
const POR_1446F = 'jv-j1co · SCRUM-1446f';
const POR_1322C = 'jv-j2bg · SCRUM-1322c';
const POR_1322D = 'jv-j2bh · SCRUM-1322d';
const POR_1602 = 'S2 · SCRUM-1602';
const POR_1640 = 'jv-j1dq · SCRUM-1640';

export const PARES_LEIDOS = Object.freeze([
  { ticket: 299, comentario: 12188, leido: '2026-10-24', por: POR_1511G },
  { ticket: 593, comentario: 14262, leido: '2026-10-24', por: POR_1511G },
  { ticket: 825, comentario: 17446, leido: '2026-10-24', por: POR_1511G },
  { ticket: 887, comentario: 15675, leido: '2026-10-24', por: POR_1511G },
  { ticket: 895, comentario: 15699, leido: '2026-10-24', por: POR_1511G },
  { ticket: 915, comentario: 15790, leido: '2026-10-24', por: POR_1511G },
  { ticket: 915, comentario: 15868, leido: '2026-10-24', por: POR_1511G },
  { ticket: 920, comentario: 15992, leido: '2026-10-24', por: POR_1511G },
  { ticket: 1135, comentario: 17449, leido: '2026-10-24', por: POR_1511G },
  { ticket: 1216, comentario: 17347, leido: '2026-10-24', por: POR_1511G },
  { ticket: 1252, comentario: 17726, leido: '2026-10-24', por: POR_1511G },
  { ticket: 1257, comentario: 17444, leido: '2026-10-24', por: POR_1511G },
  { ticket: 1258, comentario: 17713, leido: '2026-10-24', por: POR_1511G },
  { ticket: 1260, comentario: 19616, leido: '2026-10-24', por: POR_1511G },
  { ticket: 1341, comentario: 17825, leido: '2026-10-24', por: POR_1511G },
  { ticket: 1404, comentario: 18840, leido: '2026-10-24', por: POR_1511G },
  { ticket: 1502, comentario: 18835, leido: '2026-10-24', por: POR_1511G },
  { ticket: 1502, comentario: 20514, leido: '2026-10-24', por: POR_1511G },
  { ticket: 1502, comentario: 20629, leido: '2026-10-24', por: POR_1511G },
  { ticket: 1502, comentario: 20702, leido: '2026-10-24', por: POR_1511G },
  { ticket: 1502, comentario: 20690, leido: '2026-10-24', por: POR_1511H },
  { ticket: 1511, comentario: 18924, leido: '2026-10-24', por: POR_1511H },
  { ticket: 769, comentario: 14580, leido: '2026-10-24', por: POR_1502M },
  { ticket: 1502, comentario: 20834, leido: '2026-10-24', por: POR_1502O },
  { ticket: 1502, comentario: 20853, leido: '2026-10-26', por: POR_1502P },
  { ticket: 1402, comentario: 20866, leido: '2026-10-26', por: POR_1402K },
  { ticket: 1446, comentario: 20917, leido: '2026-10-26', por: POR_1446E },
  { ticket: 1446, comentario: 20939, leido: '2026-10-26', por: POR_1446F },
  { ticket: 1322, comentario: 20957, leido: '2026-10-26', por: POR_1322C },
  { ticket: 1322, comentario: 20977, leido: '2026-10-26', por: POR_1322D },
  { ticket: 1251, comentario: 20675, leido: '2026-10-27', por: POR_1602 },
  { ticket: 1640, comentario: 21292, leido: '2026-10-30', por: POR_1640 },
].map(Object.freeze));
