// Salvage Cyrillic node names from STEP files that were written in
// Windows-1251 without proper ISO-10303-21 escape sequences. occt-import-js
// reads them as Latin-1, so "Прокладка" comes back as "Ïðîêëàäêà".
//
// We detect that pattern (string contains code points in the 0x80-0xFF range
// but nothing higher) and re-decode the same byte sequence as windows-1251.
// We then sanity-check that the result actually contains Cyrillic letters
// before swapping — otherwise an English string with a "ñ" tilde would get
// destroyed.
//
// The harder mojibake case (`\X2\xxxx\X0\` decoded with the wrong endianness,
// producing things like "m린 G-2") is out of scope here — the bytes are
// already lost by the time the JSON reaches us.

const CYRILLIC_RE = /[А-яЁёЇїІіЄєҐґ]/;

function looksLikeLatin1Mojibake(s: string): boolean {
    let hasLatin1Supp = false;
    for (let i = 0; i < s.length; i++) {
        const c = s.charCodeAt(i);
        if (c > 0xff) return false; // higher code points → not pure Latin-1
        if (c >= 0x80) hasLatin1Supp = true;
    }
    return hasLatin1Supp;
}

let decoder: TextDecoder | null = null;
function getDecoder(): TextDecoder | null {
    if (decoder) return decoder;
    try {
        decoder = new TextDecoder('windows-1251');
    } catch {
        decoder = null;
    }
    return decoder;
}

export function decodeName(s: string | undefined | null): string {
    if (!s) return '';
    if (!looksLikeLatin1Mojibake(s)) return s;

    const dec = getDecoder();
    if (!dec) return s;

    const bytes = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
    const candidate = dec.decode(bytes);
    return CYRILLIC_RE.test(candidate) ? candidate : s;
}

// Any code point outside ASCII printable + Cyrillic (incl. Ukrainian
// additions) + a handful of common technical symbols is treated as mojibake
// from a STEP `\X2\xxxx\X0\` escape that occt-import-js decoded incorrectly.
// Hangul, CJK, modifier letters, private-use, even Latin-1 supplement chars
// like superscript-2 (which used to be a Cyrillic В) all show up that way.
//
// The set is deliberately narrow — false positives surface as "Part N" in
// the tree, which is fixable; false negatives leave unreadable glyphs in
// place, which isn't.
const ALLOWED_RE = /^[\x20-\x7EЀ-ӿԀ-ԯ\s°§©®]*$/u;

export function isReadableName(s: string): boolean {
    return ALLOWED_RE.test(s);
}

export function decodeOrLabel(
    raw: string | undefined | null,
    counter: { n: number },
    prefix: string,
): string {
    const decoded = decodeName(raw);
    if (decoded && isReadableName(decoded)) return decoded;
    counter.n += 1;
    return `${prefix} ${counter.n}`;
}
