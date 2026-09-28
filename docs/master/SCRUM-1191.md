# SCRUM-1191 · Tope de la cola de firmas sin conexión, cableado

**Medido contra:** `origin/main` = `29b492b0c2f246941e5c514d682887c18fd19494` · 2026-09-28T14:28:33Z

## Qué pasaba

`hayEspacioParaOtraFirma` (SCRUM-360, `resistenciaAlmacen.js`) medía el tope (50 firmas, o el disco sin
sitio) y nadie la consultaba antes de encolar. El aviso aprobado en SCRUM-469
(`TEXTO_SIN_ESPACIO_PARA_FIRMA`: «No cabe otra firma en este móvil. Conéctate para subir las que tienes
pendientes.») estaba escrito y sin pintar, vigilado a propósito para que siguiera sin consumidor.

## Qué cambia (solo front)

- `colaDeFirmas.js` · `noCabeOtraFirma` antes de `encolarFirma`, dentro de `firmarConRedDeSeguridad`.
  Da `true` solo con las tres cosas: la cola se ha podido leer, **tiene firmas pendientes** y el tope
  dice `SIN_ESPACIO`. Entonces no se encola, **se intenta subir igual** (con red sube, ③) y, si falla,
  el error lleva `sinEspacio` (igual que `sinRed`/`sinClave`).
  - Si ESE documento ya está en la cola, encolar lo sobrescribe y la cola no crece: no se le quita la red.
  - `NO_SE_SABE` o no poder leer la cola → se encola como siempre (decisión de SCRUM-360).
  - **Condición de verdad:** con la cola vacía (el disco lo llenó otra cosa) se encola como siempre,
    porque «Conéctate para subir las que tienes pendientes» sería falso.
- `albaranDetailView.js` · `mensajeDeFalloAlFirmar` devuelve el texto aprobado si `e.sinEspacio`,
  salvo que el servidor diera un motivo propio. Lo usan el albarán y el parte con su llamada de siempre.
- `estadoFirma.js` · el comentario de «sin consumidor» se actualiza.
- `tests/scrum469-aviso-desalojo.test.mjs` · **RETIRADA A PROPÓSITO** de la aserción «sigue sin
  consumidor», que estaba hecha para caer el día que se cablease. La sustituye una que exige que el
  único consumidor sea `albaranDetailView.js`.
- `scripts/_sin-consumir-declarados.json` · `hayEspacioParaOtraFirma` pasa a `retiradas`.

Un primer intento pasaba `sinEspacio` en el `estado` de las vistas. `scrum358-encolar-firma` fija la
forma exacta de la llamada del albarán, así que la marca se movió al error (regla 41: se cambió el
código, no el guard).

## Cómo se prueba

`tests/scrum1191-tope-cola-firmas.test.mjs`, con el dashboard entero en el banco (IndexedDB estándar,
`api.js` real). La cola se llena de verdad y se usa la misma llamada que la vista. 9 casos: tope sin
red → no encola + aviso · tope con red → sube · 49 → encola (texto de SCRUM-919) · reintento del mismo
documento → encola · **disco lleno y cola vacía → encola y NO sale el aviso** · disco lleno con
pendientes → aviso · `NO_SE_SABE` → encola · motivo del servidor manda · **el parte** (pad real) → aviso.

- En rojo: sin el tope caen 3 · sin la condición «cola > 0» cae 1 · sin la marca en el error caen 3.
- Vecinos (49 ficheros de la cola, el albarán, el parte, 469, 358, 1185, 697/698): 471/471.

## Lo que queda fuera

- Portal cautivo (respuesta que no confirma, sin error) con la cola en el tope: no hay error que marcar
  y sale «No hemos podido registrar la firma», que es cierto. No se cambia el contrato por ese caso.
- Sin cambio visual: el texto sale en el aviso del pad que ya existe. Sin captura.
- yaqu.app: **NO VERIFICABLE** (sin credenciales del demo, y llenar 50 firmas sin red no se hace en prod).
