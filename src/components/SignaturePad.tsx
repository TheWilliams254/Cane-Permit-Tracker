"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "./ui";

/** Finger/stylus signature on a canvas. Calls onChange with a PNG blob when the farmer lifts the finger. */
export function SignaturePad({
  onChange,
  disabled,
  initialUrl,
}: {
  onChange: (blob: Blob | null) => void;
  disabled?: boolean;
  initialUrl?: string | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);
  const [showInitial, setShowInitial] = useState(!!initialUrl);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = Math.round(rect.width * ratio);
    c.height = Math.round(rect.height * ratio);
    const ctx = c.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#15211A";
  }, []);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const ctx = e.currentTarget.getContext("2d")!;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    setShowInitial(false);
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = e.currentTarget.getContext("2d")!;
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    if (!hasInk) setHasInk(true);
  }
  function up(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    drawing.current = false;
    e.currentTarget.toBlob((b) => onChange(b), "image/png");
  }
  function clear() {
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.restore();
    setHasInk(false);
    setShowInitial(false);
    onChange(null);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative rounded-lg border-2 border-dashed border-stone-300 bg-white">
        {showInitial && initialUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={initialUrl} alt="Existing signature" className="absolute inset-0 h-full w-full object-contain pointer-events-none" />
        )}
        <canvas
          ref={canvasRef}
          className="block h-40 w-full touch-none"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          aria-label="Signature area"
        />
        {!hasInk && !showInitial && (
          <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-sm text-stone-500">Farmer signs here</p>
        )}
      </div>
      <div className="flex justify-between items-center">
        <p className="text-sm text-stone-500">{showInitial ? "Existing signature kept unless the farmer signs again." : hasInk ? "Signature captured." : ""}</p>
        <Button type="button" variant="secondary" size="sm" onClick={clear} disabled={disabled || (!hasInk && !showInitial)}>Clear</Button>
      </div>
    </div>
  );
}
