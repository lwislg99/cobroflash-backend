# SCRUM-1515 · Paso ①: nuestra puerta de alta (el guion que crea un merchant)

**Medido contra:** `origin/main` = `4f8c473da8a565fdb6f00316f7ef5b14be3c1f1c` · 2026-10-08T08:11:30Z

A9: comprobación → `tests/scrum1515-nuestra-puerta-de-alta.test.mjs`

8-oct-2026 · **J3** (sesión `jv-j3`, equipo de Javier, relevo), por encargo del orquestador (`cobroflash-backend-90`).
[Escrito por J3. El encargo es la descripción de SCRUM-1515 y sus comentarios c.18969 y c.18971, leídos en Jira.]

**Carril J3 a mano** (`src/modules/auth/**`, `dos-equipos.md` §3.1; el test es el del ticket). El hook de
arranque dijo «SIN IDENTIDAD… no construyas» (no reconoce `jv-j3`, SCRUM-1498); se siguió, como manda
la ficha común del 8-oct.

La orden, tal como está en el ticket: «Ponte con lo de inhabilitar el registro desde el landing, creamos
los merchants nosotros desde el proyecto, que nadie pueda registrarse externo.» — el fundador, 8-oct-2026.

## Qué hay y qué NO hay

**Hay sólo el paso ①.** Tres ficheros:

- `src/modules/auth/app/cli/altaDeMerchant.ts`: el guion. Llama a `registerMerchant`; no contiene
  ningún `merchant.create`. Se lanza con `node dist/modules/auth/app/cli/altaDeMerchant.js --name … --email …
  [--country …] [--ref …] [--source …]` y dice en una línea de JSON qué creó.
- `tests/scrum1515-nuestra-puerta-de-alta.test.mjs`: da de alta los mismos dos merchants por la ruta y por
  el guion y compara las filas.
- `docs/master/evidencias/SCRUM-1515/`: el banco local y las seis mutaciones, con su salida.

**NO hay paso ②.** `POST /auth/register` sigue dando de alta exactamente igual: `auth.routes.ts` no se ha
tocado, ni `index.html`, `register.html`, `precios.html`, ni `prisma/schema.prisma`. El literal de la ruta
cerrada está firmado en c.18971; no se ha construido.

**Por qué vive en `src/modules/auth/` y no en `scripts/`:** la fila general de `scripts/` no recoge lo que
no es verificación ni censo (SCRUM-1480); allí no tendría dueño. En `src/modules/auth/**` es de J3.

## Lo que se encontró: llamar a `registerMerchant` con los cinco campos NO basta

1. **Quien limpia los campos es la ruta, no `registerMerchant`.** Correo a minúsculas y sin espacios,
   nombre sin espacios, país `ES` por defecto, `source` recortado a 200, `ref` vacío como ausente: todo eso
   está en el manejador de `/register`. `registerMerchant` guarda lo que recibe. Un correo con una
   mayúscula entraría tal cual, y `/auth/login` busca en minúsculas: ese merchant no podría entrar.
   El guion lleva una **segunda copia** de esas seis líneas. No se sacaron a un sitio común porque
   `scrum334` y `scrum264` leen el texto de la ruta.
2. **La bienvenida sale después de que `registerMerchant` vuelva, y es ella la que escribe
   `lifecycleEmailsSent` en la fila.** Un guion que termine al volver la llamada deja ese campo a NULL.
   El guion no sale: espera a que el proceso se quede sin trabajo (`beforeExit`) y entonces lee la fila.
3. **Con un correo que ya es merchant, `registerMerchant` no crea nada y le manda un enlace de acceso.**
   El guion mira antes y no llama (sale 3). Es una decisión mía; se cambia en una línea si no se quiere.

## La comparación, y qué caza

Los datos entran SUCIOS por las dos puertas (espacios, mayúsculas, un `source` de 230, país ` PT `). Los
merchants de la ruta se borran antes de crear los del guion, así que correo, nombre y código de referido
son los mismos y se comparan por valor.

