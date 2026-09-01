import { describe, expect, it } from 'vitest';
import { decodeName, decodeOrLabel, isReadableName } from './decode-names';

describe('decodeName', () => {
    it('re-decodes windows-1251 bytes that arrived as Latin-1', () => {
        expect(decodeName('Ïðîêëàäêà')).toBe('Прокладка');
    });

    it('leaves plain ASCII untouched', () => {
        expect(decodeName('Bearing housing')).toBe('Bearing housing');
    });

    it('leaves already-correct Cyrillic untouched', () => {
        // Code points above 0xff mean the string was never Latin-1 bytes.
        expect(decodeName('Прокладка')).toBe('Прокладка');
    });

    // The guard that cost the most to get right: a single Cyrillic letter is
    // not evidence, so Latin-1 accented names must survive intact.
    it.each(['Gehäuse', 'Ölfilter', 'Ø12 shaft'])('keeps accented Latin name %s', (name) => {
        expect(decodeName(name)).toBe(name);
    });

    it('returns an empty string for missing input', () => {
        expect(decodeName(undefined)).toBe('');
        expect(decodeName(null)).toBe('');
        expect(decodeName('')).toBe('');
    });
});

describe('isReadableName', () => {
    it.each(['Part 1', 'Кронштейн', 'Кронштейн 90°', 'Вал §2'])('accepts %s', (name) => {
        expect(isReadableName(name)).toBe(true);
    });

    it.each(['m린 G-2', '部品', 'Part²'])('rejects mojibake %s', (name) => {
        expect(isReadableName(name)).toBe(false);
    });
});

describe('decodeOrLabel', () => {
    it('passes through a readable name without touching the counter', () => {
        const counter = { n: 0 };
        expect(decodeOrLabel('Bracket', counter, 'Part')).toBe('Bracket');
        expect(counter.n).toBe(0);
    });

    it('numbers unreadable names sequentially', () => {
        const counter = { n: 0 };
        expect(decodeOrLabel('m린 G-2', counter, 'Part')).toBe('Part 1');
        expect(decodeOrLabel('', counter, 'Part')).toBe('Part 2');
        expect(counter.n).toBe(2);
    });

    it('decodes first and only falls back when decoding fails', () => {
        const counter = { n: 0 };
        expect(decodeOrLabel('Ïðîêëàäêà', counter, 'Part')).toBe('Прокладка');
        expect(counter.n).toBe(0);
    });
});
