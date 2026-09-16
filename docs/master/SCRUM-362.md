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

Con `main` dentro. Se movió dos veces mientras se cerraba —`687d262b` → **`96c14054`** (SCRUM-474)—
y los dos merges fueron limpios; los números de abajo son **los de después del último**.

**La línea base, MEDIDA APARTE y no restada de cabeza:**

| | tests | pass | fail | skipped |
|---|---|---|---|---|
| **línea base** — el conjunto de tests **de `main`**, corrido sobre este árbol | **3.237** | **3.160** | **0** | **77** |
| **después** — la tanda entera de esta rama | **3.248** | **3.171** | **0** | **77** |
| diferencia | **+11** | **+11** | 0 | **0** |

Los +11 son exactamente los de `scrum362-residuales`, y **los saltos no se mueven: este ticket no
añade ni uno**.

* `npm run guards:entrada` — **17 tests, 4 guards, 0 fail**.
* **Marcadores con el guard oficial** `tests/scrum393-marcadores-de-conflicto.test.mjs` — **6 tests,
  0 fail** (no un barrido a mano).

### 🔴 Y cómo NO se mide una línea base

El primer intento dio **1 fail en la base** y estuvo a punto de reportarse como «main está roja».
**No lo estaba: el rojo lo produjo el propio método de medir.** Para «volver a la base» se borró del
disco `tests/scrum362-residuales.test.mjs`, que ya estaba **commiteado**; `scrum239-huella-de-codigo`
calcula la huella con `git ls-files` + `git hash-object` fichero a fichero, y un fichero **seguido
por git pero ausente del disco** hace fallar `hash-object` → la huella sale `null` → rojo.

El guard hizo exactamente lo que debía —fail-closed—; quien midió mal fui yo. **Un árbol a medio
deshacer no es «la base»: es un tercer estado que no existe en ningún sitio.** La base se mide
**sin borrar nada**, corriendo el conjunto de tests que `main` declara:

```
node --test $(git ls-tree -r --name-only main -- tests | grep '\.test\.mjs$')
```

Es el mismo género de error que este bloque persigue: «main está roja» ya se reportó dos veces sobre
defectos que no existían (SCRUM-471).

## Ficheros (residuales)

* `tests/_banco-red.mjs` — **ampliado**: `falloDelServidor()` y `TEXTO_DE_ESTADO`. Nada reescrito.
* `tests/scrum362-residuales.test.mjs` (nuevo, 11).
* `docs/master/SCRUM-307.md` — §8 nuevo: el gate de cierre del bloque.

---

# SCRUM-362 · H7 (12-ago-2026) — el hueco humano deja de ser una promesa

**Medido contra:** `origin/main` = `eb681bf6a0f685a20fea6b1865d6b825e0236386` · 2026-08-12T11:24:43+02:00

**Rama:** `scrum-362-h7-prueba-iphone` · **encargo de FICHERO, no de código**

> **Cero líneas de `src/` y cero de `public/`.** Y cero de tests: esto no construye instrumento ni
> medida — pone en el repo el **procedimiento humano** que las dos secciones de arriba declararon
> como hueco y no podían cerrar desde la tanda.

## 1 · Qué cierra, exactamente

La sección RESIDUALES de arriba (§ *El hueco humano, y su puerta*) dice:

> 🔸 **`docs/PRUEBA-IPHONE-BLOQUE-H.md` NO EXISTE.** […] **Cuando el fundador lo commitee, aquí va el
> mapa bloque→escenario.**

**Ya existe.** El documento entra **verbatim**, tal como se aprobó, en `docs/PRUEBA-IPHONE-BLOQUE-H.md`.
Aquella frase **no se borra** —era cierta el 12-ago-2026 cuando se midió—: queda arriba y esta
sección es la que la supera.

## 2 · PASO 0 · la premisa, verificada por CONTENIDO y no por número

`main` = `eb681bf6` antes del `fetch` y **`eb681bf6` después**: no se movió.

