# SCRUM-849 · Handlers de ESCRITURA que se saltan el filtro de acceso que su hermano de LECTURA sí aplica

**Fecha:** 15-sep-2026 · **Carril:** control de acceso (rol, dentro del mismo merchant) · **Gate:** medición + arreglo + guard

**Medido contra:** `origin/main` = `7bae70d0e15c18326b19cb75d23b5d47b5110402` · 2026-09-15T08:30:21Z
**Rama:** `scrum-849-escritura-sin-filtro-de-rol` · **Preámbulo (A1):** `prisma generate` rc=0 ·
`git rev-list --count HEAD..origin/main` = **0** al ramificar · árbol limpio.

> ⚠️ **`main` se movió DURANTE la tanda, y encima DONDE YO TOCO** (norma A4): SCRUM-841 entró por
> auto-merge y cambió `albaranes.routes.ts`, uno de mis dos ficheros. Se trajo con
> `git merge origin/main` dentro de la rama y se comprobó que **no se perdió trabajo en silencio**:
> el filtro de `findAlbaran` (849) y el escritor `datosDeAlbaranEmitido` (841) conviven en el
> fichero, cada uno con su import, y `npm run build` sigue en rc=0. Un merge sin conflictos no es
> un merge correcto hasta que se mira.

> Nace del **hallazgo de rebote de SCRUM-841**, que lo reportó sin arreglarlo (norma A7: un
> hallazgo de otro carril se reporta). Rama NUEVA desde `origin/main`, sin colgar de la 841.

---

## 1 · La pregunta que decidía el tamaño, y su número

**¿Era sólo `/emitir`, o un patrón?** Censo por AST sobre **los 221 handlers de `src/`**, no sólo
sobre el fichero del hallazgo.

### 🔴 NUEVE handlers de escritura comprobaban menos que su propia lectura

| fichero | handlers |
|---|---|
| `albaranes.routes.ts` | `PATCH /:id` · `POST /:id/emitir` · `/duplicar` · `/firmar` · `/fotos` · `/enviar-whatsapp` · `/enviar-para-firmar` |
| `jobs.routes.ts` | `PATCH /:id` · `POST /:id/albaranes` |

Más **4 exentos legítimos**, todos con `requireRole('admin')` (`facturar-parcial`,
`convertir-en-factura`, `collect-rest`, `consolidar-albaranes`): con el rol ya cerrado, el filtro
row-level no añade nada.

**El daño, dicho corriendo:** `GET /admin/albaranes/:id` devolvía **404** sobre la obra de otro
técnico —eso lo cerró SCRUM-467— y `POST /admin/albaranes/:id/firmar` sobre **ese mismo id**
funcionaba. **Se podía firmar un albarán que no se podía ni abrir.**

### Y dos LECTURAS que tampoco comprobaban (hallazgo de rebote de éste)

`GET /:id/pdf` y `GET /:id/fotos` de albaranes pasan por el mismo helper y tampoco filtraban: el
PDF lleva dentro el nombre del cliente y la dirección de la obra, que es exactamente lo que
SCRUM-467 cerró en `GET /:id`. **Quedan cerradas por el mismo arreglo**, sin coste añadido.

---

## 2 · 🔴 EL INSTRUMENTO TUVO CUATRO VERSIONES MAL, Y DOS DE ELLAS OCULTABAN CASOS

Se deja escrito porque en un guard de acceso el modo de fallo que importa no es el ruido: es el
silencio. Cada versión se descartó por una medición, no por opinión.

| v | qué contaba mal | efecto |
|---|---|---|
| v1 | emparejaba por path sin mirar `requireRole` ni las creaciones | **14**, inflado |
| v2 | eximía si el nombre `teamMemberId` **aparecía** en el cuerpo | 🔴 **ocultó 2 casos reales** — el identificador venía del AuditLog y del gate por campo |
| v3 | contaba el gate **por CAMPO** (`if (!seesAllJobs(…)) … 403`) como pertenencia | 🔴 **ocultó `PATCH /admin/jobs/:id`** |
| v4 | exigía la identidad en el *test* del `if` | perdió el `GET` de albaranes, donde vive en `const suyo = …` |
| **v5** | sigue la indirección por variables **y por auxiliares del fichero** | **9**, y coincide con la lectura manual |

