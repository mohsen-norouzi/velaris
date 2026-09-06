const HOME_AZIMUTH = -Math.atan(0.3);
const HOME_ELEVATION = 0.052;
const MIN_ELEVATION = 0.035;
const MAX_ELEVATION = 0.72;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** Frame-rate-independent camera follow and release inertia. Angles are radians. */
export class CameraOrbit {
  azimuth = HOME_AZIMUTH;
  elevation = HOME_ELEVATION;
  private targetAzimuth = HOME_AZIMUTH;
  private targetElevation = HOME_ELEVATION;
  private azimuthVelocity = 0;
  private elevationVelocity = 0;
  private lastMoveTime = 0;
  private dragging = false;

  begin(time: number) {
    this.dragging = true;
    this.lastMoveTime = time;
    this.azimuthVelocity = this.elevationVelocity = 0;
  }

  move(dx: number, dy: number, time: number) {
    if (!this.dragging) return;
    const dt = clamp((time - this.lastMoveTime) / 1000, 1 / 240, 0.05);
    const horizontal = -dx * 0.0045;
    const nextElevation = clamp(this.targetElevation + dy * 0.0035, MIN_ELEVATION, MAX_ELEVATION);
    const vertical = nextElevation - this.targetElevation;
    this.targetAzimuth += horizontal;
    this.targetElevation = nextElevation;
    this.azimuthVelocity = this.azimuthVelocity * 0.35 + clamp(horizontal / dt, -2.4, 2.4) * 0.65;
    this.elevationVelocity = this.elevationVelocity * 0.35 + clamp(vertical / dt, -1.2, 1.2) * 0.65;
    this.lastMoveTime = time;
  }

  end(time: number, cancel = false) {
    this.dragging = false;
    // Holding still before releasing must not resurrect an earlier flick.
    if (cancel || time - this.lastMoveTime > 90) this.azimuthVelocity = this.elevationVelocity = 0;
  }

  nudge(horizontal: number, vertical: number) {
    this.azimuthVelocity = this.elevationVelocity = 0;
    this.targetAzimuth += horizontal;
    this.targetElevation = clamp(this.targetElevation + vertical, MIN_ELEVATION, MAX_ELEVATION);
  }

  reset() {
    this.dragging = false;
    this.azimuthVelocity = this.elevationVelocity = 0;
    // Return along the short arc even after several complete orbits.
    this.targetAzimuth = this.azimuth + Math.atan2(Math.sin(HOME_AZIMUTH - this.azimuth), Math.cos(HOME_AZIMUTH - this.azimuth));
    this.targetElevation = HOME_ELEVATION;
  }

  update(dt: number, reducedMotion = false) {
    if (!this.dragging && !reducedMotion) {
      const decay = Math.exp(-6 * dt);
      this.targetAzimuth += this.azimuthVelocity * (1 - decay) / 6;
      this.targetElevation = clamp(this.targetElevation + this.elevationVelocity * (1 - decay) / 6, MIN_ELEVATION, MAX_ELEVATION);
      this.azimuthVelocity *= decay;
      this.elevationVelocity *= decay;
      if (this.targetElevation === MIN_ELEVATION || this.targetElevation === MAX_ELEVATION) this.elevationVelocity = 0;
    }
    const follow = reducedMotion ? 1 : 1 - Math.exp(-10 * dt);
    this.azimuth += (this.targetAzimuth - this.azimuth) * follow;
    this.elevation += (this.targetElevation - this.elevation) * follow;
  }
}
