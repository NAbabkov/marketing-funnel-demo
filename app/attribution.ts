import type { Demo, Event, Placement } from "./demo";

export type AttributionModel = "first" | "last" | "linear" | "decay";
export type AttributionGroup = "placement" | "campaign" | "channel";
export type AttributionOptions = { model: AttributionModel; windowDays: number; halfLifeDays: number };
export type Allocation = { placementId: string | null; weight: number; revenue: number; touchAt: string | null };
export type PurchaseAttribution = { purchase: Event; allocations: Allocation[]; path: { placementId: string; at: string }[] };
export type AttributionRow = { key: string; name: string; detail: string; placementIds: string[]; revenue: number; creditedPurchases: number; cost: number; roas: number | null };
const DAY = 86_400_000;

// Старые стартовые события — заранее созданная синтетика. Их связи заданы только для
// известных ID из исходного демо; старые пользовательские события не склеиваются догадками.
function visitorKey(event: Event): string | null {
  if (event.visitorId) return event.visitorId;
  const match = /^([vp])-(\d+)-(\d+)$/.exec(event.id);
  if (!match) return null;
  const [, kind, indexText, personText] = match;
  const index = Number(indexText), person = Number(personText);
  if (index > 3 || event.placementId !== `demo-${index + 1}` || (kind === "v") !== (event.kind === "visit")) return null;
  // Три вымышленных посетителя взаимодействуют с несколькими размещениями.
  return person < 3 ? `synthetic-shared-${person}` : `synthetic-${index}-${person}`;
}

export function attribute(data: Demo, options: AttributionOptions): PurchaseAttribution[] {
  const { model, windowDays, halfLifeDays } = options;
  if (!Number.isFinite(windowDays) || windowDays <= 0 || !Number.isFinite(halfLifeDays) || halfLifeDays <= 0) throw new Error("Окно и период полураспада должны быть положительными");
  const placementIds = new Set(data.placements.map((placement) => placement.id));
  const visitsByVisitor = new Map<string, Event[]>();
  for (const event of data.events) {
    if (event.kind !== "visit" || !placementIds.has(event.placementId)) continue;
    const key = visitorKey(event);
    if (key) {
      const bucket = visitsByVisitor.get(key);
      if (bucket) bucket.push(event); else visitsByVisitor.set(key, [event]);
    }
  }
  return data.events.filter((event) => event.kind === "purchase").map((purchase) => {
    const buyer = visitorKey(purchase);
    const paidAt = Date.parse(purchase.at);
    const unique = new Map<string, Event>();
    if (buyer && Number.isFinite(paidAt)) {
      for (const visit of visitsByVisitor.get(buyer) ?? []) {
        const touchedAt = Date.parse(visit.at);
        const age = paidAt - touchedAt;
        if (!Number.isFinite(touchedAt) || age < 0 || age > windowDays * DAY) continue;
        const previous = unique.get(visit.placementId);
        // Повторы одного размещения не должны умножать его долю.
        if (!previous || (model === "first" ? touchedAt < Date.parse(previous.at) : touchedAt > Date.parse(previous.at))) unique.set(visit.placementId, visit);
      }
    }
    const path = [...unique.values()].sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.placementId.localeCompare(b.placementId));
    const selected = model === "first" ? path.slice(0, 1) : model === "last" ? path.slice(-1) : path;
    const amount = purchase.amount ?? 0;
    if (!selected.length) return { purchase, path: [], allocations: [{ placementId: null, weight: 1, revenue: amount, touchAt: null }] };
    // Смещаем веса к ближайшему касанию: нормализация не меняется,
    // но даже при очень большом окне они не исчезают из-за округления.
    const nearest = Math.min(...selected.map((touch) => paidAt - Date.parse(touch.at)));
    const weights = selected.map((touch) => model === "decay" ? 2 ** (-(paidAt - Date.parse(touch.at) - nearest) / DAY / halfLifeDays) : 1);
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    return {
      purchase,
      path: path.map(({ placementId, at }) => ({ placementId, at })),
      allocations: selected.map((touch, index) => ({ placementId: touch.placementId, weight: weights[index] / total, revenue: amount * weights[index] / total, touchAt: touch.at })),
    };
  });
}

// Фильтр применяется после распределения. Доли скрытых касаний не перераспределяем.
export function attributionRows(data: Demo, results: PurchaseAttribution[], group: AttributionGroup, campaign: string, channel: string): AttributionRow[] {
  const selected = data.placements.filter((placement) => (!campaign || placement.campaign === campaign) && (!channel || placement.channel === channel));
  const selectedIds = new Set(selected.map((placement) => placement.id));
  const rows = new Map<string, AttributionRow>();
  const keyFor = (placement: Placement) => `${group}:${group === "placement" ? placement.id : group === "campaign" ? placement.campaign : placement.channel}`;
  for (const placement of selected) {
    const key = keyFor(placement);
    const existing = rows.get(key);
    if (existing) { existing.cost += placement.cost; existing.placementIds.push(placement.id); }
    else rows.set(key, { key, name: group === "placement" ? placement.title : group === "campaign" ? placement.campaign : placement.channel, detail: group === "placement" ? `${placement.channel} · ${placement.campaign}` : "", placementIds: [placement.id], revenue: 0, creditedPurchases: 0, cost: placement.cost, roas: null });
  }
  const byId = new Map(data.placements.map((placement) => [placement.id, placement]));
  for (const result of results) for (const allocation of result.allocations) {
    if (allocation.placementId === null) {
      if (campaign || channel) continue;
      const key = "__unknown__";
      if (!rows.has(key)) rows.set(key, { key, name: "Источник неизвестен", detail: "Нет подходящих переходов", placementIds: [], revenue: 0, creditedPurchases: 0, cost: 0, roas: null });
      const row = rows.get(key)!; row.revenue += allocation.revenue; row.creditedPurchases += allocation.weight;
    } else if (selectedIds.has(allocation.placementId)) {
      const placement = byId.get(allocation.placementId)!;
      const row = rows.get(keyFor(placement))!; row.revenue += allocation.revenue; row.creditedPurchases += allocation.weight;
    }
  }
  return [...rows.values()].map((row) => ({ ...row, roas: row.cost > 0 ? row.revenue / row.cost : null })).sort((a, b) => b.revenue - a.revenue || a.name.localeCompare(b.name, "ru"));
}

export function csvCell(value: string | number): string {
  let text = String(value);
  // Электронные таблицы могут выполнять ячейки как формулы, включая ввод с пробелом.
  if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
