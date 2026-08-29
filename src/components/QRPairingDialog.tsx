import React, { useState } from 'react';
import { QrCode, Camera, ShieldCheck, ArrowRight, CheckCircle2, Copy, X, Sparkles, ExternalLink, RefreshCw } from 'lucide-react';
import { QRCodeDisplay } from './QRCodeDisplay';
import { QRScannerModal } from './QRScannerModal';

interface QRPairingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  isConnected: boolean;
  connectionStatus: string;
  onCreateOffer: () => Promise<string>;
  onIngestOffer: (offerJson: string) => Promise<string>;
  onIngestAnswer: (answerJson: string) => Promise<void>;
  onOpenDualTab: () => void;
}

export const QRPairingDialog: React.FC<QRPairingDialogProps> = ({
  isOpen,
  onClose,
  clientId,
  isConnected,
  connectionStatus,
  onCreateOffer,
  onIngestOffer,
  onIngestAnswer,
  onOpenDualTab,
}) => {
  const [step, setStep] = useState<'SELECT' | 'HOST_OFFER' | 'GUEST_SCAN' | 'GUEST_ANSWER' | 'HOST_SCAN_ANSWER'>('SELECT');
  const [offerCode, setOfferCode] = useState<string>('');
  const [answerCode, setAnswerCode] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerMode, setScannerMode] = useState<'OFFER' | 'ANSWER'>('OFFER');

  if (!isOpen) return null;

  const handleStartHost = async () => {
    setIsGenerating(true);
    try {
      const offer = await onCreateOffer();
      setOfferCode(offer);
      setStep('HOST_OFFER');
    } catch (e) {
      console.error('Failed to create offer:', e);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStartGuestScan = () => {
    setScannerMode('OFFER');
    setScannerOpen(true);
  };

  const handleScanOfferSuccess = async (scannedOffer: string) => {
    setIsGenerating(true);
    try {
      const answer = await onIngestOffer(scannedOffer);
      setAnswerCode(answer);
      setStep('GUEST_ANSWER');
    } catch (e) {
      console.error('Failed to process offer:', e);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStartHostScanAnswer = () => {
    setScannerMode('ANSWER');
    setScannerOpen(true);
  };

  const handleScanAnswerSuccess = async (scannedAnswer: string) => {
    try {
      await onIngestAnswer(scannedAnswer);
      onClose();
    } catch (e) {
      console.error('Failed to ingest answer:', e);
    }
  };

  return (
    <div
      id="qr-pairing-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
    >
      <div
        id="qr-pairing-dialog"
        className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 text-slate-100 flex flex-col max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <span className="p-2 bg-blue-500/10 text-blue-400 rounded-xl">
              <QrCode size={22} />
            </span>
            <div>
              <h3 className="text-base font-bold">P2P QR Code Pairing</h3>
              <p className="text-xs text-slate-400">
                Direct WebRTC handshake • Zero server storage/upload • Client ID: <span className="font-mono text-blue-400">{clientId}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Status Alert */}
        {isConnected && (
          <div className="my-4 p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs text-emerald-400 font-semibold">
              <CheckCircle2 size={16} />
              <span>Clients Connected via WebRTC DataChannel!</span>
            </div>
            <span className="text-[10px] font-mono bg-emerald-900/50 px-2 py-0.5 rounded text-emerald-200">
              ACTIVE
            </span>
          </div>
        )}

        {/* STEP 1: INITIAL ROLE SELECTION */}
        {step === 'SELECT' && (
          <div className="py-4 space-y-4">
            <p className="text-xs text-slate-300 leading-relaxed">
              Connect 2 devices or browser tabs peer-to-peer using camera QR scan. No files or packets are ever uploaded to any server.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Option A: Host */}
              <button
                id="host-session-btn"
                onClick={handleStartHost}
                disabled={isGenerating}
                className="p-5 bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-blue-500/50 rounded-xl text-left transition-all group flex flex-col justify-between"
              >
                <div>
                  <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-lg w-fit mb-3 group-hover:scale-110 transition-transform">
                    <QrCode size={24} />
                  </div>
                  <h4 className="text-sm font-bold text-slate-100">Host (Show QR)</h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Generate an Offer QR code on this screen for another client to scan.
                  </p>
                </div>
                <div className="mt-4 flex items-center space-x-1 text-xs font-semibold text-blue-400">
                  <span>Start Hosting</span>
                  <ArrowRight size={14} />
                </div>
              </button>

              {/* Option B: Guest */}
              <button
                id="join-session-btn"
                onClick={handleStartGuestScan}
                className="p-5 bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-emerald-500/50 rounded-xl text-left transition-all group flex flex-col justify-between"
              >
                <div>
                  <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-lg w-fit mb-3 group-hover:scale-110 transition-transform">
                    <Camera size={24} />
                  </div>
                  <h4 className="text-sm font-bold text-slate-100">Join (Scan QR)</h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Open camera to scan the Host's QR code and establish direct link.
                  </p>
                </div>
                <div className="mt-4 flex items-center space-x-1 text-xs font-semibold text-emerald-400">
                  <span>Open Scanner</span>
                  <ArrowRight size={14} />
                </div>
              </button>
            </div>

            {/* Same-Machine Quick Test Helper */}
            <div className="mt-4 p-4 bg-slate-950 rounded-xl border border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-slate-300">
                <span className="font-semibold block text-slate-200">Testing on Single Device?</span>
                <span className="text-slate-400 text-[11px]">
                  Open in a second tab to test instant dual-client packet transmission.
                </span>
              </div>
              <button
                id="open-second-tab-btn"
                onClick={onOpenDualTab}
                className="flex items-center space-x-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors shrink-0"
              >
                <ExternalLink size={14} />
                <span>Open 2nd Peer Tab</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: HOST OFFER QR DISPLAY */}
        {step === 'HOST_OFFER' && (
          <div className="py-3 space-y-4">
            <QRCodeDisplay
              data={offerCode}
              title="Host Offer QR Code"
              subtitle="Scan this QR code using the Join camera on Client B"
              badge="Step 1 of 2: Host Offer"
            />

            <div className="flex items-center justify-between gap-2 pt-2">
              <button
                onClick={() => setStep('SELECT')}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
              >
                Back
              </button>
              <button
                id="host-scan-answer-btn"
                onClick={handleStartHostScanAnswer}
                className="flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-md transition-all"
              >
                <Camera size={15} />
                <span>Next: Scan Client B's Answer QR</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: GUEST ANSWER QR DISPLAY */}
        {step === 'GUEST_ANSWER' && (
          <div className="py-3 space-y-4">
            <QRCodeDisplay
              data={answerCode}
              title="Client B Answer QR Code"
              subtitle="Show this QR code to Client A (Host) camera to complete connection"
              badge="Step 2 of 2: Client B Answer"
            />

            <div className="flex justify-between items-center pt-2">
              <button
                onClick={() => setStep('SELECT')}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
              >
                Back
              </button>
              <p className="text-xs text-emerald-400 font-semibold">
                Connection will open automatically once Host scans!
              </p>
            </div>
          </div>
        )}

        {/* Zero Upload Security Guarantee Badge */}
        <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-center space-x-2 text-[11px] text-slate-400">
          <ShieldCheck size={14} className="text-emerald-400" />
          <span>Strict Zero-Upload Architecture: Direct browser-to-browser P2P transport.</span>
        </div>
      </div>

      {/* Camera Scanner Modal */}
      <QRScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanSuccess={(data) => {
          if (scannerMode === 'OFFER') {
            handleScanOfferSuccess(data);
          } else {
            handleScanAnswerSuccess(data);
          }
        }}
        expectedType={scannerMode}
        title={scannerMode === 'OFFER' ? 'Scan Host Offer QR' : 'Scan Client B Answer QR'}
      />
    </div>
  );
};
