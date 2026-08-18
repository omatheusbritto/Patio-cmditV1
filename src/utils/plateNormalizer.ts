import { FuelLevel, LocationCode, VehicleCharacteristic } from '../types';

// Regex patterns for Brazilian plates
// Standard Mercosul Car: 3 letters, 1 number, 1 letter, 2 numbers (e.g. BRA2E19)
export const MERCOSUL_REGEX = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/;

// Mercosul Motorcycle: 3 letters, 2 numbers, 1 letter, 1 number (e.g. ABC12D3)
export const MERCOSUL_MOTO_REGEX = /^[A-Z]{3}[0-9]{2}[A-Z][0-9]$/;

// Old Brazilian Plate: 3 letters, 4 numbers (e.g. ABC1234)
export const OLD_PLATE_REGEX = /^[A-Z]{3}[0-9]{4}$/;

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
  'U': '0',
  'I': '1',
  'i': '1',
  'L': '1',
  'l': '1',
  '|': '1',
  '/': '1',
  'Z': '2',
  'z': '2',
  'E': '3',
  'e': '3',
  'A': '4',
  'a': '4',
  'S': '5',
  's': '5',
  'G': '6',
  'g': '6',
  'b': '6',
  'T': '7',
  't': '7',
  'B': '8',
  'P': '9',
  'p': '9',
  'q': '9',
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
    return clean; // Mercosul usually displayed as ABC1D23 or BRA2E19
  }
  return clean;
}

/**
 * Validate whether a string is a valid Brazilian license plate (Mercosul Car, Mercosul Moto or Old)
 */
export function isValidBrazilianPlate(plate: string): boolean {
  const clean = sanitizeRawText(plate);
  return (
    MERCOSUL_REGEX.test(clean) ||
    OLD_PLATE_REGEX.test(clean) ||
    MERCOSUL_MOTO_REGEX.test(clean)
  );
}

/**
 * Detect whether plate is Mercosul format
 */
export function isMercosulFormat(plate: string): boolean {
  const clean = sanitizeRawText(plate);
  return MERCOSUL_REGEX.test(clean) || MERCOSUL_MOTO_REGEX.test(clean);
}

/**
 * Attempt to fix OCR character ambiguities for a 7-character string.
 * Tests Mercosul car (LLLNLNN), Old pattern (LLLNNNN), and Mercosul moto (LLLNNLN).
 */
