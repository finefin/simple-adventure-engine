class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    this.load.json('world', 'src/data/world.json');
  }

  create() {
    const worldData = this.cache.json.get('world');
    this.scene.start('GameScene', { worldData });
  }
}
