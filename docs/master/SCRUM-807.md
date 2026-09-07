# SCRUM-807 · Los esquemas del href: uno de los tres era de verdad

**Fecha:** 7-sep-2026 · **Carril:** producto · seguridad — MEDICIÓN **y luego** construcción · **Gate:** sin gate
**Medido contra:** `origin/main` = `349350c8a7a34f24e9263aba1ca2af36e3cb4a91` · 2026-09-07T01:45:00+01:00
**Tanda:** 5755 tests, 5653 pass, 0 fail, 102 skipped · `EXIT_REAL=0` (leído aparte, nunca del final de una tubería) · tras mezclar main

> **DOS TIEMPOS, y el primero fue parar.** La obligación 2 mandaba avisar antes de construir: se
> avisó, y el arreglo llegó autorizado en un segundo encargo (defensa pura + un gate DERIVADO del
> rótulo que el propio banner ya llevaba). Lo de abajo está en orden: primero lo medido, después lo
> construido. **Ni una línea de la medición se ha reescrito para que cuadre con el arreglo.**

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

Cinco de seis en aquella pasada — **y luego fueron seis de seis**: la que fallaba la mandé mal
codificada, y con `encodeURIComponent` llega también. La cifra buena es **6/6**, medida dos veces.
`esc()` hace bien su trabajo —escapa `&<>"'`— y por eso el `data:` sale con sus
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
| `customerPortal.routes.ts:305` | `${esc(pdfUrl)}` | **ya arreglado en SCRUM-806**, mezclado mientras esto se construía (PR #1115) |
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

## Obligación 4 · lo construido (segundo encargo)

Tres cosas, todas en la misma línea del fichero, y ninguna inventa nada:

| # | qué | dónde |
|---|---|---|
| ① | **La lista blanca**: el href pasa por `hrefSeguro()` | `core/utils/utils.ts`, **al lado de `esc` y NO dentro** |
| ② | **El gate**: el banner sólo existe donde existe su productor | `receipt.routes.ts` — `config.NODE_ENV !== 'production'` |
| ③ | **`rel="noopener"`** | la misma ancla; era la única del fichero sin él |

**Por qué `hrefSeguro` vive al lado de `esc` y no dentro.** `esc` escapa HTML y lo hace bien; el
problema nunca fue suyo, era que le pedíamos otro trabajo. Darle dos garantiza que un día haga mal
uno de los dos. Va pegada para que quien busque `esc` para un href se tropiece con ella.

**Por qué lista blanca y no lista negra.** Las seis cargas lo demuestran solas: bastaron las
MAYÚSCULAS y un ESPACIO delante para colarse. Una lista negra es un censo de lo que se le ocurrió a
alguien un martes. La blanca es corta porque la aplicación necesita poco: **un camino propio**
(`/outbox/…`, que es lo que produce el flujo real) y **http/https**. Lo demás sale `'#'` — un ancla
inerte, que no es copy: es la forma estándar de no ir a ninguna parte, y no cambia el texto de nadie.
`//evil` y `/\evil` **no** cuentan como camino propio: el navegador se los lleva a otro origen, así
que se mira el segundo carácter y no sólo el primero.

**Y el gate es DERIVADO, no inventado**: el banner ya decía «(modo dev)» y el código no lo
comprobaba. Se le pone el mismo gate que a su único productor. Re-verificado antes de tocarlo (más
abajo) que ese productor sigue siendo único: si hubiera aparecido un segundo, gatear habría roto
algo real y tocaba parar otra vez.

---

## Los cuatro controles

### 🔴 EL QUE DECIDE — las seis cargas, ANTES y DESPUÉS, pegadas

Y por **navegación directa**, no con click programático: yo misma medí que el click programático
sobre un `target="_blank"` no reproduce el gesto real y estuve a un renglón de firmar lo contrario
de lo que pasaba.

```
════ DESPUÉS (el código de hoy) ════
   javascript simple                      href="#" ✅ inerte
   javascript en MAYÚSCULAS               href="#" ✅ inerte
   data: con html                         href="#" ✅ inerte
   vbscript                               href="#" ✅ inerte
   javascript con espacio delante         href="#" ✅ inerte
   javascript partido por salto de línea  href="#" ✅ inerte

════ ANTES (la forma anterior, restaurada a propósito) ════
   javascript simple                      href="javascript:void(document.title=&#39;x&#39;)" 🔴 LLEGA CRUDA
   javascript en MAYÚSCULAS               href="JaVaScRiPt:void(document.title=&#39;x&#39;)" 🔴 LLEGA CRUDA
   data: con html                         href="data:text/html,&lt;script&gt;1&lt;/script&gt;" 🔴 LLEGA CRUDA
   vbscript                               href="vbscript:msgbox(1)" 🔴 LLEGA CRUDA
   javascript con espacio delante         href="  javascript:void(document.title=&#39;x&#39;)" 🔴 LLEGA CRUDA
   javascript partido por salto de línea  href="java\nscript:void(document.title=&#39;x&#39;)" 🔴 LLEGA CRUDA

   llegaban ANTES: 6 de 6 · llegan AHORA: 0 de 6
   ✅ el arreglo MUERDE: lo que pasaba ya no pasa, y se ve que pasaba
```

El fichero se restauró **byte a byte** (sha256 idéntico) y se recompiló.

### ✅ EL POSITIVO — lo bueno sigue funcionando

```
   ✅ el .eml real del flujo de dev: href="/outbox/invoice-2026-CF-001.eml"
   ✅ un https:// legítimo:          href="https://ejemplo.invalid/correo.eml"
```

Si al cerrar el hueco se rompe un enlace bueno, se ha roto por el otro lado. No se rompió.

### ✅ EL GATE, en los dos sentidos

```
   ✅ en DESARROLLO el banner SÍ se pinta
   [proceso aparte, NODE_ENV=production] SIN BANNER en produccion simulada
   ✅ en PRODUCCIÓN simulada el banner NO se pinta
```

**En un proceso aparte**, y no es un detalle: `config` se resuelve al importar, así que cambiar
`NODE_ENV` dentro del mismo proceso no habría cambiado lo que el módulo ya leyó — la misma lección
de la caché de módulos del 762. Y aunque diga `NODE_ENV=production`, **la base sigue siendo la de
desarrollo**: sólo se simula el entorno de ejecución, y el guard de destino lo dice en cada línea.
El control lleva dentro su propio suelo: comprueba que la página *se sirvió* (`Recibo #…`) antes de
concluir que el banner no está — si no, «no se pintó» y «no se pudo mirar» serían el mismo verde.

### ✅ googleReviewUrl sigue rechazando, y ahora por su propio motivo

`6/6` cargas siguen dando `PUT 400`, y un `https://` legítimo entra con `200`. Pero lo que las para
es un `z.preprocess` **que se puso para otra cosa** (A2.5: tolerar `g.page/r/…` sin protocolo). Una
defensa que sujeta algo por accidente es una defensa que alguien quita sin saber qué se lleva por
delante — así que el guard nuevo la sujeta **por su motivo**, con las seis cargas, con el enlace
legítimo y con el caso sin protocolo que el preprocess existe para permitir. Quien lo toque verá en
rojo qué estaba aguantando.

---

## El guard, y la prueba de que muerde

`tests/scrum807-esquemas-del-href.test.mjs`, 6 tests, dentro de `npm test` (sin BD ni servidor).
Se retiró **cada defensa por separado**:

```
[sin tocar] VERDE ✅
   ✅ ROJO · quitar la validación de esquema del href
   ✅ ROJO · quitar el gate de entorno del banner
   ✅ ROJO · quitar el rel="noopener"
   ✅ ROJO · aflojar la lista blanca (colar javascript:)
[restauración] los dos ficheros, byte a byte: sí ✅
[tras restaurar] VERDE ✅
```

Uno de los seis tests vigila algo que **no** es este arreglo: que `esc` **no** se haya ensanchado.
Si alguien un día mete la validación ahí dentro, se pone rojo y le manda a leer por qué son dos
funciones y no una.

---

## Obligación 1 · re-verificado ANTES de gatear

Censado todo el árbol (`src/`, `public/`, `scripts/`, `tests/`): el único productor de
`?mail=saved&eml=` sigue siendo `dev.routes.ts:100`, y `/dev` sólo se monta si
`NODE_ENV!=='production'` (`app.ts:354`). **Si hubiera aparecido un segundo, tocaba parar otra vez**
— gatear el banner habría roto algo real.

---

## Tres veces estuve a punto de firmar lo contrario de lo que pasaba

> **Tienen nombre, y no lo he puesto yo:** EL INSTRUMENTO CONTESTÓ A UNA PREGUNTA DISTINTA DE LA
> QUE SE LE HIZO. Las tres son de esa familia, y por eso van escritas aunque las cazara a tiempo.

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
- **Ni un literal nuevo.** El banner conserva su texto; lo único con forma de cadena que se ha
  escrito es `'#'` (ancla inerte, no copy) y el nombre de una función.
- **No hay superficie pública NUEVA**: no se ha añadido ninguna ruta, sólo se ha endurecido una que
  ya existía y ya estaba declarada. SCRUM-98 y SCRUM-243 no tienen nada que declarar aquí, y la
  tanda entera lo confirma en verde.
- **Cero producción y staging.** Todo en dev, con el guard de destino diciendo `cuadra`, y el
  navegador contra `127.0.0.1`. Base igual antes y después en las cuatro pasadas.
- **La tanda no se canalizó por una tubería:** se redirige a fichero y `$?` se guarda aparte.
