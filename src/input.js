// Keyboard + USB controller (Gamepad API, "standard" mapping) input.
// Axes: LS X roll, LS Y pitch, RS X yaw, RS Y (unused).  Triggers: RT throttle up, LT down.
// Buttons: A fire guns · B drop depth charge · X sighting report · Y camera view
//          LB depth setting · RB fire guns · D-pad up/down throttle · D-pad left/right radar range
//          Start pause · Back mission map
const STD = {
  A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, BACK: 8, START: 9, LS: 10, RS: 11,
  UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15,
};

export class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set();     // edge-triggered this frame
    this.pad = null;
    this.padName = '';
    this.prevButtons = [];
    this.deadzone = 0.12;
    this.throttle = 0.0;
    this.invertPitch = false;
    this.touch = null;           // on-screen controls (touch.js), when present
    this.state = { pitch: 0, roll: 0, yaw: 0, throttle: 0, fire: false, drop: false, report: false, camera: false, depth: false, radarRange: false, pause: false, map: false, brake: false, ff: false };
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code); this.pressed.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('gamepadconnected', (e) => { this.padName = e.gamepad.id; this.onPad && this.onPad(e.gamepad.id); });
    window.addEventListener('gamepaddisconnected', () => { this.padName = ''; this.onPad && this.onPad(''); });
  }

  axis(v) { return Math.abs(v) < this.deadzone ? 0 : Math.sign(v) * (Math.abs(v) - this.deadzone) / (1 - this.deadzone); }

  poll(dt) {
    const s = this.state;
    const k = this.keys;
    // keyboard
    let pitch = 0, roll = 0, yaw = 0;
    if (k.has('ArrowUp') || k.has('KeyW')) pitch -= 1;     // push forward = nose down
    if (k.has('ArrowDown') || k.has('KeyS')) pitch += 1;
    if (k.has('ArrowLeft') || k.has('KeyA')) roll -= 1;
    if (k.has('ArrowRight') || k.has('KeyD')) roll += 1;
    if (k.has('KeyQ')) yaw -= 1;
    if (k.has('KeyE')) yaw += 1;
    if (k.has('ShiftLeft') || k.has('ShiftRight') || k.has('Equal') || k.has('NumpadAdd')) this.throttle = Math.min(1, this.throttle + dt * 0.5);
    if (k.has('ControlLeft') || k.has('ControlRight') || k.has('Minus') || k.has('NumpadSubtract')) this.throttle = Math.max(0, this.throttle - dt * 0.5);
    let fire = k.has('Space');
    let drop = this.pressed.has('KeyB');
    let report = this.pressed.has('KeyR');
    let camera = this.pressed.has('KeyV');
    let depth = this.pressed.has('KeyF');
    let radarRange = this.pressed.has('KeyT');
    let pause = this.pressed.has('Escape') || this.pressed.has('KeyP');
    let map = this.pressed.has('KeyM');
    let brake = k.has('KeyX');
    const ff = this.pressed.has('KeyN');
    const tc = this.touch;
    if (tc) {
      if (tc.pitch || tc.roll) { pitch = tc.pitch; roll = tc.roll; }
      fire = fire || tc.fire;
    }
    if (this.pressed.has('KeyI')) this.invertToggle = true;

    // gamepad
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let pad = null;
    for (const p of pads) if (p && p.connected) { pad = p; break; }
    this.pad = pad;
    if (pad) {
      if (!this.padName) { this.padName = pad.id; this.onPad && this.onPad(pad.id); }
      const ax = pad.axes;
      const r = this.axis(ax[0] || 0), p = this.axis(ax[1] || 0), y = this.axis(ax[2] || 0);
      if (Math.abs(r) > Math.abs(roll)) roll = r;
      if (Math.abs(p) > Math.abs(pitch)) pitch = -p * (this.invertPitch ? -1 : 1) * -1;  // stick back (positive) = nose up
      if (Math.abs(y) > Math.abs(yaw)) yaw = y;
      const b = (i) => !!(pad.buttons[i] && pad.buttons[i].pressed);
      const bv = (i) => (pad.buttons[i] ? pad.buttons[i].value : 0);
      const edge = (i) => b(i) && !this.prevButtons[i];
      const rt = bv(STD.RT), lt = bv(STD.LT);
      if (rt > 0.05) this.throttle = Math.min(1, this.throttle + dt * 0.6 * rt);
      if (lt > 0.05) this.throttle = Math.max(0, this.throttle - dt * 0.6 * lt);
      if (b(STD.UP)) this.throttle = Math.min(1, this.throttle + dt * 0.5);
      if (b(STD.DOWN)) this.throttle = Math.max(0, this.throttle - dt * 0.5);
      fire = fire || b(STD.A) || b(STD.RB);
      drop = drop || edge(STD.B);
      report = report || edge(STD.X);
      camera = camera || edge(STD.Y);
      depth = depth || edge(STD.LB);
      radarRange = radarRange || edge(STD.LEFT) || edge(STD.RIGHT);
      pause = pause || edge(STD.START);
      map = map || edge(STD.BACK);
      brake = brake || b(STD.LS);
      this.prevButtons = pad.buttons.map((x) => x.pressed);
    }
    s.pitch = Math.max(-1, Math.min(1, pitch));
    s.roll = Math.max(-1, Math.min(1, roll));
    s.yaw = Math.max(-1, Math.min(1, yaw));
    s.throttle = this.throttle;
    s.fire = fire; s.drop = drop; s.report = report; s.camera = camera; s.depth = depth;
    s.radarRange = radarRange; s.pause = pause; s.map = map; s.brake = brake; s.ff = ff;
    this.pressed.clear();
    return s;
  }

  // Menu navigation helpers (edge-triggered), usable before a mission starts.
  menuPoll() {
    const out = { up: false, down: false, left: false, right: false, accept: false, back: false };
    if (this.pressed.has('ArrowUp') || this.pressed.has('KeyW')) out.up = true;
    if (this.pressed.has('ArrowDown') || this.pressed.has('KeyS')) out.down = true;
    if (this.pressed.has('ArrowLeft') || this.pressed.has('KeyA')) out.left = true;
    if (this.pressed.has('ArrowRight') || this.pressed.has('KeyD')) out.right = true;
    if (this.pressed.has('Enter') || this.pressed.has('Space')) out.accept = true;
    if (this.pressed.has('Escape') || this.pressed.has('Backspace')) out.back = true;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let pad = null;
    for (const p of pads) if (p && p.connected) { pad = p; break; }
    if (pad) {
      const b = (i) => !!(pad.buttons[i] && pad.buttons[i].pressed);
      const edge = (i) => b(i) && !this.prevButtons[i];
      const ay = pad.axes[1] || 0, ax = pad.axes[0] || 0;
      const now = performance.now();
      if (!this._stickT || now - this._stickT > 220) {
        if (ay < -0.6) { out.up = true; this._stickT = now; }
        if (ay > 0.6) { out.down = true; this._stickT = now; }
        if (ax < -0.6) { out.left = true; this._stickT = now; }
        if (ax > 0.6) { out.right = true; this._stickT = now; }
      }
      if (edge(STD.UP)) out.up = true;
      if (edge(STD.DOWN)) out.down = true;
      if (edge(STD.LEFT)) out.left = true;
      if (edge(STD.RIGHT)) out.right = true;
      if (edge(STD.A) || edge(STD.START)) out.accept = true;
      if (edge(STD.B) || edge(STD.BACK)) out.back = true;
      this.prevButtons = pad.buttons.map((x) => x.pressed);
      if (!this.padName) { this.padName = pad.id; this.onPad && this.onPad(pad.id); }
    }
    this.pressed.clear();
    return out;
  }
}
