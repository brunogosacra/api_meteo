const form = document.querySelector("#search-form");
const cityInput = document.querySelector("#city-input");
const searchButton = document.querySelector("#search-button");
const suggestionsPanel = document.querySelector("#suggestions-panel");
const suggestionsList = document.querySelector("#city-suggestions");
const suggestionsMessage = document.querySelector("#suggestions-message");
const statusMessage = document.querySelector("#status-message");
const statusText = document.querySelector("#status-text");
const weatherSection = document.querySelector("#weather-section");
const welcomeCard = document.querySelector("#welcome-card");
const forecastGrid = document.querySelector("#forecast-grid");
const weatherChart = document.querySelector("#weather-chart");
const chartTitle = document.querySelector("#chart-title");
const chartLegend = document.querySelector("#chart-legend");
const chartTabs = [...document.querySelectorAll("[data-chart-metric]")];
const activitySection = document.querySelector("#activity-section");
const recentCitiesContainer = document.querySelector("#recent-cities");
const comparisonForm = document.querySelector("#comparison-form");
const comparisonCityOne = document.querySelector("#comparison-city-one");
const comparisonCityTwo = document.querySelector("#comparison-city-two");
const compareButton = document.querySelector("#compare-button");
const comparisonStatus = document.querySelector("#comparison-status");
const comparisonResults = document.querySelector("#comparison-results");
const themeToggle = document.querySelector("#theme-toggle");
const themeColor = document.querySelector('meta[name="theme-color"]');
const recentCitiesStorageKey = "sol-lua-recent-cities";
const maxRecentCities = 5;
let suggestionTimer;
let suggestionRequest;
let suggestionCities = [];
let activeSuggestion = -1;
let selectedCity = null;
let recentCities = loadRecentCities();
let activeChartMetric = "temperature";
let currentDailyForecast;

function setTheme(theme) {
  const isDark = theme === "dark";
  document.documentElement.dataset.theme = isDark ? "dark" : "light";
  themeToggle.setAttribute("aria-pressed", String(isDark));
  themeToggle.setAttribute("aria-label", isDark ? "Ativar modo claro" : "Ativar modo noturno");
  themeToggle.setAttribute("title", isDark ? "Ativar modo claro" : "Ativar modo noturno");
  themeToggle.querySelector(".theme-toggle-label").textContent = isDark ? "Modo claro" : "Modo noturno";
  themeColor.setAttribute("content", isDark ? "#25222e" : "#f6efe5");
}

const savedTheme = localStorage.getItem("sol-lua-theme");
setTheme(savedTheme === "dark" ? "dark" : "light");

themeToggle.addEventListener("click", () => {
  const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  setTheme(nextTheme);
  localStorage.setItem("sol-lua-theme", nextTheme);
});

function loadRecentCities() {
  const savedCities = JSON.parse(localStorage.getItem(recentCitiesStorageKey) ?? "[]");
  if (!Array.isArray(savedCities)) return [];

  return savedCities.filter((city) =>
    city &&
    typeof city.name === "string" &&
    typeof city.latitude === "number" &&
    typeof city.longitude === "number",
  ).slice(0, maxRecentCities);
}

