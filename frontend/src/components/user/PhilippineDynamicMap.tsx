'use client';

import React, { useMemo, useState } from 'react';
import { Compass, ExternalLink, MapPin, Sparkles } from 'lucide-react';
import type { MealLocalityPreference } from '@/types';
import { formatRegionDisplay } from '@/lib/philippine-regions';

interface PhilippineDynamicMapProps {
  preference: MealLocalityPreference;
  regionName?: string;
  provinceHucName?: string;
  className?: string;
}

// Approximate coordinate centers for Philippine regions
const REGION_COORDINATES: Record<string, { lat: number; lng: number }> = {
  'National Capital Region': { lat: 14.5995, lng: 120.9842 },
  'Cordillera Administrative Region': { lat: 17.3513, lng: 121.1719 },
  'Ilocos Region': { lat: 17.5707, lng: 120.3871 },
  'Cagayan Valley': { lat: 17.6132, lng: 121.727 },
  'Central Luzon': { lat: 15.4828, lng: 120.712 },
  CALABARZON: { lat: 14.1008, lng: 121.0794 },
  'MIMAROPA Region': { lat: 13.0565, lng: 121.4304 },
  'Bicol Region': { lat: 13.421, lng: 123.4137 },
  'Western Visayas': { lat: 10.7202, lng: 122.5621 },
  'Negros Island Region': { lat: 10.0439, lng: 122.9872 },
  'Central Visayas': { lat: 10.3157, lng: 123.8854 },
  'Eastern Visayas': { lat: 11.2433, lng: 125.0047 },
  'Zamboanga Peninsula': { lat: 7.8436, lng: 122.9563 },
  'Northern Mindanao': { lat: 8.4542, lng: 124.6319 },
  'Davao Region': { lat: 7.1907, lng: 125.4553 },
  SOCCSKSARGEN: { lat: 6.2707, lng: 124.6857 },
  Caraga: { lat: 8.9475, lng: 125.5406 },
  'Bangsamoro Autonomous Region in Muslim Mindanao': { lat: 7.2236, lng: 124.2464 },
};

export default function PhilippineDynamicMap({
  preference,
  regionName = '',
  provinceHucName = '',
  className = '',
}: PhilippineDynamicMapProps) {
  const cleanRegion = regionName.trim();
  const cleanProvince = provinceHucName.trim();
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  // Normalize strength to 1 (National), 2 (Regional), or 3 (Local)
  const strengthLevel = useMemo(() => {
    if (preference === 'LOCAL' || preference === 'REGIONAL_LOCAL') return 3;
    if (preference === 'REGIONAL' || preference === 'NATIONAL_REGIONAL') return 2;
    return 1;
  }, [preference]);

  const isRegional = strengthLevel === 2;
  const isLocal = strengthLevel === 3;

  // Determine target search query, zoom level, and label
  const { locationQuery, zoomLevel, levelLabel, localityBadge, coordinates, caption } = useMemo(() => {
    if (isLocal && (cleanProvince || cleanRegion)) {
      const target = cleanProvince || cleanRegion;
      const coords = REGION_COORDINATES[cleanRegion] || { lat: 10.3157, lng: 123.8854 };
      return {
        locationQuery: `${target}, Philippines`,
        zoomLevel: 10,
        levelLabel: `Level 3: ${target}`,
        localityBadge: `${target} Locality`,
        coordinates: `${coords.lat.toFixed(4)}° N, ${coords.lng.toFixed(4)}° E`,
        caption: `Centering recommendations on local market availability in ${target}, with regional fallback.`,
      };
    }

    if (isRegional && cleanRegion) {
      const coords = REGION_COORDINATES[cleanRegion] || { lat: 12.8797, lng: 121.774 };
      const displayRegion = formatRegionDisplay(cleanRegion);
      return {
        locationQuery: `${cleanRegion}, Philippines`,
        zoomLevel: 8,
        levelLabel: `Level 2: ${displayRegion}`,
        localityBadge: `${displayRegion} Focus`,
        coordinates: `${coords.lat.toFixed(4)}° N, ${coords.lng.toFixed(4)}° E`,
        caption: `Centering recommendations on regional market availability in ${displayRegion}.`,
      };
    }

    // Default National
    return {
      locationQuery: 'Philippines',
      zoomLevel: 5,
      levelLabel: 'Level 1: Nationwide',
      localityBadge: 'National Philippines',
      coordinates: '12.8797° N, 121.7740° E',
      caption: 'Favoring Philippines-wide familiarity. Published consumption evidence is used when available.',
    };
  }, [isLocal, isRegional, cleanProvince, cleanRegion]);

  const embedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(locationQuery)}&t=m&z=${zoomLevel}&output=embed`;
  const externalMapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationQuery)}`;

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
            {levelLabel}
          </span>
        </div>

        <div className="flex items-center gap-2 font-mono text-[9px] text-white/50">
          <div className="flex items-center gap-1">
            <Compass className="h-3 w-3 text-brand-green" />
            <span>{coordinates}</span>
          </div>
          <a
            href={externalMapUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Open in Google Maps"
            aria-label="Open in Google Maps"
            className="flex items-center gap-0.5 text-white/40 hover:text-brand-accent transition-colors ml-1"
          >
            <ExternalLink className="h-2.5 w-2.5" />
          </a>
        </div>
      </div>

      {/* Embedded Google Map Frame */}
      <div className="relative h-56 w-full overflow-hidden sm:h-64 bg-[#0a1510]">
        {!isMapLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#07110d] text-brand-muted text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-brand-green border-t-transparent" />
              <span>Loading Google Map...</span>
            </div>
          </div>
        )}

        <iframe
          key={`${locationQuery}-${zoomLevel}`}
          title={`Google Map - ${locationQuery}`}
          src={embedUrl}
          onLoad={() => setIsMapLoaded(true)}
          className={`h-full w-full border-0 select-none transition-opacity duration-500 dark:invert-[0.9] dark:hue-rotate-[170deg] dark:contrast-[1.1] dark:brightness-[0.88] ${
            isMapLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          aria-label={`Interactive Google Map focused on ${locationQuery}`}
        />
      </div>

      {/* Bottom Context Badge & Caption */}
      <div className="border-t border-white/[0.08] bg-[#07110d]/90 px-4 py-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-green/30 bg-brand-green/10 px-2.5 py-0.5 font-mono text-[10px] font-black uppercase tracking-wider text-brand-green">
            <MapPin className="h-3 w-3" />
            <span>{localityBadge}</span>
          </span>
          {isLocal && (
            <span className="inline-flex items-center gap-1 font-mono text-[9px] text-brand-accent">
              <Sparkles className="h-2.5 w-2.5" /> High priority
            </span>
          )}
        </div>
        <p className="text-[11px] leading-relaxed text-brand-muted">{caption}</p>
      </div>
    </div>
  );
}
