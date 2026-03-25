# Human Traffic Intelligence — Agent Team

## Зачем это сделано

Country Explorer изначально позиционировался как **инструмент** — карта, скоринг, агенты. Аналитик ресторанной сети мог сам анализировать данные и принимать решения.

После разговора с CEO (Денис) направление сместилось: **компании покупают инсайты, а не инструменты**. Ресторанная сеть видит только свои данные. Getplace видит ВСЕ бренды + может подтянуть внешние сигналы. Именно это пересечение рождает инсайты, за которые платят.

**Задача:** Показать, что Getplace умеет анализировать данные, замечать паттерн, формулировать гипотезу и выдавать ценный для компании инсайт — автоматически.

**Решение:** 3 новых агента, которые накладывают внешние UK open data (пассажирский трафик ж/д станций, дорожный трафик, плотность автобусных остановок, демография) на существующие 21,263 ресторанных точек. Результаты доступны через toggleable map layers и Insights view (default view платформы).

---

## Источники данных

Все данные бесплатные и публикуются под Open Government Licence v3.0. Это означает, что их можно свободно использовать, в том числе в коммерческих продуктах, с указанием источника.

### 1. ORR Station Usage (пассажирский трафик станций)

| | |
|---|---|
| **Что содержит** | Количество входов и выходов пассажиров за год по каждой железнодорожной станции Великобритании |
| **Кто публикует** | Office of Rail and Road (ORR) — регулятор ж/д транспорта UK |
| **Частота обновления** | Ежегодно (апрель–март). Текущая версия: 2024–2025 |
| **Формат** | CSV, ~2,600 станций |
| **Ключевые поля** | Station name, Entries and exits (All tickets), Region, TLC |
| **Скачать** | https://dataportal.orr.gov.uk/ → Table 1410 |
| **Лицензия** | OGL v3.0 |

**Почему этот источник:** Это единственный официальный источник данных о пассажиропотоке ж/д станций UK. Данные точные (основаны на продажах билетов), покрывают все станции, публикуются регулятором. Альтернатив с такой полнотой нет.

**Ограничение:** CSV не содержит GPS-координат станций. Координаты берутся из NaPTAN (ниже).

### 2. NaPTAN (координаты транспортных объектов + bus stop density)

| | |
|---|---|
| **Что содержит** | Координаты (lat/lon) всех остановок общественного транспорта UK: ж/д станции, автобусные остановки, метро, трамваи |
| **Кто публикует** | Department for Transport (DfT) |
| **Частота обновления** | Ежедневно |
| **Формат** | CSV, ~434K записей |
| **Ключевые поля** | CommonName, Latitude, Longitude, StopType |
| **API** | https://naptan.api.dft.gov.uk/v1/access-nodes?dataFormat=csv |
| **Лицензия** | OGL v3.0 |

**Почему этот источник:** NaPTAN — каноническая база координат транспортных объектов UK. Используется всеми картографическими и транспортными сервисами.

**Как используется (двойная роль):**
1. **Координаты станций:** Джойним NaPTAN (StopType='RLY') с ORR по названию станции → GPS для каждой станции. Матчинг 99.92% — 2,587 из 2,589 станций (multi-level fuzzy matching: exact → strip parens → fuzzy key with and/& normalization → partial name → flat parens).
2. **Bus stop density как proxy для пешеходного трафика:** NaPTAN содержит ~371K автобусных остановок (StopType='BCT'). Плотность остановок рядом со станцией коррелирует с пешеходной активностью района — где много остановок, там много людей ходят пешком. Используется как 5-й сигнал в Opportunity Engine.

### 3. DfT Traffic Counts / AADF (дорожный трафик)

| | |
|---|---|
| **Что содержит** | Среднесуточный поток автомобилей (Annual Average Daily Flow) в ~46,000 точках замера по всей UK |
| **Кто публикует** | Department for Transport (DfT) |
| **Частота обновления** | Ежегодно. Данные с 2000 по 2024 |
| **Формат** | CSV (в ZIP), ~580K строк (по точке × год). Координаты в count_points.csv |
| **Ключевые поля** | latitude, longitude, all_motor_vehicles (AADF), road_name, road_type |
| **Скачать** | https://roadtraffic.dft.gov.uk/downloads |
| **Лицензия** | OGL v3.0 |

**Почему этот источник:** DfT AADF — единственный открытый источник данных об автомобильном трафике UK. Покрывает все типы дорог (от автомагистралей до местных дорог). Актуален для drive-thru ресторанов: высокий AADF = много потенциальных клиентов на авто.

**Как используется:** Фильтруем до топ-5,000 точек по трафику. Для каждой считаем кол-во drive-thru ресторанов в радиусе 1.5км. Высокий трафик + мало drive-thru = возможность.

### 4. UK Deprivation Indices (демография)

Четыре национальных индекса депривации, нормализованных в единую шкалу:

| Нация | Индекс | Версия | Единиц | Формат | Источник |
|-------|--------|--------|--------|--------|----------|
| England | IMD | 2025 | 33,755 LSOA | CSV | gov.uk |
| Wales | WIMD | 2025 | 1,917 LSOA | ODS | gov.wales |
| Scotland | SIMD | 2020v2 | 6,973 Data Zones | XLSX | gov.scot |
| N. Ireland | NIMDM | 2017 | 890 SOA | XLS | nisra.gov.uk |

Все данные под Open Government Licence v3.0. Итого: ~43,535 микрорайонов по всему UK.

**Почему эти источники:** Индексы депривации — стандартный инструмент для оценки социально-экономического профиля территорий UK. Income deprivation rate позволяет понять, соответствует ли аудитория района целевой аудитории бренда (premium vs value).

**Как используется:** Данные на уровне микрорайонов агрегируются до 12 UK-регионов (через маппинг Local Authority / Data Zone / SOA → ITL1 Region). Для каждого региона считается средний income score, медианный UK-normalized income decile, и средний composite deprivation score. Подробная методология нормализации — в секции ниже.

#### Методология нормализации (Combo A+C)

##### Проблема: четыре несопоставимых индекса

Каждая нация UK публикует собственный индекс депривации. Они **методологически несовместимы** — все четыре правительства прямо заявляют, что прямое сравнение невозможно:

