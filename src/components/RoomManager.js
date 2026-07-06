class RoomManager {
  constructor(scene, worldData, inventory) {
    this.scene = scene;
    this.worldData = worldData;
    this.inventory = inventory;
    this.currentRoomId = null;
    this.currentRoomData = null;
    this.container = scene.add.container(0, 0);
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
    this.container.removeAll(true);
    this.roomObjects = [];
    this.doors = [];
    this.scene.messageText.setVisible(false);
  }

  buildRoom(spawnPos) {
    const data = this.currentRoomData;
    const w = this.scene.scale.width;
    const h = this.scene.scale.height;
    const wt = data.wallThickness || 24;
    const invH = this.scene.inventory ? this.scene.inventory.barHeight : 0;
    const floorColor = parseInt(data.floorColor);
    const wallColor = parseInt(data.wallColor);
    const bgColor = parseInt(data.backgroundColor);

    const gfx = this.scene.add.graphics();
    this.container.add(gfx);

    gfx.fillStyle(bgColor);
    gfx.fillRect(0, 0, w, h);

    gfx.fillStyle(floorColor);
    gfx.fillRect(wt, wt, w - wt * 2, h - wt * 2 - invH);

    gfx.fillStyle(wallColor);
    gfx.fillRect(0, 0, w, wt);
    gfx.fillRect(0, h - wt - invH, w, wt + invH);
    gfx.fillRect(0, 0, wt, h);
    gfx.fillRect(w - wt, 0, wt, h);

    this.walkableMargin = 16;
    const margin = this.walkableMargin;
    this.walkableArea = new Phaser.Geom.Rectangle(
      wt + margin, wt + margin,
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

    if (objDef.spriteFrame !== undefined) {
      let frame = objDef.spriteFrame;
      if (objDef.stateFrames && objDef.state && objDef.stateFrames[objDef.state] !== undefined) {
        frame = objDef.stateFrames[objDef.state];
      }
      go = this.scene.add.sprite(objDef.x, objDef.y, 'objects', frame);
      go.setDepth(5).setScale(2);
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

    const label = this.scene.add.text(
      objDef.x, objDef.y + (objDef.type === 'rect' ? objDef.height / 2 + 8 : objDef.radius + 8),
      objDef.label,
      { fontSize: '11px', color: '#aaaaaa', fontFamily: 'monospace' }
    ).setOrigin(0.5).setDepth(5);

    this.container.add(go);
    this.container.add(label);
    this.roomObjects.push({ go, label, def: objDef });
  }

  createDoor(doorDef) {
    let go;
    if (doorDef.spriteFrame !== undefined) {
      go = this.scene.add.sprite(doorDef.x, doorDef.y, 'objects', doorDef.spriteFrame);
      go.setDepth(3).setScale(2);
    } else {
      const color = parseInt(doorDef.color);
      go = this.scene.add.rectangle(doorDef.x, doorDef.y, doorDef.width, doorDef.height, color);
      go.setDepth(3);
    }
    go.setInteractive({ useHandCursor: true });
    go.doorDef = doorDef;

    this.container.add(go);
    this.doors.push({ go, def: doorDef });
  }

  removeRoomObject(obj) {
    this.container.remove(obj.go);
    this.container.remove(obj.label);
    obj.go.destroy();
    obj.label.destroy();
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
    this.container.destroy();
  }
}
