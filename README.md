# Bean Boutique Front End Web Development Assignment

This package contains an original six-page HTML5 prototype created for NCC Education paper 2231-1. It uses a shared external stylesheet and shared JavaScript file; no site template, inline CSS or embedded `style` element is used.

## Pages

- `dist/index.html` — responsive home page, slideshow and first-visit email modal
- `dist/coffee.html` — catalogue, Fuse.js search and Swiper origin guide
- `dist/equipment.html` — equipment descriptions, usage tips and cart controls
- `dist/events.html` — events, validated email-registration form and Leaflet map
- `dist/offers.html` — special offer and three subscription levels
- `dist/cart.html` — persistent `localStorage` cart and future-checkout explanation

## Third-party plugins

1. Swiper: featured and origin sliders.
2. Fuse.js: tolerant on-page coffee search.
3. Leaflet: mobile-friendly interactive event map.
4. DOMPurify: sanitises user-controlled form and search text before reuse.

All plugin versions are pinned through jsDelivr. OpenStreetMap tiles include the required attribution.

## Run locally

Serve the `dist` folder through a local web server so browser storage and page navigation share one origin. Opening `index.html` directly still displays the pages, but cross-page cart behaviour can vary under the `file` protocol.

## Assessment evidence

The `evidence` folder contains automated structural results, desktop Chromium and Firefox results when available, a Pixel 7 emulation result and screenshots. These are honest development checks, not substitutes for the brief's official W3C output, physical mobile-device test or named screen-reader session. Complete those three assessor-facing checks before submission and replace the clearly marked evidence placeholders in the written report.

## Student details to complete

- Student name: Mian Asim
- NCC Education student number: `[insert before submission]`
- Statement and Confirmation of Own Work: attach the signed official form

Product descriptions, dates, addresses and prices are fictional prototype content. The three raster images are original AI-generated assets produced for this prototype and contain no third-party logos or recognisable people.
