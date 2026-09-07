export type FuelLevel = '1/8' | '2/8' | '3/8' | '4/8' | '5/8' | '6/8' | '7/8' | '8/8';

export type VehicleCharacteristic = '🟣 DT' | '🟠 REVENDA' | '🟢 CONSUMIDOR' | '⚪ OUTROS';

export type LocationCode = 'P1' | 'P2' | 'P3' | 'R1' | 'ADM' | 'PDC' | 'OUTROS' | string;

export type QualityLocationCode = 'P1' | 'P2' | 'P3' | 'R1' | 'ADM' | 'OUTROS' | string;

export type OperationType =
  | 'entrada'
  | 'saida'
  | 'abastecimento'
  | 'pdc'
  | 'qualidade_51'
  | 'movimentacao'
  | 'inventario';

export type EntrySubtype = 'bolsao_40' | 'retorno' | 'recusa' | 'remocao_adesivos';

export type VehicleFleetType = 'RAC' | 'GF' | 'LQV' | 'OUTROS' | string;

export type VehicleStatus = 'parked' | 'released';

export type NavTab = 'register' | 'patio' | 'movimentacao' | 'inventario' | 'history' | 'logs';

export interface VehicleMovement {
  id: string;
  createdAt: number;
  dateFormatted: string; // A: data
  timeFormatted: string; // B: hora
  plate: string; // C: placa
  origin: string; // D: origem
  destination: string; // E: destino
  observation: string; // F: observação
  fuelLevel?: string; // G: combustível
  odometer?: number | string; // H: km odômetro
  operatorName: string; // I: operador
  photoUrl?: string;
}

export interface VehicleInventory {
  id: string;
  createdAt: number;
  dateFormatted: string; // Col A: Data
  timeFormatted: string; // Col B: Hora
  plate: string; // Col C: Placa
  location: string; // Col D: Local
  observation?: string; // Col E: Observação (contendo o Local obrigatório e detalhes adicionais de Combustível/KM)
  fuelLevel?: string; // Combustível (opcional)
  odometer?: number | string; // Km odômetro (opcional)
  operatorName: string; // Col F: Operador
  photoUrl?: string;
}

export type LogEventType = 'LOGIN' | 'LOGOUT' | 'EXPIRADO';

export interface AccessLog {
  id: string;
  timestamp: string; // ISO string
  dateFormatted?: string; // dd/MM/yyyy HH:mm:ss
  event: LogEventType;
  username: string;
  name: string;
  role: UserRole;
  whatsapp?: string;
  ip?: string;
  userAgent?: string;
  deviceType?: 'mobile' | 'desktop' | 'tablet' | 'outro';
  details?: string;
}

export type Step =
  | 'home'
  | 'camera'
  | 'ocr_processing'
  | 'plate_confirm'
  | 'operation_select'
  | 'operation_details'
  | 'dashboard_camera'
  | 'fueling_details'
  | 'fuel'
  | 'characteristic'
  | 'location'
  | 'review';

export interface VehicleRecord {
  id: string;
  createdAt: number;
  photoDataUrl: string;
  photoBlob?: Blob;
  dashboardPhotoUrl?: string;
  dashboardPhotoBlob?: Blob;
  documentPhotoUrl?: string;
  documentPhotoBlob?: Blob;
  plate: string;
  plateSource?: 'local_ocr' | 'gemini_ai' | 'manual';
  rawOcrText?: string;
  aiDetails?: string;
  
  // Operation specifics
  operationType: OperationType;
  driverName?: string;
  origin?: string;
  destination?: string;
  km?: string | number;
  hasSpareKey?: boolean;
  fleetType?: VehicleFleetType;
  entrySubtype?: EntrySubtype;
  entryReason?: string;

  // Fueling specifics
  liters?: string | number;
  fuelType?: string;

  // General fields
  fuel: FuelLevel;
  characteristic?: VehicleCharacteristic | null;
  location?: LocationCode;
  
  description?: string;
  status: VehicleStatus;
  releasedAt?: number;
  notes?: string;
  operatorName?: string;
  username?: string;
}

export interface SectorConfig {
  code: LocationCode;
  name: string;
  capacity: number;
  description: string;
  color: string;
}

