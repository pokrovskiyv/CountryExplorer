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
  Leaflet/MapLibre    PostGIS queries         Brand scrapers
  Chart.js/Recharts   Aggregation cache       GeoJSON normalization
  State (Zustand)     Auth & permissions      Population data enrichment
```

### Технологический стек (предложение)
- **Frontend:** React 18+ / Next.js, TypeScript, Leaflet или MapLibre GL JS, Recharts/Chart.js, Zustand для state
- **Backend:** Существующий API Getplace + новые endpoints
- **Database:** PostgreSQL + PostGIS (для пространственных запросов)
- **Cache:** Redis для агрегированных метрик по регионам
- **Data format:** GeoJSON (source) → TopoJSON (delivery) → Vector Tiles (scale)

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
CountryExplorer/
├── CountryExplorerPage.tsx          # Основная страница
├── components/
│   ├── Header/
│   │   ├── Header.tsx               # Навигация, выбор страны
│   │   └── ViewTabs.tsx             # Map / Table переключатель
│   ├── Sidebar/
│   │   ├── Sidebar.tsx              # Левая панель
│   │   ├── BrandSelector.tsx        # Toggles брендов
│   │   ├── MetricSelector.tsx       # Выбор метрики для окраски
│   │   ├── DisplaySelector.tsx      # Regions / Points / Both
│   │   └── CountrySummary.tsx       # Summary карточки
│   ├── Map/
│   │   ├── MapView.tsx              # Leaflet/MapLibre контейнер
│   │   ├── RegionLayer.tsx          # Хороплетный слой регионов
│   │   ├── PointsLayer.tsx          # Слой точек (CircleMarkers)
│   │   ├── MapLegend.tsx            # Легенда
│   │   └── RegionTooltip.tsx        # Tooltip при наведении
│   ├── Panel/
│   │   ├── RegionPanel.tsx          # Правая панель с деталями
│   │   ├── BrandBreakdown.tsx       # Горизонтальные бары
│   │   ├── MarketShareChart.tsx     # Doughnut chart
│   │   └── RegionStats.tsx          # Карточки метрик
│   └── Table/
│       ├── TableView.tsx            # Табличный вид
│       └── SortableHeader.tsx       # Сортируемые заголовки
├── hooks/
│   ├── useCountryData.ts            # Загрузка данных страны
│   ├── useRegionStats.ts            # Вычисление метрик
│   └── useMapInteraction.ts         # Состояние карты
├── store/
│   └── explorerStore.ts             # Zustand store
└── utils/
    ├── colors.ts                    # Цветовые шкалы
    ├── metrics.ts                   # Вычисление метрик
    └── geo.ts                       # Гео-утилиты
```

## 5. Состояние приложения (Zustand Store)

```typescript
interface ExplorerState {
  // Country
  selectedCountry: string;

  // Brands
  selectedBrands: Set<string>;
  toggleBrand: (brandSlug: string) => void;

  // Metric & Display
  colorMetric: 'total' | 'density' | 'share';
  displayMode: 'choropleth' | 'points' | 'both';
  setColorMetric: (metric: ColorMetric) => void;
  setDisplayMode: (mode: DisplayMode) => void;

  // Region selection
  selectedRegion: string | null;
  selectRegion: (regionId: string | null) => void;

  // View
  activeView: 'map' | 'table';
  setActiveView: (view: View) => void;

  // Table sorting
  tableSortKey: string;
  tableSortDirection: 'asc' | 'desc';
  setTableSort: (key: string) => void;
}
```

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
