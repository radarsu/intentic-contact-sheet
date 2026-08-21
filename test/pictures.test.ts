import assert from "node:assert/strict";
import { test } from "node:test";
import { orientationTransform, readJpegMeta } from "../src/exif.ts";
import { entriesAt, indexPictureFolders, isPicture, picturesIn, ROOT, type TreeEntry } from "../src/pictures.ts";

/* The two pure halves: which folders earn an icon, and what a JPEG says about itself. Node's own runner, no
 * test dependency: node 24 strips the types, so these run straight off src/ with nothing built. */

const file = (path: string, size?: number): TreeEntry => ({ name: path.slice(path.lastIndexOf(`/`) + 1), path, type: `file`, size });
const dir = (path: string, children: TreeEntry[], ignored?: boolean): TreeEntry => ({
    name: path.slice(path.lastIndexOf(`/`) + 1),
    path,
    type: `dir`,
    children,
    ignored,
});

test(`only browser-decodable pictures count`, () => {
    assert.equal(isPicture(`IMG_0001.JPG`), true);
    assert.equal(isPicture(`scan.webp`), true);
    // HEIC is deliberately out: no browser decodes it, so a folder of iPhone originals must not claim a sheet.
    assert.equal(isPicture(`IMG_0002.HEIC`), false);
    assert.equal(isPicture(`notes.txt`), false);
    assert.equal(isPicture(`.png`), false);
});

test(`a folder is indexed by what sits DIRECTLY in it`, () => {
    const tree = [
        file(`cover.png`),
        dir(`trip`, [file(`trip/a.jpg`), file(`trip/b.jpg`), dir(`trip/raw`, [file(`trip/raw/c.png`)])]),
        dir(`docs`, [file(`docs/notes.md`)]),
    ];
    const index = indexPictureFolders(tree);

    // The workspace root has a loose picture of its own.
    assert.equal(index.get(ROOT), 1);
    assert.equal(index.get(`trip`), 2);
    // Nesting does not bubble up: `trip` must not claim its subfolder's picture, or every parent up to the
    // root would offer a sheet of pictures that are not in it.
    assert.equal(index.get(`trip/raw`), 1);
    assert.equal(index.get(`docs`), undefined);
});

test(`ignored subtrees are skipped whole`, () => {
    const index = indexPictureFolders([dir(`node_modules`, [file(`node_modules/pkg/logo.png`)], true)]);
    assert.equal(index.size, 0);
});

test(`pictures sort the way a person counts, not the way bytes do`, () => {
    const sorted = picturesIn([file(`trip/IMG_10.jpg`), file(`trip/IMG_2.jpg`), file(`trip/notes.txt`), file(`trip/IMG_1.jpg`)]);
    assert.deepEqual(
        sorted.map((picture) => picture.name),
        [`IMG_1.jpg`, `IMG_2.jpg`, `IMG_10.jpg`],
    );
});

test(`the root's entries come out of the cached tree, since /workspace/children has no path for it`, () => {
    const tree = [dir(`trip`, [file(`trip/a.jpg`)]), file(`cover.png`)];
    assert.equal(entriesAt(tree, ROOT).length, 2);
    assert.deepEqual(
        entriesAt(tree, `trip`).map((entry) => entry.path),
        [`trip/a.jpg`],
    );
    assert.deepEqual(entriesAt(tree, `nope`), []);
});

test(`exif: orientation and taken-date are read out of a JPEG's APP1 segment`, () => {
    const meta = readJpegMeta(buildJpeg({ orientation: 6, taken: `2026:08:03 14:22:07` }));
    assert.deepEqual({ ...meta }, { orientation: 6, takenAt: `2026-08-03 14:22` });
});

test(`exif: a file that is not a JPEG, or has no APP1, yields nothing rather than a guess`, () => {
    assert.deepEqual(readJpegMeta(new Uint8Array([0x89, 0x50, 0x4e, 0x47])), {});
    // SOI, then straight to a scan: a JPEG with no metadata at all.
    assert.deepEqual(readJpegMeta(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0x00, 0x02])), {});
    // An orientation outside 1–8 is corrupt; the picture renders unrotated rather than transformed by garbage.
    assert.equal(readJpegMeta(buildJpeg({ orientation: 42 })).orientation, undefined);
});

test(`exif: every rotation and mirror maps to a transform, and 1 to none`, () => {
    assert.equal(orientationTransform(1), undefined);
    assert.equal(orientationTransform(undefined), undefined);
    assert.equal(orientationTransform(6), `rotate(90deg)`);
    assert.equal(orientationTransform(5), `rotate(90deg) scaleX(-1)`);
});

/* A structurally real JPEG head: SOI, then an APP1 holding "Exif\0\0", a little-endian TIFF header, an IFD0
 * with an orientation and a pointer to an Exif IFD, and DateTimeOriginal in that sub-IFD. Hand-built rather
 * than a checked-in binary: the offsets ARE what is being tested, and a blob nobody can read in a diff would
 * make this test unmaintainable. */
const buildJpeg = ({ orientation, taken }: { orientation?: number; taken?: string }): Uint8Array => {
    const ifd0Entries = [orientation === undefined ? undefined : `orientation`, taken === undefined ? undefined : `exifPointer`].filter(
        (entry): entry is string => entry !== undefined,
    );
    const tiffLength = 8 + (2 + ifd0Entries.length * 12 + 4) + (taken === undefined ? 0 : 2 + 12 + 4 + 20);
    // The APP1 length field counts itself and the "Exif\0\0" preamble, but not the two marker bytes.
    const app1Length = 2 + 6 + tiffLength;
    const bytes = new Uint8Array(4 + app1Length);
    const view = new DataView(bytes.buffer);

    bytes.set([0xff, 0xd8, 0xff, 0xe1], 0);
    view.setUint16(4, app1Length);
    bytes.set([0x45, 0x78, 0x69, 0x66, 0, 0], 6); // "Exif\0\0"

    const tiff = 12;
    view.setUint16(tiff, 0x4949); // little-endian
    view.setUint16(tiff + 2, 42, true);
    view.setUint32(tiff + 4, 8, true); // IFD0 sits straight after the header

    const ifd0 = tiff + 8;
    view.setUint16(ifd0, ifd0Entries.length, true);
    const exifIfd = ifd0 + 2 + ifd0Entries.length * 12 + 4;
    ifd0Entries.forEach((kind, index) => {
        const entry = ifd0 + 2 + index * 12;
        if (kind === `orientation`) {
            view.setUint16(entry, 0x0112, true);
            view.setUint16(entry + 2, 3, true); // SHORT
            view.setUint32(entry + 4, 1, true);
            view.setUint16(entry + 8, orientation as number, true);
            return;
        }
        view.setUint16(entry, 0x8769, true); // Exif IFD pointer
        view.setUint16(entry + 2, 4, true); // LONG
        view.setUint32(entry + 4, 1, true);
        view.setUint32(entry + 8, exifIfd - tiff, true); // offsets are relative to the TIFF header
    });

    if (taken !== undefined) {
        view.setUint16(exifIfd, 1, true);
        const entry = exifIfd + 2;
        const stringAt = exifIfd + 2 + 12 + 4;
        view.setUint16(entry, 0x9003, true); // DateTimeOriginal
        view.setUint16(entry + 2, 2, true); // ASCII
        view.setUint32(entry + 4, 20, true);
        view.setUint32(entry + 8, stringAt - tiff, true);
        bytes.set([...taken].map((char) => char.charCodeAt(0)), stringAt);
    }
    return bytes;
};
