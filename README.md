# Contact sheet

Folders of pictures in your workspace, as pictures. The Workspace tree puts a small icon on any folder that
holds photos; clicking it opens a contact sheet as a tab beside the files: thumbnails, names, sizes, and the
date each photo was taken, in a grid you can actually look at. Click a tile to open the picture full size.

This is an [intentic](https://intentic.dev) extension, and a deliberately small one: the app's file tree is a
list of names, which is the right answer for source code and the wrong one for the folder your camera dumped
four hundred files into.

## What it does that a file list can't

- **Turns portrait photos the right way up.** Phones store the sensor's landscape frame plus a rotation flag;
  an `<img>` renders the frame. The sheet reads EXIF `Orientation` and rotates each tile accordingly.
- **Shows when the photo was taken**, from EXIF `DateTimeOriginal`: not when the file was copied, which is
  what a timestamp on disk means.
- **Sorts the way people count**: `IMG_2` before `IMG_10`.

HEIC files are not shown. No browser decodes them, so counting them would mean an icon that opens a sheet of
broken tiles; convert them first (any pack that puts a converter on the agent's PATH will do).

## What it is allowed to do

Three read-only routes, declared in the manifest and enforced by the host:

| Route | Why |
| --- | --- |
| `GET /workspace/tree` | Once at activation, then at most once a minute: the index of which folders hold pictures |
| `GET /workspace/children` | The folder you actually opened |
| `GET /workspace/raw` | The bytes of each thumbnail |

It writes nothing, and it cannot reach any other part of the daemon: a call outside that list throws before it
leaves the browser.

Thumbnails are full-size reads: there is no thumbnail service in the daemon, and an extension is not allowed
to add one. So a sheet loads a bounded number of pictures (**Settings → Extensions → Pictures per folder**,
120 by default), four at a time, and says plainly when there are more.

## Install

**Capabilities → Add → Extension**, then the repo URL and a full 40-character commit sha.

## Build it yourself

```sh
pnpm install
pnpm typecheck
pnpm test              # the folder index and the EXIF reader, then the built bundle against a host stub
pnpm build         # dist/extension.js — one file, vue as the only import
```

`dist/extension.js` is committed: it is what `entry` points at and what the owner's sandbox clones, and there
is no build step at install time. Rebuild it in the same commit as any source change.

## Notes for anyone reading the source

- **`detect()` is a lookup, never a fetch.** The tree asks it for every visible directory row on every render,
  so the answer comes out of a `path → count` map built from one tree read and held in module state
  (`src/index-state.ts`). Because that state is a `ref`, the tree repaints itself when the index lands.
- **Re-reading is throttled to a minute.** The trigger available here is the facts poll behind
  `workspace.onDidChange`, which fires far more often than photo folders appear; no `contributes.files` prefix
  could express "a picture appeared somewhere", so a throttle is the honest substitute.
- **A folder is judged by what is directly in it**, not recursively: otherwise every parent up to the
  workspace root would claim to be a photo folder because something deep inside it is.
- **One known gap in the SDK, worked around in `src/extension.ts`:** `api.documents.open` (used by the palette
  command for the workspace root, which has no tree row of its own) exists on the host but is missing from the
  published `@intentic/extension-api@1.176.3` types, and the protocol version in `engines.intentic` did not
  move when it was added. The command feature-detects instead of assuming.

MIT licensed. No warranty, and nobody has audited it but its author.
