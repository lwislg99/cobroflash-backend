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

## Sigue abierto en este ticket tras C

D y E, camino fiscal (J1). Los dos «NO TOCADO» de arriba.
