import type { ExtensionContext, IntenticApi } from "@intentic/extension-api";
import { bindHost } from "./host";
import { pictureCount, startIndex } from "./index-state";
import { installStyles } from "./styles";
import { ROOT } from "./pictures";

/* intentic.contact-sheet — the folders in your workspace that hold pictures, as pictures.
 *
 * A DOCUMENT provider rather than a view, because the subject is a DIRECTORY. A view's detect() answers per
 * repo, and "which folders have photos in them" is not a fact about a repo: one repository can hold a dozen
 * such folders and its root is not one of them. So this marks the rows it can explain in the Workspace tree,
 * and the host opens the sheet as a tab beside the files — which is where a picture belongs, next to the
 * folder it is in rather than behind a navigation away from it.
 *
 * detect() is a LOOKUP into the index in index-state.ts, never a fetch: the tree calls it for every visible row
 * on every render. */

/* `api.documents.open` is missing from the PUBLISHED SDK's types (@intentic/extension-api@1.176.3) even though
 * the host implements it — and `extensionApiVersion`, the value `engines.intentic` is checked against, did not
 * move when it was added. So an extension has no way to DECLARE that it needs a host new enough to have it,
 * and feature-detection is what is left: with it, the palette entry opens the root's sheet; without it the
 * command does nothing, rather than throwing inside the shell. */
type DocumentsWithOpen = IntenticApi["documents"] & { open?: (id: string, path: string) => void };
export const activate = (api: IntenticApi, context: ExtensionContext): void => {
    bindHost(api);
    context.subscriptions.push(
        installStyles(),
        startIndex(),
        api.documents.register({
            id: `photos`,
            detect: (path) => {
                const count = pictureCount(path);
                if (count === undefined || count === 0) {
                    return undefined;
                }
                return {
                    icon: `image`,
                    tooltip: `Open the contact sheet — ${count} picture${count === 1 ? `` : `s`}`,
                    title: `Photos`,
                };
            },
            view: async () => (await import(`./ContactSheet.vue`)).default,
        }),
        // The workspace root has no row in the tree — it is the thing the tree renders the contents of — so a
        // sheet of the pictures sitting loose at the top of the workspace is only reachable from the palette.
        api.commands.register(`contact-sheet.root`, () => (api.documents as DocumentsWithOpen).open?.(`photos`, ROOT)),
    );
};
