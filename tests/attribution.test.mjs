import test from 'node:test';
import assert from 'node:assert/strict';
import { attribute, attributionRows, csvCell } from '../app/attribution.ts';

const placements = [
  { id:'a', title:'Первый пост', channel:'Канал A', campaign:'Кампания', date:'2026-09-01', cost:100, price:1000 },
  { id:'b', title:'Второй пост', channel:'Канал B', campaign:'Кампания', date:'2026-09-02', cost:0, price:1000 },
];
const event = (id, placementId, kind, at, visitorId, amount) => ({ id, placementId, kind, at, ...(visitorId && { visitorId }), ...(amount && { amount }) });
const visits = [
  event('a1','a','visit','2026-09-01T10:00:00Z','person'),
  event('a2','a','visit','2026-09-02T10:00:00Z','person'),
  event('b1','b','visit','2026-09-03T10:00:00Z','person'),
  event('other','b','visit','2026-09-04T10:00:00Z','other'),
  event('future','b','visit','2026-09-10T10:00:00Z','person'),
];
const buy = event('purchase','b','purchase','2026-09-04T10:00:00Z','person',1000);
const options = (model, windowDays=30, halfLifeDays=1) => ({ model, windowDays, halfLifeDays });

test('модели распределяют одну покупку и не умножают повторные касания', () => {
  const data = { placements, events:[...visits,buy] };
  const first = attribute(data, options('first'))[0];
  const last = attribute(data, options('last'))[0];
  const linear = attribute(data, options('linear'))[0];
  const decay = attribute(data, options('decay'))[0];
  assert.equal(first.allocations[0].placementId,'a');
  assert.equal(last.allocations[0].placementId,'b');
  assert.deepEqual(linear.allocations.map(a => a.weight),[0.5,0.5]);
  assert.deepEqual(linear.path.map(t => t.placementId),['a','b']);
  assert.ok(decay.allocations[1].weight > decay.allocations[0].weight);
  for (const result of [first,last,linear,decay]) {
    assert.ok(Math.abs(result.allocations.reduce((s,a)=>s+a.weight,0)-1)<1e-12);
    assert.ok(Math.abs(result.allocations.reduce((s,a)=>s+a.revenue,0)-1000)<1e-9);
  }
});

test('Time Decay сохраняет корректные веса даже при очень коротком полураспаде', () => {
  const result = attribute({ placements, events:[...visits,buy] }, options('decay',30,0.000001))[0];
  assert.ok(result.allocations.every(a => Number.isFinite(a.weight) && Number.isFinite(a.revenue)));
  assert.ok(Math.abs(result.allocations.reduce((sum,a) => sum + a.weight,0) - 1) < 1e-12);
});

test('окно исключает старые, будущие и чужие переходы; без связи источник неизвестен', () => {
  const data = { placements, events:[...visits,buy,event('old','a','purchase','2026-09-04T10:00:00Z',undefined,500)] };
  const [within, unknown] = attribute(data, options('linear',1));
  assert.deepEqual(within.path.map(t=>t.placementId),['b']);
  assert.deepEqual(unknown.allocations.map(a=>[a.placementId,a.revenue]),[[null,500]]);
  assert.throws(()=>attribute(data,options('first',0)),/положительными/);
});

test('фильтрация выполняется после атрибуции, нулевой расход не даёт ROAS', () => {
  const data = { placements, events:[...visits,buy] };
  const result = attribute(data,options('linear'));
  const filtered = attributionRows(data,result,'channel','','Канал B');
  assert.equal(filtered.length,1);
  assert.equal(filtered[0].revenue,500);
  assert.equal(filtered[0].creditedPurchases,0.5);
  assert.equal(filtered[0].roas,null);
  const grouped = attributionRows(data,result,'campaign','','');
  assert.equal(grouped[0].revenue,1000);
  assert.equal(grouped[0].cost,100);
  assert.equal(grouped[0].roas,10);
});

test('экспорт экранирует формулы и кавычки', () => {
  assert.equal(csvCell(' =HYPERLINK("x")'), '"\' =HYPERLINK(""x"")"');
  assert.equal(csvCell('обычный;текст'), '"обычный;текст"');
});

test('только исходная синтетика получает демонстрационные связи', () => {
  const demoPlacement = { ...placements[0], id:'demo-1' };
  const seed = { placements:[demoPlacement], events:[event('v-0-0','demo-1','visit','2026-09-01T10:00:00Z'),event('p-0-0','demo-1','purchase','2026-09-02T10:00:00Z',undefined,1000)] };
  assert.equal(attribute(seed,options('first'))[0].allocations[0].placementId,'demo-1');
  const legacy = { placements:[demoPlacement], events:[event('manual-visit','demo-1','visit','2026-09-01T10:00:00Z'),event('manual-payment','demo-1','purchase','2026-09-02T10:00:00Z',undefined,1000)] };
  assert.equal(attribute(legacy,options('first'))[0].allocations[0].placementId,null);
});
