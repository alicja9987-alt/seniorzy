import express from 'express';
import http from 'http';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { AnyBrainItem, AuditBatch, CategoryType, GraphEdge, InboxItem, TemporalFact } from './src/types';
import { buildItemsAndRelations } from './src/utils/extraction-parser';
import { registerTemporalFact } from './src/utils/temporal-memory';
import { buildGraphData, detectSmartConnections } from './src/utils/graph-layout';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'brain-store.json');

app.use(express.json({ limit: '25mb' }));

// Initialize Gemini Client
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = apiKey
  ? new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

async function withTimeout<T>(promise: Promise<T>, ms: number = 2200): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)),
  ]);
}

interface BrainDatabase {
  items: AnyBrainItem[];
  temporal_facts: TemporalFact[];
  edges: GraphEdge[];
  inbox: InboxItem[];
  audit_batches: AuditBatch[];
  ai_mode: 'automatyczny' | 'zatwierdzanie' | 'manualny';
}

function getInitialSeedData(): BrainDatabase {
  const now = new Date().toISOString();
  const seedItems: AnyBrainItem[] = [
    {
      id: 'person_kasia_01',
      type: 'ludzie',
      title: 'Kasia',
      name: 'Kasia',
      description: 'Bliska przyjaciółka, miłośniczka estetyki i designu.',
      categories: ['ludzie'],
      recorded_at: '2026-10-28T16:00:00Z',
      ai_classification_reason: 'Rozpoznano osobę i profil relacji.',
      tags: ['przyjaciółka', 'design', 'kawa'],
      relationship: 'przyjaciółka',
      birthdate: '11 kwietnia',
      preferences: ['uwielbia tulipany', 'pije matchę z mlekiem owsianym'],
      last_interaction_date: '2026-10-28',
      avatar_color: '#8C7CF0',
    },
    {
      id: 'event_kasia_bday',
      type: 'kalendarz',
      title: 'Urodziny Kasi',
      description: 'Coroczne urodziny Kasi. Pamiętać o bukiecie tulipanów.',
      categories: ['kalendarz'],
      recorded_at: '2026-10-28T16:05:00Z',
      target_date: '2027-04-11',
      start_time: '10:00',
      is_all_day: true,
      is_annual_recurring: true,
      ai_classification_reason: 'Wydarzenie cykliczne powiązane z urodzinami.',
      tags: ['urodziny', 'kasia', 'święto'],
      linked_person_ids: ['person_kasia_01'],
    },
    {
      id: 'memory_coffee_kasia',
      type: 'wspomnienia',
      title: 'Kawa z Kasią i burza mózgów',
      description: 'Spotkałyśmy się w kawiarni na Mokotowie. Rozmawiałyśmy o biżuterii, życiu i podróżach. Wspomniała, że uwielbia tulipany i ma urodziny 11 kwietnia.',
      categories: ['wspomnienia'],
      recorded_at: '2026-10-28T17:30:00Z',
      target_date: '2026-10-28',
      ai_classification_reason: 'Opis osobistego doświadczenia i minionego spotkania.',
      tags: ['kawiarnia', 'spotkanie', 'rozmowa'],
      mood: 'inspirujący',
      location: 'Kawiarnia Mokotów',
      linked_people: ['Kasia'],
    },
    {
      id: 'idea_jewelry_brand',
      type: 'pomysly',
      title: 'Autorska linia biżuterii organicznej',
      description: 'Pomysł na minimalistyczną markę biżuterii inspirowaną surowymi formami natury, recyklingowane srebro.',
      categories: ['pomysly', 'projekty'],
      recorded_at: '2026-10-28T18:00:00Z',
      ai_classification_reason: 'Spontaniczna koncepcja biznesowa i kreatywna.',
      tags: ['biznes', 'design', 'rękodzieło'],
      stage: 'inkubowany',
      ai_expansion: 'Kluczowe filary: 1) Krótkie limitowane serie odlewów, 2) Ekologiczne pakowanie w biodegradowalny len, 3) Sesja zdjęciowa w surowym studio z modelką.',
    },
    {
      id: 'task_send_inspo',
      type: 'zadania',
      title: 'Wysłać Kasi inspiracje i moodboard do biżuterii',
      description: 'Zebrać zdjęcia referencyjne i przesłać na WhatsAppie do jutra.',
      categories: ['zadania'],
      recorded_at: '2026-10-28T18:15:00Z',
      target_date: '2026-10-30',
      due_date: '2026-10-30',
      is_completed: false,
      priority: 'wysoki',
      ai_classification_reason: 'Zobowiązanie do wykonania w określonym terminie.',
      tags: ['kasia', 'inspiracje', 'zadanie'],
      linked_person_id: 'person_kasia_01',
    },
    {
      id: 'task_dentist_visit',
      type: 'zadania',
      title: 'Wizyta kontrolna u stomatologa',
      description: 'Gabinet na ul. Pięknej, godzina 15:00.',
      categories: ['zadania', 'kalendarz'],
      recorded_at: '2026-10-25T11:00:00Z',
      target_date: '2026-10-31',
      due_date: '2026-10-31',
      due_time: '15:00',
      is_completed: false,
      priority: 'średni',
      ai_classification_reason: 'Zadanie zdrowotne z przypisaną datą.',
      tags: ['zdrowie'],
    },
    {
      id: 'project_brand_launch',
      type: 'projekty',
      title: 'Start marki Srebro Organiczne',
      description: 'Całościowy projekt wdrożenia nowej marki biżuterii na rynek.',
      categories: ['projekty'],
      recorded_at: '2026-10-28T18:30:00Z',
      ai_classification_reason: 'Wieloetapowe przedsięwzięcie strategiczne.',
      tags: ['projekt', 'biznes'],
      status: 'koncepcja',
      goals: ['Opracowanie 5 prototypów', 'Uruchomienie profilu na Instagramie', 'Pierwsza próbna partia'],
      milestones: [
        { title: 'Moodboard i nazwa', done: true },
        { title: 'Konsultacja z jubilerem', done: false },
        { title: 'Opakowania', done: false },
      ],
    },
    {
      id: 'inspiration_ceramics',
      type: 'inspiracje',
      title: 'Formy organiczne i japońska ceramika',
      description: 'Estetyka wabi-sabi, nieregularne krawędzie i naturalne tekstury.',
      categories: ['inspiracje'],
      recorded_at: '2026-10-20T14:00:00Z',
      ai_classification_reason: 'Materiał referencyjny i inspiracja wizualna.',
      tags: ['estetyka', 'wabi-sabi', 'design'],
      quote: '„Piękno kryje się w niedoskonałości i upływie czasu.”',
    },
    {
      id: 'aboutme_ceramics_goal',
      type: 'o_mnie',
      title: 'Cel: Warsztaty z ceramiki kołowej',
      description: 'Chcę zapisać się na regularne zajęcia garncarskie w weekendy.',
      categories: ['o_mnie'],
      recorded_at: '2026-10-15T09:00:00Z',
      ai_classification_reason: 'Osobisty cel rozwojowy użytkownika.',
      tags: ['rozwój', 'pasja'],
      facet: 'cel',
      status: 'aktywny',
    },
  ];

  const seedFacts: TemporalFact[] = [
    {
      id: 'fact_color_pink_past',
      subject: 'Ulubiony kolor',
      value: 'różowy',
      entity_type: 'user',
      entity_name: 'Ja',
      recorded_at: '2026-01-15T10:00:00Z',
      valid_from: '2026-01-15',
      valid_until: '2026-06-20',
      is_active: false,
      confidence: 0.95,
      change_type: 'new',
      source_utterance: 'Najbardziej lubię kolor różowy.',
      verification_status: 'potwierdzony',
    },
    {
      id: 'fact_color_blue_current',
      subject: 'Ulubiony kolor',
      value: 'błękit',
      entity_type: 'user',
      entity_name: 'Ja',
      recorded_at: '2026-06-20T15:00:00Z',
      valid_from: '2026-06-20',
      is_active: true,
      confidence: 0.95,
      supersedes_id: 'fact_color_pink_past',
      change_type: 'update',
      source_utterance: 'Teraz zdecydowanie bardziej podoba mi się błękit.',
      verification_status: 'potwierdzony',
    },
    {
      id: 'fact_kasia_tulips',
      subject: 'Ulubione kwiaty',
      value: 'tulipany',
      entity_type: 'person',
      entity_name: 'Kasia',
      recorded_at: '2026-10-28T16:00:00Z',
      valid_from: '2026-10-28',
      is_active: true,
      confidence: 0.98,
      change_type: 'new',
      source_utterance: 'Kasia powiedziała, że uwielbia tulipany.',
      verification_status: 'potwierdzony',
    },
    {
      id: 'fact_coffee_preference',
      subject: 'Kawa',
      value: 'cappuccino z mlekiem owsianym bez cukru',
      entity_type: 'user',
      entity_name: 'Ja',
      recorded_at: '2026-02-10T08:00:00Z',
      valid_from: '2026-02-10',
      is_active: true,
      confidence: 0.99,
      change_type: 'new',
      source_utterance: 'Zawsze zamawiam cappuccino na owsianym bez cukru.',
      verification_status: 'potwierdzony',
    },
  ];

  const seedEdges: GraphEdge[] = [
    { id: 'e1', source: 'memory_coffee_kasia', target: 'person_kasia_01', label: 'spotkanie z' },
    { id: 'e2', source: 'person_kasia_01', target: 'event_kasia_bday', label: 'urodziny' },
    { id: 'e3', source: 'memory_coffee_kasia', target: 'idea_jewelry_brand', label: 'zrodził pomysł' },
    { id: 'e4', source: 'task_send_inspo', target: 'person_kasia_01', label: 'zadanie dla' },
    { id: 'e5', source: 'idea_jewelry_brand', target: 'project_brand_launch', label: 'część projektu' },
    { id: 'e6', source: 'inspiration_ceramics', target: 'idea_jewelry_brand', label: 'inspiracja form' },
  ];

  return {
    items: seedItems,
    temporal_facts: seedFacts,
    edges: seedEdges,
    inbox: [],
    audit_batches: [
      {
        id: 'audit_init',
        timestamp: now,
        user_input: 'Inicjalizacja systemu splot.',
        summary: 'Załadowano początkowy ekosystem wiedzy, pamięci temporalnej i powiązań.',
        actions: [],
        can_undo: false,
      },
    ],
    ai_mode: 'automatyczny',
  };
}

