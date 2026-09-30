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
