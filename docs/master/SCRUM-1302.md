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

## H1 · La firma directa lee «ya está firmado» como lo lee el drenado

**Medido contra:** `origin/main` = `48babd04d40667a9ec8fbeb6e02b9e44dbf0585b` · 2026-10-01T11:09:06Z

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
