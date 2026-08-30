import { GoogleGenAI } from '@google/genai';

/**
 * Interface representing a vehicle record for Sheets sync
 */
export interface SheetVehiclePayload {
  plate: string;
  operationType: 'entrada' | 'saida' | 'abastecimento' | 'pdc' | 'qualidade_51';
  fuel: string;
  operatorName?: string;
  driverName?: string;
  origin?: string;
  destination?: string;
  km?: string | number;
  hasSpareKey?: boolean;
  fleetType?: string;
  entrySubtype?: string;
  entryReason?: string;
  liters?: string | number;
  fuelType?: string;
  location?: string;
  characteristic?: string | null;
  notes?: string;
  description?: string;
}

const SPREADSHEET_TITLE = 'Controle de Frota & Pátio CMDIT';

// Header specifications per tab customized strictly as requested (no unnecessary fields):
export const HEADERS_ENTRADA = [
  'DATA',
  'HORA',
  'PLACA',
  'CONDUTOR',
  'KM (ODÔMETRO)',
  'NÍVEL DO COMBUSTÍVEL',
  'ORIGEM',
  'DESTINO',
  'CHAVE RESERVA',
  'TIPO DE VEÍCULO',
  'OBSERVAÇÃO',
  'OPERADOR DO REGISTRO',
];

export const HEADERS_SAIDA = [
  'DATA',
  'HORA',
  'PLACA',
  'CONDUTOR',
  'KM (ODÔMETRO)',
  'NÍVEL DO COMBUSTÍVEL',
  'DESTINO',
  'CHAVE RESERVA',
  'OBSERVAÇÃO',
  'OPERADOR DO REGISTRO',
];

export const HEADERS_QUALIDADE = [
  'DATA',
  'HORA',
  'PLACA',
  'CONDUTOR',
  'CARACTERÍSTICA DO VEÍCULO',
  'NÍVEL DO COMBUSTÍVEL',
  'DESTINO',
  'OPERADOR DO REGISTRO',
];

export const HEADERS_COMBUSTIVEL = [
  'DATA',
  'HORA',
  'PLACA',
  'KM (ODÔMETRO)',
  'NÍVEL DO COMBUSTÍVEL',
  'CONDUTOR',
  'DESTINO',
  'OPERADOR DO REGISTRO',
];

export const HEADERS_PDC = [
  'DATA',
  'HORA',
  'PLACA',
  'NÍVEL DO COMBUSTÍVEL',
  'OBSERVAÇÃO',
  'OPERADOR DO REGISTRO',
];

// Standard tab specifications
export const TAB_DEFINITIONS = {
  geral: {
    title: '📊 Geral',
    aliases: ['geral', 'todos', 'registros', 'movimentacoes', 'consolidado', 'sheet1', 'planilha1', 'página1'],
    color: { red: 0.15, green: 0.2, blue: 0.3 },
    headers: HEADERS_ENTRADA,
  },
  entrada: {
    title: '📥 Entrada',
    aliases: ['entrada', 'entradas', 'chegada', 'inbound', 'in'],
    color: { red: 0.13, green: 0.69, blue: 0.3 },
    headers: HEADERS_ENTRADA,
  },
  saida: {
    title: '📤 Saída',
    aliases: ['saida', 'saidas', 'liberacao', 'outbound', 'out'],
    color: { red: 0.88, green: 0.25, blue: 0.25 },
    headers: HEADERS_SAIDA,
  },
  combustivel: {
    title: '⛽ Combustível',
    aliases: ['combustivel', 'abastecimento', 'abastecimentos', 'abastec', 'posto', 'gasolina', 'diesel'],
    color: { red: 0.06, green: 0.73, blue: 0.85 },
    headers: HEADERS_COMBUSTIVEL,
  },
  pdc: {
    title: '📋 Fila PDC',
    aliases: ['fila pdc', 'pdc', 'fila_pdc', 'fila', 'lavagem', 'oficina'],
    color: { red: 0.95, green: 0.55, blue: 0.1 },
    headers: HEADERS_PDC,
  },
  qualidade: {
    title: '🔍 Qualidade 51',
    aliases: ['qualidade 51', 'qualidade', '51 (qualidade)', '51', 'vistoria', 'inspecao'],
    color: { red: 0.39, green: 0.36, blue: 0.93 },
    headers: HEADERS_QUALIDADE,
  },
};

