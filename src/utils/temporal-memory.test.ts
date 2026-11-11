import test from 'node:test';
import assert from 'node:assert/strict';
import { registerTemporalFact, getFactEvolution, getActiveAndFormerFacts } from './temporal-memory';
import { TemporalFact } from '../types';

test('registerTemporalFact creates new fact when no prior fact exists', () => {
  const existing: TemporalFact[] = [];
  const res = registerTemporalFact(
    existing,
    {
      subject: 'Ulubiony kolor',
      value: 'różowy',
      entity_type: 'user',
      entity_name: 'Ja',
      valid_from: '2026-01-15',
      confidence: 0.95,
      change_type: 'new',
      source_utterance: 'Najbardziej lubię kolor różowy.',
      verification_status: 'potwierdzony',
      recorded_at: '2026-01-15T12:00:00Z',
    },
    () => 'fact_pink'
  );

  assert.equal(res.updatedFacts.length, 1);
  assert.equal(res.updatedFacts[0].is_active, true);
  assert.equal(res.updatedFacts[0].value, 'różowy');
  assert.equal(res.isNewFact, true);
});

test('registerTemporalFact correctly supersedes prior fact while keeping history', () => {
  const initialFact: TemporalFact = {
    id: 'fact_pink',
    subject: 'Ulubiony kolor',
    value: 'różowy',
    entity_type: 'user',
    entity_name: 'Ja',
    valid_from: '2026-01-15',
    is_active: true,
    confidence: 0.95,
    change_type: 'new',
    source_utterance: 'Najbardziej lubię kolor różowy.',
    verification_status: 'potwierdzony',
    recorded_at: '2026-01-15T12:00:00Z',
  };

  const res = registerTemporalFact(
    [initialFact],
    {
      subject: 'Ulubiony kolor',
      value: 'błękit',
      entity_type: 'user',
      entity_name: 'Ja',
      valid_from: '2026-06-20',
      confidence: 0.95,
      change_type: 'update',
      source_utterance: 'Teraz zdecydowanie bardziej podoba mi się błękit.',
      verification_status: 'potwierdzony',
      recorded_at: '2026-06-20T14:00:00Z',
    },
    () => 'fact_blue'
  );

  assert.equal(res.updatedFacts.length, 2);
  const oldFact = res.updatedFacts.find((f) => f.id === 'fact_pink');
  const newFact = res.updatedFacts.find((f) => f.id === 'fact_blue');

  assert.ok(oldFact);
  assert.ok(newFact);

  assert.equal(oldFact?.is_active, false);
  assert.equal(oldFact?.valid_until, '2026-06-20');

  assert.equal(newFact?.is_active, true);
  assert.equal(newFact?.supersedes_id, 'fact_pink');
  assert.equal(newFact?.change_type, 'update');

  const { active, former } = getActiveAndFormerFacts(res.updatedFacts);
  assert.equal(active.length, 1);
  assert.equal(active[0].value, 'błękit');
  assert.equal(former.length, 1);
  assert.equal(former[0].value, 'różowy');

  const history = getFactEvolution(res.updatedFacts, 'kolor');
  assert.equal(history.length, 2);
  assert.equal(history[0].value, 'różowy');
  assert.equal(history[1].value, 'błękit');
});