**Un nombre que aparece no es una comprobación**, y comparar el ROL con campos del body no es
comparar el RECURSO con quien llama. Las dos sondas —lectura a mano y AST v5— dan la misma lista
de nueve; cuando discrepaban, la discrepancia fue el dato.

### La definición que quedó

> Un handler **comprueba pertenencia** si existe un `if` que CORTA con 401/403/404 y cuyo test
> depende —directa o transitivamente— de una comparación con `req.teamMemberId`, la identidad de
> quien llama.

---

## 3 · El arreglo: un punto, no nueve parches

**`findAlbaran` era la puerta de ONCE handlers** de `/admin/albaranes/:id` y sólo filtraba por
merchant. La comprobación va **ahí**: once copias de un filtro de acceso divergen, y la que se
queda atrás no da error — **da acceso**. Un handler nuevo que use `findAlbaran` nace protegido.

`src/modules/jobs/domain/accesoAlTrabajo.ts` (nuevo) tiene el criterio una vez: los **tres ejes**
de SCRUM-467 + SCRUM-650 (`operarioId`, `assignedUserId`, `assignees`), `teamMemberId` nulo →
`false` (lado seguro), y sin comparar `null === null` —dos trabajos sin operario harían dueño a
cualquiera que tampoco lo tenga—.

En `jobs.routes.ts` los dos handlers reciben la comprobación de **su propia lectura**: un eje,
`operarioId`. **No** los tres de albaranes, porque eso dejaría la escritura **más abierta** que su
lectura — el mismo defecto con el signo cambiado.

### ⚠️ Por qué el criterio queda escrito DOS veces, a propósito

El guard de SCRUM-467 (`tests/scrum467-tecnico-ve-lo-suyo.test.mjs`) exige **por texto** que
`GET /admin/albaranes/:id` contenga `job.operarioId === req.teamMemberId` y
`job.assignedUserId === req.teamMemberId`. Sustituir esas líneas por una llamada al helper lo
pondría en rojo **sin que la garantía cambiara**, y un guard en rojo se arregla cambiando el
código, nunca lo que el guard exige (norma A7). Así que se baja un escalón —duplicar— **por
imposibilidad medida**, y la divergencia la vigila el control ⑥ **por comportamiento**, no por
texto.

---

## 4 · El guard, que es lo que de verdad se entrega

`tests/_acceso-lectura-escritura.mjs` (instrumento) + `tests/scrum849-escritura-no-afloja.test.mjs`
(6 controles). **Derivado del árbol entero, cada vez.** No hay lista de rutas escrita a mano: una
lista caduca el día que alguien añade la décima, y no da error — da acceso.

| # | control |
|---|---|
| ① | **SUELO**: si no viera ningún handler con filtro, se declara **CIEGO**. Cero no es «está limpio» |
| ② | 🔴 **el que decide**: ninguna escritura comprueba menos que la lectura de su recurso |
| ③ | 🔴 **rojo por mecanismo**: sin testigo de lectura no se reporta; con desnivel, sí — y con coordenadas |
| ④ | **control negativo**: no confunde el gate por CAMPO, ni un `teamMemberId` de traza, ni un corte con 409 |
| ⑤ | **indirección**: reconoce la comprobación hecha en un auxiliar del fichero |
| ⑥ | **los ejes se derivan**: lectura y escritura miran los mismos |
| ⑦ | 🔴 **corriendo**: un técnico ajeno recibe **404** al emitir el albarán de otra obra, y el **dueño sigue pudiendo** |