/**
 * Creates the standardized spreadsheet in user's Google Drive with full styling and headers
 */
export async function createStandardFleetSpreadsheet(accessToken: string): Promise<{
  spreadsheetId: string;
  spreadsheetUrl: string;
}> {
  // 1. Create Spreadsheet with exact tabs
  const createResp = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title: SPREADSHEET_TITLE,
        locale: 'pt_BR',
        timeZone: 'America/Sao_Paulo',
      },
      sheets: [
        {
          properties: {
            title: '📊 Visão Geral',
            gridProperties: { rowCount: 100, columnCount: 15 },
            tabColor: { red: 0.05, green: 0.59, blue: 0.41 },
          },
        },
        {
          properties: {
            title: TAB_DEFINITIONS.entrada.title,
            gridProperties: { rowCount: 1000, columnCount: TAB_DEFINITIONS.entrada.headers.length + 2 },
            tabColor: TAB_DEFINITIONS.entrada.color,
          },
        },
        {
          properties: {
            title: TAB_DEFINITIONS.saida.title,
            gridProperties: { rowCount: 1000, columnCount: TAB_DEFINITIONS.saida.headers.length + 2 },
            tabColor: TAB_DEFINITIONS.saida.color,
          },
        },
        {
          properties: {
            title: TAB_DEFINITIONS.combustivel.title,
            gridProperties: { rowCount: 1000, columnCount: TAB_DEFINITIONS.combustivel.headers.length + 2 },
            tabColor: TAB_DEFINITIONS.combustivel.color,
          },
        },
        {
          properties: {
            title: TAB_DEFINITIONS.pdc.title,
            gridProperties: { rowCount: 1000, columnCount: TAB_DEFINITIONS.pdc.headers.length + 2 },
            tabColor: TAB_DEFINITIONS.pdc.color,
          },
        },
        {
          properties: {
            title: TAB_DEFINITIONS.qualidade.title,
            gridProperties: { rowCount: 1000, columnCount: TAB_DEFINITIONS.qualidade.headers.length + 2 },
            tabColor: TAB_DEFINITIONS.qualidade.color,
          },
        },
      ],
    }),
  });

  if (!createResp.ok) {
    const errText = await createResp.text();
    throw new Error(`Erro ao criar planilha no Google Drive: ${errText}`);
  }

  const sheetData = await createResp.json();
  const spreadsheetId = sheetData.spreadsheetId;
  const spreadsheetUrl = sheetData.spreadsheetUrl;

  // 2. Populate Headers and Visual Format for each tab
  await initializeSpreadsheetHeaders(spreadsheetId, accessToken);

  return { spreadsheetId, spreadsheetUrl };
}

/**
 * Populates header rows for all tabs
 */
