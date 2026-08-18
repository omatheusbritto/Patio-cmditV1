import { FuelLevel, LocationCode, VehicleCharacteristic } from '../types';

// Regex patterns for Brazilian plates
export const MERCOSUL_REGEX = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/;
export const OLD_PLATE_REGEX = /^[A-Z]{3}[0-9]{4}$/;
export const GENERAL_PLATE_REGEX = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/;

// Number to Letter map (for positions that MUST be letters)
const NUM_TO_LETTER: Record<string, string> = {
  '0': 'O',
  '1': 'I',
  '2': 'Z',
  '3': 'E',
  '4': 'A',
  '5': 'S',
  '6': 'G',
  '7': 'T',
  '8': 'B',
  '9': 'P',
};

// Letter to Number map (for positions that MUST be numbers)
const LETTER_TO_NUM: Record<string, string> = {
  'O': '0',
  'o': '0',
  'D': '0',
  'Q': '0',
  'I': '1',
  'i': '1',
  'L': '1',
  'l': '1',
  'Z': '2',
  'z': '2',
  'E': '3',
  'A': '4',
  'S': '5',
  's': '5',
  'G': '6',
  'B': '8',
  'T': '7',
  'P': '9',
};

/**
 * Basic sanitization: uppercase, alphanumeric only
 */
export function sanitizeRawText(input: string): string {
  if (!input) return '';
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .trim();
}

/**
 * Format plate with hyphen if desired for display (e.g., ABC-1234 or ABC1D23)
 */
export function formatPlateForDisplay(plate: string): string {
  const clean = sanitizeRawText(plate);
  if (clean.length === 7) {
    if (OLD_PLATE_REGEX.test(clean)) {
      return `${clean.slice(0, 3)}-${clean.slice(3)}`;
    }
    return clean; // Mercosul usually displayed as ABC1D23 or ABC 1D23
  }
  return clean;
}

/**
 * Validate whether a string is a valid Brazilian license plate (Mercosul or Old)
 */
export function isValidBrazilianPlate(plate: string): boolean {
  const clean = sanitizeRawText(plate);
  return MERCOSUL_REGEX.test(clean) || OLD_PLATE_REGEX.test(clean);
}

/**
 * Detect whether plate is Mercosul format
 */
export function isMercosulFormat(plate: string): boolean {
  const clean = sanitizeRawText(plate);
  return MERCOSUL_REGEX.test(clean);
}

/**
 * Attempt to fix OCR character ambiguities for a 7-character string.
 * Tests both Mercosul pattern (LLLNLNN) and Old pattern (LLLNNNN).
 */
export function tryFixPlateCandidates(sevenCharCandidate: string): string[] {
  const raw = sanitizeRawText(sevenCharCandidate);
  if (raw.length !== 7) return [];

  // Direct match?
  if (isValidBrazilianPlate(raw)) {
    return [raw];
  }

  const chars = raw.split('');

  // 1. Try to coerce into Mercosul: LLL - N - L - NN
  const mercosulCoerced = [
    NUM_TO_LETTER[chars[0]] || chars[0],
    NUM_TO_LETTER[chars[1]] || chars[1],
    NUM_TO_LETTER[chars[2]] || chars[2],
    LETTER_TO_NUM[chars[3]] || chars[3],
    NUM_TO_LETTER[chars[4]] || chars[4],
    LETTER_TO_NUM[chars[5]] || chars[5],
    LETTER_TO_NUM[chars[6]] || chars[6],
  ].join('');

  // 2. Try to coerce into Old format: LLL - NNNN
  const oldCoerced = [
    NUM_TO_LETTER[chars[0]] || chars[0],
    NUM_TO_LETTER[chars[1]] || chars[1],
    NUM_TO_LETTER[chars[2]] || chars[2],
    LETTER_TO_NUM[chars[3]] || chars[3],
    LETTER_TO_NUM[chars[4]] || chars[4],
    LETTER_TO_NUM[chars[5]] || chars[5],
    LETTER_TO_NUM[chars[6]] || chars[6],
  ].join('');

  const candidates: string[] = [];
  if (MERCOSUL_REGEX.test(mercosulCoerced)) {
    candidates.push(mercosulCoerced);
  }
  if (OLD_PLATE_REGEX.test(oldCoerced) && !candidates.includes(oldCoerced)) {
    candidates.push(oldCoerced);
  }

  return candidates;
}

/**
 * Extract plate candidates from any raw OCR string using sliding window and regex.
 */
export function extractPlatesFromText(ocrText: string): { plate: string; isMercosul: boolean; confidence: number } | null {
  if (!ocrText) return null;

  // 1. Clean line by line & token by token
  const cleanTokens = ocrText
    .toUpperCase()
    .replace(/[\n\r\t]+/g, ' ')
    .replace(/[^A-Z0-9\s-]/g, '')
    .split(/\s+/)
    .filter(Boolean);

  // Check direct tokens first (e.g. "ABC-1234" -> "ABC1234", "ABC1D23")
  for (const token of cleanTokens) {
    const sanitized = sanitizeRawText(token);
    if (isValidBrazilianPlate(sanitized)) {
      return {
        plate: sanitized,
        isMercosul: MERCOSUL_REGEX.test(sanitized),
        confidence: 0.98,
      };
    }
  }

  // Check full cleaned string sliding windows of length 7
  const allSanitized = sanitizeRawText(ocrText);
  if (allSanitized.length >= 7) {
    for (let i = 0; i <= allSanitized.length - 7; i++) {
      const window = allSanitized.slice(i, i + 7);
      if (isValidBrazilianPlate(window)) {
        return {
          plate: window,
          isMercosul: MERCOSUL_REGEX.test(window),
          confidence: 0.95,
        };
      }
    }

    // Try OCR coercion heuristics on windows
    for (let i = 0; i <= allSanitized.length - 7; i++) {
      const window = allSanitized.slice(i, i + 7);
      const fixedCandidates = tryFixPlateCandidates(window);
      if (fixedCandidates.length > 0) {
        const best = fixedCandidates[0];
        return {
          plate: best,
          isMercosul: MERCOSUL_REGEX.test(best),
          confidence: 0.85,
        };
      }
    }
  }

  return null;
}

/**
 * Generate standardized WhatsApp caption description exactly as required:
 * When characteristic is selected:
 * "Placa: ABC1D23 | Combustível: 6/8 | Característica: 🟢 CONSUMIDOR | Local: P1"
 * When characteristic is empty/null:
 * "Placa: ABC1D23 | Combustível: 6/8 | Local: P1"
 */
export function generateRecordDescription(params: {
  plate: string;
  fuel: FuelLevel;
  characteristic?: VehicleCharacteristic | null;
  location: LocationCode;
}): string {
  const plateClean = sanitizeRawText(params.plate) || 'SEM_PLACA';
  const fuel = params.fuel || '1/8';
  const location = params.location || 'P1';

  if (params.characteristic && params.characteristic.trim().length > 0) {
    return `Placa: ${plateClean} | Combustível: ${fuel} | Característica: ${params.characteristic.trim()} | Local: ${location}`;
  }

  return `Placa: ${plateClean} | Combustível: ${fuel} | Local: ${location}`;
}
