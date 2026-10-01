import { shallowRef as N, defineComponent as D, ref as I, computed as O, watch as P, onBeforeUnmount as F, openBlock as l, createElementBlock as d, createElementVNode as g, toDisplayString as f, Fragment as T, createTextVNode as S, normalizeClass as V, renderList as X, normalizeStyle as G, unref as H, createCommentVNode as Y } from "vue";
import { hostSlot as q } from "@intentic/extension-api";
const { bindHost: J, host: x } = q("intentic.contact-sheet"), W = /* @__PURE__ */ new Set(["png", "jpg", "jpeg", "gif", "webp", "avif", "bmp"]), R = (e) => {
  const t = e.lastIndexOf(".");
  return t > 0 && W.has(e.slice(t + 1).toLowerCase());
}, k = "", K = (e) => {
  const t = e.lastIndexOf("/");
  return t < 0 ? k : e.slice(0, t);
}, Q = (e) => {
  const t = /* @__PURE__ */ new Map(), o = (n) => {
    for (const r of n)
      if (r.ignored !== !0) {
        if (r.type === "file") {
          if (R(r.name)) {
            const i = K(r.path);
            t.set(i, (t.get(i) ?? 0) + 1);
          }
          continue;
        }
        r.children !== void 0 && o(r.children);
      }
  };
  return o(e), t;
}, Z = (e) => e.filter((t) => t.type === "file" && R(t.name)).map((t) => ({ name: t.name, path: t.path, size: t.size })).sort((t, o) => t.name.localeCompare(o.name, void 0, { numeric: !0, sensitivity: "base" })), ee = (e, t) => e, z = N(/* @__PURE__ */ new Map()), M = N([]), te = (e) => z.value.get(e), oe = () => M.value, ne = 6e4;
let A = 0, w;
const re = async () => {
  const t = (await x().sandbox.json("/workspace/tree")).tree ?? [];
  M.value = t, z.value = Q(t);
}, L = async (e, t = !1) => {
  if (!(!t && e - A < ne)) {
    if (w !== void 0)
      return w;
    A = e, w = re().catch(() => {
    }), await w, w = void 0;
  }
}, se = () => {
  const e = x();
  L(Date.now(), !0);
  const t = e.workspace.onDidChange(() => {
    e.sandbox.reachable() && L(Date.now());
  });
  return { dispose: () => t.dispose() };
}, ae = `
.cs-page { padding: 1rem 1.25rem 2rem; color: var(--color-content); }
.cs-head { display: flex; align-items: baseline; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 0.9rem; }
.cs-title { font-size: 1.05rem; font-weight: 600; }
.cs-muted { color: var(--color-muted); font-size: 0.78rem; }
.cs-grid { display: grid; gap: 0.75rem; }
.cs-grid-small { grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); }
.cs-grid-medium { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); }
.cs-grid-large { grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); }
.cs-tile {
    display: block; width: 100%; padding: 0; border: 1px solid var(--color-line); border-radius: 0.5rem;
    background: transparent; color: inherit; overflow: hidden; cursor: pointer; text-align: left; font: inherit;
}
.cs-tile:hover { border-color: color-mix(in srgb, var(--color-content) 45%, transparent); }
.cs-tile:focus-visible { outline: 2px solid color-mix(in srgb, var(--color-content) 45%, transparent); outline-offset: 2px; }
.cs-frame {
    display: flex; align-items: center; justify-content: center; aspect-ratio: 1; overflow: hidden;
    background: color-mix(in srgb, var(--color-content) 5%, transparent);
}
.cs-frame img { max-width: 100%; max-height: 100%; object-fit: contain; display: block; }
.cs-caption { padding: 0.35rem 0.5rem 0.45rem; border-top: 1px solid color-mix(in srgb, var(--color-line) 60%, transparent); }
.cs-name { font-size: 0.75rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cs-meta { font-size: 0.68rem; color: var(--color-muted); }
.cs-note { color: var(--color-muted); font-size: 0.8rem; margin-top: 1rem; }
`, ie = () => {
  const e = document.createElement("style");
  return e.dataset.owner = "intentic.contact-sheet", e.textContent = ae, document.head.append(e), { dispose: () => e.remove() };
}, Ne = (e, t) => {
  J(e), t.subscriptions.push(
    ie(),
    se(),
    e.documents.register({
      id: "photos",
      detect: (o) => {
        const n = te(o);
        if (!(n === void 0 || n === 0))
          return {
            icon: "image",
            tooltip: `Open the contact sheet, ${n} picture${n === 1 ? "" : "s"}`,
            title: "Photos"
          };
      },
      view: async () => (await Promise.resolve().then(() => Ae)).default
    }),
    // The workspace root has no row in the tree (it is the thing the tree renders the contents of) so a
    // sheet of the pictures sitting loose at the top of the workspace is only reachable from the palette.
    e.commands.register("contact-sheet.root", () => e.documents.open?.("photos", k))
  );
}, ce = 274, j = 34665, le = 36867, de = (e) => {
  if (e.length < 4 || e[0] !== 255 || e[1] !== 216)
    return {};
  const t = new DataView(e.buffer, e.byteOffset, e.byteLength);
  let o = 2;
  for (; o + 4 <= t.byteLength; ) {
    if (t.getUint8(o) !== 255)
      return {};
    const n = t.getUint8(o + 1);
    if (n === 218)
      return {};
    const r = t.getUint16(o + 2);
    if (r < 2)
      return {};
    if (n === 225 && o + 4 + 6 <= t.byteLength && B(e, o + 4, 4) === "Exif")
      return ue(t, o + 10, e);
    o += 2 + r;
  }
  return {};
}, B = (e, t, o) => String.fromCharCode(...e.subarray(t, t + o)), ue = (e, t, o) => {
  if (t + 8 > e.byteLength)
    return {};
  const n = e.getUint16(t);
  if (n !== 18761 && n !== 19789)
    return {};
  const r = n === 18761;
  if (e.getUint16(t + 2, r) !== 42)
    return {};
  const i = e.getUint32(t + 4, r), m = $(e, t, t + i, r, o), h = m.pointers.get(j), b = h === void 0 ? void 0 : $(e, t, t + h, r, o), u = m.orientation, p = b?.dateTimeOriginal ?? m.dateTimeOriginal;
  return {
    orientation: u !== void 0 && u >= 1 && u <= 8 ? u : void 0,
    takenAt: p === void 0 ? void 0 : pe(p)
  };
}, $ = (e, t, o, n, r) => {
  const i = /* @__PURE__ */ new Map();
  let m, h;
  if (o + 2 > e.byteLength)
    return { pointers: i };
  const b = e.getUint16(o, n);
  for (let u = 0; u < b; u += 1) {
    const p = o + 2 + u * 12;
    if (p + 12 > e.byteLength)
      break;
    const v = e.getUint16(p, n), y = p + 8;
    if (v === ce)
      m = e.getUint16(y, n);
    else if (v === j)
      i.set(v, e.getUint32(y, n));
    else if (v === le) {
      const U = e.getUint32(p + 4, n), C = t + e.getUint32(y, n);
      U >= 19 && C + 19 <= e.byteLength && (h = B(r, C, 19));
    }
  }
  return { pointers: i, orientation: m, dateTimeOriginal: h };
}, pe = (e) => {
  const t = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2})/.exec(e);
  return t === null ? void 0 : `${t[1]}-${t[2]}-${t[3]} ${t[4]}:${t[5]}`;
}, me = (e) => {
  switch (e) {
    case 2:
      return "scaleX(-1)";
    case 3:
      return "rotate(180deg)";
    case 4:
      return "scaleY(-1)";
    case 5:
      return "rotate(90deg) scaleX(-1)";
    case 6:
      return "rotate(90deg)";
    case 7:
      return "rotate(270deg) scaleX(-1)";
    case 8:
      return "rotate(270deg)";
    default:
      return;
  }
}, fe = { class: "cs-page" }, ge = { class: "cs-head" }, he = { class: "cs-title" }, ve = { class: "cs-muted" }, _e = {
  key: 0,
  class: "ui-card ui-card-dashed"
}, xe = { class: "cs-muted" }, be = ["onClick"], ye = { class: "cs-frame" }, we = ["src", "alt"], ke = {
  key: 1,
  class: "cs-meta"
}, Ce = { class: "cs-caption" }, Ie = ["title"], Te = { class: "cs-meta" }, Ue = {
  key: 2,
  class: "cs-note"
}, Ee = 4, Oe = 128 * 1024, Se = /* @__PURE__ */ D({
  __name: "ContactSheet",
  props: {
    path: {}
  },
  setup(e) {
    const t = e, o = I([]), n = I(0), r = I(!0), i = I(void 0), m = x().settings, h = O(() => String(m.get("thumbnail") ?? "medium")), b = O(() => Math.max(1, Number(m.get("limit") ?? 120))), u = O(() => t.path === k ? "Workspace root" : t.path.slice(t.path.lastIndexOf("/") + 1)), p = () => {
      for (const s of o.value)
        s.url !== void 0 && URL.revokeObjectURL(s.url);
    }, v = async (s) => {
      const c = await x().sandbox.request(`/workspace/raw?path=${encodeURIComponent(s.picture.path)}`);
      if (!c.ok) {
        s.error = c.status === 413 ? "too large to preview" : `couldn't read (${c.status})`;
        return;
      }
      const a = await c.blob();
      s.url = URL.createObjectURL(a), /\.jpe?g$/i.test(s.picture.name) && (s.meta = de(new Uint8Array(await a.slice(0, Oe).arrayBuffer())));
    }, y = async (s) => {
      p(), o.value = [], r.value = !0, i.value = void 0;
      try {
        const c = s === k ? ee(oe(), k) : (await x().sandbox.json(`/workspace/children?path=${encodeURIComponent(s)}`)).entries ?? [], a = Z(c);
        n.value = a.length, o.value = a.slice(0, b.value).map((_) => ({ picture: _ }));
        const E = [...o.value];
        await Promise.all(
          Array.from({ length: Ee }, async () => {
            for (let _ = E.shift(); _ !== void 0; _ = E.shift())
              await v(_).catch(() => {
                _.error = "couldn't read";
              }), o.value = [...o.value];
          })
        );
      } catch (c) {
        i.value = c instanceof Error ? c.message : String(c);
      } finally {
        r.value = !1;
      }
    };
    P(() => t.path, (s) => {
      y(s);
    }, { immediate: !0 }), F(p);
    const U = (s) => x().navigate(`/workspace/${s.path}`), C = (s) => s === void 0 ? void 0 : s >= 1024 * 1024 ? `${(s / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(s / 1024))} kB`;
    return (s, c) => (l(), d("div", fe, [
      g("div", ge, [
        g("span", he, f(u.value), 1),
        g("span", ve, [
          r.value ? (l(), d(T, { key: 0 }, [
            S("Loading…")
          ], 64)) : n.value > o.value.length ? (l(), d(T, { key: 1 }, [
            S(f(o.value.length) + " of " + f(n.value) + ' pictures: raise "Pictures per folder" in Settings → Extensions', 1)
          ], 64)) : (l(), d(T, { key: 2 }, [
            S(f(n.value) + " picture" + f(n.value === 1 ? "" : "s"), 1)
          ], 64))
        ])
      ]),
      i.value ? (l(), d("div", _e, [
        g("p", xe, "Couldn't list this folder: " + f(i.value), 1)
      ])) : (l(), d("div", {
        key: 1,
        class: V(`cs-grid cs-grid-${h.value}`)
      }, [
        (l(!0), d(T, null, X(o.value, (a) => (l(), d("button", {
          key: a.picture.path,
          class: "cs-tile",
          type: "button",
          onClick: (E) => U(a.picture)
        }, [
          g("div", ye, [
            a.url ? (l(), d("img", {
              key: 0,
              src: a.url,
              alt: a.picture.name,
              loading: "lazy",
              style: G({ transform: H(me)(a.meta?.orientation) })
            }, null, 12, we)) : (l(), d("span", ke, f(a.error ?? "…"), 1))
          ]),
          g("div", Ce, [
            g("div", {
              class: "cs-name",
              title: a.picture.name
            }, f(a.picture.name), 9, Ie),
            g("div", Te, f([a.meta?.takenAt, C(a.picture.size)].filter(Boolean).join(" · ")), 1)
          ])
        ], 8, be))), 128))
      ], 2)),
      !r.value && n.value === 0 && !i.value ? (l(), d("p", Ue, " No pictures directly in this folder. HEIC files aren't shown: no browser decodes them; convert them first. ")) : Y("", !0)
    ]));
  }
}), Ae = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: Se
}, Symbol.toStringTag, { value: "Module" }));
export {
  Ne as activate
};
