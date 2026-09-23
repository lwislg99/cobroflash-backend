# SCRUM-1086 · Lote único de literales de la web que prometen cobro

**Fecha:** 22-sep-2026 · **Carril:** J4 (legal y cumplimiento) · **Gate:** ninguno — solo propone
**Medido contra:** `origin/main` = `763d37e5225ea4897827b1a997e34cf5e117c5c3` · 2026-09-22T22:38:42Z

## Encargo

Javier va a firmar una vez, no seis: J4 reúne en `docs/legal/LITERALES_COBRO_WEB_PENDIENTES.md`
todos los textos de la web que siguen prometiendo cobro por YaQu (falso desde la regla 24,
`INVOICING_ES_ENABLED` OFF para España, SCRUM-612) en un solo documento listo para firmar.

## PASO 0 (medido, no asumido)

- Las **13 líneas** de `scrum-1016c-literales-verdad-hoy` (PR #1653, mergeado) se revalidaron
  letra por letra contra `origin/main` de hoy: mismo fichero, misma línea, mismo texto en las 13.
  No se redactan de nuevo, se traen tal cual.
- El **demo interactivo de `#probar`** (`public/index.html:523-601`) — hallazgo de J3, sin
  propuesta previa — se describe y se dan 3 opciones con pro/contra. No se propone un literal
  porque el propio encargo pide una decisión de Javier, no una redacción.
- Se midieron **3 literales nuevos** no cubiertos por SCRUM-1016c: el toast `✓ Cobrado · 961,95 €`
  de la animación del hero (`index.html:466`, un elemento DISTINTO del `beat-label` que ya cubría
  el ítem 5 de la tabla A), la tarjeta de precios propia de `index.html` (`:747-748`, paralela pero
  distinta de la de `precios.html`) y la respuesta del FAQ sobre "dos botones — Firmar y Pagar"
  (`index.html:760`, la 2ª de las 4 preguntas — la tabla A solo cubría la 1ª y la 3ª, saltándose
  ésta).
- La **categoría de la Parte H2** del máster (`docs/YAQU_MASTER.md:215`) se verificó contra el
  guion H2 recién aplicado (mismo comentario 16432 de hoy): el guion dice "no cobramos por la
  app — la señal la gestionas tú por fuera", pero la categoría de la Etapa 1, tres frases antes,
  sigue diciendo "...cobrar señales por WhatsApp". Contradicción confirmada dentro de la misma
  línea del máster, no supuesta.

## Qué se hizo

- Nuevo fichero `docs/legal/LITERALES_COBRO_WEB_PENDIENTES.md` con las cuatro secciones (A-D)
  descritas arriba.
- **No se aplica nada** a `public/index.html`, `public/precios.html` ni `docs/YAQU_MASTER.md`:
  todo es propuesta a la espera de la firma de Javier. La sección D, además, lo marca aparte como
  cambio de máster (regla 35): ni siquiera con la firma la aplica esta sesión.

## Control al cerrar

- No se tocó ningún fichero de `public/` ni `docs/YAQU_MASTER.md` — `git diff --stat` de esta rama
  solo toca `docs/legal/` y `docs/master/`.
- El STOP de siempre en J4: copy fiscal/de producto, propone y para — no envía ni aplica.

## Corrección post-CI (rojo obligatorio, misma rama)

El PR entró en rojo en «build + tests (con banco desechable)» (run 35793619444) por dos guards de
`docs/legal/` que la entrega original no satisfacía — ninguno pide relajar el guard (regla 41):

- **SCRUM-525d (trinquete de anclas con testigo):** la cita `docs/YAQU_MASTER.md:215` de la
  sección D no llevaba testigo escrito. Se le añadió el testigo `` (`cobrar señales por WhatsApp`) ``
  — literal que sí está en esa línea — sin cambiar la afirmación.
- **SCRUM-547 (documento «para aprobar» sin enlazar):** el nombre del fichero nuevo contiene
  "PENDIENTES", así que el censo lo cuenta como a la espera de aprobación; no estaba enlazado desde
  ninguna puerta. Se añadió una entrada en `docs/PENDIENTES_FUNDADOR.md` (sección "✍️ Aprobar
  textos") que dice qué decidir y cómo contestar.

El fallo de «meta-guard · los guards caen cuando deben» del mismo run era consecuencia del segundo
punto: la pasada limpia de control ya caía por SCRUM-547 antes de mutar nada, así que el meta-guard
no podía medir la mutación. Se resuelve solo al arreglar la causa.

# APÉNDICE · 23-sep-2026 · SCRUM-1086b · Bloques A, C y B(opción 3) aplicados a `public/`, J3

**Fecha:** 23-sep-2026 · **Carril:** J3 (alta y crecimiento) · **Gate:** ninguno — literales y demo,
no toca fiscal ni cobro
**Skill UI:** cargada
**Medido contra:** `origin/main` = `54769d968903a53a6a5b0c02bc84662e1f81cedf` · 2026-09-23T08:55:10Z

## Encargo

Javier firmó en SCRUM-1086 (comentario 16576): bloque A (las 13 líneas), bloque C (3 literales
nuevos) y bloque B opción 3 (el demo de `#probar` se corta en la firma). A, C y B los aplica J3 en
`public/`; el bloque D (`docs/YAQU_MASTER.md:215`) lo aplica el orquestador aparte (cambio de
máster, regla 35) y no es parte de esta entrada.

## PASO 0 (medido, no asumido)

El lote de `docs/legal/LITERALES_COBRO_WEB_PENDIENTES.md` se midió contra `origin/main` =
`763d37e5...` (22-sep). Antes de aplicar se comprobó `git log 763d37e5..origin/main --
public/index.html public/precios.html`: **0 commits** — ningún tercero tocó esos dos ficheros desde
entonces, y las 13 líneas de A más los 3 sitios de C se releyeron letra por letra y coincidían
exactamente con el documento. Se aplicó tal cual, sin adaptar nada.

## Qué se hizo

- **Bloque A** (13 líneas, `index.html` y `precios.html`): meta description/og/twitter/JSON-LD sin
  "cobro"/"pago"; el beat-label del hero anima "Firmado. Presupuesto cerrado." en vez de "Cobrado,
  sin perseguir a nadie"; el paso "3 · Cobra" pasa a "3 · Organiza"; FAQ y CTA sin "cobro"; la tarjeta
  de `precios.html` sin la comisión de tarjeta ni el "cobro integrado".
- **Bloque C**: C1 el toast del hero dice "Firmado · 961,95 €" (antes "Cobrado ·", coherente con el
  beat-label de al lado — los dos se tocaron juntos, nunca uno solo); C2 la tarjeta de precios propia
  de `index.html` cambia "Cobro con tarjeta, Bizum y transferencia" por "Recordatorios automáticos de
  firma" y retira su nota de tarifa; C3 el FAQ de "dos botones — Firmar y Pagar" ahora dice que el
  cliente "lo firma con el dedo", sin mencionar pago.
- **Bloque B opción 3**: se retiran los `try-step` `data-s="3"` ("Recibe el enlace de pago") y
  `data-s="4"` ("Paga como quiera"), y las pantallas `data-scr="3"` (recibe enlace), `data-scr="4"`
  (elige método de pago) y `data-scr="5"` (¡Cobrado!). El JS del botón de firmar (`#signBtn`) ya NO
  se relabela a "Firmado — ver cómo paga" ni navega a `data-go="3"` (pantalla retirada): tras dibujar
  la firma, se deshabilita (`disabled=true`) y ahí termina el recorrido — sin inventar copy nueva
  para un "paso 4" que no existe (regla 39). El reset restaura `disabled=false`. `active=Math.min(n,4)`
  pasa a `Math.min(n,2)` (solo 3 pasos ya). Nada de esto tocó CSS, tokens ni componentes nuevos
  (`yaqu-premium-ui`: vanilla, sin estilos inline nuevos).

## Control al cerrar

- `npm run build` limpio; `npm run guards:entrada` 112/112 verde.
- Verificación funcional con Edge headless (`puppeteer-core`, vía `scripts/_navegador.mjs`): tras
  step1→step2→firma quedan exactamente 3 pantallas y 3 pasos en el DOM, el botón de firmar sale
  `disabled`, no queda ningún "Pagar" ni "¡Cobrado!" en el `body`, el pad de firma dibuja, y "Volver a
  empezar" restaura el estado inicial. Script de un solo uso, no se comitea (no es un guard
  permanente del repo, es la comprobación manual de esta entrega).
- `git diff --stat` de esta rama solo toca `public/index.html` y `public/precios.html`.

## Dos hallazgos NUEVOS, reportados y NO aplicados (piden firma aparte)

1. **El párrafo de cabecera de `#probar`** (`index.html:525`) sigue diciendo *"avanza — del
   presupuesto al pago, como lo viven tú y tu cliente"* — inexacto tras la opción 3 (el recorrido ya
   no llega al pago). No está en el lote firmado (el documento solo describía el mecanismo, no este
   párrafo), así que no se toca sin firma explícita: sería copy nuevo sin aprobar (regla 39). Queda
   contradictorio hasta que Javier decida el texto.
