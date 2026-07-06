class CharacterMovement {
  constructor(scene, character, config) {
    this.scene = scene;
    this.character = character;
    this.speed = config.speed || 200;
    this.walkableBounds = config.walkableBounds || null;
    this.target = null;
    this.isMoving = false;
    this.onArrive = config.onArrive || null;
    this.defaultOnArrive = this.onArrive;
    this.path = [];
    this.pathIndex = 0;
    this.blockers = [];
    this.cellSize = 20;
    this.playerHalfW = 14;
    this.playerHalfH = 22;
  }

  setWalkableBounds(bounds) {
    this.walkableBounds = bounds;
  }

  setBlockers(blockers) {
    this.blockers = blockers;
    this.grid = null;
  }

  cellBlocked(cx, cy) {
    const wx = cx * this.cellSize + this.cellSize / 2 + this.walkableBounds.x;
    const wy = cy * this.cellSize + this.cellSize / 2 + this.walkableBounds.y;
    for (const b of this.blockers) {
      if (b.type === 'rect') {
        const halfW = b.width / 2 + this.playerHalfW;
        const halfH = b.height / 2 + this.playerHalfH;
        if (Math.abs(wx - b.x) < halfW && Math.abs(wy - b.y) < halfH) return true;
      } else if (b.type === 'circle') {
        const r = b.radius + Math.max(this.playerHalfW, this.playerHalfH);
        const dx = wx - b.x;
        const dy = wy - b.y;
        if (dx * dx + dy * dy < r * r) return true;
      }
    }
    return false;
  }

  toGrid(wx, wy) {
    const gx = Math.floor((wx - this.walkableBounds.x) / this.cellSize);
    const gy = Math.floor((wy - this.walkableBounds.y) / this.cellSize);
    return { gx, gy };
  }

  toWorld(gx, gy) {
    return {
      x: gx * this.cellSize + this.cellSize / 2 + this.walkableBounds.x,
      y: gy * this.cellSize + this.cellSize / 2 + this.walkableBounds.y,
    };
  }

  findPath(fromX, fromY, toX, toY) {
    const gw = Math.ceil(this.walkableBounds.width / this.cellSize);
    const gh = Math.ceil(this.walkableBounds.height / this.cellSize);
    const start = this.toGrid(fromX, fromY);
    const end = this.toGrid(toX, toY);

    if (start.gx === end.gx && start.gy === end.gy) {
      return [new Phaser.Math.Vector2(toX, toY)];
    }

    const key = (x, y) => x + ',' + y;
    const endKey = key(end.gx, end.gy);
    function octile(dx, dy) {
      const f = Math.SQRT2 - 1;
      return dx < dy ? f * dx + dy : f * dy + dx;
    }

    const open = [{ gx: start.gx, gy: start.gy, g: 0, f: octile(Math.abs(end.gx - start.gx), Math.abs(end.gy - start.gy)) }];
    const closed = new Set();
    const cameFrom = {};
    const gScore = {};
    gScore[key(start.gx, start.gy)] = 0;

    while (open.length > 0) {
      open.sort((a, b) => a.f - b.f);
      const cur = open.shift();
      const curKey = key(cur.gx, cur.gy);

      if (curKey === endKey) {
        const path = [];
        let k = curKey;
        while (k !== undefined) {
          const [gx, gy] = k.split(',').map(Number);
          path.unshift(this.toWorld(gx, gy));
          k = cameFrom[k];
        }
        return path.map((p) => new Phaser.Math.Vector2(p.x, p.y));
      }

      if (closed.has(curKey)) continue;
      closed.add(curKey);

      const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0], [-1, -1], [-1, 1], [1, -1], [1, 1]];
      for (const [dx, dy] of dirs) {
        const nx = cur.gx + dx;
        const ny = cur.gy + dy;
        if (nx < 0 || nx >= gw || ny < 0 || ny >= gh) continue;
        if (this.cellBlocked(nx, ny)) continue;
        const nk = key(nx, ny);
        if (closed.has(nk)) continue;
        const cost = dx !== 0 && dy !== 0 ? Math.SQRT2 : 1;
        const ng = (cur.g || 0) + cost;
        if (gScore[nk] !== undefined && ng >= gScore[nk]) continue;
        gScore[nk] = ng;
        cameFrom[nk] = curKey;
        const h = octile(Math.abs(end.gx - nx), Math.abs(end.gy - ny));
        open.push({ gx: nx, gy: ny, g: ng, f: ng + h });
      }
    }

    return [new Phaser.Math.Vector2(toX, toY)];
  }

  moveTo(x, y) {
    if (this.walkableBounds) {
      x = Phaser.Math.Clamp(x, this.walkableBounds.x, this.walkableBounds.x + this.walkableBounds.width);
      y = Phaser.Math.Clamp(y, this.walkableBounds.y, this.walkableBounds.y + this.walkableBounds.height);
    }

    if (this.blockers.length > 0) {
      const eg = this.toGrid(x, y);
      if (this.cellBlocked(eg.gx, eg.gy)) {
        const gw = Math.ceil(this.walkableBounds.width / this.cellSize);
        const gh = Math.ceil(this.walkableBounds.height / this.cellSize);
        let bx = eg.gx, by = eg.gy, bd = Infinity;
        for (let gy = 0; gy < gh; gy++) {
          for (let gx = 0; gx < gw; gx++) {
            if (this.cellBlocked(gx, gy)) continue;
            const d = Math.abs(gx - eg.gx) + Math.abs(gy - eg.gy);
            if (d < bd) { bd = d; bx = gx; by = gy; }
          }
        }
        const w = this.toWorld(bx, by);
        x = w.x; y = w.y;
      }
    }

    const path = this.findPath(this.character.x, this.character.y, x, y);
    if (path.length > 1) {
      this.path = path;
      this.pathIndex = 1;
      this.target = path[0];
      this.isMoving = true;
    } else {
      this.target = new Phaser.Math.Vector2(x, y);
      this.isMoving = true;
    }
  }

  stop() {
    this.target = null;
    this.isMoving = false;
    this.path = [];
    this.pathIndex = 0;
  }

  resetOnArrive() {
    this.onArrive = this.defaultOnArrive;
  }

  update(time, delta) {
    if (!this.isMoving || !this.target) return;

    const dx = this.target.x - this.character.x;
    const dy = this.target.y - this.character.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 2) {
      this.character.x = this.target.x;
      this.character.y = this.target.y;

      if (this.pathIndex < this.path.length) {
        this.target = this.path[this.pathIndex];
        this.pathIndex++;
        return;
      }

      this.isMoving = false;
      this.target = null;
      this.path = [];
      this.pathIndex = 0;
      if (this.onArrive) this.onArrive();
      return;
    }

    const step = this.speed * (delta / 1000);
    const ratio = Math.min(step / dist, 1);
    this.character.x += dx * ratio;
    this.character.y += dy * ratio;
  }

  destroy() {
    this.stop();
    this.scene = null;
    this.character = null;
  }
}
