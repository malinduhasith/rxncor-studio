"use client";

import { useEffect, useRef } from "react";

const vertexShaderSource = `
  attribute vec2 a_position;

  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const fragmentShaderSource = `
  precision highp float;

  uniform vec2 u_resolution;
  uniform vec2 u_pointer;
  uniform float u_time;
  uniform float u_scroll;

  float organicShape(vec2 point) {
    point.y *= 1.08;
    float angle = atan(point.y, point.x);
    float radius = 0.31;
    radius += sin(angle * 3.0 + u_time * 0.82) * 0.032;
    radius += sin(angle * 5.0 - u_time * 0.57) * 0.018;
    radius += sin(angle * 2.0 + u_time * 0.31 + u_scroll * 3.0) * 0.025;
    return length(point) - radius;
  }

  void main() {
    vec2 resolution = max(u_resolution, vec2(1.0));
    vec2 uv = (gl_FragCoord.xy * 2.0 - resolution.xy) / min(resolution.x, resolution.y);
    uv.y *= -1.0;

    vec2 offset = vec2(u_pointer.x * 0.055, u_pointer.y * 0.04 - u_scroll * 0.055);
    vec2 point = uv - offset;
    point *= 1.0 + u_scroll * 0.12;

    float distanceToShape = organicShape(point);
    float epsilon = 0.0035;
    vec2 gradient = vec2(
      organicShape(point + vec2(epsilon, 0.0)) - organicShape(point - vec2(epsilon, 0.0)),
      organicShape(point + vec2(0.0, epsilon)) - organicShape(point - vec2(0.0, epsilon))
    );
    vec3 normal = normalize(vec3(-gradient * 72.0, 1.0));
    vec3 light = normalize(vec3(-0.45 + u_pointer.x * 0.2, -0.68, 0.72));
    float diffuse = clamp(dot(normal, light) * 0.5 + 0.5, 0.0, 1.0);

    float fill = 1.0 - smoothstep(-0.006, 0.012, distanceToShape);
    float innerGlow = exp(-abs(distanceToShape + 0.09) * 15.0) * fill;
    float outerLine = 1.0 - smoothstep(0.0, 0.008, abs(distanceToShape - 0.072));
    float farLine = 1.0 - smoothstep(0.0, 0.006, abs(distanceToShape - 0.13));

    vec3 shadow = vec3(0.62, 0.08, 0.015);
    vec3 orange = vec3(1.0, 0.245, 0.055);
    vec3 highlight = vec3(1.0, 0.62, 0.23);
    vec3 color = mix(shadow, orange, diffuse);
    color = mix(color, highlight, innerGlow * 0.66);

    float alpha = max(fill * 0.97, outerLine * 0.35);
    alpha = max(alpha, farLine * 0.16);
    gl_FragColor = vec4(color, alpha);
  }
`;

function createShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string
) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

export function MorphCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: true,
      premultipliedAlpha: false
    });
    if (!gl) {
      canvas.dataset.fallback = "true";
      return;
    }

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    if (!vertexShader || !fragmentShader) {
      canvas.dataset.fallback = "true";
      return;
    }

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      canvas.dataset.fallback = "true";
      return;
    }

    const buffer = gl.createBuffer();
    const position = gl.getAttribLocation(program, "a_position");
    const resolution = gl.getUniformLocation(program, "u_resolution");
    const pointer = gl.getUniformLocation(program, "u_pointer");
    const time = gl.getUniformLocation(program, "u_time");
    const scroll = gl.getUniformLocation(program, "u_scroll");

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    );
    gl.useProgram(program);
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    gl.clearColor(0, 0, 0, 0);

    let pointerX = 0;
    let pointerY = 0;
    let renderedPointerX = 0;
    let renderedPointerY = 0;
    let frame = 0;
    const startedAt = performance.now();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const scrollSection = canvas.closest<HTMLElement>("[data-scroll-track]");

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const width = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const height = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl.viewport(0, 0, width, height);
    };

    const handlePointerMove = (event: PointerEvent) => {
      pointerX = (event.clientX / Math.max(1, window.innerWidth) - 0.5) * 2;
      pointerY = (event.clientY / Math.max(1, window.innerHeight) - 0.5) * 2;
    };

    const render = (now: number) => {
      resize();
      renderedPointerX += (pointerX - renderedPointerX) * 0.055;
      renderedPointerY += (pointerY - renderedPointerY) * 0.055;

      const scrollProgress = Number(
        scrollSection?.style.getPropertyValue("--scroll-progress") || 0
      );
      const elapsed = reducedMotion.matches ? 0 : (now - startedAt) / 1000;

      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.uniform2f(resolution, canvas.width, canvas.height);
      gl.uniform2f(pointer, renderedPointerX, renderedPointerY);
      gl.uniform1f(time, elapsed);
      gl.uniform1f(scroll, Number.isFinite(scrollProgress) ? scrollProgress : 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      frame = window.requestAnimationFrame(render);
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    frame = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", handlePointerMove);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
    };
  }, []);

  return <canvas aria-hidden="true" className="rr-morph-canvas" ref={canvasRef} />;
}
