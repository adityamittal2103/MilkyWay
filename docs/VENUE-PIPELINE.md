# Venue pipeline: `Map Nothing.blend` to the web

## Inspection findings
| Property | Value |
|---|---|
| File | `Map Nothing.blend`, 330 MB, **zstd-compressed**, Blender **5.0** format (`BLENDER17-01v0500`) |
| Uncompressed | 773 MB (about 700 MB of it is packed image/raw data) |
| Scenes / collections | 1 scene; `Collection` (3,613 objects) + `Group 1` (33 meshes) |
| Objects | 3,653 total: 2,508 meshes, 1,142 empties (import hierarchy roots), 3 lights, 1 camera (not set as scene camera) |
| Materials / images | 617 materials, 170 images |
| Triangles | **6.05 M** |
| Units | Metric, `scale_length = 1.0`, Z-up |
| Modifiers | Only 26× Bevel+Subdivision (rounded cubes) and 7× SimpleDeform, with no geometry-changing arrays or booleans |
| Instancing | No collection instancing |

**The model is a diorama.** The hall is 4.27 × 1.44 units with walls 0.14 tall. Props are exaggerated for legibility (the vending machine is 0.136 tall and the bar stools are 0.087), so there is no single consistent real-world scale. The hall's ~3:1 footprint matches the published proportions of Yashobhoomi's exhibition halls (72 m × 200 m).

### Spatial read of the plan (Blender XY, +Y = north)
| Area | Evidence in the file | Sector (provisional function) |
|---|---|---|
| NW room + gate crossing the north wall | `Plane.004/.005` walls; `Object_22.001` spans y 0.32→0.75 through the wall | **Docking Bay** (entry) |
| West tunnel | 5–7 × `Light 4_Light Base` arches (0.29 wide, 0.27 tall) in a row | **The Wormhole** |
| North-wall strip | **2,227 tiny cylinders** stacked 0–0.13 high along y≈0.54, x −1.7→−0.75, a fairy-light curtain | **Nebula Walk** |
| U-shaped corridor | `Plane.006–.011` partitions | **Event Horizon** |
| Central walled room | 5 angled low plinths (`Plane.034–.038`), banner (`Cylinder_1`) on a low dais (`Plane.033`), a 2×10 box grid on the east wall | **Constellation Hall** |
| South platform | Floor mark `Plane.041`, 4 ring objects (`Torus`), a DJ console cluster, speaker stacks (`Cube.000_4`), a chair row | **Supergiant** (main stage) |
| East bar | Angled counter (`Plane.032`), 4 bar stools (`Banqueta`), bottle shelves, vending machine | **Orbital Market** |
| SE counter | U counter (`Plane.029–.031`) with 8 round items | **Refuel Deck** |
| Mid-east | Pool table (green fabric), arcade-like cabinet (`Object_15`), café tables (`Object_5` ×7) | **Zero-G Lounge** |
| Outside north | Tall kiosk cluster (`Object_*`, 0.29 tall), red vehicle (`Material3`, likely a food truck) | **Outer Orbit** |

Sector *functions* are inferred from geometry and live in `data/zones.ts` flagged `provisional: true`. Confirm them against the organisers' plan.

## Pipeline
```
Map Nothing.blend (zstd, Blender 5.0)
 └─ scripts/venue/build.sh
     ├─ zstd unwrap
     ├─ blendparse.py   SDNA-driven .blend reader (no Blender install needed)
     │                  · per-ID pointer scoping (Blender 5 reuses old addresses across IDs)
     │                  · Blender 5 AttributeStorage meshes (position, .corner_vert, face offsets)
     ├─ build_venue.py  · bake world matrices (parent × parentinv × TRS, all rotation modes)
     │                  · drop 22 stray objects (e.g. a box 150 units away, 1-tri debris)
     │                  · classify: wall / furniture / prop / emissive / bulb / floor / floor-mark
     │                  · decimate per object with a budget scaled by object size
     │                    (quadric first; vertex-clustering fallback for disconnected soups)
     │                  · Z-up diorama → Y-up web units (×100, recentred on hall)
     │                  · merge by category → 4 draw calls
     │                  · sample 60k surface points (galaxy→venue morph), 2,227 bulb centres, wall segments
     └─ gltf-transform  weld → quantize (14-bit) → meshopt (EXT_meshopt_compression)
```

## Result
| | Source | Web |
|---|---|---|
| Triangles | 6,053,360 | **109,064** |
| Size | 330 MB (.blend, compressed) | **306 KB** GLB + 420 KB points + 27 KB bulbs |
| Draw calls | 2,508 meshes | **4** meshes + 1 instanced bulb set + 1 point cloud |

Heaviest offenders fixed: three bottle shelves at 974k tris each became about 2.4k each (vertex clustering, since they are disconnected soups), and a 2.0M-tri plant became 10k (quadric decimation, which keeps its silhouette).

## Re-running
```bash
BLEND="/path/to/Map Nothing.blend" npm run venue:build
```
This writes `public/models/venue.glb`, `venue-points.bin`, `venue-bulbs.bin` and `public/data/venue-meta.json`.
