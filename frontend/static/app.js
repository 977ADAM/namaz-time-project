const form = document.querySelector("#prayer-form");
const dateInput = document.querySelector("#date-input");
const statusEl = document.querySelector("#status");
const titleEl = document.querySelector("#result-title");
const metaEl = document.querySelector("#result-meta");
const timingsEl = document.querySelector("#timings");

dateInput.value = new Date().toISOString().slice(0, 10);

const labelMap = {
  fajr: "Fajr",
  sunrise: "Sunrise",
  dhuhr: "Dhuhr",
  asr: "Asr",
  maghrib: "Maghrib",
  isha: "Isha",
};

function renderTimings(timings) {
  timingsEl.innerHTML = "";

  Object.entries(timings).forEach(([key, value]) => {
    const card = document.createElement("article");
    card.className = "timing-card";
    card.innerHTML = `
      <span class="timing-name">${labelMap[key] || key}</span>
      <span class="timing-value">${value}</span>
    `;
    timingsEl.appendChild(card);
  });
}

async function loadPrayerTimes(event) {
  event.preventDefault();
  const formData = new FormData(form);
  const params = new URLSearchParams(formData);

  statusEl.textContent = "Loading prayer times...";
  timingsEl.innerHTML = "";

  try {
    const response = await fetch(`/v1/prayer-times?${params.toString()}`);
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.detail || "Failed to load prayer times");
    }

    titleEl.textContent = payload.date.readable || payload.requested_date;
    metaEl.textContent = `${payload.meta.timezone} • method ${formData.get("method")} • school ${formData.get("school")}`;
    statusEl.textContent = "Prayer times loaded.";
    renderTimings(payload.timings);
  } catch (error) {
    titleEl.textContent = "Request failed";
    metaEl.textContent = "Please check the coordinates or try again later.";
    statusEl.textContent = error.message;
  }
}

form.addEventListener("submit", loadPrayerTimes);
