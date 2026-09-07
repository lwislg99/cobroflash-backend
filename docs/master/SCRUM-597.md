# SCRUM-597 · DOC-07 · Asignar usuario al documento — y cerrar la puerta de atrás de coste y margen

**Fecha:** 07-sep-2026 · **Carril:** producto · permisos · **Gate:** 🔴 **PR NO MERGEABLE** hasta que el fundador aplique `docs/sql/scrum-597-asignados-de-documento.sql` en las tres bases

**Medido contra:** `origin/main` = `d271d29aff85ed155d23397b7e6a1fca64a86bb0` · 2026-09-07T18:56:51+02:00

(Ese sha es la BASE de la rama: es contra lo que se leyó el árbol en la Obligación 0.)

---

## Lo que pedía el ticket, y lo que resultó ser la mitad de él

Asignar uno o varios usuarios de la cuenta a un documento — factura y presupuesto, los dos.

Y con la firma **P-DOC-3** del fundador (7-sep-2026) delante:

> «Coste y margen los ven el PROPIETARIO y los ADMINS. Los técnicos NO.»

La consecuencia no era un detalle: **la asignación no podía abrir por la puerta de atrás la
visibilidad de coste ni de margen**. Al medir resultó que esa puerta no había que impedir que se
abriera — **estaba abierta de par en par ya**.

---

## OBLIGACIÓN 0 · el estado real, leído del árbol

### (a) Los roles que existen HOY

`TeamMember.role`, string con **dos** valores: **`admin`** y **`tecnico`** (`@default("tecnico")`,
`schema.prisma:967`). El **propietario no es un rol**: es la sesión con `teamMemberId = null`, y
`requireAuth` le sintetiza `admin` (`authMiddleware.ts:33`). En pantalla al técnico se le llama
«Operario» (`teamView.js:15`), pero el valor del schema es `tecnico`.

O sea que «propietario y admins» y «no es técnico» son, **hoy y medido**, el mismo conjunto.

### (b) Dónde se veían coste y margen — censo, no sospecha

**No era cero: eran cuatro sitios, y dos ya estaban cerrados.**

| Sitio | Quién lo veía ANTES |
|---|---|
| Ficha del catálogo, campos «Coste» y «Margen %» (`productsView.js:300-301` alta, `:479-485` edición) | **cualquiera, incluido el técnico** |
| `cost` viajando en `GET /admin/products`, `/:id` y `/autocomplete` (`products.service.ts:250`); el router se monta **sin** `requireRole` (`app.ts:546`) | **cualquiera** |
| Campo «Coste» por línea del presupuesto (`quotesView.js:3003-3013`), congelado en `Quote.lines.costeUnitario` (SCRUM-661) | **cualquiera** |
| `/admin/expenses/margin/:id` y `/admin/reports/pl` | ya admin-only ✅ |

**Conclusión de la medición: P-DOC-3 no se cumplía en absoluto.** Un técnico veía el coste en la
casilla de al lado del precio: el margen no había ni que deducirlo, se leía restando dos columnas
contiguas de la misma fila.

### (c) ¿Existía ya asignación de usuario a documento?

**No.** Lo que hay y **no** es esto:

* `Quote.teamMemberId` es **AUTORÍA** — «técnico que creó la cotización», lo dice el propio schema.
  `Invoice` no tiene ni eso.
* `Job.assignedUserId` + `job_assignees` es asignación a **Trabajo**, no a documento (SCRUM-650).

Un documento lo redacta uno y puede estar asignado a tres: son dos ideas y se declaran aparte.

---

## Lo construido

### El esquema (dominio del fundador — escrito, NO aplicado)

Dos tablas puente, `quote_assignees` e `invoice_assignees`, espejo de `job_assignees`.

