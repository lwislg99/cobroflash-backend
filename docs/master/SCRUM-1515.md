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

# SCRUM-1515 · Paso ②: la ruta pública ya no da de alta

**Medido contra:** `origin/main` = `7079aaf3876a6a314919c506b8aaa92d4ac52529` · 2026-10-08T08:27:00Z

A9: comprobación → `tests/scrum1515-nuestra-puerta-de-alta.test.mjs`

8-oct-2026 · **J3** (sesión `jv-j3`, equipo de Javier, relevo de la que hizo el paso ①), por encargo del
orquestador (`cobroflash-backend-90`). [Escrito por J3.]

**Carril J3 a mano** (`src/modules/auth/**`; los tests son los del ticket y los dos que el cierre arrastra).
El hook de arranque volvió a decir «SIN IDENTIDAD… no construyas» (SCRUM-1498); se siguió por la ficha común.

**Permiso:** el literal lo firmó el fundador en SCRUM-1515 **c.18971** («Sí firmo.», 8-oct-2026) y está
copiado de ese comentario, no de la ficha del encargo: la ficha lo traía sin tilde («escribenos») y la
firma dice «escríbenos». Avisado el orquestador, que lo confirmó.

El paso ① entró en `main` solo mientras se construía éste (PR #2319, 08:25:33Z). Su obligatorio (job
113215920130, punta `a945b405`) se leyó por nombre: 11.091 tests, 10.998 pasan, 0 caen, 93 saltos; log de
1.785.997 B; `SCRUM-1518` (el mayor número del log más uno) aparece 0 veces y `✔ SCRUM-1308` 3. El test del
guion salió `✔ SCRUM-1515 · …` en Postgres de verdad (3.788 ms, 121 campos por valor), **no como salto**.
Meta-guard, trinquete y navegador de ese PR: sin leer.

## Qué cambia

`POST /auth/register` (`src/modules/auth/app/routes/auth.routes.ts`) contesta siempre:

    409 { error: 'registration_closed', message: <el literal firmado> }

- **No lee el cuerpo, no toca la base, no manda correo.** `registerMerchant` ya no se importa en ese fichero:
  su único llamador en `src/` es el guion del paso ①.
- **Código HTTP: 409**, de los que ya usaba esa ruta (400, 409, 500). Es el del precedente que se mandó
  seguir (`email_belongs_to_team`: el único que llevaba `message`). 400 diría que la petición está mal
  hecha y 500 que hemos fallado; ninguna de las dos cosas es verdad.
- **`error: 'registration_closed'` lo he elegido yo.** La forma del precedente lleva las dos claves y hacía
  falta un valor. La página no lo pinta nunca (pinta `message` antes), no está en su tabla y no se traduce a
  ninguna otra frase. Si se quiere otro nombre, es una línea aquí y otra en cada uno de los dos tests.
- **Sin limitador, y es decisión mía:** el de antes contestaba a la sexta petición un 429 con «Demasiados
  intentos seguidos. Espera unos minutos y vuelve a intentarlo.», que en una ruta cerrada es falso (esperar
  no sirve). La respuesta es una constante que no hace trabajo.
- **Las seis líneas de limpieza de la ruta desaparecen con el manejador.** No se han «extraído»: no queda
  ruta que las use. La copia del guion pasa a ser la única; la tarea que el orquestador tenía en cola (atar
  las dos copias) se queda sin segunda copia que atar.
- `index.html`, `register.html`, `precios.html`, `login.html`, `prisma/schema.prisma`, los flags y los
  workflows: sin tocar. Sin flag nuevo.

## Los tres controles del ticket

| control | cómo se vio | resultado |
|---|---|---|
| ① la ruta da de alta ANTES y se niega DESPUÉS | el test del paso ① en el banco local, sobre `a945b405` (`salida-2-antes-de-cerrar.txt`); el test nuevo tras el cierre (`salida-2-despues-de-cerrar.txt`) | antes: 200 y 2 merchants por la ruta · después: 409 con la frase en 14 llamadas (los cinco campos, cuerpo vacío, sin nombre, sin arroba, ocho veces el mismo correo, un correo que ya es merchant, el de un operario), 0 merchants, 0 correos, 0 enlaces |
| ② el guion SIGUE creando, y la fila es la de la ruta | el guion lanzado después del cierre, comparado con la foto de la ruta | 2 merchants; 119 campos por valor, 0 distintos; mismas filas colgadas, sesiones y correos |
| ③ 🔴 login y verificación intactos | EJECUTADO: un merchant que ya existe recibe el 409 de la ruta cerrada, pide enlace por `POST /auth/login`, lo abre en `GET /auth/verify`, y con la cookie lee `GET /admin/me` | 200 y un enlace nuevo · 302 a `/dashboard/` con sesión · 200 con su `merchantId` y su nombre (401 sin cookie) · el enlace usado y uno inventado van a `/login.html?error=link_expired` · un correo de nadie: 200, sin carta y sin merchant |

