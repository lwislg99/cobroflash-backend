# SCRUM-920c · la lista de Gastos, sin tabla

**Fecha:** 21-sep-2026 · **Carril:** front (S2); lo construye S4 por encargo del orquestador (excepción de carril: S2 está con 915)
**Medido contra:** `origin/main` = `06939b3dc305683d88155fcb1cabb7e65f6e8b4c` · 2026-09-21T08:23:07Z (hora de la cabecera `Date:` de GitHub)
**Rama:** `scrum-920c-lista-sin-tabla` · **Serie:** 920c lista sin tabla (este PR) → 920d foto en la lista + filtros → 920e detalle → 920f alta en el modal + la ficha de microcopy ENTERA.

El prototipo de Gastos (`docs/prototipos/SCRUM-920/gastos.html`) lo aprobó el fundador y no estaba en pantalla: un diseño
aprobado que no está en la pantalla no está hecho. Este PR pone en pantalla **la lista** y arregla de paso el punto 1 de
SCRUM-944 (ver su expediente).

## Qué cambia (encargo, filas L2, L9, L11, L13, L15, L16 y L18-L20 en lo que toca a la lista)

- **L9 · filas en rejilla, no tabla.** La `<table style="min-width:600px">` dentro de un `.table-scroll` medía 628 px a
  390 en una caja de 366 y había que arrastrarla de lado para ver el importe. Ahora `.gasto-fila` (`styles.css`):
  cinco columnas a escritorio, tres renglones a ≤900 px. Medido a 390: lista de 366 px, 0 px de scroll lateral, 0 cajas
  que se salen de la lista, incluido un concepto de 130 caracteres sin espacios. No se toca `.table-scroll .table`
  (es de otros usos, `patron-tabla-de-lado.md`).
- **L2 · KPI compactos.** Los mismos tres, con los mismos rótulos y cuentas; a ≤560 px son UNA tarjeta de tres renglones.
- **L15/L16 · el «⋯» por fila** (`overflowMenu`, AB3), a 44 px: Editar · Ver trabajo (solo si el gasto tiene Trabajo) ·
  🗑 Eliminar. La papelera de 21 × 29 px pegada a una fila que navega deja de ser un botón suelto; el `confirm()`
  «¿Eliminar este gasto?» se conserva. «Ver la foto» y «📷 Añadir la foto» llegan con 920d/920e (necesitan la foto en la
  fila y el detalle).
