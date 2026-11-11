import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  forceX,
  forceY,
  Simulation,
  SimulationNodeDatum,
  SimulationLinkDatum,
} from 'd3-force';
import { AnyBrainItem, CategoryType, GraphEdge, GraphNode } from '../types';

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface SimNode extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  pinned?: boolean;
}

export interface D3GraphNode extends SimulationNodeDatum, GraphNode {
  id: string;
  radius: number;
  width?: number;
  height?: number;
  lifecycle_status?: 'active' | 'in_memoriam' | 'archived' | 'completed';
}

export interface D3GraphLink extends SimulationLinkDatum<D3GraphNode> {
  id: string;
  source: string | D3GraphNode;
  target: string | D3GraphNode;
  label: string;
  confidence?: number;
}

export function buildGraphData(items: AnyBrainItem[], storedEdges: GraphEdge[] = []): GraphData {
  const nodes: GraphNode[] = items.map((item) => {
    let subtitle = '';
    if (item.type === 'ludzie') {
      subtitle = item.lifecycle_status === 'in_memoriam' ? 'In memoriam' : ((item as any).relationship || 'Osoba');
    } else if (item.type === 'miejsca') {
      subtitle = `Lokalizacja (${(item as any).visit_count || 1} powiązania)`;
    } else if (item.type === 'kalendarz') {
      subtitle = (item as any).is_annual_recurring ? 'Coroczne' : (item as any).start_time || 'Wydarzenie';
    } else if (item.type === 'zadania') {
      subtitle =
        item.lifecycle_status === 'archived'
          ? 'Zarchiwizowane'
          : (item as any).is_completed
          ? 'Ukończone'
          : `Termin: ${(item as any).due_date || 'brak'}`;
    } else if (item.type === 'pomysly') {
      subtitle = `Status: ${(item as any).stage || 'pomysł'}`;
    } else if (item.type === 'projekty') {
      subtitle = `Projekt: ${(item as any).status || 'w toku'}`;
    } else {
      subtitle = item.categories.join(', ');
    }

    return {
      id: item.id,
      label: item.title,
      category: item.categories[0] || ('wspomnienia' as CategoryType),
      subtitle,
      importance: item.pinned || item.lifecycle_status === 'in_memoriam' || item.type === 'miejsca' ? 2 : 1,
      tags: item.tags,
      lifecycle_status: item.lifecycle_status,
    };
  });

  const nodeIds = new Set(nodes.map((n) => n.id));
  const validEdges = storedEdges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));

  return { nodes, edges: validEdges };
}

/**
 * Focus mode: extracts a subgraph centered on a specific node,
 * keeping only direct (1-hop) and secondary (2-hop) connections.
 */
export function getFocusedSubgraph(
  graph: GraphData,
  focusNodeId: string,
  maxHops: number = 1
): GraphData {
  const centerNode = graph.nodes.find((n) => n.id === focusNodeId);
  if (!centerNode) return graph;

  const includedNodeIds = new Set<string>([focusNodeId]);

  for (let hop = 0; hop < maxHops; hop++) {
    const currentBatch = Array.from(includedNodeIds);
    for (const edge of graph.edges) {
      if (currentBatch.includes(edge.source)) {
        includedNodeIds.add(edge.target);
      }
      if (currentBatch.includes(edge.target)) {
        includedNodeIds.add(edge.source);
      }
    }
  }

  const nodes = graph.nodes.filter((n) => includedNodeIds.has(n.id));
  const edges = graph.edges.filter(
    (e) => includedNodeIds.has(e.source) && includedNodeIds.has(e.target)
  );

  return { nodes, edges };
}

export interface SuggestedConnection {
  sourceId: string;
  targetId: string;
  sourceTitle: string;
  targetTitle: string;
  reason: string;
  suggestedRelation: string;
}

/**
 * Smart Connections: detects potential implicit links across items
 */
