# Country Explorer — Документация для разработки

## 1. Обзор архитектуры

### Компоненты системы

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│   Frontend   │────▶│   API Layer  │────▶│   Data Pipeline  │
│  (React SPA) │◀────│  (REST/GQL)  │◀────│  (ETL + Storage) │
└──────────────┘     └──────────────┘     └──────────────────┘
       │                    │                       │
       ▼                    ▼                       ▼
  Leaflet/react-leaflet  Supabase + local data  Brand scrapers
  Recharts (Radar)       Aggregation cache      GeoJSON normalization
  Context + Hooks        Auth & permissions     Population data enrichment
```

### Технологический стек (реализованный)
- **Frontend:** React 18, TypeScript, Vite (build), Tailwind CSS + shadcn/ui
- **Карта:** Leaflet + react-leaflet, leaflet.heat (heatmap), CartoCDN tiles (light/dark)
- **Графики:** Recharts (Radar page)
- **State management:** React Context (CountryContext) + custom hooks (без Zustand)
- **Backend:** Supabase (brand-points, countries API)
- **Тестирование:** Vitest + Testing Library
- **Data format:** TopoJSON для доставки геометрий

---

## 2. Модель данных

### Таблица: `countries`
| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID | PK |
| name | VARCHAR(100) | Название страны |
| code | VARCHAR(3) | ISO 3166-1 alpha-3 |
| bounds | GEOMETRY(Polygon) | Bounding box страны |
| is_active | BOOLEAN | Доступна ли для клиентов |

### Таблица: `regions`
| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID | PK |
| country_id | UUID | FK → countries |
| name | VARCHAR(200) | Название региона |
| code | VARCHAR(10) | Код региона (ITL1, NUTS2, etc.) |
| geometry | GEOMETRY(MultiPolygon, 4326) | Полигон региона |
| population | INTEGER | Население (обновляется ежегодно) |
| centroid_lat | FLOAT | Центроид широта |
| centroid_lon | FLOAT | Центроид долгота |

### Таблица: `brands`
| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID | PK |
| name | VARCHAR(100) | Название бренда |
| slug | VARCHAR(100) | URL-safe идентификатор |
| color | VARCHAR(7) | HEX цвет для UI |
| category | VARCHAR(50) | Категория: pizza, chicken, burgers, etc. |
| logo_url | VARCHAR(500) | URL логотипа |
| is_active | BOOLEAN | Показывать ли в UI |

### Таблица: `locations`
| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID | PK |
| brand_id | UUID | FK → brands |
| country_id | UUID | FK → countries |
| region_id | UUID | FK → regions (nullable, вычисляется) |
| name | VARCHAR(200) | Название точки |
| coordinates | GEOMETRY(Point, 4326) | Координаты |
| address | JSONB | Структурированный адрес |
| postcode | VARCHAR(20) | Почтовый индекс |
| city | VARCHAR(100) | Город |
| status | VARCHAR(20) | open / closed / temporarily_closed |
| attributes | JSONB | Доп. атрибуты (drive_thru, delivery, wifi, etc.) |
| source_id | VARCHAR(100) | ID из оригинального источника |
| first_seen_at | TIMESTAMP | Когда впервые появился в данных |
| last_seen_at | TIMESTAMP | Когда последний раз видели |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

**Индексы:**
```sql
CREATE INDEX idx_locations_brand ON locations(brand_id);
CREATE INDEX idx_locations_country ON locations(country_id);
CREATE INDEX idx_locations_region ON locations(region_id);
CREATE INDEX idx_locations_coords ON locations USING GIST(coordinates);
CREATE INDEX idx_locations_status ON locations(status);
```

### Таблица: `region_brand_stats` (materialized view / cache)
| Поле | Тип | Описание |
|------|-----|----------|
| region_id | UUID | FK → regions |
| brand_id | UUID | FK → brands |
| location_count | INTEGER | Количество точек |
| market_share | FLOAT | Доля от общего кол-ва в регионе |
| density_per_100k | FLOAT | На 100к населения |
| computed_at | TIMESTAMP | Когда пересчитано |

---

## 3. API Endpoints

### GET `/api/v1/countries`
Список доступных стран.

**Response:**
```json
{
  "data": [
    {
      "id": "uk",
      "name": "United Kingdom",
      "code": "GBR",
      "region_count": 12,
      "brand_count": 6,
      "total_locations": 6820
    }
  ]
}
```

### GET `/api/v1/countries/{code}/regions`
Регионы страны с полигонами и агрегированной статистикой.

**Query params:**
- `format`: `geojson` (default) | `topojson`
- `brands`: comma-separated brand slugs (filter)
- `simplify`: `0.001` (tolerance для упрощения геометрии)

**Response:** GeoJSON FeatureCollection, где каждый Feature содержит:
```json
{
  "type": "Feature",
  "properties": {
    "id": "region-uuid",
    "name": "London",
    "code": "TLI",
    "population": 8866000,
    "brands": {
      "subway": { "count": 216, "share": 23.6, "density": 2.44 },
      "mcdonalds": { "count": 192, "share": 21.0, "density": 2.17 },
      ...
    },
    "total": 914
  },
  "geometry": { "type": "MultiPolygon", "coordinates": [...] }
}
```

### GET `/api/v1/countries/{code}/locations`
Точки брендов с фильтрацией.

**Query params:**
- `brands`: comma-separated slugs
- `region_id`: UUID региона
- `bbox`: `lon_min,lat_min,lon_max,lat_max`
- `status`: `open` | `closed` | `all`
- `attributes`: `drive_thru,delivery` (фильтр по атрибутам)
- `limit`: int (default 1000, max 5000)
- `offset`: int

**Response:**
```json
{
  "data": [
    {
      "id": "loc-uuid",
      "brand": "mcdonalds",
      "name": "Penzance",
      "lat": 50.12,
      "lon": -5.53,
      "city": "Penzance",
      "postcode": "TR20 8HT",
      "status": "open",
      "attributes": { "drive_thru": true, "wifi": true, "breakfast": true }
    }
  ],
  "meta": { "total": 1508, "limit": 1000, "offset": 0 }
}
```

### GET `/api/v1/countries/{code}/brands`
Список брендов в стране с суммарной статистикой.

**Response:**
```json
{
  "data": [
    {
      "id": "brand-uuid",
      "name": "Subway",
      "slug": "subway",
      "color": "#22c55e",
      "category": "sandwiches",
      "total_locations": 2063,
      "regions_present": 12,
      "top_region": "North West (England)"
    }
  ]
}
```

### GET `/api/v1/countries/{code}/stats`
Агрегированная статистика для summary cards.

---

## 4. Frontend — Структура компонентов

```
src/
├── App.tsx                        # Root component: routing (Explorer, LandingPage, NotFound)
├── main.tsx                       # Entry point: ReactDOM.createRoot
├── pages/
│   ├── Explorer.tsx               # Главная страница — оркестрация всех хуков
│   ├── LandingPage.tsx            # Marketing landing page
│   └── NotFound.tsx               # 404
├── components/
│   ├── NavLink.tsx                # Навигационная ссылка (shared)
│   ├── explorer/                  # Компоненты Explorer view
│   │   ├── Header.tsx             # Навигация, выбор страны, view tabs (Map/Table/Radar)
│   │   ├── Sidebar.tsx            # Левая панель: бренды, метрики, display mode, brand groups
│   │   ├── MapView.tsx            # Leaflet карта: choropleth + points + heatmap
│   │   ├── RegionPanel.tsx        # Правая панель: детали региона, brand breakdown
│   │   ├── TableView.tsx          # Табличный вид с сортировкой
│   │   ├── TimelineSlider.tsx     # Слайдер Jan 2015 – Dec 2025, play/pause
│   │   ├── AlertsPanel.tsx        # Sheet-панель: 3 таба (Events / Agents / Rules)
│   │   ├── AlertBadge.tsx         # Badge с кол-вом непрочитанных
│   │   ├── AgentsTab.tsx          # Карточки 3 агентов с инсайтами
│   │   ├── BrandGroupManager.tsx  # Управление группами брендов
│   │   ├── CityBreakdown.tsx      # Drill-down до уровня города
│   │   └── ThemeToggle.tsx        # Light/Dark/System переключатель
│   ├── radar/                     # Компоненты Expansion Radar
│   │   ├── RadarSidebar.tsx       # Выбор бренда, weight sliders, region ranking
│   │   ├── RadarMapView.tsx       # Карта с цветовой кодировкой по score
│   │   ├── RadarPanel.tsx         # Правая панель: детали региона, factor breakdown
│   │   ├── WeightSliders.tsx      # 4 слайдера весов факторов
│   │   ├── RegionRankingList.tsx  # Ранжированный список регионов
│   │   ├── ScoreGauge.tsx         # Визуализация composite score
│   │   ├── ScoreBadge.tsx         # Цветной badge тира (Hot/Warm/...)
│   │   ├── FactorBreakdown.tsx    # 4 фактора с прогресс-барами
│   │   ├── StatTiles.tsx          # Карточки метрик
│   │   ├── InsightCard.tsx        # Карточка инсайта
│   │   └── ComparativeSnapshot.tsx# Сравнение региона с национальными средними
│   ├── landing/                   # Компоненты лендинга
│   │   ├── Hero.tsx, Navbar.tsx, Features.tsx, UseCases.tsx
│   │   ├── StatsBar.tsx, Screenshot.tsx, CTASection.tsx, Footer.tsx
│   └── ui/                        # shadcn/ui компоненты (40+ файлов)
├── hooks/
│   ├── useTimeline.ts             # Timeline state: month 0-131, play/pause, speed, visibleIndices
│   ├── useAlerts.ts               # Alert rules (localStorage) + event evaluation
│   ├── useAgents.ts               # 3 AI-агента, insight generation, read/unread tracking
│   ├── useBrandGroups.ts          # Brand groups CRUD + localStorage persistence
│   ├── useExpansionRadar.ts       # Radar state: target brand, weights, scores, region selection
│   ├── useTheme.ts                # Light/Dark/System theme + localStorage
│   ├── useCountryData.ts          # Загрузка и мемоизация CountryConfig
│   ├── useResolvedTheme.ts        # Resolved theme value (for map tiles)
│   ├── use-mobile.tsx             # Mobile breakpoint detection
│   └── use-toast.ts               # Toast notifications hook
├── contexts/
│   └── CountryContext.tsx          # CountryConfig: brands, regionCounts, population, brandPoints, etc.
├── lib/
│   ├── agent-engine.ts            # 3 агента × 4 insight types = 12 типов инсайтов
│   ├── alert-engine.ts            # evaluateAlerts + buildSnapshot (pure functions)
│   ├── expansion-scoring.ts       # 4 sub-scores, composite scoring, tiers
│   ├── city-aggregation.ts        # Агрегация точек по городам
│   ├── derived-metrics.ts         # Вычисление density, share
│   ├── export-csv.ts              # CSV export
│   ├── export-pdf.ts              # PDF snapshot export
│   ├── feed-types.ts              # Unified feed type definitions
│   ├── insight-generator.ts       # High-level insight generator
│   ├── opportunity-colors.ts      # Цветовые шкалы для Radar тиров
│   ├── utils.ts                   # cn() и общие утилиты
│   └── api/
│       ├── brand-points.ts        # Supabase API: загрузка brand points
│       └── countries.ts           # Supabase API: загрузка списка стран
├── data/
│   ├── uk-data.ts                 # Статические данные UK (regions, brands, population)
│   ├── brand-points.ts            # Brand point coordinates and metadata
│   ├── country-configs.ts         # COUNTRY_CONFIGS registry
│   ├── city-region-mapping.ts     # city → region lookup table
│   └── temporal-data.ts           # OPEN_DATES: synthetic opening dates per brand
├── integrations/
│   └── supabase/
│       ├── client.ts              # Supabase client initialization
│       └── types.ts               # Database type definitions
└── test/
    ├── setup.ts                   # Vitest setup
    ├── agent-engine.test.ts       # Agent engine tests
    ├── alert-engine.test.ts       # Alert engine tests
    ├── expansion-scoring.test.ts  # Expansion scoring tests
    ├── timeline.test.ts           # Timeline logic tests
    ├── brand-groups.test.ts       # Brand groups tests
    ├── city-aggregation.test.ts   # City aggregation tests
    ├── export-csv.test.ts         # CSV export tests
    ├── country-context.test.ts    # Context tests
    ├── api-integration.test.ts    # API integration tests
    └── example.test.ts            # Example/smoke test
