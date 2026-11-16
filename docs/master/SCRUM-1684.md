# SCRUM-1684 · LATIDO · alarma «main sin verde del obligatorio > 48 h» (§4 MAIN)

**Medido contra:** `origin/main` = `5986d520a77dc7076ad86ea656e1550ee75c7215` · 2026-11-10T17:18:45Z
A9: comprobación → `tests/scrum1684-main-sin-verde.test.mjs`

Lo encarga el orquestador (10-nov-2026); umbral de 48 h y decisiones de cancelados/página llena, suyas
(delegación del fundador del 3-nov). Puesto S5.

## Qué hace

- `alarmaSinVerde` (`scripts/equipo/latido.mjs`, §4): edad del CIERRE (`completed_at`) del último job
  obligatorio en `success` sobre main, desde la MISMA lectura de `commitsDeCorridas` (sin consulta nueva).
  `HORAS_SIN_VERDE_DE_MAIN = 48`; avisa con `h >= 48` (47:59 no, 48:00 sí).
- Los tres casos, cada uno con su frase:
  - ① hubo corridas en rojo → nombra el PRIMER rojo (el más viejo detrás del verde).
  - ② no hubo corridas → ninguna después del verde, o «hubo N y ninguna terminó» (canceladas / en curso:
    decisión del orquestador, la propuesta ② del ticket), o la API no tiene ninguna con la lista ENTERA.
  - ③ no pude leer → la lista no llegó, los jobs de una corrida no se dejan leer, el verde no trae hora,
    o la página vino LLENA (`per_page=20`) sin un verde dentro. Sale CIEGA (salida 2), con lo que sí se
    leyó debajo. Nunca ②: «no pude mirar» y «no hay nada» no salen iguales.
- `seccionMain({ …, leidasTodas })`: `undefined` = no se pregunta (los tests viejos no cambian);
  `main()` pasa `leidasTodas = Array.isArray(corridas) && corridas.length < COMMITS_DE_MAIN`.
- `commitsDeCorridas` ahora para en el primer VERDE, no en el primer veredicto: con main en rojo, el último
  verde está detrás de los rojos. Coste: una lectura de jobs más por cada rojo seguido (máx. 20).
  `seccionMain` sigue parándose en el primer veredicto (su aviso de siempre no cambia).

## Control positivo, por los dos lados

- Test `tests/scrum1684-main-sin-verde.test.mjs` 7/7; con los de siempre de la §4
  (`scrum1350-latido`, `scrum1459-latido-lee-al-vigia`) 50/50.
- ROJO: 7 mutaciones, 7 MUERTAS (borde `<=`, página llena tratada como entera, parar en el primer
  rojo, rojos contados como ②, `main()` sin `leidasTodas`, lista ausente sin alarma, ③ como aviso y no ciega).
- VERDE, contra el main REAL (sólo lectura, 17:18Z): 20 corridas, 1 lectura de jobs, ✅ «el último verde
  es 5986d520 (17:15Z) dentro de las 48 h», salida 0. Con los MISMOS datos y el reloj +49 h: 🔴 caso ②,
  salida 1.
