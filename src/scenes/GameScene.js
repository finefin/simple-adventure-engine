class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  init(data) {
    this.worldData = data.worldData;
    this.frameTags = data.frameTags || {};
  }

  frameNumber(v) {
    if (typeof v === 'string') {
      const tag = this.frameTags[v];
      return tag ? tag.from : 0;
    }
    return v || 0;
  }

  frameRange(v) {
    if (typeof v === 'string') {
      const tag = this.frameTags[v];
      if (tag) {
        const frames = [];
        for (let i = tag.from; i <= tag.to; i++) frames.push(i);
        return frames;
      }
      return [0];
    }
    if (Array.isArray(v)) return v;
    return [v || 0];
  }

  create() {
    this.createPlayer();
    this.createUI();
    this.worldState = {};
    this.combineMode = null;
    this.inventory = new Inventory(this);
    this.actionMenu = new ActionMenu(this);
    this.dialogUI = new DialogUI(this);
    this.textPanel = new TextPanel(this);
    this.createObjectAnimations();
    this.roomManager = new RoomManager(this, this.worldData, this.inventory);
    this.roomManager.onTransition = (roomId) => {
      this.showMessage('Entered ' + this.roomManager.currentRoomData.name);
    };
    this.roomManager.start(this.worldData.startRoom);
    if (this.worldData.startPanel) {
      this.time.delayedCall(100, () => {
        this.textPanel.open(this.worldData.startPanel);
      });
    }
    this.setupInput();
  }

  getObjState(objDef) {
    return this.worldState[objDef.id] || objDef.state;
  }

  setObjState(objDef, newState) {
    this.worldState[objDef.id] = newState;

    if (objDef.stateFrames && objDef.stateFrames[newState] !== undefined) {
      const frame = this.frameNumber(objDef.stateFrames[newState]);
      const entry = this.roomManager.roomObjects.find(o => o.def.id === objDef.id);
      if (entry) {
        entry.go.stop();
        entry.go.setFrame(frame);
      } else if (this.inventory.pickedUpIds.has(objDef.id)) {
        const invItem = this.inventory.items.find(i => i.id === objDef.id);
        if (invItem) {
          invItem.spriteFrame = frame;
          if (objDef.states && objDef.states[newState] && objDef.states[newState].label) {
            invItem.label = objDef.states[newState].label;
          }
          this.inventory.updateDisplay();
        }
      }
    }

    if (objDef.stateAnim && objDef.stateAnim[newState] !== undefined) {
      const entry = this.roomManager.roomObjects.find(o => o.def.id === objDef.id);
      if (entry) {
        const animKey = 'obj_' + objDef.stateAnim[newState];
        if (this.anims.exists(animKey)) {
          entry.go.play(animKey);
        }
      }
    }

    if (objDef.reveals) {
      objDef.reveals.forEach((childId) => {
        const childDef = this.roomManager.currentRoomData.objects.find((o) => o.id === childId);
        if (childDef && !this.worldState[childDef.id + '_revealed']) {
          this.worldState[childDef.id + '_revealed'] = true;
          this.roomManager.revealObjectById(childDef);
        }
      });
    }

    if (objDef.states && objDef.states[newState] && objDef.states[newState].showPanel) {
      this.time.delayedCall(1200, () => {
        this.textPanel.open(objDef.states[newState].showPanel);
      });
    }
  }

  getObjMessage(objDef, key) {
    const state = this.getObjState(objDef);
    if (state && objDef.states && objDef.states[state] && objDef.states[state][key + 'Message'] !== undefined) {
      return objDef.states[state][key + 'Message'];
    }
    return objDef[key + 'Message'];
  }

  resolveCombineResult(a, b) {
    const bid = typeof b === 'string' ? b : b.id;
    const aid = typeof a === 'string' ? a : a.id;
    const r1 = a.combineMessages && a.combineMessages[bid];
    const r2 = b.combineMessages && b.combineMessages[aid];

    const conditionMet = (entry) => {
      if (!entry || typeof entry !== 'object' || !entry.requiresState) return true;
      return entry.requiresState.every((cond) => {
        return (this.worldState[cond.id] || null) === cond.state;
      });
    };

    const candidates = [
      { entry: r1 && typeof r1 === 'object' ? r1 : null, src: 'a' },
      { entry: r2 && typeof r2 === 'object' ? r2 : null, src: 'b' },
      { entry: typeof r1 === 'string' ? { message: r1 } : null, src: 'a' },
      { entry: typeof r2 === 'string' ? { message: r2 } : null, src: 'b' },
    ];

    for (const { entry, src } of candidates) {
      if (!entry) continue;
      if (!conditionMet(entry)) continue;
      return { message: entry.message, setState: entry.setState, setStateTarget: src === 'a' ? a : b };
    }

    return { message: 'Nothing happens.' };
  }

  createPlayer() {
    this.player = this.add.sprite(0, 0, 'player');
    this.player.setDepth(10).setScale(2);

    this.anims.create({
      key: 'idle',
      frames: this.anims.generateFrameNumbers('player', { start: 0, end: 1 }),
      frameRate: 2.5,
      repeat: -1
    });

    this.anims.create({
      key: 'walk',
      frames: this.anims.generateFrameNumbers('player', { start: 2, end: 3 }),
      frameRate: 10,
      repeat: -1
    });

    this.player.play('idle');

    this.playerMovement = new CharacterMovement(this, this.player, {
      speed: 220,
      onArrive: () => {}
    });

    this.mirrorReflection = this.add.sprite(0, 0, 'player', 0);
    this.mirrorReflection.setDepth(6).setScale(2).setAlpha(0.5).setVisible(false);
  }

  createObjectAnimations() {
    const anims = this.worldData.animations;
    if (!anims) return;
    Object.keys(anims).forEach((key) => {
      const def = anims[key];
      this.anims.create({
        key: 'obj_' + key,
        frames: this.anims.generateFrameNumbers('objects', { frames: this.frameRange(def.frames) }),
        frameRate: def.frameRate,
        repeat: def.repeat !== undefined ? def.repeat : -1,
      });
    });
  }

  createUI() {
    this.roomLabel = this.add.text(12, 6, '', {
      fontSize: '14px',
      color: '#ffffff',
      fontFamily: 'monospace',
      backgroundColor: '#00000088',
      padding: { x: 6, y: 3 },
    }).setDepth(100);

    this.messageText = this.add.text(0, 0, '', {
      fontSize: '14px',
      color: '#ffffff',
      fontFamily: 'monospace',
      backgroundColor: '#000000aa',
      padding: { x: 10, y: 6 },
      wordWrap: { width: this.scale.width - 100 },
    }).setDepth(100).setVisible(false).setOrigin(0.5);
  }

  setupInput() {
    this.input.on('pointerdown', (pointer) => {
      console.log(`Pointer: ${Math.round(pointer.x)}, ${Math.round(pointer.y)}`);
      if (this.dialogUI.isOpen || this.textPanel.isOpen) return;

      if (this._invClick) {
        this._invClick = false;
        return;
      }

      if (this.actionMenu.isOpen) {
        this.actionMenu.close();
        return;
      }

      const invY = this.scale.height - this.inventory.barHeight;
      if (pointer.y > invY) return;

      const hitDoor = this.doorHitTest(pointer.x, pointer.y);
      if (hitDoor) return;

      const hitDoorObj = this.doorObjectHitTest(pointer.x, pointer.y);
      if (hitDoorObj) return;

      const hitObject = this.objectHitTest(pointer.x, pointer.y);
      if (hitObject) return;

      if (this.combineMode) {
        this.combineMode = null;
        this.showMessage('Cancelled.');
        return;
      }

      this.player.setFlipX(pointer.x >= this.player.x);
      this.playerMovement.moveTo(pointer.x, pointer.y);
    });
  }

  resolveCombine(targetItem) {
    const source = this.combineMode.sourceItem;
    this.combineMode = null;

    const result = this.resolveCombineResult(targetItem, source);

    if (result.setState) {
      this.setObjState(result.setStateTarget, result.setState);
    }

    this.showMessage(result.message);
  }

  doorHitTest(x, y) {
    const door = this.roomManager.doors.find((d) => {
      const dx = d.go.x - x;
      const dy = d.go.y - y;
      const halfW = d.def.width / 2 + 3;
      const halfH = d.def.height / 2 + 3;
      return Math.abs(dx) <= halfW && Math.abs(dy) <= halfH;
    });
    if (!door) return false;

    if (door.def.locked) {
      this.showMessage(door.def.lockedMessage);
      return true;
    }

    this.playerMovement.moveTo(door.go.x, door.go.y);
    const origArrive = this.playerMovement.onArrive;
    this.playerMovement.onArrive = () => {
      this.playerMovement.onArrive = origArrive;
      this.roomManager.transitionTo(door.def);
    };
    return true;
  }

  doorObjectHitTest(x, y) {
    if (this.combineMode) return false;
    const obj = this.roomManager.roomObjects.find((o) => {
      if (!o.def.becomesDoor) return false;
      if (!this.worldState[o.def.id + '_doorOpen']) return false;
      const dx = o.go.x - x;
      const dy = o.go.y - y;
      const hw = (o.def.width || o.def.radius * 2) / 2 + 3;
      const hh = (o.def.height || o.def.radius * 2) / 2 + 3;
      return Math.abs(dx) <= hw && Math.abs(dy) <= hh;
    });
    if (!obj) return false;

    this.playerMovement.moveTo(obj.go.x, obj.go.y);
    const origArrive = this.playerMovement.onArrive;
    this.playerMovement.onArrive = () => {
      this.playerMovement.onArrive = origArrive;
      const bd = obj.def.becomesDoor;
      this.roomManager.transitionTo({ targetRoom: bd.targetRoom, targetX: bd.targetX, targetY: bd.targetY });
    };
    return true;
  }

  objectHitTest(x, y) {
    const hits = this.roomManager.roomObjects.filter((o) => {
      const dx = o.go.x - x;
      const dy = o.go.y - y;
      if (o.def.type === 'rect') {
        return Math.abs(dx) <= o.def.width / 2 && Math.abs(dy) <= o.def.height / 2;
      }
      return Math.sqrt(dx * dx + dy * dy) <= o.def.radius;
    });
    if (!hits.length) return false;

    const obj = hits.sort((a, b) => {
      if (a.def.pickup && !b.def.pickup) return -1;
      if (!a.def.pickup && b.def.pickup) return 1;
      const aArea = a.def.type === 'rect' ? a.def.width * a.def.height : a.def.radius * a.def.radius;
      const bArea = b.def.type === 'rect' ? b.def.width * b.def.height : b.def.radius * b.def.radius;
      return aArea - bArea;
    })[0];

    if (this.combineMode) {
      const source = this.combineMode.sourceItem;
      this.combineMode = null;
      this.playerMovement.moveTo(obj.go.x, obj.go.y);
      const origArrive = this.playerMovement.onArrive;
      this.playerMovement.onArrive = () => {
        this.playerMovement.onArrive = origArrive;
        const result = this.resolveCombineResult(obj.def, source);
        if (result.setState) {
          this.setObjState(result.setStateTarget, result.setState);
        }
        this.showMessage(result.message);

        if (obj.def.becomesDoor) {
          const conds = obj.def.becomesDoor.requiresState || [];
          if (conds.every((c) => (this.worldState[c.id] || null) === c.state)) {
            this.worldState[obj.def.id + '_doorOpen'] = true;
            if (obj.def.becomesDoor.openColor) {
              const color = parseInt(obj.def.becomesDoor.openColor);
              if (obj.go.setFillStyle) {
                obj.go.setFillStyle(color);
              } else if (obj.go.setTint) {
                obj.go.setTint(color);
              }
            }
            if (obj.def.becomesDoor.openLookMessage) {
              obj.def.lookMessage = obj.def.becomesDoor.openLookMessage;
            }
            this.showMessage(obj.def.becomesDoor.message);
          }
        }
      };
      return true;
    }

    this.playerMovement.moveTo(obj.go.x, obj.go.y);
    const origArrive = this.playerMovement.onArrive;
    this.playerMovement.onArrive = () => {
      this.playerMovement.onArrive = origArrive;
      this.actionMenu.open(obj.go.x, obj.go.y, obj.def, 'scene');
    };
    return true;
  }

  showMessage(text) {
    this.messageText.setText(text);
    this.messageText.setPosition(this.scale.width / 2, this.scale.height - this.inventory.barHeight - 16);
    this.messageText.setVisible(true);
    if (this.msgTimer) this.msgTimer.remove();
    this.msgTimer = this.time.delayedCall(4000, () => {
      this.messageText.setVisible(false);
    });
  }

  update(time, delta) {
    if (this.playerMovement) {
      this.playerMovement.update(time, delta);

      if (this.playerMovement.isMoving) {
        if (this.player.anims.currentAnim?.key !== 'walk') {
          this.player.play('walk');
        }
        if (this.playerMovement.target) {
          this.player.setFlipX(this.playerMovement.target.x >= this.player.x);
        }
      } else {
        if (this.player.anims.currentAnim?.key !== 'idle') {
          this.player.play('idle');
        }
      }
    }

    this.updateDepthSorting();
    this.updateMirrorReflection();
  }

  updateDepthSorting() {
    if (!this.roomManager.roomObjects) return;
    const z = (y, top) => 5 + y * 0.15 + (top ? 50 : 0);
    const feetY = (go, def) => {
      if (def.spriteFrame !== undefined || def.spriteAnim) return go.y + go.displayHeight / 2;
      if (def.type === 'rect') return go.y + def.height / 2;
      if (def.type === 'circle') return go.y + def.radius;
      return go.y;
    };
    this.player.setDepth(z(this.player.y + this.player.displayHeight / 2));
    this.roomManager.roomObjects.forEach((o) => o.go.setDepth(z(feetY(o.go, o.def), o.def.alwaysOnTop)));
  }

  updateMirrorReflection() {
    const room = this.roomManager.currentRoomData;
    const mirrorDef = room && room.objects.find(o => o.id === 'mirror');
    if (!mirrorDef) {
      this.mirrorReflection.setVisible(false);
      return;
    }

    const dy = this.player.y - mirrorDef.y;
    const dx = this.player.x - mirrorDef.x;
    const near = Math.abs(dx) < 200 && Math.abs(dy) < 200;

    if (near) {
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxDist = 200;
      const t = Phaser.Math.Clamp(1 - dist / maxDist, 0, 1);
      const alpha = 0.5 * t;
      const scale = 1 + t;
      this.mirrorReflection.setPosition(mirrorDef.x, mirrorDef.y);
      this.mirrorReflection.setScale(scale);
      this.mirrorReflection.setDepth(100);
      this.mirrorReflection.setFrame(this.player.frame.name);
      this.mirrorReflection.setFlipX(this.player.flipX);
      this.mirrorReflection.setAlpha(alpha);
      this.mirrorReflection.setVisible(true);
    } else {
      this.mirrorReflection.setAlpha(0);
      this.mirrorReflection.setVisible(false);
    }
  }
}
