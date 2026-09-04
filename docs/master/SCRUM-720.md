# SCRUM-720b · «Partes por valorar» no abría: `opts` donde el parámetro se llama `options`

**Fecha:** 4-sep-2026 · **Carril:** dashboard (router del nav) · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `d9f60f7e89cc600e4d518af50ad2a977ed1876ba` · 2026-09-04T14:05:00+02:00

## 1 · PASO 0 = PULSAR

No se empezó por el código. Se sirvió `public/` en local y **se pulsó la entrada en un navegador**:

```
ReferenceError: opts is not defined
    at renderView (app.js:326:57)
    at HTMLButtonElement.<anonymous> (app.js:489:41)
```

`renderView(view, options = {})` — y el `case 'partes-oficina'` escribía **`opts`**.

## 2 · Cuál de los cuatro cortes era: **ninguno de los cuatro**

| | medido |
| --- | --- |
| a) el nav no dispara | ❌ **sí dispara** — el botón existe, es visible (`display: flex`), y el escuchador de `app.js:489` corre |
| b) la vista no está registrada | ❌ **sí está** — `window.renderPartesOficinaView` es `function`, y llamada a mano pinta **1250 caracteres** y lanza su `GET /admin/partes/oficina/pendientes` |
| c) la ruta responde 4xx/5xx | ❌ **no se llega a pedir** |
| d) responde bien y no pinta | ❌ **tampoco** |

**Revienta ENTRE el `case` y la llamada a la vista**, en un identificador que no existe. Y el
título ya se había puesto en la línea de arriba, así que el profesional ve **el rótulo correcto y
la pantalla en blanco**. Eso es lo que se lee como «no pasa nada».

## 3 · Qué se ve al pulsar, después del arreglo

```
título    : «Partes por valorar»
innerHTML : 1250 caracteres
lo que se lee: «Partes por valorar — Los partes que tu equipo ya ha firmado y todavía no
               tienen precios.»
```

**CONTROL POSITIVO, enumerado — las 17 entradas del nav pulsadas una a una, todas abren:**

| entrada | HTML | entrada | HTML | entrada | HTML |
| --- | :-: | --- | :-: | --- | :-: |
| home | 5846 | invoices | 5713 | reports | 2244 |
| quote-requests | 1775 | cobros | 584 | libro-registro | 273 |
| jobs | 1932 | customers | 6327 | team | 1612 |
| quotes-list | 5879 | products | 7796 | plans | 108 |
| albaranes | 226 | providers | 4610 | settings | 11053 |
| **partes-oficina** | **1250** | expenses | 3117 | | |

Cero excepciones en las 17. Arreglar una no ha roto otra.

## 4 · 🔒 Por qué 21/21 en verde no lo vieron

`scrum652d` mide que ninguna entrada del nav lleve a una vista **sin contexto**; `scrum652f` que el
extractor **no se quede ciego**. Las dos son ciertas, las dos siguen en verde con el defecto puesto,
y **ninguna pulsa**.

> **Se medía el mecanismo, no el hecho.** Un `data-view` que existe y un `case` que existe no son
> una pantalla que se abre.

## 5 · El guard que faltaba

Que `renderView` **no lea ningún identificador fuera de su alcance**. Eso es, por construcción, la
clase entera de este defecto: un `ReferenceError` en el router deja la pantalla en blanco sin que
falle ningún test.

**No es un tercer analizador**: es una comprobación de ámbito sobre **una sola función**, con el
scanner de la casa, y valida contra fuente sintética donde la respuesta se sabe por construcción.

## 6 · ⚠️ Y ESTE INSTRUMENTO NACIÓ ROTO

La primera versión recogía las declaraciones de las funciones **hermanas**, así que `opts`
—parámetro de `window.renderAppView = function (view, opts)`, otra función del mismo fichero— salía
«a alcance». **Daba CERO con el fallo puesto.**

No lo vi mirando la salida: **lo dijo la inyección.** Es exactamente la regla que la sesión 4 dejó
escrita hoy —*mirar las muestras a ojo no es un control*— y por eso el guard lleva **autoprueba
sobre fuente sintética**: un fuente sano que no puede acusar, y uno roto que tiene que cazar.

## 7 · Los rojos · commit de resguardo `9a0aa971b353bbc9f09c0f152cb2230aac1bde56`

| # | Qué se rompe | Qué cae |
| :-: | --- | --- |
| 1 | se reinyecta `opts` (el defecto real) | 1/3 · `EL ROUTER LEE UN IDENTIFICADOR QUE NO EXISTE A SU ALCANCE: app.js:330 opts` |
| 2 | el instrumento vuelve a su versión rota | 1/3 · **la autoprueba**: `EL INSTRUMENTO NO VE EL DEFECTO` |
| 3 | se le quitan las globales de la página | 1/3 · acusa al sano — y el guard lo caza |

