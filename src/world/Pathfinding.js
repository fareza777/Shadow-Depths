/**
 * Pathfinding — A* with a per-turn cache.
 *
 * Each turn the engine should call `invalidate()` once. Within a turn the same
 * (start, goal) query (e.g. multiple enemies pathing to the player) returns
 * the cached node-set without re-running A*.
 *
 * Movement model: 4-directional (N/S/E/W). Diagonals were rejected because
 * vision math + UI feel cleaner on a strict grid and Hoplite-style clarity
 * is a Pillar 1 goal.
 *
 * `findPath(floor, start, goal, opts)` returns:
 *   - array of {x,y} from start (inclusive) to goal (inclusive), or
 *   - null if no path exists.
 *
 * `opts.canPassEntity(x,y)` — predicate to ignore enemy blockers (useful when
 * an enemy is plotting a path through space the player will vacate).
 * `opts.ignoreWalls` — Shadow Wraith pathing.
 */
export class Pathfinding {
  constructor() {
    /** @type {Map<string, {x:number,y:number}[]|null>} */
    this._cache = new Map();
  }

  invalidate() {
    this._cache.clear();
  }

  /**
   * @param {import('./Floor.js').Floor} floor
   * @param {{x:number,y:number}} start
   * @param {{x:number,y:number}} goal
   * @param {{ canPassEntity?: (x:number,y:number)=>boolean, ignoreWalls?: boolean }} [opts]
   */
  findPath(floor, start, goal, opts = {}) {
    const key = Pathfinding._cacheKey(start, goal, opts);
    if (this._cache.has(key)) return this._cache.get(key);
    const path = Pathfinding._astar(floor, start, goal, opts);
    this._cache.set(key, path);
    return path;
  }

  /** Manhattan distance. */
  static distance(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  // --- internal -------------------------------------------------------
  static _cacheKey(s, g, opts) {
    return `${s.x},${s.y}->${g.x},${g.y}|${opts.ignoreWalls ? 'w' : ''}`;
  }

  static _astar(floor, start, goal, opts) {
    if (start.x === goal.x && start.y === goal.y) return [start];

    const w = floor.width;
    const startIdx = start.y * w + start.x;
    const goalIdx  = goal.y  * w + goal.x;

    // Binary-heap open set keyed by f-score.
    const open = new MinHeap();
    open.push(startIdx, 0);

    const cameFrom = new Map();
    const gScore = new Map();
    gScore.set(startIdx, 0);

    const passEnt = opts.canPassEntity;
    const ignoreWalls = !!opts.ignoreWalls;

    const maxPops = w * floor.height * 4;
    let pops = 0;
    while (open.size() > 0 && pops < maxPops) {
      pops += 1;
      const currentIdx = open.pop();
      if (currentIdx === goalIdx) {
        return Pathfinding._reconstruct(cameFrom, currentIdx, w);
      }
      const cx = currentIdx % w;
      const cy = (currentIdx - cx) / w;
      const currentG = gScore.get(currentIdx);

      // 4-neighbours
      for (let dir = 0; dir < 4; dir++) {
        const dx = DIRS[dir][0];
        const dy = DIRS[dir][1];
        const nx = cx + dx;
        const ny = cy + dy;
        if (!floor.inBounds(nx, ny)) continue;

        const tile = floor.tiles[ny][nx];
        // Wall check (wraith ignores).
        if (!ignoreWalls && tile.isBlocking()) continue;
        // For walking, must be walkable even if not blocking by sight rules.
        if (!ignoreWalls && !tile.isWalkable()) continue;

        // Entity blocker check — but ALWAYS allow stepping onto the goal tile
        // even if an entity is on it (so attack pathing works).
        const nIdx = ny * w + nx;
        if (nIdx !== goalIdx) {
          const ent = floor.entityAt(nx, ny);
          if (ent && (!passEnt || !passEnt(nx, ny))) continue;
        }

        const tentativeG = currentG + 1;
        const known = gScore.get(nIdx);
        if (known === undefined || tentativeG < known) {
          cameFrom.set(nIdx, currentIdx);
          gScore.set(nIdx, tentativeG);
          const f = tentativeG + Pathfinding._heuristic(nx, ny, goal);
          open.push(nIdx, f);
        }
      }
    }
    return null;
  }

  static _heuristic(x, y, goal) {
    return Math.abs(x - goal.x) + Math.abs(y - goal.y);
  }

  static _reconstruct(cameFrom, currentIdx, w) {
    const path = [];
    let idx = currentIdx;
    const maxSteps = w * (cameFrom.size + 1);
    while (idx !== undefined && path.length < maxSteps) {
      const x = idx % w;
      const y = (idx - x) / w;
      path.push({ x, y });
      idx = cameFrom.get(idx);
    }
    path.reverse();
    return path;
  }
}

const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];

/**
 * Minimal binary min-heap of (value:int, priority:number) pairs. Small and
 * specialized to avoid a generic priority-queue dependency.
 */
class MinHeap {
  constructor() {
    this._data = []; // pairs of [priority, value]
  }
  size() { return this._data.length; }

  push(value, priority) {
    this._data.push([priority, value]);
    this._bubbleUp(this._data.length - 1);
  }

  pop() {
    if (this._data.length === 0) return undefined;
    const top = this._data[0];
    const last = this._data.pop();
    if (this._data.length > 0) {
      this._data[0] = last;
      this._sinkDown(0);
    }
    return top[1];
  }

  _bubbleUp(i) {
    const d = this._data;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (d[i][0] >= d[parent][0]) break;
      [d[i], d[parent]] = [d[parent], d[i]];
      i = parent;
    }
  }

  _sinkDown(i) {
    const d = this._data;
    const len = d.length;
    for (;;) {
      let smallest = i;
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      if (l < len && d[l][0] < d[smallest][0]) smallest = l;
      if (r < len && d[r][0] < d[smallest][0]) smallest = r;
      if (smallest === i) break;
      [d[i], d[smallest]] = [d[smallest], d[i]];
      i = smallest;
    }
  }
}
