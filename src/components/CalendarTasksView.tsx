import React, { useState } from 'react';
import { Calendar as CalendarIcon, CheckSquare, Clock, AlertTriangle, Plus, CheckCircle2, Circle, Repeat, MapPin, ExternalLink } from 'lucide-react';
import { AnyBrainItem, CalendarEventItem, TaskItem } from '../types';

interface CalendarTasksViewProps {
  items: AnyBrainItem[];
  onToggleTask: (taskId: string) => void;
  onDeleteItem: (id: string) => void;
  onOpenCapture: (text?: string) => void;
}

export const CalendarTasksView: React.FC<CalendarTasksViewProps> = ({
  items,
  onToggleTask,
  onDeleteItem,
  onOpenCapture,
}) => {
  const [viewMode, setViewMode] = useState<'dzien' | 'tydzien' | 'miesiac'>('tydzien');
  const [activeTab, setActiveTab] = useState<'wszystko' | 'wydarzenia' | 'zadania'>('wszystko');

  const events = items.filter((i) => i.type === 'kalendarz') as (CalendarEventItem & { type: 'kalendarz' })[];
  const tasks = items.filter((i) => i.type === 'zadania') as (TaskItem & { type: 'zadania' })[];

  // Conflict detection: simple check if multiple events happen on the exact same date & time
  const conflicts: string[] = [];
  const dateMap = new Map<string, string[]>();

  events.forEach((ev) => {
    const key = `${ev.target_date || 'brak'}_${ev.start_time || 'brak'}`;
    if (!dateMap.has(key)) dateMap.set(key, []);
    dateMap.get(key)!.push(ev.title);
  });

  dateMap.forEach((titles, key) => {
    if (titles.length > 1 && !key.includes('brak')) {
      conflicts.push(`Potencjalny konflikt: ${titles.join(' oraz ')} przypadają w zbliżonym terminie.`);
    }
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E9E8E5]">
        <div>
          <h2 className="text-2xl font-serif-editorial font-normal text-[#202020]">
            Kalendarz & Zadania
          </h2>
          <p className="text-xs text-[#707070]">
            Harmonogram życia, powtarzalne rocznice i rzeczy do zrobienia bez presji.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode */}
          <div className="flex items-center bg-[#E9E8E5] p-0.5 rounded-lg text-xs">
            {(['dzien', 'tydzien', 'miesiac'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                className={`px-3 py-1 rounded-md capitalize font-medium transition-all cursor-pointer ${
                  viewMode === m
                    ? 'bg-white text-[#202020] shadow-2xs'
                    : 'text-[#707070] hover:text-[#202020]'
                }`}
              >
                {m === 'dzien' ? 'Dzień' : m === 'tydzien' ? 'Tydzień' : 'Miesiąc'}
              </button>
            ))}
          </div>

          <button
            onClick={() => onOpenCapture('Nowe wydarzenie: ')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#202020] text-white hover:bg-[#8C7CF0] transition-colors text-xs font-semibold cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Dodaj</span>
          </button>
        </div>
      </div>

      {/* Conflict Warning if any */}
      {conflicts.length > 0 && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-semibold">Wykryto kolizję w harmonogramie:</span>
            {conflicts.map((c, idx) => (
              <p key={idx} className="text-amber-800">{c}</p>
            ))}
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 text-xs">
        {[
          { id: 'wszystko', label: `Wszystko (${events.length + tasks.length})` },
          { id: 'wydarzenia', label: `Wydarzenia (${events.length})` },
          { id: 'zadania', label: `Zadania (${tasks.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
              activeTab === tab.id
                ? 'bg-white border border-[#E9E8E5] text-[#202020] shadow-2xs'
                : 'text-[#707070] hover:text-[#202020]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Events Column */}
        {(activeTab === 'wszystko' || activeTab === 'wydarzenia') && (
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#707070] flex items-center gap-1.5">
              <CalendarIcon className="w-4 h-4 text-[#8C7CF0]" />
              <span>Wydarzenia i daty w kalendarzu</span>
            </h3>

            <div className="space-y-2.5">
              {events.map((ev) => (
                <div
                  key={ev.id}
                  className="p-4 bg-white rounded-xl border border-[#E9E8E5] shadow-2xs hover:border-[#8C7CF0]/40 transition-all space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-semibold text-[#202020]">{ev.title}</h4>
                      <p className="text-xs text-[#606060] mt-0.5">{ev.description}</p>
                    </div>
                    {ev.is_annual_recurring && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#D9D0FF]/40 text-[#8C7CF0] text-[10px] font-semibold shrink-0">
                        <Repeat className="w-3 h-3" />
                        <span>Coroczne</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-[#707070] pt-1 border-t border-[#F0EEE8]">
                    <span className="flex items-center gap-1 font-medium text-[#202020]">
                      <Clock className="w-3.5 h-3.5 text-[#8C7CF0]" />
                      {ev.start_time || 'Cały dzień'}
                    </span>
                    {ev.target_date && <span>Data: {ev.target_date}</span>}
                    {ev.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-[#A09E97]" />
                        {ev.location}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {events.length === 0 && (
                <p className="text-xs text-[#909090] p-4 text-center bg-white rounded-xl border border-[#E9E8E5]">
                  Brak zapisanych wydarzeń.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Tasks Column */}
        {(activeTab === 'wszystko' || activeTab === 'zadania') && (
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#707070] flex items-center gap-1.5">
              <CheckSquare className="w-4 h-4 text-[#8C7CF0]" />
              <span>Lista zadań i zobowiązań</span>
            </h3>

            <div className="space-y-2.5">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className={`p-4 bg-white rounded-xl border transition-all flex items-start gap-3 ${
                    task.is_completed
                      ? 'border-[#E9E8E5] opacity-60 bg-[#FAFAFA]'
                      : 'border-[#E9E8E5] hover:border-[#8C7CF0]/40 shadow-2xs'
                  }`}
                >
                  <button
                    onClick={() => onToggleTask(task.id)}
                    aria-label={`Przełącz stan zadania: ${task.title}`}
                    className="mt-0.5 text-[#8C7CF0] hover:scale-110 transition-transform cursor-pointer"
                  >
                    {task.is_completed ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <Circle className="w-5 h-5 text-[#B0AEA6]" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <h4
                      className={`text-sm font-semibold text-[#202020] ${
                        task.is_completed ? 'line-through text-[#808080]' : ''
                      }`}
                    >
                      {task.title}
                    </h4>
                    <p className="text-xs text-[#606060] mt-0.5">{task.description}</p>
                    {task.status_note && (
                      <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded mt-1.5 inline-block">
                        {task.status_note}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2 text-[10px]">
                      {task.due_date && (
                        <span className="text-[#707070] font-medium">Termin: {task.due_date}</span>
                      )}
                      <span
                        className={`px-1.5 py-0.5 rounded font-medium ${
                          task.priority === 'wysoki'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-stone-100 text-[#505050]'
                        }`}
                      >
                        {task.priority}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {tasks.length === 0 && (
                <p className="text-xs text-[#909090] p-4 text-center bg-white rounded-xl border border-[#E9E8E5]">
                  Brak zadań w toku.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Integration Note */}
      <div className="p-4 rounded-xl bg-white border border-[#E9E8E5] text-xs text-[#606060] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-[#8C7CF0]" />
          <span>Synchronizacja z Kalendarzem Google jest gotowa do podłączenia.</span>
        </div>
        <span className="text-[11px] text-[#8C7CF0] font-medium">Lokalna baza aktywna</span>
      </div>
    </div>
  );
};
