export interface YardLocationOption {
  id: string;
  name: string;
  shortCode: string;
  isQuadrant: boolean;
  quadrantNumber?: number;
  category: 'vaga' | 'bolsao' | 'quadrante' | 'especial';
  description?: string;
  isBolsao?: boolean;
}

export interface KeyYardSlot {
  id: string;
  code: string;
  name: string;
  shortCode: string;
  category: 'vaga_individual' | 'bolsao' | 'quadrante' | 'especial';
  description: string;
  isMultiVehicle: boolean;
  badgeColor: string;
}

/**
 * Principais Vagas Individuais e Bolsões Operacionais solicitados expressamente:
 * P1, P2, P3, R1, ADM, Bolsão 40, Fila PDC, Bolsão superior
 */
export const KEY_YARD_SLOTS: KeyYardSlot[] = [
  {
    id: 'p1',
    code: 'P1',
    name: 'Vaga P1',
    shortCode: 'P1',
    category: 'vaga_individual',
    description: 'Vaga P1 • Vistoria Técnica e Qualidade',
    isMultiVehicle: false,
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  },
  {
    id: 'p2',
    code: 'P2',
    name: 'Vaga P2',
    shortCode: 'P2',
    category: 'vaga_individual',
    description: 'Vaga P2 • Vistoria Técnica e Qualidade',
    isMultiVehicle: false,
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  },
  {
    id: 'p3',
    code: 'P3',
    name: 'Vaga P3',
    shortCode: 'P3',
    category: 'vaga_individual',
    description: 'Vaga P3 • Triagem Técnica e Qualidade',
    isMultiVehicle: false,
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  },
  {
    id: 'r1',
    code: 'R1',
    name: 'Setor R1',
    shortCode: 'R1',
    category: 'vaga_individual',
    description: 'Setor R1 • Liberação e Saída de Veículos',
    isMultiVehicle: false,
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-300',
  },
  {
    id: 'adm',
    code: 'ADM',
    name: 'Setor ADM',
    shortCode: 'ADM',
    category: 'vaga_individual',
    description: 'Setor ADM • Vagas Administrativas e Diretoria',
    isMultiVehicle: false,
    badgeColor: 'bg-sky-100 text-sky-800 border-sky-300',
  },
  {
    id: '40',
    code: '40',
    name: 'Bolsão 40',
    shortCode: 'BOLSÃO 40',
    category: 'bolsao',
    description: 'Bolsão 40 • Estacionamento Intermediário',
    isMultiVehicle: true,
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
  },
  {
    id: 'fila_pdc',
    code: 'PDC',
    name: 'Fila PDC',
    shortCode: 'FILA PDC',
    category: 'bolsao',
    description: 'Fila PDC • Preparação, Lavagem e Oficina',
    isMultiVehicle: true,
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
  },
  {
    id: 'bolsao_superior',
    code: 'B.SUP',
    name: 'Bolsão Superior',
    shortCode: 'BOLSÃO SUP.',
    category: 'bolsao',
    description: 'Bolsão Superior • Platô Alto do Pátio',
    isMultiVehicle: true,
    badgeColor: 'bg-teal-100 text-teal-800 border-teal-300',
  },
  {
    id: 'q1',
    code: 'Q1',
    name: 'Quadrante 1',
    shortCode: 'Q1',
    category: 'quadrante',
    description: 'Quadrante 1 • Filas 1 a 5 (Q1F1 a Q1F5)',
    isMultiVehicle: true,
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  },
  {
    id: 'q2',
    code: 'Q2',
    name: 'Quadrante 2',
    shortCode: 'Q2',
    category: 'quadrante',
    description: 'Quadrante 2 • Filas 1 a 5 (Q2F1 a Q2F5)',
    isMultiVehicle: true,
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  },
  {
    id: 'q3',
    code: 'Q3',
    name: 'Quadrante 3',
    shortCode: 'Q3',
    category: 'quadrante',
    description: 'Quadrante 3 • Filas 1 a 5 (Q3F1 a Q3F5)',
    isMultiVehicle: true,
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  },
  {
    id: 'q4',
    code: 'Q4',
    name: 'Quadrante 4',
    shortCode: 'Q4',
    category: 'quadrante',
    description: 'Quadrante 4 • Filas 1 a 5 (Q4F1 a Q4F5)',
    isMultiVehicle: true,
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  },
  {
    id: 'q5',
    code: 'Q5',
    name: 'Quadrante 5',
    shortCode: 'Q5',
    category: 'quadrante',
    description: 'Quadrante 5 • Filas 1 a 5 (Q5F1 a Q5F5)',
    isMultiVehicle: true,
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  },
];

