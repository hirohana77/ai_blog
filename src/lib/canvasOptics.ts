const contextDimensionCache = new WeakMap<
  WebGLRenderingContext | WebGL2RenderingContext,
  number
>();

/**
 * Compute a safe device-pixel-ratio bounded by GPU limits, pinch zoom scale,
 * and a 16-megapixel buffer budget so ultra-wide or zoomed viewports never OOM.
 */
export function getBoundedPixelRatio(
  element: HTMLElement,
  context?: WebGLRenderingContext | WebGL2RenderingContext | null
): number {
  const zoomScale = window.visualViewport?.scale || 1;
  const requested = Math.min(window.devicePixelRatio || 1, 2) * zoomScale;
  const width = Math.max(element.clientWidth, 1);
  const height = Math.max(element.clientHeight, 1);

  let maxDim = 8192;
  if (context) {
    let cached = contextDimensionCache.get(context);
    if (cached === undefined) {
      cached = Math.min(
        maxDim,
        context.getParameter(context.MAX_TEXTURE_SIZE) || maxDim,
        context.getParameter(context.MAX_RENDERBUFFER_SIZE) || maxDim
      );
      contextDimensionCache.set(context, cached);
    }
    maxDim = cached;
  }

  return Math.min(
    requested,
    maxDim / Math.max(width, height),
    Math.sqrt(16_777_216 / (width * height))
  );
}

/**
 * ResizeObserver coalesced to animation frames and responsive to pinch-zoom
 * visualViewport changes.
 */
export function createCanvasResizeObserver(onResize: () => void) {
  const viewport = window.visualViewport;
  let frame = 0;
  let disconnected = false;

  const schedule = () => {
    if (frame || disconnected) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      onResize();
    });
  };

  const observer = new ResizeObserver(schedule);
  window.addEventListener('resize', schedule, { passive: true });
  viewport?.addEventListener('resize', schedule, { passive: true });

  return {
    observe(element: Element, options?: ResizeObserverOptions) {
      observer.observe(element, options);
    },
    disconnect() {
      disconnected = true;
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', schedule);
      viewport?.removeEventListener('resize', schedule);
    },
  };
}

/**
 * Caches element bounding rect across ResizeObserver + passive scroll/resize events
 * so hot pointermove handlers never trigger synchronous layout thrashing.
 */
export function createRectCache(element: Element) {
  let current = element.getBoundingClientRect();

  const refresh = () => {
    current = element.getBoundingClientRect();
  };

  const observer = new ResizeObserver(refresh);
  observer.observe(element);
  window.addEventListener('resize', refresh, { passive: true });
  window.addEventListener('scroll', refresh, { capture: true, passive: true });

  return {
    get current() {
      return current;
    },
    refresh,
    destroy() {
      observer.disconnect();
      window.removeEventListener('resize', refresh);
      window.removeEventListener('scroll', refresh, true);
    },
  };
}

/**
 * Frame-rate-independent exponential smoothing (consistent across 60Hz, 120Hz, 240Hz).
 */
export function expDamp(current: number, target: number, speed: number, dt: number): number {
  const factor = 1 - Math.exp(-Math.max(dt, 0) * speed);
  return current + (target - current) * factor;
}