| Аспект | England (IMD) | Wales (WIMD) | Scotland (SIMD) | N. Ireland (NIMDM) |
|--------|---------------|--------------|-----------------|-------------------|
| Доменов | 7 | 8 | 7 | 7 |
| Вес Income | 22.5% | 22% → 20% (2025) | 28% | 25% |
| Вес Employment | 22.5% | 22% → 20% (2025) | 28% | 25% |
| Вес Crime | 9.3% | 5% | 5% | 5% |
| Geography unit | LSOA (~1,500 чел.) | LSOA (~1,600 чел.) | Data Zone (~750 чел.) | SOA (~2,000 чел.) |
| Базовая линия дохода | 60% медианы England | 60% медианы Wales | Различные индикаторы | 60% медианы NI |
| Публикует | Score + rank + decile | Score (0-100) | Rank only | Rank only |

Ключевые различия: разные домены и веса, разные индикаторы внутри доменов, разные geography units, разные poverty baselines. Composite score из одного индекса **нельзя** сравнивать с composite score из другого.

##### Решение: две параллельные нормализации

Мы используем подход "Combo A+C" — две стратегии нормализации для двух разных потребителей данных.

**Вариант C — UK-wide income decile (для scoring-движка)**

Единственная метрика, реально сопоставимая между нациями — **income deprivation rate** (доля населения в бедности). Все 4 индекса её содержат, и она измеряет по сути одно и то же: процент людей с доходом ниже порога.

Алгоритм:
1. Собираем income deprivation rate из всех ~43,500 микрорайонов UK
2. Сортируем по income rate (ascending — от наименее бедных к наиболее бедным)
3. Каждому микрорайону присваиваем перцентиль: `i / (n - 1)`
4. Конвертируем в децили: `decile = 10 - floor(percentile × 10)`, где 1 = самые бедные 10%, 10 = самые богатые 10%
5. Агрегируем до региона: медианный децил всех микрорайонов в регионе

Результат: `medianIncomeDecile` — единственное cross-nation comparable поле. Используется в brand-income affinity: premium бренды (Nando's) → decile ≥ 6, value бренды (McDonald's, Subway) → decile ≤ 5.

**Вариант A — nation-normalized composite score (для карты)**

Для визуального слоя на карте используем composite deprivation из каждого национального индекса, нормализованный в единую шкалу 0-100 (higher = more deprived):

- **IMD (England):** score используется напрямую (уже в масштабе 0-~90)
- **WIMD (Wales):** score используется напрямую (шкала 0-100, where 100 = most deprived)
- **SIMD (Scotland):** из рангов: `(6976 - rank) / 6976 × 100` (rank 1 = most deprived → score ≈ 100)
- **NIMDM (N. Ireland):** из рангов: `(890 - rank) / 890 × 100` (аналогично)

Результат: `avgImdScore` — НЕ сопоставим между нациями (decile 5 в Wales ≠ decile 5 в England по этому полю). Используется **только** для раскраски карты внутри каждого региона. Функция `imdColor` вычисляет min/max динамически из всего массива REGION_DEMOGRAPHICS.

##### Правила использования полей

| Поле | Cross-nation comparable | Где используется |
|------|------------------------|-----------------|
| `medianIncomeDecile` | **Да** — UK-wide normalized | Scoring: brand-income affinity |
| `avgImdScore` | Нет — nation-specific composite | Карта: цвет региона |
| `avgIncomeScore` | Нет — разные poverty baselines | Tooltip: information only |
| `avgEmploymentScore` | Нет — разные методологии | Tooltip: information only |
| `deprivationSource` | N/A | Tooltip: "IMD 2025" / "WIMD 2025" / etc. |
| `microAreaLabel` | N/A | Tooltip: "LSOAs" / "Data Zones" / "SOAs" |

##### Ограничения нормализации

1. **Income rate — не идентичная метрика.** England/NI используют "60% медианы" страны, Wales — аналогично но с другой медианой, Scotland — набор индикаторов вместо одного порога. На практике разница невелика для агрегата на уровне регионов.
2. **NIMDM 2017 устарел.** Данные 2015/16 — 10-летней давности. NI income decile может не отражать текущую реальность.
3. **Composite scores не выровнены.** avgImdScore 28.45 (North East, IMD) и 49.94 (N. Ireland, NIMDM) нельзя сравнивать — это разные шкалы. На карте это выглядит как "NI более депривирован чем NE", что может быть неточно.
4. **Потеря "multiple" из MDI.** Для scoring мы используем только income — теряем health, education, crime и другие домены. Для QSR site selection это приемлемо: income — главный предиктор brand affinity.

### 5. Census 2021 Workplace Population (WP001)

| | |
|---|---|
| **Что содержит** | Количество людей, работающих в каждом микрорайоне (MSOA) — "дневное население" вместо "ночного" |
| **Кто публикует** | Office for National Statistics (ONS) через Nomis |
| **Частота обновления** | Раз в 10 лет (перепись). Текущая версия: Census 2021 |
| **Формат** | CSV (в ZIP), 7,264 MSOA areas (Англия и Уэльс) |
| **Ключевые поля** | MSOA code, Count (workplace population) |
| **Скачать** | https://www.nomisweb.co.uk/output/census/2021/wp001.zip |
| **Координаты MSOA** | https://opendata.arcgis.com/ → MSOA Dec 2021 EW PWC (Population Weighted Centroids) |
| **Лицензия** | OGL v3.0 |

**Почему этот источник:** Workplace population показывает, где люди **работают днём**, а не где живут. Для QSR это критично — обеденный трафик идёт рядом с офисами, а не рядом с домами. Станция Old Street (174,745 workers в 1.5km) и спальная станция с тем же пассажиропотоком — это совершенно разные обеденные возможности.

**Важно:** Это не то же самое, что residential population. City of London 001 (квадратная миля финансового центра) имеет ~8,600 жителей, но **88,923 workers**. Workplace population в 10 раз выше residential — и именно эти 89K человек ходят в рестораны днём.

**Как используется:** Для каждой станции суммируется workplace population всех MSOA-центроидов в радиусе 1.5km (haversine + bounding-box pre-filter). Результат — поле `workplacePop1500m` в station-data.ts. Используется как 7-й сигнал в Opportunity Engine: ≥50K workers = major business district (strength 0.9), ≥20K = significant office area (strength 0.6).

**Ограничение:** Census 2021 покрывает только Англию и Уэльс (7,264 MSOA). Шотландия не включена. Данные — snapshot на 21 марта 2021, могут не отражать post-COVID изменения в паттернах remote work.

