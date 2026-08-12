# SCRUM-478 · Rescatar la rama gemela — cerrado SIN construir: ya estaba todo

**Fecha:** 12-ago-2026 · **Carril:** infraestructura de envío · **Tipo:** MEDICIÓN (no toca código)

**Medido contra:** `origin/main` = `2794f7415669548b3de4acfe13211ac22773eea3` · 2026-08-12T07:23:16Z

> **Entrega barata de las dos válidas:** los bloques 2 y 3 están vivos en `main`, con fichero y
> línea. No se reconstruye nada. El bloque 1 lo cerró SCRUM-477 y no se vuelve a medir.

## 1 · Lo primero: la rama gemela está ENTERA en `main`

`scrum-475-constancia-correo` (`f2483e9e`) tocaba **9 ficheros**. Comprobados uno a uno contra
`origin/main` —comparando contenido, no nombres—: **los 9 están, evolucionados**. Ninguno se perdió.

| | |
| --- | --- |
| `constanciaCorreo.ts` · `_censo-correo.mjs` · `scrum475-constancia-correo.test.mjs` | en `main` |
| los 5 emisores que ella cableó | en `main` |
| su diff de schema (`EmailMessage`) | **NO aplicado — correcto**: es SCRUM-479 y es del fundador |

## 2 · Bloque 2 · las cuatro salidas mudas — **CERRADO**

Buscado **por contenido**, no por número de ticket. La prueba no es que exista un fichero: es que el
código dice por qué no salió.

| Salida | Dónde vive hoy |
| --- | --- |
| destinatario sin email | `enviarCorreo.ts:146` `resultadoSinDestino()` → `motivo: 'sin_destino'` + constancia |
| — consumida en | `enviarCorreo.ts:155` · `lifecycle:27` · `merchantNotifications:17` y `:133` · `weeklyDigest:19` |
| sin `RESEND_API_KEY` y sin `SMTP_URL` | `enviarCorreo.ts:189` `motivo: 'sin_transporte'` + constancia |
| el envío revienta | `:134` y `:184` `motivo: 'fallo_envio'` + `constanciaDeFallo(e)` |

Y el propio helper lleva escrita la historia del ticket: *«eran cuatro sitios diciendo lo mismo.
Ahora es uno»*.

### 🔴 Lo que lo mantiene cerrado no es un guard: es el compilador

`ResultadoCorreo.constancia` es **obligatorio**. Comprobado por inyección, no por lectura: al quitar
la constancia de UNA salida, `tsc` responde

```
error TS2741: Property 'constancia' is missing in type '{ enviado: false; motivo: "sin_destino"; }'
              but required in type 'ResultadoCorreo'.
```

**Una divergencia imposible gana a una vigilada.** No hace falta guard nuevo, y añadirlo sería un
segundo vigilante del mismo hecho.

## 3 · Bloque 3 · el criterio — **CERRADO**

`src/modules/messaging/domain/constanciaCorreo.ts`, con sus tests vivos en
`tests/scrum475-constancia-correo.test.mjs` (23 tests con los de SCRUM-477, todos en verde):

| Exigencia del encargo | Dónde |
| --- | --- |
| «aceptado» no es «entregado» | `ESTADOS_CORREO` separa `aceptado_sin_confirmacion` de `entregado`; `entregado` solo desde un aviso del proveedor |
| sin identificador se dice, no se guarda `undefined` | `constanciaDeEnvio()` → `aceptado_sin_identificador`; `idDeLaRespuesta()` exige cadena no vacía |
| un rebote no lo tapa ningún aviso posterior | `avanzar()`, y su test: `avanzar('rebotado', 'entregado') === 'rebotado'` |

## 4 · Bloque 1 · muerto, y **el motivo me señala a mí**

No lo re-mido (lo hizo SCRUM-477: **12 con el criterio completo, 8 tras arreglar los cuatro**,
nombrados con fichero y línea en su trinquete). Lo que sí dejo escrito es la parte que me toca:

> **Mi unificación en `enviarCorreo.ts` dejó ciego un guard ajeno sin tocarlo.** El censo de avisos
> que se tragan su fallo pasó de **4 a 0** — y los cuatro seguían ahí. Propagaba solo DENTRO de un
> fichero, y al mover el envío a una función importada dejaron de censarse.

Un refactor **correcto** cegó un guard, y el guard lo cantó como una mejora. Lo cazó alguien leyendo
los cuatro a mano. Hoy ese test lleva su suelo dentro (`total >= 31`) y su comentario lo cuenta.

**Censo de hoy**, con el instrumento de `main`: 17 emisores derivados · 31 llamadas ·
`traga-mudo: 0` · `traga-log: 3` · `ignora-resultado: 8` · `mira-resultado: 17` · `avisa: 3`.

## 5 · 🔴 Y me volvió a pasar en este mismo turno

Escribí un detector de «salidas mudas» para medir el bloque 2. Se **autoprobó bien** contra dos
fixtures sintéticos —veía 2 defectos en el malo y 0 en el bueno— y aun así, contra el árbol real,
cantó **19 salidas mudas** que no lo eran: marcaba como mudas las salidas de ÉXITO
(`enviado: true`), las delegaciones (`return r`) y los `{ ok: true }` de `email.service`.

**La autoprueba pasó y el número seguía siendo basura.** Lo vi porque leí la lista, no el recuento —
y ahí apareció `resultadoSinDestino()`, que es la respuesta del bloque 2.

> Autoprobarse es necesario y **no es suficiente**: un detector puede distinguir el caso que le
> enseñas y clasificar mal todo lo demás. El número se lee entero o no se lee.

## 6 · Lo que NO se ha hecho

Cero código. Cero tests nuevos —los que harían falta ya existen—. `prisma/schema.prisma` intacto
(ninguna tabla: es SCRUM-479). No se ha tocado el control de flujo de los cinco emisores migrados.
Sobre la rama gemela, **solo lectura**.

⚠️ Una cosa que sí hice y deshice: al leerla, un `git show … > tests/_censo-correo.mjs` **sobrescribió
la versión de `main` con la suya, más vieja**. Revertido con `git checkout --` antes de nada más;
`git status` limpio y comprobado. Leer una rama no debería escribir en la mía, y ese redirect lo hizo.

## 7 · Estado del árbol al cerrar

Suite completa en `main`: **3.289 tests · 3.212 pasan · 0 fallos · 77 saltados** (los gateados por BD).
