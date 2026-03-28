# Insights Engine для экспансии ресторанных сетей

**8 источников данных**

6 630 scored opportunities — 517 станций + 5 000 перекрёстков + 1 113 зон. Каждая с прозрачным разбором сигналов, cited evidence и AI-рекомендацией.

---

## Три инсайта, которые невозможно получить вручную

| Локация | Факт | Что видит бренд | Что видит Getplace |
|---------|------|-----------------|-------------------|
| Custom House, London | 9.8M пассажиров/год | «Станция DLR где-то на востоке» | Score 75: 5 брендов отсутствуют, 48 bus stops, A13 — 109K авто/день. Один Subway на 9.8M человек |
| M25 у Heathrow | 210K авто/день | «Загруженная дорога» | Score 94: ноль drive-thru в 1.5 км. 210K машин проезжают мимо пустоты |
| City of London | 88 923 работника | «Бизнес-район» | Score 82: 89K обедают, 8.6K живут. Рестораны смотрят на жителей — и не видят 10× спроса |

Три инсайта, каждый создан на пересечении 5–8 государственных датасетов (пассажиропоток, автотрафик, демография, рабочее население, автобусные остановки, локации конкурентов). 
---

## Кейс: «Drive-thru» — M25 и M60

### Проблема

Drive-thru — самый быстрорастущий сегмент QSR (7,2% CAGR). В US drive-thru генерирует 50%+ выручки; в UK тренд активно растёт. Greggs открыл 207 новых точек в 2025 году, KFC планирует 500 новых к 2034, Popeyes открывает ~1 ресторан в неделю. 

### Что нашла система

На самых загруженных дорогах UK практически нет drive-thru:

| Дорога | Трафик (авто/день) | Drive-thru в 1.5км | QSR в 1.5км | Score |
|--------|-------------------|-------------------|-------------|-------|
| M25 (Heathrow) | 210 436 | 0 | 1 | 94 |
| M60 (Manchester) | 192 025 | 0 | 0 | 90 |
| M25 (Hertfordshire) | 185 136 | 0 | 0 | 90 |
| M1 (Luton) | 179 502 | 0 | 0 | 89 |
| M42 (West Midlands) | 167 419 | 0 | 0 | 89 |
| M62 (Yorkshire) | 165 097 | 0 | 0 | 88 |
| M6 (West Midlands) | 172 000 | 0 | 0 | 88 |

Из 5 000 высокотрафиковых сегментов дорог: **3 095 (62%) имеют ноль drive-thru в 1.5км.** 149 сегментов набрали ≥80 баллов — это first-mover corridor opportunities.

Этот инсайт невозможен без пересечения DfT AADF (дорожный трафик) + Getplace (drive-thru локации). DfT публикует трафик, но никто не cross-reference-ил с локациями drive-thru. Первый бренд, занявший эти точки, получает first-mover advantage на 3–5 лет.

### Demand Evidence — 5 источников

| Demand Evidence | Источник |
|----------------|----------|
| M25 у Heathrow: 210 436 авто/день | GOV  DfT AADF 2024 |
| 0 drive-thru в 1.5км от топ-перекрёстка | GP  Getplace |
| 3 095 из 5 000 сегментов (62%) — ноль drive-thru | CROSS  DfT × Getplace |
| Drive-thru — самый быстрорастущий формат QSR (7,2% CAGR) | Industry  QSR Magazine |
| Greggs: 207 новых в 2025, KFC: 500 план к 2034 | Industry  Company filings |

### Risks & Caveats

| Риск | Тип | Комментарий |
|------|-----|-------------|
| Близость к автомагистрали ≠ удобный съезд | CROSS | Не все высокотрафиковые сегменты имеют удобные развязки/съезды |
| Planning permission для drive-thru | Regulatory | Местные органы могут ограничить строительство drive-thru у магистралей |
| AADF — среднегодовой, сезонность не учтена | Data | Летний/праздничный трафик может отличаться от среднего |

### Deep Dive: M25 South East — Score 94, #1 в рейтинге

Система показывает не только список — а полный deep dive по каждому перекрёстку. M25 у Egham (South East) — перекрёсток #1 с максимальным скором:

