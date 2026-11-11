import React, { useState } from 'react';
import { Sun, CheckCircle2, Circle, Clock, Sparkles, ArrowRight, Calendar, Heart, Lightbulb, UserCheck, Flame } from 'lucide-react';
import { AnyBrainItem, TaskItem } from '../types';

interface TodayViewProps {
  items: AnyBrainItem[];
  onToggleTask: (taskId: string) => void;
  onOpenCapture: (initialText?: string) => void;
  onSelectTab: (tab: any) => void;
}

export const TodayView: React.FC<TodayViewProps> = ({
  items,
  onToggleTask,
  onOpenCapture,
  onSelectTab,
}) => {
  const [quickInput, setQuickInput] = useState('');
  const [showAiFocusModal, setShowAiFocusModal] = useState(false);

  // Polish date formatting
  const todayFormatted = new Intl.DateTimeFormat('pl-PL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  const tasks = items.filter((i) => i.type === 'zadania') as (TaskItem & { type: 'zadania' })[];
  const pendingTasks = tasks.filter((t) => !t.is_completed);
  const completedTasks = tasks.filter((t) => t.is_completed);
  const events = items.filter((i) => i.type === 'kalendarz');
  const memories = items.filter((i) => i.type === 'wspomnienia');
  const ideas = items.filter((i) => i.type === 'pomysly');
  const people = items.filter((i) => i.type === 'ludzie');
  const goals = items.filter((i) => i.type === 'o_mnie');

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickInput.trim()) return;
    onOpenCapture(quickInput);
    setQuickInput('');
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-fadeIn">
      {/* Editorial Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2 border-b border-[#E9E8E5]">
        <div>
          <span className="text-xs uppercase tracking-widest text-[#8C7CF0] font-semibold">
            {todayFormatted}
          </span>
          <h2 className="text-2xl sm:text-3xl font-serif-editorial font-normal text-[#202020] mt-1">
            Dzień dobry. Twój umysł jest spokojny.
          </h2>
          <p className="text-xs sm:text-sm text-[#707070] mt-0.5">
            Wszystko, co ważne, jest zapisane, połączone i czeka w odpowiednim momencie.
          </p>
        </div>

        {/* AI Focus Button */}
        <button
          onClick={() => setShowAiFocusModal(true)}
          aria-label="Zapytaj na czym dzisiaj najlepiej się skupić"
          className="self-start md:self-auto flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-[#8C7CF0]/40 text-[#202020] hover:bg-[#D9D0FF]/30 transition-colors text-xs font-semibold shadow-2xs cursor-pointer"
        >
          <Sparkles className="w-4 h-4 text-[#8C7CF0]" />
          <span>Na czym dziś się skupić?</span>
        </button>
      </div>

      {/* Quick Capture Bar */}
      <form onSubmit={handleQuickSubmit} className="relative">
        <input
          type="text"
          value={quickInput}
          onChange={(e) => setQuickInput(e.target.value)}
          placeholder="O czym chcesz teraz pamiętać? (np. Kasia ma urodziny 11 kwietnia...)"
          className="w-full px-5 py-3.5 pr-28 rounded-2xl bg-white border border-[#E9E8E5] text-sm text-[#202020] placeholder-[#A09E97] shadow-xs focus:outline-hidden focus:border-[#8C7CF0] transition-all"
        />
        <button
          type="submit"
          disabled={!quickInput.trim()}
          className={`absolute right-2 top-2 bottom-2 px-4 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
            quickInput.trim()
              ? 'bg-[#202020] hover:bg-[#8C7CF0] text-white'
              : 'bg-[#E9E8E5] text-[#909090] cursor-not-allowed'
          }`}
        >
          <span>Zapisz</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </form>

      {/* Morning Brief Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Today's Agenda & Events */}
        <div className="bg-white p-5 rounded-2xl border border-[#E9E8E5] shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#707070]">
              <Calendar className="w-4 h-4 text-[#8C7CF0]" />
              <span>Kalendarz i daty</span>
            </div>
            <button
              onClick={() => onSelectTab('kalendarz')}
              className="text-xs text-[#8C7CF0] hover:underline"
            >
              Wszystkie ({events.length})
            </button>
          </div>

          <div className="space-y-2.5">
            {events.slice(0, 3).map((event) => (
              <div
                key={event.id}
                className="p-3 rounded-xl bg-[#F7F6F2] border border-[#E9E8E5] hover:border-[#8C7CF0]/40 transition-colors"
              >
                <div className="flex items-center justify-between text-[11px] text-[#707070]">
                  <span className="font-medium text-[#8C7CF0]">
                    {(event as any).is_annual_recurring ? 'Coroczne wydarzenie' : (event as any).start_time || 'Cały dzień'}
                  </span>
                  <span>{event.target_date || 'Niebawem'}</span>
                </div>
                <h4 className="text-sm font-semibold text-[#202020] mt-0.5">{event.title}</h4>
                <p className="text-xs text-[#606060] line-clamp-1 mt-0.5">{event.description}</p>
              </div>
            ))}
            {events.length === 0 && (
              <p className="text-xs text-[#909090] py-4 text-center">Brak zaplanowanych wydarzeń.</p>
            )}
          </div>
        </div>

        {/* Card 2: Priority Tasks */}
        <div className="bg-white p-5 rounded-2xl border border-[#E9E8E5] shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#707070]">
              <CheckCircle2 className="w-4 h-4 text-[#8C7CF0]" />
              <span>Zadania do zrobienia</span>
            </div>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[#D9D0FF]/50 text-[#202020]">
              {pendingTasks.length} oczekujące
            </span>
          </div>

          <div className="space-y-2">
            {pendingTasks.slice(0, 4).map((task) => (
              <div
                key={task.id}
                onClick={() => onToggleTask(task.id)}
                className="group flex items-start gap-2.5 p-2.5 rounded-xl hover:bg-[#F7F6F2] transition-colors cursor-pointer border border-transparent hover:border-[#E9E8E5]"
              >
                <button
                  type="button"
                  aria-label={`Oznacz jako ukończone: ${task.title}`}
                  className="mt-0.5 text-[#A09E97] group-hover:text-[#8C7CF0] transition-colors"
                >
                  <Circle className="w-4 h-4" />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[#202020] group-hover:text-[#8C7CF0] transition-colors truncate">
                    {task.title}
                  </p>
                  <div className="flex items-center gap-2 text-[10px] text-[#707070] mt-0.5">
                    {task.due_date && <span>Termin: {task.due_date}</span>}
                    <span
                      className={`px-1.5 py-0.2 rounded font-medium ${
                        task.priority === 'wysoki'
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-stone-100 text-[#505050]'
                      }`}
                    >
                      {task.priority}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {pendingTasks.length === 0 && (
              <div className="text-center py-4 text-xs text-emerald-600 font-medium">
                Wszystkie zadania ukończone!
              </div>
            )}
          </div>
        </div>

        {/* Card 3: People & Connections Pulse */}
        <div className="bg-white p-5 rounded-2xl border border-[#E9E8E5] shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#707070]">
              <Heart className="w-4 h-4 text-[#8C7CF0]" />
              <span>Relacje i bliscy</span>
            </div>
            <button
              onClick={() => onSelectTab('pamiec')}
              className="text-xs text-[#8C7CF0] hover:underline"
            >
              Zobacz ({people.length})
            </button>
          </div>

          <div className="space-y-2.5">
            {people.slice(0, 3).map((p) => {
              const person = p as any;
              return (
                <div
                  key={p.id}
                  className="p-3 rounded-xl bg-[#F7F6F2] border border-[#E9E8E5] space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#202020]">{person.name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white text-[#707070] border border-[#E9E8E5]">
                      {person.relationship || 'Znajomy'}
                    </span>
                  </div>
                  {person.preferences && person.preferences.length > 0 && (
                    <p className="text-[11px] text-[#606060]">
                      Lubi: <span className="text-[#202020] font-medium">{person.preferences.join(', ')}</span>
                    </p>
                  )}
                  {person.birthdate && (
                    <p className="text-[10px] text-[#8C7CF0]">Urodziny: {person.birthdate}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Second Row: Recent Memories & Incubating Ideas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Memories Highlights */}
        <div className="bg-white p-5 rounded-2xl border border-[#E9E8E5] shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#202020]">Ostatnie wspomnienia</h3>
            <button
              onClick={() => onSelectTab('pamiec')}
              className="text-xs text-[#8C7CF0] hover:underline"
            >
              Katalog
            </button>
          </div>
          <div className="space-y-3">
            {memories.slice(0, 2).map((m) => (
              <div
                key={m.id}
                className="p-3.5 rounded-xl bg-[#F7F6F2] border border-[#E9E8E5] hover:border-[#8C7CF0]/40 transition-colors"
              >
                <div className="flex items-center justify-between text-[11px] text-[#707070]">
                  <span>{m.target_date || m.recorded_at.slice(0, 10)}</span>
                  {(m as any).mood && (
                    <span className="px-2 py-0.5 rounded-md bg-[#D9D0FF]/40 text-[#202020] font-medium text-[10px]">
                      {(m as any).mood}
                    </span>
                  )}
                </div>
                <h4 className="text-sm font-semibold text-[#202020] mt-1">{m.title}</h4>
                <p className="text-xs text-[#505050] mt-1 leading-relaxed">{m.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Ideas Incubator */}
        <div className="bg-white p-5 rounded-2xl border border-[#E9E8E5] shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Lightbulb className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-semibold text-[#202020]">Inkubator pomysłów</h3>
            </div>
            <button
              onClick={() => onSelectTab('pamiec')}
              className="text-xs text-[#8C7CF0] hover:underline"
            >
              Wszystkie ({ideas.length})
            </button>
          </div>
          <div className="space-y-3">
            {ideas.slice(0, 2).map((idea) => {
              const item = idea as any;
              return (
                <div
                  key={idea.id}
                  className="p-3.5 rounded-xl bg-[#F7F6F2] border border-[#E9E8E5] space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-[#202020]">{idea.title}</h4>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium">
                      {item.stage || 'spontaniczny'}
                    </span>
                  </div>
                  <p className="text-xs text-[#505050]">{idea.description}</p>
                  {item.ai_expansion && (
                    <div className="p-2 rounded-lg bg-white border border-[#E9E8E5] text-[11px] text-[#606060]">
                      <span className="font-medium text-[#8C7CF0]">Rozwinięcie AI: </span>
                      {item.ai_expansion}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* AI Focus Recommendation Modal */}
      {showAiFocusModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
        >
          <div className="w-full max-w-lg bg-[#F7F6F2] rounded-2xl border border-[#E9E8E5] shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#8C7CF0]" />
                <h3 className="text-lg font-serif-editorial font-medium text-[#202020]">
                  Rekomendacja splot na dziś
                </h3>
              </div>
              <button
                onClick={() => setShowAiFocusModal(false)}
                className="text-[#707070] hover:text-[#202020] text-xs font-semibold px-2 py-1"
              >
                Zamknij
              </button>
            </div>

            <div className="p-4 bg-white rounded-xl border border-[#E9E8E5] space-y-3 text-xs sm:text-sm text-[#404040] leading-relaxed">
              <p className="font-medium text-[#202020]">
                Analizując Twoje zapisane cele i terminy, proponuję skupić się dziś na:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-[#505050]">
                <li>
                  <strong className="text-[#202020]">Wysłać Kasi inspiracje do biżuterii</strong> — to kluczowe działanie po wczorajszej burzy mózgów, aby utrzymać dynamikę pomysłu.
                </li>
                <li>
                  <strong className="text-[#202020]">Wizyta u dentysty</strong> — zaplanowana na piątek, warto sprawdzić dojazd i nie planować spotkań bezpośrednio po.
                </li>
                <li>
                  <strong className="text-[#202020]">Pielęgnowanie pasji</strong> — Twój cel warsztatów z ceramiki kołowej czeka na pierwszy krok (zapisanie się na weekendowy termin).
                </li>
              </ul>
              <p className="text-[11px] text-[#707070] pt-2 border-t border-[#E9E8E5]">
                Pamiętaj: splot podpowiada priorytety, ale to Ty decydujesz o tempie swojego dnia.
              </p>
            </div>

            <button
              onClick={() => setShowAiFocusModal(false)}
              className="w-full py-2.5 bg-[#202020] hover:bg-[#8C7CF0] text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              Dziękuję, wracam do działania
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
