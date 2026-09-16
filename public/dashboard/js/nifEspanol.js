// public/dashboard/js/nifEspanol.js — SCRUM-575 (CONT-02)
//
// 🔴 ESTO ES UNA SEGUNDA COPIA DELIBERADA DE `src/core/validation/nifEspanol.ts`, Y CONSTA COMO TAL.
//
// ── POR QUÉ EXISTE ───────────────────────────────────────────────────────────────────────────
//
// El front es vanilla y `tsconfig.json` fija `rootDir: "src"` / `include: ["src"]`: el navegador
// NO PUEDE importar del backend, y el backend no puede importar de `public/`. Es la categoría que
// el propio repo tiene declarada como `REGLA_COPIADA_AL_FRONT` en `_huerfanos-declarados.mjs`
// («duplicada en public/ porque el front no puede importar»), con precedente en `partirMetodo`.
//
// La alternativa era no validar en el navegador y avisar sólo al guardar. Se descartó porque el
// aviso llegaría después de que el profesional haya terminado la ficha, y el ticket va justo de
// que se entere EN EL CAMPO.
//
// ── 🔴 Y POR QUÉ ESTA COPIA LLEVA TRINQUETE, A DIFERENCIA DE LAS OTRAS ───────────────────────
//
// Porque ésta es una regla FISCAL. Dos copias de un dígito de control son dos sitios donde
// divergir, y el día que divergieran el navegador diría «válido» sobre algo que el servidor
// rechaza —o peor, al revés—. Un comentario que dice «acuérdate de cambiar las dos» no es un
// mecanismo: se olvida.
//
// Así que `tests/scrum575-nif-espanol.test.mjs` corre LAS DOS implementaciones sobre el mismo
// corpus y exige que coincidan en TODOS los casos. Si alguien toca una y no la otra, la suite
// cae nombrando el valor en el que discrepan. La copia sigue siendo una copia; lo que deja de
// ser posible es que se separen en silencio.
(function () {
  'use strict';

  var LETRAS_DNI = 'TRWAGMYFPDXBNJZSQVHLCKE';
  var LETRAS_CIF = 'ABCDEFGHJKLMNPQRSUVW';
  var CIF_CONTROL_LETRA = 'KPQRSNW';
  var CIF_CONTROL_DIGITO = 'ABEH';

  /** Un NIF se escribe con espacios, guiones y en minúsculas sin dejar de ser el mismo documento. */
  function normalizarNif(valor) {
    return String(valor == null ? '' : valor).toUpperCase().replace(/[\s.-]/g, '');
  }

  function letraDe(numero) {
    return LETRAS_DNI[numero % 23];
  }

  function controlCif(sieteDigitos) {
    var pares = 0;
    var impares = 0;
    for (var i = 0; i < 7; i += 1) {
      var d = Number(sieteDigitos[i]);
      if (i % 2 === 0) {
        var doble = d * 2;
        impares += Math.floor(doble / 10) + (doble % 10);
      } else {
        pares += d;
      }
    }
    return (10 - ((pares + impares) % 10)) % 10;
  }

  /**
   * ¿Es un NIF/CIF/NIE español bien formado y con el control correcto?
   *
   * 🔴 VACÍO ES VÁLIDO. El campo es opcional y esto no lo convierte en obligatorio.
   */
  function validarNifEspanol(valor) {
    var v = normalizarNif(valor);
    if (!v) return { valido: true, tipo: null, motivo: 'vacio' };

    if (/^\d{8}[A-Z]$/.test(v)) {
      return letraDe(Number(v.slice(0, 8))) === v[8]
        ? { valido: true, tipo: 'DNI', motivo: 'ok' }
        : { valido: false, tipo: 'DNI', motivo: 'control' };
    }

    if (/^[XYZ]\d{7}[A-Z]$/.test(v)) {
      var inicial = String('XYZ'.indexOf(v[0]));
      return letraDe(Number(inicial + v.slice(1, 8))) === v[8]
        ? { valido: true, tipo: 'NIE', motivo: 'ok' }
        : { valido: false, tipo: 'NIE', motivo: 'control' };
    }

    if (/^[A-Z]\d{7}[0-9A-J]$/.test(v)) {
      var entidad = v[0];
      if (LETRAS_CIF.indexOf(entidad) === -1) return { valido: false, tipo: null, motivo: 'forma' };

      var esperado = controlCif(v.slice(1, 8));
      var control = v[8];
      var comoDigito = String(esperado);
      var comoLetra = 'JABCDEFGHI'[esperado];

      var ok;
      if (CIF_CONTROL_LETRA.indexOf(entidad) !== -1) ok = control === comoLetra;
      else if (CIF_CONTROL_DIGITO.indexOf(entidad) !== -1) ok = control === comoDigito;
      else ok = control === comoDigito || control === comoLetra;

      return ok
        ? { valido: true, tipo: 'CIF', motivo: 'ok' }
        : { valido: false, tipo: 'CIF', motivo: 'control' };
    }

    return { valido: false, tipo: null, motivo: 'forma' };
  }

  var api = { normalizarNif: normalizarNif, validarNifEspanol: validarNifEspanol };

  if (typeof window !== 'undefined') {
    window.nifEspanol = api;
    window.validarNifEspanol = validarNifEspanol;
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