**Lo que pinta la página:** el test saca de `public/register.html` la expresión de la línea 103 y su tabla,
y las ejecuta con la respuesta de la ruta: da el literal firmado, entero. Positivo de que la expresión
consulta la tabla: `invalid_email` da «Email inválido.». **No se ha abierto en un navegador.**

## La decisión sobre mi propio test, por delante

El test comparaba el merchant del guion con uno recién creado **por la ruta**. Esa referencia ya no se puede
fabricar. No se ha quitado la comparación: se ha **congelado la referencia**. Antes de cerrar se corrió el
test del paso ① una última vez y se guardó lo que dejó la ruta en `tests/_scrum1515-foto-de-la-ruta.json`
(los dos merchants, 65 campos cada uno, filas colgadas, sesiones, asuntos de los correos y cómo entra A).
El test cambia en la foto el sello de aquella pasada por el suyo y compara.

- `referralCode` pasa de «por valor» a «por regla»: acaba en las dos cifras del año
  (`referral.service.ts`), y contra una foto de 2026 caería el 1 de enero. Se compara todo menos esas dos
  cifras, y que sean las del año de `createdAt`. Por eso son 119 campos por valor y no 121.
- **Lo que se pierde:** la foto no se puede volver a sacar. Un campo NUEVO de la fila no tiene con qué
  compararse: el test lo cuenta y lo nombra en su diagnóstico, no lo juzga (hoy, 0). Un campo que la foto
  tiene y la fila ya no, sí cae.
- La foto no se edita a mano; nada lo impide más que la frase que lleva dentro.

## Visto en rojo

`salida-2-verlo-en-rojo.txt`: 16 filas, 0 sin cuadrar. La base sale 0 y caen los quince cambios, cada uno
sobre `dist/` y restaurado por sha: los cinco del guion del paso ①, y diez nuevos — la ruta vuelve a dar de
alta; cambia una letra de la frase («escribenos», justo la errata de la ficha); contesta 400; no manda
`message`; le manda un enlace a quien ya es merchant; recupera el limitador; el login se niega; el login
contesta 200 sin mandar enlace; la verificación no deja entrar; la verificación redirige sin dar sesión.

Las dos de la verificación caen en el primer enlace que se abre (el del alta por el guion), no en la
aserción del «merchant que ya existe»: ésa va después y no llegó a correr en esas dos filas.

## Lo que el cierre arrastra

- `tests/scrum334-correo-sin-consentimiento.test.mjs`: su trinquete de «rutas públicas que leen un correo»
  tenía tres y ahora ve dos. Pide literalmente quitar la línea de la ruta que deja de leerlo; quitada.
- `tests/scrum94-register-teammember.test.mjs`: afirmaba el alta abierta (el operario recibe
  `email_belongs_to_team`; el suspendido y el correo nuevo, 200). Reescrito al comportamiento decidido:
  todos reciben el mismo 409 y no se crea nada; la invariancia entre empresas se conserva. ⚠️ **NO
  EJECUTADO**: su gate es staging y este ticket no toca staging. Lo mismo, ejecutado, está en el test de
  SCRUM-1515 (el guion sale 4 con el correo de un operario; la ruta le contesta lo que a cualquiera).
- `tests/scrum419-…`: sólo el comentario de la fila de este test (sigue siendo 1 gateado).
- `docs/master/evidencias/SCRUM-1515/verlo-en-rojo.mjs`: la fila que mutaba la limpieza de la ruta ya no
  tiene texto que mutar; sustituida por las diez de arriba.

## Dicho y NO arreglado

1. **`src/core/http/publicAccessDeclarations.ts:114` (carril S1), sin tocar.** La ruta sigue montada y
   pública, y su `kind` (`no-sensitive-resource`) sigue valiendo; su `reason`, «mismo diseño
   anti-enumeración que /auth/login», queda viejo: ya no hay nada que enumerar. Lo sube el orquestador.
2. **`scripts/e2e-critico.mjs:51` deja de funcionar** (no es mi carril). Es `npm run e2e:critico`, el
   recorrido «¿despliego tranquilo?» de `docs/QA_MASTER.md:30`: registro → onboarding → presupuesto → firma →
   pago de prueba, con un merchant efímero que crea **por la ruta**. Con el cierre parará en su primer paso
   con «registro devolvió 409». Lo corre una persona a mano: ningún fichero de `.github/` lo nombra (8
   workflows mirados por nombre del guion; no he leído quién lo usa de hecho).
