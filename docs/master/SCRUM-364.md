# SCRUM-364 · El oficio se puede elegir después del alta, y el catálogo se carga

**Fecha:** 5-ago-2026 · **Carril:** D (alta e importación) · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `5ae48e836ec439d6c7d1bccd9ebe0836c9a2e141` · 2026-08-05T10:16:27+02:00
**Tanda:** 1506 tests, 1439 pass, 0 fail, 67 skipped

## El defecto

`trade` se captura en **un solo sitio de todo el producto** —el paso 1 del asistente de alta— y no
es editable en ninguna pantalla. El asistente se salta de un clic, queda marcado como completado y
**no vuelve a salir nunca**. Quien lo saltó se queda sin oficio para siempre.

El botón de rescate del estado vacío de Productos llamaba a `load-catalog` con `{}` → 400
`trade_required` → la pantalla decía **«No se pudo cargar el catálogo. Inténtalo de nuevo.»**,
pidiéndole al usuario que repitiera algo que no podía funcionar. Sin salida y sin explicación.

### Lo medido en producción (5-ago-2026, solo lectura)

| | |
|---|---|
| merchants totales | 13 |
| sin `trade` | **8 (61,5 %)** |
| de esos, fixtures de test (`@test.local`) | 4 |
| **cuentas reales sin oficio** | **4** |
| de ellas, con actividad | **2** — una de pago, con **31 presupuestos y 6 facturas** desde mayo |

Y el dato que lo cierra: **los 8 tienen `onboardingCompleted: true`**. No están a medias — el único
sitio donde se elige oficio ya se cerró para todos ellos.

El titular del 61,5 % está inflado por las fixtures. Es un rescate **de 4 cuentas**, no de la base
instalada. Se dice porque el número asusta más de lo que debe.

## El servidor no se toca — y la premisa del encargo era otra

El encargo decía que el defecto estaba en que el front manda `{}`. **Medido, no es así:**
`load-catalog` ya resuelve `req.body?.trade || merchant.trade`, así que con `{}` **cae al oficio
del merchant y YA funciona hoy** para quien lo tenga.

Mandar el oficio desde el front no arregla a nadie: la única fuente que el front tiene es ese mismo
campo. Para quien no lo tiene, no hay nada que mandar.

**Lo que faltaba no era el dato en la petición: era poder ELEGIRLO.** Por eso el arreglo es un
selector en el estado vacío, y el servidor queda intacto.

## Lo que se construye

Ante `trade_required`, el estado vacío ofrece elegir oficio ahí mismo, lo **guarda** con
`updateMerchantProfile` y carga el catálogo.

* **Se ramifica por `err.code`, no por el texto del mensaje.** `api.js` deja el código del servidor
  ahí precisamente para esto, y su propio comentario dice que ramificar por texto es lo que nunca
  hay que hacer.
* **El oficio se PERSISTE antes de cargar.** Mandarlo solo en el cuerpo cargaría el catálogo una
  vez y dejaría al usuario igual de roto al cerrar la pantalla: el mismo defecto con más pasos.
* **No se escribe una cuarta lista de oficios.** El censo de SCRUM-310 encontró **tres** listas del
  mismo gremio a mano en el producto; ésta habría sido la cuarta. Se consume `window.OB_TRADES`,
  que `onboardingView.js` pasa a publicar.

### Por qué la lista se publica explícitamente

`OB_TRADES` es un `const` de nivel superior y **hoy no lo usa ningún otro fichero**: no hay
precedente en el panel de que el ámbito compartido de los scripts clásicos cruce ficheros. El que
sí lo tiene —`updateMerchantProfile`, usado desde tres vistas— es una `function` de `api.js`, que
es otra cosa. `window.OB_TRADES = OB_TRADES` convierte una suposición sobre ámbitos en un contrato,
y un test lo vigila.

## El aviso, y por qué va ANTES de cargar

Microcopy **aprobada por el fundador**, literal:

> **Tu oficio**
> Cargamos los conceptos de tu oficio. Lo que ya tengas en tu catálogo se queda como está.

**El servidor ya garantiza que no sustituye nada**: con 2 o más productos devuelve
`already_has_products` y no borra ni una fila. Así que lo que faltaba no era una protección —
existía— sino **decirlo**. El defecto de hoy no es que destruya: es que no destruye y tampoco lo
cuenta, y el usuario no tiene forma de saberlo antes de pulsar.

## Lo que NO entra: el campo en Configuración

**Parado a propósito, y el fundador lo autorizó por adelantado.** El sitio natural es
Configuración › Empresa, y **ese submenú no existe en `main`**: hoy Configuración es una sola
página con separadores (`Datos bancarios`, `Cobros con tarjeta`, `Automatizaciones`,
`Notificaciones`, `Empresa (Enterprise)` —que es de plan, no de datos de empresa—), con `taxId` y
`country` sueltos en el primer bloque.

El submenú vive en `scrum-284-configuracion-submenus` (Javier, sin mergear): **3 commits sobre main
y +182 líneas en `settingsView.js`**, el fichero exacto donde iría el campo. Construirlo hoy es un
conflicto garantizado en el carril de otra sesión, y por poco: **el rescate de Productos ya cubre
el caso que duele** —quien no tiene oficio— sin tocar ese fichero.

Queda pendiente el caso «tengo oficio y quiero cambiarlo», que sí necesita Configuración.

## Verificado en rojo

* **El estado vacío vuelve a morir en el `catch` genérico** → caen dos: no distingue el caso y no
  decide por código.
* **La cuarta lista, escrita a mano** → cae el guard nombrando los valores copiados.
* **`onboardingView.js` deja de publicar la lista** → cae el guard del contrato. Es el rojo que
  importa: sin él, el asistente seguiría verde con sus tests y el rescate mostraría el error
  genérico sin que nada se enterara.

Las tres inyecciones verificadas como aplicadas y compilando; revertidas, árbol limpio.

**Un fallo mío, corregido:** el primer test de microcopy comparaba por igualdad y los rótulos viven
dentro de trozos de `innerHTML`. Era un fallo del test, no del código; se pasó a subcadena.

## Hallazgo reportado y NO arreglado

`already_has_products` se muestra hoy como **«No se pudo cargar el catálogo.»** — dice que *no
pudo* cuando en realidad *decidió no hacerlo*, para proteger lo que el usuario ya tiene. Es el
mismo defecto de fondo que este ticket cierra, en el otro extremo del flujo.

**No se toca porque es microcopy** (regla 30) y el fundador aprobó dos textos, no tres. Y hoy es
**inalcanzable**: ese botón solo aparece con cero productos, así que `existingCount >= 2` no se
cumple nunca por esa vía. Se vuelve alcanzable **exactamente** cuando exista el cambio de oficio en
Configuración — o sea, en la parte que este ticket deja parada. Va junta.

## Lo que NO cubre

* **No se ha probado en el navegador.** Los guards leen el código, no la pantalla: que el selector
  aparezca, se vea bien y sea accesible no está verificado aquí.
* **`otro` sigue sin catálogo.** Quien lo elija recibe «Tu gremio aún no tiene catálogo
  predefinido», que ya existía. Este ticket no lo cambia.
* **No se ha tocado ninguna cuenta de producción.** Las 4 reales sin oficio siguen sin él hasta que
  entren en la pantalla y lo elijan.

## Ficheros

* `public/dashboard/js/productsView.js` — el rescate: selector, guardado y carga.
* `public/dashboard/js/onboardingView.js` — publica `OB_TRADES` y `obTradeLabel`.
* `tests/scrum364-cambiar-gremio.test.mjs` (7, sin gate).
