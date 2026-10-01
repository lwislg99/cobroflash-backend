# SCRUM-1360 · La firma en cola de un parte no degrada la caja de un albarán con su mismo número

**Medido contra:** `origin/main` = `7a30dbb0e50e1cc4d54949619f7be8d4aac0193f` · 2026-10-01T12:05:02Z
A9: comprobación → `tests/scrum1360-caja-albaran-firma-de-parte.test.mjs`

Carril S2 (`public/dashboard/js/estadoFirma.js`; §11bis: «el resto es de la S2») · rama `scrum-1360-caja-albaran-firma-de-parte` · sesión relevo de `s2-1oct`. Lo leyó la S4 y lo dejó marcado «leído, NO ejecutado»; aquí se ejecutó antes de tocar nada.

**Skill UI:** cargada (`yaqu-premium-ui`, en esta sesión y antes de editar). Cambio de lógica en un fichero de `public/dashboard/js/`: sin marcado, sin estilos y **sin texto nuevo** (la píldora que se pinta es la que ya existía; cambia cuándo sale).

(La A9: mi primera tanda del test salió 0/7 y no era el defecto — el worktree nació sin `dist` y el banco no montaba. Lo dijo el SUELO del propio test, que cayó el primero; sin él, siete rojos habrían parecido siete defectos.)

## El defecto

`hayFirmaEnColaDe` casaba una entrada de la cola sólo por `albaranId`. Desde SCRUM-652 la cola guarda también firmas de parte, y `encolarFirma` escribe el id del parte en ese mismo campo, con `tipo: 'parte'` o `'parte-tecnico'`. Partes y albaranes numeran aparte, así que los ids pueden coincidir.

Con la firma del parte N esperando, el detalle del albarán N —firmado y confirmado por el servidor— pintaba «solo en este móvil».

Sólo pinta: la clave del almacén sí lleva el tipo (`firma:parte:7`), así que nada se pisa ni se sube mal.

## Reproducido antes de tocar (ficheros de `origin/main`, sin modificar)

Población: 5 casos, albarán 7 firmado según el servidor.

| Cola | Caja del albarán 7 | |
| --- | --- | --- |
| vacía | ③ | base |
| firma del albarán 7 | ① | control positivo |
| firma del parte 8 | ③ | control |
| firma del parte 7 (cliente) | **①** | **defecto** |
| firma del parte 7 (técnico) | **①** | **defecto** |

## El arreglo

`hayFirmaEnColaDe` exige además `(f.tipo || 'albaran') === 'albaran'`. El default es el mismo con el que `colaDeFirmas.js` sube una entrada sin `tipo`: las colas anteriores a SCRUM-652 siguen contando como de albarán.

## Verificado, ejecutando

`tests/scrum1360-caja-albaran-firma-de-parte.test.mjs`, encolando con `encolarFirma` y el almacén reales del banco:

- **Rojo antes del arreglo:** 5/7; caen los dos del defecto (parte y parte-técnico).
- **Verde después:** 7/7. Vecinos `scrum356` y `scrum358`: 38/38 sumados los tres ficheros, 0 saltados.

**NO medido:** en pantalla contra yaqu.app. La cuenta QA tiene el albarán #46 y el parte #9: no comparten número, y forzarlo exige sembrar fuera de la lista de `sembrar-qa`.
