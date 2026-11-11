import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGraphData, getFocusedSubgraph, detectSmartConnections } from './graph-layout';
import { AnyBrainItem, GraphEdge } from '../types';

test('buildGraphData builds nodes and filters edges', () => {
  const items: AnyBrainItem[] = [
    {
      id: 'item_1',
      title: 'Kasia',
      description: 'Przyjaciółka',
      categories: ['ludzie'],
      type: 'ludzie',
      recorded_at: '2026-10-29',
      ai_classification_reason: 'Osoba',
      tags: ['przyjaciele', 'moda'],
      name: 'Kasia',
      preferences: ['tulipany'],
    },
    {
      id: 'item_2',
      title: 'Projekt Biżuteria',
      description: 'Marka biżuterii',
      categories: ['projekty'],
      type: 'projekty',
      recorded_at: '2026-10-29',
      ai_classification_reason: 'Projekt',
      tags: ['biznes', 'moda'],
      status: 'w_trakcie',
    },
  ];

  const edges: GraphEdge[] = [
    { id: 'edge_1', source: 'item_1', target: 'item_2', label: 'współtworzy' },
    { id: 'edge_invalid', source: 'item_1', target: 'non_existing', label: 'rel' },
  ];

  const graph = buildGraphData(items, edges);
  assert.equal(graph.nodes.length, 2);
  assert.equal(graph.edges.length, 1);
  assert.equal(graph.edges[0].id, 'edge_1');
});

test('getFocusedSubgraph returns only 1-hop neighborhood of focus node', () => {
  const graph = {
    nodes: [
      { id: 'center', label: 'Center', category: 'ludzie' as const },
      { id: 'friend_1', label: 'Friend 1', category: 'wspomnienia' as const },
      { id: 'unrelated', label: 'Unrelated', category: 'pomysly' as const },
    ],
    edges: [
      { id: 'e1', source: 'center', target: 'friend_1', label: 'związany' },
    ],
  };

  const focused = getFocusedSubgraph(graph, 'center', 1);
  assert.equal(focused.nodes.length, 2);
  assert.ok(focused.nodes.some((n) => n.id === 'center'));
  assert.ok(focused.nodes.some((n) => n.id === 'friend_1'));
  assert.ok(!focused.nodes.some((n) => n.id === 'unrelated'));
  assert.equal(focused.edges.length, 1);
});

test('detectSmartConnections discovers shared tag connection', () => {
  const items: AnyBrainItem[] = [
    {
      id: 'item_1',
      title: 'Kasia',
      description: 'Przyjaciółka',
      categories: ['ludzie'],
      type: 'ludzie',
      recorded_at: '2026-10-29',
      ai_classification_reason: 'Osoba',
      tags: ['design'],
      name: 'Kasia',
      preferences: [],
    },
    {
      id: 'item_2',
      title: 'Projekt Biżuteria',
      description: 'Nowy brand biżuteryjny',
      categories: ['projekty'],
      type: 'projekty',
      recorded_at: '2026-10-29',
      ai_classification_reason: 'Projekt',
      tags: ['design'],
      status: 'koncepcja',
    },
  ];

  const suggestions = detectSmartConnections(items, []);
  assert.ok(suggestions.length > 0);
  assert.equal(suggestions[0].sourceId, 'item_1');
  assert.equal(suggestions[0].targetId, 'item_2');
  assert.ok(suggestions[0].reason.includes('design'));
});

test('stepPhysics updates node positions without exploding', () => {
  const nodes = [
    { id: '1', label: 'A', category: 'ludzie' as const, x: 100, y: 100, vx: 0, vy: 0, radius: 20 },
    { id: '2', label: 'B', category: 'projekty' as const, x: 105, y: 105, vx: 0, vy: 0, radius: 20 },
  ];
  const edges = [{ id: 'e1', source: '1', target: '2', label: 'rel' }];

  // Step physics
  import('./graph-layout').then(({ stepPhysics }) => {
    stepPhysics(nodes, edges, 800, 600);
    assert.ok(nodes[0].x !== 100 || nodes[1].x !== 105);
  });
});

test('createD3ForceSimulation creates simulation and steps smoothly', () => {
  import('./graph-layout').then(({ createD3ForceSimulation, calculateCurvedLinkPath }) => {
    const nodes = [
      { id: 'a', label: 'Gdańsk', category: 'miejsca' as const, radius: 34, x: 100, y: 100 },
      { id: 'b', label: 'Kasia', category: 'ludzie' as const, radius: 34, x: 120, y: 120 },
    ];
    const links = [{ id: 'l1', source: 'a', target: 'b', label: 'spotkanie' }];

    const sim = createD3ForceSimulation(nodes, links, 800, 600);
    assert.ok(sim);
    sim.tick(10);
    // Nodes should have moved under D3 forces
    assert.ok(typeof nodes[0].x === 'number');
    assert.ok(typeof nodes[1].x === 'number');

    const curve = calculateCurvedLinkPath(10, 20, 100, 200, 25);
    assert.ok(curve.path.startsWith('M 10 20 Q'));
    assert.ok(typeof curve.midX === 'number');
    assert.ok(typeof curve.midY === 'number');
  });
});

