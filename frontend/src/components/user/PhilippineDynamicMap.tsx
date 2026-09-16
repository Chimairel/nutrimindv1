'use client';

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Compass, MapPin, Radio, Sparkles } from 'lucide-react';
import type { MealLocalityPreference } from '@/types';
import { formatRegionDisplay } from '@/lib/philippine-regions';

interface PhilippineDynamicMapProps {
  preference: MealLocalityPreference;
  regionName?: string;
  provinceHucName?: string;
  className?: string;
}

// Approximate coordinate centers for Philippine regions within SVG canvas (400 x 520)
interface RegionFocus {
  islandGroup: 'LUZON' | 'VISAYAS' | 'MINDANAO';
  cx: number;
  cy: number;
  zoom: number;
}

const REGION_COORDINATES: Record<string, RegionFocus> = {
  // Luzon
  'National Capital Region': { islandGroup: 'LUZON', cx: 175, cy: 172, zoom: 2.8 },
  'Cordillera Administrative Region': { islandGroup: 'LUZON', cx: 175, cy: 95, zoom: 2.5 },
  'Ilocos Region': { islandGroup: 'LUZON', cx: 155, cy: 95, zoom: 2.4 },
  'Cagayan Valley': { islandGroup: 'LUZON', cx: 205, cy: 95, zoom: 2.4 },
  'Central Luzon': { islandGroup: 'LUZON', cx: 175, cy: 145, zoom: 2.5 },
  CALABARZON: { islandGroup: 'LUZON', cx: 185, cy: 195, zoom: 2.5 },
  'MIMAROPA Region': { islandGroup: 'LUZON', cx: 145, cy: 235, zoom: 2.2 },
  'Bicol Region': { islandGroup: 'LUZON', cx: 235, cy: 215, zoom: 2.4 },
  // Visayas
  'Western Visayas': { islandGroup: 'VISAYAS', cx: 195, cy: 265, zoom: 2.6 },
  'Negros Island Region': { islandGroup: 'VISAYAS', cx: 215, cy: 295, zoom: 2.6 },
  'Central Visayas': { islandGroup: 'VISAYAS', cx: 240, cy: 275, zoom: 2.8 },
  'Eastern Visayas': { islandGroup: 'VISAYAS', cx: 275, cy: 250, zoom: 2.5 },
  // Mindanao
  'Zamboanga Peninsula': { islandGroup: 'MINDANAO', cx: 165, cy: 375, zoom: 2.5 },
  'Northern Mindanao': { islandGroup: 'MINDANAO', cx: 245, cy: 360, zoom: 2.5 },
  'Davao Region': { islandGroup: 'MINDANAO', cx: 275, cy: 405, zoom: 2.6 },
  SOCCSKSARGEN: { islandGroup: 'MINDANAO', cx: 235, cy: 430, zoom: 2.5 },
  Caraga: { islandGroup: 'MINDANAO', cx: 285, cy: 345, zoom: 2.5 },
  'Bangsamoro Autonomous Region in Muslim Mindanao': { islandGroup: 'MINDANAO', cx: 205, cy: 400, zoom: 2.4 },
};

