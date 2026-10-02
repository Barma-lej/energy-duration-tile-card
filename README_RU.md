# Energy Duration Tile Card

Кастомная карточка для **Home Assistant**, объединяющая дизайн штатной **Tile Card** (Material 3) с интерактивным выбором дат через **`energy-date-selection`**. [deepwiki](https://deepwiki.com/home-assistant/home-assistant.io/12.3-energy-dashboard)

Карточка динамически пересчитывает долгосрочную статистику (`recorder/statistics_during_period`) за выбранный в пикере период (день, месяц, год или произвольный диапазон) и выводит данные с нативным форматированием Home Assistant: сенсоры времени отображаются в виде «41 ч 8 мин», энергии — в «кВт⋅ч», а также поддерживается автоматическое объединение с сенсором затрат и Jinja2-шаблоны .

***

## Возможности

- **100% нативный интерфейс Tile Card**: поддержка всех штатных опций (`vertical`, `color`, `icon`, `tap_action`, `features`, стилей оформления темы).
- **Связка с `energy-date-selection`**: мгновенная реакция на переключение периода с поддержкой `collection_key` для нескольких панелей.
- **Нативное форматирование**:
  - Сенсоры длительности (`device_class: duration` или единицы `s`, `min`, `h`) → «41 ч 8 мин» .
  - Сенсоры энергии (`kWh`, `Wh`) → «2 515,69 кВт⋅ч» с учетом локали .
- **Автоматический вывод затрат (`cost_entity`)**: при указании сенсора затрат карточка сама объединяет расход и деньги (`2 515,69 kWh · 638,76 €`).
- **Поддержка Jinja2-шаблонов (`template`)**: возможность тонкой настройки строки состояния с передачей переменных `value`, `cost`, `duration`, `formatted_cost` .
- **Точность до сотых**: алгоритм учитывает незавершенный текущий час из `live state`, исключая погрешности агрегации .
- **Полноценный визуальный редактор (UI Editor)**: настройка через графический интерфейс Lovelace с автодополнением сущностей .

***

## Установка

### Способ 1. Установка через HACS (Пользовательский репозиторий)

1. Откройте **HACS** в боковом меню Home Assistant.
2. В правом верхнем углу нажмите на три точки `⋮` → **Пользовательские репозитории** (*Custom repositories*).
3. Добавьте URL вашего репозитория:
   - **URL**: `https://github.com/Barma-lej/energy-duration-tile-card` (или ссылка на ваш форк)
   - **Тип**: `Lovelace` (или `Dashboard`)
4. Нажмите **Добавить** (*Add*), найдите карточку в списке и нажмите **Загрузить** (*Download*).
5. Перезагрузите страницу браузера (`Ctrl + F5`).

***

### Способ 2. Ручная установка

1. Скачайте файл `energy-duration-tile-card.js`.
2. Поместите его в директорию `www` вашей конфигурации Home Assistant:
   ```text
   /config/www/energy-duration-tile-card.js
   ```
3. Откройте Home Assistant: **Настройки** → **Панели управления** → нажмите три точки `⋮` в правом верхнем углу → **Ресурсы**.
4. Нажмите **+ Добавить ресурс**:
   - **URL**: `/local/energy-duration-tile-card.js`
   - **Тип ресурса**: `Модуль JavaScript`
5. Сохраните и выполните жесткую перезагрузку страницы (`Ctrl + F5` / `Cmd + Shift + R`).

***

## Параметры конфигурации

| Параметр | Тип | Обязательный | По умолчанию | Описание |
| :--- | :--- | :--- | :--- | :--- |
| `type` | `string` | **Да** | — | Должно быть `custom:energy-duration-tile-card` |
| `entity` | `string` | **Да** | — | Основной сенсор (время работы, потребление энергии, объем и т.д.) |
| `cost_entity` | `string` | Нет | — | Сенсор затрат (денежный эквивалент расхода) |
| `stat_type` | `string` | Нет | `change` | Тип статистики: `change` (разница/расход), `sum` (накопительное), `mean` (среднее)  |
| `collection_key` | `string` | Нет | авто | Имя коллекции для синхронизации с `energy-date-selection`  |
| `template` | `string` | Нет | — | Jinja2-шаблон для кастомного отображения строки состояния  |
| `name` | `string` | Нет | Имя сенсора | Заголовок карточки |
| `icon` | `string` | Нет | Иконка сенсора | Кастомная иконка `mdi:...` |
| `color` | `string` | Нет | — | Цвет бейджа иконки (например, `blue`, `amber`, `teal`) |
| `vertical` | `boolean` | Нет | `false` | Вертикальное расположение иконки и текста |
| `tap_action` | `object` | Нет | `more-info` | Действие при клике на плитку  |

***

## Примеры использования

### 1. Время работы зоны полива (длительность)

Привязка ко времени полива за выбранный в пикере период. Значение автоматически выводится в формате `41 ч 8 мин`:

```yaml
type: energy-date-selection

type: custom:energy-duration-tile-card
entity: sensor.irrigation_watering_duration_zone1_yearly
name: Hinterhof
icon: mdi:sprinkler-variant
color: light-blue
stat_type: change
```

***

### 2. Расход энергии + Затраты (Автоматическое объединение)

Если указан `cost_entity` и не задан `template`, карточка автоматически объединит расход и затраты через разделитель `·`:

```yaml
type: energy-date-selection
collection_key: energy_consumption

type: custom:energy-duration-tile-card
entity: sensor.haus_energy_t
cost_entity: sensor.haus_energy_t_cost
collection_key: energy_consumption
name: Потребление дома
stat_type: change
vertical: false
grid_options:
  columns: full
```
**Результат:** `2 515,69 kWh · 638,76 €`

***

### 3. Расчёт стоимости через фиксированный тариф (Template)

Если отдельного сенсора затрат нет, можно посчитать стоимость на лету, умножив число расхода (`value`) на значение тарифа:

```yaml
type: custom:energy-duration-tile-card
entity: sensor.irrigation_watering_duration_zone2_yearly
name: Полив газона
stat_type: change
template: >-
  {% set tariff = states('input_number.water_tariff_hourly') | float(1.80) %}
  {{ duration }} · {{ (value * tariff) | round(2) }} €
```
**Результат:** `41 ч 8 мин · 74.04 €`

***

### 4. Динамический расчёт объёма воды в литрах

При известной производительности форсунок (например, 15 л/мин) можно вывести общее количество вылитой воды:

```yaml
type: custom:energy-duration-tile-card
entity: sensor.irrigation_watering_duration_zone2_yearly
name: Расход воды
template: "{{ duration }} ({{ (value * 60 * 15) | round }} л)"
```
**Результат:** `41 ч 8 мин (37020 л)`

***

## Переменные шаблона (`template`)

В Jinja2-шаблоне доступны следующие контекстные переменные :

| Переменная | Тип | Описание | Пример значения |
| :--- | :--- | :--- | :--- |
| `value` | `float` | Числовое значение за период | `2515.69` или `41.13` |
| `duration` | `string` | Нативно отформатированное состояние основной сущности | `"2 515,69 kWh"` или `"41 ч 8 мин"`  |
| `formatted_state` | `string` | Синоним для `duration` | `"2 515,69 kWh"` |
| `cost` | `float` | Числовое значение затрат из `cost_entity` | `638.76` |
| `formatted_cost` | `string` | Нативно отформатированное состояние сенсора затрат | `"638,76 €"` |
| `entity` | `string` | ID основного сенсора | `"sensor.haus_energy_t"` |
| `cost_entity` | `string` | ID сенсора затрат | `"sensor.haus_energy_t_cost"` |

Также доступны все стандартные функции и фильтры Home Assistant: `states()`, `is_state()`, `float`, `round`, `now()` и другие .
