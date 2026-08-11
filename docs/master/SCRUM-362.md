# SCRUM-362 · H7 — cómo se prueba «sin cobertura» de verdad

**Fecha:** 10-ago-2026 · **Carril:** H (herramienta de medición) · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `9093c11017e52fcb0e7b085e5054fb8505168f43` · 2026-08-10T20:34:53+02:00
**Tanda:** 2780 tests · 2706 pass · **0 fail** · 74 gateados · `npm test` exit **0**

> **Ni una línea de producto.** Esto construye herramienta y nada más: ni el service worker, ni el
> esquema, ni una vista.

## PASO 0

**a) ¿Estaba ya hecho?** No. `docs/master/SCRUM-362.md` no existe en `main` ni en el árbol, ningún
commit de `main` lo cita en su asunto, y no hay rama con ese número.

**b) ¿Sigue siendo cierta la premisa?** **Sí.** Censado el árbol, lo que hay es:

| qué | qué cubre | por qué no vale |
|---|---|---|
| `scrum405-descarga-verificada` | el portal cautivo, **para una función** | extrae `descargarBinario` con `new Function(...)` y le pasa un `fetch` de mentira. Prueba esa función, no pone **el producto** en el escenario |
| `scrum404-trazo-no-se-pierde` | el **mensaje** de `sinRed` | fabrica un `Error` con la marca puesta a mano; no reproduce ninguna red |
| `_banco-vistas.mjs` | montar el dashboard | su `fetch` responde **siempre `200` con JSON** y `navigator.onLine` está fijo a `true`. No hay forma de poner un escenario |

**No existe forma de poner el producto sin cobertura.** La premisa se sostiene.

**ENTRADA.** No hay: nadie puede reproducir hoy ninguno de los tres escenarios desde un test.

**MECANISMO.** Existe **medio**: `_banco-vistas.mjs` monta el dashboard como el navegador, sirve
`fetch` con fixture y dispara oyentes. Lo único que le falta es **el control de la red**.

## Lo que se construye — y por qué NO es un banco nuevo

`tests/_banco-red.mjs`: la capa que faltaba. Cuatro escenarios que producen el `fetch` y el
`navigator` que el banco de siempre enchufa por `cargarDashboard(raiz, { red })`. Dos líneas en
`_banco-vistas.mjs` y ninguna dependencia nueva.

**El toggle «offline» de DevTools no vale: corta limpio, y la obra no corta limpio.** Por eso son
tres escenarios y no uno — un producto puede aguantar uno y caerse con otro:

| escenario | qué hace la red | la trampa |
|---|---|---|
| **control positivo** · red normal | `200` + JSON | sin él, los tres de abajo podrían estar pasando porque la pantalla no funciona **nunca** |
| **① portal cautivo** | `200` + `text/html` con la pantalla de acceso del router | **parece que ha ido bien**: `res.ok` es `true`, hay cuerpo, y `onLine` dice que sí |
| **② acepta y no entrega** | la promesa **nunca resuelve**, y `onLine === true` | `onLine` **miente**: una LAN sin salida cuenta como estar conectado |
| **③ corte a media subida** | `TypeError: Failed to fetch` **después** de salir | el servidor **pudo recibirla**: no se puede dar por perdido ni por guardado |

El registro de cada escenario guarda las peticiones, y el de ③ guarda además el `body` — para que
un test de H pueda comprobar **qué se estaba subiendo** cuando se cortó.

### 🔴 El suelo es el corazón, no las aserciones

**«El producto aguanta sin cobertura» y «no supe cortar la red» dan el mismo verde y significan lo
contrario.** Cada escenario cuenta las peticiones que le llegan: si el producto no pidió nada, el
escenario **no se ha ejercido** y el test se declara **CIEGO** en vez de dar por buena una pantalla
que nunca llegó a intentarlo. Es el defecto que este ticket existe para no volver a permitir.

## Verificado

Se ejercita con **abrir Cobros**, que pide `/admin/cobros` al abrirse y cuyo copy está aprobado —
así se puede afirmar qué debería decir sin inventar microcopy.

| # | qué se rompe | qué sale |
|---|---|---|
| **R1** | el escenario ② deja de colgar y responde bien | 🔴 «la petición **no se ha quedado colgada** (1 resueltas · 0 colgadas): esto no es «acepta y no entrega», es otra cosa» + cae el negativo de que los escenarios se distinguen |
| **R2** | se relaja el suelo (`seEjercio` dice siempre que sí) | 🔴 «un escenario recién fabricado, sin que nadie le pida nada, **se declara ejercido**. Entonces el suelo no distingue «lo probé» de «no lo probé»» |

