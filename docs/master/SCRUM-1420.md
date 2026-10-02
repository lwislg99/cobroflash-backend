# SCRUM-1420 · El pad de firma dice cuándo se ha cerrado (mitad S2: `onClose` en `signaturePad.js`)

**Medido contra:** `origin/main` = `a2fe215e5fdd5f86b6b13fe009198daed27b3a5a` · 2026-10-02T12:31:36Z
A9: comprobación → `tests/scrum1420-el-pad-avisa-al-cerrarse.test.mjs`

Carril S2 (`public/dashboard/js/signaturePad.js`, por la fila general de §11bis) · rama `scrum-1420-el-pad-avisa-al-cerrarse` · sesión `s2-2octa`.

**Skill UI:** cargada (`yaqu-premium-ui`, en esta sesión y antes de editar). Cambio de lógica en un fichero de `public/dashboard/js/`: sin marcado, sin estilos y **sin texto**.

## El defecto entero, y por qué va en dos mitades

SCRUM-1374 hizo que la ficha del albarán se ponga al día cuando la cola avisa de que el servidor ya tiene la firma, **salvo si hay un pad abierto** (repintar debajo del pad es peligroso). Pero si el aviso llega con el pad abierto, nadie lo recuerda: al cerrarlo, la ficha sigue en «emitido» ofreciendo firmar. Lo midió S4 en yaqu.app.

Para ponerse al día al cerrar, la vista necesita saber CUÁNDO se cierra el pad. Hoy sabe de su `onConfirm` y tiene el `close` que el pad le devuelve, pero **no sabe nada de «Cancelar», Escape ni el clic en el fondo**: esos tres se cierran dentro del pad y no avisan. Y son justo el caso (la persona cierra sin firmar después de que el aviso haya llegado).

- **Esta mitad (S2):** el pad avisa al cerrarse.
- **La otra mitad (S4):** `albaranDetailView.js` pasa `onClose` al abrir y decide qué hacer. No se toca aquí.

Vigilar el DOM desde la vista se descartó: es adivinar el cierre desde fuera.

## EL CONTRATO — lo que S4 puede dar por cierto

```js
window.openSignaturePad({ …, onClose: (info) => { … } });
```

- **Nombre:** `opts.onClose`. Opcional. Si no es una función, se ignora.
- **Qué recibe:** un objeto `{ confirmada }`.
  - `confirmada: true` — el pad se cierra porque `onConfirm` terminó bien.
  - `confirmada: false` — cualquier otro cierre: «Cancelar», Escape, clic en el fondo, o el `close` devuelto al llamador.
- **Cuándo se llama:** al cerrarse el pad, **después** de quitarlo del DOM y de soltar su oyente de teclado. Quien escuche ya no encuentra el pad (`[data-sp-aviso]`) en el documento.
- **Cuántas veces:** **una por pad**, aunque `close()` se llame varias (lo tiene el llamador y además está Escape).
- **Si `onConfirm` falla:** el pad no se cierra (SCRUM-404) y **no** se avisa. Se avisará cuando de verdad se cierre.
- **Orden al confirmar:** primero termina `onConfirm`, después se cierra el pad, después `onClose`.
- **Si `onClose` lanza:** el error se traga. El pad se cierra igual y no le llega a quien pulsó.
- **Sin `onClose`:** el componente hace exactamente lo de antes.
- Lo que devuelve `openSignaturePad` no cambia: `{ close }`.

## Por qué el cambio no puede sorprender a un tercero

Leído en `main` antes de construir:

- En el fichero hay **un solo `close()`**, y los cinco caminos de cierre pasan por él: Escape, «Cancelar», clic en el fondo, tras confirmar con éxito, y el `close` devuelto.
- El pad tiene **dos llamadores**, los dos de S4: `albaranDetailView.js` y `parteDetailView.js`. Ninguno pasa `onClose` hoy.

## Verificado, ejecutando

`tests/scrum1420-el-pad-avisa-al-cerrarse.test.mjs`, con el `openSignaturePad` real sobre el mini-DOM del banco.

- **Rojo antes** (con el `signaturePad.js` de `main`): 9 de 11 caen; pasan el suelo y «un `onClose` que no es función se ignora».
- **Verde después:** 11 de 11. Los cuatro cierres sin firma, el cierre al confirmar, el envío que falla, los cierres repetidos (un solo aviso), el oyente que lanza, dos pads a la vez.
- Vecinos que montan el pad (`scrum1351`, `scrum466`, `scrum468`, `scrum652c`, `scrum705`, `scrum743b`, `scrum919`, `scrum404`, `scrum1374`) más `scrum1185`, `scrum1344` y éste: 128 de 128.

## Lo que NO hace, y lo que no está medido

- No repinta nada ni cambia ninguna vista: hoy nadie pasa `onClose`. **SCRUM-1420 sigue abierto hasta que S4 lo conecte.**
- No visto en un navegador: el banco no dibuja (el canvas recibe un contexto que no hace nada) y su `document` no guarda oyentes; el test le pone uno para poder pulsar Escape.
- No ejercita las dos vistas que abren el pad.
