# Smart Camp Resource Book
## UI/UX Design Guidelines

Version: 1.0

---

# Purpose

This document defines the design principles for every UI component, page, layout, and interaction within the Smart Camp Resource Book project.

Any AI assistant (OpenAI, DeepSeek, Claude, Gemini, Cursor, GitHub Copilot, etc.) must follow these guidelines whenever generating or modifying frontend code.

These rules override default styling decisions.

---

# Overall Design Philosophy

The application should look like a modern premium SaaS product rather than a traditional management system.

Design should feel:

- Modern
- Premium
- Professional
- Clean
- Minimal
- Trustworthy
- Friendly
- Easy to use

Avoid looking like an old government portal or enterprise dashboard.

---

# Target Users

Primary users are:

- Camp staff
- Volunteers
- Camp administrators
- Resource managers

Most users are NOT technical.

Therefore the interface must be intuitive enough that someone can understand it without training.

---

# UX Principles

Always optimize for:

- Simplicity
- Readability
- Speed
- Accessibility
- Consistency
- Minimal clicks

Users should never wonder:

"What should I do next?"

The interface should naturally guide them.

---

# Mobile First

Always design mobile first.

Every component must work perfectly on:

- Mobile phones
- Tablets
- Desktop

Responsive behavior should be intentional—not an afterthought.

---

# Navigation

Navigation should be extremely simple.

Requirements:

- Clear labels
- Consistent icons
- Obvious buttons
- Predictable layouts

Avoid deep nesting.

Users should reach any important page in 2–3 taps.

---

# Visual Style

Use:

- Plenty of whitespace
- Soft shadows
- Rounded corners
- Modern cards
- Clean dividers
- Subtle gradients
- Premium spacing

Avoid:

- Heavy borders
- Clutter
- Bright random colors
- Too many boxes
- Outdated UI styles

---

# Color Palette

Primary:
Blue

Secondary:
Slate

Success:
Green

Warning:
Amber

Danger:
Red

Background:
Very light gray or white

Dark mode:
Supported where possible.

Colors should feel calm and professional.

---

# Typography

Use modern fonts.

Preferred:

- Inter
- Geist
- SF Pro
- Roboto

Hierarchy:

Page Title

Section Title

Card Title

Body

Caption

Do NOT use oversized fonts.

Readable but compact.

---

# Spacing

Use an 8px spacing system.

Examples:

8px
16px
24px
32px
40px
48px

Maintain consistent spacing everywhere.

---

# Cards

Cards should have:

Rounded corners

Soft shadow

Enough padding

Simple hierarchy

Optional icon

Cards should never feel crowded.

---

# Buttons

Buttons should:

Have rounded corners

Clear labels

Proper spacing

Hover animation

Loading state

Disabled state

Use icons only when helpful.

Never rely on icons alone.

---

# Forms

Forms must be easy.

Requirements:

Clear labels

Helpful placeholders

Inline validation

Logical grouping

Proper spacing

Auto focus where useful

Never ask unnecessary information.

---

# Tables

Tables should support:

Search

Sorting

Filtering

Pagination

Responsive layout

On mobile:

Convert large tables into cards if necessary.

---

# Dashboard

Dashboard should show:

Important statistics

Recent activity

Quick actions

Status summaries

Notifications

Avoid unnecessary charts.

Only show data users actually need.

---

# Icons

Use Lucide icons.

Icons should:

Be consistent

Simple

Minimal

Never overuse icons.

---

# Animations

Animations should be subtle.

Examples:

Fade

Slide

Scale

Hover elevation

Smooth page transitions

Avoid flashy animations.

Performance is more important.

---

# Accessibility

Support:

Keyboard navigation

Proper contrast

ARIA labels

Focus states

Screen readers where practical

Accessibility is mandatory.

---

# Performance

Pages should feel instant.

Prioritize:

Lazy loading

Code splitting

Image optimization

Skeleton loading

Minimal re-renders

Avoid unnecessary animations.

---

# Loading States

Never leave blank screens.

Use:

Skeleton loaders

Loading indicators

Progress feedback

---

# Empty States

Every empty page should explain:

Why it is empty

What user can do next

Provide a clear action button.

---

# Error Handling

Errors should:

Explain the problem

Explain how to fix it

Never expose technical errors to users.

---

# Confirmation Actions

For destructive actions:

Delete

Archive

Reset

Use confirmation dialogs.

Prevent accidental mistakes.

---

# Search Experience

Search should be:

Fast

Visible

Forgiving

Support partial matches.

---

# Notifications

Use toast notifications.

Keep messages short.

Examples:

Resource added successfully.

Changes saved.

Connection lost.

Try again.

---

# Component Consistency

Reuse existing components whenever possible.

Avoid creating duplicate button styles.

Maintain a single design language.

---

# Code Quality

Generated UI code should be:

Reusable

Modular

Maintainable

Well named

Easy to extend

Avoid duplicated logic.

---

# Framework Preference

When generating code:

Use React best practices.

Use functional components.

Prefer reusable components.

Keep files organized.

---

# Tailwind Guidelines

Use Tailwind CSS utilities.

Avoid excessive custom CSS.

Prefer utility-first styling.

Keep class names readable.

---

# Design Inspiration

The UI quality should be comparable to:

- Linear
- Notion
- Stripe Dashboard
- Vercel Dashboard
- GitHub
- Clerk
- Supabase
- Raycast
- Figma

Do NOT copy designs.

Only match the quality level.

---

# AI Instructions

Whenever generating UI:

Think like a senior product designer and frontend engineer.

Before producing code, ask:

Is this simple?

Is it modern?

Is it premium?

Can a non-technical camp staff member immediately understand it?

Is it mobile friendly?

Can this component be reused?

If any answer is "No", redesign before generating code.

---

# Final Rule

Every generated screen should feel like a polished production-ready application rather than a university project.

The user experience should always take priority over visual complexity.

Simple is better than clever.

Professional is better than flashy.

Consistency is more important than creativity.