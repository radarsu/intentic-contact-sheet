import { hostSlot } from "@intentic/extension-api";

/* The activated host handle. `activate(api)` binds it once, before anything can render: the document provider
 * is registered during activate and its component mounts later, so the modules below reach the authenticated
 * daemon transport without an ambient global. There is none to reach for: the host passes the api in as an
 * argument precisely so an extension cannot acquire more reach than the manifest it was approved under.
 *
 * The slot itself is the SDK's (`hostSlot`, from 1.228.3), not a copy: a factory rather than one shared module
 * handle because the host publishes ONE instance of that module to every bundle, so a slot at module scope
 * would be a global the last extension to activate takes over. */
export const { bindHost, host } = hostSlot(`intentic.contact-sheet`);
