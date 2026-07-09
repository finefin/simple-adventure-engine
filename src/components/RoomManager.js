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
    const wt = data.wallThickness || 24;
    const invH = this.scene.inventory ? this.scene.inventory.barHeight : 0;
    const floorColor = parseInt(data.floorColor);
    const wallColor = parseInt(data.wallColor);
    const bgColor = parseInt(data.backgroundColor);
    const floorTile = this.scene.frameNumber(data.floorTile !== undefined ? data.floorTile : 'floor');
    const wallTile = this.scene.frameNumber(data.wallTile !== undefined ? data.wallTile : 'wallStone');

    const gfx = this.scene.add.graphics();
    this.roomElements.push(gfx);
    gfx.fillStyle(bgColor);
    gfx.fillRect(0, 0, cw, ch);

    const floor = this.scene.add.tileSprite(
      ox + wt, oy + wt, w - wt * 2, h - wt * 2 - invH, 'objects', floorTile
    );
    floor.setOrigin(0, 0);
    floor.setTint(floorColor);
    this.roomElements.push(floor);

    const wallSides = [
      { x: ox, y: oy, w: w, h: wt },
      { x: ox, y: oy + h - wt - invH, w: w, h: wt + invH },
      { x: ox, y: oy, w: wt, h: h },
      { x: ox + w - wt, y: oy, w: wt, h: h },
    ];
    wallSides.forEach((ws) => {
      const wall = this.scene.add.tileSprite(ws.x, ws.y, ws.w, ws.h, 'objects', wallTile);
      wall.setOrigin(0, 0);
      wall.setTint(wallColor);
      this.roomElements.push(wall);
    });

    this.walkableMargin = 16;
    const margin = this.walkableMargin;
    this.walkableArea = new Phaser.Geom.Rectangle(
      ox + wt + margin, oy + wt + margin,
      w - (wt + margin) * 2,
      h - (wt + margin) * 2 - invH
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
    this.loadRoom(doorDef.targetRoom, { x: doorDef.targetX, y: doorDef.targetY });
    if (this.onTransition) this.onTransition(this.currentRoomId);
  }

  destroy() {
    this.clearRoom();
  }
}
