import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Sparkles,
  Link as LinkIcon,
  X,
  Play,
  Pause,
  Search,
  User,
  CheckCircle2,
  FolderKanban,
  Lightbulb,
  Calendar,
  Heart,
  Compass,
  ArrowRight,
  MapPin,
  GitBranch,
  Network,
  ListTree,
  Info,
  Clock,
  Check,
  Send,
  Plus,
  History,
  Tag,
  ChevronRight,
  CornerDownRight,
  CalendarDays,
  RotateCcw,
  Zap,
} from 'lucide-react';
import { Simulation } from 'd3-force';
import { AnyBrainItem, CategoryType, GraphEdge, GraphNode, TemporalFact } from '../types';
import {
  buildGraphData,
  calculateCurvedLinkPath,
  createD3ForceSimulation,
  D3GraphLink,
  D3GraphNode,
  detectSmartConnections,
} from '../utils/graph-layout';

interface KnowledgeGraphViewProps {
  items: AnyBrainItem[];
  edges: GraphEdge[];
  temporalFacts?: TemporalFact[];
  onAddEdge: (edge: GraphEdge) => void;
  onToggleTask?: (taskId: string) => void;
  onRefresh?: () => void;
  onOpenCapture?: (initialText?: string) => void;
}

export const CATEGORY_CONFIG: Record<
  CategoryType,
  { label: string; color: string; bgLight: string; borderColor: string; icon: React.FC<{ className?: string }> }
> = {
  ludzie: { label: 'Ludzie', color: '#D97706', bgLight: '#FEF3C7', borderColor: '#FCD34D', icon: User },
  miejsca: { label: 'Miejsca', color: '#0891B2', bgLight: '#CFFAFE', borderColor: '#67E8F9', icon: MapPin },
  projekty: { label: 'Projekty', color: '#7C3AED', bgLight: '#EDE9FE', borderColor: '#C4B5FD', icon: FolderKanban },
  pomysly: { label: 'Pomysły', color: '#D97706', bgLight: '#FEF9C3', borderColor: '#FDE047', icon: Lightbulb },
  zadania: { label: 'Zadania', color: '#059669', bgLight: '#D1FAE5', borderColor: '#6EE7B7', icon: CheckCircle2 },
  kalendarz: { label: 'Kalendarz', color: '#2563EB', bgLight: '#DBEAFE', borderColor: '#93C5FD', icon: Calendar },
  wspomnienia: { label: 'Wspomnienia', color: '#DB2777', bgLight: '#FCE7F3', borderColor: '#F9A8D4', icon: Sparkles },
  o_mnie: { label: 'O mnie', color: '#7C3AED', bgLight: '#F3E8FF', borderColor: '#D8B4FE', icon: Heart },
  inspiracje: { label: 'Inspiracje', color: '#0D9488', bgLight: '#CCFBF1', borderColor: '#5EEAD4', icon: Compass },
};

export function getNodeEmoji(node: { category: string; label: string; lifecycle_status?: string }): string {
  if (node.lifecycle_status === 'in_memoriam') return '🕊️';
  const l = node.label.toLowerCase();
  if (node.category === 'miejsca' || l.includes('gdańsk') || l.includes('warszaw') || l.includes('kraków')) return '📍';
  if (node.category === 'ludzie' || l.includes('kasia') || l.includes('marek')) return '👤';
  if (l.includes('tatuaż')) return '🎨';
  if (l.includes('drukark')) return '🖨️';
  if (l.includes('biżuteri') || l.includes('jubiler')) return '💎';
  if (l.includes('kawa') || l.includes('kawiarni')) return '☕';
  if (l.includes('urodzin') || l.includes('kalendarz') || l.includes('wyjazd')) return '📅';
  if (l.includes('stomatolog') || l.includes('lekarz')) return '🦷';
  if (l.includes('ceramik')) return '🏺';
  if (node.category === 'zadania') return '✓';
  if (node.category === 'pomysly') return '💡';
  if (node.category === 'wspomnienia') return '✨';
  if (node.category === 'projekty') return '📁';
  if (node.category === 'o_mnie') return '💜';
  if (node.category === 'inspiracje') return '🧭';
  return '📌';
}

type ViewMode = 'klastry' | 'siec' | 'drzewo';
type DrilldownTab = 'all' | 'memories' | 'plans' | 'ai';

