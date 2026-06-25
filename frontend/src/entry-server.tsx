import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { Landing } from './pages/Landing';

/**
 * Build-time SSG: render the public Landing page to static HTML so crawlers (and
 * no-JS clients) get the full content + FAQ in the initial response, not an empty
 * <div id="root">. Used by scripts/prerender.mjs. Landing is purely presentational
 * (no browser APIs at render), so renderToStaticMarkup is safe and browser-free.
 */
export function renderLanding(): string {
  return renderToStaticMarkup(
    <StaticRouter location="/">
      <Landing />
    </StaticRouter>,
  );
}