| Qué se buscó | Dónde | Resultado |
| --- | --- | --- |
| el fichero `docs/PRUEBA-IPHONE-BLOQUE-H.md` | **todas** las refs de `origin`, una a una | **no existe en ninguna** |
| «Prueba en iPhone real» (su título) | todas las refs de `origin` | **cero** |
| `navigator.storage.persisted` | todas las refs de `origin` | **cero** |
| `display-mode: standalone` | `main` | 5 apariciones, **ninguna es un procedimiento**: son `api.js`, su test, y dos entradas que lo citan |
| «modo avión» | `docs/` de `main` | 8 apariciones, **todas dentro de otras entradas**; las dos de SCRUM-307 y SCRUM-362 son justamente las que declaran el hueco |
| `PRUEBA-IPHONE` | `main` | **2**, y las dos son la DECLARACIÓN de que no existe (`SCRUM-307.md:225`, `SCRUM-362.md:225`) |

**La premisa se sostiene:** no había procedimiento escrito para probar sin cobertura en un aparato
real. Lo que había eran dos entradas diciendo que faltaba.

Ramas del ticket, con su punta:

| Rama | Último commit | Autor | Hora |
| --- | --- | --- | --- |
| `scrum-362-banco-sin-cobertura` | `4d93f916` | Javier Pereira Fernández | 10-ago 19:46 +0100 |
| `scrum-362-residuales` | `8f0f127b` | Javier Pereira Fernández | 11-ago 22:34 +0100 |

Las dos están **ya en `main`** (`git merge-base --is-ancestor`, comprobado), así que no hay trabajo
ajeno sin empujar que este documento pueda pisar.

## 3 · Qué cubre el documento

Tres bloques, y el orden es deliberado: lo que se puede hacer **sin nada** va primero.

| Bloque | Qué mide | Necesita |
| --- | --- | --- |
| **A** (~25 min) | modo avión REAL desde el icono y desde pestaña · instalación en pantalla de inicio · navegar cinco pantallas sin red · intentar firmar · volver | solo un iPhone |
| **B** (~30 min) | `display-mode`/`standalone` en aparato real · entradas del precache · **la prueba de SCRUM-453** (`caches.match` con y sin `?v=`) · `storage.estimate/persisted` · `indexedDB.databases()` | Mac con cable |
| **C** (2 min) | **arranca el reloj del desalojo a 8 días** — instalada vs pestaña | 8 días y un dueño que colabore |

Tres cosas del documento que son método, no contenido, y por eso se conservan intactas:

* **Tres respuestas, no dos:** SÍ · NO · **NO SUPE MIRAR**. Es la misma regla que gobierna los
  suelos de esta casa —«cero» y «no supe mirar» nunca son el mismo número— escrita para una persona.
* **«O hay foto, o no pasó.»** Una medición sin evidencia no es una medición.
* **A3 es la única prueba que puede invalidar trabajo ya hecho**, y el documento lo dice con esas
  palabras: si la app no abre en modo avión desde el icono, el bloque H se está diseñando sobre arena.

## 4 · Qué NO cubre — y esto es del propio documento, no mío

Lo declara él en su sección *Lo que este documento NO cubre*:

* **La muerte del proceso.** Que iOS mate la app en segundo plano con firmas sin subir dentro. No se
  puede provocar de forma fiable a mano y el procedimiento no lo intenta. Es exactamente el mismo
  hueco que RESIDUALES declaró para `④` («esto **no** se llama muerte del proceso»): el instrumento
  cubre la DURABILIDAD DEL ALMACÉN y este documento tampoco alcanza al sistema operativo.
* **Android y Chrome.** Todo es Safari sobre iOS y no se puede extrapolar ni un dato.

Y lo que no cubre **por ser un documento**: nada de esto está medido todavía. Entra el
procedimiento, no el resultado. La plantilla está en blanco a propósito.

## 5 · El mapa bloque→escenario, que es lo que RESIDUALES dejó pendiente

Los seis que necesitaban mano humana, y dónde los recoge el documento:

| El hueco humano (RESIDUALES) | Dónde se cubre |
| --- | --- |
| modo avión real | **A3** (desde el icono) y **A4** (desde pestaña) |
| iPhone real / Safari, Background Sync 0 % | **A5** y **A6** — cinco pantallas y el intento de firma |
| instalación en pantalla de inicio | **A2**, y **B1** lo comprueba por código |
| **desalojo a 7 días** | **C** — el reloj, con las tres condiciones que hay que pedirle al dueño |
| **el sistema mata la app a media escritura** | 🔸 **NO se cubre**, y el documento lo declara |
| cuota agotada en un móvil de verdad | **B4** (`estimate`) — parcial: mide el espacio, no lo agota |

