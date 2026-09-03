import React, { useState, useEffect, useMemo } from 'react';
import {
  EntrySubtype,
  FuelLevel,
  LocationCode,
  NavTab,
  OperationType,
  QualityLocationCode,
  Step,
  VehicleCharacteristic,
  VehicleFleetType,
  VehicleRecord,
  VehicleStatus,
  getAllowedOperationsForRole,
  getRoleBadgeStyle,
  getRoleDisplayName,
} from './types';
import { sanitizeRawText } from './utils/plateNormalizer';
import { smartRecognizePlate, recognizePlateWithGemini } from './utils/geminiPlateService';
import {
  getAllRecords,
  saveRecord,
  updateRecordStatus,
  deleteRecord,
  clearAllRecords,
  calculatePatioMetrics,
} from './utils/storageService';

import { Header } from './components/Header';
import { HomeScreen } from './components/HomeScreen';
import { CameraView } from './components/CameraView';
import { PlateConfirmation } from './components/PlateConfirmation';
import { OperationSelector } from './components/OperationSelector';
import { OperationDetailsForm } from './components/OperationDetailsForm';
import { QualityLocationSelector } from './components/QualityLocationSelector';
import { FuelSelector } from './components/FuelSelector';
import { CharacteristicSelector } from './components/CharacteristicSelector';
import { LocationSelector } from './components/LocationSelector';
import { DashboardCameraView } from './components/DashboardCameraView';
import { FuelingDetailsForm } from './components/FuelingDetailsForm';
import { ReviewAndShare } from './components/ReviewAndShare';
import { HistoryModal } from './components/HistoryModal';
import { PatioDashboard } from './components/PatioDashboard';
import { SmartHistory } from './components/SmartHistory';
import { AndroidBottomNav } from './components/AndroidBottomNav';
import { OfflineStatusBanner } from './components/OfflineStatusBanner';
import { LoginModal } from './components/LoginModal';
import { UserManagementModal } from './components/UserManagementModal';
import { MyShiftHistoryModal } from './components/MyShiftHistoryModal';
import { OnlineSpreadsheetViewerModal } from './components/OnlineSpreadsheetViewerModal';
import { AccessLogsTab } from './components/AccessLogsTab';
import {
  getCurrentSession,
  logoutUser,
  formatRemainingSessionTime,
} from './utils/authService';
import {
  getAutoPlateReadPreference,
  setAutoPlateReadPreference,
} from './utils/preferencesService';
import { AuthSession } from './types';
import { ShieldCheck, Clock, History, LogOut, AlertTriangle, FileSpreadsheet } from 'lucide-react';