export const KnowledgeGraphView: React.FC<KnowledgeGraphViewProps> = ({
  items,
  edges,
  temporalFacts = [],
  onAddEdge,
  onToggleTask,
  onRefresh,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('klastry');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>('miejsca_hduarhm_1793533183132'); // Default to Gdańsk for immediate rich preview
  const [drilldownTab, setDrilldownTab] = useState<DrilldownTab>('all');
  const [filterCategory, setFilterCategory] = useState<CategoryType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [focusMode, setFocusMode] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [manualEdgeTarget, setManualEdgeTarget] = useState<string>('');
  const [quickThought, setQuickThought] = useState('');
  const [isSubmittingQuick, setIsSubmittingQuick] = useState(false);

  // 2D Canvas interactive controls
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [isPhysicsRunning, setIsPhysicsRunning] = useState(true);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);

  const canvasContainerRef = useRef<HTMLDivElement | null>(null);

  // Raw graph structure
  const rawGraph = useMemo(() => buildGraphData(items, edges), [items, edges]);

  // Connect node status (e.g. in_memoriam)
  const nodesWithMetadata = useMemo(() => {
    const itemMap = new Map(items.map((i) => [i.id, i]));
    return rawGraph.nodes.map((n) => {
      const realItem = itemMap.get(n.id);
      return {
        ...n,
        lifecycle_status:
          realItem?.lifecycle_status ||
          (realItem?.type === 'zadania' && (realItem as any).is_completed ? 'completed' : 'active'),
        rawItem: realItem,
      };
    });
  }, [rawGraph.nodes, items]);

  // Filtered graph for Network view
  const activeGraph = useMemo(() => {
    let nodes = nodesWithMetadata;
    let validEdges = rawGraph.edges;

    if (focusMode && selectedNodeId) {
      const neighborIds = new Set<string>([selectedNodeId]);
      validEdges.forEach((e) => {
        if (e.source === selectedNodeId) neighborIds.add(e.target);
        if (e.target === selectedNodeId) neighborIds.add(e.source);
      });
      nodes = nodes.filter((n) => neighborIds.has(n.id));
      validEdges = validEdges.filter((e) => neighborIds.has(e.source) && neighborIds.has(e.target));
    } else if (filterCategory !== 'all') {
      const nodeIds = new Set(nodes.filter((n) => n.category === filterCategory).map((n) => n.id));
      nodes = nodes.filter((n) => nodeIds.has(n.id));
      validEdges = validEdges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchIds = new Set(
        nodes
          .filter((n) => n.label.toLowerCase().includes(q) || (n.subtitle || '').toLowerCase().includes(q))
          .map((n) => n.id)
      );
      nodes = nodes.filter((n) => matchIds.has(n.id));
      validEdges = validEdges.filter((e) => matchIds.has(e.source) && matchIds.has(e.target));
    }

    return { nodes, edges: validEdges };
  }, [nodesWithMetadata, rawGraph.edges, focusMode, selectedNodeId, filterCategory, searchQuery]);

  // d3-force Simulation State & References
  const d3SimRef = useRef<Simulation<D3GraphNode, D3GraphLink> | null>(null);
  const [d3Nodes, setD3Nodes] = useState<D3GraphNode[]>([]);
  const [d3Links, setD3Links] = useState<D3GraphLink[]>([]);
  const previousPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  // Initialize and run d3-force simulation
  useEffect(() => {
    if (viewMode !== 'siec') {
      d3SimRef.current?.stop();
      return;
    }

    const prevPos = previousPositionsRef.current;
    const count = activeGraph.nodes.length;
    const width = 880;
    const height = 560;

    // Build fresh nodes for D3 simulation, preserving previous layout positions
    const initialNodes: D3GraphNode[] = activeGraph.nodes.map((n, idx) => {
      const existing = prevPos.get(n.id);
      if (existing) {
        return {
          ...n,
          x: existing.x,
          y: existing.y,
          radius: 34,
        };
      }
      const angle = (idx / Math.max(1, count)) * 2 * Math.PI;
      const dist = 210 + (idx % 3) * 65;
      return {
        ...n,
        x: width / 2 + Math.cos(angle) * dist,
        y: height / 2 + Math.sin(angle) * dist,
        radius: 34,
      };
    });

    // Deep copy link data so D3 can mutate source/target safely
    const initialLinks: D3GraphLink[] = activeGraph.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label,
      confidence: e.confidence,
    }));

    // Create d3-force simulation
    const sim = createD3ForceSimulation(initialNodes, initialLinks, width, height, {
      linkDistance: 175,
      chargeStrength: -440,
      collisionRadius: 50,
      alphaDecay: 0.02,
    });

    d3SimRef.current = sim;

    sim.on('tick', () => {
      // Remember updated positions for stability and keep comfortably bounded
      initialNodes.forEach((node) => {
        if (typeof node.x === 'number' && typeof node.y === 'number') {
          node.x = Math.max(65, Math.min(width - 65, node.x));
          node.y = Math.max(60, Math.min(height - 60, node.y));
          prevPos.set(node.id, { x: node.x, y: node.y });
        }
      });
      setD3Nodes([...initialNodes]);
      setD3Links([...initialLinks]);
    });

    if (!isPhysicsRunning) {
      sim.stop();
    }

    return () => {
      sim.stop();
    };
  }, [activeGraph, viewMode, isPhysicsRunning]);

  // Dragging & Panning handlers for Network Canvas using d3-force
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.interactive-node') || target.closest('button')) return;
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
      return;
    }
    if (draggedNodeId && canvasContainerRef.current) {
      const rect = canvasContainerRef.current.getBoundingClientRect();
      const nodeX = (e.clientX - rect.left - pan.x) / zoom;
      const nodeY = (e.clientY - rect.top - pan.y) / zoom;
      const node = d3Nodes.find((n) => n.id === draggedNodeId);
      if (node) {
        node.fx = nodeX;
        node.fy = nodeY;
        d3SimRef.current?.alphaTarget(0.3).restart();
      }
    }
  };

  const handleCanvasMouseUp = () => {
    setIsPanning(false);
    if (draggedNodeId) {
      const node = d3Nodes.find((n) => n.id === draggedNodeId);
      if (node) {
        node.fx = null;
        node.fy = null;
      }
      d3SimRef.current?.alphaTarget(0);
      setDraggedNodeId(null);
    }
  };

  const handleTogglePhysics = () => {
    setIsPhysicsRunning((prev) => {
      const next = !prev;
      if (next) {
        d3SimRef.current?.alpha(0.3).restart();
      } else {
        d3SimRef.current?.stop();
      }
      return next;
    });
  };

  const handleReheatLayout = () => {
    d3SimRef.current?.alpha(1).restart();
  };

  // Selected item reference
  const selectedItem = useMemo(() => {
    return items.find((i) => i.id === selectedNodeId);
  }, [items, selectedNodeId]);

  // Direct edges count map for badge indicator
  const edgeCountMap = useMemo(() => {
    const counts = new Map<string, number>();
    rawGraph.edges.forEach((e) => {
      counts.set(e.source, (counts.get(e.source) || 0) + 1);
      counts.set(e.target, (counts.get(e.target) || 0) + 1);
    });
    return counts;
  }, [rawGraph.edges]);

  // Comprehensive Drilldown for the Selected Node
  const drilldownData = useMemo(() => {
    if (!selectedItem) return null;

    const itemMap = new Map(items.map((i) => [i.id, i]));
    const directEdges = rawGraph.edges.filter(
      (e) => e.source === selectedItem.id || e.target === selectedItem.id
    );

    const connectedItemSet = new Map<string, { item: AnyBrainItem; edge?: GraphEdge }>();

    directEdges.forEach((e) => {
      const otherId = e.source === selectedItem.id ? e.target : e.source;
      const item = itemMap.get(otherId);
      if (item && item.id !== selectedItem.id) {
        connectedItemSet.set(item.id, { item, edge: e });
      }
    });

    // Also look for implicit semantic links
    const titleLower = selectedItem.title.toLowerCase().trim();
    items.forEach((it) => {
      if (it.id === selectedItem.id) return;
      if (connectedItemSet.has(it.id)) return;

      const desc = `${it.title} ${it.description} ${it.raw_input || ''} ${(it.tags || []).join(' ')}`.toLowerCase();
      if (
        (titleLower.length >= 4 && desc.includes(titleLower)) ||
        (selectedItem.type === 'miejsca' && (it as any).location?.toLowerCase().includes(titleLower)) ||
        (selectedItem.type === 'ludzie' && (it as any).linked_people?.some((p: string) => p.toLowerCase().includes(titleLower)))
      ) {
        connectedItemSet.set(it.id, { item: it });
      }
    });

    const allConnected = Array.from(connectedItemSet.values());

    // 1. Memories: "Co kiedy tam robił użytkownik"
    const memories: Array<{ item: AnyBrainItem; date: string; relationLabel?: string }> = [];

    if (selectedItem.type === 'wspomnienia') {
      memories.push({
        item: selectedItem,
        date: selectedItem.target_date || selectedItem.recorded_at.slice(0, 10),
        relationLabel: 'Główny wpis wspomnienia',
      });
    }

    allConnected.forEach(({ item, edge }) => {
      if (item.type === 'wspomnienia' || (item.categories || []).includes('wspomnienia')) {
        memories.push({
          item,
          date: item.target_date || item.recorded_at.slice(0, 10),
          relationLabel: edge?.label || 'wspomnienie',
        });
      }
    });

    memories.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // 2. Plans & Schedule: "Co ma zaplanowane"
    const plans: Array<{ item: AnyBrainItem; date: string; isTask: boolean; isCompleted: boolean; relationLabel?: string }> = [];

    if (selectedItem.type === 'kalendarz' || selectedItem.type === 'zadania') {
      plans.push({
        item: selectedItem,
        date: selectedItem.target_date || (selectedItem as any).due_date || selectedItem.recorded_at.slice(0, 10),
        isTask: selectedItem.type === 'zadania',
        isCompleted: Boolean((selectedItem as any).is_completed),
        relationLabel: 'Główny plan',
      });
    }

    allConnected.forEach(({ item, edge }) => {
      if (item.type === 'kalendarz' || item.type === 'zadania') {
        plans.push({
          item,
          date: item.target_date || (item as any).due_date || item.recorded_at.slice(0, 10),
          isTask: item.type === 'zadania',
          isCompleted: Boolean((item as any).is_completed),
          relationLabel: edge?.label || (item.type === 'kalendarz' ? 'termin w kalendarzu' : 'zadanie'),
        });
      }
    });

    // 3. Ideas, Projects & Other Links
    const otherLinks = allConnected.filter(
      ({ item }) =>
        !memories.some((m) => m.item.id === item.id) &&
        !plans.some((p) => p.item.id === item.id)
    );

    // 4. Temporal facts matching this entity
    const matchingFacts = temporalFacts.filter(
      (f) =>
        (f.entity_name || '').toLowerCase().includes(titleLower) ||
        (f.subject || '').toLowerCase().includes(titleLower) ||
        (selectedItem.type === 'ludzie' && f.entity_type === 'person')
    );

    return {
      memories,
      plans,
      otherLinks,
      matchingFacts,
      totalCount: allConnected.length,
    };
  }, [selectedItem, items, rawGraph.edges, temporalFacts]);

  // Smart suggestions
  const smartConnections = useMemo(() => detectSmartConnections(items, edges), [items, edges]);

  // Semantic Clusters computation for the 'klastry' view
  const semanticClusters = useMemo(() => {
    const itemMap = new Map(items.map((i) => [i.id, i]));
    const edgeMap = new Map<string, Array<{ otherId: string; label: string }>>();

    rawGraph.edges.forEach((e) => {
      if (!edgeMap.has(e.source)) edgeMap.set(e.source, []);
      if (!edgeMap.has(e.target)) edgeMap.set(e.target, []);
      edgeMap.get(e.source)!.push({ otherId: e.target, label: e.label });
      edgeMap.get(e.target)!.push({ otherId: e.source, label: e.label });
    });

    // 1. Places cluster
    const placeItems = items.filter((i) => i.type === 'miejsca');
    const placeClusters = placeItems.map((place) => {
      const connected = (edgeMap.get(place.id) || [])
        .map((c) => ({
          item: itemMap.get(c.otherId),
          relation: c.label,
        }))
        .filter((c) => Boolean(c.item));

      return {
        hub: place,
        type: 'miejsca' as CategoryType,
        title: place.title,
        badge: 'Kotwica Lokacyjna',
        accentColor: '#0891B2',
        children: connected,
      };
    });

    // 2. People cluster
    const peopleItems = items.filter((i) => i.type === 'ludzie');
    const peopleClusters = peopleItems.map((person) => {
      const connected = (edgeMap.get(person.id) || [])
        .map((c) => ({
          item: itemMap.get(c.otherId),
          relation: c.label,
        }))
        .filter((c) => Boolean(c.item));

      return {
        hub: person,
        type: 'ludzie' as CategoryType,
        title: person.title,
        badge: person.lifecycle_status === 'in_memoriam' ? 'In memoriam' : 'Bliska relacja',
        accentColor: person.lifecycle_status === 'in_memoriam' ? '#64748B' : '#D97706',
        children: connected,
      };
    });

    // 3. Projects & Initiatives cluster
    const projectItems = items.filter((i) => i.type === 'projekty');
    const projectClusters = projectItems.map((project) => {
      const connected = (edgeMap.get(project.id) || [])
        .map((c) => ({
          item: itemMap.get(c.otherId),
          relation: c.label,
        }))
        .filter((c) => Boolean(c.item));

      return {
        hub: project,
        type: 'projekty' as CategoryType,
        title: project.title,
        badge: 'Projekt & Pasja',
        accentColor: '#7C3AED',
        children: connected,
      };
    });

    // 4. Daily Life & Tasks cluster
    const dailyItems = items.filter(
      (i) =>
        (i.type === 'kalendarz' || i.type === 'zadania') &&
        !peopleItems.some((p) => (edgeMap.get(p.id) || []).some((c) => c.otherId === i.id)) &&
        !placeItems.some((pl) => (edgeMap.get(pl.id) || []).some((c) => c.otherId === i.id)) &&
        !projectItems.some((pr) => (edgeMap.get(pr.id) || []).some((c) => c.otherId === i.id))
    );

    return {
      placeClusters,
      peopleClusters,
      projectClusters,
      dailyItems,
    };
  }, [items, rawGraph.edges]);

  const handleCreateManualEdge = () => {
    if (!selectedNodeId || !manualEdgeTarget || selectedNodeId === manualEdgeTarget) return;
    const newEdge: GraphEdge = {
      id: `edge_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      source: selectedNodeId,
      target: manualEdgeTarget,
      label: 'połączone ręcznie',
      confidence: 1.0,
    };
    onAddEdge(newEdge);
    setManualEdgeTarget('');
  };

  // Quick Inline Capture attached to the selected entity
  const handleQuickCaptureSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickThought.trim() || !selectedItem || isSubmittingQuick) return;

    setIsSubmittingQuick(true);
    try {
      const promptText = `[Kontekst: ${selectedItem.title} (${selectedItem.type})] ${quickThought}`;
      const res = await fetch('/api/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: promptText }),
      });
      if (res.ok) {
        setQuickThought('');
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      console.error('Quick capture error:', err);
    } finally {
      setIsSubmittingQuick(false);
    }
  };

  return (
    <div className="space-y-4 animate-fadeIn select-none">
      {/* Top Header & View Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-[#E9E8E5]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-serif-editorial font-normal text-[#202020]">
              Mapa & Klastry Powiązań
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-[#EFECE6] text-[#606060] text-[11px] font-medium flex items-center gap-1">
              <Zap className="w-3 h-3 text-[#8C7CF0]" />
              <span>d3-force</span> · {items.length} haseł · {edges.length} relacji
            </span>
          </div>
          <p className="text-xs text-[#707070] mt-0.5">
            Zwięzłe hasła z ikonkami z automatycznym układem przestrzennym <strong>d3-force</strong> — kliknij dowolny punkt, aby rozwinąć historię wspomnień i zaplanowane sprawy.
          </p>
        </div>

        {/* View Switcher Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {/* 3 Main View Modes */}
          <div className="flex items-center bg-[#EFECE6] p-1 rounded-xl text-xs">
            <button
              onClick={() => setViewMode('klastry')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                viewMode === 'klastry'
                  ? 'bg-white text-[#202020] shadow-xs'
                  : 'text-[#606060] hover:text-[#202020]'
              }`}
            >
              <GitBranch className="w-3.5 h-3.5 text-[#8C7CF0]" />
              <span>Klastry Haseł</span>
            </button>
            <button
              onClick={() => setViewMode('siec')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                viewMode === 'siec'
                  ? 'bg-white text-[#202020] shadow-xs'
                  : 'text-[#606060] hover:text-[#202020]'
              }`}
            >
              <Network className="w-3.5 h-3.5 text-[#0891B2]" />
              <span>Interaktywny Graf (d3-force)</span>
            </button>
            <button
              onClick={() => setViewMode('drzewo')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                viewMode === 'drzewo'
                  ? 'bg-white text-[#202020] shadow-xs'
                  : 'text-[#606060] hover:text-[#202020]'
              }`}
            >
              <ListTree className="w-3.5 h-3.5 text-[#059669]" />
              <span>Lista Drzewa</span>
            </button>
          </div>

          {/* AI Suggestions button */}
          <button
            onClick={() => setShowSuggestions(!showSuggestions)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
              showSuggestions
                ? 'bg-[#8C7CF0] text-white border-[#8C7CF0]'
                : 'bg-white border-[#E9E8E5] text-[#202020] hover:border-[#8C7CF0]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Relacje ({smartConnections.length})</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-white p-2.5 rounded-xl border border-[#E9E8E5] shadow-2xs">
        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-[#A09E97] absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Szukaj hasła (np. Gdańsk, Kasia, tatuaże)..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#F7F6F2] border border-[#E9E8E5] text-xs text-[#202020] placeholder-[#A09E97] focus:outline-hidden focus:border-[#8C7CF0]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2 text-[#909090] hover:text-[#202020]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Category Pills Filter */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
          <button
            onClick={() => setFilterCategory('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
              filterCategory === 'all'
                ? 'bg-[#202020] text-white'
                : 'bg-[#F7F6F2] text-[#606060] hover:text-[#202020]'
            }`}
          >
            Wszystko ({items.length})
          </button>
          {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => {
            const count = items.filter((i) => i.categories.includes(key as CategoryType)).length;
            if (count === 0 && key !== 'miejsca') return null;
            const Icon = cfg.icon;
            const isActive = filterCategory === key;

            return (
              <button
                key={key}
                onClick={() => setFilterCategory(key as CategoryType)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-[#8C7CF0] text-white'
                    : 'bg-[#F7F6F2] text-[#606060] hover:text-[#202020]'
                }`}
              >
                <Icon className="w-3 h-3" />
                <span>{cfg.label}</span>
                <span className="opacity-75 text-[10px]">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Smart Suggestions Dropdown */}
      {showSuggestions && (
        <div className="bg-white border border-[#E9E8E5] rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#F0EEE8]">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#8C7CF0]" />
              <h3 className="text-sm font-semibold text-[#202020]">Odkryte powiązania kontekstowe AI</h3>
            </div>
            <button onClick={() => setShowSuggestions(false)} className="text-[#909090] hover:text-[#202020]">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {smartConnections.map((sug, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-[#FBFBFA] border border-[#E9E8E5] flex flex-col justify-between space-y-2">
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-[#202020]">
                    <span className="truncate max-w-[120px]">{sug.sourceTitle}</span>
                    <span className="text-[#8C7CF0] text-[10px]">⇄ {sug.suggestedRelation}</span>
                    <span className="truncate max-w-[120px]">{sug.targetTitle}</span>
                  </div>
                  <p className="text-[11px] text-[#707070] mt-1">{sug.reason}</p>
                </div>
                <button
                  onClick={() => {
                    onAddEdge({
                      id: `edge_${Date.now()}_${idx}`,
                      source: sug.sourceId,
                      target: sug.targetId,
                      label: sug.suggestedRelation,
                      confidence: 0.95,
                    });
                  }}
                  className="w-full py-1.5 rounded-lg bg-[#8C7CF0]/10 hover:bg-[#8C7CF0] text-[#8C7CF0] hover:text-white text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <LinkIcon className="w-3.5 h-3.5" />
                  <span>Połącz w mózgu</span>
                </button>
              </div>
            ))}
            {smartConnections.length === 0 && (
              <p className="col-span-full py-4 text-center text-xs text-[#808080]">
                Wszystkie powiązane wątki są już zsynchronizowane.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Main Content Area: Split View between Map/Clusters and Rich Point Expansion */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left / Center: Map Views with Compact Icon Hasła */}
        <div className={`transition-all ${selectedItem ? 'lg:col-span-7' : 'lg:col-span-12'}`}>
          {/* VIEW 1: KLASTRY HASEŁ (COMPACT ICON PILLS) */}
          {viewMode === 'klastry' && (
            <div className="space-y-6">
              {/* Section 1: Kotwice Lokacyjne (Miejsca np. Gdańsk) */}
              {semanticClusters.placeClusters.length > 0 && (
                <div className="bg-white rounded-2xl border border-[#E9E8E5] p-4 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-cyan-100 flex items-center justify-center text-cyan-800">
                        <MapPin className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-[#404040]">
                          Kotwice Lokacyjne & Miejsca
                        </h3>
                        <p className="text-[11px] text-[#707070]">
                          Kliknij miasto/miejsce, aby rozwinąć co tam robiłeś i co planujesz.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Icon Pills Grid */}
                  <div className="flex flex-wrap gap-2.5 pt-1">
                    {semanticClusters.placeClusters.map((cluster) => {
                      const isSelected = selectedNodeId === cluster.hub.id;
                      const count = edgeCountMap.get(cluster.hub.id) || cluster.children.length;

                      return (
                        <button
                          key={cluster.hub.id}
                          onClick={() => setSelectedNodeId(cluster.hub.id)}
                          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[#0891B2] text-white border-[#0891B2] shadow-sm ring-2 ring-[#0891B2]/20 scale-[1.02]'
                              : 'bg-[#F7F6F2] hover:bg-cyan-50 border-[#E9E8E5] hover:border-cyan-300 text-[#202020]'
                          }`}
                        >
                          <span className="text-sm">📍</span>
                          <span className="font-semibold">{cluster.hub.title}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                              isSelected ? 'bg-white/20 text-white' : 'bg-white border border-[#E9E8E5] text-cyan-800'
                            }`}
                          >
                            {count} powiązań
                          </span>
                          <CornerDownRight className={`w-3 h-3 ${isSelected ? 'text-white' : 'text-[#909090]'}`} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Section 2: Ludzie & Relacje (np. Kasia [In memoriam]) */}
              {semanticClusters.peopleClusters.length > 0 && (
                <div className="bg-white rounded-2xl border border-[#E9E8E5] p-4 shadow-2xs space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-amber-100 flex items-center justify-center text-amber-800">
                      <User className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-[#404040]">
                        Ludzie, Relacje & Pamięć
                      </h3>
                      <p className="text-[11px] text-[#707070]">
                        Kliknij osobę, aby zobaczyć wspólne chwile, rocznice i plany.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2.5 pt-1">
                    {semanticClusters.peopleClusters.map((cluster) => {
                      const isSelected = selectedNodeId === cluster.hub.id;
                      const isInMemoriam = cluster.hub.lifecycle_status === 'in_memoriam';
                      const count = edgeCountMap.get(cluster.hub.id) || cluster.children.length;

                      return (
                        <button
                          key={cluster.hub.id}
                          onClick={() => setSelectedNodeId(cluster.hub.id)}
                          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[#8C7CF0] text-white border-[#8C7CF0] shadow-sm ring-2 ring-[#8C7CF0]/20 scale-[1.02]'
                              : isInMemoriam
                              ? 'bg-slate-100/80 border-slate-300 text-slate-800 hover:border-slate-400'
                              : 'bg-[#F7F6F2] hover:bg-amber-50 border-[#E9E8E5] hover:border-amber-300 text-[#202020]'
                          }`}
                        >
                          <span className="text-sm">{isInMemoriam ? '🕊️' : '👤'}</span>
                          <span className="font-semibold">{cluster.hub.title}</span>
                          {isInMemoriam && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200/80 text-slate-700">
                              In memoriam
                            </span>
                          )}
                          <span
                            className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                              isSelected ? 'bg-white/20 text-white' : 'bg-white border border-[#E9E8E5] text-[#606060]'
                            }`}
                          >
                            {count}
                          </span>
                          <CornerDownRight className={`w-3 h-3 ${isSelected ? 'text-white' : 'text-[#909090]'}`} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Section 3: Projekty & Działania (np. Robienie tatuaży + Drukarka) */}
              {semanticClusters.projectClusters.length > 0 && (
                <div className="bg-white rounded-2xl border border-[#E9E8E5] p-4 shadow-2xs space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-purple-100 flex items-center justify-center text-purple-800">
                      <FolderKanban className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-[#404040]">
                        Projekty, Pasje & Przedsięwzięcia
                      </h3>
                      <p className="text-[11px] text-[#707070]">
                        Kliknij projekt, aby zobaczyć powiązany sprzęt, zadania i etapy.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2.5 pt-1">
                    {semanticClusters.projectClusters.map((cluster) => {
                      const isSelected = selectedNodeId === cluster.hub.id;
                      const count = edgeCountMap.get(cluster.hub.id) || cluster.children.length;
                      const emoji = getNodeEmoji({ category: 'projekty', label: cluster.hub.title });

                      return (
                        <button
                          key={cluster.hub.id}
                          onClick={() => setSelectedNodeId(cluster.hub.id)}
                          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[#7C3AED] text-white border-[#7C3AED] shadow-sm ring-2 ring-[#7C3AED]/20 scale-[1.02]'
                              : 'bg-[#F7F6F2] hover:bg-purple-50 border-[#E9E8E5] hover:border-purple-300 text-[#202020]'
                          }`}
                        >
                          <span className="text-sm">{emoji}</span>
                          <span className="font-semibold">{cluster.hub.title}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                              isSelected ? 'bg-white/20 text-white' : 'bg-white border border-[#E9E8E5] text-purple-800'
                            }`}
                          >
                            {count} wątków
                          </span>
                          <CornerDownRight className={`w-3 h-3 ${isSelected ? 'text-white' : 'text-[#909090]'}`} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Section 4: Pozostałe hasła, zadania i kalendarz */}
              <div className="bg-white rounded-2xl border border-[#E9E8E5] p-4 shadow-2xs space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-800">
                    <Calendar className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-[#404040]">
                      Wszystkie Hasła & Punkty Pamięci ({items.length})
                    </h3>
                    <p className="text-[11px] text-[#707070]">
                      Każde hasło posiada ikonkę ułatwiającą identyfikację tematu.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-1 max-h-72 overflow-y-auto no-scrollbar">
                  {items.map((item) => {
                    const isSelected = selectedNodeId === item.id;
                    const emoji = getNodeEmoji({
                      category: item.type,
                      label: item.title,
                      lifecycle_status: item.lifecycle_status,
                    });
                    const count = edgeCountMap.get(item.id) || 0;

                    return (
                      <button
                        key={item.id}
                        onClick={() => setSelectedNodeId(item.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#202020] text-white border-[#202020] shadow-sm ring-2 ring-[#202020]/20'
                            : 'bg-[#FAF9F5] hover:bg-white border-[#E9E8E5] hover:border-[#8C7CF0] text-[#303030]'
                        }`}
                      >
                        <span className="text-xs">{emoji}</span>
                        <span className="font-medium truncate max-w-[140px]">{item.title}</span>
                        {count > 0 && (
                          <span
                            className={`text-[9px] px-1 py-0.2 rounded-full font-semibold ${
                              isSelected ? 'bg-white/20 text-white' : 'bg-[#EFECE6] text-[#707070]'
                            }`}
                          >
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* VIEW 2: INTERAKTYWNY GRAF 2D Z SILNIKIEM D3-FORCE I ZAKRZYWIONYMI RELACJAMI */}
          {viewMode === 'siec' && (
            <div className="relative w-full h-[620px] bg-[#FAF9F5] rounded-2xl border border-[#E9E8E5] overflow-hidden shadow-2xs">
              {/* Canvas Controls Overlay */}
              <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 bg-white/90 backdrop-blur-md p-1 rounded-xl border border-[#E9E8E5] shadow-xs">
                <button
                  onClick={() => setZoom((z) => Math.min(2, z + 0.15))}
                  title="Przybliż"
                  className="p-1.5 rounded-lg hover:bg-[#F0EEE8] text-[#505050] hover:text-[#202020] cursor-pointer"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setZoom((z) => Math.max(0.4, z - 0.15))}
                  title="Oddal"
                  className="p-1.5 rounded-lg hover:bg-[#F0EEE8] text-[#505050] hover:text-[#202020] cursor-pointer"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setZoom(1);
                    setPan({ x: 0, y: 0 });
                    setFocusMode(false);
                  }}
                  title="Wyśrodkuj widok"
                  className="p-1.5 rounded-lg hover:bg-[#F0EEE8] text-[#505050] hover:text-[#202020] cursor-pointer"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
                <div className="w-px h-4 bg-[#E9E8E5] mx-0.5" />
                <button
                  onClick={handleTogglePhysics}
                  title={isPhysicsRunning ? 'Zatrzymaj d3-force' : 'Wznów d3-force'}
                  className="p-1.5 rounded-lg hover:bg-[#F0EEE8] text-[#505050] hover:text-[#202020] cursor-pointer"
                >
                  {isPhysicsRunning ? <Pause className="w-4 h-4 text-purple-700" /> : <Play className="w-4 h-4 text-emerald-600" />}
                </button>
                <button
                  onClick={handleReheatLayout}
                  title="Przelicz układ d3-force (Re-heat)"
                  className="p-1.5 rounded-lg hover:bg-[#F0EEE8] text-[#505050] hover:text-[#8C7CF0] cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>

              {/* Instructions & Technology Pill */}
              <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
                <span className="hidden sm:inline-flex items-center gap-1 bg-[#8C7CF0]/10 text-[#6D28D9] font-medium px-2.5 py-1 rounded-full text-[11px] border border-[#8C7CF0]/25">
                  <Zap className="w-3 h-3 text-[#8C7CF0]" />
                  <span>Układ d3-force</span>
                </span>
                <span className="bg-white/90 backdrop-blur-md px-3 py-1 rounded-full border border-[#E9E8E5] text-[11px] text-[#707070] shadow-xs">
                  Przeciągaj węzły · Kliknij punkt, aby rozwinąć
                </span>
              </div>

              {/* Interactive SVG Canvas */}
              <div
                ref={canvasContainerRef}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                className="w-full h-full cursor-grab active:cursor-grabbing"
              >
                <svg
                  width="100%"
                  height="100%"
                  viewBox="0 0 880 560"
                  className="w-full h-full overflow-visible"
                >
                  {/* Arrow markers and glow filters */}
                  <defs>
                    <marker
                      id="relation-arrow"
                      viewBox="0 0 10 10"
                      refX="22"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#B8B5AB" />
                    </marker>
                    <marker
                      id="relation-arrow-highlight"
                      viewBox="0 0 10 10"
                      refX="22"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#8C7CF0" />
                    </marker>
                  </defs>

                  <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                    {/* Organic Curved Connection Lines computed from d3-force coordinates */}
                    {d3Links.map((link, idx) => {
                      const s =
                        typeof link.source === 'object'
                          ? (link.source as D3GraphNode)
                          : d3Nodes.find((n) => n.id === link.source);
                      const t =
                        typeof link.target === 'object'
                          ? (link.target as D3GraphNode)
                          : d3Nodes.find((n) => n.id === link.target);

                      if (
                        !s ||
                        !t ||
                        typeof s.x !== 'number' ||
                        typeof s.y !== 'number' ||
                        typeof t.x !== 'number' ||
                        typeof t.y !== 'number'
                      ) {
                        return null;
                      }

                      const isHighlighted = selectedNodeId === s.id || selectedNodeId === t.id;

                      // Calculate organic curve to prevent overlapping mutual links
                      const curveOffset = (idx % 2 === 0 ? 1 : -1) * (18 + (idx % 3) * 6);
                      const { path, midX, midY } = calculateCurvedLinkPath(s.x, s.y, t.x, t.y, curveOffset);

                      return (
                        <g key={link.id} className="transition-opacity duration-200">
                          {/* Glowing background path when highlighted */}
                          {isHighlighted && (
                            <path
                              d={path}
                              fill="none"
                              stroke="#8C7CF0"
                              strokeWidth={6}
                              strokeOpacity={0.25}
                              strokeLinecap="round"
                            />
                          )}

                          {/* Curved filament link */}
                          <path
                            d={path}
                            fill="none"
                            stroke={isHighlighted ? '#8C7CF0' : '#D1CEBF'}
                            strokeWidth={isHighlighted ? 2.5 : 1.3}
                            strokeDasharray={isHighlighted ? 'none' : '4 3'}
                            markerEnd={isHighlighted ? 'url(#relation-arrow-highlight)' : 'url(#relation-arrow)'}
                          />

                          {/* Label badge placed smoothly along the curve */}
                          <g transform={`translate(${midX}, ${midY})`}>
                            <rect
                              x={-((link.label.length * 5.2) / 2 + 6)}
                              y={-9}
                              width={link.label.length * 5.2 + 12}
                              height={18}
                              rx={5}
                              fill="white"
                              stroke={isHighlighted ? '#8C7CF0' : '#E2DFD7'}
                              strokeWidth={isHighlighted ? 1.5 : 1}
                              filter="drop-shadow(0 1px 2px rgba(0,0,0,0.05))"
                            />
                            <text
                              textAnchor="middle"
                              y={3.5}
                              fontSize={8.5}
                              fontWeight="600"
                              fill={isHighlighted ? '#6D28D9' : '#64748B'}
                              fontFamily="system-ui, sans-serif"
                            >
                              {link.label}
                            </text>
                          </g>
                        </g>
                      );
                    })}

                    {/* Nodes as Sleek Compact Icon Pills Positioned by d3-force */}
                    {d3Nodes.map((node) => {
                      if (typeof node.x !== 'number' || typeof node.y !== 'number') return null;

                      const isSelected = selectedNodeId === node.id;
                      const cfg = CATEGORY_CONFIG[node.category] || CATEGORY_CONFIG.wspomnienia;
                      const isInMemoriam = node.lifecycle_status === 'in_memoriam';
                      const isPlace = node.category === 'miejsca';
                      const emoji = getNodeEmoji({
                        category: node.category,
                        label: node.label,
                        lifecycle_status: node.lifecycle_status,
                      });

                      const count = edgeCountMap.get(node.id) || 0;
                      const cleanLabel = node.label.length > 18 ? `${node.label.slice(0, 16)}...` : node.label;
                      const pillWidth = Math.max(90, cleanLabel.length * 7.5 + 46);
                      const pillHeight = 34;

                      return (
                        <g
                          key={node.id}
                          transform={`translate(${node.x}, ${node.y})`}
                          className="interactive-node cursor-pointer transition-transform duration-75"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setDraggedNodeId(node.id);
                            node.fx = node.x;
                            node.fy = node.y;
                            d3SimRef.current?.alphaTarget(0.3).restart();
                          }}
                          onClick={() => setSelectedNodeId(node.id)}
                        >
                          {/* Selection aura */}
                          {isSelected && (
                            <rect
                              x={-(pillWidth / 2 + 4)}
                              y={-(pillHeight / 2 + 4)}
                              width={pillWidth + 8}
                              height={pillHeight + 8}
                              rx={21}
                              fill="none"
                              stroke="#8C7CF0"
                              strokeWidth={2}
                              strokeDasharray="4 2"
                            />
                          )}

                          {/* Pill Base */}
                          <rect
                            x={-pillWidth / 2}
                            y={-pillHeight / 2}
                            width={pillWidth}
                            height={pillHeight}
                            rx={17}
                            fill={isSelected ? '#FFFFFF' : '#FFFFFF'}
                            stroke={
                              isSelected
                                ? '#8C7CF0'
                                : isInMemoriam
                                ? '#94A3B8'
                                : isPlace
                                ? '#0891B2'
                                : cfg.borderColor
                            }
                            strokeWidth={isSelected ? 2 : 1.5}
                            filter="drop-shadow(0 2px 4px rgba(0,0,0,0.06))"
                          />

                          {/* Left Icon Circle */}
                          <circle
                            cx={-pillWidth / 2 + 16}
                            cy={0}
                            r={11}
                            fill={isInMemoriam ? '#F1F5F9' : isPlace ? '#CFFAFE' : cfg.bgLight}
                          />

                          {/* Icon Emoji */}
                          <text
                            x={-pillWidth / 2 + 16}
                            y={4.5}
                            textAnchor="middle"
                            fontSize={11}
                            fontFamily="Apple Color Emoji, Segoe UI Emoji, system-ui, sans-serif"
                          >
                            {emoji}
                          </text>

                          {/* Keyword Label */}
                          <text
                            x={-pillWidth / 2 + 33}
                            y={3.5}
                            fontSize={11}
                            fontWeight="600"
                            fill="#1E293B"
                            fontFamily="system-ui, sans-serif"
                          >
                            {cleanLabel}
                          </text>

                          {/* Count Badge on Right if connected */}
                          {count > 0 && (
                            <text
                              x={pillWidth / 2 - 10}
                              y={3.5}
                              textAnchor="middle"
                              fontSize={9}
                              fontWeight="700"
                              fill={isSelected ? '#8C7CF0' : '#94A3B8'}
                              fontFamily="system-ui, sans-serif"
                            >
                              {count}
                            </text>
                          )}
                        </g>
                      );
                    })}
                  </g>
                </svg>
              </div>
            </div>
          )}

          {/* VIEW 3: DRZEWO RELACJI */}
          {viewMode === 'drzewo' && (
            <div className="bg-white rounded-2xl border border-[#E9E8E5] p-5 shadow-2xs space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-[#202020] uppercase tracking-wider">
                  Struktura & Drzewo Powiązań
                </h3>
                <p className="text-xs text-[#707070]">
                  Hierarchiczna lista głównych wątków. Kliknij hasło, aby zbadać jego rozwinięcie.
                </p>
              </div>

              <div className="space-y-4">
                {/* 1. Miejsca */}
                {semanticClusters.placeClusters.map((cluster) => (
                  <div key={cluster.hub.id} className="p-3.5 rounded-xl bg-[#F7F6F2] border border-[#E9E8E5] space-y-2">
                    <div
                      onClick={() => setSelectedNodeId(cluster.hub.id)}
                      className="flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">📍</span>
                        <span className="font-semibold text-sm text-[#202020]">{cluster.hub.title}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-cyan-100 text-cyan-800 font-medium">
                          Kotwica lokacyjna
                        </span>
                      </div>
                      <span className="text-xs text-[#0891B2] font-semibold">Rozwiń punkt →</span>
                    </div>

                    <div className="pl-6 border-l-2 border-[#0891B2]/30 space-y-1.5 pt-1">
                      {cluster.children.map(({ item, relation }, cIdx) => (
                        <div
                          key={cIdx}
                          onClick={() => setSelectedNodeId(item!.id)}
                          className="flex items-center justify-between text-xs p-1.5 rounded-lg bg-white border border-[#E9E8E5] hover:border-[#0891B2] cursor-pointer"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs">{getNodeEmoji({ category: item!.type, label: item!.title })}</span>
                            <span className="text-[#303030] font-medium">{item!.title}</span>
                          </div>
                          <span className="text-[10px] text-[#0891B2] font-medium">{relation}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {/* 2. Ludzie */}
                {semanticClusters.peopleClusters.map((cluster) => (
                  <div key={cluster.hub.id} className="p-3.5 rounded-xl bg-[#F7F6F2] border border-[#E9E8E5] space-y-2">
                    <div
                      onClick={() => setSelectedNodeId(cluster.hub.id)}
                      className="flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">{cluster.hub.lifecycle_status === 'in_memoriam' ? '🕊️' : '👤'}</span>
                        <span className="font-semibold text-sm text-[#202020]">{cluster.hub.title}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            cluster.hub.lifecycle_status === 'in_memoriam'
                              ? 'bg-slate-200 text-slate-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {cluster.badge}
                        </span>
                      </div>
                      <span className="text-xs text-[#8C7CF0] font-semibold">Rozwiń punkt →</span>
                    </div>

                    <div className="pl-6 border-l-2 border-[#D97706]/30 space-y-1.5 pt-1">
                      {cluster.children.map(({ item, relation }, cIdx) => (
                        <div
                          key={cIdx}
                          onClick={() => setSelectedNodeId(item!.id)}
                          className="flex items-center justify-between text-xs p-1.5 rounded-lg bg-white border border-[#E9E8E5] hover:border-[#8C7CF0] cursor-pointer"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs">{getNodeEmoji({ category: item!.type, label: item!.title })}</span>
                            <span className="text-[#303030] font-medium">{item!.title}</span>
                          </div>
                          <span className="text-[10px] text-[#707070] font-medium">{relation}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: PEŁNE ROZWINIĘCIE PUNKTU (np. Gdańsk -> co robił, co ma zaplanowane) */}
        {selectedItem && drilldownData && (
          <div className="lg:col-span-5 bg-white rounded-2xl border border-[#E9E8E5] p-4 shadow-sm space-y-4 animate-fadeIn">
            {/* Header of the Expanded Point */}
            <div className="flex items-start justify-between pb-3 border-b border-[#F0EEE8]">
              <div className="flex items-start gap-3">
                <div
                  className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0 shadow-2xs"
                  style={{
                    backgroundColor: CATEGORY_CONFIG[selectedItem.categories[0]]?.bgLight || '#EDE9FE',
                    border: `1px solid ${CATEGORY_CONFIG[selectedItem.categories[0]]?.borderColor || '#C4B5FD'}`,
                  }}
                >
                  {getNodeEmoji({
                    category: selectedItem.type,
                    label: selectedItem.title,
                    lifecycle_status: selectedItem.lifecycle_status,
                  })}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider"
                      style={{
                        backgroundColor: CATEGORY_CONFIG[selectedItem.categories[0]]?.bgLight || '#EDE9FE',
                        color: CATEGORY_CONFIG[selectedItem.categories[0]]?.color || '#8C7CF0',
                      }}
                    >
                      {CATEGORY_CONFIG[selectedItem.categories[0]]?.label || selectedItem.type}
                    </span>
                    {selectedItem.lifecycle_status === 'in_memoriam' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-200 text-slate-800 border border-slate-300">
                        In memoriam
                      </span>
                    )}
                    {selectedItem.type === 'miejsca' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-cyan-100 text-cyan-800 border border-cyan-200">
                        Kotwica lokacyjna
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold text-[#202020] mt-1 leading-snug">
                    {selectedItem.title}
                  </h3>
                  <p className="text-[11px] text-[#707070] mt-0.5">
                    {selectedItem.description}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedNodeId(null)}
                title="Zamknij rozwinięcie"
                className="p-1 rounded-lg text-[#909090] hover:text-[#202020] hover:bg-[#F0EEE8] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drilldown Tabs */}
            <div className="flex items-center gap-1 bg-[#F7F6F2] p-1 rounded-xl text-xs">
              <button
                onClick={() => setDrilldownTab('all')}
                className={`flex-1 py-1.5 rounded-lg font-medium transition-all cursor-pointer text-center ${
                  drilldownTab === 'all'
                    ? 'bg-white text-[#202020] shadow-xs'
                    : 'text-[#606060] hover:text-[#202020]'
                }`}
              >
                Wszystko ({drilldownData.totalCount})
              </button>
              <button
                onClick={() => setDrilldownTab('memories')}
                className={`flex-1 py-1.5 rounded-lg font-medium transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  drilldownTab === 'memories'
                    ? 'bg-white text-[#DB2777] shadow-xs'
                    : 'text-[#606060] hover:text-[#202020]'
                }`}
              >
                <span>🕰️ Co robiłeś</span>
                <span className="text-[10px] opacity-75">({drilldownData.memories.length})</span>
              </button>
              <button
                onClick={() => setDrilldownTab('plans')}
                className={`flex-1 py-1.5 rounded-lg font-medium transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  drilldownTab === 'plans'
                    ? 'bg-white text-[#2563EB] shadow-xs'
                    : 'text-[#606060] hover:text-[#202020]'
                }`}
              >
                <span>🗓️ Zaplanowane</span>
                <span className="text-[10px] opacity-75">({drilldownData.plans.length})</span>
              </button>
              <button
                onClick={() => setDrilldownTab('ai')}
                className={`py-1.5 px-2.5 rounded-lg font-medium transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  drilldownTab === 'ai'
                    ? 'bg-white text-[#8C7CF0] shadow-xs'
                    : 'text-[#606060] hover:text-[#202020]'
                }`}
              >
                <Info className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* TAB CONTENT: 1. CO KIEDY TAM ROBIŁ UŻYTKOWNIK */}
            {(drilldownTab === 'all' || drilldownTab === 'memories') && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#DB2777]">
                    <History className="w-3.5 h-3.5" />
                    <span>Co kiedy tam robiłeś (Wspomnienia & Historia)</span>
                  </div>
                  <span className="text-[10px] text-[#707070] font-medium">
                    {drilldownData.memories.length} wpisów
                  </span>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto no-scrollbar">
                  {drilldownData.memories.map(({ item, date, relationLabel }) => (
                    <div
                      key={item.id}
                      onClick={() => item.id !== selectedItem.id && setSelectedNodeId(item.id)}
                      className={`p-3 rounded-xl border transition-all text-xs space-y-1.5 ${
                        item.id === selectedItem.id
                          ? 'bg-[#FDF2F8] border-[#FBCFE8]'
                          : 'bg-[#FAF9F5] hover:bg-white border-[#E9E8E5] cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-[#DB2777] flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {date}
                        </span>
                        {relationLabel && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-white border border-[#E9E8E5] text-[#707070]">
                            {relationLabel}
                          </span>
                        )}
                      </div>
                      <h4 className="font-semibold text-[#202020] text-xs leading-snug">
                        {item.title}
                      </h4>
                      <p className="text-[11px] text-[#505050] leading-relaxed">
                        {item.description}
                      </p>
                      {item.raw_input && (
                        <p className="text-[10px] text-[#808080] italic">
                          Wypowiedź: „{item.raw_input}”
                        </p>
                      )}
                      {(item.tags || []).length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {item.tags.map((t, idx) => (
                            <span key={idx} className="text-[9px] px-1.5 py-0.2 rounded-full bg-white text-[#606060] border border-[#E9E8E5]">
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                  {drilldownData.memories.length === 0 && (
                    <div className="p-3 text-center rounded-xl bg-[#FBFBFA] border border-[#E9E8E5] text-xs text-[#808080]">
                      Brak zarejestrowanych wspomnień w tym punkcie.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT: 2. CO MA ZAPLANOWANE */}
            {(drilldownTab === 'all' || drilldownTab === 'plans') && (
              <div className="space-y-2 pt-1 border-t border-[#F0EEE8]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#2563EB]">
                    <CalendarDays className="w-3.5 h-3.5" />
                    <span>Co masz zaplanowane (Terminy & Zadania)</span>
                  </div>
                  <span className="text-[10px] text-[#707070] font-medium">
                    {drilldownData.plans.length} planów
                  </span>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto no-scrollbar">
                  {drilldownData.plans.map(({ item, date, isTask, isCompleted, relationLabel }) => (
                    <div
                      key={item.id}
                      onClick={() => item.id !== selectedItem.id && setSelectedNodeId(item.id)}
                      className={`p-3 rounded-xl border transition-all text-xs space-y-1.5 ${
                        item.id === selectedItem.id
                          ? 'bg-[#EFF6FF] border-[#BFDBFE]'
                          : isCompleted
                          ? 'bg-slate-50 border-slate-200 opacity-60'
                          : 'bg-[#FAF9F5] hover:bg-white border-[#E9E8E5] cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-[#2563EB] flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {date}
                        </span>
                        {relationLabel && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-white border border-[#E9E8E5] text-[#707070]">
                            {relationLabel}
                          </span>
                        )}
                      </div>
                      <div className="flex items-start gap-2">
                        {isTask && onToggleTask && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleTask(item.id);
                            }}
                            className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center border transition-all cursor-pointer ${
                              isCompleted
                                ? 'bg-emerald-600 border-emerald-600 text-white'
                                : 'border-[#94A3B8] hover:border-emerald-600 bg-white'
                            }`}
                          >
                            {isCompleted && <Check className="w-3 h-3 stroke-[3]" />}
                          </button>
                        )}
                        <div>
                          <h4 className={`font-semibold text-xs leading-snug ${isCompleted ? 'line-through text-[#808080]' : 'text-[#202020]'}`}>
                            {item.title}
                          </h4>
                          <p className="text-[11px] text-[#505050] leading-relaxed mt-0.5">
                            {item.description}
                          </p>
                        </div>
                      </div>
                      {item.raw_input && (
                        <p className="text-[10px] text-[#808080] italic">
                          Wypowiedź: „{item.raw_input}”
                        </p>
                      )}
                    </div>
                  ))}

                  {drilldownData.plans.length === 0 && (
                    <div className="p-3 text-center rounded-xl bg-[#FBFBFA] border border-[#E9E8E5] text-xs text-[#808080]">
                      Brak zaplanowanych zadań ani terminów w tym punkcie.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT: 3. POWIĄZANE POMYSŁY, OSOBY & KONCEPCJE */}
            {drilldownTab === 'all' && drilldownData.otherLinks.length > 0 && (
              <div className="space-y-2 pt-1 border-t border-[#F0EEE8]">
                <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-[#707070]">
                  <span>Powiązane idee & wątki ({drilldownData.otherLinks.length})</span>
                </div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto no-scrollbar">
                  {drilldownData.otherLinks.map(({ item, edge }) => (
                    <div
                      key={item.id}
                      onClick={() => setSelectedNodeId(item.id)}
                      className="p-2 rounded-xl bg-[#FAF9F5] hover:bg-white border border-[#E9E8E5] flex items-center justify-between text-xs cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs">{getNodeEmoji({ category: item.type, label: item.title })}</span>
                        <span className="font-semibold text-[#202020] truncate">{item.title}</span>
                      </div>
                      <span className="text-[10px] text-[#8C7CF0] font-medium shrink-0">
                        {edge?.label || 'powiązane'} →
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB CONTENT: 4. AI INTELIGENCJA & TEMPORAL MEMORY */}
            {(drilldownTab === 'all' || drilldownTab === 'ai') && (
              <div className="p-3 rounded-xl bg-[#FBFBFA] border border-[#E9E8E5] space-y-2 text-xs">
                <div className="flex items-center gap-1.5 font-semibold text-[#303030]">
                  <Info className="w-3.5 h-3.5 text-[#8C7CF0]" />
                  <span>Pamięć temporalna & Dlaczego AI to zapisało</span>
                </div>
                <p className="text-[11px] text-[#606060] leading-relaxed">
                  {selectedItem.ai_classification_reason || 'Wyodrębniono automatycznie z intencji użytkownika.'}
                </p>

                {drilldownData.matchingFacts.length > 0 && (
                  <div className="pt-2 border-t border-[#F0EEE8] space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[#707070]">
                      Utrwalone fakty w pamięci:
                    </span>
                    {drilldownData.matchingFacts.map((fact) => (
                      <div key={fact.id} className="text-[11px] text-[#404040] flex items-center justify-between bg-white px-2 py-1 rounded border border-[#E9E8E5]">
                        <span className="font-medium">{fact.subject}:</span>
                        <span className="text-[#8C7CF0] font-semibold">{fact.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* SZYBKIE DODANIE MYŚLI DO TEGO PUNKTU */}
            <form onSubmit={handleQuickCaptureSubmit} className="pt-2 border-t border-[#F0EEE8] space-y-1.5">
              <label className="text-[11px] font-semibold text-[#404040] flex items-center justify-between">
                <span>Dodaj wspomnienie lub plan do punktu {selectedItem.title}:</span>
                <span className="text-[10px] text-[#8C7CF0] font-normal">Automatycznie połączy</span>
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={quickThought}
                  onChange={(e) => setQuickThought(e.target.value)}
                  placeholder={`np. Byliśmy w kawiarni w ${selectedItem.title}...`}
                  className="flex-1 bg-[#F7F6F2] border border-[#E9E8E5] rounded-xl text-xs text-[#202020] px-3 py-2 focus:outline-hidden focus:border-[#8C7CF0]"
                />
                <button
                  type="submit"
                  disabled={!quickThought.trim() || isSubmittingQuick}
                  className="px-3.5 py-2 rounded-xl bg-[#8C7CF0] hover:bg-[#7866e4] disabled:opacity-40 text-white text-xs font-semibold transition-all cursor-pointer flex items-center gap-1"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Zapisz</span>
                </button>
              </div>
            </form>

            {/* Ręczne łączenie z innym punktem */}
            <div className="pt-2 border-t border-[#F0EEE8] flex items-center gap-1.5">
              <select
                value={manualEdgeTarget}
                onChange={(e) => setManualEdgeTarget(e.target.value)}
                className="flex-1 bg-[#F7F6F2] border border-[#E9E8E5] rounded-xl text-xs text-[#202020] px-2.5 py-1.5 focus:outline-hidden focus:border-[#8C7CF0]"
              >
                <option value="">Połącz {selectedItem.title} z innym hasłem...</option>
                {items
                  .filter((i) => i.id !== selectedItem.id)
                  .map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.title} ({i.type})
                    </option>
                  ))}
              </select>
              <button
                disabled={!manualEdgeTarget}
                onClick={handleCreateManualEdge}
                className="px-3 py-1.5 rounded-xl bg-[#202020] hover:bg-[#404040] disabled:opacity-40 text-white text-xs font-semibold transition-all cursor-pointer"
              >
                Połącz
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
