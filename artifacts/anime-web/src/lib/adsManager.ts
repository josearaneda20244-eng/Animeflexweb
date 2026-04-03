const STORAGE_KEY = "animeflex_ads";
const COOLDOWN_MS = 45_000;
const EPISODES_PER_CYCLE = 3;
const ADS_PER_CYCLE = 2;
const INTER_AD_DELAY_MS = 50_000;

interface AdsState {
  episodesWatched: number;
  lastAdTime: number;
}

function loadState(): AdsState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) return { episodesWatched: 0, lastAdTime: 0, ...JSON.parse(raw) };
  } catch {}
  return { episodesWatched: 0, lastAdTime: 0 };
}

function saveState(state: AdsState): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

let scriptReady = false;
let scriptLoading = false;
const pendingCallbacks: Array<() => void> = [];

function loadMonetagScript(onReady: () => void): void {
  if (scriptReady) {
    onReady();
    return;
  }
  pendingCallbacks.push(onReady);
  if (scriptLoading) return;
  scriptLoading = true;

  const script = document.createElement("script");
  script.src = "https://quge5.com/88/tag.min.js";
  script.setAttribute("data-zone", "225958");
  script.setAttribute("data-cfasync", "false");
  script.async = true;
  script.onload = () => {
    scriptReady = true;
    scriptLoading = false;
    const cbs = pendingCallbacks.splice(0);
    cbs.forEach((cb) => cb());
  };
  script.onerror = () => {
    scriptLoading = false;
    pendingCallbacks.length = 0;
  };
  document.head.appendChild(script);
}

function fireMonetag(): void {
  loadMonetagScript(() => {
    setTimeout(() => {
      try {
        const fn = (window as Record<string, unknown>)["show_225958"];
        if (typeof fn === "function") (fn as () => void)();
      } catch {}
    }, 300);
  });
}

function showAdControlled(state: AdsState): boolean {
  const now = Date.now();
  if (now - state.lastAdTime < COOLDOWN_MS) return false;
  state.lastAdTime = now;
  saveState(state);
  fireMonetag();
  return true;
}

function scheduleAds(count: number): void {
  for (let i = 0; i < count; i++) {
    const delay = i === 0 ? 500 : i * INTER_AD_DELAY_MS;
    setTimeout(() => {
      const state = loadState();
      showAdControlled(state);
    }, delay);
  }
}

export function onAnimeClick(): void {
  scheduleAds(1);
}

export function onEpisodeClick(): void {
  const state = loadState();
  showAdControlled(state);
}

export function onEpisodeWatched(): void {
  const state = loadState();
  state.episodesWatched += 1;
  saveState(state);

  if (state.episodesWatched % EPISODES_PER_CYCLE === 0) {
    scheduleAds(ADS_PER_CYCLE);
  }
}