export const BASE_YARD_LOCATIONS: YardLocationOption[] = [
  // Vagas Principais Solicitadas
  { id: 'p1', name: 'Vaga P1', shortCode: 'P1', isQuadrant: false, category: 'vaga', description: 'Vistoria / Qualidade' },
  { id: 'p2', name: 'Vaga P2', shortCode: 'P2', isQuadrant: false, category: 'vaga', description: 'Vistoria / Qualidade' },
  { id: 'p3', name: 'Vaga P3', shortCode: 'P3', isQuadrant: false, category: 'vaga', description: 'Vistoria / Qualidade' },
  { id: 'r1', name: 'R1 (Liberação)', shortCode: 'R1', isQuadrant: false, category: 'vaga', description: 'Liberação e Expedição' },
  { id: 'adm', name: 'ADM (Administrativo)', shortCode: 'ADM', isQuadrant: false, category: 'vaga', description: 'Setor Administrativo' },
  { id: '40', name: 'Bolsão 40', shortCode: '40', isQuadrant: false, category: 'bolsao', isBolsao: true, description: 'Estacionamento 40' },
  { id: 'fila_pdc', name: 'Fila PDC', shortCode: 'PDC', isQuadrant: false, category: 'bolsao', isBolsao: true, description: 'Lavagem / Oficina' },
  { id: 'bolsao_superior', name: 'Bolsão superior', shortCode: 'B.SUP', isQuadrant: false, category: 'bolsao', isBolsao: true, description: 'Platô Superior' },

  // Quadrantes Principais
  { id: 'q1', name: 'Quadrante 1', shortCode: 'Q1', isQuadrant: true, quadrantNumber: 1, category: 'quadrante' },
  { id: 'q2', name: 'Quadrante 2', shortCode: 'Q2', isQuadrant: true, quadrantNumber: 2, category: 'quadrante' },
  { id: 'q3', name: 'Quadrante 3', shortCode: 'Q3', isQuadrant: true, quadrantNumber: 3, category: 'quadrante' },
  { id: 'q4', name: 'Quadrante 4', shortCode: 'Q4', isQuadrant: true, quadrantNumber: 4, category: 'quadrante' },
  { id: 'q5', name: 'Quadrante 5', shortCode: 'Q5', isQuadrant: true, quadrantNumber: 5, category: 'quadrante' },

  // Outros Setores Especiais / Operacionais
  { id: '51', name: '51 (Qualidade)', shortCode: '51', isQuadrant: false, category: 'especial' },
  { id: 'fp', name: 'FP', shortCode: 'FP', isQuadrant: false, category: 'especial' },
  { id: 'am', name: 'AM', shortCode: 'AM', isQuadrant: false, category: 'especial' },
  { id: 'apoio', name: 'Apoio', shortCode: 'APOIO', isQuadrant: false, category: 'especial' },
  { id: 'rampa_fundos', name: 'Rampa dos fundos', shortCode: 'RAMPA', isQuadrant: false, category: 'especial' },
  { id: 'dt', name: 'DT', shortCode: 'DT', isQuadrant: false, category: 'especial' },
  { id: 'fabrica', name: 'Fabrica', shortCode: 'FÁBRICA', isQuadrant: false, category: 'especial' },
  { id: 'servico_estetico', name: 'Serviço externo estético', shortCode: 'ESTÉTICA', isQuadrant: false, category: 'especial' },
];

export const QUADRANT_ROWS = [1, 2, 3, 4, 5];

/**
 * Retorna a string legível do local de quadrante e fila (ex: "Quadrante 1 fila 2")
 */
export function formatQuadrantRow(quadrantNum: number, rowNum: number): string {
  return `Quadrante ${quadrantNum} fila ${rowNum}`;
}

/**
 * Retorna o código curto de quadrante e fila (ex: "Q1F2")
 */
export function formatQuadrantRowCode(quadrantNum: number, rowNum: number): string {
  return `Q${quadrantNum}F${rowNum}`;
}

/**
 * Gera lista exaustiva de todas as localizações disponíveis
 */
export function getAllSpecificYardLocations(): string[] {
  const list: string[] = [];

  // Vagas e Bolsões solicitados
  list.push(
    'P1',
    'P2',
    'P3',
    'R1',
    'ADM',
    'Bolsão 40',
    'Fila PDC',
    'Bolsão superior'
  );

  // Quadrantes 1 a 5 com Filas 1 a 5
  for (let q = 1; q <= 5; q++) {
    for (let f = 1; f <= 5; f++) {
      list.push(formatQuadrantRow(q, f));
    }
  }

  // Outros setores
  list.push(
    '51',
    'FP',
    'AM',
    'Apoio',
    'Rampa dos fundos',
    'DT',
    'Fabrica',
    'Serviço externo estético'
  );

  return list;
}

