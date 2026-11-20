import { beforeEach, describe, expect, it } from 'vitest';
import {
  appendPlusComparison, readPlusComparison, readPlusComparisonLabels, savePlusComparison,
} from './plusComparisonSelection';

const a = '12345678-1234-4234-8234-123456789abc';
const b = '12345678-1234-4234-8234-123456789abd';
const c = '12345678-1234-4234-8234-123456789abe';
const d = '12345678-1234-4234-8234-123456789abf';
const e = '12345678-1234-4234-8234-123456789ac0';

beforeEach(() => window.sessionStorage.clear());

describe('Comparación Plus: selección por cuenta y pestaña', () => {
  it('adds a product and displays its actual published name without a pasted link', () => {
    expect(appendPlusComparison('usuario-1', a, 'Pan queso')).toMatchObject({ outcome: 'added', ids: [a] });
    expect(readPlusComparisonLabels('usuario-1')).toEqual({ [a]: 'Pan queso' });
    expect(readPlusComparison('usuario-1')).toEqual([a]);
  });

  it('prevents repeated options, the fifth option, and invalid identifiers', () => {
    appendPlusComparison('usuario-1', a);
    expect(appendPlusComparison('usuario-1', a).outcome).toBe('duplicate');
    for (const id of [b, c, d]) expect(appendPlusComparison('usuario-1', id).outcome).toBe('added');
    expect(appendPlusComparison('usuario-1', e).outcome).toBe('full');
    expect(readPlusComparison('usuario-1')).toHaveLength(4);
    expect(appendPlusComparison('usuario-2', 'invalid').outcome).toBe('invalid');
  });

  it('removes labels and selections together when the user restarts', () => {
    appendPlusComparison('usuario-1', a, 'Producto 1');
    appendPlusComparison('usuario-1', b, 'Producto 2');
    savePlusComparison('usuario-1', [b]);
    expect(readPlusComparisonLabels('usuario-1')).toEqual({ [b]: 'Producto 2' });
    savePlusComparison('usuario-1', []);
    expect(readPlusComparison('usuario-1')).toEqual([]);
    expect(readPlusComparisonLabels('usuario-1')).toEqual({});
  });

  it('never mixes selections or names between real user accounts', () => {
    appendPlusComparison('usuario-1', a, 'Producto real A');
    appendPlusComparison('usuario-2', b, 'Producto real B');
    expect(readPlusComparison('usuario-1')).toEqual([a]);
    expect(readPlusComparison('usuario-2')).toEqual([b]);
    expect(readPlusComparisonLabels('usuario-1')).toEqual({ [a]: 'Producto real A' });
    expect(readPlusComparisonLabels('usuario-2')).toEqual({ [b]: 'Producto real B' });
  });

  it('discards malformed browser data and never exposes an extra selection', () => {
    window.sessionStorage.setItem('xamuko-plus-comparison:real:usuario-1', 'bad json');
    expect(readPlusComparison('usuario-1')).toEqual([]);
    savePlusComparison('usuario-1', [a, a, b, c, d, e, 'unsafe']);
    expect(readPlusComparison('usuario-1')).toEqual([a, b, c, d]);
  });
});