### 6. BRES — Business Register and Employment Survey (занятость по отраслям)

| | |
|---|---|
| **Что содержит** | Количество сотрудников по отраслям (SIC 2007 section A–S) в каждом Local Authority District |
| **Кто публикует** | ONS через NOMIS (dataset NM_189_1, open access) |
| **Частота обновления** | Ежегодно. Текущая версия: 2023 |
| **Формат** | CSV через NOMIS API, 348 LA × 19 SIC sections |
| **Ключевые поля** | GEOGRAPHY_NAME, INDUSTRY_NAME, OBS_VALUE (кол-во сотрудников) |
| **API** | `https://www.nomisweb.co.uk/api/v01/dataset/NM_189_1.data.csv` |
| **Лицензия** | OGL v3.0 |

**Почему этот источник:** BRES даёт **число сотрудников**, а не предприятий. Это критично: 1 Goldman Sachs в City of London = 5,000+ сотрудников, а 1 кофейня = 3 сотрудника. Business Counts (NM_141_1) считает оба как "1 enterprise", что сжимает реальную разницу.

**Как используется:** Для каждого LA строится профиль занятости по SIC-секциям. City of London: 223K в finance (K), 169K в professional services (M). Этот профиль взвешивается медианными зарплатами из ASHE (ниже) → estimated median worker salary per LA.

**Ограничение:** NOMIS API не поддерживает bulk download по geography TYPE — скачивается батчами по 50 LA кодов. Шотландия и Северная Ирландия не включены (348 из 406 LA — только England & Wales).

### 7. ASHE — Annual Survey of Hours and Earnings (зарплаты по отраслям)

| | |
|---|---|
| **Что содержит** | Медианная годовая зарплата (gross) по каждой SIC 2007 section (19 отраслей) |
| **Кто публикует** | ONS, Table 16.5a |
| **Частота обновления** | Ежегодно. Текущая версия: 2023 revised |
| **Формат** | CSV, 19 записей |
| **Ключевые поля** | sic_section (A–S), median_annual_pay (£) |
| **Скачать** | ONS ASHE Table 16, данные в `ashe-median-pay-by-sic.csv` |
| **Лицензия** | OGL v3.0 |

**Почему этот источник:** ASHE — крупнейший survey зарплат в UK (300K+ записей). Даёт разницу между отраслями: Finance (K) = £38,150, Hospitality (I) = £16,440. Эта разница — ключ к пониманию lunch budget районов.

**Как используется (в связке с BRES):** `estimated salary = Σ(employees_in_SIC × median_pay_SIC) / total_employees`. Pipeline: станция → ближайший LA centroid → BRES SIC-профиль → ASHE-взвешенная зарплата → поле `estWorkerSalary` в station-data.ts. Используется в сигнале Demo Fit для деловых кварталов (50K+ workers) вместо residential income decile.

**Ограничение:** Национальные медианы (не региональные). Finance worker в London зарабатывает больше чем в Leeds, но оба получают £38K в расчёте. Региональная разбивка ASHE по SIC недоступна через NOMIS API — только через ONS Query Builder вручную. Это ограничивает диапазон: £23K – £35K вместо реальных ~£18K – £55K.

---

## Архитектура решения

### Общая схема

```
Внешние данные (CSV)  →  Python ETL скрипты  →  Static TypeScript файлы  →  Агенты (чистые функции)  →  UI
```

### Почему ETL в Python, а не в браузере

Proximity-расчёты (сколько ресторанов в радиусе 800м от каждой станции) — это 2,587 станций × 6,820 ресторанов = **17.6 миллиона** вычислений расстояний. Плюс 2,587 × 371,000 bus stops = **960 миллионов**. В браузере это заняло бы минуты при каждой загрузке.

Вместо этого всё предрасчитывается в Python (Shapely + haversine с bounding-box pre-filter) и сохраняется в статические TypeScript файлы. Браузер загружает готовые числа мгновенно. Этот подход уже используется в проекте для ресторанных данных (`convert-geojson.py` → `brand-points.ts`).

### ETL Pipeline

| Скрипт | Вход | Выход | Что делает |
|--------|------|-------|-----------|
| `scripts/download-external-data.sh` | — | CSV файлы в `src/data/Data for assignment/external/` | Скачивает все датасеты |
| `scripts/convert-stations.py` | ORR CSV + NaPTAN CSV + brand GeoJSON | `src/data/station-data.ts` (2,361 станция) | Джойнит ORR (2,589 станций) с NaPTAN координатами (fuzzy match 99.92% = 2,587), фильтрует до 2,361 с region assignment, считает QSR в радиусе 400м/800м/1500м |
| `scripts/convert-bus-density.py` | NaPTAN CSV + station-data.ts | Обогащает `station-data.ts` полем busStopCount800m | Считает автобусные остановки в радиусе 800м от каждой станции (371K stops) |
| `scripts/convert-traffic.py` | DfT AADF CSV + brand GeoJSON | `src/data/traffic-data.ts` (5,000 точек) | Фильтрует топ-5000 по трафику, считает drive-thru в радиусе 1.5км |
| `scripts/convert-demographics.py` | IMD 2025 + WIMD 2025 + SIMD 2020v2 + NIMDM 2017 | `src/data/demographic-data.ts` (12 регионов) | Загружает 4 национальных индекса (43,535 микрорайонов), нормализует income rate в UK-wide децили, агрегирует в 12 регионов |
| `scripts/convert-workplace-pop.py` | WP001 CSV + MSOA centroids + station-data.ts | Обогащает `station-data.ts` полем `workplacePop1500m` | Суммирует workplace population всех MSOA в 1.5km от станции |
| `scripts/convert-worker-salary.py` | BRES CSV + ASHE CSV + MSOA centroids + MSOA-LAD lookup + station-data.ts | Обогащает `station-data.ts` полем `estWorkerSalary` | Для каждой станции: nearest LA → SIC employment profile (BRES) × median pay (ASHE) → weighted avg salary |

### Файлы данных (TypeScript)

