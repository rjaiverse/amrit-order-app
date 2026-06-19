# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A mobile-friendly web app for internal sales staff at **Amrit Foods Enterprises Inc.** (Surrey, BC, Canada). Salespeople use it on their iPhones while visiting or calling customers to capture orders in a structured format. It replaces freehand WhatsApp ordering.

Users:
- 2 internal salespeople (iPhone users)
- Admin staff who re-key orders into **Sage 50** accounting software
- Password protected — internal use only

## Hard Constraints (do not violate)

- **NO frameworks, NO build tools, NO npm packages.** Pure HTML, CSS, and vanilla JavaScript only. The app must run as plain static files.
- **No backend.** Hosted on **GitHub Pages**. There is no server, no database, no API. All logic is client-side.
- **The product catalogue lives in `products.json` and nothing else.** Salespeople and admins update products by editing that JSON file only — they never touch code. Keep the schema stable and human-editable.
- **iPhone Safari is the primary target.** Mobile-first; it must work perfectly on a phone screen. Test layout at narrow widths.
- Keep it fast and simple — the users are not technical.

## Running / Developing

There is no build step. Open the files directly or serve the folder statically:

```sh
python3 -m http.server 8000   # then visit http://localhost:8000/
```

Deployment is GitHub Pages serving these files from the repo root. A commit to the deployed branch is the deploy.

## Architecture

Two-page static SPA-ish flow gated by a shared password:

- `index.html` — **password gate**. On correct password it sets a flag in `sessionStorage` and redirects to `app.html`. The password check is client-side only — this is a soft gate for internal use, **not real security**. Do not present it as such.
- `app.html` — **main order app**. On load it checks the `sessionStorage` auth flag and redirects back to `index.html` if absent.
- `app.js` — all application logic: fetches `products.json`, renders the catalogue by category, search filtering, add-to-order with quantities, the running order-summary panel, and order generation (printable summary + copy-as-text for WhatsApp/print).
- `style.css` — all styles. Brand colours as CSS custom properties.
- `products.json` — the catalogue: `categories[]`, each with a `name` and a `products[]` array of `{ sku, name, unit }`.

State (current order, customer/salesperson/date/notes) is held in memory in `app.js` for the session. There is no persistence beyond `sessionStorage` for the auth flag.

### `products.json` schema

```json
{
  "categories": [
    { "name": "Category Name",
      "products": [ { "sku": "XX-001", "name": "Product Name", "unit": "bag" } ] }
  ]
}
```

To add/change products, edit this file only. `sku` is what admin staff use to match to Sage 50; keep it present on every product.

## Phase Scope

**Phase 1 (current):** password gate, catalogue browse-by-category, search, tap-to-add with quantity, running order summary, salesperson inputs (customer name, salesperson name, date, notes), submit → clean printable order summary, copy-as-text and print.

**Phase 2 (DO NOT BUILD until asked):** CSV export formatted for Sage 50 import, customer database with price tiers, order history, backend API for order storage. If a request implies one of these, confirm scope before building.

## Brand

- Company: Amrit Foods Enterprises Inc.
- Royal Blue `#1B3F8B`, Gold `#C5982A`
- Clean, professional, mobile-first.
