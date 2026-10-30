const INK = '#23272d';
const PAPER = '#ffffff'; // fixed, so the image reads the same in light and dark mode

/** A standalone copy of a circuit <svg>, sized `width` px wide, as a data: URL (the CSP allows data: images). */
export function svgDataUrl(svg, width) {
  const [, , w, h] = svg.getAttribute('viewBox').split(/\s+/).map(Number);
  const height = Math.round((width * h) / w);
  const copy = svg.cloneNode(true);
  copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  copy.setAttribute('width', String(width));
  copy.setAttribute('height', String(height));
  // Labels use the page's CSS variable for ink; a standalone image has none, so give it a fixed colour.
  const markup = new XMLSerializer().serializeToString(copy).replaceAll('var(--canvas-ink)', INK);
  return { url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`, height };
}

/** Downloads a circuit <svg> as a PNG for sharing, on a white background. */
export async function downloadSvgAsPng(svg, fileName, width = 1200) {
  const { url, height } = svgDataUrl(svg, width);
  const img = new Image();
  img.src = url;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = `${fileName.replace(/[^a-z0-9-_]+/gi, '_') || 'circuit'}.png`;
  a.click();
}
