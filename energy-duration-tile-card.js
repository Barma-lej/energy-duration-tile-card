class EnergyDurationTileCard extends HTMLElement {
  constructor() {
    super();
    this._calculatedValue = null;
    this._calculatedCost = null;
    this._templateResult = null;
    this._unsub = null;
    this._templateUnsub = null;
    this._isCreating = false;
    this._isSubscribing = false;
  }

  connectedCallback() {
    this.style.display = "block";
    if (this._hass && !this._unsub && !this._isSubscribing) {
      this._setupSubscription();
    }
  }

  disconnectedCallback() {
    this._unsubscribe();
  }

  _unsubscribe() {
    if (typeof this._unsub === "function") {
      this._unsub();
    }
    if (typeof this._templateUnsub === "function") {
      this._templateUnsub();
    }
    this._unsub = null;
    this._templateUnsub = null;
    this._isSubscribing = false;
  }

  static getConfigForm() {
    return {
      schema: [
        { name: "entity", required: true, selector: { entity: {} } },
        { name: "cost_entity", selector: { entity: {} } },
        { name: "name", selector: { text: {} } },
        { name: "icon", selector: { icon: {} } },
        { name: "color", selector: { ui_color: {} } },
        {
          name: "stat_type",
          default: "change",
          selector: {
            select: {
              options: [
                { value: "change", label: "Change (разница / расход за период)" },
                { value: "sum", label: "Sum (накопительное значение)" },
                { value: "mean", label: "Mean (среднее значение)" },
              ],
            },
          },
        },
        {
          name: "collection_key",
          selector: {
            text: {},
          },
        },
        {
          name: "template",
          selector: {
            template: {},
          },
        },
        { name: "vertical", selector: { boolean: {} } },
      ],
      assertConfig: (config) => {
        if (!config.entity) {
          throw new Error("Необходимо указать сущность (entity)");
        }
      },
    };
  }

  static getStubConfig() {
    return {
      entity: "",
      stat_type: "change",
    };
  }

  set hass(hass) {
    this._hass = hass;

    if (!this._card && !this._isCreating) {
      this._createTileCard();
    } else {
      this._updateTileHass();
    }

    if (!this._unsub && !this._isSubscribing && hass?.connection) {
      this._setupSubscription();
    }
  }

  setConfig(config) {
    if (!config.entity) {
      throw new Error("Необходимо указать entity");
    }

    const oldKey = this._config?.collection_key;
    const oldTpl = this._config?.template;
    const oldCostEntity = this._config?.cost_entity;
    this._config = config;

    if (oldKey !== config.collection_key) {
      this._unsubscribe();
      if (this._hass?.connection) {
        this._setupSubscription();
      }
    } else if (
      (oldTpl !== config.template || oldCostEntity !== config.cost_entity) &&
      this._calculatedValue !== null
    ) {
      if (config.template) {
        this._subscribeTemplate(this._calculatedValue, this._calculatedCost);
      } else {
        if (typeof this._templateUnsub === "function") {
          this._templateUnsub();
          this._templateUnsub = null;
        }
        this._templateResult = null;
        this._updateTileHass();
      }
    }

    if (this._card) {
      this._card.setConfig(this._getTileConfig());
      this._updateTileHass();
    }
  }

  _getTileConfig() {
    const tileConfig = { ...this._config, type: "tile" };
    delete tileConfig.collection_key;
    delete tileConfig.stat_type;
    delete tileConfig.template;
    delete tileConfig.cost_entity;
    return tileConfig;
  }

  async _createTileCard() {
    if (this._card || this._isCreating || !this._config) return;
    this._isCreating = true;

    try {
      let helpers;
      if (window.loadCardHelpers) {
        helpers = await window.loadCardHelpers();
      }

      const tileConfig = this._getTileConfig();
      let cardEl;

      if (helpers) {
        cardEl = await helpers.createCardElement(tileConfig);
      } else {
        cardEl = document.createElement("hui-tile-card");
        cardEl.setConfig(tileConfig);
      }

      this._card = cardEl;
      this.replaceChildren(this._card);
      this._updateTileHass();
    } finally {
      this._isCreating = false;
    }
  }

  _updateTileHass() {
    if (!this._card || !this._hass) return;

    const entityId = this._config.entity;
    const origState = this._hass.states?.[entityId];

    if (!origState) {
      this._card.hass = this._hass;
      return;
    }

    const numericValue =
      this._calculatedValue !== null && this._calculatedValue !== undefined
        ? this._calculatedValue
        : origState.state;

    const virtualState = {
      ...origState,
      state: String(numericValue),
      attributes: { ...origState.attributes },
    };

    const virtualHass = {
      ...this._hass,
      states: {
        ...this._hass.states,
        [entityId]: virtualState,
      },
    };

    const hasCustomTemplate = Boolean(this._config.template && this._templateResult !== null);
    const hasAutoCost = Boolean(
      !this._config.template &&
      this._config.cost_entity &&
      this._calculatedCost !== null &&
      this._calculatedValue !== null
    );

    if (hasCustomTemplate || hasAutoCost) {
      let displayText = "";

      if (hasCustomTemplate) {
        displayText = String(this._templateResult);
      } else {
        // Автоматическое объединение расхода и стоимости при отсутствии template
        const mainFormatted = this._hass.formatEntityState
          ? this._hass.formatEntityState(virtualState)
          : `${numericValue} ${origState.attributes?.unit_of_measurement || ""}`.trim();

        const costState = this._hass.states?.[this._config.cost_entity];
        const virtualCost = {
          ...costState,
          state: String(this._calculatedCost),
          attributes: { ...(costState?.attributes || {}) },
        };

        const costFormatted = this._hass.formatEntityState
          ? this._hass.formatEntityState(virtualCost)
          : `${this._calculatedCost} €`;

        displayText = `${mainFormatted} · ${costFormatted}`;
      }

      const origFormat = this._hass.formatEntityState
        ? this._hass.formatEntityState.bind(this._hass)
        : null;

      virtualHass.formatEntityState = (stateObj, state) => {
        if (stateObj?.entity_id === entityId) {
          return displayText;
        }
        return origFormat ? origFormat(stateObj, state) : (state ?? stateObj?.state);
      };
    }

    this._card.hass = virtualHass;
  }

  _findCollection() {
    const conn = this._hass?.connection;
    if (!conn) return null;

    const userKey = this._config?.collection_key?.trim();
    const panelUrl = this._hass.panelUrl || "energy";

    if (userKey) {
      const candidates = [`_energy_${userKey}`, userKey, `_energy_${userKey}_energy`];
      for (const k of candidates) {
        if (conn[k] && typeof conn[k].subscribe === "function") {
          return { key: k, coll: conn[k] };
        }
      }
      for (const k of Object.keys(conn)) {
        if (k.includes(userKey) && conn[k] && typeof conn[k].subscribe === "function") {
          return { key: k, coll: conn[k] };
        }
      }
    }

    const defaults = [`_energy_${panelUrl}`, "_energy_dashboard_energy", "_energy"];
    for (const k of defaults) {
      if (conn[k] && typeof conn[k].subscribe === "function") {
        return { key: k, coll: conn[k] };
      }
    }

    for (const k of Object.keys(conn)) {
      if (k.startsWith("_energy") && conn[k] && typeof conn[k].subscribe === "function") {
        return { key: k, coll: conn[k] };
      }
    }

    return null;
  }

  _setupSubscription() {
    if (!this._hass?.connection || !this._config || this._unsub || this._isSubscribing) return;
    this._isSubscribing = true;

    let attempts = 0;
    const checkCollection = () => {
      if (!this._isSubscribing) return;

      const found = this._findCollection();
      if (found) {
        this._isSubscribing = false;

        this._unsub = found.coll.subscribe((energyData) => {
          this._fetchStatistics(energyData);
        });

        if (found.coll.state?.start) {
          this._fetchStatistics(found.coll.state);
        }
      } else {
        attempts++;
        if (attempts < 60) {
          setTimeout(checkCollection, 250);
        } else {
          this._isSubscribing = false;
        }
      }
    };

    checkCollection();
  }

  _calcDelta(records, statType, entityId, isCurrentPeriod) {
    if (!records || records.length === 0) return 0;

    const first = records[0];
    const last = records[records.length - 1];
    const liveState = Number(this._hass?.states?.[entityId]?.state);

    if (statType === "mean") {
      const withMean = records.filter((r) => r.mean != null);
      return withMean.length ? withMean.reduce((a, b) => a + b.mean, 0) / withMean.length : 0;
    }

    if (statType === "sum") {
      return last.sum != null && first.sum != null && records.length > 1
        ? last.sum - first.sum
        : (last.sum ?? 0);
    }

    let changeSum = 0;
    let hasChange = false;
    for (const r of records) {
      if (r.change != null && !isNaN(r.change)) {
        changeSum += r.change;
        hasChange = true;
      }
    }

    let val = 0;
    if (hasChange && changeSum !== 0) {
      val = changeSum;
    } else if (last.sum != null && first.sum != null && records.length > 1) {
      val = last.sum - first.sum;
    } else if (last.state != null && first.state != null && records.length > 1) {
      val = last.state - first.state;
    } else {
      val = last.state ?? 0;
    }

    if (isCurrentPeriod && !isNaN(liveState) && last.state != null && liveState > last.state) {
      val += (liveState - last.state);
    }

    return val;
  }

  async _subscribeTemplate(numericValue, costValue) {
    if (typeof this._templateUnsub === "function") {
      this._templateUnsub();
      this._templateUnsub = null;
    }

    if (!this._config?.template || !this._hass?.connection) {
      this._templateResult = null;
      this._updateTileHass();
      return;
    }

    const entityId = this._config.entity;
    const origState = this._hass.states?.[entityId];
    const virtualState = {
      ...origState,
      state: String(numericValue),
      attributes: { ...(origState?.attributes || {}) },
    };

    const formattedStr = this._hass.formatEntityState
      ? this._hass.formatEntityState(virtualState)
      : String(numericValue);

    let formattedCostStr = "";
    if (this._config.cost_entity && costValue !== null) {
      const costState = this._hass.states?.[this._config.cost_entity];
      const virtualCost = {
        ...costState,
        state: String(costValue),
        attributes: { ...(costState?.attributes || {}) },
      };
      formattedCostStr = this._hass.formatEntityState
        ? this._hass.formatEntityState(virtualCost)
        : `${costValue} €`;
    }

    try {
      this._templateUnsub = await this._hass.connection.subscribeMessage(
        (ev) => {
          this._templateResult = ev?.result !== undefined ? ev.result : ev;
          this._updateTileHass();
        },
        {
          type: "render_template",
          template: this._config.template,
          variables: {
            value: numericValue,
            duration: formattedStr,
            formatted_state: formattedStr,
            cost: costValue ?? 0,
            formatted_cost: formattedCostStr,
            entity: entityId,
            cost_entity: this._config.cost_entity || "",
          },
        }
      );
    } catch (err) {
      console.error("[EnergyDurationTileCard] Ошибка рендеринга template:", err);
      this._templateResult = null;
      this._updateTileHass();
    }
  }

  async _fetchStatistics(energyData) {
    if (!energyData?.start) return;

    try {
      const startDate = energyData.start instanceof Date ? energyData.start : new Date(energyData.start);
      const endDate = energyData.end
        ? energyData.end instanceof Date
          ? energyData.end
          : new Date(energyData.end)
        : new Date();

      const statType = this._config.stat_type || "change";
      const entityId = this._config.entity;
      const costEntityId = this._config.cost_entity;
      const isCurrentPeriod = endDate.getTime() >= Date.now() - 3600000;

      const statIds = [entityId];
      if (costEntityId) {
        statIds.push(costEntityId);
      }

      const stats = await this._hass.callWS({
        type: "recorder/statistics_during_period",
        statistic_ids: statIds,
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        period: "hour",
      });

      const entityRecords = (stats?.[entityId] || []).filter((r) => r != null);
      const mainTotal = this._calcDelta(entityRecords, statType, entityId, isCurrentPeriod);
      this._calculatedValue = Math.round(mainTotal * 100) / 100;

      if (costEntityId) {
        const costRecords = (stats?.[costEntityId] || []).filter((r) => r != null);
        const costTotal = this._calcDelta(costRecords, statType, costEntityId, isCurrentPeriod);
        this._calculatedCost = Math.round(costTotal * 100) / 100;
      } else {
        this._calculatedCost = null;
      }

      if (this._config.template) {
        this._subscribeTemplate(this._calculatedValue, this._calculatedCost);
      } else {
        this._updateTileHass();
      }
    } catch (err) {
      console.error("[EnergyDurationTileCard] Ошибка получения статистики:", err);
      this._calculatedValue = 0;
      this._calculatedCost = 0;
      this._updateTileHass();
    }
  }

  getCardSize() {
    return this._card?.getCardSize ? this._card.getCardSize() : 1;
  }

  getLayoutOptions() {
    return (
      this._card?.getLayoutOptions?.() || {
        grid_columns: 2,
        grid_rows: 1,
      }
    );
  }
}

customElements.define("energy-duration-tile-card", EnergyDurationTileCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "energy-duration-tile-card",
  name: "Energy Duration Tile Card",
  description: "Tile Card с поддержкой energy_date_selection, стоимости и любых сенсоров",
  preview: true,
});
