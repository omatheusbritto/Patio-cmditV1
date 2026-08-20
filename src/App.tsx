import React, { useState, useEffect, useMemo } from 'react';
import {
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
import { ReviewAndShare } from './components/ReviewAndShare';
import { TestDiagnosticsModal } from './components/TestDiagnosticsModal';
import { HistoryModal } from './components/HistoryModal';
import { PatioDashboard } from './components/PatioDashboard';
import { SmartHistory } from './components/SmartHistory';
import { AndroidBottomNav } from './components/AndroidBottomNav';
import { OfflineStatusBanner } from './components/OfflineStatusBanner';

export default function App() {
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
  const [hasSpareKey, setHasSpareKey] = useState<boolean>(true);
  const [fleetType, setFleetType] = useState<VehicleFleetType>('RAC');

  // Fuel, Location & Characteristics
  const [fuel, setFuel] = useState<FuelLevel | null>(null);
  const [characteristic, setCharacteristic] = useState<VehicleCharacteristic | null>(null);
  const [location, setLocation] = useState<LocationCode | null>(null);

  // OCR state
  const [isOcrLoading, setIsOcrLoading] = useState<boolean>(false);
  const [ocrProgressMsg, setOcrProgressMsg] = useState<string>('Lendo placa...');

  // Modals state
  const [isTestsModalOpen, setIsTestsModalOpen] = useState<boolean>(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);

  // History & Patio Records (IndexedDB + Offline Persistent)
  const [records, setRecords] = useState<VehicleRecord[]>([]);

  // Load records from IndexedDB on startup
  useEffect(() => {
    getAllRecords().then((loaded) => {
      setRecords(loaded);
    });
  }, []);

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
    setHasSpareKey(true);
    setFleetType('RAC');

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
    setPlate(sanitizeRawText(confirmedPlate));
    setCurrentStep('operation_select');
  };

  // When user selects the Operation
  const handleSelectOperation = (op: OperationType) => {
    setOperationType(op);
    if (op === 'entrada' || op === 'saida') {
      setCurrentStep('operation_details');
    } else if (op === 'pdc') {
      setLocation('PDC');
      setCurrentStep('fuel');
    } else if (op === 'qualidade_51') {
      setCurrentStep('location');
    }
  };

  // When user submits operation details (Entrada / Saída)
  const handleSubmitOperationDetails = (details: {
    driverName: string;
    origin?: string;
    destination?: string;
    km: string;
    hasSpareKey: boolean;
    fleetType: VehicleFleetType;
  }) => {
    setDriverName(details.driverName);
    if (details.origin) setOrigin(details.origin);
    if (details.destination) setDestination(details.destination);
    setKm(details.km);
    setHasSpareKey(details.hasSpareKey);
    setFleetType(details.fleetType);
    setCurrentStep('fuel');
  };

  // When user selects fuel
  const handleSelectFuel = (selectedFuel: FuelLevel) => {
    setFuel(selectedFuel);
    if (operationType === 'qualidade_51') {
      setCurrentStep('characteristic');
    } else {
      // For Entrada, Saída, PDC -> direct to review
      if (operationType === 'entrada') setLocation(location || 'P1');
      if (operationType === 'saida') setLocation(location || 'R1');
      if (operationType === 'pdc') setLocation('PDC');
      setCurrentStep('review');
    }
  };

  // When user selects characteristic (for 51 Qualidade)
  const handleSelectCharacteristic = (char: VehicleCharacteristic | null) => {
    setCharacteristic(char);
  };

  const handleNextFromCharacteristic = () => {
    setCurrentStep('review');
  };

  // When user selects location (for 51 Qualidade)
  const handleSelectQualityLocation = (selectedLoc: QualityLocationCode) => {
    setLocation(selectedLoc);
  };

  const handleNextFromQualityLocation = () => {
    if (location) {
      setCurrentStep('fuel');
    }
  };

  // Save completed record to persistent storage and update patio
  const handleSaveToHistory = async (recordData: {
    photoDataUrl: string;
    plate: string;
    operationType: OperationType;
    fuel: FuelLevel;
    driverName?: string;
    origin?: string;
    destination?: string;
    km?: string | number;
    hasSpareKey?: boolean;
    fleetType?: VehicleFleetType;
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
    if (tab === 'diagnostics') {
      setIsTestsModalOpen(true);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900 flex flex-col font-sans antialiased selection:bg-emerald-200">
      {/* Real-time Offline & Online status banner */}
      <OfflineStatusBanner />

      {/* App Header */}
      <Header
        currentStep={currentStep}
        onReset={handleReset}
        onOpenTests={() => setIsTestsModalOpen(true)}
        onOpenHistory={() => setActiveTab('history')}
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
                onOpenTests={() => setIsTestsModalOpen(true)}
                metrics={patioMetrics}
              />
            )}

            {currentStep === 'camera' && (
              <CameraView
                onPhotoCaptured={handlePhotoCaptured}
                onCancel={() => setCurrentStep('home')}
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
              />
            )}

            {currentStep === 'operation_select' && (
              <OperationSelector
                plate={plate}
                selectedOperation={operationType}
                onSelectOperation={handleSelectOperation}
                onBack={() => setCurrentStep('plate_confirm')}
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
                onSubmit={handleSubmitOperationDetails}
                onBack={() => setCurrentStep('operation_select')}
              />
            )}

            {currentStep === 'location' && operationType === 'qualidade_51' && (
              <QualityLocationSelector
                plate={plate}
                selectedLocation={location}
                onSelectLocation={handleSelectQualityLocation}
                onNext={handleNextFromQualityLocation}
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
                    setCurrentStep('location');
                  } else {
                    setCurrentStep('operation_select');
                  }
                }}
              />
            )}

            {currentStep === 'characteristic' && operationType === 'qualidade_51' && (
              <CharacteristicSelector
                selectedCharacteristic={characteristic}
                onSelectCharacteristic={handleSelectCharacteristic}
                onNext={handleNextFromCharacteristic}
                onBack={() => setCurrentStep('fuel')}
              />
            )}

            {currentStep === 'review' && fuel && (
              <ReviewAndShare
                photoDataUrl={photoDataUrl}
                plate={plate}
                operationType={operationType}
                fuel={fuel}
                driverName={driverName}
                origin={origin}
                destination={destination}
                km={km}
                hasSpareKey={hasSpareKey}
                fleetType={fleetType}
                characteristic={characteristic}
                location={location}
                onEditPlate={() => setCurrentStep('plate_confirm')}
                onRetakePhoto={() => setCurrentStep('camera')}
                onEditOperation={() => setCurrentStep('operation_select')}
                onEditDetails={() => setCurrentStep('operation_details')}
                onEditFuel={() => setCurrentStep('fuel')}
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
            onClearHistory={handleClearAllRecords}
          />
        )}
      </main>

      {/* Global Developer Signature Footer (when not obscured by bottom nav) */}
      <footer className="w-full py-2 pb-20 text-center text-[11px] text-neutral-400 font-medium">
        Registro Veicular CMDIT • Desenvolvido por <span className="font-bold text-neutral-700">@omatheusbritto</span>
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

      {/* Test & Diagnostics Modal */}
      <TestDiagnosticsModal
        isOpen={isTestsModalOpen}
        onClose={() => {
          setIsTestsModalOpen(false);
          if (activeTab === 'diagnostics') setActiveTab('register');
        }}
      />

      {/* Legacy History Modal if triggered from header */}
      <HistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        records={records}
        onClearHistory={handleClearAllRecords}
        onDeleteRecord={handleDeleteVehicleRecord}
      />
    </div>
  );
}