Dos de los seis quedan abiertos, y aquí se dicen: la muerte del proceso (nada) y la cuota agotada
(medida, no provocada).

## 6 · Lo que me pareció un error y NO he tocado

El contenido es verbatim (era STOP). Estas dos cosas se reportan y se dejan:

1. **El documento dice «8 días» y las dos entradas de arriba dicen «7 días»** (`H0`: *«el borrado de
   origen de iOS a los 7 días»*). El plazo real de WebKit son 7 días de no-uso, así que **8 es un
   margen y probablemente deliberado** —esperar 8 para medir un plazo de 7—; pero el título del
   bloque C dice «el reloj de los 8 días» y el hueco declarado dice 7. Quien lea las dos cosas verá
   dos números. No lo cambio: el contenido está aprobado.
2. **B2 dice «¿Salen 54 entradas?»** y el propio documento añade la salvaguarda buena —*«si sale
   otro, el número del repo ha cambiado y hay que volver a contarlo antes de llamarlo divergencia»*—.
   **No he verificado el 54 contra el árbol**: verificarlo sería medir, y este encargo es de fichero.
   La salvaguarda hace que un 54 desactualizado no produzca un falso hallazgo, que era el riesgo.

## 7 · Comprobado antes de empujar

* **El documento no referencia NINGÚN documento.** Medido, no supuesto: `grep` de `.md`, `docs/`,
  `tests/`, `src/` y `public/` sobre el fichero → **cero coincidencias**. Solo cita **tickets**, con
  enlace a Jira (4 enlaces: SCRUM-453, SCRUM-448, SCRUM-451 y SCRUM-360). No los he comprobado
  porque **no tengo acceso a Jira**, y el encargo lo anticipaba: se dejan tal cual.
* El guard de SCRUM-242 vigila las rutas `docs/**.md` que nombran los **scripts** de `scripts/`, no
  las de un documento — leído para no suponerlo. Este fichero no le añade nada que vigilar.
* **Esta entrada sí nombra el documento**, y ahora puede: existe en el mismo commit.

## 8 · Números — la tanda va DESPUÉS de la última edición del documento

Ese orden costó un rojo esta semana (`SCRUM-284.md:123`), así que se respeta: primero el fichero
terminado, después medir.

La línea base se mide **sin borrar nada**, corriendo el conjunto de tests que `main` declara — el
método que RESIDUALES dejó escrito arriba (§ *cómo NO se mide una línea base*):

```
node --test --test-force-exit $(git ls-tree -r --name-only main -- tests | grep '\.test\.mjs$')
```

| | tests | pass | fail | skipped |
| --- | --- | --- | --- | --- |
| línea base — el conjunto de tests **de `main`**, medido aparte | 3.315 | 3.238 | **0** | 77 |
| después — la tanda entera de esta rama | 3.315 | 3.238 | **0** | 77 |
| diferencia | **0** | **0** | 0 | **0** |

⚠️ `main` **se movió una vez más** mientras se cerraba —`eb681bf6` → **`3be9a2ea`** (SCRUM-483)—, se
trajo dentro y **la línea base se volvió a medir después del merge**: da los mismos cuatro números,
así que el cero de la diferencia sigue siendo un cero medido y no uno heredado. El ancla de arriba
apunta al `main` contra el que se hizo el PASO 0, que es lo que el ancla significa.

**Cero diferencia es el resultado correcto aquí**: un documento no añade tests. Si hubiera cambiado
algo, sería que este encargo ha tocado código, y tenía prohibido tocarlo.

* `npm run guards:entrada` — **4 guards · 17 tests · 0 fail**.
* `tests/scrum393-marcadores-de-conflicto.test.mjs` — **6 tests · 0 fail**.

## 9 · Lo que NO se ha tocado

`prisma/schema.prisma` · nada de `src/` · nada de `public/` · ningún test · `_banco-red.mjs` y sus
escenarios · el contenido aprobado del documento (verbatim, sin una coma cambiada) · las dos
secciones anteriores de esta entrada, que se conservan enteras.
