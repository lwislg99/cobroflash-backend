# SCRUM-460 · Bajar el paquete y servirlo sin red (H1 · fase 3)

**Fecha:** 10-ago-2026 · **Carril:** H (offline) · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `e9a2707eeaa481b40d9fb0737d3544abc04dc408` · 2026-08-10T23:36:16+01:00
**Tanda:** 2916 tests · 2842 pass · **0 fail** · 74 gateados · `npm test` exit **0** · `guards:entrada` 17/17

## PASO 0

**a)** `docs/master/SCRUM-460.md` no existe en `main`; no hay rama `scrum-460-*`.
**b) La premisa se sostiene:** SCRUM-458 está en `main` (ancestro **y** contenido), su servicio
existe, y el trinquete de SCRUM-411 sigue en **8** — la deuda que este ticket paga.

**ENTRADA.** No había superficie: se crea `GET /admin/precarga`.
**MECANISMO.** El productor (458), el almacén (455) y el purgado (455/457) ya están.

## 🔴 Los números de producción cambian qué es el caso normal

Medidos por el fundador el 10-ago-2026: **42 trabajos · 35 no cerrados · 0 agendados hoy o mañana ·
26 sin agendar en absoluto (62 %) · 1 tocado en los últimos 7 días.** Con esos datos **la precarga
bajaría como mucho un albarán en toda la producción**.

La política no se toca —42 filas de un producto que empieza dicen más de nuestra adopción que del
criterio—, pero **la unión vacía deja de ser el caso raro: es el que va a ocurrir casi siempre.** Un
profesional que abre la app, ve que «está preparado» y baja al sótano con cero albaranes precargados
es exactamente la víctima de H1.

Por eso se distinguen **tres** cosas y no dos, y ninguna se colapsa:

| resultado | qué significa |
|---|---|
| `NADA_QUE_PRECARGAR` | **no había nada que precargar.** Es cierto, y hay que decirlo. |
| `NO_SE_PUDO` | **no supe mirar.** Es un fallo, y hay que decirlo **distinto**. |
| `PRECARGADO` | **precargué N**, y **N se puede ver**. |

Y **guardar a medias es `NO_SE_PUDO`, no «precargué algunos»**: el profesional que lea «precargado»
y le falte justo el albarán que iba a firmar está **peor** que si no le hubiéramos dicho nada.

## Lo que se construye

**① La ruta.** `GET /admin/precarga`, con `mountAdmin` (hereda `requireAuth` y `req.merchantId`). El
aislamiento por merchant ya tiene test en 458 y **no se relaja**. Con esto `precarga.service.ts` pasa
a ser alcanzable y **el trinquete de SCRUM-411 baja de 8 a 7 en este mismo commit**, que es lo que su
fichero exige. Estuvo en 8 exactamente lo que duró la deuda: para eso sirve.

> 🔴 **ADMIN-ONLY, y eso tiene un coste que no se esconde:** el que baja al sótano puede ser un
> **técnico**, y así no se precarga nada para él. Abrirlo **no es cambiar un rol**: el paquete de 458
> filtra por `merchantId` y **no** por `operarioId`, así que un técnico recibiría los albaranes de
> **todo** el merchant — justo el filtro row-level de SCRUM-23/147. Son **dos** decisiones (permiso y
> alcance del paquete) y las toma el fundador.

**② Cuándo se dispara — decisión, no detalle.** **Al arrancar Y al volver a la pestaña**
(`visibilitychange` → `visible`, que ya usa el vigilante de versión). Solo al arrancar sería pedirle
al profesional que se acuerde de recargar antes de meterse en un sótano, justo lo que la política
venía a evitar: el caso que se escapa es el normal —abre la app en casa, la oficina emite el albarán
a las diez, y él no recarga en todo el día—. Con **acelerador** de 5 min: volver a la pestaña doce
veces no son doce paquetes.

> **✋ Lo que deja fuera, dicho:** si el profesional **no trae la app al frente con cobertura** entre
> que el albarán se emite y él baja al sótano, **no se precarga nada**. No hay tercer momento
> disponible: `Periodic Background Sync` no existe en Safari/iOS y el push no está montado. Y no se
> usa `navigator.onLine` para decidir —miente en este escenario exacto y tiene cero usos en el árbol
> a propósito (SCRUM-356)—: se intenta y se mira el resultado.

**③ Guardar, respetando los tres resultados del almacén.** `GUARDADO` solo con `tx.oncomplete`;
`NO_DISPONIBLE` y `FALLO` **no se colapsan**: el primero no se arregla reintentando y el segundo sí.

**④ Servirlo sin red — y SIN TOCAR `sw.js`, que es deliberado.** El albarán se sirve desde
**IndexedDB**, no desde la Cache API, y `albaranDetailView.js` y `almacenLocal.js` **ya están en el
SHELL**. `cache.addAll` es **atómico**: tocarlo mal deja a todo el mundo sin offline a la vez y en
silencio (SCRUM-231). Aquí no hacía ninguna falta, así que **no hay fichero nuevo ni cambio de
precache** — y por tanto tampoco hay nada que declararle al guard de SCRUM-274.

## 🔴 Dos defectos que encontró el test de modo avión, no una lectura

1. **El paquete y la pantalla no tienen la misma forma.** El paquete es **plano** por minimización
   (`clienteNombre`, `jobTitulo`) y el rail lee `alb.customer.name` y `alb.job.titulo`: sin traducir,
   el profesional abría en el sótano una ficha que decía **«Cliente —»** y **«Trabajo —»**.
   Traducido. Y lo que **no** viaja se deja **ausente** —`estadoFacturacion`, `pendientes`—: inventar
   un valor sería afirmar algo que nadie ha comprobado.
