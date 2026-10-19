import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../CaseDetail.jsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../../index.css", import.meta.url), "utf8");

test("Back to top is an accessible compact floating arrow with reduced-motion support", () => {
  assert.match(source, /setShowScrollTop\(window\.scrollY > 400\)/);
  assert.match(source, /window\.matchMedia\?\.\("\(prefers-reduced-motion: reduce\)"\)\.matches/);
  assert.match(source, /behavior: reduceMotion \? "auto" : "smooth"/);
  assert.match(source, /aria-label="Back to top"/);
  assert.match(source, /className="proveit-back-to-top fixed bottom-20 right-4/);
  assert.match(source, /<ArrowUp className="h-\[18px\] w-\[18px\]" aria-hidden="true"/);
  assert.doesNotMatch(source, /bg-lime-600 text-\[10px\]/);
  assert.match(css, /\.proveit-back-to-top \{[\s\S]*height: 42px;[\s\S]*width: 42px;[\s\S]*background: #10213a;/);
  assert.match(css, /\.proveit-back-to-top:focus-visible/);
});
