# SCRUM-615 · `tipoDestinatario` fija un plazo legal, está en NULL en el 100 %, y con NULL se aplica PARTICULAR implícito

**Fecha:** 24-ago-2026 · **Carril:** B · **Gate:** PROPÓN Y PARA — los puntos 3 y 4 son decisión del fundador
**Medido contra:** `origin/main` = `61d35a741e92c0e987d70bc7dba5a0a8302a5630` · 2026-08-24T14:00:00+02:00
**Tanda:** 4028 tests, 3951 pass, 0 fail, 77 skipped — **todos con su gate declarado**: 65 `QA_DB_TEST`, 9 `LIBRO_PG_URL`, 1 `BOT_SUITE_TEST`, 1 `A55_DB_TEST`, 1 por `EPERM` al crear un enlace en Windows (su mecanismo lo cubre un control positivo portable que sí corre). Ninguno salta en silencio.

> ⚠️ Esa hora es la del trabajo de esta rama, no una lectura de reloj — criterio R14.
>
> **Por qué el ancla no es el `main` de ahora.** Medí sobre `61d35a74`. Después entró `010c05d3`
> (SCRUM-616). **Comprobado uno a uno: no toca ninguno de los seis ficheros de este censo**
> (`pendientesFacturar.service.ts`, `customerAdmin.ts`, `invoicesView.js`, `albaranes.routes.ts`,
> `schemas.ts`, `schema.prisma`), así que la medición sigue vigente. Se ancla donde se midió.

---

## LA RESPUESTA A LA PREGUNTA ABIERTA

De las tres respuestas posibles que planteaba el ticket —valor por defecto implícito · nadie lo lee
· falla en algún camino— la medida es **la primera**:

> **Con `tipoDestinatario` en NULL se aplica `PARTICULAR`.** No está en la BD (la columna no tiene
> `@default`) ni en el `z.enum`: está **en el código**, en `resolveTipoDestinatario`, y se aplica en
> cada lectura sin dejar rastro.

**No es «nadie lo lee».** La cadena está completa y alcanzable de punta a punta, y llega al píxel.

---

# PUNTO 1 · Quién lee el campo (derivado, no a mano)

Instrumento: `scripts/censo-usos-de-campo.mjs` — **AST, no `grep`**. `x.campo = 1` y `if (x.campo)`
son la misma cadena y cosas opuestas: leer o escribir es una propiedad de la posición en el árbol.

**Las grafías, por donde esto ya falló una vez.** En SCRUM-574 un guard buscaba `tipoDestinatario`
literal y no vio `fieldTipoDestinatario`. Aquí la comparación es por **contención sobre forma
normalizada**, así que ve las tres: `tipo_destinatario` (columna) · `tipoDestinatario` (modelo) ·
`fieldTipoDestinatario` (formulario).

| Comprobación | Resultado |
|---|---|
| **Calibración** (suelo del encargo) — `providerId` | **84 usos · 21 ficheros · 40 lecturas** → el instrumento no está ciego |
| **Control positivo** — los dos escritores que midió S1 | ✅ `customersView.js:297` y `customerDetailView.js:365`, en su línea exacta |
| **Control de grafía** | ✅ ve `fieldTipoDestinatario` |

**Censo de `tipoDestinatario`: 44 usos · 10 ficheros** — 24 lecturas, 6 escrituras, 10 declaraciones,
3 sin clasificar (declarados, no escondidos en el cubo grande).

**En `src/` sólo hay dos ficheros que lo leen, y sólo UNO hace algo con el valor:**

| Fichero | Qué hace |
|---|---|
| `src/modules/jobs/domain/pendientesFacturar.service.ts` | **el único que decide con él** |
| `src/modules/system/customerAdmin.ts:19` | transporte: el `select` que lo trae a la ficha |

> Dos correcciones que el propio instrumento se hizo al calibrarlo, y que van escritas porque
> cambiaban el resultado: **(1)** un literal de cadena sólo cuenta si es un TOKEN, no una frase —
> la contención metía en el censo mensajes de test que *mencionan* `provider_id` en prosa;
> **(2)** `campo: true` es una proyección de Prisma (LEE) y `campo: z.…` es una declaración de
> esquema — las dos salían como ESCRITURA. Se reconocen por la **forma del valor**, no por el
> nombre de la variable.

