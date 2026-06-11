---
name: Atoll Geometric
colors:
  surface: '#f9f9f9'
  surface-dim: '#dadada'
  surface-bright: '#f9f9f9'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3f3'
  surface-container: '#eeeeee'
  surface-container-high: '#e8e8e8'
  surface-container-highest: '#e2e2e2'
  on-surface: '#1a1c1c'
  on-surface-variant: '#43474f'
  inverse-surface: '#2f3131'
  inverse-on-surface: '#f1f1f1'
  outline: '#737780'
  outline-variant: '#c3c6d1'
  surface-tint: '#3a5f94'
  primary: '#001e40'
  on-primary: '#ffffff'
  primary-container: '#003366'
  on-primary-container: '#799dd6'
  inverse-primary: '#a7c8ff'
  secondary: '#00696b'
  on-secondary: '#ffffff'
  secondary-container: '#56f5f8'
  on-secondary-container: '#006e70'
  tertiary: '#002501'
  on-tertiary: '#ffffff'
  tertiary-container: '#003d04'
  on-tertiary-container: '#4bb043'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d5e3ff'
  primary-fixed-dim: '#a7c8ff'
  on-primary-fixed: '#001b3c'
  on-primary-fixed-variant: '#1f477b'
  secondary-fixed: '#5af8fb'
  secondary-fixed-dim: '#2ddbde'
  on-secondary-fixed: '#002020'
  on-secondary-fixed-variant: '#004f51'
  tertiary-fixed: '#92fa83'
  tertiary-fixed-dim: '#77dd6a'
  on-tertiary-fixed: '#002201'
  on-tertiary-fixed-variant: '#005307'
  background: '#f9f9f9'
  on-background: '#1a1c1c'
  surface-variant: '#e2e2e2'
  ocean-deep: '#003366'
  reef-turquoise: '#00CED1'
  island-green: '#228B22'
  sand-neutral: '#F5F5F5'
  status-success: '#1B5E20'
  status-warning: '#E65100'
  status-error: '#B71C1C'
  status-info: '#01579B'
  border-subtle: '#E0E0E0'
  surface-card: '#FFFFFF'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 40px
  container-max-width: 1440px
---

## Brand & Style

The design system is engineered for the **Maldives Island Registry**, a professional geospatial platform that balances government-grade authority with the vibrant natural palette of the archipelago. The target audience includes urban planners, environmental researchers, and government officials who require precision and reliability.

The design style is **Corporate / Modern** with a focus on high-density information display. It prioritizes clarity over ornamentation, utilizing a "Swiss-inspired" layout characterized by rigorous grid systems, generous whitespace to prevent cognitive overload, and crisp, intentional borders. The aesthetic avoids heavy shadows in favor of tonal layering and subtle strokes, ensuring the interface feels light, efficient, and technologically advanced.

## Colors

The palette is rooted in the "Deep Ocean Blue" (#003366), serving as the primary color for navigation and structural elements to convey stability and institutional trust. "Reef Turquoise" acts as the secondary action color, used sparingly for primary buttons and interactive map highlights to provide a modern, high-tech contrast.

"Island Green" is reserved for environmental data indicators and tertiary actions. The neutral "Sand" background (#F5F5F5) reduces eye strain during long sessions of data entry or map analysis. Status indicators use a higher-saturation variant of the primary palette to ensure clear communication of data completeness and verification scores without breaking the professional tone.

## Typography

The system utilizes **Inter** exclusively to ensure maximum legibility and a systematic, utilitarian feel. The hierarchy is strictly enforced: 
- **Headlines** use heavier weights (600-700) and negative letter spacing at larger sizes to maintain a compact, authoritative appearance.
- **Body text** defaults to 16px for optimal readability in data-heavy contexts.
- **Labels** utilize uppercase styling with increased letter spacing to distinguish metadata and table headers from content.
- All geospatial coordinates and numeric data should use tabular lining (if available in the font features) to ensure vertical alignment in tables.

## Layout & Spacing

This design system uses a **12-column fluid grid** for desktop and a **4-column grid** for mobile. The rhythm is based on a **4px baseline grid**, ensuring all components align to a consistent vertical scale.

- **Desktop (1200px+):** 12 columns, 24px gutters, 40px external margins.
- **Tablet (768px - 1199px):** 8 columns, 20px gutters, 24px external margins.
- **Mobile (Up to 767px):** 4 columns, 16px gutters, 16px external margins.

For map interfaces, a "Sidebar + Canvas" layout is preferred. The sidebar should be fixed at 360px width on desktop, while the map canvas expands to fill the remaining viewport. Content modules within cards should use 24px internal padding (the "standard container" unit).

## Elevation & Depth

To maintain a "government-grade" feel, this design system minimizes the use of heavy shadows. Depth is primarily conveyed through **Tonal Layers** and **Low-contrast Outlines**.

- **Level 0 (Background):** Used for the main page background (#F5F5F5).
- **Level 1 (Surfaces):** Cards and white containers use a 1px solid border (#E0E0E0). No shadow.
- **Level 2 (Navigation/Floating):** Top navigation bars or floating action buttons (FABs) in the map UI use a very soft, ambient shadow (0px 4px 12px rgba(0, 0, 0, 0.05)) to suggest they sit above the content.
- **Active States:** Elements being dragged or interacted with use a 2px stroke of the primary color rather than a shadow increase.

## Shapes

The shape language is **Soft (0.25rem)**. This provides a subtle modern touch without sacrificing the professional rigor required for a government portal. 

- **Standard Buttons & Inputs:** 4px (0.25rem) radius.
- **Data Cards:** 8px (0.5rem) radius.
- **Status Badges/Chips:** Fully rounded (pill-shaped) to distinguish them from interactive buttons.
- **Map Overlays:** 8px (0.5rem) radius to soften the technical interface.

## Components

### Buttons
- **Primary:** Background `#00CED1`, Text `#FFFFFF`. Solid fill, no gradient.
- **Secondary:** Outline `#003366`, Text `#003366`. 1px stroke.
- **Ghost:** Text `#003366`. Used for secondary map controls.

### Status Badges (Verification Scores)
- Use pill-shaped containers with a 10% opacity background of the status color and a 100% opacity text color.
- **Verified:** Green (#228B22)
- **Pending:** Warning (#E65100)
- **Incomplete:** Error (#B71C1C)

### Data Tables
- Header background: `#003366`. Header text: `#FFFFFF` (Small, Uppercase).
- Row background: Alt between `#FFFFFF` and `#F9F9F9`.
- Cell borders: 1px horizontal stroke only (#EEEEEE).

### Input Fields
- 1px border (#E0E0E0). On focus: 2px border (#00CED1).
- Labels are positioned above the input in `label-md` style.

### Cards
- White background, 1px border (#E0E0E0).
- Header section of the card should be separated by a subtle 1px divider.
- Content uses `body-sm` for high-density geospatial metadata.

### Interactive Map Elements
- Map controls (Zoom, Layer Toggle) should be grouped in floating white containers with 4px rounded corners and 1px borders.
- Tooltips on the map use the Primary Ocean Blue (#003366) as the background with white text for high contrast.