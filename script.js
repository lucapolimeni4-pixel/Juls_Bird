const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayMessage = document.getElementById("overlay-message");
const startButton = document.getElementById("start-button");
const progressLabel = document.getElementById("progress");
const musicButton = document.getElementById("music-button");
const music = document.getElementById("background-music");

canvas.width = 960;
canvas.height = 540;
music.volume = 0.50; // de 0 (silencio) a 1 (máximo)

const W = canvas.width;
const H = canvas.height;
const GAME_DURATION = 90;

// Separación entre cuadros (en píxeles de pared).
const FRAME_SPACING = 390;
const FRAME_START_X = 220;
const FRAME_WIDTH = 105;

// Ancho de los obstáculos.
const OBSTACLE_WIDTH = 82;

// Posición (en la pared) del centro del primer punto medio entre dos cuadros.
// Centro del primer cuadro = 220 + 105/2 = 272.5 -> punto medio = 272.5 + 195 = 467.5
const FIRST_MIDPOINT = FRAME_START_X + FRAME_WIDTH / 2 + FRAME_SPACING / 2;

// Cargamos las imágenes.
function loadImage(src) {
    const image = new Image();
    image.src = src;
    return image;
}

const characterImage = loadImage("images/IMG-20260919-WA0096.jpg");

const pictureImages = Array.from({ length: 14 }, (_, i) =>
    loadImage(`images/cuadro${i + 1}.jpg`)
);

// Estado del juego.
let state = "ready";
let elapsed = 0;
let lastTime = 0;
let frameTime = 0;
let wallOffset = 0;
let nextObstacleWorldX = 0; // posición en la pared donde irá el próximo obstáculo (centro)
let obstacles = [];
let particles = [];

const player = {
    x: 220,
    y: H / 2,
    width: 62,
    height: 62,
    velocityY: 0,
    gravity: 1500,
    jump: -430,
    rotation: 0
};

// Ajustamos la posición del personaje al tamaño de pantalla.
function updatePlayerPosition() {
    player.x = W * 0.23;
}

// Cuadros repartidos a lo largo de la pared.
const frames = pictureImages.map((image, index) => ({
    image,
    x: FRAME_START_X + index * FRAME_SPACING,
    y: index % 2 === 0 ? 95 : 285,
    width: FRAME_WIDTH,
    height: 95
}));

// Iniciar o reiniciar.
function startGame() {
    elapsed = 0;
    lastTime = 0;
    frameTime = 0;
    wallOffset = 0;
    obstacles = [];
    particles = [];

    // Primer punto medio entre cuadros que queda fuera de pantalla.
    nextObstacleWorldX = FIRST_MIDPOINT + FRAME_SPACING * 2; // 1247.5

    player.y = H / 2;
    player.velocityY = 0;
    player.rotation = 0;

    state = "playing";
    overlay.classList.add("hidden");
    progressLabel.textContent = "0%";

    music.currentTime = 0;
    if (!musicButton.dataset.muted) {
        music.play().catch(() => {});
    }

    requestAnimationFrame(gameLoop);
}

// Saltar.
function flap() {
    if (state === "playing") {
        player.velocityY = player.jump;
    }
}

canvas.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    flap();
});

document.addEventListener("keydown", (event) => {
    if (event.code === "Space" || event.code === "ArrowUp") {
        event.preventDefault();

        if (state === "playing") {
            flap();
        } else if (state === "ready" || state === "gameover" || state === "won") {
            startGame();
        }
    }
});

startButton.addEventListener("click", startGame);

// Música: se inicia después de una interacción del jugador.
musicButton.addEventListener("click", () => {
    if (musicButton.dataset.muted) {
        delete musicButton.dataset.muted;
        musicButton.textContent = "♫ Música: ON";

        if (state === "playing") {
            music.play().catch(() => {});
        }
    } else {
        musicButton.dataset.muted = "true";
        musicButton.textContent = "♫ Música: OFF";
        music.pause();
    }
});