---

# PUNTO 2 · El hallazgo: hay una segunda regla, y ésa SÍ está declarada y no conectada

La frase del encargo aplica, pero **no al campo** —el campo sí está conectado— sino a su gemela:

`src/modules/jobs/domain/albaranAFactura.ts:106` declara
`export const TIPO_DESTINATARIO_POR_DEFECTO = 'PARTICULAR'`, con su justificación legal escrita
encima (art. 1593 CC, líneas 17-22). **Su propio módulo no la usa.** El censo lo confirma: en ese
fichero sólo aparece en la declaración y en un comentario.

Y el repo **ya lo sabía**: está en el registro de huérfanos desde el 12-ago-2026
(`tests/_huerfanos-declarados.mjs:348-351`), con este motivo textual:

> «El destinatario por defecto al pasar albarán a factura; **hoy solo lo lee su test**.»

**Es una carga fiscal DECLARADA PERO NO CONECTADA** — «construido ≠ alcanzable». Y hay algo peor
que estar muerta: son **dos copias de la misma regla fiscal**, una viva y otra no, y dos sitios
donde divergir el día que alguien cambie una. Por eso este ticket deja un trinquete sobre la lista
de lectores (probado en rojo).

---

# PUNTO 3 · LA PROPUESTA SOBRE EL NULL — *propón y para*

## a) El censo

| Base | Clientes | `NULL` | `PARTICULAR` | `EMPRESARIO` |
|---|---|---|---|---|
| `acela/railway` (STAGING) | 4 | **4 · 100,0 %** | 0 | 0 |
| `acela/yaqu_dev_javier` (DEV) | 11 | **11 · 100,0 %** | 0 | 0 |
| **TOTAL medible** | **15** | **15 · 100,0 %** | **0** | **0** |

**🕳️ HUECO DECLARADO — producción NO está medida y no puede medirse desde aquí.** No existe
`DATABASE_URL` en un árbol de trabajo (regla 3) y ninguna sesión recibe esa credencial. **No se
estima.** El porcentaje de arriba es de las dos bases medibles, no del producto.

### El número que cambia el marco de la decisión

| | |
|---|---|
| Clientes que **hoy** aparecen en la bandeja «Pendientes de facturar» | **0** (STAGING 0/4 · DEV 0/11) |
| Grupos cliente×mes en la bandeja | **0** · rojo 0 · ámbar 0 |

Medido **llamando al código real** (`getPendientesFacturar`), no reinventando su criterio — una
consulta reinventada mide otra cosa y se lee como si midiera ésta.

> 🔴 **El defecto es REAL como mecanismo y HOY está LATENTE, no activo.** Se activa la primera vez
> que un profesional firma un parte de trabajo valorado y no lo factura. Se dice así, sin inflarlo
> ni desinflarlo: no hay nadie sufriéndolo ahora mismo **en las bases medibles**, y en producción
> **no se sabe**.

## b) La cadena completa, para leerla sin abrir el repo

```
① public/dashboard/js/invoicesView.js:89
     fetch('/admin/albaranes/pendientes-facturar')
                    ↓
② src/app.ts:510            mountAdmin(app, '/admin/albaranes', albaranesRouter)
                    ↓
③ src/modules/jobs/app/routes/albaranes.routes.ts:181
     const clientes = await getPendientesFacturar(req.merchantId!, prisma)
                    ↓
④ src/modules/jobs/domain/pendientesFacturar.service.ts:179
     select: { …, tipoDestinatario: true, … }        ← el dato sale de la BD (aquí, NULL)
                    ↓
⑤ pendientesFacturar.service.ts:188 → :18-19
     const tipo = resolveTipoDestinatario(customer ?? {})
     return customer.tipoDestinatario === 'EMPRESARIO' ? 'EMPRESARIO' : 'PARTICULAR'
     ⇒ 🔴 AQUÍ NULL SE CONVIERTE EN «PARTICULAR». Es el implícito, y no deja rastro.
                    ↓
⑥ pendientesFacturar.service.ts:199 → :28-32
     fechaLimiteRecapitulativa(mesKey, tipo)
       PARTICULAR → new Date(y, m, 0)    = último día del mes
       EMPRESARIO → new Date(y, m, 16)   = día 16 del mes SIGUIENTE
                    ↓
⑦ pendientesFacturar.service.ts:200 → :51-58
     calcularSemaforo(fechaLimite, hoy)     rojo <0 días · ámbar 0-5 · verde >5
                    ↓
⑧ invoicesView.js:520   SEMAFORO_META[grupo.semaforo]      ← EL PÍXEL: color y rótulo
   invoicesView.js:571   if (grupo.semaforo === 'rojo') …   ← el bloque de «vencido»
   invoicesView.js:608   badge = nº de grupos con semáforo ≠ verde
   invoicesView.js:628   orden = { rojo:0, ambar:1, verde:2 }  ← lo urgente arriba
```