const weatherConditions = {
  0: { label: "Céu limpo", icon: "☀️" },
  1: { label: "Predominantemente limpo", icon: "🌤️" },
  2: { label: "Parcialmente nublado", icon: "⛅" },
  3: { label: "Nublado", icon: "☁️" },
  45: { label: "Neblina", icon: "🌫️" },
  48: { label: "Neblina com geada", icon: "🌫️" },
  51: { label: "Garoa leve", icon: "🌦️" },
  53: { label: "Garoa moderada", icon: "🌦️" },
  55: { label: "Garoa intensa", icon: "🌧️" },
  56: { label: "Garoa congelante leve", icon: "🌧️" },
  57: { label: "Garoa congelante intensa", icon: "🌧️" },
  61: { label: "Chuva leve", icon: "🌦️" },
  63: { label: "Chuva moderada", icon: "🌧️" },
  65: { label: "Chuva forte", icon: "🌧️" },
  66: { label: "Chuva congelante leve", icon: "🌧️" },
  67: { label: "Chuva congelante intensa", icon: "🌧️" },
  71: { label: "Neve leve", icon: "🌨️" },
  73: { label: "Neve moderada", icon: "🌨️" },
  75: { label: "Neve forte", icon: "❄️" },
  77: { label: "Grãos de neve", icon: "❄️" },
  80: { label: "Pancadas de chuva leves", icon: "🌦️" },
  81: { label: "Pancadas de chuva moderadas", icon: "🌧️" },
  82: { label: "Pancadas de chuva fortes", icon: "🌧️" },
  85: { label: "Pancadas de neve leves", icon: "🌨️" },
  86: { label: "Pancadas de neve fortes", icon: "❄️" },
  95: { label: "Trovoada", icon: "⛈️" },
  96: { label: "Trovoada com granizo leve", icon: "⛈️" },
  99: { label: "Trovoada com granizo forte", icon: "⛈️" },
};

function getCondition(code) {
  return weatherConditions[code] ?? { label: "Condição indisponível", icon: "🌡️" };
}

function setStatus(message = "", state = "") {
  statusText.textContent = message;
  statusMessage.classList.toggle("is-visible", Boolean(message));
  statusMessage.classList.toggle("is-loading", state === "loading");
  statusMessage.classList.toggle("is-error", state === "error");
}

function setLoading(isLoading) {
  searchButton.disabled = isLoading;
  searchButton.querySelector("span").textContent = isLoading ? "Buscando" : "Buscar";
  cityInput.disabled = isLoading;
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error("Não foi possível consultar os dados meteorológicos.");
  }
  return response.json();
}

async function findCity(cityName, signal) {
  const params = new URLSearchParams({
    name: cityName,
    count: "5",
    language: "pt",
    format: "json",
  });
  const data = await fetchJson(
    `https://geocoding-api.open-meteo.com/v1/search?${params}`,
    signal ? { signal } : undefined,
  );
  return data.results ?? [];
}

function closeSuggestions() {
  suggestionsPanel.hidden = true;
  cityInput.setAttribute("aria-expanded", "false");
  cityInput.removeAttribute("aria-activedescendant");
  activeSuggestion = -1;
  suggestionCities = [];
}

function showSuggestionsMessage(message, isError = false) {
  suggestionCities = [];
  activeSuggestion = -1;
  cityInput.removeAttribute("aria-activedescendant");
  suggestionsList.replaceChildren();
  suggestionsMessage.textContent = message;
  suggestionsMessage.classList.toggle("is-error", isError);
  suggestionsPanel.hidden = !message;
  cityInput.setAttribute("aria-expanded", String(Boolean(message)));
}

function renderSuggestions(cities) {
  suggestionCities = cities;
  activeSuggestion = -1;
  suggestionsMessage.textContent = "";
  suggestionsMessage.classList.remove("is-error");
  suggestionsList.replaceChildren();

  for (const [index, city] of cities.entries()) {
    const option = document.createElement("li");
    const button = document.createElement("button");
    const pin = document.createElement("span");
    const copy = document.createElement("span");
    const name = document.createElement("span");
    const location = document.createElement("span");

    option.id = `city-suggestion-${index}`;
    option.setAttribute("role", "option");
    option.setAttribute("aria-selected", "false");
    button.className = "city-suggestion";
    button.type = "button";
    pin.className = "suggestion-pin";
    pin.setAttribute("aria-hidden", "true");
    pin.textContent = "⌖";
    copy.className = "suggestion-copy";
    name.className = "suggestion-name";
    name.textContent = city.name;
    location.className = "suggestion-location";
    location.textContent = [city.admin1, city.country].filter(Boolean).join(", ");

    copy.append(name, location);
    button.append(pin, copy);
    option.append(button);
    option.addEventListener("mousedown", (event) => event.preventDefault());
    option.addEventListener("click", () => selectCity(index));
    suggestionsList.append(option);
  }

  suggestionsPanel.hidden = cities.length === 0;
  cityInput.setAttribute("aria-expanded", String(cities.length > 0));
}