| qué | resultado |
|---|---|
| campos de la fila | 65 |
| comparados por valor | 121 entre los dos merchants (61 en A, 60 en B): 0 distintos |
| comparados por su regla | `id`, `createdAt`, `updatedAt`, `planExpiresAt` (14 días desde `createdAt`), y `referredBy` en B (el id de A de su puerta) |
| alrededor de la fila | mismas filas colgadas (`authSession` 2, `emailMessage` 2 en A), mismas sesiones, mismos 2 correos |
| positivo | la fila se lee desde otro proceso al terminar el guion, lo que el guion dice es lo que hay, y el merchant entra con su enlace (302 a `/dashboard/` con sesión), igual por las dos puertas |
| rechazos | sin nombre y sin arroba: 400 en la ruta, salida 2 en el guion, mismos códigos · correo de operario: salida 4, sin merchant · correo que ya existe: salida 3, sin correo nuevo |

**¿Caza la divergencia entre las dos copias de la limpieza, o sólo el resultado de hoy?** La caza por los
dos lados para lo que los datos de prueba ejercitan: en `salida-verlo-en-rojo.txt`, quitar el recorte de
`source` EN LA RUTA hace caer el test igual que quitarlo en el guion. **Lo que no caza:** una limpieza
NUEVA que alguien añada a la ruta sobre algo que mis datos no ensucian (por ejemplo, quitar espacios
dobles dentro del nombre). Eso pediría atar el texto de las dos copias; no está hecho.

Visto en rojo (7 filas, 0 sin cuadrar): la base sale 0; caen el guion que corta al volver
`registerMerchant`, sin minúsculas, sin recorte, sin quitar espacios al país, con la fila escrita a mano,
y la ruta sin recorte.

## Lo que NO se ha medido

- **La tanda completa NO se ha corrido en local** (memoria de la máquina y turno): corrieron 20 ficheros de
  comprobaciones de suite, 0 caen, y mi test en el banco local. El resto lo dirá el obligatorio.
- **El banco local es PGlite (en memoria), no Postgres.** En Postgres de verdad sólo correrá en el job
  obligatorio de CI, que trae `LIBRO_PG_URL`. Sin esa variable el test se SALTA.
- En PGlite, un guion cortado a media consulta deja 1 merchant sin borrar (fila 2 de la salida): es el
  banco, que no se recupera del corte; no se ha visto en Postgres.
- El corte que se probó es el que no llega a decir nada. Un guion que dijera «creado» y saliera antes de
  anotar la bienvenida lo cazaría la comparación de `lifecycleEmailsSent`; no se ha ejecutado esa variante.
- El correo va a un SMTP de laboratorio. Con Resend (producción) no se ha lanzado nada, ni cuánto tarda
  el proceso en quedarse sin trabajo allí.
- El guion no se ha lanzado contra ninguna base de la casa. No dice contra qué base escribe: usa la
  `DATABASE_URL` del proceso, y en un árbol de trabajo no hay ninguna.
- Los tres controles del ticket para el paso ② (login y verificación intactos al cerrar): sin hacer,
  porque no hay cierre.

## De paso

El test nuevo se SALTA sin banco, así que va declarado en el inventario de
`tests/scrum419-ci-declara-lo-que-no-corre.test.mjs` (54 gateados donde había 53), con su motivo: es lo
que ese fichero pide a quien añade uno. No se ha cambiado nada de lo que exige.

## Mis errores

- Importé el banco desechable después de `node:test`; `scrum876e` lo cazó en local.
- Pasé de 200.000 de contexto sin medirme: la primera medida dio 240.152.
- Di de alta a mano un operario con el correo en mayúsculas y el guion, que lo limpia, no lo encontró: el
  test salió rojo por mi dato, no por el guion.
- El banco local imprimía `EXIT=1` y salía 0 cuando no podía cerrarse; una mutación viva se leía «no
  cuadra». Ahora el código de salida es el del test, se cierre o no.
- La primera versión del test sólo borraba lo que el guion DECÍA haber creado: al caer dejaba merchants.

## Cabos del ticket (c.18971), dichos y no arreglados

① El enlace de referidos (`referral.service.ts:58`) lleva a `/register.html`: al cerrar el alta quedará
roto en silencio. ② `public/index.html:307` y `:613` documentan los enlaces al registro. ③ Tres ficheros
de `tests/` llaman a la ruta, y `publicAccessDeclarations.ts:114` la declara pública. Ninguno se toca en
el paso ①.
