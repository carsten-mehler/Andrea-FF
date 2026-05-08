const arena = document.getElementById("arena");
const crosshair = document.getElementById("crosshair");
const effects = document.getElementById("effects");
const photo = document.querySelector(".andrea-photo");
const touchControls = document.querySelectorAll("[data-control]");
const hitCount = document.getElementById("hitCount");
const shotCount = document.getElementById("shotCount");
const packageImageMarkup = '<img src="assets/fishermans-friend-pack.svg" alt="" draggable="false">';

const PHOTO_RATIO = 4032 / 3024;
const TARGET_ZONES = [
  { x: 0.455, y: 0.65, w: 0.36, h: 0.35 },
  { x: 0.045, y: 0.77, w: 0.2, h: 0.23 }
];

const state = {
  x: 0,
  y: 0,
  hits: 0,
  shots: 0,
  lastShotAt: 0,
  lastFrameAt: performance.now(),
  userMoved: false,
  pressed: new Set(),
  flowers: []
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function getArenaSize() {
  const rect = arena.getBoundingClientRect();
  return { width: rect.width, height: rect.height };
}

function getImageGeometry() {
  const { width, height } = getArenaSize();
  const naturalRatio = photo.naturalWidth && photo.naturalHeight
    ? photo.naturalWidth / photo.naturalHeight
    : PHOTO_RATIO;
  const containerRatio = width / height;
  let renderedWidth;
  let renderedHeight;

  if (containerRatio > naturalRatio) {
    renderedWidth = width;
    renderedHeight = width / naturalRatio;
  } else {
    renderedHeight = height;
    renderedWidth = height * naturalRatio;
  }

  return {
    width: renderedWidth,
    height: renderedHeight,
    left: (width - renderedWidth) / 2,
    top: height - renderedHeight
  };
}

function imagePointToArena(nx, ny) {
  const image = getImageGeometry();

  return {
    x: image.left + image.width * nx,
    y: image.top + image.height * ny
  };
}

function arenaPointToImage(point) {
  const image = getImageGeometry();

  return {
    x: (point.x - image.left) / image.width,
    y: (point.y - image.top) / image.height
  };
}

function isAndreaHit(point) {
  const normalized = arenaPointToImage(point);

  if (
    normalized.x < 0 ||
    normalized.x > 1 ||
    normalized.y < 0 ||
    normalized.y > 1
  ) {
    return false;
  }

  return TARGET_ZONES.some((zone) => (
    normalized.x >= zone.x &&
    normalized.x <= zone.x + zone.w &&
    normalized.y >= zone.y &&
    normalized.y <= zone.y + zone.h
  ));
}

function setCrosshairPosition(x, y) {
  const { width, height } = getArenaSize();
  state.x = clamp(x, 32, width - 32);
  state.y = clamp(y, 32, height - 32);
  crosshair.style.left = `${state.x}px`;
  crosshair.style.top = `${state.y}px`;
}

function placeCrosshairAtAndrea() {
  const point = imagePointToArena(0.62, 0.8);
  setCrosshairPosition(point.x, point.y);
}

function createPackage() {
  const pack = document.createElement("div");
  pack.className = "package";
  pack.innerHTML = packageImageMarkup;
  return pack;
}

function createFlowerMarkup() {
  let petals = "";

  for (let index = 0; index < 8; index += 1) {
    petals += `<span class="petal" style="--i:${index}"></span>`;
  }

  return `${petals}<span class="stem"></span><span class="center"></span>`;
}

function makeFlower(element, point) {
  element.className = "flower bloom";
  element.innerHTML = createFlowerMarkup();
  element.style.left = `${point.x}px`;
  element.style.top = `${point.y}px`;
  element.style.transform = "";

  state.flowers.push(element);

  if (state.flowers.length > 28) {
    const oldest = state.flowers.shift();
    oldest.remove();
  }
}

function spawnPetals(point) {
  for (let index = 0; index < 12; index += 1) {
    const spark = document.createElement("span");
    const angle = (Math.PI * 2 * index) / 12;
    const distance = 42 + Math.random() * 56;
    spark.className = "spark";
    spark.style.left = `${point.x}px`;
    spark.style.top = `${point.y}px`;
    spark.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
    spark.style.setProperty("--dy", `${Math.sin(angle) * distance}px`);
    effects.appendChild(spark);
    window.setTimeout(() => spark.remove(), 760);
  }
}

function flashHit() {
  arena.classList.remove("hit");
  window.requestAnimationFrame(() => {
    arena.classList.add("hit");
    window.setTimeout(() => arena.classList.remove("hit"), 300);
  });
}

function registerHit(projectile, target) {
  state.hits += 1;
  hitCount.textContent = String(state.hits);
  makeFlower(projectile, target);
  spawnPetals(target);
  flashHit();
}

function registerMiss(projectile, target) {
  projectile.classList.add("miss");
  projectile.style.left = `${target.x}px`;
  projectile.style.top = `${target.y}px`;
  projectile.style.transform = "translate(-50%, -50%) rotate(30deg) scale(0.72)";
  window.setTimeout(() => projectile.remove(), 440);
}

function shoot() {
  const now = performance.now();

  if (now - state.lastShotAt < 230) {
    return;
  }

  state.lastShotAt = now;
  state.shots += 1;
  shotCount.textContent = String(state.shots);

  const { width, height } = getArenaSize();
  const projectile = createPackage();
  const start = {
    x: clamp(width * 0.5, 90, width - 90),
    y: height + 46
  };
  const target = { x: state.x, y: state.y };
  const distance = Math.hypot(target.x - start.x, target.y - start.y);
  const duration = clamp(distance * 0.82, 360, 820);
  const launchedAt = performance.now();

  effects.appendChild(projectile);

  function animateFrame(frameTime) {
    const progress = clamp((frameTime - launchedAt) / duration, 0, 1);
    const eased = easeOutCubic(progress);
    const arc = Math.sin(progress * Math.PI) * -96;
    const x = lerp(start.x, target.x, eased);
    const y = lerp(start.y, target.y, eased) + arc;
    const spin = lerp(-18, 34, progress);
    const scale = lerp(0.78, 1.04, progress);

    projectile.style.left = `${x}px`;
    projectile.style.top = `${y}px`;
    projectile.style.transform = `translate(-50%, -50%) rotate(${spin}deg) scale(${scale})`;

    if (progress < 1) {
      window.requestAnimationFrame(animateFrame);
      return;
    }

    if (isAndreaHit(target)) {
      registerHit(projectile, target);
    } else {
      registerMiss(projectile, target);
    }
  }

  window.requestAnimationFrame(animateFrame);
}

function updateMovement(frameTime) {
  const delta = Math.min((frameTime - state.lastFrameAt) / 1000, 0.04);
  state.lastFrameAt = frameTime;

  let dx = 0;
  let dy = 0;

  if (state.pressed.has("ArrowLeft")) dx -= 1;
  if (state.pressed.has("ArrowRight")) dx += 1;
  if (state.pressed.has("ArrowUp")) dy -= 1;
  if (state.pressed.has("ArrowDown")) dy += 1;

  if (dx || dy) {
    const length = Math.hypot(dx, dy);
    const speed = state.pressed.has("Shift") ? 520 : 310;
    setCrosshairPosition(
      state.x + (dx / length) * speed * delta,
      state.y + (dy / length) * speed * delta
    );
  }

  window.requestAnimationFrame(updateMovement);
}

function handleKeyDown(event) {
  if (event.key.startsWith("Arrow")) {
    event.preventDefault();
    state.userMoved = true;
    state.pressed.add(event.key);
    return;
  }

  if (event.key === "Shift") {
    state.pressed.add("Shift");
    return;
  }

  if (event.code === "Space") {
    event.preventDefault();
    shoot();
  }
}

function handleKeyUp(event) {
  if (event.key.startsWith("Arrow") || event.key === "Shift") {
    event.preventDefault();
    state.pressed.delete(event.key);
  }
}

function pressControl(button) {
  const control = button.dataset.control;

  if (!control) {
    return;
  }

  arena.focus({ preventScroll: true });
  button.classList.add("active");

  if (control === "fire") {
    shoot();
    return;
  }

  state.userMoved = true;
  state.pressed.add(control);
}

function releaseControl(button) {
  const control = button.dataset.control;

  button.classList.remove("active");

  if (control && control !== "fire") {
    state.pressed.delete(control);
  }
}

function setupTouchControls() {
  touchControls.forEach((button) => {
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();

      if (button.setPointerCapture) {
        button.setPointerCapture(event.pointerId);
      }

      pressControl(button);
    });

    button.addEventListener("pointerup", (event) => {
      event.preventDefault();
      releaseControl(button);
    });

    button.addEventListener("pointercancel", () => {
      releaseControl(button);
    });

    button.addEventListener("lostpointercapture", () => {
      releaseControl(button);
    });
  });
}

function handleResize() {
  if (state.userMoved) {
    setCrosshairPosition(state.x, state.y);
    return;
  }

  placeCrosshairAtAndrea();
}

window.addEventListener("keydown", handleKeyDown);
window.addEventListener("keyup", handleKeyUp);
window.addEventListener("resize", handleResize);
arena.addEventListener("pointerdown", () => arena.focus({ preventScroll: true }));
photo.addEventListener("load", placeCrosshairAtAndrea, { once: true });
setupTouchControls();

if (photo.complete) {
  placeCrosshairAtAndrea();
}

arena.focus({ preventScroll: true });
window.requestAnimationFrame(updateMovement);