**La consecuencia, medida y fijada en `tests/scrum615-plazo-con-null.test.mjs`:** para un cliente
que de verdad sea EMPRESARIO pero esté sin clasificar —hoy **los 15**— YaQu pinta **ROJO**, que
significa «plazo YA vencido», durante **16 días**: del 1 al 16 del mes siguiente. En ese tramo el
plazo legal **no ha vencido**.

El sentido del error es el prudente y está razonado en el código: PARTICULAR es el plazo **más
corto**, así que YaQu nunca dice que llegas a tiempo cuando ya no llegas. Pero lo que se ve en
pantalla es **una afirmación sobre un plazo legal derivada de un dato que nadie ha rellenado nunca**.

## c) Las salidas

Cinco. Las tres del encargo y dos más que aparecieron al medir. **No elijo yo**: cada una con a
quién afecta, cuántos registros y qué se rompe.

---

### A · Quitar el implícito: con NULL no se pinta semáforo

**A quién afecta:** a **los 15** (100 %) y a todo cliente futuro sin clasificar.
**Registros que se tocarían:** 0 — no hay migración.

**¿Qué ve el pro entonces?** Ésa es la pregunta que hay que responder antes que nada, y hoy no
tiene respuesta en el máster: el grupo tendría que aparecer en la bandeja **sin plazo**. Eso exige
un cuarto valor de semáforo, o un estado «sin plazo calculable». **Es un ESTADO NUEVO (regla 27) →
cambio de máster, no decisión de este ticket.**

**🔴 Qué se rompe, medido:**

| Sitio | Qué pasa con un cuarto valor |
|---|---|
| `pendientesFacturar.service.ts:14` | `type Semaforo = 'verde'\|'ambar'\|'rojo'` — unión **cerrada**: no compila |
| `invoicesView.js:520` | `SEMAFORO_META[x] \|\| SEMAFORO_META.verde` → **cae en VERDE**. Un plazo incalculable se pintaría «todo bien»: el peor destino posible |
| `invoicesView.js:608` | el badge cuenta `≠ 'verde'` → contaría como **urgente**… mientras la tarjeta lo pinta verde. Contradictorio |
| `invoicesView.js:628` | `orden[x]` → `undefined` → comparador `NaN` → orden indefinido |

**A favor:** es la única salida en la que YaQu **deja de afirmar una fecha legal que no puede saber**.
**Coste real:** no es «quitar un default»; es rediseñar el semáforo. Ranuras nuevas: `[copy: fundador]`.

---

### B · Clasificar en migración

**🔴 Medido: NO HAY CRITERIO DISPONIBLE.** Los únicos campos que podrían servir de señal están
vacíos en el 100 % de las filas:

| Señal candidata | Filas que la tienen |
|---|---|
| `legalName` (razón social) | **0 de 15** |
| `taxId` (NIF/CIF) | **0 de 15** |

**A quién afecta:** a nadie, porque **no clasificaría a nadie**: los 15 caerían en «no clasificable».
Que es exactamente la pregunta del encargo —«¿qué pasa con los que no se puedan clasificar?»— con
la respuesta **todos**.

**Y aunque tuvieran esos campos, no valdrían.** Tener razón social es **forma jurídica**; el plazo
depende de la **capacidad fiscal**. Un autónomo no tiene razón social y es EMPRESARIO. Derivar uno
del otro es la conflación que SCRUM-574 descartó y que el fundador prohibió expresamente — y ahora
sería aún más tentador, porque `contact_kind` ya existe al lado.

