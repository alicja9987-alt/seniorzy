import test from 'node:test';
import assert from 'node:assert/strict';
import { buildItemsAndRelations, normalizeEntityName } from './extraction-parser';

test('normalizeEntityName normalizes Polish inflections', () => {
  assert.equal(normalizeEntityName('Kasi'), 'kasia');
  assert.equal(normalizeEntityName('Kasią'), 'kasia');
  assert.equal(normalizeEntityName('Tomka'), 'tomek');
  assert.equal(normalizeEntityName('Inny'), 'inny');
});

test('buildItemsAndRelations parses multi-record payload correctly', () => {
  const rawUtterance = 'Wczoraj byłam z Kasią na kawie. Ma urodziny 11 kwietnia. Powiedziała, że uwielbia tulipany.';
  const payload = {
    summary: 'Utworzono wspomnienie, profil Kasi i coroczne urodziny.',
    items: [
      {
        type: 'wspomnienia' as const,
        title: 'Kawa z Kasią',
        description: 'Spotkanie przy kawie w kawiarni.',
        ai_classification_reason: 'Wspomnienie ze spotkania.',
        tags: ['kawa', 'spotkanie'],
      },
      {
        type: 'ludzie' as const,
        title: 'Kasia',
        description: 'Przyjaciółka, lubi tulipany.',
        ai_classification_reason: 'Rozpoznano osobę.',
        tags: ['przyjaciółka'],
        details: {
          name: 'Kasia',
          relationship: 'przyjaciółka',
          preferences: ['uwielbia tulipany'],
        },
      },
      {
        type: 'kalendarz' as const,
        title: 'Urodziny Kasi',
        description: 'Coroczne urodziny 11 kwietnia.',
        target_date: '04-11',
        ai_classification_reason: 'Wydarzenie cykliczne.',
        details: {
          is_annual_recurring: true,
        },
      },
    ],
    temporal_facts: [
      {
        subject: 'Ulubione kwiaty',
        value: 'tulipany',
        entity_type: 'person' as const,
        entity_name: 'Kasia',
        valid_from: '2026-10-28',
      },
    ],
    edges: [
      {
        source_title: 'Kawa z Kasią',
        target_title: 'Kasia',
        label: 'spotkanie z',
      },
      {
        source_title: 'Kasia',
        target_title: 'Urodziny Kasi',
        label: 'ma urodziny',
      },
    ],
  };

  const result = buildItemsAndRelations(rawUtterance, payload, '2026-10-29T10:00:00Z');

  assert.equal(result.items.length, 3);
  assert.equal(result.temporalFacts.length, 1);
  assert.equal(result.temporalFacts[0].value, 'tulipany');
  assert.equal(result.temporalFacts[0].entity_name, 'Kasia');
  assert.equal(result.edges.length, 2);

  const memory = result.items.find((i) => i.type === 'wspomnienia');
  const person = result.items.find((i) => i.type === 'ludzie');
  const event = result.items.find((i) => i.type === 'kalendarz');

  assert.ok(memory);
  assert.ok(person);
  assert.ok(event);

  // Check that edge links memory to person
  const edgeMemPerson = result.edges.find((e) => e.source === memory?.id && e.target === person?.id);
  assert.ok(edgeMemPerson);
  assert.equal(edgeMemPerson?.label, 'spotkanie z');
});

test('buildItemsAndRelations connects task and project for tattoo printer prompt', () => {
  const utterance = 'Warto jest ogarnąć drukarkę w najbliższym czasie, żeby robić tatuaże, a drukarka jest niezbędna do tych tatuaży';
  const payload = {
    summary: 'Utworzono zadanie ogarnięcia drukarki i projekt robienia tatuaży.',
    items: [
      {
        type: 'zadania' as const,
        title: 'Ogarnąć drukarkę do tatuaży',
        description: 'Drukarka jest niezbędna do przygotowywania szablonów tatuaży.',
        ai_classification_reason: 'Wykryto pilne zadanie sprzętowe.',
        tags: ['tatuaże', 'drukarka', 'sprzęt'],
      },
      {
        type: 'projekty' as const,
        title: 'Robienie tatuaży',
        description: 'Projekt artystyczny i studio tatuażu.',
        ai_classification_reason: 'Długoterminowe przedsięwzięcie.',
        tags: ['tatuaże', 'sztuka', 'projekt'],
      },
    ],
    edges: [
      {
        source_title: 'Ogarnąć drukarkę do tatuaży',
        target_title: 'Robienie tatuaży',
        label: 'niezbędna do',
      },
    ],
  };

  const res = buildItemsAndRelations(utterance, payload);
  assert.equal(res.items.length, 2);
  assert.ok(res.edges.length >= 1);
  const task = res.items.find((i) => i.type === 'zadania');
  const project = res.items.find((i) => i.type === 'projekty');
  assert.ok(task && project);

  const edge = res.edges.find((e) => e.source === task.id && e.target === project.id);
  assert.ok(edge);
  assert.equal(edge.label, 'niezbędna do');
});

test('buildItemsAndRelations parses Places (miejsca) and auto-links related memories', () => {
  const utterance = 'W Gdańsku spotkałam super jubilera';
  const payload = {
    summary: 'Utworzono miejsce Gdańsk oraz wspomnienie ze spotkania.',
    items: [
      {
        type: 'miejsca' as const,
        title: 'Gdańsk',
        description: 'Miasto nad Bałtykiem.',
        ai_classification_reason: 'Rozpoznano miasto.',
        tags: ['miejsce', 'gdańsk'],
        details: {
          city: 'Gdańsk',
          country: 'Polska',
        },
      },
      {
        type: 'wspomnienia' as const,
        title: 'Spotkanie z jubilerem w Gdańsku',
        description: 'Spotkałam jubilera, który tworzy unikalne odlewy.',
        ai_classification_reason: 'Wspomnienie z podróży.',
        tags: ['jubiler', 'gdańsk'],
      },
    ],
  };

  const res = buildItemsAndRelations(utterance, payload);
  assert.equal(res.items.length, 2);
  const place = res.items.find((i) => i.type === 'miejsca');
  const memory = res.items.find((i) => i.type === 'wspomnienia');
  assert.ok(place);
  assert.ok(memory);
  assert.equal(place?.title, 'Gdańsk');

  // Should auto-link memory to place
  const edge = res.edges.find((e) => (e.source === memory?.id && e.target === place?.id) || (e.source === place?.id && e.target === memory?.id));
  assert.ok(edge);
  assert.equal(edge?.label, 'miejsce / w');
});

test('buildItemsAndRelations carries mutations for life events', () => {
  const utterance = 'Kasia zmarła.';
  const payload = {
    summary: 'Zaktualizowano profil Kasi (in memoriam).',
    items: [
      {
        type: 'wspomnienia' as const,
        title: 'Pamięć o Kasi',
        description: 'Kasia odeszła. Zachowano wspomnienia.',
        ai_classification_reason: 'Wspomnienie in memoriam.',
        tags: ['in_memoriam', 'kasia'],
      },
    ],
    mutations: [
      {
        target_name_or_title: 'Kasia',
        mutation_type: 'lifecycle_transition' as const,
        new_lifecycle_status: 'in_memoriam' as const,
        reason: 'Wiadomość o śmierci',
        affect_connected_tasks: true,
      },
    ],
  };

  const res = buildItemsAndRelations(utterance, payload);
  assert.equal(res.items.length, 1);
  assert.equal(res.mutations?.length, 1);
  assert.equal(res.mutations?.[0].new_lifecycle_status, 'in_memoriam');
  assert.equal(res.mutations?.[0].target_name_or_title, 'Kasia');
});