2. **El subtítulo del hero espejo** (`index.html:508`, sección `#heroe-f4`, propuesta F6 SIN
   PINTAR — `hidden` + `data-microcopy="PENDIENTE_FUNDADOR"`, cero palabras publicadas) repite la
   misma promesa de cobro que el hero vivo (`:428`). Censo hecho por `git grep` sobre
   `origin/main`: la frase "te paga — con tarjeta, Bizum o transferencia" aparece en EXACTAMENTE
   2 sitios del repo — `:428` (hero vivo, fuera de este lote, depende de V0-6/el titular parado por
   SCRUM-1016j) y `:508` (este, oculto). No se adapta del `:428` sin que Javier lo firme aparte
   (instrucción explícita del orquestador). Como la sección entera está `hidden`, no es una promesa
   VISIBLE hoy — pero el texto vive en el árbol y repite la misma redacción bloqueada.
---

# SCRUM-1086d · El bloque D aplicado al máster (categoría de la Parte H2)

**Medido contra:** `origin/main` = `976fa30ef7330c516ea2c4bf505aeda66a15d1d8` · 2026-09-23T08:32:33Z
**Aplica:** el orquestador del equipo de Javier (A13), con la firma de Javier del 23-sep-2026
(SCRUM-1086, comentario 16576).