**⑦ es el que convierte esto en una garantía y no en una inspección.** Un guard por AST dice que
la línea está, no que funcione. Se invoca el handler REAL con `prisma` de doble: el técnico ajeno
recibe 404 y **no llega ninguna escritura a la base**; el dueño recibe 200 y escribe. Sin la
segunda mitad, un filtro que devolviera 404 a todo el mundo también pasaría — y eso no es cerrar
un agujero, es romper el trabajo de campo.

### 🔴 EL ROJO, sobre el árbol real

Quitado el filtro de `findAlbaran`, ② cae **nombrando fichero, línea y el testigo**:

```
not ok 2 - SCRUM-849 · 🔴 ② ninguna ESCRITURA comprueba menos que la LECTURA de su recurso
      src/modules/jobs/app/routes/albaranes.routes.ts:577  PATCH /:id
          su lectura SÍ comprueba: GET /:id (src/modules/jobs/app/routes/albaranes.routes.ts:770)
      src/modules/jobs/app/routes/albaranes.routes.ts:862  POST /:id/emitir
      src/modules/jobs/app/routes/albaranes.routes.ts:918  POST /:id/firmar
      [...7 en total]
```

Fuente **restaurada byte a byte** (`Buffer.compare === 0`, 84652 = 84652).

Y el rojo de ⑥: añadido al helper un eje (`supervisorId`) que el `GET` no mira, cae nombrándolo
— *«el helper mira el eje `supervisorId` y el GET de albaranes NO»*. Restaurado byte a byte
(4864 = 4864).

### Dos correcciones propias (norma A9)

1. **El guard dio rojo sobre código correcto.** Su primera versión no veía el corte
   `res.status(found.status)`, que es como los once handlers reenvían la decisión del auxiliar.
   Un guard que obliga a copiar la comprobación once veces empuja justo a lo contrario de lo que
   hay que hacer. Se afinó `corta()` **sin** aflojar ④, que sigue rechazando el 409 y el
   `teamMemberId` de traza.
2. **Exporté una constante `EJES_DE_PERTENENCIA` y el censo de SCRUM-411 se puso rojo con razón**
   (241 medidos contra 240 declarados): no la usaba nadie en producción, sólo su test. La deuda
   **se quita, no se declara** — y además una lista al lado de la función es una **segunda**
   fuente que puede quedarse atrás mintiendo que todo cuadra. Los ejes se derivan ahora del
   **cuerpo** de `esSuyoElTrabajo` por AST. SCRUM-411 vuelve a **25/0**.
3. **El cambio tumbó 6 tests ajenos y propios**, y no se vio hasta la suite completa: 2 de
   SCRUM-302 (duplicar) y 4 de SCRUM-841. **Causa medida:** sus `req` de doble no llevaban
   `userRole`, y `seesAllJobs` es un **allowlist fail-closed** — un rol ausente cae del lado
   restringido, así que `findAlbaran` devolvía 404.
   **Lo que NO se hizo:** relajar el filtro para que los tests pasaran. Un `req` real **siempre**
   trae `userRole` (lo inyecta `requireAuth`), así que **el doble era lo irreal**: se le añadió el
   rol, con el motivo escrito dentro de cada fichero. El código de producción no se tocó.
   ⚠️ **Y el primer `npm test` de esta tanda dijo `exit code 0` con un test en rojo**, porque iba
   con `| tail`: el pipe devuelve el código del `tail`, no el de la suite. La segunda vez se corrió
   redirigiendo a fichero y mirando `rc`.
