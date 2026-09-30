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
