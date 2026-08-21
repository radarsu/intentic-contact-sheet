import type { IntenticApi } from "@intentic/extension-api";

/* The activated host handle. `activate(api)` binds it once, before anything can render: the document provider
 * is registered during activate and its component mounts later: so the modules below reach the authenticated
 * daemon transport without an ambient global. There is none to reach for: the host passes the api in as an
 * argument precisely so an extension cannot acquire more reach than the manifest it was approved under. */
let current: IntenticApi | undefined;

export const bindHost = (api: IntenticApi): void => {
    current = api;
};

export const host = (): IntenticApi => {
    if (current === undefined) {
        throw new Error(`intentic.contact-sheet: host() called before activate()`);
    }
    return current;
};