Las dos inyecciones llevan **post-condición** —cambió el fichero que digo y la cadena ya no está— y
**R2 abortó al primer intento** por un caso mal elegido, que es para lo que está.

**Controles negativos:** los cuatro escenarios **no se confunden entre sí** (tres huellas distintas
de red: resuelta, fallida y colgada) · y el portal cautivo, cuya huella de red es **idéntica** a la
de una red sana —`200`, resuelta—, se distingue **por el cuerpo**: devuelve `text/html` y su
`json()` revienta como en la obra. Sin ese control, ① sería un duplicado de la red normal.

## 🔴 HALLAZGO: el banco encontró algo al primer uso, y NO se ha arreglado aquí

Con la petición **colgada** (escenario ②), la pantalla de Cobros dice hoy **«Todavía no hay cobros
registrados.»** Eso le **afirma al profesional que no le deben nada** cuando lo que pasa es que la
respuesta no ha llegado — el mismo defecto que la microcopy de los dos estados vacíos (SCRUM-285)
existía para evitar, colándose por el **estado de carga**, que nadie había mirado.

**No se toca:** este ticket no toca producto. Y **no se convierte en aserción**, porque aseverar el
texto de hoy lo fijaría como requisito — el error que ya se corrigió tres veces esta semana. El test
② afirma lo que sí puede: que el escenario se monta, que `onLine` miente, y que la pantalla **no
pinta datos que no tiene**. El hallazgo va al informe.

## El hueco humano, con esas palabras

**Nada de esto sustituye a un iPhone real.** El banco no puede reproducir:

* el **borrado de origen de iOS a los 7 días** — H0 lo midió y no hay forma de simularlo aquí;
* **el comportamiento real de Safari**, empezando por que Background Sync es 0 % (H0): la cola solo
  se mueve al abrir la app, y eso depende de cuándo el sistema decide despertar la pestaña;
* que el proceso **muera de verdad** a media subida. El escenario ③ modela lo que el navegador
  entrega —`Failed to fetch` tras salir—, no un proceso matado por el sistema operativo.

Queda como **hueco humano (AB6)**, con matriz de dispositivos, y no se cierra con esta herramienta.

## Lo que NO cubre, además

* **Solo se ejercita una operación** (`renderCobrosView`, una LECTURA). Una SUBIDA real —firmar un
  albarán— tiene más estados intermedios, y el banco los soporta pero **no se han probado aquí**:
  eso es H1 y siguientes, que es para lo que se construye esto.
* **No hay IndexedDB.** H0 midió cero ficheros en el producto; el banco no la simula porque todavía
  no hay nada que la use.
* **El `AbortController` del contexto es el real de Node**, no uno instrumentado: un test que quiera
  medir cancelaciones tendrá que añadirlo.

## Ficheros

* `tests/_banco-red.mjs` (nuevo) — los cuatro escenarios, con registro y suelo.
* `tests/scrum362-banco-sin-cobertura.test.mjs` (nuevo, 8).
* `tests/_banco-vistas.mjs` — dos líneas: `fetch` y `navigator` salen del escenario si lo hay.

---

# SCRUM-362 · RESIDUALES (12-ago-2026) — los dos escenarios que faltaban

**Medido contra:** `origin/main` = `687d262b9ef2409cc9613a1b72844f60f6907c00` · 2026-08-12T00:36:11+01:00

**Rama:** `scrum-362-residuales` · sin gate, corre en `npm test`

> **Nada de `4d93f916` se rehace**: está en `main` y es bueno. `_banco-red.mjs` **solo se amplía**.
> Ni una línea de producto — este ticket construye el instrumento, no la medida (regla 38).

## El censo de los cinco, contra `main` — y por qué eran exactamente dos

| # | escenario | antes | dónde estaba cubierto |
|---|---|---|---|
| ① | portal cautivo | ✔ **×4** | `362 ①` · `356:150` · `358-encolar:165` · `358-drenado:155` |
| ② | **fallo del servidor** | 🔸 **a medias** | → **lo cierra esto** |
| ③ | red intermitente / corte a media subida | ✔ | `362 ③` · `460` |
| ④ | **muerte del proceso a media subida** | ❌ | → **su mitad automatizable, aquí** |
| ⑤ | idempotencia de la cola | ✔ **×3** | `358-encolar:105` y `:208` · `358-drenado:169` |

## ② Por qué «ya había un test de servidor en error» no bastaba

