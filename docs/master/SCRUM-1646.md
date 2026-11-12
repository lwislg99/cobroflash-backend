# SCRUM-1646 · CSP paso 2 (S1)

> Este fichero lo crean también #3048 (albarán) y #3124 (avisos). Al unir: se conservan TODAS las
> secciones (unión), nunca se elige bando.

## SCRUM-1646c · 2026-11-12 (noche) · script de la firma del PRESUPUESTO (`quoteDecisionLanding`)

**Medido contra:** `origin/main` = `8f235725590f2c984b1709a5331ff26a53f25792` (2026-11-12T15:06:10Z).
Punto de partida: sección ② de la rama `scrum-1646-csp-avisos-publicos` (3 `<script>` en línea + `onclick` por opción).

### Qué cambia (cero textos, cero cambios de conducta)

- Los tres scripts (`TIER_JS`, `SIG_JS` y el del botón) pasan a UNA cadena constante,
  `PRESUPUESTO_FIRMA_JS`, en `src/modules/system/app/routes/quoteDecisionNavegador.ts` (`String.raw`
  sin `${`), servida en `GET /pay/quote/js/firma.js?v=<sha1 10>` (`immutable` sólo con la huella buena,
  si no `no-cache`). Declarada `no-sensitive-resource` en `publicAccessDeclarations.ts` (`/pay` ya era prefijo).
- Lo que iba interpolado (ruta del POST con el token, códigos de recarga, TODOS los textos, nombre del
  negocio, enlace de compartir, trazo del icono) viaja en `<script type="application/json"
  id="presupuesto-firma-datos">`, con `<` → `<`. Los literales se quedan en la ruta, idénticos.
- El `onclick="selectTier(…)"` de cada opción → listener sobre `.tier-card .btn-tier`, que lee el
  `data-tier-id` que la tarjeta ya llevaba.
- El éxito ya no se monta con `innerHTML`: `createElement`/`textContent`, mismo árbol
  (div > div.success-check, h1, p, [p.sin-pago], a.btn-share > svg + texto) y mismos estilos vía CSSOM.
- `TIER_JS` deja de exportarse (sólo lo leía SCRUM-212).

### Tests

- Censo de acoplados (36 ficheros, 284 tests): **10 caían**, en 4 ficheros que ejecutaban o leían el
  script en línea → adaptados para EJECUTAR el guion servido sobre los datos de la página
  (`tests/_navegador-de-la-firma-del-presupuesto.mjs`, nuevo): 1302t, 1302d (mitad presupuesto), 264
  (fila ACEPTAR: expresión del guion + `T.reserva` ligado al literal de la ruta), 1001 (suelo). 212 mira
  la condición del IVA en su forma nueva (`conIva?T.ivaIncluido:''`) además de la vieja.
- 1302t: su `MUTACIONES_QUE_ME_TUMBAN` M1 apuntaba a la rama 5xx en el fuente viejo (quedaba CIEGA):
  movida al guion; aplicada a mano cae SÓLO «un 5xx al aceptar…». Censo de las 3 declaraciones que mutan
  la landing: ninguna ciega.
- 888d: su huella es de `renderQuoteDetail`, que no se toca → sigue verde sin regenerar.
- Nuevo `tests/scrum1646c-presupuesto-sin-script-en-linea.test.mjs` (8): control de sondas · las dos caras
  (un precio, tres opciones) sin script en línea ni `on*=` y con UN guion `'self'` · guion constante · caché
  por huella · un `</script>` en el nombre no abre HTML · elegir opción · éxito · 409 recarga.
  **Mutantes (base 8/8):** M1 script en línea vuelve → caen 2 · M2 immutable siempre → 1 · M3 sin listener
  de opción → 1 · M4 el 409 no recarga → 1.
- Tanda de acoplados tras el cambio: **294 tests · 291 pass · 0 fail · 2 skip** (+553 arreglado: extractor
  con hueco de atributos). `guards:entrada` 15 guards **170/170**; los 5 de árbol entero + 98 + 55: 133, 0 fail.

### ⑥ Lo que FALTA antes de empujar (relevo)

- 🔴 **Capturas byte a byte con la CSP APLICADA + control positivo** (la vara): antes = main sin CSP;
  después = esta rama con `script-src 'self'` (el estilo sigue en línea hasta 1646d, así que la CSP de la
  medida lleva `style-src 'unsafe-inline'` y se dice). Caras: un precio y tres opciones, 390 y 1280 px,
  y el ESTADO tras pulsar (elegir opción, firmar, éxito). Control: la página de main con la misma CSP sale
  distinta/rota y con violaciones `script-src`.
- Recorrido en yaqu.app tras el merge.
