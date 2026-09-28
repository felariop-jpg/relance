import { fold } from './text';

// Official ISO 3166-1 alpha-2 codes, plus XK (Kosovo, widely used).
// Explicit rather than derived from Intl, which also knows legacy codes (FX, UK, SU...).
const ISO_CODES = `
AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ
BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM
DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS
GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN
KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ
MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM
PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV
SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI
VN VU WF WS XK YE YT ZA ZM ZW`
  .trim()
  .split(/\s+/);

const ALIASES: Record<string, string> = {
  uk: 'GB',
  'great britain': 'GB',
  england: 'GB',
  scotland: 'GB',
  wales: 'GB',
  'northern ireland': 'GB',
  angleterre: 'GB',
  ecosse: 'GB',
  usa: 'US',
  'united states of america': 'US',
  'etats-unis': 'US',
  'etats unis': 'US',
  holland: 'NL',
  hollande: 'NL',
};

/** Every country code Relance offers. */
export function countryCodes(): string[] {
  return ISO_CODES;
}

const displayNames = new Map<string, Intl.DisplayNames>();

export function countryName(code: string, locale: string): string {
  if (!code) return '';
  try {
    let names = displayNames.get(locale);
    if (!names) {
      names = new Intl.DisplayNames([locale], { type: 'region', fallback: 'code' });
      displayNames.set(locale, names);
    }
    return names.of(code) ?? code;
  } catch {
    return code;
  }
}

export function countryOptions(locale: string): { code: string; name: string }[] {
  return countryCodes()
    .map((code) => ({ code, name: countryName(code, locale) }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));
}

let nameIndex: Map<string, string> | null = null;

function index(): Map<string, string> {
  if (nameIndex) return nameIndex;
  const map = new Map<string, string>();
  for (const locale of ['en', 'fr']) {
    const names = new Intl.DisplayNames([locale], { type: 'region', fallback: 'none' });
    for (const code of countryCodes()) {
      const name = names.of(code);
      if (name) map.set(fold(name), code);
    }
  }
  for (const [alias, code] of Object.entries(ALIASES)) map.set(alias, code);
  nameIndex = map;
  return map;
}

/**
 * Reads a country from an ISO-2 code or an English/French name.
 * Returns '' for blank input and null when it cannot be recognised.
 */
export function parseCountry(raw: string): string | null {
  const value = raw.trim();
  if (!value) return '';
  const upper = value.toUpperCase();
  if (upper.length === 2 && countryCodes().includes(upper)) return upper;
  return index().get(fold(value)) ?? null;
}
