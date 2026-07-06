class Inventory {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.pickedUpIds = new Set();
    this.slotSize = 44;
    this.padding = 6;
    this.barHeight = this.slotSize + this.padding * 2;

    this.container = scene.add.container(0, 0).setDepth(200);

    this.bg = scene.add.rectangle(0, 0, 0, 0, 0x000000, 0.7);
    this.container.add(this.bg);

    this.slots = [];
    this.selectedIndex = -1;
  }

  addItem(itemDef) {
    this.pickedUpIds.add(itemDef.id);
    this.items.push({ ...itemDef });
    this.updateDisplay();
  }

  hasItem(id) {
    return this.pickedUpIds.has(id);
  }

  removeItem(id) {
    this.pickedUpIds.delete(id);
    this.items = this.items.filter((item) => item.id !== id);
    this.updateDisplay();
  }

  updateDisplay() {
    const w = this.scene.scale.width;

    this.slots.forEach((s) => {
      s.bg.destroy();
      if (s.icon) s.icon.destroy();
      if (s.label) s.label.destroy();
    });
    this.slots = [];

    const totalWidth = this.items.length * this.slotSize + (this.items.length - 1) * 4;
    const startX = (w - totalWidth) / 2 + this.slotSize / 2;
    const y = this.scene.scale.height - this.barHeight / 2;

    this.items.forEach((item, i) => {
      const x = startX + i * (this.slotSize + 4);

      const bg = this.scene.add.rectangle(x, y, this.slotSize - 4, this.slotSize - 4, 0x333344, 1);
      bg.setStrokeStyle(1, 0x888899);

      let icon;
      const color = parseInt(item.color);
      if (item.type === 'circle') {
        icon = this.scene.add.circle(x, y - 2, 10, color);
      } else {
        icon = this.scene.add.rectangle(x, y - 2, 20, 16, color);
      }

      icon.setDepth(201);

      const label = this.scene.add.text(x, y + this.slotSize / 2 - 10, item.label.slice(0, 6), {
        fontSize: '8px', color: '#cccccc', fontFamily: 'monospace'
      }).setOrigin(0.5).setDepth(201);

      bg.setInteractive({ useHandCursor: true });
      bg.itemIndex = i;
      bg.on('pointerdown', (pointer) => {
        this.scene._invClick = true;
        this.scene.playerMovement.resetOnArrive();
        if (this.scene.combineMode) {
          this.scene.resolveCombine(item);
          return;
        }
        this.scene.actionMenu.open(pointer.x, pointer.y, item, 'inventory');
      });

      this.container.add(bg);
      this.container.add(icon);
      this.container.add(label);
      this.slots.push({ bg, icon, label });
    });

    this.bg.setPosition(w / 2, this.scene.scale.height - this.barHeight / 2);
    this.bg.setSize(w, this.barHeight);
  }

  destroy() {
    this.container.destroy(true);
  }
}
