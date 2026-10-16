# SCRUM-1302 · Siete defectos del recorrido de PARTE y ALBARÁN, separados por riesgo

Ticket abierto por S4 el 29-sep-2026 (siete defectos, A–G, medidos pulsando). Lo trabaja **J3**
(equipo de Javier) por encargo del orquestador `cobroflash-backend-47`, 30-sep-2026.

## 0 · La separación (aceptada entera por el orquestador, 30-sep-2026)

Los siete, reproducidos en el banco (`cargarDashboard`, scripts de `index.html` en orden) sobre
`b6243e1c`. **Un PR por defecto**; sólo se construyen los de panel que no piden texto.

| Def | ¿Reproducido? | ¿Camino fiscal? | ¿Texto nuevo? | Destino |
|---|---|---|---|---|
| A · el dueño edita la descripción y el aviso se va | sí | no | no | **este registro, §A** |
| B · `guardarCampo` falla y la casilla vuelve sin decir nada | sí | no | sí | orquestador: espera al helper de SCRUM-1233 y a la firma |
| C · el aviso de «Ordenar en líneas» sale vacío | sí | no | sí | orquestador: firma |
| D · «Facturar con el presupuesto» se queda en «Procesando…» | sí | **sí** | sí | STOP (regla 40), orquestador y fundador |
| E · el mismo botón cuando sólo puede dar 409 | panel sí; servidor leído, no ejecutado | **sí** | no | STOP (regla 40) |
| F · enviar a firmar / WhatsApp sin teléfono | sí | no | no | PR propio, después de A |
| G · «Añadir foto» con 10 fotos | sí | no | no | PR propio, después de F |

## A · La marca del dato inventado viaja también en la vista de oficina

**Medido contra:** `origin/main` = `b6243e1c9f22e23b5a48332acc30ef533e55589f` · 2026-09-30T21:54:57+01:00

A9: comprobación → `tests/scrum1302a-marca-en-la-vista-de-oficina.test.mjs`

**Causa.** `PATCH /admin/partes/:id` responde, con rol `admin`, `serializeParteParaLaOficina`, y sus
líneas no llevaban `datosNoRespaldados`. La ficha del parte hace `parte.lineas = r.lineas` y repinta
el aviso de SCRUM-1266 con eso: se iba. La base sí conservaba la marca (`casarLineasPorIdentidad`).
Con el técnico no pasa (su vista la lleva) y cambiando la cantidad tampoco (ese camino no repinta).

**Arreglo.** La vista de oficina añade la marca a cada línea que la tenga, tomada de
`lineasParaElTecnico` —la misma función que se la sirve al técnico—, así la regla de «qué sigue
escrito» vive en un solo sitio. Una línea sin marca sale sin el campo. No hay texto nuevo: el aviso
es el de SCRUM-725 que ya se pintaba.

**Prueba.** La vista de verdad (`parteDetailView.js`) contra la ruta de verdad (`dist`, base doblada
con `_envio-doblado.mjs`), con los dos roles:

- rojo primero: con rol `admin` el aviso desaparecía tras editar la descripción; con `tecnico`, verde
  por el mismo camino (el control que demuestra que el banco distingue);
- control positivo: el dueño que corrige el dato sí ve irse el aviso, y una línea sin marca no sale
  con el campo;
- mutación: quitar la marca del serializador en `dist` → cae el caso `admin`; restaurado y
  comprobado por sha256.

## F · Sin canal de WhatsApp, los dos envíos del albarán no se ofrecen

**Medido contra:** `origin/main` = `21c7163d04c8a117df995f3f945cf6f04c53bc99` · 2026-09-30T22:26:51+01:00

A9: comprobación → `tests/scrum1302f-envio-sin-telefono.test.mjs`

**Causa.** «Enviar para firmar» (primaria en `emitido`) y «Enviar por WhatsApp» (secundaria en
`firmado`) se pintaban siempre; con el cliente sin número su único desenlace era
`409 customer_missing_phone`. El profesional SÍ leía «Este cliente no tiene WhatsApp guardado.»: el
defecto era ofrecer un botón que sólo sabe fallar, no el silencio. `GET /admin/albaranes/:id` no
decía si el cliente tiene canal.

**Arreglo** (patrón ya aprobado de la hoja del Trabajo, SCRUM-993 opción A; mecanismo aprobado por el
orquestador el 30-sep):

- el detalle manda `customer.puedeRecibirWhatsApp`, calculado con `canalDeWhatsApp` —la misma función
  que da el 409 en los dos envíos—; el número no sale de la ruta;
- `requiere` nuevo en la ley (`patronDetalleAcciones.js`): oculta la acción en cualquier destino si el
  contexto dice `false` EXPLÍCITO. Sin el dato (la lista, la copia precargada) no oculta nada;
- el registro del albarán pone `requiere: 'cliente-con-whatsapp'` en los dos envíos, y
  `ctxAlbaranDeFila` lo responde desde el dato del servidor.

**Hueco declarado, sin texto.** En `emitido` sin número desaparece la PRIMARIA y queda «Firmar aquí
mismo»: la pantalla no dice por qué no se ofrece el envío. Decirlo es texto (regla 39); el orquestador
lo sube al fundador. Hasta que haya firma, el hueco se queda así, declarado.

**Prueba.** La pantalla real (`cargarDashboard`) pidiendo el detalle a la ruta real (`dist`, base
doblada): rojo visto con cliente sin número y con un número que no se puede marcar (los dos 409);
control positivo con móvil (siguen los dos); sin el dato no se esconde nada; la ruta no manda el
número; y la factura no cambia (ninguna acción suya lleva `requiere` y sus destinos son los mismos con
la condición del albarán en el contexto). Tres mutaciones cazadas (quitar `requiere` de la ley, tratar
la falta de dato como `false`, servidor diciendo siempre `true`), restauradas con sha256.
Guards de navegador de las pantallas afectadas: `guard:albaranes-con-acciones`,
`guard:detalle-trabajo-917` y `guard:descuentos-en-el-detalle`, los tres en 0.

## G · Con las diez fotos puestas, «Añadir foto» no se ofrece

**Medido contra:** `origin/main` = `0e3b2d66d0ba92a3d0af41f01a2180644320077c` · 2026-09-30T22:45:20+01:00

A9: comprobación → `tests/scrum1302g-foto-con-diez.test.mjs`

**Causa.** Con 10 fotos en el albarán, «📷 Añadir foto» seguía en el «⋯» y su único desenlace era
`409 max_fotos` (tope `FOTOS_MAX_POR_ALBARAN` en `POST /admin/albaranes/:id/fotos`). El detalle no
decía si caben más.

**Arreglo.** `GET /admin/albaranes/:id` cuenta las fotos de ese albarán y ese merchant contra el MISMO
tope y manda `cabenMasFotos`; el registro pone `requiere: 'caben-fotos'` en `btnFoto` (la ley de §F).
Sin el dato no se esconde nada. Sin texto nuevo.

**Prueba.** Pantalla real contra la ruta real con N fotos en la base: rojo visto con 10; positivo con
9 y sin el dato; la ruta filtra por merchant y albarán y compara con el tope del 409. Dos mutaciones
cazadas (quitar el `requiere` de la foto; `<=` en vez de `<` en la ruta), restauradas con sha256.
El test de §F pasa a fijar cada acción con SU condición (los dos envíos → canal; la foto → plazas).

**Fixture ajeno completado (aprobado por el orquestador, opción a).** `tests/scrum302-presupuesto-y-fotos.test.mjs`
monta a mano un doble de la base sin el modelo `attachment`: con la cuenta de fotos, el GET respondía 500
y sus dos casos del presupuesto no llegaban a ejecutarse. Se le añade UNA línea
(`attachment.count → 0`) con su porqué y el aviso de que el 0 es fijo. Ninguna aserción se toca.

# APÉNDICE · H1 y H6 de la cola de firmas (S2) · la firma directa lee «ya está firmado» como lo lee el drenado

**Medido contra:** `origin/main` = `48babd04d40667a9ec8fbeb6e02b9e44dbf0585b` · 2026-10-01T11:09:06Z
A9: aviso → A10 «Una red de seguridad que no caza tiene el mismo aspecto que una que no tuvo nada que cazar.» — no se pudo comprobar: el fallo fue de una sonda de usar y tirar contra yaqu.app (un interceptor de Playwright que no interceptó y dejó pasar un POST real); no hay instrumento común de sondas en el repo donde poner el control positivo.

Entrada propia (encabezado de primer nivel) para que su declaración de skill no se le atribuya a las secciones F y G de arriba, que son de otros PR.

## H1

Carril S2 (`colaDeFirmas.js`; §11bis: «el resto es de la S2») · rama `scrum-1302-firma-directa-ya-registrada` · sesión `s2-01a`. Hallazgo 1 del recorrido de S4 de la cola de firmas sin red del albarán (Jira SCRUM-1302, c.17880). Los otros cinco de ese recorrido NO van aquí.

**Skill UI:** cargada (`yaqu-premium-ui`, en esta sesión y antes de editar). El cambio es de lógica en `public/dashboard/js/colaDeFirmas.js`: sin marcado, sin estilos y **sin texto nuevo**.

### El defecto

La cola sube la firma al volver la red y el detalle abierto se queda viejo. Firmar o «Reintentar» desde ahí recibe 409 `albaran_locked` («Este albarán ya está firmado.»). `firmarConRedDeSeguridad` lo trataba como un fallo cualquiera: devolvía ②, la vista pintaba «No hemos podido registrar la firma (…)» de una firma que SÍ estaba registrada, y la firma volvía a la cola, donde el aviso dice «si lo pierdes, se pierde» de algo que el servidor ya guarda. El drenado, en el mismo fichero, ya lo leía bien (`elServidorYaLaTiene`).

### El arreglo

En el `catch` de la subida, antes del rechazo definitivo: si `elServidorYaLaTiene(error)` —la MISMA función del drenado, no una segunda regla— la firma sale de la cola, se olvida su rechazo y se devuelve ③ (`FIRMA_A_SALVO`) con `yaLaTenia: true` y sin `respuesta`. Las dos vistas que llaman (`albaranDetailView.js` y `parteDetailView.js`, de S4, no tocadas) ante ③ repintan pidiendo el documento al servidor y no leen `respuesta`: leído en su fuente, no ejecutado aquí.

Vale también para `parte_locked`: en las rutas de firmar del parte ese código sólo sale de `puedeFirmarCliente`/`puedeFirmarTecnico` («ya ha firmado»).

### Verificado, ejecutando

`tests/scrum1302h-firma-directa-ya-registrada.test.mjs`: `firmarConRedDeSeguridad` real con el `apiRequest` real y una red que responde el 409 (el `code` lo pone `api.js`, no el test).

- **Rojo antes del arreglo:** caen justo los tres del defecto (`albaran_locked`, con firma previa en la cola, y `parte_locked`); el suelo y los tres controles pasan.
- **Verde después:** 7/7. Controles: un 409 `invalid_transition` y un 500 siguen en ② **y en la cola**; con red normal sigue ③ con la respuesta del servidor.
- Vecinos (los 15 ficheros de test que nombran la cola o el drenado): 171/171.

**NO medido:** la vista del albarán montada (el recorrido con pantalla es la sonda de S4), ni yaqu.app: reproducirlo en producción exige firmar un albarán, y el fixture sólo tiene uno emitido.

