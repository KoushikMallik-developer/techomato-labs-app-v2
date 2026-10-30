import { describe, it, expect } from 'vitest';
import { svgDataUrl } from './shareImage';

describe('svgDataUrl', () => {
  it('sizes a standalone copy by the viewBox aspect and leaves the page svg alone', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '-10 -10 400 200');
    svg.innerHTML = '<circle r="5"/><text style="fill:var(--canvas-ink)">5</text>';
    const { url, height } = svgDataUrl(svg, 1200);
    expect(height).toBe(600);
    const markup = decodeURIComponent(url.split(',')[1]);
    expect(url.startsWith('data:image/svg+xml')).toBe(true);
    expect(markup).toContain('width="1200"');
    expect(markup).toContain('<circle');
    expect(markup).not.toContain('var(--');
    expect(svg.hasAttribute('width')).toBe(false);
  });
});
