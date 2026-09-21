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


---

# SCRUM-920d · la foto en la fila, los filtros, los chips, la cabecera del mes y «Nuevo gasto» fijo en el móvil

**Fecha:** 21-sep-2026 · **Carril:** front (S2); lo construye S4 por encargo del orquestador (excepción de carril, como 920c)
**Medido contra:** `origin/main` = `6db52e1661ca63562ff082a45f970ad29be26ac9` · 2026-09-21T14:52:57Z (cabecera `Date:` de GitHub). La rama fusiona `5dacafa672779b4391d57660c5d02ecf5ef41c99` sin conflictos; de los tres ficheros míos, `main` sólo tocó `docs/master/SCRUM-920.md`.
**Rama:** `scrum-920d-foto-chips-filtros` · **Serie:** 920c lista sin tabla (#1573, en `main`) → **920d (este PR)** → 920e detalle → 920f alta en el modal (**BLOQUEADA** hasta SCRUM-950, Jira 16175).

## Qué cambia (encargo, filas L5, L6, L7, L8, L12 y L19)

- **L12 · la foto en la fila: «Foto guardada» / «Sin foto», SIN miniatura.** Un hecho sobre el archivo (`tieneFoto`, de SCRUM-964),
  sin triángulo y sin decir nada de lo que Hacienda admite. La decisión y su medición, más abajo.
- **L5 · filtro por trabajo.** `select` con «Todos los trabajos», «Sin trabajo» y los trabajos que tienen gastos en la lista que llegó
  (`item.job`, ya resuelto por SCRUM-135: no se pide `/admin/jobs`). «Sin trabajo» = los gastos SIN `job` (incluye el que tiene
  presupuesto pero no trabajo, que la celda llama «Presupuesto sin trabajo»): es la misma cuenta que el KPI «Sin asignar a trabajo».
  Si el trabajo elegido ya no está al cambiar de mes o de categoría, vuelve a «Todos los trabajos».
- **L6 · los dos chips** «Todos · N» / «Sin foto · N», con `aria-pressed`. **La cuenta es la de lo que verás al pulsar el chip**
  (sobre los gastos ya filtrados por trabajo), no la del mes: el prototipo contaba el mes entero y con un trabajo elegido el chip decía
  «Sin foto · 3» y al pulsarlo salía 1 fila. Sin filtro de trabajo coinciden. El pulsado va en Tinta, no en verde (Una Sola Voz).
- **L8 · cabecera del mes** «Septiembre de 2026 · 9 gastos» (singular «· 1 gasto»). Con un filtro puesto (categoría, trabajo o «Sin foto»)
  lleva además **la suma de lo que se ve** y «Es la suma de lo que estás viendo, no la del mes.»; sin filtros no lleva suma, porque
  sería la del KPI y el total del mes sale UNA sola vez. La suma va en céntimos.
- **L19 · vacío de los filtros** «Ningún gasto con esos filtros» + «Prueba con otro mes, otra categoría u otro trabajo.» + «Quitar los
  filtros», que quita los tres (trabajo, foto y **categoría**, que filtra el servidor y por eso vuelve a pedir el mes por el mismo camino
  que si la cambiaras a mano). Una categoría sin gastos ya no dice «Sin gastos este mes» (era falso): dice esto.
- **L7 · «Nuevo gasto» fijo abajo a ≤560 px, y sólo ahí.** Es **el mismo botón** (`#exp-new-btn`, con `atajoNuevo.etiquetar/registrar` de
  SCRUM-769), no una copia: sólo cambia dónde se dibuja. A escritorio pasa a la cabecera junto a «⬇ CSV» (como el prototipo); a móvil el
  CSV se queda arriba. La primera fila entera entra en la primera pantalla a 390×844 (acaba en 654; la barra empieza en 779).

Microcopy: **ningún literal nuevo**. Todos están en `textos-propuestos.md` y firmados el 20-sep (comentario 15992). Único añadido no visible:
`aria-label="Trabajo"` en el filtro (el del prototipo aprobado; «Trabajo» ya existe como rótulo).

## 🔴 L12 · por qué NO hay miniatura, medido

`GET /admin/expenses/:id/foto` sirve **la foto entera** como binario, con `Cache-Control: no-store`. Una `<img>` por fila = N descargas de ese
tamaño en cada visita a la lista, sin caché.

Sonda `docs/master/evidencias/scrum920/sonda-peso-fotos-staging.mjs` (solo lectura: login de QA + `GET`; staging, versión `25a279f3…`):

- 12 meses recorridos, **4 gastos, 3 con foto**; las tres son **PNG de 0,1 KiB** (los fixtures del seed). `Content-Length` = bytes recibidos
  en las tres; sin `content-encoding`; `no-store`. La lista JSON de septiembre: **2,2 KiB** (sin fotos: confirma SCRUM-964).
- **Lo que NO se pudo medir: el peso de una foto REAL guardada.** Staging solo tiene tres fixtures de juguete y en producción no hay clientes
  reales (ni se consulta). Sin muestra real, el peso sale del CÓDIGO: `fotoParaGuardar` guarda tal cual si el data-URI cabe en 1,5 MiB
  (= **1,125 MiB** de binario como máximo) o la reduce hasta que cabe, y SCRUM-947 midió una foto de 3,73 MiB → 0,73 MiB de data-URI
  (**0,55 MiB** binarios) y una de detalle fino → 1,48 MiB (**1,11 MiB**). Una lista de 20 filas con foto serían **≈ 11 MiB** (0,55) a
  **≈ 22 MiB** (1,1) por visita, en el móvil de un profesional en la obra.
- **Decisión:** píldora sin imagen. La miniatura llega cuando el servidor sirva una pequeña. Es un ticket de servidor (S1) que no abro yo
  (A13): opciones y su coste en «Para ti». El guard lo mantiene: I.1 exige **0 `<img>` y 0 descargas de `/foto`** en la lista.

## Cómo se mide: `npm run guard:lista-gastos` ampliado (navegador, 390 y 1280 px, pulsando con el ratón)

Nuevas secciones **I** (foto en la fila, filtro por trabajo, chips, cabecera del mes, vacío de filtros, «Quitar los filtros» con categoría en
el servidor del banco) y **J** («Nuevo gasto» fijo a 390, quieto al recorrer 1.194 px de lista, sin tapar la última fila, POR DEBAJO del modal;
a 1280 arriba y junto al CSV; el atajo «N» sigue siendo de este botón), más H con las dos píldoras de la foto en AA. Población: 8 gastos
(3 con foto, 5 sin ella; 3 trabajos, uno compartido por dos gastos; 4 sin trabajo) + la ruta de la clave desconocida + la vacía.
**77 ✅ · 0 🔴**, exit 0, 27 s.

- **Rojo con el código de antes** (`GASTOS_PUBLICO` apuntando a `public/` de `320c7f20`): exit 2, 15 hallazgos + 14 «no supe mirar»,
  **0 excepciones**. (El primer intento usó una ruta con `/` y el guard no sirvió ni un fichero: lo dijo él mismo, «NO SUPE MIRAR», y no era
  un rojo; ver «Errores propios».)
- **Banco de mutación** `docs/master/evidencias/scrum920/mutar-920d.mjs`, con la BASE sin mutar delante (77/0, exit 0), el `git diff
  --numstat` de cada inyección y el fichero restaurado y comprobado limpio: **18 mutaciones sobre el guard FINAL, las 18 caen**, cada una por el rojo que se esperaba (BASE sin mutar 77/0 delante de cada tanda; `sin restaurar=[]`; salidas en `mutar-920d-final-A.txt` M01-M09 y `-final-B.txt` M10-M18, en dos tandas porque el reloj de la herramienta corta a los 10 min): M01 sin la animación de sólo opacidad (barra a `bottom: 2021`) · M02 «⚠ Sin foto» · M03 una `<img>` con la foto entera por fila · M04 chips que cuentan el mes · M05 el chip vuelve a pedir la lista · M06 suma sin filtros · M07 «Quitar los filtros» sin soltar la categoría · M08 «Sin gastos este mes» con una categoría vacía · M09 barra fija en escritorio · M10 barra por encima del modal · M11 «Sin trabajo» sin el gasto con presupuesto · M12 suma que pierde un gasto · M13 «1 gastos» · M14 ámbar sin AA · M15 chip sin `aria-pressed` · M16 barra que tapa la última fila · M17 dos `#exp-new-btn` · M18 el trabajo repetido en el filtro.
  **Lo que enseñó el banco** (tres pasadas previas guardadas como `mutar-920d-salida-1/2/3.txt`): (1) **M10 dio un mutante EQUIVALENTE**: subir sólo el `z-index` de la barra no cambia nada, porque con `animation-fill-mode: both` la pantalla es un contexto de apilado permanente y el `z-index` vive dentro, siempre por debajo de un modal del `body`; la mutación honesta quita también la animación (entonces cae, y además rompe el «⋯» de abajo). Consecuencia: el `z-index: 25` de la barra es un cinturón, no lo que la pone bajo el modal. (2) M12 y M13 dieron exit 134 / 0xC0000409 = **el navegador muriendo bajo carga, sin veredicto**: no son «mutante vivo», son instrumento ciego; el banco ahora reintenta y, si sigue, declara CIEGO. (3) M15 salió «viva» por un regex MÍO que no casaba con el mensaje real; el guard sí había caído. (4) Mi `espera(300)` fija daba un rojo intermitente del banco bajo carga (el alta no había abierto aún): ahora esperan a la condición (como texto, por el censo de SCRUM-258). Tras ese último cambio del guard se rehicieron M07, M08 y M10 (las que dependen de esas esperas): **las tres caen** (`mutar-920d-final-C.txt`, BASE 77/0).

## 🟠 Hallazgo para S2 (no lo arreglo yo: es de `styles.css` global)

`#view-container > * { animation: yaqu-fade-in .25s ease both }` termina en `transform: translateY(0)` y `both` lo **mantiene**. Un `transform`
distinto de `none` convierte a esa pantalla en el bloque contenedor de todo `position: fixed` que lleve dentro. Medido: la barra de «Nuevo gasto»
se dibujaba a `bottom: 2021` en una pantalla de 844 y se movía con el scroll (`position` decía `fixed`, y era mentira). Hoy nadie lo pisa porque
los overlays cuelgan de `body`. Aquí se evita con una animación de sólo opacidad **acotada a `.gastos-pantalla`**. Quien haga la próxima barra fija
en una vista, se lo encuentra.

## Errores propios

- **Mi guard reventaba con una excepción en vez de dar un rojo con nombre** (`Cannot read properties of null (reading 'getBoundingClientRect')`)
  en cuanto una pieza de la cabecera faltaba: exit 1, sin veredicto. Lo cazó correr el guard contra el `public/` viejo. Es el mismo defecto que
  ya tuve el 21-sep en el medidor del prototipo. Ahora una pieza que falta es un ✗ con su nombre.
- **Mi primera comparación contra el `public/` viejo no medía nada:** `GASTOS_PUBLICO` con barras `/` y el servidor del banco compara con
  `startsWith` sobre rutas de `path.join` (barras `\`): 404 en todos los ficheros, «`renderExpensesView` is not a function». El guard lo declaró
  («NO SUPE MIRAR», 0 filas) y no lo leí como un rojo de verdad. Con `\`, 15 hallazgos reales.
- **Esperé que la tecla «N» se pudiera pulsar en el banco.** No se puede: la escucha `app.js`, que este banco no carga. Lo declaro en el guard
  y compruebo lo que la vista le da a `app.js` (destino registrado, rótulo + `<kbd>N</kbd>, y que el destino abre el alta).
- La primera barra fija pasó el «es fija» y falló el «pegada al borde»: `getComputedStyle().position` **no basta**; hay que medir dónde está.

## No hecho / declarado

- **Sin recorrido en staging** (no se puede antes de mergear): Gastos a 390 con datos reales, pulsar los chips y «Nuevo gasto».
- **La foto real no está medida** (arriba). **Miniatura: no.** Necesita servidor.
- **El CSV no lleva el filtro de trabajo ni el de foto**, sólo mes y categoría (los que filtra el servidor). El botón dice «Exportar gastos
  filtrados a CSV» (texto de hoy): con un trabajo elegido exporta más de lo que se ve. **Decisión de producto abierta**, no la tomo yo.
- **Desviaciones del prototipo, declaradas:** (1) las dos píldoras de la fila van UNA debajo de la otra en la columna de 150 px de escritorio
  (el prototipo dejaba 290 px, pero no tenía la barra lateral de 248 px del panel real: con 290 px la columna del concepto se queda sin sitio
  entre 900 y 1100 px); en los tres renglones van en fila. (2) Los chips cuentan lo que filtran (arriba).
- 920e (detalle), 920f (alta; bloqueada) y el IVA 0·2·4·5·10·21 (Jira 16175) **no están en este PR**: el desplegable de IVA está en el modal de
  alta, que es de 920f.
- `medir-hoy.mjs`/`sonda-peso-lista-gastos.mjs` del prototipo siguen como estaban: la primera midió el mecanismo con fotos inventadas; la de
  este PR mide fotos guardadas.

## Suite

`npm run build` **exit 0** (tras `prisma generate`: el cliente compartido de este worktree estaba desfasado y `tsc` daba errores de `revision`/`tags` que NO son de este PR: 0 cambios en `src/`). **87 ficheros de test** (los que leen `expensesView.js`/`styles.css`/el guard, más los censos y trinquetes que barren `tests/`): **866 tests, 864 pasan, 0 fallan, 2 saltados** (`SCRUM-324` × 2, sin `LIBRO_PG_URL`: banco desechable, ajeno). En el camino cayeron **3 guards de entrada, todos por mi código y arreglados en el CÓDIGO, no en el guard**: `SCRUM-666b` (`.gastos-chip-n` se pintaba sin regla → regla de cifras tabulares), `SCRUM-258` (mis esperas del guard usaban `document` dentro de una flecha → ahora expresiones de texto) y `SCRUM-267` (mi ancla de «Medido contra» llevaba texto dentro de las comillas del sha). **La suite COMPLETA no la he corrido** (sin turno, cinco sesiones más en la máquina): el CI es la puerta.

# SCRUM-920i · el recorrido de staging de 920c/920d a 390 px (solo lectura) y lo que destapó

**Fecha:** 21-sep-2026 · **Carril:** front (S2); lo mide S4 por encargo del orquestador (excepción de carril, como 920c y 920d)
**Medido contra:** `origin/main` = `b6cde0517649d991a1b08eabb50017a81a03acfb` · 2026-09-21T17:25:34Z (cabecera `Date:` de GitHub). Staging sirve esa misma versión (`GET /version`) y lleva #1613 (920d) dentro: merge `cdc3282298c84502964f2a7f15ff8ae223323d79`, 17:12:43Z.
**Rama:** `scrum-920i-recorrido-staging-920d` · **Solo docs y evidencias:** 0 cambios en `src/`, `public/` y `prisma/`. Autorización: GO de staging solo lectura del orquestador para este recorrido (21-sep); no se hereda.

## Qué se hizo

- `docs/master/evidencias/scrum920/recorrido-staging-920d.mjs`: login de QA (`POST /auth/test-login`, secreto leído en tiempo de ejecución, regla 9) y después SOLO pantalla, con Edge, 390×844, dpr 2, táctil. Abre Gastos, pulsa los chips y el filtro por trabajo, abre el alta de «Nuevo gasto» y la cierra sin guardar. No pulsa filas, ni «Eliminar», ni «Guardar».
- **Población:** merchant QA, mes 2026-09, **4 gastos** (3 con foto, 1 sin ella; 2 con trabajo y 2 sin él), contados antes por la API y comparados con lo que pinta la pantalla.
- **23 ✅ · 1 🔴** (`recorrido-staging-920d-salida.txt`; 7 capturas en `recorrido-staging-920d/`). Lo que sale bien, medido: 4 filas = 4 de la API; **0 px de scroll lateral**; 3 «Foto guardada» y 1 «Sin foto»; **0 `<img>` y 0 descargas de `/foto`** en todo el recorrido; cabecera «Septiembre de 2026 · 4 gastos»; chips «Todos · 4» (pulsado) y «Sin foto · 1»; «Sin foto» deja 1 fila y la cabecera lleva la suma con su salvedad; «Sin trabajo» deja 2 filas y el trabajo elegido 2, las mismas que dice la API; la barra de «Nuevo gasto» es `fixed`, con el borde inferior en 834 de 844, botón de **44 px**, no se mueve al recorrer la lista y no tapa la última fila (acaba en 755, la barra empieza en 779); el alta abre y se cierra.

## 🔴 Hallazgo: el «?» de ayuda tapa el extremo derecho del botón «Nuevo gasto»

Sonda `sonda-flotantes-staging.mjs` (salida en `sonda-flotantes-staging-salida.txt`): en Gastos a 390×844 hay tres elementos fijos (el menú lateral fuera de pantalla, la barra y `#tut-help-btn`).

- `#tut-help-btn` (`tutorial.js:196`, estilo en línea: `position:fixed; bottom:20px; right:20px; z-index:350`, 48×48) ocupa x 322-370, y 776-824. El botón de la barra ocupa x 16-374, y 790-834. **Se solapan 1.632 px²** (el 10 % del botón) y el «?» va por encima (z 350 frente a 25).
- `elementFromPoint` en cinco puntos a lo ancho del botón: 4 llegan al botón; **x=353 lo recibe `#tut-help-btn`**. El rótulo «Nuevo gasto» está centrado y no se tapa: lo que se pierde es el extremo derecho del botón y el aspecto de la barra.
- **Por qué mi guard no lo vio (77 ✅ · 0 🔴):** el banco de `guard-lista-gastos` no carga `tutorial.js`, así que no hay «?». El 77/0 era cierto para lo que veía. Las medidas de 920d se hicieron en un banco sin la ayuda, y en producción el botón está en todos los dashboards.
- **De dónde viene:** `styles.css` ya lo decía —el hueco inferior de 80 px del `.view-container` existe justo porque ahí flota el «?» (SCRUM-720e)—; la barra fija nueva ocupa ese mismo hueco. Es un defecto de 920d, no del botón de ayuda.
- **Sin cambio en este PR** (no se toca el diseño aprobado ni se decide por el propietario del diseño). Opciones, con lo que cuesta cada una:
  1. **Dejar sitio a la derecha en la barra** (`padding-right` ≈ 78 px a ≤560 px: el botón termina en x=312, 8 px antes del «?», que queda sobre la propia barra). Es CSS de 920d, sin texto nuevo; cambia el ancho del botón respecto al prototipo firmado.
  2. **Ocultar el «?» en esta pantalla** con `body:has(.gastos-barra) #tut-help-btn { display: none !important }` (hace falta `!important` por el estilo en línea; ya hay un precedente: `body:has(.modal-overlay) #tut-help-btn`). Quita la ayuda de Gastos en el móvil: decisión de producto.
  3. **Subir el «?» sobre la barra** (`bottom: ~84px`): no vale; cae sobre el «⋯» de las filas (x 320-362), justo lo que el hueco de SCRUM-720e evita.
  La recomendación es la 1. Cuando se arregle, el guard tiene que llevar el «?» de verdad (o un doble con su mismo estilo en línea) y medir `elementFromPoint` en el botón, como hace el recorrido.

## Errores propios

- **Dos rojos del primer intento eran del instrumento, no del producto:** busqué la cabecera del mes como un elemento «hoja» y es un contenedor con un `<span>` hijo (lo confirmó la captura: «Septiembre de 2026 · 4 gastos» se ve bien); y conté como escritura el `POST /admin/entorno`, que **lo manda la propia app al cargar** (`enviarEntornoDeLaApp`, `app.js:762`, SCRUM-360: marca el «último entorno visto» de la sesión, sin datos de negocio). Lo cuento como excepción declarada (una por carga del dashboard: 4 en total, tres recorridos y una sonda), no lo oculto: cualquier otra escritura sigue siendo rojo.
- Un `textContent` no lleva el espacio antes del «·» (lo pone el hueco entre los dos `<span>`): mi regex exigía un espacio literal.

## No hecho / declarado

- **1280 px** no se recorrió (el encargo era 390). La lista sin tabla de 920c se comprobó por sus efectos (sin scroll lateral, filas y píldoras); **no se abrió el «⋯»** de las filas.
- **La foto real sigue sin medirse:** staging solo tiene fixtures de 0,1 KiB.
- No se probó guardar un gasto (recorrido de solo lectura).

# SCRUM-920j · el «?» de ayuda deja de tapar «Nuevo gasto» (decisión 1 del comentario 16255)

**Fecha:** 21-sep-2026 · **Carril:** S4 por encargo del orquestador (excepción de carril, como 920i)
**Medido contra:** `origin/main` = `4f40e95c169281beb224e7b61c904974b4534141` · 2026-09-21T17:52:03Z (cabecera `Date:` de GitHub, al escribir esta entrada; a esa hora `main` ya iba por `b46229f1f65bf802ac3cb79ec2d0a5540931f370`, y entre los dos no cambió `styles.css`, `tutorial.js` ni el guard).
**Rama:** `scrum-920j-el-ayuda-no-tapa-nuevo-gasto` · guard (rojo) `30c01276f631dc61eaa82af1fa39318da26c533e` · arreglo `f374fdcad104b13cd1c6a547b544f22d4bc23e6b`
**Decisión:** la del orquestador sobre el comentario de Jira 16255, opción 1 (la recomendada): `padding-right` en la barra a ≤560 px. Sin texto nuevo: es CSS.

## Qué se hizo

- **Arreglo (1 regla, 3 líneas con su comentario):** `.gastos-barra { padding-right: 78px; }` dentro del `@media (max-width: 560px)` de `styles.css`, DESPUÉS del `padding:` abreviado de la barra. 78 = 20 (el `right` del «?») + 48 (su ancho) + 10 de aire. A 390 px el botón pasa de 358 a **296 px** y termina en x=312; el «?» empieza en x=322.
- **Guard (bloque J de `scripts/guard-lista-gastos.mjs`):** pinta un DOBLE de `#tut-help-btn` con el MISMO `cssText`, **leído de `tutorial.js`** (si el fichero cambia, el doble cambia; si no lo encuentra, sale «NO SUPE MIRAR», no verde), y mira con `elementFromPoint` una rejilla de 27 puntos sobre «Nuevo gasto», más el solape en px². Lleva su control positivo: el doble tiene que verse a sí mismo en su centro.
- **Rojo con el código de antes (sin la regla):** `🔴 el «?» de ayuda TAPA a «Nuevo gasto»: 2 de 27 puntos del botón y 1632 px²` (los mismos 1.632 px² que midió el recorrido de staging en 920i). **Verde con el arreglo:** `0 de 27 puntos tapados, 0 px² de solape (el botón acaba en x=312, el «?» empieza en x=322)`. La BASE (main sin tocar) dio 77 ✅ · 0 🔴; ahora 78 ✅ · 0 🔴; el conjunto de líneas ✅ cambia sólo en el ancho del botón (358→296) y la línea nueva.
- **Tres mutaciones + el rojo** (`mutar-920j.mjs`, sobre una COPIA de `public/`, salida en `mutar-920j-salida.txt`): base 0 · sin la regla 🔴 (1632 px²) · hueco corto de 60 px 🔴 (272 px²) · `padding-left` en vez de `-right` 🔴 · la regla antes del `padding:` abreviado, que la pisa, 🔴. Las cuatro caen; ninguna sustitución dejó de casar.
- **Captura antes/después a 390×844** (`capturas-920j/`, `capturas-920j.mjs`): antes el «?» muerde el extremo derecho del botón; después queda un hueco entre los dos.
- **Población de la suite:** los **61 ficheros de test** cuyo texto cita `styles.css` (`git grep -l`): **556 tests, 556 pasan, 0 fallan, 0 saltados**. La suite completa no se ha corrido: el CI es la puerta.

## Errores propios

- **Mi primer instrumento no habría visto el defecto.** El traspaso decía «`elementFromPoint` en 5 puntos» y los escribí (cuatro esquinas a 2 px y el centro): con el defecto puesto dieron **«0 de 5»** aunque el solape era de 1.632 px². El «?» es un círculo y ninguno de esos cinco puntos cae dentro. Lo cazó correr el rojo ANTES del arreglo; ahora es una rejilla de 9×3.
- **He tocado un umbral que ya existía:** «a ancho completo» era `ancho - 40` y con el hueco del «?» el botón mide 296 de 390, así que pasa a `ancho - 100`. Es la única pieza del guard que se relaja; lo dice el comentario del código y lo cubre lo nuevo (el «?» no tapa) más el umbral, que sigue exigiendo un botón ancho.

## No hecho / declarado

- **No verificado en staging:** el PR aún no está en `main`. Cuando lo esté, se puede volver a correr `recorrido-staging-920d.mjs` (solo lectura, GO nuevo) y mirar si el botón y el «?» conviven; el ticket lo cierra el orquestador por efecto medido.
- El doble del «?» reproduce su posición y su `z-index`, no su comportamiento (`openHelpGuide`): aquí sólo importa qué tapa.
- Otras pantallas con barra fija abajo a ≤560 px, si las hubiera, no se han censado: este PR no las toca.