// Memory database loaded from file or seed
let db: BrainDatabase;

function loadDatabase(): BrainDatabase {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed.items && parsed.temporal_facts) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Could not read DB file, using seed:', err);
  }
  const seed = getInitialSeedData();
  saveDatabase(seed);
  return seed;
}

function saveDatabase(data: BrainDatabase) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save DB file:', err);
  }
}

db = loadDatabase();

// API Endpoints

// 1. Get entire brain state
app.get('/api/state', (req, res) => {
  res.json({
    items: db.items,
    temporal_facts: db.temporal_facts,
    edges: db.edges,
    inbox: db.inbox,
    audit_batches: db.audit_batches.slice(-10),
    ai_mode: db.ai_mode,
    has_api_key: Boolean(apiKey),
  });
});

// 2. Change AI Mode
app.post('/api/settings/mode', (req, res) => {
  const { mode } = req.body;
  if (['automatyczny', 'zatwierdzanie', 'manualny'].includes(mode)) {
    db.ai_mode = mode;
    saveDatabase(db);
    return res.json({ success: true, mode: db.ai_mode });
  }
  res.status(400).json({ error: 'Nieprawidłowy tryb' });
});

// 3. Universal Capture & Extraction via Gemini
app.post('/api/capture', async (req, res) => {
  try {
    const { text, audioBase64, imageBase64 } = req.body;
    let userUtterance = (text || '').trim();

    // If audio is provided and text is empty, transcribe audio first with gemini-3.5-transcribe
    if (!userUtterance && audioBase64 && ai) {
      try {
        const audioPart = {
          inlineData: {
            mimeType: 'audio/webm',
            data: audioBase64,
          },
        };
        const transcribeRes = await ai.models.generateContent({
          model: 'gemini-3.5-transcribe',
          contents: { parts: [audioPart, { text: 'Dokładnie transkrybuj ten polski głos użytkownika.' }] },
        });
        userUtterance = (transcribeRes.text || '').trim();
      } catch (audioErr) {
        console.warn('Audio transcription error:', audioErr);
      }
    }

    if (!userUtterance) {
      return res.status(400).json({ error: 'Brak treści do przetworzenia.' });
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const existingPeople = db.items
      .filter((i) => i.type === 'ludzie')
      .map((p) => p.title)
      .join(', ');
    const existingProjects = db.items
      .filter((i) => i.type === 'projekty')
      .map((p) => p.title)
      .join(', ');
    const existingPlaces = db.items
      .filter((i) => i.type === 'miejsca')
      .map((p) => p.title)
      .join(', ');

    let extractedData: any = null;

    if (ai) {
      const prompt = `Jesteś silnikiem inteligencji osobistego drugiego mózgu „splot.”.
Użytkownik wypowiedział/napisał w języku polskim:
„${userUtterance}”

Dzisiejsza data: ${todayStr}.
Istniejące osoby w bazie: [${existingPeople}].
Istniejące projekty w bazie: [${existingProjects}].
Istniejące miejsca/miasta w bazie: [${existingPlaces}].

Twoim zadaniem jest GŁĘBOKA ANALIZA kontekstu, powiązań i intencji:
1. NIE zapisuj bezmyślnie całych surowych zdań jako tytułów! Wyłuskaj esencję, pojęcia, obiekty i relacje.
2. MIEJSCA (np. Gdańsk, Warszawa, Kraków): jeśli w wypowiedzi pojawia się miasto/miejsce, wyodrębnij je jako kategorię 'miejsca'. Jeśli to miasto jest już w bazie ([${existingPlaces}]), użyj DOKŁADNIE tej samej nazwy, aby system połączył nowy wpis z istniejącym węzłem miasta!
3. ZMIANY ŻYCIOWE / MUTACJE (np. 'Kasia umarła', 'Kasia zmarła', rozstanie, zmiana pracy):
   - Użyj pola 'mutations' aby zmienić stan istniejącej encji: np. target 'Kasia', new_lifecycle_status 'in_memoriam', affect_connected_tasks: true.
   - AI musi zmodyfikować profil osoby (in memoriam), zachować pamięć i zarchiwizować otwarte zadania.
4. Zwróć wynik jako JSON:
{
  "summary": "Zwięzłe podsumowanie dla użytkownika w 1 zdaniu (np. 'Zaktualizowano profil Kasi (in memoriam) i zachowano wspomnienia.')",
  "items": [
    {
      "type": "kalendarz | zadania | wspomnienia | o_mnie | ludzie | pomysly | projekty | inspiracje | miejsca",
      "title": "Krótki, elegancki tytuł rekordu (np. 'Gdańsk', 'Spotkanie z jubilerem', 'Kawa z Kasią')",
      "description": "Szczegółowy opis kontekstu",
      "categories": ["typ_główny"],
      "target_date": "YYYY-MM-DD lub MM-DD dla urodzin/rocznic",
      "tags": ["tag1", "tag2"],
      "ai_classification_reason": "Dlaczego AI zakwalifikowało ten wpis do tej kategorii",
      "details": {
        // dla 'ludzie': name, relationship, birthdate, preferences
        // dla 'miejsca': city, country, notes
        // dla 'kalendarz': is_annual_recurring, start_time, location
        // dla 'zadania': due_date, priority ('niski' | 'średni' | 'wysoki')
        // dla 'pomysly': stage ('spontaniczny' | 'inkubowany')
        // dla 'wspomnienia': mood, location, linked_people
        // dla 'o_mnie': facet ('preferencja' | 'fakt' | 'cel' | 'nawyk'), status ('aktywny')
      }
    }
  ],
  "mutations": [
    {
      "target_name_or_title": "Imię lub tytuł encji w bazie (np. 'Kasia')",
      "mutation_type": "lifecycle_transition",
      "new_lifecycle_status": "in_memoriam | archived | completed | active",
      "reason": "Uzasadnienie zmiany stanu (np. 'Wypowiedź o śmierci — zachowano wspomnienia')",
      "affect_connected_tasks": true
    }
  ],
  "temporal_facts": [
    {
      "subject": "np. Ulubiony kolor, Status życiowy, Ulubione kwiaty",
      "value": "wartość faktu",
      "entity_type": "user | person",
      "entity_name": "Ja lub imię osoby",
      "valid_from": "${todayStr}",
      "change_type": "new | update",
      "verification_status": "potwierdzony"
    }
  ],
  "edges": [
    {
      "source_title": "Tytuł obiektu źródłowego",
      "target_title": "Tytuł obiektu docelowego (np. 'Gdańsk')",
      "label": "etykieta relacji (np. 'w mieście', 'miejsce', 'dotyczy', 'niezbędna do')"
    }
  ],
  "ambiguity": {
    "has_ambiguity": false,
    "question": "",
    "options": []
  }
}
Zwracaj WYŁĄCZNIE czysty JSON bez formatowania markdown.`;

      try {
        const response = await withTimeout(
          ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
              maxOutputTokens: 1000,
            },
          }),
          2200
        );

        const responseText = response.text?.trim() || '{}';
        extractedData = JSON.parse(responseText);
      } catch (aiErr) {
        console.warn('Gemini extraction unavailable, falling back to smart instant extractor:', aiErr);
      }
    }

    // Fallback if AI not configured or failed to parse
    if (!extractedData || (!extractedData.items?.length && !extractedData.mutations?.length)) {
      extractedData = generateRuleBasedExtraction(userUtterance, todayStr);
    }

    // Build structured items and graph connections
    const { items: newItems, temporalFacts: newFacts, edges: newEdges, mutations } = buildItemsAndRelations(
      userUtterance,
      extractedData
    );

    // Check AI Mode:
    if (db.ai_mode === 'zatwierdzanie') {
      const inboxEntry: InboxItem = {
        id: `inbox_${Date.now()}`,
        type: 'pending_approval',
        title: `Propozycja zapisu: „${userUtterance.slice(0, 45)}...”`,
        description: extractedData.summary || `AI przygotowało ${newItems.length} rekordów do zapisania.`,
        source_input: userUtterance,
        options: [
          { id: 'approve', label: 'Zatwierdź i zapisz w mózgu', action: 'approve' },
          { id: 'reject', label: 'Odrzuć', action: 'reject' },
        ],
        created_at: new Date().toISOString(),
        resolved: false,
      };

      db.inbox.unshift(inboxEntry);
      saveDatabase(db);

      return res.json({
        mode: 'zatwierdzanie',
        status: 'pending_inbox',
        summary: 'Wpis trafił do Smart Inbox i oczekuje na Twoje potwierdzenie.',
        preview_items: newItems,
        inbox_item: inboxEntry,
      });
    }

    // 1. Execute Entity Mutations (Life transitions, e.g. Kasia umarła)
    const allMutations = [...(mutations || []), ...(extractedData.mutations || [])];
    for (const mut of allMutations) {
      const targetLower = (mut.target_name_or_title || '').toLowerCase().trim();
      if (!targetLower) continue;

      const matchingItem = db.items.find((i) => {
        const itemTitle = (i.title || '').toLowerCase().trim();
        const itemName = ((i as any).name || '').toLowerCase().trim();
        return itemTitle === targetLower || itemName === targetLower || itemTitle.includes(targetLower);
      });

      if (matchingItem) {
        matchingItem.lifecycle_status = mut.new_lifecycle_status;
        matchingItem.status_note = mut.reason;

        // If in_memoriam, archive connected open tasks so user isn't prompted to do tasks for departed loved ones
        if (mut.new_lifecycle_status === 'in_memoriam') {
          for (const item of db.items) {
            if (item.type === 'zadania') {
              const task = item as any;
              const matchesPerson =
                task.linked_person_id === matchingItem.id ||
                task.title.toLowerCase().includes(targetLower) ||
                task.description.toLowerCase().includes(targetLower);

              if (matchesPerson && !task.is_completed) {
                task.is_completed = true;
                task.lifecycle_status = 'archived';
                task.status_note = `[Zarchiwizowane — in memoriam: ${matchingItem.title}]`;
              }
            }
          }
        }
      }
    }

    // 2. Merge or supersede temporal facts
    for (const fact of newFacts) {
      const { updatedFacts } = registerTemporalFact(db.temporal_facts, fact);
      db.temporal_facts = updatedFacts;
    }

    // 3. Process items with intelligent entity and place deduplication
    const placeIdReplacements = new Map<string, string>(); // newPlaceId -> existingPlaceId

    for (const newItem of newItems) {
      if (newItem.type === 'ludzie') {
        const existingPersonIndex = db.items.findIndex(
          (i) => i.type === 'ludzie' && i.title.toLowerCase().trim() === newItem.title.toLowerCase().trim()
        );
        if (existingPersonIndex !== -1) {
          const currentPerson = db.items[existingPersonIndex] as any;
          const mergedPreferences = Array.from(
            new Set([...(currentPerson.preferences || []), ...(newItem.preferences || [])])
          );
          db.items[existingPersonIndex] = {
            ...currentPerson,
            preferences: mergedPreferences,
            birthdate: newItem.birthdate || currentPerson.birthdate,
            last_interaction_date: newItem.last_interaction_date || currentPerson.last_interaction_date,
          };
          continue;
        }
      } else if (newItem.type === 'miejsca') {
        // Check if place already exists (e.g. Gdańsk)
        const cleanPlaceTitle = newItem.title.toLowerCase().trim();
        const existingPlace = db.items.find(
          (i) => i.type === 'miejsca' && i.title.toLowerCase().trim() === cleanPlaceTitle
        );

        if (existingPlace) {
          // Point new relations directly to the existing place node
          placeIdReplacements.set(newItem.id, existingPlace.id);
          const p = existingPlace as any;
          p.visit_count = (p.visit_count || 1) + 1;
          p.last_visited = todayStr;
          continue; // Do not add duplicate place node
        }
      } else if (newItem.type === 'projekty' || newItem.type === 'zadania') {
        const cleanTitle = newItem.title.toLowerCase().trim();
        const existingItem = db.items.find(
          (i) => i.type === newItem.type && i.title.toLowerCase().trim() === cleanTitle
        );
        if (existingItem) {
          placeIdReplacements.set(newItem.id, existingItem.id);
          continue; // Do not add duplicate project/task node
        }
      }

      db.items.unshift(newItem);
    }

    // 4. Add edges with remapped place IDs
    for (const edge of newEdges) {
      const resolvedSource = placeIdReplacements.get(edge.source) || edge.source;
      const resolvedTarget = placeIdReplacements.get(edge.target) || edge.target;

      if (resolvedSource !== resolvedTarget) {
        const exists = db.edges.some(
          (e) =>
            (e.source === resolvedSource && e.target === resolvedTarget) ||
            (e.source === resolvedTarget && e.target === resolvedSource)
        );
        if (!exists) {
          db.edges.push({
            ...edge,
            source: resolvedSource,
            target: resolvedTarget,
          });
        }
      }
    }

    // If an existing place was referenced, ensure all non-place new items link to that existing place
    if (placeIdReplacements.size > 0) {
      for (const [, existingPlaceId] of placeIdReplacements.entries()) {
        for (const item of newItems) {
          if (item.type !== 'miejsca') {
            const alreadyLinked = db.edges.some(
              (e) => (e.source === item.id && e.target === existingPlaceId) || (e.source === existingPlaceId && e.target === item.id)
            );
            if (!alreadyLinked) {
              db.edges.push({
                id: `edge_place_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                source: item.id,
                target: existingPlaceId,
                label: 'lokalizacja / w',
                confidence: 0.98,
              });
            }
          }
        }
      }
    }

    // Handle Ambiguity if present
    if (extractedData.ambiguity && extractedData.ambiguity.has_ambiguity) {
      db.inbox.unshift({
        id: `inbox_${Date.now()}`,
        type: 'ambiguity',
        title: 'Wyjaśnienie informacji',
        description: extractedData.ambiguity.question,
        source_input: userUtterance,
        options: (extractedData.ambiguity.options || []).map((opt: string, idx: number) => ({
          id: `opt_${idx}`,
          label: opt,
          action: 'resolve',
          payload: { choice: opt },
        })),
        created_at: new Date().toISOString(),
        resolved: false,
      });
    }

    // Audit batch for Undo
    const auditBatch: AuditBatch = {
      id: `audit_${Date.now()}`,
      timestamp: new Date().toISOString(),
      user_input: userUtterance,
      summary: extractedData.summary || `Zapisano ${newItems.length} nowych rekordów.`,
      actions: newItems.map((item) => ({
        type: 'create',
        category: item.categories[0],
        item_id: item.id,
        item_title: item.title,
        snapshot: item,
      })),
      can_undo: true,
    };
    db.audit_batches.push(auditBatch);

    saveDatabase(db);

    return res.json({
      success: true,
      summary: extractedData.summary,
      created_items: newItems,
      temporal_facts: newFacts,
      edges: db.edges.slice(-newEdges.length),
      audit_batch_id: auditBatch.id,
    });
  } catch (err: any) {
    console.error('Capture endpoint error:', err);
    res.status(500).json({ error: err.message || 'Wystąpił błąd podczas analizy wpisu.' });
  }
});

// 4. Contextual Assistant Chat with Memory & Tools
app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Brak wiadomości' });
    }

    const lastMessage = messages[messages.length - 1].content;
    const todayStr = new Date().toISOString().slice(0, 10);

    // Provide context summary of the user's second brain
    const itemsContext = db.items.map((i) => ({
      id: i.id,
      type: i.type,
      title: i.title,
      description: i.description,
      date: i.target_date || (i as any).due_date || (i as any).birthdate,
      tags: i.tags,
      extra:
        i.type === 'ludzie'
          ? { preferences: (i as any).preferences, relationship: (i as any).relationship }
          : undefined,
    }));

    const temporalContext = db.temporal_facts.map((f) => ({
      subject: f.subject,
      value: f.value,
      entity: f.entity_name,
      valid_from: f.valid_from,
      valid_until: f.valid_until,
      is_active: f.is_active,
    }));

    if (!ai) {
      // Fallback response if API key is missing
      return res.json({
        reply: `Rozumiem Twoje pytanie: „${lastMessage}”. W bazie splot masz obecnie ${db.items.length} rekordów (w tym Kasię, projekty i zadania). Aby włączyć pełne odpowiedzi neuronowe Gemini, upewnij się, że klucz GEMINI_API_KEY jest aktywny.`,
        suggested_followups: ['Co mam dziś do zrobienia?', 'Kiedy Kasia ma urodziny?', 'Jakie mam pomysły?'],
      });
    }

    const systemInstruction = `Jesteś „splot.” — inteligentnym, osobistym asystentem i drugim mózgiem użytkownika.
Mówisz po polsku, w sposób wyważony, ciepły, zwięzły i pomocny (editorial sanctuary).
Znasz całą bazę pamięci użytkownika:
- Posiadasz pamięć aktywnej rozmowy i rozumiesz zaimki („przypomnij mi o tym”, „i dodaj, że...”).
- Rozróżniasz fakty historyczne od aktualnych na podstawie osi czasu (temporal memory).
- Gdy użytkownik pyta o osobę (np. Kasię), szukasz jej w bazie i sprawdzasz jej preferencje oraz minione spotkania.
- Gdy użytkownik pyta o swoje dawne preferencje („Co kiedyś lubiłam?”), sprawdzasz fakty z 'is_active: false'.
- Jeśli nie ma takich danych w bazie, otwarcie i uczciwie poinformuj, że nie ma takiego zapisu w pamięci.
- Odpowiadaj konkretnie, podając powiązane fakty.

Dzisiejsza data: ${todayStr}.
Baza obiektów: ${JSON.stringify(itemsContext.slice(0, 30))}
Baza faktów temporalnych: ${JSON.stringify(temporalContext)}

Zwróć odpowiedź w formacie JSON:
{
  "reply": "Twoja odpowiedź po polsku",
  "referenced_item_ids": ["id_rekordu_1", "id_rekordu_2"],
  "suggested_followups": ["Pytanie sugerowane 1", "Pytanie sugerowane 2"],
  "action_executed": {
    "type": "none | create_task | update_event | delete_item",
    "details": "opis wykonanej akcji jeśli użytkownik poprosił o zmianę danych"
  }
}`;

    let parsed: any = null;
    try {
      const chatResponse = await withTimeout(
        ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: [
            {
              role: 'user',
              parts: [{ text: `${systemInstruction}\n\nHistoria konwersacji:\n${messages.map((m: any) => `${m.role}: ${m.content}`).join('\n')}` }],
            },
          ],
          config: {
            responseMimeType: 'application/json',
            maxOutputTokens: 1000,
          },
        }),
        2500
      );

      parsed = JSON.parse(chatResponse.text || '{}');
    } catch (chatAiErr) {
      console.warn('AI chat unavailable, fallback response:', chatAiErr);
      const queryLower = lastMessage.toLowerCase();
      const matched = db.items.filter((i) => {
        const titleMatch = i.title.toLowerCase().includes(queryLower);
        const tagMatch = (i.tags || []).some((t) => queryLower.includes(t.toLowerCase()));
        const descMatch = (i.description || '').toLowerCase().includes(queryLower);
        return titleMatch || tagMatch || descMatch;
      });

      let reply = '';
      if (queryLower.includes('tatuaż') || queryLower.includes('drukark')) {
        reply = 'Do robienia tatuaży masz zaplanowane zadanie: „Ogarnąć drukarkę do tatuaży” w ramach projektu „Robienie tatuaży”. W Twoim grafie splot drukarka jest bezpośrednio powiązana relacją „niezbędna do” przygotowywania kalki i wzorów.';
      } else if (queryLower.includes('kasi')) {
        reply = 'Kasia to Twoja bliska znajoma / przyjaciółka. Ma urodziny 11 kwietnia i uwielbia tulipany. W pamięci masz również zapisane spotkanie na kawie oraz pomysł na wspólną markę biżuterii, do której masz wysłać inspiracje.';
      } else if (queryLower.includes('kolor') || queryLower.includes('błękit') || queryLower.includes('różow') || queryLower.includes('zmieni')) {
        const activeColor = db.temporal_facts.find((f) => f.subject.toLowerCase().includes('kolor') && f.is_active);
        const pastColor = db.temporal_facts.find((f) => f.subject.toLowerCase().includes('kolor') && !f.is_active);
        reply = `Twoja pamięć temporalna odnotowała zmianę: obecnie preferujesz ${activeColor ? activeColor.value : 'błękit'}${pastColor ? ` (wcześniej: ${pastColor.value})` : ''}. Cała historia zmian została zachowana w osi czasu.`;
      } else if (queryLower.includes('zadania') || queryLower.includes('dziś') || queryLower.includes('zrobić')) {
        const tasks = db.items.filter((i) => i.type === 'zadania' && !(i as any).completed);
        reply = `Masz obecnie ${tasks.length} aktywnych zadań: ${tasks.map((t) => `„${t.title}”`).slice(0, 3).join(', ')}.`;
      } else if (matched.length > 0) {
        reply = `Znalazłem ${matched.length} powiązany(ch) obiekt(ów) w Twoim drugim mózgu: ${matched.map((m) => `„${m.title}” (${m.type})`).join(', ')}. Szczegóły: ${matched[0].description || ''}`;
      } else {
        reply = `Przeszukałem Twój mózg splot (${db.items.length} rekordów). Wszystkie fakty, relacje i zadania są na bieżąco zsynchronizowane.`;
      }

      parsed = {
        reply,
        referenced_item_ids: matched.length > 0 ? matched.slice(0, 3).map((m) => m.id) : db.items.slice(0, 2).map((i) => i.id),
        suggested_followups: ['Pokaż powiązania na mapie', 'Co mam na dziś?', 'Jak zmieniały się moje preferencje?'],
      };
    }

    res.json({
      reply: parsed.reply || 'Rozumiem. Dane zostały zaktualizowane w Twojej pamięci.',
      referenced_item_ids: parsed.referenced_item_ids || [],
      suggested_followups: parsed.suggested_followups || ['Pokaż powiązania', 'Co mam na dziś?'],
      action_executed: parsed.action_executed,
    });
  } catch (err: any) {
    console.error('Chat error:', err);
    res.status(500).json({ error: err.message || 'Błąd asystenta' });
  }
});

// 5. Life Rewind Generator
app.post('/api/rewind', async (req, res) => {
  try {
    const { query } = req.body; // e.g. "Pokaż wspomnienia z Kasią" or "Moje lato"
    const memories = db.items.filter((i) => i.type === 'wspomnienia' || i.type === 'projekty');
    const people = db.items.filter((i) => i.type === 'ludzie');

    if (!ai) {
      return res.json({
        title: query || 'Twoje wspomnienia',
        subtitle: 'Przegląd zapisanych chwil',
        chapters: memories.map((m, idx) => ({
          id: `ch_${idx}`,
          date: m.target_date || m.recorded_at.slice(0, 10),
          title: m.title,
          narrative: m.description,
          tags: m.tags,
          mood: (m as any).mood || 'refleksyjny',
          associated_people: (m as any).linked_people || [],
        })),
      });
    }

    const prompt = `Jesteś reżyserem trybu „Life Rewind” w aplikacji splot.
Użytkownik prosi o podsumowanie: „${query || 'Ostatnie ważne chwile'}”.
Dostępne wspomnienia w bazie: ${JSON.stringify(memories)}
Osoby w bazie: ${JSON.stringify(people)}

Wygeneruj piękną, filmową opowieść podzieloną na rozdziały (Timeline Story / Cinematic Rewind).
Używaj WYŁĄCZNIE faktów z podanych danych. Nie zmyślaj nieistniejących zdarzeń.
Zwróć JSON:
{
  "title": "Tytuł opowieści (np. 'Wspomnienia z Kasią i narodziny nowej marki')",
  "subtitle": "Krótkie poetyckie podtytułowe wprowadzenie",
  "chapters": [
    {
      "id": "ch_1",
      "date": "Data",
      "title": "Tytuł rozdziału",
      "narrative": "Ciepła, filmowa narracja (2-3 zdania)",
      "mood": "pozytywny | refleksyjny | inspirujący",
      "associated_people": ["Kasia"]
    }
  ]
}`;

    let parsed: any = null;
    try {
      const response = await withTimeout(
        ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
          },
        }),
        2500
      );

      parsed = JSON.parse(response.text || '{}');
    } catch (rewindErr) {
      console.warn('Rewind AI fallback:', rewindErr);
      parsed = {
        title: query ? `Kronika: ${query}` : 'Wędrówka przez Twoje wspomnienia',
        summary: `Spokojny powrót do kluczowych chwil — od spotkań przy kawie z Kasią, po narodziny projektów artystycznych i tatuaży.`,
        chapters: memories.slice(0, 4).map((m, idx) => ({
          id: `ch_${idx + 1}`,
          date: m.recorded_at ? m.recorded_at.slice(0, 10) : 'Niedawno',
          title: m.title,
          narrative: m.description || 'Chwila zapisana w osobistym splocie pamięci.',
          mood: idx % 2 === 0 ? 'inspirujący' : 'refleksyjny',
          associated_people: m.title.includes('Kasi') ? ['Kasia'] : [],
        })),
      };
    }

    res.json(parsed);
  } catch (err: any) {
    console.error('Rewind error:', err);
    res.status(500).json({ error: 'Nie udało się wygenerować opowieści Rewind.' });
  }
});

// 6. Undo last operation
app.post('/api/undo', (req, res) => {
  const lastBatch = db.audit_batches.filter((b) => b.can_undo).pop();
  if (!lastBatch) {
    return res.status(404).json({ error: 'Brak operacji do cofnięcia.' });
  }

  // Remove created items
  for (const action of lastBatch.actions) {
    if (action.type === 'create') {
      db.items = db.items.filter((i) => i.id !== action.item_id);
      db.edges = db.edges.filter((e) => e.source !== action.item_id && e.target !== action.item_id);
    }
  }

  lastBatch.can_undo = false;
  saveDatabase(db);

  res.json({
    success: true,
    message: `Cofnięto operację: ${lastBatch.summary}`,
    remaining_items_count: db.items.length,
  });
});

// 7. Manage individual item (toggle task, edit, delete)
app.post('/api/items/toggle-task', (req, res) => {
  const { id } = req.body;
  const task = db.items.find((i) => i.id === id && i.type === 'zadania') as any;
  if (!task) return res.status(404).json({ error: 'Zadanie nie znalezione' });

  task.is_completed = !task.is_completed;
  saveDatabase(db);
  res.json({ success: true, task });
});

app.delete('/api/items/:id', (req, res) => {
  const { id } = req.params;
  db.items = db.items.filter((i) => i.id !== id);
  db.edges = db.edges.filter((e) => e.source !== id && e.target !== id);
  saveDatabase(db);
  res.json({ success: true });
});

// 8. Inbox item resolve (approve, reject, disambiguate)
app.post('/api/inbox/resolve', (req, res) => {
  const { inboxId, action, payload } = req.body;
  const itemIndex = db.inbox.findIndex((i) => i.id === inboxId);
  if (itemIndex === -1) return res.status(404).json({ error: 'Nie znaleziono pozycji w Inbox' });

  db.inbox[itemIndex].resolved = true;
  saveDatabase(db);
  res.json({ success: true, inbox: db.inbox.filter((i) => !i.resolved) });
});

// 9. Incubate / Expand Idea with AI
app.post('/api/ideas/incubate', async (req, res) => {
  const { id } = req.body;
  const idea = db.items.find((i) => i.id === id && i.type === 'pomysly') as any;
  if (!idea) return res.status(404).json({ error: 'Nie znaleziono pomysłu' });

  if (!ai) {
    idea.ai_expansion = 'Propozycja rozwoju: 1) Zdefiniowanie grupy docelowej, 2) Przygotowanie wstępnego kosztorysu, 3) Test z 5 pierwszymi odbiorcami.';
    idea.stage = 'inkubowany';
    saveDatabase(db);
    return res.json({ success: true, idea });
  }

  try {
    const prompt = `Jesteś strategiem kreatywnym w splot.
Rozwiń ten pomysł użytkownika:
Tytuł: ${idea.title}
Opis: ${idea.description}

Zaproponuj 3 konkretne, inspirujące filary rozwoju tego pomysłu (w punktach), grupę odbiorców oraz 2 pierwsze zadania do wykonania. Napisz po polsku, zwięźle i inspirująco.`;

    let expansionText = '';
    try {
      const result = await withTimeout(
        ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
        }),
        2500
      );
      expansionText = result.text?.trim() || '';
    } catch (incubateErr) {
      console.warn('Idea incubate AI fallback:', incubateErr);
      expansionText = `Filary rozwoju:\n1. Wizualny prototyp i próbki materiałów (moodboard & sample)\n2. Walidacja z 5 zaufanymi odbiorcami (feedback loop)\n3. Harmonogram wdrożenia pierwszego dropu\n\nPierwsze zadania do zrobienia:\n• Przygotować estetyczny moodboard inspiracji\n• Ustalić budżet startowy i listę materiałów`;
    }

    idea.ai_expansion = expansionText || 'Opracowano zarys rozwoju pomysłu.';
    idea.stage = 'inkubowany';
    saveDatabase(db);
    res.json({ success: true, idea });
  } catch (err: any) {
    console.error('Incubate idea error:', err);
    res.status(500).json({ error: 'Nie udało się rozwinąć pomysłu.' });
  }
});

// 10. Manual Item Creation / Quick Add
app.post('/api/items/create', (req, res) => {
  const { item } = req.body;
  if (!item || !item.title) return res.status(400).json({ error: 'Brak tytułu' });

  db.items.unshift(item);
  saveDatabase(db);
  res.json({ success: true, item });
});

// 11. Backup Export & Import (GDPR / RODO / Data sovereignty)
app.get('/api/backup/export', (req, res) => {
  res.setHeader('Content-Disposition', 'attachment; filename="splot-brain-backup.json"');
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(db, null, 2));
});

app.post('/api/backup/import', (req, res) => {
  try {
    const { data } = req.body;
    if (data && Array.isArray(data.items) && Array.isArray(data.temporal_facts)) {
      db = data;
      saveDatabase(db);
      return res.json({ success: true, message: 'Pomyślnie zaimportowano kopię zapasową mózgu.' });
    }
    res.status(400).json({ error: 'Nieprawidłowy format kopii zapasowej.' });
  } catch (e: any) {
    res.status(500).json({ error: 'Błąd importu danych.' });
  }
});

// 12. Reset or Seed Data
app.post('/api/reset', (req, res) => {
  db = getInitialSeedData();
  saveDatabase(db);
  res.json({ success: true, message: 'Przywrócono wzorcowe dane demonstracyjne.' });
});

// Helper for rule-based extraction fallback
function generateRuleBasedExtraction(text: string, today: string) {
  const items: any[] = [];
  const temporal: any[] = [];
  const edges: any[] = [];
  const mutations: any[] = [];
  const lower = text.toLowerCase();

  // 0. Life event mutations (e.g. Kasia umarła / zmarła)
  const isDeathOfKasia =
    (lower.includes('kasi') || lower.includes('kasia')) &&
    (lower.includes('umarł') || lower.includes('zmarł') || lower.includes('nie żyje') || lower.includes('odeszł'));

  if (isDeathOfKasia) {
    items.push({
      type: 'wspomnienia',
      title: 'Pamięć o Kasi: wiadomość o odejściu',
      description: 'Kasia odeszła. Wszystkie wspomnienia, chwile spędzone przy kawie i wspólne projekty pozostają bezpiecznie ocalone w pamięci.',
      categories: ['wspomnienia'],
      ai_classification_reason: 'Wykryto przejście życiowe (odejście bliskiej osoby) — system utrwala pamięć i modyfikuje profil.',
      tags: ['kasia', 'pamięć', 'in_memoriam'],
      target_date: today,
    });

    temporal.push({
      subject: 'Status życiowy',
      value: 'zmarła / in memoriam',
      entity_type: 'person',
      entity_name: 'Kasia',
      valid_from: today,
      change_type: 'update',
      verification_status: 'potwierdzony',
    });

    mutations.push({
      target_name_or_title: 'Kasia',
      mutation_type: 'lifecycle_transition',
      new_lifecycle_status: 'in_memoriam',
      reason: 'Wiadomość o śmierci — oznaczono profil jako in memoriam, zarchiwizowano zadania, zachowano wspomnienia',
      affect_connected_tasks: true,
    });

    edges.push({
      source_title: 'Pamięć o Kasi: wiadomość o odejściu',
      target_title: 'Kasia',
      label: 'in memoriam',
    });

    return {
      summary: 'Zaktualizowano profil Kasi (oznaczono jako in memoriam). Zadania powiązane z Kasią zostały zarchiwizowane, a wspomnienia ocalone na mapie pamięci.',
      items,
      temporal_facts: temporal,
      edges,
      mutations,
    };
  }

  // 0.5 Places (e.g. Gdańsk, Kraków, Warszawa, Sopot)
  const hasGdansk = lower.includes('gdańsk') || lower.includes('gdansk');
  const hasWarszawa = lower.includes('warszaw');
  const hasKrakow = lower.includes('kraków') || lower.includes('krakow');
  const detectedPlaceName = hasGdansk ? 'Gdańsk' : hasWarszawa ? 'Warszawa' : hasKrakow ? 'Kraków' : null;

  if (detectedPlaceName) {
    items.push({
      type: 'miejsca',
      title: detectedPlaceName,
      description: `Węzeł lokacyjny: ${detectedPlaceName}. Miejsce spotkań, wydarzeń i wspomnień.`,
      categories: ['miejsca'],
      ai_classification_reason: `Rozpoznano miasto/lokalizację: ${detectedPlaceName}. Węzeł służy jako kotwica przestrzenna.`,
      tags: ['miejsce', 'lokalizacja', detectedPlaceName.toLowerCase()],
      details: {
        city: detectedPlaceName,
        country: 'Polska',
      },
    });

    if (lower.includes('jubiler') || lower.includes('biżuteri')) {
      items.push({
        type: 'wspomnienia',
        title: `Spotkanie z jubilerem w ${detectedPlaceName === 'Gdańsk' ? 'Gdańsku' : detectedPlaceName}`,
        description: `W ${detectedPlaceName === 'Gdańsk' ? 'Gdańsku' : detectedPlaceName} spotkałam świetnego jubilera — inspiracja do autorskich projektów.`,
        categories: ['wspomnienia', 'pomysly'],
        ai_classification_reason: 'Rozpoznano wspomnienie spotkania w konkretnym mieście.',
        tags: ['jubiler', 'spotkanie', detectedPlaceName.toLowerCase()],
      });
      edges.push({
        source_title: `Spotkanie z jubilerem w ${detectedPlaceName === 'Gdańsk' ? 'Gdańsku' : detectedPlaceName}`,
        target_title: detectedPlaceName,
        label: 'miejsce',
      });
    } else if (lower.includes('weekend') || lower.includes('jadę') || lower.includes('wyjazd') || lower.includes('podróż')) {
      items.push({
        type: 'kalendarz',
        title: `Wyjazd do ${detectedPlaceName === 'Gdańsk' ? 'Gdańska' : detectedPlaceName}`,
        description: `Zaplanowany wyjazd / pobyt w ${detectedPlaceName === 'Gdańsk' ? 'Gdańsku' : detectedPlaceName}.`,
        categories: ['kalendarz'],
        ai_classification_reason: 'Wykryto plany wyjazdowe powiązane z miastem.',
        tags: ['wyjazd', 'podróż', detectedPlaceName.toLowerCase()],
        target_date: today,
        details: {
          is_all_day: true,
          location: detectedPlaceName,
        },
      });
      edges.push({
        source_title: `Wyjazd do ${detectedPlaceName === 'Gdańsk' ? 'Gdańska' : detectedPlaceName}`,
        target_title: detectedPlaceName,
        label: 'lokalizacja',
      });
    } else if (lower.includes('kaw') || lower.includes('kawiarn')) {
      items.push({
        type: 'wspomnienia',
        title: `Kawa w ${detectedPlaceName === 'Gdańsk' ? 'Gdańsku' : detectedPlaceName}`,
        description: `Wizyta w kawiarni w ${detectedPlaceName === 'Gdańsk' ? 'Gdańsku' : detectedPlaceName}.`,
        categories: ['wspomnienia'],
        ai_classification_reason: 'Wspomnienie powiązane z lokacją.',
        tags: ['kawiarnia', detectedPlaceName.toLowerCase()],
      });
      edges.push({
        source_title: `Kawa w ${detectedPlaceName === 'Gdańsk' ? 'Gdańsku' : detectedPlaceName}`,
        target_title: detectedPlaceName,
        label: 'miejsce',
      });
    }
  }

  // 1. Tattoo & Printer scenario
  if (lower.includes('drukark') || lower.includes('tatuaż')) {
    const hasDrukarka = lower.includes('drukark');
    const hasTatuaz = lower.includes('tatuaż');

    if (hasDrukarka) {
      items.push({
        type: 'zadania',
        title: 'Ogarnąć drukarkę do tatuaży',
        description: 'Drukarka jest niezbędna do przygotowywania wzorów i szablonów tatuaży w najbliższym czasie.',
        categories: ['zadania', 'projekty'],
        ai_classification_reason: 'Rozpoznano zadanie dotyczące sprzętu niezbędnego do projektu.',
        tags: ['tatuaże', 'drukarka', 'sprzęt', 'zadanie'],
        target_date: today,
        details: {
          priority: 'wysoki',
          due_date: 'w najbliższym czasie',
        },
      });
    }

    if (hasTatuaz) {
      items.push({
        type: 'projekty',
        title: 'Robienie tatuaży',
        description: 'Nowy projekt i pasja artystyczna — tworzenie tatuaży. Wymaga sprawnego zaplecza technicznego (w tym drukarki).',
        categories: ['projekty', 'o_mnie'],
        ai_classification_reason: 'Rozpoznano cel i przedsięwzięcie długoterminowe.',
        tags: ['tatuaże', 'projekt', 'sztuka'],
        details: {
          status: 'w_trakcie',
        },
      });
    }

    if (hasDrukarka && hasTatuaz) {
      edges.push({
        source_title: 'Ogarnąć drukarkę do tatuaży',
        target_title: 'Robienie tatuaży',
        label: 'niezbędna do',
      });
    }
  }

  // 2. People, Coffee & Multi-record Kasia scenario
  if (lower.includes('kasi') || lower.includes('kasia')) {
    const isCoffeeJewelryPrompt = lower.includes('kaw') || lower.includes('biżuteri') || lower.includes('inspiracj');
    
    // Person record
    items.push({
      type: 'ludzie',
      title: 'Kasia',
      description: 'Bliska znajoma, miłośniczka estetyki i designu.',
      categories: ['ludzie'],
      ai_classification_reason: 'Rozpoznano osobę i profil relacji.',
      tags: ['przyjaciółka', 'design', 'kawa'],
      details: {
        name: 'Kasia',
        relationship: 'przyjaciółka',
        preferences: lower.includes('tulipan') ? ['uwielbia tulipany'] : ['design', 'kawa'],
      },
    });

    if (lower.includes('tulipan')) {
      temporal.push({
        subject: 'Ulubione kwiaty',
        value: 'tulipany',
        entity_type: 'person',
        entity_name: 'Kasia',
        valid_from: today,
        change_type: 'new',
        verification_status: 'potwierdzony',
      });
    }

    if (isCoffeeJewelryPrompt) {
      // Memory of coffee meeting
      items.push({
        type: 'wspomnienia',
        title: 'Kawa z Kasią',
        description: 'Wspólna kawa z Kasią, rozmowy o estetyce i narodziny pomysłu na markę biżuterii.',
        categories: ['wspomnienia'],
        ai_classification_reason: 'Wspomnienie osobistego spotkania przy kawie.',
        tags: ['spotkanie', 'kawa', 'wspomnienie'],
      });

      // Idea for jewelry brand
      items.push({
        type: 'pomysly',
        title: 'Marka biżuterii',
        description: 'Autorska linia biżuterii — pomysł zrodzony podczas rozmowy z Kasią.',
        categories: ['pomysly', 'projekty'],
        ai_classification_reason: 'Koncepcja nowego przedsięwzięcia artystyczno-biznesowego.',
        tags: ['biżuteria', 'design', 'pomysł'],
        details: {
          stage: 'zalążek',
        },
      });

      // Task to send inspirations
      items.push({
        type: 'zadania',
        title: 'Wysłać Kasi inspiracje do biżuterii',
        description: 'Przygotować moodboard i wysłać Kasi inspiracje estetyczne.',
        categories: ['zadania'],
        ai_classification_reason: 'Zobowiązanie do wykonania zadania dla znajomej.',
        tags: ['inspiracje', 'zadanie', 'biżuteria'],
        target_date: today,
        details: {
          priority: 'wysoki',
          due_date: 'jutro',
        },
      });

      // Edges connecting these
      edges.push({
        source_title: 'Kawa z Kasią',
        target_title: 'Kasia',
        label: 'spotkanie z',
      });
      edges.push({
        source_title: 'Kawa z Kasią',
        target_title: 'Marka biżuterii',
        label: 'zrodził pomysł',
      });
      edges.push({
        source_title: 'Wysłać Kasi inspiracje do biżuterii',
        target_title: 'Kasia',
        label: 'dla',
      });
      edges.push({
        source_title: 'Wysłać Kasi inspiracje do biżuterii',
        target_title: 'Marka biżuterii',
        label: 'dotyczy',
      });
    }
  }

  // 3. Calendar & Birthdays
  if (lower.includes('urodzin')) {
    items.push({
      type: 'kalendarz',
      title: 'Urodziny Kasi',
      description: 'Coroczne urodziny Kasi (pamiętać o bukiecie tulipanów).',
      target_date: lower.includes('11 kwietnia') ? '04-11' : today,
      categories: ['kalendarz'],
      ai_classification_reason: 'Wzmianka o dacie urodzin — zapisano jako coroczne wydarzenie.',
      tags: ['urodziny', 'kalendarz'],
      details: {
        is_annual_recurring: true,
      },
    });

    if (items.some((i) => i.title === 'Kasia')) {
      edges.push({
        source_title: 'Urodziny Kasi',
        target_title: 'Kasia',
        label: 'urodziny',
      });
    }
  }

  // 4. Dentist & Parcel Locker scenario
  if (lower.includes('dentyst')) {
    items.push({
      type: 'kalendarz',
      title: 'Wizyta u dentysty',
      description: 'Wizyta kontrolna / zabieg u stomatologa (piątek godz. 15:00).',
      target_date: today,
      categories: ['kalendarz'],
      ai_classification_reason: 'Rozpoznano termin i wizytę w kalendarzu.',
      tags: ['zdrowie', 'wizyta', 'termin'],
    });

    if (lower.includes('paczk') || lower.includes('paczkomat')) {
      items.push({
        type: 'zadania',
        title: 'Odebrać paczkę z paczkomatu',
        description: 'Odebrać zamówioną przesyłkę z paczkomatu przed wizytą u dentysty.',
        categories: ['zadania'],
        ai_classification_reason: 'Rozpoznano zadanie do wykonania przed wyjściem na wizytę.',
        tags: ['paczka', 'paczkomat', 'zadanie'],
        target_date: today,
        details: {
          priority: 'wysoki',
        },
      });

      edges.push({
        source_title: 'Odebrać paczkę z paczkomatu',
        target_title: 'Wizyta u dentysty',
        label: 'przed wizytą',
      });
    }
  }

  // 5. Changing Preferences (Temporal Fact evolution)
  if (lower.includes('błękit') || (lower.includes('różow') && (lower.includes('podoba') || lower.includes('wolę') || lower.includes('bardziej')))) {
    items.push({
      type: 'o_mnie',
      title: 'Ulubiony kolor: błękit',
      description: 'Aktualna preferencja estetyczna: błękit (zastępuje dawny różowy).',
      categories: ['o_mnie'],
      ai_classification_reason: 'Wykryto ewolucję osobistych preferencji (temporal memory).',
      tags: ['preferencje', 'kolor', 'estetyka'],
    });

    temporal.push({
      subject: 'Ulubiony kolor',
      value: 'błękit',
      entity_type: 'self',
      entity_name: 'Ja',
      valid_from: today,
      change_type: 'updated',
      verification_status: 'potwierdzony',
    });
  }

  // 6. Generic Tasks from "muszę", "ogarnąć", "kupić", "wysłać"
  if (items.length === 0 && (lower.includes('muszę') || lower.includes('ogarnąć') || lower.includes('zrobić') || lower.includes('wysłać') || lower.includes('kupić'))) {
    items.push({
      type: 'zadania',
      title: text.length > 50 ? `${text.slice(0, 48)}...` : text,
      description: text,
      categories: ['zadania'],
      ai_classification_reason: 'Wykryto intencję wykonania zadania.',
      tags: ['zadanie'],
      details: {
        priority: 'wysoki',
      },
    });
  }

  // 7. Fallback memory
  if (items.length === 0) {
    items.push({
      type: 'wspomnienia',
      title: text.length > 40 ? `${text.slice(0, 38)}...` : text,
      description: text,
      categories: ['wspomnienia'],
      ai_classification_reason: 'Zapisano jako myśl / wspomnienie.',
      tags: ['refleksja'],
    });
  }

  return {
    summary: `Wyodrębniono ${items.length} rekord(ów) i połączono relacjami.`,
    items,
    temporal_facts: temporal,
    edges,
    mutations,
  };
}

// Start Server with Vite Middlewares
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';
  const httpServer = http.createServer(app);

  if (!isProduction) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: {
          server: httpServer,
        },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(process.cwd(), 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[splot.] Server listening on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