| Файл | Размер | Записей | Интерфейс |
|------|--------|---------|-----------|
| `src/data/station-data.ts` | ~200 KB | 2,361 | `StationRecord` — name, lat, lon, region, annualEntries, qsrCount800m, brandCounts800m, footfallRatio, busStopCount800m, workplacePop1500m, estWorkerSalary |
| `src/data/traffic-data.ts` | 774 KB | 5,000 | `TrafficPoint` — lat, lon, region, roadName, aadf, driveThruCount1500m, qsrCount1500m |
| `src/data/demographic-data.ts` | 2.5 KB | 12 | `RegionDemographics` — region, avgIncomeScore, avgEmploymentScore, medianIncomeDecile, avgImdScore, lsoaCount, deprivationSource, microAreaLabel |

### Вспомогательный модуль

`src/lib/geo-utils.ts` (96 строк) — haversine distance, countPointsInRadius, findNearestPoints, formatDistance. Используется для popup-ов на карте и edge-case расчётов в браузере.

### Walk time вместо метров

Расстояния в интерфейсе показываются в **минутах пешком**, а не в метрах. Формула: haversine distance × 1.35 (walking factor — улицы не прямые) / 5 км/ч × 60. Это стандартный приём в urban planning (circuity factor ~1.3-1.4 для городской застройки). Для пользователя "~13 мин пешком" понятнее, чем "800м по прямой".

---

## Три новых агента

Все агенты — **статические** (запускаются один раз при загрузке, не зависят от таймлайна). Следуют паттерну `delivery-intel-agent.ts`: чистые функции, readonly данные, diversity-first cap.

### 1. Human Flow Analyst (amber)

**Файл:** `src/lib/human-flow-agent.ts` (210 строк)

**Стратегический вопрос:** ГДЕ находятся люди?

**Логика:** Сопоставляет пассажирский трафик станций с плотностью QSR рядом. Находит станции, где много людей, но мало ресторанов.

| Тип инсайта | Приоритет | Когда срабатывает | Пример |
|-------------|-----------|-------------------|--------|
| `high-station-traffic-low-qsr` | 2 | Станция >5M пассажиров/год И <8 QSR ~13 min walk | "Canada Water: 18.7M passengers/year but only 1 QSR within ~13 min walk" |
| `station-brand-gap` | 2 | Топ-50 станция, 2+ бренда есть, 1+ нет | "London Liverpool Street (98M passengers) has Subway, McDonalds, KFC, Nandos but zero Dominos" |
| `underserved-corridor` | 3 | 2+ underserved станции в одном регионе | "London: 51 major stations with <8 QSR within ~13 min walk" |

**Пороги:**
- `HIGH_STATION_TRAFFIC` = 5,000,000 (годовых входов)
- `LOW_QSR_NEAR_STATION` = 8 (QSR в зоне ~13 мин пешком)
- `MAX_INSIGHTS` = 10, `MAX_PER_TYPE` = 3

### 2. Market Fit Analyst (cyan)

**Файл:** `src/lib/market-fit-agent.ts` (221 строка)

**Стратегический вопрос:** КТО эти люди? Подходит ли демография под бренд?

**Логика:** Сопоставляет демографический профиль региона (доход) с позиционированием бренда. Находит несоответствия — бренд недопредставлен в регионе, где его целевая аудитория.

| Тип инсайта | Приоритет | Когда срабатывает | Пример |
|-------------|-----------|-------------------|--------|
| `affluence-brand-mismatch` | 2 | Premium-бренд на 20%+ ниже нац. среднего в high-income регионе, или value-бренд на 20%+ ниже в low-income | "Nando's (premium brand) has 37% fewer locations per capita in East Midlands — despite income decile 6" |
| `demographic-expansion-signal` | 3 | Регион с QSR плотностью <85% от среднего при income decile ≥4 | "South East: QSR density 15% below national average despite income decile 7" |

**Матрица бренд-доход (эвристика):**

| Бренд | Аффинити | Интерпретация |
|-------|----------|---------------|
| Nandos | premium | Сверхпредставлен в top-25% по доходу |
| McDonalds | neutral | Нет корреляции с доходом |
| KFC | value | Сверхпредставлен в bottom-50% |
| Subway | value | Сверхпредставлен в bottom-50% |
| Dominos | neutral | Нет корреляции |
| PapaJohns | value | Сверхпредставлен в bottom-50% |

### 3. Opportunity Engine (rose)

**Файл:** `src/lib/opportunity-engine-agent.ts` (~350 строк)

**Стратегический вопрос:** ГДЕ открываться? Где совпадают несколько сигналов?

**Логика:** Синтезирует все источники данных. Для каждой комбинации "бренд × станция" проверяет 7 взвешенных сигналов. Если 2+ совпали — это convergent opportunity.

**7 сигналов:**

| # | Сигнал | Вес | Описание | Сила (0-1) |
|---|--------|-----|----------|-----------|
| 1 | Footfall | 25% | Станция >1M пассажиров/год | 0–1.0 (log-шкала от 1M до max) |
| 2 | Brand gap | 25% | У бренда 0 точек ~13 min walk, но конкуренты есть | 0.8 |
| 3 | Demo fit | 15% | Income decile региона соответствует позиционированию бренда. В деловых кварталах (50K+ workers) — neutral (0.5), т.к. residential income не отражает lunch crowd | 0.5–0.9 |
| 4 | Low density | 15% | QSR рядом со станцией <50-75% от среднего | 0.5–0.8 |
| 5 | Pedestrian | 8% | 30+ автобусных остановок в 800м (оживлённый район) | 0.6–0.9 |
| 6 | Road traffic | 7% | 50K+ авто/день на ближайшей дороге, <2 drive-thru | 0.6–0.9 |
| 7 | Workforce | 5% | 20K+ workers в 1.5km — деловой район (Census 2021) | 0.6–0.9 |

**Composite Score** = sum(weight × strength) / totalWeight × 100 × confidenceMultiplier

### Обоснование весов (Evidence Base)

#### Почему именно эти веса?

Веса основаны на **индустриальных исследованиях QSR site selection + экспертной оценке**. Это не regression на outcome data (у нас нет данных "открылся → успешен"). Это informed expert judgment, подкреплённый конкретными источниками. Ниже — обоснование каждого веса.

#### Доказательная база по каждому сигналу

