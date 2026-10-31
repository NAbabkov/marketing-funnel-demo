"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Link2,
  Plus,
  RotateCcw,
  X,
} from "lucide-react";

import { addDays, dateKey, dateLabel, dayName, makeDemo, metrics, number, parseDate, percent, plural, rub, startOfWeek, uid, type Placement } from "./demo";
import { useDemo } from "./useDemo";
import AttributionPanel from "./AttributionPanel";
import posts from "./posts.json";

type Tab = "calendar" | "analytics";

// Даты публичных постов показываем по московскому времени, как в архиве кейса.
const archiveDay = (value: string) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date(value));

export default function Home() {
  const { data, updateData, storageError } = useDemo();
  const [tab, setTab] = useState<Tab>("calendar");
  const [week, setWeek] = useState(() => startOfWeek(parseDate(archiveDay(posts[0].publishedAt))));
  const [highlightToday, setHighlightToday] = useState(false);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [copied, setCopied] = useState(false);
  const [ref, setRef] = useState<string | null>(null);
  const [bought, setBought] = useState(false);
  const tracked = useRef(false);
  const visitorId = useRef<string | undefined>(undefined);
  const dialogOpen = adding || Boolean(data?.placements.some((p) => p.id === selected)) || posts.some((post) => post.url === selected);
  useEffect(() => () => { if (highlightTimer.current) clearTimeout(highlightTimer.current); }, []);

  useEffect(() => {
    if (!dialogOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    if (!dialog) return;
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled])',
    ));
    (focusable()[0] ?? dialog).focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setAdding(false); setSelected(null); }
      if (event.key !== "Tab") return;
      const elements = focusable();
      const first = elements[0], last = elements[elements.length - 1];
      if (!first || !last) { event.preventDefault(); dialog.focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("keydown", onKeyDown); if (previous?.isConnected) previous.focus(); };
  }, [adding, selected, dialogOpen]);

  useEffect(() => {
    // Псевдоним остаётся в этом браузере и нужен только для демонстрации пути.
    if (!visitorId.current) {
      try {
        const key = "marketing-demo-browser-id";
        const saved = localStorage.getItem(key);
        visitorId.current = saved && saved.length <= 128 ? saved : uid();
        if (!saved || saved.length > 128) localStorage.setItem(key, visitorId.current);
      } catch { visitorId.current = uid(); }
    }
    setRef(new URLSearchParams(window.location.search).get("ref"));
  }, []);
  useEffect(() => {
    if (!data || !ref || tracked.current || !data.placements.some((p) => p.id === ref)) return;
    tracked.current = true;
    const visit = { id: uid(), placementId: ref, kind: "visit" as const, at: new Date().toISOString(), visitorId: visitorId.current };
    void updateData((current) => current.placements.some((p) => p.id === ref)
      ? { ...current, events: [...current.events, visit] }
      : current);
  }, [data, ref, updateData]);

  const total = useMemo(() => (data ? metrics(data) : null), [data]);
  const item = data?.placements.find((p) => p.id === selected);
  const selectedPost = posts.find((post) => post.url === selected);
  const landing = data?.placements.find((p) => p.id === ref);
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const linkFor = (id: string) => {
    const url = new URL(window.location.href);
    url.search = "";
    url.hash = "";
    url.searchParams.set("ref", id);
    return url.toString();
  };
  const copyLink = async (id: string) => {
    try {
      await navigator.clipboard.writeText(linkFor(id));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
      window.prompt("Скопируйте ссылку:", linkFor(id));
    }
  };
  const reset = () => {
    if (
      window.confirm(
        "Восстановить исходные данные демо? Добавленные размещения и события в этом браузере будут удалены.",
      )
    ) {
      void updateData(() => makeDemo());
      setSelected(null);
      setWeek(startOfWeek(new Date()));
    }
  };
  const addPlacement = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") || "").trim();
    const channel = String(form.get("channel") || "").trim();
    const campaign = String(form.get("campaign") || "").trim();
    const date = String(form.get("date") || "");
    const cost = Number(form.get("cost"));
    const price = Number(form.get("price"));
    if (
      !title ||
      !channel ||
      !campaign ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      dateKey(parseDate(date)) !== date ||
      !Number.isInteger(cost) || cost < 0 || cost > 100000000 ||
      !Number.isInteger(price) || price < 1 || price > 100000000
    )
      return;
    const placement: Placement = { id: uid(), title, channel, campaign, date, cost, price };
    void updateData((current) => ({ ...current, placements: [...current.placements, placement] }));
    setWeek(startOfWeek(parseDate(date)));
    setAdding(false);
    setSelected(placement.id);
  };

  if (!data || !total) return <main className="loading">Открываем демо…</main>;
  if (ref)
    return (
      <main className="landing-shell">
        <div className="landing-top">
          <a className="landing-brand" href={window.location.pathname}>
            <span className="brand-mark">↗</span>
            <span>
              Маршрут <small>учебный проект</small>
            </span>
          </a>
          <span className="demo-badge">
            <span />
            ДЕМОНСТРАЦИЯ
          </span>
        </div>
        {storageError && <div className="notice error" role="alert">Не удалось прочитать или сохранить данные браузера. Изменения могут не сохраниться.</div>}
        {landing ? (
          <div className="landing-content">
            <div className="landing-copy">
              <span className="eyebrow">ОТ ПЕРЕХОДА К ПОКУПКЕ / 01</span>
              <h1>
                Большие цели
                <br />
                <em>начинаются</em>
                <br />с первого шага.
              </h1>
              <p>
                Небольшая учебная страница для проверки рекламной ссылки. Здесь можно пройти путь
                посетителя и увидеть, как он отражается в аналитике.
              </p>
              <div className="landing-meta">
                <span>
                  Источник <strong>{landing.channel}</strong>
                </span>
                <span>
                  Кампания <strong>{landing.campaign}</strong>
                </span>
              </div>
            </div>
            <div className="checkout-card">
              <div className="checkout-number">01 / ПРАКТИКУМ</div>
              <div className="checkout-art" aria-hidden="true">
                <span>✳</span>
                <b>+</b>
                <i>?</i>
              </div>
              <h2>Время разобраться</h2>
              <p>Демонстрационный продукт для проверки работы воронки.</p>
              <div className="checkout-price">
                <strong>{rub.format(landing.price)}</strong>
                <span>условная стоимость</span>
              </div>
              <button
                className="button button-dark button-wide"
                disabled={bought}
                onClick={() => {
                  const purchase = {
                    id: uid(), placementId: landing.id, kind: "purchase" as const,
                    at: new Date().toISOString(), amount: landing.price, visitorId: visitorId.current,
                  };
                  void updateData((current) => current.placements.some((p) => p.id === landing.id)
                    ? { ...current, events: [...current.events, purchase] }
                    : current);
                  setBought(true);
                }}
              >
                {bought ? (
                  <>
                    <Check size={17} /> Покупка отмечена
                  </>
                ) : (
                  <>
                    Имитировать покупку <ArrowUpRight size={17} />
                  </>
                )}
              </button>
              <p className="checkout-note">
                Деньги не списываются. Данные карты и контакты не запрашиваются.
              </p>
            </div>
          </div>
        ) : (
          <div className="landing-missing">
            <h1>Ссылка не найдена</h1>
            <p>
              Возможно, размещение было удалено при сбросе демо. Откройте приложение и создайте
              новую ссылку.
            </p>
            <a className="button button-dark" href={window.location.pathname}>
              <ArrowLeft size={16} /> К календарю
            </a>
          </div>
        )}
        <div className="landing-bottom">
          <span>Данные сохраняются только в этом браузере.</span>
          <a href={window.location.pathname}>
            Открыть рабочее пространство <ArrowUpRight size={15} />
          </a>
        </div>
      </main>
    );

  return (
    <div className="app-shell">
      <aside className="side">
        <div className="brand">
          <span className="brand-mark">↗</span>
          <div>
            Маршрут<small>маркетинговая аналитика</small>
          </div>
        </div>
        <div className="side-label">РАБОЧЕЕ ПРОСТРАНСТВО</div>
        <nav className="side-nav" aria-label="Разделы">
          <button
            className={`nav-item ${tab === "calendar" ? "active" : ""}`}
            aria-current={tab === "calendar" ? "page" : undefined}
            onClick={() => setTab("calendar")}
          >
            <CalendarDays size={18} />
            Календарь <span>01</span>
          </button>
          <button
            className={`nav-item ${tab === "analytics" ? "active" : ""}`}
            aria-current={tab === "analytics" ? "page" : undefined}
            onClick={() => setTab("analytics")}
          >
            <BarChart3 size={18} />
            Аналитика <span>02</span>
          </button>
        </nav>
        <div className="side-footer">
          <span className="footer-symbol">✳</span>
          <strong>
            Идеи становятся
            <br />
            понятнее в цифрах.
          </strong>
          <p>Учебный проект по мотивам хакатон-кейса</p>
        </div>
      </aside>
      <main className="workspace">
        <header className="topbar">
          <div className="breadcrumbs">
            Рабочее пространство <span>/</span>{" "}
            <strong>{tab === "calendar" ? "Календарь" : "Аналитика"}</strong>
          </div>
          <div className="top-actions">
            <span className="demo-badge">
              <span />
              ДЕМО И АРХИВ
            </span>
            <button className="reset-button" onClick={reset} aria-label="Сбросить демо">
              <RotateCcw size={16} />
              <span>Сбросить</span>
            </button>
          </div>
        </header>
        <div className="page-body">
          {storageError && (
            <div className="notice error" role="alert">
              Не удалось прочитать или сохранить данные браузера. Изменения могут не сохраниться.
            </div>
          )}
          {tab === "calendar" ? (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">ПЛАНИРОВАНИЕ / 01</div>
                  <h1>
                    Календарь размещений<span className="heading-dot">.</span>
                  </h1>
                  <p>Публичные посты из архива и демонстрационные размещения — в одном календаре.</p>
                </div>
                <button className="button button-dark" onClick={() => setAdding(true)}>
                  <Plus size={17} /> Новое размещение
                </button>
              </div>
              <div className="overview-line">
                <div>
                  <span className="overview-icon">
                    <ArrowLeftRight size={18} />
                  </span>
                  <div>
                    <strong>От ссылки до покупки</strong>
                    <p>Создайте размещение, откройте его ссылку и попробуйте демо-сценарий.</p>
                  </div>
                </div>
                <button className="text-button" onClick={() => setTab("analytics")}>
                  Посмотреть аналитику <ArrowRight size={16} />
                </button>
              </div>
              <div className="calendar-toolbar">
                <div>
                  <span className="section-kicker">НЕДЕЛЯ</span>
                  <h2>
                    {dateLabel.format(days[0])} — {dateLabel.format(days[6])}
                  </h2>
                </div>
                <div className="week-controls">
                  <button aria-label="Предыдущая неделя" onClick={() => setWeek(addDays(week, -7))}>
                    <ChevronLeft size={18} />
                  </button>
                  <button className="today-button" onClick={() => {
                    setWeek(startOfWeek(new Date()));
                    setHighlightToday(false);
                    if (highlightTimer.current) clearTimeout(highlightTimer.current);
                    requestAnimationFrame(() => {
                      setHighlightToday(true);
                      document.querySelector<HTMLElement>(`[data-calendar-day="${dateKey(new Date())}"]`)
                        ?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
                      highlightTimer.current = setTimeout(() => setHighlightToday(false), 2600);
                    });
                  }}>
                    Сегодня
                  </button>
                  <button aria-label="Следующая неделя" onClick={() => setWeek(addDays(week, 7))}>
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
              <div className="calendar-scroll">
                <div className="week-grid">
                  {days.map((day) => {
                    const key = dateKey(day);
                    const dayItems = data.placements.filter((p) => p.date === key);
                    const dayPosts = posts.filter((post) => archiveDay(post.publishedAt) === key);
                    return (
                      <div className={`day-column ${highlightToday && key === dateKey(new Date()) ? "highlight-today" : ""}`} data-calendar-day={key} key={key}>
                        <div
                          className={`day-heading ${key === dateKey(new Date()) ? "today" : ""}`}
                        >
                          <span>{dayName.format(day)}</span>
                          <strong>{day.getDate()}</strong>
                        </div>
                        <div className="day-events">
                          {dayItems.map((p, index) => {
                            const m = metrics(data, p.id);
                            return (
                              <button
                                key={p.id}
                                className={`event-card event-tone-${index % 3}`}
                                onClick={() => {
                                  setCopied(false);
                                  setSelected(p.id);
                                }}
                              >
                                <span className="event-time">
                                  РАЗМЕЩЕНИЕ <ArrowUpRight size={14} />
                                </span>
                                <strong>{p.title}</strong>
                                <span className="event-channel">{p.channel}</span>
                                <span className="event-stats">
                                  {number.format(m.visits)}{" "}
                                  {plural(m.visits, ["переход", "перехода", "переходов"])}{" "}
                                  <span>·</span> {m.purchases}{" "}
                                  {plural(m.purchases, ["покупка", "покупки", "покупок"])}
                                </span>
                              </button>
                            );
                          })}
                          {dayPosts.map((post) => (
                            <button key={post.url} className="event-card event-card-archive" onClick={() => setSelected(post.url)}>
                              <span className="event-time">ПОСТ В TELEGRAM <ArrowUpRight size={14} /></span>
                              <strong>{post.excerpt}</strong>
                              <span className="event-channel">@{post.channel}</span>
                              <span className="event-stats">{post.views ? `${post.views} просмотров` : "Публичный пост"}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="calendar-foot">
                <span>
                  <i /> Светлые карточки — демо, зелёные — реальные посты
                </span>
                <span>
                  Нажмите на карточку, чтобы открыть детали <ArrowUpRight size={15} />
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">РЕЗУЛЬТАТЫ / 02</div>
                  <h1>
                    Аналитика<span className="heading-dot">.</span>
                  </h1>
                  <p>Путь от рекламного размещения до условной покупки.</p>
                </div>
                <button className="button button-outline" onClick={() => setTab("calendar")}>
                  <CalendarDays size={16} /> К календарю
                </button>
              </div>
              <div className="stats">
                <article>
                  <span>Переходы</span>
                  <strong>{number.format(total.visits)}</strong>
                  <p>Открытия страниц по ссылке</p>
                </article>
                <article>
                  <span>Покупки</span>
                  <strong>{number.format(total.purchases)}</strong>
                  <p>Только имитация</p>
                </article>
                <article>
                  <span>Конверсия</span>
                  <strong>{percent(total.conversion)}</strong>
                  <p>Покупки / переходы</p>
                </article>
                <article>
                  <span>Условная выручка</span>
                  <strong>{rub.format(total.revenue)}</strong>
                  <p>Без реальных платежей</p>
                </article>
              </div>
              <section className="panel journey-panel">
                <div className="panel-heading">
                  <div>
                    <span className="section-kicker">КАК ЭТО РАБОТАЕТ</span>
                    <h2>Короткий путь клиента</h2>
                  </div>
                  <span className="mini-label">ДЕМО-СЦЕНАРИЙ</span>
                </div>
                <div className="journey-grid">
                  <div>
                    <span>01</span>
                    <Link2 size={20} />
                    <strong>Рекламная ссылка</strong>
                    <p>У каждого размещения своя ссылка.</p>
                  </div>
                  <ArrowRight className="journey-arrow" size={18} />
                  <div>
                    <span>02</span>
                    <ExternalLink size={20} />
                    <strong>Переход на страницу</strong>
                    <p>Открытие записывается как переход.</p>
                  </div>
                  <ArrowRight className="journey-arrow" size={18} />
                  <div>
                    <span>03</span>
                    <Check size={20} />
                    <strong>Покупка понарошку</strong>
                    <p>Кнопка добавляет условную покупку.</p>
                  </div>
                </div>
              </section>
              <AttributionPanel data={data} onSelectPlacement={setSelected} />
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <span className="section-kicker">СРАВНЕНИЕ</span>
                    <h2>Прямые результаты размещений</h2>
                    <p>Покупки по открытой ссылке, без распределения между предыдущими касаниями.</p>
                  </div>
                  <span className="mini-label">
                    {data.placements.length}{" "}
                    {plural(data.placements.length, ["РАЗМЕЩЕНИЕ", "РАЗМЕЩЕНИЯ", "РАЗМЕЩЕНИЙ"])}
                  </span>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Размещение / канал</th>
                        <th>Переходы</th>
                        <th>Покупки</th>
                        <th>Конверсия</th>
                        <th>Расход</th>
                        <th>Условная выручка</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.placements.map((p) => {
                        const m = metrics(data, p.id);
                        return (
                          <tr key={p.id}>
                            <td>
                              <button className="table-link" onClick={() => setSelected(p.id)}>
                                {p.title}
                              </button>
                              <small>{p.channel}</small>
                            </td>
                            <td>{m.visits}</td>
                            <td>{m.purchases}</td>
                            <td>{percent(m.conversion)}</td>
                            <td>{rub.format(p.cost)}</td>
                            <td>{rub.format(m.revenue)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
              <div className="analytics-note">
                <span>✳</span>
                <p>
                  <strong>Это учебная модель, а не платёжная система.</strong> Здесь нет реальных
                  клиентов, оплат и межбраузерного отслеживания. Начальные показатели вымышлены;
                  новые действия сохраняются локально.
                </p>
              </div>
            </>
          )}
        </div>
      </main>
      {selectedPost && (
        <div className="overlay" onClick={() => setSelected(null)}>
          <section className="drawer" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="post-detail-title" onClick={(event) => event.stopPropagation()}>
            <div className="drawer-top">
              <span className="section-kicker">ПУБЛИЧНАЯ ПУБЛИКАЦИЯ</span>
              <button className="icon-button" aria-label="Закрыть" onClick={() => setSelected(null)}><X size={20} /></button>
            </div>
            <div className="drawer-content">
              <span className="tag">ПОСТ В TELEGRAM</span>
              <h2 id="post-detail-title">@{selectedPost.channel}</h2>
              <p className="drawer-subtitle">{dateLabel.format(parseDate(archiveDay(selectedPost.publishedAt)))} 2026 · {selectedPost.views ? `${selectedPost.views} просмотров на момент сбора` : "просмотры не указаны"}</p>
              <div className="post-excerpt">{selectedPost.excerpt}</div>
              <div className="link-box">
                <div className="link-box-title"><Link2 size={19} /><strong>Оригинальная публикация</strong></div>
                <p>Откройте оригинал в Telegram. Просмотры сохранены на момент сбора и не обновляются автоматически.</p>
                <code>{selectedPost.url}</code>
                <div className="drawer-actions"><a className="button button-dark" href={selectedPost.url} target="_blank" rel="noopener noreferrer">Открыть пост <ExternalLink size={15} /></a></div>
              </div>
              <p className="drawer-note">Показан фрагмент публичного поста; этот источник не связан с демонстрационной оплатой.</p>
            </div>
          </section>
        </div>
      )}
      {item && (
        <div className="overlay" onClick={() => setSelected(null)}>
          <section
            className="drawer"
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="detail-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="drawer-top">
              <span className="section-kicker">КАРТОЧКА РАЗМЕЩЕНИЯ</span>
              <button
                className="icon-button"
                aria-label="Закрыть"
                onClick={() => setSelected(null)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="drawer-content">
              <span className="tag">{item.campaign}</span>
              <h2 id="detail-title">{item.title}</h2>
              <p className="drawer-subtitle">
                {item.channel} · {dateLabel.format(parseDate(item.date))}
              </p>
              <div className="detail-grid">
                <div>
                  <span>ПЕРЕХОДЫ</span>
                  <strong>{metrics(data, item.id).visits}</strong>
                </div>
                <div>
                  <span>ПОКУПКИ</span>
                  <strong>{metrics(data, item.id).purchases}</strong>
                </div>
                <div>
                  <span>РАСХОД</span>
                  <strong>{rub.format(item.cost)}</strong>
                </div>
                <div>
                  <span>ВЫРУЧКА</span>
                  <strong>{rub.format(metrics(data, item.id).revenue)}</strong>
                </div>
              </div>
              <div className="link-box">
                <div className="link-box-title">
                  <Link2 size={19} />
                  <strong>Ссылка размещения</strong>
                </div>
                <p>
                  Откройте ссылку в этом браузере, чтобы добавить переход. На странице можно
                  имитировать покупку.
                </p>
                <code>{linkFor(item.id)}</code>
                <div className="drawer-actions">
                  <button className="button button-dark" onClick={() => void copyLink(item.id)}>
                    {copied ? <Check size={16} /> : <Copy size={16} />}{" "}
                    {copied ? "Скопировано" : "Скопировать"}
                  </button>
                  <a
                    className="button button-outline"
                    href={linkFor(item.id)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Открыть <ExternalLink size={15} />
                  </a>
                </div>
              </div>
              <p className="drawer-note">
                <ArrowDownLeft size={17} /> Ссылка работает с локальными данными этого браузера. На
                другом устройстве эта статистика не появится.
              </p>
            </div>
          </section>
        </div>
      )}
      {adding && (
        <div className="overlay" onClick={() => setAdding(false)}>
          <section
            className="modal"
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="form-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="drawer-top">
              <span className="section-kicker">НОВОЕ РАЗМЕЩЕНИЕ</span>
              <button className="icon-button" aria-label="Закрыть" onClick={() => setAdding(false)}>
                <X size={20} />
              </button>
            </div>
            <h2 id="form-title">
              Добавим в календарь<span className="heading-dot">.</span>
            </h2>
            <p className="modal-subtitle">
              Заполните данные публикации — ссылка появится автоматически.
            </p>
            <form className="form-grid" onSubmit={addPlacement}>
              <label className="full">
                Название размещения
                <input
                  name="title"
                  maxLength={100}
                  pattern=".*\S.*"
                  title="Введите хотя бы один непробельный символ"
                  required
                  placeholder="Например, разбор задачи"
                />
              </label>
              <label>
                Канал
                <input name="channel" maxLength={80} pattern=".*\S.*" title="Введите хотя бы один непробельный символ" required placeholder="Название канала" />
              </label>
              <label>
                Кампания
                <input
                  name="campaign"
                  maxLength={80}
                  pattern=".*\S.*"
                  title="Введите хотя бы один непробельный символ"
                  required
                  placeholder="Например, осенний набор"
                />
              </label>
              <label>
                Дата публикации
                <input name="date" type="date" min="1000-01-01" max="9999-12-31" defaultValue={dateKey(new Date())} required />
              </label>
              <label>
                Стоимость рекламы, ₽
                <input
                  name="cost"
                  type="number"
                  min="0"
                  max="100000000"
                  step="1"
                  defaultValue="0"
                  required
                />
              </label>
              <label className="full">
                Условная цена продукта, ₽
                <input
                  name="price"
                  type="number"
                  min="1"
                  max="100000000"
                  step="1"
                  defaultValue="4900"
                  required
                />
              </label>
              <div className="form-actions full">
                <button
                  className="button button-outline"
                  type="button"
                  onClick={() => setAdding(false)}
                >
                  Отмена
                </button>
                <button className="button button-dark" type="submit">
                  Создать размещение <ArrowRight size={16} />
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