```

## 5. Архитектура состояния (Context + Custom Hooks)

Приложение **не использует Zustand**. Вместо этого — `CountryContext` для конфигурации страны и набор custom hooks как state containers в `Explorer.tsx`.

### CountryContext

```typescript
interface CountryConfig {
  readonly code: string
  readonly name: string
  readonly brands: Record<string, BrandInfo>
  readonly regionCounts: Record<string, Record<string, number>>
  readonly population: Record<string, number>
  readonly brandPoints: Record<string, readonly [number, number, string, string, string][]>
  readonly regionCentroids: Record<string, [number, number]>
  readonly interpolateColor: (t: number) => string
  readonly mapCenter: [number, number]
  readonly mapZoom: number
  readonly cityToRegion: Record<string, string>
}
```

### Custom Hooks — State Containers

| Hook | Назначение | Ключевое состояние |
|------|------------|-------------------|
| `useTimeline` | Временная шкала | `currentMonth` (0-131), `isPlaying`, `speed`, `visibleIndices` |
| `useAlerts` | Система алертов | `rules` (localStorage), `events`, `unreadCount` |
| `useAgents` | AI-агенты | `insights` (до 50), `agentStatuses`, `unreadCount` |
| `useBrandGroups` | Группы брендов | `groups` (default + custom), CRUD + localStorage |
| `useExpansionRadar` | Radar scoring | `targetBrand`, `weights`, `scores`, `selectedRegion` |
| `useTheme` | Тема оформления | `theme` (light/dark/system), `resolved`, `toggle` |
| `useCountryData` | Данные страны | `config` (CountryConfig), `isLoading` |

Все хуки оркестрируются в `Explorer.tsx`, который передаёт данные вниз через props.

## 5a. Архитектура Agent Team

### Агенты

3 специализированных агента, каждый анализирует snapshot переходы (prevSnapshot → nextSnapshot):

| Агент | ID | Tagline | Типы инсайтов |
|-------|-----|---------|---------------|
| Market Monitor | `market-monitor` | Tracks growth trends and market dynamics | rapid-growth, regional-leader-shift, market-acceleration, stagnant-market |
| Competitor Tracker | `competitor-tracker` | Identifies competitive threats and openings | brand-dominance, competitive-entry, flanking-threat, brand-gap |
| Expansion Scout | `expansion-scout` | Discovers expansion opportunities | hot-opportunity, tier-upgrade, multi-brand-opportunity, saturated-region-warning |

### 12 типов инсайтов

| Тип | Агент | Триггер | Приоритет |
|-----|-------|---------|-----------|
| `rapid-growth` | Market Monitor | Бренд добавил ≥3 локации в регионе за месяц | 2 |
| `regional-leader-shift` | Market Monitor | Топ-бренд в регионе сменился | 1 |
| `market-acceleration` | Market Monitor | Бренд растёт на 50%+ быстрее среднего | 2 |
| `stagnant-market` | Market Monitor | Ноль чистых открытий в регионе за месяц | 4 |
| `brand-dominance` | Competitor Tracker | Бренд контролирует >35% доли в регионе | 2 |
| `competitive-entry` | Competitor Tracker | Бренд вошёл в регион, где у rival >30 локаций | 1 |
| `flanking-threat` | Competitor Tracker | 2+ бренда одновременно растут (≥2 каждый) в регионе | 3 |
| `brand-gap` | Competitor Tracker | Бренд с >50 нац. локациями отсутствует в регионе | 3 |
| `hot-opportunity` | Expansion Scout | Регион получил тир Hot для бренда | 2 |
| `tier-upgrade` | Expansion Scout | Регион перешёл из Warm в Hot | 1 |
| `multi-brand-opportunity` | Expansion Scout | Регион Hot для ≥2 брендов | 1 |
| `saturated-region-warning` | Expansion Scout | Все бренды Cold в регионе | 4 |

### Data Flow

```
Timeline month change
  → buildSnapshot(month, openDates, brandPoints, cityToRegion)
  → prevSnapshot vs nextSnapshot
  → runAllAgents(prev, next, countryConfig, monthDate)
  → AgentInsight[] (sorted by priority)
  → useAgents state (max 50 insights, FIFO)
  → AlertsPanel → AgentsTab UI
