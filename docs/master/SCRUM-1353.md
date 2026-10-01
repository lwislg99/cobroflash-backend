# SCRUM-1353 · El detalle del albarán dice la firma que guarda el móvil y el rechazo del servidor

**Medido contra:** `origin/main` = `ba930e80e29d267f010b2086e2d4f3503210aec8` · 2026-10-01T11:36:36Z
A9: comprobación → `tests/scrum1351-viaje-firma-sin-red-albaran.test.mjs`
**Skill UI:** cargada

1-oct-2026 · **S4**. Hallazgos 2 y 4 de SCRUM-1302 (comentario 17880), medidos por SCRUM-1351.
Firma: SCRUM-1353 comentario 17881 (el orquestador, por delegación del fundador). Rama apilada
sobre la de SCRUM-1351, porque retira dos líneas de su lista de defectos.

## Qué cambia en pantalla

Sólo `public/dashboard/js/albaranDetailView.js`, y sólo para un albarán que el servidor no da por
firmado.

| Situación | Antes | Ahora |
| --- | --- | --- |
| Hay una firma de este albarán en la cola del móvil | pantalla idéntica a la de uno sin firmar | la caja «Solo en este móvil», ya aprobada para el firmado |
| Pulsar «Firmar aquí mismo» con esa firma guardada | abría el pad y la reemplazaba sin decirlo | pregunta antes; si dice que no, no abre el pad ni toca la cola |
| «Enviar para firmar» con esa firma guardada | se ofrecía | no se ofrece |
| El servidor rechazó para siempre la firma encolada | nada | aviso «…Vuelve a firmar el albarán.» |
| Ese rechazo con código `invalid_id` | nada | nada: el texto sería falso (límite firmado) |
| Rechazo y además una firma nueva en la cola | nada | sólo la caja |
| El almacén del móvil no se puede leer | — | igual que antes: ni caja, ni aviso, ni pregunta |

El aviso antes del pad consulta la cola **en el clic**, no al pintar: quien firma sin red y cancela
el pad sigue en una pantalla que se pintó cuando la cola estaba vacía.

Componentes: la caja de `pintarEstadoDeFirma`, `.alert warning` y `window.confirm` (el patrón que
ya usan otras vistas). No se añade ninguno ni se toca CSS.

## Tests

`tests/scrum1351-viaje-firma-sin-red-albaran.test.mjs`: 13 pasan de 13.

- Seis tests nuevos (bloque SCRUM-1353), uno por fila de la tabla, más el control «sin nada en el
  móvil se pinta como siempre».
- `DEFECTOS_DECLARADOS` baja de seis a cuatro en este mismo commit. Antes de borrar las dos líneas
  corrí el test con la lista intacta: cayó nombrando exactamente esas dos como «ya no se observa».
- `firmarEnPantalla` espera 40 ms tras el clic: el botón ahora consulta la cola antes de abrir.

## Error propio, cazado por el test antes de salir de esta máquina

La primera versión preguntaba «¿hay firma en cola?» a `estadoDeLaFirmaDelAlbaran(id, false, cola)`.
Esa función contesta ① también con la cola vacía si el servidor no ha confirmado, así que la caja
salía en **todo** albarán sin firmar. Mi comprobación a mano dio «funciona» porque la hice con una
firma en la cola. Lo cazó el detector del rechazo, que compara contra un albarán sin nada: los dos
textos eran iguales. Ahora se mira la clave `firma:albaran:<id>`, y hay un test de control que
exige que sin cola no haya caja.

## Lo que queda fuera

- No visto todavía en yaqu.app: se mira tras el despliegue. En producción no se puede encolar una
  firma sin cortar la red del navegador; la sonda tiene que bloquear el service worker.
- La pantalla que ya estaba abierta no se repinta cuando la cola cambia (defecto declarado, de S2).
- El texto del parte con `invalid_id`: SCRUM-1352.
- `tests/scrum1321-el-resumen-no-prueba-el-final.test.mjs` sale CIEGO en esta máquina (temporal en
  `C:`, repositorio en `D:`). Lo dice en rojo, pero aquí no mide nada. Sin ticket todavía.
- `tests/scrum1266b-…` cayó una vez con la máquina cargada y pasa 15 de 15 solo.
