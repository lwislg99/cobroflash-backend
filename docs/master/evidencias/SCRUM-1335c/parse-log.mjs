// Parser del log del job "trinquete zona". Exporta parseLog(text) -> objeto de metricas.
// Uso CLI: node parse-log.mjs <fichero.log>   (imprime JSON)

export function stripAnsi(s) {
  // elimina secuencias ANSI (colores, cursor, etc.)
  return s.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -\/]*[@-~])/g, '');
}

export function parseLog(raw) {
  const text = stripAnsi(raw);
  const lines = text.split(/\r?\n/).map(l => l.replace(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z\s?/, ''));

  const out = {
    poblacion_N: null, // ficheros de la tanda
    poblacion_canarios: null,
    poblacion_M: null,
    zonas: [], // { zona, ok, pruebas, segundos, motivo }
    repesca_K: null,
    repesca_ficheros: [], // { fichero, cambian, sinComparar, candidatasEnTanda }
    cambian_veredicto_X: null,
    censadas_Y: null,
    no_pude_comparar: null, // { enTanda_P, comparadasQ, siguenSinCompararR }
    siguen_sin_comparar_ficheros: [], // { fichero, n, zona }
    veredicto_final: null,
    lineas_relevantes: [],
  };

  for (const line of lines) {
    // N ficheros de la tanda + 4 canarios = M
    let m = line.match(/(\d+)\s+ficheros de la tanda\s*\+\s*(\d+)\s+canarios\s*=\s*(\d+)/);
    if (m) {
      out.poblacion_N = Number(m[1]);
      out.poblacion_canarios = Number(m[2]);
      out.poblacion_M = Number(m[3]);
      out.lineas_relevantes.push(line.trim());
      continue;
    }

    // midiendo en Pacific/Kiritimati … 10656 pruebas · 367 s · el hijo vio …
    m = line.match(/midiendo en (\S+)\s*…?\s*(.*)$/);
    if (m) {
      const zona = m[1];
      const resto = m[2];
      const fail = resto.match(/🔴\s*(.*)$/);
      if (fail) {
        out.zonas.push({ zona, ok: false, motivo: fail[1].trim() });
      } else {
        const mm = resto.match(/(\d+)\s*pruebas\s*·\s*(\d+)\s*s/);
        out.zonas.push({
          zona,
          ok: true,
          pruebas: mm ? Number(mm[1]) : null,
          segundos: mm ? Number(mm[2]) : null,
          resto,
        });
      }
      out.lineas_relevantes.push(line.trim());
      continue;
    }

    // REPESCA · K fichero(s) con candidatos, medidos a solas
    m = line.match(/REPESCA\s*·\s*(\d+)\s*fichero\(s\)\s*con candidatos/);
    if (m) {
      out.repesca_K = Number(m[1]);
      out.lineas_relevantes.push(line.trim());
      continue;
    }

    // <fichero>   a solas: cambian A · sin comparar B   (candidatas en la tanda: C)
    m = line.match(/^\s*(\S.*?)\s{2,}a solas:\s*cambian\s*(\d+)\s*·\s*sin comparar\s*(\d+)\s*\(candidatas en la tanda:\s*(\d+)\)/);
    if (m) {
      out.repesca_ficheros.push({
        fichero: m[1].trim(),
        cambian: Number(m[2]),
        sinComparar: Number(m[3]),
        candidatasEnTanda: Number(m[4]),
      });
      out.lineas_relevantes.push(line.trim());
      continue;
    }

    // CAMBIAN DE VEREDICTO EN EL ÁRBOL: X  (censadas: Y)
    m = line.match(/CAMBIAN DE VEREDICTO EN EL [ÁA]RBOL:\s*(\d+)\s*\(censadas:\s*(\d+)\)/);
    if (m) {
      out.cambian_veredicto_X = Number(m[1]);
      out.censadas_Y = Number(m[2]);
      out.lineas_relevantes.push(line.trim());
      continue;
    }

    // NO PUDE COMPARAR · en la tanda P · comparadas a solas, con el mismo veredicto Q · SIGUEN SIN COMPARAR R
    m = line.match(/NO PUDE COMPARAR\s*·\s*en la tanda\s*(\d+)\s*·\s*comparadas a solas,?\s*con el mismo veredicto\s*(\d+)\s*·\s*SIGUEN SIN COMPARAR\s*(\d+)/);
    if (m) {
      out.no_pude_comparar = {
        enTanda_P: Number(m[1]),
        comparadasQ: Number(m[2]),
        siguenSinCompararR: Number(m[3]),
      };
      out.lineas_relevantes.push(line.trim());
      continue;
    }

    //    · <fichero>   n prueba(s) · faltan n en <zona>
    m = line.match(/^\s*·\s*(\S.*?)\s{2,}(\d+)\s*prueba\(s\)\s*·\s*faltan\s*(\d+)\s*en\s*(\S+)/);
    if (m) {
      out.siguen_sin_comparar_ficheros.push({
        fichero: m[1].trim(),
        n: Number(m[2]),
        faltan: Number(m[3]),
        zona: m[4],
      });
      out.lineas_relevantes.push(line.trim());
      continue;
    }

    // veredicto final
    if (/✔\s*TRINQUETE EN VERDE/.test(line)) {
      out.veredicto_final = 'TRINQUETE EN VERDE';
      out.lineas_relevantes.push(line.trim());
      continue;
    }
    if (/🔴\s*CIEGO/.test(line)) {
      out.veredicto_final = 'CIEGO';
      out.lineas_relevantes.push(line.trim());
      continue;
    }
    if (/🔴\s*EL TRINQUETE HABLA/.test(line)) {
      out.veredicto_final = 'EL TRINQUETE HABLA';
      out.lineas_relevantes.push(line.trim());
      continue;
    }
    if (/🔴\s*UNA CENSADA SE APAG[OÓ]/.test(line)) {
      out.veredicto_final = 'UNA CENSADA SE APAGO';
      out.lineas_relevantes.push(line.trim());
      continue;
    }
  }

  return out;
}

import { pathToFileURL } from 'node:url';
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const fs = await import('node:fs');
  const file = process.argv[2];
  const raw = fs.readFileSync(file, 'utf8');
  console.log(JSON.stringify(parseLog(raw), null, 2));
}