| Метрика | Значение | Контекст |
|---------|----------|----------|
| Daily Traffic | 196K авто/день | top 0% nationally |
| Drive-Thru Nearby | 0 | ноль в 1.5км |
| QSR Nearby | 4 | спрос подтверждён |
| Confidence | high | 4 из 4 сигналов |

| Сигнал | Значение | Tier | Детали |
|--------|----------|------|--------|
| Traffic volume | 196K vehicles/day | Very Strong | top 0% — один из самых загруженных в UK |
| Drive-thru gap | 0 в 1.5км | Very Strong | Полностью пустой коридор |
| QSR presence | 4 QSR в 1.5км | Strong | Коммерческий спрос валидирован |
| Demographic fit | Income matches brand | Strong | Уровень дохода соответствует |

4 из 4 сигналов сработали — максимальный confidence bonus. Особенность: 4 QSR уже работают рядом (sit-down формат), но ни одного drive-thru. Спрос подтверждён наличием конкурентов — но формат drive-thru не занят.

![Рис. 2. Junction Deep Dive: M25 score 94, 4 сигнала, Demand Evidence + Risks](../screenshots/m25-junction-deep-dive.png)

![Рис. 3. Road Traffic Flow: тепловая карта AADF + diamond-маркеры drive-thru возможностей](../screenshots/m25-traffic-heatmap.png)

![Рис. 4. M25 со всеми слоями: Road Traffic + People Density + Station Analysis + Zone Opportunities](../screenshots/m25-all-layers.png)

---

## Кейс: 9.8 миллионов пассажиров, один Subway

Custom House — станция DLR/Elizabeth Line рядом с ExCeL London. 9.8M пассажиров в год (top 10% nationally). При этом всего 1 QSR в радиусе 800м (Subway). Ни McDonald's, ни KFC, ни Domino's, ни Nando's, ни Papa John's.

Score: 75/100, 7 из 7 сигналов сработали — одна из немногих станций в UK с полным набором сигналов (confidence bonus +25%):

| Сигнал | Значение | Tier | Детали |
|--------|----------|------|--------|
| Footfall | 9.8M pax/yr | Moderate | Top 10% nationally |
| Brand Gap | 5 gaps | Strong | KFC absent, 1 competitor within 800m |
| Demo Fit | Decile 2 | Very Strong | Value brand match |
| Low Density | 1 QSR | Moderate | 1 QSR vs avg 3 |
| Pedestrian | 48 bus stops | Moderate | Top 38% |
| Road Traffic | A13 — 109K/day | Strong | 1 drive-thru nearby |
| Workforce | 26K workers | Strong | Business district |

### AI-рекомендация

> *"The convergence of DLR/Elizabeth line rail access, the A13 at 109K vehicles/day, and proximity to ExCeL London creates a unique multi-modal demand profile with only 1 QSR currently serving 9.8M annual passengers."*
> — AI Recommendation

> *"Demand is partially event-driven via ExCeL London, so model revenue with and without major exhibitions to ensure the base case (9.8M rail passengers plus A13 road traffic) supports the unit independently. The ongoing Royal Docks development pipeline will increase the permanent residential and worker population over the next 3–5 years."*
> — AI Risk Warning

### Demand Evidence (5 источников, каждый проверяемый)

Система приводит доказательства спроса с указанием конкретного государственного источника для каждого факта:

| Demand Evidence | Источник |
|----------------|----------|
| 9.8M passengers/year — top 10% nationally | GOV  ORR Station Usage 2024-25 |
| 48 bus stops within 800m — top 38% for pedestrian activity | GOV  NaPTAN |
| A13 nearby — 109K vehicles/day, 1113m away | GOV  DfT AADF |
| 1 QSR competitor already present — validates commercial demand | GP  Getplace |
| 26K workers within 1.5km — business district with strong lunchtime demand | GOV  Census 2021 WP001 |

Каждый факт помечен GOV (государственный источник) или GP (Getplace). 

### Risks & Caveats

| Риск | Тип | Комментарий |
|------|-----|-------------|
| Спрос частично event-driven (ExCeL London) | CROSS | Моделировать выручку без выставок |
| London локация — premium rental costs | CROSS | Учесть в финмодели |

**Data completeness: 100%** (7 из 7 сигналов сработали, все источники доступны). 

### Потенциальная выручка

