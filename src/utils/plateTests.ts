import {
  formatPlateForDisplay,
  generateRecordDescription,
  isMercosulFormat,
  isValidBrazilianPlate,
  sanitizeRawText,
  tryFixPlateCandidates,
} from './plateNormalizer';

export interface TestResult {
  id: string;
  name: string;
  category: 'plate' | 'description' | 'ocr_fix';
  passed: boolean;
  expected: string;
  actual: string;
  details?: string;
}

export function runAllUnitTests(): { passedCount: number; totalCount: number; results: TestResult[] } {
  const results: TestResult[] = [];

  // Test 1: Sanitize text
  const t1_input = '  abc-1d23!  ';
  const t1_actual = sanitizeRawText(t1_input);
  const t1_expected = 'ABC1D23';
  results.push({
    id: 'test_sanitize_1',
    name: 'Sanitização de texto com hífens e espaços',
    category: 'plate',
    passed: t1_actual === t1_expected,
    expected: t1_expected,
    actual: t1_actual,
  });

  // Test 2: Mercosul plate validation
  const t2_mercosul = 'ABC1D23';
  const t2_actual = isValidBrazilianPlate(t2_mercosul) && isMercosulFormat(t2_mercosul);
  results.push({
    id: 'test_mercosul_val',
    name: 'Validação de Placa Mercosul (ABC1D23)',
    category: 'plate',
    passed: t2_actual === true,
    expected: 'true (Mercosul Válida)',
    actual: String(t2_actual),
  });

  // Test 3: Old plate validation
  const t3_old = 'ABC1234';
  const t3_actual = isValidBrazilianPlate(t3_old) && !isMercosulFormat(t3_old);
  results.push({
    id: 'test_old_val',
    name: 'Validação de Placa Antiga (ABC1234)',
    category: 'plate',
    passed: t3_actual === true,
    expected: 'true (Antiga Válida)',
    actual: String(t3_actual),
  });

  // Test 4: Display formatting
  const t4_formatted = formatPlateForDisplay('abc1234');
  results.push({
    id: 'test_format_old',
    name: 'Formatação de exibição placa antiga (ABC-1234)',
    category: 'plate',
    passed: t4_formatted === 'ABC-1234',
    expected: 'ABC-1234',
    actual: t4_formatted,
  });

  // Test 5: OCR disambiguation fix (e.g. '0' confused for 'O' in letter position)
  const t5_fixed = tryFixPlateCandidates('0BC1D23'); // 0 at start should be 'O' -> OBC1D23
  const t5_passed = t5_fixed.includes('OBC1D23');
  results.push({
    id: 'test_ocr_disambiguation',
    name: 'Correção de ambiguidade OCR (0BC1D23 -> OBC1D23)',
    category: 'ocr_fix',
    passed: t5_passed,
    expected: 'OBC1D23',
    actual: t5_fixed.join(', ') || 'Nenhum',
  });

  // Test 6: Description WITH characteristic
  const t6_desc = generateRecordDescription({
    plate: 'ABC1D23',
    fuel: '6/8',
    characteristic: '🟢 CONSUMIDOR',
    location: 'P1',
  });
  const t6_expected = 'Placa: ABC1D23 | Combustível: 6/8 | Característica: 🟢 CONSUMIDOR | Local: P1';
  results.push({
    id: 'test_desc_with_char',
    name: 'Descrição com Característica selecionada',
    category: 'description',
    passed: t6_desc === t6_expected,
    expected: t6_expected,
    actual: t6_desc,
  });

  // Test 7: Description WITHOUT characteristic (null / empty)
  const t7_desc = generateRecordDescription({
    plate: 'ABC1D23',
    fuel: '6/8',
    characteristic: null,
    location: 'P1',
  });
  const t7_expected = 'Placa: ABC1D23 | Combustível: 6/8 | Local: P1';
  results.push({
    id: 'test_desc_without_char',
    name: 'Descrição sem Característica (deixar em branco)',
    category: 'description',
    passed: t7_desc === t7_expected,
    expected: t7_expected,
    actual: t7_desc,
  });

  // Test 8: Description with REVENDA
  const t8_desc = generateRecordDescription({
    plate: 'XYZ9876',
    fuel: '4/8',
    characteristic: '🟠 REVENDA',
    location: 'ADM',
  });
  const t8_expected = 'Placa: XYZ9876 | Combustível: 4/8 | Característica: 🟠 REVENDA | Local: ADM';
  results.push({
    id: 'test_desc_revenda',
    name: 'Descrição com 🟠 REVENDA e Local ADM',
    category: 'description',
    passed: t8_desc === t8_expected,
    expected: t8_expected,
    actual: t8_desc,
  });

  // Test 9: Description with DT
  const t9_desc = generateRecordDescription({
    plate: 'RIO2A18',
    fuel: '8/8',
    characteristic: '🔵 DT',
    location: 'PDC',
  });
  const t9_expected = 'Placa: RIO2A18 | Combustível: 8/8 | Característica: 🔵 DT | Local: PDC';
  results.push({
    id: 'test_desc_dt',
    name: 'Descrição com 🔵 DT e Local PDC',
    category: 'description',
    passed: t9_desc === t9_expected,
    expected: t9_expected,
    actual: t9_desc,
  });

  const passedCount = results.filter((r) => r.passed).length;
  return {
    passedCount,
    totalCount: results.length,
    results,
  };
}
