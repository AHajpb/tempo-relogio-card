/*
 * Tempo & Relógio — custom Lovelace card for Home Assistant.
 * Mostra o estado atual do tempo (ícone + temperatura + condição),
 * um relógio ao vivo, a data de hoje, humidade/vento e uma previsão
 * com separadores "Diariamente" / "De hora em hora", à semelhança do
 * card nativo de previsão do Home Assistant — mas com representação
 * separada de dia e noite em cada coluna diária (ícone principal =
 * condição diurna, ícone pequeno no canto = condição noturna).
 * Fundo em gradiente colorido que muda consoante a condição
 * meteorológica e a hora do dia.
 *
 * Instalar: copiar este ficheiro para config/www/tempo-relogio-card.js,
 * registar como recurso Lovelace (Módulo JavaScript,
 * url: /local/tempo-relogio-card.js) e adicionar um card:
 *
 *   type: custom:tempo-relogio-card
 *   entity: weather.home          # a tua entidade de meteorologia
 *   name: Casa                    # opcional, default = nome da entidade
 *   time_format: 24               # 24 ou 12, default 24
 *   show_seconds: true            # default true (relógio ao vivo, ao segundo)
 *   forecast_days: 5              # default 5, 0 esconde a previsão diária
 *   forecast_hours: 12            # default 12, quantas horas mostrar no separador horário
 */

const CONDITION_ICONS = {
  'clear-night': 'mdi:weather-night',
  'cloudy': 'mdi:weather-cloudy',
  'exceptional': 'mdi:alert-circle-outline',
  'fog': 'mdi:weather-fog',
  'hail': 'mdi:weather-hail',
  'lightning': 'mdi:weather-lightning',
  'lightning-rainy': 'mdi:weather-lightning-rainy',
  'partlycloudy': 'mdi:weather-partly-cloudy',
  'partlycloudy-night': 'mdi:weather-night-partly-cloudy',
  'pouring': 'mdi:weather-pouring',
  'rainy': 'mdi:weather-rainy',
  'snowy': 'mdi:weather-snowy',
  'snowy-rainy': 'mdi:weather-snowy-rainy',
  'sunny': 'mdi:weather-sunny',
  'windy': 'mdi:weather-windy',
  'windy-variant': 'mdi:weather-windy-variant',
};

const CONDITION_LABELS_PT = {
  'clear-night': 'Céu limpo',
  'cloudy': 'Nublado',
  'exceptional': 'Excecional',
  'fog': 'Nevoeiro',
  'hail': 'Granizo',
  'lightning': 'Trovoada',
  'lightning-rainy': 'Trovoada com chuva',
  'partlycloudy': 'Poucas nuvens',
  'partlycloudy-night': 'Poucas nuvens',
  'pouring': 'Chuva forte',
  'rainy': 'Chuva',
  'snowy': 'Neve',
  'snowy-rainy': 'Aguaneve',
  'sunny': 'Céu limpo',
  'windy': 'Vento',
  'windy-variant': 'Vento e nuvens',
};

// Gradientes vivos por condição — dão a identidade colorida ao card.
const CONDITION_GRADIENTS = {
  'sunny': ['#fbbf24', '#f97316'],
  'clear-night': ['#4c1d95', '#1e1b4b'],
  'partlycloudy': ['#38bdf8', '#6366f1'],
  'partlycloudy-night': ['#4338ca', '#1e1b4b'],
  'cloudy': ['#64748b', '#334155'],
  'fog': ['#94a3b8', '#475569'],
  'rainy': ['#38bdf8', '#1d4ed8'],
  'pouring': ['#1d4ed8', '#0f172a'],
  'lightning': ['#7c3aed', '#1e1b4b'],
  'lightning-rainy': ['#4c1d95', '#0f172a'],
  'snowy': ['#bae6fd', '#60a5fa'],
  'snowy-rainy': ['#93c5fd', '#3b82f6'],
  'hail': ['#a5f3fc', '#0ea5e9'],
  'windy': ['#5eead4', '#0d9488'],
  'windy-variant': ['#5eead4', '#0f766e'],
  'exceptional': ['#f43f5e', '#7f1d1d'],
};
const DEFAULT_GRADIENT = ['#64748b', '#334155'];

