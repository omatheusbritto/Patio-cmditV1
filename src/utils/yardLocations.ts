export interface YardLocationOption {
  id: string;
  name: string;
  shortCode: string;
  isQuadrant: boolean;
  quadrantNumber?: number;
  category: 'quadrante' | 'especial';
}

export const BASE_YARD_LOCATIONS: YardLocationOption[] = [
  { id: 'q1', name: 'Quadrante 1', shortCode: 'Q1', isQuadrant: true, quadrantNumber: 1, category: 'quadrante' },
  { id: 'q2', name: 'Quadrante 2', shortCode: 'Q2', isQuadrant: true, quadrantNumber: 2, category: 'quadrante' },
  { id: 'q3', name: 'Quadrante 3', shortCode: 'Q3', isQuadrant: true, quadrantNumber: 3, category: 'quadrante' },
  { id: 'q4', name: 'Quadrante 4', shortCode: 'Q4', isQuadrant: true, quadrantNumber: 4, category: 'quadrante' },
  { id: 'q5', name: 'Quadrante 5', shortCode: 'Q5', isQuadrant: true, quadrantNumber: 5, category: 'quadrante' },
  
  // Setores Especiais / Operacionais
  { id: 'fp', name: 'FP', shortCode: 'FP', isQuadrant: false, category: 'especial' },
  { id: 'r1', name: 'R1', shortCode: 'R1', isQuadrant: false, category: 'especial' },
  { id: 'servico_estetico', name: 'Serviço externo estético', shortCode: 'ESTÉTICA', isQuadrant: false, category: 'especial' },
  { id: '40', name: '40 (Bolsão 40)', shortCode: '40', isQuadrant: false, category: 'especial' },
  { id: 'am', name: 'AM', shortCode: 'AM', isQuadrant: false, category: 'especial' },
  { id: 'apoio', name: 'Apoio', shortCode: 'APOIO', isQuadrant: false, category: 'especial' },
  { id: 'rampa_fundos', name: 'Rampa dos fundos', shortCode: 'RAMPA', isQuadrant: false, category: 'especial' },
  { id: 'dt', name: 'DT', shortCode: 'DT', isQuadrant: false, category: 'especial' },
  { id: 'fila_pdc', name: 'Fila PDC', shortCode: 'PDC', isQuadrant: false, category: 'especial' },
  { id: 'bolsao_superior', name: 'Bolsão superior', shortCode: 'B.SUP', isQuadrant: false, category: 'especial' },
  { id: 'adm', name: 'ADM', shortCode: 'ADM', isQuadrant: false, category: 'especial' },
  { id: '51', name: '51 (Qualidade)', shortCode: '51', isQuadrant: false, category: 'especial' },
  { id: 'fabrica', name: 'Fabrica', shortCode: 'FÁBRICA', isQuadrant: false, category: 'especial' },
];

export const QUADRANT_ROWS = [1, 2, 3, 4, 5];

/**
 * Returns formatted location string e.g. "Quadrante 1 fila 2"
 */
export function formatQuadrantRow(quadrantNum: number, rowNum: number): string {
  return `Quadrante ${quadrantNum} fila ${rowNum}`;
}

export function formatQuadrantRowCode(quadrantNum: number, rowNum: number): string {
  return `Q${quadrantNum}F${rowNum}`;
}

/**
 * Generates all possible specific location values
 */
export function getAllSpecificYardLocations(): string[] {
  const list: string[] = [];
  
  // Quadrants 1-5 with Filas 1-5
  for (let q = 1; q <= 5; q++) {
    for (let f = 1; f <= 5; f++) {
      list.push(formatQuadrantRow(q, f));
    }
  }

  // Specials
  list.push(
    'FP',
    'R1',
    'Serviço externo estético',
    '40',
    'AM',
    'Apoio',
    'Rampa dos fundos',
    'DT',
    'Fila PDC',
    'Bolsão superior',
    'ADM',
    '51',
    'Fabrica'
  );

  return list;
}

/**
 * Checks if a stored location matches a sector or quadrant
 */
export function matchLocationToGroup(locStr: string | undefined, groupKey: string): boolean {
  if (!locStr) return false;
  const upper = locStr.toUpperCase().trim();
  const grp = groupKey.toUpperCase().trim();

  if (grp === 'ALL') return true;

  if (grp.startsWith('Q') && grp.length === 2) {
    const qNum = grp.substring(1);
    return upper.includes(`QUADRANTE ${qNum}`) || upper.startsWith(`Q${qNum}`);
  }

  if (grp.startsWith('Q') && grp.includes('F')) {
    // e.g. Q1F2
    const parts = grp.match(/Q(\d)F(\d)/);
    if (parts) {
      return (
        upper.includes(`QUADRANTE ${parts[1]} FILA ${parts[2]}`) ||
        upper === `Q${parts[1]}F${parts[2]}`
      );
    }
  }

  return upper.includes(grp) || grp.includes(upper);
}