### H6, en la misma rama · firmar CON red ya no deja la marca de «hubo cola»

Va en la misma rama y el mismo fichero porque toca la misma función y las mismas líneas que H1. **Skill UI:** la de arriba; tampoco hay marcado, estilos ni texto nuevo.

**El defecto.** `yaqu_hubo_cola` se pone al encolar (antes de subir) y sólo la retiraba el drenado. Una firma que sube a la primera sale de la cola y dejaba la marca. En el arranque siguiente `detectarDesalojo` lee «hubo cola y el almacén está vacío» y la home pinta «El móvil ha borrado firmas sin subir» de una firma que está en el servidor.

**Quién gana la carrera, medido en navegador real** (S4 no pudo: su banco daba 10/10 sin `persist` y 0/10 con ≥5 ms). Chromium headless contra yaqu.app (build `48babd04`), cuenta QA, sólo lectura, partiendo del estado que deja «firmar con red» (marca puesta, cola vacía), 10 arranques por tanda:

| Estado de partida | Resultado del detector | Aviso pintado | Marca tras arrancar |
| --- | --- | --- | --- |
| sin marca (control) | 10/10 `SIN_PERDIDA` | 0/10 | no |
| marca + cola vacía, service worker activo | 10/10 `POSIBLE_PERDIDA` | **10/10** | no (la borra el drenado, después) |
| marca + cola vacía, service worker bloqueado | 10/10 `POSIBLE_PERDIDA` | **10/10** | no |

En Chromium gana siempre el detector: el aviso falso sale el 100 % de las veces, una vez. **No medido:** Safari ni un iPhone.

**El arreglo no depende de quién gane:** se quita la causa. `retirarLaMarcaSiNoQuedaNada()` en `colaDeFirmas.js`, con el criterio que ya usa el drenado (cola leída y vacía), llamada cuando la firma directa confirma (③) y cuando el servidor contesta que ya la tenía. Si queda otra firma en la cola o no se puede leer, la marca se queda.

**Verificado.** Mismo fichero de test, 12/12. Rojo antes: caen los dos del defecto (confirmada y «ya la tenía»). Controles: el detector SÍ caza marca + cola vacía; si la firma no sube, la marca se queda; si sube ésta y queda otra en la cola, la marca se queda. Vecinos (17 ficheros que nombran cola, drenado, marca o detector): 197/197.

**Queda abierto, dicho y no arreglado:** con marca y cola vacía DE VERDAD (un desalojo real), el aviso depende de la misma carrera — `drenarAlAbrir` también borra la marca cuando encuentra la cola ya vacía (`quedan === 0`). En Chromium gana el detector y el aviso sale; en el banco de S4 con `persist` ≥5 ms gana el drenado y **una pérdida real se callaría**. Cambiarlo es rediseñar quién es dueño de la marca; no se toca aquí sin medir Safari.

### Retirada de las dos entradas declaradas (sesión `s2-1octc`, 1-oct-2026)

Al mezclar `main` (que ya trae SCRUM-1351 y SCRUM-1362), `tests/scrum1351-viaje-firma-sin-red-albaran.test.mjs` cae en «los defectos del viaje son EXACTAMENTE los declarados»: H1 y H6 ya no se observan y sus entradas seguían en `scripts/_defectos-viaje-firma-declarados.json`. Se borran `firmar-lo-ya-subido-dice-que-no-se-registro-y-reencola` y `firmar-con-red-deja-la-marca-de-que-hubo-cola`; quedan dos (`el-detalle-abierto-no-se-entera-de-que-la-cola-subio`, `cerrar-sesion-borra-la-cola-sin-avisar`), cuyos defectos siguen vivos. Ninguna aserción se toca.

**Autorización:** retirada autorizada por el fundador el 1-oct-2026 («1 autorizo lo que dices»), regla en `settings.local.json:70`. La sesión anterior (`s2-1octb`) no la hizo porque tenía una denegación propia sobre ese resultado; ésta arranca sin ella.

**Medido:** ese fichero de test, rojo 12/13 antes de borrar (el que cae nombra justo esas dos claves) y verde 13/13 después.

# APÉNDICE · Aviso al cerrar sesión con firmas sin subir (S2)

**Medido contra:** `origin/main` = `3017ae0c8008e93ed3ff230ebf64bbebd44b6e2a` · 2026-10-01T13:58:44Z
A9: comprobación → `tests/scrum1302i-aviso-cerrar-sesion.test.mjs`

