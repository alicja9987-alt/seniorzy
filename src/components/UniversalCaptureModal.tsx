import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, X, Sparkles, Image as ImageIcon, ArrowUpRight, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { AnyBrainItem, GraphEdge, TemporalFact } from '../types';

interface UniversalCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (result: {
    summary: string;
    items: AnyBrainItem[];
    temporalFacts: TemporalFact[];
    edges: GraphEdge[];
  }) => void;
  onAddToInbox?: () => void;
}

export const UniversalCaptureModal: React.FC<UniversalCaptureModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onAddToInbox,
}) => {
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [extractionPreview, setExtractionPreview] = useState<{
    summary: string;
    items: AnyBrainItem[];
    temporalFacts: TemporalFact[];
    edges: GraphEdge[];
  } | null>(null);

  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => textareaRef.current?.focus(), 100);
      setExtractionPreview(null);
      setErrorMsg(null);
    } else {
      stopRecording();
    }
  }, [isOpen]);

  // Web Speech API / MediaRecorder setup
  const startRecording = async () => {
    setErrorMsg(null);
    try {
      // 1. Try SpeechRecognition for live text stream
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.lang = 'pl-PL';
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onresult = (event: any) => {
          let interimTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              setText((prev) => (prev ? prev + ' ' : '') + event.results[i][0].transcript);
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }
        };

        recognition.onerror = (e: any) => {
          console.warn('SpeechRecognition error:', e);
        };

        recognition.start();
        recognitionRef.current = recognition;
      }

      // 2. Audio recording via MediaRecorder to support backend Gemini transcription
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        audioChunksRef.current = [];

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };

        recorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64data = (reader.result as string).split(',')[1];
            setAudioBase64(base64data);
          };
          reader.readAsDataURL(audioBlob);
          // Stop stream tracks
          stream.getTracks().forEach((track) => track.stop());
        };

        recorder.start();
        mediaRecorderRef.current = recorder;
      }

      setIsRecording(true);
    } catch (err: any) {
      console.warn('Mic access error:', err);
      setErrorMsg('Nie udało się uzyskać dostępu do mikrofonu. Możesz wpisać tekst ręcznie.');
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
      mediaRecorderRef.current = null;
    }
    setIsRecording(false);
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
      // If user dictated text, automatically submit immediately!
      if (text.trim()) {
        setTimeout(() => handleSubmit(), 80);
      }
    } else {
      startRecording();
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const [autoSaveOnVoice, setAutoSaveOnVoice] = useState(true);

  const handleSubmit = async (overrideText?: string) => {
    const textToSubmit = (overrideText || text).trim();
    if (!textToSubmit && !audioBase64) {
      setErrorMsg('Podaj treść lub powiedz coś do mikrofonu.');
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);
    const startTimestamp = performance.now();

    try {
      // Fast path: if text is present, NEVER send raw audioBase64 to save upload bandwidth and avoid server transcribe delay!
      const res = await fetch('/api/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textToSubmit,
          audioBase64: textToSubmit ? null : audioBase64,
          imageBase64: photoBase64,
        }),
      });

      const elapsed = Number(((performance.now() - startTimestamp) / 1000).toFixed(2));
      setExecutionTime(elapsed);

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Nie udało się przetworzyć wypowiedzi.');
      }

      if (data.mode === 'zatwierdzanie') {
        if (onAddToInbox) onAddToInbox();
        onClose();
        return;
      }

      const previewData = {
        summary: data.summary || 'Zapisano pomyślnie.',
        items: data.created_items || [],
        temporalFacts: data.temporal_facts || [],
        edges: data.edges || [],
      };

      setExtractionPreview(previewData);
      onSuccess(previewData);

      // Fast auto-close after celebration
      setTimeout(() => {
        setText('');
        setAudioBase64(null);
        setPhotoBase64(null);
        setExecutionTime(null);
        onClose();
      }, 950);
    } catch (err: any) {
      setErrorMsg(err.message || 'Wystąpił błąd podczas analizy.');
    } finally {
      setIsProcessing(false);
    }
  };

  const samplePrompts = [
    'Warto ogarnąć drukarkę w najbliższym czasie, żeby robić tatuaże, a drukarka jest niezbędna do tych tatuaży',
    'Wczoraj byłam z Kasią na kawie. Ma urodziny 11 kwietnia. Powiedziała, że uwielbia tulipany. Wpadłyśmy na pomysł stworzenia marki biżuterii. Jutro muszę jej wysłać inspiracje.',
    'W piątek o 15 idę do dentysty, a wcześniej muszę odebrać paczkę z paczkomatu.',
    'Teraz zdecydowanie bardziej podoba mi się błękit niż różowy.',
    'Pomysł: minimalistyczna seria biżuterii z surowego srebra i sesja w opuszczonej szklarni.',
  ];

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="capture-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs transition-opacity"
    >
      <div className="relative w-full max-w-2xl bg-[#F7F6F2] rounded-2xl shadow-2xl border border-[#E9E8E5] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E9E8E5] bg-white/70">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#8C7CF0]" />
            <h2 id="capture-title" className="text-lg font-serif-editorial font-medium text-[#202020]">
              Universal Capture — Powiedz raz. Zapamiętaj na zawsze.
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Zamknij okno przechwytywania"
            className="p-1.5 text-[#707070] hover:text-[#202020] hover:bg-[#E9E8E5] rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {/* Quick Speed & Feature indicator */}
          <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-[#D9D0FF]/30 border border-[#8C7CF0]/20 text-[11px] text-[#404040]">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="font-medium text-[#202020]">Silnik błyskawicznego zapisu (sub-second AI capture)</span>
            </div>
            <span className="text-[#606060]">Głos / Tekst → Automatyczne relacje w mózgu</span>
          </div>

          {/* Audio recording status banner */}
          {isRecording && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-[#D9D0FF]/40 border border-[#8C7CF0]/40">
              <div className="flex items-center gap-2 text-sm text-[#202020] font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                <Mic className="w-4 h-4 text-[#8C7CF0]" />
                <span>Słucham... transkrypcja na żywo:</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    stopRecording();
                    handleSubmit();
                  }}
                  className="text-xs px-3 py-1.5 rounded-lg bg-[#8C7CF0] text-white font-semibold cursor-pointer shadow-xs hover:bg-[#7a68e8] transition-colors"
                >
                  ⚡ Zakończ i Zapisz od razu
                </button>
                <button
                  onClick={stopRecording}
                  className="text-xs px-2.5 py-1.5 rounded-lg bg-white border border-[#E9E8E5] text-[#404040] hover:text-[#202020] cursor-pointer"
                >
                  Tylko zatrzymaj
                </button>
              </div>
            </div>
          )}

          {/* Text Input area */}
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Np. Warto ogarnąć drukarkę w najbliższym czasie, żeby robić tatuaże... lub naciśnij 'Mów teraz'"
              rows={4}
              className="w-full p-4 rounded-xl bg-white border border-[#E9E8E5] text-[#202020] placeholder-[#A09E97] focus:outline-hidden focus:border-[#8C7CF0] focus:ring-1 focus:ring-[#8C7CF0] text-sm leading-relaxed resize-none transition-all shadow-inner/10"
            />

            {/* Photo preview pill if attached */}
            {photoBase64 && (
              <div className="mt-2 flex items-center gap-2 p-2 bg-white rounded-lg border border-[#E9E8E5] text-xs">
                <img
                  src={photoBase64}
                  alt="Załączone zdjęcie"
                  className="w-10 h-10 object-cover rounded-md"
                />
                <span className="text-[#505050] flex-1 truncate">Załączono zdjęcie do powiązania</span>
                <button
                  onClick={() => setPhotoBase64(null)}
                  className="text-[#707070] hover:text-[#202020] p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Prompt chips */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-[#707070] font-medium">
                Przykłady naturalnych wypowiedzi (kliknij, aby przetestować):
              </span>
              <span className="text-[10px] text-[#8C7CF0] font-semibold">1-kliknięcie</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {samplePrompts.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setText(p);
                    handleSubmit(p);
                  }}
                  title="Kliknij, aby natychmiast sprawdzić analizę i połączenia"
                  className="text-left text-xs px-2.5 py-1.5 rounded-lg bg-white border border-[#E9E8E5] hover:border-[#8C7CF0] hover:bg-[#D9D0FF]/20 text-[#404040] hover:text-[#202020] transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Sparkles className="w-3 h-3 text-[#8C7CF0] shrink-0" />
                  <span>„{p.slice(0, 50)}...”</span>
                </button>
              ))}
            </div>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Extraction Result Summary */}
          {extractionPreview && (
            <div className="p-4 rounded-xl bg-[#D9D0FF]/25 border border-[#8C7CF0]/40 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#202020]">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{extractionPreview.summary}</span>
                </div>
                {executionTime !== null && (
                  <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                    ⚡ Błyskawicznie: {executionTime}s
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {extractionPreview.items.map((item, idx) => (
                  <div key={idx} className="p-2.5 bg-white rounded-lg border border-[#E9E8E5] shadow-2xs">
                    <div className="flex items-center justify-between text-[#8C7CF0] font-medium mb-1">
                      <span className="uppercase tracking-wider text-[10px]">{item.type}</span>
                      {item.target_date && <span className="text-[10px] text-[#707070]">{item.target_date}</span>}
                    </div>
                    <p className="font-semibold text-[#202020] truncate">{item.title}</p>
                    <p className="text-[#606060] text-[11px] line-clamp-2 mt-0.5">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Action Footer */}
        <div className="px-6 py-4 bg-white/80 border-t border-[#E9E8E5] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {/* Microphone Button */}
            <button
              onClick={toggleRecording}
              aria-label={isRecording ? 'Zatrzymaj nagrywanie' : 'Rozpocznij nagrywanie głosu'}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                isRecording
                  ? 'bg-rose-500 text-white animate-pulse'
                  : 'bg-[#E9E8E5] hover:bg-[#D9D0FF] text-[#202020]'
              }`}
            >
              {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-[#8C7CF0]" />}
              <span>{isRecording ? 'Zatrzymaj' : 'Mów teraz'}</span>
            </button>

            {/* Photo Attach Button */}
            <label
              htmlFor="photo-upload"
              title="Dołącz zdjęcie lub zrzut ekranu"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#E9E8E5] hover:bg-[#E0DDD5] text-[#404040] text-xs font-medium cursor-pointer transition-colors"
            >
              <ImageIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Zdjęcie</span>
              <input
                id="photo-upload"
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </label>
          </div>

          {/* Submit Button */}
          <button
            onClick={() => handleSubmit()}
            disabled={isProcessing || (!text.trim() && !audioBase64)}
            aria-label="Przetwórz i połącz w splot"
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              isProcessing || (!text.trim() && !audioBase64)
                ? 'bg-[#E9E8E5] text-[#909090] cursor-not-allowed'
                : 'bg-[#202020] hover:bg-[#8C7CF0] text-white shadow-xs active:scale-95'
            }`}
          >
            {isProcessing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-[#D9D0FF]" />
                <span>Analizuję i łączę w pamięci...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-[#D9D0FF]" />
                <span>Zapisz w mózgu</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
