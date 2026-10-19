# SCRUM-1056 · «Volver a llamar»: diseño y `.sql` del ALTER (paso ② de A5)

**Medido contra:** `origin/main` = `c30b4ed43e27b79d65f8e8aabefd7154058e6245` · 2026-09-27T16:12:23Z

**Escribe:** Sesión 1 (S1, `s1-27a`) · **Rama:** `scrum-1056-volver-a-llamar-alter` · **Carril:** S1
(servidor) + S2 (pantallas) · bloque CRM (SCRUM-977), ola 3.

## Alcance de esta rama: SÓLO el ②

Diseño y `docs/sql/scrum-1056-volver-a-llamar.sql`. No toca `prisma/schema.prisma` (regla 40) ni
código, y no aplica nada a ninguna base.

## PASO 0 — medido en origin/main

- Ningún modelo de seguimiento: `callback|followUp|volverA` en `schema.prisma` → 0. Lo que sale con
  `remind` son los recordatorios de PAGO (`reminder7SentAt`…), otra cosa.
- `CustomerEvent` existe y es el historial del cliente (`type` libre, con la lista en comentario).
- D6 = tarea PROPIA (`docs/producto/CRM.md` §6); `MAINTENANCE_ENABLED` no se toca.

## El diseño: dos columnas en `customers`, no una tabla

La aceptación pide UNA pendiente por cliente («poner otra sustituye a la anterior») y que «hecho»
deje el apunte en `CustomerEvent`. El historial ya tiene tabla; otra tabla sería un historial paralelo
y necesitaría un índice parcial para «una activa por cliente». Por eso:

- `callback_on DATE` (NULL = nada pendiente). `DATE`, porque es un día del calendario; «vencido» se
  decide contra HOY en la zona del merchant (`diaNaturalEn`), nunca con el reloj del proceso.
- `callback_note TEXT` (NULL = sin nota).
- Índice `(merchant_id, callback_on)` para «hoy o vencidos» y «esta semana».

DDL derivado offline con `previewMigracion` (control positivo: ok, 31 tablas): 2 `ADD COLUMN`
nullables sin `DEFAULT` + 1 `CREATE INDEX`. Nada más.

## Criterios de aceptación que añade el esquema al ③

1. `callbackNote` entra en la lista de `customer` de `anonimizarMerchant.ts`, con test.
2. «Hecho» pone las dos columnas a NULL y crea el `CustomerEvent` en la MISMA transacción (test).
3. «Vencido/hoy» se calcula con la zona del merchant (test en la frontera del día, Europe/Madrid).
4. Toda lectura/escritura filtra por `req.merchantId`; otro merchant no la ve (test).
5. El tipo nuevo de `CustomerEvent` se añade a la lista de su comentario en el esquema (en el ③).

## SCRUM-1056b · la pieza de pantalla: el bloque de la ficha y la marca de la lista (13-oct, S2)

**Medido contra:** `origin/main` = `18014c49ab7f2089c48d4c2e189f1fe799b829cf` · 2026-10-13T14:09:59Z

A9: comprobación → `tests/scrum1056b-volver-a-llamar-la-pieza.test.mjs`

El fallo propio de esta entrega: la primera versión pintaba la nota en un párrafo sin más, y una nota
con una palabra muy larga se salía de la tarjeta a 390 px. El banco de vistas no lo ve (no calcula
anchos); lo vio el navegador, en la sonda. Arreglado con una regla de la hoja, y el test fija que la
nota lleva su clase y que la regla existe. Un segundo, del test y no del código: su detector de rutas
contaba como ruta la barra que separa día, mes y año, y dio un rojo falso en la primera pasada.

**Sesión:** S2 (`s2-13oct`, tercera tanda) · carril: `public/**` es S2 (`node scripts/carriles.mjs de …`).
**Skill UI:** cargada (`yaqu-premium-ui`). Sección AÑADIDA: lo de arriba no se toca.