// Cores por condição para os ícones da previsão (nuvens cinza/brancas,
// chuva azul, sol amarelo…), tal como no card nativo de previsão.
const CONDITION_ICON_COLORS = {
  'sunny': '#fbbf24',
  'clear-night': '#c7d2fe',
  'partlycloudy': '#e2e8f0',
  'partlycloudy-night': '#c7d2fe',
  'cloudy': '#cbd5e1',
  'fog': '#cbd5e1',
  'rainy': '#38bdf8',
  'pouring': '#0ea5e9',
  'lightning': '#fbbf24',
  'lightning-rainy': '#38bdf8',
  'snowy': '#e0f2fe',
  'snowy-rainy': '#93c5fd',
  'hail': '#7dd3fc',
  'windy': '#5eead4',
  'windy-variant': '#5eead4',
  'exceptional': '#f87171',
};
const DEFAULT_ICON_COLOR = '#e2e8f0';

function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : str;
}

class TempoRelogioCard extends HTMLElement {
  constructor() {
    super();
    this._activeTab = 'daily';
  }
  setConfig(config) {
    if (!config || !config.entity) {
      throw new Error('Defina "entity" na configuração do card (ex: weather.home).');
    }
    const entityChanged = this._config && this._config.entity !== config.entity;
    this._config = config;
    if (!this.shadowRoot) this._buildDom();
    if (entityChanged) {
      if (typeof this._dailySub === 'function') this._dailySub();
      if (typeof this._hourlySub === 'function') this._hourlySub();
      this._dailySub = undefined;
      this._hourlySub = undefined;
      this._dailyRaw = null;
      this._hourlyRaw = null;
      this._dailyMode = undefined;
      this._dailyUnavailable = false;
      this._hourlyUnavailable = false;
    }
    const days = config.forecast_days === undefined ? 5 : Number(config.forecast_days);
    const section = this.shadowRoot.querySelector('.forecast-section');
    if (section) section.style.display = days > 0 ? '' : 'none';
    this._updateClock();
    this._render();
  }
  getCardSize() {
    return 7;
  }
  getGridOptions() {
    return {
      columns: 12,
      rows: 6,
      min_columns: 6,
      min_rows: 5,
    };
  }
  connectedCallback() {
    if (!this._clockTimer) {
      this._updateClock();
      this._clockTimer = setInterval(() => this._updateClock(), 1000);
    }
  }
  disconnectedCallback() {
    clearInterval(this._clockTimer);
    this._clockTimer = null;
    if (typeof this._dailySub === 'function') this._dailySub();
    if (typeof this._hourlySub === 'function') this._hourlySub();
    this._dailySub = undefined;
    this._hourlySub = undefined;
  }
  set hass(hass) {
    this._hass = hass;
    if (this._dailySub === undefined) this._subscribeDaily();
    if (this._hourlySub === undefined) this._subscribeHourly();
    this._render();
  }
  async _subscribeDaily() {
    if (this._dailySub !== undefined) return;
    this._dailySub = null;
    if (!this._hass || !this._hass.connection || !this._config) {
      this._dailySub = undefined;
      return;
    }
    const trySubscribe = (type) => this._hass.connection.subscribeMessage(
      (msg) => {
        this._dailyRaw = (msg && msg.forecast) || [];
        this._dailyMode = type;
        this._renderForecastRow();
      },
      { type: 'weather/subscribe_forecast', forecast_type: type, entity_id: this._config.entity }
    );
    try {
      // "twice_daily" dá-nos previsão de dia E de noite separadas.
      this._dailySub = await trySubscribe('twice_daily');
    } catch (err1) {
      try {
        this._dailySub = await trySubscribe('daily');
      } catch (err2) {
        this._dailySub = null;
        this._dailyUnavailable = true;
        this._renderForecastRow();
      }
    }
  }
  async _subscribeHourly() {
    if (this._hourlySub !== undefined) return;
    this._hourlySub = null;
    if (!this._hass || !this._hass.connection || !this._config) {
      this._hourlySub = undefined;
      return;
    }
    try {
      this._hourlySub = await this._hass.connection.subscribeMessage(
        (msg) => {
          this._hourlyRaw = (msg && msg.forecast) || [];
          this._renderForecastRow();
        },
        { type: 'weather/subscribe_forecast', forecast_type: 'hourly', entity_id: this._config.entity }
      );
    } catch (err) {
      this._hourlySub = null;
      this._hourlyUnavailable = true;
      this._renderForecastRow();
    }
  }
  _buildDom() {
    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>
        :host { display: block; container-type: inline-size; }
        ha-card {
          display: block;
          position: relative;
          overflow: hidden;
          padding: 0;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
          user-select: none;
          border-radius: var(--ha-card-border-radius, 12px);
          box-shadow: var(--ha-card-box-shadow, 0 4px 14px rgba(0,0,0,0.25));
        }
        ha-card:active { transform: scale(0.997); }
        ha-card.unavailable .card-inner { opacity: 0.6; }
        .card-bg {
          position: absolute;
          inset: 0;
          z-index: 0;
          background: linear-gradient(135deg, ${DEFAULT_GRADIENT[0]}, ${DEFAULT_GRADIENT[1]});
          transition: background 0.6s ease, filter 0.6s ease;
        }
        .card-bg.dim-night { filter: brightness(0.6) saturate(0.9); }
        .card-inner {
          position: relative;
          z-index: 1;
          padding: 16px 20px;
          color: rgba(255,255,255,0.95);
        }
        .eyebrow {
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.8);
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
        }
        .dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: #fff;
          flex: none;
          box-shadow: 0 0 6px 1px rgba(255,255,255,0.6);
        }
        .main-row {
          display: flex;
          flex-direction: row;
          align-items: center;
          gap: 18px;
        }
        @container (max-width: 380px) {
          .main-row { flex-direction: column; text-align: center; }
          .temp-row { justify-content: center; }
        }
        .illustration {
          position: relative;
          flex: none;
          width: 84px; height: 84px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .icon-halo {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(255,255,255,0.35), transparent 72%);
          animation: halo-pulse 4s ease-in-out infinite;
        }
        @keyframes halo-pulse {
          0%, 100% { transform: scale(1); opacity: 0.55; }
          50% { transform: scale(1.12); opacity: 0.9; }
        }
        .weather-icon {
          --mdc-icon-size: 64px;
          position: relative;
          color: #fff;
          filter: drop-shadow(0 2px 6px rgba(0,0,0,0.25));
        }
        .weather-icon.spin { animation: spin 50s linear infinite; }
        .weather-icon.twinkle { animation: twinkle 3.5s ease-in-out infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes twinkle { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }
        .content {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        h1.time {
          margin: 0;
          font-size: 36px;
          font-weight: 700;
          letter-spacing: -0.01em;
          font-variant-numeric: tabular-nums;
          color: #fff;
          text-shadow: 0 2px 8px rgba(0,0,0,0.25);
        }
        .date {
          margin: 0;
          font-size: 13px;
          color: rgba(255,255,255,0.85);
        }
        .temp-row {
          display: flex;
          align-items: baseline;
          gap: 8px;
          margin-top: 6px;
        }
        .current-temp {
          font-size: 22px;
          font-weight: 700;
          color: #fff;
        }
        .condition-label {
          font-size: 13px;
          color: rgba(255,255,255,0.85);
        }
        .divider { height: 1px; background: rgba(255,255,255,0.25); margin: 14px 0; }
        .stats-row {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .stat {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          color: #fff;
          background: rgba(255,255,255,0.16);
          -webkit-backdrop-filter: blur(6px);
          backdrop-filter: blur(6px);
          border-radius: 999px;
          padding: 6px 12px;
        }
        .stat ha-icon { --mdc-icon-size: 16px; color: rgba(255,255,255,0.9); }
        .forecast-tabs {
          display: flex;
          gap: 20px;
          margin-bottom: 10px;
        }
        .tab-btn {
          background: none;
          border: none;
          font: inherit;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.02em;
          color: rgba(255,255,255,0.6);
          padding: 0 0 6px 0;
          cursor: pointer;
          border-bottom: 2px solid transparent;
        }
        .tab-btn.active { color: #fff; border-bottom-color: #22d3ee; }
        .forecast-row {
          display: flex;
          align-items: stretch;
          justify-content: space-around;
          gap: 14px;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: thin;
        }
        .forecast-row::-webkit-scrollbar { height: 4px; }
        .forecast-row::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.3); border-radius: 4px; }
        .forecast-day {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          flex: 1;
          min-width: 56px;
          padding: 4px 2px;
        }
        .forecast-day-label {
          font-size: 12px;
          letter-spacing: 0.02em;
          color: rgba(255,255,255,0.8);
          margin-bottom: 2px;
        }
        .icon-stack { position: relative; display: inline-flex; align-items: center; justify-content: center; }
        .forecast-icon { --mdc-icon-size: 38px; color: #e2e8f0; filter: drop-shadow(0 1px 3px rgba(0,0,0,0.35)); }
        .forecast-icon-night {
          --mdc-icon-size: 14px;
          color: #fff;
          position: absolute;
          bottom: -2px;
          right: -10px;
          background: rgba(15,23,42,0.65);
          border-radius: 50%;
          padding: 2px;
          box-sizing: content-box;
        }
        .forecast-max { font-size: 14px; font-weight: 700; color: #fff; margin-top: 4px; }
        .forecast-min { font-size: 12px; color: rgba(255,255,255,0.65); }
        .forecast-empty { font-size: 12px; color: rgba(255,255,255,0.8); padding: 4px 2px; }
      </style>
      <ha-card>
        <div class="card-bg"></div>
        <div class="card-inner">
          <div class="eyebrow"><span class="dot"></span><span class="status-text">—</span></div>
          <div class="main-row">
            <div class="illustration">
              <div class="icon-halo"></div>
              <ha-icon class="weather-icon" icon="mdi:weather-cloudy"></ha-icon>
            </div>
            <div class="content">
              <div class="clock-block">
                <h1 class="time">--:--</h1>
                <p class="date"></p>
              </div>
              <div class="temp-row">
                <span class="current-temp">—</span>
                <span class="condition-label">—</span>
              </div>
            </div>
          </div>
          <div class="divider"></div>
          <div class="stats-row">
            <div class="stat"><ha-icon icon="mdi:water-percent"></ha-icon><span class="humidity-val">—</span></div>
            <div class="stat"><ha-icon icon="mdi:weather-windy"></ha-icon><span class="wind-val">—</span></div>
          </div>
          <div class="forecast-section">
            <div class="divider"></div>
            <div class="forecast-tabs">
              <button type="button" class="tab-btn active" data-tab="daily">Diariamente</button>
              <button type="button" class="tab-btn" data-tab="hourly">De hora em hora</button>
            </div>
            <div class="forecast-row"></div>
          </div>
        </div>
      </ha-card>
    `;
    root.querySelector('ha-card').addEventListener('click', () => {
      if (!this._hass || !this._config) return;
      this.dispatchEvent(new CustomEvent('hass-more-info', {
        detail: { entityId: this._config.entity },
        bubbles: true, composed: true,
      }));
    });
    root.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        this._activeTab = btn.dataset.tab;
        root.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b === btn));
        this._renderForecastRow();
      });
    });
  }
  _updateClock() {
    if (!this.shadowRoot || !this._config) return;
    const root = this.shadowRoot;
    const now = new Date();
    const hour12 = this._config.time_format === 12;
    const timeOpts = { hour: '2-digit', minute: '2-digit', hour12 };
    if (this._config.show_seconds !== false) timeOpts.second = '2-digit';
    const timeStr = now.toLocaleTimeString('pt-PT', timeOpts);
    let dateStr = now.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });
    dateStr = capitalize(dateStr);
    root.querySelector('.time').textContent = timeStr;
    root.querySelector('.date').textContent = dateStr;
  }
  _isNight(condition) {
    const sun = this._hass.states['sun.sun'];
    if (sun) return sun.state === 'below_horizon';
    if (typeof condition === 'string' && condition.includes('night')) return true;
    const h = new Date().getHours();
    return h < 7 || h >= 21;
  }
  _render() {
    if (!this._hass || !this.shadowRoot || !this._config) return;
    const root = this.shadowRoot;
    const card = root.querySelector('ha-card');
    const bg = root.querySelector('.card-bg');
    const stateObj = this._hass.states[this._config.entity];
    if (!stateObj) {
      card.classList.add('unavailable');
      root.querySelector('.status-text').textContent = 'Indisponível';
      root.querySelector('.condition-label').textContent = `Entidade "${this._config.entity}" não encontrada.`;
      root.querySelector('.current-temp').textContent = '—';
      return;
    }
    card.classList.remove('unavailable');
    const condition = stateObj.state;
    const isNight = this._isNight(condition);
    const iconName = CONDITION_ICONS[condition] || (isNight ? 'mdi:weather-night' : 'mdi:weather-cloudy');
    const iconEl = root.querySelector('.weather-icon');
    iconEl.setAttribute('icon', iconName);
    iconEl.classList.toggle('spin', condition === 'sunny');
    iconEl.classList.toggle('twinkle', condition === 'clear-night');
    const gradient = CONDITION_GRADIENTS[condition] || DEFAULT_GRADIENT;
    bg.style.background = `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})`;
    bg.classList.toggle('dim-night', isNight && !String(condition).includes('night'));
    root.querySelector('.status-text').textContent = this._config.name || stateObj.attributes.friendly_name || 'Tempo';
    root.querySelector('.condition-label').textContent = CONDITION_LABELS_PT[condition] || condition;
    const temp = stateObj.attributes.temperature;
    const unit = stateObj.attributes.temperature_unit || '°C';
    root.querySelector('.current-temp').textContent = (temp !== undefined && temp !== null) ? `${Math.round(temp)}${unit}` : '—';
    const humidity = stateObj.attributes.humidity;
    root.querySelector('.humidity-val').textContent = (humidity !== undefined && humidity !== null) ? `${humidity}%` : '—';
    const wind = stateObj.attributes.wind_speed;
    const windUnit = stateObj.attributes.wind_speed_unit || 'km/h';
    root.querySelector('.wind-val').textContent = (wind !== undefined && wind !== null) ? `${Math.round(wind)} ${windUnit}` : '—';
    this._renderForecastRow();
  }
  _buildDailyPairs(list) {
    const days = [];
    let current = null;
    for (const entry of list) {
      const dateKey = entry.datetime ? entry.datetime.slice(0, 10) : null;
      const isDay = entry.is_daytime !== false;
      if (isDay) {
        current = { date: dateKey, day: entry, night: null };
        days.push(current);
      } else if (current && !current.night) {
        current.night = entry;
      } else {
        current = { date: dateKey, day: null, night: entry };
        days.push(current);
      }
    }
    return days;
  }
  _dayCellHtml(pair) {
    const dayEntry = pair.day;
    const nightEntry = pair.night;
    const ref = dayEntry || nightEntry;
    const label = capitalize(new Date(ref.datetime).toLocaleDateString('pt-PT', { weekday: 'short' })).replace('.', '');
    const dayIcon = dayEntry ? (CONDITION_ICONS[dayEntry.condition] || 'mdi:weather-cloudy') : 'mdi:weather-night';
    const dayIconColor = dayEntry ? (CONDITION_ICON_COLORS[dayEntry.condition] || DEFAULT_ICON_COLOR) : DEFAULT_ICON_COLOR;
    const nightIcon = nightEntry ? (CONDITION_ICONS[nightEntry.condition] || 'mdi:weather-night') : null;
    const maxSrc = dayEntry && dayEntry.temperature != null ? dayEntry.temperature : (nightEntry && nightEntry.temperature != null ? nightEntry.temperature : null);
    const minSrc = nightEntry && (nightEntry.templow != null ? nightEntry.templow : nightEntry.temperature) != null
      ? (nightEntry.templow != null ? nightEntry.templow : nightEntry.temperature)
      : (dayEntry && dayEntry.templow != null ? dayEntry.templow : null);
    const max = maxSrc != null ? Math.round(maxSrc) : null;
    const min = minSrc != null ? Math.round(minSrc) : null;
    return `
      <div class="forecast-day">
        <span class="forecast-day-label">${label}</span>
        <div class="icon-stack">
          <ha-icon icon="${dayIcon}" class="forecast-icon" style="color: ${dayIconColor};"></ha-icon>
          ${nightIcon ? `<ha-icon icon="${nightIcon}" class="forecast-icon-night"></ha-icon>` : ''}
        </div>
        <span class="forecast-max">${max !== null ? max + '°' : '—'}</span>
        ${min !== null ? `<span class="forecast-min">${min}°</span>` : ''}
      </div>`;
  }
  _hourCellHtml(entry) {
    const d = new Date(entry.datetime);
    const label = `${d.getHours()}h`;
    const icon = CONDITION_ICONS[entry.condition] || 'mdi:weather-cloudy';
    const iconColor = CONDITION_ICON_COLORS[entry.condition] || DEFAULT_ICON_COLOR;
    const temp = entry.temperature != null ? Math.round(entry.temperature) : null;
    return `
      <div class="forecast-day">
        <span class="forecast-day-label">${label}</span>
        <ha-icon icon="${icon}" class="forecast-icon" style="color: ${iconColor};"></ha-icon>
        <span class="forecast-max">${temp !== null ? temp + '°' : '—'}</span>
      </div>`;
  }
  _renderForecastRow() {
    if (!this.shadowRoot || !this._config) return;
    const root = this.shadowRoot;
    const container = root.querySelector('.forecast-row');
    if (this._activeTab === 'hourly') {
      const hours = this._config.forecast_hours === undefined ? 12 : Number(this._config.forecast_hours);
      const list = (this._hourlyRaw || []).slice(0, hours);
      if (!list.length) {
        container.innerHTML = `<span class="forecast-empty">${this._hourlyUnavailable ? 'Previsão horária indisponível' : 'A carregar…'}</span>`;
        return;
      }
      container.innerHTML = list.map((e) => this._hourCellHtml(e)).join('');
      return;
    }
    const days = this._config.forecast_days === undefined ? 5 : Number(this._config.forecast_days);
    if (!days || days <= 0) { container.innerHTML = ''; return; }
    let raw = this._dailyRaw;
    let mode = this._dailyMode;
    if ((!raw || !raw.length) && this._dailyUnavailable && this._hass) {
      const stateObj = this._hass.states[this._config.entity];
      raw = (stateObj && stateObj.attributes && stateObj.attributes.forecast) || [];
      mode = mode || 'daily';
    }
    if (!raw || !raw.length) {
      container.innerHTML = `<span class="forecast-empty">${this._dailyUnavailable ? 'Previsão indisponível' : 'A carregar…'}</span>`;
      return;
    }
    const pairs = mode === 'twice_daily'
      ? this._buildDailyPairs(raw)
      : raw.map((e) => ({ date: e.datetime ? e.datetime.slice(0, 10) : null, day: e, night: null }));
    container.innerHTML = pairs.slice(0, days).map((p) => this._dayCellHtml(p)).join('');
  }
  static getStubConfig() {
    return { entity: 'weather.home', name: 'Casa' };
  }
}
customElements.define('tempo-relogio-card', TempoRelogioCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'tempo-relogio-card',
  name: 'Tempo & Relógio',
  description: 'Tempo atual, previsão diária (com dia/noite) e horária, relógio ao vivo e data — fundo colorido por condição.',
});
