# Country Explorer — Тестовое задание для Getplace

**Автор:** Виталий Покровский
**Дата:** Февраль 2026

---

## Содержание

### 1. [Продуктовая концепция](./01-product-concept.md)
Для кого фича, какую задачу решает, JTBD, ключевые сценарии использования, MVP vs следующие итерации.

### 2a. Интерактивный прототип (HTML)
**→ [Открыть прототип](./prototype.html)** (откройте в браузере)

Самодостаточное single-page приложение с реальными данными:
- Хороплетная карта 12 регионов UK
- 6 брендов (Subway, McDonald's, Domino's, KFC, Nando's, Papa John's) — 6,820 точек
- Три метрики: абсолютные числа, на 100к населения, доля бренда
- Region drill-down с charts
- Табличный вид с сортировкой
- Переключение regions/points/both

### 2b. React-приложение

Полноценное SPA, реализующее функционал далеко за пределами MVP:

**Карта и визуализация:**
- Хороплетная карта регионов (choropleth) с TopoJSON
- Слой точек (CircleMarkers) с popup-деталями
- Heatmap mode (тепловая карта плотности)
- Light/Dark тема с автоматическим переключением тайлов CartoCDN

**Аналитика и навигация:**
- Region drill-down → City drill-down (кластеризация по городам)
- Табличный вид с сортировкой по всем колонкам
- Population overlay (нормализация per 100k)
- Три метрики окраски: total / density / share

**Временная динамика:**
- Timeline slider (Jan 2015 – Dec 2025, 131 месяц)
- Анимация Play/Pause с настраиваемой скоростью
- Synthetic opening dates для демонстрации динамики

**Алерты и мониторинг:**
- Система алертов с 3 типами правил (threshold, change, competitor)
- Unified Feed: Events + Agent insights + Rules management
- Persistence правил в localStorage

**AI-инсайты (Agent Team):**
- 3 агента: Market Monitor, Competitor Tracker, Expansion Scout
- 12 типов инсайтов с приоритизацией (1-5)
- Карточки агентов с индикацией статуса (idle/alerting)

**Expansion Radar:**
- Scoring-система с 4 факторами и настраиваемыми весами
- 5 тиров возможностей: Hot → Warm → Moderate → Cool → Cold
- Отдельный map view с цветовой кодировкой по score
- Comparative snapshot и InsightCard

**Управление данными:**
- Custom brand groups (предустановленные + пользовательские)
- Экспорт в CSV и PDF
- Supabase API integration (brand-points, countries)

### 3. [Роадмап](./02-roadmap.md)
5 фаз развития: MVP → Глубина → Динамика → Масштаб → Интеллект. Фазы 1-3 в основном реализованы, Phase 5 (AI) полностью реализована.

### 4. [Монетизация](./03-monetization.md)
Ценность для клиента (количественная и стратегическая), три модели монетизации, влияние на метрики Getplace, go-to-market стратегия.

### 5. [Документация для разработки](./04-dev-documentation.md)
Архитектура, модель данных, API endpoints, структура React-компонентов, CountryContext + custom hooks, Agent Team, Expansion Radar, Timeline, система алертов.

### 6. [Лендинг фичи](./05-landing-page.html)
Marketing landing page с hero, stats, features, use cases, CTA.

---

## Данные

Использованы реальные данные из задания:

| Бренд | Точек | Ключевые атрибуты |
|-------|-------|-------------------|
| Subway | 2,063 | Адреса, postcode |
| McDonald's | 1,508 | Drive-thru, delivery, wifi, breakfast |
| Domino's | 1,331 | FSA рейтинг, методы доставки, trading hours |
| KFC | 1,037 | Facilities, агрегаторы (Deliveroo/Uber/JustEat) |
| Nando's | 484 | Cuisine, price range, amenities |
| Papa John's | 397 | Min spend, delivery charge |

12 регионов UK (ITL1), дополнены данными о населении.

## Технологии

### Прототип (HTML)
- **Leaflet** — интерактивная карта
- **TopoJSON** — сжатие геометрий (с 13MB до 889KB)
- **Chart.js** — doughnut charts
- **CartoDB Dark** — тайловый слой

### React-приложение
- **React 18** + **TypeScript** — UI framework
- **Vite** — build tool
- **Tailwind CSS** + **shadcn/ui** — стилизация и UI-компоненты
- **Leaflet** + **react-leaflet** — интерактивная карта
- **leaflet.heat** — heatmap layer
- **Recharts** — графики в Radar
- **Supabase** — backend API (brand-points, countries)
- **Vitest** + **Testing Library** — тестирование
- **Zod** — валидация данных