4. **Dejé `tests/scrum302-duplicar.test.mjs` con 305 CRLF en el disco** y lo cazó el guard de
   SCRUM-533. El blob estaba **limpio** y `.gitattributes` promete `*.mjs text eol=lf`: era la
   discrepancia **disco/blob** de `core.autocrlf=true`. Las únicas tres líneas en LF del fichero
   eran las mías, o sea que el CRLF ya estaba en disco y **tocarlo lo metió en el censo del
   guard**. Normalizado a LF (17440 → 17135 bytes, CR 305 → 0), test en 9/9.
   ⚠️ **Y `grep -c $'\r'` MINTIÓ las dos veces que lo usé**: dijo `0` sobre este fichero cuando
   tenía 305 CR. Los finales de línea se miden **sobre bytes, con Node**, nunca con el `grep` del
   shell. (Por lo mismo, la comprobación de CRLF que se pegó en `docs/master/SCRUM-841.md` §3 no
   vale como medición: su conclusión —que no había mezcla— la sostiene el `git diff --stat` de
   34 líneas, no aquel `grep`.)

---

## 5 · Lo que este PR **NO** hace

1. **No relaja ningún GET.** Se subió el que faltaba, en los nueve.
2. **No sustituye a la regla 2.** Filtrar por `req.merchantId` es otra cosa —de qué negocio es la
   fila— y se sigue vigilando donde se vigilaba. Esto es ADEMÁS.
3. **Ni un estado, ni un flag, ni una dependencia, ni un texto de usuario nuevos** (reglas 27/30/36).
4. **No toca `prisma/schema.prisma`** ni el camino de emisión fiscal.

---

## 6 · Hallazgos que se REPORTAN y no se arreglan (norma A7)

### 6.1 · `SCRUM-822` casa «404» contra el NÚMERO DE PUERTO

`tests/scrum329-legal-pagina-publica.test.mjs` afirma que «no pude conectar» no se cuenta como
404, y lo comprueba con `assert.doesNotMatch(mensaje, /404/)` sobre un texto que incluye el
**puerto efímero**. Cayó en esta tanda con:

```
'/privacidad → sin respuesta (connect ECONNREFUSED 127.0.0.1:54047)'
```

**El puerto era `54047`, que contiene `404`.** El guard que existe para distinguir «no hay
respuesta» de «404» se confunde con una subcadena del puerto — *un prefijo no es un nombre, y una
subcadena tampoco* (A10). Medido: **3 de 3 en verde** al correrlo aislado, así que es flake, no un
defecto de este PR. No se toca porque es otro carril: el arreglo es anclar la expresión (`\b404\b`
o mirar el código de estado recibido, no el texto).

### 6.2 · La lectura de `Job` y la de sus albaranes no usan los mismos ejes

**La lectura de `Job` y la de sus albaranes no usan los mismos ejes.** `GET /admin/jobs/:id` mira
sólo `operarioId`; `GET /admin/albaranes` y la precarga miran los **tres**. Consecuencia: un
técnico asignado por `assignedUserId` o por la tabla ve los partes de una obra cuyo Trabajo no
puede abrir — y, tras este PR, tampoco puede editarlo.

**No se toca aquí porque igualar eso es decidir política de producto**, no cerrar un agujero: hay
que elegir si `GET /admin/jobs/:id` sube a tres ejes (y entonces el técnico asignado recupera su
Trabajo) o si el reparto del equipo no da acceso al Trabajo. Este PR sólo garantiza que **escribir
nunca sea más fácil que leer**, que es el invariante que faltaba.

---

## 7 · Verificación

- `npm run build` rc=0
- `node --test --test-reporter=tap tests/scrum849-escritura-no-afloja.test.mjs` → **6 pass, 0 fail, `# skipped 0`**
- `npm test` → pegado en el PR
- `npm run guards:entrada` → pegado en el PR
- **Nada ejecutado contra producción ni contra staging**, ni con `--dry-run`.

## 8 · Documentos consultados

`docs/YAQU_MASTER.md` (Parte I, reglas 2/27/30/36) · `docs/equipo/00-normas-comunes.md` (A1, A2,
A4, A7, A16) · `docs/master/SCRUM-841.md` · `src/core/http/roleCapabilities.ts` ·
`src/core/http/adminRouteDeclarations.ts` · `tests/scrum467-tecnico-ve-lo-suyo.test.mjs`
