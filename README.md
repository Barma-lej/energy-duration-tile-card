# Energy Duration Tile Card

A custom card for **Home Assistant** that combines the native design of the Tile Card (Material 3) with interactive period filtering via `energy-date-selection`. [github](https://github.com/home-assistant/frontend/blob/dev/src/panels/lovelace/cards/hui-tile-card.ts)

The card dynamically queries long-term statistics (`recorder/statistics_during_period`) for the time range chosen in the picker (day, month, year, or custom range) . It renders data using native Home Assistant formatting: duration sensors are displayed as human-readable durations, energy sensors formatted in kWh with locale support, alongside automatic cost aggregation and Jinja2 templating .

***

## Features

- Native Tile Card look and feel: full support for layout options (`vertical`), colors, custom icons, and tap actions .
- Seamless `energy-date-selection` synchronization: instantaneous updates on period change with multi-dashboard `collection_key` support .
- Automatic localization:
  - Duration entities (`device_class: duration` or units `s`, `min`, `h`) render as localized durations .
  - Energy entities (`kWh`, `Wh`) render with standard unit localization .
- Built-in cost pairing (`cost_entity`): automatically combines energy consumption and monetary expense into a single line.
- Jinja2 template support (`template`): full control over the displayed state string using contextual variables .
- Live hour accuracy: accounts for current in-progress hour states to eliminate discrepancies with native cards .
- Visual UI editor: configure entities, keys, and display parameters directly from the dashboard editor .

***

## Installation

### Method 1: HACS (Custom Repository)

1. Open **HACS** in your Home Assistant sidebar.
2. Click the three dots `⋮` in the top-right corner and select **Custom repositories**.
3. Add your repository details:
   - **Repository**: `https://github.com/Barma-lej/energy-duration-tile-card` (or your fork URL)
   - **Type**: `Dashboard` (or `Lovelace`)
4. Click **Add**, find **Energy Duration Tile Card** in the list, and select **Download**.
5. Reload your browser window (`Ctrl + F5`).

### Method 2: Manual Install

1. Download the `energy-duration-tile-card.js` file.
2. Place it into your Home Assistant configuration directory under `www`:
   ```text
   /config/www/energy-duration-tile-card.js
   ```
3. Navigate to **Settings** → **Dashboards** → click the three dots `⋮` in the top right → **Resources**.
4. Click **+ Add Resource**:
   - **URL**: `/local/energy-duration-tile-card.js`
   - **Resource Type**: `JavaScript Module`
5. Save and perform a hard refresh in your browser (`Ctrl + F5` or `Cmd + Shift + R`).

***

## Configuration

| Option | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `type` | string | **Yes** | — | Must be `custom:energy-duration-tile-card` |
| `entity` | string | **Yes** | — | Target entity ID (runtime sensor, energy sensor, volume, etc.) |
| `cost_entity` | string | No | — | Associated monetary cost sensor ID |
| `stat_type` | string | No | `change` | Statistical characteristic: `change`, `sum`, or `mean`  |
| `collection_key` | string | No | auto | Collection key matching your `energy-date-selection` card  |
| `template` | string | No | — | Optional Jinja2 template to override the secondary line  |
| `name` | string | No | Entity friendly name | Overrides card title |
| `icon` | string | No | Entity icon | Custom icon `mdi:...` |
| `color` | string | No | — | Accent color for the icon badge |
| `vertical` | boolean | No | `false` | Enables vertical layout |
| `tap_action` | object | No | `more-info` | Action triggered on click  |

***

## Usage Examples

### 1. Irrigation Zone Runtime (Duration)

Tracking watering duration over the selected period. Formatted automatically as localized hours and minutes:

```yaml
type: energy-date-selection

type: custom:energy-duration-tile-card
entity: sensor.irrigation_watering_duration_zone1_yearly
name: Backyard
icon: mdi:sprinkler-variant
color: light-blue
stat_type: change
```

### 2. Energy Consumption + Cost (Automatic Pairing)

Specifying `cost_entity` without a `template` automatically joins energy and cost:

```yaml
type: energy-date-selection
collection_key: energy_consumption

type: custom:energy-duration-tile-card
entity: sensor.haus_energy_t
cost_entity: sensor.haus_energy_t_cost
collection_key: energy_consumption
name: House Consumption
stat_type: change
vertical: false
grid_options:
  columns: full
```
**Output:** `2 515,69 kWh · 638,76 €`

### 3. Paired Cost Sensor (`cost_entity`) (Template)

When tracking costs with an existing recorder cost sensor:

```yaml
type: custom:energy-duration-tile-card
entity: sensor.haus_energy_t
cost_entity: sensor.haus_energy_t_cost
stat_type: change
template: "{{ duration }} · {{ formatted_cost }}"
```
*(If `template` is left empty, this format is applied automatically).*  
**Output:** `2 515,69 kWh · 638,76 €`

***

### 4. Duration and Cost Side-by-Side (Template)

Displays the native duration string alongside flat-rate computed cost:

```yaml
type: custom:energy-duration-tile-card
entity: sensor.irrigation_watering_duration_zone1_yearly
stat_type: change
template: "{{ duration }} · {{ (value * 1.80) | round(2) }} €"
```
**Output:** `41 h 8 min · 74.04 €`

***

### 5. Tariff Calculation from Dynamic Sensor (Template)

Calculates total expense based on real-time price entities or tariff helpers:

```yaml
type: custom:energy-duration-tile-card
entity: sensor.haus_energy_t
stat_type: change
template: >-
  {% set tariff = states('sensor.electricity_price') | float(0.35) %}
  {{ duration }} · {{ (value * tariff) | round(2) }} €
```
**Output:** `2 515,69 kWh · 880.49 €`

***

### 6. Duration and Water Consumption in Litres / Cubic Metres (Template)

Estimates water usage using irrigation run time (e.g., 15 L/min nozzle flow rate):

```yaml
type: custom:energy-duration-tile-card
entity: sensor.irrigation_watering_duration_zone1_yearly
stat_type: change
template: "{{ duration }} ({{ (minutes * 15) | round }} L)"
```
**Output:** `41 h 8 min (37020 L)`

*For cubic metres (\(m^3\)):*
```yaml
template: "{{ duration }} ({{ ((minutes * 15) / 1000) | round(2) }} m³)"
```
**Output:** `41 h 8 min (37.02 m³)`

***

### 7. Cost Only

Replaces the primary status line completely with calculated monetary value:

```yaml
type: custom:energy-duration-tile-card
entity: sensor.irrigation_watering_duration_zone1_yearly
stat_type: change
template: "{{ (value * 1.80) | round(2) }} €"
```
**Output:** `74.04 €`

***

## Template Variables

The following context variables are exposed to the Jinja2 engine:

| Variable | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| `value` | `float` | Calculated interval value | `41.13` or `2515.69` |
| `duration` | `string` | Formatted primary entity state | `"41 h 8 min"` or `"2 515,69 kWh"`  |
| `formatted_state` | `string` | Alias for `duration` | `"41 h 8 min"` |
| `minutes` | `integer` | Value expressed in total minutes (`value * 60`) | `2468` |
| `cost` | `float` | Calculated monetary value from `cost_entity` | `638.76` |
| `formatted_cost` | `string` | Formatted cost string with currency | `"638,76 €"` |
| `entity` | `string` | Primary sensor entity ID | `"sensor.haus_energy_t"` |
| `cost_entity` | `string` | Secondary cost sensor entity ID | `"sensor.haus_energy_t_cost"` |

Standard Home Assistant functions such as `states()`, `float`, `round`, and `now()` remain accessible .
