import {
  extractPlatesFromText,
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

  // Test 6: Spaced token extraction (e.g. "BRA 2E19")
  const t6_extracted = extractPlatesFromText('BRASIL \n BRA 2E19 \n MERCOSUL');
  const t6_passed = t6_extracted?.plate === 'BRA2E19';
  results.push({
    id: 'test_ocr_spaced_tokens',
    name: 'Extração de placa com espaços e ruído ("BRASIL BRA 2E19 MERCOSUL")',
    category: 'ocr_fix',
    passed: t6_passed,
    expected: 'BRA2E19',
    actual: t6_extracted?.plate || 'Não encontrado',
  });

  // Test 7: Angled / Hyphenated token extraction
  const t7_extracted = extractPlatesFromText('DETRAN SP-SAO PAULO ABC-1234 FIAT');
  const t7_passed = t7_extracted?.plate === 'ABC1234';
  results.push({
    id: 'test_ocr_noisy_old',
    name: 'Extração de placa antiga em foto ruidosa ("SP-SAO PAULO ABC-1234")',
    category: 'ocr_fix',
    passed: t7_passed,
    expected: 'ABC1234',
    actual: t7_extracted?.plate || 'Não encontrado',
  });

  // Test 8: Mercosul Motorcycle Plate extraction
  const t8_extracted = extractPlatesFromText('BRASIL ABC 12 D 3');
  const t8_passed = t8_extracted?.plate === 'ABC12D3';
  results.push({
    id: 'test_ocr_moto',
    name: 'Extração de placa de moto Mercosul ("ABC12D3")',
    category: 'ocr_fix',
    passed: t8_passed,
    expected: 'ABC12D3',
    actual: t8_extracted?.plate || 'Não encontrado',
  });

  // Test 9: Description WITH characteristic
  const t9_desc = generateRecordDescription({
    plate: 'ABC1D23',
    fuel: '6/8',
    characteristic: '🟢 CONSUMIDOR',
    location: 'P1',
  });
  const t9_expected = 'Placa: ABC1D23 | Combustível: 6/8 | Característica: 🟢 CONSUMIDOR | Local: P1';
  results.push({
    id: 'test_desc_with_char',
    name: 'Descrição com Característica selecionada',
    category: 'description',
    passed: t9_desc === t9_expected,
    expected: t9_expected,
    actual: t9_desc,
  });

  // Test 10: Description WITHOUT characteristic (null / empty)
  const t10_desc = generateRecordDescription({
    plate: 'ABC1D23',
    fuel: '6/8',
    characteristic: null,
    location: 'P1',
  });
  const t10_expected = 'Placa: ABC1D23 | Combustível: 6/8 | Local: P1';
  results.push({
    id: 'test_desc_without_char',
    name: 'Descrição sem Característica (deixar em branco)',
    category: 'description',
    passed: t10_desc === t10_expected,
    expected: t10_expected,
    actual: t10_desc,
  });

  // Test 11: Description with REVENDA
  const t11_desc = generateRecordDescription({
    plate: 'XYZ9876',
    fuel: '4/8',
    characteristic: '🟠 REVENDA',
    location: 'ADM',
  });
  const t11_expected = 'Placa: XYZ9876 | Combustível: 4/8 | Característica: 🟠 REVENDA | Local: ADM';
  results.push({
    id: 'test_desc_revenda',
    name: 'Descrição com 🟠 REVENDA e Local ADM',
    category: 'description',
    passed: t11_desc === t11_expected,
    expected: t11_expected,
    actual: t11_desc,
  });

  // Test 12: Description with DT
  const t12_desc = generateRecordDescription({
    plate: 'RIO2A18',
    fuel: '8/8',
    characteristic: '🟣 DT',
    location: 'PDC',
  });
  const t12_expected = 'Placa: RIO2A18 | Combustível: 8/8 | Característica: 🟣 DT | Local: PDC';
  results.push({
    id: 'test_desc_dt',
    name: 'Descrição com 🟣 DT e Local PDC',
    category: 'description',
    passed: t12_desc === t12_expected,
    expected: t12_expected,
    actual: t12_desc,
  });

  const passedCount = results.filter((r) => r.passed).length;
  return {
    passedCount,
    totalCount: results.length,
    results,
  };
}

