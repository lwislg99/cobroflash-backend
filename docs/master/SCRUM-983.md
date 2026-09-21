# SCRUM-983 · editar sólo la nota desde la ficha 360 BORRABA seis datos del cliente

**Fecha:** 21-sep-2026 · **Carril:** S2b (front + una ruta de lectura del servidor) · **Pedido por:** el orquestador, con GO expreso
**Medido contra:** `origin/main` = `3ac838a5e055bb9e70a484560ee5b23187c6f491` · 2026-09-21T07:55:42Z (cabecera `Date:` de `gh api -i zen`)
**Rama:** `scrum-983-ficha-360-no-borra` · **Origen:** lo encontró LEYENDO la Sesión 0 (s0-21); lo reprodujo POR EFECTO la Sesión 2b.

## La víctima

El profesional abre la ficha de un cliente, pulsa «Editar», corrige la nota («timbre roto») y
guarda. Sin error y sin aviso, el cliente pierde su **NIF**, su **razón social**, el **vínculo con
su empresa**, su **forma jurídica** (Empresa/Persona), su **tipo de destinatario** —que decide el
plazo legal de la recapitulativa— y su **periodicidad de facturación**. Son los datos que alimentan
los documentos que se le mandan.

**Sin víctimas reales:** en producción no hay ningún cliente real (dato del fundador, 21-sep-2026).
Se cierra por prevención. La fecha de abajo es contexto, no urgencia.

## PASO 0 · medido en staging antes de escribir una línea

Sonda en navegador contra staging (`/version` = `3ac838a5`), merchant QA:
`docs/master/evidencias/scrum983/sonda-nif-360.mjs`, salida en `salida-staging-21sep.txt`.
Crea un cliente de prueba con todo relleno (y su empresa), abre la ficha 360, pulsa Editar,
escribe SÓLO en Notas, guarda, lee el PUT que sale y compara `GET /admin/customers/:id` antes y
después. Borra los dos clientes al final (DELETE 204, y el GET posterior ya no los encuentra).

| campo | antes | después |
|---|---|---|
| `taxId` | `12345678Z` | 🔴 `null` |
| `legalName` | `ZZZ Razon Social` | 🔴 `null` |
| `companyId` | `3928` | 🔴 `null` |
| `contactKind` | `PERSONA` | 🔴 `null` |
| `tipoDestinatario` | `EMPRESARIO` | 🔴 `null` |
| `billingPeriodicity` | `MENSUAL` | 🔴 `NINGUNA` |
| `name`, `phone`, `email`, `waOptOut` | — | ✔ iguales |
| `notes` (control positivo) | `nota vieja` | ✔ cambió |

Población: 11 campos, 6 perdidos. El modal ya ABRÍA con esos campos vacíos.

**Fallo del instrumento, no del producto:** la nota quedó «nota viejanota nueva» porque el triple
clic de la sonda no seleccionó el texto antes de teclear. No cambia nada de lo medido —el control
positivo sólo pide que la nota cambie—, pero es de la sonda y se dice.

## La causa: dos eslabones

1. **Servidor.** `GET /admin/customers/:id/detail` (`customersAdmin.routes.ts`) seleccionaba 9
   campos y ninguno de esos seis. El modal «Editar» rellena sus controles con ese `customer`, así
   que los pintaba vacíos.
2. **Front.** El modal (`customerDetailView.js`, `openEdit360Modal`) mandaba lo que hubiera en el
   control aunque no lo hubiera cargado nunca; vacío viaja como `null` y `updateCustomer` lo escribe.

### Por qué SCRUM-692 no lo cazó

SCRUM-692 vigila justo este formulario, con la propiedad «un formulario sólo envía lo que
MUESTRA»: cada clave del payload tiene que leer un control. Aquí el control **existía** —el campo
NIF se ve—; lo que faltaba es que se hubiera **llenado** con el dato de verdad. El guard medía que
hubiera control, no que el control tuviera el valor guardado: **era más débil que el contrato que
quería proteger**, y por eso pasó en verde mientras se borraba el NIF. Es la misma lección que el
control D.10 de SCRUM-917e (com. 16001). No se toca su fichero: se le añade la mitad que faltaba.

## Desde cuándo (historial de git, sin tocar producción)

El `select` del `/detail` tiene esa forma desde que nació la ficha 360
(`ece3279d05b67fbeadaeb1461ca76f787a23ed82`, 22-may-2026, sprint 15) y **nunca** trajo esos
campos. El defecto empieza el día que el modal empezó a MANDARLOS, y se fue ensanchando:

| desde | commit | campo que el modal empezó a mandar sin que el /detail lo trajera |
|---|---|---|
| 2026-07-05 20:37 +02:00 | `31391ff68f901fabe32e4637e8ee56b5f3ca4691` (A20.4) | `taxId`, `legalName` |
| 2026-07-23 14:21 +02:00 | `aba490431df8936e210a2dffaf68bc9e35e55ff5` (SCRUM-69) | `tipoDestinatario` |
| 2026-07-27 20:29 +02:00 | `090ca6e0dc6315325018121788efb98219692f36` (SCRUM-171b) | `billingPeriodicity` |
| 2026-08-24 13:01 +01:00 | `b47e8341e696fee3f46cf6ac95335356baf99d28` (SCRUM-574) | `contactKind` |
| 2026-09-07 21:16 +01:00 | `c6fc3fec773177783a5f111252c5b6162f1a5437` (SCRUM-576) | `companyId` |

(Fechas de commit; el comando es `git log origin/main --reverse -S "<la línea del payload>" --
public/dashboard/js/customerDetailView.js`. La fecha de entrada en `main` puede ser posterior.)