## Qué se cambia, y por qué no lo aplicó J4

El bloque D del lote (`docs/legal/LITERALES_COBRO_WEB_PENDIENTES.md`) es el único que **no vive en
`public/`**: es una línea de `docs/YAQU_MASTER.md`. Por la regla 35 el máster no se toca sin la
firma de Javier, y por la regla de puesto J4 propone pero no aplica. Los bloques A, C y B (opción 3)
los aplica J3 en `public/`; éste lo aplico yo.

## El cambio, literal

`docs/YAQU_MASTER.md:215`, Parte H2 («Mensaje en dos etapas»), Etapa 1 (pre-SIF):

| | texto |
|---|---|
| **antes** | `categoría = "herramienta para presupuestar, firmar y cobrar señales por WhatsApp"` |
| **después** | `categoría = "herramienta para presupuestar y firmar por WhatsApp"` |

Se retira «y cobrar señales» **sin sustituto**: hoy no hay ninguna función de cobro que sea verdad
para un merchant español, así que no hay nada que poner en su lugar.

## Por qué era falso: se contradecía consigo mismo en la misma línea

La línea 215 lleva, tres frases después de esa categoría, el guion único ante «¿me vale para
VeriFactu?» —reescrito y firmado el 22-sep (SCRUM-534, comentario 16404)— que dice literalmente:

> *«…en España la beta es de presupuestos y firma: **no emitimos ningún documento de facturación ni
> cobramos por la app** — la señal la gestionas tú por fuera.»*

La categoría de la propia Etapa 1 prometía justo lo que el guion de al lado negaba. Es la misma
familia de contradicción que motivó la reescritura del guion (regla 24 / SCRUM-612), sin resolver
en esta línea concreta hasta hoy.

## Controles de la aplicación, ejecutados y no supuestos

El cambio se aplicó con un script que **aborta** si cualquiera de estos controles no se cumple
(`scratchpad/aplicar-1086d.mjs`), no con una edición a mano:

| control | resultado |
|---|---|
| apariciones del texto viejo antes de tocar (se exige exactamente 1) | **1** |
| líneas del fichero antes → después | **1887 → 1887** |
| líneas que difieren entre antes y después | **1** |
| bytes retirados | **17** |
| el guion H2 de la misma línea sigue entero | **sí** |
| ocurrencias de «cobrar señales» que quedan en todo el máster | **0** |

## Lo que NO se ha tocado

- **Nada de `public/`** — los bloques A, C y B son de J3, en su propia rama.
- **Ninguna otra línea del máster.** No se aprovechó el viaje para corregir nada más: un cambio de
  máster lleva una firma, y esta firma cubre esta línea.
- **Ningún estado, flag ni transición** (reglas 27 y 30).

# APÉNDICE · 23-sep-2026 · SCRUM-1086e · Los censos de `public/` resincronizados con el bloque A/C/B, J3

