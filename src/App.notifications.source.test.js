import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
const css = readFileSync(new URL("./index.css", import.meta.url), "utf8");

test("app notices retain existing state and timing while supporting semantic visual tones", () => {
  assert.match(app, /const \[appNotice, setAppNotice\] = useState\(null\)/);
  assert.match(app, /\["success", "info", "warning", "error"\]\.includes\(appNotice\?\.tone\)/);
  assert.match(app, /appNotice\.tone === "error" \? 8000 : 6000/);
  for (const tone of ["success", "info", "warning", "error"]) {
    assert.match(css, new RegExp(`\\.proveit-app-notification-${tone}`));
  }
});

test("app notices expose one atomic live region and retain a labelled dismissal control", () => {
  assert.match(app, /role=\{appNoticeTone === "error" \? "alert" : "status"\}/);
  assert.match(app, /aria-atomic="true"/);
  assert.match(app, /aria-label="Dismiss notification"/);
  assert.match(app, /onClick=\{\(\) => setAppNotice\(null\)\}/);
});