function setActiveSuggestion(index) {
  if (suggestionCities.length === 0) return;

  activeSuggestion = (index + suggestionCities.length) % suggestionCities.length;
  for (const [optionIndex, option] of [...suggestionsList.children].entries()) {
    const isActive = optionIndex === activeSuggestion;
    option.setAttribute("aria-selected", String(isActive));
    if (isActive) {
      cityInput.setAttribute("aria-activedescendant", option.id);
    }
  }
}

function selectCity(index) {
  const city = suggestionCities[index];
  if (!city) return;

  selectedCity = city;
  cityInput.value = city.name;
  closeSuggestions();
  form.requestSubmit();
}

async function loadSuggestions(query) {
  suggestionRequest?.abort();
  suggestionRequest = new AbortController();
  showSuggestionsMessage("Procurando cidades...");

  try {
    const cities = await findCity(query, suggestionRequest.signal);
    if (cityInput.value.trim() !== query) return;
    if (cities.length === 0) {
      showSuggestionsMessage("Nenhuma cidade encontrada. Você ainda pode tentar buscar.");
      return;
    }
    renderSuggestions(cities);
  } catch (error) {
    if (error.name === "AbortError" || cityInput.value.trim() !== query) return;
    showSuggestionsMessage("Não foi possível carregar sugestões. Tente buscar a cidade.", true);
  }
}

async function fetchForecast({ latitude, longitude }) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: [
      "temperature_2m",
      "relative_humidity_2m",
      "apparent_temperature",
      "precipitation",
      "weather_code",
      "wind_speed_10m",
    ].join(","),
    daily: [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "relative_humidity_2m_mean",
      "wind_speed_10m_max",
      "precipitation_probability_max",
    ].join(","),
    temperature_unit: "celsius",
    wind_speed_unit: "kmh",
    timezone: "auto",
    forecast_days: "5",
  });
  return fetchJson(`https://api.open-meteo.com/v1/forecast?${params}`);
}

function formatNumber(value) {
  return Math.round(value);
}

function renderCurrent(city, forecast) {
  const current = forecast.current;
  const countryAndRegion = [city.admin1, city.country].filter(Boolean).join(", ");
  const condition = getCondition(current.weather_code);

  document.querySelector("#city-name").textContent = city.name;
  document.querySelector("#city-region").textContent = countryAndRegion;
  document.querySelector("#weather-icon").textContent = condition.icon;
  document.querySelector("#temperature").textContent = `${formatNumber(current.temperature_2m)}°C`;
  document.querySelector("#condition").textContent = condition.label;
  document.querySelector("#feels-like").textContent = `${formatNumber(current.apparent_temperature)}°C`;
  document.querySelector("#humidity").textContent = `${formatNumber(current.relative_humidity_2m)}%`;
  document.querySelector("#wind").textContent = `${formatNumber(current.wind_speed_10m)} km/h`;
  document.querySelector("#precipitation").textContent = `${current.precipitation} mm`;

  const localTime = current.time.split("T")[1]?.slice(0, 5);
  document.querySelector("#updated-at").textContent = `Atualizado às ${localTime} · horário local`;
}

