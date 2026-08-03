# Registro de trabajo — un fichero por ticket

Aquí vive el **registro de lo que se ha hecho**, a partir del 3-ago-2026 (SCRUM-273).
Un fichero por ticket: `SCRUM-<n>.md`.

## Por qué está separado del máster

Porque el conflicto no se resuelve mejor: **deja de existir**.

El 2-ago-2026 **siete ramas distintas chocaron en `docs/YAQU_MASTER.md`** en un solo día, todas
por lo mismo: cada ticket añadía su entrada al final de la misma sección y cuatro sesiones a la
vez escribían en el mismo punto. Medido: el máster tiene 1713 líneas, pero **las últimas 12
entradas ocupaban de la 1406 a la 1449** — el 11 % de las entradas en el 2,5 % del fichero.

Y el coste peor no era el tiempo. **Resolver conflictos a mano en la única fuente de verdad del
proyecto es la operación de más riesgo que se hace aquí**, y se hizo siete veces en un día. Ya
rozó: en la rama de SCRUM-234 el script de resolución ancló con `$` sobre un fichero en CRLF,
encontró 2 de 3 marcadores y abortó. Sin ese guard habría dejado un `=======` dentro del máster.

La causa raíz estaba un nivel más abajo: el máster mezclaba **lo que casi nunca cambia** (reglas,
decisiones, estrategia) con **lo que cambia cinco veces al día** (el registro). Esa mezcla es lo
que hacía que un apunte rutinario tocase el documento más delicado del repo.

**Dos ficheros nunca colisionan porque dos tickets nunca tienen el mismo número.**

## Lo que NO cambia

* **El máster sigue siendo la fuente de verdad** sobre reglas, decisiones y estrategia (regla 35).
  Esto cambia **dónde se escribe el registro**, no **qué manda**. Si algo aquí contradice al
  máster, gana el máster.
* **El histórico no se migró.** Las 110 entradas anteriores al 3-ago-2026 siguen en el máster, con
  su redacción y su orden intactos. Reescribir 476 KB para esto habría sido aceptar justo el
  riesgo que el cambio elimina.
* **No se duplica ni se enlaza hacia atrás.** Quien busca SCRUM-243 lo encuentra en el máster;
  quien busque SCRUM-274 lo encontrará aquí. Dos verdades sobre la misma entrada sería el defecto
  que esto viene a evitar, cometido por el propio arreglo.

## Formato

Encabezado en una línea con ticket, título, fecha, carril y si corre gateado. Después, el cuerpo
con el mismo criterio de siempre: **qué defecto cierra, qué se decidió y por qué, qué se midió,
en qué rojo se verificó, y qué NO se cubre**. Un lector dentro de seis meses tiene que poder
reconstruir la decisión sin preguntarle a nadie.

```markdown
# SCRUM-<n> · TÍTULO-CORTO: la frase que resume qué cambia

**Fecha:** <d-mmm-aaaa> · **Carril:** A|B · **Gate:** sin gate | gateado | STOP con GO
**Tanda:** <N> tests, <N> pass, <N> fail, <N> skipped

## El defecto
## La decisión, y por qué
## Lo que se midió
## Verificado en rojo
## Lo que NO cubre
## Ficheros
```

Ninguna sección es obligatoria salvo el encabezado: un ticket de recon no tiene rojo, y uno de
docs no tiene tanda. Lo que sí se espera siempre es **lo que NO cubre** — un registro que solo
cuenta lo que salió bien se lee, dentro de unos meses, como si hubiera cubierto más de lo que
cubrió.

## El guard

`tests/scrum273-registro-por-fichero.test.mjs` se pone **rojo** si aparece una entrada de trabajo
nueva en `YAQU_MASTER.md`. El censo se congela por **número de ticket y cantidad**, no por línea:
por línea, cualquier edición diez líneas más arriba lo pondría en rojo, y un guard que grita sin
motivo se acaba puenteando igual que uno que no grita nunca.