export interface PatioMetrics {
  totalRecords: number;
  totalParked: number;
  totalReleased: number;
  totalEntradas: number;
  totalSaidas: number;
  totalAbastecimento: number;
  totalPdc: number;
  totalQualidade: number;
  averageFuelNumeric: number; // 1 to 8
  averageFuelPercent: number; // 0 to 100%
  criticalFuelCount: number; // <= 2/8
  sectorOccupancy: Record<LocationCode, {
    count: number;
    capacity: number;
    percent: number;
    isFull: boolean;
  }>;
  characteristicCount: Record<string, number>;
}

export interface OcrResult {
  plate: string;
  confidence: number;
  rawText: string;
  isMercosul: boolean;
  isValid: boolean;
}

export type UserRole =
  | 'master'
  | 'patio'
  | 'entrada_saida'
  | 'movimentacao'
  | 'inventario'
  | 'qualidade_51'
  | 'pdc'
  | 'combustivel'
  | 'operador'
  | 'vistoriador'
  | 'motorista'
  | 'manobrista';

export interface UserProfileDefinition {
  role: UserRole;
  title: string;
  category: string;
  badgeLabel: string;
  badgeClass: string;
  borderClass: string;
  bgClass: string;
  textClass: string;
  description: string;
  responsibilities: string[];
  allowedOperations: OperationType[];
  specialPermissions?: string[];
}

