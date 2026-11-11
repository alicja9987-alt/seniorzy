import { AnyBrainItem, CategoryType, EntityMutation, GraphEdge, PlaceItem, TemporalFact } from '../types';

/**
 * Normalizes strings for robust matching (e.g. Kasia / Kasią / Kasi)
 */
export function normalizeEntityName(name: string): string {
  if (!name) return '';
  const cleaned = name.trim().toLowerCase();
  // Polish inflection stem normalization for common names
  if (cleaned.startsWith('kasi') || cleaned === 'kasia') return 'kasia';
  if (cleaned.startsWith('tomk') || cleaned === 'tomasz' || cleaned === 'tomek') return 'tomek';
  if (cleaned.startsWith('ani') || cleaned === 'anna' || cleaned === 'ania') return 'ania';
  if (cleaned.startsWith('mich') || cleaned === 'michał' || cleaned === 'michal') return 'michał';
  if (cleaned.startsWith('piotr') || cleaned === 'piotrek') return 'piotr';
  // Common Polish cities normalization
  if (cleaned.startsWith('gdańsk') || cleaned.startsWith('gdansk') || cleaned.startsWith('gdańsku') || cleaned.startsWith('gdanska')) return 'gdańsk';
  if (cleaned.startsWith('warszaw') || cleaned === 'warszawa') return 'warszawa';
  if (cleaned.startsWith('krakow') || cleaned.startsWith('kraków')) return 'kraków';
  if (cleaned.startsWith('wrocł') || cleaned.startsWith('wrocl')) return 'wrocław';
  if (cleaned.startsWith('sopot')) return 'sopot';
  if (cleaned.startsWith('gdyni')) return 'gdynia';
  return cleaned;
}

export interface ExtractedPayload {
  summary: string;
  items: Array<{
    type: CategoryType;
    title: string;
    description: string;
    categories?: CategoryType[];
    target_date?: string;
    tags?: string[];
    ai_classification_reason: string;
    details?: Record<string, any>;
  }>;
  temporal_facts?: Array<{
    subject: string;
    value: string;
    entity_type: 'user' | 'person';
    entity_name?: string;
    valid_from?: string;
    change_type?: 'new' | 'update' | 'contradiction' | 'addition';
    verification_status?: 'potwierdzony' | 'przypuszczenie' | 'wymaga_weryfikacji';
  }>;
  edges?: Array<{
    source_title: string;
    target_title: string;
    label: string;
  }>;
  mutations?: EntityMutation[];
  ambiguity_question?: string;
  ambiguity_options?: string[];
}

