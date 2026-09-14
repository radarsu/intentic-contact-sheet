import type { Disposable } from "@intentic/extension-api";
import { shallowRef } from "vue";
import { host } from "./host";
import { indexPictureFolders, type TreeEntry } from "./pictures";

/* WHICH FOLDERS HAVE PICTURES IN THEM: module state, owned by activate(). */

const folders = shallowRef<ReadonlyMap<string, number>>(new Map());
const tree = shallowRef<readonly TreeEntry[]>([]);

// How many pictures sit directly in this folder, or undefined when it isn't one. Reactive: called inside the
// host's render, so reading the ref here is what repaints the tree.
export const pictureCount = (path: string): number | undefined => folders.value.get(path);

// The last tree read, for the one directory /workspace/children cannot serve: the root, whose path is empty.
export const cachedTree = (): readonly TreeEntry[] => tree.value;

/* Re-reading is throttled because the trigger is not a file event. */
const MIN_INTERVAL_MS = 60_000;
let lastRead = 0;
let inFlight: Promise<void> | undefined;

const read = async (): Promise<void> => {
    const response = await host().sandbox.json<{ tree?: readonly TreeEntry[] }>(`/workspace/tree`);
    const entries = response.tree ?? [];
    tree.value = entries;
    folders.value = indexPictureFolders(entries);
};

export const refreshIndex = async (now: number, force = false): Promise<void> => {
    if (!force && now - lastRead < MIN_INTERVAL_MS) {
        return;
    }
    if (inFlight !== undefined) {
        return inFlight;
    }
    lastRead = now;
    // A failed read leaves the previous index in place: stale icons are better than a tree that loses its
    // affordances because the daemon blinked.
    inFlight = read().catch(() => undefined);
    await inFlight;
    inFlight = undefined;
};

export const startIndex = (): Disposable => {
    const api = host();
    void refreshIndex(Date.now(), true);
    const subscription = api.workspace.onDidChange(() => {
        if (api.sandbox.reachable()) {
            void refreshIndex(Date.now());
        }
    });
    return { dispose: (): void => subscription.dispose() };
};
