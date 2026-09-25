# SCRUM-1049 · «Resumen del trimestre» en Informes (CON-07, mitad 2/2)

**Medido contra:** `origin/main` = `29a77d3af7923d28ef3093ec553955a69384413b` · 2026-09-25T16:55:06Z

**Rama:** `scrum-1049-resumen-trimestre-pantalla`

## Encargo (orquestador, 25-sep-2026)

Construir la pantalla con los números que YA se calculan hoy — IVA repercutido/soportado y
gastos. Lo que depende de SCRUM-1048 (esperando al asesor) NO se pinta: sin retenciones, sin
hueco ni marcador. «Una pantalla útil con lo que hay vale más que ninguna pantalla.»

## Diseño: cero cálculo fiscal nuevo

Los tres bloques salen de **tres endpoints que YA EXISTÍAN antes de este ticket**:

| bloque | fuente | qué hace la pantalla |
| --- | --- | --- |
| IVA repercutido | `GET /admin/reports/vat?year=&quarter=` (SCRUM-389) | pinta `totals.cuota` tal cual |
| IVA soportado (deducible) | `GET /admin/libros/recibidas.json?ano=&trimestre=` (SCRUM-1040/CON-04) | suma `cuota` de las filas con `deducible === 'Sí'` |
| Gastos del trimestre | `GET /admin/reports/pl?year=` (existente) | suma `.expenses` de los 3 meses del trimestre elegido |

**Nada de esto es un cálculo nuevo del lado del servidor.** Se descartó a propósito una ruta
nueva de agregación (`/admin/reports/vat-soportado`, reusando `leerLibroRecibidas`) al encontrar
que `GET /admin/libros/recibidas.json` (SCRUM-1040) ya hace exactamente eso — mismo motor, mismo
periodo (`rangoTrimestre`), ya probado. Añadir una segunda ruta habría sido dos caminos para la
misma cifra, que es justo el defecto que `scrum389-censo-vat.test.mjs` vigila para el lado de
emitidas.

**Retenciones y «diferencia» (repercutido − soportado) NO se pintan.** Son la mitad 1/2 del
ticket hermano SCRUM-1048 (S1, bloqueado esperando al asesor) — pintar una diferencia sin la
declaración fiscal real de fondo sería un cálculo a medias con forma de resultado, y regla 7
prohíbe cualquier «lo que debes».

## Selector de trimestre PROPIO

El «IVA repercutido» ya tenía su selector (`vatQuarter`, dentro de `vatCard`). Este resumen usa
uno **independiente** (`resumenQuarter`, dentro de `resumenCard`) en vez de reutilizar el de al
lado: es su propio componente (yaqu-premium-ui: una pantalla/componente por cambio, sin tocar
código ajeno más de lo necesario). El año sí se comparte — `yearSelect`, igual que las demás
tarjetas de la página.

## Casos límite (comentario 16250 del ticket)

- **Trimestre en curso:** badge «Trimestre en curso — cifras provisionales…» cuando el
  año+trimestre elegidos son los de hoy.
- **Trimestre sin datos:** si los TRES orígenes están vacíos a la vez (`vat.invoiceCount === 0`,
  `recibidas.miradas === 0`, los 3 meses del P&L sin revenue ni expenses), un único mensaje «Sin
  movimientos en este trimestre.» — nunca tres bloques a «0,00 €» sin explicar.
- **Importes largos a 390px:** capturado en `docs/master/evidencias/SCRUM-1049/` (grid
  `auto-fit`, mismo patrón que el resto de KPIs de la página).
- **Resultado negativo:** no aplica — no se calcula ningún resultado combinado (ver arriba). El
  repercutido en sí PUEDE salir negativo si un trimestre tiene más rectificativas que emitidas;
  se pinta el número con signo tal cual da `/vat`, sin palabras nuevas.
- **Lo que se excluye, se dice:** facturas sin desglose (ya lo hacía `/vat`), gastos sin datos de
  IVA (aviso ya aprobado de SCRUM-1040, reutilizado literal) y gastos no-deducibles/sin decidir
  (nota nueva de este ticket, contados aparte).

