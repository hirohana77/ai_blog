type HtmlInCanvasContext = CanvasRenderingContext2D & {
  drawElementImage: (element: Element, x: number, y: number) => DOMMatrix | void;
};

type HtmlInCanvasElement = HTMLCanvasElement & {
  updateElementGeometry?: (
    element: Element,
    options: { canvasTransform: DOMMatrix }
  ) => void;
};

/**
 * Android can expose the API, but renderer crashes were reported on effect
 * pages. Keep Android on the overlay fallback until native capture is validated there.
 */
export function isHtmlInCanvasBlocked(): boolean {
  if (typeof navigator === 'undefined') return false;
  const platform = (
    navigator as Navigator & {
      userAgentData?: { platform?: string };
    }
  ).userAgentData?.platform;
  return platform === 'Android' || /Android/i.test(navigator.userAgent);
}

/** Configure the capture subtree for both generations of the experimental API. */
export function prepareHtmlInCanvas(source: HTMLCanvasElement, content: HTMLElement) {
  if ('content' in source) {
    source.setAttribute('content', 'drawable');
    content.setAttribute('drawable', '');
  } else {
    source.setAttribute('layoutsubtree', '');
  }
}

/** Capture pixels and keep the native DOM hit-test region aligned with them. */
export function drawHtmlInCanvas(
  source: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  content: HTMLElement
) {
  const transform = (context as HtmlInCanvasContext).drawElementImage(content, 0, 0);
  const canvas = source as HtmlInCanvasElement;
  if (transform && typeof canvas.updateElementGeometry === 'function') {
    canvas.updateElementGeometry(content, { canvasTransform: transform });
  }
}
