# El aviso de cuando no se guardan las líneas dictadas

**Aprobado por el fundador** el 3-sep-2026, en **SCRUM-704**.
**Aplicado en el mismo acto** (regla 30).

## Texto aprobado, literal

> No se han podido guardar las líneas — vuelve a intentarlo

## Dónde se pinta

`public/dashboard/js/parteDetailView.js` — ranura `noSeGuardo`. Sale **solo** cuando el técnico ha
confirmado las líneas que le propuso el dictado y el `PATCH` al parte **falla**.

## Qué cambió

**Ni una letra.** Se propuso así y se aprobó así. Está en la voz de la casa —«no se han podido»,
nunca «no hemos podido»—, con raya larga de un solo carácter (`—`) y terminando en la acción que le
sirve al técnico. Lo único que se retira es el marcador `[PENDIENTE microcopy oficial]`.

## Por qué este aviso existe, que es lo que decide su texto

Si el guardado falla y la pantalla **se repintara como si hubiera ido bien**, el técnico se iría
convencido de que sus líneas están apuntadas y no lo estarían. Un guardado que falla en silencio es
peor que uno que revienta: el que revienta se vuelve a intentar, y el mudo se descubre semanas
después, delante del cliente.

Por eso el aviso dice **las dos cosas**: que no se ha guardado, y qué hacer. Y por eso la propuesta
**no se borra de la pantalla** cuando aparece: lo que el técnico había corregido sigue ahí para que
pueda reintentarlo sin volver a dictar.

## Qué queda sin firmar en esa pantalla

**VEINTISÉIS rótulos**, contados: «Firma del cliente», «Mano de obra», «Materiales», «UNDS»,
«Entrada», «Salida», «Desplazamiento», «Kilómetros», «REF», «Notas», los tres tipos de
intervención, los del dictado, los de la propuesta… Se **reportan**, no se aprueban aquí (regla 30).

> ⚠️ **Y el censo de marcadores dice UNO, no veintiséis, y las dos cifras son correctas.** Ese censo
> cuenta **literales que contienen la marca**, y esta pantalla la factoriza en una constante que
> concatena veintiséis veces. Quien lea ese «1» no debe deducir «un rótulo pendiente».
>
> Por eso la entrada de `parteDetailView.js` en `tests/scrum402-marcador-no-se-pinta.test.mjs`
> **sigue en 1 y no se retira**: aplicar este aviso no ha cambiado el número, porque este aviso
> nunca fue un literal marcado aparte.
