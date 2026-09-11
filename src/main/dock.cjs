function dockBounds(workArea, view = 'home') {
  const width = Math.min(view === 'widget' ? 280 : 448, workArea.width);
  const height = view === 'widget' ? workArea.height - 24 : Math.min(660, workArea.height - 24);
  return { width, height, y: Math.round(workArea.y + (workArea.height - height) / 2) };
}
function isInRect(point, rect, padding = 0) {
  return point.x >= rect.x - padding && point.x < rect.x + rect.width + padding && point.y >= rect.y - padding && point.y < rect.y + rect.height + padding;
}
function activationRect(bounds, side) {
  return { x: side === 'left' ? bounds.x : bounds.x + bounds.width - 14, y: bounds.y + bounds.height / 2 - 80, width: 14, height: 160 };
}
module.exports = { dockBounds, isInRect, activationRect };