// Crear obstáculos con huecos progresivamente más exigentes.
// "x" es la posición en pantalla del borde izquierdo del obstáculo.
function createObstacle(x) {
    const difficulty = Math.min(elapsed / GAME_DURATION, 1);
    const gap = 190 - difficulty * 65;
    const margin = 70;
    const gapY = margin + Math.random() * (H - gap - margin * 2);

    obstacles.push({
        x,
        width: OBSTACLE_WIDTH,
        gapY,
        gap,
        passed: false
    });
}

// Fondo y pared.
function drawBackground() {
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, "#b7dce8");
    gradient.addColorStop(1, "#f5e4c7");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    // Pared.
    ctx.fillStyle = "#d8c4a0";
    ctx.fillRect(0, 35, W, H - 70);

    // Zócalos.
    ctx.fillStyle = "#9d8263";
    ctx.fillRect(0, 35, W, 12);
    ctx.fillRect(0, H - 47, W, 12);

    // Líneas suaves de la pared.
    ctx.strokeStyle = "rgba(100, 70, 45, 0.12)";
    ctx.lineWidth = 2;

    for (let y = 75; y < H - 65; y += 70) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
    }

    drawFrames();
}

function drawFrames() {
    const repeatWidth = frames.length * FRAME_SPACING;

    frames.forEach((frame) => {
        let x = (frame.x - wallOffset) % repeatWidth;
        if (x < -frame.width) x += repeatWidth;

        // Marco exterior.
        ctx.fillStyle = "#65452e";
        ctx.fillRect(x - 7, frame.y - 7, frame.width + 14, frame.height + 14);

        // Borde dorado.
        ctx.fillStyle = "#d5b16a";
        ctx.fillRect(x - 3, frame.y - 3, frame.width + 6, frame.height + 6);

        // Interior.
        ctx.fillStyle = "#f7f0df";
        ctx.fillRect(x, frame.y, frame.width, frame.height);

        const image = frame.image;

        if (image.complete && image.naturalWidth > 0) {
            drawImageCover(
                image,
                x + 4,
                frame.y + 4,
                frame.width - 8,
                frame.height - 8
            );
        } else {
            ctx.fillStyle = "#b5a58e";
            ctx.fillRect(x + 4, frame.y + 4, frame.width - 8, frame.height - 8);
        }
    });
}

// Recorta las imágenes para que encajen en los cuadros.
function drawImageCover(image, x, y, width, height) {
    const scale = Math.max(width / image.width, height / image.height);
    const sourceWidth = width / scale;
    const sourceHeight = height / scale;
    const sourceX = (image.width - sourceWidth) / 2;
    const sourceY = (image.height - sourceHeight) / 2;

    ctx.drawImage(
        image,
        sourceX, sourceY, sourceWidth, sourceHeight,
        x, y, width, height
    );
}

// Obstáculos con estilo de columnas.
function drawObstacles() {
    obstacles.forEach((obstacle) => {
        const bottomY = obstacle.gapY + obstacle.gap;

        ctx.fillStyle = "#417b45";
        ctx.strokeStyle = "#285b30";
        ctx.lineWidth = 4;

        // Columna superior.
        ctx.fillRect(obstacle.x, 35, obstacle.width, obstacle.gapY - 35);
        ctx.strokeRect(obstacle.x, 35, obstacle.width, obstacle.gapY - 35);

        // Borde de la columna superior.
        ctx.fillRect(obstacle.x - 7, obstacle.gapY - 20, obstacle.width + 14, 20);
        ctx.strokeRect(obstacle.x - 7, obstacle.gapY - 20, obstacle.width + 14, 20);

        // Columna inferior.
        ctx.fillRect(obstacle.x, bottomY, obstacle.width, H - 35 - bottomY);
        ctx.strokeRect(obstacle.x, bottomY, obstacle.width, H - 35 - bottomY);

        // Borde de la columna inferior.
        ctx.fillRect(obstacle.x - 7, bottomY, obstacle.width + 14, 20);
        ctx.strokeRect(obstacle.x - 7, bottomY, obstacle.width + 14, 20);
    });
}

