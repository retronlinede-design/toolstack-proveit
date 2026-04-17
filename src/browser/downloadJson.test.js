import test from "node:test";
import assert from "node:assert/strict";

import { downloadJson } from "./downloadJson.js";

function installBrowserStubs() {
  const originalUrl = globalThis.URL;
  const originalDocument = globalThis.document;
  const state = {
    blob: null,
    revokedUrl: null,
    appended: [],
    removed: [],
    anchor: null,
    clicked: false,
  };

  globalThis.URL = {
    createObjectURL(blob) {
      state.blob = blob;
      return "blob:test-url";
    },
    revokeObjectURL(url) {
      state.revokedUrl = url;
    },
  };

  globalThis.document = {
    createElement(tagName) {
      assert.equal(tagName, "a");
      state.anchor = {
        href: "",
        download: "",
        click() {
          state.clicked = true;
        },
      };
      return state.anchor;
    },
    body: {
      appendChild(node) {
        state.appended.push(node);
      },
      removeChild(node) {
        state.removed.push(node);
      },
    },
  };

  return {
    state,
    restore() {
      globalThis.URL = originalUrl;
      globalThis.document = originalDocument;
    },
  };
}

test("downloadJson preserves compact JSON download behavior by default", async () => {
  const { state, restore } = installBrowserStubs();

  try {
    downloadJson({ app: "proveit", count: 1 }, "backup.json");

    assert.equal(await state.blob.text(), JSON.stringify({ app: "proveit", count: 1 }));
    assert.equal(state.blob.type, "application/json");
    assert.equal(state.anchor.href, "blob:test-url");
    assert.equal(state.anchor.download, "backup.json");
    assert.equal(state.appended[0], state.anchor);
    assert.equal(state.removed[0], state.anchor);
    assert.equal(state.clicked, true);
    assert.equal(state.revokedUrl, "blob:test-url");
  } finally {
    restore();
  }
});

test("downloadJson preserves pretty JSON formatting when space is provided", async () => {
  const { state, restore } = installBrowserStubs();

  try {
    const payload = { app: "proveit", nested: { ok: true } };

    downloadJson(payload, "pretty.json", { space: 2 });

    assert.equal(await state.blob.text(), JSON.stringify(payload, null, 2));
    assert.equal(state.anchor.download, "pretty.json");
  } finally {
    restore();
  }
});
