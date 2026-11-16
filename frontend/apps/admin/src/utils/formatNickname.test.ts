import { describe, expect, it } from 'vitest';
import { formatNickname } from './format';

describe('Formato del nickname en Admin', () => {
  it('agrega una única arroba cuando el nickname no la tiene', () => {
    expect(formatNickname('usuario')).toBe('@usuario');
  });

  it('no duplica una arroba existente', () => {
    expect(formatNickname('@usuario')).toBe('@usuario');
  });

  it('reduce arrobas repetidas a una sola', () => {
    expect(formatNickname('@@@usuario')).toBe('@usuario');
  });

  it('no muestra arroba si no hay nickname', () => {
    expect(formatNickname(null)).toBe('');
    expect(formatNickname('')).toBe('');
    expect(formatNickname('@@')).toBe('');
  });
});
