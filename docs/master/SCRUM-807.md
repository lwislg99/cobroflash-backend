# SCRUM-807 · Los esquemas del href: uno de los tres era de verdad

**Fecha:** 7-sep-2026 · **Carril:** producto · seguridad — MEDICIÓN · **Gate:** sin gate
**Medido contra:** `origin/main` = `5af8e7e9cdcd15ac90eb9b8a1473737872b6625c` · 2026-09-07T01:05:00+01:00
**Tanda:** 5728 tests, 5626 pass, 0 fail, 102 skipped · `EXIT_REAL=0` (leído aparte, no del final de una tubería)

> **🛑 SE PARA AQUÍ Y NO SE CONSTRUYE.** La obligación 2 del encargo dice que si se puede meter un
> esquema, hay que parar y avisar antes de tocar nada. Se puede. Así que esto es la medición y el
> aviso; el arreglo está propuesto, no hecho, y es del fundador.

> Nace de mis propias declaraciones sin medir en el censo de [SCRUM-806](SCRUM-806.md). El encargo
> las planteó como **condición preocupante y no como vulnerabilidad**, a propósito, para no emitir
> una hipótesis con forma de medición. La primera obligación era averiguar cuál de las dos era.
> **Son las dos, una cada uno.**

---

## La respuesta, en una línea

De los tres href, **uno es inyectable y se ejecuta** (`?eml=`, un parámetro de URL) y **dos no lo
son** (`googleReviewUrl`, que su puerta de escritura rechaza). Que el segundo saliera limpio no es
un ticket fallido: es la mitad del resultado, y va escrita con el mismo detalle que la otra.

---

## Obligación 1 · ¿se puede meter un esquema que no sea http/https?

### A · `?eml=` (`receipt.routes.ts:115`) — **SÍ**

```
════ A · href de `?eml=` ════
   javascript simple                      -> 🔴 LLEGA: href="javascript:alert(1)"
   javascript en MAYÚSCULAS               -> 🔴 LLEGA: href="JaVaScRiPt:alert(1)"
   data: con html                         -> 🔴 LLEGA: href="data:text/html,&lt;script&gt;…"
   vbscript                               -> 🔴 LLEGA: href="vbscript:msgbox(1)"
   javascript con espacio delante         -> 🔴 LLEGA: href="  javascript:alert(1)"
   javascript partido por un salto de línea -> no llega
   ✅ NEGATIVO · https legítimo            -> se pinta ✅
```

Cinco de seis. `esc()` hace bien su trabajo —escapa `&<>"'`— y por eso el `data:` sale con sus
`&lt;`: el HTML está escapado. Pero **un href no se defiende escapando HTML, se defiende validando
el esquema**, y en `javascript:alert(1)` no hay un solo carácter que escapar.

### B/C · `googleReviewUrl` (`receipt.routes.ts:255` y `:261`) — **NO, por su puerta real**

Se probó por donde se escribe de verdad, `PUT /admin/merchant` con sesión, y **no** con un
`update` a pelo: meterlo por detrás habría sido fabricar el defecto que buscaba.

| carga | resultado |
|---|---|
| las 6 (javascript, mayúsculas, data:, vbscript, con espacio, con salto) | **`PUT 400`**, no se guarda nada |
| ✅ NEGATIVO · `https://g.page/r/…/review` | `PUT 200`, se guarda y **se pinta** |

Lo para el `z.preprocess` de `schemas.ts:461`: antepone `https://` a todo lo que no empiece por
`http`, con lo que `javascript:alert(1)` se convierte en `https://javascript:alert(1)` — puerto
inválido — y `.url()` lo rechaza. **Y se censaron todos los escritores de la columna:** sólo hay
uno de usuario y es ése; el otro es el sembrador, con una URL legítima.