export default function App() {
  // Authentication & Shift Session State (8 hours)
  const [authSession, setAuthSession] = useState<AuthSession | null>(() => getCurrentSession());
  const [showUserManagement, setShowUserManagement] = useState(false);
  const [showMyShiftModal, setShowMyShiftModal] = useState(false);
  const [isSpreadsheetModalOpen, setIsSpreadsheetModalOpen] = useState(false);
  const [sessionTimeText, setSessionTimeText] = useState<string>('');
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  // User preference: Leitura Automática de Placas (Liga / Desliga)
  const [autoReadEnabled, setAutoReadEnabled] = useState<boolean>(() => getAutoPlateReadPreference());

  const handleToggleAutoRead = () => {
    setAutoReadEnabled((prev) => {
      const next = !prev;
      setAutoPlateReadPreference(next);
      return next;
    });
  };

  // Active Navigation Tab
  const [activeTab, setActiveTab] = useState<NavTab>('register');

  // Step inside Registration Flow
  const [currentStep, setCurrentStep] = useState<Step>('home');

  // Form State
  const [photoDataUrl, setPhotoDataUrl] = useState<string>('');
  const [plate, setPlate] = useState<string>('');
  const [plateSource, setPlateSource] = useState<'local_ocr' | 'gemini_ai' | 'manual' | null>(null);
  const [croppedPlateUrl, setCroppedPlateUrl] = useState<string | null>(null);
  const [isCertain, setIsCertain] = useState<boolean>(true);
  const [analysisNotes, setAnalysisNotes] = useState<string>('');
  const [aiDetails, setAiDetails] = useState<string>('');
  const [rawOcrText, setRawOcrText] = useState<string>('');

  // Operation specifics
  const [operationType, setOperationType] = useState<OperationType>('entrada');
  const [driverName, setDriverName] = useState<string>('');
  const [origin, setOrigin] = useState<string>('');
  const [destination, setDestination] = useState<string>('');
  const [km, setKm] = useState<string>('');
  const [hasSpareKey, setHasSpareKey] = useState<boolean | undefined>(undefined);
  const [fleetType, setFleetType] = useState<VehicleFleetType | undefined>(undefined);
  const [entrySubtype, setEntrySubtype] = useState<EntrySubtype | undefined>(undefined);
  const [entryReason, setEntryReason] = useState<string>('');
  const [documentPhotoUrl, setDocumentPhotoUrl] = useState<string>('');

  // Fueling specifics
  const [dashboardPhotoUrl, setDashboardPhotoUrl] = useState<string>('');
  const [liters, setLiters] = useState<string>('');
  const [fuelType, setFuelType] = useState<string>('');

  // Fuel, Location & Characteristics
  const [fuel, setFuel] = useState<FuelLevel | null>(null);
  const [characteristic, setCharacteristic] = useState<VehicleCharacteristic | null>(null);
  const [location, setLocation] = useState<LocationCode | null>(null);

  // OCR state
  const [isOcrLoading, setIsOcrLoading] = useState<boolean>(false);
  const [ocrProgressMsg, setOcrProgressMsg] = useState<string>('Lendo placa...');

  // Modals state
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);

  // History & Patio Records (IndexedDB + Offline Persistent)
  const [records, setRecords] = useState<VehicleRecord[]>([]);

  // Load records from IndexedDB on startup
  useEffect(() => {
    getAllRecords().then((loaded) => {
      setRecords(loaded);
    });
  }, []);

  // Session expiry check & remaining time calculation (8-hour shift)
  useEffect(() => {
    const checkSession = () => {
      const session = getCurrentSession();
      setAuthSession(session);
      if (session) {
        setSessionTimeText(formatRemainingSessionTime(session.expiresAt));
      }
    };

    checkSession();
    const interval = setInterval(checkSession, 30000); // Checks every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    logoutUser();
    setAuthSession(null);
    setShowUserManagement(false);
    setShowMyShiftModal(false);
  };

  // Compute real-time Patio Metrics
  const patioMetrics = useMemo(() => {
    return calculatePatioMetrics(records);
  }, [records]);

  // Reset entire flow
  const handleReset = () => {
    setPhotoDataUrl('');
    setPlate('');
    setPlateSource(null);
    setCroppedPlateUrl(null);
    setIsCertain(true);
    setAnalysisNotes('');
    setAiDetails('');
    setRawOcrText('');

    setOperationType('entrada');
    setDriverName('');
    setOrigin('');
    setDestination('');
    setKm('');
    setHasSpareKey(undefined);
    setFleetType(undefined);
    setEntrySubtype(undefined);
    setEntryReason('');
    setDocumentPhotoUrl('');

    setDashboardPhotoUrl('');
    setLiters('');
    setFuelType('');

    setFuel(null);
    setCharacteristic(null);
    setLocation(null);
    setIsOcrLoading(false);
    setCurrentStep('home');
  };

  // Start new registration
  const handleStartRegistration = (presetOp?: OperationType) => {
    if (presetOp) setOperationType(presetOp);
    setActiveTab('register');
    setCurrentStep('camera');
  };

  // When photo is captured from camera or file
  const handlePhotoCaptured = async (dataUrl: string) => {
    setPhotoDataUrl(dataUrl);
    setCroppedPlateUrl(null);
    setCurrentStep('plate_confirm');

    if (!autoReadEnabled) {
      // Leitura Automática DESLIGADA pelo usuário: permite digitação manual direta
      setIsOcrLoading(false);
      setPlate('');
      setPlateSource('manual');
      setIsCertain(false);
      setAnalysisNotes('Leitura automática desligada nas preferências. Digite a placa ou clique em Ler Placa com IA.');
      return;
    }

    setIsOcrLoading(true);
    setOcrProgressMsg('✨ Lendo placa em alta velocidade...');

    try {
      const result = await smartRecognizePlate(dataUrl, (msg) => {
        setOcrProgressMsg(msg);
      });

      if (result.plate) {
        setPlate(result.plate);
        setPlateSource(result.source === 'none' ? 'manual' : result.source);
        if (result.croppedPlateUrl) setCroppedPlateUrl(result.croppedPlateUrl);
        setIsCertain(result.isCertain ?? true);
        if (result.analysisNotes) setAnalysisNotes(result.analysisNotes);
        if (result.rawText) setRawOcrText(result.rawText);
      } else {
        setPlateSource('manual');
        setIsCertain(false);
      }
    } catch (err) {
      console.warn('Smart recognition error:', err);
      setPlateSource('manual');
      setIsCertain(false);
    } finally {
      setIsOcrLoading(false);
    }
  };

  // Force re-analysis directly with Gemini AI Vision
  const handleReanalyzeWithAi = async () => {
    if (!photoDataUrl) return;
    setIsOcrLoading(true);
    setOcrProgressMsg('✨ Reanalisando imagem com IA sem alucinação...');

    try {
      const geminiResult = await recognizePlateWithGemini(photoDataUrl);
      if (geminiResult.plate) {
        setPlate(geminiResult.plate);
        setPlateSource('gemini_ai');
        if (geminiResult.croppedPlateUrl) setCroppedPlateUrl(geminiResult.croppedPlateUrl);
        setIsCertain(geminiResult.isCertain ?? true);
        if (geminiResult.analysisNotes) setAnalysisNotes(geminiResult.analysisNotes);
      }
    } catch (err) {
      console.warn('Gemini AI reanalyze error:', err);
    } finally {
      setIsOcrLoading(false);
    }
  };

  // When user confirms or manually inputs plate
  const handleConfirmPlate = (confirmedPlate: string) => {
    const clean = sanitizeRawText(confirmedPlate);
    setPlate(clean);

    // Validação de Duplicidade em Tempo Real (últimos 3 minutos)
    const recentDuplicate = records.find((item) => {
      const isSamePlate = item.plate.toUpperCase() === clean.toUpperCase();
      const timeDiffMs = Date.now() - item.createdAt;
      return isSamePlate && timeDiffMs < 3 * 60 * 1000;
    });

    if (recentDuplicate) {
      setDuplicateWarning(
        `⚠️ Atenção: A placa ${clean} já foi registrada há menos de 3 minutos como ${recentDuplicate.operationType?.toUpperCase()}.`
      );
    } else {
      setDuplicateWarning(null);
    }

    setCurrentStep('operation_select');
  };

  // When user selects the Operation
  const handleSelectOperation = (op: OperationType) => {
    setOperationType(op);
    if (op === 'entrada' || op === 'saida') {
      setCurrentStep('operation_details');
    } else if (op === 'abastecimento') {
      setCurrentStep('dashboard_camera');
    } else if (op === 'pdc') {
      setLocation('PDC');
      setCurrentStep('fuel');
    } else if (op === 'qualidade_51') {
      setCurrentStep('characteristic');
    }
  };

  // Fueling: when dashboard photo is captured
  const handleDashboardPhotoCaptured = (dataUrl: string) => {
    setDashboardPhotoUrl(dataUrl);
    setCurrentStep('fueling_details');
  };

  // Fueling: skip dashboard photo
  const handleSkipDashboardPhoto = () => {
    setDashboardPhotoUrl('');
    setCurrentStep('fueling_details');
  };

  // Fueling: submit manual data (KM, Fuel level, Liters, Fuel type, Driver, Destination)
  const handleSubmitFuelingDetails = (data: {
    km: string;
    fuel: FuelLevel;
    liters?: string;
    fuelType?: string;
    driverName?: string;
    destination?: string;
  }) => {
    setKm(data.km);
    setFuel(data.fuel);
    if (data.liters !== undefined) setLiters(data.liters);
    if (data.fuelType !== undefined) setFuelType(data.fuelType);
    if (data.driverName !== undefined) setDriverName(data.driverName);
    if (data.destination !== undefined) setDestination(data.destination);
    setCurrentStep('review');
  };

  // When user submits operation details (Entrada / Saída)
  const handleSubmitOperationDetails = (details: {
    driverName: string;
    origin?: string;
    destination?: string;
    km: string;
    hasSpareKey?: boolean;
    fleetType?: VehicleFleetType;
    entrySubtype?: EntrySubtype;
    entryReason?: string;
    documentPhotoUrl?: string;
  }) => {
    setDriverName(details.driverName);
    if (details.origin) setOrigin(details.origin);
    if (details.destination) setDestination(details.destination);
    setKm(details.km);
    setHasSpareKey(details.hasSpareKey);
    setFleetType(details.fleetType);
    setEntrySubtype(details.entrySubtype);
    setEntryReason(details.entryReason || '');
    if (details.documentPhotoUrl !== undefined) setDocumentPhotoUrl(details.documentPhotoUrl);
    setCurrentStep('fuel');
  };

  // When user selects fuel
  const handleSelectFuel = (selectedFuel: FuelLevel) => {
    setFuel(selectedFuel);
    if (operationType === 'qualidade_51') {
      setCurrentStep('location');
      return;
    }
    // For Entrada, Saída, PDC -> direct to review
    if (operationType === 'entrada') setLocation(location || 'P1');
    if (operationType === 'saida') setLocation(location || 'R1');
    if (operationType === 'pdc') setLocation('PDC');
    setCurrentStep('review');
  };

  // When user selects characteristic (for 51 Qualidade)
  const handleSelectCharacteristic = (char: VehicleCharacteristic | null) => {
    setCharacteristic(char);
  };

  const handleNextFromCharacteristic = () => {
    if (characteristic) {
      setCurrentStep('fuel');
    }
  };

  // When user selects location (for 51 Qualidade)
  const handleSelectQualityLocation = (selectedLoc: QualityLocationCode) => {
    setLocation(selectedLoc);
  };

  const handleNextFromQualityLocation = () => {
    if (location) {
      setCurrentStep('review');
    }
  };

  // Save completed record to persistent storage and update patio
  const handleSaveToHistory = async (recordData: {
    photoDataUrl: string;
    dashboardPhotoUrl?: string;
    documentPhotoUrl?: string;
    plate: string;
    operationType: OperationType;
    fuel: FuelLevel;
    driverName?: string;
    origin?: string;
    destination?: string;
    km?: string | number;
    liters?: string;
    fuelType?: string;
    hasSpareKey?: boolean;
    fleetType?: VehicleFleetType;
    entrySubtype?: EntrySubtype;
    entryReason?: string;
    characteristic?: VehicleCharacteristic | null;
    location?: LocationCode;
    description: string;
  }) => {
    const isOut = recordData.operationType === 'saida';
    const newRecord: VehicleRecord = {
      id: `rec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: Date.now(),
      status: isOut ? 'released' : 'parked',
      releasedAt: isOut ? Date.now() : undefined,
      ...recordData,
    };

    await saveRecord(newRecord);
    setRecords((prev) => [newRecord, ...prev.filter((r) => r.id !== newRecord.id)]);
  };

  // Toggle vehicle status (parked / released)
  const handleUpdateVehicleStatus = async (id: string, status: VehicleStatus) => {
    await updateRecordStatus(id, status);
    setRecords((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status, releasedAt: status === 'released' ? Date.now() : undefined } : r))
    );
  };

  // Save direct record (Master CRUD edit/create)
  const handleSaveDirectRecord = async (savedRecord: VehicleRecord) => {
    await saveRecord(savedRecord);
    setRecords((prev) => [savedRecord, ...prev.filter((r) => r.id !== savedRecord.id)]);
  };

  // Delete a single vehicle record
  const handleDeleteVehicleRecord = async (id: string) => {
    await deleteRecord(id);
    setRecords((prev) => prev.filter((r) => r.id !== id));
  };

  // Clear all local records
  const handleClearAllRecords = async () => {
    await clearAllRecords();
    setRecords([]);
  };

  // Handle Tab Switch
  const handleSelectTab = (tab: NavTab) => {
    setActiveTab(tab);
  };

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900 flex flex-col font-sans antialiased selection:bg-emerald-200">
      {/* Se não autenticado, bloqueia toda a tela com o modal de Login */}
      {!authSession && (
        <LoginModal
          onLoginSuccess={(session) => {
            setAuthSession(session);
            setSessionTimeText(formatRemainingSessionTime(session.expiresAt));
          }}
        />
      )}

      {/* Barra Superior Corporativa com Usuário Logado, Cargo/Função, Contador de Sessão (9h) e Painel Master */}
      {authSession && (
        <div className="bg-neutral-900 text-white px-3 py-1.5 text-xs flex items-center justify-between border-b border-neutral-800 shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full bg-emerald-600 flex items-center justify-center text-[10px] font-black text-white">
                {authSession.user.name.charAt(0).toUpperCase()}
              </div>
              <span className="font-bold text-neutral-200 truncate max-w-[110px] sm:max-w-[180px]">
                {authSession.user.name}
              </span>
            </div>
            
            {/* Badge da Função */}
            <span
              className={`text-[9px] font-black px-1.5 py-0.5 rounded border uppercase shrink-0 ${
                getRoleBadgeStyle(authSession.user.role).badgeClass
              }`}
            >
              {getRoleBadgeStyle(authSession.user.role).label}
            </span>

            <span className="text-[10px] bg-neutral-800/90 text-neutral-300 px-2 py-0.5 rounded-md hidden sm:flex items-center gap-1 font-medium border border-neutral-700/50" title="Tempo restante da sessão de 9 horas">
              <Clock className="w-3 h-3 text-emerald-400" />
              <span>{sessionTimeText || '9h restante'}</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowMyShiftModal(true)}
              className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
              title="Meus Registros do Turno"
            >
              <History className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Meus Registros</span>
            </button>

            {authSession.user.role === 'master' && (
              <>
                <button
                  type="button"
                  onClick={() => setIsSpreadsheetModalOpen(true)}
                  className="px-2 py-1 bg-emerald-800 hover:bg-emerald-700 text-emerald-100 rounded-lg text-[11px] font-bold flex items-center gap-1 transition cursor-pointer border border-emerald-600/50"
                  title="Consultar Planilha Online (5 Abas)"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-300" />
                  <span className="hidden sm:inline">Planilha Online</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowUserManagement(true)}
                  className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
                  title="Gerenciar Usuários (Apenas Master)"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Usuários</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={handleLogout}
              className="p-1 rounded-lg bg-neutral-800 hover:bg-rose-950/60 hover:text-rose-400 text-neutral-400 transition cursor-pointer"
              title="Sair (Logout)"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Real-time Offline & Online status banner */}
      <OfflineStatusBanner />

      {/* Duplicate Warning Toast */}
      {duplicateWarning && (
        <div className="max-w-lg mx-auto w-full px-4 pt-2">
          <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs font-bold text-amber-900 flex items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{duplicateWarning}</span>
            </div>
            <button
              type="button"
              onClick={() => setDuplicateWarning(null)}
              className="text-amber-800 hover:text-amber-950 font-black text-xs px-1.5 py-0.5 rounded cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* App Header */}
      <Header
        currentStep={currentStep}
        onReset={handleReset}
        onOpenHistory={() => setActiveTab('history')}
        onOpenSpreadsheetOnline={() => setIsSpreadsheetModalOpen(true)}
        historyCount={records.length}
      />

      {/* Main Container */}
      <main className="flex-1 w-full max-w-lg mx-auto p-4 flex flex-col justify-start">
        {/* Tab 1: Registrar & Flow Screens */}
        {activeTab === 'register' && (
          <>
            {currentStep === 'home' && (
              <HomeScreen
                onStartRegistration={() => handleStartRegistration()}
                onOpenPatio={() => setActiveTab('patio')}
                onOpenHistory={() => setActiveTab('history')}
                onOpenLogs={() => setActiveTab('logs')}
                onOpenSpreadsheetOnline={() => setIsSpreadsheetModalOpen(true)}
                metrics={patioMetrics}
                autoReadEnabled={autoReadEnabled}
                onToggleAutoRead={handleToggleAutoRead}
              />
            )}

            {currentStep === 'camera' && (
              <CameraView
                onPhotoCaptured={handlePhotoCaptured}
                onCancel={() => setCurrentStep('home')}
                autoReadEnabled={autoReadEnabled}
                onToggleAutoRead={handleToggleAutoRead}
              />
            )}

            {currentStep === 'plate_confirm' && (
              <PlateConfirmation
                photoDataUrl={photoDataUrl}
                initialPlate={plate}
                plateSource={plateSource}
                croppedPlateUrl={croppedPlateUrl}
                isCertain={isCertain}
                analysisNotes={analysisNotes}
                aiDetails={aiDetails}
                isOcrLoading={isOcrLoading}
                ocrProgressMsg={ocrProgressMsg}
                onConfirmPlate={handleConfirmPlate}
                onRetakePhoto={() => setCurrentStep('camera')}
                onReanalyzeWithAi={handleReanalyzeWithAi}
                autoReadEnabled={autoReadEnabled}
                onToggleAutoRead={handleToggleAutoRead}
              />
            )}

            {currentStep === 'operation_select' && (
              <OperationSelector
                plate={plate}
                selectedOperation={operationType}
                onSelectOperation={handleSelectOperation}
                onBack={() => setCurrentStep('plate_confirm')}
                onUpdatePlate={(newPlate) => setPlate(newPlate)}
                userRole={authSession?.user.role}
              />
            )}

            {currentStep === 'operation_details' && (
              <OperationDetailsForm
                operationType={operationType as 'entrada' | 'saida'}
                plate={plate}
                initialDriverName={driverName}
                initialOrigin={origin}
                initialDestination={destination}
                initialKm={km}
                initialHasSpareKey={hasSpareKey}
                initialFleetType={fleetType}
                initialEntrySubtype={entrySubtype}
                initialEntryReason={entryReason}
                initialDocumentPhotoUrl={documentPhotoUrl}
                onUpdatePlate={(newPlate) => setPlate(newPlate)}
                onSubmit={handleSubmitOperationDetails}
                onBack={() => setCurrentStep('operation_select')}
              />
            )}

            {currentStep === 'dashboard_camera' && (
              <DashboardCameraView
                plate={plate}
                onPhotoCaptured={handleDashboardPhotoCaptured}
                onSkip={handleSkipDashboardPhoto}
                onBack={() => setCurrentStep('operation_select')}
                onUpdatePlate={(newPlate) => setPlate(newPlate)}
              />
            )}

            {currentStep === 'fueling_details' && (
              <FuelingDetailsForm
                plate={plate}
                platePhotoUrl={photoDataUrl}
                dashboardPhotoUrl={dashboardPhotoUrl}
                initialKm={km}
                initialFuel={fuel || '8/8'}
                initialLiters={liters}
                initialFuelType={fuelType}
                initialDriverName={driverName}
                initialDestination={destination}
                onRetakeDashboardPhoto={() => setCurrentStep('dashboard_camera')}
                onUpdatePlate={(newPlate) => setPlate(newPlate)}
                onSubmit={handleSubmitFuelingDetails}
                onBack={() => setCurrentStep('operation_select')}
              />
            )}

            {currentStep === 'characteristic' && operationType === 'qualidade_51' && (
              <CharacteristicSelector
                selectedCharacteristic={characteristic}
                onSelectCharacteristic={handleSelectCharacteristic}
                onNext={handleNextFromCharacteristic}
                onBack={() => setCurrentStep('operation_select')}
              />
            )}

            {currentStep === 'fuel' && (
              <FuelSelector
                selectedFuel={fuel}
                onSelectFuel={handleSelectFuel}
                onBack={() => {
                  if (operationType === 'entrada' || operationType === 'saida') {
                    setCurrentStep('operation_details');
                  } else if (operationType === 'qualidade_51') {
                    setCurrentStep('characteristic');
                  } else {
                    setCurrentStep('operation_select');
                  }
                }}
              />
            )}

            {currentStep === 'location' && operationType === 'qualidade_51' && (
              <QualityLocationSelector
                plate={plate}
                selectedLocation={location}
                onSelectLocation={handleSelectQualityLocation}
                onNext={handleNextFromQualityLocation}
                onBack={() => setCurrentStep('fuel')}
                onUpdatePlate={(newPlate) => setPlate(newPlate)}
              />
            )}

            {currentStep === 'review' && fuel && (
              <ReviewAndShare
                photoDataUrl={photoDataUrl}
                dashboardPhotoUrl={dashboardPhotoUrl}
                documentPhotoUrl={documentPhotoUrl}
                plate={plate}
                operationType={operationType}
                fuel={fuel}
                driverName={driverName}
                origin={origin}
                destination={destination}
                km={km}
                liters={liters}
                fuelType={fuelType}
                hasSpareKey={hasSpareKey}
                fleetType={fleetType}
                entrySubtype={entrySubtype}
                entryReason={entryReason}
                characteristic={characteristic}
                location={location}
                onEditPlate={() => setCurrentStep('plate_confirm')}
                onUpdatePlate={(newPlate) => setPlate(newPlate)}
                onRetakePhoto={() => setCurrentStep('camera')}
                onRetakeDashboardPhoto={() => setCurrentStep('dashboard_camera')}
                onEditOperation={() => setCurrentStep('operation_select')}
                onEditDetails={() => {
                  if (operationType === 'abastecimento') {
                    setCurrentStep('fueling_details');
                  } else {
                    setCurrentStep('operation_details');
                  }
                }}
                onEditFuel={() => {
                  if (operationType === 'abastecimento') {
                    setCurrentStep('fueling_details');
                  } else {
                    setCurrentStep('fuel');
                  }
                }}
                onEditLocation={() => setCurrentStep('location')}
                onEditCharacteristic={() => setCurrentStep('characteristic')}
                onNewRegistration={handleReset}
                onSaveToHistory={handleSaveToHistory}
              />
            )}
          </>
        )}

        {/* Tab 2: Painel de Ocupação de Vagas & Pátio */}
        {activeTab === 'patio' && (
          <PatioDashboard
            records={records}
            metrics={patioMetrics}
            onSelectSectorForNew={(sector) => {
              setLocation(sector);
              setActiveTab('register');
              setCurrentStep('camera');
            }}
            onReleaseVehicle={(id) => handleUpdateVehicleStatus(id, 'released')}
            onStartNewRegistration={() => handleStartRegistration('entrada')}
            onOpenHistoryTab={() => setActiveTab('history')}
          />
        )}

        {/* Tab 3: Histórico com Busca Rápida */}
        {activeTab === 'history' && (
           <SmartHistory
             records={records}
             onUpdateStatus={handleUpdateVehicleStatus}
             onDeleteRecord={handleDeleteVehicleRecord}
             onSaveRecord={handleSaveDirectRecord}
             onClearHistory={handleClearAllRecords}
             onOpenSpreadsheetOnline={() => setIsSpreadsheetModalOpen(true)}
           />
        )}

        {/* Tab 4: Tratamento de Logs de Acesso */}
        {activeTab === 'logs' && (
          <AccessLogsTab
            currentSession={authSession}
            onOpenSpreadsheetModal={() => setIsSpreadsheetModalOpen(true)}
          />
        )}
      </main>

      {/* Global Developer Signature Footer (bottom right, single instance, WhatsApp link) */}
      <footer className="w-full max-w-md mx-auto px-4 py-1 pb-24 flex justify-end">
        <a
          href="https://wa.me/5511963816345?text=Ol%C3%A1%20Matheus%2C%20estou%20entrando%20em%20contato%20sobre%20o%20Registro%20Veicular%20CMDIT"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[10px] text-neutral-400 hover:text-emerald-700 active:scale-95 transition-all font-medium py-1 px-1.5 rounded-lg hover:bg-emerald-50/80"
          title="Falar com Matheus Britto no WhatsApp"
        >
          <span>Desenvolvido por</span>
          <span className="font-bold text-neutral-600 hover:text-emerald-700 hover:underline">@omatheusbritto</span>
        </a>
      </footer>

      {/* Android 12+ Bottom Navigation Bar */}
      {currentStep === 'home' && (
        <AndroidBottomNav
          activeTab={activeTab}
          onSelectTab={handleSelectTab}
          parkedCount={patioMetrics.totalParked}
          historyCount={records.length}
        />
      )}

      {/* Legacy History Modal if triggered from header */}
      <HistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        records={records}
        onClearHistory={handleClearAllRecords}
        onDeleteRecord={handleDeleteVehicleRecord}
      />

      {/* Painel do Master (Criar usuários, recuperar senhas, excluir operadores) */}
      {showUserManagement && (
        <UserManagementModal onClose={() => setShowUserManagement(false)} />
      )}

      {/* Meus Registros do Turno */}
      {showMyShiftModal && (
        <MyShiftHistoryModal
          onClose={() => setShowMyShiftModal(false)}
          allRecords={records}
        />
      )}

      {/* Consulta da Planilha Online (Apenas Master / Visualizador 5 Abas) */}
      <OnlineSpreadsheetViewerModal
        isOpen={isSpreadsheetModalOpen}
        onClose={() => setIsSpreadsheetModalOpen(false)}
        localRecords={records}
        onImportRecords={(importedList) => {
          if (importedList.length > 0) {
            const combined = [...importedList, ...records];
            setRecords(combined);
            importedList.forEach((r) => {
              saveRecord(r).catch(console.error);
            });
            alert(`${importedList.length} registros foram sincronizados com sucesso no sistema!`);
          }
        }}
      />
    </div>
  );
}