async function initializeSpreadsheetHeaders(spreadsheetId: string, accessToken: string) {
  const headerValues = [
    {
      range: `'${TAB_DEFINITIONS.entrada.title}'!A1:${String.fromCharCode(64 + TAB_DEFINITIONS.entrada.headers.length)}1`,
      values: [TAB_DEFINITIONS.entrada.headers],
    },
    {
      range: `'${TAB_DEFINITIONS.saida.title}'!A1:${String.fromCharCode(64 + TAB_DEFINITIONS.saida.headers.length)}1`,
      values: [TAB_DEFINITIONS.saida.headers],
    },
    {
      range: `'${TAB_DEFINITIONS.combustivel.title}'!A1:${String.fromCharCode(64 + TAB_DEFINITIONS.combustivel.headers.length)}1`,
      values: [TAB_DEFINITIONS.combustivel.headers],
    },
    {
      range: `'${TAB_DEFINITIONS.pdc.title}'!A1:${String.fromCharCode(64 + TAB_DEFINITIONS.pdc.headers.length)}1`,
      values: [TAB_DEFINITIONS.pdc.headers],
    },
    {
      range: `'${TAB_DEFINITIONS.qualidade.title}'!A1:${String.fromCharCode(64 + TAB_DEFINITIONS.qualidade.headers.length)}1`,
      values: [TAB_DEFINITIONS.qualidade.headers],
    },
    {
      range: "'📊 Visão Geral'!A1:G11",
      values: [
        ['PAINEL DE CONTROLE DE FROTA - CMDIT', '', '', '', '', '', ''],
        ['Indicador', 'Valor', 'Status', '', 'Métricas Rápidas', 'Fórmulas Ativas', ''],
        ['Total Entrada', `=COUNTA('${TAB_DEFINITIONS.entrada.title}'!C2:C)`, 'Ativo', '', 'Última Atualização', '=NOW()', ''],
        ['Total Saída', `=COUNTA('${TAB_DEFINITIONS.saida.title}'!C2:C)`, 'Ativo', '', 'Veículos na Qualidade 51', `=COUNTA('${TAB_DEFINITIONS.qualidade.title}'!C2:C)`, ''],
        ['Total Combustível', `=COUNTA('${TAB_DEFINITIONS.combustivel.title}'!C2:C)`, 'Ativo', '', 'Total de Litros Inseridos', `=SUM('${TAB_DEFINITIONS.combustivel.title}'!H2:H)`, ''],
        ['Total Fila PDC', `=COUNTA('${TAB_DEFINITIONS.pdc.title}'!C2:C)`, 'Ativo', '', 'Veículos em Fila PDC', `=COUNTA('${TAB_DEFINITIONS.pdc.title}'!C2:C)`, ''],
        ['Total Qualidade 51', `=COUNTA('${TAB_DEFINITIONS.qualidade.title}'!C2:C)`, 'Ativo', '', 'Sistema Sincronizado', '100% Automático', ''],
        ['', '', '', '', '', '', ''],
        ['* Esta planilha é sincronizada automaticamente com o aplicativo Registro Veicular CMDIT.', '', '', '', '', '', ''],
        ['* Desenvolvido por @omatheusbritto.', '', '', '', '', '', ''],
      ],
    },
  ];

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: headerValues,
      }),
    }
  );
}

/**
 * Ensures the target tab exists in the spreadsheet.
 * If missing, creates the tab and writes the header row automatically.
 */