export function tryFixPlateCandidates(sevenCharCandidate: string): string[] {
  const raw = sanitizeRawText(sevenCharCandidate);
  if (raw.length !== 7) return [];

  // Direct match?
  if (isValidBrazilianPlate(raw)) {
    return [raw];
  }

  const chars = raw.split('');

  // 1. Try to coerce into Mercosul Car: LLL - N - L - NN
  const mercosulCar = [
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

  // 3. Try to coerce into Mercosul Moto: LLL - NN - L - N
  const mercosulMoto = [
    NUM_TO_LETTER[chars[0]] || chars[0],
    NUM_TO_LETTER[chars[1]] || chars[1],
    NUM_TO_LETTER[chars[2]] || chars[2],
    LETTER_TO_NUM[chars[3]] || chars[3],
    LETTER_TO_NUM[chars[4]] || chars[4],
    NUM_TO_LETTER[chars[5]] || chars[5],
    LETTER_TO_NUM[chars[6]] || chars[6],
  ].join('');

  const candidates: string[] = [];
  if (MERCOSUL_REGEX.test(mercosulCar) && !candidates.includes(mercosulCar)) {
    candidates.push(mercosulCar);
  }
  if (OLD_PLATE_REGEX.test(oldCoerced) && !candidates.includes(oldCoerced)) {
    candidates.push(oldCoerced);
  }
  if (MERCOSUL_MOTO_REGEX.test(mercosulMoto) && !candidates.includes(mercosulMoto)) {
    candidates.push(mercosulMoto);
  }

  return candidates;
}

/**
 * Filter out common non-plate noise words found on Brazilian cars and license plate frames
 */
const NOISE_WORDS = new Set([
  'BRASIL',
  'BRAZIL',
  'MERCOSUL',
  'MERCOSUR',
  'MERC',
  'DETRAN',
  'CHEVROLET',
  'VOLKSWAGEN',
  'FIAT',
  'TOYOTA',
  'HYUNDAI',
  'HONDA',
  'RENAULT',
  'NISSAN',
  'FORD',
  'JEEP',
  'PEUGEOT',
  'CITROEN',
  'MOTORS',
  'VEICULOS',
  'AUTO',
  'CAR',
  'PLACA',
]);

/**
 * Extract plate candidates from any raw OCR string using multi-token sliding window and fuzzy disambiguation.
 */
export function extractPlatesFromText(ocrText: string): { plate: string; isMercosul: boolean; confidence: number } | null {
  if (!ocrText || ocrText.trim().length === 0) return null;

  // Normalize delimiters & replace newlines with space
  const normalizedRaw = ocrText
    .toUpperCase()
    .replace(/[·•\-_:|/\\]/g, ' ')
    .replace(/[\n\r\t]+/g, ' ');

  // Split into alphanumeric tokens
  const tokens = normalizedRaw
    .replace(/[^A-Z0-9\s]/g, '')
    .split(/\s+/)
    .filter((t) => t.length > 0 && !NOISE_WORDS.has(t));

  // 1. Direct single-token check
  for (const token of tokens) {
    const sanitized = sanitizeRawText(token);
    if (isValidBrazilianPlate(sanitized)) {
      return {
        plate: sanitized,
        isMercosul: isMercosulFormat(sanitized),
        confidence: 0.99,
      };
    }
  }

  // 2. Sliding window of joined adjacent tokens (e.g. ["ABC", "1D23"] -> "ABC1D23", ["BRA", "2E19"] -> "BRA2E19", ["A", "B", "C", "1", "2", "3", "4"])
  for (let windowSize = 2; windowSize <= Math.min(7, tokens.length); windowSize++) {
    for (let i = 0; i <= tokens.length - windowSize; i++) {
      const combined = tokens.slice(i, i + windowSize).join('');
      const sanitized = sanitizeRawText(combined);

      if (isValidBrazilianPlate(sanitized)) {
        return {
          plate: sanitized,
          isMercosul: isMercosulFormat(sanitized),
          confidence: 0.96,
        };
      }

      if (sanitized.length === 7) {
        const fixed = tryFixPlateCandidates(sanitized);
        if (fixed.length > 0) {
          return {
            plate: fixed[0],
            isMercosul: isMercosulFormat(fixed[0]),
            confidence: 0.90,
          };
        }
      }
    }
  }

  // 3. Single token OCR ambiguity fix (e.g. 7-char token that has 0 instead of O)
  for (const token of tokens) {
    const sanitized = sanitizeRawText(token);
    if (sanitized.length === 7) {
      const fixed = tryFixPlateCandidates(sanitized);
      if (fixed.length > 0) {
        return {
          plate: fixed[0],
          isMercosul: isMercosulFormat(fixed[0]),
          confidence: 0.88,
        };
      }
    }
  }

  // 4. Sliding window across the entire continuous alphanumeric string
  const allSanitized = sanitizeRawText(normalizedRaw);
  if (allSanitized.length >= 7) {
    for (let i = 0; i <= allSanitized.length - 7; i++) {
      const window = allSanitized.slice(i, i + 7);
      if (isValidBrazilianPlate(window)) {
        return {
          plate: window,
          isMercosul: isMercosulFormat(window),
          confidence: 0.92,
        };
      }
    }

    // Try OCR coercion heuristics on continuous 7-char slices
    for (let i = 0; i <= allSanitized.length - 7; i++) {
      const window = allSanitized.slice(i, i + 7);
      const fixedCandidates = tryFixPlateCandidates(window);
      if (fixedCandidates.length > 0) {
        const best = fixedCandidates[0];
        return {
          plate: best,
          isMercosul: isMercosulFormat(best),
          confidence: 0.82,
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

