class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    this.load.json('world', 'src/data/world.json');
    this.load.json('spritesheet', 'assets/Sprite-0002.json');
    this.load.spritesheet('objects', 'assets/Sprite-0002.png', { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('player', 'assets/Sprite-0001.png', { frameWidth: 32, frameHeight: 32 });
  }

  create() {
    const worldData = this.cache.json.get('world');
    const spriteMeta = this.cache.json.get('spritesheet');
    const frameTags = {};
    if (spriteMeta && spriteMeta.meta && spriteMeta.meta.frameTags) {
      spriteMeta.meta.frameTags.forEach((tag) => {
        frameTags[tag.name] = { from: tag.from, to: tag.to };
      });
    }
    this.scene.start('GameScene', { worldData, frameTags });
  }
}
