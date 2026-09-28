# Los errores del alta de cliente · SCRUM-1199

**Aprobado por el orquestador por delegación del fundador** el 28-sep-2026 — SCRUM-1199 comentario 17321.

La delegación está en `docs/equipo/limites-del-fundador.md` §«Delegación permanente», línea
«Javier, 25-sep-2026» (referencia SCRUM-1121), verificada hoy en `origin/main`.

## Textos aprobados, literales

| Ranura | Texto aprobado |
|---|---|
| `altaCliente.telefonoCorto` | Revisa el teléfono: le faltan cifras. |
| `altaCliente.movilCorto` | Revisa el móvil: le faltan cifras. |
| `altaCliente.emailInvalido` | Revisa el email: no parece una dirección válida. |
| `altaCliente.errorGenerico` | No se ha podido guardar el cliente. Revisa los datos e inténtalo de nuevo. |

## A qué sustituyen

A esto, que es lo que el profesional ve hoy en producción en la **segunda pantalla** que toca:

> Error guardando cliente: API 400: validation_error

Un identificador interno en crudo. Lo midió la S0 del equipo de Luis (SCRUM-1161) haciendo el
recorrido completo de un profesional español por primera vez seguido.

## 🔴 Son CUATRO porque la pantalla tiene DOS cajas de número

La propuesta que llegó traía **un** literal para `phone` y `mobile`. No se firmó así.

| Medido en `origin/main` | |
|---|---|
| `customersView.js:947` | `ROTULO_TELEFONO = "Teléfono"` |
| `customersView.js:967` | `ROTULO_MOVIL = "Móvil (WhatsApp)"` |

Son **dos campos distintos en la misma pantalla**, cada uno con su propio selector de prefijo —
separados a propósito en SCRUM-590, y el porqué está escrito en `customersView.js:1205-1210`.

🔴 **Un texto que nombra sólo «el teléfono» manda al profesional a la caja equivocada la mitad de
las veces.** No es matiz de estilo: es la forma exacta de SCRUM-828, «el mensaje que manda a mirar
donde no es». Y no había nada que decidir para arreglarlo — el mecanismo lee `details[].path`,
que **ya distingue** `phone` de `mobile`. La información estaba ahí sin usar.

## «el correo» → «el email»

La etiqueta que el profesional tiene delante es literalmente `Email` (`customersView.js:1234`).
**El mensaje nombra el rótulo que hay en pantalla, no un sinónimo.** Misma razón que lo anterior:
el aviso apunta a donde está la cosa.

## Qué NO dicen, y por qué

**Ninguno dice «falta» ni «es obligatorio».** Ni el teléfono, ni el móvil, ni el email lo son:
el esquema los tiene `optional()` (`src/core/validation/schemas.ts:529`, `:543`, `:544`).

🔴 Un mensaje que dijera «falta el teléfono» **convertiría en obligatorio un campo que nadie
decidió que lo fuera**, y rompería justo el caso que este trabajo viene a arreglar: *el fontanero
casi nunca tiene el correo de su cliente.*

**Ninguno manda a soporte ni a esperar.** En los tres específicos el profesional tiene el dato
delante y lo arregla él. Decirle «inténtalo más tarde» sería mandarlo a esperar a que pase algo
que no va a pasar.

## Dos avisos para quien los toque después

⚠️ **«Le faltan cifras» es exacto HOY, y lo es por una razón que puede caducar.** `phone` y
`mobile` son `z.string().min(5)`: el **único** modo de fallo es la longitud. El día que el esquema
valide formato, ese literal se vuelve falso — y entonces hay que volver a firmarlo. **No se
hereda.**

⚠️ **El genérico es un SUELO, no un techo.** Entra sólo donde hoy se pinta
`"Error guardando cliente: " + err.message` (`customersView.js:1793`). Los mensajes propios que ya
existen —`El nombre es obligatorio.`— **ganan**. Un genérico que se traga un mensaje específico
empeora la pantalla en vez de mejorarla.

## Dependen de que SCRUM-1161 siga dentro

Con el arreglo de SCRUM-1161, **lo vacío ya no llega a la puerta**: sólo llega lo que está mal
escrito. Si ese arreglo se revirtiera, estos cuatro textos dejan de ser ciertos el mismo día.

## Una ranura vale también para otra pantalla, y tres no

En el presupuesto rápido (`homeView.js`, SCRUM-1198, **carril S2 del equipo de Luis**) sólo hay
teléfono: ni móvil ni email.

- ✅ `altaCliente.telefonoCorto` **vale allí tal cual**, y queda aprobado también para esa pantalla.
- ⛔ `altaCliente.errorGenerico` **NO vale allí**: ese botón crea cliente *y* presupuesto a la vez,
  así que «No se ha podido guardar el cliente» sería verdad **a medias**. Si S2 quiere uno, lo
  redacta para su flujo y lo firma su jefe.
- Las otras dos no aplican.

## Por qué esta firma la escribe el orquestador y no J2

Es el mismo camino que SCRUM-1108 y SCRUM-1116: el clasificador de permisos de una sesión **para**
a una sesión que escribe una aprobación de texto de cara al usuario porque se lo pide otra sesión,
y **tiene razón**. Una firma no vale si la escribe quien no aprueba.

Lo que la resuelve no es que lo haga otra sesión cualquiera, sino **quien tiene la delegación**.
