// client/src/utils/gs1Parser.js
// Phase 13B: GS1 Application Identifier parser.
//
// Handles the four AIs used in this application:
//   (01) GTIN      — 14 digits (fixed length)
//   (17) Expiry    — 6 digits YYMMDD (fixed length)
//   (10) Batch/Lot — up to 20 chars (variable length)
//   (21) Serial    — up to 20 chars (variable length)
//
// Accepts:
//   - Parenthesized AI strings:    "(01)06130000010003(17)270315(10)B001(21)SN0001"
//   - Concatenated AI strings:     "01061300000100031727031510B001\u001d21SN0001"
//   - Mixed FNC1 (\u001d) separated variants
//   - Any order of AIs
//
// Does NOT guess at unsupported AIs. If the string contains an AI we do not
// recognize in a position we cannot skip, the parser returns ok:false with a
// reason. It never silently produces garbage.
//
// Reference: GS1 General Specifications, Section 7.8 (Application Identifiers).

const FNC1 = '\u001d';
const SENTINEL = '\u241f'; // SYMBOL FOR UNIT SEPARATOR — safe placeholder.

// Only these AIs are supported this phase. Others cause a controlled failure.
const KNOWN_AIS = {
    '01': { name: 'gtin', fixed: 14 },
    '17': { name: 'expiry', fixed: 6 },
    '10': { name: 'batch', fixed: null, max: 20 },
    '21': { name: 'serial', fixed: null, max: 20 },
};

const isDigits = (s) => /^\d+$/.test(s);

const normalize = (raw) => String(raw || '').replace(new RegExp(FNC1, 'g'), SENTINEL);

const parseParenthesized = (input) => {
    // Extracts (AI)value pairs. value runs until the next ( or the sentinel.
    const ais = {};
    const re = /\((\d{2,4})\)([^()]*)/g;
    let m;
    while ((m = re.exec(input)) !== null) {
        const ai = m[1];
        let value = m[2];
        const sep = value.indexOf(SENTINEL);
        if (sep >= 0) value = value.slice(0, sep);
        if (!KNOWN_AIS[ai]) {
            return { ok: false, reason: `unsupported_ai:${ai}`, raw: input };
        }
        ais[ai] = value;
    }
    return { ok: true, ais };
};

const parseConcatenated = (input) => {
    // Walks left-to-right, reading AI + value based on fixed/variable length.
    // Uses SENTINEL as the delimiter for variable-length fields.
    const ais = {};
    let i = 0;
    while (i < input.length) {
        if (input[i] === SENTINEL) { i++; continue; }
        if (i + 2 > input.length) break;

        const ai = input.substr(i, 2);
        const def = KNOWN_AIS[ai];
        if (!def) {
            return { ok: false, reason: `unsupported_ai:${ai}`, raw: input };
        }
        i += 2;

        let value = '';
        if (def.fixed) {
            if (i + def.fixed > input.length) {
                return { ok: false, reason: `truncated_ai:${ai}`, raw: input };
            }
            value = input.substr(i, def.fixed);
            i += def.fixed;
        } else {
            let end = input.indexOf(SENTINEL, i);
            if (end === -1) end = input.length;
            value = input.slice(i, end);
            if (value.length > def.max) {
                return { ok: false, reason: `oversize_ai:${ai}`, raw: input };
            }
            i = end;
        }
        ais[ai] = value;
    }
    return { ok: true, ais };
};

const parseYymmdd = (yymmdd) => {
    if (!yymmdd || !/^\d{6}$/.test(yymmdd)) return null;
    const yy = parseInt(yymmdd.slice(0, 2), 10);
    const mm = parseInt(yymmdd.slice(2, 4), 10);
    const dd = parseInt(yymmdd.slice(4, 6), 10);
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
    const year = 2000 + yy;
    const mmStr = String(mm).padStart(2, '0');
    const ddStr = String(dd).padStart(2, '0');
    return `${year}-${mmStr}-${ddStr}`;
};

/**
 * Parse a decoded GS1 string.
 * @param {string} raw
 * @returns {{
 *   ok: boolean,
 *   reason?: string,
 *   gtin?: string,
 *   batch?: string,
 *   expiryRaw?: string,
 *   expiryISO?: string,
 *   serial?: string,
 *   ais?: Record<string, string>,
 *   raw: string
 * }}
 */
export const parseGS1 = (raw) => {
    const original = String(raw || '');
    const input = normalize(original).trim();

    if (!input) return { ok: false, reason: 'empty', raw: original };

    const hasParens = /\(\d{2,4}\)/.test(input);
    const result = hasParens ? parseParenthesized(input) : parseConcatenated(input);

    if (!result.ok) return { ...result, raw: original };

    const ais = result.ais || {};
    const gtin = ais['01'];
    const batch = ais['10'];
    const expiryRaw = ais['17'];
    const serial = ais['21'];

    if (!gtin) return { ok: false, reason: 'missing_gtin', ais, raw: original };
    if (!isDigits(gtin) || gtin.length !== 14) {
        return { ok: false, reason: 'malformed_gtin', ais, raw: original };
    }
    if (expiryRaw && (!isDigits(expiryRaw) || expiryRaw.length !== 6)) {
        return { ok: false, reason: 'malformed_expiry', ais, raw: original };
    }

    const expiryISO = expiryRaw ? parseYymmdd(expiryRaw) : null;

    return {
        ok: true,
        gtin,
        batch: batch || undefined,
        expiryRaw: expiryRaw || undefined,
        expiryISO: expiryISO || undefined,
        serial: serial || undefined,
        ais,
        raw: original,
    };
};

// ---------------------------------------------------------------------------
// Self-contained example expectations (documentation, not a test runner):
//
//   parseGS1('(01)06130000010003(17)270315(10)B001(21)SN0001')
//     → { ok:true, gtin:'06130000010003', batch:'B001', expiryISO:'2027-03-15',
//         serial:'SN0001' }
//
//   parseGS1('01061300000100031727031510B001\u001d21SN0001')
//     → same result
//
//   parseGS1('0106130000010003')
//     → { ok:true, gtin:'06130000010003' }
//
//   parseGS1('')
//     → { ok:false, reason:'empty' }
//
//   parseGS1('(01)123(21)ABC')
//     → { ok:false, reason:'malformed_gtin' }
//
//   parseGS1('(30)5')
//     → { ok:false, reason:'unsupported_ai:30' }
// ---------------------------------------------------------------------------

export default parseGS1;