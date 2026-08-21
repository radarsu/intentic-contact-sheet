/* The two EXIF fields a contact sheet cannot do without: which way up the picture goes, and when it was taken.
 *
 * Orientation is not a nicety. A phone writes its sensor's native landscape frame and a rotation flag beside
 * it; an <img> renders the frame. Without reading the flag, every portrait photo in the sheet lies on its side,
 * which is exactly the folder people open a contact sheet for. And a file's own timestamp is the date it was
 * copied, so the taken-date has to come from the picture or not at all.
 *
 * Only JPEG, which is where these live in practice. Everything else yields nothing and renders unrotated. */

export interface JpegMeta {
    // EXIF orientation 1–8; absent when the file doesn't say.
    readonly orientation?: number;
    // "YYYY-MM-DD HH:MM", from DateTimeOriginal: the moment the shutter fired, not the file's mtime.
    readonly takenAt?: string;
}

const ORIENTATION_TAG = 0x0112;
const EXIF_IFD_TAG = 0x8769;
const DATE_TIME_ORIGINAL_TAG = 0x9003;

export const readJpegMeta = (bytes: Uint8Array): JpegMeta => {
    // SOI. A file that doesn't start with it is not a JPEG, whatever it is called.
    if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
        return {};
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let offset = 2;

    // Walk the segment chain to APP1. Segments are marker + length, so this is a hop per segment rather than a
    // scan for a byte pattern that could appear inside compressed data.
    while (offset + 4 <= view.byteLength) {
        if (view.getUint8(offset) !== 0xff) {
            return {};
        }
        const marker = view.getUint8(offset + 1);
        // Start of scan: pixel data begins, and no metadata follows it.
        if (marker === 0xda) {
            return {};
        }
        const length = view.getUint16(offset + 2);
        if (length < 2) {
            return {};
        }
        if (marker === 0xe1 && offset + 4 + 6 <= view.byteLength && readAscii(bytes, offset + 4, 4) === `Exif`) {
            return readTiff(view, offset + 10, bytes);
        }
        offset += 2 + length;
    }
    return {};
};

const readAscii = (bytes: Uint8Array, at: number, length: number): string =>
    String.fromCharCode(...bytes.subarray(at, at + length));

// The TIFF header EXIF embeds: byte order, magic 42, then the offset of IFD0, every offset inside is relative
// to `start`, which is why it is threaded through rather than folded into the DataView.
const readTiff = (view: DataView, start: number, bytes: Uint8Array): JpegMeta => {
    if (start + 8 > view.byteLength) {
        return {};
    }
    const order = view.getUint16(start);
    if (order !== 0x4949 && order !== 0x4d4d) {
        return {};
    }
    const little = order === 0x4949;
    if (view.getUint16(start + 2, little) !== 42) {
        return {};
    }
    const ifd0 = view.getUint32(start + 4, little);
    const primary = readIfd(view, start, start + ifd0, little, bytes);
    const exifIfd = primary.pointers.get(EXIF_IFD_TAG);
    const exif = exifIfd === undefined ? undefined : readIfd(view, start, start + exifIfd, little, bytes);

    const orientation = primary.orientation;
    const raw = exif?.dateTimeOriginal ?? primary.dateTimeOriginal;
    return {
        orientation: orientation !== undefined && orientation >= 1 && orientation <= 8 ? orientation : undefined,
        takenAt: raw === undefined ? undefined : formatExifDate(raw),
    };
};

interface Ifd {
    readonly pointers: Map<number, number>;
    readonly orientation?: number;
    readonly dateTimeOriginal?: string;
}

const readIfd = (view: DataView, tiffStart: number, at: number, little: boolean, bytes: Uint8Array): Ifd => {
    const pointers = new Map<number, number>();
    let orientation: number | undefined;
    let dateTimeOriginal: string | undefined;
    if (at + 2 > view.byteLength) {
        return { pointers };
    }
    const count = view.getUint16(at, little);
    for (let index = 0; index < count; index += 1) {
        const entry = at + 2 + index * 12;
        if (entry + 12 > view.byteLength) {
            break;
        }
        const tag = view.getUint16(entry, little);
        const valueAt = entry + 8;
        if (tag === ORIENTATION_TAG) {
            // SHORT, so the value sits in the first two bytes of the value field itself.
            orientation = view.getUint16(valueAt, little);
        } else if (tag === EXIF_IFD_TAG) {
            pointers.set(tag, view.getUint32(valueAt, little));
        } else if (tag === DATE_TIME_ORIGINAL_TAG) {
            const length = view.getUint32(entry + 4, little);
            const stringAt = tiffStart + view.getUint32(valueAt, little);
            if (length >= 19 && stringAt + 19 <= view.byteLength) {
                dateTimeOriginal = readAscii(bytes, stringAt, 19);
            }
        }
    }
    return { pointers, orientation, dateTimeOriginal };
};

// EXIF writes "2026:08:03 14:22:07". Only the colons in the date part are wrong for a reader, and the seconds
// are noise on a contact sheet.
const formatExifDate = (raw: string): string | undefined => {
    const match = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2})/.exec(raw);
    return match === null ? undefined : `${match[1]}-${match[2]}-${match[3]} ${match[4]}:${match[5]}`;
};

/* Orientation as a CSS transform. The eight EXIF values are the four rotations and their mirrors; the mirrored
 * ones are rare (a front camera that flips its own frame) but cost one term each to honour. */
export const orientationTransform = (orientation: number | undefined): string | undefined => {
    switch (orientation) {
        case 2:
            return `scaleX(-1)`;
        case 3:
            return `rotate(180deg)`;
        case 4:
            return `scaleY(-1)`;
        case 5:
            return `rotate(90deg) scaleX(-1)`;
        case 6:
            return `rotate(90deg)`;
        case 7:
            return `rotate(270deg) scaleX(-1)`;
        case 8:
            return `rotate(270deg)`;
        default:
            return undefined;
    }
};