**Fecha:** 23-sep-2026 · **Carril:** J3 · **Gate:** ninguno — resincroniza censos de test, no toca
copy publicado ni el mecanismo de SCRUM-568
**Medido contra:** `origin/main` = `a457077f4d73bb0d3923f98916ddf03ffbd2fb13` · 2026-09-23T09:53:38Z

## Encargo

El PR #1706 (esta rama) entró en rojo en CI (run 35840396154): 21 casos en 7 ficheros de test
(el aviso inicial decía «43» porque el log de CI imprime cada fallo dos veces — en «Tests» y en
«Por qué cayó» — y alguien los contó sin deduplicar). Los 21 son la MISMA causa: SCRUM-1086b quitó
del `public/` las promesas de cobro (`#como`, `#precios`, `#probar`) y varios censos que miden ese
HTML byte a byte —`scripts/_afirmaciones-publicadas.mjs` (SCRUM-564), `scripts/_hueco-condicion.mjs`
(SCRUM-564b) y la cifra acoplada de SCRUM-555— se quedaron citando texto que ya no existe.

## Qué se hizo — por causa medida, no por parecido

1. **`ANCLAS_564`** (`scripts/_afirmaciones-publicadas.mjs`): se quitaron las **11** entradas cuyo
   texto ya no aparece en el marcado (el demo de pago de `#probar`, el fee-note de `#precios`, «3 ·
   Cobra» de `#como`…) y se actualizaron las **4** con texto desfasado por el lote —
   `precios/li#3`, `precios/p#2`, `faq/div#1`, `faq/div#3`. La claim nueva, «Recordatorios
   automáticos de firma», se verificó contra código real antes de anclarla: existe
   (`src/modules/quotes/domain/reminder.service.ts::sendPendingReminders`, ya wireado en
   `src/core/cron/cron.ts`, sin flag) — no es un `SIN_ANCLA` a ciegas.
2. **Los documentos generados** (`docs/AFIRMACIONES_DEL_COPY_PUBLICADO.md`,
   `docs/DONDE_CABE_LA_CONDICION.md`) se re-generaron con sus propios scripts
   (`citar-afirmaciones-publicadas.mjs`, `citar-hueco-condicion.mjs`) — no se editaron a mano. El
   segundo generador tenía además prosa fija que citaba ejemplos ya retirados (`probar/span#15`,
   el caso de `precios/li#3`): se reescribió para que hable de lo que hay hoy, con los rangos
   calculados desde `HUECOS`, no hardcodeados.
3. **Los números fijos de los tests** (`AFIRMACIONES`, `GRUPOS_HOY`, `CUANTAS`, `CONDICIONADAS`…)
   se actualizaron a lo que la herramienta mide DESPUÉS del punto 1, nunca al revés: 28→17
   afirmaciones, 15→12 con ancla, 10→2 falsas, 9→1 condicionada a flag. `precios/li#3` y `faq/div#1`
   ya no son falsas — vuelven a ser CON_ANCLA. **`faq/div#3` sigue FALSA** (`SIN_ANCLA`, sin ancla
   individual a sus 8 capacidades) y **`todo/p#3` (en `#todo`, fuera del lote firmado) sigue
   prometiendo tarjeta/Bizum/transferencia** — el lote no la tocó; sigue siendo «lo que va delante
   del fundador», documentada en el `.md` regenerado.
4. **La familia de 5→3 pasos de la demo** (SCRUM-543, SCRUM-553, SCRUM-555 — el `<br>` entre
   título y descripción, y la cifra acoplada «la demo se numera 1…N»): SCRUM-1086b retiró los
   `try-step` 4 y 5, así que las tres quedan en 3, medido contando los `.try-step` reales, no
   decidido.
5. **SCRUM-985** («Excel»/«xlsx» solo donde está declarado): el nuevo texto de `#como`
   («…sin post-its ni Excel») nombra Excel para decir que NO hace falta, igual que la frase ya
   permitida de `csvImport.js` — se añadió a `EXCEL_PERMITIDO`, no se cambió el criterio.

## El trinquete de zona horaria (el otro check en rojo del run)

`trinquete · ningún test nuevo mide la zona de la máquina` marcaba 3 tests de
`scrum564b-hueco-condicion.test.mjs` como recién dependientes de la zona — pero **«ausente» en una
de las dos zonas, no «distinto resultado»**, y ninguno de los tres usa `Date`/`Intl`. Es el síntoma
de que el `ANCLAS_564` viejo (con los 11 huecos) hacía que ALGÚN test anterior del mismo fichero
lanzara y abortara el registro del resto — no una dependencia real del reloj. No confirmable en
esta máquina (sin Postgres/Docker: ese job corre contra un banco desechable). Con el registro
arreglado, los 13 tests de ese fichero corren limpios de punta a punta en local; lo confirma CI.