**Qué se rompe:** escribir `PARTICULAR` o `EMPRESARIO` en 15 filas sin saber cuál son es **escribir
un dato fiscal inventado**, y encima destruiría la distinción que la columna mantiene a propósito
(`NULL` = nunca clasificado ≠ clasificado como particular).
**Recomendación sobre esta salida: descartarla.** No por gusto: por falta de criterio medido.

---

### C · Dejarlo y avisar en pantalla

**A quién afecta:** sólo a quien vea la bandeja — hoy **0 clientes** en las bases medibles.
**Registros que se tocarían:** 0.
**Qué se rompe:** nada. El mecanismo se queda igual.
**Coste:** **1 ranura nueva** `[copy: fundador]`, en la tarjeta del grupo (`invoicesView.js:520-571`).

**La objeción honesta:** un aviso **no arregla el rojo falso, sólo lo explica**. El pro sigue viendo
«vencido» sobre un plazo vivo; ahora con una nota al lado. Y hay precedente en contra en el propio
máster: SCRUM-294-a decidió que **el dato se pide, no se explica** — decirle al profesional a qué
régimen pertenece su cliente es asesorarle.

---

### D · Pedir el dato en el momento en que importa *(no estaba en la lista; aparece al medir)*

Ni migración, ni obligatorio en el alta. **Cuando un cliente ENTRA en la bandeja** —que es el único
momento en que este dato cambia algo— se le pregunta ahí, una vez.

**A quién afecta:** sólo a los clientes que llegan a tener parte firmado sin facturar. **Hoy 0**, y
por eso es barato hacerlo ahora: no hay cola acumulada.
**Registros que se tocarían:** 0 en migración. Se rellenan **de uno en uno y por su dueño**, que es
la única forma de que el dato sea verdad.
**Qué se rompe:** nada del mecanismo; el implícito sigue de red mientras el pro no conteste.
**Coste:** 1 ranura `[copy: fundador]` + un punto de entrada en la bandeja.

**⚠️ Cambia una decisión ya tomada, y por eso es del fundador:** SCRUM-69 decidió el 23-jul-2026
«sin banner ni prompt forzado — solo en la ficha». Esto sería un prompt **contextual**, no forzado,
pero es una revisión de esa decisión y no se hace sin GO.

---

### E · Campo obligatorio en el alta

**A quién afecta:** sólo a clientes **futuros**.
**Registros que se tocarían:** 0 — **y ahí está el problema: los 15 de hoy siguen en NULL.** No
resuelve el caso que abrió el ticket.
**Qué se rompe:** añade fricción obligatoria al alta, y «presupuesto en 30 segundos» es la promesa
del producto. Además hace que el profesional declare un régimen fiscal **en el peor momento**:
cuando sólo quiere apuntar un nombre y un teléfono.

---

## Recomendación

**D, y C como acompañante si el fundador quiere red mientras tanto.**

Por qué D: es la única que consigue que el dato **sea verdad** —lo rellena quien lo sabe, en el
momento en que importa— sin escribir nada inventado, sin migración, sin estado nuevo y sin tocar el
alta. Y hoy es cuando más barato sale: **0 clientes en cola**.

Por qué **no A**, aun siendo la más correcta en el fondo: tiene razón en que YaQu no debería afirmar
una fecha que no sabe, pero su coste real no es quitar un default — es **rediseñar el semáforo y
abrir un estado nuevo**, con cuatro puntos de rotura medidos. Es un ticket propio, no un remate de
éste. **Si el fundador prioriza dejar de afirmar por encima de todo, A es la respuesta correcta y
lo digo aunque cueste más.**

**No ejecuto ninguna.** El punto 3 es propón y para.

---

# PUNTO 4 · Las ranuras de texto — *sin escribirlas*

Forma de SCRUM-600. **Derivado del árbol**, acotado al bloque del campo (el primer barrido coló
`"No consta"`, que es del select de *recargo de equivalencia* y comparte el `value=""`; corregido).

| | |
|---|---|
| Ranuras **visibles** del campo | **8** |
| Textos **distintos** | **4** — cada uno sirve a **2 sitios** |
| 🔴 **Decisiones para el fundador** | **4** |

