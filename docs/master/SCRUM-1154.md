# SCRUM-1154 · La política de privacidad nombra a Google (Gemini) y deja de nombrar a Anthropic

**Medido contra:** `origin/main` = `d0b297652092dee8177239b41f2cbdacd0fa6340` · 2026-09-30T20:54:24+01:00
(orquestador del equipo de Javier, `cobroflash-backend-47`)

A9: comprobación → `tests/scrum1154-google-encargado.test.mjs`

## 0 · El permiso, y quién lo leyó

**Firma del fundador: SCRUM-1154, comentario 17576.** Javier firma **en persona**, no por
delegación: es texto legal publicado y la delegación permanente de
`docs/equipo/limites-del-fundador.md` **no cubre** los textos legales (regla 39).

Su literal: **«Firmo y quitala».** Las dos mitades de la frase son las dos mitades del cambio.

✅ **Leído de primera mano por quien lo aplica.** El orquestador recogió esa firma él mismo y la
escribió en el comentario; no hay aquí ninguna transcripción de segunda mano que rotular. Es la
primera vez hoy que eso ocurre, y por eso se dice: ayer tres sesiones distintas se quedaron
bloqueadas por no poder abrir ese comentario.

El texto literal, con su línea de firma comprobable, vive en
`docs/microcopy/2026-09-29-SCRUM-1154-encargados-privacidad.md` (el día del nombre es el de la
aprobación, no el de la aplicación, como pide el README del directorio).

## 1 · Qué cambia en la página

`public/privacidad.html`, §5 «Con quién compartimos los datos»:

- ✅ **Entra** la fila de **Google (Gemini)**, con el texto firmado, **carácter a carácter**.
- ✅ **Sale** la fila de **Anthropic**. No se reescribe: se borra.

**El motivo de la baja va con la decisión**, porque es lo que impide que alguien la «arregle»
mañana: hoy a Anthropic **no le llega ningún dato**. Sólo se usaría si faltara `GEMINI_API_KEY`, y
`ANTHROPIC_API_KEY` ni siquiera está puesta; el «proveedor de respaldo» **se midió y no existe** —
con un 429 de Google, cero llamadas. Una política de privacidad lista **quién recibe datos**.

⚠️ El día que se encienda, **vuelve a firma**. No queda un texto «por si acaso».

## 2 · Por qué había que aplicarlo, y por qué nadie lo había cazado

El programa mandaba a Gemini el texto de los presupuestos, **el dictado de los partes** y **la foto
entera de los tickets de gasto**, y la política no nombraba a Google. Decía lo contrario de lo que
hacía el programa.

SCRUM-950 se cerró «Finalizada» **sin aplicar su §5**, y el defecto sobrevivió a ese cierre. La
razón de que sobreviviera la midió J6 el 29-sep: **ningún test fijaba la fila de Anthropic**. Quitarla
—o no poner la de Google— no lo habría cazado nadie. Por eso este PR trae guard.

## 3 · El guard: `tests/scrum1154-google-encargado.test.mjs`

**El texto no se escribe en el test: se LEE de su firma.** Lo que se compara contra la página es el
literal del registro de aprobación, no una copia tecleada. Si alguien reescribe el texto de la
página —aunque sea para mejorarlo— deja de coincidir con lo firmado y el guard cae. Eso es la
regla 39 convertida en comprobación, y además hace imposible que el test y la firma se separen sin
que nadie lo note.

🔴 **Y `fonts.googleapis.com` PARECE Google sin serlo.** Un guard
que buscara «google» daría verde por el motivo equivocado. Hay un caso dedicado que lo demuestra: se
le da una página **con** las fuentes cargadas y **sin** la fila, y tiene que decir que no está.

Los cuatro casos:

| Caso | Qué sujeta |
|---|---|
| **SUELO** | el §5 acotado contiene a Meta, Stripe, Resend y Railway, y el corte no se pasa a la sección siguiente. Sin esto, todo «X no está» sería una ceguera con cara de veredicto |
| **Google figura** | el §5 contiene **carácter a carácter** el literal que consta firmado en SCRUM-1154, y ese literal menciona el dictado, el ticket y la transferencia internacional |
| **EL QUE DECIDE** | `fonts.googleapis.com` no cuenta como nombrar a Google |
| **Anthropic no figura** | con su control positivo: el mismo detector, sobre la misma página con el nombre metido a mano, **sí** lo encuentra |

