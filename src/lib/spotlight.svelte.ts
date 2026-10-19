import { createContext } from 'svelte';

/** The gauge someone's pointing at, on the map or in the rail, so the other can light it up */
export class Spotlight {
  id = $state<string>();
}

export const [useSpotlight, provideSpotlight] = createContext<Spotlight>();
