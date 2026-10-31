import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { attribute, attributionRows, csvCell, type AttributionGroup, type AttributionModel } from "./attribution";
import { number, type Demo } from "./demo";

const models: { value: AttributionModel; label: string; description: string }[] = [
  { value: "first", label: "Первое (First Touch)", description: "Вся сумма относится к первому подходящему размещению." },
  { value: "last", label: "Последнее (Last Touch)", description: "Вся сумма относится к последнему подходящему размещению." },
  { value: "linear", label: "Линейная (Linear)", description: "Сумма делится поровну между разными подходящими размещениями." },
  { value: "decay", label: "По времени (Time Decay)", description: "Более близкие к покупке касания получают больший вес." },
];
const currency = new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", minimumFractionDigits: 0, maximumFractionDigits: 2 });
const money = (value: number) => currency.format(Math.abs(value) < 0.005 ? 0 : value);
const count = (value: number) => value.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
const dateTime = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

type Props = { data: Demo; onSelectPlacement: (id: string) => void };
export default function AttributionPanel({ data, onSelectPlacement }: Props) {
  const [model, setModel] = useState<AttributionModel>("last");
  const [windowDays, setWindowDays] = useState(30);
  const [halfLifeDays, setHalfLifeDays] = useState(7);
  const [group, setGroup] = useState<AttributionGroup>("placement");
  const [campaign, setCampaign] = useState("");
  const [channel, setChannel] = useState("");
  const [expanded, setExpanded] = useState(false);
  const campaigns = useMemo(() => [...new Set(data.placements.map((p) => p.campaign))].sort(), [data.placements]);
  const channels = useMemo(() => [...new Set(data.placements.map((p) => p.channel))].sort(), [data.placements]);
  const comparisons = useMemo(() => models.map(({ value }) => {
    const results = attribute(data, { model: value, windowDays, halfLifeDays });
    return { model: value, results, rows: attributionRows(data, results, group, campaign, channel) };
  }), [data, windowDays, halfLifeDays, group, campaign, channel]);
  const current = comparisons.find((item) => item.model === model)!;
  const lookups = comparisons.map((item) => new Map(item.rows.map((row) => [row.key, row])));
  const total = current.rows.reduce((sum, row) => sum + row.revenue, 0);
  const unknown = current.rows.find((row) => row.key === "__unknown__");
  const names = new Map(data.placements.map((p) => [p.id, p.title]));
  const allowed = new Set(current.rows.flatMap((row) => row.placementIds));
  const paths = current.results.filter((result) => result.allocations.some((allocation) => allocation.placementId === null ? !campaign && !channel : allowed.has(allocation.placementId)))
    .slice().sort((a, b) => Date.parse(b.purchase.at) - Date.parse(a.purchase.at));
  function download() {
    const header = ["Группа", "Канал / кампания", ...models.map((m) => m.label), "Доли покупок", "Расход", "ROAS выбранной модели"];
    const lines = current.rows.map((row) => [row.name, row.detail, ...lookups.map((lookup) => (lookup.get(row.key)?.revenue ?? 0).toFixed(2)), row.creditedPurchases.toFixed(4), row.cost.toFixed(2), row.roas === null ? "" : row.roas.toFixed(4)]);
    const metadata = [["Модель", models.find((item) => item.value === model)!.label], ["Окно, дней", windowDays], ["Полураспад, дней", halfLifeDays], ["Группировка", group], ["Кампания", campaign || "Все"], ["Канал", channel || "Все"]];
    const csv = "\uFEFF" + [...metadata, [], header, ...lines].map((line) => line.map(csvCell).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "attribution-demo.csv"; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section className="panel attribution-panel" aria-labelledby="attribution-title">
    <div className="panel-heading attribution-heading"><div><span className="section-kicker">АНАЛИЗ / АТРИБУЦИЯ</span><h2 id="attribution-title">Кому отнести покупку?</h2><p>Сравните правила распределения условной выручки между касаниями.</p></div><button className="button button-outline" onClick={download}><Download size={16}/> CSV</button></div>
    <div className="attribution-warning"><strong>Только демонстрация.</strong> Исторические Telegram-посты не связаны с оплатами. Пути стартового набора смоделированы; ваши действия связываются только в этом браузере. Модель не доказывает влияние рекламы.</div>
    <div className="model-picker" role="group" aria-label="Модель атрибуции">{models.map((item) => <button key={item.value} className={item.value === model ? "model-option active" : "model-option"} aria-pressed={item.value === model} onClick={() => setModel(item.value)}>{item.label}</button>)}</div>
    <p className="model-description">{models.find((item) => item.value === model)?.description} Повторные переходы к одному размещению учитываются один раз.</p>
    <div className="attribution-filters">
      <label>Окно до покупки<select value={windowDays} onChange={(event) => setWindowDays(Number(event.target.value))}><option value={7}>7 дней</option><option value={30}>30 дней</option><option value={90}>90 дней</option></select></label>
      <label>Полураспад<select value={halfLifeDays} onChange={(event) => setHalfLifeDays(Number(event.target.value))} disabled={model !== "decay"}><option value={1}>1 день</option><option value={7}>7 дней</option><option value={14}>14 дней</option><option value={30}>30 дней</option></select></label>
      <label>Группировка<select value={group} onChange={(event) => setGroup(event.target.value as AttributionGroup)}><option value="placement">Размещение</option><option value="campaign">Кампания</option><option value="channel">Канал</option></select></label>
      <label>Кампания<select value={campaign} onChange={(event) => setCampaign(event.target.value)}><option value="">Все кампании</option>{campaigns.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label>Канал<select value={channel} onChange={(event) => setChannel(event.target.value)}><option value="">Все каналы</option>{channels.map((item) => <option key={item}>{item}</option>)}</select></label>
    </div>
    <div className="attribution-summary"><span>Выручка в выбранном срезе <strong>{money(total)}</strong></span><span>Без источника <strong>{unknown ? money(unknown.revenue) : campaign || channel ? "вне фильтра" : money(0)}</strong></span></div>
    <div className="table-scroll"><table className="attribution-table"><thead><tr><th>{group === "placement" ? "Размещение" : group === "campaign" ? "Кампания" : "Канал"}</th>{models.map((item) => <th className={item.value === model ? "selected-model" : ""} key={item.value}>{item.label}</th>)}<th>Доли покупок</th><th>Расход</th><th>ROAS</th></tr></thead><tbody>{current.rows.map((row) => <tr key={row.key}><td>{group === "placement" && row.placementIds.length === 1 ? <button className="table-link" onClick={() => onSelectPlacement(row.placementIds[0])}>{row.name}</button> : <strong>{row.name}</strong>}{row.detail && <small>{row.detail}</small>}</td>{comparisons.map((item, index) => <td className={item.model === model ? "selected-model" : ""} key={item.model}>{money(lookups[index].get(row.key)?.revenue ?? 0)}</td>)}<td>{count(row.creditedPurchases)}</td><td>{row.key === "__unknown__" ? "—" : money(row.cost)}</td><td>{row.roas === null ? "—" : `${count(row.roas)}×`}</td></tr>)}</tbody></table></div>
    <p className="attribution-help">Таблица показывает все четыре модели; доли и ROAS рассчитаны для выбранной. ROAS = условная выручка / условные рекламные расходы; при нулевом расходе — прочерк. Выручка и расходы за всё время, суммы округлены для отображения. Фильтры не перераспределяют доли скрытых касаний.</p>
    <details className="attribution-paths" open={expanded} onToggle={(event) => setExpanded(event.currentTarget.open)}><summary>Посмотреть пути покупок <span>{number.format(paths.length)}</span></summary><p>Для каждого примера показаны подходящие переходы в пределах окна и доли выбранной модели. Более старые действия без идентификатора остаются без источника.</p>{paths.length ? <div className="path-list">{paths.slice(0, 50).map((result) => <div className="path-item" key={result.purchase.id}><div><strong>{money(result.purchase.amount ?? 0)}</strong><span>{dateTime.format(new Date(result.purchase.at))}</span></div><p>{result.path.length ? result.path.map((touch) => names.get(touch.placementId) ?? "Удалённое размещение").join(" → ") : "Подходящих переходов нет"}</p><small>{result.allocations.filter((item) => item.placementId === null ? !campaign && !channel : allowed.has(item.placementId)).map((item) => `${item.placementId ? names.get(item.placementId) : "Источник неизвестен"}: ${(item.weight * 100).toLocaleString("ru-RU", { maximumFractionDigits: 1 })}%`).join(" · ")}</small></div>)}</div> : <p>В выбранном срезе пока нет покупок.</p>}{paths.length > 50 && <p>Показаны последние 50 из {paths.length} покупок.</p>}</details>
  </section>;
}
