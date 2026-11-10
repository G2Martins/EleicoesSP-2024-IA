import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideClientHydration, withEventReplay, withIncrementalHydration } from '@angular/platform-browser';

// ponytail: one page, no router. SSR prerenders "/" when no routes exist.
// Incremental hydration: Dashboard and Modelo stay static HTML until scrolled into view (less main-thread work at load).
export const appConfig: ApplicationConfig = {
  providers: [provideBrowserGlobalErrorListeners(), provideClientHydration(withEventReplay(), withIncrementalHydration())],
};
