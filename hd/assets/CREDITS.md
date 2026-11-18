# Asset credits

All textures, skies and the leaf atlas come from [Poly Haven](https://polyhaven.com) and are CC0 (public domain).

| File | Poly Haven asset |
|---|---|
| lime_diff/nor/rough.jpg | marble_cliff_05 |
| lime2_diff/nor.jpg | marble_cliff_04 |
| sand_diff/nor.jpg | aerial_sand |
| reef_diff/nor.jpg | coral_ground_02 |
| leaf_*.jpg, bark_*.jpg | island_tree_02 (leaves and trunk textures) |
| rock_diff/nor.jpg | lichen_rock |
| snow_diff/nor.jpg | snow_field_aerial |
| mtn_diff/nor.jpg | rocky_terrain_02 |
| forest_diff/nor.jpg | forest_ground_04 |
| roof_diff/nor.jpg | clay_roof_tiles_02 |
| plaster_diff/nor.jpg | clay_plaster |
| pine_diff.jpg | coated_pine |
| fir_*.jpg | fir_tree_01 (twig textures) |
| sky_night.rgbe.png | rogland_clear_night (1K; lighting only, the backdrop is a procedural starfield) |
| sky_noon.rgbe.png | qwantani_noon_puresky |
| sky_gold.rgbe.png | qwantani_late_afternoon_puresky |
| sky_storm.rgbe.png | kloofendal_overcast_puresky |

The skies are the original HDRIs repacked losslessly as RGBE in PNG (RGB mantissas, shared exponent in alpha), because artifacts don't serve .hdr files; main.js decodes them back to half floats.

water_nor.jpg is the water normal map from the three.js examples (MIT).
