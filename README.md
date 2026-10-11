# VELARIS

A local luxury yacht experience built with React, Bun, Tailwind CSS, Three.js, and GSAP.

## Run locally

Install Bun, then from this directory run:

```sh
bun install
bun run dev
```

Open the local address printed by the development server, normally http://localhost:5173.

## Experience

- Five distinct, fully three-dimensional yacht concepts: Horizon 88, Élan 62, Solstice 54, Meridian 76, and Aether 90.
- Scroll to dissolve, wander, and reform the particle geometry between chapters.
- Drag left/right to orbit the camera through 360 degrees around the yacht and sea; drag up/down with a mouse to adjust elevation. The view follows smoothly and coasts briefly after release.
- The five chapter markers and the arrow keys also navigate the voyage.
- “Explore in 3D” clears the editorial copy; “Reset camera view” restores the original angle.
- Sea and yacht particles have independently animated sizes and glints, with depth-dependent foreground softness.
- Optional synthesized sea ambience starts only when enabled. The pause control freezes the ambient animation.
- Yacht details and collection navigation open in accessible panels.
- Mobile particle counts are reduced. System reduced-motion preferences suppress particle scattering and ambient movement.

## Validation

```sh
bunx tsc --noEmit
bun run build
```

The website uses procedural 3D geometry and shader reflections, rather than flat yacht images. All five designs and their specifications are illustrative concepts. No external model, font, photograph, or audio downloads are needed at runtime. 

## Source map

- `app/page.tsx`: chapter content, navigation, detail panels, ambience.
- `app/ocean-scene.tsx`: Three.js rendering, ocean, reflections, interaction, and morph shaders.
- `app/camera-orbit.ts`: camera orbit, damping, release inertia, and view reset.
- `app/sea-system.ts`: gentle surface waves, sparse floating lights, short surface reflections, and foreground bokeh.
- `app/yacht-geometry.ts`: deterministic surface sampling for the five yacht designs.
- `app/globals.css`: visual styling and responsive layout.

## Deploy to Vercel

The app builds as a static React/Vite website. `vercel.json` sets the Vite framework, `bun run build` command, and `dist` output directory. The build includes `dist/index.html`; no Cloudflare runtime is needed.

1. Commit and push these changes to the repository connected to Vercel.
2. In Vercel, use the repository folder containing this `package.json` as the Root Directory (leave it at the repository root if Velaris is the entire repository).
3. Remove conflicting dashboard overrides, or set Framework Preset to **Vite**, Build Command to **bun run build**, and Output Directory to **dist**.
4. Deploy the new commit. Redeploying an older commit will still use the old build setup.

To check the production build locally, run `bun run build` followed by `bun run start` and open the address printed by Vite.

The earlier Vinext/Cloudflare dependencies and scaffolding are retained but are no longer used by the app's development or production scripts.
