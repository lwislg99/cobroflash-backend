# SCRUM-1060 · CLIENTES · cuánto pesa la foto de un Trabajo antes de enseñarla en el historial del cliente

**Medido contra:** `origin/main` = `25c078667e94c4b62a7756901c24b83bb7006699` · 2026-09-22T08:22:59Z (hora de GitHub, `gh api -i zen`)

Solo medición (AC del ticket); no se toca `src/`, `public/` ni las rutas de fotos.

## Punto de partida: staging no tiene NINGUNA foto de tamaño real

Confirmado de nuevo (`docs/master/evidencias/scrum920/sonda-peso-fotos-staging.mjs`, solo lectura):
el merchant QA solo tiene 3 fixtures de 0,1 KiB (PNG de semilla). SCRUM-920d ya lo midió el
21-sep-2026 y siguen igual hoy. `GET /admin/expenses/:id/foto` sirve la foto **entera**, binario,
`Cache-Control: no-store` — sin miniatura, tal y como 920d lo dejó escrito.

## A · Peso real de 20 fotos de móvil típicas (por el pipeline REAL, sin tocar datos)

`window.fotoParaGuardar` (`expensesView.js`, SCRUM-947) es código de cliente puro — se llamó TAL
CUAL como lo sirve staging hoy, sobre 20 imágenes sintéticas que varían resolución (12/8/16 MP,
apaisada y vertical, como una cámara de móvil real) y densidad de detalle (pared lisa → ticket con
letra menuda). Cero escrituras en el servidor para esta parte.

Instrumento: `docs/master/evidencias/SCRUM-1060/medir-peso-y-carga.mjs`, datos completos en
`docs/master/evidencias/SCRUM-1060/informe.json`.

| | binario guardado |
|---|---|
| mínimo | 0,185 MiB |
| mediana | 0,443 MiB |
| p90 | 0,937 MiB |
| máximo | 0,941 MiB |

Coherente con lo que 920d ya había derivado del código (0,55–1,11 MiB): el techo real de
`fotoParaGuardar` (2000 px de lado largo, calidad deslizante) mantiene el peso SIEMPRE por debajo
de ~1 MiB, pase lo que pase con la foto de origen (aquí, hasta 5,46 MB de origen).

## B · Tiempo de carga bajo red 4G simulada (1 gasto de prueba, creado/medido/borrado)

Sin ninguna foto de tamaño real en staging que descargar, se creó **un** gasto con la foto MEDIANA
de la parte A (0,443 MiB) por el modal real — mismo patrón de un solo escrito que SCRUM-947b — y se
midió `GET /admin/expenses/:id/foto` con `Network.emulateNetworkConditions` (perfil «4G regular» de
`scripts/guard-primera-pantalla.mjs`: 9 Mbps bajada, 4 subida, 170 ms de ida y vuelta). El gasto de
prueba (id `239`) se **borró** al terminar; confirmado sin huérfanos con la sonda de solo lectura
después de cada ejecución.

| intento | ms | bytes |
|---|---|---|
| 1 | 739 | 464.473 |
| 2 | 738 | 464.473 |
| 3 | 735 | 464.473 |

**~735–740 ms por foto de tamaño mediano, bajo 4G simulada.** Para el máximo medido (0,94 MiB),
la cifra escala aproximadamente a ~1,1–1,3 s (transferencia ≈ tamaño ÷ 9 Mbps + los 170 ms de ida
y vuelta).

Captura del detalle del gasto con su foto, a 390 px:
`docs/master/evidencias/SCRUM-1060/captura-390/detalle-gasto-390.png`.

## Propuesta (no se construye aquí)

1. **Cuántas fotos caben en el historial del cliente:** recomiendo **3 fotos inline como máximo**
   (una por Trabajo reciente con foto), sin miniatura de momento. Coste en el peor caso: 3 × 0,94
   MiB ≈ 2,8 MiB de datos móviles y, cargando en paralelo (el navegador hace hasta 6 peticiones a
   la vez al mismo origen), un tiempo de pantalla dominado por la foto más lenta: ~1,1–1,3 s. Es el
   mismo orden de magnitud que la lista de Gastos que 920d ya midió (11–22 MiB para 20 filas) pero
   acotado, porque el historial del cliente no enseña 20 Trabajos de golpe.
2. **¿Hace falta miniatura?** No para 3 fotos. Si en el futuro se quisiera enseñar más de 3, o la
   lista de Gastos (920d) avanza, sí — 920d ya dejó abierto ese ticket de servidor (S1), y esta
   medición no lo repite: sigue haciendo falta el mismo día que el número de fotos por pantalla
   suba de 3.
3. **Quick win aparte, NO parte de este ticket:** `Cache-Control: no-store` obliga a re-descargar
   la MISMA foto en cada visita — una foto ya guardada no cambia nunca (regla 29 de documentos no
   aplica aquí, pero el hecho es el mismo: un gasto pasado no se edita en la práctica). Cambiar a
   `private, max-age=…` ahorraría descargas repetidas sin tocar el peso. Lo apunto para quien abra
   el ticket de construcción; no lo decido ni lo construyo aquí.

## Ficheros

- `docs/master/evidencias/SCRUM-1060/medir-peso-y-carga.mjs` — el instrumento (parte A + B).
- `docs/master/evidencias/SCRUM-1060/captura.mjs` — la captura de detalle (1 escrito más, mismo patrón, borrado).
- `docs/master/evidencias/SCRUM-1060/informe.json` — las 20 muestras + la medición de carga, en crudo.
- `docs/master/evidencias/SCRUM-1060/captura-390/detalle-gasto-390.png`.
