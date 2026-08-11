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