**Qué es.** Un fichero nuevo, `public/dashboard/js/clienteVolverALlamar.js`, que dibuja el bloque
«Volver a llamar» y dice qué marca lleva el cliente en la lista. Es la mitad de S2 del paso ③. La
ficha y la lista son de J2 y las rutas, de S1: ninguna de las dos existe todavía para esto.

**Qué NO es, y por eso no cierra nada.** La pieza se carga con el panel y ninguna pantalla la monta:
hoy no se ve en yaqu.app. No hay esquema, ni rutas, ni apunte en el historial.

**Cómo está hecha para no inventar lo que no existe.**

- No conoce ninguna ruta. Quien la monta le pasa la llamada (`{ dia, nota, estado }`) y dos
  funciones, `guardar({ dia, nota })` y `hecho()`. Cuando S1 ponga las rutas, quien monte las llama
  ahí; la pieza no cambia.
- «Hoy», «vencida» o «para más adelante» lo dice el servidor en `estado`. La pieza no compara
  ninguna fecha con el reloj del navegador, y por eso no rechaza una fecha en el pasado: se manda y
  se pinta lo que vuelve (decisión de c.19396, aceptada en c.19401).
- Lo que llega y no se entiende (sin objeto, un día con otra forma, un día sin estado) no se lee como
  «no hay ninguna»: el bloque se queda vacío y no hay marca. Lo mismo si `guardar` resuelve con algo
  sin día.
- Sólo usa clases que ya existían (`section-title`, `field`, `form-actions`, `btn`, `alert error`),
  más una regla nueva en `styles.css`, `.volver-a-llamar-nota`, que parte las palabras largas.

**Desviaciones declaradas.**

- La forma `{ dia, nota, estado }` es una propuesta de S2 (c.19341); S1 no ha contestado con el
  contrato. Si el servidor los llama de otra manera, lo traduce quien monte.
- Sin día, «Guardar» no manda nada y el aviso lo pone el navegador (es un campo obligatorio suyo): no
  hay texto nuestro para ese caso.
- La nota no tiene tope de largo en la pieza: lo pondrá el servidor, y un rechazo se lee como el
  fallo de guardar.
- B11 («Llamada hecha») no está en la pieza: lo escribe el servidor en el historial.
- Una línea en `tests/_banco-vistas.mjs`, que es de S3: su lista de scripts tiene que ser la del
  índice, y sin esa línea el panel no carga en el banco.

**Textos y firma.** Los catorce de SCRUM-1056 comentario 19401; trece son de esta pieza. Registro:
`docs/microcopy/2026-10-13-SCRUM-1056-volver-a-llamar.md`. Cada uno lleva su marca en su línea.

### Pruebas de SCRUM-1056b

`tests/scrum1056b-volver-a-llamar-la-pieza.test.mjs`: 14 casos por el banco de vistas, con el panel
entero cargado por el índice.

- **Mutantes** (`evidencias/SCRUM-1056/salida-1056b-mutantes.txt`; base sin mutar 14 de 14): trece,
  mueren trece, cada uno con su `git diff --numstat` al lado. Entre ellos: un texto firmado cambiado,
  la marca en una llamada futura, un día sin estado dado por futuro, pintar lo tecleado en vez de lo
  devuelto, callar el fallo, pasar el día por una fecha con hora, y la nota sin su clase.
- **Navegador, a 390 px, sobre yaqu.app** (cuenta QA, hojas de producción; la pieza no hace
  peticiones y el interceptor corta todo lo que no sea `GET`; `evidencias/SCRUM-1056/`): ocho
  estados. Todos los botones y campos miden 44 px de alto o más; rótulos enlazados a su campo; el
  aviso de fallo sale una vez; una fecha de 2020 se manda y vuelve como vencida. Con la hoja de
  producción la nota larga se sale de la caja (1 estado de 8: es el control); con la hoja de la rama,
  ninguno. Dos capturas.
