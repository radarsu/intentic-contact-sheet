import type { Disposable } from "@intentic/extension-api";

/* One stylesheet, added by activate() and removed when the extension is switched off. An SFC <style> block
 * would be emitted by vite's library build as a separate CSS asset, and the host imports a single JS file from
 * a blob URL: nothing would ever fetch it. Built on the design system's role tokens, so the sheet follows the
 * light/dark theme without knowing which is on. */

const SHEET = `
.cs-page { padding: 1rem 1.25rem 2rem; color: var(--color-content); }
.cs-head { display: flex; align-items: baseline; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 0.9rem; }
.cs-title { font-size: 1.05rem; font-weight: 600; }
.cs-muted { color: var(--color-muted); font-size: 0.78rem; }
.cs-grid { display: grid; gap: 0.75rem; }
.cs-grid-small { grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); }
.cs-grid-medium { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); }
.cs-grid-large { grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); }
.cs-tile {
    display: block; width: 100%; padding: 0; border: 1px solid var(--color-line); border-radius: 0.5rem;
    background: transparent; color: inherit; overflow: hidden; cursor: pointer; text-align: left; font: inherit;
}
.cs-tile:hover { border-color: color-mix(in srgb, var(--color-content) 45%, transparent); }
.cs-tile:focus-visible { outline: 2px solid color-mix(in srgb, var(--color-content) 45%, transparent); outline-offset: 2px; }
.cs-frame {
    display: flex; align-items: center; justify-content: center; aspect-ratio: 1; overflow: hidden;
    background: color-mix(in srgb, var(--color-content) 5%, transparent);
}
.cs-frame img { max-width: 100%; max-height: 100%; object-fit: contain; display: block; }
.cs-caption { padding: 0.35rem 0.5rem 0.45rem; border-top: 1px solid color-mix(in srgb, var(--color-line) 60%, transparent); }
.cs-name { font-size: 0.75rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cs-meta { font-size: 0.68rem; color: var(--color-muted); }
.cs-note { color: var(--color-muted); font-size: 0.8rem; margin-top: 1rem; }
`;

export const installStyles = (): Disposable => {
    const element = document.createElement(`style`);
    element.dataset.owner = `intentic.contact-sheet`;
    element.textContent = SHEET;
    document.head.append(element);
    return { dispose: (): void => element.remove() };
};
