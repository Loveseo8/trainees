(() => {
  "use strict";
  const catalog = window.TRAINERS_DATA || {};
  let section = "cosmetology";
  let selectedCity = "";
  let mapRoot = null;
  let mapPointSeries = null;
  let deferredPrompt = null;

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const el = {
    federal: $("#federalGrid"), regional: $("#regionalGrid"), template: $("#trainerCardTemplate"),
    search: $("#searchInput"), district: $("#districtFilter"), cityChips: $("#cityChips"), regionChips: $("#regionChips"),
    fallbackCities: $("#fallbackCities"), mapFallback: $("#mapFallback"), map: $("#map"),
    regionTitle: $("#regionTitle"), regionalCount: $("#regionalCount"), manager: $("#managerCard"),
    clearCity: $("#clearCity"), empty: $("#emptyState"), dialog: $("#trainerDialog"),
    dialogContent: $("#dialogContent"), dialogClose: $("#dialogClose"), install: $("#installButton"),
    installDialog: $("#installDialog"), installDialogClose: $("#installDialogClose"),
    installDialogOk: $("#installDialogOk"), installInstructions: $("#installInstructions"),
  };
  const clean = (value) => String(value || "").trim();
  const normalize = (value) => clean(value).toLocaleLowerCase("ru-RU").replace(/ё/g, "е");
  const displayDegree = (value) => /^(нет|нет данных|другое|-|—)$/i.test(clean(value)) ? "" : clean(value);
  const initials = (name) => clean(name).split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("");
  const data = () => catalog[section] || { trainers: [], managers: [] };
  const managerIdsFor = (trainer) => trainer.managerIds?.length ? trainer.managerIds : (trainer.managerId ? [trainer.managerId] : []);
  const managersFor = (trainer) => managerIdsFor(trainer).map((id) => data().managers.find((item) => item.id === id)).filter(Boolean);
  const federalDistrictRegions = {
    "ЦФО": ["RU-BEL","RU-BRY","RU-VLA","RU-IVA","RU-KLU","RU-KOS","RU-LIP","RU-ORL","RU-RYA","RU-SMO","RU-TAM","RU-TVE","RU-TUL","RU-YAR"],
    "МОСКВА И МО": ["RU-MOW","RU-MOS"],
    "СЗФО": ["RU-KR","RU-KO","RU-ARK","RU-VLG","RU-KGD","RU-LEN","RU-MUR","RU-NEN","RU-NGR","RU-PSK","RU-SPE"],
    "СФО": ["RU-ALT","RU-AL","RU-IRK","RU-KEM","RU-KYA","RU-NVS","RU-TY","RU-ZAB"],
    "УРФО": ["RU-PER","RU-SVE","RU-CHE","RU-KIR","RU-UD"],
    "ПФО": ["RU-SAM","RU-VGG","RU-AST","RU-SAR","RU-PNZ","RU-ROS","RU-VOR","RU-KRS"],
    "ДВО": ["RU-AMU","RU-BU","RU-CHU","RU-KAM","RU-MAG","RU-PRI","RU-SA","RU-SAK","RU-KHA","RU-YEV"],
    "ЮФО": ["RU-AD","RU-KDA","RU-KL","RU-SEV","RU-CR","RU-DA","RU-IN","RU-KB","RU-KC","RU-SE","RU-CE","RU-STA"],
    "ЯНАО, ХМАО": ["RU-KGN","RU-TYU","RU-KHM","RU-YAN","RU-OMS"],
    "Нижний Новгород, Казань, Уфа": ["RU-NIZ","RU-TA","RU-BA"],
  };
  const districtByRegion = Object.fromEntries(
    Object.entries(federalDistrictRegions).flatMap(([district, ids]) => ids.map((id) => [id, district])),
  );
  const districtColors = {
    "ЦФО": { active: 0xf1c5cd, inactive: 0xe4dfdc },
    "СЗФО": { active: 0xf5d1d7, inactive: 0xeee9e6 },
    "ЮФО": { active: 0xedbbc4, inactive: 0xddd8d5 },
    "СКФО": { active: 0xf7d9de, inactive: 0xebe6e3 },
    "ПФО": { active: 0xf0c2ca, inactive: 0xe2ddda },
    "МОСКВА И МО": { active: 0xf4ccd3, inactive: 0xe9e4e1 },
    "УРФО": { active: 0xf4ccd3, inactive: 0xe9e4e1 },
    "СФО": { active: 0xeebdc6, inactive: 0xded9d6 },
    "ДВО": { active: 0xf6d4da, inactive: 0xe7e2df },
    "ЯНАО, ХМАО": { active: 0xedbbc4, inactive: 0xe7e2df },
    "Нижний Новгород, Казань, Уфа": { active: 0xf1c5cd, inactive: 0xe7e2df },
  };
  const districtByCity = {
    "Москва":"ЦФО", "Санкт-Петербург":"СЗФО", "Самара":"ПФО", "Ростов-на-Дону":"ЮФО",
    "Новосибирск":"СФО", "Екатеринбург":"УрФО", "Нижний Новгород":"ПФО", "Воронеж":"ЦФО",
    "Уфа":"ПФО", "Барнаул":"СФО", "Владивосток":"ДФО", "Красноярск":"СФО",
    "Киров":"ПФО", "Краснодар":"ЮФО", "Астрахань":"ЮФО", "Ижевск":"ПФО",
    "Кемерово":"СФО", "Омск":"СФО", "Пермь":"ПФО", "Иркутск":"СФО",
    "Тюмень":"УрФО",
  };
  const trainerDistrict = (trainer) => districtByCity[trainer.city] || trainer.district;
  const trainerRegion = (trainer) => clean(trainer.region) || "Регион не указан";

  function setPhoto(container, trainer, imageSelector = "img") {
    const img = container.querySelector(imageSelector);
    const fallback = container.querySelector("span");
    if (fallback) fallback.textContent = initials(trainer.name);
    if (!trainer.photo) { if (img) img.classList.add("is-broken"); return; }
    img.src = trainer.photo;
    img.alt = trainer.name;
    img.addEventListener("error", () => img.classList.add("is-broken"), { once: true });
  }

  function shortSummary(trainer) {
    return trainer.credentials || trainer.workplace || "Сертифицированный тренер компании ИНГАЛ";
  }

  function openTrainer(trainer) {
    const managers = managersFor(trainer);
    el.dialogContent.innerHTML = `
      <div class="dialog-layout">
        <div class="dialog-photo"><img alt=""><span>${initials(trainer.name)}</span></div>
        <div class="dialog-copy">
          <div class="trainer-tags"><span class="level-tag">${trainer.level}</span><span class="city-tag">${trainer.city}</span></div>
          <h2>${trainer.name}</h2>
          <p class="dialog-place">${[trainer.specialty, displayDegree(trainer.degree)].filter(Boolean).join(" · ")}</p>
          ${trainer.credentials ? `<h4>Профессиональный профиль</h4><p>${trainer.credentials}</p>` : ""}
          ${trainer.workplace ? `<h4>Место работы</h4><p>${trainer.workplace}</p>` : ""}
          ${managers.length ? `<div class="dialog-manager"><small>${managers.length === 1 ? "Региональный менеджер" : "Региональные менеджеры"}</small>${managers.map((manager) => `<div><strong>${manager.name}</strong></div>`).join("")}</div>` : ""}
        </div>
      </div>`;
    setPhoto(el.dialogContent.querySelector(".dialog-photo"), trainer);
    el.dialog.showModal();
  }

  function renderFederal() {
    el.federal.innerHTML = "";
    const federal = data().trainers.filter((trainer) => trainer.level === "Федеральный");
    if (!federal.length) {
      el.federal.innerHTML = `<div class="empty-state federal-empty">В этом направлении федеральные тренеры пока не указаны.</div>`;
      return;
    }
    federal.forEach((trainer) => {
      const card = el.template.content.firstElementChild.cloneNode(true);
      card.querySelector("h3").textContent = trainer.name;
      card.querySelector(".level-tag").textContent = "Федеральный";
      card.querySelector(".city-tag").textContent = trainer.city;
      card.querySelector(".trainer-role").textContent = [trainer.specialty, displayDegree(trainer.degree)].filter(Boolean).join(" · ");
      card.querySelector(".trainer-summary").textContent = shortSummary(trainer);
      setPhoto(card.querySelector(".trainer-photo"), trainer);
      card.querySelector(".card-button").addEventListener("click", () => openTrainer(trainer));
      el.federal.append(card);
    });
  }

  function filteredRegional() {
    const query = normalize(el.search.value);
    const district = el.district.value;
    return data().trainers.filter((trainer) => trainer.level === "Региональный")
      .filter((trainer) => !selectedCity || trainer.city === selectedCity)
      .filter((trainer) => !district || trainerRegion(trainer) === district)
      .filter((trainer) => !query || normalize([trainer.name, trainer.city, trainer.specialty, trainer.credentials].join(" ")).includes(query));
  }

  function renderManager(items) {
    if (!selectedCity && !el.district.value) {
      el.manager.hidden = true;
      return;
    }

    const managerIds = [...new Set(items.flatMap(managerIdsFor))];
    let managers = managerIds.map((id) => data().managers.find((item) => item.id === id)).filter(Boolean);
    if (el.district.value) {
      managers = data().managers.filter((manager) => manager.region === el.district.value);
    }
    if (!managers.length) { el.manager.hidden = true; return; }
    el.manager.innerHTML = `<small>${managers.length === 1 ? "Региональный менеджер" : "Региональные менеджеры"}</small>${managers.map((manager) => `<div class="manager-entry"><strong>${manager.name}</strong>${manager.territory ? `<p>${manager.territory}</p>` : ""}</div>`).join("")}`;
    el.manager.hidden = false;
  }

  function renderRegional() {
    const items = filteredRegional();
    el.regional.innerHTML = "";
    items.forEach((trainer) => {
      const row = document.createElement("article");
      row.className = "regional-row";
      row.tabIndex = 0;
      row.innerHTML = `<div class="regional-avatar"><img alt=""><span>${initials(trainer.name)}</span></div><div><h4>${trainer.name}</h4><p>${trainer.city} · ${trainer.specialty || "Тренер ИНГАЛ"}</p></div><b>→</b>`;
      setPhoto(row.querySelector(".regional-avatar"), trainer);
      row.addEventListener("click", () => openTrainer(trainer));
      row.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") openTrainer(trainer); });
      el.regional.append(row);
    });
    const selectedDistrict = el.district.value;
    const districtExists = !selectedDistrict || data().trainers.some((trainer) => trainer.level === "Региональный" && trainerRegion(trainer) === selectedDistrict) || data().managers.some((manager) => manager.region === selectedDistrict);
    el.regionalCount.textContent = districtExists ? `${items.length} ${items.length === 1 ? "тренер" : items.length < 5 ? "тренера" : "тренеров"}` : "";
    el.empty.hidden = items.length > 0 || !districtExists;
    el.regionTitle.textContent = selectedCity || (el.district.value ? el.district.options[el.district.selectedIndex].text : "Все города");
    el.clearCity.hidden = !selectedCity && !el.district.value && !el.search.value;
    renderManager(items);
  }

  function regionalCities() {
    return [...new Set(data().trainers.filter((item) => item.level === "Региональный").map((item) => item.city).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ru"));
  }

  function selectCity(city) {
    selectedCity = city;
    el.district.value = "";
    $$(".city-chips button").forEach((button) => button.classList.toggle("is-active", button.dataset.city === city));
    $$(".region-chips button").forEach((button) => button.classList.remove("is-active"));
    renderRegional();
  }

  function selectDistrict(district) {
    selectedCity = "";
    el.search.value = "";
    el.district.value = district;
    $$(".city-chips button").forEach((button) => button.classList.remove("is-active"));
    $$(".region-chips button").forEach((button) => button.classList.toggle("is-active", button.dataset.district === district));
    renderRegional();
  }

  function renderFilters() {
    const districts = [...new Set([...data().managers.map((manager) => manager.region), ...data().trainers.filter((trainer) => trainer.level === "Региональный").map(trainerRegion)].filter(Boolean))];
    const activeDistricts = districts;
    el.district.innerHTML = `<option value="">Все регионы</option>${activeDistricts.map((item) => `<option value="${item}">${item}</option>`).join("")}`;
    el.regionChips.innerHTML = activeDistricts.map((district) => `<button data-district="${district}">${district}</button>`).join("");
    const chips = regionalCities().map((city) => `<button data-city="${city}">${city}</button>`).join("");
    el.cityChips.innerHTML = chips;
    el.fallbackCities.innerHTML = chips;
    $$(".city-chips button").forEach((button) => button.addEventListener("click", () => selectCity(button.dataset.city)));
    $$(".region-chips button").forEach((button) => button.addEventListener("click", () => selectDistrict(button.dataset.district)));
  }

  function updateMetrics() {
    const trainers = data().trainers;
    $("#totalTrainers").textContent = trainers.length;
    $("#totalCities").textContent = new Set(trainers.map((item) => item.city).filter(Boolean)).size;
  }

  function initMap() {
    if (mapRoot) { mapRoot.dispose(); mapRoot = null; }
    if (!window.am5 || !window.am5map || !window.am5geodata_russiaLow) {
      el.map.hidden = true; el.mapFallback.hidden = false; return;
    }
    el.map.hidden = false; el.mapFallback.hidden = true;
    mapRoot = am5.Root.new("map");
    mapRoot._logo?.dispose();
    const chart = mapRoot.container.children.push(am5map.MapChart.new(mapRoot, {
      panX: "translateX", panY: "translateY", wheelY: "zoom", projection: am5map.geoMercator(),
    }));
    const polygonSeries = chart.series.push(am5map.MapPolygonSeries.new(mapRoot, { geoJSON: am5geodata_russiaLow }));
    polygonSeries.mapPolygons.template.setAll({
      fill: am5.color(0xf1c5cd), stroke: am5.color(0xf1c5cd), strokeWidth: 1.5,
      interactive: true, cursorOverStyle: "pointer", tooltipText: "{district}", templateField: "polygonSettings",
    });
    polygonSeries.mapPolygons.template.states.create("hover", {
      fill: am5.color(0xb3162d), strokeOpacity: 0, strokeWidth: 0,
    });
    const activeDistricts = new Set([...data().trainers.filter((item) => item.level === "Региональный").map(trainerRegion), ...data().managers.map((manager) => manager.region)]);
    polygonSeries.data.setAll(Object.entries(districtByRegion).map(([id, district]) => {
      return {
        id, district,
        polygonSettings: { fill: am5.color(0xf1c5cd), stroke: am5.color(0xf1c5cd), strokeWidth: 1.5 },
      };
    }));
    const setDistrictHover = (district, enabled) => {
      if (!district) return;
      polygonSeries.mapPolygons.each((polygon) => {
        if (polygon.dataItem?.dataContext?.district === district) {
          if (enabled) polygon.hover(); else polygon.unhover();
        }
      });
    };
    polygonSeries.mapPolygons.template.events.on("pointerover", (event) => {
      const district = event.target.dataItem?.dataContext?.district;
      if (activeDistricts.has(district)) setDistrictHover(district, true);
    });
    polygonSeries.mapPolygons.template.events.on("pointerout", (event) => {
      const district = event.target.dataItem?.dataContext?.district;
      if (activeDistricts.has(district)) setDistrictHover(district, false);
    });
    polygonSeries.mapPolygons.template.events.on("click", (event) => {
      const district = event.target.dataItem?.dataContext?.district;
      if (!district || !activeDistricts.has(district)) return;
      selectDistrict(district);
    });
    mapPointSeries = chart.series.push(am5map.MapPointSeries.new(mapRoot, {}));
    mapPointSeries.bullets.push((root, series, dataItem) => {
      const count = dataItem.dataContext.count;
      const container = am5.Container.new(root, { cursorOverStyle: "pointer", tooltipText: `{city}: ${count}` });
      container.children.push(am5.Circle.new(root, { radius: 15, fill: am5.color(0xffffff), stroke: am5.color(0xb3162d), strokeWidth: 2 }));
      container.children.push(am5.Circle.new(root, { radius: 6, fill: am5.color(0xb3162d) }));
      container.events.on("click", () => selectCity(dataItem.dataContext.city));
      return am5.Bullet.new(root, { sprite: container });
    });
    const regional = data().trainers.filter((item) => item.level === "Региональный" && item.coordinates);
    const cityData = regionalCities().map((city) => {
      const trainers = regional.filter((item) => item.city === city);
      const coordinates = trainers[0]?.coordinates;
      return coordinates ? { city, count: trainers.length, geometry: { type: "Point", coordinates } } : null;
    }).filter(Boolean);
    mapPointSeries.data.setAll(cityData);
    chart.appear(650, 80);
  }

  function switchSection(next) {
    section = next; selectedCity = ""; el.search.value = "";
    $$(".direction-tab, .map-direction-button").forEach((button) => { const active = button.dataset.section === next; button.classList.toggle("is-active", active); button.setAttribute("aria-selected", String(active)); });
    renderFederal(); renderFilters(); renderRegional(); updateMetrics(); initMap();
  }

  $$(".direction-tab, .map-direction-button").forEach((button) => button.addEventListener("click", () => switchSection(button.dataset.section)));
  el.search.addEventListener("input", renderRegional);
  el.district.addEventListener("change", () => selectDistrict(el.district.value));
  el.clearCity.addEventListener("click", () => {
    selectedCity = ""; el.search.value = ""; el.district.value = "";
    $$(".city-chips button, .region-chips button").forEach((button) => button.classList.remove("is-active"));
    renderRegional();
  });
  el.dialogClose.addEventListener("click", () => el.dialog.close());
  el.dialog.addEventListener("click", (event) => { if (event.target === el.dialog) el.dialog.close(); });
  const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  const showInstallHelp = () => {
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    el.installInstructions.innerHTML = isIOS
      ? `<p>На iPhone или iPad нажмите кнопку <strong>«Поделиться»</strong> в браузере Safari, затем выберите <strong>«На экран Домой»</strong> и подтвердите добавление.</p>`
      : `<p>Откройте меню браузера и выберите <strong>«Установить приложение»</strong> или <strong>«Добавить на главный экран»</strong>.</p>`;
    el.installDialog.showModal();
  };
  window.addEventListener("beforeinstallprompt", (event) => { event.preventDefault(); deferredPrompt = event; });
  window.addEventListener("appinstalled", () => { deferredPrompt = null; el.install.hidden = true; });
  el.install.addEventListener("click", async () => {
    if (isStandalone()) return;
    if (!deferredPrompt) { showInstallHelp(); return; }
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
  });
  [el.installDialogClose, el.installDialogOk].forEach((button) => button.addEventListener("click", () => el.installDialog.close()));
  el.installDialog.addEventListener("click", (event) => { if (event.target === el.installDialog) el.installDialog.close(); });
  if (isStandalone()) el.install.hidden = true;
  if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  switchSection(section);
})();
