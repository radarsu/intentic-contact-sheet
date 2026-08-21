import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

/* The extension bundle, built as /docs/extensions/build/ prescribes.
 *
 * externals         : the host publishes its own vue instance through the app's import map; a second copy in
 *                      the bundle would fork reactivity, and the viewer would render from state the shell
 *                      cannot see.
 * one file, no chunks, the loader fetches the bundle with an auth header and imports it from a blob: URL,
 *                      where a relative chunk import has no base to resolve against. */
export default defineConfig({
    plugins: [vue()],
    build: {
        outDir: "dist",
        lib: { entry: "src/extension.ts", formats: ["es"], fileName: () => "extension.js" },
        rollupOptions: {
            external: ["vue", "@tanstack/vue-query", "@intentic/extension-api", "@intentic/extension-ui"],
            output: { inlineDynamicImports: true },
        },
    },
});
