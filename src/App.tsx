import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { Navigation, TabType } from './components/Navigation';
import { TodayView } from './components/TodayView';
import { CalendarTasksView } from './components/CalendarTasksView';
import { MemoryCatalogView } from './components/MemoryCatalogView';
import { KnowledgeGraphView } from './components/KnowledgeGraphView';
import { AssistantView } from './components/AssistantView';
import { UniversalCaptureModal } from './components/UniversalCaptureModal';
import { AnyBrainItem, AuditBatch, GraphEdge, InboxItem, TemporalFact } from './types';
import { Sparkles, CheckCircle2 } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('dzisiaj');
  const [items, setItems] = useState<AnyBrainItem[]>([]);
  const [temporalFacts, setTemporalFacts] = useState<TemporalFact[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [auditBatches, setAuditBatches] = useState<AuditBatch[]>([]);
  const [aiMode, setAiMode] = useState<'automatyczny' | 'zatwierdzanie' | 'manualny'>('automatyczny');
  const [hasApiKey, setHasApiKey] = useState(true);
  const [isCaptureOpen, setIsCaptureOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Fetch full state from backend
  const loadState = useCallback(async () => {
    try {
      const res = await fetch('/api/state');
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        setTemporalFacts(data.temporal_facts || []);
        setEdges(data.edges || []);
        setInbox(data.inbox || []);
        setAuditBatches(data.audit_batches || []);
        if (data.ai_mode) setAiMode(data.ai_mode);
        if (typeof data.has_api_key === 'boolean') setHasApiKey(data.has_api_key);
      }
    } catch (e) {
      console.error('Failed to load brain state:', e);
    }
  }, []);

  useEffect(() => {
    loadState();
  }, [loadState]);

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCaptureOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleToggleTask = async (taskId: string) => {
    try {
      const res = await fetch('/api/items/toggle-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: taskId }),
      });
      if (res.ok) {
        setItems((prev) =>
          prev.map((i) =>
            i.id === taskId && i.type === 'zadania'
              ? { ...i, is_completed: !(i as any).is_completed }
              : i
          )
        );
      }
    } catch (e) {
      console.error('Failed to toggle task:', e);
    }
  };

  const handleDeleteItem = async (id: string) => {
    try {
      const res = await fetch(`/api/items/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== id));
        setEdges((prev) => prev.filter((e) => e.source !== id && e.target !== id));
        showToast('Rekord został usunięty z pamięci.');
      }
    } catch (e) {
      console.error('Failed to delete item:', e);
    }
  };

  const handleUndo = async () => {
    try {
      const res = await fetch('/api/undo', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || 'Cofnięto ostatnią operację.');
        loadState();
      } else {
        showToast(data.error || 'Brak operacji do cofnięcia.');
      }
    } catch (e) {
      console.error('Failed to undo:', e);
    }
  };

  const handleSetAiMode = async (mode: 'automatyczny' | 'zatwierdzanie' | 'manualny') => {
    setAiMode(mode);
    try {
      await fetch('/api/settings/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      showToast(`Przełączono tryb AI na: ${mode}.`);
    } catch (e) {
      console.error('Failed to update AI mode:', e);
    }
  };

  const handleResetData = async () => {
    if (window.confirm('Czy na pewno chcesz przywrócić początkowe dane demonstracyjne?')) {
      try {
        await fetch('/api/reset', { method: 'POST' });
        loadState();
        showToast('Przywrócono wzorcowe dane splot.');
      } catch (e) {
        console.error('Reset error:', e);
      }
    }
  };

  const handleAddEdge = (newEdge: GraphEdge) => {
    setEdges((prev) => [...prev, newEdge]);
    showToast(`Połączono: ${newEdge.label}`);
  };

  const handleResolveInbox = async (inboxId: string, action: string, payload?: any) => {
    try {
      const res = await fetch('/api/inbox/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inboxId, action, payload }),
      });
      if (res.ok) {
        setInbox((prev) => prev.filter((i) => i.id !== inboxId));
        showToast('Rozwiązano sprawę w Smart Inbox.');
        loadState();
      }
    } catch (e) {
      console.error('Inbox resolve error:', e);
    }
  };

  const canUndo = auditBatches.some((b) => b.can_undo);

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F6F2] text-[#202020]">
      {/* Top Header */}
      <Header
        aiMode={aiMode}
        onSetAiMode={handleSetAiMode}
        canUndo={canUndo}
        onUndo={handleUndo}
        onResetData={handleResetData}
        hasApiKey={hasApiKey}
        onOpenCapture={() => setIsCaptureOpen(true)}
      />

      {/* Navigation Pills */}
      <Navigation
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenMic={() => setIsCaptureOpen(true)}
        inboxCount={inbox.filter((i) => !i.resolved).length}
      />

      {/* Main App Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 py-6 pb-24 sm:pb-12">
        {activeTab === 'dzisiaj' && (
          <TodayView
            items={items}
            onToggleTask={handleToggleTask}
            onOpenCapture={(init) => {
              setIsCaptureOpen(true);
            }}
            onSelectTab={setActiveTab}
          />
        )}

        {activeTab === 'kalendarz' && (
          <CalendarTasksView
            items={items}
            onToggleTask={handleToggleTask}
            onDeleteItem={handleDeleteItem}
            onOpenCapture={() => setIsCaptureOpen(true)}
          />
        )}

        {activeTab === 'pamiec' && (
          <MemoryCatalogView
            items={items}
            temporalFacts={temporalFacts}
            onDeleteItem={handleDeleteItem}
            onOpenCapture={() => setIsCaptureOpen(true)}
          />
        )}

        {activeTab === 'mapa' && (
          <KnowledgeGraphView
            items={items}
            edges={edges}
            temporalFacts={temporalFacts}
            onAddEdge={handleAddEdge}
            onToggleTask={handleToggleTask}
            onRefresh={loadState}
            onOpenCapture={(initialText) => {
              setIsCaptureOpen(true);
            }}
          />
        )}

        {activeTab === 'asystent' && (
          <AssistantView
            items={items}
            inbox={inbox}
            onResolveInbox={handleResolveInbox}
            onOpenCapture={() => setIsCaptureOpen(true)}
          />
        )}
      </main>

      {/* Universal Capture Modal */}
      <UniversalCaptureModal
        isOpen={isCaptureOpen}
        onClose={() => setIsCaptureOpen(false)}
        onSuccess={(result) => {
          showToast(result.summary || 'Zapisano w mózgu splot.');
          loadState();
        }}
        onAddToInbox={() => {
          showToast('Wpis przekazano do akceptacji w Smart Inbox.');
          loadState();
        }}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 sm:bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl bg-[#202020] text-white text-xs font-medium shadow-xl border border-white/10 animate-bounce">
          <Sparkles className="w-4 h-4 text-[#D9D0FF]" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