🔴 **UNA SOLA FUENTE DE VERDAD**, y es la diferencia con SCRUM-650: el Trabajo guarda su asignación
también en la columna `jobs.assigned_user_id` porque ésta ya existía, y eso obligó a escribir los
dos sitios a la vez y a montar un censo que caza cuándo se separan. Aquí **no hay columna
heredada**, así que el dato vive sólo en su tabla y esa discrepancia no puede producirse.

El ALTER va **primero** (`docs/sql/scrum-597-asignados-de-documento.sql`) y el schema después.
Registrado en `docs/MIGRATIONS_PENDING.md` con **las tres bases SIN marcar**. Verificado sin tocar
ninguna base: `preview-migracion.mjs` offline (control positivo OK, veredicto **aditiva**, y el SQL
de Prisma coincide con el escrito a mano) y el clasificador real del aplicador (`ok: true`).

### La política de visibilidad — `src/core/visibilidadEconomica.ts`

Un solo sitio responde «¿este rol ve coste y margen?», y las rutas **preguntan** en vez de
reimplementar el criterio (mismo trato que `entitlements.ts`, regla 34).

**Fail-closed**, y es la decisión que más importa: la lista es BLANCA (`admin`), así que un tercer
rol futuro nace **sin ver** y alguien tiene que venir aquí a concedérselo con su motivo. Escrito
como `role !== 'tecnico'`, ese rol nuevo habría nacido viendo el margen del negocio sin que nadie
lo decidiera.

Tapa las tres bocas del catálogo y las del documento — y **también `quote.lines`**, porque el
detalle de una factura arrastra el presupuesto de origen entero (`include: { quote: true }`) y por
ahí salía el mismo coste. Tapar sólo `lines` habría dejado la fuga en la misma respuesta.

Y quien no ve el coste **tampoco lo escribe**: `PUT`/`POST` de producto ignoran la clave por rol,
para que un técnico no pueda poner a `null` el coste de un artículo que ni siquiera puede leer.

### La asignación — `src/core/documentos/asignacionDeDocumento.ts` + `PATCH /:id/asignados`

Admin-only **por ruta** (no por campo), para que entre sola en la red fail-closed de SCRUM-55, que
reconoce el marcador de `requireRole` y no sabría ver un `if` dentro del handler. Las dos rutas
quedan declaradas en `ADMIN_ONLY_ROUTES`.

---

## Las tres cosas que este ticket promete y NO hace

* **Asignar no es un permiso.** No cambia quién edita ni quién emite. Ejercitado: un técnico
  asignado sigue recibiendo 403 en emitir, cobrar, cambiar estado, rectificar y asignar.
* **Asignar no abre la economía.** Un técnico asignado sigue sin ver coste ni margen — lo decide el
  ROL, y la asignación no entra en esa pregunta.
* **Asignar no toca el documento (regla 29).** Escribe SOLO en la tabla puente. No es cuidado: no
  hay por dónde.

---

## Verificación · POR EL CAMINO REAL

No hay Postgres local, ni docker, ni `psql`, y el encargo prohibía staging y producción. Aun así
**no se razonó sobre el fuente**: `tests/_banco-camino-real.mjs` arranca **la app Express real** —el
mismo `dist/app.js`, con su `requireAuth`, su `requireRole` y sus handlers— y le habla por HTTP.

El mecanismo: `dist/core/db/prisma.js` construye el cliente como
`globalForPrisma.prisma ?? new PrismaClient()`, así que fijando `globalThis.prisma` antes del primer
require la app adopta un doble y **no se llega a construir ningún PrismaClient**. Cero conexiones,
cero credenciales, cero staging. El banco **falla** si la app no ha adoptado el doble.

Los ocho casos corren en `npm test` normal — **ninguno gateado, ninguno saltado**.

