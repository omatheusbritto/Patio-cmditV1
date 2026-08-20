import React, { useState, useEffect, useMemo } from 'react';
import {
  FuelLevel,
  LocationCode,
  NavTab,
  Step,
  VehicleCharacteristic,
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
  // Active Navigation Tab (Android 12+ Tabs)
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
    setFuel(null);
    setCharacteristic(null);
    setLocation(null);
    setIsOcrLoading(false);
    setCurrentStep('home');
  };

  // Start new registration
  const handleStartRegistration = () => {
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
    setCurrentStep('fuel');
  };

  // When user selects fuel
  const handleSelectFuel = (selectedFuel: FuelLevel) => {
    setFuel(selectedFuel);
    setCurrentStep('characteristic');
  };

  // When user selects characteristic (or leaves blank)
  const handleSelectCharacteristic = (char: VehicleCharacteristic | null) => {
    setCharacteristic(char);
  };

  const handleNextFromCharacteristic = () => {
    setCurrentStep('location');
  };

  // When user selects location
  const handleSelectLocation = (selectedLoc: LocationCode) => {
    setLocation(selectedLoc);
  };

  const handleNextFromLocation = () => {
    if (location) {
      setCurrentStep('review');
    }
  };

  // Save completed record to persistent storage and update patio
  const handleSaveToHistory = async (recordData: {
    photoDataUrl: string;
    plate: string;
    fuel: FuelLevel;
    characteristic: VehicleCharacteristic | null;
    location: LocationCode;
    description: string;
  }) => {
    const newRecord: VehicleRecord = {
      id: `rec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: Date.now(),
      status: 'parked',
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
                onStartRegistration={handleStartRegistration}
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

            {currentStep === 'fuel' && (
              <FuelSelector
                selectedFuel={fuel}
                onSelectFuel={handleSelectFuel}
                onBack={() => setCurrentStep('plate_confirm')}
              />
            )}

            {currentStep === 'characteristic' && (
              <CharacteristicSelector
                selectedCharacteristic={characteristic}
                onSelectCharacteristic={handleSelectCharacteristic}
                onNext={handleNextFromCharacteristic}
                onBack={() => setCurrentStep('fuel')}
              />
            )}

            {currentStep === 'location' && (
              <LocationSelector
                selectedLocation={location}
                onSelectLocation={handleSelectLocation}
                onNext={handleNextFromLocation}
                onBack={() => setCurrentStep('characteristic')}
              />
            )}

            {currentStep === 'review' && fuel && location && (
              <ReviewAndShare
                photoDataUrl={photoDataUrl}
                plate={plate}
                fuel={fuel}
                characteristic={characteristic}
                location={location}
                onEditPlate={() => setCurrentStep('plate_confirm')}
                onRetakePhoto={() => setCurrentStep('camera')}
                onEditFuel={() => setCurrentStep('fuel')}
                onEditCharacteristic={() => setCurrentStep('characteristic')}
                onEditLocation={() => setCurrentStep('location')}
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
            onStartNewRegistration={handleStartRegistration}
            onOpenHistoryTab={(sector) => setActiveTab('history')}
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
