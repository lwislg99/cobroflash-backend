// src/modules/fiscal/plazos/textos.ts — SCRUM-1076d · LOS TEXTOS del calendario de plazos.
//
// LITERALES de SCRUM-1076 c.21876 §3, FIRMADOS «tal cual» en c.21877 (regla 39): T1–T20, y T6a/T7
// reutilizados de SCRUM-1064 c.20780. No se redacta nada aquí: un texto nuevo es una firma nueva.
// La pantalla (S2) los pinta de aquí y no los copia a mano. Los nombres de modelo (T6a–T6f) viven
// con su cita, en `citas.ts`.
//
// 🔴 Ninguno dice «presentado» ni nada que sugiera que YaQu presentó algo (regla 7). Lo vigila
//    `tests/scrum1076d-calendario-de-plazos.test.mjs`.

export const TEXTOS_PLAZOS = Object.freeze({
  /** T1 · rótulo del menú. */
  menu: 'Calendario de plazos',
  /** T2 · título de la pantalla. */
  titulo: 'Calendario de plazos',
  /** T3 · subtítulo. */
  subtitulo: 'Fechas límite de los modelos de los que YaQu te prepara un borrador, tal como las fija su orden ministerial. Marca los que ya le has llevado a tu asesor.',
  /** T20 · bajo el subtítulo (P3 de c.21877: sí). */
  noPresenta: 'YaQu no presenta ningún modelo: eso lo hace tu asesor.',
  /** T4 · selector de año (seguido del año, que es un dato). */
  ejercicio: 'Ejercicio',
  /** T5 · cabeceras. */
  cabeceras: Object.freeze(['Modelo', 'Periodo', 'Fecha límite', 'Estado']),
  /** T9 · pastilla (en mayúsculas por DESIGN.md: eso es CSS, el texto es éste). */
  pendiente: 'Pendiente',
  /** T10 · pastilla. */
  llevadoAsesor: 'Llevado a mi asesor',
  /** T11 · botón. */
  marcarLlevado: 'Marcar como llevado a mi asesor',
  /** T12 · botón. */
  volverPendiente: 'Volver a pendiente',
  /** T14 · nota fija al pie de la tabla. */
  notaFestivos: 'Fechas tal como las fija la norma. Si el último día cae en sábado, domingo o festivo, confirma la fecha con tu asesor.',
  /** T15 · en la fila cuya fecha cae en sábado o domingo (P2 de c.21877: sí). */
  finDeSemana: 'Cae en fin de semana: confírmala con tu asesor.',
  /** T16 · pastilla del periodo que no ha terminado. */
  enCurso: 'En curso',
  /** T17 · estado vacío. */
  vacio: 'No hay plazos que mostrar para este ejercicio.',
  /** T18 · error al cargar. */
  errorCargar: 'No se ha podido cargar el calendario. Vuelve a intentarlo.',
  /** T19 · error al guardar el estado. */
  errorGuardar: 'No se ha podido guardar. Vuelve a intentarlo.',
});

/** T7 «1T · 2T · 3T · 4T», con el año detrás («1T 2026»), y T8 «Año {año}». */
export function rotuloDelPeriodo(periodo: string, ejercicio: number): string {
  return periodo === 'ANUAL' ? `Año ${ejercicio}` : `${periodo} ${ejercicio}`;
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** «13 nov 2026», el formato del ejemplo de T13. Recibe `YYYY-MM-DD`. */
export function fechaCorta(iso: string): string {
  const [y, m, d] = [Number(iso.slice(0, 4)), Number(iso.slice(5, 7)), Number(iso.slice(8, 10))];
  return `${d} ${MESES[m - 1]} ${y}`;
}

/** T13 · «Fuente: {orden}, {artículo} · comprobada el {fecha}». */
export function rotuloDeLaFuente(c: { orden: string; articulo: string; comprobadaEl: string }): string {
  return `Fuente: ${c.orden}, ${c.articulo} · comprobada el ${fechaCorta(c.comprobadaEl)}`;
}