### Y una decisión que tomó el trinquete de SCRUM-553, no yo

La primera versión troceaba la lista con una expresión regular sobre `<li>`/`<strong>`, y después con
literales de etiqueta. **SCRUM-553 saltó las dos veces**: el repo lleva la cuenta de los extractores
que parsean HTML con el `>` pegado y **no deja que suba** (tope 20; mi fichero la ponía en 28).

**No se ensanchó el tope.** Se cambió el test, que es lo que el trinquete pide. Ahora el §5 se acota
por los **títulos visibles** de las secciones —«Con quién compartimos los datos» y «Conservación»—,
que son texto del documento y no marcado. El guard quedó **mejor** que la versión que el trinquete
rechazó: ya no depende de cómo esté escrito el HTML.

### Interrogado, no sólo visto verde

Tres mutaciones sobre la página, cada una con el caso en el que tenía que caer, **y las tres caen**:

| Mutación | Cae en |
|---|---|
| (a) se quita la fila de Google | «Google (Gemini) figura como encargado» |
| (b) vuelve la fila de Anthropic | «Anthropic NO figura como encargado» |
| (c) se reescribe **una palabra** del texto firmado | «Google (Gemini) figura como encargado» |

La (c) es la que vale para un texto legal: no basta con que ponga «Google», tiene que poner **lo que
el fundador firmó**.

Post-condición de **contenido**: `public/privacidad.html` quedó con el mismo sha256 que antes de
mutar. Un `finally` no basta — si el proceso muere se lo salta.

## 4 · Tres cosas que me cazaron a mí, y no al revés

**① El control positivo del caso de Anthropic.** Su primera versión inyectaba la fila de prueba con
un `replace` sobre el documento entero, que toca el **primer** cierre de lista del fichero —está
antes del §5—, así que el control salió rojo contra quien lo escribía. El `assert` habría pasado
igual sin él, midiendo otra lista.

**② El trinquete de SCRUM-553**, dos veces (§3).

**③ La precondición del instrumento de mutación.** Al renombrar un caso del test, el script que lo
interroga siguió esperando el nombre viejo y dio «cayó, pero no donde debía». Ahora comprueba
primero que cada nombre esperado **existe** en el fichero de test: cuesta un segundo y evita una
tanda entera midiendo a ciegas.

## 5 · 🔴 Lo que este cambio NO arregla, y queda ABIERTO

**La facturación del proyecto de Google.** Sus condiciones para la API de Gemini exigen **servicio de
pago** para poner clientes a disposición de usuarios del EEE, y el repositorio documenta que
producción va en el **nivel gratuito**. Si el proyecto de producción no tiene facturación activa,
este tratamiento **no es lícito con usuarios en España, se escriba lo que se escriba en la
política**. Medido en el comentario 17317; va al equipo de Luis.

**Aplicar este texto no cierra ese asunto.** Y tampoco se ha comprobado si `GEMINI_API_KEY` está
puesta en producción: los documentos dicen que sí, **nadie lo ha mirado**.

## 6 · Dos huecos del §5 que piden ticket propio

- ~~**Google Fonts**~~ — **CORREGIDO el 30-sep: no es un hueco.** Ver el apéndice del final.
- **Cloudflare** ve todo el tráfico de `yaqu.app` y reescribe el HTML servido. No figura en el §5.

Los dos los midió J4 en el comentario 17317. **No se arreglan «de paso»** (A7).

## 7 · Qué falta para cerrar el ticket

① firma ✅ · ② aplicarlo ✅ (este PR) · ③ **verificarlo en lo que sirve `yaqu.app`** ← después del
merge, y lo hace el orquestador.

---

# APÉNDICE · 30-sep-2026 · Una afirmación mía que era FALSA

**Medido contra:** `origin/main` = `79b8513da48bdc8cb1de0dc209bb6dfae9a89db3` · 2026-09-30T23:37:15+01:00
(orquestador del equipo de Javier, `cobroflash-backend-47`)

A9: aviso → A10 «Un dato copiado de un registro lleva la fecha en que se midió, no la de hoy.» — no se pudo comprobar: lo que falló es una afirmación en PROSA sobre el estado del código, y el guard que la habría desmentido (`tests/scrum1234-inter-autoalojada.test.mjs`) ya existía y estaba en verde — lo que falló fue no consultarlo. Un guard nuevo sobre esta cadena cazaría el caso y no la clase.