## 🔴 Hallazgo de paso, en el MISMO fichero: `vatCard.innerHTML +=` se comía sus propios botones

Mi test del suelo (trimestre sin datos en NINGUNO de los tres orígenes) reventó por partida
doble: `loadVat` hacía `vatCard.innerHTML += '<p>Sin facturas emitidas…</p>'` cuando el
trimestre no tenía facturas — y ese `+=`, tras ya haber hecho `appendChild` de los 4 botones de
trimestre tres líneas antes, los serializa y se los lleva por delante (la lección de SCRUM-515,
citada en la propia ficha de esta sesión: «un aviso pintado con `appendChild` y borrado por un
`innerHTML` cuatro líneas después»). En un trimestre real sin facturas, el profesional se quedaba
**sin botones para volver a otro trimestre**. Arreglado con `appendChild` de un `<p>`, mismo
patrón que ya usa el bloque nuevo. Verificado en rojo (revertido a mano, 4 botones → 0) antes de
aplicar el arreglo definitivo.

## Test de contrato

`tests/scrum1049-resumen-trimestre.test.mjs`, DOM real del banco de SCRUM-417 sobre
`renderReportsView` (no el fuente): 4 casos — suelo (los tres endpoints en su forma vacía no
revientan la pantalla), trimestre sin datos → mensaje único, los tres bloques con datos reales
(incluida la resta de lo no-deducible), y el control de que el selector de trimestre es propio
(8 botones «nT» = 2 selectores independientes, no 4 compartidos). Verificado en rojo quitando el
filtro `deducible === 'Sí'` antes de reponerlo.

⚠️ Trampa de entorno medida escribiendo el test: `Intl.NumberFormat('es-ES', {style:'currency'})`
separa el número del símbolo con un ESPACIO DE NO RUPTURA (U+00A0), no un espacio normal — un
`assert.equal` con `'210,00 €'` (espacio normal) falla aunque la pantalla esté bien. El test
construye el importe esperado con `toLocaleString` + NBSP explícito.

## Skill UI

Cargada (`yaqu-premium-ui`). Reutiliza tokens y clases existentes (`.customers-card`,
`.kpi-card`, `.kpi-label`, `.kpi-value`, `.btn-primary/btn-ghost.btn-sm` del selector segmentado)
— cero tokens nuevos, cero componente nuevo. Capturas a 390px en
`docs/master/evidencias/SCRUM-1049/` (`con-datos.png`, `sin-datos.png`).

## ✅ Textos — FIRMADOS por el fundador (regla 39; SCRUM-1049, comentario de firma, 25-sep-2026)

1. Título: «Resumen del trimestre»
2. Subtítulo: «Borrador de trabajo con los números de tu cuenta — para llevarle a tu asesor, no
   es una presentación a Hacienda.»
3. Badge de trimestre en curso: «Trimestre en curso — cifras provisionales, puede haber más
   movimientos antes de que acabe.»
4. Estado vacío: «Sin movimientos en este trimestre.»
5. Etiquetas de bloque: «IVA repercutido» · «IVA soportado (deducible)» · «Gastos del trimestre»
6. Nota de no-deducibles — **CORREGIDA por el fundador** al firmar: la propuesta inicial («…no
   tienen el IVA marcado como deducible…») podía leerse como que YaQu decide qué es deducible, y
   esa decisión es del asesor. Literal aprobado: «N gastos de este trimestre no los has marcado
   como IVA deducible, así que no se han sumado aquí. Revísalos con tu asesor si crees que
   deberían entrar.» — con la concordancia de singular/plural que exige el trinquete de SCRUM-377
   (1 gasto → «no lo has marcado… no se ha sumado… Revísalo… debería entrar»).

Aplicado en `reportsView.js`, verificado con el test de contrato y recapturada la captura
`con-datos.png` con el texto final.
