class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    const worldFile = typeof SELECTED_WORLD !== 'undefined' && SELECTED_WORLD
      ? 'src/data/' + SELECTED_WORLD : 'src/data/demo.json';
    this.load.json('world', worldFile);
    this.load.json('spritesheet', 'assets/Sprite-0002.json');
    this.load.spritesheet('objects', 'assets/Sprite-0002.png', { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('player', 'assets/Sprite-0001.png', { frameWidth: 32, frameHeight: 32 });

    const gameName = typeof SELECTED_WORLD !== 'undefined' && SELECTED_WORLD
      ? SELECTED_WORLD.replace('.json', '') : 'demo';

    const w = this.scale.width;
    const h = this.scale.height;

    const text = this.add.text(w / 2, h / 2 - 40, 'Loading ' + gameName + '...', {
      fontSize: '16px', color: '#666666', fontFamily: 'monospace'
    }).setOrigin(0.5);

    const barBg = this.add.rectangle(w / 2, h / 2, 200, 6, 0x222222).setOrigin(0.5);
    const bar = this.add.rectangle(w / 2 - 100, h / 2, 0, 6, 0x666666).setOrigin(0, 0.5);

    this.load.on('progress', (val) => {
      bar.width = 200 * val;
    });
  }

  create() {
    const worldData = this.cache.json.get('world');
    if (!worldData) {
      this.add.text(this.scale.width / 2, this.scale.height / 2, 'Failed to load world file', {
        fontSize: '14px', color: '#ff4444', fontFamily: 'monospace'
      }).setOrigin(0.5);
      return;
    }
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