Entrada propia (encabezado de primer nivel) para que su declaración de skill no se le atribuya a los PR de arriba. Carril S2 (`public/dashboard/js/app.js`) · rama `scrum-1302-aviso-cerrar-sesion`, apilada sobre la de H1/H6 (#2080).

**Skill UI:** cargada (`yaqu-premium-ui`) en esta sesión. Dicho como fue: la cargué DESPUÉS de la primera edición de `app.js` y antes del commit; no cambió nada del diff. El cambio no lleva marcado ni estilos: es un `window.confirm` nativo, el patrón que ya usa el panel (`albaranDetailView.js`, `jobsView.js`), con texto firmado.

## El defecto

`logout()` purga los datos locales, y el purgado vacía `firmasPendientes` a propósito (SCRUM-455, art. 32 RGPD). Lo hacía callado: una firma hecha sin cobertura y aún sin subir desaparecía al cerrar sesión. Era la entrada `cerrar-sesion-borra-la-cola-sin-avisar` de `scripts/_defectos-viaje-firma-declarados.json`.

## El texto

Aprobado por el orquestador por delegación del fundador, 1-oct-2026 — SCRUM-1302 comentario 17889. Dos literales, sin cambios:

- una: «Te queda 1 firma por subir. Si cierras sesión ahora, se borra de este móvil y habrá que volver a firmar. ¿Cerrar sesión?»
- varias: «Te quedan ${n} firmas por subir. Si cierras sesión ahora, se borran de este móvil y habrá que volver a firmarlas. ¿Cerrar sesión?»

## Lo construido: las tres mitades, juntas

En `app.js`, antes del purgado (`confirmarCierreConFirmasSinSubir`):

- **(a)** la cola se lee ANTES del purgado;
- **(b)** si `navigator.onLine` no dice que no hay red, se intenta subir con el drenado de siempre (`drenarSiNoSeEstaDrenando`, que tiene el plazo de `api.js`) y se vuelve a contar; si queda en cero, se cierra sin preguntar;
- **(c)** si quedan, se pregunta con la cifra que QUEDA; «Cancelar» sale de `logout()` antes del purgado: ni se borra nada ni se llama a `/auth/logout` ni se va al login.

Sin cifra cierta no se pregunta: cola ilegible (antes o después del intento), o sin `leerFirmasPendientes`/`confirm`. En esos casos se cierra sesión como hasta hoy. El orden de SCRUM-455/457 (purgado antes del POST) no cambia.

## Verificado, ejecutando

`tests/scrum1302i-aviso-cerrar-sesion.test.mjs`: el `logout()` real con `colaDeFirmas.js`, `almacenLocal.js` y `api.js` reales sobre `fake-indexeddb`.

- **Rojo antes** (con el `app.js` anterior): 3/8; caen los cinco del defecto y pasan el suelo, el control de cola vacía y el de cola ilegible.
- **Verde después:** 8/8. Incluye «`onLine` miente» (dice que hay red y no la hay: se pregunta igual) y «la red no las acepta» (500: se intenta, quedan, se pregunta por las que quedan).
- Vecinos que llaman a `logout()` (scrum1351, scrum455, scrum457, scrum460, scrum890b) más éste: 64/64, con la entrada ya retirada del JSON. Queda una entrada (`el-detalle-abierto-no-se-entera-de-que-la-cola-subio`), así que `vacio_a_proposito` no aplica. Medido antes de mezclar `main` (`3017ae0c`).
- La tanda dirigida para `app.js` son 459 ficheros de 1.183: NO se corrió en local (norma del 1-oct); el juez es el CI.

**NO medido:** yaqu.app ni un navegador real (el `confirm` nativo, Safari, un iPhone). Verlo en producción exige dejar una firma en la cola de la cuenta QA sin red.

## Queda abierto: SCRUM-1383

Leído en el código, NO ejecutado. Durante el intento de subida de (b) el servidor puede rechazar una firma de forma definitiva (`RECHAZOS_DEFINITIVOS`). Sale de la cola dejando una constancia en `localStorage`, la cola queda en cero, se cierra sin preguntar y el purgado borra la constancia (`almacenLocal.js`, patrón `yaqu_firma_rechazada_`, `purga: true`). La mitad (b) puede crear ese agujero, no sólo heredarlo. El texto firmado no sirve ahí (no «queda por subir», está rechazada): necesita texto nuevo, que se propone y se para.

# APÉNDICE · B: un campo de la cabecera del parte que no se guarda, se dice (S4)

**Medido contra:** `origin/main` = `39af736efc8ccf7d2966063561421855b3e4c4e9` · 2026-10-06T11:20:17Z
A9: sin fallo que generalice — el arreglo se probó en rojo antes de darlo por bueno y el control negativo va dentro del test

Carril S4 (`public/dashboard/js/parteDetailView.js`) · rama `scrum-1302b-campo-que-no-se-guarda`.

**Skill UI:** cargada (`yaqu-premium-ui`) en esta sesión. Dicho como fue: la cargué DESPUÉS de editar la vista y antes del commit. Tras leerla no cambié nada, y declaro lo que choca con ella: el aviso lleva `style.marginTop = '8px'`, copiado del aviso vecino de la misma vista (`avisar`, el de la firma rechazada). No hay clase compartida que dé ese hueco y `styles.css` es carril de S2; sin el hueco el aviso queda pegado a la casilla. `tests/scrum713c` no lo cuenta (sólo mira `cssText`) y lo dice él mismo.

## El defecto

`guardarCampo` mandaba el `PATCH` y, si fallaba, repintaba la ficha desde el servidor sin decir nada. Visto en yaqu.app el 1-oct (comentario 17880): la casilla vuelve al valor viejo, su línea plegada se cierra y no sale ningún texto.

## El texto

Aprobado por el orquestador por delegación del fundador, 6-oct-2026 — SCRUM-1302 comentario 18288: «No se ha podido guardar el cambio — vuelve a intentarlo». Ficha: `docs/microcopy/2026-10-06-SCRUM-1302-campo-que-no-se-guarda.md`.

## Lo construido

- Tras el repintado, el aviso sale en el paso del campo que falló: en la sección de las horas, o dentro de su línea plegada, que se abre. `role="alert"`, clase `alert error`.
- Vale para las ocho casillas y para los tres radios del tipo: todos guardan por `guardarCampo`.
- Si ese mismo campo se guarda después, el aviso se quita. Guardar otro campo no lo quita.
- Si la relectura también falla, la ficha ya dice entera que no se ha podido cargar y no se añade nada.

Decisiones mías, no firmadas, que el orquestador puede cambiar: abrir la línea plegada (el comentario 18288 firma el texto, no dónde); y que cada fallo repinta la ficha, así que sólo queda a la vista el aviso del último campo que falló.

## Verificado, ejecutando

`tests/scrum1302b-campo-que-no-se-guarda.test.mjs`, con la vista real en el banco y un servidor que rechaza el campo que se le diga.

- **Rojo antes** (con la vista de `origin/main`): 2 de 6; caen los cuatro del defecto y pasan los dos controles.
- **Verde después:** 6 de 6.

**NO medido:** yaqu.app ni un navegador real. La cuenta QA está caducada desde el 3-oct (`node scripts/qa/sesion-panel.mjs estado` → MUERTA). No se ha visto en pantalla cómo queda el aviso a 390 px ni si el hueco de 8 px basta.

## Sigue abierto en este ticket

C (el aviso vacío de «Ordenar en líneas») sin firmar, a propósito. D y E, camino fiscal. Y la pregunta de si los cuatro mensajes del servidor se pueden enseñar tal cual.

# APÉNDICE · C: «Ordenar en líneas» que falla se dice, y no borra la propuesta que ya hay (S4)

**Medido contra:** `origin/main` = `8f77f96dd12c0cc7cad87f94d166b58601741b5f` · 2026-10-06T18:06:42Z
A9: comprobación → `tests/scrum1302c-ordenar-que-falla-no-borra-la-propuesta.test.mjs`

Carril S4 (`public/dashboard/js/parteDetailView.js`) · rama `scrum-1302c-ordenar-que-falla-no-borra-la-propuesta`.

**Skill UI:** cargada (`yaqu-premium-ui`) en esta sesión, antes de editar la vista. Sin clases, tokens ni colores nuevos: el aviso es el `alert error` de la casa, igual que el del punto B. Declaro lo que choca con ella: lleva `style.marginTop = '8px'`, copiado del aviso vecino de la misma vista; no hay clase compartida que dé ese hueco y `styles.css` es carril de S2.

## El defecto

Ejecutado en yaqu.app el 6-oct (comentario 18486, 18 filas). Si la ruta del dictado no contesta, el párrafo del aviso existe con texto «» y alto 0. Y si en pantalla había una propuesta, el fallo pintaba una propuesta vacía encima: tres líneas, una corregida a mano, y un 500 se las llevaba sin una palabra.

## Lo firmado

Aprobado por el orquestador por delegación del fundador, 6-oct-2026 — SCRUM-1302 comentario 18491, las tres cosas juntas. Ficha: `docs/microcopy/2026-10-06-SCRUM-1302-ordenar-que-falla.md`.

- El texto: «No se ha podido ordenar el dictado — vuelve a intentarlo o escribe las líneas tú». Casos: no llega la petición, 5xx, 502.
- Conducta 1: si ya hay una propuesta en pantalla y el nuevo intento falla, la propuesta no se toca.
- Conducta 2: 409 y 404 releen el parte, sin texto nuevo.

## Lo construido

- El aviso tiene sitio propio (`[data-dictado-aviso]`), bajo el botón y fuera del hueco de la propuesta. Así se puede decir sin pintar encima de lo que el técnico corrigió. `role="alert"`, clase `alert error`, y se trae a la vista con `scrollIntoView({ block: 'nearest' })`, como el del punto B desde SCRUM-1475.
- Un intento que falla ya no pinta nada en el hueco de la propuesta.
- 409 y 404: `renderParteDetailView`, lo mismo que hace un campo que no se guarda.
- Se quita cuando un intento siguiente recibe respuesta.
- Se decide por `err.status`, que pone `apiRequest`; sin código es «no llegó» (sin red, o el plazo venció).

**La trampa que este cambio abría, y por eso va en la línea `A9:`.** Dejar viva la propuesta de antes deja vivo su botón «Añadir al parte» con la escucha que ya tenía. El cable del dictado ataba una escucha al botón de añadir después de CADA intento: con la propuesta conservada, cada fallo le habría atado otra, y un solo toque habría guardado las líneas dos o tres veces en un documento que se firma. Ahora sólo se ata cuando acaba de nacer una propuesta nueva. Lo sujeta el test «guarda UNA vez», que cae si se quita esa línea (mutante M4).

## Lo que la firma no cubre, y cómo queda

- **Otro rechazo (400, 401, 403…):** no sale texto (no hay ninguno firmado para él) y la propuesta tampoco se toca. Sigue callado, como antes; lo que cambia es que ya no borra.
- **La ruta contesta 200 sin líneas (la IA caída) con una propuesta en pantalla:** NO TOCADO. La propuesta se sustituye por el aviso del servidor, con lo corregido dentro. Medido el 6-oct, 2 de 2 ventanas. Es el mismo daño por otro camino, pero ahí el aviso diría «ninguna línea» encima de tres líneas: pide que lo mire quien firma.
- **«Añadir al parte» con el guardado fallando:** NO TOCADO. La propuesta se sustituye por «No se han podido guardar las líneas — vuelve a intentarlo», y lo que habría que reintentar ya no está en pantalla. Medido el 6-oct, 2 de 2 ventanas.

## Verificado, ejecutando

`tests/scrum1302c-ordenar-que-falla-no-borra-la-propuesta.test.mjs`: la vista real en el banco, servida por `fetch`, así que el error que decide es el que fabrica el `apiRequest` de verdad.

- **Rojo antes** (con la vista de `origin/main`): 1 de 9; caen los ocho del defecto y pasa el control.
- **Verde después:** 9 de 9.
- **Por mutación:** base verde y 15 mutantes de 15 mueren, cada uno con su `git diff --numstat` al lado.

**En el navegador**, con el `parteDetailView.js` de esta rama servido encima de yaqu.app (build `8f77f96d`, cuenta QA, parte 9, service worker bloqueado, control del interceptor antes de tocar; a producción no llega nada que no sea GET). 2 ventanas (390×844 y 1280×800) × 12 casos = 24 filas, 0 rotas:

- 500, sin red y 502: el texto firmado, letra a letra, a 8 px del botón; 366×63 en móvil y 984×42 en escritorio; entero en la ventana y sin nada encima. El dictado sigue escrito (70 caracteres) y el botón vuelve.
- Propuesta de tres líneas, una corregida, y dos intentos fallidos seguidos: las tres siguen con la corrección, un solo aviso, y «Añadir al parte» manda UN `PATCH`.
- 409: una relectura; la ficha sale firmada, sin botón de ordenar y sin casillas. La relectura se sirvió con el parte 10 de la cuenta, que está firmado de verdad.
- 404 con la relectura también en 404: «No se ha podido cargar el parte. Vuelve a intentarlo.»
- Con el botón pegado al borde inferior (la ventana encogida hasta dejarlo a 2 px): el aviso queda entero. **Control negativo:** la misma fila sirviendo la vista sin el `scrollIntoView` lo deja FUERA de la ventana, en las dos.
- Control: la ruta contesta 200 sin líneas y sale el aviso del servidor, no éste.

**NO medido:** yaqu.app con el JS ya desplegado (se mira cuando mergee) · un móvil de verdad · una sesión caducada (401) de verdad · el plazo vencido de `apiRequest` (se decide igual que sin red, por lectura del código).

## SCRUM-1302j · dos firmas a la vez sobre el mismo parte escribían las dos (S1, 13-oct-2026)

**Medido contra:** `origin/main` = `fc10ff9cb3b29eb18a5da552ec18f8c551eba7b7` · 2026-10-13T14:50:24Z
A9: comprobación → `tests/scrum1302j-dos-firmas-del-parte-a-la-vez.test.mjs`

Carril S1 · sesión `s1-13octe` · rama `scrum-1302j-dos-firmas-del-parte-a-la-vez`. Encargo del orquestador sobre una medición de S4 (SCRUM-1302d, `docs/master/evidencias/SCRUM-1302/reintento-de-firma/`, caso 2; en su rama, sin mergear al escribir esto): dos `POST /albaran/:token/firmar` a la vez contestaban las dos 200, con 2 escrituras, 2 PDF y 2 copias pedidas, y en el parte quedaba el SEGUNDO trazo y el segundo nombre.

**La causa:** `albaranPublic.routes.ts` leía el parte, comprobaba `emitido` y escribía con `where: { id }`. Leer y escribir no es una operación.

**El arreglo**, el de SCRUM-1276 en el presupuesto: el `update` lleva en el `where` el estado y la versión LEÍDOS (`{ id, estado, version }`). Quien llega tarde recibe P2025, se vuelve a leer el parte y se contesta lo que contestaría una petición nueva: `{ ok: true, already: true }` si ya está firmado; el 409 de SCRUM-361 si el parte cambió de versión; el 409 `invalid_transition` en otro caso. No repite PDF, copia ni enlace del portal. **Ningún texto nuevo:** los tres son respuestas que la ruta ya daba.

La versión en el `where` cierra una segunda ventana que nadie había pedido medir: si el profesional corrige el parte entre la lectura y la escritura, antes se sellaba un contenido que el cliente no vio (SCRUM-361 lo comprueba, pero sobre lo leído).

**Medido, con el mismo test y el doble fiel al `where`:**

| caso | código de `main` | con el arreglo |
|---|---|---|
| suelo: una firma, una copia pedida | pasa | pasa |
| 🔴 dos a la vez | **2 escrituras** («Ana y después Blas») | 1 escritura, queda la de quien escribió, la otra contesta `already`, 1 copia |
| 🔴 el parte cambia de versión tras leerlo | **se sella** (1 escritura) | 0 escrituras, 409 de SCRUM-361 |
| control: firmar un parte ya firmado | pasa | pasa |

- Tanda dirigida (230 ficheros de `tests/` que nombran la ruta, el censo de escrituras del albarán o la microcopy): 2.323 tests, 0 fallos, 7 saltos. Una pasada anterior dio un rojo mío, `SCRUM-275 · TRINQUETE` (respuestas públicas sin `message`): había sacado el 409 a una variable y el guard dejó de verle el `message`. Arreglado en el código: literal y con su `message`.

**NO medido:** contra un Postgres real (el doble imita el P2025; que Prisma acepte campos no únicos en el `where` de `update` es lo que ya usa SCRUM-1276 en producción) · yaqu.app · cada cuánto ocurre la carrera.

**NO tocado, y es el gemelo:** la firma EN OBRA (`albaranes.routes.ts:1045`) escribe `estado: 'firmado'` igual. No la he medido ni cambiado.

## SCRUM-1302k · el gemelo: dos firmas EN OBRA a la vez escribían las dos (S1, 13-oct-2026)

**Medido contra:** `origin/main` = `ef419ff0dc52e6d8f809e97978cdfc15704f011b` · 2026-10-13T15:20:25Z
A9: comprobación → `tests/scrum1302k-dos-firmas-en-obra-a-la-vez.test.mjs`

Carril S1 · sesión `s1-13octf` · rama `scrum-1302k-dos-firmas-en-obra-a-la-vez`. Es el cabo que dejó escrito la sección de arriba. Encargo del orquestador: medir primero, y arreglar sólo si reproduce y el arreglo no toca el camino de emisión.

**Reproduce.** `POST /admin/albaranes/:id/firmar` leía el albarán, comprobaba `emitido` y escribía con `where: { id }`. Con el código de `main` (instrumento comiteado antes del arreglo, `923fe69b40c12a3faf4fdc071ce359455ca61068`): 2 escrituras, «Ana y después Blas». Aquí la segunda petición tiene origen conocido: la firma en obra se reintenta (`firmarConRedDeSeguridad`) y la cola de firmas sin cobertura la vuelve a subir.

**Dónde cae el arreglo, mirado y no deducido:** las bocas de emisión del fichero (`emitInvoice`) están en `facturar-parcial` (línea 1310) y `convertir-en-factura` (línea 1590). El manejador de la firma (995-1079) no llama a ninguna. El diff se queda entero dentro de ese manejador y no toca `buildFirmaEvidencia` ni lo que se sella: sólo el `where` del `update` y qué se contesta cuando no casa.

**El arreglo:** el `where` lleva el estado LEÍDO (`{ id, estado }`). Quien llega tarde recibe P2025, se relee el albarán (por id y merchant) y se contesta lo que contestaría una petición nueva: 409 `albaran_locked` si ya está firmado, 409 `invalid_transition` en otro caso, 404 si ya no existe. No regenera el PDF. **Ningún texto nuevo:** son los literales que la ruta ya daba unas líneas más arriba.

| caso | código de `main` | con el arreglo |
|---|---|---|
| suelo: una firma, se pide el PDF | pasa | pasa |
| 🔴 dos a la vez | **2 escrituras** («Ana y después Blas») | 1 escritura, queda la de quien escribió, la otra 409 `albaran_locked`, 1 PDF |
| control: firmar un albarán ya firmado | pasa | pasa |

- Tanda dirigida: 89 ficheros de `tests/` (los que nombran albarán, firma, el trinquete de `message` y el año de la serie), 807 tests, 800 pasan, 0 fallos, 7 saltos.

**NO hecho, a propósito: la versión NO va en este `where`.** En la firma remota sí (SCRUM-1302j) porque el cliente manda la versión que vio y hay un 409 firmado para decírselo. En obra el cuerpo no lleva versión y esta ruta no tiene texto para «el albarán ha cambiado»: ponerla exigía un texto nuevo, que es firma. Queda la ventana, leída y NO medida: si alguien del equipo edita el albarán entre la lectura y la escritura de la firma, la evidencia sella el contenido leído y la fila guarda el editado.

**NO medido:** contra un Postgres real · yaqu.app · cada cuánto ocurre · `POST /admin/partes/:id/firmar` y `/firmar-tecnico` (`partes.routes.ts`), que firman con el mismo gesto: sin leer.

**Visto en yaqu.app el 14-oct-2026** (SCRUM-1302 c.19601): dos firmas en obra a la vez, desde dos procesos, sobre el albarán de prueba #47 de la cuenta QA → una 200 y otra 409 `albaran_locked`; releído por `GET`, el firmante es el del 200.

## SCRUM-1302o · la versión en el `where` de la firma en obra, y el otro lado de la misma ventana: el PATCH (S1, 14-oct-2026)

**Medido contra:** `origin/main` = `e2be1c9fda3b5ceac853b4d376f5664ac8e4df67` · 2026-10-14T08:11:04Z
A9: comprobación → `tests/scrum1302o-version-en-la-firma-en-obra.test.mjs`

Carril S1 · tanda del 14-oct · árbol `s1-13octd` · rama `scrum-1302o-version-en-la-firma-en-obra`. Cierra la ventana que 1302k dejó declarada, con el texto firmado en SCRUM-1302 c.19467 (`docs/microcopy/2026-10-14-SCRUM-1302-albaran-cambiado-en-obra.md`).

**Reproduce, por las dos puertas** (instrumentos comiteados antes de cada arreglo: `68c8c4290` y `a0025674c`):

| caso | código de `main` | con el arreglo |
|---|---|---|
| firma en obra; alguien edita el albarán entre la lectura y la escritura | **escribe**: la evidencia sella «lo que vio el cliente» y la fila guarda lo editado | 409 `albaran_cambiado` con el texto firmado, 0 escrituras, sin PDF |
| control: firmado por otro en medio | 409 `albaran_locked` | igual |
| `PATCH`; la firma entra entre su lectura y su escritura | **escribe sobre un albarán FIRMADO** | 409 `albaran_locked` «Un albarán firmado está congelado: no se puede editar.» |
| dos `PATCH` con la misma versión | **el segundo pisa al primero en silencio** | 409 `albaran_cambiado_al_editar` (la respuesta que la ruta ya da a una versión vieja) |
| suelos: una firma sola, un `PATCH` solo | pasan | pasan |

El `PATCH` no estaba en el encargo: la firma no sube `version`, así que poner la versión sólo en el `where` de la firma dejaba la ventana abierta por el otro orden. Es la misma ventana, y se arregla sin texto nuevo.

**Dónde cae, mirado y no deducido (14-oct, no heredado de 1302k):** `emitInvoice` está ahora en las líneas 1330 y 1610 del fichero de `main` (`facturar-parcial` y `convertir-en-factura`; antes 1310 y 1590). Los dos manejadores tocados, `PATCH /:id` y `POST /:id/firmar`, no llaman a ninguna. El diff no toca `buildFirmaEvidencia` ni lo sellado: el `where` de los dos `update` y qué se contesta si no casa.

**De paso, por el guard de SCRUM-411:** `ERROR_ALBARAN_CAMBIADO` y `ERROR_ALBARAN_CAMBIADO_AL_EDITAR` dejan de ser huérfanos (ya los importa la ruta) y salen de `tests/_huerfanos-declarados.mjs`.

**Lo que esto NO cierra, declarado:** en obra el cuerpo de la firma no lleva versión, así que el servidor no sabe qué contenido VIO el cliente. Esto garantiza que la evidencia y la fila hablan del mismo contenido; no que ése sea el que el cliente tenía delante. Si la oficina edita mientras la firma espera en la cola sin cobertura, al volver la red la cola la sube y entra sobre lo editado (`albaran_cambiado` no está en `RECHAZOS_DEFINITIVOS` de `public/dashboard/js/colaDeFirmas.js`, así que la firma no sale de la cola y el siguiente intento lee la versión nueva). Cerrarlo pide que el panel mande la `version` que pintó (carril S2) y una decisión sobre las firmas ya encoladas sin ella.

**NO medido:** contra un Postgres real (el doble imita el `P2025`) · en yaqu.app (la edición en medio no se provoca desde fuera con garantía).

## Sigue abierto en este ticket tras C

D y E, camino fiscal (J1). Los dos «NO TOCADO» de arriba.

# APÉNDICE · SCRUM-1302d: cuatro textos de las páginas que ve el cliente final (S4)

**Medido contra:** `origin/main` = `fc10ff9cb3b29eb18a5da552ec18f8c551eba7b7` · 2026-10-13T14:50:44Z
A9: comprobación → `tests/scrum1302d-textos-de-la-pagina-de-firma.test.mjs`

Carril S4 por ser texto puro (encargo del orquestador del 13-oct; los dos ficheros son de S1) · rama `scrum-1302d-textos-firmados-de-la-pagina-de-firma`.

**Skill UI:** no cargada · sólo cambian cuatro literales en dos páginas que sirve el servidor; ni una clase, ni un estilo, ni una etiqueta.

## Lo firmado

Aprobado por el orquestador por delegación del fundador, 13-oct-2026 — SCRUM-1302 comentario 19428. Ficha: `docs/microcopy/2026-10-13-SCRUM-1302-paginas-de-firma-del-cliente.md`.

| | antes | ahora | dónde |
|---|---|---|---|
| A | «⭐ Más popular» | «Recomendada» | la tarjeta de la opción con `recommended`, `quoteDecisionLanding.routes.ts` |
| B | «Error de conexión.» | «No hemos podido confirmar que tu firma haya llegado. Comprueba tu conexión y vuelve a intentarlo.» | el `catch` de la petición de firma, presupuesto y parte |
| C | «Error al procesar.» | «No se ha podido firmar. Inténtalo de nuevo.» | el texto de reserva del presupuesto |
| D | «Gracias, {nombre}. Recibirás tu copia por WhatsApp.» | «Gracias, {nombre}.» | las dos pantallas del parte firmado, `albaranPublic.routes.ts` |

D no es un texto nuevo: es una retirada. El envío de la copia es de mejor esfuerzo y lo corta el tope diario; la página no sabe si va a salir.

## La condición de la B, medida antes de construir

B aconseja reintentar. Se firmó a condición de medir qué pasa al reintentar cuando la primera firma sí llegó.

**Parte**, corriendo `POST /albaran/:token/firmar` de `dist` sobre `tests/_banco-firma-del-parte.mjs` (base doblada con una fila que recuerda; el PDF y el envío de la copia son contadores). Guion y salida: `docs/master/evidencias/SCRUM-1302/reintento-de-firma/reintento.mjs` y `reintento.txt`.

| caso | respuesta | escrituras | copias pedidas | queda |
|---|---|---|---|---|
| control: un parte emitido, una firma | 200 `{ok:true}` | 1 | 1 | el primer trazo |
| la primera llegó, se reintenta con lo mismo | 200 `{ok:true, already:true}` | 1 | 1 | mismo sello y misma fecha |
| se reintenta con otro trazo y otro nombre | 200 `already` | 1 | 1 | el primer trazo y el primer nombre |
| se reintenta con otra versión del parte | 200 `already` | 1 | 1 | el primer trazo |

**Presupuesto:** ya estaba sujeto en `tests/scrum1276-decision-no-reabre.test.mjs` (casos 4-5: 200 `already_accepted` sin escribir, sin aviso y sin historial; caso 7: dos a la vez, escribe una). Corrido hoy sobre esta rama: 9 de 9.

Con eso el orquestador confirmó que la B se construye (mensaje del 13-oct, tras la medición).

## 🔴 Hallazgo de servidor, NO arreglado aquí (es de S1)

En el parte, **dos peticiones a la vez** sobre un parte emitido (las dos leen `emitido` antes de que ninguna escriba) **escriben las dos**: 2 escrituras, 2 PDF, 2 copias pedidas, y quedan **el segundo trazo y el segundo nombre**. Las dos contestan 200 `{ok:true}`. El `update` de `albaranPublic.routes.ts` no lleva en su `where` la condición de estado que SCRUM-1276 puso en el del presupuesto.

No es el reintento de una persona que ha leído el aviso: para entonces la primera ya escribió, salvo que se quede atascada antes de su escritura. Y el camino existe igual con el texto viejo, porque el botón ya se reactivaba en el `catch`. Es el caso 2 del guion. El doble no tiene cerrojos: dice qué hace el código en esa carrera, no cada cuánto ocurre.

## Verificado, ejecutando

`tests/scrum1302d-textos-de-la-pagina-de-firma.test.mjs`: pide las dos páginas a sus rutas de `dist` y mira el HTML que sale; 8 tests.

- **Rojo antes** (con el `dist` de `origin/main`): 4 de 8. Caen A, B+C del presupuesto, B del parte y D, cada uno enseñando el texto viejo; pasan el control de las sondas, «sin opción marcada no hay insignia» y los dos del reintento.
- **Verde después:** 8 de 8.
- **Una sonda mía estaba ciega y lo cazó el rojo:** la primera versión de la sonda de B se quedaba con el rótulo del botón, que el mismo `catch` reescribe antes, y daba rojo por otra cosa. Ahora se ancla en `#sig-error` dentro del último `catch`, y el control lleva ese rótulo delante.
- **D, como retirada:** en las dos páginas del parte, medidas enteras, antes había una frase con «copia», «recibirás» o «WhatsApp» (la retirada) y ahora ninguna.
- `tests/scrum264-copy-que-llega-al-cliente.test.mjs` cambia una línea: su `porDefecto` de la landing es el literal C. La propiedad que mide (el mensaje humano gana al código) no cambia.

- **La tanda dirigida** (`npm run tanda:dirigida`, en dos tramos) se corrió entera sobre `875d665c42a055a09d05d75bc3bd580b03c82744`: 377 ficheros, 3.671 tests, 1 caído y ciego por entorno de esta máquina (SCRUM-1321, el temporal en otra unidad), veredicto verde. `main` se movió 12 commits después (traía `quotes.routes.ts` y el esquema): sobre el ancla de arriba se volvieron a correr 18 ficheros, los de estas dos páginas y los guards del registro y de las evidencias (158 de 158), y `guards:entrada`. La dirigida entera NO se repitió sobre el ancla.

**NO medido:** yaqu.app con esto desplegado (se mira cuando mergee) · un navegador de verdad con la red cortada a mitad de la firma · la carrera de las dos peticiones contra una base real.

## Lo que la firma no cubre, y cómo queda

- En el parte, el texto de reserva sigue siendo «No se pudo firmar. Inténtalo de nuevo.», que no es el literal C. El comentario 19428 dice que C «unifica»; cambiar también éste es estirar la firma, y se pregunta.
- Con «Acepto sin firmar» marcado en el presupuesto, C dice «No se ha podido firmar» de una aceptación sin trazo. El botón se sigue llamando «Firmar y aceptar», así que no desentona con la página; queda dicho.
- El guion de las dos páginas lleva comentarios de código que se sirven al navegador (ya los había). Los dos que añade esta rama no nombran ficheros ni tests.

# APÉNDICE · SCRUM-1302e: la reserva del parte dice lo mismo que la del presupuesto, y dos guiones a salvo (S4)

**Medido contra:** `origin/main` = `1ef32907a2e7fb162a5d9b95ab7e887a4cfb35a0` · 2026-10-13T15:25:14Z
A9: comprobación → `tests/scrum1302d-textos-de-la-pagina-de-firma.test.mjs`

Carril S4 por ser texto puro (encargo del orquestador del 13-oct; el fichero es de S1) · sesión `s4-13octf` · rama `scrum-1302e-la-reserva-del-parte-dice-lo-mismo`. El #2395 (SCRUM-1302d, arriba) entró a las 15:10:04Z; esto es lo que el comentario 19454 firmó después y no llegó a tiempo de ir dentro.

**Skill UI:** no cargada · cambia un literal en una página que sirve el servidor.

## Lo firmado

Aprobado por el orquestador por delegación del fundador, 13-oct-2026 — SCRUM-1302 comentario 19454, punto 4. Ficha: `docs/microcopy/2026-10-13-SCRUM-1302-paginas-de-firma-del-cliente.md`, que ya llevaba el literal para el presupuesto.

| | antes | ahora | dónde |
|---|---|---|---|
| C, parte | «No se pudo firmar. Inténtalo de nuevo.» | «No se ha podido firmar. Inténtalo de nuevo.» | el texto de reserva de `albaranPublic.routes.ts`, detrás de `d.message` |

Lo que el mismo comentario dijo y NO se ha aplicado, con su motivo:

- **El final «Inténtalo otra vez.» (punto 5): anulado.** El orquestador lo retiró el mismo día en SCRUM-1215 comentario 19460, con la medida del puesto de front delante: «Inténtalo de nuevo.» está en 24 sitios del panel y «otra vez» en 7. Esta sesión llegó a escribir el cambio en su árbol, no lo empujó, y lo deshizo al recibir la anulación. En `main` no ha estado nunca.
- **«Firmar» cuando se acepta sin trazo:** la regla es que el aviso nombra la acción que nombraba el botón. El botón del presupuesto dice «Firmar y aceptar» con la casilla marcada o sin marcar, así que el aviso se queda como está.

## Verificado, ejecutando

`tests/scrum1302d-textos-de-la-pagina-de-firma.test.mjs` gana un test y una sonda con su control: 9 tests. El test pide la página del parte a su ruta de `dist`, lee el texto de reserva y lo compara con el literal y con el que pinta la página del presupuesto.

- **Rojo antes** (el fichero de `origin/main` puesto de vuelta y compilado): cae 1 de 26 entre este fichero y `scrum264`, el test nuevo, enseñando «No se pudo firmar. Inténtalo de nuevo.».
- **Verde después** (cambio repuesto, `git status` limpio, `npm run build` con código 0): 26 de 26.
- **Los que leen estas páginas, las fichas, las evidencias o el registro:** 424 ficheros, 4.123 tests, 4.095 pasan, 27 saltados y 1 caído: `scrum854`, que pedía esta misma entrada de registro antes de que estuviera escrita. Repetido con la entrada puesta: ver el comentario de entrega. La tanda dirigida entera NO se ha corrido.
- **De paso, un rojo propio que cazó esa misma tanda en la versión que no se empujó:** una ficha de microcopy que nombraba a otra por su fichero es un índice a mano (`scrum709`). La versión empujada no lo hace: el literal del parte se apunta en la ficha que ya lo tenía.

## Dos guiones que vivían fuera de git, ahora a salvo

- `docs/master/evidencias/SCRUM-1302/revision-vieja/`: el defecto del enlace de una revisión antigua (comentario 19451). Con una .1 en el grupo, el enlace de la .0 pinta el formulario con el total de la vieja y el `POST` acepta con 200; preguntas por el grupo, 0, con el contador comprobado a mano. Vuelto a correr hoy sobre este árbol: mismo resultado. Es el control de lo que se construya.
- `docs/master/evidencias/SCRUM-1302/crear-revision-no-avisa/`: qué le dice el panel al profesional al pulsar «Crear revisión». Con la ficha real del presupuesto montada entera y una versión enviada y sin decidir: ninguna pregunta antes del POST, un POST con un solo clic, la sección «Revisiones» dice lo mismo antes, durante y después («Esta es la única versión.» y el botón), ninguno de esos textos nombra el enlace, y al terminar la pantalla va a la ficha de la revisión nueva sin mensaje. La primera versión de la sonda estaba ciega (el banco de vistas no agrega el texto de los hijos) y la cazó su propio control positivo, que salió rojo.

## Sigue abierto en este ticket tras 1302e

- **La página del enlace de una revisión antigua NO está construida.** Los literales y la conducta están firmados en el comentario 19454, con una condición: el panel tiene que decírselo al profesional al crear la revisión, y hoy no lo dice. El aviso del panel está propuesto para firmar en el comentario 19456. Las dos mitades entran juntas o no entra ninguna.
- Rechazar el `POST /quote/:token/decision` de una revisión no vigente es de S1.
- D y E de la tabla del comentario 19449 siguen vivos y cruzan a J1.

**NO medido:** yaqu.app con el #2395 desplegado · la ficha de la revisión nueva tras navegar · un clic en «Crear revisión» en yaqu.app.

# APÉNDICE · SCRUM-1302m: el total y la leyenda «IVA NO INCLUIDO» del PDF del presupuesto (J1)

**Medido contra:** `origin/main` = `1d338a5ae8afa6166282c28e7a8c818c5375a856` · 2026-10-14T01:54:29Z
A9: comprobación → `tests/scrum1302m-el-total-y-la-leyenda.test.mjs`

Sale del hallazgo 1 de la entrega de S4 (comentario 19428 de este ticket): el PDF decía «Total 121,00» y, debajo,
«IVA NO INCLUIDO», con el IVA dentro de ese total. El fundador autorizó tocar SÓLO el PDF; lo demás del IVA
(SCRUM-1438 y SCRUM-1439) sigue parado y aquí no se toca.

## Cuál de los dos estaba mal

**La cifra, no la leyenda.** Fabricado y leído, no razonado: `docs/master/evidencias/scrum1302m/medicion.mjs`
arma la fila, calcula su total con `calcTotal` (lo que hace `POST /quote/create`), genera el PDF por
`paramsDePresupuestoParaPdf` → `generateQuotePdf` y lee el texto del fichero. Una línea de 100,00 al 21 %:

| modo | lo guardado | lo que decía el PDF | lo que dice ahora |
|---|---|---|---|
| `sumar` | 121,00 | línea 121,00 · Base imponible 100,00 · IVA 21% 21,00 · Total presupuesto 121,00 | igual |
| `no_incluido` | 121,00 | línea 121,00 · **Total presupuesto 121,00 · IVA NO INCLUIDO** | línea 100,00 · Total presupuesto 100,00 · IVA NO INCLUIDO |
| `no_incluido`, línea al 0 % | 100,00 | Total presupuesto 100,00 · IVA NO INCLUIDO | igual |
| sin modo (anterior a la casilla) | 121,00 | como `sumar` | igual |

Las salidas enteras: `antes-sobre-1d338a5ae.txt` y `despues.txt`, en esa carpeta.

- **La leyenda es el modo funcionando.** `no_incluido` es un modo declarado (SCRUM-656): el profesional lo elige
  en el editor y el documento de referencia dice «TOTAL 987,00 € · IVA NO INCLUIDO», con un total sin impuesto.
- **El total guardado no está mal calculado.** `Quote.total` lleva el IVA de sus líneas en los dos modos, a
  propósito («el modo no cambia ni un céntimo», `presentacionIva.ts`), y es lo que se cobra.
- **El defecto era del PDF:** en ese modo pintaba el guardado a secas, y también el importe de cada línea y el de
  cada opción con el IVA sumado, encima de una leyenda que dice que no lo llevan.

## Lo construido — sólo `pdf.service.ts`, sólo el presupuesto

En `no_incluido`, los importes del papel van sin impuesto: el de cada línea, el de cada línea y el total de cada
opción, y «Total presupuesto». El total sigue saliendo del guardado: se le resta el IVA que lleva dentro, que es
`calcTotal` con los tipos de las líneas menos `calcTotal` con los tipos a cero (`ivaDentroDelImporte`). No hay
aritmética nueva ni texto nuevo: los rótulos y la leyenda son los que había.

En `sumar` y sin modo el papel sale idéntico. La factura no lo conoce (lo comprueba el test, por AST).

## Verificado, ejecutando

- `tests/scrum1302m-el-total-y-la-leyenda.test.mjs`: ocho casos, con céntimos, dos tipos, descuento de línea y
  global, y tres opciones. Las bases esperadas están calculadas a mano en el propio test.
- **Visto en rojo:** `mutaciones.mjs` quita el arreglo en cinco trozos; la base sale verde y las cinco caen
  (`mutaciones.txt`, con el `diff --numstat` de cada una).
- **La tanda dirigida** (`npm run tanda:dirigida`, sobre la base `1d338a5a`) cazó dos rojos de este mismo cambio
  antes de empujar, y los dos se arreglaron en el código: el test usaba el merchant demo como fixture
  (`scrum409`) y la función nueva estaba colocada donde `scrum603b` la cuenta como cuerpo de la factura; ahora
  vive al final del fichero. Quedan en rojo en este árbol, sin relación con el cambio, `scrum476` (el árbol no
  tiene `node_modules` propio) y dos casos de `scrum1298b` (miden el árbol principal de esta máquina): no se han
  corrido sobre la base para confirmarlo.

## Lo que este arreglo NO decide, y queda a la vista

- **La columna «IVA%» de la tabla sigue pintando el tipo de cada línea** («21%») también en `no_incluido`. No
  contradice a la leyenda, pero `presentacionIva.ts` dice que ese documento «no afirma cuánto será el impuesto».
  Quitarla es maqueta y decisión de producto; no se ha tocado.
- **El papel y la página pública enseñan ahora cifras distintas del mismo presupuesto**, y las dos son ciertas:
  el PDF, 100,00 sin IVA; la página donde el cliente firma, 121,00 «IVA incluido» (medido por S4, comentario 19428;
  aquí no se ha vuelto a medir). Es la página de S1 y cae en lo parado de SCRUM-1438.
- **Lo que se cobra no cambia:** sigue siendo el guardado, con IVA.
- El importe de línea de la tabla no aplica el descuento de línea (`qty × price`); ya era así y no es de este
  encargo.

**NO medido:** yaqu.app (nada de esto está desplegado) · el `POST /quote/create` de verdad contra una base (se usó
su misma función de total, no la ruta) · un presupuesto real de producción en `no_incluido` (no se sabe si existe
alguno) · el PDF abierto en un visor: se leyó su texto, no su maqueta.

# APÉNDICE · SCRUM-1302n: el banco de 1302m, y el de SCRUM-1544, al catálogo del meta-guard (J1)

**Medido contra:** `origin/main` = `cb30885dd69c4df7f33d3a0066fed93698926857` · 2026-10-14T02:30:35Z
A9: comprobación → `tests/scrum1387-banco-nuevo-va-al-catalogo.test.mjs`

Este tramo no cambia el arreglo del PDF: trae la rama de 1302m por `git merge` (su PR, el #2408, queda
sustituido por el de esta rama) y da de alta su banco de mutación donde el guard de SCRUM-1387 lo pide.

## Lo que se encontró: el guard cazaba DOS bancos, y uno ya estaba en `main`

El obligatorio del #2408 caía en «ningún banco de mutación nuevo queda fuera del catálogo». Corrido en local,
el guard nombró dos carpetas, no una:

- `docs/master/evidencias/scrum1302m/mutaciones.mjs`, el de la rama que se trae;
- `docs/master/evidencias/SCRUM-1544/mutaciones.mjs`, que **ya estaba en `main`**.

El guard entró con el PR #2406 (`bc5fa21ee`, 2026-10-14T02:04:37Z) y el banco de SCRUM-1544 con el PR #2407
(`cb30885dd`, 2026-10-14T02:08:10Z): un commit después del corte. El obligatorio del #2407 había corrido antes
de que el guard existiera en `main`, así que pasó. No es un descuido de nadie: es la ventana de estrenar un
guard, y volverá a darse con el siguiente. **Medido, no deducido:** el guard corrido sobre un árbol aparte fijado
a `origin/main` `cb30885dd` cae nombrando sólo la carpeta de SCRUM-1544. Mientras eso no se registrara, caía el
obligatorio de cualquier PR, no sólo el de 1302m.

## Lo que pide el guard, leído en `tests/_catalogo-obligatorio.mjs`

Un banco es una carpeta de evidencias con algún fichero con «mut» en el nombre; está fuera si tiene guion
(`.mjs`) y ninguno nombra el catálogo. El alta es que el test del ticket exporte `MUTACIONES_QUE_ME_TUMBAN` y el
guion las tome de ahí. No hay lista de excepciones, y no se ha tocado ni el guard ni su catálogo.

## Lo hecho

- `tests/scrum1302m-el-total-y-la-leyenda.test.mjs` exporta las cinco mutaciones del banco (mismos `de` y `a` que
  llevaba el guion). Sus ocho casos no cambian. Cada una nombra ahora UN caso que tiene que caer.
- `tests/scrum710b-anclaje-por-identidad.test.mjs` exporta las cinco del banco de SCRUM-1544, trasladadas tal
  cual: mismo fichero, `de`, `a` y `cae`. Cruce de puesto (el ticket es de J6) autorizado por el orquestador de
  Javier por el canal, el 14-oct-2026; los ficheros no tienen fila en `dos-equipos.md` §3.
- Los dos guiones dejan su lista propia y leen la del test con `mutacionesDeclaradas` del meta-guard, que es el
  lector que usa el CI. El de 1302m exige ahora que caiga el caso nombrado, no «alguno».

**Por qué no es un esquive.** Nada sale del alcance del censo: las carpetas, los nombres de fichero y los guiones
siguen donde estaban. Lo que cambia es que las diez mutaciones las ejecuta `npm run meta:mutaciones` en el CI en
cada PR, y que borrar una declaración lo denuncia el suelo contra `main` de SCRUM-810.

## Verificado, ejecutando

- **En rojo primero:** el guard, antes de tocar nada, con las dos carpetas nombradas; y sobre `origin/main`
  limpio, con una.
- **En verde después:** el mismo guard, sobre este árbol (la población y el recuento van en la entrega).
- **Las diez mutaciones caen** por los dos caminos: los dos guiones (`mutaciones.txt` y `mutaciones-salida.txt`,
  regenerados) y el camino del meta-guard (`correr` + `aplicarUna`, con un guion de fuera del árbol que pasa sólo
  estos dos tests): diez VIVAS, cero ciegas, cero mudas, con la pasada limpia en verde antes.
- El test del PDF sigue cazando sus cinco: la base, ocho casos en verde; cada mutación, su caso nombrado en rojo.

**NO medido:** `npm run meta:mutaciones` entero (el del CI, con todas las declaraciones de la casa) · la tanda
completa de `npm test` · yaqu.app (este tramo no despliega nada que se vea).

# APÉNDICE · SCRUM-1302p: el enlace de una revisión antigua deja de aceptar, y el panel lo avisa antes de crearla (S4)

**Medido contra:** `origin/main` = `e2be1c9fda3b5ceac853b4d376f5664ac8e4df67` · 2026-10-14T08:13:22Z (`Date:` de GitHub)
A9: comprobación → `tests/scrum1302p-la-pagina-de-una-revision-antigua.test.mjs`

Sesión `s4-14oct` · rama `scrum-1302p-el-enlace-de-una-revision-antigua`. El sufijo era `1302o` y pasó a `1302p` antes de empujar, por aviso del orquestador: S1 tenía `1302o` en otra rama al mismo tiempo, y los dos sin empujar.

**Carril.** Las dos mitades en un solo PR, construidas por S4, por decisión del orquestador (SCRUM-1302 c.19475, repetida en el encargo del 14-oct-2026): `quoteRevisiones.js` es de S2 y `quoteDecisionLanding.routes.ts` de S1, con la excepción dada sólo para este cambio. Motivo, del propio orquestador: repartir un cambio cuyas mitades sólo valen juntas es la forma de que se mergee una sola. ⛔ El `POST /quote/:token/decision` (rechazar la decisión sobre una no vigente) es de S1 y no se ha tocado.

**Skill UI:** cargada (`yaqu-premium-ui`) antes de tocar `public/dashboard/css/styles.css` y `public/dashboard/js/quoteRevisiones.js`. Sin tokens nuevos: el aviso usa el ámbar de `.aviso-sin-cobertura` y los `.btn` de siempre; ni un `style=` nuevo.

## Lo firmado

- La página: T1, T2, T3 (con la enmienda del orquestador) y los siete puntos de conducta, SCRUM-1302 c.19454. Ficha: `docs/microcopy/2026-10-13-SCRUM-1302-enlace-de-revision-antigua.md`.
- El aviso del panel: W1, W2 y su conducta, sin estrechar a `sent`, SCRUM-1302 c.19475 sobre la propuesta de c.19456. Ficha: `docs/microcopy/2026-10-13-SCRUM-1302-aviso-al-crear-revision.md`.

## Lo construido — qué líneas toca, para no pisar a S1

- `src/modules/quotes/domain/versionMasReciente.ts` (nuevo): `tieneVersionMasReciente(q, merchant)` y `ESTADOS_CON_ENLACE_VIVO`. Pregunta con `prisma.quote.count` por el grupo de `whereDelGrupo` (negocio, año de la serie, número) con `revision > n`. Sin número no hay grupo. Si la consulta falla, LANZA: «no he podido mirar» no pinta el formulario. **Está hecho para que el `POST` de S1 lo use con la misma condición.**
- `quoteDecisionLanding.routes.ts`: un import; la función `paginaDeVersionAntigua` (justo encima de `loadQuote`); en el `GET /quote/:token`, una comprobación justo antes del bloque de caducado; en el `GET /quote/:token/reject`, una comprobación justo después de la de «ya decidido». **Nada del `POST /quote/:token/reject` ni de ningún otro manejador.**
- `src/core/i18n/locales.ts`: dos campos por país, `quoteUpdatedTitle` y `quoteHasNewer`, frases enteras como los títulos de SCRUM-1476.
- `public/dashboard/js/quoteRevisiones.js`: `TEXTOS_AVISO` y `ESTADOS_CON_ENLACE_VIVO` aparte de `TEXTOS` (el bloque de SCRUM-688 no se toca); el botón lleva `data-revision-avisa` con el número de la vigente si está en `draft`, `sent` o `expired` (`expired` desde c.19636, abajo); `pintarAvisoDelEnlace`; el cableado crea al segundo clic. El foco pasa a «Cancelar» al abrir el aviso, para que un segundo Intro sin leer no cree la revisión.
- `public/dashboard/css/styles.css`: `.revision-aviso`.

## Cambio de conducta a propósito en tests de otros (declarado)

- `scrum1150b`, `scrum1215-revisiones-error-crear` y `scrum988`: pulsaban «Crear revisión» una vez y esperaban el POST. Con la vigente enviada o en borrador, el primer clic ahora avisa; los tres pulsan después el «Crear revisión» del aviso, y exigen que exista (si falta, caen con «CIEGO»). Lo que miden después no cambia.
- `scrum1001`, `scrum1431-tarjeta-sin-claim-de-iva`, `scrum1444` y `scrum1476`: doblaban sólo `prisma.quote.findUnique`, y la página pregunta ahora también por el grupo. Se les dobla `prisma.quote.count` a 0 («no hay versión más reciente»), que es el caso que modelan, y se restaura en el mismo `finally`.

## Verificado, ejecutando

- **Los dos tests nuevos:** el del panel, 9 de 9; el de la página, 11 de 11. Cada uno con su CONTROL POSITIVO dentro: con la vigente aceptada o rechazada, la misma sonda ve el POST salir al primer clic; el enlace de la vigente sigue pintando el formulario.
- **Rojo con cada mutación** (`git diff --numstat` 1 1 en cada una, restaurada con `git restore --source=HEAD` y `git status` limpio): el botón sin aviso → 6 de 9 caen; estrechado a `sent` → 2 de 9 (el de borrador y el de «mismos estados»); la página sin hacer caso a la pregunta → 5 de 11; el grupo sin el año de la serie → 1 de 11 (el del año). Dos de cada fichero quedan declaradas en `MUTACIONES_QUE_ME_TUMBAN` para el meta-guard (`--solo-censo`: 559 declaraciones, salida 0).
- **Los guiones de ayer, vueltos a correr sobre este árbol** (`despues-1302p.txt` junto a cada uno): el `GET` del enlace de la .0 ya no pinta el formulario y pregunta por el grupo 1 vez; el panel avisa con W1 y W2 y no hace ningún POST al primer clic. El control 0 del guion del panel ahora cae, y es lo esperado: pulsaba una vez para provocar un fallo del POST, y el primer clic ya no lo hace.
- **El `POST` de aceptar con el enlace de la .0 sigue contestando 200** (mismo guion): es la mitad de S1, y hasta que entre, un cliente que fabricara el `POST` a mano todavía podría aceptar la vieja. La página ya no le ofrece el formulario.

## Lo que queda sin hacer, y de quién

- Rechazar el `POST /quote/:token/decision` de una no vigente: S1, con `tieneVersionMasReciente` ya disponible.
- ~~La concordancia en femenino de T1 y T2~~ → firmada en c.19636 (abajo).
- ~~Una versión antigua con `status = 'expired'` sigue pintando la página de caducado~~ → ampliado en c.19636 (abajo).
- El PDF del enlace antiguo (`GET /quote/:token/pdf`) se sigue sirviendo: la conducta firmada habla de la página, no de esa ruta.

- **Tanda amplia** (los ficheros de test que leen estas páginas, el panel, los locales, el dominio de presupuestos, las fichas, las evidencias o los registros; `--test-concurrency=3`, `FORCE_COLOR` borrado, 3.529 MB libres): **427 ficheros, 4.019 tests, 3.982 pasan, 34 saltados, 3 caídos, los tres míos**, y arreglados en el código: `scrum411` (`ESTADOS_CON_ENLACE_VIVO` exportado sin llamador: deja de exportarse) y `scrum553` (cuatro extractores de mi test con el `>` pegado: aceptan atributos). Esos dos ficheros y los dos míos, otra vez: 61 de 61.

**NO medido:** yaqu.app (este PR no ha mergeado al escribir esto) · la suite completa de `npm test`.


---

# SCRUM-1302r · el `POST /quote/:token/decision` rechaza la versión no vigente (S1)

**Medido contra:** `origin/main` = `099cfd383764b8cd87ab78e9ef7df8ca57a206a7` · traído a la rama en el merge `4ecebfea5` (2026-10-14T16:24:16Z); la tanda completa corrió después, sobre ese árbol. Lo escribe S1.
A9: comprobación → `tests/scrum1302r-el-post-rechaza-la-version-vieja.test.mjs`

**Lo que faltaba de este defecto** (c.19636 punto 3, c.19656): con una .1 en el grupo, un `POST` fabricado con el token de la .0 todavía ACEPTABA (200). La página ya no ofrecía el formulario (1302p), la API sí.

**Lo firmado que se aplica:** que el `POST` rechace, con `message` = T2 y T3 seguidos (propuesta de S4 en c.19451; firmada en c.19454 punto 6 y repetida en c.19636 punto 3). **Ningún texto nuevo.** Ningún comentario fija el código HTTP: va un **409**, como el de «ya decidido» de la misma ruta (SCRUM-1276), con un `error` propio, `quote_has_newer_version`, para no decir «ya decidido» de algo que no lo está.

## Lo construido

- `src/modules/quotes/domain/versionMasReciente.ts`: T3 pasa a `fraseDeLaVersionAntigua(negocio)`, la fuente única para la página y para el `POST`; `mensajeDeVersionMasReciente(quoteHasNewer, merchant)` = T2 + T3; `ERROR_VERSION_NO_VIGENTE`. **No se toca `tieneVersionMasReciente`**: la ampliación a `expired` es de #2451 (S4), que entró antes que esto y el `POST` ya la hereda (test: una .0 en `expired` habiendo .1 → 409).
- `quotes.routes.ts`, `POST /:token/decision`: la misma pregunta que la página, **después** de los 200 idempotentes y **antes** del caducado (punto 5). Vale para `accept` y `reject` (punto 7). Una aceptada o rechazada no cambia (punto 6: la pregunta la deja fuera). Si la consulta falla, LANZA y la ruta da 500: nunca acepta a ciegas.
- `quoteDecisionLanding.routes.ts`: la página pinta T3 desde la función (mismo HTML; `scrum1302p`, 11 de 11), y sus dos manejadores del 409 (el `fetch` de aceptar y el `POST /quote/:token/reject`) tratan `quote_has_newer_version` como «ya decidido»: recargan, y sale el aviso de la versión antigua. Es el caso de una revisión creada con la página ya abierta.

## Tests de otros que cambian (declarado)

`scrum1202`, `scrum892`, `scrum887c` y `scrum1370b` doblaban `prisma.quote` sin `count`, o con una fila sin `createdAt` ni `seriesYear`, y la ruta ahora pregunta por el grupo (que es por año). A los tres primeros se les dobla `count` a 0 («no hay versión más reciente», el caso que modelan); a `scrum1202` y `scrum1370b` se les pone el `createdAt` que una fila real siempre trae. Lo que miden no cambia.

## Verificado, ejecutando

- `tests/scrum1302r-el-post-rechaza-la-version-vieja.test.mjs`: 8 de 8, con CONTROL POSITIVO (la vigente se acepta, y el banco ve la pregunta por el grupo y la escritura).
- **Rojo con la mutación** (`if (false && await tieneVersionMasReciente…`, que es la conducta de `main`): **6 de 8 caen**; siguen verdes los dos controles del otro lado (aceptada idempotente, .1 de otro año). Restaurada y recompilada. Declarada en `MUTACIONES_QUE_ME_TUMBAN`.
- Los 29 ficheros que pasan por estas rutas: en verde tras arreglar los 4 dobles de arriba.

## Lo que NO cubre

- **El camino del bot** (`whatsappIncoming.routes.ts`, de J2) no pasa por este `POST`. No lo he medido.
- `GET /quote/:token/pdf` de la antigua sigue sirviéndose (ya declarado arriba por S4).
## Seguimiento (SCRUM-1302q): las dos firmas de c.19636

**Medido contra:** `origin/main` = `4f487bb177c42a7ee02042b0029f8c90b7e9e77e` · 2026-10-14T08:53:25Z (`Date:` de GitHub). Relevo de S4 (la tanda anterior salió a 347k). Iba a ir en #2445, que a las 08:53Z seguía sin mergear; entró entre el commit y el push, así que va en un PR de seguimiento, rama `scrum-1302q-expired-en-el-enlace-vivo` (el commit de código conserva el asunto `SCRUM-1302p`, escrito antes).

- **Concordancia en femenino:** ya estaba aplicada en `locales.ts` y atada por el test del país de «cotización». No cambia código; sólo la ficha, que la daba por «sin firmar».
- **`expired` entra en la condición**, en las dos mitades a la vez (`versionMasReciente.ts` y `quoteRevisiones.js`); el test de «mismos estados» exige ahora `['draft', 'sent', 'expired']`. Motivo, del propio orquestador: el punto 1 (`draft`/`sent`) y el punto 5 (va antes que el caducado) no podían cumplirse a la vez con una vieja ya barrida por el cron. ⛔ Aceptado y rechazado siguen fuera.
- **Rojo antes del cambio:** con los tests nuevos y el código sin tocar, 3 de 22 caen (la .0 `expired` habiendo .1 en la página, la vigente `expired` en el panel, y «mismos estados»). Con el cambio, 22 de 22. El test de la página trae su control: la misma .0 caducada SIN .1 sigue diciendo «caducó».
- **Mutaciones nuevas, declaradas:** M3 en cada fichero (quitar `expired`). La M2 del panel (estrechar a `sent`) cambia su `de`/`a` para casar con la línea nueva.
- **Riesgo declarado de W1 con una vigente caducada:** «el enlace de {número} dejará de valer» — ese enlace ya no dejaba aceptar (caducó); lo que cambia es lo que dice. Es el mismo caso que ya existía con una `sent` vencida que el cron no ha barrido, y W2 sigue siendo cierto. No pido texto nuevo.
- **De paso, en el código:** el comentario de `versionMasReciente.ts` citaba un test que no existe (`scrum1302p-el-enlace-de-una-revision-antigua`); ahora nombra el que lo ata.
- **Tanda dirigida:** los 81 ficheros de test que nombran la página, el panel de revisiones, `versionMasReciente` o revisiones: 756 tests, 749 pasan, 7 saltados, 0 caídos.
- **Error propio (14-oct 15:50Z):** este tramo se empujó sin su línea A9 y el obligatorio de #2451 cayó por eso (`not ok 1597`, `docs/master/SCRUM-1302.md:678 · ancla del 2026-10-14 sin línea «A9:»`; ni `scrum1405c` ni nada ajeno: leído en el log del job 115768836190). La tanda dirigida elegía los tests por lo que nombran del código, y el que lee los registros no nombra nada de eso.

A9: comprobación → `tests/scrum1294-a9-leccion-en-a10.test.mjs`


---

# SCRUM-1302s · dos firmas a la vez sobre la misma ranura del PARTE: escribe una (S1)

**Medido contra:** `origin/main` = `099cfd383764b8cd87ab78e9ef7df8ca57a206a7` · 2026-10-14T16:36:49Z (`Date:` de GitHub, la de las dos salidas de la sonda). Lo escribe S1.
A9: comprobación → `tests/scrum1302s-dos-firmas-del-parte-a-la-vez.test.mjs`

**El tercer sitio del patrón** de 1302j (firma remota) y 1302k (albarán en obra), encargado por el orquestador el 14-oct-2026: «medirlo igual; si no reproduce, se cierra el cabo».

**REPRODUCE, medido con el código de `main`** (`evidencias/SCRUM-1302/partes-dos-a-la-vez/salida-main.txt`, sonda `sonda.mjs` con la ruta real de `dist` y un doble del `update` fiel al `where`). Dos `POST /admin/partes/:id/firmar` a la vez → **200 y 200, 2 escrituras**, y en la fila queda el SEGUNDO nombre y trazo. El primero recibió un 200 de una firma que ya no está. `/firmar-tecnico`, igual. Controles en la misma sonda: una firma sola escribe 1 vez; una segunda posterior ya daba 409.

## Lo construido

- `src/modules/jobs/app/routes/partes.routes.ts`: la ranura leída vacía va en el `where` (`firmadoAt: null` en `/firmar`, `firmadoTecnicoAt: null` en `/firmar-tecnico`). Quien llega tarde (P2025) relee con tenancy y recibe lo que ya contestaba la puerta de arriba: `409 parte_locked` con el mismo motivo (`puedeFirmarCliente` / `puedeFirmarTecnico`). La cola de firmas lo trata como ÉXITO al drenar. **Ningún texto nuevo.** Si la fila sigue ahí con la ranura vacía (no debería), LANZA → 500, nunca un 409 que la cola daría por bueno.
- **El sello no se toca:** `computeParteContentHash` y su entrada son los mismos; sólo cambia la condición de la escritura.

## Verificado, ejecutando

- `tests/scrum1302s-dos-firmas-del-parte-a-la-vez.test.mjs`, 6 de 6: control positivo por ranura; carrera en cada ranura (1 escritura, gana la primera, la otra 409 con el motivo literal); **cliente y técnico a la vez entran los dos** (ranuras distintas, mismo sello); secuencial como antes.
- **Rojo con cada mutación** (la condición fuera del `where`): M1 tumba la carrera de `/firmar`, M2 la de `/firmar-tecnico`, una cada una. Restauradas y recompiladas. Declaradas en `MUTACIONES_QUE_ME_TUMBAN`.
- La sonda contra esta rama (`salida-1302s.txt`): 200 y 409, 1 escritura, queda la primera.
- Los 9 ficheros de test que cargan `partes.routes.js`: 72 de 72.

## Lo que NO cubre

- **Editar el parte mientras se firma** (lo que 1302o cerró en el albarán con `version`): `ParteTrabajo` no tiene columna `version`, y la firma ya congela el contenido. No lo he medido.
- **En producción: NO lo he intentado.** Haría falta un parte sin firmar en la cuenta QA y dos `POST` simultáneos desde una sesión con escritura; con la prueba de la cuenta caducada (12-oct) no he comprobado si deja crear un parte.
## SCRUM-1302t: el 5xx al aceptar (firma de c.19719)

**Medido contra:** `origin/main` = `56d53be5cf2df7bac82c6891960095fdbc849c94` · 2026-10-14T16:48:07Z

Lo medido en c.19714: con un 5xx, la landing pintaba bajo la firma el código crudo `internal_error`, y ese 500 también sale después del commit. El orquestador no firmó el literal B que propuse (aconseja repetir lo que puede estar hecho) y firmó otro en c.19719, **con una condición: volver a abrir el enlace tiene que enseñar el estado decidido.**

- **Código:** en `quoteDecisionLanding.routes.ts`, una rama `res.status >= 500` antes de la genérica, con `COPY_RESPUESTA_SIN_CONFIRMAR` («No hemos podido confirmar tu respuesta. Vuelve a abrir el enlace para ver si se ha guardado.», `// APROBADO · SCRUM-1302 comentario 19719`). Vale para cualquier 5xx, lleve el cuerpo que lleve: un 502 del proxy tampoco sabe si se guardó. Los 4xx, el 409 «ya decidido» y la red caída no cambian. Ficha: `docs/microcopy/2026-10-14-SCRUM-1302-el-5xx-de-la-aceptacion.md`.
- **La condición, comprobada ejecutando la ruta real** (`dist`, base doblada), no leyendo: el enlace de un aceptado pinta «Ya aceptaste este presupuesto…» sin formulario, también con la validez ya pasada (`isQuoteExpired` sólo mira `sent`); el control, el mismo enlace sin decidir, pinta el formulario. **En yaqu.app no se pudo mirar:** la cuenta QA sólo tiene borradores (202-208), la API del panel no expone el token del enlace, y crear uno aceptado está BLOQUEADO (prueba caducada, 403 `trial_expired`).
- **Test:** `tests/scrum1302t-el-5xx-de-la-aceptacion.test.mjs` EJECUTA el `<script>` del botón que sale en el HTML servido, con un `fetch` doblado (500, 502 sin JSON, 503 con texto). **Rojo antes del cambio (el control positivo de la firma):** con el código de hoy, el 500 enseña `internal_error`; caía sólo ese test y pasaban los otros tres. Con el cambio, 4 de 4.
- **Mutaciones declaradas y ejecutadas a mano** (mutar, compilar y ver qué cae): M1 (la rama del 5xx no se alcanza) tumba «un 5xx al aceptar enseña el literal firmado…»; M2 (el aceptado vuelve al formulario) tumba «LA CONDICIÓN…». Cada una, sólo la suya.
- **`scrum264` no se toca:** su fila ACEPTAR extrae la expresión de los 4xx (`data.message || data.error || C`), que sigue igual. La rama nueva escribe por `aviso.textContent`, y por eso su patrón no la ve: **esa fila sigue sin modelar el 5xx, y el que lo modela es el test de 1302t.** Lo declaro para que nadie lea el verde de `scrum264` como cobertura del 5xx.
- **Primer rojo del test, mío y del instrumento:** el token `'r'×32` no pasa `parseToken` y la página salía en 404; cayeron los cuatro, controles incluidos. Por eso aquel rojo no valía, y lo repetí con un token hexadecimal.
- **Tanda amplia** (todo test que lee `docs/master`, `docs/microcopy`, `docs/equipo` o la landing): **la cortó el sistema por falta de memoria**, con 3.717 pasados y 5 caídos hasta ese punto; no sé cuántos ficheros quedaban. De los 5: `scrum553` era MÍO (mi extractor `<script>` con el `>` pegado; ahora `<script[^>]*>`, y 20/20 junto con el mío). Los otros cuatro cayeron como fichero entero y con 10-162 s de duración, y **pasan solos**: `scrum854` 6/6, `scrum839d` 15/15, `scrum839e` 13/13, `scrum775` 16/16.
- **Sufijo:** lo empecé como `1302r` y antes de empujar vi que `1302r` (S1, el `POST` de la versión vieja) y `1302s` ya existían en el remoto. Lo pasé a `1302t` (rama, test y comentarios). Los dos primeros commits de la rama conservan `1302r` en el asunto: estaban escritos y no se reescriben.
- **NO medido:** yaqu.app (arriba) · la suite completa (la corre el obligatorio).

A9: aviso → cicatriz S4 «el primer rojo de un test nuevo cayó también en sus controles: era el instrumento (un token que no pasaba `parseToken` daba la página de 404), no el defecto, y un rojo así no prueba nada» — no se pudo comprobar: no hay forma general de saber qué tests de un fichero son controles
- **Tanda completa** (`node --test tests/*.test.mjs`, TMP en la misma unidad que el repo): 11.503 tests, 11.334 pasan, 158 saltados, **11 caídos**, clasificados uno a uno: **1 mío** (`scrum836d`: el `cae` de mi mutación no nombraba un test existente; arreglado); **8** comparan esquema contra cliente de Prisma (`scrum222`, `scrum235` ×3, `scrum252`, `scrum461` ×2, `scrum733`), que en mi disco es COMPARTIDO y estaba generado con el esquema de otra rama (`archivedAt`, de 1273); **2** de `scrum1266b` (el dictado del panel, que este cambio no toca). Regenerado el cliente con el esquema de este árbol, esos 8 ficheros más el mío: **118 de 118 sin fallos** (2 saltados), incluido 1266b, que en la tanda cayó bajo carga.

**NO medido todavía:** yaqu.app (sin mergear al escribir esto). Es verificable SIN crear nada (la cuenta QA tiene la prueba caducada y no deja crear): S4 dejó en producción la .0 y la .1 del dato P3.1 (id 208, c.19656). Cuando entre: `POST /quote/<token de la .0>/decision` con `accept` → 409 `quote_has_newer_version` con T2+T3, y la .0 sigue en su estado, leído por otra vía (el panel).

## SCRUM-1302u · lo que quedó abierto de B y de C, contestado (S4, 15-oct-2026)

**Medido contra:** `origin/main` = `73e41ab00f727fae5c6c8f1715d6eb6749133502` · 2026-10-15T16:10:09Z
A9: sin fallo que generalice — solo lectura y una respuesta; nada construido

Carril S4. Sin código: contesta las dos cosas que este registro dejaba abiertas para S4 (líneas «Sigue abierto en este ticket» del apéndice B y «Sigue abierto en este ticket tras C»).

### C · los dos casos «NO TOCADO»: YA ESTÁN, los cerró SCRUM-1493

El apéndice C los declaró sin tocar el 6-oct: ① la ruta del dictado contesta 200 sin líneas con una propuesta en pantalla, y ② «Añadir al parte» con el guardado fallando. Los dos los arregló SCRUM-1493 (registro `docs/master/SCRUM-1493.md`, en `main`): en ① la propuesta corregida se queda y el texto del servidor sale arriba, en ② el aviso firmado va a su sitio y la propuesta con su botón siguen. Hoy, corrido y no leído: `tests/scrum1493-la-propuesta-no-se-borra-por-ningun-camino.test.mjs` y `tests/scrum1302c-…` en verde sobre este `main` (tanda de 65 ficheros vecinos de SCRUM-1233e, 600 de 600).

Lo que 1493 dejó a la vista, y es texto, por eso se nombra aquí y no se toca:

| hoy dice | debería decir | estado |
|---|---|---|
| ① encima de tres líneas que siguen ahí: «No se ha podido sacar ninguna línea — escríbelas tú» (firmado para una pantalla SIN propuesta; 1493 lo declaró «impreciso, no falso») | lo que se firme: el literal se estiró a un caso para el que no se firmó | **pide firma** — no se propone texto aquí sin que lo pida quien firma |
| un `PATCH` de «Añadir al parte» rechazado con 409 (el parte se firmó en otro sitio) dice «vuelve a intentarlo», y repetir no va a salir nunca | lo mismo que «Ordenar» ante el 409: releer el parte (conducta 2 de c.18491), sin texto nuevo | **pide firma de conducta**: c.18491 la firmó para «Ordenar», no para «Añadir»; estirarla no vale |

### B · ¿los mensajes del servidor se pueden enseñar TAL CUAL?

⚠️ **Premisa corregida:** quien los lee no es un cliente final. Es la ficha del parte (`parteDetailView.js`, `guardarCampo`), o sea el profesional o su técnico.

La ficha de la firma (`docs/microcopy/2026-10-06-SCRUM-1302-campo-que-no-se-guarda.md`) habla de «Los desplazamientos son un número entero.» «y otros tres». Los cuatro rechazos de valor que tenía entonces el `PATCH /admin/partes/:id` (`partes.routes.ts`, `parteRango.ts`):

| código | mensaje del servidor, literal | ¿tal cual? | hoy en pantalla |
|---|---|---|---|
| `desplazamientos_invalido` | «Los desplazamientos son un número entero.» | **sí**, se entiende y dice qué hacer | **ya no hace falta:** SCRUM-1491/1492 le dieron texto propio firmado en la vista (`TEXTO_POR_CODIGO_DE_LA_RUTA` → «No se ha guardado. Desplazamiento es un número entero, como 1 o 2 — no el tiempo de viaje») |
| `kilometros_invalido` | «Los kilómetros son un número.» | **sí** | **ya no hace falta:** igual («No se ha guardado. Kilómetros es un número, como 12 o 12,5») |
| `tipo_invalido` | «Tipo de intervención desconocido: ${tipo}.» | **no**: interpola el identificador interno que llegó | el general firmado, «No se ha podido guardar el cambio — vuelve a intentarlo». **Sin recambio:** desde esta pantalla no se alcanza (el tipo sale de los radios, con valores de la lista) — leído en el código, no intentado |
| `tecnicos_invalido` | «Los técnicos vienen en una lista.» | **no**: habla del formato de la petición, y un técnico no puede hacer nada con eso | el general. **Sin recambio:** `cuerpoDeCampo` manda SIEMPRE una lista (parte por comas) — leído en el código, no intentado |

Los cuatro que SCRUM-1488 añadió después (`desplazamientos_negativo`, `_no_cabe`, `kilometros_negativo`, `_no_cabe`) también tienen ya texto propio en la vista. `«… no pueden pasar de 2147483647.»` no se habría podido enseñar tal cual (un número de columna), y no se enseña.

**Conclusión:** no queda nada que decidir sobre «enseñar el mensaje del servidor» en la cabecera del parte. Los dos que se alcanzan tienen texto firmado propio; los dos que no, caen en el general, y está bien. **No hay que pedir ninguna firma por B.**

**NO medido:** ninguno de los cuatro en yaqu.app.
