import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

let estado = 0;
console.log('CARGA-DEL-MODULO');
test('primero pone estado', () => { estado = 1; });
test('segundo depende del primero', () => { assert.equal(estado, 1); });
test('lento', async () => { await new Promise((r) => setTimeout(r, 300)); });
describe('grupo exterior', () => {
  test('interno con (paréntesis) y [corchetes] y *', () => {});
  test('interno dos', () => {});
});
test('marca execArgv', () => { console.log('EXECARGV=' + JSON.stringify(process.execArgv)); });
