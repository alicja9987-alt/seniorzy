import React from 'react';
import { RotateCcw, Sparkles, Shield, RefreshCw, Undo2 } from 'lucide-react';

interface HeaderProps {
  aiMode: 'automatyczny' | 'zatwierdzanie' | 'manualny';
  onSetAiMode: (mode: 'automatyczny' | 'zatwierdzanie' | 'manualny') => void;
  canUndo: boolean;
  onUndo: () => void;
  onResetData: () => void;
  hasApiKey: boolean;
  onOpenCapture: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  aiMode,
  onSetAiMode,
  canUndo,
  onUndo,
  onResetData,
  hasApiKey,
  onOpenCapture,
}) => {
  const [showPrivacyModal, setShowPrivacyModal] = React.useState(false);

  return (
    <header className="sticky top-0 z-30 bg-[#F7F6F2]/90 backdrop-blur-md border-b border-[#E9E8E5] px-4 sm:px-8 py-3.5 transition-all">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-baseline gap-2.5">
          <h1 className="text-2xl sm:text-3xl font-serif-editorial font-normal tracking-tight text-[#202020]">
            splot<span className="text-[#8C7CF0] font-semibold">.</span>
          </h1>
          <span className="hidden sm:inline-block text-xs uppercase tracking-widest text-[#707070] font-medium">
            osobisty drugi mózg
          </span>
        </div>

        {/* Center / Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick Capture Pill */}
          <button
            onClick={onOpenCapture}
            aria-label="Otwórz przechwytywanie myśli"
            className="hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#202020] text-[#F7F6F2] hover:bg-[#333333] transition-colors text-xs font-medium cursor-pointer shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#D9D0FF]" />
            <span>Powiedz lub wpisz...</span>
            <kbd className="ml-1 px-1.5 py-0.5 text-[10px] bg-white/20 rounded font-mono-code text-white/90">
              Ctrl+K
            </kbd>
          </button>

          {/* AI Mode Selector */}
          <div className="relative flex items-center bg-[#E9E8E5] p-0.5 rounded-lg text-xs">
            <button
              onClick={() => onSetAiMode('automatyczny')}
              aria-label="Tryb automatyczny"
              title="Tryb automatyczny: AI zapisuje informacje natychmiast"
              className={`px-2.5 py-1 rounded-md transition-all font-medium cursor-pointer ${
                aiMode === 'automatyczny'
                  ? 'bg-white text-[#202020] shadow-xs'
                  : 'text-[#707070] hover:text-[#202020]'
              }`}
            >
              Auto
            </button>
            <button
              onClick={() => onSetAiMode('zatwierdzanie')}
              aria-label="Tryb zatwierdzania"
              title="Tryb zatwierdzania: AI przygotowuje propozycje do akceptacji w Inbox"
              className={`px-2.5 py-1 rounded-md transition-all font-medium cursor-pointer ${
                aiMode === 'zatwierdzanie'
                  ? 'bg-white text-[#202020] shadow-xs'
                  : 'text-[#707070] hover:text-[#202020]'
              }`}
            >
              Zatwierdzanie
            </button>
          </div>

          {/* Undo Action */}
          {canUndo && (
            <button
              onClick={onUndo}
              aria-label="Cofnij ostatnią operację"
              title="Cofnij ostatnie zapisy AI"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#D9D0FF]/40 hover:bg-[#D9D0FF]/80 text-[#202020] border border-[#8C7CF0]/30 transition-colors text-xs font-medium cursor-pointer"
            >
              <Undo2 className="w-3.5 h-3.5 text-[#8C7CF0]" />
              <span className="hidden sm:inline">Cofnij</span>
            </button>
          )}

          {/* Privacy & Backup Modal Toggle */}
          <button
            onClick={() => setShowPrivacyModal(true)}
            aria-label="Prywatność i kopia zapasowa"
            title="Prywatność, eksport i kopia zapasowa danych"
            className="p-1.5 text-[#707070] hover:text-[#202020] hover:bg-[#E9E8E5] rounded-lg transition-colors cursor-pointer"
          >
            <Shield className="w-4 h-4 text-[#8C7CF0]" />
          </button>

          {/* Reset Demo Data */}
          <button
            onClick={onResetData}
            aria-label="Zresetuj przykładowe dane"
            title="Przywróć wzorcowe dane pamięci"
            className="p-1.5 text-[#707070] hover:text-[#202020] hover:bg-[#E9E8E5] rounded-lg transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Privacy and Backup Dialog */}
      {showPrivacyModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
        >
          <div className="w-full max-w-lg bg-[#F7F6F2] rounded-2xl border border-[#E9E8E5] shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#E9E8E5]">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-[#8C7CF0]" />
                <h3 className="text-base font-serif-editorial font-medium text-[#202020]">
                  Prywatność i suwerenność danych
                </h3>
              </div>
              <button
                onClick={() => setShowPrivacyModal(false)}
                className="text-[#707070] hover:text-[#202020] text-xs font-semibold px-2 py-1"
              >
                Zamknij
              </button>
            </div>

            <div className="space-y-3 text-xs leading-relaxed text-[#505050]">
              <div className="p-3 bg-white rounded-xl border border-[#E9E8E5] space-y-1">
                <span className="font-semibold text-[#202020] block">Prywatna przestrzeń:</span>
                <p>
                  Twoje wspomnienia, relacje i notatki są przechowywane wyłącznie w Twojej prywatnej bazie splot. Żadne dane nie są wykorzystywane do trenowania modeli publicznych ani udostępniane podmiotom trzecim.
                </p>
              </div>

              <div className="p-3 bg-white rounded-xl border border-[#E9E8E5] space-y-2">
                <span className="font-semibold text-[#202020] block">Kopia zapasowa i eksport (RODO):</span>
                <div className="flex gap-2">
                  <a
                    href="/api/backup/export"
                    download="splot-brain-backup.json"
                    className="flex-1 py-2 text-center rounded-lg bg-[#202020] hover:bg-[#8C7CF0] text-white text-xs font-semibold transition-colors"
                  >
                    Eksportuj do JSON
                  </a>
                  <label
                    htmlFor="import-backup-file"
                    className="flex-1 py-2 text-center rounded-lg bg-[#E9E8E5] hover:bg-[#D9D0FF] text-[#202020] text-xs font-semibold cursor-pointer transition-colors"
                  >
                    Importuj z JSON
                    <input
                      id="import-backup-file"
                      type="file"
                      accept=".json"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = async (evt) => {
                            try {
                              const json = JSON.parse(evt.target?.result as string);
                              const res = await fetch('/api/backup/import', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ data: json }),
                              });
                              if (res.ok) {
                                alert('Pomyślnie zaimportowano bazę splot.');
                                window.location.reload();
                              }
                            } catch (err) {
                              alert('Niepoprawny plik JSON.');
                            }
                          };
                          reader.readAsText(file);
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowPrivacyModal(false)}
              className="w-full py-2 bg-white border border-[#E9E8E5] text-[#202020] hover:bg-[#E9E8E5] text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              Zamknij
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