## El arreglo

1. **Servidor:** el `select` del `/detail` trae los seis. El `where` sigue con `merchantId`
   (multi-tenant intacto). Un campo por línea.
2. **Front:** tras montar el payload, una clave que el `customer` cargado no tenía **no viaja**
   (ausente ≠ null). Vaciar a propósito un campo que SÍ se cargó sigue mandando `null`
   (SCRUM-692 ⑤ sigue verde). Va después del literal, así que el contrato de 692 no cambia.

Las dos, porque cualquiera por separado vuelve a abrir el hueco el día que alguien añada un campo
al modal y no al `select`: con la segunda, ese día el campo no se guarda, pero no se borra.

## El rojo, y cada mitad cazada por su test

`tests/scrum983-la-ficha-360-carga-lo-que-edita.test.mjs`, 4 tests:

- ① SUELO: los dos extractores (AST del TS de la ruta y del JS del modal) ven lo suyo, con
  control positivo por nombre.
- ② estructural: todo `customer.X` con el que el modal rellena un control está en el `select`.
- ③ por efecto (banco de vistas): con un `customer` construido con las claves REALES del
  `select` (leídas por AST), editar sólo la nota no cambia los seis. Reproduce en el banco
  exactamente lo de staging: los mismos seis, con los mismos valores.
- ④ por efecto: un campo que el modal no cargó no viaja.

| árbol | ① | ② | ③ | ④ |
|---|---|---|---|---|
| rojo (`bc865f0308b7a66de122cf4096302d37417615d7`) | ✔ | ✖ | ✖ | ✖ |
| arreglo (`3f674b7d3ce240b7cc3733949fa4681bcd600c55`) | ✔ | ✔ | ✔ | ✔ |
| arreglo SIN la mitad del modal | ✔ | ✔ | ✔ | ✖ |
| arreglo SIN la mitad del `select` | ✔ | ✖ | ✔ | ✔ |

Cada mutante con su `git diff --numstat` al lado (0/13 en el modal; 1/12 en la ruta) y el árbol
restaurado con `git restore --source=HEAD` y `status --porcelain` vacío.

**Un censo me paró, y con razón:** `scrum615-plazo-con-null` fija quién lee `tipoDestinatario`
(campo con carga fiscal). El `select` nuevo entra en su lista como **transporte**, igual que la
entrada que ya tenía `customerAdmin.ts`: lo trae para pintarlo, no decide nada con él.

## Medido, con su población

- `npm run build` EXIT 0.
- 983: 4/4.
- Grupo de clientes y NIF (los ficheros de 983, 692, 574-590, 615, 795, 767, 446, 820 y todo test
  que nombre `taxId` o el censo de origen de la factura): **114 ficheros, 933 tests, 0 fail**, 47
  saltados (gateados por base de datos).

## La misma familia, en el OTRO formulario: el modal de la LISTA — medido, NO borra

El modal «Editar» de la lista de clientes (`customersView.js`) rellena desde `listCustomers`, cuyo
`select` (`CUSTOMER_SELECT_NO_TOKEN`, `customerAdmin.ts`) ya trae todo lo que ese modal edita. Por
lectura no tenía el hueco, pero se midió por efecto con la sonda gemela
(`docs/master/evidencias/scrum983/sonda-lista.mjs`, salida en `salida-lista-staging-21sep.txt`),
staging `/version` = `53d756d7f619b1bfb22e36c5dd1ecd4ed9fcf160`, 21-sep-2026 ~08:20Z:

- un cliente con **todos** los campos editables rellenos (NIF, razón social, empresa, forma
  jurídica, tipo, periodicidad, recargo, descuento, referencia, etiquetas, los cinco de dirección,
  móvil y fijo en rango imposible) → la lista → «Editar» de SU fila (buscada por nombre) → se
  vacía la nota y se teclea otra → «Guardar cambios»;
- **población: 23 campos (sin `notes` ni `updatedAt`), los 23 rellenos antes · 0 cambiados** ·
  control positivo: la nota pasó a «nota nueva». El PUT lleva los 20 que el modal muestra con su
  valor; `billingPeriodicity` no viaja (no es de ese modal) y siguió en `MENSUAL`;
- limpieza: los dos clientes de prueba (3930, 3931) borrados, DELETE 204 y ya no se encuentran.

No hace falta arreglo en ese formulario.

## Error propio: un teléfono de móvil ordinario en los datos de prueba

El primer CI del PR #1568 cayó en `scrum262-telefonos-de-prueba`: el test llevaba `34600111222`,
que es un móvil español ORDINARIO y puede ser de alguien. **Y la sonda de staging creó el cliente
de prueba con ese mismo número** (vivió unos segundos y se borró; no se envió nada desde la sonda,
pero hay crons que escriben por WhatsApp a teléfonos guardados). Los dos pasan a
`telefonoDePrueba(983)` (rango imposible, prefijo 340). La salida de la primera pasada se deja tal
cual, con ese número, porque es lo que se ejecutó. En la misma edición se arregla el triple clic
de la sonda: ahora vacía la nota antes de teclear.

🔒 *La regla existía y tenía guard; lo que faltó fue usar el helper desde la primera línea en vez
de escribir un número «de ejemplo» a mano.*

## Lo que NO cubre

- La suite completa no se ha corrido en local (sin turno): la corre el PR.
- El fichero gateado `scrum692-guardado-parcial-en-base` (viaje contra base) no se ha corrido.
- (Aquí ponía «el modal de la LISTA no está medido». El orquestador pidió que no se quedara como
  hueco: está medido abajo, y NO borra.)
- Sin verificar en staging tras el despliegue todavía.
