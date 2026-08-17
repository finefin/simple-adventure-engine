class RoomManager {
  constructor(scene, worldData, inventory) {
    this.scene = scene;
    this.worldData = worldData;
    this.inventory = inventory;
    this.currentRoomId = null;
    this.currentRoomData = null;
    this.roomElements = [];
    this.roomObjects = [];
    this.doors = [];
    this.onTransition = null;
  }

  start(roomId) {
    this.loadRoom(roomId, null);
  }

  loadRoom(roomId, spawnPos) {
    this.clearRoom();
    this.currentRoomId = roomId;
    this.currentRoomData = this.worldData.rooms[roomId];
    if (!this.currentRoomData) {
      console.warn('Room not found:', roomId);
      return;
    }
    this.buildRoom(spawnPos);
  }

  clearRoom() {
    this.roomElements.forEach((e) => e.destroy());
    this.roomObjects.forEach((o) => o.go.destroy());
    this.doors.forEach((d) => d.go.destroy());
    this.roomElements = [];
    this.roomObjects = [];
    this.doors = [];
    this.scene.messageText.setVisible(false);
  }

  buildRoom(spawnPos) {
    const data = this.currentRoomData;
    const cw = this.scene.scale.width;
    const ch = this.scene.scale.height;
    const w = data.width || cw;
    const h = data.height || ch;
    const ox = Math.max(0, (cw - w) / 2);
    const oy = Math.max(0, (ch - h) / 2);
    this.roomOffX = ox;
    this.roomOffY = oy;
    const invH = this.scene.inventory ? this.scene.inventory.barHeight : 0;
    const bgColor = parseInt(data.backgroundColor);

    const gfx = this.scene.add.graphics();
    this.roomElements.push(gfx);
    gfx.fillStyle(bgColor);
    gfx.fillRect(0, 0, cw, ch);

    if (data.floorTile !== undefined) {
      const floorColor = parseInt(data.floorColor);
      const floor = this.scene.add.tileSprite(
        ox, oy, w, h - invH, 'objects', this.scene.frameNumber(data.floorTile)
      );
      floor.setOrigin(0, 0);
      if (Number.isFinite(floorColor)) floor.setTint(floorColor);
      this.roomElements.push(floor);
    }

    if (Array.isArray(data.tiles) && data.tiles.length) {
      const tsize = data.tileSize || 32;
      const tscale = tsize / 32;
      const renderTile = (t) => {
        const frame = this.scene.frameNumber(t.frame);
        const img = this.scene.add.image(ox + t.x * tsize + tsize / 2, oy + t.y * tsize + tsize / 2, 'objects', frame);
        img.setScale(tscale);
        if (t.tint) img.setTint(parseInt(t.tint));
        img.setDepth(t.kind === 'wall' ? 1 : 0);
        this.roomElements.push(img);
      };
      data.tiles.filter((t) => t.kind !== 'wall').forEach(renderTile);
      data.tiles.filter((t) => t.kind === 'wall').forEach(renderTile);
    }

    this.walkableMargin = 16;
    const margin = this.walkableMargin;
    this.walkableArea = new Phaser.Geom.Rectangle(
      ox + margin, oy + margin,
      w - margin * 2,
      h - margin * 2 - invH
    );

    data.objects.forEach((objDef) => {
      if (this.inventory && this.inventory.hasItem(objDef.id)) return;
      if (objDef.hiddenBy) {
        const revealed = this.scene.worldState[objDef.id + '_revealed'];
        if (!revealed) return;
      }
      const def = { ...objDef };
      const savedState = this.scene.worldState[def.id];
      if (savedState) def.state = savedState;
      this.createObject(def);
    });

    data.doors.forEach((doorDef) => {
      this.createDoor(doorDef);
    });

    if (spawnPos) {
      this.scene.player.setPosition(spawnPos.x, spawnPos.y);
    } else if (data.playerStart) {
      this.scene.player.setPosition(data.playerStart.x, data.playerStart.y);
    }

    this.scene.playerMovement.setWalkableBounds(this.walkableArea);

    const blockers = [];
    data.objects.forEach((objDef) => {
      if (!objDef.blocks) return;
      if (this.inventory && this.inventory.hasItem(objDef.id)) return;
      if (objDef.hiddenBy) {
        const revealed = this.scene.worldState[objDef.id + '_revealed'];
        if (!revealed) return;
      }
      blockers.push({ type: objDef.type, x: objDef.x, y: objDef.y, width: objDef.width, height: objDef.height, radius: objDef.radius });
    });
    if (Array.isArray(data.tiles) && data.tiles.length) {
      const tsize = data.tileSize || 32;
      data.tiles.forEach((t) => {
        if (t.kind !== 'wall') return;
        blockers.push({ type: 'rect', x: ox + t.x * tsize + tsize / 2, y: oy + t.y * tsize + tsize / 2, width: tsize, height: tsize });
      });
    }
    this.scene.playerMovement.setBlockers(blockers);

    this.scene.roomLabel.setText(data.name);
  }

  createObject(objDef) {
    let go;

    if (objDef.spriteFrame !== undefined || objDef.spriteAnim) {
      const frame = this.scene.frameNumber(
        objDef.stateFrames && objDef.stateFrames[objDef.state] !== undefined
          ? objDef.stateFrames[objDef.state]
          : objDef.spriteFrame
      );
      go = this.scene.add.sprite(objDef.x, objDef.y, 'objects', frame);
      go.setDepth(5).setScale(2);
      go.setFlipX(!!objDef.flipX);
      go.setFlipY(!!objDef.flipY);
      if (objDef.spriteAnim) {
        const animKey = 'obj_' + objDef.spriteAnim;
        if (this.scene.anims.exists(animKey)) {
          go.play(animKey);
        }
      }
      if (objDef.stateAnim && objDef.stateAnim[objDef.state] !== undefined) {
        const animKey = 'obj_' + objDef.stateAnim[objDef.state];
        if (this.scene.anims.exists(animKey)) {
          go.play(animKey);
        }
      }
    } else if (objDef.type === 'rect') {
      const color = parseInt(objDef.color);
      go = this.scene.add.rectangle(objDef.x, objDef.y, objDef.width, objDef.height, color);
      if (objDef.strokeColor) go.setStrokeStyle(2, parseInt(objDef.strokeColor));
      go.setDepth(5);
    } else if (objDef.type === 'circle') {
      const color = parseInt(objDef.color);
      go = this.scene.add.circle(objDef.x, objDef.y, objDef.radius, color);
      if (objDef.strokeColor) go.setStrokeStyle(2, parseInt(objDef.strokeColor));
      go.setDepth(5);
    }

    go.setInteractive({ useHandCursor: true });
    go.objDef = objDef;

    this.roomObjects.push({ go, def: objDef });
  }

  createDoor(doorDef) {
    let go;
    if (doorDef.spriteFrame !== undefined) {
      go = this.scene.add.sprite(doorDef.x, doorDef.y, 'objects', this.scene.frameNumber(doorDef.spriteFrame));
      go.setDepth(3).setScale(2);
    } else {
      const color = parseInt(doorDef.color);
      go = this.scene.add.rectangle(doorDef.x, doorDef.y, doorDef.width, doorDef.height, color);
      go.setDepth(3);
    }
    go.setInteractive({ useHandCursor: true });
    go.doorDef = doorDef;

    this.doors.push({ go, def: doorDef });
  }

  removeRoomObject(obj) {
    obj.go.destroy();
    this.roomObjects = this.roomObjects.filter((o) => o !== obj);
  }

  removeRoomObjectByDef(objDef) {
    const entry = this.roomObjects.find((o) => o.def.id === objDef.id);
    if (entry) this.removeRoomObject(entry);
  }

  revealObjectById(objDef) {
    const existing = this.roomObjects.find((o) => o.def.id === objDef.id);
    if (existing) return;
    const def = { ...objDef };
    const savedState = this.scene.worldState[def.id];
    if (savedState) def.state = savedState;
    this.createObject(def);
  }

  transitionTo(doorDef) {
    let spawn = null;
    if (doorDef.targetDoor) {
      const targetRoomData = this.worldData.rooms[doorDef.targetRoom];
      const targetDoor = targetRoomData && (targetRoomData.doors || []).find((td) => td.id === doorDef.targetDoor);
      if (targetDoor) spawn = { x: targetDoor.x, y: targetDoor.y };
    }
    if (!spawn && doorDef.targetX !== undefined && doorDef.targetY !== undefined) {
      spawn = { x: doorDef.targetX, y: doorDef.targetY };
    }
    this.loadRoom(doorDef.targetRoom, spawn);
    if (this.onTransition) this.onTransition(this.currentRoomId);
  }

  destroy() {
    this.clearRoom();
  }
}
