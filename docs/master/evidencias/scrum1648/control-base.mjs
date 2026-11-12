// Control: el «> absoluta sin cd» que sale MAL, ¿es por las barras o por desde DÓNDE arranca?
// Reutiliza el banco que deja mide.mjs. Sólo pregunta.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const [RAIZ, BANCO] = process.argv.slice(2);
const { evaluar } = await import(pathToFileURL(path.join(RAIZ, '.claude', 'hooks', 'guard-dangerous.mjs')).href);
const FALSO = path.join(BANCO, '__no-existe__');
const LIMPIO = path.join(BANCO, 'limpio'); const SUCIO = path.join(BANCO, 'sucio');
const objetivo = path.join(LIMPIO, 'rastreado.txt').replace(/\\/g, '/');
for (const [nombre, base] of [['base = EL MISMO repo', LIMPIO], ['base = OTRO repo', SUCIO], ['base = no-repo', path.join(BANCO, 'base-no-repo')]]) {
  const crudo = JSON.stringify({ tool_name: 'PowerShell', tool_input: { command: `echo x > ${objetivo}` } });
  const r = evaluar(crudo, FALSO, { base, sentinelDestructivo: FALSO });
  console.log(`${nombre}\t${r.bloqueado ? 'BLOQUEA' : 'deja'}\t${(r.motivo || '').split('\n')[0].slice(0, 60)}`);
}
