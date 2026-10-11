---
name: KAINARA
description: The existing KAINARA visual system, preserved during interface refinement.
colors:
  light-background: '#faf8f5'
  light-background-alt: '#f3efe8'
  light-surface: '#ffffff'
  light-border: '#dce4e0'
  light-text: '#0d2820'
  light-muted: '#5a746a'
  light-green: '#08705b'
  dark-background: '#071914'
  dark-background-alt: '#0b231c'
  dark-surface: '#0e271f'
  dark-border: '#173e33'
  dark-text: '#eff8f3'
  dark-muted: '#8ea99f'
  dark-green: '#10b981'
  orange: '#eb6a38'
  peach: '#f09e6c'
typography:
  display:
    fontFamily: 'Outfit, sans-serif'
  body:
    fontFamily: 'DM Sans, sans-serif'
  data:
    fontFamily: 'JetBrains Mono, monospace'
rounded:
  xl: '14px'
  2xl: '20px'
  3xl: '24px'
  surface: '28px'
  surface-desktop: '36px'
spacing:
  compact: '8px'
  group: '16px'
  section: '24px'
components:
  button-primary:
    backgroundColor: '{colors.orange}'
    textColor: '#ffffff'
    rounded: '{rounded.2xl}'
    height: '44px'
---

# Design System: KAINARA

## Overview

This records the existing system from `frontend/src/app/globals.css`, `frontend/tailwind.config.ts`, and shared UI components. It is an incumbent design reference, not a replacement visual identity. Executable tokens and the component contracts in `frontend/src/components/README.md` remain the implementation sources of truth.

The user has explicitly asked to preserve the theme while improving clarity and hierarchy. Warm cream, pine green, orange actions, rounded surfaces and Filipino illustrations are established parts of that identity.

## Colors

Use the matching light/dark CSS variables through semantic Tailwind tokens. Orange and peach identify primary actions and selected navigation. Green identifies ordinary links, supporting icons and appropriate completed states. Keep existing semantic warning/error/info colors; preserve their textual meanings. Document paper remains readable independently of the surrounding viewer theme.

## Typography

Outfit supplies display headings and existing button labels. DM Sans supplies body and record text. JetBrains Mono is available for identifiers and measured data. Data counts use tabular numerals and explicit units. Preserve the current font loading and fallbacks.

## Layout

Staff pages use the portal shell, shared page header and section tabs. Prioritize current work, then supporting totals, then optional explanatory detail. Related secondary metrics may share one surface. Comparable records use the grocery-style WorkspaceTable with bounded scrolling; keep all recorded fields accessible. Adapt with structural grid changes and contained table scrolling, keeping DOM order and focus order consistent.

## Elevation & Depth

Use existing tinted `shadow-card`, `shadow-card-hover` and `shadow-card-lg` tokens. Default Card has a subtle border and soft shadow; preserve this established combination. Optional decorations and existing gradients are intentional, especially on member and public surfaces. Staff summaries need less decoration and fewer nested surfaces.

## Shapes

Reuse Card, Button, Input and existing rounded table/dialog surfaces. Keep larger default card corners and the existing orange button gradient. General advice about smaller radii or flat buttons does not override these established components.

## Components

Use WorkspaceMetricStrip for compact comparable totals, WorkspaceTable for records, and existing tabs, dropdowns and loaders. Callers own data, permissions, filters and mutations. DocumentViewer and the desktop ReviewCanvas retain their separate interactions. Keep the shared Nara illustrations, meal plates, logo and landing ribbons in their existing contexts; do not add decorative artwork to ordinary staff records.

## Do's and Don'ts

- Do improve reading order, grouping, spacing, accessible controls and both theme variants.
- Do preserve numeric definitions, historical evidence and clinical/admin role boundaries.
- Do reuse shared components and keep long values and empty states usable.
- Don't replace the palette, fonts, illustrations, orange actions or approved document/canvas patterns during refinement.
- Don't treat available records, completed setup or a published dataset as clinical approval.
- Don't turn every number, instruction and explanatory paragraph into another card.