- **Dirigida, a mano:** 176 ficheros (los que nombran el service worker, la lista de scripts, la
  hoja de estilos, `docs/microcopy/` y los censos de microcopy, de sin-consumir y de clases, más los
  que leen los registros): 1.709 tests, 4 saltos declarados. Dio 1 rojo, mío, y se arregló el código:
  `scrum352` (el censo de áreas táctiles) no sacaba ningún conjunto de clases de la pieza, porque los
  botones componían su clase a trozos dentro de un ayudante. Ahora cada clase va entera y como
  literal en `className`. Repetida después. `npm run tanda:dirigida` selecciona 610 ficheros y no se
  lanza en esta máquina.
- 🔴 **Sin `tsc`:** no cabe en memoria. Este cambio no toca `src/`. La suite completa y los tipos los
  corre el obligatorio.

### No visto en yaqu.app

La pieza no se ve hasta que J2 la monte en la ficha y en la lista y S1 ponga las rutas. Lo que sí se
puede ver al desplegar es que el panel la carga: `window.clienteVolverALlamar` existe en la consola.

## SCRUM-1056c · el fallo de «Hecho» dice lo que se pulsó (13-oct, S2)

**Medido contra:** `origin/main` = `fc10ff9cb3b29eb18a5da552ec18f8c551eba7b7` · 2026-10-13T15:02:00Z

A9: comprobación → `tests/scrum1056b-volver-a-llamar-la-pieza.test.mjs`

El fallo propio: en SCRUM-1056b la pieza salió con UN aviso para dos fallos distintos, y cuando lo
que fallaba era «Hecho» decía «No se ha podido guardar la llamada», que no es lo que se acababa de
pulsar. Lo vi al escribir la entrega (la tabla «conducta contra texto» de c.19432), no al
construir. El test tiene ahora un caso que hace fallar las dos cosas en el mismo bloque y exige a
cada una su texto.

**Sesión:** S2 (`s2-13octe`, cuarta tanda) · carril: `public/**` es S2.
**Skill UI:** cargada (`yaqu-premium-ui`). Sección AÑADIDA: lo de arriba no se toca.

**Qué cambia.** Una clave nueva en `TEXTOS`, `noMarcado`, y el fallo de «Hecho» la usa en vez de
`noGuardado`. Nada más: el aviso sale en el mismo sitio, una vez, con la llamada en pantalla como
estaba. El de «Guardar» sigue con su texto. Es un texto, no conducta: los dos fallos ya estaban en
dos sitios distintos del fichero y sólo compartían la constante.

**De paso en `main` (visto en yaqu.app el 13-oct, entre las 14:45Z y las 14:50Z):** con SCRUM-1056b ya desplegado,
`window.clienteVolverALlamar` existe en el panel de producción (c.19445).

**Texto y firma.** «No se ha podido marcar como hecha. Inténtalo otra vez.», del orquestador por
delegación: SCRUM-1056 comentario 19453. Registro:
`docs/microcopy/2026-10-13-SCRUM-1056-fallo-de-hecho.md`. La primera firma (c.19452) acababa en
«Inténtalo de nuevo.»; el orquestador la corrigió antes de que se escribiera en ningún fichero, para
que los dos avisos de la pieza acaben igual (SCRUM-1188, comentario 19450).

**Desviación declarada.** La firma no está en un comentario escrito por el orquestador: llegó por el
canal entre sesiones y la transcribí yo, letra por letra, en c.19452 y c.19453, con el sitio donde
se comprueba. En Jira todas las sesiones firman con la misma cuenta.

### Pruebas de SCRUM-1056c

- **PASO 0, corriendo:** sobre `main` sin tocar, el test de la pieza da 14 de 14, y uno de ellos
  fijaba que el fallo de «Hecho» salía con el texto de guardar. El defecto existía.
- `tests/scrum1056b-volver-a-llamar-la-pieza.test.mjs`: 15 casos (uno nuevo, «cada fallo con su
  texto», y el de «Hecho» ampliado con el segundo fallo seguido).
- **Mutantes** (`evidencias/SCRUM-1056/salida-1056c-mutantes.txt`; base sin mutar 15 de 15):
  dieciséis, mueren dieciséis, cada uno con su `git diff --numstat`. Los tres nuevos: el fallo de
  «Hecho» vuelve al texto de guardar (lo que había), el fallo de guardar sale con el texto de
  «Hecho», y el texto nuevo acaba como la firma retirada. El guion es el de 1056b
  (`mutantes-1056b.mjs`), con la línea de su M7 puesta al día.
