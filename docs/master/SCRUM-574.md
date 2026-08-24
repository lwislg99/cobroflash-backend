# SCRUM-574 · CONT-01: el switch Empresa/Persona se PARA en el PASO 0 — «Tipo de cliente» es el campo fiscal de SCRUM-69

**Fecha:** 24-ago-2026 · **Carril:** producto (BLOQUE 1) · **Gate:** STOP — pendiente de GO del fundador (AA1.4, zona fiscal)
**Medido contra:** `origin/main` = `9b49190a7ab81be5c88a32b7745623ac78c8354f` · 2026-08-24T00:00:00+02:00
**Tanda:** 3934 tests, 3857 pass, 0 fail, 77 skipped

> ⚠️ Esa hora es la del trabajo de esta rama, no una lectura de reloj — criterio R14.

**Alcance de lo entregado:** el PASO 0 medido y escrito, el censo de dónde vive el campo, el
hallazgo que abre la decisión, y el diff del esquema PREPARADO Y SIN APLICAR. **El switch no se
ha construido**, y el motivo está abajo: el propio encargo manda parar en este caso exacto.

---

## El defecto que el ticket quería cerrar

El profesional da de alta a un administrador de fincas y a un particular con el mismo formulario
y luego no puede distinguirlos: la diferencia vive en si alguien rellenó «Razón social». El
ticket propone un switch Empresa|Persona que declare la distinción y que **absorba el desplegable
«Tipo de cliente», eliminándolo**, sin añadir ningún campo nuevo.

## Lo que se midió (PASO 0 · `P-CONT-4`)

Censo completo en `docs/CENSO_TIPO_CLIENTE.md`. Comando re-ejecutable y de **solo lectura**:
`node scripts/censo-tipo-cliente.mjs`.

**Las dos preguntas del encargo, que son distintas y hacían falta las dos:**

* **(a) Qué permite el esquema:** `customers.tipo_destinatario` es `text`, `nullable`, **sin
  `DEFAULT` y sin `CHECK`** → la BD acepta cualquier cadena. La lista cerrada
  (`PARTICULAR`/`EMPRESARIO`) existe **solo** en Zod, en el borde de la API.
* **(b) Qué tienen las filas de hoy:** **15 clientes medidos, los 15 con `NULL`.**
  STAGING (`acela/railway`) 4 de 4 · DEV (`acela/yaqu_dev_javier`) 11 de 11. Cero razón social,
  cero NIF. **Ningún valor existente necesita mapearse.**

**Producción NO se midió y no puede medirse desde aquí:** no existe `DATABASE_URL` en el árbol
(regla 3, verificado con `scripts/comprobar-claves-bd.mjs`). El censo lo declara en vez de
afirmar un total que no tiene.

**No hubo segunda medición que contrastar.** El encargo avisaba de que S1 tenía encargada esta
misma pregunta. Se buscó `P-CONT-4` en `docs/` y `.claude/`: **cero coincidencias**. Ésta es hoy
la única medición, y se dice para que nadie la lea como una coincidencia de dos.

## El hallazgo, y por qué cambia el ticket

El encargo describía «Tipo de cliente» a partir de capturas, declarando que **el repositorio no
se había abierto**. Abierto: **ese desplegable es `Customer.tipoDestinatario`, el campo fiscal de
SCRUM-69 (FACT-1)**, y determina el **plazo legal de la factura recapitulativa** (art. 13.2
RD 1619/2012) — `EMPRESARIO` → día 16 del mes siguiente; `PARTICULAR` → último día del mes.
De ahí sale el semáforo de la bandeja «Pendientes de facturar».

Tres razones por las que el switch **no puede absorberlo**, en orden de gravedad:

1. **No son la misma distinción.** «Empresa/Persona» es **forma jurídica**;
   `PARTICULAR/EMPRESARIO` es **si el destinatario actúa como empresario a efectos de IVA**. Un
   autónomo es **PERSONA** y a la vez **EMPRESARIO**. 🔴 El caso roto es la víctima del propio
   ticket: un *administrador de fincas* autónomo puesto en «Persona» —correcto en su ficha—
   recibiría en silencio el plazo de particular, **~16 días más corto**, y la bandeja avisaría
   tarde de una factura vencida.
2. **Tres estados no caben en dos posiciones.** `NULL` · `PARTICULAR` · `EMPRESARIO`. Los 15
   clientes medidos están **todos** en el estado que un toggle no sabe representar. Y ese `NULL`
   es deliberado: `schema.prisma` deja escrito que «nunca se escribe de vuelta a la BD».
3. **El alta cambiaría de comportamiento.** Hoy un cliente nace `NULL` y el código elige el plazo
   **más corto** por seguridad. Un switch obligatorio hace que cada alta **declare** un valor: con
   «Empresa» por defecto, YaQu afirmaría un régimen fiscal que el profesional no ha declarado —
   justo lo que SCRUM-294-a prohíbe para el campo de al lado.

## La decisión que hace falta, y por qué no la toma esta sesión

