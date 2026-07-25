import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/App.jsx", "utf8");

test("case image hydration depends on a memoized review queue", () => {
  assert.match(
    source,
    /const reviewQueue = useMemo\(\s*\(\) => quickCaptures\.filter\(\(item\) => item\.status === "unreviewed"\),\s*\[quickCaptures\]\s*\);/
  );
  assert.match(
    source,
    /loadAllImages\(\);\s*\}, \[selectedCase, selectedCaseRequiresPin, reviewQueue\]\);/
  );
  assert.doesNotMatch(
    source,
    /const reviewQueue = quickCaptures\.filter/
  );
});
