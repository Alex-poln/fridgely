export function visibleTarget(root, selector) {
  return [...root.querySelectorAll(selector)].find(element => {
    const rect = element.getBoundingClientRect();
    return !element.closest("[hidden]") && rect.width > 0 && rect.height > 0;
  });
}

export function panelPlacement(target, panel, viewport) {
  const gap = 16, edge = 14;
  const left = viewport.left + edge, top = viewport.top + edge;
  const right = viewport.left + viewport.width - edge;
  const bottom = viewport.top + viewport.height - edge;
  const width = Math.min(390, right - left);
  const height = Math.min(panel.height, bottom - top);
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(n, hi));
  let x = clamp(target.left + (target.width - width) / 2, left, right - width);
  let y;
  let maxHeight = bottom - top;
  if (viewport.width > 720 && right - target.right >= width + gap) {
    x = target.right + gap;
    y = clamp(target.top, top, bottom - height);
  } else if (viewport.width > 720 && target.left - left >= width + gap) {
    x = target.left - width - gap;
    y = clamp(target.top, top, bottom - height);
  } else {
    const above = Math.max(0, target.top - gap - top);
    const below = Math.max(0, bottom - target.bottom - gap);
    if (below >= height || below >= above) {
      maxHeight = below;
      y = target.bottom + gap;
    } else {
      maxHeight = above;
      y = target.top - gap - Math.min(height, above);
    }
    // Very short viewports retain a scrollable, reachable guide.
    if (maxHeight < 100) { maxHeight = bottom - top; y = top; }
  }
  return { left: x, top: y, width, maxHeight };
}
