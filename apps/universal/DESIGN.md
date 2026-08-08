---
name: FitBlock
description: Fitness platform connecting athletes and coaches
colors:
  primary: "#3b82f6"
  neutral-50: "#f9fafb"
  neutral-100: "#f3f4f6"
  neutral-900: "#111827"
  success: "#10b981"
  warning: "#f59e0b"
  error: "#ef4444"
typography:
  display:
    fontFamily: "System"
    fontSize: "32px"
    fontWeight: 600
    lineHeight: 1.2
  heading:
    fontFamily: "System"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "System"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "System"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.4
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "12px 24px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: "12px 24px"
  card:
    backgroundColor: "{colors.neutral-50}"
    rounded: "{rounded.lg}"
    padding: "{spacing.md}"
---

# Design System: FitBlock

## Overview

**Creative North Star: "Clear Clarity"**

FitBlock is a clean, purposeful fitness platform designed for clarity and progress tracking. The design prioritizes task focus—whether an athlete is checking today's workout or a coach is reviewing performance—with intuitive navigation and minimal cognitive load. The visual system supports rapid comprehension of training data and exercise information through clear hierarchy, ample whitespace, and strategic use of accent color to highlight action and progress.

**Key Characteristics:**
- Clean, minimal aesthetic with breathing space
- Task-focused navigation (athlete vs coach contexts)
- Strategic color usage (blue for actions, neutrals for content)
- Mobile-first, responsive layout
- Clear typography hierarchy

## Colors

A neutral-dominant palette with strategic primary accent.

### Primary
- **FitBlock Blue** (#3b82f6): Primary action color, navigation highlights, interactive elements. Used to draw attention to key actions like "Start Workout" or "Create Plan."

### Neutral
- **Off-White** (#f9fafb): Background surfaces, cards, content containers
- **Light Gray** (#f3f4f6): Dividers, subtle backgrounds, disabled states
- **Dark Charcoal** (#111827): Text, headings, high-contrast content

### Semantic
- **Success Green** (#10b981): Completion status, progress indicators, successful actions
- **Warning Amber** (#f59e0b): Caution states, pending actions
- **Error Red** (#ef4444): Errors, destructive actions, warnings

## Typography

**Display Font:** System (platform native)
**Body Font:** System (platform native)

**Character:** Straightforward, accessible, and modern. The system uses native platform fonts for clarity and performance, with clear weight differentiation to establish hierarchy.

### Hierarchy
- **Display** (600, 32px, 1.2): Hero headlines, app titles
- **Heading** (600, 24px, 1.3): Section headers, screen titles
- **Body** (400, 16px, 1.5): Primary content, descriptions, labels
- **Label** (500, 12px, 1.4): Metadata, secondary info, captions

## Layout

The design uses a single-column layout on mobile and tablet, expanding to a managed width on desktop. Content is organized in logical sections with consistent spacing (8px base unit: 8, 16, 24, 32px). A persistent bottom navigation on mobile provides role-aware context switching (Athlete: Today, Calendar, Progress, Store, Profile; Coach: Teams, Calendar, Library, Settings).

Touch targets are minimum 44×44px for accessibility compliance.

## Elevation & Depth

The system is **flat by default**, relying on tonal layering (light grays as backgrounds) and subtle borders rather than shadows. Cards and containers use light backgrounds to establish hierarchy; focus states use color change and opacity shifts.

## Shapes

Consistent gentle rounding (4–12px) on interactive elements and cards. Buttons use medium radius (8px); cards use slightly larger radius (12px) for breathing room.

## Components

### Buttons
- **Primary Button:** Blue background, white text, 8px radius, 12×24px padding. Hover: darker blue.
- **Ghost Button:** Transparent, blue text, 8px radius, 12×24px padding. Hover: light blue background.
- **Disabled:** Reduced opacity, cursor not-allowed.

### Cards
- **Style:** Light gray background (#f9fafb), 12px radius, 16px padding
- **Border:** Subtle 1px light gray divider
- **Purpose:** Container for workout sessions, coach notes, athlete progress

### Navigation (Bottom Mobile)
- **Style:** White background, 5 role-based items (icons + labels)
- **Active State:** Item text and icon in primary blue
- **Inactive State:** Item text and icon in neutral gray

### Inputs / Fields
- **Style:** Light gray background, 8px radius, 12px padding, light gray border (1px)
- **Focus:** Blue border, primary color accent

## Do's and Don'ts

### Do:
- **Do** use blue primary color sparingly for key actions and navigation
- **Do** maintain ample whitespace for breathing room and clarity
- **Do** ensure 44×44px minimum touch targets on mobile
- **Do** use semantic colors (green for success, red for error, amber for caution)
- **Do** respect `prefers-reduced-motion` for any transitions or animations

### Don't:
- **Don't** overuse accent color; keep it reserved for interactive elements
- **Don't** place text or important content on photographic backgrounds without contrast verification
- **Don't** create horizontal scroll on mobile; keep single-column layout
- **Don't** use color alone to communicate status; pair with icons and text