export default function PhilippineDynamicMap({
  preference,
  regionName = '',
  provinceHucName = '',
  className = '',
}: PhilippineDynamicMapProps) {
  const cleanRegion = regionName.trim();
  const cleanProvince = provinceHucName.trim();

  // Normalize strength to 1 (National), 2 (Regional), or 3 (Local)
  const strengthLevel = useMemo(() => {
    if (preference === 'LOCAL' || preference === 'REGIONAL_LOCAL') return 3;
    if (preference === 'REGIONAL' || preference === 'NATIONAL_REGIONAL') return 2;
    return 1;
  }, [preference]);

  const regionInfo = useMemo(() => {
    if (!cleanRegion) return null;
    return (
      REGION_COORDINATES[cleanRegion] || {
        islandGroup: 'VISAYAS',
        cx: 220,
        cy: 260,
        zoom: 2.2,
      }
    );
  }, [cleanRegion]);

  // Camera viewport transformation calculation
  const viewBox = useMemo(() => {
    if (strengthLevel === 1 || !regionInfo) {
      // Full archipelago overview
      return '0 0 400 520';
    }

    if (strengthLevel === 2) {
      // Zoomed into region
      const w = 400 / regionInfo.zoom;
      const h = 520 / regionInfo.zoom;
      const x = Math.max(0, Math.min(400 - w, regionInfo.cx - w / 2));
      const y = Math.max(0, Math.min(520 - h, regionInfo.cy - h / 2));
      return `${x} ${y} ${w} ${h}`;
    }

    // Local level: Zoom closer around locality
    const localZoom = regionInfo.zoom * 1.35;
    const w = 400 / localZoom;
    const h = 520 / localZoom;
    const x = Math.max(0, Math.min(400 - w, regionInfo.cx - w / 2));
    const y = Math.max(0, Math.min(520 - h, regionInfo.cy - h / 2));
    return `${x} ${y} ${w} ${h}`;
  }, [strengthLevel, regionInfo]);

  // Highlight state helpers
  const isNational = strengthLevel === 1;
  const isRegional = strengthLevel === 2;
  const isLocal = strengthLevel === 3;

  const highlightedGroup = regionInfo ? regionInfo.islandGroup : null;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-brand-border/70 bg-gradient-to-b from-[#091410] via-[#0d1c16] to-[#08120d] text-white shadow-card ${className}`}
    >
      {/* Background Radar Grid */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.07] bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:16px_16px]" />

      {/* Top HUD Status Banner */}
      <div className="relative z-10 flex items-center justify-between border-b border-white/[0.08] bg-white/[0.03] px-3.5 py-2 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="flex h-2 w-2 items-center justify-center">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-green opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-green" />
            </span>
          </div>
          <span className="font-mono text-[10px] font-bold tracking-widest text-brand-green uppercase">
            {isNational
              ? 'Level 1: Nationwide'
              : isRegional
                ? `Level 2: ${formatRegionDisplay(cleanRegion) || 'Regional'}`
                : `Level 3: ${cleanProvince || cleanRegion || 'Local'}`}
          </span>
        </div>

        <div className="flex items-center gap-1.5 font-mono text-[9px] text-white/50">
          <Compass className="h-3 w-3 text-brand-green" />
          <span>12.8797° N, 121.7740° E</span>
        </div>
      </div>

      {/* Interactive SVG Canvas */}
      <div className="relative flex h-52 w-full items-center justify-center p-2 sm:h-56">
        <svg
          viewBox={viewBox}
          className="h-full w-full transition-all duration-700 ease-out select-none"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            {/* National Emerald Gradient */}
            <linearGradient id="nationalGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>

            {/* Active Region Accent Gradient */}
            <linearGradient id="regionGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#b8f45f" />
              <stop offset="50%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#0d9488" />
            </linearGradient>

            {/* Inactive / Base Island Fill */}
            <linearGradient id="baseIslandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1f2937" />
              <stop offset="100%" stopColor="#111827" />
            </linearGradient>

            {/* Glowing Drop Shadow */}
            <filter id="emeraldGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#10b981" floodOpacity="0.5" />
            </filter>
            <filter id="limeGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#b8f45f" floodOpacity="0.75" />
            </filter>
          </defs>

          {/* Coordinate Grid Lines */}
          <g className="stroke-white/[0.06] stroke-[0.75]" strokeDasharray="3 4">
            <line x1="50" y1="0" x2="50" y2="520" />
            <line x1="150" y1="0" x2="150" y2="520" />
            <line x1="250" y1="0" x2="250" y2="520" />
            <line x1="350" y1="0" x2="350" y2="520" />
            <line x1="0" y1="130" x2="400" y2="130" />
            <line x1="0" y1="260" x2="400" y2="260" />
            <line x1="0" y1="390" x2="400" y2="390" />
          </g>

          {/* ── 1. LUZON GROUP ── */}
          <g
            className="transition-opacity duration-500"
            style={{
              opacity: isNational || highlightedGroup === 'LUZON' ? 1 : 0.25,
            }}
          >
            {/* Northern Luzon & Cordillera */}
            <path
              d="M 160,40 L 195,45 L 215,75 L 225,120 L 205,145 L 180,165 L 155,150 L 145,100 L 155,60 Z"
              fill={
                isNational
                  ? 'url(#nationalGrad)'
                  : highlightedGroup === 'LUZON'
                    ? 'url(#regionGrad)'
                    : 'url(#baseIslandGrad)'
              }
              stroke={highlightedGroup === 'LUZON' && !isNational ? '#b8f45f' : '#10b981'}
              strokeWidth={highlightedGroup === 'LUZON' ? 1.8 : 1}
              filter={highlightedGroup === 'LUZON' ? 'url(#emeraldGlow)' : undefined}
            />
            {/* Central Luzon & NCR / Southern Tagalog */}
            <path
              d="M 155,155 L 185,160 L 200,185 L 190,215 L 175,205 L 160,185 Z"
              fill={
                isNational
                  ? 'url(#nationalGrad)'
                  : highlightedGroup === 'LUZON'
                    ? 'url(#regionGrad)'
                    : 'url(#baseIslandGrad)'
              }
              stroke={highlightedGroup === 'LUZON' && !isNational ? '#b8f45f' : '#10b981'}
              strokeWidth={1}
            />
            {/* Bicol Peninsula */}
            <path
              d="M 200,195 L 235,205 L 255,235 L 245,255 L 225,245 L 210,215 Z"
              fill={
                isNational
                  ? 'url(#nationalGrad)'
                  : highlightedGroup === 'LUZON'
                    ? 'url(#regionGrad)'
                    : 'url(#baseIslandGrad)'
              }
              stroke={highlightedGroup === 'LUZON' && !isNational ? '#b8f45f' : '#10b981'}
              strokeWidth={1}
            />
            {/* Mindoro & Marinduque */}
            <path
              d="M 145,210 L 165,215 L 160,250 L 135,245 Z"
              fill={
                isNational
                  ? 'url(#nationalGrad)'
                  : highlightedGroup === 'LUZON'
                    ? 'url(#regionGrad)'
                    : 'url(#baseIslandGrad)'
              }
              stroke="#10b981"
              strokeWidth={1}
            />
            {/* Palawan Archipelago */}
            <path
              d="M 115,260 L 130,270 L 95,340 L 75,370 L 65,360 L 95,310 Z"
              fill={
                isNational
                  ? 'url(#nationalGrad)'
                  : highlightedGroup === 'LUZON'
                    ? 'url(#regionGrad)'
                    : 'url(#baseIslandGrad)'
              }
              stroke="#10b981"
              strokeWidth={1}
            />
          </g>

          {/* ── 2. VISAYAS GROUP ── */}
          <g
            className="transition-opacity duration-500"
            style={{
              opacity: isNational || highlightedGroup === 'VISAYAS' ? 1 : 0.25,
            }}
          >
            {/* Western Visayas (Panay & Guimaras) */}
            <path
              d="M 180,255 L 205,250 L 210,275 L 185,285 Z"
              fill={
                isNational
                  ? 'url(#nationalGrad)'
                  : highlightedGroup === 'VISAYAS'
                    ? 'url(#regionGrad)'
                    : 'url(#baseIslandGrad)'
              }
              stroke={highlightedGroup === 'VISAYAS' ? '#b8f45f' : '#10b981'}
              strokeWidth={highlightedGroup === 'VISAYAS' ? 1.8 : 1}
            />
            {/* Negros Island */}
            <path
              d="M 205,280 L 220,285 L 215,330 L 195,320 Z"
              fill={
                isNational
                  ? 'url(#nationalGrad)'
                  : highlightedGroup === 'VISAYAS'
                    ? 'url(#regionGrad)'
                    : 'url(#baseIslandGrad)'
              }
              stroke={highlightedGroup === 'VISAYAS' ? '#b8f45f' : '#10b981'}
              strokeWidth={highlightedGroup === 'VISAYAS' ? 1.8 : 1}
            />
            {/* Central Visayas (Cebu & Bohol) */}
            <path
              d="M 230,265 L 242,268 L 238,315 L 228,305 Z"
              fill={
                isNational
                  ? 'url(#nationalGrad)'
                  : highlightedGroup === 'VISAYAS'
                    ? 'url(#regionGrad)'
                    : 'url(#baseIslandGrad)'
              }
              stroke={highlightedGroup === 'VISAYAS' ? '#b8f45f' : '#10b981'}
              strokeWidth={highlightedGroup === 'VISAYAS' ? 2 : 1}
              filter={highlightedGroup === 'VISAYAS' ? 'url(#limeGlow)' : undefined}
            />
            {/* Bohol */}
            <circle
              cx="252"
              cy="295"
              r="9"
              fill={
                isNational
                  ? 'url(#nationalGrad)'
                  : highlightedGroup === 'VISAYAS'
                    ? 'url(#regionGrad)'
                    : 'url(#baseIslandGrad)'
              }
              stroke={highlightedGroup === 'VISAYAS' ? '#b8f45f' : '#10b981'}
              strokeWidth={1}
            />
            {/* Eastern Visayas (Samar & Leyte) */}
            <path
              d="M 260,225 L 285,235 L 280,270 L 255,255 Z"
              fill={
                isNational
                  ? 'url(#nationalGrad)'
                  : highlightedGroup === 'VISAYAS'
                    ? 'url(#regionGrad)'
                    : 'url(#baseIslandGrad)'
              }
              stroke={highlightedGroup === 'VISAYAS' ? '#b8f45f' : '#10b981'}
              strokeWidth={1}
            />
            <path
              d="M 260,265 L 275,270 L 265,310 L 250,295 Z"
              fill={
                isNational
                  ? 'url(#nationalGrad)'
                  : highlightedGroup === 'VISAYAS'
                    ? 'url(#regionGrad)'
                    : 'url(#baseIslandGrad)'
              }
              stroke={highlightedGroup === 'VISAYAS' ? '#b8f45f' : '#10b981'}
              strokeWidth={1}
            />
          </g>

          {/* ── 3. MINDANAO GROUP ── */}
          <g
            className="transition-opacity duration-500"
            style={{
              opacity: isNational || highlightedGroup === 'MINDANAO' ? 1 : 0.25,
            }}
          >
            {/* Main Mindanao Landmass */}
            <path
              d="M 205,340 L 255,335 L 295,350 L 305,410 L 285,450 L 245,460 L 210,430 L 200,380 Z"
              fill={
                isNational
                  ? 'url(#nationalGrad)'
                  : highlightedGroup === 'MINDANAO'
                    ? 'url(#regionGrad)'
                    : 'url(#baseIslandGrad)'
              }
              stroke={highlightedGroup === 'MINDANAO' && !isNational ? '#b8f45f' : '#10b981'}
              strokeWidth={highlightedGroup === 'MINDANAO' ? 1.8 : 1}
              filter={highlightedGroup === 'MINDANAO' ? 'url(#emeraldGlow)' : undefined}
            />
            {/* Zamboanga Peninsula */}
            <path
              d="M 195,365 L 165,370 L 150,400 L 175,405 L 195,385 Z"
              fill={
                isNational
                  ? 'url(#nationalGrad)'
                  : highlightedGroup === 'MINDANAO'
                    ? 'url(#regionGrad)'
                    : 'url(#baseIslandGrad)'
              }
              stroke={highlightedGroup === 'MINDANAO' && !isNational ? '#b8f45f' : '#10b981'}
              strokeWidth={1}
            />
            {/* Sulu & Tawi-Tawi Archipelago */}
            <path
              d="M 140,415 L 125,430 L 105,455"
              fill="none"
              stroke={highlightedGroup === 'MINDANAO' && !isNational ? '#b8f45f' : '#10b981'}
              strokeWidth={2}
              strokeDasharray="3 5"
            />
          </g>

          {/* ── REGIONAL FOCUS FRAME / RADAR ── */}
          {regionInfo && (isRegional || isLocal) && (
            <g>
              {/* Regional Bounding Focus Target */}
              <circle
                cx={regionInfo.cx}
                cy={regionInfo.cy}
                r={isLocal ? 22 : 36}
                fill="none"
                stroke="#b8f45f"
                strokeWidth={1.2}
                strokeDasharray="4 3"
                className="animate-[spin_20s_linear_infinite]"
              />

              {/* Local Locality Pin */}
              {isLocal && (
                <g transform={`translate(${regionInfo.cx}, ${regionInfo.cy})`}>
                  {/* Radiating Ripple Circles */}
                  <circle cx="0" cy="0" r="14" fill="#b8f45f" fillOpacity="0.25" className="animate-ping" />
                  <circle cx="0" cy="0" r="6" fill="#b8f45f" />
                  <circle cx="0" cy="0" r="2.5" fill="#07100d" />
                </g>
              )}
            </g>
          )}
        </svg>

        {/* Dynamic Overlay HUD Tag */}
        <AnimatePresence mode="wait">
          {isNational && (
            <motion.div
              key="hud-national"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/60 px-2.5 py-1 text-[10px] font-bold text-white/90 backdrop-blur-md"
            >
              <Sparkles className="h-3 w-3 text-brand-green" />
              <span>Nationwide FCT & Staples</span>
            </motion.div>
          )}

          {isRegional && cleanRegion && (
            <motion.div
              key="hud-regional"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-1.5 rounded-lg border border-brand-green/30 bg-black/75 px-2.5 py-1 text-[10px] font-bold text-brand-accent backdrop-blur-md"
            >
              <Radio className="h-3 w-3 text-brand-accent" />
              <span>{formatRegionDisplay(cleanRegion)}</span>
            </motion.div>
          )}

          {isLocal && (cleanProvince || cleanRegion) && (
            <motion.div
              key="hud-local"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-1.5 rounded-lg border border-brand-accent/40 bg-black/80 px-2.5 py-1 text-[10px] font-black text-brand-accent backdrop-blur-md shadow-lg"
            >
              <MapPin className="h-3 w-3 text-brand-accent" />
              <span>{cleanProvince ? `${cleanProvince} Locality` : formatRegionDisplay(cleanRegion)}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Context Footer */}
      <div className="border-t border-white/[0.08] bg-white/[0.02] px-3.5 py-2 text-[11px] leading-relaxed text-brand-muted">
        {isNational ? (
          <span>
            Favor Philippines-wide familiar dishes. Published FNRI evidence and nationwide food staples are utilized.
          </span>
        ) : isRegional ? (
          <span>
            {cleanRegion
              ? `Prioritizing regional food evidence and favorites across ${formatRegionDisplay(cleanRegion)}.`
              : 'Select a region above to focus the map and unlock regional dishes.'}
          </span>
        ) : (
          <span>
            {cleanProvince
              ? `Centering recommendations on local market availability in ${cleanProvince}, with regional fallback.`
              : 'Select a province or city above to pinpoint local food evidence.'}
          </span>
        )}
      </div>
    </div>
  );
}
