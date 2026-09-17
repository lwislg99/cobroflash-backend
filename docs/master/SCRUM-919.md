# SCRUM-919 · Sin conexión: la cola sólo se vaciaba al recargar, el pad no decía que la firma estaba guardada y el del parte hablaba del albarán

**Fecha:** 17-sep-2026 · **Carril:** Sesión 4 · cola de firmas, parte, albarán, microcopy
**Medido contra:** `origin/main` = `1df4b9b9d67b2a1ed9d919bd7e746d6aae2dd219` · 2026-09-17T14:57:07Z
**Rama:** `scrum-919-cola-al-volver-la-red`
**Horas:** las de la API de GitHub.

## ① PASO 0

Medido por la Sesión 0 con corte real (17-sep-2026, staging `2be8fe16`, 390 px, albaranes 1635 y 1636). Confirmado
en el código de `main`:
1. `app.js` llama a `drenarAlAbrir()` UNA vez al arrancar; los dos oyentes de `visibilitychange` sólo miran la versión
   y la precarga. Nada vacía la cola con `online` ni al volver a primer plano.
2. `mensajeDeFalloAlFirmar` (albaranDetailView.js) decía «La firma sigue en pantalla: inténtalo otra vez…» aunque la
   firma estuviera ya en la cola del móvil.
3. El pad lee la ayuda del nombre de `ALBARAN_AYUDAS.firmadoPorNombre` también en el parte: «…el albarán vale como
   prueba de entrega…».

## ② Lo construido

- **Punto 1:** `activarDrenadoAlVolver(window, document)` en `colaDeFirmas.js` engancha `online` y
  `visibilitychange` → visible a `drenarSiNoSeEstaDrenando()` (cerrojo: un vaciado a la vez); `app.js` la llama junto
  al vaciado de arranque. Misma idempotencia de hoy. Sólo con YaQu abierto (sin Background Sync ni push).
- **Punto 2:** `mensajeDeFalloAlFirmar(e, { encolada })`: sin red y con la firma guardada → «Sin conexión. La firma
  está guardada en este móvil y se enviará cuando vuelva la señal con YaQu abierto. No hace falta volver a firmar.»;
  sin almacén, el texto de antes. El pad sigue sin cerrarse sin ③ (SCRUM-404).
- **Punto 3:** `PARTE_AYUDAS.firmadoPorNombre` = «Una firma sin nombre no identifica a nadie. Escribe el nombre de quien
  firma el parte.», servida por `/admin/me` (`parteAyudas`) y pasada al pad por el parte (`opts.ayudas`). La del albarán
  no cambia. La propuesta «vale como prueba del trabajo hecho» NO se firmó (valor probatorio pendiente del asesor).
- Textos firmados por delegación: SCRUM-919 comentario 15799; fichas en `docs/microcopy/2026-09-17-SCRUM-919-*.md`.
  Comprobado contra `MICROCOPY_BLOQUEADA`: sólo contiene `btnConvertirFactura`.

## ③ Rojo, verde y mutaciones

- Rojos: `6a3afa5b` (punto 1: `online`, primer plano sí / segundo plano no, dos avisos = una subida, aviso sin red real
  no pierde la firma, y el cable de `app.js` por AST) y `ec3035fa` (punto 2: parte sin red con y sin almacén, llamada del
  albarán con `encolada` por AST; punto 3: pad real del parte con su ayuda, y la fuente servida por `/admin/me`).
- Arreglos: `490ee47c` (punto 1) y `48873c24` (puntos 2 y 3).
- Mutaciones: sin cerrojo → cae «dos avisos seguidos»; drenar también al ocultarse → cae «irse a segundo plano NO».
- `scrum890b`: el parte sin red espera ahora el mensaje con la firma guardada (decisión de este ticket).

## ④ No cubierto aquí

- Verificación con corte real en staging (banco de la S0, `setOffline` no vale): pendiente tras desplegar.
- Con la app cerrada no se envía nada: es límite de plataforma, y el texto lo dice.
