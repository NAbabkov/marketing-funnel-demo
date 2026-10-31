export type Placement = {
  id: string;
  title: string;
  channel: string;
  campaign: string;
  date: string;
  cost: number;
  price: number;
};
export type Event = {
  id: string;
  placementId: string;
  kind: "visit" | "purchase";
  at: string;
  amount?: number;
  visitorId?: string;
};
export type Demo = { placements: Placement[]; events: Event[] };

export const STORAGE_KEY = "marketing-demo-v1";
export const rub = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});
export const number = new Intl.NumberFormat("ru-RU");
export const dateLabel = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" });
export const dayName = new Intl.DateTimeFormat("ru-RU", { weekday: "short" });
export const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export const parseDate = (date: string) => new Date(`${date}T12:00:00`);
export const addDays = (date: Date, days: number) => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
};
export const startOfWeek = (date: Date) => addDays(date, -((date.getDay() + 6) % 7));

// Демо-примеры на исторических датах нужны, чтобы увидеть оба типа карточек рядом.
const archiveExamples: Placement[] = [
  { id: "demo-archive-1", title: "Разбор задач: открытый урок", channel: "Учёба без паники", campaign: "Демо-кампания", date: "2026-09-07", cost: 8000, price: 4900 },
  { id: "demo-archive-2", title: "Практика перед олимпиадой", channel: "Клуб любопытных", campaign: "Демо-кампания", date: "2026-09-09", cost: 6000, price: 3900 },
  { id: "demo-archive-3", title: "Неделя открытых занятий", channel: "Математика на пальцах", campaign: "Демо-кампания", date: "2026-09-10", cost: 0, price: 3900 },
];
export function includeArchiveExamples(data: Demo): Demo {
  const existing = new Set(data.placements.map((item) => item.id));
  const missing = archiveExamples.filter((item) => !existing.has(item.id));
  return missing.length ? { ...data, placements: [...data.placements, ...missing] } : data;
}

// Все стартовые данные выдуманы. События сохраняются только в этом браузере.
export function makeDemo(): Demo {
  const monday = startOfWeek(new Date());
  const placements: Placement[] = [
    {
      id: "demo-1",
      title: "Задача, которая всех запутала",
      channel: "Математика на пальцах",
      campaign: "Осенний набор",
      date: dateKey(addDays(monday, 0)),
      cost: 12000,
      price: 4900,
    },
    {
      id: "demo-2",
      title: "Как подготовиться к олимпиаде",
      channel: "Учёба без паники",
      campaign: "Осенний набор",
      date: dateKey(addDays(monday, 2)),
      cost: 8000,
      price: 4900,
    },
    {
      id: "demo-3",
      title: "Три приёма для сложных задач",
      channel: "Клуб любопытных",
      campaign: "Практикум",
      date: dateKey(addDays(monday, 4)),
      cost: 6000,
      price: 3900,
    },
    {
      id: "demo-4",
      title: "Неделя открытых занятий",
      channel: "Заметки абитуриента",
      campaign: "Практикум",
      date: dateKey(addDays(monday, 6)),
      cost: 0,
      price: 3900,
    },
  ];
  const volumes = [
    [34, 5],
    [23, 3],
    [17, 2],
    [9, 1],
  ];
  const events: Event[] = [];
  placements.forEach((p, index) => {
    const [visits, purchases] = volumes[index];
    for (let i = 0; i < visits; i++)
      events.push({
        id: `v-${index}-${i}`,
        placementId: p.id,
        kind: "visit",
        at: `${p.date}T12:00:00.000Z`,
      });
    for (let i = 0; i < purchases; i++)
      events.push({
        id: `p-${index}-${i}`,
        placementId: p.id,
        kind: "purchase",
        at: `${p.date}T12:00:00.000Z`,
        amount: p.price,
      });
  });
  return includeArchiveExamples({ placements, events });
}
// Повреждённое или несовместимое хранилище не должно ломать интерфейс.
export function parseDemo(saved: string): Demo | null {
  try {
    const value = JSON.parse(saved) as Demo;
    const validDate = (date: unknown) => typeof date === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(parseDate(date).getTime()) &&
      dateKey(parseDate(date)) === date;
    if (!value || !Array.isArray(value.placements) || !Array.isArray(value.events)) return null;
    const ids = new Set<string>();
    for (const p of value.placements) {
      if (!p || typeof p.id !== "string" || !p.id || ids.has(p.id) ||
          typeof p.title !== "string" || !p.title.trim() || p.title.length > 100 ||
          typeof p.channel !== "string" || !p.channel.trim() || p.channel.length > 80 ||
          typeof p.campaign !== "string" || !p.campaign.trim() || p.campaign.length > 80 ||
          !validDate(p.date) || !Number.isInteger(p.cost) || p.cost < 0 || p.cost > 100000000 ||
          !Number.isInteger(p.price) || p.price < 1 || p.price > 100000000) return null;
      ids.add(p.id);
    }
    const eventIds = new Set<string>();
    for (const e of value.events) {
      if (!e || typeof e.id !== "string" || !e.id || eventIds.has(e.id) ||
          !ids.has(e.placementId) || (e.kind !== "visit" && e.kind !== "purchase") ||
          typeof e.at !== "string" || Number.isNaN(Date.parse(e.at)) ||
          (e.visitorId !== undefined && (typeof e.visitorId !== "string" || !e.visitorId || e.visitorId.length > 128)) ||
          (e.kind === "purchase" && (!Number.isInteger(e.amount) || e.amount! < 1 || e.amount! > 100000000))) return null;
      eventIds.add(e.id);
    }
    return value;
  } catch {
    return null;
  }
}
export function metrics(data: Demo, id?: string) {
  const events = id ? data.events.filter((event) => event.placementId === id) : data.events;
  const placements = id ? data.placements.filter((item) => item.id === id) : data.placements;
  const visits = events.filter((event) => event.kind === "visit").length;
  const purchases = events.filter((event) => event.kind === "purchase");
  const revenue = purchases.reduce((sum, event) => sum + (Number(event.amount) || 0), 0);
  const cost = placements.reduce((sum, item) => sum + item.cost, 0);
  return {
    visits,
    purchases: purchases.length,
    revenue,
    cost,
    conversion: visits ? (purchases.length / visits) * 100 : null,
  };
}
export const plural = (value: number, forms: [string, string, string]) => {
  const lastTwo = value % 100,
    last = value % 10;
  return forms[
    lastTwo >= 11 && lastTwo <= 14 ? 2 : last === 1 ? 0 : last >= 2 && last <= 4 ? 1 : 2
  ];
};
export const percent = (value: number | null) =>
  value === null ? "—" : `${value.toLocaleString("ru-RU", { maximumFractionDigits: 1 })}%`;