export function detectSmartConnections(
  items: AnyBrainItem[],
  existingEdges: GraphEdge[]
): SuggestedConnection[] {
  const suggestions: SuggestedConnection[] = [];
  const existingKey = new Set(
    existingEdges.flatMap((e) => [`${e.source}|${e.target}`, `${e.target}|${e.source}`])
  );

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];

      if (existingKey.has(`${a.id}|${b.id}`)) continue;

      // 1. Shared tags check
      const commonTags = (a.tags || []).filter(
        (t) => (b.tags || []).includes(t) && !['kalendarz', 'zadania', 'wspomnienia', 'pomysly'].includes(t)
      );

      if (commonTags.length > 0) {
        suggestions.push({
          sourceId: a.id,
          targetId: b.id,
          sourceTitle: a.title,
          targetTitle: b.title,
          reason: `Wspólny kontekst: „${commonTags[0]}”`,
          suggestedRelation: 'wspólny wątek',
        });
        continue;
      }

      // 2. Resource & Project relation (e.g. drukarka i tatuaże)
      const aDesc = `${a.title} ${a.description}`.toLowerCase();
      const bDesc = `${b.title} ${b.description}`.toLowerCase();

      if (
        (aDesc.includes('tatuaż') && bDesc.includes('tatuaż')) ||
        (aDesc.includes('biżuteri') && bDesc.includes('biżuteri')) ||
        (aDesc.includes('kasi') && bDesc.includes('kasi'))
      ) {
        suggestions.push({
          sourceId: a.id,
          targetId: b.id,
          sourceTitle: a.title,
          targetTitle: b.title,
          reason: `Oba rekordy nawiązują do tego samego tematu`,
          suggestedRelation: 'powiązane tematycznie',
        });
        continue;
      }

      // 3. Person mentioned in task or event
      if (a.type === 'ludzie' && (b.type === 'zadania' || b.type === 'kalendarz' || b.type === 'wspomnienia')) {
        const personName = a.title.toLowerCase();
        if (b.description.toLowerCase().includes(personName) || b.title.toLowerCase().includes(personName)) {
          suggestions.push({
            sourceId: a.id,
            targetId: b.id,
            sourceTitle: a.title,
            targetTitle: b.title,
            reason: `Wpis dotyczy osoby ${a.title}`,
            suggestedRelation: 'dotyczy',
          });
        }
      }
    }
  }

  return suggestions.slice(0, 6);
}

/**
 * Creates an intelligent d3-force simulation to layout graph nodes and relationships
 * in a clear, spatial, and organic force-directed configuration.
 */
export function createD3ForceSimulation(
  nodes: D3GraphNode[],
  links: D3GraphLink[],
  width: number = 880,
  height: number = 560,
  options: {
    linkDistance?: number;
    chargeStrength?: number;
    collisionRadius?: number;
    alphaDecay?: number;
  } = {}
): Simulation<D3GraphNode, D3GraphLink> {
  const linkDistance = options.linkDistance ?? 160;
  const chargeStrength = options.chargeStrength ?? -420;
  const collisionRadius = options.collisionRadius ?? 48;

  const sim = forceSimulation<D3GraphNode>(nodes)
    .force(
      'link',
      forceLink<D3GraphNode, D3GraphLink>(links)
        .id((d) => d.id)
        .distance((d) => {
          // Places, people hubs, and primary project links get extra spatial room
          const isAnchorEdge =
            d.label === 'miejsce' ||
            d.label === 'lokalizacja' ||
            d.label === 'niezbędna do' ||
            d.label === 'spotkanie z';
          return isAnchorEdge ? linkDistance * 1.25 : linkDistance;
        })
        .strength(0.45)
    )
    .force(
      'charge',
      forceManyBody<D3GraphNode>()
        .strength((d) => {
          // Hub nodes (places, in_memoriam people, main projects) exert stronger repulsion
          if (d.category === 'miejsca' || d.category === 'projekty' || d.lifecycle_status === 'in_memoriam') {
            return chargeStrength * 1.5;
          }
          return chargeStrength;
        })
        .distanceMin(30)
        .distanceMax(650)
    )
    .force('center', forceCenter<D3GraphNode>(width / 2, height / 2).strength(0.08))
    .force(
      'collide',
      forceCollide<D3GraphNode>()
        .radius((d) => (d.radius || 35) + collisionRadius * 0.35)
        .iterations(3)
        .strength(0.9)
    )
    // Soft gentle force towards center to keep everything inside view
    .force('x', forceX<D3GraphNode>(width / 2).strength(0.035))
    .force('y', forceY<D3GraphNode>(height / 2).strength(0.035))
    .alphaDecay(options.alphaDecay ?? 0.025);

  return sim;
}

