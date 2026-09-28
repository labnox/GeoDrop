import React, { useState } from 'react';
import { usePWAInstall } from './usePWAInstall';
import { Download, Smartphone, X } from 'lucide-react';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  // If already running as an installed PWA, hide
  if (isInstalled) {
    return null;
  }

  // Chromium / Android native prompt flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className={`flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-md transition-all active:scale-95 ${
          compact ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm'
        }`}
        aria-label="Installeer GeoDrop op je telefoon"
        title="Installeer GeoDrop als app"
      >
        <Smartphone className="w-4 h-4 text-emerald-100" />
        <span>App Installeren</span>
      </button>
    );
  }

  // Fallback for Android/iOS browsers when beforeinstallprompt is not currently active
  return (
    <>
      <button
        onClick={() => setShowGuide(true)}
        className={`flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all ${
          compact ? 'px-2 py-1.5 text-xs' : 'px-3 py-1.5 text-xs'
        }`}
        aria-label="Hoe installeer je GeoDrop op je telefoon?"
        title="Installeren op Android of iPhone"
      >
        <Download className="w-3.5 h-3.5 text-cyan-400" />
        <span className="hidden sm:inline">Installeren</span>
      </button>

      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-700 p-6 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <Smartphone className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold">GeoDrop installeren</h3>
              </div>
              <button
                onClick={() => setShowGuide(false)}
                className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800"
                aria-label="Venster sluiten"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm text-slate-300">
              {isIOS ? (
                <div className="space-y-2">
                  <p className="font-semibold text-white">Safari op iPhone / iPad:</p>
                  <ol className="list-decimal list-inside space-y-1.5 pl-1 text-xs leading-relaxed text-slate-300">
                    <li>Tik op de <strong className="text-cyan-400">Deel</strong>-knop (vierkant met pijl omhoog).</li>
                    <li>Scroll naar beneden en tik op <strong className="text-cyan-400">Zet op beginscherm</strong>.</li>
                    <li>Tik rechtsboven op <strong className="text-cyan-400">Voeg toe</strong>.</li>
                  </ol>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="font-semibold text-white">Chrome of browser op Android:</p>
                  <ol className="list-decimal list-inside space-y-1.5 pl-1 text-xs leading-relaxed text-slate-300">
                    <li>Tik op de <strong className="text-cyan-400">drie puntjes (⋮)</strong> rechtsboven in de browser.</li>
                    <li>Kies <strong className="text-cyan-400">App installeren</strong> of <strong className="text-cyan-400">Toevoegen aan startscherm</strong>.</li>
                    <li>Bevestig met <strong className="text-cyan-400">Installeren</strong>.</li>
                  </ol>
                  <p className="text-xs text-slate-400 pt-1">
                    GeoDrop opent daarna als volwaardige fullscreen app met automatische spraak- en audiobakens.
                  </p>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowGuide(false)}
              className="mt-6 w-full rounded-xl bg-cyan-600 hover:bg-cyan-500 py-3 text-sm font-bold text-white transition-colors shadow-lg shadow-cyan-950/40"
            >
              Begrepen
            </button>
          </div>
        </div>
      )}
    </>
  );
};
