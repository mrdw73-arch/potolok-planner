# Wall drag geometry cases

- Horizontal wall + vertical pointer movement: wall moves vertically, preserving its length.
- Vertical wall + horizontal pointer movement: wall moves horizontally, preserving its length.
- Diagonal wall: pointer movement is projected onto the wall normal in orthogonal mode.
- Grid snapping: the normal displacement is snapped to the configured grid.
- Minimum wall length: a drag that would make any segment shorter than the configured minimum is rejected.
- Non-orthogonal mode: the full pointer delta is used, allowing free parallel translation.