export function buildItemsAndRelations(
  rawInput: string,
  payload: ExtractedPayload,
  nowIso: string = new Date().toISOString()
): {
  items: AnyBrainItem[];
  temporalFacts: TemporalFact[];
  edges: GraphEdge[];
  mutations?: EntityMutation[];
} {
  const generatedId = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now()}`;

  const titleToIdMap = new Map<string, string>();
  const items: AnyBrainItem[] = [];

  // Create items with stable IDs
  for (const raw of payload.items || []) {
    const id = generatedId(raw.type);
    titleToIdMap.set(raw.title.toLowerCase().trim(), id);

    const categories: CategoryType[] = Array.from(new Set([raw.type, ...(raw.categories || [])]));
    const base = {
      id,
      title: raw.title,
      description: raw.description,
      categories,
      raw_input: rawInput,
      recorded_at: nowIso,
      target_date: raw.target_date,
      ai_classification_reason: raw.ai_classification_reason || `Sklasyfikowano jako ${raw.type} na podstawie kontekstu wypowiedzi.`,
      tags: raw.tags || [raw.type],
    };

    const details = raw.details || {};

    if (raw.type === 'kalendarz') {
      items.push({
        ...base,
        type: 'kalendarz',
        start_time: details.start_time || raw.target_date || '10:00',
        end_time: details.end_time,
        is_all_day: details.is_all_day ?? true,
        is_annual_recurring: details.is_annual_recurring ?? false,
        location: details.location,
        linked_person_ids: details.linked_person_ids || [],
      });
    } else if (raw.type === 'zadania') {
      items.push({
        ...base,
        type: 'zadania',
        due_date: details.due_date || raw.target_date,
        due_time: details.due_time,
        is_completed: false,
        priority: details.priority || 'średni',
        linked_person_id: details.linked_person_id,
        linked_project_id: details.linked_project_id,
      });
    } else if (raw.type === 'ludzie') {
      items.push({
        ...base,
        type: 'ludzie',
        name: details.name || raw.title,
        aliases: details.aliases || [],
        relationship: details.relationship || 'znajomy',
        birthdate: details.birthdate || raw.target_date,
        preferences: details.preferences || [],
        last_interaction_date: details.last_interaction_date || nowIso.slice(0, 10),
        avatar_color: details.avatar_color || '#8C7CF0',
        notes: raw.description,
      });
    } else if (raw.type === 'wspomnienia') {
      items.push({
        ...base,
        type: 'wspomnienia',
        mood: details.mood || 'pozytywny',
        location: details.location,
        linked_people: details.linked_people || [],
        photo_urls: details.photo_urls || [],
      });
    } else if (raw.type === 'pomysly') {
      items.push({
        ...base,
        type: 'pomysly',
        stage: details.stage || 'spontaniczny',
        ai_expansion: details.ai_expansion,
      });
    } else if (raw.type === 'projekty') {
      items.push({
        ...base,
        type: 'projekty',
        status: details.status || 'koncepcja',
        goals: details.goals || [],
      });
    } else if (raw.type === 'inspiracje') {
      items.push({
        ...base,
        type: 'inspiracje',
        source_url: details.source_url,
        media_url: details.media_url,
        quote: details.quote,
      });
    } else if (raw.type === 'miejsca') {
      items.push({
        ...base,
        type: 'miejsca',
        city: details.city || raw.title,
        country: details.country || 'Polska',
        visit_count: details.visit_count || 1,
        last_visited: details.last_visited || nowIso.slice(0, 10),
        notes: raw.description,
      });
    } else {
      items.push({
        ...base,
        type: 'o_mnie',
        facet: details.facet || 'preferencja',
        status: details.status || 'aktywny',
      });
    }
  }

  // Create temporal facts
  const temporalFacts: TemporalFact[] = (payload.temporal_facts || []).map((fact) => ({
    id: generatedId('fact'),
    subject: fact.subject,
    value: fact.value,
    entity_type: fact.entity_type,
    entity_name: fact.entity_name || (fact.entity_type === 'user' ? 'Użytkownik' : undefined),
    recorded_at: nowIso,
    valid_from: fact.valid_from || nowIso.slice(0, 10),
    is_active: true,
    confidence: 0.95,
    change_type: fact.change_type || 'new',
    source_utterance: rawInput,
    verification_status: fact.verification_status || 'potwierdzony',
  }));

  // Resolve edges with exact or fuzzy title matching
  const findItemIdByTitle = (queryTitle: string): string | undefined => {
    if (!queryTitle) return undefined;
    const q = queryTitle.toLowerCase().trim();
    if (titleToIdMap.has(q)) return titleToIdMap.get(q);

    // Substring / fuzzy match
    const matched = items.find(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        q.includes(item.title.toLowerCase()) ||
        (item.tags && item.tags.some((t) => q.includes(t.toLowerCase())))
    );
    return matched?.id;
  };

  const edges: GraphEdge[] = [];
  for (const rel of payload.edges || []) {
    const sourceId = findItemIdByTitle(rel.source_title);
    const targetId = findItemIdByTitle(rel.target_title);
    if (sourceId && targetId && sourceId !== targetId) {
      // Avoid duplicate edge
      if (!edges.some((e) => e.source === sourceId && e.target === targetId)) {
        edges.push({
          id: generatedId('edge'),
          source: sourceId,
          target: targetId,
          label: rel.label || 'powiązanie',
          confidence: 0.95,
        });
      }
    }
  }

  // If no explicit edges were supplied or to enrich links between co-created items
  if (items.length > 1) {
    const person = items.find((i) => i.type === 'ludzie');
    const memory = items.find((i) => i.type === 'wspomnienia');
    const event = items.find((i) => i.type === 'kalendarz');
    const task = items.find((i) => i.type === 'zadania');
    const idea = items.find((i) => i.type === 'pomysly');
    const project = items.find((i) => i.type === 'projekty');
    const place = items.find((i) => i.type === 'miejsca');

    const addEdgeIfNotExists = (sId: string, tId: string, lbl: string) => {
      if (sId && tId && sId !== tId && !edges.some((e) => (e.source === sId && e.target === tId) || (e.source === tId && e.target === sId))) {
        edges.push({ id: generatedId('edge'), source: sId, target: tId, label: lbl, confidence: 0.95 });
      }
    };

    if (place) {
      for (const other of items) {
        if (other.id !== place.id) {
          addEdgeIfNotExists(other.id, place.id, 'miejsce / w');
        }
      }
    }
    if (task && project) {
      addEdgeIfNotExists(task.id, project.id, 'niezbędna do');
    }
    if (person && memory) {
      addEdgeIfNotExists(memory.id, person.id, 'spotkanie z');
    }
    if (person && event) {
      addEdgeIfNotExists(person.id, event.id, 'wydarzenie');
    }
    if (idea && memory) {
      addEdgeIfNotExists(memory.id, idea.id, 'zrodził pomysł');
    }
    if (task && person) {
      addEdgeIfNotExists(task.id, person.id, 'dla osoby');
    }
    if (task && idea) {
      addEdgeIfNotExists(task.id, idea.id, 'działanie do pomysłu');
    }
    if (idea && project) {
      addEdgeIfNotExists(idea.id, project.id, 'część projektu');
    }
  }

  return { items, temporalFacts, edges, mutations: payload.mutations || [] };
}