export const ALL_USER_PROFILES: UserProfileDefinition[] = [
  {
    role: 'master',
    title: 'Administrador Master',
    category: 'Gestão & Supervisão',
    badgeLabel: 'Master Total',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    borderClass: 'border-emerald-300',
    bgClass: 'bg-emerald-50',
    textClass: 'text-emerald-900',
    description:
      'Acesso total e irrestrito a todos os módulos do sistema. Responsável pela gestão dos operadores, senhas, auditoria de logs de acesso, consulta em tempo real da planilha Google Sheets e supervisão de todas as rotinas do pátio.',
    responsibilities: [
      'Execução de todas as 7 operações veiculares no pátio',
      'Gestão cadastral completa de usuários (criar, editar, bloquear, excluir e senhas)',
      'Auditoria de logs de login, logout e sessões em tempo real',
      'Acesso ao visualizador da planilha Google Sheets online com todas as abas',
      'Configuração central de webhooks, reconexão e integrações',
    ],
    allowedOperations: ['entrada', 'saida', 'abastecimento', 'pdc', 'qualidade_51', 'movimentacao', 'inventario'],
    specialPermissions: [
      'Gestão de Usuários e Senhas',
      'Auditoria de Logs de Acesso',
      'Consulta da Planilha Online',
      'Edição/Exclusão de Registros',
      'Configurações de Sincronização',
    ],
  },
  {
    role: 'patio',
    title: 'Operador Geral do Pátio',
    category: 'Operação Geral',
    badgeLabel: 'Operador Geral do Pátio',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
    borderClass: 'border-blue-300',
    bgClass: 'bg-blue-50',
    textClass: 'text-blue-900',
    description:
      'Perfil operacional amplo para colaboradores responsáveis pela rotina diária completa do pátio CMDIT. Possui permissão para executar todas as operações veiculares, manobras e auditorias.',
    responsibilities: [
      'Execução de todas as 7 operações operacionais do pátio',
      'Organização e alocação de veículos nos bolsões e vagas',
      'Registro de entradas e saídas com checklist completo',
      'Encaminhamentos para abastecimento, fila PDC e vistoria 51',
      'Realização de movimentações internas e conferência de inventário',
    ],
    allowedOperations: ['entrada', 'saida', 'abastecimento', 'pdc', 'qualidade_51', 'movimentacao', 'inventario'],
  },
  {
    role: 'entrada_saida',
    title: 'Operador de Portaria (Entrada/Saída)',
    category: 'Portaria & Fluxo',
    badgeLabel: 'Portaria (Entrada/Saída)',
    badgeClass: 'bg-teal-100 text-teal-800 border-teal-300',
    borderClass: 'border-teal-300',
    bgClass: 'bg-teal-50',
    textClass: 'text-teal-900',
    description:
      'Controle rigoroso do fluxo de veículos na portaria principal. Registra a chegada (com identificação do condutor, odômetro, nível de combustível, chave reserva e foto do documento) e a expedição de veículos com destino autorizado.',
    responsibilities: [
      'Check-in de entrada com foto de documento, chave reserva e checklist',
      'Check-out e liberação de saída com registro de condutor e destino',
      'Movimentação de veículos entre portaria e bolsões de triagem',
      'Conferência de inventário na área de portaria e estacionamentos externos',
    ],
    allowedOperations: ['entrada', 'saida', 'movimentacao', 'inventario'],
  },
  {
    role: 'movimentacao',
    title: 'Operador de Movimentação & Manobra',
    category: 'Manobra & Remanejamento',
    badgeLabel: 'Movimentação & Manobra',
    badgeClass: 'bg-cyan-100 text-cyan-800 border-cyan-300',
    borderClass: 'border-cyan-300',
    bgClass: 'bg-cyan-50',
    textClass: 'text-cyan-900',
    description:
      'Especialista em remanejamento interno e manobras no pátio. Responsável pela transferência de veículos entre vagas, bolsões e setores (Origem ➔ Destino), mantendo a fluidez das vias e a organização do pátio.',
    responsibilities: [
      'Registro detalhado de transferência entre setores (Origem e Destino)',
      'Atualização de KM odômetro e nível de combustível durante manobras',
      'Anotação de observações relevantes de deslocamento interno',
      'Suporte direto às contagens e conferências de inventário',
    ],
    allowedOperations: ['movimentacao', 'inventario'],
  },
  {
    role: 'inventario',
    title: 'Operador de Inventário / Conferente',
    category: 'Auditoria & Estoque',
    badgeLabel: 'Inventário & Auditoria',
    badgeClass: 'bg-violet-100 text-violet-800 border-violet-300',
    borderClass: 'border-violet-300',
    bgClass: 'bg-violet-50',
    textClass: 'text-violet-900',
    description:
      'Focado na auditoria contínua, localização e contagem física do estoque veicular. Registra de forma rápida a Placa e o Local exato de cada veículo (com campos complementares opcionais de Combustível, KM e Observações) na aba "inventario".',
    responsibilities: [
      'Conferência física sistemática de veículos em todas as vagas e bolsões',
      'Sincronização instantânea na aba "inventario" da planilha (6 colunas: Data, Hora, Placa, Local, Observação, Operador)',
      'Identificação rápida de divergências de localização física versus sistema',
      'Remanejamento corretivo de veículos estacionados em locais indevidos',
    ],
    allowedOperations: ['inventario', 'movimentacao'],
  },
  {
    role: 'qualidade_51',
    title: 'Operador 51 Qualidade (Vistoria)',
    category: 'Vistoria & Inspeção',
    badgeLabel: '51 Qualidade (P1-P3, R1, ADM)',
    badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    borderClass: 'border-indigo-300',
    bgClass: 'bg-indigo-50',
    textClass: 'text-indigo-900',
    description:
      'Responsável pela inspeção técnica, triagem e encaminhamento de veículos no Bolsão 51. Classifica as características veiculares (DT, Revenda, Consumidor, Outros), confere o combustível e destina o veículo para os setores autorizados (P1, P2, P3, R1, ADM).',
    responsibilities: [
      'Vistoria técnica detalhada de veículos no Bolsão 51',
      'Classificação visual padronizada (🟣 DT, 🟠 REVENDA, 🟢 CONSUMIDOR, ⚪ OUTROS)',
      'Registro obrigatório do local/destino de qualidade (P1, P2, P3, R1, ADM)',
      'Gravação garantida do local na Coluna G da aba "QUALIDADE 51"',
      'Apoio a manobras e auditoria de inventário das vagas de qualidade',
    ],
    allowedOperations: ['qualidade_51', 'movimentacao', 'inventario'],
  },
  {
    role: 'pdc',
    title: 'Operador da Fila PDC (Lavagem/Oficina)',
    category: 'Preparação & Manutenção',
    badgeLabel: 'Fila PDC (Lavagem/Oficina)',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
    borderClass: 'border-amber-300',
    bgClass: 'bg-amber-50',
    textClass: 'text-amber-900',
    description:
      'Responsável pelo controle da fila de veículos destinados aos serviços de preparação, higienização, lavagem geral e manutenção preventiva ou corretiva na oficina. Registra a condição de recebimento e nível de combustível.',
    responsibilities: [
      'Recepção e organização da fila de veículos para PDC',
      'Direcionamento para lavagem, higienização e oficina de reparos',
      'Registro do nível de combustível e observações sobre o estado do veículo',
      'Remanejamento e conferência de inventário da fila de espera',
    ],
    allowedOperations: ['pdc', 'movimentacao', 'inventario'],
  },
  {
    role: 'combustivel',
    title: 'Operador do Posto / Abastecimento',
    category: 'Abastecimento & Posto',
    badgeLabel: 'Posto de Combustível',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
    borderClass: 'border-rose-300',
    bgClass: 'bg-rose-50',
    textClass: 'text-rose-900',
    description:
      'Responsável exclusivo pelo controle de combustível da frota no posto interno. Realiza a captura fotográfica do painel/odômetro, conferência do nível do tanque, tipo de combustível e quantidade exata de litros abastecidos.',
    responsibilities: [
      'Operação e controle do posto de combustível interno da unidade',
      'Registro fotográfico obrigatório do painel (KM odômetro e nível do tanque)',
      'Lançamento exato do tipo de combustível (Diesel S10, Gasolina, Etanol) e litros abastecidos',
      'Sincronização imediata na aba "COMBUSTIVEL" da planilha',
      'Conferência de inventário dos veículos abastecidos',
    ],
    allowedOperations: ['abastecimento', 'movimentacao', 'inventario'],
  },
];

