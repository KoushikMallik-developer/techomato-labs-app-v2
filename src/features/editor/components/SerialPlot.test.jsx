import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SerialPlot, { parseSeries } from './SerialPlot';

describe('parseSeries', () => {
  it('reads plain and named numbers per line, skipping text-only lines', () => {
    const s = parseSeries('Ready!\npot = 512, wait = 300 ms\npot = 100, wait = 80 ms\n');
    expect(s.map((x) => x.label)).toEqual(['pot', 'wait']);
    expect(s[0].points).toEqual([[0, 512], [1, 100]]);
    expect(parseSeries('-1.5\n2\n')[0]).toEqual({ label: 'value 1', points: [[0, -1.5], [1, 2]] });
  });

  it("ignores the simulator's own warnings", () => {
    const s = parseSeries('10\n⚠️ Arduino pin 13 is drawing too much current (45mA)\n20\n');
    expect(s).toHaveLength(1);
    expect(s[0].points).toEqual([[0, 10], [1, 20]]);
  });

  it('keeps only the last 200 lines', () => {
    const text = Array.from({ length: 300 }, (_, i) => String(i)).join('\n');
    const [s] = parseSeries(text);
    expect(s.points).toHaveLength(200);
    expect(s.points[0][1]).toBe(100);
  });
});

describe('SerialPlot', () => {
  it('explains what to do before there are numbers, then draws one line per series', () => {
    const { rerender, container } = render(<SerialPlot serialText="Ready!" />);
    expect(screen.getByText(/Serial.println/)).toBeInTheDocument();
    rerender(<SerialPlot serialText={'a:1 b:2\na:3 b:4\n'} />);
    expect(container.querySelectorAll('polyline')).toHaveLength(2);
    expect(screen.getByText(/a 3/)).toBeInTheDocument();
  });
});