```

Все функции — pure (без side effects). Агенты rule-based, не используют LLM.

## 5b. Система алертов

### Типы правил

| Тип | Триггер | Пример |
|-----|---------|--------|
| `threshold` | Бренд превысил N локаций в регионе | «Subway exceeded 200 locations in London» |
| `change` | Бренд вошёл/вышел из региона | «KFC entered Northern Ireland» |
| `competitor` | Rival бренд появился в регионе, где уже есть target бренд | «Dominos opened near Subway in Scotland» |

### Персистентность
- Правила (AlertRule[]) хранятся в `localStorage` под ключом `explorer-alert-rules`
- События (AlertEvent[]) — in-memory, максимум 100, FIFO
- Состояние read/unread — in-memory

### Evaluation
`evaluateAlerts(rules, prevSnapshot, nextSnapshot, monthDate)` — pure function, вызывается из `useAlerts` при каждом изменении `currentMonth` в timeline.

## 5c. Expansion Radar — система скоринга

### 4 фактора (sub-scores, 0-100)

| Фактор | Вес по умолчанию | Логика |
|--------|-----------------|--------|
| Penetration Gap | 35% | 1 − (regional density / national avg density) |
| Competitor Presence | 25% | Плотность конкурентов относительно максимума |
| Population Score | 20% | Население региона / max население |
| Density Headroom | 20% | 1 − (total density / max total density) |

### Composite Score
```
composite = Σ(sub_score × weight) / Σ(weights)   → clamp(0, 100)
```

### Тиры

| Тир | Score range | Интерпретация |
|-----|-----------|---------------|
| Hot | 80-100 | Высший приоритет для экспансии |
| Warm | 60-79 | Сильный потенциал |
| Moderate | 40-59 | Умеренные возможности |
| Cool | 20-39 | Низкий приоритет |
| Cold | 0-19 | Рынок насыщен или непривлекателен |

Веса настраиваются через UI (WeightSliders). Все вычисления — pure functions в `expansion-scoring.ts`.

## 5d. Timeline — временная динамика

### Параметры
- **Диапазон:** Jan 2015 – Dec 2025 (month index 0-131)
- **По умолчанию:** month 131 (Dec 2025 — текущий snapshot)
- **Скорость:** 200ms / speed на один месяц (speed = 1x, 2x, 4x)

### Механизм
1. `temporal-data.ts` содержит `OPEN_DATES` — synthetic opening dates для каждого бренда
2. `buildSnapshot(month, openDates, brandPoints, cityToRegion)` строит срез region→brand→count по cutoff date
3. `getVisibleIndicesForMonth(month)` возвращает индексы видимых точек per brand
4. При изменении month — пересчитываются `visibleIndices`, передаются в `MapView` и `Sidebar`
5. `useAlerts` и `useAgents` реагируют на month change, генерируя events/insights

### Play/Pause
При нажатии Play — автоматическое инкрементирование month через `setInterval`. При достижении MAX_MONTH (131) — автоматическая остановка. При повторном Play от конца — restart с month 0.

## 6. Поведение элементов интерфейса

### Карта (MapView)

**Начальное состояние:**
- Центр: координаты выбранной страны (UK: 54.5, -2.0)
- Zoom: подобран так, чтобы вся страна была видна (UK: zoom 6)
- Тайловый слой: CartoDB Dark (без labels) + отдельный слой labels поверх

**Хороплетный слой (RegionLayer):**
- Каждый регион залит цветом по выбранной метрике
- Цветовая шкала: последовательная (sequential), от тёмного к яркому синему
- При hover: граница региона подсвечивается (#60a5fa, weight 2.5), появляется tooltip
- При click: регион выделяется (weight 3), открывается правая панель с деталями, карта анимированно зумится к этому региону
- При изменении выбранных брендов или метрики — плавный перерасчёт цветов (transition 400ms)

**Слой точек (PointsLayer):**
- CircleMarker с radius=3, цвет бренда, fillOpacity=0.7
- При hover: popup с названием, брендом, адресом
- При zoom > 12: radius увеличивается до 5, показывается label

**Tooltip (RegionTooltip):**
- Появляется при hover на регион (position: абсолютная, привязана к курсору)
- Содержит: название региона + список брендов с цветными точками и числами
- Показывает текущую метрику с единицей измерения
- Исчезает при mouseout

### Левая панель (Sidebar)

**Brand Selector:**
- Каждый бренд — toggle (checkbox) с цветной точкой, названием и общим кол-вом
- По умолчанию все включены
- Изменение мгновенно обновляет карту и правую панель
- Сортировка: по убыванию кол-ва точек

**Metric Selector:**
- 3 кнопки: "Total locations" / "Per 100k pop." / "Brand share %"
- "Brand share %" показывает долю первого выбранного бренда
- Выбор мгновенно перекрашивает карту

**Display Selector:**
- 3 кнопки: "Regions" / "Points" / "Both"
- "Points" — показывает точки, регионы полупрозрачные (fillOpacity: 0.15)
- "Both" — и хороплет, и точки

### Правая панель (RegionPanel)

**Открытие:** клик по региону на карте или по ссылке в таблице
**Закрытие:** кнопка ×, или клик на другой регион
**Содержимое:**
1. Stats grid (2×2): Total locations, Per 100k, Population, (можно добавить Growth)
2. Brand breakdown: горизонтальные бары, отсортированные по убыванию
   - Каждый бар: имя бренда (80px) | прогресс-бар (цвет бренда) | число + %
   - Ширина бара пропорциональна максимальному бренду в регионе
3. Market share chart: doughnut chart (Chart.js), легенда внизу

### Таблица (TableView)

**Структура:** Регион | Total | Population | Per 100k | <каждый бренд>
**Поведение:**
- Клик по заголовку — сортировка (toggle asc/desc)
- Текущий sort подсвечен синим
- В колонках брендов: число + (процент) серым
- Название региона — кликабельная ссылка (переключает на Map view и открывает panel)
- Фиксированная шапка при скролле (sticky header)

### Переключение видов (Map / Table)

- Кнопки в header
- При переключении на Map — вызывается map.invalidateSize() с задержкой 100ms
- State (выбранные бренды, метрика) сохраняется при переключении
- URL обновляется: `/explorer/uk?view=map&brands=subway,kfc&metric=density`

### Heatmap mode
- Display mode "heatmap" в Sidebar
- Использует leaflet.heat plugin
- Интенсивность определяется количеством точек
- Переключается через 4-позиционный selector: Regions / Points / Both / Heatmap

### Timeline Slider (TimelineSlider)
- Горизонтальная полоса под Header, над контентом
- Показывает текущий месяц/год (например, "Mar 2020")
- Кнопка Play/Pause слева
- При перетаскивании — мгновенное обновление карты и sidebar counts
- Скрывается в Radar view

### AlertsPanel
- Sheet-панель (shadcn Sheet), открывается по клику на badge в Header
- 3 таба:
  - **Events** — хронологический список сработавших алертов
  - **Agents** — карточки 3 агентов с инсайтами (AgentsTab)
  - **Rules** — список правил + форма создания нового правила
- Badge в Header показывает суммарный unread count (alerts + agent insights)

### AgentsTab
- 3 карточки агентов с цветовой индикацией: emerald (Market Monitor), red (Competitor Tracker), purple (Expansion Scout)
- Статус: idle (серый) / alerting (пульсирующий цветной)
- Разворачиваемый список инсайтов per agent
- Кнопка «Mark all read»

### BrandGroupManager
- Аккордеон в Sidebar
- Предустановленные группы: All Brands, Pizza, Chicken & Burgers
- Кнопка «Create group» — выбор брендов + название
- Клик по группе — применяет фильтр (setSelectedBrands)
- Custom groups удаляются, default — нет

### ThemeToggle
- Иконка Sun/Moon в Header
- 3 режима: Light / Dark / System
- При переключении:
  - Toggle CSS class `dark` на `<html>`
  - Тайлы карты переключаются между CartoCDN light_all и dark_all
  - Сохраняется в localStorage

### City Drill-down (CityBreakdown)
- Появляется в RegionPanel при выборе региона
- Агрегация точек по городам через `city-aggregation.ts`
- Сортировка городов по количеству точек
- Показывает breakdown по брендам в каждом городе

## 7. Работа с данными

### Загрузка данных
1. При открытии страницы загружается `/api/v1/countries/{code}/regions` (GeoJSON с полигонами и статистикой)
2. Данные кэшируются в store (они не часто меняются)
3. Точки загружаются лениво при переключении на Points view или при zoom > 10
4. Используется TopoJSON format для доставки (экономия ~80% по сравнению с GeoJSON)

### Перерасчёт метрик
Все метрики вычисляются на фронтенде из загруженных данных:
- `total`: сумма location_count по выбранным брендам
- `density`: total / (population / 100000)
- `share`: brand_count / region_total * 100

### Цветовая шкала
```typescript
function getColor(value: number, maxValue: number): string {
  const t = Math.max(0, Math.min(1, value / maxValue));
  // 5-step sequential scale: dark navy → bright blue
  const colors = [[15,23,42], [30,58,138], [59,130,246], [96,165,250], [191,219,254]];
  // interpolate...
}
```
`maxValue` пересчитывается при каждом изменении фильтров (макс среди всех видимых регионов).

### Производительность
- Регионы: 12 полигонов — легко, но полигоны могут быть тяжёлыми (~5-13MB GeoJSON). Решение: TopoJSON (889KB) или vector tiles для продакшена.
- Точки: ~6800 — нормально для CircleMarker, но при zoom out используем кластеризацию (Leaflet.markercluster или supercluster)
- При масштабировании до 50+ стран → переход на vector tiles (Mapbox/MapLibre GL JS)

## 8. Нормализация данных

Каждый бренд приходит в своём формате. Необходимый ETL pipeline:

```
Source GeoJSON → Normalize Schema → Geocode/Validate → Region Assignment → Store
```

**Ключевые маппинги (из текущих данных):**

| Поле | Domino's | KFC | McDonald's | Nando's | Papa John's | Subway |
|------|----------|-----|-----------|---------|------------|--------|
| name | `name` | `name` | `name` | `name` | `name` | `name` |
| city | `location.address.town` | `city` | `city` | `address.addressLocality` | `town` | `city` |
| postcode | `location.address.postcode` | `postalcode` | `postcode` | `address.postalCode` | `postcode` | `postcode` |
| has_delivery | `availableFulfilmentMethods.includes('Delivery')` | `hasDelivery` | `deliveryServices.length > 0` | — | — | — |
| has_drive_thru | — | `hasDriveThru` | `driveThru == 'Y'` | — | — | — |
| status | `status == 'Online'` → open | `status == 'available'` → open | `status == 'OPEN'` → open | always open | `active == true` → open | always open |

**Region assignment:**
```sql
UPDATE locations SET region_id = r.id
FROM regions r
WHERE ST_Contains(r.geometry, locations.coordinates)
  AND locations.country_id = r.country_id;
```