При конверсии 0.5% из 9.8M пассажиров и среднем чеке £14 — **~£686K/год**. Бренды в 800м: Subway (присутствует, 1), KFC (gap), PapaJohns (gap), McDonalds (gap), Dominos (gap), Nandos (gap) — 5 из 6 брендов отсутствуют.

![Рис. 5. Station Deep Dive: score 75, 4 KPI, 7 сигналов с tier-метками, brand gaps (5 из 6)](../screenshots/custom-house-deep-dive.png)

![Рис. 6. Smart Map: Custom House с 800м, People Density + Station Analysis + Zone Opportunities](../screenshots/custom-house-smart-map.png)

![Рис. 7. Satellite view: ExCeL London, Royal Victoria Dock, A13 — географический контекст](../screenshots/custom-house-satellite.png)

---

## Кейс: 89 000 обедают, 8 600 живут

Зоны с обеденным трафиком:

| Зона | Работники | Жители | Ratio | Ближайшая станция |
|------|-----------|--------|-------|-------------------|
| City of London 001 | 88 923 | ~8 600 | 10.3× | Liverpool Street (98M pax) |
| Westminster 018 | ~75 000 | ~12 000 | 6.3× | Victoria (54M pax) |
| Tower Hamlets 033 | ~60 000 | ~15 000 | 4.0× | Canary Wharf (16M pax) |

### Но система находит и неочевидные зоны

Zone London #668 район рядом с Wimbledon. 5 000 работников, ни одного QSR в радиусе 1.5км. Зона становится видимой только на пересечении Census WP001 + Getplace QSR + ORR.

Score: 72/100, тип Area opportunity, 4 сигнала, high confidence:

| Метрика | Значение | Источник |
|---------|----------|----------|
| Workplace Pop | 5 000 | Census 2021 WP001 |
| QSR Nearby | 0 (ноль) | Getplace |
| Brand Gaps | 6 из 6 | Getplace |
| Ближайшая станция | Raynes Park, 0.2км | ORR Station Usage 2024-25 |

| Сигнал | Значение | Tier | Детали |
|--------|----------|------|--------|
| Brand gap | 6 из 6 брендов отсутствуют | Very Strong | Ни одного конкурента в 1.5км |
| QSR density gap | 0 QSR в 1.5км | Very Strong | Полностью необслуженная территория |
| Demographic fit | Income matches brand | Strong | Уровень дохода соответствует QSR |
| Workforce | 5K workers | Moderate | Пороговое значение для зоны |
| Footfall proximity | Raynes Park 0.2км | Very Strong | 3M pax/yr в шаговой доступности |

### Demand Evidence (3 источника)

| Demand Evidence | Источник |
|----------------|----------|
| Ноль QSR в радиусе 1.5км — полностью необслуженная зона | GP  Getplace |
| Станция Raynes Park в 0.2км — 3M pax/yr | GOV  ORR Station Usage 2024-25 |
| 5 000 работников в зоне (Census 2021) | GOV  Census 2021 WP001 |

### Risks & Caveats

| Риск | Тип | Комментарий |
|------|-----|-------------|
| Умеренное рабочее население (5K) — может не обеспечить standalone QSR | CROSS | Оценить дополнительный трафик от Raynes Park (3M pax) |
| 6 из 6 брендов отсутствуют — зона может не иметь коммерческой инфраструктуры | CROSS | Проверить наличие коммерческих площадей на месте |

**Пересечение источников:** этот инсайт требует одновременно Census WP001 (рабочее население) + Getplace (QSR локации) + ORR (пассажиропоток станции). Ни один из этих источников по отдельности не показывает эту возможность — только их пересечение создаёт инсайт.

Zone scoring находит **1 113 таких зон по всей UK** — это lunchtime goldmine, который невозможно увидеть из данных о населении (Census residential).