## Control al cerrar

- Cada uno de los 7 ficheros, en rojo primero (verificado contra el run de CI) y en verde después,
  por separado: 12+13+39+12+5 = correcto uno a uno antes de correr la tanda entera.
- `npm run build` limpio. Tanda completa (973 ficheros, `npm test`): **8168 tests · 8033 pass · 5
  fail**. Los 5 que quedan (`scrum476-reconciliar-censos`, `scrum910d-microcopy-recibo-pendiente`,
  `scrum939b-trinquete-de-las-skills` ×3) son ruido de ESTA máquina — desfase de `node_modules`
  entre las ~20 worktrees ajenas que viven en este árbol y una ruta de `gh.exe` hardcodeada —, no
  tocan ningún fichero de esta entrada y ya estaban rojos antes de empezar (no forman parte de los
  21 del run 35840396154).
- `git diff --stat` de este apéndice: los 6 ficheros de `tests/`, los 3 `scripts/` y los 2 `docs/`
  generados. Nada de `public/`.

# APÉNDICE · 23-sep-2026 · SCRUM-1086f · El párrafo de `#probar` firmado y aplicado, J3

**Fecha:** 23-sep-2026 · **Carril:** J3 · **Gate:** ninguno — cuatro palabras de copy firmado
**Skill UI:** cargada (yaqu-premium-ui) — cambio de texto puro, sin tocar layout/tokens
**Medido contra:** `origin/main` = `8599c18b4033a598cf87ce5c6dd0af198b75dfcc` · 2026-09-23T10:39:39Z

## Encargo

Hallazgo 1 de SCRUM-1086b (apéndice anterior): `index.html:525` seguía diciendo *"del
presupuesto al pago"* tras el bloque B opción 3 (el recorrido ya no llega al pago). Javier lo
firmó en **SCRUM-1086, comentario 16602**: cambiar únicamente esas cuatro palabras.

## El cambio, literal y verificado en rojo primero

`public/index.html:525`, dentro del párrafo de cabecera de `#probar`:

| | texto |
|---|---|
| **antes** (confirmado en el árbol antes de tocar) | `…avanza — del presupuesto al pago, como lo viven tú y tu cliente.` |
| **después** | `…avanza — del presupuesto a la firma, como lo viven tú y tu cliente.` |

Nada más de la frase se toca — ni "como lo viven tú y tu cliente", ni el `<h2>`, ni el
`eyebrow`. `git diff` de esta entrada: una sola línea de `public/index.html`.

## Efecto colateral medido, y resuelto igual que el resto del apéndice SCRUM-1086e

El nuevo texto activa el detector léxico (contiene «firma») donde el viejo («pago») no lo
hacía: el párrafo entero pasa a ser una AFIRMACIÓN nueva del censo SCRUM-564
(`probar/p#1`), antes fuera de alcance. Se declaró en `ANCLAS_564` con ancla `FIRMA` —la
misma que ya respalda `probar/span#9` y `probar/div#6`, es literalmente la misma promesa— y
se volvió a medir: **17→18 afirmaciones, 12→13 con ancla**. El documento
`docs/AFIRMACIONES_DEL_COPY_PUBLICADO.md` se regeneró con su script, no a mano.

## Lo que NO se toca

- **El subtítulo del hero espejo** (`:508`, `#heroe-f4`, `hidden`, `PENDIENTE_FUNDADOR`).
  Javier lo descartó como pendiente suelto: sin `hidden` no es promesa visible hoy, y se
  arregla en la misma pasada que el titular vivo (`:428`), bloqueado por SCRUM-1090/537.
  Queda igual — no forma parte de esta entrada.
- Los ficheros de `scripts/tests/docs` del apéndice SCRUM-1086e no se tocan de nuevo salvo
  para declarar `probar/p#1` y regenerar el `.md` afectado.

## Control al cerrar

- Los 7 ficheros de test de SCRUM-1086e, re-corridos completos tras el cambio: **81/81
  verde**. `npm run build` limpio. `npm run guards:entrada`: **112/112 verde**.
- `git diff --stat`: `public/index.html` (1 línea), `scripts/_afirmaciones-publicadas.mjs`
  (nueva entrada), `tests/scrum564-afirmaciones-publicadas.test.mjs` (números re-medidos),
  `docs/AFIRMACIONES_DEL_COPY_PUBLICADO.md` (regenerado), este fichero.
