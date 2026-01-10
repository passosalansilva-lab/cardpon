import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn utility', () => {
  it('combines class names correctly', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('handles conditional and falsy values', () => {
    const result = cn('a', false && 'b', null as any, undefined as any, 'c');
    expect(result).toBe('a c');
  });
});
