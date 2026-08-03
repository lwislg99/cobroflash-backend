# SCRUM-275 · MESSAGE-EN-EL-ACCESO: la tabla existía y vivía detrás de una llave

**Fecha:** 3-ago-2026 · **Carril:** A · **Gate:** microcopy aprobado por el fundador (regla 30)
**Medido contra:** `origin/main` = `5cd6387c0e21405a782d625dccef3ab58ad92db8` · 2026-08-03T13:16:20+02:00
**Tanda:** 1128 tests, 1061 pass, 0 fail (el resto, gateados a staging)

> La medición original se hizo sobre `1f8c6a07` y se **re-verificó entera** tras rebasar sobre
> este main: el censo sigue dando 28 y la suite sigue en verde. El ancla apunta al main
> re-verificado, no al de la primera pasada — si apuntara al viejo, declararía haber medido algo
> que ya no es lo que se va a mergear.

## El defecto

Quien se equivocaba al teclear su correo en `/login.html` leía **`invalid_email`**. Quien agotaba
los intentos leía **`too_many_requests`** — y ése es el peor de los tres, porque el servidor
**mandaba su copy en español** («Demasiados intentos seguidos. Espera unos minutos y vuelve a
intentarlo.») y la página lo tiraba.

Es SCRUM-151 a medio cerrar por tercera vez: `api.js:35-37` lo resolvió para el dashboard,
SCRUM-264 para la landing de presupuesto, y la página de acceso seguía fuera.

## 🔑 El hallazgo, que cambió el arreglo entero

**La página ya tenía la tabla de traducción**, bien escrita, con «El enlace ha caducado o ya fue
usado. Solicita uno nuevo.» dentro. Y no es que no la aplicara al `fetch`: **no podía**. El
`const msgs` estaba declarado **dentro del `if (params.get('error'))`**, así que desde
`sendLink()` no estaba ni en el alcance.

**El arreglo no fue escribir textos: fue sacar la tabla de la llave.** De los tres códigos que
faltaban, `internal_error` ya estaba escrito en esa tabla y `too_many_requests` ya lo manda el
servidor. **Un solo texto nuevo que aprobar.**

## La decisión, y por qué

**Texto oficial** (fundador, 3-ago-2026): `invalid_email` → **«Escribe un correo electrónico
válido.»** Elegido para casar con los que la propia página ya usa («Solicita uno nuevo.»):
imperativo, corto, sin explicar lo obvio.

**El `catch` también se arregla.** Envolvía `fetch` **y** `res.json()`, así que un 500 con cuerpo
vacío o HTML se etiquetaba «Error de conexión. Comprueba tu internet.». Miente dos veces: al
usuario, que se pone a mirar su wifi con el servidor caído, y a quien lo depure después, que
buscará donde no es. Ahora `res.json().catch(() => ({}))` — el parseo no decide el diagnóstico.

## Lo que se midió

**Censo 1 · la página de acceso, entera.** `POST /auth/login` devuelve `400 invalid_email`,
`500 internal_error` y `429 too_many_requests` (éste **con** `message`); un correo **no
registrado** responde `200` a propósito, para no revelar quién tiene cuenta. Por la otra mitad,
`GET /auth/verify` redirige con `link_expired`, `invalid_token` e `internal_error`, **y esos tres
ya se traducían bien**.

**Censo 2 · el servidor, que faltaba.** De 36 respuestas de error de superficie pública, **28 no
llevan `message`**: `/quote/*` 17, `/auth/*` 6, `/cliente/*` 4, `/health` 1. `albaranPublic` va
**5 de 5** — el patrón no hay que inventarlo, hay que extenderlo.

**Y esto corrige el alcance de SCRUM-264, que quedó escrito de menos:** la landing ya prefiere
`message`, pero **solo 4 de las 21 respuestas de `/quote/*` mandan uno**. El arreglo del front
era **necesario y no suficiente**. Son dos censos porque son dos defectos.

## El trinquete (`SIN_MESSAGE = 28`)

Nace en 28 y **no puede subir**: quien añada una respuesta pública nueva la escribe con su texto.
**Y bajar también falla**, igual que en SCRUM-243 y SCRUM-273 — si la bajada pasara en silencio,
la mejora no quedaría escrita y el número dejaría de significar nada: nadie sabría si es que se
arregló algo o si el escáner ve menos. Por eso **no hay ticket para «cerrar los 28»**: el
trinquete es su propio registro y el incentivo le toca a quien pase por esas rutas.

**Las superficies se DERIVAN**, cruzando `publicAccessDeclarations.ts` (qué es público y de qué
clase) con los montajes de `app.ts` (qué router sirve cada prefijo). Un fichero de rutas públicas
nuevo entra solo el día que se monte.

**⚠️ Son 28 y el censo a mano dijo 27.** La diferencia se queda escrita porque es la lección de
SCRUM-264 otra vez: aquel censo salió de una **lista de ficheros escrita a mano** y se dejó
`health.routes.ts` fuera; al derivar, `/health` entra sola. **Una lista a mano no avisa de lo que
le falta.** `/health` la lee un monitor y su respuesta sin texto no es deuda real, pero se cuenta
igual: excluirla por ruta abriría, dentro del guard, la misma lista a mano que el guard evita. Las
únicas exclusiones son **por clase declarada** — `signed-webhook` e `internal`, que las leen
máquinas.

## Verificado en rojo

- **Los cuatro defectos, uno por rojo** (`scrum264-…`, 4 de 17): el código en vez del copy, la
  tabla no consultada, `invalid_email` sin traducción, y el parseo lanzando para que el `catch`
  mintiera.
- **El trinquete, en las dos direcciones**: con tope 27 → «HAY 28 … y el tope es 27»; con tope
  29 → «✅ BIEN, y hay que anotarlo: quedan 28 y el tope decía 29».
- **El suelo cazó un fallo real durante la construcción**: la primera derivación resolvía las
  rutas a ficheros inexistentes (los imports de `app.ts` son relativos a `src/`) y el censo daba
  **0**. Sin el suelo, cero se habría leído como «ninguna respuesta sin texto» — un trinquete
  perfecto sobre nada.

## Lo que NO cubre

- **Los 28 siguen ahí.** Esto impide que crezcan; no los arregla.
- **Cinco rutas públicas quedan fuera del censo** por no tener router propio (`/privacidad`,
  `/terminos`, `/precios`, `/public/founding-status`, `/version`). El test las **imprime** en cada
  tanda en vez de descartarlas en silencio.
- **El guard de 264 mira lo que la pantalla PINTA, no lo que el usuario ve.** Si alguien deja de
  llamar a `showAlert`, la expresión seguiría siendo correcta y no habría aviso.

## Ficheros

`public/login.html` · `tests/scrum264-copy-que-llega-al-cliente.test.mjs` (ampliado a tabla de 4
superficies, +cobertura derivada del handler, +el `catch`) ·
`tests/scrum275-message-en-superficie-publica.test.mjs` (nuevo, el trinquete).
