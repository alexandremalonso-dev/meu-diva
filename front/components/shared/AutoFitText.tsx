"use client";

import { useRef, useLayoutEffect, useState } from "react";

interface AutoFitTextProps {
  children: React.ReactNode;
  className?: string;
  minScale?: number;
}

// 🔥 Tenta encolher o texto (via transform:scale) pra caber numa linha só.
// Se mesmo na escala mínima ainda não coubesse (texto muito comprido), em
// vez de ficar ilegível, troca pra permitir quebra de linha em tamanho
// normal — nunca corta com "..." e nunca fica pequeno demais pra ler.
export function AutoFitText({ children, className = "", minScale = 0.62 }: AutoFitTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [scale, setScale] = useState(1);
  const [wrap, setWrap] = useState(false);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const text = textRef.current;
    if (!container || !text) return;

    const fit = () => {
      setWrap(false);
      text.style.transform = "scale(1)";
      text.style.whiteSpace = "nowrap";
      const containerWidth = container.clientWidth;
      const textWidth = text.scrollWidth;

      if (containerWidth <= 0 || textWidth <= containerWidth) {
        setScale(1);
        return;
      }

      const ratio = containerWidth / textWidth;
      if (ratio >= minScale) {
        setScale(ratio);
      } else {
        // Nem encolhendo até o mínimo caberia numa linha — permite quebrar
        setScale(1);
        setWrap(true);
      }
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(container);
    return () => ro.disconnect();
  }, [children, minScale]);

  return (
    <div ref={containerRef} className={`overflow-hidden w-full ${className}`}>
      <span
        ref={textRef}
        style={{
          display: "inline-block",
          transform: `scale(${scale})`,
          transformOrigin: "left center",
          whiteSpace: wrap ? "normal" : "nowrap",
        }}
      >
        {children}
      </span>
    </div>
  );
}