2. **La pantalla de detalle NO pinta las líneas**: las delega al Trabajo (`btnEditarLineas`). Mi
   primera aserción decía que salían y **el rojo era mío**. Ahora se afirma lo que sí importa y sí es
   cierto: que **viajen**, porque son el contenido que la firma sella.

## Microcopy — MEDIDA y PROPUESTA, no dada por buena

**La caja, con el CSS real:** `.view-container` 12 px de padding a cada lado (≤ 768 px) + `.alert`
14 px → **ancho útil 338 px a 390 y 268 px a 320**. `.alert` es 13,5 px con `line-height` 1,5 →
**~20 px por línea**. Con Inter a 13,5 px (avance medio ≈ 0,50 em ≈ 6,8 px/carácter): **~49
caracteres por línea a 390** y **~39 a 320**.

| # | propuesta | car. | a 390 | a 320 |
|---|---|---|---|---|
| **a** | «Este albarán no se descargó y ahora no hay cobertura. Podrás abrirlo cuando tengas señal.» | 89 | 2 líneas (~40 px) | 3 líneas (~60 px) |
| **b** | «Sin cobertura no puedes crear albaranes, solo firmar los que ya llevas descargados.» | 83 | 2 líneas (~40 px) | 3 líneas (~60 px) |

Las dos caben sin recortar en los dos anchos. **Salen con marcador `[PENDIENTE microcopy oficial]`
hasta que las apruebes** (regla 30), y el censo de SCRUM-402 sube de **1 a 3** en
`albaranDetailView.js` **a conciencia y con su motivo escrito**: el mecanismo no existe sin texto, y
sin (b) el límite «no se crea sin red» —que quedó fuera de alcance **por decisión**— se vive como una
avería. **Bajan a 1 el commit que las apruebe.**

## Verificado

**8 tests.** **Cuatro rojos por el MECANISMO**, con post-condición en disco:

| # | qué se rompe | qué sale |
|---|---|---|
| **R1** | el guardado deja de contar | 🔴 «no se precargó: `NO_SE_PUDO`» |
| **R2** | no se mira lo precargado al fallar la red | 🔴 «sin red, el albarán precargado **NO se abre**… es el punto entero del bloque H» |
| **R3** | dice que guardó y **no** guarda | 🔴 «dice haber precargado y el almacén está vacío» + «la escritura no confirmó y el resultado dice PRECARGADO» |
| **R4** | el purgado deja de llevarse lo precargado | 🔴 «tras cerrar sesión **sigue en el móvil** el albarán precargado, con su cliente y sus líneas» |

**Control positivo y es el test:** modo avión (`corteAMediaSubida`) + albarán precargado → **se abre**,
con su número, su cliente, su trabajo y su botón de firmar. **Control negativo:** sin red y **sin**
precarga → se avisa, y **no** se pinta el documento; ni pantalla en blanco ni formulario vacío que
invite a firmar algo que no está. **Suelos, por separado:** el escenario tiene que haberse ejercido ·
tiene que haber algo precargado que purgar antes de afirmar que el purgado funciona · el vacío
legítimo y el fallo se comprueban **por separado** y se afirma que no se han colapsado.

**Y que esta fase no abra un agujero en la de al lado:** test de que lo precargado **desaparece al
cerrar sesión** (455/457).

**El banco gana `prepend()`**, que no existía y por eso `albaranDetailView` **reventaba al montarse**
— hueco que yo mismo reporté en SCRUM-451. Nada podía depender de él: llamarlo era un `TypeError`.

**Y el trinquete de SCRUM-451 cuenta ahora un marcador como «hablar»**, con el motivo escrito: lo que
mide es si la pantalla se queda **muda**, y un `[PENDIENTE microcopy oficial]` visible no lo está. Lo
que impide que los marcadores se multipliquen es **otro** trinquete, el de SCRUM-402.

## Lo que NO cubre

* **El técnico no recibe precarga.** Ver el aviso de la ruta: son dos decisiones del fundador.
* **Firmar sin red no está probado de extremo a extremo.** Esta fase abre el albarán; **encolar la
  firma es H3** y la lleva otra sesión. Abrir sin poder firmar sigue dejando al profesional a medias.
* **No se ha visto en un navegador ni en un móvil real.** Modo avión aquí es el banco de SCRUM-362.
* **Nadie pinta el resultado de la precarga.** `PRECARGADO n` / `NADA_QUE_PRECARGAR` / `NO_SE_PUDO`
  se guardan en `window.precargaUltimoResultado` y **no se enseñan**: eso es H2 (SCRUM-356). Hasta
  entonces, el profesional **no puede saber** si lleva algo encima — que con los números de arriba es
  el caso que más va a ocurrir.
* **La medida de la caja es aritmética, no una captura.** Ancho y alturas salen del CSS real; el
  avance medio del carácter es una estimación (0,50 em), no una métrica de fuente.

## Ficheros

* `src/modules/jobs/app/routes/precargaAdmin.routes.ts` (nuevo) · `src/app.ts` — la ruta.
* `public/dashboard/js/almacenLocal.js` — `precargarAlbaranes` y `leerAlbaranPrecargado`.
* `public/dashboard/js/app.js` — los dos momentos y el acelerador.
* `public/dashboard/js/albaranDetailView.js` — servir sin red, y los dos avisos con marcador.
* `tests/scrum460-precarga-al-movil.test.mjs` (nuevo, 8) · `tests/_banco-vistas.mjs` (`prepend`).
* `tests/scrum411-…` 8 → **7** · `tests/scrum402-…` `albaranDetailView.js` 1 → **3** ·
  `tests/scrum451-…` el marcador cuenta como hablar.
