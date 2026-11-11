import React from 'react';
import { Sun, Calendar, BookOpen, Share2, MessageSquareText, Mic } from 'lucide-react';

export type TabType = 'dzisiaj' | 'kalendarz' | 'pamiec' | 'mapa' | 'asystent';

interface NavigationProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  onOpenMic: () => void;
  inboxCount?: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
  onOpenMic,
  inboxCount = 0,
}) => {
  const tabs = [
    { id: 'dzisiaj' as TabType, label: 'Dzisiaj', icon: Sun },
    { id: 'kalendarz' as TabType, label: 'Kalendarz', icon: Calendar },
    { id: 'pamiec' as TabType, label: 'Pamięć', icon: BookOpen },
    { id: 'mapa' as TabType, label: 'Mapa', icon: Share2 },
    { id: 'asystent' as TabType, label: 'Asystent', icon: MessageSquareText, badge: inboxCount > 0 ? inboxCount : undefined },
  ];

  return (
    <>
      {/* Desktop Top Nav Pills */}
      <nav aria-label="Nawigacja główna desktop" className="hidden sm:block border-b border-[#E9E8E5] bg-[#F7F6F2]">
        <div className="max-w-6xl mx-auto px-8 flex items-center justify-between">
          <div className="flex gap-1 py-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onSelectTab(tab.id)}
                  aria-label={tab.label}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer relative ${
                    isActive
                      ? 'bg-white text-[#202020] shadow-xs border border-[#E9E8E5]'
                      : 'text-[#707070] hover:text-[#202020] hover:bg-white/50'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[#8C7CF0]' : 'text-[#707070]'}`} />
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span className="w-5 h-5 rounded-full bg-[#8C7CF0] text-white text-[11px] font-bold flex items-center justify-center">
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <button
            onClick={onOpenMic}
            aria-label="Nagraj głos lub przechwyć myśl"
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#8C7CF0] text-white hover:bg-[#7866e4] transition-all text-xs font-semibold shadow-xs cursor-pointer active:scale-95"
          >
            <Mic className="w-4 h-4 text-white" />
            <span>Nagraj myśl</span>
          </button>
        </div>
      </nav>

      {/* Mobile Floating Bottom Bar with Central Microphone Button */}
      <nav aria-label="Nawigacja dolna mobile" className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#F7F6F2]/95 backdrop-blur-lg border-t border-[#E9E8E5] px-3 py-2">
        <div className="flex items-center justify-around relative">
          {tabs.slice(0, 2).map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                aria-label={tab.label}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg cursor-pointer ${
                  isActive ? 'text-[#8C7CF0] font-semibold' : 'text-[#707070]'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px]">{tab.label}</span>
              </button>
            );
          })}

          {/* Central Floating Microphone */}
          <div className="relative -top-5 flex flex-col items-center">
            <button
              onClick={onOpenMic}
              aria-label="Przechwytywanie informacji głosowo"
              className="w-14 h-14 rounded-full bg-[#202020] text-white flex items-center justify-center shadow-lg border-4 border-[#F7F6F2] hover:bg-[#8C7CF0] transition-transform active:scale-90 cursor-pointer"
            >
              <Mic className="w-6 h-6 text-[#D9D0FF]" />
            </button>
            <span className="text-[9px] uppercase tracking-wider text-[#707070] mt-0.5 font-bold">
              Powiedz
            </span>
          </div>

          {tabs.slice(2).map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                aria-label={tab.label}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg cursor-pointer relative ${
                  isActive ? 'text-[#8C7CF0] font-semibold' : 'text-[#707070]'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px]">{tab.label}</span>
                {tab.badge && (
                  <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-[#8C7CF0]" />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
