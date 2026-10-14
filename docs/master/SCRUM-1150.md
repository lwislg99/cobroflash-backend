# SCRUM-1150 · «Crear revisión»: un código por causa, y el diagnóstico al log (la mitad del servidor)

**Medido contra:** `origin/main` = `85d8d01e64196569928b523c9074542d6ffbbd0a` · 2026-10-09T10:09:01Z

A9: comprobación → `tests/scrum1294-a9-leccion-en-a10.test.mjs`

El fallo propio de esta entrega: el primer push de este registro salió SIN la línea de arriba, igual que
el de SCRUM-1188c una hora antes. Lo dijo el check obligatorio de aquél (PR #2328) y se corrigió aquí
antes de que el de éste diera veredicto. `guards:entrada` verde no cubre ese guard: hay que correr el
dirigido.

S1, 9-oct-2026. Es la mitad que el orquestador encargó a S1 en el comentario 18740 del ticket: separar
el código `revisiones_ambiguas` y que la ruta deje de mandar el texto de la excepción. La otra mitad (que
la pantalla decida por el código, con sus textos) es de S2 y de S4 y NO va aquí.

## Qué pasaba

`POST /admin/quotes/:id/revisiones` contestaba `409 { error: 'revisiones_ambiguas', message }` a todo lo
que el dominio lanzara como `RevisionesAmbiguas` o `CensoDeRevisionesCiego`, y `message` era el texto de
la excepción («DOS VIGENTES A LA VEZ: …», «CENSO CIEGO · …»). La pantalla pinta `data.message` cuando
llega (`mensajeParaPersona`), así que el profesional leía el diagnóstico de un programador: ocho líneas a
390 px (medido por S4, comentario 18736).

## Las causas: no eran dos, son cuatro sitios que lanzan

Contado por AST sobre `src/` entero (321 ficheros): cuatro `new` de esas dos clases, los cuatro en
`src/modules/quotes/domain/revision.ts`.

| código nuevo | quién lanza | qué ha pasado | ¿lo alcanza esta ruta? | ¿reintentar lo arregla? |
|---|---|---|---|---|
| `revisiones_dos_vigentes` | `vigenteUnicaDe` (`RevisionesAmbiguas`) | dos filas del grupo tienen la misma revisión más alta | sí | no: son los datos |
| `revisiones_sin_leer` | `vigenteUnicaDe` (`CensoDeRevisionesCiego`) | el grupo llega sin ninguna revisión legible | sí, sólo si el presupuesto se borra entre las dos consultas de la ruta | sí: la siguiente vez contesta `quote_not_found` |
| `revision_no_posterior` | `nuevaRevisionDe` (`RevisionesAmbiguas`) | el número calculado para la nueva no supera al de la que se revisa | por construcción no (el número sale del máximo del grupo); si saliera, es un fallo nuestro | no |
| `revisiones_sin_la_propia` | `revisionesDe` (`CensoDeRevisionesCiego`) | el censo de un presupuesto no lo incluye a él | no: sólo lo llama la lectura (`vistaDeRevisiones`, `GET /admin/quotes/:id`), que no pasa por este `catch` | — |

## Qué cambia

- **El dominio dice la causa.** Las dos clases reciben un `motivo` como primer argumento, de un tipo
  cerrado: lanzar sin decir la causa no compila. Los nombres de clase no cambian.
- **La ruta manda el `motivo` como `error`, sin `message`,** y escribe el diagnóstico en el log con el
  comercio y el presupuesto. El estado sigue siendo 409 en los cuatro: no se ha cambiado ninguno.
- **El código `revisiones_ambiguas` deja de existir.** No lo leía nadie: ni `public/` ni `tests/` lo
  nombraban.

## Qué ve el profesional entre este cambio y la otra mitad

Para estos códigos ya no llega `message`, así que la pantalla cae en el texto general firmado en
SCRUM-688: «No se ha podido crear la revisión. Vuelve a intentarlo.». Para `revisiones_dos_vigentes` ese
«vuelve a intentarlo» no es cierto (reintentar no lo arregla); deja de serlo cuando ese código tenga su
frase firmada y la pantalla decida por el código. Es lo que el comentario 18740 mandó hacer, y sustituye a
ocho líneas de diagnóstico.

## Lo que NO cambia, y se dice

- Los motivos de `RevisionNoCreable` (`quote_not_found`, `quote_sin_numero`,
  `descuento_global_con_varios_iva`) siguen viajando con su `message`. Los dos primeros tienen ya su
  literal firmado para la pantalla (comentario 18740) y los pintará ella por el código.
- `docs/microcopy/2026-09-16-SCRUM-688-crear-revision.md` sigue nombrando `revisiones_ambiguas` entre los
  motivos de los que «se enseña el suyo». Ese registro es del puesto que usa el texto (S2): avisado en el
  ticket, no editado aquí.
- **`revisiones_dos_vigentes` tiene HOY dos orígenes en los datos, y la frase que se le escriba tiene que
  ser cierta para los dos.** Uno es una revisión repetida de verdad. El otro es SCRUM-1490: el grupo se
  arma por (comercio, número) SIN el año de la serie, así que desde el 1-ene-2027 el presupuesto 12 de
  2026 y el 12 de 2027 caen en el mismo grupo como dos originales. Ahí no hay «dos versiones»: hay dos
  presupuestos distintos. El dominio no los puede distinguir (ve dos filas con la misma revisión); deja
  de pasar cuando entre SCRUM-1490, que agrupa con el año. Medido en SCRUM-1444, comentario 18485.
- **Cómo se llega a «dos vigentes» no se ha arreglado.** No hay unicidad en el esquema para
  (comercio, número, revisión), así que dos «Crear revisión» a la vez desde dos pestañas podrían crear el
  empate (la pantalla desactiva el botón al pulsar, pero eso sólo cubre una pestaña). Leído, no
  provocado: probarlo pide una base de verdad y concurrencia de verdad, y cerrarlo pide o un cerrojo en
  la ruta o un índice único, que es esquema.
  *(13-oct-2026: provocado el 9-oct y arreglado con un cerrojo en SCRUM-1150c, al final de este registro.)*

## Pruebas

`tests/scrum1150-un-codigo-por-causa.test.mjs`, 9 casos: la ruta de `dist/` con la base doblada
(`_envio-doblado.mjs`), el dominio, y dos censos de `src/` por AST.

- **Control positivo:** con el código de antes caen 7 de 9. Pasan los dos que tienen que pasar con las
  dos versiones: el suelo (un grupo sano crea la revisión) y el motivo no tocado (`quote_sin_numero`).
- Con el cambio, 9 de 9. Con sus vecinos (`scrum655b`, `scrum655c`, `scrum688`, `scrum887c`, `scrum1215`,
  `scrum988`, `scrum411`, `scrum494`, `scrum1379b`, `scrum1344`, `scrum710b`): 185 pasan, 0 fallan,
  0 saltos, en 12 ficheros.
- ⚠️ El caso de `revision_no_posterior` por la ruta es FABRICADO: una hermana con la revisión ilegible,
  que Postgres no admite (`revision Int` no nulo) y el doble sí.
- **La otra mitad, el censo, existe y recorre `src/` entero:** cada sitio que lanza una de las dos
  clases lleva su código como literal, ninguno lo comparte, y el código viejo no queda como literal en
  ningún fichero. Un quinto sitio lo pone en rojo. No recorre `public/`: allí hoy nadie decide por estos
  códigos.
- 🔴 **Sin `tsc` del proyecto:** había entre 0,5 y 1,5 GB libres. El `dist/` se hizo con
  `ts.transpileModule` (321 de 321 ficheros), que no comprueba tipos. `revision.ts` no importa nada y sí
  pasó un `tsc --noEmit --strict` él solo (salida 0); la ruta no. Los tipos del conjunto los comprueba el
  check obligatorio del PR.

## No visto en yaqu.app, y por qué

Ninguna de las tres causas se puede provocar en producción sin estropear datos (hacen falta dos filas
con la misma revisión) y la herramienta de sesión de la cuenta QA sólo hace `GET`. Lo que se ve en
pantalla lo midió S4 con su sonda (comentario 18736), contestando ella el `POST`.

## SCRUM-1150b · la mitad de la pantalla: «Crear revisión» decide por el código (9-oct, S2)

**Medido contra:** `origin/main` = `44cbb050536158705c423950a76254ad8f1848b4` · 2026-10-09T11:40:48Z

A9: comprobación → `tests/scrum1150b-la-pantalla-decide-por-el-codigo.test.mjs`

El fallo propio de esta entrega: di por bueno que «un `message` humano del servidor se enseña tal cual»
era de otro ticket y no lo miré hasta que mi propio cambio lo contradijo.
`tests/scrum1215-revisiones-error-crear.test.mjs` fijaba para `quote_sin_numero` justo la conducta que
c.18740 firmó cambiar. No se rodea: su tercer caso pasa al único código para el que sigue siendo verdad, con el motivo escrito dentro,
y `quote_sin_numero` queda atado a su literal firmado en el test de arriba.

**Sesión:** S2 (`s2-9oct`, cuarta tanda) · carril: `public/dashboard/js/quoteRevisiones.js` es S2, con
fila propia (`node scripts/carriles.mjs de …`). **Skill UI:** cargada (`yaqu-premium-ui`). Sección
AÑADIDA: lo de S1, arriba, no se toca.

**Qué pasaba.** La pantalla pintaba el `data.message` de cualquier respuesta fallida. S1 quitó el
diagnóstico de los 409 de grupo (arriba), pero la puerta seguía abierta: cualquier `message` nuevo habría
llegado tal cual. Además el aviso no llevaba `role`, y cada fallo colgaba otro párrafo debajo del
anterior (medido: dos fallos, dos avisos).

**Qué cambia, sólo en `quoteRevisiones.js`.**

| código del servidor | lo que se lee | por qué |
|---|---|---|
| `quote_sin_numero` | «No se puede crear una revisión: este presupuesto no tiene número.» | literal firmado, c.18740 |
| `quote_not_found` | «No se puede crear una revisión: este presupuesto ya no existe.» | literal firmado, c.18740 |
| `descuento_global_con_varios_iva` | el `message` del servidor | firmado en SCRUM-887; el único que pasa tal cual |
| `revisiones_dos_vigentes` | el general | 🔴 su frase (c.19098) NO tiene firma; no se pinta hasta que conste |
| `revisiones_sin_leer` · `revision_no_posterior` · `revisiones_sin_la_propia` | el general | c.19085 |
| `invalid_quote_id` · `internal_error` · sin red · cualquier código nuevo | el general | la puerta |

El general es «No se ha podido crear la revisión. Vuelve a intentarlo.» (SCRUM-688). El aviso lleva
`role="alert"`, y el del intento anterior se quita al volver a pulsar: queda uno.

**Desviación declarada, que sigue.** Para `revisiones_dos_vigentes`, «vuelve a intentarlo» no es cierto
(son los datos). Es lo mismo que se lee hoy en producción desde #2330. Deja de serlo cuando se firme su
frase: una fila en `TEXTO_POR_CODIGO`, una en `DECISION` del test y su ficha en `docs/microcopy/`.

**Textos.** Ninguno nuevo sin firma. Ficha:
`docs/microcopy/2026-10-07-SCRUM-1150-crear-revision-por-codigo.md` (firma delegada, comentario 18740). La de SCRUM-688 nombraba `revisiones_ambiguas`, que ya no
existe: lleva una nota fechada debajo; su texto aprobado y su firma no se tocan.

**La otra mitad (pantalla ↔ servidor).** El censo de S1 recorre `src/` y no mira `public/`. El test nuevo
ata los dos árboles por AST: los códigos que la ruta puede contestar (3 `new RevisionNoCreable` de
`quoteAdmin.ts`, los 4 motivos de los dos tipos cerrados de `revision.ts` y los literales de la propia
ruta: 9) son exactamente los decididos en su tabla; y todo código que la pantalla nombra existe en el
servidor, con el literal firmado letra por letra. Un código nuevo en `src/` lo pone en rojo hasta que
alguien decida qué lee el profesional.

### Pruebas de SCRUM-1150b

`tests/scrum1150b-la-pantalla-decide-por-el-codigo.test.mjs`: 16 casos. Catorce por el viaje (ficha en el
banco, clic, `apiRequest` real) y dos de atadura. A cada código se le pone SIEMPRE un `message`: el
firmado donde toca y un diagnóstico de programador en los demás.

- **Control positivo** (`evidencias/SCRUM-1150/salida-1150b-mutantes.txt`; base 16 de 16): con el
  `quoteRevisiones.js` de `main` caen 12 de 16 y deja 2 avisos tras dos fallos; sin `role`, 1; sin quitar
  el aviso anterior, 1; con la puerta abierta, 7; una errata en una clave, 2; una letra de un literal, 3;
  la frase sin firma metida en la tabla, 2; un motivo nuevo en el dominio, 1 (la atadura). Ocho mutantes,
  ocho mueren, cada uno con su `git diff --numstat`.
- **Navegador, sobre yaqu.app** (cuenta QA, presupuesto 206, build `44cbb050`; el `POST` lo contesta la
  sonda, a producción sólo llegan `GET`): 22 filas, 0 rotas, a 390×844 y 1280×800. Con el fichero de la
  rama: los dos literales en 2 líneas (320×40) y 1 línea (938×20), enteros en la ventana; el diagnóstico
  no llega con ningún código; `role=alert` en las 22; dos fallos, un aviso. Con el de producción y el
  mismo `message` puesto: el diagnóstico sale en 9 de 10 códigos (5 líneas, no cabe entero a 390),
  `role=null` en las 22, y dos fallos dejan dos avisos.
- ⚠️ Lo que el «antes» de la sonda NO dice: producción ya no manda ese diagnóstico (#2330). La sonda lo
  pone a propósito para ver si la pantalla lo deja pasar.
- 🔴 **Sin `tsc`** (≈1 GB libre): no se toca `src/`. Los tests que leen `dist/` corrieron con los tres
  `.ts` de `main` transpilados. La suite completa y los tipos, en el obligatorio.

### No visto en yaqu.app

Hasta que la rama entre: `node sondas-s2/revision-error.mjs` sin argumento (copia en
`evidencias/SCRUM-1150/`). Ninguna de las causas se provoca de verdad; lo que se mide es la pantalla de
producción con la respuesta puesta por la sonda.

## SCRUM-1150c · dos «Crear revisión» a la vez ya no crean el empate (13-oct, S1)

**Medido contra:** `origin/main` = `9358f02b14e9648f1ab65fbdacf6464d50728242` · 2026-10-13T10:56:19Z

A9: comprobación → `tests/scrum219-tx-tipado.test.mjs`

(El fallo propio: la primera versión tipaba como `Prisma.TransactionClient` un lector al que se le pasa
el cliente global. Lo paró ese guard antes de empujar, y el arreglo fue el tipo, no el guard.)

### Qué pasaba

`crearRevisionDeQuote` leía la revisión más alta del grupo y creaba la siguiente sin nada que pusiera
las dos cosas en serie. Dos `POST /admin/quotes/:id/revisiones` a la vez leían las dos «la última es
la .0» y las dos escribían la `.1`. Las dos contestaban 201. Desde ese momento la ficha de ese
presupuesto (`GET /admin/quotes/:id`) daba 500 y «Crear revisión» 409 `revisiones_dos_vigentes`, y el
profesional no podía salir de ahí desde el panel.

Hace falta que coincidan dos pulsaciones: dos pestañas, dos dispositivos o dos personas del mismo
negocio (la pantalla desactiva el botón al pulsar, y eso cubre una pestaña).

### Medido antes de tocar nada (PASO 0)

`dist/app.js` por HTTP, sesión de administradora, contra un Postgres 16.4 propio y desechable. Diez
intentos de dos `POST` a la vez sobre un presupuesto sano, y un control con los mismos dos en serie.

| árbol | control en serie | a la vez | ficha después |
|---|---|---|---|
| `main` (`9358f02b1`), 13-oct | `.1` y `.2` | **9 empates de 10** (el 9-oct, 8 de 10) | 500 en los 9 |
| con el arreglo | `.1` y `.2` | **0 empates de 10**: `.1` y `.2` en los diez | 200 en los diez |

Sonda y salidas: `docs/master/evidencias/SCRUM-1150c/` (`sonda-1150-carrera.mjs` y sus dos salidas).
`sonda-1150.mjs` es la del 9-oct que fabrica el empate y mide la ficha en 500; va con ellas.

### Qué cambia

Un fichero de `src/`: `src/modules/system/quoteAdmin.ts`.

- La creación va dentro de una transacción cuya primera sentencia es
  `pg_advisory_xact_lock(1752, negocio)`. El grupo se lee **detrás** del cerrojo, así que la segunda
  petición ve la revisión que acaba de confirmar la primera y escribe la siguiente.
- El espacio `1752` es propio. 1748, 1749 y 1750 son de la emisión y 1751 del tope de WhatsApp: crear
  una revisión no espera a una factura, ni al revés.
- Las puertas se pasan dos veces: antes de abrir la transacción (un rechazo no reserva ni escribe
  nada; `tests/scrum887c-caso-c-bloqueado.test.mjs` cuenta abrir una transacción como escritura) y otra
  vez dentro, sobre lo que se lee con el cerrojo. Es el molde de SCRUM-814 al facturar.
- **No hay ALTER ni cambio de esquema.** No depende de SCRUM-1490.

Lo que contesta la ruta no cambia: los mismos códigos y los mismos estados.

### Lo que NO arregla, y se dice

- **Dos pulsaciones a la vez dejan DOS revisiones** (`.1` y `.2`), las dos válidas. Es lo que ya pasaba
  con dos pulsaciones seguidas. Que la segunda no cree nada pediría que la pantalla mande qué versión
  creía vigente, y eso es otra conducta: no se ha decidido ni construido.
- **Un empate que YA esté en una base sigue dando 500 en la ficha.** Este cambio impide crearlo; no
  repara filas. No se ha mirado si alguna base tiene uno: no hay acceso de lectura a producción desde
  una sesión. Qué contesta la ficha en ese caso es una decisión que sigue abierta en el ticket.
- **El otro origen de `revisiones_dos_vigentes`, el año de la serie, sigue vivo** hasta que entre
  SCRUM-1490 (dos presupuestos de años distintos con el mismo número, desde el 1-ene-2027).
- **No hay segunda red:** `Quote` sigue sin unicidad para (negocio, número, revisión). Un camino nuevo
  que cree revisiones sin pasar por `crearRevisionDeQuote` no tendría cerrojo. El índice único es
  esquema y lo decide el fundador.
- El cerrojo es por negocio, no por número: dos revisiones de presupuestos distintos del mismo
  negocio se esperan una a otra durante lo que dura una creación.

### Pruebas de SCRUM-1150c

- `tests/scrum1150c-dos-crear-revision-a-la-vez.test.mjs`, 4 casos con Prisma doblado, corre siempre:
  las claves del cerrojo y que no comparte espacio, que el grupo se lee y se escribe detrás de él, que
  si la `.1` aparece mientras se espera sale la `.2` heredando de la `.1`, que si el presupuesto
  desaparece se rechaza sin escribir, y que un rechazo decidible sin esperar no toma el cerrojo.
- `tests/scrum1150c-carrera-de-la-revision-postgres.test.mjs`, 2 casos contra el banco desechable
  (`LIBRO_PG_URL`; declarados en `tests/scrum419`): diez pares a la vez sin una sola revisión repetida,
  y la espera vista en `pg_locks` (otro tiene el cerrojo, la creación aparece como pendiente, no ha
  escrito, y al soltar lee la `.1` del otro y escribe la `.2`).
- **Control positivo** (`evidencias/SCRUM-1150c/salida-control-positivo.txt`, con el `numstat` de cada
  inyección): base 6 de 6. Con el fichero de `main` caen 5 de 6. Con el cerrojo puesto pero sin releer
  detrás, 5 de 6. Sin cerrojo, 5 de 6. El que pasa en los cuatro es el que tiene que pasar: el rechazo
  que no llega a tomar el cerrojo.
- Vecinos: 105 ficheros de `tests/` que nombran lo tocado, 848 tests, 823 pasan, 0 fallan, 25 saltos
  (los de otras bases). La primera pasada dio 1 rojo, el de SCRUM-219 de arriba.
- Tipos: `tsc --noEmit` sobre `quoteAdmin.ts` y su ruta (93 fuentes en el programa), 0 errores; la
  misma sonda ve dos errores puestos a propósito. El proyecto entero no cabe en memoria en esta
  máquina (1,3 GB libres): lo comprueba el check obligatorio.

### No visto en yaqu.app, y por qué

Al escribir esto la rama no está desplegada. La medida que decide es la de arriba, con el motor de
verdad: en producción un par a la vez que sale bien no prueba nada por sí solo (con el código viejo
salía bien 1 o 2 de cada 10). Lo que se mira al desplegar, y se escribe en el ticket: que el build
servido es el del merge, y que dos «Crear revisión» a la vez sobre un presupuesto de la cuenta de
pruebas contestan `.N` y `.N+1` y su ficha sigue abriendo.

## SCRUM-1150d · el hash no dice «ya no existe» con un 5xx o sin red (14-oct, S4)

**Medido contra:** `origin/main` = `7f5e1dd225430829497a6a778f06527892b606f4` · 2026-10-14T09:12:19Z (`Date:` de GitHub)

A9: comprobación → `tests/scrum832-atras-vuelve-a-la-lista.test.mjs`

**Skill UI:** cargada (`yaqu-premium-ui`), pero DESPUÉS de escribir el cambio de `app.js`, no antes: lo declaro. El cambio no toca tokens, estilos, componentes ni texto; sólo a qué pantalla lleva el router.

**Decisión:** del orquestador, encargo del 14-oct-2026, punto 2 (SCRUM-1150 (b)): el `catch` de `abrirFichaDesdeHash` separa «sin respuesta o 5xx» de «4xx». Medido el defecto en c.19286 (S2): llegando por el hash con un 500 o sin red, el panel volvía a la lista y decía «Ese presupuesto ya no existe.», con el presupuesto en esa misma lista.

### Lo construido

- `public/dashboard/js/app.js`: `elServidorDijoQueNo(err)` (sólo mira si `status` es un número entre 400 y 499) y, en el `catch`, si NO es un 4xx se abre la ficha, que dice su propio «no se ha podido cargar». Con un 4xx, lo de siempre, carácter por carácter. Vale para las seis fichas de `DETALLES`.
- Sin texto nuevo.

### Por qué no abre la fuga de SCRUM-832

Lo que el cerrojo protegía era que «no existe» y «no es tuyo» no se distingan. Leídas las seis rutas (`GET /admin/quotes|jobs|invoices|albaranes|customers|partes/:id`): todas filtran por `merchantId` en el `where` de la primera lectura y nada que pueda lanzar va antes; un id inexistente y uno de otro negocio dan el mismo 404 `not_found`. Un 5xx (base caída, proceso roto) no depende de quién es el dueño del id. **Leído, no corrido contra una base.**

### Cambio de conducta a propósito en el test de SCRUM-832 (declarado)

- Caía si el `catch` leía el error. Ahora exige que lo lea UNA vez y sólo para `elServidorDijoQueNo`, y que ni el router ni esa pregunta nombren `.code`, `.data`, `message`, `403`, `404`, `forbidden` ni `not_found`.
- No es más flojo: el caso CORRIDO antes ejecutaba una copia de la función escrita a mano en el test (no habría cambiado aunque cambiara el router); ahora saca del fuente la función REAL y la corre en las SEIS fichas con cuatro 4xx de mensajes distintos (404, 403, 400 y el 403 de la prueba caducada): mismo aviso firmado, mismo destino, mismo hash. Si el router pintara el error o distinguiera un código de otro, cae.
- Dos casos nuevos: con 500, 503, sin red y un `Error` sin estado, en las seis fichas, el router no pinta nada y abre la ficha (con control positivo: la misma sonda ve abrirse la ficha con un 200 y ve el aviso con un 404); y la ficha del presupuesto montada con su `GET` en 500 dice «Error cargando presupuesto.» y no «internal_error», «API 500» ni «ya no existe».

### Verificado, ejecutando

- El fichero, 9 de 9.
- **Rojo con cada mutación** (aplicada sobre `app.js`, restaurada y comprobada idéntica): M1, el `if` quitado (vuelve el «ya no existe» con un 500) → 2 de 9; M2, `s === 404` en vez del rango → 2 de 9; M3, el aviso cambiado por `e.message` → 2 de 9. Con el `app.js` de `main` tal cual → 3 de 9 (los tres por CIEGO: allí no existe `elServidorDijoQueNo`, así que el de los 4xx cae por no encontrarla y no por conducta; lo prueban M2 y M3). Las tres declaradas en `MUTACIONES_QUE_ME_TUMBAN`, con el nombre exacto del caso que cae.
- **Tanda** (los 362 ficheros de test que leen `app.js`, montan el banco de vistas o declaran mutaciones; `--test-concurrency=4`): 3.493 tests, 6 caídos. Míos y arreglados: `scrum836d` (el `cae` debe ser el nombre exacto de un caso) y `scrum811c`/`scrum976` (este registro). De entorno: `scrum1321` (el temporal está en `C:` y el repo en `D:`, sale CIEGO) y `scrum1266b`, que solo da 15 de 15.

### Lo que queda, declarado

- ~~El albarán con un 5xx pinta el código crudo~~ → **arreglado en este mismo PR** con el literal firmado en SCRUM-1150 c.19658: «No se pudo cargar el albarán. Inténtalo de nuevo.» (`COPY_ALBARAN_NO_SE_PUDO_CARGAR`, por `mensajeParaPersona`: si el servidor trae un `message` para personas, ése). Ficha: `docs/microcopy/2026-10-14-SCRUM-1150-albaran-no-se-pudo-cargar.md`. Caso nuevo en el test de SCRUM-832, con la ficha REAL del albarán y su `GET` en 500: 10 de 10; con el `albaranDetailView.js` de `main`, cae ese caso. Guards de microcopy, del albarán y de trinquetes (135 ficheros, 1.304 tests): 0 caídos.
- Las otras cuatro fichas dicen un texto propio y legible: «No pudimos cargar el trabajo.», «Error cargando la factura.», «Error al cargar el historial del cliente.» y «No se ha podido cargar el parte. Vuelve a intentarlo.» (este último con la forma de reintento que no es la de la casa; ya estaba firmado y no lo toco).
- Con un 5xx la ficha hace su `GET` una segunda vez (la del router y la suya). Es una petición de más en un caso de fallo.
- **NO medido:** yaqu.app (hasta que mergee) · la suite completa de `npm test`.