export interface UserAccount {
  id: string;
  username: string; // Matrícula ou nome de usuário
  name: string;
  role: UserRole;
  whatsapp?: string; // Número do WhatsApp (opcional)
  password?: string;
  createdAt: string;
  lastLogin?: string;
  isActive: boolean;
}

export interface AuthSession {
  user: {
    id: string;
    username: string;
    name: string;
    role: UserRole;
  };
  loginTimestamp: number;
  expiresAt: number; // 9 horas após login
}

/**
 * Retorna a definição completa do perfil de usuário
 */
export function getUserProfileDefinition(role?: UserRole): UserProfileDefinition {
  const clean = (role || 'patio').toLowerCase().trim();
  const found = ALL_USER_PROFILES.find((p) => {
    if (p.role === clean) return true;
    if (clean === 'operador' && p.role === 'patio') return true;
    if (clean === 'vistoriador' && p.role === 'qualidade_51') return true;
    if (clean === 'motorista' && p.role === 'entrada_saida') return true;
    if (clean === 'manobrista' && p.role === 'movimentacao') return true;
    return false;
  });
  return found || ALL_USER_PROFILES[1]; // default 'patio'
}

/**
 * Retorna a lista de operações permitidas para cada perfil de operador
 */
export function getAllowedOperationsForRole(role?: UserRole): OperationType[] {
  const profile = getUserProfileDefinition(role);
  return profile.allowedOperations;
}

/**
 * Retorna o título legível da função/cargo
 */
export function getRoleDisplayName(role?: UserRole): string {
  const profile = getUserProfileDefinition(role);
  return profile.title;
}

/**
 * Retorna a cor e estilo do badge da função
 */
export function getRoleBadgeStyle(role?: UserRole): { label: string; badgeClass: string } {
  const profile = getUserProfileDefinition(role);
  return {
    label: profile.badgeLabel,
    badgeClass: profile.badgeClass,
  };
}

/**
 * Retorna o nome amigável, descrição e estilo visual da operação veicular
 */