| Сигнал | Вес | Что говорят исследования | Сила обоснования |
|--------|-----|--------------------------|------------------|
| **Footfall** | 25% | Корреляция foot traffic с продажами QSR = **0.93** (Unacast). Coldwell Banker называет foot traffic **фактором #1** в QSR site selection. Kalibrate (ведущий вендор location intelligence) ставит traffic counts в категорию "very important". Strength рассчитывается по **log-шкале**: `(log(entries) - log(1M)) / (log(max) - log(1M))`, что лучше передаёт разницу между станциями при крайне неравномерном распределении (медиана 290K, max 98M). | **Сильное** ✓ |
| **Brand Gap** | 25% | Whitespace analysis — стандартная методология индустрии. Penn Station нашёл "1,000+ whitespace opportunities" этим методом (QSR Magazine). Однако исследование Choi et al. (2019) на 30,000 ресторанах показало, что QSR *выигрывают от рассредоточения* — наличие конкурентов валидирует спрос, но прямая конкуренция вредит. | **Умеренное** ⚠ |
| **Demo Fit** | 15% | 40% потребителей с доходом <$50K **сократили** посещения QSR (Restroworks). При этом 28% тех, кто ходит 15+ раз/мес, имеют доход >$150K (NRN). Income decile доказанно влияет на тип QSR бренда: premium vs value. **Ограничение:** Deprivation indices измеряют доход *жителей* района, а не посетителей. В деловых кварталах (50K+ workers в 1.5km) lunch crowd приезжает отовсюду — residential income не отражает реальную аудиторию. Для таких станций сигнал переводится в neutral (0.5). Income decile нормализован UK-wide (Combo A+C Variant C) — сопоставим между нациями. | **Умеренное** ⚠ |
| **Low Density** | 15% | 60% новых ресторанов закрываются в первый год, saturation — один из факторов (NRA). ICSC: "успех зависит от demand drivers, а не от абсолютной плотности". Undersaturation *относительно спроса* — хороший сигнал. | **Умеренное** ✓ |
| **Pedestrian** | 8% | Рестораны **более чувствительны к walkability**, чем другие бизнесы (ScienceDirect 2022). Пешеходы и велосипедисты тратят на **40% больше в месяц**, чем автомобилисты (UW-Extension). Улучшение пешеходной среды увеличивает продажи на **30%** (Active Living Research). | **Сильное** ✓ |
| **Road Traffic** | 7% | В US drive-thru = **50-70% revenue** QSR (QSR Magazine 2025). Но в UK drive-thru — значительно меньшая доля. 7% адекватно для UK-focused модели. При расширении на US нужно повысить до 15-25%. | **Контекстно** ⚠ |
| **Workforce** | 5% | Census daytime population — стандартный метрик в коммерческой недвижимости (Census Bureau). Однако post-COVID lunch transactions **down 3.3% vs 2019** (NBC News). 51% сотрудников пропускают ланч минимум раз в неделю (ezCater). Сигнал ослаблен hybrid work. | **Умеренное** ⚠ |

#### Академические и индустриальные источники

1. **Unacast Foot Traffic Analytics** — "0.93 correlation with ground truth sales data" для QSR. Подтверждает foot traffic как сильнейший single predictor.
2. **Choi et al. (2019)** — "To cluster or not to cluster? Understanding geographic clustering by restaurant segment", *International Journal of Hospitality Management*. На 30,000+ ресторанах: QSR benefit from diffusing, casual dining from clustering.
3. **ScienceDirect (2022)** — "Streetscape and business survival", *Journal of Transport Geography*. Рестораны более чувствительны к walkability, чем другие бизнесы.
4. **Active Living Research (2013)** — "Business Performance in Walkable Shopping Areas". Pedestrian improvements → +30% sales.
5. **QSR Magazine (2025)** — Annual Drive-Thru Report. Drive-thru = 50-70% revenue у top QSR brands.
6. **Coldwell Banker Commercial** — "Mastering Site Selection: Top 7 Key Factors for QSR". High foot traffic = фактор #1.
7. **Kalibrate** — "Guide to Site Selection". Traffic counts = "very important" для QSR, coffee, convenience.
8. **National Restaurant Association** — 60% новых ресторанов закрываются в первый год.
9. **NBC News / Restaurant Business (2024)** — Weekday lunch transactions down 3.3% vs 2019 из-за hybrid work.
10. **NRN (National Restaurant News)** — Демография частых посетителей QSR: 28% с доходом >$150K.

#### Известные ограничения модели

**1. Redundancy сигналов.** Footfall, Pedestrian и Workforce измеряют разные аспекты одного явления (urbanness / activity concentration). В top-20 станциях footfall и pedestrian коррелируют на ~100%. Это означает, что effective weight footfall ≈ 32%, а не 25%. Confidence multiplier (+5% за каждый сигнал) over-rewards эту redundancy.

**2. Density signal — inverted behavior.** Сигнал fires когда QSR рядом мало. Но топ-10 станций (Liverpool Street: 98M pax, 11 QSR) имеют высокую плотность — сигнал для них НЕ fires. Высокая плотность = validated market. Сигнал правильно работает для underserved corridors, но наказывает proven markets.

**3. Geographic bias.** 75% top opportunities — London. Workforce сигнал покрывает только England/Wales (Census 2021 WP001). Demographic сигнал теперь покрывает все 12 регионов UK (IMD + WIMD + SIMD + NIMDM), но income deciles нормализованы UK-wide — нет region-relative normalization: Liverpool Street (99-й перцентиль в London) и Manchester Piccadilly (99-й перцентиль в North West) сравниваются напрямую, хотя масштабы разные.

**4. Нет outcome validation.** Веса основаны на research + expert judgment, не на regression "рекомендация → открытие → успех". Для regression нужны данные о реальных открытиях — это следующий этап.

**5. Demo fit в деловых кварталах.** IMD income decile измеряет доход *жителей*, а не дневной толпы. В City of London 8,600 жителей, но 89,000 workers — lunch crowd приезжает из районов с decile от 2 до 10. Для станций с 50K+ workplace population в 1.5km вместо residential income decile используется **SIC-weighted estimated worker salary** (BRES employment × ASHE median pay). Это даёт data-driven оценку lunch crowd вместо нерелевантных residential данных. 62 станции попадают под эту коррекцию. Ограничение: ASHE median pay — национальные цифры (не региональные), поэтому диапазон сжат (£23K–£35K вместо реальных ~£18K–£55K).

#### Changelog модели