> ⚠️ **Pero esa defensa es un efecto lateral.** El comentario que la acompaña dice para qué se
> puso: para tolerar que el profesional pegue `g.page/r/…` sin protocolo (A2.5). Nadie la escribió
> para bloquear esquemas. Una defensa que sujeta algo por accidente es una defensa que alguien
> puede quitar sin saber qué se lleva por delante. Queda dicho aquí y en `docs/BUGS.md`.

---

## Obligación 2 · ¿hasta dónde llega el de verdad?

**Sube a 🔴🔴 y se registra como `P0-SEC-8`.** Pero severidad se dice con lo medido, no con
adjetivos, así que aquí está lo que se midió — incluido lo que juega a favor.

### Se ejecuta, y en qué condiciones exactamente

Probado en un **Edge de verdad**, no razonado:

```
   href en el DOM: "javascript:void(document.title='EJECUTADO807bb9a59')"
   ① click REAL (CDP), tal cual está     título="Recibo #141 — YaQu" no ejecutó
   ② click real, sin target=_blank       título="EJECUTADO807bb9a59" 🔴 EJECUTÓ
   ③ navegación directa a ese mismo href título="EJECUTADO807bb9a59" 🔴 EJECUTÓ

   VEREDICTO: 🔴 SÍ SE EJECUTA — corrió código en el ORIGEN DE LA APP.
```

**Con el ancla tal y como se emite hoy —lleva `target="_blank"`— Edge NO lo ejecutó.** Sin el
target, y navegando directamente a ese mismo href (que es lo que pasa si alguien copia y pega el
enlace), **sí**. Otros navegadores **no medidos**: sólo hay Edge en esta máquina y se dice.

### Lo que juega a favor, medido

- La **cookie de sesión es `HttpOnly; SameSite=Lax`** (+`Secure` en producción), en
  `authMiddleware.ts:84` — desde JS no se puede leer.
- Hace falta un **`receiptToken` válido** (128 bits, opaco): un token inventado da 404. Quien
  **manda** el enlace del recibo es quien controla la carga.

### Lo que juega en contra, medido

- **No hay CSP** en esa página. Tampoco `X-Frame-Options` ni `X-Content-Type-Options`.
- El **único productor legítimo** de `?mail=saved&eml=` es `dev.routes.ts:99-100`, y `/dev` sólo se
  monta si `NODE_ENV!=='production'` (`app.ts:354`). O sea: **en producción nadie genera ese banner
  y la página lo sigue pintando a quien se lo pida.** El texto dice «(modo dev)»; el código no lo
  comprueba. Un cartel no es una condición.
- Es el **único `target="_blank"` del fichero sin `rel="noopener"`** — las otras tres anclas sí lo
  llevan. Con una URL externa, eso además da acceso a `window.opener`.
- Y ni siquiera hace falta un esquema raro para hacer daño: `?eml=https://…` planta un enlace
  externo dentro de una página con la marca del profesional. Eso funciona en todos los navegadores.

---

## Obligación 3 · el censo, por el método del 806

La pregunta no es «¿dónde aparece la cadena `javascript:`?» —un censo de literales no puede
encontrar un defecto que vive en un valor— sino: **¿qué href se rellenan con una expresión que
puede traer su propio esquema?** Un href que empieza por `/algo/` o `${BASE_URL}/algo/` no puede:
el prefijo ya fija el esquema.

**53 href en el lado público (25 montajes, 24 ficheros). 5 pueden traer esquema:**

| dónde | href | veredicto |
|---|---|---|
| `receipt.routes.ts:115` | `${esc(emlParam \|\| '')}` | 🔴 **inyectable y ejecuta** |
| `receipt.routes.ts:255` | `${esc(reviewUrl)}` | validado aguas arriba (400) |
| `receipt.routes.ts:261` | `${esc(reviewUrl)}` | validado aguas arriba (400) |
| `customerPortal.routes.ts:305` | `${esc(pdfUrl)}` | **ya arreglado en SCRUM-806**, sin mezclar aún |
| `customerPortal.routes.ts:350` | `${esc(pdfUrl)}` | no alcanzable por un usuario (abajo) |