![Рис. 8. Smart Map: Zone London #668 рядом с Wimbledon — 0 QSR в 1.5км, score 72](../screenshots/zone-668-smart-map.png)

![Рис. 9. Zone Deep Dive: 5 сигналов, 6 brand gaps, Raynes Park 0.2км](../screenshots/zone-668-deep-dive.png)

---

## 3 типа возможностей

Три типа точек привязки, каждый со своей моделью, объединённые в один ранжированный список. Все дают скор 0–100 и полностью сопоставимы.

| Тип | Кол-во | Сигналы | Пример инсайта |
|-----|--------|---------|----------------|
| Станции (ж/д) | 517 | 7: пассажиропоток, brand gap, демография, плотность QSR, пешеходы, трафик, рабочие | Custom House: 9.8M pax, 1 QSR, score 75 |
| Перекрёстки (drive-thru) | 5 000 | 4: трафик, drive-thru gap, QSR наличие, демография | M25: 210K авто/день, 0 drive-thru, score 94 |
| Рабочие зоны (MSOA) | 1 113 | 4: рабочее население, QSR gap, демография, близость станции | City of London: 89K работников, 8.6K жителей |

### Система начисляет confidence bonus: +5% за каждый сигнал сверх минимума.

| Сигналов | Confidence | Bonus | Пример | Действие |
|----------|-----------|-------|--------|----------|
| 2 | Low | ×1.00 | Пассажиропоток + brand gap | Мониторить |
| 3 | Medium | ×1.05 (+5%) | + демография | Изучить |
| 4+ | High | ×1.10–1.25 | + пешеходы + трафик + рабочие | Act Now — осмотр площадки |

Custom House набрал 7 из 7 сигналов. Base score 60 × 1.25 bonus = 75/100. **~20% всех opportunities имеют 4+ сигналов** (high confidence) — это локации, которые стоят личного осмотра.

### 8 источников данных, все бесплатные и пригодны для коммерческого использования (под Open Government Licence v3.0).

| Источник | Что даёт | Объём |
|----------|---------|-------|
| ORR (Office of Rail & Road) | Пассажиропоток ж/д станций | 2 361 станция |
| NaPTAN (реестр остановок) | Координаты + плотность автобусных остановок | 434K остановок |
| DfT (Департамент транспорта) | Автомобильный трафик (AADF) | 46K точек → 5K топ |
| Индексы депривации (4 нации) | Уровень благосостояния по микро-зонам | 43 535 микро-зон |
| Census 2021 WP001 | Рабочее население по районам | 7 264 зоны |
| BRES + ASHE | Занятость и зарплаты по отраслям | 348 районов × 19 отраслей |
| Getplace (собственные) | Локации ресторанов 6 брендов | 6 820 точек |

Вычислительный масштаб: 17.6 млн пар «станция–ресторан» + 960 млн пар «станция–автобусная остановка». 
---

### Ограничения 

| Ограничение | Влияние | Решения |
|-------------|---------|-----------|
| Census 2021 (workplace pop) | Remote work изменил паттерны | 6 из 8 источников обновляются ежегодно. BRES provisional 2024 уже доступен |
| Зарплата на уровне LA | Все районы в одном LA = одна зарплата | Более гранулярные данные ASHE |
| Шотландия нет в WP001 | Нет zone scoring | Census Scotland покрытие |
| Brand affinity — эвристика | Premium/value может не совпадать | Валидировать с клиентами |

---

## Технические детали

### Station Scoring: 7 сигналов

| Сигнал | Вес | Порог | Функция |
|--------|-----|-------|---------|
| Footfall | 25% | ≥1M пассажиров/год | Log-scale |
| Brand Gap | 25% | Бренд отсутствует, конкуренты есть | 0.6 + min(QSR/10, 1) × 0.2 |
| Demographic Fit | 15% | Income decile match | Brand affinity матчинг |
| Low Density | 15% | QSR < 75% среднего | Линейная |
| Pedestrian | 8% | ≥30 bus stops в 800м | Линейный ramp |
| Road Traffic | 7% | ≥50K авто/день + <2 drive-thru | Линейная |
| Workforce | 5% | ≥10K работников в 1.5км | Log-scale |

**Формула:** `compositeScore = Σ(weight × strength × 100) × confidence_bonus`

Confidence bonus: `1 + 0.05 × (signal_count – 2)`. Минимум 2 сигнала для включения.

### Ключевые числа

| Метрика | Значение |
|---------|----------|
| Расчётов расстояний (станции×рестораны) | 17.6 млн |
| Расчётов расстояний (станции×bus stops) | 960 млн |
| Junction signal evaluations | ~20 000 (5K точек × 4 сигнала) |
| Zone signal evaluations | ~26 800 (6.7K MSOA × 4 сигнала) |
| Общее покрытие | 6 630 scored opportunities |
| High confidence (4+ сигналов) | ~20% opportunities |
| Act Now (≥80 score) | 149 opportunities |
