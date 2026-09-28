# SCRUM-1199 · La firma de los cuatro literales del alta de cliente

**Medido contra:** `origin/main` = `dedc9292d6c139261d6e5969b42ca62842a6abdc` · 2026-09-28T13:55:44Z

28-sep-2026 · Lo escribe **el orquestador de Javier** (`jv-orquestador`) por delegación del
fundador. El texto firmado vive en
[`docs/microcopy/2026-09-28-SCRUM-1199-alta-cliente-errores.md`](../microcopy/2026-09-28-SCRUM-1199-alta-cliente-errores.md).

## Qué entra aquí y qué no

⛔ **Este PR no construye nada.** No toca `customersView.js`, ni el esquema, ni un test. Sólo trae
la firma, para que J2 pueda construir sin escribir una aprobación que su clasificador pararía —
y pararía **con razón**.

La construcción va en su propio PR, en el carril de J2.

## Por qué se firmaron CUATRO y no los TRES propuestos

La propuesta traía un solo literal para `phone` y `mobile`. Medido sobre `origin/main`:
`ROTULO_TELEFONO = "Teléfono"` (`customersView.js:947`) y `ROTULO_MOVIL = "Móvil (WhatsApp)"`
(`:967`) son **dos cajas distintas**, cada una con su selector de prefijo propio.

🔴 Un aviso que nombra sólo «el teléfono» **manda a mirar la caja equivocada la mitad de las
veces**. Y no exigía decidir nada nuevo: `details[].path` ya distingue los dos campos. El defecto
no era de criterio, era de no usar un dato que ya estaba.

## Lo que se comprobó antes de firmar, y no se dio por bueno

| Pregunta | Cómo se contestó |
|---|---|
| ¿Sigue viva la delegación? | Leída en `origin/main`: `limites-del-fundador.md` §«Delegación permanente», línea «Javier, 25-sep-2026» |
| ¿Cuántas cajas de número hay? | Leídos los dos rótulos en el fuente, no supuestos |
| ¿Cómo se llama el campo de correo **en pantalla**? | `createField("Email", …)` (`:1234`) → el literal dice «el email», no «el correo» |
| ¿«Le faltan cifras» es exacto? | `z.string().min(5)` — el **único** modo de fallo es la longitud. Sería falso si validara formato |
| ¿El genérico se traga algo? | El modal ya pinta `El nombre es obligatorio.`; el genérico entra sólo donde hoy va `err.message` (`:1793`) |

## Suelo

⚠️ **Los cuatro literales caducan si SCRUM-1161 se revierte.** Dicen lo que dicen porque, con ese
arreglo dentro, lo vacío ya no llega a la puerta y sólo llega lo mal escrito.

⚠️ **«Le faltan cifras» no se hereda.** Es exacto por la forma del esquema de hoy. Si el esquema
cambia, el literal vuelve a firma.

⚠️ **No se ha censado si hay más pantallas que pintan `validation_error` en crudo.** Se conocen
dos —el alta de cliente (J2) y el presupuesto rápido (SCRUM-1198, S2)— **porque salieron al
paso**, no porque nadie las buscara.

## Código (J2, jv-j2): los cuatro literales montados en el modal

**Medido contra:** `origin/main` = `3f4c643e93871234e59e5ca5db145ba5cef8f9ee` · 2026-09-28T14:02:17Z (J2; SCRUM-1161 ya dentro)

Esta sección la añade J2 en su rama de código. La firma de arriba es del orquestador y no se toca.
Va aquí y no en otro fichero porque `scrum854` exige que una rama que toca código traiga su
entrada, y `#1861` saldrá del diff en cuanto entre en `main`.

- **Lo que midió el punto 5 de la firma, ejecutando la ruta real:** el 400 salía como
  `{"error":"validation_error"}` a secas, SIN `details`. La ruta mandaba `details: err.errors`, y
  con Zod 4 eso es `undefined`, así que `JSON.stringify` borraba la clave. Solo con el front, las
  cuatro ranuras habrían caído en el genérico.
- **Servidor** (`customersAdmin.routes.ts`, POST y PUT/PATCH): `details: err.issues`, un cambio
  aditivo a la respuesta. Medido después: `path` trae `["phone"]`, `["mobile"]` o `["email"]`, y
  `code` es `too_small` o `invalid_format`.
- **Pantalla** (`customersView.js`, `avisoDeGuardadoFallido`): decide por campo Y código. Muestra
  «le faltan cifras» solo con `too_small`, y el email solo con `invalid_format`. El genérico solo
  sustituye al mensaje compuesto en crudo: un `message` humano del servidor, o un aviso ya resuelto
  por `apiRequest` (`handled`), se sigue pintando como antes. «El nombre es obligatorio.» no pasa
  por aquí.
- **Test** `tests/scrum1199-avisos-alta-cliente.test.mjs`: ruta real → cuerpo real → modal real
  → aviso pintado. Rojo verificado por mutación y con el árbol devuelto al commit: con el servidor
  en `err.errors` caen 2 de 4, y con la pantalla en el crudo caen otros 2 de 4.
- **Fuera de carril, sin tocar:** `details: err.errors` sigue igual de roto en otras 6 rutas
  (`quotes.routes.ts` ×3, `invoice.routes.ts`, `charges.routes.ts`, `psp.routes.ts`). Sus 400
  tampoco dicen qué campo falla.
