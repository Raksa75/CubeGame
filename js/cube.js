/**
 * Cube face IDs (never change — they track the hollow face):
 *   0 = initially TOP
 *   1 = initially BOTTOM  ← THE HOLLOW FACE
 *   2 = initially FRONT   (south / +row)
 *   3 = initially BACK    (north / -row)
 *   4 = initially LEFT    (west  / -col)
 *   5 = initially RIGHT   (east  / +col)
 */
class Cube {
    constructor() { this.reset(); }

    reset() {
        this.top = 0;
        this.bottom = 1; // hollow
        this.front = 2;
        this.back = 3;
        this.left = 4;
        this.right = 5;
    }

    get hollowDown() { return this.bottom === 1; }

    // Roll toward +col (east)
    rollRight() {
        const { top, right, bottom, left } = this;
        this.top = left; this.right = top; this.bottom = right; this.left = bottom;
    }

    // Roll toward -col (west)
    rollLeft() {
        const { top, right, bottom, left } = this;
        this.top = right; this.left = top; this.bottom = left; this.right = bottom;
    }

    // Roll toward +row (south)
    rollForward() {
        const { top, front, bottom, back } = this;
        this.top = back; this.front = top; this.bottom = front; this.back = bottom;
    }

    // Roll toward -row (north)
    rollBackward() {
        const { top, front, bottom, back } = this;
        this.top = front; this.back = top; this.bottom = back; this.front = bottom;
    }

    // Rotate 90° counter-clockwise (seen from above) — used by rotation tiles
    rotateCCW() {
        const { front, right, back, left } = this;
        this.front = right; this.right = back; this.back = left; this.left = front;
    }

    clone() {
        const c = new Cube();
        Object.assign(c, this);
        return c;
    }

    // Returns which of the 6 face-slots the hollow face (id=1) is currently in
    hollowPosition() {
        for (const slot of ['top', 'bottom', 'front', 'back', 'left', 'right']) {
            if (this[slot] === 1) return slot;
        }
    }
}