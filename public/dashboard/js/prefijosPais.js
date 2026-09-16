// public/dashboard/js/prefijosPais.js — SCRUM-578 (CONT-05, punto a)
//
// EL SELECTOR DE PREFIJO DE PAÍS. España primero, el resto con bandera + nombre + prefijo.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL PRESUPUESTO DE PESO MANDA (Parte AB · <1,5 s en 4G · Lighthouse ≥90), Y POR ESO NO HAY
// NI NOMBRES NI IMÁGENES EN ESTE FICHERO
//
// Una lista de ~200 países con su nombre en español y su bandera es, hecha a lo bruto, varios
// cientos de KB —o una librería, que la regla 36 prohíbe—. Aquí no pesa casi nada, y es por dos
// decisiones que conviene dejar escritas porque no son obvias:
//
//   ① EL NOMBRE LO PONE EL NAVEGADOR. `Intl.DisplayNames` traduce un código ISO a «España»,
//      «Francia», «Alemania»… en el idioma que se le pida. Está en el navegador desde 2021 y no
//      cuesta ni un byte de descarga. Así que aquí sólo viaja el ISO y el prefijo.
//      ⚠️ Con su respaldo: si no existe —navegador viejo, o entorno sin ICU completo— se enseña
//      el propio código ISO. Un selector que dice «FR +33» sigue siendo usable; uno que revienta
//      al montarse deja al profesional sin poder escribir un teléfono.
//
//   ② LA BANDERA SE CALCULA, NO SE DESCARGA. Los emoji de bandera son dos «indicadores
//      regionales», que son las letras A-Z desplazadas a otro bloque Unicode. O sea que la
//      bandera de `ES` ES `ES` con otro código de carácter: cero imágenes, cero sprites, cero
//      peticiones. Si la plataforma no las dibuja se ven las dos letras, que tampoco estorba.
//
// Resultado: los datos son una sola cadena de pares `ISO+prefijo`. El peso medido va en la
// entrada de SCRUM-578; el comando para volver a medirlo es `node scripts/censo-peso-prefijos.mjs`.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// MICROCOPY (regla 30)
//
// Aquí NO hay ni un texto de interfaz. Los nombres de país los da `Intl` —no son copy nuestro,
// son la traducción estándar del navegador— y el marcador del rótulo del campo vive en
// `customersView.js`, que es quien lo pinta.
(function () {
  'use strict';

  // ISO-3166-1 alfa-2 + prefijo telefónico E.164, separados por coma. Sin nombres: los pone el
  // navegador. España NO está aquí: va aparte, arriba del todo (España-first, máster).
  var TABLA = (
    'AD376,AE971,AF93,AG1,AI1,AL355,AM374,AO244,AR54,AS1,AT43,AU61,AW297,AZ994,' +
    'BA387,BB1,BD880,BE32,BF226,BG359,BH973,BI257,BJ229,BM1,BN673,BO591,BR55,BS1,BT975,BW267,BY375,BZ501,' +
    'CA1,CD243,CF236,CG242,CH41,CI225,CK682,CL56,CM237,CN86,CO57,CR506,CU53,CV238,CW599,CY357,CZ420,' +
    'DE49,DJ253,DK45,DM1,DO1,DZ213,EC593,EE372,EG20,ER291,ET251,' +
    'FI358,FJ679,FK500,FM691,FO298,FR33,GA241,GB44,GD1,GE995,GF594,GH233,GI350,GL299,GM220,GN224,GP590,' +
    'GQ240,GR30,GT502,GU1,GW245,GY592,HK852,HN504,HR385,HT509,HU36,' +
    'ID62,IE353,IL972,IN91,IQ964,IR98,IS354,IT39,JM1,JO962,JP81,' +
    'KE254,KG996,KH855,KI686,KM269,KN1,KP850,KR82,KW965,KY1,KZ7,' +
    'LA856,LB961,LC1,LI423,LK94,LR231,LS266,LT370,LU352,LV371,LY218,' +
    'MA212,MC377,MD373,ME382,MG261,MH692,MK389,ML223,MM95,MN976,MO853,MQ596,MR222,MT356,MU230,MV960,' +
    'MW265,MX52,MY60,MZ258,NA264,NC687,NE227,NG234,NI505,NL31,NO47,NP977,NR674,NU683,NZ64,' +
    'OM968,PA507,PE51,PF689,PG675,PH63,PK92,PL48,PM508,PR1,PS970,PT351,PW680,PY595,QA974,' +
    'RE262,RO40,RS381,RU7,RW250,SA966,SB677,SC248,SD249,SE46,SG65,SI386,SK421,SL232,SM378,SN221,' +
    'SO252,SR597,SS211,ST239,SV503,SY963,SZ268,TD235,TG228,TH66,TJ992,TL670,TM993,TN216,TO676,TR90,' +
    'TT1,TV688,TW886,TZ255,UA380,UG256,US1,UY598,UZ998,VA39,VC1,VE58,VG1,VI1,VN84,VU678,WS685,' +
    'XK383,YE967,ZA27,ZM260,ZW263'
  );

  /** España va aparte y PRIMERA. España-first no es una preferencia: es el máster. */
  var ESPANA = { iso: 'ES', prefijo: '34' };

  function parsear(tabla) {
    var fuera = [];
    var trozos = tabla.split(',');
    for (var i = 0; i < trozos.length; i += 1) {
      var t = trozos[i];
      if (t.length < 3) continue;
      fuera.push({ iso: t.slice(0, 2), prefijo: t.slice(2) });
    }
    return fuera;
  }

  /**
   * La bandera, CALCULADA. `A` (65) → indicador regional `🇦` (0x1F1E6): el desplazamiento es
   * constante, así que dos letras ISO son dos indicadores y el navegador los dibuja juntos.
   */
  function banderaDe(iso) {
    var s = String(iso || '').toUpperCase();
    if (!/^[A-Z]{2}$/.test(s)) return '';
    return String.fromCodePoint(0x1f1e6 + (s.charCodeAt(0) - 65))
      + String.fromCodePoint(0x1f1e6 + (s.charCodeAt(1) - 65));
  }

  // Se construye UNA vez: `Intl.DisplayNames` es caro de instanciar y barato de reusar.
  var traductor = null;
  function nombreDe(iso) {
    if (traductor === null) {
      try {
        traductor = new Intl.DisplayNames(['es'], { type: 'region' });
      } catch (e) {
        traductor = false; // no hay: se cae al código ISO, que sigue siendo usable
      }
    }
    if (!traductor) return String(iso).toUpperCase();
    try {
      return traductor.of(String(iso).toUpperCase()) || String(iso).toUpperCase();
    } catch (e) {
      return String(iso).toUpperCase();
    }
  }

  /** La lista lista para pintar: España primero, el resto por nombre en español. */
  function listaDePrefijos() {
    var resto = parsear(TABLA)
      .map(function (p) { return { iso: p.iso, prefijo: p.prefijo, nombre: nombreDe(p.iso) }; })
      .sort(function (a, b) { return a.nombre.localeCompare(b.nombre, 'es'); });
    var es = { iso: ESPANA.iso, prefijo: ESPANA.prefijo, nombre: nombreDe(ESPANA.iso) };
    return [es].concat(resto);
  }

  /**
   * El `<select>` de prefijo. Sin rótulo: el rótulo del campo lo pone quien lo monta, con su
   * marcador, porque el texto es del fundador (regla 30).
   *
   * Objetivo táctil ≥44 px por la clase `.prefijo-pais`, igual criterio que vigilan los guards
   * de la landing — aquí no hay guard que lo mire (SCRUM-628), así que se cumple a mano.
   */
  function selectorDePrefijo(o) {
    var opciones = o || {};
    var d = opciones.doc || (typeof document !== 'undefined' ? document : null);
    if (!d) return null;

    var sel = d.createElement('select');
    sel.className = 'input prefijo-pais';
    sel.name = 'prefijoPais';
    var lista = listaDePrefijos();
    for (var i = 0; i < lista.length; i += 1) {
      var p = lista[i];
      var op = d.createElement('option');
      op.value = p.prefijo;
      // Bandera + nombre + prefijo. Ninguno de los tres es copy nuestro.
      op.textContent = banderaDe(p.iso) + ' ' + p.nombre + ' +' + p.prefijo;
      sel.appendChild(op);
    }
    sel.value = opciones.valor || ESPANA.prefijo;
    return sel;
  }

  var api = {
    ESPANA: ESPANA,
    TABLA: TABLA,
    banderaDe: banderaDe,
    nombreDe: nombreDe,
    listaDePrefijos: listaDePrefijos,
    selectorDePrefijo: selectorDePrefijo,
  };

  // El `typeof window` permite que la suite CARGUE el fichero y ejecute las reglas de verdad.
  if (typeof window !== 'undefined') window.prefijosPais = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
