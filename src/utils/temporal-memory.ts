import { TemporalFact } from '../types';

/**
 * Updates a temporal knowledge base with a new fact.
 * If the fact matches an existing active fact on the same subject and entity,
 * the old fact is superseded (marked inactive, valid_until set to new fact's valid_from),
 * and the new fact points to the old one via supersedes_id.
 */
export function registerTemporalFact(
  existingFacts: TemporalFact[],
  incoming: Omit<TemporalFact, 'id' | 'is_active'>,
  generateId: () => string = () => `fact_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
): {
  updatedFacts: TemporalFact[];
  supersededFactId?: string;
  isNewFact: boolean;
} {
  const normSubject = incoming.subject.trim().toLowerCase();
  const normEntity = (incoming.entity_name || '').trim().toLowerCase();
  const validFrom = incoming.valid_from || new Date().toISOString().slice(0, 10);

  // Find if there is an active fact with same subject and entity
  const existingActiveIndex = existingFacts.findIndex(
    (f) =>
      f.is_active &&
      f.subject.trim().toLowerCase() === normSubject &&
      (f.entity_name || '').trim().toLowerCase() === normEntity &&
      f.entity_type === incoming.entity_type
  );

  let updatedList = [...existingFacts];
  let supersededId: string | undefined = undefined;

  if (existingActiveIndex !== -1) {
    const oldFact = updatedList[existingActiveIndex];
    // If the value is strictly identical, we don't need to supersede, it's a re-confirmation
    if (oldFact.value.trim().toLowerCase() === incoming.value.trim().toLowerCase()) {
      return { updatedFacts: existingFacts, isNewFact: false };
    }

    supersededId = oldFact.id;
    // Mark previous fact as inactive and set valid_until
    updatedList[existingActiveIndex] = {
      ...oldFact,
      is_active: false,
      valid_until: validFrom,
    };
  }

  const newFact: TemporalFact = {
    ...incoming,
    id: generateId(),
    is_active: true,
    valid_from: validFrom,
    supersedes_id: supersededId,
    change_type: supersededId ? 'update' : 'new',
  };

  updatedList.push(newFact);

  return {
    updatedFacts: updatedList,
    supersededFactId: supersededId,
    isNewFact: true,
  };
}

/**
 * Returns the timeline evolution of facts for a given subject and entity.
 * Sorted chronologically from oldest to newest.
 */
export function getFactEvolution(
  facts: TemporalFact[],
  subject?: string,
  entityName?: string
): TemporalFact[] {
  let filtered = facts;
  if (subject) {
    const s = subject.trim().toLowerCase();
    filtered = filtered.filter((f) => f.subject.trim().toLowerCase().includes(s));
  }
  if (entityName) {
    const e = entityName.trim().toLowerCase();
    filtered = filtered.filter((f) => (f.entity_name || '').trim().toLowerCase().includes(e));
  }

  return filtered.sort((a, b) => a.valid_from.localeCompare(b.valid_from));
}

/**
 * Groups facts into active facts vs archived/former facts.
 */
export function getActiveAndFormerFacts(facts: TemporalFact[]): {
  active: TemporalFact[];
  former: TemporalFact[];
} {
  return {
    active: facts.filter((f) => f.is_active),
    former: facts.filter((f) => !f.is_active),
  };
}
