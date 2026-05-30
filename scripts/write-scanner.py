content = '''\
"use client";
import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType, NotFoundException } from "@zxing/library";

interface Props {
  onDetected: (code: string) => void;
  onClose: () => void;
}

const HINTS = new Map([
  [DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.EAN_13, BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A, BarcodeFormat.UPC_E,
    BarcodeFormat.CODE_128, BarcodeFormat.CODE_39,
    BarcodeFormat.QR_CODE,
  ]],
  [DecodeHintType.TRY_HARDER, true],
]) as Map<DecodeHintType, unknown>;

export default function BarcodeScannerModal({ onDetected, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState("Starting camera\u2026");
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");

  useEffect(() => {
    let active = true;
    let stream: MediaStream | null = null;
    const reader = new BrowserMultiFormatReader(HINTS, { delayBetweenScanAttempts: 100 });

    async function start() {
      try {
        // Request high-res stream for better barcode readability on shiny/curved packaging
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });

        if (!videoRef.current || !active) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setStatus("Aim at barcode\u2026");

        await reader.decodeFromStream(stream, videoRef.current, (result, err) => {
          if (!active) return;
          if (result) {
            active = false;
            onDetected(result.getText());
          } else if (err && !(err instanceof NotFoundException)) {
            console.warn("ZXing:", err);
          }
        });
      } catch (e: unknown) {
        if (active) {
          const msg = e instanceof Error ? e.message : String(e);
          setError(
            msg.includes("Permission") || msg.includes("denied") || msg.includes("NotAllowed")
              ? "Camera access denied. Click the lock icon in Chrome\'s address bar to allow it."
              : msg
          );
        }
      }
    }

    start();

    return () => {
      active = false;
      BrowserMultiFormatReader.releaseAllStreams();
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
  }, [onDetected]);

  function submitManual(e: React.FormEvent) {
    e.preventDefault();
    if (manual.trim()) onDetected(manual.trim());
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-5 w-full max-w-sm mx-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-gray-900">Scan Barcode</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl font-bold leading-none">&times;</button>
        </div>

        {error ? (
          <div>
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 mb-4">{error}</p>
            <p className="text-xs text-gray-500 mb-3">Type the barcode number manually:</p>
            <form onSubmit={submitManual} className="flex gap-2">
              <input autoFocus value={manual} onChange={e => setManual(e.target.value)}
                placeholder="e.g. 8901491001045"
                className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              <button type="submit"
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700">
                Look up
              </button>
            </form>
          </div>
        ) : (
          <div>
            <div className="relative bg-black rounded-lg overflow-hidden mb-2" style={{ aspectRatio: "4/3" }}>
              <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-64 h-24 border-2 border-indigo-400 rounded opacity-90" />
              </div>
            </div>
            <p className="text-xs text-center text-indigo-600 font-medium mb-1">{status}</p>
            <p className="text-xs text-center text-gray-400 mb-3">Align barcode inside the box \u2014 hold steady</p>
            <div className="border-t pt-3">
              <p className="text-xs text-gray-500 mb-2">Or enter barcode manually:</p>
              <form onSubmit={submitManual} className="flex gap-2">
                <input value={manual} onChange={e => setManual(e.target.value)}
                  placeholder="e.g. 8901491001045"
                  className="flex-1 border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                <button type="submit"
                  className="bg-indigo-600 text-white px-3 py-2 rounded-lg text-xs font-semibold hover:bg-indigo-700">
                  Go
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
'''

with open(r'C:\Users\anand\erp\apps\gateway\src\components\BarcodeScannerModal.tsx', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)

print('Written', len(content.splitlines()), 'lines')
