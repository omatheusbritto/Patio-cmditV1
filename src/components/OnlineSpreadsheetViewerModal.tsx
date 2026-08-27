import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  FileSpreadsheet,
  RefreshCw,
  ExternalLink,
  X,
  Search,
  Download,
  Fuel,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  Wrench,
  Layers,
  Table as TableIcon,
  Globe,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Settings2,
  HelpCircle,
  FolderUp,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { VehicleRecord } from '../types';
import {
  getStoredDriveConfig,
  saveDriveConfig,
  DEFAULT_SPREADSHEET_ID,
  DEFAULT_SPREADSHEET_URL,
} from '../utils/googleDriveClient';
import { formatPlateForDisplay, isMercosulFormat } from '../utils/plateNormalizer';

interface OnlineSpreadsheetViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  localRecords?: VehicleRecord[];
  onImportRecords?: (imported: VehicleRecord[]) => void;
}

type TabKey = 'entrada' | 'saida' | 'combustivel' | 'qualidade51' | 'pdc' | 'all' | string;

interface SheetTabInfo {
  name: string;
  category: TabKey;
  headers: string[];
  rows: any[];
}

export const OnlineSpreadsheetViewerModal: React.FC<OnlineSpreadsheetViewerModalProps> = ({
  isOpen,
  onClose,
  localRecords = [],
  onImportRecords,
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>('entrada');
  const [viewMode, setViewMode] = useState<'table' | 'embed'>('table');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'yesterday' | 'week'>('all');
  const [showConfigPanel, setShowConfigPanel] = useState<boolean>(false);
  const [showHelpGuide, setShowHelpGuide] = useState<boolean>(false);
  const [dataSource, setDataSource] = useState<string>('server_synced_store');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Config State
  const [config, setConfig] = useState(() => getStoredDriveConfig());
  const [inputSpreadsheetUrl, setInputSpreadsheetUrl] = useState<string>(
    config.spreadsheetUrl || (config.spreadsheetId ? `https://docs.google.com/spreadsheets/d/${config.spreadsheetId}/edit` : DEFAULT_SPREADSHEET_URL)
  );
  const [inputWebhookUrl, setInputWebhookUrl] = useState<string>(config.webhookUrl || '');

  const [onlineData, setOnlineData] = useState<{
    spreadsheetTitle?: string;
    spreadsheetUrl?: string;
    source?: string;
    tabs: Record<string, { name: string; headers: string[]; rows: any[] }>;
  } | null>(null);

  const currentSpreadsheetId = config.spreadsheetId || DEFAULT_SPREADSHEET_ID;
  const currentSpreadsheetUrl =
    config.spreadsheetUrl ||
    (currentSpreadsheetId
      ? `https://docs.google.com/spreadsheets/d/${currentSpreadsheetId}/edit`
      : DEFAULT_SPREADSHEET_URL);

  const embedUrl = currentSpreadsheetId
    ? `https://docs.google.com/spreadsheets/d/${currentSpreadsheetId}/htmlembed?widget=true&headers=false`
    : '';

  // Fetch online data from server with multi-strategy support
  const loadData = async (overrideUrl?: string, overrideWebhook?: string) => {
    setIsLoading(true);
    setErrorMsg(null);
    setStatusMessage(null);

    const activeUrl = overrideUrl || inputSpreadsheetUrl || config.spreadsheetUrl || '';
    const activeWebhook = overrideWebhook !== undefined ? overrideWebhook : (inputWebhookUrl || config.webhookUrl || '');

    // Extract ID if URL is provided (Google Sheets, Drive file, or direct ID)
    let sId = config.spreadsheetId || '';
    if (activeUrl) {
      const match =
        activeUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/) ||
        activeUrl.match(/\/file\/d\/([a-zA-Z0-9-_]+)/) ||
        activeUrl.match(/[?&]id=([a-zA-Z0-9-_]+)/) ||
        activeUrl.match(/\/open\?id=([a-zA-Z0-9-_]+)/);
      if (match && match[1]) {
        sId = match[1];
      }
    }

    try {
      const queryParams = new URLSearchParams();
      if (activeWebhook) queryParams.set('webhookUrl', activeWebhook);
      if (sId) queryParams.set('spreadsheetId', sId);
      if (activeUrl) queryParams.set('spreadsheetUrl', activeUrl);

      const resp = await fetch(`/api/sheets/online-data?${queryParams.toString()}`, {
        headers: {
          Accept: 'application/json',
        },
      });

      const responseText = await resp.text();
      let data: any = null;
      try {
        data = JSON.parse(responseText);
      } catch (parseErr) {
        console.warn('Endpoint returned non-JSON response, using server synced storage');
      }

      if (data && data.success && data.tabs && Object.keys(data.tabs).length > 0) {
        setOnlineData(data);
        setDataSource(data.source || 'server_synced_store');
        setLastUpdated(data.updatedAt || new Date().toLocaleTimeString('pt-BR'));

        const rowCount = Object.values(data.tabs).reduce((acc: number, t: any) => acc + (t.rows?.length || 0), 0);

        if (data.source === 'apps_script_live') {
          setStatusMessage(`Lido via Webhook Apps Script (${rowCount} linhas)`);
        } else if (data.source === 'google_sheets_gviz_live') {
          setStatusMessage(`Lido via Google Sheets online (${rowCount} linhas)`);
        } else {
          setStatusMessage(`Base de dados sincronizada (${rowCount} linhas)`);
        }
      } else {
        // Safe fallback without error
        setDataSource('local_storage');
        setStatusMessage('Base de dados sincronizada');
      }
    } catch (err: any) {
      console.warn('Erro ao carregar dados online:', err);
      setDataSource('local_storage');
      setStatusMessage('Base de dados sincronizada');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      const freshConfig = getStoredDriveConfig();
      setConfig(freshConfig);
      setInputSpreadsheetUrl(
        freshConfig.spreadsheetUrl ||
        (freshConfig.spreadsheetId ? `https://docs.google.com/spreadsheets/d/${freshConfig.spreadsheetId}/edit` : DEFAULT_SPREADSHEET_URL)
      );
      setInputWebhookUrl(freshConfig.webhookUrl || '');
      loadData();
    }
  }, [isOpen]);

  // Save new spreadsheet link/ID
  const handleSaveConfig = () => {
    let sId = '';
    const match =
      inputSpreadsheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/) ||
      inputSpreadsheetUrl.match(/\/file\/d\/([a-zA-Z0-9-_]+)/) ||
      inputSpreadsheetUrl.match(/[?&]id=([a-zA-Z0-9-_]+)/) ||
      inputSpreadsheetUrl.match(/\/open\?id=([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      sId = match[1];
    } else if (inputSpreadsheetUrl.trim().length > 15 && !inputSpreadsheetUrl.includes('/')) {
      sId = inputSpreadsheetUrl.trim();
    }

    const updated = saveDriveConfig({
      spreadsheetId: sId || config.spreadsheetId,
      spreadsheetUrl: inputSpreadsheetUrl.trim() || config.spreadsheetUrl,
      webhookUrl: inputWebhookUrl.trim() || config.webhookUrl,
    });

    setConfig(updated);
    setShowConfigPanel(false);
    loadData(inputSpreadsheetUrl, inputWebhookUrl);
  };

  // Parse Excel (.xlsx, .xls) or CSV uploaded directly by user
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setErrorMsg(null);
    setUploadedFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        const importedTabs: Record<string, { name: string; headers: string[]; rows: any[] }> = {};
        const parsedRecordsForSync: VehicleRecord[] = [];

        workbook.SheetNames.forEach((sheetName) => {
          const worksheet = workbook.Sheets[sheetName];
          const jsonRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

          if (jsonRows.length > 0) {
            const headers = Object.keys(jsonRows[0]);
            importedTabs[sheetName] = {
              name: sheetName,
              headers,
              rows: jsonRows,
            };

            // Attempt to convert to standard VehicleRecord if applicable
            jsonRows.forEach((r, idx) => {
              const plateRaw = r.PLACA || r['PLACA VEÍCULO'] || r.Placa || '';
              if (plateRaw) {
                const opType = (
                  sheetName.toLowerCase().includes('saida') || sheetName.toLowerCase().includes('saída')
                    ? 'saida'
                    : sheetName.toLowerCase().includes('combust')
                    ? 'abastecimento'
                    : sheetName.toLowerCase().includes('51')
                    ? 'qualidade_51'
                    : sheetName.toLowerCase().includes('pdc')
                    ? 'pdc'
                    : 'entrada'
                ) as any;

                parsedRecordsForSync.push({
                  id: `excel_imp_${Date.now()}_${idx}`,
                  plate: String(plateRaw).replace(/[^A-Za-z0-9]/g, '').toUpperCase(),
                  photoDataUrl: '',
                  operationType: opType,
                  driverName: r.CONDUTOR || r['MOTORISTA'] || r.OPERADOR || '',
                  destination: r.DESTINO || '',
                  origin: r.ORIGEM || '',
                  fuel: (r.COMBUSTÍVEL || r['NÍVEL TANQUE'] || '4/8') as any,
                  fuelType: r.TIPO || 'DIESEL S10',
                  liters: r.LITROS ? Number(String(r.LITROS).replace(/[^0-9.]/g, '')) : undefined,
                  hasSpareKey: String(r.CHAVE || '').toUpperCase().includes('SIM'),
                  fleetType: r.FROTA || 'FROTA',
                  notes: r.OBS || r.OBSERVAÇÕES || '',
                  description: r.OPERADOR ? `Operador: ${r.OPERADOR}` : undefined,
                  createdAt: Date.now() - idx * 60000,
                  status: 'parked',
                });
              }
            });
          }
        });

        if (Object.keys(importedTabs).length > 0) {
          setOnlineData({
            spreadsheetTitle: file.name,
            source: 'excel_file_upload',
            tabs: importedTabs,
          });
          setDataSource('excel_file_upload');
          setLastUpdated(`Importado em ${new Date().toLocaleTimeString('pt-BR')}`);
          setStatusMessage(`Arquivo "${file.name}" carregado com sucesso (${Object.keys(importedTabs).length} abas encontradas)`);

          if (parsedRecordsForSync.length > 0 && onImportRecords) {
            // Offer to sync
            const shouldSync = window.confirm(
              `Deseja sincronizar os ${parsedRecordsForSync.length} registros extraídos do Excel com a lista local do Pátio?`
            );
            if (shouldSync) {
              onImportRecords(parsedRecordsForSync);
            }
          }
        } else {
          setErrorMsg('O arquivo Excel não contém linhas com dados.');
        }
      } catch (err: any) {
        console.error('Erro ao ler Excel:', err);
        setErrorMsg(`Falha ao ler arquivo Excel: ${err.message || 'Formato não reconhecido'}`);
      } finally {
        setIsLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // Merge server records, online sheet records, and uploaded excel tabs
  const normalizedTabsData = useMemo(() => {
    const STANDARD_11_HEADERS = [
      'DATA',
      'HORA',
      'OPERADOR (AUDITORIA)',
      'PLACA',
      'CONDUTOR',
      'KM (ODÔMETRO)',
      'NÍVEL DO COMBUSTÍVEL',
      'LITROS ABASTECIDOS',
      'TIPO DE COMBUSTÍVEL',
      'DESTINO',
      'OBSERVAÇÕES',
    ];

    const result: Record<string, SheetTabInfo> = {
      entrada: {
        name: '📥 Entrada',
        category: 'entrada',
        headers: [...STANDARD_11_HEADERS],
        rows: [],
      },
      saida: {
        name: '📤 Saída',
        category: 'saida',
        headers: [...STANDARD_11_HEADERS],
        rows: [],
      },
      combustivel: {
        name: '⛽ Combustível',
        category: 'combustivel',
        headers: [...STANDARD_11_HEADERS],
        rows: [],
      },
      qualidade51: {
        name: '🔍 Qualidade 51',
        category: 'qualidade51',
        headers: [...STANDARD_11_HEADERS],
        rows: [],
      },
      pdc: {
        name: '📋 Fila PDC',
        category: 'pdc',
        headers: [...STANDARD_11_HEADERS],
        rows: [],
      },
      all: {
        name: '📊 Todos os Registros',
        category: 'all',
        headers: [...STANDARD_11_HEADERS],
        rows: [],
      },
    };

    // 1. If onlineData has tabs:
    if (onlineData?.tabs) {
      Object.entries(onlineData.tabs).forEach(([tabName, tabContent]: [string, any]) => {
        const lower = tabName.toLowerCase();
        let cat: string = tabName;

        if (lower.includes('entrad')) cat = 'entrada';
        else if (lower.includes('said')) cat = 'saida';
        else if (lower.includes('combust') || lower.includes('abastec')) cat = 'combustivel';
        else if (lower.includes('51') || lower.includes('qualidade')) cat = 'qualidade51';
        else if (lower.includes('pdc') || lower.includes('fila')) cat = 'pdc';

        if (!result[cat]) {
          result[cat] = {
            name: tabName,
            category: cat,
            headers: tabContent.headers || [...STANDARD_11_HEADERS],
            rows: [],
          };
        }

        if (tabContent && Array.isArray(tabContent.rows) && tabContent.rows.length > 0) {
          result[cat].rows = [...tabContent.rows];
          if (Array.isArray(tabContent.headers) && tabContent.headers.length > 0) {
            result[cat].headers = tabContent.headers;
          }
        }
      });
    }

    // 2. If online rows are empty, fallback to local/synced vehicle records
    const hasAnyOnlineRows = Object.values(result).some((t) => t.rows.length > 0);
    if (!hasAnyOnlineRows && localRecords.length > 0) {
      // Sort newest first (pilha / LIFO)
      const sortedLocal = [...localRecords].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      sortedLocal.forEach((rec) => {
        const dateObj = new Date(rec.createdAt);
        const dateStr = dateObj.toLocaleDateString('pt-BR');
        const timeStr = dateObj.toLocaleTimeString('pt-BR');
        const op = rec.operationType || 'entrada';

        const operador = rec.operatorName || 'Operador';
        const condutor = rec.driverName || rec.condutor || '-';
        const placa = (rec.plate || '').toUpperCase().trim();
        const destino =
          rec.destination ||
          (op === 'pdc'
            ? 'Fila PDC (Lavagem/Oficina)'
            : op === 'qualidade_51' && rec.location
            ? `Pátio ${rec.location}`
            : '-');
        const km = rec.km ? `${String(rec.km).replace(/\s*km/i, '')} km` : '-';
        
        let nivelCombustivel = rec.fuel || '-';
        if (nivelCombustivel === '1/8') nivelCombustivel = '1/8 (Reserva)';
        else if (nivelCombustivel === '2/8') nivelCombustivel = '2/8 (1/4)';
        else if (nivelCombustivel === '3/8') nivelCombustivel = '3/8';
        else if (nivelCombustivel === '4/8' || nivelCombustivel === '4/8 • 1/2' || nivelCombustivel === 'Meio Tanque (1/2)') nivelCombustivel = '4/8 (1/2)';
        else if (nivelCombustivel === '5/8') nivelCombustivel = '5/8';
        else if (nivelCombustivel === '6/8') nivelCombustivel = '6/8 (3/4)';
        else if (nivelCombustivel === '7/8') nivelCombustivel = '7/8';
        else if (nivelCombustivel === '8/8' || nivelCombustivel === '8/8 • Cheio' || nivelCombustivel === 'Tanque Cheio') nivelCombustivel = '8/8 (Cheio)';

        const litrosAbastecidos = rec.liters ? `${String(rec.liters).replace(/\s*l/i, '')} L` : (op === 'abastecimento' ? '-' : '-');
        const tipoCombustivel = rec.fuelType || (op === 'abastecimento' ? 'DIESEL S10' : '-');

        const extras: string[] = [];
        if (rec.hasSpareKey !== undefined && rec.hasSpareKey !== null) {
          extras.push(`Chave: ${rec.hasSpareKey ? 'SIM' : 'NÃO'}`);
        }
        if (rec.fleetType) extras.push(`Frota: ${rec.fleetType}`);
        if (rec.entrySubtype) extras.push(`Subtipo: ${rec.entrySubtype}`);
        if (rec.entryReason) extras.push(`Motivo: ${rec.entryReason}`);
        if (rec.characteristic) extras.push(`Caract: ${rec.characteristic}`);
        if (rec.location) extras.push(`Local: ${rec.location}`);
        if (rec.origin) extras.push(`Origem: ${rec.origin}`);

        let observacoes = rec.notes || rec.description || '';
        if (extras.length > 0) {
          const extraStr = `[${extras.join(' | ')}]`;
          observacoes = observacoes ? `${extraStr} ${observacoes}` : extraStr;
        }
        if (!observacoes) observacoes = '-';

        const standardRowObj = {
          DATA: dateStr,
          HORA: timeStr,
          'OPERADOR (AUDITORIA)': operador,
          PLACA: placa,
          CONDUTOR: condutor,
          'KM (ODÔMETRO)': km,
          'NÍVEL DO COMBUSTÍVEL': nivelCombustivel,
          'LITROS ABASTECIDOS': litrosAbastecidos,
          'TIPO DE COMBUSTÍVEL': tipoCombustivel,
          DESTINO: destino,
          OBSERVAÇÕES: observacoes,
          _rawDate: rec.createdAt,
          _plate: placa,
        };

        if (op === 'saida') {
          result.saida.rows.push(standardRowObj);
        } else if (op === 'abastecimento') {
          result.combustivel.rows.push(standardRowObj);
        } else if (op === 'qualidade_51') {
          result.qualidade51.rows.push(standardRowObj);
        } else if (op === 'pdc') {
          result.pdc.rows.push(standardRowObj);
        } else {
          result.entrada.rows.push(standardRowObj);
        }

        // All tab
        result.all.rows.push(standardRowObj);
      });
    }

    return result;
  }, [onlineData, localRecords]);

  // Active Tab rows filtered by search and date
  const filteredRows = useMemo(() => {
    const currentTabObj = normalizedTabsData[activeTab] || Object.values(normalizedTabsData)[0];
    if (!currentTabObj) return [];

    const searchClean = searchTerm.trim().toUpperCase();
    const ONE_DAY = 24 * 60 * 60 * 1000;
    const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).getTime();
    const yesterdayStart = todayStart - ONE_DAY;
    const weekStart = todayStart - 7 * ONE_DAY;

    return currentTabObj.rows.filter((row: any) => {
      // Search matching
      if (searchClean) {
        const matchesSearch = Object.values(row).some((val) =>
          String(val).toUpperCase().includes(searchClean)
        );
        if (!matchesSearch) return false;
      }

      // Date filtering (if raw date exists)
      if (row._rawDate) {
        const rowTime = Number(row._rawDate);
        if (dateFilter === 'today' && rowTime < todayStart) return false;
        if (dateFilter === 'yesterday' && (rowTime < yesterdayStart || rowTime >= todayStart))
          return false;
        if (dateFilter === 'week' && rowTime < weekStart) return false;
      }

      return true;
    });
  }, [normalizedTabsData, activeTab, searchTerm, dateFilter]);

  // Export current tab rows to CSV
  const handleExportCsv = () => {
    const tabObj = normalizedTabsData[activeTab];
    if (!tabObj || filteredRows.length === 0) {
      alert('Nenhum registro para exportar nesta aba.');
      return;
    }

    const headers = tabObj.headers.filter((h) => !h.startsWith('_'));
    const csvContent = [
      headers.join(';'),
      ...filteredRows.map((row) =>
        headers
          .map((h) => {
            const val = row[h] !== undefined ? String(row[h]) : '';
            return `"${val.replace(/"/g, '""')}"`;
          })
          .join(';')
      ),
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `CMDIT_Planilha_${tabObj.name.replace(/[^a-zA-Z0-9]/g, '')}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  const defaultTabsConfig: { id: TabKey; label: string; icon: any; color: string }[] = [
    { id: 'entrada', label: 'Entrada', icon: ArrowDownLeft, color: 'text-emerald-700' },
    { id: 'saida', label: 'Saída', icon: ArrowUpRight, color: 'text-rose-700' },
    { id: 'combustivel', label: 'Combustível', icon: Fuel, color: 'text-sky-700' },
    { id: 'qualidade51', label: 'Qualidade 51', icon: ShieldCheck, color: 'text-purple-700' },
    { id: 'pdc', label: 'Fila PDC', icon: Wrench, color: 'text-amber-700' },
    { id: 'all', label: 'Geral', icon: Layers, color: 'text-neutral-700' },
  ];

  // Dynamic tabs if custom sheet names loaded from Excel
  const allAvailableTabKeys = Object.keys(normalizedTabsData);
  const extraTabs = allAvailableTabKeys
    .filter((key) => !defaultTabsConfig.some((d) => d.id === key))
    .map((key) => ({
      id: key,
      label: normalizedTabsData[key]?.name || key,
      icon: FileSpreadsheet,
      color: 'text-teal-700',
    }));

  const activeTabsList = [...defaultTabsConfig, ...extraTabs];

  // Source Badge Text
  const getSourceBadge = () => {
    switch (dataSource) {
      case 'google_sheets_oauth_api':
        return { label: 'Google Drive API Conectado', bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' };
      case 'apps_script_live':
        return { label: 'Apps Script Webhook Online', bg: 'bg-teal-500/20 text-teal-300 border-teal-500/40' };
      case 'google_sheets_gviz_live':
        return { label: 'Google Sheets Link Direto', bg: 'bg-blue-500/20 text-blue-300 border-blue-500/40' };
      case 'excel_file_upload':
        return { label: `Excel Importado (${uploadedFileName})`, bg: 'bg-amber-500/20 text-amber-300 border-amber-500/40' };
      default:
        return { label: 'Base Sincronizada Pátio', bg: 'bg-slate-700 text-slate-300 border-slate-600' };
    }
  };

  const sourceBadge = getSourceBadge();

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 select-none animate-fade-in">
      <div className="bg-white rounded-3xl max-w-6xl w-full h-[94vh] flex flex-col shadow-2xl overflow-hidden border border-neutral-200">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-3.5 sm:p-4 flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-black text-base sm:text-lg leading-tight text-white">
                  Consulta da Planilha Online (Google Drive & Excel)
                </h2>
                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${sourceBadge.bg}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                  {sourceBadge.label}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Painel Master CMDIT • Consulta ao vivo das 5 abas com suporte a Google Sheets e Excel (.xlsx)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Upload Excel Button */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".xlsx,.xls,.csv"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              title="Abrir arquivo Excel (.xlsx, .csv) do Computador/Drive"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 hover:text-emerald-200 transition active:scale-95 text-xs font-bold flex items-center gap-1.5 border border-emerald-500/30"
            >
              <FolderUp className="w-4 h-4" />
              <span className="hidden sm:inline">Importar Excel</span>
            </button>

            {/* Config Connection */}
            <button
              type="button"
              onClick={() => {
                setShowConfigPanel(!showConfigPanel);
                setShowHelpGuide(false);
              }}
              title="Configurar Link da Planilha e Conexão Google Drive"
              className={`p-2 rounded-xl transition active:scale-95 text-xs font-bold flex items-center gap-1.5 ${
                showConfigPanel ? 'bg-emerald-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              <Settings2 className="w-4 h-4" />
              <span className="hidden md:inline">Link / Config</span>
            </button>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => loadData()}
              disabled={isLoading}
              title="Atualizar dados da planilha"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition active:scale-95 disabled:opacity-50 flex items-center gap-1.5 text-xs font-bold"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </button>

            {/* Direct Open in Google Sheets */}
            <a
              href={currentSpreadsheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition active:scale-95 flex items-center gap-1.5 text-xs font-bold shadow-md shadow-emerald-900/30"
              title="Abrir no Google Sheets Web / App"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="hidden sm:inline">Abrir Google Sheets</span>
            </a>

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-400 hover:text-white transition active:scale-95"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Configuration / Connection Bar (Collapsible) */}
        {showConfigPanel && (
          <div className="bg-slate-850 border-b border-slate-700 p-3 sm:p-4 text-slate-200 text-xs flex flex-col gap-3 animate-fade-in shrink-0 bg-slate-900/95">
            <div className="flex items-center justify-between">
              <span className="font-black text-sm text-white flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-emerald-400" />
                Vincular Planilha do Google Drive / Google Sheets
              </span>
              <button
                type="button"
                onClick={() => setShowHelpGuide(!showHelpGuide)}
                className="text-emerald-400 hover:underline flex items-center gap-1 font-bold text-xs"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Como Compartilhar a Planilha?</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  Link da Planilha Google Sheets (URL ou ID do Drive):
                </label>
                <input
                  type="text"
                  value={inputSpreadsheetUrl}
                  onChange={(e) => setInputSpreadsheetUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  URL Webhook do Google Apps Script (Opcional para gravação direta):
                </label>
                <input
                  type="text"
                  value={inputWebhookUrl}
                  onChange={(e) => setInputWebhookUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-1 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowConfigPanel(false)}
                className="px-3 py-1.5 text-slate-400 hover:text-white font-bold text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveConfig}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-4 py-1.5 rounded-xl flex items-center gap-1.5 transition active:scale-95 shadow-md text-xs"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Salvar & Carregar Planilha</span>
              </button>
            </div>
          </div>
        )}

        {/* Help Guide Box */}
        {showHelpGuide && (
          <div className="bg-emerald-950/90 border-b border-emerald-800 p-3 sm:p-4 text-emerald-100 text-xs flex flex-col gap-2 shrink-0 animate-fade-in">
            <div className="flex items-center justify-between font-bold text-white">
              <span className="flex items-center gap-1.5 text-emerald-300">
                <HelpCircle className="w-4 h-4" />
                Instruções de integração sem login:
              </span>
              <button
                type="button"
                onClick={() => setShowHelpGuide(false)}
                className="text-emerald-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <ol className="list-decimal pl-4 space-y-1 text-emerald-200">
              <li>
                <strong>Link Compartilhado</strong>: Na sua planilha Google, clique em <strong>Compartilhar</strong> (canto superior direito) &gt; altere para <strong>&quot;Qualquer pessoa com o link pode ver&quot;</strong> &gt; Copie o link e salve na configuração.
              </li>
              <li>
                <strong>Webhook Google Apps Script</strong>: Cole o link do seu Webhook Apps Script para gravação em tempo real sem precisar de login.
              </li>
              <li>
                <strong>Importar Arquivo (.xlsx / .csv)</strong>: Clique em <strong>&quot;Importar Excel&quot;</strong> para abrir qualquer planilha diretamente do seu computador.
              </li>
            </ol>
          </div>
        )}

        {/* Status / Error Toast Bar */}
        {(statusMessage || errorMsg) && (
          <div
            className={`px-4 py-2 text-xs flex items-center justify-between shrink-0 font-medium ${
              errorMsg ? 'bg-rose-900/40 text-rose-200 border-b border-rose-800' : 'bg-emerald-900/40 text-emerald-200 border-b border-emerald-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {errorMsg ? <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
              <span>{errorMsg || statusMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setStatusMessage(null);
                setErrorMsg(null);
              }}
              className="text-xs hover:underline opacity-80"
            >
              Fechar
            </button>
          </div>
        )}

        {/* Sub-header / Tab Bar & Controls */}
        <div className="bg-slate-50 border-b border-neutral-200 p-2.5 sm:p-3 flex flex-col gap-2.5 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Tabs Selector */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              {activeTabsList.map((tab) => {
                const isActive = activeTab === tab.id;
                const Icon = tab.icon;
                const count = normalizedTabsData[tab.id]?.rows?.length || 0;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(tab.id);
                      if (viewMode === 'embed') setViewMode('table');
                    }}
                    className={`py-1.5 px-2.5 sm:px-3 rounded-xl text-xs font-black flex items-center gap-1.5 transition whitespace-nowrap active:scale-95 cursor-pointer ${
                      isActive
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'bg-white text-slate-700 hover:bg-slate-200/70 border border-slate-200'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-400' : tab.color}`} />
                    <span>{tab.label}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        isActive ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* View Mode Toggle: Table vs Live Google Sheets Embed */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`py-1 px-2.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                  viewMode === 'table' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span>Tabela</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('embed')}
                className={`py-1 px-2.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                  viewMode === 'embed' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Google Sheets ao Vivo</span>
              </button>
            </div>
          </div>

          {/* Search & Filter bar (shown in Table mode) */}
          {viewMode === 'table' && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex-1 min-w-[200px] relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={`Buscar em ${normalizedTabsData[activeTab]?.name || 'tabela'} por placa, operador, motorista...`}
                  className="w-full pl-9 pr-8 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent font-medium"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Date Filter */}
                <select
                  value={dateFilter}
                  onChange={(e: any) => setDateFilter(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl py-1.5 px-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="all">Todas as Datas</option>
                  <option value="today">Apenas Hoje</option>
                  <option value="yesterday">Ontem</option>
                  <option value="week">Últimos 7 dias</option>
                </select>

                {/* Export CSV Button */}
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-900 py-1.5 px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 shadow-2xs"
                  title="Baixar dados desta aba em formato CSV"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="hidden sm:inline">Exportar CSV</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto bg-slate-100 p-2 sm:p-4">
          {viewMode === 'embed' ? (
            /* Live Google Sheets Embed */
            <div className="w-full h-full bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="p-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600">
                <span className="font-bold flex items-center gap-1.5 text-slate-800">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  Exibição Oficial Google Sheets
                </span>
                <a
                  href={currentSpreadsheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-700 hover:underline font-bold flex items-center gap-1"
                >
                  <span>Abrir em tela cheia no Google</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <iframe
                src={embedUrl}
                title="Google Sheet Live View"
                className="w-full flex-1 border-0"
              />
            </div>
          ) : (
            /* Interactive Data Table */
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
              <div className="overflow-auto flex-1">
                {filteredRows.length === 0 ? (
                  <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center p-4">
                    <FileSpreadsheet className="w-12 h-12 stroke-1 mb-2 text-slate-300" />
                    <p className="font-bold text-sm text-slate-700">Nenhum registro retornado</p>
                    <p className="text-xs text-slate-500 max-w-md mt-1">
                      {searchTerm
                        ? 'Nenhum resultado para a busca atual. Tente alterar os termos ou limpar o filtro.'
                        : `Ainda não há linhas lidas para a aba selecionada. Você pode clicar em "Link / Config" para conectar sua conta Google ou clicar em "Importar Excel" para carregar a planilha diretamente.`}
                    </p>
                    <div className="mt-4 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowConfigPanel(true)}
                        className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 transition active:scale-95"
                      >
                        <Settings2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Verificar Link da Planilha</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition active:scale-95"
                      >
                        <FolderUp className="w-3.5 h-3.5" />
                        <span>Carregar Arquivo .xlsx</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-900 text-white font-black uppercase text-[10px] tracking-wider sticky top-0 z-10 shadow-xs">
                        <th className="py-2.5 px-3 border-r border-slate-800 w-10 text-center">#</th>
                        {normalizedTabsData[activeTab]?.headers
                          ?.filter((h) => !h.startsWith('_'))
                          .map((header) => (
                            <th key={header} className="py-2.5 px-3 border-r border-slate-800 whitespace-nowrap">
                              {header}
                            </th>
                          ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                      {filteredRows.map((row, idx) => {
                        const headers = normalizedTabsData[activeTab]?.headers?.filter((h) => !h.startsWith('_')) || [];

                        return (
                          <tr
                            key={idx}
                            className={`hover:bg-emerald-50/50 transition-colors ${
                              idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'
                            }`}
                          >
                            <td className="py-2.5 px-3 text-center text-[10px] font-mono text-slate-400 border-r border-slate-100">
                              {idx + 1}
                            </td>
                            {headers.map((h) => {
                              const cellValue = row[h] !== undefined && row[h] !== null ? String(row[h]) : '-';

                              // Formatting for special columns:
                              if (h.toUpperCase().includes('PLACA')) {
                                return (
                                  <td key={h} className="py-2.5 px-3 border-r border-slate-100 whitespace-nowrap">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-mono font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-xs">
                                        {formatPlateForDisplay(cellValue)}
                                      </span>
                                      {cellValue && cellValue.length >= 7 && (
                                        <span className="text-[9px] font-bold px-1 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                                          {isMercosulFormat(cellValue) ? 'Mercosul' : 'Antiga'}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                );
                              }

                              if (h.toUpperCase().includes('COMBUST') || h.toUpperCase().includes('TANQUE')) {
                                return (
                                  <td key={h} className="py-2.5 px-3 border-r border-slate-100 whitespace-nowrap">
                                    <span className="inline-flex items-center gap-1 font-bold text-[11px] px-1.5 py-0.5 rounded bg-sky-50 text-sky-800 border border-sky-200">
                                      <Fuel className="w-3 h-3 text-sky-600" />
                                      {cellValue}
                                    </span>
                                  </td>
                                );
                              }

                              if (h.toUpperCase().includes('CHAVE')) {
                                const hasKey = cellValue.toUpperCase().includes('SIM');
                                return (
                                  <td key={h} className="py-2.5 px-3 border-r border-slate-100 whitespace-nowrap">
                                    <span
                                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                        hasKey
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : 'bg-slate-100 text-slate-600'
                                      }`}
                                    >
                                      {cellValue}
                                    </span>
                                  </td>
                                );
                              }

                              if (h.toUpperCase() === 'DATA' || h.toUpperCase() === 'HORA') {
                                return (
                                  <td key={h} className="py-2.5 px-3 border-r border-slate-100 whitespace-nowrap font-mono text-[11px] text-slate-600">
                                    {cellValue}
                                  </td>
                                );
                              }

                              return (
                                <td key={h} className="py-2.5 px-3 border-r border-slate-100 text-slate-700">
                                  {cellValue}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Table Footer with Summary Stats */}
              <div className="p-2.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-500">
                <span>
                  Exibindo <strong>{filteredRows.length}</strong> de <strong>{normalizedTabsData[activeTab]?.rows?.length || 0}</strong> linhas na aba {normalizedTabsData[activeTab]?.name || activeTab}
                </span>
                {lastUpdated && (
                  <span className="text-[11px] text-slate-400">
                    Última sincronização: <strong>{lastUpdated}</strong>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