// Personaje: foto real recortada en forma circular.
function drawPlayer() {
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.rotation);

    ctx.beginPath();
    ctx.arc(0, 0, player.width / 2, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, player.width / 2 - 3, 0, Math.PI * 2);
    ctx.clip();

    if (characterImage.complete && characterImage.naturalWidth > 0) {
        drawImageCover(
            characterImage,
            -player.width / 2 + 3,
            -player.height / 2 + 3,
            player.width - 6,
            player.height - 6
        );
    } else {
        ctx.fillStyle = "#f3c94e";
        ctx.fillRect(-player.width / 2, -player.height / 2, player.width, player.height);

        ctx.fillStyle = "#222";
        ctx.font = "bold 14px Arial";
        ctx.textAlign = "center";
        ctx.fillText("FOTO", 0, 5);
    }

    ctx.restore();
    ctx.restore();
}

// Colisiones.
function checkCollisions() {
    const radius = player.width * 0.34;

    if (player.y - radius < 35 || player.y + radius > H - 35) {
        endGame(false);
        return;
    }

    for (const obstacle of obstacles) {
        const overlapsX =
            player.x + radius > obstacle.x &&
            player.x - radius < obstacle.x + obstacle.width;

        const outsideGap =
            player.y - radius < obstacle.gapY ||
            player.y + radius > obstacle.gapY + obstacle.gap;

        if (overlapsX && outsideGap) {
            endGame(false);
            return;
        }
    }
}

// Pantalla final.
function endGame(won) {
    state = won ? "won" : "gameover";
    music.pause();

    overlay.classList.remove("hidden");

    if (won) {
        overlayTitle.textContent = "Felicidades amor!!";
        overlayMessage.textContent =
            "Ganaste con muchísima aura, te amo";
        startButton.textContent = "JUGAR DE NUEVO";
    } else {
        overlayTitle.textContent = "Para la próxima amor:";
        overlayMessage.textContent =
            `Llegaste al ${Math.floor(elapsed / GAME_DURATION * 100)}% del recorrido`;
        startButton.textContent = "REINTENTAR";
    }
}

// Bucle principal.
function gameLoop(timestamp) {
    if (state !== "playing") return;

    if (!lastTime) lastTime = timestamp;

    // Evitamos saltos enormes si la pestaña pierde el foco.
    const dt = Math.min((timestamp - lastTime) / 1000, 0.033);
    lastTime = timestamp;

    elapsed += dt;
    frameTime += dt;

    const progress = Math.min(elapsed / GAME_DURATION, 1);
    const difficulty = progress;

    // Velocidad de desplazamiento progresiva.
    const speed = 220 + difficulty * 130;
    wallOffset += speed * dt;

    // Física del personaje.
    player.velocityY += player.gravity * dt;
    player.y += player.velocityY * dt;
    player.rotation = Math.max(-0.45, Math.min(0.8, player.velocityY / 650));

    // Los obstáculos aparecen justo entre dos cuadros (cada 390 px de pared),
    // así la columna nunca tapa un cuadro.
    // Se crea cuando el centro del obstáculo entra en el borde derecho (con margen).
    const spawnEdge = W + 30 + OBSTACLE_WIDTH / 2;

    while (wallOffset + spawnEdge >= nextObstacleWorldX) {
        const x = nextObstacleWorldX - wallOffset - OBSTACLE_WIDTH / 2;
        createObstacle(x);
        nextObstacleWorldX += FRAME_SPACING;
    }

    obstacles.forEach((obstacle) => {
        obstacle.x -= speed * dt;
    });

    obstacles = obstacles.filter((obstacle) => obstacle.x + obstacle.width > -20);

    // Dibujar todo.
    drawBackground();
    drawObstacles();
    drawPlayer();

    progressLabel.textContent = `${Math.floor(progress * 100)}%`;

    checkCollisions();

    if (state !== "playing") return;

    if (elapsed >= GAME_DURATION) {
        endGame(true);
        return;
    }

    requestAnimationFrame(gameLoop);
}

// Estado inicial.
updatePlayerPosition();
drawBackground();
drawPlayer();

// Redibujar la pantalla de inicio cuando cada imagen termina de cargar.
[characterImage, ...pictureImages].forEach((img) => {
    img.addEventListener("load", () => {
        if (state === "ready") {
            drawBackground();
            drawPlayer();
        }
    });
});

window.addEventListener("resize", updatePlayerPosition);