| # | Texto de hoy | Dónde | Qué tiene que hacer entender |
|---|---|---|---|
| 1 | `Tipo de cliente` | `customersView.js:167` · `customerDetailView.js:312` | que esto **fija una fecha límite legal**, no clasifica |
| 2 | `Sin clasificar` | `customersView.js:172` · `customerDetailView.js:314` | que **no es neutro**: hoy se calcula como particular |
| 3 | `Particular` | `customersView.js:173` · `customerDetailView.js:315` | el plazo que implica |
| 4 | `Empresa / profesional` | `customersView.js:174` · `customerDetailView.js:316` | el plazo que implica · **ojo**: un autónomo va aquí y **no** es «empresa» en `contact_kind` |

**Las 8 superficies colapsan en 4 decisiones** porque los dos formularios repiten los mismos cuatro
textos. Aprobar cuatro los apaga los ocho.

### Una decisión que va POR DELANTE de las cuatro

**¿Existe una quinta ranura que explique la consecuencia** (que este campo mueve el plazo)? Hoy **no
existe** — el campo va sin explicación. Es la misma forma que SCRUM-600 marcó como *«primero se
decide si el bloque aplica»*: si la respuesta es no, no hay texto que escribir; si es sí, son 5
decisiones y no 4. **Y choca de frente con SCRUM-294-a** («el dato se pide, no se explica»), así que
no la doy por buena por mi cuenta.

### Dependencia con el punto 3

El recuento de arriba es **el del estado de hoy**. Cada salida lo mueve: **A** añade la ranura de
«sin plazo calculable» (y su cuarto estado) · **C** añade la del aviso en la tarjeta · **D** añade la
de la pregunta contextual. **B y E** no añaden ninguna. Se dice para que nadie lea «4» como el número
final: **4 es lo que hay que decidir aunque no se cambie nada más**.

**Ni una palabra de copy escrita** (regla 30). Todo lo de arriba es `[copy: fundador]`.

---

## Verificado en rojo

Sobre el commit `f73749cc`, revirtiendo **byte a byte contra los BYTES DE DISCO** guardados antes de
tocar (`Buffer.compare = 0` en los dos ficheros) — no contra el blob: `npm run cr:tecnica` clasifica
los dos como **CASO B, normalizados**.

| Rotura inyectada | Resultado |
|---|---|
| El implícito cambia de lado (`PARTICULAR` → `EMPRESARIO`) | ✔ caen 4 tests, nombrando el defecto y la ventana |
| El censo busca el nombre **exacto** (el fallo de SCRUM-574) | ✔ cae: «NO VE `fieldTipoDestinatario`» |
| Aparece una **segunda copia** de la regla en `src/` | ✔ cae: «HA CAMBIADO QUIÉN LEE UN CAMPO CON CARGA FISCAL» |

## Lo que NO cubre

* **No se ha escrito nada en ninguna fila.** Ni un valor por defecto, ni el `z.enum`, ni el schema.
* **Producción sin medir**, y declarado como hueco, no estimado.
* **Ninguna de las cinco salidas está ejecutada.** Propón y para.
* **`albaranAFactura.ts` no se toca:** su regla huérfana se reporta; cablearla o borrarla es una
  decisión fiscal con su propio ticket.
* **Cero microcopy.**
* **El trinquete de lectores vigila `src/`, no `public/`.** Es deliberado —el front no decide
  plazos— pero significa que una copia de la regla en el navegador no lo haría caer.

---

# APÉNDICE · 24-ago-2026 · EJECUTADAS LAS SALIDAS D y C

**Decisión del fundador:** adelante con **D** (pedir el tipo cuando el cliente entra en la bandeja)
y **C** (aviso de red mientras el dato no esté). **A** queda descartada de la cola ejecutable: abre
un estado nuevo del semáforo (regla 27) y exige antes **SCRUM-622** — sin arreglar el
`|| SEMAFORO_META.verde` de `invoicesView.js:520`, quitar el implícito no deja de mentir:
**miente en verde**.

## Qué se construyó

| Pieza | Dónde |
|---|---|
| El dato que faltaba | `pendientesFacturar.service.ts` → `tipoDestinatarioDeclarado` en el DTO |
| La regla + el bloque | `public/dashboard/js/tipoDestinatarioPendiente.js` (nuevo) |
| El cableado | `invoicesView.js`, en `renderGrupoCard`, debajo del importe |