`scrum356:140` inyecta `async () => { throw new Error('500') }` en el subidor. **Eso no es un 500:
es una excepción**, y el producto los trata por sitios distintos (`api.js:_pedir`):

| | una excepción | un 500 de verdad |
|---|---|---|
| por dónde entra | el `catch` del `fetch` | la rama `!res.ok` |
| se le lee el cuerpo | no | **sí** (`res.json()`, y `trial_expired`) |
| sale con | `sinRed = true` | `status`, `code`, `data` y **sin `sinRed`** |

Y la marca decide qué se le dice al profesional: `sinRed` es «espera a tener cobertura», y un 500
**no se arregla esperando** (SCRUM-404). **Hasta hoy ningún escenario del banco podía producir un
500**: los seis respondían `ok:true, status:200`.

`falloDelServidor(status = 500, cuerpo)` lo cierra. Si `cuerpo` es una cadena, `json()` **revienta**
— el 502 que pinta un proxy en HTML y nunca llega a nuestro servidor.

> ⚠️ **No entra en `ESCENARIOS`** a propósito: `scrum362-banco-sin-cobertura` recorre ese objeto y su
> test se llama «los CUATRO escenarios». Ampliarlo dejaría mintiendo un título de un fichero que está
> en `main` y no es de este ticket. El recorrido con el quinto vive en `scrum362-residuales`.

## ④ Esto **no** se llama «muerte del proceso», y no es un matiz

No se puede matar un proceso desde la tanda. Lo que sí se prueba, y es lo que le importa al
profesional, es **DURABILIDAD DEL ALMACÉN**:

> tras una **carga nueva sin apagado limpio**, la cola sigue **completa** y **nada** quedó tratado
> como enviado.

Se monta con **un solo `IDBFactory` y dos montajes** del dashboard: el segundo es «abrir la app otra
vez» —contexto JS nuevo, mismo almacén físico—. Entre los dos **no se drena, no se cierra y no se
purga nada**: eso es lo abrupto.

**«Marcado como enviado» aquí es literal:** la cola **no tiene campo de estado**. La marca de enviado
es SALIR de la cola (`quitarFirmaPendiente`, y sólo con confirmación del servidor). Así que se
comprueba que sigue dentro, que el trazo sobrevive, que el contador que ve el profesional la sigue
contando (`pendientesDeSubir().n === 1` **y** `.sabemos === true`, que es el suelo de SCRUM-356), y
que **la entrada no ha ganado ningún campo** que `encolarFirma` no pusiera.

🔴 **Lo que sigue SIN cubrir, y va declarado:** que el **sistema operativo** mate la app a media
escritura, y el **desalojo de WebKit a los 7 días**. Eso es plan humano, no tanda.

## Qué camino del producto recorre cada escenario nuevo

Si un escenario no recorre ningún camino, es decoración. Los dos recorren el de firma **entero**:

| escenario | camino recorrido |
|---|---|
| `falloDelServidor` | `apiRequest` → `_pedir` → rama `!res.ok` → composición del error (`status`/`code`/`data`, SCRUM-151) → `firmarConRedDeSeguridad` → la firma **se queda en la cola** |
| durabilidad | `firmarConRedDeSeguridad` → `encolarFirma` → IndexedDB real → **segundo montaje** → `leerFirmasPendientes` y `pendientesDeSubir` |

## Los tests — `tests/scrum362-residuales.test.mjs` (11, en `npm test`)

Suelo ×2 (el camino se monta o CIEGO · el escenario sin usar se declara ciego) · el banco sabe dar
un 500 · **el 500 no se marca `sinRed`** · la firma se queda en la cola · el 502 con cuerpo HTML no
revienta el producto · **la cola sobrevive a una carga nueva** · **nada quedó tratado como enviado**
· control negativo con red normal (sube, y la cola queda vacía **y sigue vacía tras recargar**) ·
control negativo de coste · y que el escenario nuevo **no se confunde** con el corte a media subida.

**Ninguno cuelga:** los 11 corren en **309 ms**, y aun así cada uno lleva plazo de 3 s que falla
NOMBRANDO el escenario. «Un rojo que tarda 60 segundos y no dice nada no es un rojo: es un cuelgue.»

### 🔴 EL ROJO POR MUTACIÓN — y el harness mintió dos veces antes de que saliera uno solo