- **Navegador, a 390 px, sobre yaqu.app** (cuenta QA, build `fc10ff9c…`; la pieza no hace peticiones
  y el interceptor corta todo lo que no sea `GET`: 0 en las dos pasadas; guion
  `evidencias/SCRUM-1056/sonda-1056c-fallo-de-hecho-390.mjs`), seis estados por pasada:
  - con la pieza que sirve **producción** (el control: el texto viejo se vuelve a ver), el fallo de
    «Hecho» dice «No se ha podido guardar la llamada. Inténtalo otra vez.»;
  - con la pieza **de la rama**, dice «No se ha podido marcar como hecha. Inténtalo otra vez.», una
    vez tras dos fallos seguidos, y el fallo de «Guardar» sigue diciendo el suyo;
  - en las dos, los botones miden 44 px de alto y nada se sale de la caja. Una captura.

### No visto en yaqu.app

El texto nuevo no se ve en producción hasta que alguna pantalla monte la pieza (J2) y haya rutas
(S1). Al desplegar esta rama lo que se puede comprobar es que `clienteVolverALlamar.TEXTOS.noMarcado`
existe en el panel.

## SCRUM-1056d · los dos avisos de fallo acaban en «Inténtalo de nuevo.» (14-oct, S2)

**Medido contra:** `origin/main` = `ebe2b932c0a4e07352516487df5146cd1a37abfc` · 2026-10-14T09:16:06Z

A9: comprobación → `tests/scrum1056b-volver-a-llamar-la-pieza.test.mjs`

**Sesión:** S2 (`s2-14oct`, sesión `c92d5545`) · carril: `public/**` es S2.
**Skill UI:** no cargada · cambia el final de dos literales; ni dibujo, ni clases, ni conducta.
Sección AÑADIDA: lo de arriba no se toca.

**La corrección es del ORQUESTADOR, no de esta sesión.** Firmó B12 y B15 el 13-oct con «Inténtalo
otra vez.» antes de fijar la forma de la casa, «Inténtalo de nuevo.» (SCRUM-1215 comentario 19460).
Lo corrige hoy, cuando nadie puede leerlos todavía: la pieza sigue sin montar en ninguna pantalla
(en `main` sólo la nombran `public/dashboard/index.html:255`, que la carga, y `public/sw.js:44`).

**Texto y firma.** «No se ha podido guardar la llamada. Inténtalo de nuevo.» (B12) y «No se ha podido
marcar como hecha. Inténtalo de nuevo.» (B15), del orquestador por delegación: SCRUM-1056 comentario
19649. Registro: `docs/microcopy/2026-10-14-SCRUM-1056-intentalo-de-nuevo.md`. Las dos fichas del
13-oct no se tocan (README de `docs/microcopy/`); sus dos citas viejas pasan a `APARCADOS` de
`tests/scrum514-aprobado-y-aplicado.test.mjs` como «SUSTITUIDO POR UNA FIRMA POSTERIOR», que es como
la casa ya trata una ranura que se vuelve a firmar (SCRUM-915d, SCRUM-1257d).

**Desviación declarada.** Como en 1056c, la firma no la escribió el orquestador en Jira: llegó en el
encargo de arranque de esta sesión y la transcribí letra por letra en c.19649, con el sitio donde se
comprueba. En Jira todas las sesiones firman con la misma cuenta.

### Pruebas de SCRUM-1056d

- `tests/scrum1056b-volver-a-llamar-la-pieza.test.mjs`: 15 de 15, con los dos literales nuevos.
- **Mutantes** (`evidencias/SCRUM-1056/salida-1056d-mutantes.txt`; base sin mutar 15 de 15): diecisiete,
  mueren diecisiete. **El control positivo del encargo** («con el texto viejo, se vuelve a ver») son
  M16 y M17: cada uno devuelve un aviso a «Inténtalo otra vez.» y el test cae. M16 antes comprobaba lo
  contrario (que no se colara «de nuevo», la firma retirada en c.19453): se ha dado la vuelta.