| Дата | Изменение | Причина | Влияние |
|------|-----------|---------|---------|
| 2026-03-25 | Footfall: линейная шкала с cap 20M → log-шкала `(log(entries) - log(1M)) / (log(max) - log(1M))` | 22 станции >20M получали одинаковый score=100, теряя 5x разницу в трафике. Распределение крайне неравномерное (медиана 290K, max 98M) — log лучше передаёт magnitude | Топ-станции получили дифференцированные scores: Liverpool Street 100, Victoria 87, Bond Street 82, Clapham Junction 70. Средние станции (~8M) незначительно выросли (+5) |
| 2026-03-25 | Demo fit: SIC-weighted worker salary для деловых кварталов (50K+ workers) вместо neutral 0.5 | Residential income decile не отражает lunch crowd в business districts. Добавлены 2 новых источника: BRES (employment by SIC, NOMIS) + ASHE (median pay by SIC, ONS). Pipeline: station → nearest LA → BRES SIC profile × ASHE pay → estimated salary | 62 бизнес-станции получают data-driven demo fit вместо neutral. Liverpool Street (finance-heavy, £35K) = strong fit для Nando's. Hospitality-heavy районы = better fit для KFC. Новое поле `estWorkerSalary` в station-data.ts (2,318 из 2,361 станций) |
| 2026-03-25 | Demo fit: UK-wide deprivation — 4 национальных индекса (IMD + WIMD + SIMD + NIMDM) вместо England-only IMD | Wales, Scotland, N.Ireland были белыми на карте, demo fit = `fired: false` для всех станций этих наций. Combo A+C нормализация: income rate → UK-wide percentile → decile (Variant C для scoring), nation-specific composite → 0-100 (Variant A для карты) | 12 регионов вместо 9, 43,535 микрорайонов. Wales decile=5, Scotland decile=8, NI decile=7. Станции в Scotland/Wales/NI теперь получают demographic signal. Карта заполнена без пробелов |

#### Как мы это позиционируем

> "Мы не утверждаем, что модель идеальна. Мы показываем, что **8 независимых источников данных** — государственные (ORR, NaPTAN, DfT, IMD, Census, BRES, ASHE) и коммерческие (Getplace) — **сходятся на одной локации**. Каждый сигнал имеет обоснование из индустриальных исследований. А breakdown по сигналам позволяет клиенту самому решить, какой фактор для его бренда важнее. Это не оракул — это intelligence framework."

| Тип инсайта | Приоритет | Когда срабатывает | Пример |
|-------------|-----------|-------------------|--------|
| `convergent-opportunity` | 1-2 | 2+ сигнала совпали для конкретного бренда | "Nandos at London Liverpool Street: 2 signals align (high-footfall + high-pedestrian), score 95/100" |
| `multi-signal-dead-zone` | 1 | Регион: 3+ underserved станций + low density + decent demographics | "South East: convergent underservice — 101 underserved stations, income decile 7" |

---

## Интеграция в существующую систему

### Расширенные типы (agent-engine.ts)

```typescript
// Добавлены к существующим
type AgentId = ... | "human-flow" | "market-fit" | "opportunity-engine"

type HumanFlowInsightType = "high-station-traffic-low-qsr" | "station-brand-gap" | "underserved-corridor"
type MarketFitInsightType = "affluence-brand-mismatch" | "demographic-expansion-signal"
type OpportunityEngineInsightType = "convergent-opportunity" | "multi-signal-dead-zone"
```

### Регистрация агентов

3 новых записи в `AGENT_DEFINITIONS` (agent-engine.ts). Все `static: true` — запускаются один раз при монтировании.

### Hook (useAgents.ts)

- `AGENT_IDS` расширен с 4 до 7
- `MAX_INSIGHTS` увеличен с 50 до 70
- Логика запуска не изменена — хук уже обрабатывал static agents обобщённо

### UI (AgentsTab.tsx)

- 3 новые иконки: Activity (amber), Users (cyan), Target (rose)
- 3 новых цвета в `AGENT_COLORS`

### Landing page

- Hero: "Find your next 50 locations before competitors do" (insights-first messaging)
- Features: benefit-focused titles ("See where competitors win", "7 AI agents working for you", "Never miss a competitive move")
- `LANDING_AGENTS`: 7 карточек с example insights
- "See the Platform" и "Try Explorer" ведут на `/explorer#opportunities` (Insights view)

### Карта (MapView.tsx) — toggleable data layers

Три overlay-слоя, каждый — отдельный `useEffect` в MapView, читает `mapRef.current` напрямую:

**1. Station analysis** (merged footfall + opportunity score)
- Размер маркера = passenger volume (3–12px, пропорционально annualEntries)
- Цвет = opportunity confidence: зелёный (high), оранжевый (medium), серый (low), светло-серый (not scored)
- Popup объединяет: footfall + QSR count + bus stops + brand presence/absence + opportunity score badge + 7-signal breakdown (если есть scoring data)
- Toggle в sidebar: секция "Stations & Opportunities" → "Station analysis"

**2. Road traffic flow** (heatmap + drive-thru markers)
- Heatmap всех точек + отдельные CircleMarkers для drive-thru opportunities (AADF ≥50K, <2 drive-thru)
- Sub-filter: "High-traffic roads only (50k+ vehicles/day)"
- Toggle в sidebar: секция "Road Traffic"

**3. Demographic overlays** (Income level / Deprivation index)
- Перекрашивают все 12 UK region polygons по income decile или composite deprivation score
- `imdColor` вычисляет min/max динамически из `REGION_DEMOGRAPHICS` (адаптируется к данным)
- Tooltip показывает source per nation: "1,917 LSOAs (WIMD 2025)", "6,973 Data Zones (SIMD 2020)"
- Hover сохраняет демографический цвет (через `demoActiveStylesRef`)
- Взаимоисключающие — включение одного выключает другой
- Toggle в sidebar: секция "Demographics"

**Sidebar structure:** Brand Groups → Brands → Data Layers → Map Style → Country Summary

**Нет жаргона:** "Choropleth" → "Regions", "AADF" → "vehicles/day", "IMD" → "Deprivation index", "Per 100k pop." → "Per 100k people"

**Default view:** Insights (opportunities), не Map. Landing page links тоже ведут на `#opportunities`.

---

## Сценарии использования

### Сценарий 1: Поиск локации для нового ресторана