3. **El enlace de referidos** (`referral.service.ts:58`) lleva a `/register.html?ref=…`: quien llegue por él
   verá el formulario, lo enviará y leerá la frase firmada. El programa queda sin efecto y nada avisa a
   quien repartió el enlace (c.18971, cabo ①).
4. **Los 14 enlaces del landing siguen invitando a registrarse** y `public/index.html:307` y `:613` los
   siguen documentando: decidido a propósito en c.18971.
5. **`register.html` sigue diciendo «Crear cuenta y acceder»** y, al enviar, «Creando cuenta…» antes de
   pintar la frase. No se toca ningún otro literal de esa página (c.18971).
6. El mensaje de éxito de la ruta («Cuenta creada. Revisa tu email para acceder.») y el 409 de
   `email_belongs_to_team` con su frase **han dejado de existir en el servidor**. No he mirado si algún
   censo de literales fuera de la tanda los nombra.

## Lo que NO se ha medido

- **La tanda completa NO se ha corrido en local**: el test nuevo en el banco local (PGlite, no Postgres) y
  los ficheros de suite que se nombran en la entrega. En Postgres de verdad lo dirá el obligatorio.
- **Nada en un navegador, nada en yaqu.app, nada contra staging ni producción.**
- `scrum94` reescrito y sin ejecutar (arriba).
- Qué ve quien tenga abierta `register.html` desde antes del despliegue: la página no cambia, así que lo
  mismo; no ejecutado.
- Clientes de la ruta que no sean la página: sólo se buscó en `src/`, `scripts/`, `tests/` y `public/`.

## Mis errores

- Crucé 200.000 de contexto sin avisar: la primera medida dio 218.575.
- Di por hecho que `/admin/me` devolvía el correo del merchant; devuelve `merchantId` y `merchantName`. El
  test salió rojo por mi aserción, con el login funcionando.
- Mi primer lector del log del obligatorio no sacaba los totales (una barra perdida al pasar la expresión
  por la consola): los recuentos salieron vacíos, no a cero, y se repitió.

## Lo que cazó la tanda local antes de empujar (tres cosas mías, y una que no)

Corridos 391 ficheros de `tests/` de 1.295 (los que leen la ruta, el servicio de auth, los literales, los
censos declarados, el registro y las evidencias): 3.655 tests, 3.636 pasan, 16 saltos, **3 caen y los tres
son de `scrum475-schema-vs-sql`** («la herramienta de la casa no responde»: es el preview del esquema en
este árbol anidado; no lee nada de lo que toca este PR, y no lo he comparado con `main`). **Los otros 904
ficheros no se han corrido en local.** La primera pasada (223 ficheros) dio 8 rojos; cinco eran míos:

- **`registerMerchant` se quedó sin llamador que el censo vea** (`scrum411` y `scrum1185`): su único
  llamador es el guion, que se lanza a mano y no cuelga de ninguna entrada viva. Declarado donde los dos
  piden: `tests/_huerfanos-declarados.mjs` (categoría `FALSO_POSITIVO_MEDIDO`, con la causa) y
  `scripts/_sin-consumir-declarados.json` (carril J3, este ticket). No se ha tocado ningún número ni el
  instrumento. ⚠️ Es una consecuencia del cierre que nadie había nombrado: **en el servidor, el alta ya no
  la ejecuta nada**; vive sólo por el guion.
- **`scrum275`: el tope de respuestas públicas sin `message` baja de 21 a 18.** Lo exige él mismo al bajar
  («baja `SIN_MESSAGE` en este mismo commit»): con el manejador se van `name_required`, `invalid_email` e
  `internal_error`. No se ha arreglado ningún texto.
- **`scrum560`: mi test nuevo hacía 6 `fetch` sobre su propio servidor** (el tope son 3; revienta libuv al
  cerrar, 2 de cada 10 tandas). Cambiado a `node:http` sin pool, como manda. El test y las quince
  mutaciones de arriba se corrieron con `fetch`; tras el cambio se repitió el test en el banco (verde,
  `salida-2-despues-de-cerrar.txt`) y **las quince mutaciones NO se han repetido**.

De esto sale un error más para la lista: di el paso ② por construido con mi test en verde, antes de correr
la tanda de suite. Lo que lo impide ya existe y cazó las tres: son esos tres ficheros, en el obligatorio.
