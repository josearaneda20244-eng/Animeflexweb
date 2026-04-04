// Ads are now handled exclusively through the <AdBanner> React component.
// Pop-under / script-based ads have been removed.
// To connect a real ad provider (Google AdSense, Adsterra, etc.)
// edit the <AdBanner> component in src/components/AdBanner.tsx.

export function setAdsBlocked(_blocked: boolean): void {}
export function onAnimeClick(): void {}
export function onEpisodeClick(): void {}
export function onEpisodeWatched(): void {}
