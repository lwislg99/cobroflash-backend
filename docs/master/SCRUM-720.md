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

# SCRUM-720 · la pantalla del parte no tenía UNA SOLA regla de CSS

**Medido contra:** `origin/main` = `d9f60f7e89cc600e4d518af50ad2a977ed1876ba` · 2026-09-04T14:10:00+02:00

---

## 0 · PASO 0 · el diagnóstico, y era el SEGUNDO de los tres

**La hoja SÍ se carga.** El índice la trae en `index.html:10-11` (`tokens.css` y `css/styles.css`),
la app es un SPA de un solo índice, y en la captura se ve aplicada: **la tipografía Inter y los
colores `--muted`/`--ink` de las etiquetas están puestos**. No es «no se carga».

**El defecto es que las clases no existen.** Medido, enumerado:

| vista | clases que pinta | existen en la hoja | **no existen** |
|---|---|---|---|
| **el parte** | 4 | **0** | 🔴 `parte-bloque`, `parte-tipo`, `parte-anadir`, `parte-quitar-linea` |
| Trabajos (sí se ve) | 15 | 13 | `job-actions`, `job-cierre` |
| albarán (sí se ve) | 12 | 11 | `alb-status` |

**Cero de cuatro.** Y encima la hoja sólo declara `button { font-family: inherit; cursor: pointer }`
—sin apariencia—, así que **todo botón sin clase sale como el nativo del navegador**. La pantalla
del parte pinta **tres botones sin clase** (`[data-parte-firmar]`, `[data-dictado-ordenar]`,
`[data-propuesta-confirmar]`) más dos con clase inexistente. Eso es exactamente lo que se vio en
producción.

> ⚠️ **Un matiz sobre lo reportado:** en el papel medido, «Firmar aquí mismo» sale como **botón
> nativo**, no como enlace azul subrayado — la hoja neutraliza los enlaces (`a { color: inherit;
> text-decoration: none }`) y esa pantalla no pinta ningún `<a>`. Lo digo por si el enlace azul
> venía de otra vista, porque el arreglo es el mismo pero la coordenada no.

---

## 1 · El arreglo: **la hoja, y sólo la hoja**

147 líneas en `public/dashboard/css/styles.css`. **Ni una línea en el JS** — la sesión 4 está
firmando los rótulos en ese fichero y chocaríamos por un `class=`.

Por eso se estiliza por `data-*` donde el marcado no lleva clase: **no es un atajo**, son los mismos
ganchos que ya usan los tests, y son estables.

**No se estrena vocabulario.** Se reutiliza el que existe: la tarjeta copia `.customers-card`, el
botón principal copia `.btn-primary`, el secundario `.btn-secondary`, y los tokens son los de la
casa. Un componente nuevo iría al inventario AB3 y esta pantalla no necesita ninguno.

---

## 2 · LA CAPTURA — campo por campo

| elemento | **antes** | **después** |
|---|---|---|
| los dos bloques (mano de obra / materiales) | texto suelto sobre blanco, sin contorno | **tarjeta** blanca con borde, radio y sombra, como el resto de la app |
| filas de línea | pegadas, sin separación | separador sutil, y la última sin línea colgando |
| cabecera de la tabla | texto plano | etiqueta gris, peso 600, con su regla debajo |
| **«Firmar aquí mismo»** | **botón gris nativo del navegador** | **botón verde de marca**, píldora, ancho completo |
| «Ordenar en líneas» | botón nativo | botón secundario de la casa |
| «Añadir línea» (×2) | botón nativo | botón secundario, dentro de su tarjeta |
| **«×» de quitar línea** | botoncito nativo con borde de sistema | fantasma discreto, y en rojo al pasar por encima |
| las 3 casillas de tipo | radios desnudos en fila | **píldoras**; la marcada, con borde de marca y fondo tinte |
| textarea del dictado | caja del sistema | campo con el borde de la casa y anillo de foco |
| cabecera y datos (obra, REF, horas…) | ya iban bien | **sin cambios** — su estilo en línea ya los resolvía |

---

## 3 · Los controles

**CONTROL POSITIVO — y ejecutado, no afirmado.** Se renderizó un banco con los componentes que usan
Trabajos, Clientes y el albarán (`customers-card`, `btn-primary`, `btn-secondary`, `btn-ghost`,
`status-pill`, `empty-state`, `alert`, `input`, una tabla suelta y un `<button>` sin clase **fuera**
del parte) con la hoja de **antes** y la de **ahora**:

```
casa-antes.png  sha256 51855557a535ae08…
casa-ahora.png  sha256 51855557a535ae08…
✅ IDÉNTICAS al byte: el bloque nuevo no toca ningún componente de la casa

CONTROL POSITIVO DEL MÉTODO: el parte antes/después SÍ difiere → el método discrimina
```

**CONTROL NEGATIVO — cero estilos en línea.** `git diff` sobre `public/` añade **0** líneas con
`style=`. El diff entero es **un fichero**: la hoja.

**Y los guards de navegador**: 9/9 verdes, exit 0.

---

## 4 · 🔴 Lo que sigue mal y NO es de esta tanda (regla 9)

**La cabecera «UNDS» se parte en cuatro líneas.** No es el CSS: es que el rótulo lleva delante
`[PENDIENTE microcopy oficial] `, y ese texto no cabe en una columna de 64 px. Se ve igual en las
dos capturas. **Lo cierra la sesión 4 al firmar los rótulos**, y por eso no lo toco: taparlo con CSS
sería maquillar un texto que está a punto de desaparecer.

**Y la razón de fondo, que es SCRUM-666:** ninguno de los 5.059 tests podía haber cazado esto. El
banco de vistas no aplica CSS externo, así que un test puede afirmar que la pantalla «se pinta»
mientras el usuario ve texto crudo. **La confirmación de este ticket es la captura, no la suite** —
y esa es la lección, no el CSS.
=======
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