/**
 * Calculates a smooth curved Bézier path between two coordinates,
 * preventing overlapping straight lines and producing an organic, neural flow.
 */
export function calculateCurvedLinkPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  curvature: number = 22
): {
  path: string;
  midX: number;
  midY: number;
} {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;

  // Normal unit vector
  const nx = -dy / len;
  const ny = dx / len;

  // Control point displaced along the normal
  const cx = mx + nx * curvature;
  const cy = my + ny * curvature;

  // Midpoint along the quadratic curve at t = 0.5
  // B(0.5) = 0.25*P0 + 0.5*P1 + 0.25*P2
  const midX = 0.25 * x1 + 0.5 * cx + 0.25 * x2;
  const midY = 0.25 * y1 + 0.5 * cy + 0.25 * y2;

  const path = `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;

  return { path, midX, midY };
}

/**
 * Legacy physics simulation step (preserved for compatibility)
 */
export function stepPhysics(
  simNodes: SimNode[],
  edges: GraphEdge[],
  width: number,
  height: number,
  options: {
    repulsion?: number;
    springLength?: number;
    springK?: number;
    gravity?: number;
    damping?: number;
  } = {}
) {
  const repulsion = options.repulsion ?? 3200;
  const springLength = options.springLength ?? 130;
  const springK = options.springK ?? 0.045;
  const gravity = options.gravity ?? 0.035;
  const damping = options.damping ?? 0.88;

  const centerX = width / 2;
  const centerY = height / 2;

  for (let i = 0; i < simNodes.length; i++) {
    for (let j = i + 1; j < simNodes.length; j++) {
      const n1 = simNodes[i];
      const n2 = simNodes[j];
      const dx = n2.x - n1.x;
      const dy = n2.y - n1.y;
      const distSq = dx * dx + dy * dy || 1;
      const dist = Math.sqrt(distSq);

      const force = repulsion / distSq;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;

      if (!n1.pinned) {
        n1.vx -= fx;
        n1.vy -= fy;
      }
      if (!n2.pinned) {
        n2.vx += fx;
        n2.vy += fy;
      }
    }
  }

  const nodeMap = new Map<string, SimNode>(simNodes.map((n) => [n.id, n]));

  for (const edge of edges) {
    const s = nodeMap.get(edge.source);
    const t = nodeMap.get(edge.target);
    if (!s || !t) continue;

    const dx = t.x - s.x;
    const dy = t.y - s.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const displacement = dist - springLength;
    const force = springK * displacement;

    const fx = (dx / dist) * force;
    const fy = (dy / dist) * force;

    if (!s.pinned) {
      s.vx += fx;
      s.vy += fy;
    }
    if (!t.pinned) {
      t.vx -= fx;
      t.vy -= fy;
    }
  }

  for (const n of simNodes) {
    if (n.pinned) continue;

    const gdx = centerX - n.x;
    const gdy = centerY - n.y;
    n.vx += gdx * gravity;
    n.vy += gdy * gravity;

    n.vx *= damping;
    n.vy *= damping;

    n.x += n.vx;
    n.y += n.vy;

    const pad = 40;
    if (n.x < pad) {
      n.x = pad;
      n.vx = 0;
    } else if (n.x > width - pad) {
      n.x = width - pad;
      n.vx = 0;
    }
    if (n.y < pad) {
      n.y = pad;
      n.vy = 0;
    } else if (n.y > height - pad) {
      n.y = height - pad;
      n.vy = 0;
    }
  }
}
