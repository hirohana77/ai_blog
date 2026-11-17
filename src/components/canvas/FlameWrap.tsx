import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from 'react';
import {
  createFlameWrap,
  supportsHtmlInCanvas,
  type FlameWrapInstance,
  type FlameWrapOptions,
} from './FlameWrapVanilla';

export interface FlameWrapProps extends FlameWrapOptions {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

const emptySubscribe = () => () => {};

export function FlameWrap({
  children,
  className,
  style,
  ...options
}: FlameWrapProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const sourceRef = useRef<HTMLCanvasElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const outputRef = useRef<HTMLCanvasElement>(null);
  const instanceRef = useRef<FlameWrapInstance | null>(null);
  const [initialOptions] = useState(options);
  const [failed, setFailed] = useState(false);

  const supported = useSyncExternalStore(
    emptySubscribe,
    supportsHtmlInCanvas,
    () => false
  );
  const native = supported && !failed;

  const reach = Math.round(Math.max(options.height ?? 170, 24) * 1.5) + 40;
  const glow = Math.round(Math.max(options.spread ?? 8, 8) * 3) + 16;

  // Keep intrinsic wrapper height synced from content when `source` is absolute-positioned
  // under html-in-canvas (`native = true`), preventing 0px collapse when no fixed height is given.
  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    const content = contentRef.current;
    if (!wrapper || !content) return;

    const syncHeight = () => {
      if (style?.height !== undefined) return;
      const measured = Math.ceil(content.getBoundingClientRect().height || content.scrollHeight);
      if (measured > 0) {
        const next = `${measured}px`;
        if (wrapper.style.minHeight !== next) {
          wrapper.style.minHeight = next;
          instanceRef.current?.resize();
        }
      }
    };

    syncHeight();

    const ro = new ResizeObserver(syncHeight);
    ro.observe(content);
    return () => ro.disconnect();
  }, [native, style?.height]);

  useEffect(() => {
    const source = sourceRef.current;
    const content = contentRef.current;
    const output = outputRef.current;
    if (!source || !content || !output) return;
    instanceRef.current = createFlameWrap(
      { source, content, output },
      initialOptions
    );
    if (native && !instanceRef.current) setFailed(true);
    return () => {
      instanceRef.current?.destroy();
      instanceRef.current = null;
    };
  }, [initialOptions, native]);

  useEffect(() => {
    instanceRef.current?.setOptions(options);
  });

  return (
    <div
      ref={wrapperRef}
      className={className}
      style={{ position: 'relative', ...style }}
    >
      <canvas
        ref={sourceRef}
        // @ts-expect-error experimental html-in-canvas attribute
        layoutsubtree="true"
        suppressHydrationWarning
        style={
          native
            ? { position: 'absolute', inset: 0, width: '100%', height: '100%' }
            : { display: 'none' }
        }
      >
        {native ? (
          <div
            ref={contentRef}
            style={{
              position: 'relative',
              width: '100%',
              overflow: 'visible',
            }}
          >
            {children}
          </div>
        ) : null}
      </canvas>
      {!native ? (
        <div
          ref={contentRef}
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            overflow: 'visible',
          }}
        >
          {children}
        </div>
      ) : null}
      <canvas
        ref={outputRef}
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: -reach,
          right: -glow,
          bottom: -glow,
          left: -glow,
          width: `calc(100% + ${glow * 2}px)`,
          height: `calc(100% + ${reach + glow}px)`,
          pointerEvents: 'none',
          zIndex: 20,
        }}
      />
    </div>
  );
}

export type { FlameWrapInstance, FlameWrapOptions };

export default FlameWrap;
