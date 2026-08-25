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

// Standard 11-field specification requested by the user:
// DATA | HORA | CONDUTOR | PLACA | ORIGEM | DESTINO | KM (ODÔMETRO) | NÍVEL DO COMBUSTÍVEL | LITROS ABASTECIDOS | TIPO DE COMBUSTÍVEL | OBSERVAÇÕES
export const STANDARD_HEADERS = [
  'DATA',
  'HORA',
  'CONDUTOR',
  'PLACA',
  'ORIGEM',
  'DESTINO',
  'KM (ODÔMETRO)',
  'NÍVEL DO COMBUSTÍVEL',
  'LITROS ABASTECIDOS',
  'TIPO DE COMBUSTÍVEL',
  'OBSERVAÇÕES',
];

// Standard tab specifications
export const TAB_DEFINITIONS = {
  geral: {
    title: '📊 Geral',
    aliases: ['geral', 'todos', 'registros', 'movimentacoes', 'consolidado', 'sheet1', 'planilha1', 'página1'],
    color: { red: 0.15, green: 0.2, blue: 0.3 },
    headers: STANDARD_HEADERS,
  },
  entrada: {
    title: '📥 Entrada',
    aliases: ['entrada', 'entradas', 'chegada', 'inbound', 'in'],
    color: { red: 0.13, green: 0.69, blue: 0.3 },
    headers: STANDARD_HEADERS,
  },
  saida: {
    title: '📤 Saída',
    aliases: ['saida', 'saidas', 'liberacao', 'outbound', 'out'],
    color: { red: 0.88, green: 0.25, blue: 0.25 },
    headers: STANDARD_HEADERS,
  },
  combustivel: {
    title: '⛽ Combustível',
    aliases: ['combustivel', 'abastecimento', 'abastecimentos', 'abastec', 'posto', 'gasolina', 'diesel'],
    color: { red: 0.06, green: 0.73, blue: 0.85 },
    headers: STANDARD_HEADERS,
  },
  pdc: {
    title: '📋 Fila PDC',
    aliases: ['fila pdc', 'pdc', 'fila_pdc', 'fila', 'lavagem', 'oficina'],
    color: { red: 0.95, green: 0.55, blue: 0.1 },
    headers: STANDARD_HEADERS,
  },
  qualidade: {
    title: '🔍 Qualidade 51',
    aliases: ['qualidade 51', 'qualidade', '51 (qualidade)', '51', 'vistoria', 'inspecao'],
    color: { red: 0.39, green: 0.36, blue: 0.93 },
    headers: STANDARD_HEADERS,
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

/**
 * Appends a new vehicle record safely into the appropriate sheet tab (Append-Only mode)
 * Faithfully maps all 11 fields requested:
 * 1. DATA | 2. HORA | 3. CONDUTOR | 4. PLACA | 5. ORIGEM | 6. DESTINO | 7. KM (ODÔMETRO) | 8. NÍVEL DO COMBUSTÍVEL | 9. LITROS ABASTECIDOS | 10. TIPO DE COMBUSTÍVEL | 11. OBSERVAÇÕES
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

  // 1. DATA & 2. HORA already computed
  // 3. CONDUTOR
  const condutor = record.driverName || record.operatorName || '-';

  // 4. PLACA
  const placa = (record.plate || '').toUpperCase().trim();

  // 5. ORIGEM
  const origem = record.origin || (record.operationType === 'entrada' ? 'Pátio Principal' : '-');

  // 6. DESTINO
  let destino = record.destination || '-';
  if (record.operationType === 'pdc') {
    destino = record.destination || 'Fila PDC (Lavagem / Oficina)';
  } else if (record.operationType === 'qualidade_51' && record.location) {
    destino = `Pátio ${record.location}`;
  }

  // 7. KM (ODÔMETRO)
  const kmClean =
    record.km !== undefined && record.km !== null && String(record.km).trim() !== ''
      ? String(record.km).trim().replace(/\s*km/i, '')
      : '-';

  // 8. NÍVEL DO COMBUSTÍVEL
  const nivelCombustivel = record.fuel || '-';

  // 9. LITROS ABASTECIDOS
  const litrosAbastecidos =
    record.liters !== undefined && record.liters !== null && String(record.liters).trim() !== ''
      ? String(record.liters).trim().replace(/\s*l/i, '')
      : '-';

  // 10. TIPO DE COMBUSTÍVEL
  const tipoCombustivel =
    record.fuelType || (record.operationType === 'abastecimento' ? 'DIESEL S10' : '-');

  // 11. OBSERVAÇÕES (reúne fielmente notas e complementos do veículo)
  const extraDetails: string[] = [];
  if (record.hasSpareKey !== undefined) {
    extraDetails.push(`Chave Reserva: ${formatSpareKey(record.hasSpareKey)}`);
  }
  if (record.fleetType) {
    extraDetails.push(`Frota: ${record.fleetType}`);
  }
  if (record.entrySubtype) {
    extraDetails.push(`Subtipo: ${getSubtypeClean(record.entrySubtype)}`);
  }
  if (record.entryReason) {
    extraDetails.push(`Motivo: ${record.entryReason}`);
  }
  if (record.characteristic) {
    extraDetails.push(`Característica: ${record.characteristic}`);
  }
  if (record.location) {
    extraDetails.push(`Local/Poste: ${record.location}`);
  }
  if (record.operatorName && record.operatorName !== condutor) {
    extraDetails.push(`Operador Auditor: ${record.operatorName}`);
  }

  let observacoes = record.notes || record.description || '';
  if (extraDetails.length > 0) {
    const extraStr = `[${extraDetails.join(' | ')}]`;
    observacoes = observacoes ? `${extraStr} ${observacoes}` : extraStr;
  }
  if (!observacoes) observacoes = '-';

  // Standard 11 columns in strictly faithful order
  const standardRow = [
    dateStr,             // 1. DATA
    timeStr,             // 2. HORA
    condutor,            // 3. CONDUTOR
    placa,               // 4. PLACA
    origem,              // 5. ORIGEM
    destino,             // 6. DESTINO
    kmClean,             // 7. KM (ODÔMETRO)
    nivelCombustivel,    // 8. NÍVEL DO COMBUSTÍVEL
    litrosAbastecidos,   // 9. LITROS ABASTECIDOS
    tipoCombustivel,     // 10. TIPO DE COMBUSTÍVEL
    observacoes,         // 11. OBSERVAÇÕES
  ];

  let categoryKey: 'entrada' | 'saida' | 'combustivel' | 'pdc' | 'qualidade' = 'entrada';
  if (record.operationType === 'saida') categoryKey = 'saida';
  else if (record.operationType === 'abastecimento') categoryKey = 'combustivel';
  else if (record.operationType === 'pdc') categoryKey = 'pdc';
  else if (record.operationType === 'qualidade_51') categoryKey = 'qualidade';

  // Resolve or automatically create the dedicated tab for this operation
  const resolvedTabTitle = await ensureTargetTab(spreadsheetId, categoryKey, accessToken);

  // Smart header inspection: if the sheet tab already has headers in row 1, match by column name
  let rowValuesToSend = standardRow;
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
      const existingHeaders: string[] = (headerData.values?.[0] || []).map((h: string) =>
        String(h || '').trim().toLowerCase()
      );

      if (existingHeaders.length > 0) {
        const mappedRow: any[] = new Array(existingHeaders.length).fill('');
        existingHeaders.forEach((hdr, idx) => {
          if (hdr.includes('data') || hdr === 'dt') mappedRow[idx] = dateStr;
          else if (hdr.includes('hora') || hdr === 'hr') mappedRow[idx] = timeStr;
          else if (hdr.includes('condut') || hdr.includes('motor') || hdr.includes('operad')) mappedRow[idx] = condutor;
          else if (hdr.includes('plac')) mappedRow[idx] = placa;
          else if (hdr.includes('orig')) mappedRow[idx] = origem;
          else if (hdr.includes('dest')) mappedRow[idx] = destino;
          else if (hdr.includes('km') || hdr.includes('odôm') || hdr.includes('odomet')) mappedRow[idx] = kmClean;
          else if (
            hdr.includes('nível') ||
            hdr.includes('nivel') ||
            (hdr.includes('combust') && !hdr.includes('tipo') && !hdr.includes('litr'))
          )
            mappedRow[idx] = nivelCombustivel;
          else if (hdr.includes('litr') || hdr.includes('abastec')) mappedRow[idx] = litrosAbastecidos;
          else if (hdr.includes('tipo') && hdr.includes('combust')) mappedRow[idx] = tipoCombustivel;
          else if (hdr.includes('obs') || hdr.includes('nota') || hdr.includes('detalh')) mappedRow[idx] = observacoes;
          else if (hdr.includes('chave')) mappedRow[idx] = formatSpareKey(record.hasSpareKey) || '-';
          else if (hdr.includes('frota')) mappedRow[idx] = record.fleetType || '-';
          else if (hdr.includes('local') || hdr.includes('posto') || hdr.includes('poste')) mappedRow[idx] = record.location || '-';
          else if (hdr.includes('caract')) mappedRow[idx] = record.characteristic || '-';
          else if (hdr.includes('status')) mappedRow[idx] = 'REGISTRADO';
          else if (idx < standardRow.length) mappedRow[idx] = standardRow[idx];
        });
        rowValuesToSend = mappedRow;
      }
    }
  } catch (hdrErr) {
    console.warn('Header inspection fallback:', hdrErr);
  }

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

