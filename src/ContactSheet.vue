<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { orientationTransform, readJpegMeta, type JpegMeta } from "./exif";
import { host } from "./host";
import { cachedTree } from "./index-state";
import { entriesAt, picturesIn, ROOT, type Picture, type TreeEntry } from "./pictures";

/* One folder's pictures, in the editor area beside the files. The host owns the tab; this owns what is in it.
 *
 * Every thumbnail is a separate authenticated read of the file's bytes — there is no thumbnail service in the
 * daemon and this extension is not allowed to write one, so the honest design is: fetch a bounded number,
 * concurrently but not all at once, and say plainly when there are more. */

const props = defineProps<{ path: string }>();

// Bytes are fetched with an auth header, so the browser cannot be pointed at the file directly. A blob URL is
// the way in, and every one of them has to be revoked or the tab leaks the whole folder.
interface Tile {
    readonly picture: Picture;
    url?: string;
    meta?: JpegMeta;
    error?: string;
}

const tiles = ref<Tile[]>([]);
const total = ref(0);
const loading = ref(true);
const failure = ref<string | undefined>(undefined);

const settings = host().settings;
const size = computed(() => String(settings.get(`thumbnail`) ?? `medium`));
const limit = computed(() => Math.max(1, Number(settings.get(`limit`) ?? 120)));

const folderName = computed(() => (props.path === ROOT ? `Workspace root` : props.path.slice(props.path.lastIndexOf(`/`) + 1)));

const revokeAll = (): void => {
    for (const tile of tiles.value) {
        if (tile.url !== undefined) {
            URL.revokeObjectURL(tile.url);
        }
    }
};

// Four at a time: enough to fill the visible grid quickly, few enough that opening a sheet doesn't monopolise
// the daemon's request budget while the rest of the app is trying to work.
const CONCURRENCY = 4;
// EXIF lives in the first segments of a JPEG; reading a slice keeps a 12 MP original off the main thread's
// decode path for a field two dozen bytes long.
const META_BYTES = 128 * 1024;

const loadOne = async (tile: Tile): Promise<void> => {
    const response = await host().sandbox.request(`/workspace/raw?path=${encodeURIComponent(tile.picture.path)}`);
    if (!response.ok) {
        // 413 is the daemon's raw-read cap, which a 40 MB original really can hit. Naming it beats a broken
        // image icon that looks like a bug in this extension.
        tile.error = response.status === 413 ? `too large to preview` : `couldn't read (${response.status})`;
        return;
    }
    const blob = await response.blob();
    tile.url = URL.createObjectURL(blob);
    if (/\.jpe?g$/i.test(tile.picture.name)) {
        tile.meta = readJpegMeta(new Uint8Array(await blob.slice(0, META_BYTES).arrayBuffer()));
    }
};

const load = async (path: string): Promise<void> => {
    revokeAll();
    tiles.value = [];
    loading.value = true;
    failure.value = undefined;
    try {
        const entries: readonly TreeEntry[] =
            path === ROOT
                ? entriesAt(cachedTree(), ROOT)
                : (await host().sandbox.json<{ entries?: readonly TreeEntry[] }>(`/workspace/children?path=${encodeURIComponent(path)}`)).entries ?? [];
        const pictures = picturesIn(entries);
        total.value = pictures.length;
        tiles.value = pictures.slice(0, limit.value).map((picture) => ({ picture }));

        const queue = [...tiles.value];
        await Promise.all(
            Array.from({ length: CONCURRENCY }, async () => {
                for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
                    // One unreadable file must not stop the sheet: the tile says why and the rest keep loading.
                    await loadOne(next).catch(() => {
                        next.error = `couldn't read`;
                    });
                    // Reassigning is what Vue sees; the tiles themselves are mutated in place by the loader.
                    tiles.value = [...tiles.value];
                }
            }),
        );
    } catch (error) {
        failure.value = error instanceof Error ? error.message : String(error);
    } finally {
        loading.value = false;
    }
};

watch(() => props.path, (path) => void load(path), { immediate: true });
onBeforeUnmount(revokeAll);

const open = (picture: Picture): void => host().navigate(`/workspace/${picture.path}`);

const kilobytes = (bytes: number | undefined): string | undefined =>
    bytes === undefined ? undefined : bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} kB`;
</script>

<template>
    <div class="cs-page">
        <div class="cs-head">
            <span class="cs-title">{{ folderName }}</span>
            <span class="cs-muted">
                <template v-if="loading">Loading…</template>
                <template v-else-if="total > tiles.length">{{ tiles.length }} of {{ total }} pictures — raise "Pictures per folder" in Settings → Extensions</template>
                <template v-else>{{ total }} picture{{ total === 1 ? `` : `s` }}</template>
            </span>
        </div>

        <div v-if="failure" class="ui-card ui-card-dashed">
            <p class="cs-muted">Couldn't list this folder: {{ failure }}</p>
        </div>

        <div v-else :class="`cs-grid cs-grid-${size}`">
            <button v-for="tile in tiles" :key="tile.picture.path" class="cs-tile" type="button" @click="open(tile.picture)">
                <div class="cs-frame">
                    <img
                        v-if="tile.url"
                        :src="tile.url"
                        :alt="tile.picture.name"
                        loading="lazy"
                        :style="{ transform: orientationTransform(tile.meta?.orientation) }"
                    />
                    <span v-else class="cs-meta">{{ tile.error ?? `…` }}</span>
                </div>
                <div class="cs-caption">
                    <div class="cs-name" :title="tile.picture.name">{{ tile.picture.name }}</div>
                    <div class="cs-meta">{{ [tile.meta?.takenAt, kilobytes(tile.picture.size)].filter(Boolean).join(` · `) }}</div>
                </div>
            </button>
        </div>

        <p v-if="!loading && total === 0 && !failure" class="cs-note">
            No pictures directly in this folder. HEIC files aren't shown — no browser decodes them; convert them first.
        </p>
    </div>
</template>