function createForecastCard(daily, index) {
  const card = document.createElement("article");
  card.className = "forecast-card";

  const date = new Date(`${daily.time[index]}T12:00:00`);
  const day = index === 0
    ? "Hoje"
    : new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(date).replace(".", "");
  const condition = getCondition(daily.weather_code[index]);

  const dayLabel = document.createElement("span");
  dayLabel.className = "forecast-day";
  dayLabel.textContent = day.charAt(0).toUpperCase() + day.slice(1);

  const icon = document.createElement("span");
  icon.className = "forecast-icon";
  icon.setAttribute("aria-label", condition.label);
  icon.textContent = condition.icon;

  const description = document.createElement("p");
  description.className = "forecast-condition";
  description.textContent = condition.label;

  const temperatures = document.createElement("div");
  temperatures.className = "forecast-temperatures";
  const high = document.createElement("span");
  high.className = "forecast-high";
  high.textContent = `${formatNumber(daily.temperature_2m_max[index])}°`;
  const low = document.createElement("span");
  low.className = "forecast-low";
  low.textContent = `${formatNumber(daily.temperature_2m_min[index])}°`;
  temperatures.append(high, low);

  const rain = document.createElement("p");
  rain.className = "forecast-rain";
  const rainChance = daily.precipitation_probability_max?.[index];
  rain.textContent = rainChance == null ? "" : `☂ ${rainChance}% de chuva`;

  card.append(dayLabel, icon, description, temperatures, rain);
  return card;
}

function renderForecast(forecast) {
  forecastGrid.replaceChildren(
    ...forecast.daily.time.map((_, index) => createForecastCard(forecast.daily, index)),
  );
  currentDailyForecast = forecast.daily;
  renderWeatherChart(activeChartMetric);
}

const chartMetrics = {
  temperature: {
    title: "Variação da temperatura",
    unit: "°C",
    series: [
      { key: "temperature_2m_max", label: "Máxima", className: "chart-line-high" },
      { key: "temperature_2m_min", label: "Mínima", className: "chart-line-low" },
    ],
  },
  humidity: {
    title: "Umidade do ar",
    unit: "%",
    series: [{ key: "relative_humidity_2m_mean", label: "Umidade média", className: "chart-line-high" }],
  },
  wind: {
    title: "Velocidade do vento",
    unit: "km/h",
    series: [{ key: "wind_speed_10m_max", label: "Vento máximo", className: "chart-line-high" }],
  },
  rain: {
    title: "Probabilidade de chuva",
    unit: "%",
    series: [{ key: "precipitation_probability_max", label: "Chance de chuva", className: "chart-line-low" }],
  },
};

function createSvgElement(tagName, attributes = {}) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", tagName);
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, String(value));
  }
  return element;
}

function formatForecastDay(dateString) {
  const day = new Intl.DateTimeFormat("pt-BR", { weekday: "short" })
    .format(new Date(`${dateString}T12:00:00`))
    .replace(".", "");
  return day.charAt(0).toUpperCase() + day.slice(1);
}

