export default class Game extends Phaser.Scene {
  constructor() {
    super("game");
  }

  init(data) {
    this.currentLevel = data.level || 1;
    this.score = 0;
    this.totalScore = data.totalScore || 0;
    this.starsCollected = 0;
    this.requiredStars = 5;
  }

  preload() {
    this.load.tilemapTiledJSON("level1", "public/assets/tilemap/map.json");
    this.load.xml("level2tmx", "public/assets/tilemap/Nivel2.tmx");
    this.load.image("tileset", "public/assets/texture.png");
    this.load.image("texture", "public/assets/texture.png");
    this.load.image("star", "public/assets/star.png");
    this.load.image("goal", "public/assets/bomb.png");
    this.load.spritesheet("dude", "./public/assets/dude.png", {
      frameWidth: 32,
      frameHeight: 48,
    });
  }

  create() {
    const mapConfig = this.getLevelConfig(this.currentLevel);
    const map = this.currentLevel === 1
      ? this.make.tilemap({ key: "level1" })
      : this.currentLevel === 2
      ? this.makeLevel2Map()
      : this.make.tilemap({ tileWidth: 24, tileHeight: 24, width: mapConfig.width, height: mapConfig.height });

    const tilesetKey = this.currentLevel === 2 ? "texture" : "tileset";
    const tileset = map.addTilesetImage(tilesetKey, tilesetKey);

    let belowLayer;
    let platformLayer;

    if (this.currentLevel === 1) {
      belowLayer = map.createLayer("Fondo", tileset, 0, 0);
      platformLayer = map.createLayer("Plataformas", tileset, 0, 0);
    } else if (this.currentLevel === 2) {
      belowLayer = map.createBlankLayer("Fondo", tileset, 0, 0);
      platformLayer = map.createBlankLayer("Plataformas", tileset, 0, 0);
      belowLayer.putTilesAt(this.parseLevel2Layer("Fondo"), 0, 0);
      platformLayer.putTilesAt(this.parseLevel2Layer("Plataformas"), 0, 0);
    } else {
      belowLayer = map.createBlankLayer("Fondo", tileset, 0, 0);
      platformLayer = map.createBlankLayer("Plataformas", tileset, 0, 0);
      const platformData = mapConfig.platformData || this.buildPlatformData(mapConfig.width, mapConfig.height, mapConfig.walls);
      platformLayer.putTilesAt(platformData, 0, 0);
    }

    if (this.currentLevel === 1) {
      platformLayer.setCollisionByProperty({ esColisionable: true });
      platformLayer.setCollision([828]);
    } else if (this.currentLevel === 2) {
      platformLayer.setCollision([835]);
    } else {
      platformLayer.setCollisionByProperty({ esColisionable: true });
      platformLayer.setCollision([828]);
    }

    const objects = this.currentLevel === 1
      ? map.getObjectLayer("Objetos").objects
      : this.currentLevel === 2
      ? this.parseLevel2Objects()
      : mapConfig.objects;

    const spawnPoint = objects.find((obj) => obj.name === "player");
    this.player = this.physics.add.sprite(spawnPoint.x, spawnPoint.y, "dude");
    this.player.setBounce(0.2);
    this.player.setCollideWorldBounds(true);
    this.player.body.setAllowGravity(false);
    this.player.body.setSize(20, 40).setOffset(6, 8);
    this.physics.add.collider(this.player, platformLayer);

    this.createPlayerAnimations();
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keyR = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);

    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);

    this.stars = this.physics.add.group();
    this.goalGroup = this.physics.add.staticGroup();

    objects.forEach((objData) => {
      const { x = 0, y = 0, type, name } = objData;
      if (type === "star") {
        const star = this.stars.create(x, y, "star");
        star.setBounceY(Phaser.Math.FloatBetween(0.4, 0.8));
      }
      if (type === "goal" || name === "goal") {
        const goal = this.goalGroup.create(x, y, "goal");
        goal.setScale(0.8);
        goal.body.setSize(goal.width, goal.height);
      }
    });

    this.physics.add.collider(this.stars, platformLayer);
    this.physics.add.overlap(this.player, this.stars, this.collectStar, null, this);
    this.physics.add.overlap(this.player, this.goalGroup, this.handleGoal, null, this);

    this.createHUD();
    this.updateHUD();
  }

  update() {
    const speed = 160;
    let vx = 0;
    let vy = 0;

    if (this.cursors.left.isDown) {
      vx = -speed;
    } else if (this.cursors.right.isDown) {
      vx = speed;
    }

    if (this.cursors.up.isDown) {
      vy = -speed;
    } else if (this.cursors.down.isDown) {
      vy = speed;
    }

    this.player.setVelocity(vx, vy);

    if (vx < 0) {
      this.player.anims.play("left", true);
    } else if (vx > 0) {
      this.player.anims.play("right", true);
    } else if (vy !== 0) {
      this.player.anims.play("turn", true);
    } else {
      this.player.anims.play("turn");
    }

    if (Phaser.Input.Keyboard.JustDown(this.keyR)) {
      this.scene.start("game", { level: this.currentLevel, totalScore: this.totalScore });
    }
  }

  collectStar(player, star) {
    star.disableBody(true, true);
    this.starsCollected += 1;
    this.score += 10;
    this.totalScore += 10;
    this.updateHUD();
  }

  handleGoal() {
    if (this.starsCollected >= this.requiredStars) {
      if (this.currentLevel < 3) {
        this.showMessage(`¡Nivel ${this.currentLevel} completado! Avanzando...`);
        this.time.delayedCall(1000, () => {
          this.scene.start("game", {
            level: this.currentLevel + 1,
            totalScore: this.totalScore,
          });
        });
      } else {
        this.showMessage(`¡Ganaste! Puntaje total: ${this.totalScore}`);
      }
    } else {
      this.showMessage(`Necesitas ${this.requiredStars} elementos para ganar`);
    }
  }

  createPlayerAnimations() {
    this.anims.create({
      key: "left",
      frames: this.anims.generateFrameNumbers("dude", { start: 0, end: 3 }),
      frameRate: 10,
      repeat: -1,
    });
    this.anims.create({
      key: "turn",
      frames: [{ key: "dude", frame: 4 }],
      frameRate: 20,
    });
    this.anims.create({
      key: "right",
      frames: this.anims.generateFrameNumbers("dude", { start: 5, end: 8 }),
      frameRate: 10,
      repeat: -1,
    });
  }

  createHUD() {
    this.levelText = this.add.text(16, 16, "", { fontSize: "24px", fill: "#ffffff", backgroundColor: "rgba(0,0,0,0.5)" });
    this.scoreText = this.add.text(16, 46, "", { fontSize: "24px", fill: "#ffffff", backgroundColor: "rgba(0,0,0,0.5)" });
    this.totalText = this.add.text(16, 76, "", { fontSize: "24px", fill: "#ffffff", backgroundColor: "rgba(0,0,0,0.5)" });
    this.goalText = this.add.text(16, 106, "", { fontSize: "24px", fill: "#ffffff", backgroundColor: "rgba(0,0,0,0.5)" });
    this.messageText = this.add.text(16, 140, "", { fontSize: "24px", fill: "#ffff00", backgroundColor: "rgba(0,0,0,0.5)" });

    this.levelText.setScrollFactor(0);
    this.scoreText.setScrollFactor(0);
    this.totalText.setScrollFactor(0);
    this.goalText.setScrollFactor(0);
    this.messageText.setScrollFactor(0);
  }

  updateHUD() {
    this.levelText.setText(`Nivel: ${this.currentLevel}`);
    this.scoreText.setText(`Puntaje nivel: ${this.score}`);
    this.totalText.setText(`Puntaje total: ${this.totalScore}`);
    this.goalText.setText(`Recolectados: ${this.starsCollected}/${this.requiredStars}`);
  }

  showMessage(text) {
    this.messageText.setText(text);
    if (this.messageTimer) {
      this.messageTimer.remove(false);
    }
    this.messageTimer = this.time.delayedCall(1500, () => {
      this.messageText.setText("");
      this.messageTimer = null;
    });
  }

  getLevelConfig(level) {
    const configs = {
      2: {
        width: 30,
        height: 30,
        walls: [
          [5, 1, 5, 23],
          [10, 6, 10, 28],
          [15, 1, 15, 22],
          [20, 7, 20, 29],
          [25, 1, 25, 23],
          [1, 5, 13, 5],
          [16, 12, 28, 12],
          [2, 18, 14, 18],
        ],
        objects: [
          { name: "player", type: "", x: 80, y: 80 },
          { name: "", type: "star", x: 240, y: 160 },
          { name: "", type: "star", x: 520, y: 120 },
          { name: "", type: "star", x: 440, y: 440 },
          { name: "", type: "star", x: 130, y: 520 },
          { name: "", type: "star", x: 660, y: 260 },
          { name: "goal", type: "goal", x: 700, y: 700 },
        ],
      },
      3: {
        width: 40,
        height: 20,
        walls: [
          [7, 1, 7, 18],
          [13, 5, 13, 19],
          [19, 0, 19, 14],
          [25, 5, 25, 19],
          [31, 0, 31, 18],
          [1, 7, 18, 7],
          [21, 12, 38, 12],
          [2, 15, 18, 15],
          [22, 16, 38, 16],
        ],
        objects: [
          { name: "player", type: "", x: 96, y: 96 },
          { name: "", type: "star", x: 240, y: 200 },
          { name: "", type: "star", x: 680, y: 140 },
          { name: "", type: "star", x: 520, y: 360 },
          { name: "", type: "star", x: 320, y: 320 },
          { name: "", type: "star", x: 720, y: 360 },
          { name: "goal", type: "goal", x: 900, y: 360 },
        ],
      },
    };
    return configs[level];
  }

  buildPlatformData(width, height, walls) {
    const data = new Array(width * height).fill(0);
    for (let x = 0; x < width; x += 1) {
      data[x] = 828;
      data[(height - 1) * width + x] = 828;
    }
    for (let y = 0; y < height; y += 1) {
      data[y * width] = 828;
      data[y * width + (width - 1)] = 828;
    }
    walls.forEach(([x0, y0, x1, y1]) => {
      if (x0 === x1) {
        for (let y = y0; y <= y1; y += 1) {
          data[y * width + x0] = 828;
        }
      } else {
        for (let x = x0; x <= x1; x += 1) {
          data[y0 * width + x] = 828;
        }
      }
    });
    return data;
  }

  makeLevel2Map() {
    const xml = this.cache.xml.get("level2tmx");
    const mapElement = xml.documentElement;
    const width = parseInt(mapElement.getAttribute("width"), 10);
    const height = parseInt(mapElement.getAttribute("height"), 10);
    const tileWidth = parseInt(mapElement.getAttribute("tilewidth"), 10);
    const tileHeight = parseInt(mapElement.getAttribute("tileheight"), 10);
    return this.make.tilemap({ width, height, tileWidth, tileHeight });
  }

  parseLevel2Layer(name) {
    const xml = this.cache.xml.get("level2tmx");
    const layer = xml.querySelector(`layer[name='${name}']`);
    const width = parseInt(layer.getAttribute("width"), 10);
    const csv = layer
      .querySelector("data")
      .textContent.trim()
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
      .map((value) => parseInt(value, 10));
    const rows = [];
    for (let i = 0; i < csv.length; i += width) {
      rows.push(csv.slice(i, i + width));
    }
    return rows;
  }

  parseLevel2Objects() {
    const xml = this.cache.xml.get("level2tmx");
    const objects = [];
    xml.querySelectorAll("objectgroup[name='Objetos'] object").forEach((obj) => {
      objects.push({
        x: parseFloat(obj.getAttribute("x")) || 0,
        y: parseFloat(obj.getAttribute("y")) || 0,
        type: obj.getAttribute("type") || "",
        name: obj.getAttribute("name") || "",
      });
    });
    return objects;
  }

  get levelConfig() {
    return this.getLevelConfig(this.currentLevel);
  }
}