Es zona fiscal (AA1.4) y toca `prisma/schema.prisma`, dominio de los fundadores. Tres salidas, en
`docs/CENSO_TIPO_CLIENTE.md` §3.2: **(A)** el switch escribe en `tipoDestinatario` — lo que pide el
ticket, con la conflación fiscal dentro; **(B)** campo nuevo para la forma jurídica, dejando el
campo fiscal intacto; **(C)** el switch como pura presentación, sin persistir — que deja a CONT-08
(el filtro Empresas/Personas) sin dato sobre el que filtrar.

**Recomendación medida: B.** El ticket dice «NO SE AÑADE CAMPO» y también dice, dos veces, que si
parece hacer falta un estado nuevo hay que **parar y reportarlo**. Éste es ese caso.

## El diff, preparado y sin aplicar

`docs/sql/SCRUM-574-opcion-B.diff`. **`prisma/schema.prisma` NO se ha tocado.**
Aditivo puro: `ALTER TABLE "customers" ADD COLUMN "contact_kind" TEXT;` — una sentencia, nullable,
cero `DROP`, cero `RENAME`, sin pérdida de datos posible.

Generado con el **CLI local por ruta** (nunca `npx`, SCRUM-385) y con **control positivo delante**:
el esquema entero contra vacío devolvió **25 `CREATE TABLE`**, así que la herramienta contestaba y
el diff es interpretable. `DATABASE_URL` se fijó a una URL muerta (`127.0.0.1:1/nada`): ninguna
base real intervino.

**Migración de datos que acompañaría: ninguna.** Con los 15 clientes en `NULL` y `contact_kind`
naciendo `NULL`, no se escribe un solo byte sobre ninguna fila existente — que es exactamente el
control que pedía el encargo («sigue siendo el mismo cliente, mismo id»), sostenido por la vía más
fuerte: no hay escritura que comparar.

## Verificado en rojo

**Nada que romper todavía, y se dice en vez de simularlo.** El encargo pedía romper a propósito
«cualquier comprobación que construyas sobre el switch». No se ha construido ninguna, porque no se
ha construido el switch. Un rojo sobre un mecanismo inexistente sería teatro.
Lo que sí se ejerció es el **suelo** del propio censo: el camino «la columna no existe» y el camino
de error devuelven *NO SUPE MIRAR* en vez de `0 clientes` — la distinción que el encargo exigía.
Se observó de verdad en DEV, donde `recargo_equivalencia` falta y la consulta cayó con `P2010`:
el script lo declaró como ceguera en lugar de devolver un cero limpio.

## Hallazgo lateral (otro carril — se reporta, no se arregla; regla 37)

**Deriva de esquema DEV vs STAGING:** `customers.recargo_equivalencia` (SCRUM-294-a) existe en
STAGING y **no existe** en `yaqu_dev_javier`. El comentario de `schema.prisma` solo afirmaba
producción y staging, así que no se contradice; lo que no estaba escrito es que DEV se quedó atrás.
No bloquea este ticket y no es su zona.

## Lo que NO cubre

* **El switch no existe.** Ni en el alta ni en la edición. Puntos 2, 3 y 5 del encargo, sin empezar.
* **El desplegable «Tipo de cliente» sigue donde estaba**, en los dos formularios. No se ha
  eliminado nada: eliminarlo antes de la decisión es elegir la opción A por omisión.
* **Ninguna migración se ha ejecutado.** El encargo la condicionaba al PASO 0 medido y escrito —
  ya lo está — pero la decisión fiscal es previa.
* **Producción sin medir**, por diseño.
* **Microcopy: cero.** Ni etiquetas del switch ni de los campos que cambiarían — son del fundador
  (regla 30). El nombre `contact_kind` del diff es identificador de código, no texto de pantalla.
* **Los duplicados de clientes no se auditaron ni se tocaron**, como pedía el encargo.
* **`docs/DECISIONES_PENDIENTES.md` no se ha tocado**: la decisión se entrega aquí y en el censo,
  sin duplicarla en un tercer sitio.
* **Nada de F1 se movió:** el teléfono sigue siendo la columna que era en la lista (medido: los
  encabezados son `ID · Nombre · Teléfono · Email · Notas · Alta`, así que Teléfono es el **tercer**
  `<th>` y el segundo dato tras el nombre — el encargo lo llamaba «segunda columna»; se manda lo
  medido). No se tocó el formulario de documentos ni el PDF (S2 / DOC-10).

## Ficheros

* `docs/CENSO_TIPO_CLIENTE.md` — **nuevo.** El PASO 0, las dos preguntas, el hallazgo y las opciones.
* `docs/sql/SCRUM-574-opcion-B.diff` — **nuevo.** El diff preparado, con cómo reproducirlo.
* `scripts/censo-tipo-cliente.mjs` — **nuevo.** El censo, solo lectura, re-ejecutable, con suelo.
* `docs/master/SCRUM-574.md` — esta entrada.

**Ni una línea de `src/`, `public/` o `prisma/` fue modificada.**