- **L13 · «Sin trabajo»** (firmado, com. 15992) para el gasto suelto, en vez de «—». «Presupuesto sin trabajo» se conserva.
  `job.titulo` llega ya compuesto desde el servidor (SCRUM-944 punto 2, #1537, en `main`).
- **L11 · la píldora de categoría a clases** (`.gasto-cat--<clave>`): era un `style=` en línea por fila (norma A7). Mismos
  cinco colores de familia, con el texto un tono más oscuro para pasar AA: **la de «Otros» medía 4,31:1** y el guard la cazó.
- El resto de `style=` de la pantalla (cabecera, filtros, vacío, error) también a clases. Los KPI de «Sin asignar» pasan
  del `#d97706`/`#22c55e` a `#b45309`/`--brand` (el `warning` de DESIGN.md; el `#22c55e` no pasaba contraste).
- **944 punto 1** · el KPI «Mayor categoría» ya no enseña la clave interna: ver `docs/master/SCRUM-944.md` (apéndice).

## Microcopy: NINGÚN texto nuevo sin firmar

Solo literales ya firmados o ya existentes: «Editar», «Ver trabajo» (SCRUM-302), «🗑 Eliminar», «¿Eliminar este gasto?»,
«Sin trabajo» (com. 15992), «Presupuesto sin trabajo». La ficha `ficha-microcopy-DRAFT.md` NO se mueve a `docs/microcopy/`
en este PR (entra entera en 920f, por `scrum514`). El único texto nuevo es el `aria-label` «Más acciones de <concepto>»
del «⋯» (mismo patrón que el `label` por defecto de `overflowMenu`), que no es un rótulo visible.

## Cómo se mide: `npm run guard:lista-gastos` (navegador, 390 y 1280 px, pulsando con el ratón)

Población: 8 gastos (5 categorías + una clave desconocida, con y sin Trabajo, con y sin presupuesto, con y sin proveedor,
importe de 9.999,99 €, concepto largo) + una ruta con la clave desconocida como mayor categoría + una ruta vacía.
Comprueba: SUELO (filas y los tres KPI) · A sin tabla ni scroll lateral · B todo control a 44 px (17 controles) ·
C KPI sin clave interna (+ positivo) · D cada opción del «⋯» cambia el estado (Editar abre el modal con ESE gasto,
Ver trabajo navega al trabajo correcto sin abrir nada, Eliminar borra ESE gasto y la lista lo pierde, y **rechazar la
pregunta no borra nada**) · E la fila abre el gasto, el enlace del trabajo y el «⋯» no · F la celda del trabajo · G lo que
ya estaba (vacío palabra por palabra, filtro, CSV, «Nuevo gasto») · H cero `style=` en línea y contraste de las píldoras.

**Rojo medido por mutación** sobre una copia de `public/` (nunca sobre el árbol): 11 fallos inyectados, **los 11 caen**,
cada uno nombrando lo que falla — sin el `@media` de 900 px (194 px de scroll a 390), «⋯» a 20 px (8 de 17 controles),
KPI con la clave cruda (3 rojos), Eliminar de otro gasto, Ver trabajo al trabajo equivocado, enlace que deja pasar el
clic, fila que ya no abre, gasto suelto con «—», `style=` en línea, «Otros» sin AA y la tabla de vuelta.

**Lo que enseñó el instrumento (errores propios):**
- Mi mutación «el enlace deja pasar el clic» **no rompía nada**: la fila ya excluía los `<a>`, así que el guard verde era
  CORRECTO. Hay dos protecciones; la mutación honesta quita las dos. Y esa mutación equivalente destapó un defecto MÍO
  del guard: el camino verde **no terminaba nunca** (el servidor del banco seguía abierto y solo se salía en los caminos
  rojos) — se colgó veinte minutos hasta que maté el proceso. Ahora sale con `process.exit(0)` y lleva un reloj de 4
  minutos que lo convierte en «no supe mirar» (2), no en un CI parado.
- El primer verde del guard fue a la primera pasada (salvo el 4,31:1): por eso no valía sin las mutaciones.

## Suite

`node --test "tests/*.test.mjs"` sobre el árbol antes de fusionar main: **7.781 tests, 7.666 pasan, 111 saltados, 4 caen**:
`scrum748` (mío: el censo de respaldos baja de 1 a 0 y se anota) y tres de `scrum939b` (ajenos, en rojo en `main`). Tras
arreglar `scrum748`: 68/68 en el conjunto afectado (`scrum748`, `scrum522`, `scrum628`, `scrum713c`, `scrum644`).
`guards:entrada` 28/28. `guard:lista-gastos` declarado en `tests/_guards-de-navegador-declarados.mjs` (SCRUM-970).

## No mirado / no hecho (declarado)

- **Recorrido en staging** (no se puede antes de mergear): abrir Gastos a 390 con datos reales y pulsar el «⋯».
- **L7 «Nuevo gasto» fijo abajo en móvil**: NO se hace aquí. Cambia de sitio un botón con atajo «N» (SCRUM-769) y su
  interacción con la barra inferior del panel no está medida; queda para 920d, con su propia medición.
- L5, L6, L8, L12, L19 (filtro por trabajo, chips de foto, cabecera del mes, foto en la fila, vacío de filtros): 920d.
  L17 (tocar la fila abre el detalle): 920e; hasta entonces la fila abre el modal de edición, como hoy.
- `.gasto-fila` deja 150 px para la píldora: cuando 920d meta «Foto guardada» junto a ella hará falta ensanchar la columna.
- Los guards de navegador de CI ya tienen dos rojos ajenos vistos hoy (`guard:escalera-por-estado` CIEGO y
  `guard:detalle-trabajo-917`); este PR no los toca.

---

# SCRUM-920h · el diseño dice POR QUÉ un campo de la lectura quedó sin rellenar

**Fecha:** 21-sep-2026 · **Carril:** S4 (diseño, prototipo y textos; sin código de producto) · **Rama:** `scrum-920h-motivos-de-la-lectura`
**Medido contra:** `origin/main` = `320c7f2035067bf845e582373b63aba8c4fd6fa9` · 2026-09-21T13:48:18Z (hora de la cabecera `Date:` de GitHub); la rama nace de `2631bb9a53905c89537c8461c9cf2ab12de796f8`.
**Origen:** comentarios 16007 y 16152 de SCRUM-920 (orquestador y S0): `POST /admin/expenses/leer-ticket` ya devuelve `descartados: [{campo, motivo}]` (nueve motivos) y ninguna pantalla lo pinta.

**Este PR no toca producción** (`src/`, `public/`): sólo `docs/prototipos/SCRUM-920/` (prototipo, medidor, capturas, textos, encargo) y este expediente.

## Qué cambia

- **`gastos.html`:** un segundo conmutador de andamio («…y con datos que no cuadraron») que, con la lectura encendida y la foto hecha,
  enseña tres descartes reales de `sanearLectura` (fecha futura, base que no suma, NIF inválido). El motivo va **debajo del campo**, en
  ámbar y enlazado con `aria-describedby`; el bloque plegado con descartes dentro se abre solo y su resumen dice «Revisa N datos».
  El diccionario de los **nueve** motivos está en la pantalla y el grupo H del inventario los lista con su porqué.
- **`textos-propuestos.md` §920h:** los nueve literales + «Revisa 1 dato / N datos», **PROPUESTOS Y SIN FIRMAR** (los firma el orquestador).
  Y una reformulación del aviso de la lectura (F3, también sin firmar): «el importe y la fecha» dejaba de ser verdad con un dato descartado.
- **`encargo-construccion-s2.md`:** filas A13 (la pantalla que llama a la ruta) y A14 (los porqués), firmas F3/F7 y §2bis con el mapa
  campo del servidor → campo del formulario.
- **`medir.mjs`:** 12 comprobaciones nuevas por anchura (ver `medicion.md` §8) y la toma 7 de capturas.

## Tres cosas que el enunciado no decía y que cambian el texto

1. **`no_cuadra_con_el_total` vacía la BASE, no el IVA.** El ejemplo del comentario («el IVA que leí no cuadraba con el total») no
   describe lo que hace el código: se descarta `baseAmount`; la cuota se queda rellena y puede ser ella la mal leída.
2. **La fecha descartada NO queda vacía:** el formulario nace con la de hoy. El texto dice «Hemos dejado la de hoy».
3. **`nif_invalido` convive con la ayuda firmada del NIF** (SCRUM-937b) y se queda al elegir proveedor.

## Hallazgos para quien construya 920f (declarados en el encargo §2bis, sin ticket: hoy no hay víctima, la lectura no tiene pantalla)

- El desplegable «Tipo de IVA» ofrece 21 · 10 · 4 · 0 y el servidor admite 0 · 2 · 4 · 5 · 10 · 21: un 5 % leído no cabe y **no viene en `descartados`**.
- `proveedorNombre` no tiene campo en el formulario y el prototipo no dibuja dónde se pinta.
- **Llamar a la ruta desde el alta es encenderla:** el expediente de 912 dice que encenderla para usuarios reales espera al ticket de
  privacidad (Google como encargado). Antes de empujar 920f hay que medir si producción tiene `GEMINI_API_KEY` y pedir el OK del fundador.

## Medido

`node docs/prototipos/SCRUM-920/medir.mjs` sobre el árbol: **BASE 86/86 y 0 rojas; después 110/110 y 0 rojas, `EXIT=0`**, los tres
controles positivos disparando. **14 mutaciones inyectadas, las 14 caen** (detalle y los dos errores propios del instrumento en
`medicion.md` §8: la variable `$ok`/`$OK` de PowerShell y una excepción que tumbaba el medidor en vez de dar un rojo con nombre).

## No hecho / no medido

- **Nada de esto está en la pantalla real:** la lectura no tiene pantalla (A13) y los textos no están firmados. Un diseño aprobado que
  no está en la pantalla no está hecho: esto es diseño y andamio.
- El prototipo enseña tres de los nueve motivos a la vez; los nueve textos están comprobados por texto, no vistos en pantalla.
- No se ha medido ninguna lectura de un ticket real con descartes: 912d midió tres tickets sintéticos sin ningún descarte.