**Por qué hacía falta un campo nuevo en el DTO:** sólo se exponía el tipo **resuelto**, y con el
resuelto el front **no puede distinguir «es un particular» de «nadie lo ha dicho»** — justo la
distinción que hace falta para poder preguntar. No es información nueva: el valor crudo ya se
expone en `GET /admin/customers`; esta respuesta era la única que lo pisaba.

🔴 **`resolveTipoDestinatario` NO SE TOCA.** Sigue siendo la red que da el plazo corto mientras
nadie conteste. D la **vacía de casos**, no la borra.

## 🔴 Corrección de una cifra mía: la subida del censo es +1, no +2

Declaré «+2» contando **superficies**. El censo de SCRUM-402 cuenta **marcas**: una sola constante
`MARCADOR`, una entrada — igual que `NF_PENDIENTE` contaba 1 pintando veintidós. Mi segundo
marcador no es un literal nuevo: es una **referencia** a la misma constante desde `invoicesView`,
así que el AST no lo cuenta aparte, y hace bien.

> **La cifra correcta: +1 MARCA · 2 SUPERFICIES** (el aviso de C · el error de guardado).
>
> Y una consecuencia que va escrita en el propio censo: **aprobar UN texto NO apaga las dos.** Son
> dos textos distintos que hoy comparten marcador; el día que el fundador los escriba habrá que
> partir la constante. Decir «se apagan de golpe» aquí sería falso.

## El censo de ranuras, actualizado

| | Antes | Ahora |
|---|---|---|
| Ranuras visibles del campo | 8 | **12** — el mismo campo se pinta en un **tercer** sitio |
| Textos distintos del campo | 4 | **4** (reutilizados **verbatim**) |
| Decisiones de copy del campo | 4 | **4** — cada una sirve ahora a **3** sitios |
| Ranuras nuevas de este ticket | — | **+2 superficies / +1 marca** |
| **🔴 Decisiones totales para el fundador** | **4** | **6** |

Las dos nuevas: **(5)** el aviso de C · **(6)** el error de guardado. Ésta última no reutiliza el
mensaje de carga que ya existe porque aquel dice «no se han podido **CARGAR**» y aquí lo que falla
es **guardar**: enseñarlo sería un texto que no describe lo que pasó.

**La QUINTA pregunta que quedó abierta sigue abierta y NO se ha construido:** si debe existir una
ranura que explique, *en el formulario*, que este campo mueve un plazo. Choca con SCRUM-294-a («el
dato se pide, no se explica») y va con las demás. Sería la **séptima** decisión, no la quinta —
el número cambió al entrar las dos de arriba.

## Verificado en rojo

Sobre `80381c63`, revirtiendo **byte a byte contra los bytes de disco** (`Buffer.compare = 0`).

| Rotura inyectada | Resultado |
|---|---|
| Mirar el tipo **resuelto** en vez del **declarado** | ✔ caen 7, incluido el que nombra el defecto |
| El bloque se pinta **siempre** (se pierde el sentido negativo) | ✔ caen los dos: «se le está enseñando el aviso a quien YA contestó» y el control negativo |
| Escribir **texto de producto** en vez del marcador | ✔ cae: «TEXTO NUEVO SIN APROBAR en pantalla» |

## Lo que NO cubre

* **A no se ejecuta**, y con ella el `|| SEMAFORO_META.verde` sigue ahí: **SCRUM-622**, anotado y
  no tocado.
* **Ninguna fila se ha escrito.** El dato lo rellena el profesional, de uno en uno.
* **Cero microcopy.** Las dos ranuras nuevas salen **a ciegas** —marcador sin palabra de trabajo—
  a propósito: aquí el copy no es decorado, es lo que el profesional lee para contestar sobre un
  plazo legal.
* **El aviso de C no es utilizable hasta que el fundador lo escriba.** Se dice claro: hoy esa caja
  muestra el marcador.
* **`albaranAFactura.ts` sigue con su regla huérfana**, reportada y sin cablear.

**Tanda final:** 4041 tests, 3964 pass, 0 fail, 77 skipped. `guards:entrada` verde.
**Los 9 guards de navegador verdes** (51,9 s en serie), incluida la pantalla de facturas, que es
la que toca este cambio.
