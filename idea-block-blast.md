project title

single-layer rectangular tiling math game (curated, agent-iterated)

objective

Build a child-focused interactive tiling puzzle that develops multiplication and division intuition through area coverage using equal-sized pieces. Target age: ~5. Math remains implicit. Focus on clarity, low frustration, and strong structural signals.

Level design should support conversational iteration with a coding agent (e.g., “make level 12 easier”), without requiring a visual editor.

⸻

core gameplay

Each puzzle presents one rectangular grid.

rules
	•	Grid has dimensions width × height.
	•	Total area N = width * height (not shown explicitly).
	•	All pieces for that grid have equal area k (k cells per piece).
	•	k must divide N exactly.
	•	Number of pieces = N / k.
	•	Pieces are curated polyominoes of size k.
	•	Tap a piece to rotate 90°.
	•	Drag to place; placement snaps to grid.
	•	Placement must:
	•	stay inside bounds
	•	not overlap existing pieces
	•	Puzzle completes when:
	•	all cells are filled
	•	all pieces are used

interaction constraints
	•	Rotation: tap only.
	•	No rotate-while-dragging gesture.
	•	Piece tray order is shuffled each run.
	•	Child can reset freely at any time.
	•	No penalty for reset.

⸻

level identification and iteration model

Each level must have:
	•	A stable numeric id (e.g., 1, 2, 3 …).
	•	A human-readable label (optional, but helpful).
	•	A difficulty rating (optional metadata).

Primary reference mechanism:
	•	“level 12”
	•	“make level 18 harder”
	•	“reduce piece count in level 7”
	•	“change level 22 from tetrominoes to triominoes”

This allows natural-language iteration with a coding agent.

⸻

curated tiling approach

All levels use precomputed, guaranteed-solvable configurations stored directly in code or JSON.

For each level:
	•	id
	•	gridWidth
	•	gridHeight
	•	pieceSize (k)
	•	pieces: Shape[]
	•	canonicalSolutions: Placement[][] (used only for hints)

Important:
	•	Completion validation is geometric, not solution-matching.
	•	Any valid full tiling counts as success.
	•	canonicalSolutions are only for hint generation and difficulty tuning.

⸻

level structure example (conceptual)

Level 12:
	•	grid: 4 × 5
	•	pieceSize: 5
	•	pieces: 4 pentominoes
	•	canonicalSolutions: 2 stored solutions

If you later say:
	•	“Level 12 is too hard.”
Possible adjustments:
	•	Simplify shapes (replace complex pentominoes with bars).
	•	Reduce piece count (change grid dimensions).
	•	Reduce symmetry traps.
	•	Add an additional canonical solution for better hint coverage.

⸻

piece design strategy

Early levels:
	•	Bars only (1×k).
	•	3–4 pieces max.

Mid levels:
	•	Introduce L shapes and simple triominoes.
	•	Moderate piece count (4–5).

Later levels:
	•	More irregular shapes.
	•	Slightly larger grids.
	•	Increased spatial reasoning demands.

Avoid excessive branching-factor puzzles at this age.

⸻

hints

Hints escalate:

Hint level 1:
	•	Highlight all legal placements for selected piece.

Hint level 2:
	•	Show translucent “ghost” placement from canonical solution.

Hint level 3:
	•	Auto-place one correct piece.

Hints must never enforce a specific canonical solution if multiple exist.

⸻

visual feedback
	•	Snap-to-grid placement.
	•	Soft glow when piece fits.
	•	Gentle completion animation.
	•	No red failure states.

⸻

what is shown numerically

Visible:
	•	Piece count (e.g., “4 pieces”).
	•	Optionally: “each piece has 5 squares.”

Not shown:
	•	Total area N.
	•	Explicit multiplication or division symbols.
	•	Factor vocabulary.

⸻

difficulty progression axes
	1.	grid area
6 → 8 → 12 → 15 → 20 → 24 → 30
	2.	piece size
2 → 3 → 4 → 5
	3.	geometry complexity
bars → simple L → more irregular
	4.	piece count
start at 3
gradually increase to 5–6

Difficulty metadata can be attached per level to support agent-driven balancing.

⸻

validation logic

On placement:
	•	Check bounds.
	•	Check overlap.
	•	Maintain occupancy grid.

Completion when:
	•	All cells occupied.
	•	placedPieceCount == totalPieceCount.

No solution matching required.

⸻

development workflow assumption

Levels are:
	•	Defined declaratively in code or JSON.
	•	Modified conversationally by referencing numeric id.
	•	Iterated based on observed child behavior.

No visual level editor required. The coding agent should be able to:
	•	Generate new levels.
	•	Modify specific levels by id.
	•	Adjust piece shapes or grid size.
	•	Recompute canonicalSolutions if needed.

This keeps iteration lightweight and conversational rather than tool-driven.