⚠️ **Re-anclado DOS veces, y la segunda por un defecto que merece quedar escrito.** Primero contra
`d65cfaa9`; luego escribí `7042852f`, que era lo que `git rev-parse origin/main` había dicho **setenta
minutos antes**; y la base real de la rama era otra. Ancla definitiva, la de arriba.

🔴 **Por qué se movió sin que yo lo tocara: los siete worktrees de esta máquina comparten UN solo
`.git`.** `refs/remotes/origin/main` es de todos, así que cuando otra sesión hace `fetch`, mi
`origin/main` avanza **por debajo**, sin que yo ejecute nada. Copiar el sha de `git rev-parse` no
basta: hay que copiarlo **en el momento de anclar**, y comprobar que coincide con la base de la rama
(`git rev-parse HEAD~1`, o el merge que la trae). Aquí no coincidía.

Las tres afirmaciones se volvieron a medir contra el sha definitivo: `0` aciertos de
`fonts.googleapis.com`/`fonts.gstatic.com` en `public/` y en `src/`, con control positivo de que la
misma maquinaria SÍ encuentra `fonts/inter` en 8 ficheros de `public/` —de modo que el cero no es un
`grep` ciego—, y el guard de SCRUM-1234 presente en `main`. Los shas viejos se dicen en vez de
borrarse: un ancla que cambia sin explicar por qué es una fecha nueva sobre una medición vieja.

## Qué dije, y qué es verdad

Escribí en este registro, en el de microcopy y en el comentario de cierre del ticket que **Google
Fonts era un hueco abierto del §5**: que `fonts.googleapis.com` se cargaba «en 7 de las 9 páginas de
`public/` y en 9 superficies servidas desde `src/`», y que cada visita mandaba la IP del cliente
final a Google sin que la política lo dijera.

🔴 **Era falso, y llevaba dos días siéndolo.** Lo midió J5:

- `fonts.googleapis.com` y `fonts.gstatic.com` salen **0 veces** en `public/` y en `src/`.
- **Inter se sirve del propio dominio**: `public/fonts/` con sus 7 `.woff2` y su `inter.css`.
- Lo cerró **SCRUM-1234** el 28-sep (PR #1908, merge `a3c0be3e`): «fuera `fonts.googleapis.com` y
  `fonts.gstatic.com` de las 16 superficies, 9 del cliente final».
- **Hay un guard que impide que vuelva**: `tests/scrum1234-inter-autoalojada.test.mjs`, que además
  comprueba que las 16 superficies piden `/fonts/inter.css`.
- Y verificado en **producción**: `/`, `/login.html`, `/register.html`, `/precios`, `/privacidad`,
  `/terminos` y `/dashboard/` dan `google = 0` y cargan `/fonts/inter`.

## De dónde venía el dato, y por qué eso no me excusa

De la medición de J4 en el comentario 17317 de este ticket, del **28-sep**. Era cierta **cuando se
tomó** y dejó de serlo ese mismo día, cuando entró SCRUM-1234.

**Yo la repetí dos días después sin volver a medirla**, en tres sitios, uno de ellos un registro de
aprobación de texto legal. Es la misma forma que ya tengo apuntada: *una avería declarada como
corregida se barre en el presente*. La heredé como cierta porque venía escrita.

## Y otra premisa mía, también falsa

Escribí que `privacidad.html` «no carga fuentes de Google, por eso el guard puede probar ese caso a
mano». **Falso en las dos mitades**: sí las cargaba —está en la lista de las 16 de SCRUM-1234— y hoy
no las carga porque 1234 se las quitó. Y el control del guard **no depende de eso**: inyecta el texto
`fonts.googleapis.com` a mano en el §5 para comprobar que no lo cuenta como encargado. El caso sigue
siendo bueno; mi explicación de por qué era mala.

## Qué queda, de verdad

El **único** hueco abierto del §5 sigue siendo **Cloudflare**, y no es una impresión: su literal
**L3 está firmado** desde el 29-sep (SCRUM-1196, comentario 17453) y **sin publicar**.

⚠️ Y una pregunta que J5 deja bien planteada y que decide el fundador: **si el §5 debe decir algo
sobre las fuentes ahora que ya no hay ningún tercero a quien nombrar.** Su lectura, y la comparto:
no, porque una política lista a quien **recibe** datos y aquí ya no los recibe nadie.
