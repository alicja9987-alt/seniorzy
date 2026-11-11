export type CategoryType = 
  | 'kalendarz'
  | 'zadania'
  | 'wspomnienia'
  | 'o_mnie'
  | 'ludzie'
  | 'pomysly'
  | 'projekty'
  | 'inspiracje'
  | 'miejsca';

export interface BaseItem {
  id: string;
  title: string;
  description: string;
  categories: CategoryType[];
  raw_input?: string;
  recorded_at: string;
  target_date?: string; // Date or month-day (e.g. 2026-10-30 or 04-11)
  ai_classification_reason: string;
  tags: string[];
  sentiment?: 'pozytywny' | 'neutralny' | 'refleksyjny' | 'inspirujący';
  pinned?: boolean;
  lifecycle_status?: 'active' | 'in_memoriam' | 'archived' | 'completed';
  status_note?: string;
  place_id?: string;
  location?: string;
}

export interface CalendarEventItem extends BaseItem {
  start_time: string; // ISO string or time e.g. "15:00"
  end_time?: string;
  is_all_day?: boolean;
  is_annual_recurring?: boolean; // E.g. birthdays
  location?: string;
  linked_person_ids?: string[];
}

export interface TaskItem extends BaseItem {
  due_date?: string;
  due_time?: string;
  is_completed: boolean;
  priority: 'niski' | 'średni' | 'wysoki';
  linked_person_id?: string;
  linked_project_id?: string;
}

export interface MemoryItem extends BaseItem {
  mood?: string;
  location?: string;
  linked_people?: string[];
  photo_urls?: string[];
}

export interface PersonItem extends BaseItem {
  name: string;
  aliases?: string[];
  relationship?: string; // e.g. "przyjaciółka", "mentor", "brat"
  birthdate?: string;
  preferences: string[]; // e.g. "uwielbia tulipany", "pije matchę"
  last_interaction_date?: string;
  avatar_color?: string;
  notes?: string;
}

export interface IdeaItem extends BaseItem {
  stage: 'spontaniczny' | 'inkubowany' | 'przekształcony_w_projekt';
  ai_expansion?: string; // AI incubated breakdown
  linked_project_id?: string;
}

export interface ProjectItem extends BaseItem {
  status: 'koncepcja' | 'w_trakcie' | 'wstrzymany' | 'ukończony';
  goals?: string[];
  milestones?: { title: string; done: boolean }[];
}

export interface InspirationItem extends BaseItem {
  source_url?: string;
  media_url?: string;
  quote?: string;
}

export interface AboutMeItem extends BaseItem {
  facet: 'preferencja' | 'fakt' | 'cel' | 'nawyk' | 'wartość';
  status: 'aktywny' | 'przeszły' | 'eksperyment';
}

export interface PlaceItem extends BaseItem {
  city?: string;
  country?: string;
  visit_count?: number;
  last_visited?: string;
  notes?: string;
}

export type AnyBrainItem = 
  | (CalendarEventItem & { type: 'kalendarz' })
  | (TaskItem & { type: 'zadania' })
  | (MemoryItem & { type: 'wspomnienia' })
  | (AboutMeItem & { type: 'o_mnie' })
  | (PersonItem & { type: 'ludzie' })
  | (IdeaItem & { type: 'pomysly' })
  | (ProjectItem & { type: 'projekty' })
  | (InspirationItem & { type: 'inspiracje' })
  | (PlaceItem & { type: 'miejsca' });

export interface EntityMutation {
  target_name_or_title: string;
  mutation_type: 'lifecycle_transition' | 'archive_associated' | 'update_relationship';
  new_lifecycle_status: 'in_memoriam' | 'archived' | 'completed' | 'active';
  reason: string;
  affect_connected_tasks?: boolean;
}

export interface TemporalFact {
  id: string;
  subject: string; // np. "Ulubiony kolor", "Ulubiona kawa", "Hobby"
  value: string; // np. "błękit", "różowy"
  entity_type: 'user' | 'person';
  entity_name?: string; // np. "Ja" lub "Kasia"
  recorded_at: string;
  valid_from: string;
  valid_until?: string; // null/undefined if currently active
  is_active: boolean;
  confidence: number;
  supersedes_id?: string; // id of fact this replaced
  change_type: 'new' | 'update' | 'contradiction' | 'addition';
  source_utterance: string;
  verification_status: 'potwierdzony' | 'przypuszczenie' | 'wymaga_weryfikacji';
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string; // "urodziny", "przyjaciółka", "pomysł na", "zadanie dla", "preferencja"
  confidence?: number;
}

export interface GraphNode {
  id: string;
  label: string;
  category: CategoryType;
  subtitle?: string;
  importance?: number;
  tags?: string[];
  lifecycle_status?: 'active' | 'in_memoriam' | 'archived' | 'completed';
}

export interface InboxItem {
  id: string;
  type: 'ambiguity' | 'pending_approval' | 'conflict';
  title: string;
  description: string;
  source_input?: string;
  options?: { id: string; label: string; action: string; payload?: any }[];
  created_at: string;
  resolved: boolean;
}

export interface AuditBatch {
  id: string;
  timestamp: string;
  user_input: string;
  summary: string;
  actions: {
    type: 'create' | 'update' | 'delete';
    category: CategoryType;
    item_id: string;
    item_title: string;
    snapshot?: any;
  }[];
  can_undo: boolean;
}

export interface ExtractionResult {
  summary: string;
  items: AnyBrainItem[];
  temporal_facts: TemporalFact[];
  edges: GraphEdge[];
  disambiguation?: {
    question: string;
    options: string[];
    context: string;
  };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  extracted_items?: AnyBrainItem[];
  referenced_item_ids?: string[];
  suggested_followups?: string[];
}
