'use client';

import { TrendingUp } from 'lucide-react';
import type { useProgressWorkspace } from './useProgressWorkspace';

type WeightGraphProps = Pick<ReturnType<typeof useProgressWorkspace>, 'groupedLogs' | 'targetWeight'>;

export default function WeightGraph({ groupedLogs, targetWeight }: WeightGraphProps) {
  if (groupedLogs.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center border border-dashed border-brand-border rounded-2xl bg-brand-surface/20 text-brand-muted text-xs font-semibold">
        <TrendingUp className="w-4 h-4 text-brand-green mr-1.5" />
        <span>Log your weight to generate progress graphs</span>
      </div>
    );
  }

  // Graph Dimensions
  const width = 500;
  const height = 180;
  const padding = 25;

  // Resolve min/max weights for scale
  const weights = groupedLogs.map((log) => log.weightKg);
  if (targetWeight > 0) {
    weights.push(targetWeight);
  }
  const maxW = Math.max(...weights) + 4;
  const minW = Math.max(0, Math.min(...weights) - 4);
  const rangeW = maxW - minW || 10;

  // Map logs to coordinates
  const points = groupedLogs.map((log, idx) => {
    const ratio = groupedLogs.length > 1 ? idx / (groupedLogs.length - 1) : 0.5;
    const x = padding + ratio * (width - padding * 2);
    const y = height - padding - ((log.weightKg - minW) / rangeW) * (height - padding * 2);
    return { x, y, weight: log.weightKg, date: log.dateLabel };
  });

  // Create Path commands
  let linePath = '';
  let areaPath = '';
  if (points.length > 0) {
    linePath =
      `M ${points[0].x} ${points[0].y} ` +
      points
        .slice(1)
        .map((p) => `L ${p.x} ${p.y}`)
        .join(' ');
    areaPath = `${linePath} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;
  }

  const targetY = targetWeight > 0 ? height - padding - ((targetWeight - minW) / rangeW) * (height - padding * 2) : 0;

  return (
    <div className="w-full bg-brand-surface/30 border border-brand-border/60 p-4 rounded-2xl shadow-inner relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-brand-green/5 blur-3xl pointer-events-none rounded-full" />
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand-green)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--brand-green)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--brand-green)" />
            <stop offset="100%" stopColor="var(--brand-cyan)" />
          </linearGradient>
        </defs>

        {/* Dotted Grid lines */}
        <line
          x1={padding}
          y1={padding}
          x2={width - padding}
          y2={padding}
          stroke="var(--brand-border)"
          strokeDasharray="3"
        />
        <line
          x1={padding}
          y1={height / 2}
          x2={width - padding}
          y2={height / 2}
          stroke="var(--brand-border)"
          strokeDasharray="3"
        />
        <line
          x1={padding}
          y1={height - padding}
          x2={width - padding}
          y2={height - padding}
          stroke="var(--brand-border)"
        />

        {/* Target Weight Baseline */}
        {targetWeight > 0 && targetY > padding && targetY < height - padding && (
          <>
            <line
              x1={padding}
              y1={targetY}
              x2={width - padding}
              y2={targetY}
              stroke="rgba(239, 68, 68, 0.45)"
              strokeDasharray="4 4"
              strokeWidth="1.5"
            />
            <text
              x={width - padding - 6}
              y={targetY - 5}
              fill="rgba(239, 68, 68, 0.7)"
              fontSize="8"
              fontWeight="black"
              textAnchor="end"
            >
              Target: {targetWeight} kg
            </text>
          </>
        )}

        {/* Filled Area */}
        {areaPath && <path d={areaPath} fill="url(#areaGrad)" />}

        {/* Stroke Line */}
        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke="url(#lineGrad)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Graph Nodes */}
        {points.map((p, idx) => (
          <g key={idx}>
            <circle
              cx={p.x}
              cy={p.y}
              r="5"
              fill="var(--brand-surface)"
              stroke="var(--brand-green)"
              strokeWidth="2.5"
              className="transition-all duration-200 hover:r-7 cursor-pointer"
            />
            <text x={p.x} y={p.y - 9} fill="var(--brand-text)" fontSize="8" fontWeight="extrabold" textAnchor="middle">
              {p.weight}
            </text>
            <text
              x={p.x}
              y={height - padding + 13}
              fill="var(--brand-muted)"
              fontSize="7"
              fontWeight="bold"
              textAnchor="middle"
            >
              {p.date}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