- **Recuento de la casa** (el guion de SCRUM-1215, `evidencias/SCRUM-1215/reintentos/reintentos.mjs`,
  sobre esta rama; `evidencias/SCRUM-1056/salida-1056d-reintentos.txt`): «inténtalo de nuevo» 26 veces en
  12 ficheros, «inténtalo otra vez» 5 en 5. Su control positivo ve en esta pieza las dos líneas nuevas.
- **Dirigida, a mano:** los 160 ficheros de `tests/` que leen `docs/microcopy/`, las evidencias o la
  pieza, o nombran la forma de la casa, tras mergear `origin/main` (`79531cf8`): 1.596 tests, 0 rojos,
  17 saltos declarados. Antes de arreglarlos dio 3 rojos, míos: `scrum514` (las citas viejas sin aparcar),
  `scrum709` (la ficha nueva nombraba a las viejas por su fichero) y `scrum811c` (faltaba esta sección).
- 🔴 **Sin navegador:** con la pieza sin montar, en yaqu.app lo único que se puede comprobar al
  desplegar es `clienteVolverALlamar.TEXTOS.noGuardado` y `.noMarcado` en la consola.


## SCRUM-1056e · qué falta para que se vea, y la trampa de `carriles.mjs de` (19-oct, S2)

**Medido contra:** `origin/main` = `c0745ecccc0fd518b8c299c5fc24b3c8273c42cc` · 2026-10-19T11:31:31Z

A9: aviso → A10 «Una herramienta que contesta por patrón contesta también por un fichero que no existe: antes de creerse el dueño, se comprueba que el fichero está.» — no se pudo comprobar: lo que lo impediría es un aviso de «no existe» en la salida de `scripts/carriles.mjs de`, y esa herramienta no es de S2.

**Sesión:** S2 (`s2-19oct`), encargo del orquestador del 19-oct: «hay un cabo nuestro suelto». Sección AÑADIDA: lo
de arriba no se toca.

**Lo medido.** La pieza de S2 (1056b/c/d) está en `main`: la carga `public/dashboard/index.html:255` y la cachea
`public/sw.js:44`. **Ninguna vista la monta.** Para que se vea faltan cuatro cosas, y ninguna es de S2:

| falta | dónde | dueño |
|---|---|---|
| ① las columnas `callback_on` y `callback_note` en `prisma/schema.prisma` | `callback` en el esquema: 0 apariciones | nadie: es el ALTER de A5. Según `docs/MIGRATIONS_PENDING.md:2982` se aplicó SÓLO EN DEV (28-sep); de staging y producción no consta nada |
| ② las rutas (leer, guardar, «hecho») y el `CustomerEvent` en la misma transacción | `system/customerAdmin.ts`, `customerEvents.service.ts`, `customersAdmin.routes.ts` | J2 (`dos-equipos.md`, fila de `system/customerAdmin.ts`) |
| ③ `callbackNote` en la anonimización | `anonimizarMerchant.ts` | J3 (fila de supresión y anonimización) |
| ④ montar la pieza en la ficha y en la lista | `customerDetailView.js` (allí vive `renderCustomer360View`, `:178`) y `customersView.js` | J2 (`dos-equipos.md:144`) |

`para-javier.md` §8 ya lo decía y es correcto. No hay una tercera pantalla: la «ficha 360» no es un fichero aparte.
Montar la pieza antes de ① y ② daría un bloque que no guarda, y no se ha hecho.

**La trampa que salió por el camino.** Al buscar esa tercera pantalla, `node scripts/carriles.mjs de
public/dashboard/js/customer360View.js` contestó «S2», con fila y exit 0, por un fichero que no existe. Escrita como
§16 de `docs/equipo/trampas-del-entorno.md`, con cinco rutas medidas y la comprobación de 5 segundos
(`git ls-files --error-unmatch`). La herramienta NO se ha tocado.
