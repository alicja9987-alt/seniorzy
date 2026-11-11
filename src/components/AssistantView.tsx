import React, { useState, useEffect, useRef } from 'react';
import { MessageSquareText, Film, Inbox as InboxIcon, Send, Sparkles, Play, Pause, RotateCcw, Check, X, ArrowRight, User, Calendar, History } from 'lucide-react';
import { AnyBrainItem, ChatMessage, InboxItem } from '../types';

interface AssistantViewProps {
  items: AnyBrainItem[];
  inbox: InboxItem[];
  onResolveInbox: (inboxId: string, action: string, payload?: any) => void;
  onOpenCapture: (text?: string) => void;
}

export const AssistantView: React.FC<AssistantViewProps> = ({
  items,
  inbox,
  onResolveInbox,
  onOpenCapture,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'chat' | 'rewind' | 'inbox'>('chat');

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg_welcome',
      role: 'assistant',
      content:
        'Cześć! Jestem Twoim asystentem splot. Pamiętam Twoje rozmowy, wspomnienia i osoby w Twoim życiu. O czym chciałabyś porozmawiać lub co chcesz odnaleźć?',
      timestamp: 'teraz',
      suggested_followups: [
        'Co Kasia mówiła o kwiatach?',
        'Kiedy ostatnio się widziałyśmy z Kasią?',
        'Jak zmieniały się moje preferencje?',
        'Co mam dzisiaj zrobić dla Kasi?',
      ],
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // Rewind State
  const [rewindMode, setRewindMode] = useState<'story' | 'cinematic'>('story');
  const [rewindData, setRewindData] = useState<{
    title: string;
    subtitle: string;
    chapters: {
      id: string;
      date: string;
      title: string;
      narrative: string;
      mood: string;
      associated_people?: string[];
    }[];
  } | null>(null);
  const [isRewindLoading, setIsRewindLoading] = useState(false);
  const [cinematicChapterIndex, setCinematicChapterIndex] = useState(0);
  const [isCinematicPlaying, setIsCinematicPlaying] = useState(false);

  useEffect(() => {
    chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  // Cinematic timer
  useEffect(() => {
    let timer: any;
    if (isCinematicPlaying && rewindData && rewindData.chapters.length > 0) {
      timer = setInterval(() => {
        setCinematicChapterIndex((prev) => {
          if (prev >= rewindData.chapters.length - 1) {
            setIsCinematicPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 4500);
    }
    return () => clearInterval(timer);
  }, [isCinematicPlaying, rewindData]);

  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = (customPrompt || inputText).trim();
    if (!textToSend || isLoading) return;

    const userMessage: ChatMessage = {
      id: `usr_${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: 'teraz',
    };

    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
    setInputText('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newHistory.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await res.json();
      const assistantMessage: ChatMessage = {
        id: `ast_${Date.now()}`,
        role: 'assistant',
        content: data.reply || 'Rozumiem. Odpowiedź została przetworzona.',
        timestamp: 'teraz',
        referenced_item_ids: data.referenced_item_ids || [],
        suggested_followups: data.suggested_followups || [],
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.error('Chat error:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: `ast_${Date.now()}`,
          role: 'assistant',
          content: 'Przepraszam, wystąpił chwilowy błąd połączenia z asystentem splot.',
          timestamp: 'teraz',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateRewind = async (topic: string = 'Wspomnienia z Kasią i ostatnie chwile') => {
    setIsRewindLoading(true);
    setCinematicChapterIndex(0);
    setIsCinematicPlaying(false);

    try {
      const res = await fetch('/api/rewind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: topic }),
      });
      const data = await res.json();
      setRewindData(data);
    } catch (e) {
      console.error('Rewind load error:', e);
    } finally {
      setIsRewindLoading(false);
    }
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Header and Sub-tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#E9E8E5]">
        <div>
          <h2 className="text-2xl font-serif-editorial font-normal text-[#202020]">
            Asystent, Life Rewind & Smart Inbox
          </h2>
          <p className="text-xs text-[#707070]">
            Rozmowa z pamięcią kontekstową, filmowe odtwarzanie chwil i kontrola niejednoznaczności.
          </p>
        </div>

        {/* Sub-tab switcher */}
        <div className="flex items-center bg-[#E9E8E5] p-0.5 rounded-lg text-xs">
          <button
            onClick={() => setActiveSubTab('chat')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer ${
              activeSubTab === 'chat'
                ? 'bg-white text-[#202020] shadow-2xs'
                : 'text-[#707070] hover:text-[#202020]'
            }`}
          >
            <MessageSquareText className="w-3.5 h-3.5 text-[#8C7CF0]" />
            <span>Asystent</span>
          </button>
          <button
            onClick={() => {
              setActiveSubTab('rewind');
              if (!rewindData) handleGenerateRewind();
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer ${
              activeSubTab === 'rewind'
                ? 'bg-white text-[#202020] shadow-2xs'
                : 'text-[#707070] hover:text-[#202020]'
            }`}
          >
            <Film className="w-3.5 h-3.5 text-[#8C7CF0]" />
            <span>Life Rewind</span>
          </button>
          <button
            onClick={() => setActiveSubTab('inbox')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer relative ${
              activeSubTab === 'inbox'
                ? 'bg-white text-[#202020] shadow-2xs'
                : 'text-[#707070] hover:text-[#202020]'
            }`}
          >
            <InboxIcon className="w-3.5 h-3.5 text-[#8C7CF0]" />
            <span>Inbox</span>
            {inbox.filter((i) => !i.resolved).length > 0 && (
              <span className="w-2 h-2 rounded-full bg-[#8C7CF0]" />
            )}
          </button>
        </div>
      </div>

      {/* View 1: Contextual Chat */}
      {activeSubTab === 'chat' && (
        <div className="bg-white rounded-2xl border border-[#E9E8E5] shadow-2xs flex flex-col h-[560px] overflow-hidden">
          {/* Messages list */}
          <div ref={chatScrollRef} className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4">
            {messages.map((msg) => {
              const isAssistant = msg.role === 'assistant';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isAssistant ? 'items-start' : 'items-end'}`}
                >
                  <div
                    className={`max-w-[85%] sm:max-w-[75%] p-4 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                      isAssistant
                        ? 'bg-[#F7F6F2] text-[#202020] border border-[#E9E8E5] rounded-tl-xs'
                        : 'bg-[#202020] text-white rounded-tr-xs'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>

                    {/* Referenced Items chips */}
                    {msg.referenced_item_ids && msg.referenced_item_ids.length > 0 && (
                      <div className="mt-2.5 pt-2 border-t border-[#E9E8E5]/60 space-y-1">
                        <span className="text-[10px] uppercase font-bold text-[#8C7CF0] block">
                          Powiązane rekordy w pamięci:
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {msg.referenced_item_ids.map((id) => {
                            const refItem = items.find((i) => i.id === id);
                            if (!refItem) return null;
                            return (
                              <span
                                key={id}
                                className="px-2 py-0.5 rounded-md bg-white text-[10px] text-[#202020] border border-[#E9E8E5] font-medium"
                              >
                                {refItem.type}: {refItem.title}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Suggested Followups */}
                  {isAssistant && msg.suggested_followups && msg.suggested_followups.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2 ml-1">
                      {msg.suggested_followups.map((sug, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSendMessage(sug)}
                          className="text-[11px] px-2.5 py-1 rounded-full bg-white border border-[#E9E8E5] hover:border-[#8C7CF0] text-[#505050] hover:text-[#202020] transition-colors cursor-pointer"
                        >
                          {sug}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {isLoading && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-[#F7F6F2] text-xs text-[#707070] w-fit">
                <Sparkles className="w-3.5 h-3.5 text-[#8C7CF0] animate-spin" />
                <span>Przeszukuję pamięć i historię splot...</span>
              </div>
            )}
          </div>

          {/* Chat input bar */}
          <div className="p-3 bg-[#F7F6F2]/80 border-t border-[#E9E8E5] flex items-center gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Zapytaj o osobę, przeszłość, spotkanie lub poleć: „przypomnij mi o...”"
              className="flex-1 px-4 py-2.5 rounded-xl bg-white border border-[#E9E8E5] text-xs text-[#202020] placeholder-[#A09E97] focus:outline-hidden focus:border-[#8C7CF0] shadow-2xs"
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={!inputText.trim() || isLoading}
              className={`p-2.5 rounded-xl transition-colors cursor-pointer ${
                inputText.trim() && !isLoading
                  ? 'bg-[#202020] hover:bg-[#8C7CF0] text-white'
                  : 'bg-[#E9E8E5] text-[#909090] cursor-not-allowed'
              }`}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* View 2: Life Rewind */}
      {activeSubTab === 'rewind' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white rounded-2xl border border-[#E9E8E5] shadow-2xs">
            <div>
              <h3 className="text-sm font-semibold text-[#202020] flex items-center gap-2">
                <Film className="w-4 h-4 text-[#8C7CF0]" />
                <span>Life Rewind — Filmowa opowieść z życia</span>
              </h3>
              <p className="text-xs text-[#707070] mt-0.5">
                Przekształca zapisane wspomnienia, spotkania i projekty w spójną narrację.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setRewindMode('story')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                  rewindMode === 'story'
                    ? 'bg-[#202020] text-white'
                    : 'bg-[#E9E8E5] text-[#505050]'
                }`}
              >
                Timeline Story
              </button>
              <button
                onClick={() => {
                  setRewindMode('cinematic');
                  setIsCinematicPlaying(true);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                  rewindMode === 'cinematic'
                    ? 'bg-[#8C7CF0] text-white'
                    : 'bg-[#E9E8E5] text-[#505050]'
                }`}
              >
                Cinematic Rewind
              </button>
              <button
                onClick={() => handleGenerateRewind('Wszystkie wspomnienia')}
                className="p-1.5 rounded-lg bg-white border border-[#E9E8E5] text-[#505050] hover:text-[#202020]"
                title="Przeładuj narrację"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {isRewindLoading ? (
            <div className="py-20 text-center text-xs text-[#707070] bg-white rounded-2xl border border-[#E9E8E5] space-y-2">
              <Sparkles className="w-6 h-6 text-[#8C7CF0] animate-spin mx-auto" />
              <p>Reżyseruję Twoją opowieść na podstawie rzeczywistych wpisów...</p>
            </div>
          ) : rewindData ? (
            rewindMode === 'story' ? (
              /* Timeline Story Mode */
              <div className="space-y-4">
                <div className="text-center py-4">
                  <h3 className="text-xl font-serif-editorial text-[#202020] font-normal">
                    {rewindData.title}
                  </h3>
                  <p className="text-xs text-[#707070] italic mt-0.5">{rewindData.subtitle}</p>
                </div>

                <div className="space-y-3">
                  {rewindData.chapters.map((ch, idx) => (
                    <div
                      key={ch.id || idx}
                      className="p-5 bg-white rounded-2xl border border-[#E9E8E5] shadow-2xs space-y-2 relative overflow-hidden"
                    >
                      <div className="flex items-center justify-between text-[11px] text-[#707070]">
                        <span className="font-semibold text-[#8C7CF0]">Rozdział {idx + 1}</span>
                        <span>{ch.date}</span>
                      </div>
                      <h4 className="text-base font-serif-editorial text-[#202020] font-medium">
                        {ch.title}
                      </h4>
                      <p className="text-xs text-[#404040] leading-relaxed">{ch.narrative}</p>
                      {ch.associated_people && ch.associated_people.length > 0 && (
                        <div className="pt-2 text-[11px] text-[#707070]">
                          Bohaterowie: <strong className="text-[#202020]">{ch.associated_people.join(', ')}</strong>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* Cinematic Rewind Mode */
              <div className="relative min-h-[380px] bg-[#1A1A1A] text-white rounded-2xl p-8 flex flex-col justify-between overflow-hidden shadow-xl">
                <div className="flex items-center justify-between text-xs text-white/60">
                  <span className="uppercase tracking-widest text-[#D9D0FF]">
                    {rewindData.title}
                  </span>
                  <span>
                    Rozdział {cinematicChapterIndex + 1} z {rewindData.chapters.length}
                  </span>
                </div>

                {rewindData.chapters[cinematicChapterIndex] && (
                  <div className="my-auto space-y-3 text-center max-w-xl mx-auto animate-fadeIn">
                    <span className="text-xs text-[#D9D0FF]/80 uppercase tracking-widest">
                      {rewindData.chapters[cinematicChapterIndex].date}
                    </span>
                    <h3 className="text-2xl sm:text-3xl font-serif-editorial text-white font-normal">
                      {rewindData.chapters[cinematicChapterIndex].title}
                    </h3>
                    <p className="text-sm sm:text-base text-white/80 leading-relaxed font-light">
                      „{rewindData.chapters[cinematicChapterIndex].narrative}”
                    </p>
                  </div>
                )}

                {/* Cinematic Player Controls */}
                <div className="flex items-center justify-center gap-4 pt-4 border-t border-white/10">
                  <button
                    onClick={() =>
                      setCinematicChapterIndex((p) => Math.max(0, p - 1))
                    }
                    className="p-2 text-white/70 hover:text-white"
                  >
                    Poprzedni
                  </button>
                  <button
                    onClick={() => setIsCinematicPlaying(!isCinematicPlaying)}
                    className="w-10 h-10 rounded-full bg-[#8C7CF0] text-white flex items-center justify-center hover:scale-105 transition-transform"
                  >
                    {isCinematicPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                  </button>
                  <button
                    onClick={() =>
                      setCinematicChapterIndex((p) =>
                        Math.min(rewindData.chapters.length - 1, p + 1)
                      )
                    }
                    className="p-2 text-white/70 hover:text-white"
                  >
                    Następny
                  </button>
                </div>
              </div>
            )
          ) : (
            <p className="text-xs text-center text-[#707070] py-12">Brak danych do wyświetlenia.</p>
          )}
        </div>
      )}

      {/* View 3: Smart Inbox */}
      {activeSubTab === 'inbox' && (
        <div className="space-y-4">
          <div className="p-4 bg-white rounded-2xl border border-[#E9E8E5] shadow-2xs space-y-1">
            <h3 className="text-sm font-semibold text-[#202020] flex items-center gap-2">
              <InboxIcon className="w-4 h-4 text-[#8C7CF0]" />
              <span>Smart Inbox — Wyjaśnianie i akceptacja AI</span>
            </h3>
            <p className="text-xs text-[#606060]">
              Tu trafiają kwestie wymagające doprecyzowania (np. gdy znasz dwie osoby o tym samym
              imieniu) lub wpisy w trybie Zatwierdzania.
            </p>
          </div>

          <div className="space-y-3">
            {inbox
              .filter((i) => !i.resolved)
              .map((item) => (
                <div
                  key={item.id}
                  className="p-4 bg-white rounded-xl border border-[#E9E8E5] shadow-2xs space-y-3"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#202020]">{item.title}</span>
                    <span className="text-[10px] text-[#707070]">
                      {item.type === 'ambiguity' ? 'Niejednoznaczność' : 'Wymaga akceptacji'}
                    </span>
                  </div>
                  <p className="text-xs text-[#505050]">{item.description}</p>
                  {item.source_input && (
                    <p className="text-[11px] text-[#808080] italic">
                      Źródło: „{item.source_input}”
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2 pt-1">
                    {(item.options || []).map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => onResolveInbox(item.id, opt.action, opt.payload)}
                        className="px-3 py-1.5 rounded-lg bg-[#202020] hover:bg-[#8C7CF0] text-white text-xs font-semibold transition-colors cursor-pointer"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

            {inbox.filter((i) => !i.resolved).length === 0 && (
              <div className="p-12 text-center text-xs text-[#707070] bg-white rounded-2xl border border-[#E9E8E5]">
                Wszystko jest jasne. Brak elementów wymagających decyzji w Smart Inbox.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