Los dos de `pdfUrl` **no los escribe nadie de fuera**: censados sus escritores, todos son del
propio código (`publicUrlPath`, `'PENDING_PDF'`, plantillas del servidor). Además el portal hace
`startsWith('http') ? valor : BASE_URL + valor`, así que un esquema raro acabaría pegado detrás de
nuestro propio origen. No se tocan: el 305 es la 806 y el 350 es la 762, en la mesa del fundador.

**Controles del censo:** ✅ encuentra los **tres** que ya había nombrado (los positivos exigidos);
✅ un href relativo (`/pay/invoice/…`) **no** se marca, o sea que no marca todo lo que ve; y el
falso positivo declarado en el 806 —`${mm.href}`, que mi instrumento no resuelve porque no sigue
variables— **sigue fuera del recuento y nombrado**, no borrado. Leído a mano, sus cuatro valores
son `/pay/…`.

**Límite declarado:** esto mira el **lado público del servidor**. Los href que construye el panel
en `public/dashboard/js/` **no están medidos** en este ticket.

---

## Obligación 4 · el arreglo, PROPUESTO y no hecho

Cuando el fundador dé el paso, y siguiendo lo que el encargo ya marca:

1. **Validar el esquema DONDE SE CONSTRUYE EL HREF**, no dentro de `esc()`. `esc()` escapa HTML y
   lo hace bien; darle dos trabajos garantiza que un día haga mal uno de los dos.
2. Y/o poner el banner tras **el mismo gate de entorno que su único productor**: si sólo `/dev` lo
   genera y `/dev` no existe en producción, el banner tampoco tiene por qué existir allí.
3. Al pasar, `rel="noopener"` — que es lo que ya llevan sus tres vecinas del mismo fichero.

Las tres son de una línea. **Ninguna se ha escrito**, porque el encargo dice parar y tiene razón:
un arreglo «de paso» en un sitio así es cómo se cuela el siguiente.

---

## Tres veces estuve a punto de firmar lo contrario de lo que pasaba

Se cuentan porque el método es lo que se está construyendo aquí:

1. **La cookie.** Mi primer instrumento buscó `httpOnly` en un solo fichero, no lo encontró y
   escribió `🔴 (no aparece)`. La cookie **sí** es `HttpOnly` — se pone en `authMiddleware.ts:84`.
   Habría inflado la severidad con un dato falso.
2. **El click.** El primer intento en navegador dio «no ejecuta», con un click **programático**
   sobre un ancla con `target="_blank"`. Eso era mi método fallando, no el navegador defendiendo.
   Con click real y tres variantes, dos ejecutan.
3. **La carga.** `javascript:document.title='X'` **devuelve** una cadena, y entonces el navegador
   sustituye el documento entero: leí `título=""` de una página que ya no existía y estuve a un
   renglón de escribir «no se ejecuta» cuando pasaba justo lo contrario. Con `void(...)` la página
   sigue en pie y el veredicto se ve.

Las tres son la misma lección del 806 desde el otro lado: **un negativo por el motivo equivocado
vale tan poco como un verde por el motivo equivocado.**

---

## Prohibiciones del encargo, respetadas

- **No se ha ensanchado `esc()`.** No se ha tocado.
- **No se ha tocado el botón del PDF del portal** (806) **ni el de la factura** (762).
  `P1-PORTAL-PDF` sigue sin tachar.
- **Ni un literal nuevo, y ni una línea de `src/`**: este ticket no toca código. Por eso tampoco
  hay superficie pública nueva que declarar ante SCRUM-98 ni SCRUM-243.
- **Cero producción y staging.** Todo en dev, con el guard de destino diciendo `cuadra`, y el
  navegador contra `127.0.0.1`. Base igual antes y después en las cuatro pasadas.
- **La tanda no se canalizó por una tubería:** se redirige a fichero y `$?` se guarda aparte.
