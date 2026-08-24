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
}

const SPREADSHEET_TITLE = 'Controle de Frota & Pátio CMDIT';

// Standard tab specifications
export const TAB_DEFINITIONS = {
  entrada: {
    title: '📥 Entrada',
    aliases: ['entrada', 'entradas', 'chegada', 'inbound', 'in'],
    color: { red: 0.13, green: 0.69, blue: 0.3 },
    headers: [
      'DATA',
      'HORA',
      'OPERADOR (AUDITORIA)',
      'PLACA',
      'CONDUTOR',
      'ORIGEM',
      'KM (ODÔMETRO)',
      'COMBUSTÍVEL',
      'CHAVE RESERVA',
      'TIPO FROTA',
      'SUBTIPO ENTRADA',
      'MOTIVO / DETALHE',
      'OBSERVAÇÕES',
    ],
  },
  saida: {
    title: '📤 Saída',
    aliases: ['saida', 'saidas', 'liberacao', 'outbound', 'out'],
    color: { red: 0.88, green: 0.25, blue: 0.25 },
    headers: [
      'DATA',
      'HORA',
      'OPERADOR (AUDITORIA)',
      'PLACA',
      'CONDUTOR',
      'DESTINO',
      'KM (ODÔMETRO)',
      'COMBUSTÍVEL',
      'CHAVE RESERVA',
      'TIPO FROTA',
      'OBSERVAÇÕES',
    ],
  },
  combustivel: {
    title: '⛽ Combustível',
    aliases: ['combustivel', 'abastecimento', 'abastecimentos', 'abastec', 'posto', 'gasolina', 'diesel'],
    color: { red: 0.06, green: 0.73, blue: 0.85 },
    headers: [
      'DATA',
      'HORA',
      'OPERADOR (AUDITORIA)',
      'PLACA',
      'CONDUTOR',
      'KM (ODÔMETRO)',
      'NÍVEL COMBUSTÍVEL',
      'LITROS ABASTECIDOS',
      'TIPO COMBUSTÍVEL',
      'DESTINO',
      'OBSERVAÇÕES',
    ],
  },
  pdc: {
    title: '📋 Fila PDC',
    aliases: ['fila pdc', 'pdc', 'fila_pdc', 'fila', 'lavagem', 'oficina'],
    color: { red: 0.95, green: 0.55, blue: 0.1 },
    headers: [
      'DATA',
      'HORA',
      'OPERADOR (AUDITORIA)',
      'PLACA',
      'CONDUTOR',
      'DESTINO / SERVIÇO',
      'KM (ODÔMETRO)',
      'COMBUSTÍVEL',
      'CHAVE RESERVA',
      'STATUS FILA',
      'OBSERVAÇÕES',
    ],
  },
  qualidade: {
    title: '🔍 Qualidade 51',
    aliases: ['qualidade 51', 'qualidade', '51 (qualidade)', '51', 'vistoria', 'inspecao'],
    color: { red: 0.39, green: 0.36, blue: 0.93 },
    headers: [
      'DATA',
      'HORA',
      'OPERADOR (AUDITORIA)',
      'PLACA',
      'LOCAL (PÁTIO/POSTE)',
      'CARACTERÍSTICA',
      'COMBUSTÍVEL',
      'STATUS',
      'OBSERVAÇÕES',
    ],
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
): Promise<string> {
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

        return foundTitle;
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
        return tabDef.title;
      }
    }
  } catch (err) {
    console.warn('ensureTargetTab notice:', err);
  }

  return tabDef.title;
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
    const tabTitle = await ensureTargetTab(spreadsheetId, cat, accessToken);
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

/**
 * Appends a new vehicle record safely into the appropriate sheet tab (Append-Only mode)
 */
export async function appendVehicleRecordToSheet(
  spreadsheetId: string,
  record: SheetVehiclePayload,
  accessToken: string
): Promise<{ success: boolean; updatedRange?: string; tabName: string }> {
  const now = new Date();
  
  // Format Brazilian date: DD/MM/YYYY in America/Sao_Paulo timezone
  const dateStr = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  }).format(now);

  // Format Brazilian time with exact hours, minutes, and seconds: HH:MM:SS in America/Sao_Paulo timezone
  const timeStr = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'America/Sao_Paulo',
  }).format(now);

  const formatSpareKey = (key?: boolean) => {
    if (key === true) return 'SIM';
    if (key === false) return 'NÃO';
    return '';
  };

  const getSubtypeClean = (subtype?: string) => {
    switch (subtype) {
      case 'bolsao_40':
        return 'Bolsão 40';
      case 'retorno':
        return 'Retorno';
      case 'recusa':
        return 'Recusa';
      case 'remocao_adesivos':
        return 'Remoção de Adesivos';
      default:
        return subtype || '';
    }
  };

  const operatorDisplay = record.operatorName || 'Operador';
  let categoryKey: 'entrada' | 'saida' | 'combustivel' | 'pdc' | 'qualidade' = 'entrada';
  let rowValues: any[] = [];

  switch (record.operationType) {
    case 'entrada': {
      categoryKey = 'entrada';
      rowValues = [
        dateStr,
        timeStr,
        operatorDisplay,
        record.plate.toUpperCase(),
        record.driverName || '',
        record.origin || '',
        record.km || '',
        record.fuel || '',
        formatSpareKey(record.hasSpareKey),
        record.fleetType || '',
        getSubtypeClean(record.entrySubtype),
        record.entryReason || '',
        record.notes || '',
      ];
      break;
    }

    case 'saida': {
      categoryKey = 'saida';
      rowValues = [
        dateStr,
        timeStr,
        operatorDisplay,
        record.plate.toUpperCase(),
        record.driverName || '',
        record.destination || '',
        record.km || '',
        record.fuel || '',
        formatSpareKey(record.hasSpareKey),
        record.fleetType || '',
        record.notes || '',
      ];
      break;
    }

    case 'abastecimento': {
      categoryKey = 'combustivel';
      rowValues = [
        dateStr,
        timeStr,
        operatorDisplay,
        record.plate.toUpperCase(),
        record.driverName || '',
        record.km || '',
        record.fuel || '',
        record.liters || '',
        record.fuelType || '',
        record.destination || '',
        record.notes || '',
      ];
      break;
    }

    case 'pdc': {
      categoryKey = 'pdc';
      rowValues = [
        dateStr,
        timeStr,
        operatorDisplay,
        record.plate.toUpperCase(),
        record.driverName || 'Operador',
        'Fila PDC (Lavagem/Oficina)',
        record.km || '',
        record.fuel || '',
        formatSpareKey(record.hasSpareKey),
        'EM FILA PDC',
        record.notes || '',
      ];
      break;
    }

    case 'qualidade_51': {
      categoryKey = 'qualidade';
      rowValues = [
        dateStr,
        timeStr,
        operatorDisplay,
        record.plate.toUpperCase(),
        record.location || 'P1',
        record.characteristic || 'Sem característica',
        record.fuel || '',
        'REGISTRADO',
        record.notes || '',
      ];
      break;
    }
  }

  // Resolve or automatically create the dedicated tab for this operation
  const resolvedTabTitle = await ensureTargetTab(spreadsheetId, categoryKey, accessToken);

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
        values: [rowValues],
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