function renderWeatherChart(metricKey) {
  if (!currentDailyForecast) return;

  const metric = chartMetrics[metricKey];
  if (!metric) return;
  activeChartMetric = metricKey;
  chartTitle.textContent = metric.title;
  chartTabs.forEach((tab) => {
    const isActive = tab.dataset.chartMetric === metricKey;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-pressed", String(isActive));
  });

  const availableSeries = metric.series
    .map((series) => ({
      ...series,
      values: currentDailyForecast[series.key],
    }))
    .filter((series) => Array.isArray(series.values));

  if (availableSeries.length === 0) {
    chartLegend.textContent = "";
    weatherChart.replaceChildren(
      createSvgElement("title", { id: "chart-svg-title" }),
      createSvgElement("desc", { id: "chart-svg-description" }),
    );
    weatherChart.querySelector("#chart-svg-title").textContent = metric.title;
    weatherChart.querySelector("#chart-svg-description").textContent = "Os dados deste indicador não estão disponíveis.";
    return;
  }

  const days = currentDailyForecast.time;
  const values = availableSeries.flatMap((series) => series.values.filter(Number.isFinite));
  if (days.length === 0 || values.length === 0) return;

  let minimum = Math.min(...values);
  let maximum = Math.max(...values);
  if (metricKey === "humidity" || metricKey === "rain") {
    minimum = 0;
    maximum = 100;
  } else {
    const padding = Math.max((maximum - minimum) * 0.18, metricKey === "temperature" ? 2 : 1);
    minimum -= padding;
    maximum += padding;
  }

  const width = 760;
  const height = 280;
  const margin = { top: 20, right: 24, bottom: 42, left: 48 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const x = (index) => margin.left + (days.length === 1 ? plotWidth / 2 : (index / (days.length - 1)) * plotWidth);
  const y = (value) => margin.top + ((maximum - value) / (maximum - minimum)) * plotHeight;
  const fragment = document.createDocumentFragment();
  const title = createSvgElement("title", { id: "chart-svg-title" });
  const description = createSvgElement("desc", { id: "chart-svg-description" });
  title.textContent = metric.title;
  description.textContent = `${metric.title} nos próximos ${days.length} dias.`;
  fragment.append(title, description);
  chartLegend.replaceChildren();

  for (const series of availableSeries) {
    const legend = document.createElement("span");
    const swatch = document.createElement("span");
    legend.className = "chart-legend-item";
    swatch.className = `chart-legend-swatch ${series.className}`;
    swatch.setAttribute("aria-hidden", "true");
    legend.append(swatch, document.createTextNode(series.label));
    chartLegend.append(legend);
  }

  for (let tick = 0; tick <= 4; tick += 1) {
    const value = maximum - ((maximum - minimum) * tick) / 4;
    const tickY = y(value);
    fragment.append(
      createSvgElement("line", {
        class: "chart-grid-line",
        x1: margin.left,
        x2: width - margin.right,
        y1: tickY,
        y2: tickY,
      }),
    );
    const label = createSvgElement("text", {
      class: "chart-axis-label",
      x: margin.left - 10,
      y: tickY + 4,
      "text-anchor": "end",
    });
    label.textContent = `${Math.round(value)}${metric.unit}`;
    fragment.append(label);
  }

  days.forEach((day, index) => {
    const label = createSvgElement("text", {
      class: "chart-axis-label",
      x: x(index),
      y: height - 12,
      "text-anchor": "middle",
    });
    label.textContent = index === 0 ? "Hoje" : formatForecastDay(day);
    fragment.append(label);
  });

  availableSeries.forEach((series) => {
    const points = series.values
      .map((value, index) => Number.isFinite(value) ? { value, index } : null)
      .filter(Boolean);
    if (points.length === 0) return;

    const polyline = createSvgElement("polyline", {
      class: `chart-line ${series.className}`,
      points: points.map((point) => `${x(point.index)},${y(point.value)}`).join(" "),
    });
    fragment.append(polyline);

    points.forEach((point) => {
      const circle = createSvgElement("circle", {
        class: `chart-point ${series.className}`,
        cx: x(point.index),
        cy: y(point.value),
        r: 5,
      });
      const pointTitle = createSvgElement("title");
      pointTitle.textContent = `${formatForecastDay(days[point.index])}: ${Math.round(point.value)}${metric.unit}`;
      circle.append(pointTitle);
      fragment.append(circle);
    });
  });

  weatherChart.replaceChildren(fragment);
}

function cityKey(city) {
  return `${city.latitude},${city.longitude}`;
}

function cityLabel(city) {
  return [city.name, city.admin1, city.country].filter(Boolean).join(", ");
}

function addRecentCity(city) {
  recentCities = [
    city,
    ...recentCities.filter((recentCity) => cityKey(recentCity) !== cityKey(city)),
  ].slice(0, maxRecentCities);
  localStorage.setItem(recentCitiesStorageKey, JSON.stringify(recentCities));
  renderActivity();
}

function renderActivity() {
  activitySection.hidden = recentCities.length === 0;
  recentCitiesContainer.replaceChildren();

  recentCities.forEach((city, index) => {
    const button = document.createElement("button");
    const name = document.createElement("span");
    const region = document.createElement("span");
    button.className = "recent-city";
    button.type = "button";
    button.setAttribute("aria-label", `Consultar ${cityLabel(city)} novamente`);
    name.className = "recent-city-name";
    name.textContent = city.name;
    region.className = "recent-city-region";
    region.textContent = [city.admin1, city.country].filter(Boolean).join(", ");
    button.append(name, region);
    button.addEventListener("click", () => loadCityWeather(city));
    recentCitiesContainer.append(button);
  });

  const options = recentCities.map((city) => {
    const option = document.createElement("option");
    option.value = cityKey(city);
    option.textContent = cityLabel(city);
    return option;
  });
  comparisonCityOne.replaceChildren(...options.map((option) => option.cloneNode(true)));
  comparisonCityTwo.replaceChildren(...options.map((option) => option.cloneNode(true)));

  if (recentCities[0]) {
    comparisonCityOne.value = cityKey(recentCities[0]);
  }

  if (recentCities[1]) {
    comparisonCityTwo.value = cityKey(recentCities[1]);
  } else if (recentCities[0]) {
    comparisonCityTwo.value = cityKey(recentCities[0]);
  }

  compareButton.disabled = recentCities.length < 2;
  comparisonCityOne.disabled = recentCities.length < 2;
  comparisonCityTwo.disabled = recentCities.length < 2;
  comparisonResults.replaceChildren();
  comparisonStatus.classList.remove("is-error");
  comparisonStatus.textContent = recentCities.length < 2
    ? "Consulte mais uma cidade para comparar."
    : "";
}

function renderComparisonCard(city, forecast) {
  const card = document.createElement("article");
  const header = document.createElement("div");
  const icon = document.createElement("span");
  const title = document.createElement("div");
  const name = document.createElement("h3");
  const region = document.createElement("p");
  const temperature = document.createElement("p");
  const condition = document.createElement("p");
  const details = document.createElement("dl");
  const current = forecast.current;
  const weather = getCondition(current.weather_code);

  card.className = "comparison-result-card";
  header.className = "comparison-result-heading";
  icon.className = "comparison-result-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = weather.icon;
  name.textContent = city.name;
  region.textContent = [city.admin1, city.country].filter(Boolean).join(", ");
  temperature.className = "comparison-temperature";
  temperature.textContent = `${formatNumber(current.temperature_2m)}°C`;
  condition.className = "comparison-condition";
  condition.textContent = weather.label;
  title.append(name, region);
  header.append(icon, title);

  for (const [label, value] of [
    ["Sensação", `${formatNumber(current.apparent_temperature)}°C`],
    ["Umidade", `${formatNumber(current.relative_humidity_2m)}%`],
    ["Vento", `${formatNumber(current.wind_speed_10m)} km/h`],
    ["Chuva agora", `${current.precipitation} mm`],
  ]) {
    const item = document.createElement("div");
    const term = document.createElement("dt");
    const description = document.createElement("dd");
    item.className = "comparison-detail";
    term.textContent = label;
    description.textContent = value;
    item.append(term, description);
    details.append(item);
  }

  details.className = "comparison-details";
  card.append(header, temperature, condition, details);
  return card;
}

chartTabs.forEach((tab) => {
  tab.addEventListener("click", () => renderWeatherChart(tab.dataset.chartMetric));
});

async function loadCityWeather(city) {
  setLoading(true);
  setStatus(`Buscando a previsão de ${city.name}...`, "loading");
  try {
    const forecast = await fetchForecast(city);
    if (!forecast.current || !forecast.daily) {
      throw new Error("A previsão recebida está incompleta. Tente novamente em instantes.");
    }

    renderCurrent(city, forecast);
    renderForecast(forecast);
    weatherSection.hidden = false;
    welcomeCard.hidden = true;
    addRecentCity(city);
    setStatus();
  } catch (error) {
    setStatus(
      error instanceof TypeError
        ? "Não foi possível conectar ao serviço de previsão. Verifique sua internet e tente novamente."
        : error.message,
      "error",
    );
  } finally {
    setLoading(false);
  }
}

cityInput.addEventListener("input", () => {
  selectedCity = null;
  clearTimeout(suggestionTimer);
  suggestionRequest?.abort();

  const query = cityInput.value.trim();
  if (query.length < 2) {
    closeSuggestions();
    return;
  }

  suggestionTimer = setTimeout(() => loadSuggestions(query), 300);
});

cityInput.addEventListener("keydown", (event) => {
  if (event.key === "ArrowDown" && suggestionCities.length > 0) {
    event.preventDefault();
    setActiveSuggestion(activeSuggestion + 1);
  } else if (event.key === "ArrowUp" && suggestionCities.length > 0) {
    event.preventDefault();
    setActiveSuggestion(activeSuggestion <= 0 ? suggestionCities.length - 1 : activeSuggestion - 1);
  } else if (event.key === "Enter" && activeSuggestion >= 0) {
    event.preventDefault();
    selectCity(activeSuggestion);
  } else if (event.key === "Escape" && !suggestionsPanel.hidden) {
    event.preventDefault();
    closeSuggestions();
  }
});

document.addEventListener("pointerdown", (event) => {
  if (!event.target.closest(".city-search")) {
    closeSuggestions();
  }
});

comparisonForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const firstCity = recentCities.find((city) => cityKey(city) === comparisonCityOne.value);
  const secondCity = recentCities.find((city) => cityKey(city) === comparisonCityTwo.value);

  if (!firstCity || !secondCity || cityKey(firstCity) === cityKey(secondCity)) {
    comparisonResults.replaceChildren();
    comparisonStatus.textContent = "Selecione duas cidades diferentes para comparar.";
    comparisonStatus.classList.add("is-error");
    return;
  }

  compareButton.disabled = true;
  comparisonStatus.classList.remove("is-error");
  comparisonStatus.textContent = "Comparando as condições atuais...";
  comparisonResults.replaceChildren();

  try {
    const forecasts = await Promise.all([fetchForecast(firstCity), fetchForecast(secondCity)]);
    if (forecasts.some((forecast) => !forecast.current)) {
      throw new Error("Não foi possível carregar os dados das duas cidades.");
    }

    comparisonResults.replaceChildren(
      renderComparisonCard(firstCity, forecasts[0]),
      renderComparisonCard(secondCity, forecasts[1]),
    );
    comparisonStatus.textContent = "";
  } catch (error) {
    comparisonStatus.textContent = error instanceof TypeError
      ? "Não foi possível conectar ao serviço de previsão. Verifique sua internet e tente novamente."
      : error.message;
    comparisonStatus.classList.add("is-error");
  } finally {
    compareButton.disabled = false;
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const cityName = cityInput.value.trim();
  if (!cityName) {
    setStatus("Digite o nome de uma cidade para consultar.", "error");
    cityInput.focus();
    return;
  }

  clearTimeout(suggestionTimer);
  suggestionRequest?.abort();
  closeSuggestions();
  setLoading(true);
  setStatus("Buscando a previsão do tempo...", "loading");

  try {
    const city = selectedCity?.name === cityName
      ? selectedCity
      : (await findCity(cityName))[0];
    if (!city) {
      weatherSection.hidden = true;
      welcomeCard.hidden = false;
      setStatus("Não encontramos essa cidade. Confira o nome e tente novamente.", "error");
      return;
    }

    await loadCityWeather(city);
  } catch (error) {
    weatherSection.hidden = true;
    welcomeCard.hidden = false;
    setStatus(
      error instanceof TypeError
        ? "Não foi possível conectar ao serviço de previsão. Verifique sua internet e tente novamente."
        : error.message,
      "error",
    );
  } finally {
    setLoading(false);
  }
});

renderActivity();