**Роль:** Expansion Manager ресторанной сети (например, Nando's)

**Задача:** Найти лучшие локации для открытия новых точек в Англии.

**Действия:**
1. Открыть Explorer → default view Insights → видит топ-станции с opportunity scores
2. Видит: *"Nandos at London Liverpool Street: 2 signals (high-footfall + high-pedestrian), score 95/100. 98M passengers/year, 11 QSR ~13 min walk"*
3. Переключается на Map → включает слой "Station analysis" → зумит к Liverpool Street → кликает на маркер
4. Popup показывает: opportunity score 95, 98M пассажиров, 11 QSR рядом, 234 bus stops (high pedestrian area), 7-signal breakdown, Nandos отсутствует но McDonald's, KFC и Subway есть
5. **Вывод:** Спрос доказан (конкуренты уже стоят), трафик огромный, район оживлённый — но Nandos нет. Это приоритетная локация.

**Ценность:** Expansion Manager видит только свои точки. Getplace показывает ему данные всех конкурентов + внешний трафик + пешеходную активность, и сам подсвечивает лучшие возможности.

### Сценарий 2: Анализ конкурентного ландшафта региона

**Роль:** Strategy & Analytics Director

**Задача:** Понять, почему бренд отстаёт в конкретном регионе.

**Действия:**
1. Agents tab → Market Fit Analyst показывает: *"Nandos (premium brand) has 37% fewer locations per capita in East Midlands — despite income decile 6"*
2. Открывает карту → выбирает East Midlands → drill-down по регионам
3. Видит: Nandos 42 точки, McDonald's 120, KFC 85. Доля Nandos 10% vs 15% nationally
4. Включает слой "Station analysis" → видит серые/оранжевые маркеры (low/medium opportunity) в Nottingham, Leicester, Derby
5. **Вывод:** East Midlands — состоятельный регион (income decile 6), но Nandos недопредставлен на 37%. Конкуренты уже там. Это аномалия — нужно наращивать присутствие.

**Ценность:** Стратег знает свои цифры, но не видит, как они соотносятся с демографией и конкурентами. Getplace показывает разрыв между потенциалом региона и текущим присутствием бренда.

### Сценарий 3: Оценка потенциала транзитных хабов

**Роль:** Real Estate Team

**Задача:** Оценить, на каких станциях стоит искать помещения.

**Действия:**
1. Agents tab → Human Flow Analyst: *"Canada Water: 18.7M passengers/year but only 1 QSR ~13 min walk"*
2. Включает "Station analysis" + Display: Both (рестораны + станции)
3. Зумит к Canada Water → видит: крупный зелёный маркер (high opportunity, 18.7M трафик), почти нет ресторанных точек рядом
4. Кликает popup: opportunity score, 18.7M пассажиров, 1 QSR, bus stops: 45 (high pedestrian), 7-signal breakdown, Missing: McDonalds, Dominos, KFC, Nandos, PapaJohns
5. Сравнивает с соседними станциями (London Bridge — 115M, 25 QSR, зелёный маркер)
6. **Вывод:** Canada Water — "пустая" станция с огромным трафиком. Почти весь QSR сосредоточен на London Bridge. Это gap — 18.7M человек проходят мимо, а кормить их нечем.

**Ценность:** Real Estate team обычно ищет помещения по цене/размеру. Getplace добавляет слой "где люди" — можно не тратить время на районы с красивым помещением, но без трафика.

### Сценарий 4: Подготовка к встрече с потенциальным клиентом

**Роль:** Sales Manager Getplace

**Задача:** Подготовить персонализированный pitch для ресторанной сети Subway.

**Действия:**
1. Открывает Explorer → выбирает только Subway в Brands
2. Agents tab → фильтрует инсайты по Subway:
   - Human Flow: *"London Liverpool Street (98M) has McDonalds, KFC, Nandos — but zero Subway"*. Wait, Subway IS there. Let me check another: *"London Waterloo (70.4M) has Subway, McDonalds, KFC, Nandos — but zero Dominos"*
   - Market Fit: *"Subway (value brand) has 21% fewer locations per capita in London than national average"*
   - Opportunity Engine: Convergent opportunities для Subway
3. Делает скриншоты карты со слоем Station analysis — зелёные/оранжевые opportunity маркеры рядом с Subway-точками
4. В LinkedIn-сообщении: "Заметил, что у Subway на 21% меньше точек на душу населения в Лондоне, чем в среднем по UK — при том что трафик в лондонских станциях огромный. Можем показать 5 конкретных локаций с score 85+."

**Ценность:** Персонализированный outreach на основе реальных данных, а не generic pitch. Потенциальный клиент видит, что Getplace знает его бизнес лучше, чем он сам.

### Сценарий 5: Мониторинг пешеходной активности районов

**Роль:** Regional Manager

**Задача:** Понять, какие районы вокруг его точек наиболее "живые", и где стоит усилить маркетинг.

**Действия:**
1. Включает Display: Both + Station footfall overlay
2. Зумит к своему городу (например, Manchester)
3. Видит: Manchester Piccadilly — зелёный маркер (206 bus stops, 27.4M пассажиров, 9 QSR). Manchester Victoria — красный (234 bus stops, 8.4M, мало QSR)
4. Popup для Victoria: *"234 bus stops nearby — high pedestrian area"*, но QSR мало
5. **Вывод:** Victoria — район с очень высокой пешеходной активностью (234 автобусных остановки!), но ресторанов недостаточно. Если у бренда есть точка рядом — это сигнал для delivery/промо push. Если нет — это возможность для открытия.

**Ценность:** Regional Manager обычно оценивает свои точки по выручке. Bus stop density показывает потенциал района "снаружи" — может, низкая выручка не из-за плохой локации, а из-за недостаточного маркетинга в оживлённом районе.

### Сценарий 6: Демо CEO (Денис) — как рождается инсайт

**Роль:** Product demo для Getplace CEO

**Задача:** Показать путь от данных к ценному инсайту.

**Действия:**
1. "У нас есть данные 21K ресторанов 6 брендов. Одних — компания может получить сама."
2. "Мы добавили 3 внешних источника: 2,587 станций с трафиком, 371K автобусных остановок, демографию 33K микрорайонов."
3. Открывает карту → включает Station footfall → показывает красные точки
4. "Вот Canada Water — 18.7M пассажиров в год, 45 автобусных остановок (оживлённый район), но только 1 QSR в 13 минутах пешком."
5. Открывает Agents → Opportunity Engine: "Nandos at Liverpool Street: score 95/100, 2 signals: high-footfall + high-pedestrian"
6. "Subway не видит данные Nandos. Nandos не видит данные станций. Мы видим и то, и другое — и находим, что Nandos нужно стоять у Liverpool Street. Вот за это платят."

**Ценность:** Демонстрирует core value proposition: инсайты на пересечении данных, которые ни один отдельный источник не даёт.

---

## Как пользоваться

### Для аналитика (пошаговый гайд)

1. Открыть `http://localhost:8083/explorer`
2. В сайдбаре → **Display** → "Both" (показать и регионы, и точки ресторанов)
3. В сайдбаре → **Overlays** → "🚉 Station footfall" (включить слой станций)
4. Зумить к нужному городу — видны красные/оранжевые/зелёные маркеры станций
5. Кликнуть на маркер станции → popup:
   - Пассажиры/год
   - Кол-во QSR ~13 min walk
   - Плотность автобусных остановок (high/moderate/low pedestrian area)
   - Какие бренды ✓ есть и ✗ отсутствуют
6. Колокольчик (вверху справа) → **Agents** tab → 7 агентов с инсайтами
7. **Events** tab → полная лента из ~46 инсайтов от всех агентов

### Для разработчика

#### Обновление данных

Данные обновляются запуском ETL-скриптов. Требуется Python 3 с shapely, pandas, numpy.

```bash
# 1. Скачать свежие данные
bash scripts/download-external-data.sh

# 2. Перегенерировать TypeScript файлы
python3 scripts/convert-stations.py
python3 scripts/convert-bus-density.py
python3 scripts/convert-traffic.py
python3 scripts/convert-demographics.py
python3 scripts/convert-workplace-pop.py

# 3. Пересобрать приложение
npm run build
```

#### Добавление нового источника данных

1. Создать `scripts/convert-<name>.py` по образцу `convert-stations.py`
2. Использовать `point_to_region()` для привязки к 12 UK-регионам
3. Генерировать `src/data/<name>-data.ts` с readonly interface
4. Импортировать в соответствующем агенте

#### Настройка порогов

Пороги срабатывания инсайтов — константы в начале каждого файла агента:

```typescript
// human-flow-agent.ts
const HIGH_STATION_TRAFFIC = 5_000_000  // понизить → больше инсайтов
const LOW_QSR_NEAR_STATION = 8          // повысить → больше инсайтов

// market-fit-agent.ts
const MISMATCH_THRESHOLD = 0.20         // 20% отклонение от нормы

// opportunity-engine-agent.ts
const MIN_SIGNALS = 2                   // минимум совпадающих сигналов
```

---

## Известные ограничения

| Ограничение | Влияние | Как решить |
|-------------|---------|-----------|
| NIMDM 2017 устарел (данные 2015/16) | N.Ireland demographic insights менее актуальны | Мониторить обновление NIMDM от NISRA |
| Census 2021 WP001 — snapshot 2021 | Post-COVID remote work мог изменить паттерны | Мониторить Census 2031 или использовать ONS Business Register (IDBR) как дополнение |
| Бренд-income аффинити — эвристика | Может не соответствовать реальному позиционированию | Валидировать с клиентами, заменить на data-driven classification |
| Timeline не влияет на новых агентов | Станции/демография статичны | Годовые snapshot-ы ORR данных → temporal station insights |
| 2 станции не сджойнены с NaPTAN | 0.08% потерь | Ручные коррекции для оставшихся edge cases |
| Walk time — приближение | Circuity factor 1.35 ±10% | Google Routes API для точных isochrones |
| Bus stop density — proxy | Не прямое измерение пешеходного трафика | Дополнить council footfall counters где доступны |

---

## Структура файлов

```
scripts/
  download-external-data.sh       # Загрузка всех датасетов
  convert-stations.py             # ORR + NaPTAN → station-data.ts (fuzzy match 99.92%)
  convert-bus-density.py          # NaPTAN bus stops → обогащает station-data.ts
  convert-traffic.py              # DfT AADF → traffic-data.ts
  convert-demographics.py         # IMD + WIMD + SIMD + NIMDM → demographic-data.ts (12 регионов)
  convert-workplace-pop.py        # Census 2021 WP001 → обогащает station-data.ts

src/data/
  station-data.ts                 # 2,361 станция с QSR proximity + bus stop density + workplace population
  traffic-data.ts                 # 5,000 точек дорожного трафика
  demographic-data.ts             # 12 регионов с демографией (IMD + WIMD + SIMD + NIMDM)
  Data for assignment/external/   # Сырые CSV файлы (не в git)

src/lib/
  geo-utils.ts                    # Haversine + proximity utilities
  human-flow-agent.ts             # Агент: где люди?
  market-fit-agent.ts             # Агент: кто люди?
  opportunity-engine-agent.ts     # Агент: где открываться? (5 сигналов)

Модифицированные файлы:
  src/lib/agent-engine.ts         # +3 AgentId, +InsightType unions, +3 AGENT_DEFINITIONS
  src/hooks/useAgents.ts          # +3 AGENT_IDS, MAX_INSIGHTS 50→70
  src/components/explorer/AgentsTab.tsx      # +3 иконки, +3 цвета
  src/components/explorer/MapView.tsx        # +station overlay с popup (walk time + bus density)
  src/components/explorer/Sidebar.tsx        # +Overlays toggle
  src/pages/Explorer.tsx                     # +showStations state
  src/components/landing/Hero.tsx            # "Seven intelligent agents"
  src/components/landing/Features.tsx        # Updated agent description
  src/components/landing/landing-constants.ts # +3 LANDING_AGENTS
```

---

## Ключевая мысль

Ресторанная сеть может посмотреть на карту своих точек. Но она **не может** наложить данные конкурентов + пассажиропоток + автобусные остановки + демографию и увидеть: "У вас 0 точек рядом с Liverpool Street (98M пассажиров/год, 234 автобусных остановки — high pedestrian area), а McDonald's и KFC уже стоят — спрос доказан, ваша аудитория соответствует, Score: 95/100."

Этот инсайт невозможен из одного источника данных. Его создаёт **пересечение шести**: данные конкурентов (Getplace), пассажирский трафик (ORR), пешеходная активность (NaPTAN bus stops), дорожный трафик (DfT), демография (UK Deprivation Indices — IMD/WIMD/SIMD/NIMDM), дневное рабочее население (Census 2021). Именно это Getplace может продавать.