| Control | Resultado |
|---|---|
| 🔴 Técnico **asignado** → coste y margen no aparecen (6 bocas) | ✅ |
| 🔴 **Propietario** → sí aparecen (el otro sentido, pegado) | ✅ |
| 🔴 ¿Puede **deducirlo** restando? Se barre la respuesta entera y se exige que no aparezcan ni 60, ni 40, ni 0,4 | ✅ |
| ✅ POSITIVO: documento **sin asignar** responde igual, misma lista, mismo orden | ✅ |
| ✅ NEGATIVO: asignado ≠ permiso (6 acciones, todas 403) | ✅ |
| 🔴 REGLA 29: asignar a factura emitida no escribe en `invoices` | ✅ |
| 🔴 SUELO: sin usuario o sin rol, se declara CIEGO | ✅ |

### 🔴 El verde se probó EN ROJO, en los dos sentidos

Un verde no vale hasta saber qué mediría si el sistema estuviera roto. Saboteando
`veEconomiaDelNegocio` en el `dist` compilado:

* **siempre `true`** (todos ven economía, que es el defecto que este ticket cierra) → caen
  exactamente los dos controles del técnico, y **sólo** ésos;
* **siempre `false`** (se tapa a todo el mundo) → cae exactamente el del propietario.

El sabotaje se retiró recompilando, y se comprobó que no quedaba ni un resto.

**Y el suelo cazó un verde falso de verdad, no hipotético:** la primera versión del banco creaba un
doble por test. El segundo no se adoptaba —`prisma.js` ya estaba en la caché de módulos— y del test
2 en adelante la app hablaba con un doble sin programar. Sin la comprobación de identidad habrían
salido siete verdes que no medían nada.

---

## Lo que este ticket NO construye

⛔ **CAT-01**: la misma firma lo desbloquea, pero es otro ticket. ⛔ Ningún estado ni flag nuevo.
⛔ Ningún literal nuevo: los cinco textos del selector salen con `[PENDIENTE microcopy oficial]` y
están declarados en los dos censos (SCRUM-402 como 1 marca escrita, SCRUM-755 como 5 sitios
pintados) y en `docs/CENSO_MICROCOPY_PENDIENTE.md`.

---

## 🔴 DOS COSAS QUE NECESITAN AL FUNDADOR, aparte de la migración

### ① Se ha AMPLIADO lo que exige un guard, y se declara en vez de esconderse

`tests/scrum124-r29-no-borrado-facturas.test.mjs` prohíbe toda mutación bajo `/admin/invoices` que
no sea `PUT /:id/status`. `PATCH /:id/asignados` **no es** ninguna de las dos categorías que ese
guard contempla: no es cambio de estado y no es edición de contenido — **no escribe en `invoices`**.

Se ha añadido en una **lista aparte** (`MUTACIONES_QUE_NO_TOCAN_LA_FACTURA`) con su motivo, para que
se lea qué se ha permitido; **no** colada en `ALLOWED_MUTATIONS` disfrazada de cambio de estado, que
es lo que la habría hecho invisible. Y no es un cheque en blanco: la afirmación «no toca `invoices`»
está **ejercitada** sobre el registro de escrituras de la app real, con control positivo de que el
instrumento sí anota.

La alternativa era montar la ruta bajo otro prefijo para que el guard no la viera. Eso sería
esquivarlo, que es peor que ampliarlo a la vista de todos. **Queda a tu firma.**

### ② Una consecuencia de P-DOC-3 que se declara en vez de simularse

Un presupuesto creado **por un técnico** nacerá **sin `costeUnitario`**, porque el campo ya no le
llega. El servidor podría sellarlo desde el catálogo, pero la línea sólo referencia al producto por
`concept` —texto libre, sin `productId`—, así que hacerlo sería **adivinar** de qué artículo se
trata: fabricar un hecho, que es justo lo que SCRUM-661 existe para impedir.

No hay riesgo de que la ocultación **borre** nada, y está medido: `Quote.lines` se escribe en un
solo sitio (`POST /quote/create`) y no existe ningún endpoint que reescriba las líneas de un
presupuesto ya creado.