async function ensureTargetTab(
  spreadsheetId: string,
  categoryKey: 'entrada' | 'saida' | 'combustivel' | 'pdc' | 'qualidade',
  accessToken: string
): Promise<{ title: string; sheetId?: number }> {
  const tabDef = TAB_DEFINITIONS[categoryKey];

  try {
    // 1. Fetch existing tabs
    const metaResp = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (metaResp.ok) {
      const metaData = await metaResp.json();
      const existingSheets: { properties?: { sheetId?: number; title?: string } }[] =
        metaData.sheets || [];

      // Check if any sheet matches our aliases
      const match = existingSheets.find((s) => {
        const titleNorm = (s.properties?.title || '')
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');
        return tabDef.aliases.some((alias) => titleNorm.includes(alias));
      });

      if (match?.properties?.title) {
        const foundTitle = match.properties.title;
        const foundSheetId = match.properties.sheetId;
        // Check if sheet has headers
        try {
          const checkResp = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
              `'${foundTitle}'!A1:${String.fromCharCode(64 + tabDef.headers.length)}1`
            )}`,
            {
              headers: { Authorization: `Bearer ${accessToken}` },
            }
          );
          if (checkResp.ok) {
            const checkData = await checkResp.json();
            const currentHeaders = checkData.values?.[0] || [];
            // If empty, or less columns than required, or second column is not 'HORA', write/refresh headers
            if (currentHeaders.length < 2 || String(currentHeaders[1]).toUpperCase() !== 'HORA') {
              await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
                  `'${foundTitle}'!A1:${String.fromCharCode(64 + tabDef.headers.length)}1`
                )}?valueInputOption=USER_ENTERED`,
                {
                  method: 'PUT',
                  headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    values: [tabDef.headers],
                  }),
                }
              );
            }
          }
        } catch (hErr) {
          console.warn('Header check notice:', hErr);
        }

        return { title: foundTitle, sheetId: foundSheetId };
      }

      // 2. Tab does not exist yet -> Create it automatically
      const addResp = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requests: [
              {
                addSheet: {
                  properties: {
                    title: tabDef.title,
                    gridProperties: {
                      rowCount: 1000,
                      columnCount: tabDef.headers.length + 2,
                    },
                    tabColor: tabDef.color,
                  },
                },
              },
            ],
          }),
        }
      );

      if (addResp.ok) {
        const addData = await addResp.json();
        const createdSheetId = addData.replies?.[0]?.addSheet?.properties?.sheetId;
        // Write header row to the newly created tab
        await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
            `'${tabDef.title}'!A1:${String.fromCharCode(64 + tabDef.headers.length)}1`
          )}?valueInputOption=USER_ENTERED`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              values: [tabDef.headers],
            }),
          }
        );
        return { title: tabDef.title, sheetId: createdSheetId };
      }
    }
  } catch (err) {
    console.warn('ensureTargetTab notice:', err);
  }

  return { title: tabDef.title };
}

/**
 * Ensures all 5 standard tabs exist in an existing spreadsheet and initializes their headers
 */
export async function initializeAllSpreadsheetTabs(
  spreadsheetId: string,
  accessToken: string
): Promise<{ success: boolean; tabs: string[] }> {
  const tabs = ['entrada', 'saida', 'combustivel', 'pdc', 'qualidade'] as const;
  const createdOrFoundTabs: string[] = [];

  for (const cat of tabs) {
    const tabDef = TAB_DEFINITIONS[cat];
    const targetSheet = await ensureTargetTab(spreadsheetId, cat, accessToken);
    const tabTitle = targetSheet.title;
    createdOrFoundTabs.push(tabTitle);

    // Overwrite header row 1 to guarantee all columns (DATA, HORA, etc.) are 100% aligned
    try {
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
          `'${tabTitle}'!A1:${String.fromCharCode(64 + tabDef.headers.length)}1`
        )}?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            values: [tabDef.headers],
          }),
        }
      );
    } catch (hErr) {
      console.warn('initializeAllSpreadsheetTabs header overwrite notice:', hErr);
    }
  }

  return {
    success: true,
    tabs: createdOrFoundTabs,
  };
}

function getSaoPauloDateTime(): { dateStr: string; timeStr: string; fullStr: string } {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const partMap: Record<string, string> = {};
  for (const part of parts) {
    partMap[part.type] = part.value;
  }

  const day = (partMap.day || '01').padStart(2, '0');
  const month = (partMap.month || '01').padStart(2, '0');
  const year = partMap.year || String(now.getFullYear());
  const hour = (partMap.hour || '00').padStart(2, '0');
  const minute = (partMap.minute || '00').padStart(2, '0');
  const second = (partMap.second || '00').padStart(2, '0');

  const dateStr = `${day}/${month}/${year}`;
  const timeStr = `${hour}:${minute}:${second}`;
  const fullStr = `${dateStr} ${timeStr}`;

  return { dateStr, timeStr, fullStr };
}

export function formatFuelLevelDisplay(fuel?: string | null): string {
  if (!fuel) return '-';
  const clean = String(fuel).trim().toUpperCase();
  switch (clean) {
    case '1/8':
      return '1/8 (RESERVA)';
    case '2/8':
      return '2/8 (1/4)';
    case '3/8':
      return '3/8';
    case '4/8':
      return '4/8 (1/2)';
    case '5/8':
      return '5/8';
    case '6/8':
      return '6/8 (3/4)';
    case '7/8':
      return '7/8';
    case '8/8':
      return '8/8 (CHEIO)';
    default:
      if (clean.includes('CHEIO')) return '8/8 (CHEIO)';
      if (clean.includes('1/2') || clean.includes('MEIO')) return '4/8 (1/2)';
      return clean.toUpperCase();
  }
}

/**
 * Appends a new vehicle record safely into the appropriate sheet tab (Append-Only mode)
 * Uses custom per-tab schemas without unnecessary fields:
 * - Entrada (12): DATA | HORA | PLACA | CONDUTOR | KM | NÍVEL COMBUSTÍVEL | ORIGEM | DESTINO | CHAVE RESERVA | TIPO VEÍCULO | OBSERVAÇÃO | OPERADOR
 * - Saída (10): DATA | HORA | PLACA | CONDUTOR | KM | NÍVEL COMBUSTÍVEL | DESTINO | CHAVE RESERVA | OBSERVAÇÃO | OPERADOR
 * - Qualidade 51 (8): DATA | HORA | PLACA | CONDUTOR | KM | NÍVEL COMBUSTÍVEL | DESTINO | OPERADOR
 * - Combustível (8): DATA | HORA | PLACA | KM | NÍVEL COMBUSTÍVEL | CONDUTOR | DESTINO | OPERADOR
 * - Fila PDC (6): DATA | HORA | PLACA | NÍVEL COMBUSTÍVEL | OBSERVAÇÃO | OPERADOR
 * All text entries are strictly uppercase.
 */
export async function appendVehicleRecordToSheet(
  spreadsheetId: string,
  record: SheetVehiclePayload,
  accessToken: string
): Promise<{ success: boolean; updatedRange?: string; tabName: string }> {
  const { dateStr, timeStr } = getSaoPauloDateTime();

  const formatSpareKey = (key?: boolean) => {
    if (key === true) return 'SIM';
    if (key === false) return 'NÃO';
    return '-';
  };

  const extractCleanOperator = (rawName?: string) => {
    if (!rawName) return 'OPERADOR';
    let clean = String(rawName).replace(/\(.*?\)/g, '').replace(/\[.*?\]/g, '').trim();
    if (clean.includes('@')) {
      clean = clean.split('@')[0].replace(/[._-]/g, ' ');
    }
    return clean ? clean.toUpperCase() : 'OPERADOR';
  };

  const operador = extractCleanOperator(record.operatorName);
  const condutor = String(record.driverName || '-').toUpperCase().trim();
  const placa = (record.plate || '').toUpperCase().trim();
  const origem = String(record.origin || 'PÁTIO PRINCIPAL').toUpperCase().trim();

  let destino = record.destination || '-';
  if (record.operationType === 'pdc') {
    destino = record.destination || 'FILA PDC (LAVAGEM / OFICINA)';
  } else if (record.operationType === 'qualidade_51' && record.location) {
    destino = `PÁTIO ${record.location}`;
  }
  destino = String(destino).toUpperCase().trim();

  const kmClean =
    record.km !== undefined && record.km !== null && String(record.km).trim() !== ''
      ? `${String(record.km).trim().replace(/\s*km/i, '').toUpperCase()} KM`
      : '-';

  const nivelCombustivel = formatFuelLevelDisplay(record.fuel).toUpperCase();
  const chaveReserva = formatSpareKey(record.hasSpareKey);
  const tipoVeiculo = String(record.fleetType || 'GF').toUpperCase().trim();
  const observacoes = String(record.notes || record.description || '-').toUpperCase().trim();
  const rawChar = record.characteristic || (record as any).caracteristica || (record as any).tipoCaracteristica || '-';
  const formatCharWithEmoji = (val: string) => {
    if (!val || val === '-') return '-';
    const clean = val.trim();
    const upper = clean.toUpperCase();
    if (upper.includes('DT')) return '🟣 DT';
    if (upper.includes('REVENDA')) return '🟠 REVENDA';
    if (upper.includes('CONSUMIDOR')) return '🟢 CONSUMIDOR';
    if (upper.includes('OUTROS')) return '⚪ OUTROS';
    return clean;
  };
  const caracteristica = formatCharWithEmoji(String(rawChar));

  let categoryKey: 'entrada' | 'saida' | 'combustivel' | 'pdc' | 'qualidade' = 'entrada';
  let customRow: string[] = [];

  if (record.operationType === 'saida') {
    categoryKey = 'saida';
    // 10 Colunas: Data, Hora, Placa, Condutor, KM, Nível Combustível, Destino, Chave Reserva, Observação, Operador
    customRow = [
      dateStr,
      timeStr,
      placa,
      condutor,
      kmClean,
      nivelCombustivel,
      destino,
      chaveReserva,
      observacoes,
      operador,
    ];
  } else if (record.operationType === 'abastecimento') {
    categoryKey = 'combustivel';
    // 8 Colunas: Data, Hora, Placa, KM, Nível Combustível, Condutor, Destino, Operador
    customRow = [
      dateStr,
      timeStr,
      placa,
      kmClean,
      nivelCombustivel,
      condutor,
      destino || 'POSTO DE ABASTECIMENTO',
      operador,
    ];
  } else if (record.operationType === 'pdc') {
    categoryKey = 'pdc';
    // 6 Colunas: Data, Hora, Placa, Nível Combustível, Observação, Operador
    customRow = [
      dateStr,
      timeStr,
      placa,
      nivelCombustivel,
      observacoes,
      operador,
    ];
  } else if (record.operationType === 'qualidade_51') {
    categoryKey = 'qualidade';
    // 8 Colunas: Data, Hora, Placa, Condutor, Característica do Veículo, Nível Combustível, Destino, Operador
    customRow = [
      dateStr,
      timeStr,
      placa,
      condutor,
      caracteristica,
      nivelCombustivel,
      destino || 'P1',
      operador,
    ];
  } else {
    categoryKey = 'entrada';
    // 12 Colunas: Data, Hora, Placa, Condutor, KM, Nível Combustível, Origem, Destino, Chave Reserva, Tipo Veículo, Observação, Operador
    customRow = [
      dateStr,
      timeStr,
      placa,
      condutor,
      kmClean,
      nivelCombustivel,
      origem,
      destino || 'BOLSÃO 40',
      chaveReserva,
      tipoVeiculo,
      observacoes,
      operador,
    ];
  }

  // Resolve or automatically create the dedicated tab for this operation
  const targetSheet = await ensureTargetTab(spreadsheetId, categoryKey, accessToken);
  const resolvedTabTitle = targetSheet.title;
  const tabDef = TAB_DEFINITIONS[categoryKey];

  let rowValuesToSend = customRow;
  try {
    const headerCheck = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${encodeURIComponent(
        resolvedTabTitle
      )}'!1:1`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    if (headerCheck.ok) {
      const headerData = await headerCheck.json();
      const rawExistingHeaders: string[] = headerData.values?.[0] || [];

      if (rawExistingHeaders.length > 0) {
        const normalizedHeaders = rawExistingHeaders.map((h: string) =>
          String(h || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim()
        );

        const mappedRow: any[] = new Array(normalizedHeaders.length).fill('');
        normalizedHeaders.forEach((hdr, idx) => {
          if (hdr.includes('data') || hdr === 'dt' || hdr.includes('date') || hdr === 'dia') {
            mappedRow[idx] = dateStr;
          } else if (hdr.includes('hora') || hdr === 'hr' || hdr.includes('horario') || hdr.includes('time')) {
            mappedRow[idx] = timeStr;
          } else if (hdr.includes('operad') || hdr.includes('audit')) {
            mappedRow[idx] = operador;
          } else if (hdr.includes('condut') || hdr.includes('motor') || hdr.includes('driver')) {
            mappedRow[idx] = condutor;
          } else if (hdr.includes('caracter') || hdr.includes('perfil') || hdr.includes('classif')) {
            mappedRow[idx] = caracteristica;
          } else if (hdr.includes('plac') || hdr.includes('veic') || hdr.includes('plate')) {
            mappedRow[idx] = placa;
          } else if (hdr.includes('orig') || hdr.includes('proced') || hdr === 'de') {
            mappedRow[idx] = origem;
          } else if (hdr.includes('dest') || hdr.includes('para') || hdr.includes('setor')) {
            mappedRow[idx] = destino;
          } else if (
            hdr.includes('km') ||
            hdr.includes('odomet') ||
            hdr.includes('hodomet') ||
            hdr.includes('quilomet')
          ) {
            mappedRow[idx] = kmClean;
          } else if (
            hdr.includes('nivel') ||
            hdr.includes('marcad') ||
            hdr.includes('tanque') ||
            hdr.includes('ponteiro') ||
            (hdr.includes('combust') && !hdr.includes('tipo') && !hdr.includes('litr'))
          ) {
            mappedRow[idx] = nivelCombustivel;
          } else if (hdr.includes('chave')) {
            mappedRow[idx] = chaveReserva;
          } else if (hdr.includes('tipo') || hdr.includes('frota')) {
            mappedRow[idx] = tipoVeiculo;
          } else if (
            hdr.includes('obs') ||
            hdr.includes('nota') ||
            hdr.includes('detalh') ||
            hdr.includes('motivo') ||
            hdr.includes('descri')
          ) {
            mappedRow[idx] = observacoes;
          } else if (idx < customRow.length) {
            mappedRow[idx] = customRow[idx];
          }
        });
        rowValuesToSend = mappedRow;
      }
    }
  } catch (hdrErr) {
    console.warn('Header inspection fallback:', hdrErr);
  }

  // 1. Tenta inserção no topo da planilha (LIFO / Pilha - Linha 2, logo abaixo do cabeçalho)
  if (typeof targetSheet.sheetId === 'number') {
    try {
      const insertRowResp = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requests: [
              {
                insertDimension: {
                  range: {
                    sheetId: targetSheet.sheetId,
                    dimension: 'ROWS',
                    startIndex: 1,
                    endIndex: 2,
                    inheritFromBefore: false,
                  },
                },
              },
            ],
          }),
        }
      );

      if (insertRowResp.ok) {
        const lastColLetter = String.fromCharCode(64 + Math.max(rowValuesToSend.length, 1));
        const putResp = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${encodeURIComponent(
            resolvedTabTitle
          )}'!A2:${lastColLetter}2?valueInputOption=USER_ENTERED`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              values: [rowValuesToSend],
            }),
          }
        );

        if (putResp.ok) {
          const putJson = await putResp.json();
          return {
            success: true,
            updatedRange: putJson.updatedRange || `'${resolvedTabTitle}'!A2:${lastColLetter}2`,
            tabName: resolvedTabTitle,
          };
        }
      }
    } catch (insertErr) {
      console.warn('LIFO insertDimension fallback to append:', insertErr);
    }
  }

  // Fallback: Append padrão
  const range = `'${resolvedTabTitle}'!A:Z`;
  const appendResp = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
      range
    )}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [rowValuesToSend],
      }),
    }
  );

  if (!appendResp.ok) {
    const errText = await appendResp.text();
    throw new Error(`Erro ao gravar linha na planilha: ${errText}`);
  }

  const resJson = await appendResp.json();

  return {
    success: true,
    updatedRange: resJson.updates?.updatedRange,
    tabName: resolvedTabTitle,
  };
}