export function getOperationDisplayInfo(op: OperationType): {
  name: string;
  shortDesc: string;
  badgeClass: string;
} {
  switch (op) {
    case 'entrada':
      return {
        name: 'Entrada de Veículo',
        shortDesc: 'Check-in, condutor, odômetro, chave reserva e checklist',
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      };
    case 'saida':
      return {
        name: 'Saída / Liberação',
        shortDesc: 'Check-out com destino e liberação de saída',
        badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
      };
    case 'abastecimento':
      return {
        name: 'Abastecimento & Posto',
        shortDesc: 'Registro de odômetro, nível do tanque, combustível e litros',
        badgeClass: 'bg-cyan-100 text-cyan-800 border-cyan-300',
      };
    case 'pdc':
      return {
        name: 'Fila PDC (Lavagem/Oficina)',
        shortDesc: 'Encaminhamento para preparação, oficina e lavagem geral',
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
      };
    case 'qualidade_51':
      return {
        name: '51 Qualidade (Vistoria)',
        shortDesc: 'Classificação visual e destinação para P1, P2, P3, R1 ou ADM',
        badgeClass: 'bg-purple-100 text-purple-800 border-purple-300',
      };
    case 'movimentacao':
      return {
        name: 'Movimentação & Manobra',
        shortDesc: 'Transferência física interna entre vagas e bolsões (Origem ➔ Destino)',
        badgeClass: 'bg-teal-100 text-teal-800 border-teal-300',
      };
    case 'inventario':
      return {
        name: 'Inventário de Pátio',
        shortDesc: 'Auditoria rápida: Placa e Local exato com 6 colunas na planilha',
        badgeClass: 'bg-violet-100 text-violet-800 border-violet-300',
      };
  }
}

/**
 * Verifica se um usuário possui permissão para consultar um registro do sistema.
 * Usuários Master possuem acesso total e irrestrito a todos os registros.
 * Demais perfis de usuários possuem acesso exclusivo aos seus próprios registros.
 */
export function canUserAccessRecord(
  user: { role?: UserRole; username?: string; name?: string } | null | undefined,
  record: { operatorName?: string; username?: string; driverName?: string }
): boolean {
  if (!user) return true;
  const isMaster = user.role === 'master' || user.username?.toLowerCase() === 'mastercmdit';
  if (isMaster) return true;

  const targetUsername = (user.username || '').toLowerCase().trim();
  const targetName = (user.name || '').toLowerCase().trim();

  const recUsername = (record.username || '').toLowerCase().trim();
  const recOperator = (record.operatorName || '').toLowerCase().trim();

  // Match direto por username/matrícula
  if (recUsername && targetUsername && recUsername === targetUsername) return true;

  // Match por nome de operador
  if (recOperator && targetName) {
    if (recOperator === targetName || recOperator.includes(targetName) || targetName.includes(recOperator)) {
      return true;
    }
  }

  // Match por username no campo operador
  if (recOperator && targetUsername) {
    if (recOperator === targetUsername || recOperator.includes(targetUsername)) {
      return true;
    }
  }

  // Se nenhum campo foi gravado no registro
  if (!recUsername && !recOperator) {
    return true;
  }

  return false;
}

/**
 * Verifica se um usuário possui permissão para consultar uma linha da planilha online Google Sheets.
 * Usuários Master visualizam todas as linhas.
 * Demais usuários visualizam somente linhas geradas por eles mesmos.
 */
export function canUserAccessSpreadsheetRow(
  user: { role?: UserRole; username?: string; name?: string } | null | undefined,
  row: Record<string, any>
): boolean {
  if (!user) return true;
  const isMaster = user.role === 'master' || user.username?.toLowerCase() === 'mastercmdit';
  if (isMaster) return true;

  const targetUsername = (user.username || '').toLowerCase().trim();
  const targetName = (user.name || '').toLowerCase().trim();

  // Extrai campos potenciais de operador na planilha
  const opField = String(
    row['OPERADOR DO REGISTRO'] ||
    row['OPERADOR (AUDITORIA)'] ||
    row['OPERADOR'] ||
    row['CONDUTOR(OPERADOR DO REGISTRO)'] ||
    row['Operador'] ||
    row['Usuario'] ||
    row['USUARIO'] ||
    row['username'] ||
    row['OPERADOR_REGISTRO'] ||
    ''
  ).toLowerCase().trim();

  if (!opField) {
    // Se não há operador registrado, verifica condutor ou permite caso seja genérico
    const condField = String(row['CONDUTOR'] || row['Motorista'] || '').toLowerCase().trim();
    if (condField && (condField === targetName || condField === targetUsername)) return true;
    return true;
  }

  if (opField === targetName || opField === targetUsername) return true;
  if (targetName && (opField.includes(targetName) || targetName.includes(opField))) return true;
  if (targetUsername && (opField.includes(targetUsername) || targetUsername.includes(opField))) return true;

  return false;
}

