"use client";

import { Component, type ReactNode, useEffect, useRef, useState } from "react";
import { Effects } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Particles } from "./particles";
import { VignetteShader } from "./shaders/vignetteShader";

/**
 * Error boundary around the WebGL canvas. The 3D background is purely decorative,
 * so any Three.js / shader / context-lost error must be contained here — otherwise
 * it bubbles to a parent boundary and blanks the whole page. On error we render the
 * plain fallback background and the rest of the page keeps working.
 */
class WebGLErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: unknown) {
    console.warn("[GL] WebGL background crashed — falling back to plain background:", error);
  }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

/** Plain, dependency-free background used whenever WebGL is unavailable or crashes. */
function GLFallback() {
  return (
    <div
      id="webgl"
      aria-hidden="true"
      style={{
        background:
          "radial-gradient(circle at 50% 35%, rgba(255,199,0,0.06), transparent 60%), #000",
      }}
    />
  );
}

/** Cheap up-front check so we never even mount the Canvas on devices without WebGL. */
function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
}

export const GL = ({ hovering }: { hovering: boolean }) => {
  // Start optimistic; resolve real WebGL support after mount (client-only).
  const [supported, setSupported] = useState(true);
  const [contextLost, setContextLost] = useState(false);
  const checkedRef = useRef(false);

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;
    setSupported(isWebGLAvailable());
  }, []);

  // Default values (previously controlled by leva)
  const speed = 1.0;
  const focus = 3.8;
  const aperture = 1.79;
  const size = 512;
  const noiseScale = 0.6;
  const noiseIntensity = 0.52;
  const timeScale = 1;
  const pointSize = 10.0;
  const opacity = 0.8;
  const planeScale = 10.0;
  const vignetteDarkness = 1.5;
  const vignetteOffset = 0.4;
  const useManualTime = false;
  const manualTime = 0;

  if (!supported || contextLost) {
    return <GLFallback />;
  }

  return (
    <WebGLErrorBoundary fallback={<GLFallback />}>
      <div id="webgl">
        <Canvas
          camera={{
            position: [
              1.2629783123314589, 2.664606471394044, -1.8178993743288914,
            ],
            fov: 50,
            near: 0.01,
            far: 300,
          }}
          onCreated={({ gl }) => {
            const canvas = gl.domElement;
            // Handle context loss gracefully: stop the default (which would throw
            // on every subsequent frame) and swap to the plain fallback background.
            canvas.addEventListener(
              "webglcontextlost",
              (event) => {
                event.preventDefault();
                console.warn("[GL] WebGL context lost — switching to fallback background.");
                setContextLost(true);
              },
              false
            );
          }}
        >
          {/* <Perf position="top-left" /> */}
          <color attach="background" args={["#000"]} />
          <Particles
            speed={speed}
            aperture={aperture}
            focus={focus}
            size={size}
            noiseScale={noiseScale}
            noiseIntensity={noiseIntensity}
            timeScale={timeScale}
            pointSize={pointSize}
            opacity={opacity}
            planeScale={planeScale}
            useManualTime={useManualTime}
            manualTime={manualTime}
            introspect={hovering}
          />
          <Effects multisamping={0} disableGamma>
            <shaderPass
              args={[VignetteShader]}
              uniforms-darkness-value={vignetteDarkness}
              uniforms-offset-value={vignetteOffset}
            />
          </Effects>
        </Canvas>
      </div>
    </WebGLErrorBoundary>
  );
};
