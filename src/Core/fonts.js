// BOTIFY-X Font Transforms
// Unicode character range remapping for styled text output

const RANGES = {
    boldUpper:      0x1D400,
    boldLower:      0x1D41A,
    italicUpper:    0x1D434,
    italicLower:    0x1D44E,
    boldItalicUpper:0x1D468,
    boldItalicLower:0x1D482,
    monoUpper:      0x1D670,
    monoLower:      0x1D68A,
    monoDigit:      0x1D7F6,
};

// Digits for bold
const BOLD_DIGITS   = '𝟎𝟏𝟐𝟑𝟒𝟓𝟔𝟕𝟖𝟗'.split('');
const MONO_DIGITS   = '𝟶𝟷𝟸𝟹𝟺𝟻𝟼𝟽𝟾𝟿'.split('');
const BUBBLE_UPPER  = 'ⒶⒷⒸⒹⒺⒻⒼⒽⒾⒿⓀⓁⓂⓃⓄⓅⓆⓇⓈⓉⓊⓋⓌⓍⓎⓏ'.split('');
const BUBBLE_LOWER  = 'ⓐⓑⓒⓓⓔⓕⓖⓗⓘⓙⓚⓛⓜⓝⓞⓟⓠⓡⓢⓣⓤⓥⓦⓧⓨⓩ'.split('');
const BUBBLE_DIGITS = '⓪①②③④⑤⑥⑦⑧⑨'.split('');
const SQUARE_UPPER  = '🄰🄱🄲🄳🄴🄵🄶🄷🄸🄹🄺🄻🄼🄽🄾🄿🅀🅁🅂🅃🅄🅅🅆🅇🅈🅉'.split('');
const SMALL_CAPS    = 'ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀsᴛᴜᴠᴡxʏᴢ'.split('');

function charCode(char) {
    return char.codePointAt(0);
}

function fromCode(code) {
    return String.fromCodePoint(code);
}

function isUpper(c) { return c >= 'A' && c <= 'Z'; }
function isLower(c) { return c >= 'a' && c <= 'z'; }
function isDigit(c) { return c >= '0' && c <= '9'; }

function transform(text, fn) {
    return [...text].map(fn).join('');
}

const fonts = {
    default: (text) => text,

    bold: (text) => transform(text, (c) => {
        if (isUpper(c)) return fromCode(RANGES.boldUpper + charCode(c) - 65);
        if (isLower(c)) return fromCode(RANGES.boldLower + charCode(c) - 97);
        if (isDigit(c)) return BOLD_DIGITS[charCode(c) - 48];
        return c;
    }),

    italic: (text) => transform(text, (c) => {
        if (isUpper(c)) return fromCode(RANGES.italicUpper + charCode(c) - 65);
        if (isLower(c)) {
            // 'h' is missing in italic lowercase unicode block, special case
            const offset = charCode(c) - 97;
            if (offset === 7) return '𝘩';
            return fromCode(RANGES.italicLower + offset);
        }
        return c;
    }),

    boldItalic: (text) => transform(text, (c) => {
        if (isUpper(c)) return fromCode(RANGES.boldItalicUpper + charCode(c) - 65);
        if (isLower(c)) return fromCode(RANGES.boldItalicLower + charCode(c) - 97);
        return c;
    }),

    monospace: (text) => transform(text, (c) => {
        if (isUpper(c)) return fromCode(RANGES.monoUpper + charCode(c) - 65);
        if (isLower(c)) return fromCode(RANGES.monoLower + charCode(c) - 97);
        if (isDigit(c)) return MONO_DIGITS[charCode(c) - 48];
        return c;
    }),

    smallCaps: (text) => transform(text, (c) => {
        if (isUpper(c)) return SMALL_CAPS[charCode(c) - 65] || c;
        if (isLower(c)) return SMALL_CAPS[charCode(c) - 97] || c;
        return c;
    }),

    bubble: (text) => transform(text, (c) => {
        if (isUpper(c)) return BUBBLE_UPPER[charCode(c) - 65] || c;
        if (isLower(c)) return BUBBLE_LOWER[charCode(c) - 97] || c;
        if (isDigit(c)) return BUBBLE_DIGITS[charCode(c) - 48] || c;
        return c;
    }),

    square: (text) => transform(text, (c) => {
        if (isUpper(c)) return SQUARE_UPPER[charCode(c) - 65] || c;
        if (isLower(c)) return SQUARE_UPPER[charCode(c) - 97] || c;
        return c;
    }),
};

module.exports = fonts;
