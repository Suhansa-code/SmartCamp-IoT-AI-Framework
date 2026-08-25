import '@testing-library/jest-dom';

const { getComputedStyle } = window;
window.getComputedStyle = (elt) => getComputedStyle(elt);

// Mock ResizeObserver which is not available in jsdom
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserverMock;

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// Mock EventSource (SSE) — jsdom ships none. Instances are collected so a test
// can push server events into the component under test.
class EventSourceMock {
  constructor(url) {
    this.url = url;
    this.listeners = {};
    this.readyState = 1;
    EventSourceMock.instances.push(this);
    queueMicrotask(() => this.onopen?.({}));
  }

  addEventListener(name, fn) {
    (this.listeners[name] = this.listeners[name] || []).push(fn);
  }

  removeEventListener(name, fn) {
    this.listeners[name] = (this.listeners[name] || []).filter((f) => f !== fn);
  }

  /** Test helper: deliver a named server event with a JSON payload. */
  emit(name, data) {
    (this.listeners[name] || []).forEach((fn) => fn({ data: JSON.stringify(data) }));
  }

  close() {
    this.readyState = 2;
  }
}
EventSourceMock.instances = [];

window.EventSource = EventSourceMock;
globalThis.EventSource = EventSourceMock;