| mutación | resultado |
|---|---|
| `ok: true` — el banco vuelve a no saber dar un 500 | **4 rojos** |
| **el 500 se LANZA en vez de resolver** (= el `throw` inyectado de `scrum356`) | **4 rojos**, y entre ellos el de `sinRed` |
| el `statusText` se inventa | **1 rojo** |
| el cuerpo no-JSON deja de reventar en `json()` | **11/11 VERDE** 🔴 → con la línea añadida, **1 rojo** |
| el registro de peticiones deja de contar (suelo ciego) | **4 rojos** |
| la segunda vida NO comparte almacén | **2 rojos** |

**La segunda fila es la que justifica el ticket:** prueba que el test nuevo distingue un 500 real de
la excepción inyectada, que era exactamente el agujero.

🔴 **Y dos avisos de método, porque casi cuelan dos no-rojos falsos:**

1. **Las dos primeras mutaciones no se aplicaron** y dieron «verde» sin haber cambiado nada. Causa:
   el fichero está en **CRLF** y los patrones con `\n` y con `$` no casan. Un «no dio rojo» de una
   mutación que nunca ocurrió es peor que no probarla: parece medida.
2. **La primera post-condición tampoco valía.** Usaba `git diff`, y como el fichero tiene cambios sin
   commitear decía «71 líneas» pasara lo que pasara. La buena compara **contra la copia de
   seguridad**, no contra `HEAD`.

   La cuarta fila —la que sí dio verde de verdad— se descubrió **gracias** a arreglar eso.

## El hueco humano, y su puerta

🔸 **`docs/PRUEBA-IPHONE-BLOQUE-H.md` NO EXISTE.** Comprobado el 12-ago-2026: no está en `main`, ni
en el árbol, ni en ninguna rama remota (`git grep` por contenido sobre todas las refs). **No se
nombra en ninguna entrada a propósito**: el guard de SCRUM-242 rechaza citar un documento
inexistente, y esa es justo la protección que impide que una promesa se lea como una referencia.

**Cuando el fundador lo commitee, aquí va el mapa bloque→escenario.** Los seis que necesitan mano
humana, para que ese documento los cubra: modo avión real · iPhone real (Safari, Background Sync 0 %)
· instalación en pantalla de inicio · **desalojo a 7 días** · **el sistema mata la app a media
escritura** · cuota agotada en un móvil de verdad.

`docs/master/SCRUM-307.md` §8 ya dice que **esa pasada es el gate de cierre del bloque H** — hoy no
lo decía nadie.

## 🔸 La pregunta que no decido: cómo sabremos EN PRODUCCIÓN que esto funciona

**Propuesta, y paro** (regla 30 · decide el fundador). La frase que lo resume: **si nunca llega nada
con retraso, o el offline no se usa, o se está perdiendo.**

| idea | qué mide | coste |
|---|---|---|
| **① contador de «lo que llegó con retraso»** | firmas confirmadas cuyo `encoladaEn` es anterior a la subida. **Es la señal madre**: distingue las dos mitades de la frase | el dato ya viaja en la cola; hace falta dónde apuntarlo al drenar |
| **② aviso al reconectar** — «he recuperado N cosas» | que el profesional **sepa** que se recuperó, en vez de deducirlo | superficie nueva → **microcopy, y la aprueba el asesor** |
| **③ distinguir «no se usa» de «se está perdiendo»** | ① a cero puede ser buenísimo o pésimo. Se separan cruzando ① con «cuántas veces se encoló algo» | necesita ① y un segundo contador |

**Mi recomendación:** ① primero y solo. Es la que convierte «no llega nada con retraso» de silencio
en dato, no tiene superficie y por tanto no necesita microcopy. ② y ③ dependen de ella.

⚠️ **Las tres piden dónde persistir un contador, y eso es schema — del fundador.** Ninguna se
construye aquí.

## Lo que NO se ha tocado

`prisma/schema.prisma` · la cola (H3) · el almacenamiento (H5) · la precarga (H1) · el sellado ·
nada de `src/` · nada de `public/` · `tests/scrum362-banco-sin-cobertura.test.mjs` y su `ESCENARIOS`.

## Verificación

* `npm test` — **línea base y después, medidas APARTE, no restadas de cabeza** (números abajo).
* `npm run guards:entrada` · marcadores con el guard oficial `tests/scrum393-marcadores-de-conflicto.test.mjs`.

## Ficheros (residuales)

* `tests/_banco-red.mjs` — **ampliado**: `falloDelServidor()` y `TEXTO_DE_ESTADO`. Nada reescrito.
* `tests/scrum362-residuales.test.mjs` (nuevo, 11).
* `docs/master/SCRUM-307.md` — §8 nuevo: el gate de cierre del bloque.
