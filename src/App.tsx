import React, { useState, useEffect } from 'react';
import { FuelLevel, LocationCode, Step, VehicleCharacteristic, VehicleRecord } from './types';
import { performLocalOcr } from './utils/ocrService';
import { generateRecordDescription, sanitizeRawText } from './utils/plateNormalizer';

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

export default function App() {
  // Navigation & Step State
  const [currentStep, setCurrentStep] = useState<Step>('home');

  // Form State
  const [photoDataUrl, setPhotoDataUrl] = useState<string>('');
  const [plate, setPlate] = useState<string>('');
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

  // History session persistence in local state
  const [historyRecords, setHistoryRecords] = useState<VehicleRecord[]>(() => {
    try {
      const saved = sessionStorage.getItem('cmdit_records_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Sync history to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem('cmdit_records_history', JSON.stringify(historyRecords));
    } catch (e) {
      console.warn('History storage sync error:', e);
    }
  }, [historyRecords]);

  // Reset entire flow
  const handleReset = () => {
    setPhotoDataUrl('');
    setPlate('');
    setRawOcrText('');
    setFuel(null);
    setCharacteristic(null);
    setLocation(null);
    setIsOcrLoading(false);
    setCurrentStep('home');
  };

  // Start new registration
  const handleStartRegistration = () => {
    setCurrentStep('camera');
  };

  // When photo is captured from camera or file
  const handlePhotoCaptured = async (dataUrl: string) => {
    setPhotoDataUrl(dataUrl);
    setCurrentStep('plate_confirm');
    setIsOcrLoading(true);
    setOcrProgressMsg('Lendo placa no dispositivo...');

    try {
      const ocrResult = await performLocalOcr(dataUrl, (msg) => {
        setOcrProgressMsg(msg);
      });

      if (ocrResult.success && ocrResult.plate) {
        setPlate(ocrResult.plate);
        setRawOcrText(ocrResult.rawText);
      } else if (ocrResult.plate) {
        setPlate(ocrResult.plate);
        setRawOcrText(ocrResult.rawText);
      }
    } catch (err) {
      console.warn('OCR error:', err);
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

  // Save completed record to history
  const handleSaveToHistory = (recordData: {
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
      ...recordData,
    };

    setHistoryRecords((prev) => [newRecord, ...prev.slice(0, 19)]); // Keep last 20 in session
  };

  const handleDeleteHistoryRecord = (id: string) => {
    setHistoryRecords((prev) => prev.filter((r) => r.id !== id));
  };

  const handleClearHistory = () => {
    setHistoryRecords([]);
    sessionStorage.removeItem('cmdit_records_history');
  };

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900 flex flex-col font-sans antialiased selection:bg-emerald-200">
      {/* App Header */}
      <Header
        currentStep={currentStep}
        onReset={handleReset}
        onOpenTests={() => setIsTestsModalOpen(true)}
        onOpenHistory={() => setIsHistoryModalOpen(true)}
        historyCount={historyRecords.length}
      />

      {/* Main Container */}
      <main className="flex-1 w-full max-w-lg mx-auto p-4 flex flex-col justify-start">
        {currentStep === 'home' && (
          <HomeScreen
            onStartRegistration={handleStartRegistration}
            onOpenTests={() => setIsTestsModalOpen(true)}
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
            isOcrLoading={isOcrLoading}
            ocrProgressMsg={ocrProgressMsg}
            onConfirmPlate={handleConfirmPlate}
            onRetakePhoto={() => setCurrentStep('camera')}
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
      </main>

      {/* Test & Diagnostics Modal */}
      <TestDiagnosticsModal
        isOpen={isTestsModalOpen}
        onClose={() => setIsTestsModalOpen(false)}
      />

      {/* History Modal */}
      <HistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        records={historyRecords}
        onClearHistory={handleClearHistory}
        onDeleteRecord={handleDeleteHistoryRecord}
      />
    </div>
  );
}
