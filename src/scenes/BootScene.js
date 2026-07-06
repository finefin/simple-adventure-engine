class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    this.load.json('world', 'src/data/world.json');
    this.load.spritesheet('player', 'assets/Sprite-0001.png', { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('objects', 'assets/Sprite-0002.png', { frameWidth: 32, frameHeight: 32 });
  }

  create() {
    const worldData = this.cache.json.get('world');
    this.scene.start('GameScene', { worldData });
  }
}
