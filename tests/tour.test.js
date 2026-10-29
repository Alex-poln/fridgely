import test from "node:test";
import assert from "node:assert/strict";
import { visibleTarget, panelPlacement } from "../src/core/tour-layout.js";

test("Tour ignores hidden header action and selects visible empty-state action", () => {
  const hidden = { closest: () => ({}), getBoundingClientRect: () => ({ width: 0, height: 0 }) };
  const visible = { closest: () => null, getBoundingClientRect: () => ({ width: 200, height: 48 }) };
  assert.equal(visibleTarget({ querySelectorAll: () => [hidden, visible] }, "button"), visible);
  assert.equal(visibleTarget({ querySelectorAll: () => [hidden] }, "button"), undefined);
});

for (const [width, height] of [[393, 852], [375, 667], [820, 1180], [1180, 820], [1440, 900], [852, 393]]) {
  test("Guide remains within viewport and clear of target at " + width + "x" + height, () => {
    for (const top of [70, height / 2, height - 90]) {
      const target = { left: width / 2 - 100, right: width / 2 + 100, top, bottom: top + 48, width: 200 };
      const p = panelPlacement(target, { height: 290 }, { left: 0, top: 0, width, height });
      const actualHeight = Math.min(290, p.maxHeight);
      assert.ok(p.left >= 0 && p.left + p.width <= width);
      assert.ok(p.top >= 0 && p.top + actualHeight <= height);
      assert.ok(p.left >= target.right || p.left + p.width <= target.left || p.top >= target.bottom || p.top + actualHeight <= target.top);
    }
  });
}