🔴 **Y CAE CON EL MECANISMO VIEJO:** con `opts` reinyectado, `scrum652d` sale **rc=0, 0 fallos**.
El guard que había pasa en verde sobre el defecto que llegó a producción.

## 8 · Lo que NO se ha tocado

`parteDetailView.js` (sesiones 2 y 4) · `parteOficinaView.js` · el nav · `scrum652d`/`scrum652f`,
que no se relajan · el camino de emisión.

## 9 · Huecos declarados

1. **El guard cubre `renderView`, no todo el árbol.** La misma clase de defecto en otra función
   sigue sin vigilar. Medido por qué no se generaliza hoy: `tsc --allowJs --checkJs` sobre los
   scripts del dashboard da **1086 errores, 149 de ellos «Cannot find name»** — casi todos globales
   que se resuelven entre ficheros. Como trinquete nacería rojo y lo apagaría alguien.
2. **El banco de vistas no puede pulsar.** `window.renderAppView = renderView` se asigna dentro de
   `initApp()`, que corre en `DOMContentLoaded`, y `cargarDashboard` no lo dispara. Un test que
   pulse de verdad exige plomería en `_banco-vistas.mjs`, compartido por ~30 tests. **No se toca
   aquí.** Es lo que convertiría este guard estático en uno de comportamiento.

---

> ⚠️ **Dos tickets distintos comparten este fichero.** El de arriba es SCRUM-720b (el router del
> nav) y el de abajo SCRUM-720 (los rótulos del parte). Se conservan **los dos**, por número: ninguno
> sustituye al otro y no se ha tocado una palabra de ninguno.

# SCRUM-720 · Los 21 rótulos firmados del parte, y el control que mira lo PINTADO

**Medido contra:** `origin/main` = `d9f60f7e89cc600e4d518af50ad2a977ed1876ba` · 2026-09-04T14:07:39+02:00
**Medido en:** host `DESKTOP-T5MONF5` · rama `scrum-720-rotulos-del-parte`

**LA VÍCTIMA: el profesional que abre el parte en producción y ve 26 corchetes.** El fundador firmó
**21** rótulos y se aplicaron literales, con su registro en
`docs/microcopy/2026-09-04-SCRUM-720-rotulos-del-parte.md` (mecanismo de SCRUM-709: un fichero por
aprobación, sin índice).

**EL MECANISMO SE VACÍA, NO SE RETIRA.** Las dos constantes —`M` en la pantalla del parte y
`MARCA_ASIGNADOS` en el selector— siguen vivas, y hay un control que cae si desaparecen: el rótulo
que alguien añada mañana sin firmar tiene que seguir saliendo marcado.

**QUEDAN DIEZ SIN FIRMAR, y eran más de los 21 que el fundador sospechaba.** Van listados con su
literal exacto, fichero y línea en el registro de la aprobación. No se inventan, no se borran y no se
dejan sueltos.

## El arreglo de fondo: el control cambia de sitio

El censo de SCRUM-402 decía **1** mientras la pantalla enseñaba **26**, y **las dos cifras eran
correctas**: ese censo cuenta literales con la marca en el FUENTE, y la vista la factoriza en una
constante que concatena 26 veces. Un número honesto sobre el fichero, y una pantalla llena de
corchetes.

`tests/scrum720-marcadores-en-lo-pintado.test.mjs` **ejecuta la pantalla y cuenta los marcadores en
lo que PINTA**, en tres estados —borrador, firmado y sin líneas—, con el banco de DOM de la casa y
sin dependencias nuevas (regla 36). Hoy pinta **1**: «Firmado. El contenido ya no se toca.». El
trinquete no puede subir, y con el parte en borrador salen 0 — quedarse en ese estado habría dado un
cero de mentira.

**SUELO:** si la pantalla no pintara nada, contar marcadores sobre una cadena vacía daría cero y
parecería una buena noticia. Se exige que pinte contenido real antes de contar.

⚠️ **LO QUE ESE BANCO NO ALCANZA, dicho aquí y no descubierto en producción:** de los diez que
quedan, cinco viven en caminos que `renderParte` no pinta (el pad de firma, el error al cargar, la
propuesta del dictado) y cuatro están en otra pantalla. El trinquete **no los vigila**.

## Un guard que había que reapuntar, no relajar

`SCRUM-650d` exigía que **todos** los textos del selector llevaran marcador — cierto el día que se
escribió, porque no había ni uno firmado. Ahora uno lo está. Convertirlo en «los que yo diga» habría
sido relajarlo; se apunta al **HECHO**: sin marca sólo si **consta aprobado**, y eso no se declara
—se comprueba contra el registro con `constaAprobado` (SCRUM-709/710, por identidad y no por
subcadena). Queda más fuerte que antes: un texto sin marca y sin aprobación sigue cayendo.
