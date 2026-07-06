// polyfills.js — MUST be imported before any pdf-related imports
if (typeof globalThis.DOMMatrix === 'undefined') {
  globalThis.DOMMatrix = class DOMMatrix {
    constructor(init) {
      if (typeof init === 'string') {
        this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0;
      } else if (Array.isArray(init)) {
        [this.a, this.b, this.c, this.d, this.e, this.f] = init;
      } else {
        this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0;
      }
    }
    multiply() { return this; }
    translate() { return this; }
    scale() { return this; }
    rotate() { return this; }
    skewX() { return this; }
    skewY() { return this; }
    inverse() { return this; }
    transformPoint() { return { x: 0, y: 0 }; }
    toString() { return `matrix(${this.a}, ${this.b}, ${this.c}, ${this.d}, ${this.e}, ${this.f})`; }
  };
}

if (typeof globalThis.ImageData === 'undefined') {
  globalThis.ImageData = class ImageData {
    constructor(data, width, height) {
      this.data = data;
      this.width = width;
      this.height = height;
    }
  };
}

if (typeof globalThis.Path2D === 'undefined') {
  globalThis.Path2D = class Path2D {
    constructor() {}
    addPath() {}
  };
}