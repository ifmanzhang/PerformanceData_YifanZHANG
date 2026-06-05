# Soap Film Realtime Final Goal

## Immutable Realtime Goal

Build an independent realtime soap-film visual physics path that can produce high-resolution, aesthetically strong soap-bubble imagery while maintaining physically interpretable realtime state.

This path is not a strict Huang et al. 2020 reproduction. Huang 2020 remains the main physical reference and cache source, but the realtime path may use optimized approximations when required for performance.

## Success Target

- Stable realtime simulation target: at least 24 fps for the realtime physics loop.
- Default realtime physics resolution: 256 x 512.
- Default high-resolution output: at least 2048 x 2048 sphere render.
- Main state must remain physically meaningful:
  - eta: soap-film half-thickness.
  - Gamma: surfactant-like scalar field.
  - u: spherical tangential velocity field.
- Visual output must be derived from eta/Gamma/u plus view angle, curvature, front strength, foam, and droplet fields.
- Driver parameters must remain connectable:
  - disturbance strength/radius/position.
  - gravity direction.
  - air speed and direction.
  - Marangoni strength.
  - viscosity/diffusion.
  - evaporation.
  - physical cache blend.

## References

Physics and cache references:

1. Huang et al. 2020 Full Paper.
2. Huang et al. 2020 Supplemental.
3. Official Huang output generated locally.
4. Local Huang-clean diagnostics.

Aesthetic references:

1. Huang Fig.14-style thick tears, thin rivers, and islands.
2. `artifacts/targets/soap-film-reference.jpg`.

The aesthetic reference is not a texture source, pixel truth, or sampling target.

## Hard Boundaries

- Do not sample reference images.
- Do not use texture/pattern images to fake soap-film structure.
- Do not bake color fields as visual textures.
- Precomputed caches are allowed only when they store physical fields such as eta, Gamma, velocity, divergence, curl, and front strength.
- Colors must be computed from thin-film optical thickness and physically derived visual fields.
- If the realtime solver uses approximations, diagnostics must label them as approximations.

## Completion Standard

The realtime path is acceptable when it can save a test package containing:

- Static high-resolution sphere image.
- Parameter-response sequence.
- Disturbance-response sequence.
- eta/Gamma/velocity/front/foam debug outputs.
- performance report showing at least 24 fps for realtime physics.
- documentation explaining which parts are realtime approximation and which parts come from precomputed physical cache.
