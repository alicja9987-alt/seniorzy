import React, { useState } from 'react';
import { Search, Filter, History, Clock, ArrowRight, User, Lightbulb, Compass, Heart, Tag, Info, Trash2, X, Sparkles, CheckCircle2 } from 'lucide-react';
import { AnyBrainItem, CategoryType, TemporalFact } from '../types';
import { getFactEvolution, getActiveAndFormerFacts } from '../utils/temporal-memory';

interface MemoryCatalogViewProps {
  items: AnyBrainItem[];
  temporalFacts: TemporalFact[];
  onDeleteItem: (id: string) => void;
  onOpenCapture: (text?: string) => void;
}

export const MemoryCatalogView: React.FC<MemoryCatalogViewProps> = ({
  items,
  temporalFacts,
  onDeleteItem,
  onOpenCapture,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<CategoryType | 'wszystko' | 'temporal'>('wszystko');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<AnyBrainItem | null>(null);

  const categories: { id: CategoryType | 'wszystko' | 'temporal'; label: string; count?: number }[] = [
    { id: 'wszystko', label: 'Wszystko', count: items.length },
    { id: 'temporal', label: 'Ewolucja faktów (Temporal)', count: temporalFacts.length },
    { id: 'wspomnienia', label: 'Wspomnienia', count: items.filter((i) => i.categories.includes('wspomnienia')).length },
    { id: 'ludzie', label: 'Ludzie', count: items.filter((i) => i.categories.includes('ludzie')).length },
    { id: 'pomysly', label: 'Pomysły', count: items.filter((i) => i.categories.includes('pomysly')).length },
    { id: 'projekty', label: 'Projekty', count: items.filter((i) => i.categories.includes('projekty')).length },
    { id: 'o_mnie', label: 'O mnie', count: items.filter((i) => i.categories.includes('o_mnie')).length },
    { id: 'kalendarz', label: 'Kalendarz', count: items.filter((i) => i.categories.includes('kalendarz')).length },
    { id: 'zadania', label: 'Zadania', count: items.filter((i) => i.categories.includes('zadania')).length },
    { id: 'inspiracje', label: 'Inspiracje', count: items.filter((i) => i.categories.includes('inspiracje')).length },
    { id: 'miejsca', label: 'Miejsca (Miasta)', count: items.filter((i) => i.categories.includes('miejsca')).length },
  ];

  // Filtering
  const filteredItems = items.filter((item) => {
    if (selectedCategory !== 'wszystko' && selectedCategory !== 'temporal') {
      if (!item.categories.includes(selectedCategory as CategoryType)) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchDesc = item.description.toLowerCase().includes(q);
      const matchTags = (item.tags || []).some((t) => t.toLowerCase().includes(q));
      return matchTitle || matchDesc || matchTags;
    }
    return true;
  });

  const { active: activeFacts, former: formerFacts } = getActiveAndFormerFacts(temporalFacts);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Title & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E9E8E5]">
        <div>
          <h2 className="text-2xl font-serif-editorial font-normal text-[#202020]">
            Katalog Pamięci i Wiedzy
          </h2>
          <p className="text-xs text-[#707070]">
            8 inteligentnych kategorii z wyjaśnieniem klasyfikacji AI i osią zmian w czasie.
          </p>
        </div>

        {/* Global Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-[#A09E97] absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Szukaj wspomnień, osób, faktów..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-white border border-[#E9E8E5] text-xs text-[#202020] placeholder-[#A09E97] focus:outline-hidden focus:border-[#8C7CF0] shadow-2xs"
          />
        </div>
      </div>

      {/* Category Pills Slider */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
        {categories.map((cat) => {
          const isSelected = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                isSelected
                  ? 'bg-[#202020] text-white shadow-xs'
                  : 'bg-white border border-[#E9E8E5] text-[#505050] hover:text-[#202020] hover:border-[#8C7CF0]/50'
              }`}
            >
              <span>{cat.label}</span>
              {cat.count !== undefined && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-[#E9E8E5] text-[#707070]'
                  }`}
                >
                  {cat.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main View Area */}
      {selectedCategory === 'temporal' ? (
        /* Temporal Memory Section */
        <div className="space-y-6">
          <div className="p-4 rounded-xl bg-white border border-[#E9E8E5] shadow-2xs space-y-1">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-[#8C7CF0]" />
              <h3 className="text-sm font-semibold text-[#202020]">
                Temporal Memory — Pamięć rozumiejąca upływ czasu
              </h3>
            </div>
            <p className="text-xs text-[#606060] leading-relaxed">
              Ludzkie upodobania, plany i fakty ewoluują. splot nie usuwa dawnych faktów — zachowuje
              ich chronologię, pamiętając co było aktualne w styczniu, a co uległo zmianie w czerwcu.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Active Preferences & Facts */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[#707070] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Aktualnie obowiązujące fakty ({activeFacts.length})</span>
              </h4>

              <div className="space-y-3">
                {activeFacts.map((fact) => (
                  <div
                    key={fact.id}
                    className="p-4 bg-white rounded-xl border border-[#E9E8E5] shadow-2xs space-y-2 hover:border-[#8C7CF0]/40 transition-colors"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-xs font-semibold text-[#8C7CF0]">{fact.subject}</span>
                      <span className="text-[#707070]">Obowiązuje od: {fact.valid_from}</span>
                    </div>
                    <div className="text-sm font-medium text-[#202020]">
                      {fact.entity_name ? `${fact.entity_name}: ` : ''}
                      <span className="text-[#8C7CF0] font-bold">„{fact.value}”</span>
                    </div>
                    {fact.supersedes_id && (
                      <div className="text-[11px] text-[#606060] bg-[#F7F6F2] p-2 rounded-lg border border-[#E9E8E5]">
                        <span className="font-semibold text-amber-700">Zastąpiło dawną preferencję: </span>
                        {temporalFacts.find((f) => f.id === fact.supersedes_id)?.value || 'wcześniejszy stan'}
                      </div>
                    )}
                    <p className="text-[10px] text-[#808080] italic">
                      Źródło wypowiedzi: „{fact.source_utterance}”
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Former/Historical Facts */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[#707070] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span>Fakty historyczne i dawne upodobania ({formerFacts.length})</span>
              </h4>

              <div className="space-y-3">
                {formerFacts.map((fact) => (
                  <div
                    key={fact.id}
                    className="p-4 bg-[#F7F6F2] rounded-xl border border-[#E9E8E5] space-y-2 opacity-80"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-xs font-medium text-[#606060]">{fact.subject}</span>
                      <span className="text-[#808080]">
                        {fact.valid_from} → {fact.valid_until || 'zastąpione'}
                      </span>
                    </div>
                    <div className="text-sm text-[#404040]">
                      Dawna wartość: <span className="line-through text-[#808080]">„{fact.value}”</span>
                    </div>
                    <p className="text-[10px] text-[#808080] italic">
                      Zapisano: „{fact.source_utterance}”
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Regular Items Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              onClick={() => setSelectedItem(item)}
              className="group p-4 bg-white rounded-2xl border border-[#E9E8E5] shadow-2xs hover:border-[#8C7CF0] hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <span className="uppercase tracking-wider font-semibold text-[#8C7CF0]">
                      {item.type}
                    </span>
                    {item.lifecycle_status === 'in_memoriam' && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-300">
                        In memoriam
                      </span>
                    )}
                    {item.type === 'miejsca' && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-cyan-50 text-cyan-700 border border-cyan-200">
                        Kotwica lokacyjna
                      </span>
                    )}
                  </div>
                  <span className="text-[#808080]">
                    {item.target_date || item.recorded_at.slice(0, 10)}
                  </span>
                </div>

                <h3 className="text-sm font-semibold text-[#202020] group-hover:text-[#8C7CF0] transition-colors leading-snug">
                  {item.title}
                </h3>

                <p className="text-xs text-[#505050] line-clamp-3 leading-relaxed">
                  {item.description}
                </p>

                {/* Special details for People */}
                {item.type === 'ludzie' && (item as any).preferences?.length > 0 && (
                  <div className="pt-2 text-[11px] text-[#606060]">
                    <span className="font-medium text-[#202020]">Preferencje: </span>
                    {(item as any).preferences.join(', ')}
                  </div>
                )}
              </div>

              {/* Tags & AI reasoning pill */}
              <div className="pt-3 mt-3 border-t border-[#F0EEE8] flex items-center justify-between text-[10px] text-[#707070]">
                <div className="flex items-center gap-1 truncate">
                  {(item.tags || []).slice(0, 2).map((t, idx) => (
                    <span key={idx} className="px-1.5 py-0.5 rounded bg-[#F7F6F2] border border-[#E9E8E5]">
                      #{t}
                    </span>
                  ))}
                </div>
                <span className="text-[#8C7CF0] font-medium group-hover:underline">
                  Szczegóły →
                </span>
              </div>
            </div>
          ))}

          {filteredItems.length === 0 && (
            <div className="col-span-full py-12 text-center text-xs text-[#808080] bg-white rounded-2xl border border-[#E9E8E5]">
              Brak rekordów spełniających wybrane kryteria.
            </div>
          )}
        </div>
      )}

      {/* Item Details Drawer Modal */}
      {selectedItem && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
        >
          <div className="w-full max-w-lg bg-[#F7F6F2] rounded-2xl border border-[#E9E8E5] shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-2 border-b border-[#E9E8E5] pb-3">
              <div>
                <span className="text-xs uppercase tracking-wider font-semibold text-[#8C7CF0]">
                  {selectedItem.type}
                </span>
                <h3 className="text-lg font-serif-editorial font-medium text-[#202020] mt-0.5">
                  {selectedItem.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="p-1.5 text-[#707070] hover:text-[#202020] rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs leading-relaxed text-[#404040]">
              <div className="p-3 bg-white rounded-xl border border-[#E9E8E5] space-y-1">
                <span className="font-semibold text-[#202020]">Opis rekordu:</span>
                <p>{selectedItem.description}</p>
              </div>

              {/* AI Reason */}
              <div className="p-3 bg-[#D9D0FF]/20 rounded-xl border border-[#8C7CF0]/30 space-y-1">
                <span className="font-semibold text-[#8C7CF0] flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  Dlaczego AI nadało tę kategorię:
                </span>
                <p className="text-[#303030]">{selectedItem.ai_classification_reason}</p>
              </div>

              {/* Source utterance */}
              {selectedItem.raw_input && (
                <div className="p-3 bg-white rounded-xl border border-[#E9E8E5] space-y-1">
                  <span className="font-semibold text-[#707070]">Źródłowa wypowiedź użytkownika:</span>
                  <p className="italic text-[#505050]">„{selectedItem.raw_input}”</p>
                </div>
              )}

              {/* Idea Incubator Section if Pomysł */}
              {selectedItem.type === 'pomysly' && (
                <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-amber-900 flex items-center gap-1.5">
                      <Lightbulb className="w-4 h-4 text-amber-600" />
                      Inkubator Pomysłów splot
                    </span>
                    <button
                      onClick={async () => {
                        try {
                          const res = await fetch('/api/ideas/incubate', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ id: selectedItem.id }),
                          });
                          const data = await res.json();
                          if (data.success && data.idea) {
                            setSelectedItem(data.idea);
                          }
                        } catch (e) {
                          console.error('Incubation error:', e);
                        }
                      }}
                      className="px-2.5 py-1 rounded-md bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-semibold cursor-pointer transition-colors shadow-2xs"
                    >
                      Rozwiń z AI ✨
                    </button>
                  </div>
                  {(selectedItem as any).ai_expansion ? (
                    <p className="text-[#303030] whitespace-pre-wrap bg-white p-2.5 rounded-lg border border-amber-100">
                      {(selectedItem as any).ai_expansion}
                    </p>
                  ) : (
                    <p className="text-[11px] text-[#707070] italic">
                      Kliknij „Rozwiń z AI”, aby asystent opracował filary rozwoju, grupę docelową i zadania.
                    </p>
                  )}
                </div>
              )}

              {/* Tags & Dates */}
              <div className="p-3 bg-white rounded-xl border border-[#E9E8E5] grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-[#707070] block">Zapisano:</span>
                  <span className="font-medium text-[#202020]">{selectedItem.recorded_at}</span>
                </div>
                <div>
                  <span className="text-[#707070] block">Dotyczy daty:</span>
                  <span className="font-medium text-[#202020]">{selectedItem.target_date || 'brak'}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 border-t border-[#E9E8E5] flex items-center justify-between">
              <button
                onClick={() => {
                  onDeleteItem(selectedItem.id);
                  setSelectedItem(null);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 text-xs font-semibold cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Usuń rekord</span>
              </button>

              <button
                onClick={() => setSelectedItem(null)}
                className="px-4 py-2 rounded-xl bg-[#202020] text-white hover:bg-[#8C7CF0] text-xs font-semibold transition-colors cursor-pointer"
              >
                Zamknij
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
