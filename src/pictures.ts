/* Which files are pictures, and which folders hold enough of them to be worth an icon in the tree. Pure, and
 * separate from the index that holds the answer, because this is the part with a rule in it. */

export interface TreeEntry {
    readonly name: string;
    readonly path: string;
    readonly type: "file" | "dir";
    readonly size?: number | undefined;
    readonly ignored?: boolean | undefined;
    readonly children?: readonly TreeEntry[] | undefined;
}

/* Only formats a browser can actually decode. HEIC is the obvious omission and it is deliberate: Safari aside,
 * no browser decodes it, so counting a folder of iPhone originals as a photo folder would put an icon on a row
 * that opens a sheet of broken tiles. A pack like `intentic.paperwork` can convert them first. */
export const PICTURE_EXTENSIONS = new Set([`png`, `jpg`, `jpeg`, `gif`, `webp`, `avif`, `bmp`]);

export const isPicture = (name: string): boolean => {
    const dot = name.lastIndexOf(`.`);
    return dot > 0 && PICTURE_EXTENSIONS.has(name.slice(dot + 1).toLowerCase());
};

// The workspace root is the empty path: the tree renders its contents rather than a row for it, which is why
// the root needs a command to reach its sheet at all (see contributes.commands).
export const ROOT = ``;

const parentOf = (path: string): string => {
    const slash = path.lastIndexOf(`/`);
    return slash < 0 ? ROOT : path.slice(0, slash);
};

/* Directory path → how many pictures sit DIRECTLY in it. Not recursive on purpose: a contact sheet is of one
 * folder, so a parent that merely contains a photo folder should not offer one: otherwise every repository
 * root, and the workspace root above them, would claim to be a photo folder because something deep inside is.
 *
 * Ignored subtrees (node_modules, .git, browser profiles) are skipped whole: the icons they would add are
 * noise, and a `.git` full of nothing a person put there is not a folder anyone wants a sheet of. */
export const indexPictureFolders = (tree: readonly TreeEntry[]): Map<string, number> => {
    const counts = new Map<string, number>();
    const walk = (entries: readonly TreeEntry[]): void => {
        for (const entry of entries) {
            if (entry.ignored === true) {
                continue;
            }
            if (entry.type === `file`) {
                if (isPicture(entry.name)) {
                    const folder = parentOf(entry.path);
                    counts.set(folder, (counts.get(folder) ?? 0) + 1);
                }
                continue;
            }
            if (entry.children !== undefined) {
                walk(entry.children);
            }
        }
    };
    walk(tree);
    return counts;
};

export interface Picture {
    readonly name: string;
    readonly path: string;
    readonly size?: number | undefined;
}

// One directory's pictures, in the order a person expects: by name, numerically, so IMG_2 comes before IMG_10.
export const picturesIn = (entries: readonly TreeEntry[]): Picture[] =>
    entries
        .filter((entry) => entry.type === `file` && isPicture(entry.name))
        .map((entry) => ({ name: entry.name, path: entry.path, size: entry.size }))
        .sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: `base` }));

// The top-level entries of a directory, read out of a whole-workspace tree: how the ROOT's sheet is filled,
// since /workspace/children requires a non-empty path and the root has none.
export const entriesAt = (tree: readonly TreeEntry[], path: string): readonly TreeEntry[] => {
    if (path === ROOT) {
        return tree;
    }
    const find = (entries: readonly TreeEntry[]): readonly TreeEntry[] | undefined => {
        for (const entry of entries) {
            if (entry.type !== `dir`) {
                continue;
            }
            if (entry.path === path) {
                return entry.children ?? [];
            }
            if (path.startsWith(`${entry.path}/`) && entry.children !== undefined) {
                const found = find(entry.children);
                if (found !== undefined) {
                    return found;
                }
            }
        }
        return undefined;
    };
    return find(tree) ?? [];
};
