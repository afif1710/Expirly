import { useEffect, useRef, useState } from 'react';
import { X, Camera, AlertCircle, Loader2 } from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

interface BarcodeScannerProps {
  onDetected: (barcode: string) => void;
  onClose: () => void;
}

const SCANNER_ID = 'expirly-barcode-scanner';

const SCAN_FORMATS = [
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.QR_CODE,
];

export function BarcodeScanner({ onDetected, onClose }: BarcodeScannerProps) {
  const [status, setStatus] = useState<'starting' | 'scanning' | 'error'>('starting');
  const [errorMsg, setErrorMsg] = useState('');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const detectedRef = useRef(false);
  const stoppedRef = useRef(false);

  useEffect(() => {
    // Prevent body scroll while scanner is open
    document.body.style.overflow = 'hidden';

    const scanner = new Html5Qrcode(SCANNER_ID);
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 280, height: 110 },
          formatsToSupport: SCAN_FORMATS,
        },
        (decodedText) => {
          if (!detectedRef.current && !stoppedRef.current) {
            detectedRef.current = true;
            scanner.stop().catch(() => {}).finally(() => {
              onDetected(decodedText);
            });
          }
        },
        () => {
          // Per-frame scan errors are expected — ignore them
        }
      )
      .then(() => {
        if (!stoppedRef.current) setStatus('scanning');
      })
      .catch((err: unknown) => {
        if (!stoppedRef.current) {
          setStatus('error');
          const msg = String(err);
          if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('notallowed')) {
            setErrorMsg('Camera access was denied. Please allow camera access and try again.');
          } else if (msg.toLowerCase().includes('notfound') || msg.toLowerCase().includes('device')) {
            setErrorMsg('No camera found on this device.');
          } else {
            setErrorMsg('Could not start the camera. Please enter the barcode manually.');
          }
        }
      });

    return () => {
      stoppedRef.current = true;
      document.body.style.overflow = '';
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'rgba(0,0,0,0.96)' }}
      data-testid="barcode-scanner-overlay"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 flex-shrink-0">
        <div className="flex items-center gap-2 text-white">
          <Camera size={20} />
          <span className="font-semibold text-[15px]">Scan Barcode</span>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-full bg-white/20 text-white hover:bg-white/30 active:scale-95 transition-all"
          data-testid="close-scanner-btn"
          aria-label="Close scanner"
        >
          <X size={20} />
        </button>
      </div>

      {/* Scanner area */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        {status === 'error' ? (
          <div className="text-center space-y-4 max-w-xs">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/20 flex items-center justify-center mx-auto">
              <AlertCircle size={28} className="text-amber-400" />
            </div>
            <p className="text-white/80 text-sm leading-relaxed">{errorMsg}</p>
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl bg-white/20 text-white text-sm font-medium hover:bg-white/30 transition-colors"
              data-testid="scanner-use-manual-btn"
            >
              Enter Manually
            </button>
          </div>
        ) : (
          <>
            <div className="w-full max-w-sm">
              {/* html5-qrcode mounts the camera feed inside this div */}
              <div
                id={SCANNER_ID}
                className="rounded-2xl overflow-hidden w-full"
                style={{ position: 'relative' }}
              />
            </div>

            {status === 'starting' && (
              <div className="flex items-center gap-2 text-white/70 text-sm mt-6">
                <Loader2 size={16} className="animate-spin" />
                <span>Starting camera…</span>
              </div>
            )}
            {status === 'scanning' && (
              <p className="text-white/60 text-xs mt-4 text-center">
                Point the camera at the barcode on the product packaging
              </p>
            )}
          </>
        )}
      </div>

      {/* Footer fallback button */}
      <div className="px-4 pb-6 flex-shrink-0">
        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-white/10 text-white/70 text-sm font-medium hover:bg-white/20 transition-colors"
          data-testid="scanner-cancel-btn"
        >
          Cancel — enter barcode manually
        </button>
      </div>
    </div>
  );
}