/**
 * Verifica de forma precisa e abrangente se uma string de localização corresponde ao grupo ou vaga pesquisada
 */
export function matchLocationToGroup(locStr: string | undefined, groupKey: string): boolean {
  if (!locStr) return false;
  const upper = locStr.toUpperCase().trim();
  const grp = groupKey.toUpperCase().trim();

  if (grp === 'ALL') return true;

  // Comparação idêntica direta
  if (upper === grp) return true;

  // Vagas específicas P1, P2, P3
  if (/^P[1-3]$/.test(grp)) {
    // Evita falsos positivos com PDC, P10, etc.
    const isExactP = upper === grp;
    const isVagaP = upper.includes(`VAGA ${grp}`) || upper.includes(`SETOR ${grp}`) || upper.includes(`DESTINO ${grp}`);
    const isWordP = new RegExp(`(^|\\b|\\s|_)(${grp})($|\\b|\\s|_)`, 'i').test(upper);
    return (isExactP || isVagaP || isWordP) && !upper.includes('PDC');
  }

  // Setor R1
  if (grp === 'R1') {
    return (
      upper === 'R1' ||
      new RegExp(`(^|\\b|\\s|_)(R1)($|\\b|\\s|_)`, 'i').test(upper) ||
      upper.includes('SETOR R1') ||
      upper.includes('VAGA R1') ||
      upper.includes('DESTINO R1')
    );
  }

  // Setor ADM
  if (grp === 'ADM') {
    return upper.includes('ADM');
  }

  // Bolsão 40 / 40
  if (grp === '40' || grp.includes('40') || grp.includes('BOLSÃO 40') || grp.includes('BOLSAO 40')) {
    return upper.includes('40') || upper.includes('BOLSÃO 40') || upper.includes('BOLSAO 40');
  }

  // Fila PDC / PDC
  if (grp === 'PDC' || grp.includes('PDC') || grp.includes('FILA PDC')) {
    return upper.includes('PDC');
  }

  // Bolsão Superior / B.SUP
  if (grp.includes('SUPERIOR') || grp === 'B.SUP' || grp.includes('BOLSÃO SUPERIOR') || grp.includes('BOLSAO SUPERIOR')) {
    return upper.includes('SUPERIOR') || upper.includes('B.SUP');
  }

  // Quadrante geral Q1 a Q5
  if (/^Q[1-5]$/.test(grp)) {
    const qNum = grp.substring(1);
    return (
      upper.includes(`QUADRANTE ${qNum}`) ||
      upper.startsWith(`Q${qNum}`) ||
      upper === `Q${qNum}`
    );
  }

  // Fila específica de Quadrante (ex: Q1F2)
  if (grp.startsWith('Q') && grp.includes('F')) {
    const parts = grp.match(/Q(\d)F(\d)/);
    if (parts) {
      const qNum = parts[1];
      const fNum = parts[2];
      return (
        upper.includes(`QUADRANTE ${qNum} FILA ${fNum}`) ||
        upper.includes(`Q${qNum}F${fNum}`) ||
        upper.includes(`Q${qNum} F${fNum}`) ||
        upper.includes(`Q${qNum}-F${fNum}`) ||
        upper === `Q${qNum}F${fNum}`
      );
    }
  }

  // Setor 51 Qualidade
  if (grp === '51' || grp.includes('51')) {
    return upper.includes('51') || upper.includes('QUALIDADE 51');
  }

  return upper.includes(grp) || grp.includes(upper);
}

/**
 * Associa um registro de veículo a um grupo ou vaga do pátio,
 * avaliando os campos de localização, destino (em Qualidade 51) e tipo de operação (PDC)
 */
export function matchVehicleToYardGroup(
  vehicle: { location?: string; destination?: string; operationType?: string },
  groupKey: string
): boolean {
  const grp = groupKey.toUpperCase().trim();
  if (grp === 'ALL') return true;

  // PDC: Se a operação for 'pdc', está na Fila PDC automaticamente
  if (grp === 'PDC' || grp.includes('PDC') || grp.includes('FILA PDC')) {
    if (vehicle.operationType === 'pdc') return true;
    if (matchLocationToGroup(vehicle.location, 'PDC')) return true;
    if (matchLocationToGroup(vehicle.destination, 'PDC')) return true;
    return false;
  }

  // Checa localização primária
  if (matchLocationToGroup(vehicle.location, groupKey)) return true;

  // Checa destino (usado em 51 Qualidade e Movimentações)
  if (matchLocationToGroup(vehicle.destination, groupKey)) return true;

  return false;
}
