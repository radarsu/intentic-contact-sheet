import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

/* The built bundle against a host stub that enforces the manifest — the document provider's id, the command's
 * name, and (the one that matters most here) every daemon route the extension reaches. This extension DOES
 * call the daemon, so the route check is not ceremony: the manifest's `permissions.sandbox` list is what the
 * owner approved at install, and the real host throws on anything outside it. */

const manifest = JSON.parse(await readFile(new URL(`../intentic-extension.json`, import.meta.url), `utf8`));

const head = [];
globalThis.document = {
    head: { append: (element) => head.push(element) },
    createElement: () => ({ dataset: {}, textContent: ``, remove() {} }),
};

const { activate } = await import(`../dist/extension.js`);

const declaredDocuments = new Set((manifest.contributes?.documents ?? []).map((entry) => entry.id));
const declaredCommands = new Set((manifest.contributes?.commands ?? []).map((entry) => entry.command));
const declaredRoutes = manifest.permissions?.sandbox ?? [];

// The host's own rule, in miniature: "<METHOD> <path-glob>", `*` matching exactly one path segment.
const allowed = (method, path) =>
    declaredRoutes.some((entry) => {
        const [declaredMethod, glob] = entry.split(` `);
        const pattern = new RegExp(`^${glob.split(`*`).map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, `\\$&`)).join(`[^/]+`)}$`);
        return declaredMethod === method && pattern.test(path.split(`?`)[0]);
    });

const disposable = () => ({ dispose: () => {} });

const treeFixture = {
    root: `/work`,
    hidden: 0,
    tree: [
        { name: `trip`, path: `trip`, type: `dir`, children: [{ name: `a.jpg`, path: `trip/a.jpg`, type: `file`, size: 2048 }] },
        { name: `notes.md`, path: `notes.md`, type: `file` },
    ],
};

const hostStub = () => {
    const state = { documents: [], commands: [], handlers: new Map(), requested: [], opened: [], changeListeners: [] };
    const api = {
        apiVersion: `0.4.0`,
        documents: {
            register: (provider) => {
                assert.ok(declaredDocuments.has(provider.id), `document provider "${provider.id}" is not declared`);
                state.documents.push(provider);
                return disposable();
            },
            open: (id, path) => state.opened.push([id, path]),
        },
        commands: {
            register: (command, handler) => {
                assert.ok(declaredCommands.has(command), `command "${command}" is not declared`);
                state.commands.push(command);
                state.handlers.set(command, handler);
                return disposable();
            },
        },
        views: { register: () => assert.fail(`a view registered, which this manifest never declares`) },
        viewers: { register: () => assert.fail(`a viewer registered, which this manifest never declares`) },
        settings: { get: (key) => (key === `limit` ? 120 : `medium`) },
        sandbox: {
            reachable: () => true,
            key: (...parts) => [...parts, `sandbox-test`],
            json: async (path) => {
                assert.ok(allowed(`GET`, path), `GET ${path} is not in permissions.sandbox`);
                state.requested.push(path);
                return treeFixture;
            },
            request: async (path) => {
                assert.ok(allowed(`GET`, path), `GET ${path} is not in permissions.sandbox`);
                state.requested.push(path);
                return { ok: true, blob: async () => new Blob() };
            },
        },
        workspace: {
            onDidChange: (listener) => {
                state.changeListeners.push(listener);
                return disposable();
            },
        },
        navigate: () => {},
    };
    return { api, state };
};

test(`activate registers what the manifest declares, and indexes the tree once`, async () => {
    const { api, state } = hostStub();
    const context = { extensionId: `intentic.contact-sheet`, subscriptions: [] };

    await activate(api, context);
    // The index read is fired from activate, not awaited by it — let the microtask land.
    await new Promise((resolve) => setImmediate(resolve));

    assert.deepEqual(state.documents.map((provider) => provider.id), [`photos`]);
    assert.deepEqual(state.commands, [`contact-sheet.root`]);
    assert.deepEqual(state.requested, [`/workspace/tree`]);

    const provider = state.documents[0];
    // detect() is a lookup into the index the read filled — a folder with pictures offers, one without doesn't.
    assert.equal(provider.detect(`trip`)?.title, `Photos`);
    assert.match(provider.detect(`trip`).tooltip, /1 picture$/);
    assert.equal(provider.detect(`notes.md`), undefined);
    assert.equal(provider.detect(``), undefined);
    assert.equal(typeof (await provider.view()), `object`);

    for (const subscription of context.subscriptions) {
        subscription.dispose();
    }
});

test(`the workspace-change listener re-reads at most once a minute`, async () => {
    const { api, state } = hostStub();
    const context = { extensionId: `intentic.contact-sheet`, subscriptions: [] };
    await activate(api, context);
    await new Promise((resolve) => setImmediate(resolve));

    // The facts poll behind onDidChange fires far more often than photo folders appear; a whole-tree read per
    // notification would be a request storm for a row icon.
    for (const listener of state.changeListeners) {
        listener();
        listener();
    }
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(state.requested, [`/workspace/tree`]);

    for (const subscription of context.subscriptions) {
        subscription.dispose();
    }
});

test(`the command opens this extension's own document for the root`, async () => {
    const { api, state } = hostStub();
    const context = { extensionId: `intentic.contact-sheet`, subscriptions: [] };
    await activate(api, context);

    // The root is the one directory with no row in the tree, so the palette is the only way to its sheet.
    state.handlers.get(`contact-sheet.root`)();
    assert.deepEqual(state.opened, [[`photos`, ``]]);

    // Not a runtime assertion — a reminder that this list IS the approval surface shown at install.
    assert.deepEqual(declaredRoutes, [`GET /workspace/tree`, `GET /workspace/children`, `GET /workspace/raw`]);

    for (const subscription of context.subscriptions) {
        subscription.dispose();
    }
});
