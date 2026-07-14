document.addEventListener("DOMContentLoaded", function () {
    const svgElement = document.querySelector(".interactive-svg-background");
    const canvasElement = document.querySelector(".interactive-gradient-canvas");
    if (!svgElement) return;

    const backgroundRoot = svgElement.closest(".full-width-bg");
    const visualElements = canvasElement ? [svgElement, canvasElement] : [svgElement];
    const requestedRenderer = new URLSearchParams(window.location.search).get("gradient");

    const SVG_VIEWBOX = { x: -1000, y: -900, width: 4474, height: 3541 };
    const SVG_SIZE = { width: 825, height: 514 };
    const SVG_CENTER = { x: 1237, y: 870.5 };

    const ELLIPSES = [
        { cx: 899, cy: 557, rx: 900, ry: 601, color: "#B63C8E", opacity: 0.7 },
        { cx: 1308, cy: 785, rx: 656, ry: 712, color: "#A89080", opacity: 0.7 },
        { cx: 1627.14, cy: 316.55, rx: 550, ry: 320, color: "#FC6B3F", opacity: 0.8 },
        { cx: 1032.5, cy: 445.5, rx: 554.5, ry: 339.5, color: "#FA292C", opacity: 0.8 },
        { cx: 498, cy: 975.5, rx: 567, ry: 209.5, color: "#406D82", opacity: 0.8 },
        { cx: 441.985, cy: 958.434, rx: 786.985, ry: 316.434, color: "#415E80", opacity: 0.7 }
    ];

    const BREAKPOINTS = {
        mobile: 768,
        tablet: 1024
    };

    const RESPONSIVE_CONFIG = {
        mobile: {
            scale: 3.5,
            blur: 20,
            offsetMultiplier: 0.5,
            rotationSpeed: 0.55,
            maxOffset: { x: 6, y: 11 },
            radiusX: 5,
            radiusY: 7,
            renderWidth: 512
        },
        tablet: {
            scale: 4.5,
            blur: 24,
            offsetMultiplier: 0.6,
            rotationSpeed: 0.4,
            maxOffset: { x: 7, y: 10 },
            radiusX: 6,
            radiusY: 8,
            renderWidth: 720
        },
        desktop: {
            scale: 5.8,
            blur: 28,
            offsetMultiplier: 1,
            rotationSpeed: 0.5,
            maxOffset: { x: 10, y: 15 },
            radiusX: 10,
            radiusY: 14,
            restOffset: { x: 6.2, y: 9.4 },
            parallax: { x: 3.2, y: 4.4 },
            angleRange: 18,
            angleTilt: 7,
            distanceRange: 0.24,
            paintFlow: 95,
            loopFlow: 118,
            shaderFlow: 28,
            loopSpeed: 0.98,
            pointerLoopBoost: 0.72,
            positionEasing: 0.16,
            angleEasing: 0.18,
            renderWidth: 896
        }
    };

    const CONFIG = {
        smoothingFactor: 0.1,
        maxSpeedPerFrame: 4.8,
        damping: 0.62,
        fastMovementThreshold: 2.5,
        maxDistance: 400,
        distanceEasing: 0.18,
        animationBoundary: 880,
        centerY: 440,
        mobileFrameSkip: 3,
        tabletFrameSkip: 2,
        updateThreshold: 0.01,
        cssUpdateDelay: 16
    };

    const DEG_TO_RAD = Math.PI / 180;
    const RAD_TO_DEG = 180 / Math.PI;
    const PI2 = Math.PI * 2;

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function softClamp(value, intensity = 1.25) {
        return Math.tanh(value * intensity);
    }

    function hexToRgb(hex) {
        const value = hex.replace("#", "");
        return {
            r: parseInt(value.slice(0, 2), 16) / 255,
            g: parseInt(value.slice(2, 4), 16) / 255,
            b: parseInt(value.slice(4, 6), 16) / 255
        };
    }

    class WebGLGradientRenderer {
        constructor(canvas, ellipses) {
            this.canvas = canvas;
            this.ellipses = ellipses.map((ellipse) => ({
                ...ellipse,
                rgb: hexToRgb(ellipse.color),
                dx: ellipse.cx - SVG_CENTER.x,
                dy: ellipse.cy - SVG_CENTER.y
            }));
            this.gl = canvas.getContext("webgl2", {
                alpha: true,
                antialias: false,
                depth: false,
                stencil: false,
                premultipliedAlpha: false,
                preserveDrawingBuffer: false,
                powerPreference: "high-performance"
            });
            if (!this.gl) {
                throw new Error("WebGL2 is not available.");
            }

            this.width = 0;
            this.height = 0;
            this.renderScale = 1;
            this.paintSpread = 1.18;
            this.paintCohesion = 1.08;
            this.quadBuffer = null;
            this.sourceTexture = null;
            this.tempTexture = null;
            this.sourceFramebuffer = null;
            this.tempFramebuffer = null;
            this.centerData = new Float32Array(this.ellipses.length * 2);
            this.radiusData = new Float32Array(this.ellipses.length * 2);
            this.colorData = new Float32Array(this.ellipses.length * 4);

            for (let i = 0; i < this.ellipses.length; i++) {
                const ellipse = this.ellipses[i];
                const colorIndex = i * 4;
                this.colorData[colorIndex] = ellipse.rgb.r;
                this.colorData[colorIndex + 1] = ellipse.rgb.g;
                this.colorData[colorIndex + 2] = ellipse.rgb.b;
                this.colorData[colorIndex + 3] = ellipse.opacity;
            }

            this.ellipseProgram = this.createProgram(this.ellipseVertexSource(), this.ellipseFragmentSource());
            this.ellipseUniforms = {
                centers: this.gl.getUniformLocation(this.ellipseProgram.program, "uCenters[0]"),
                radii: this.gl.getUniformLocation(this.ellipseProgram.program, "uRadii[0]"),
                colors: this.gl.getUniformLocation(this.ellipseProgram.program, "uColors[0]")
            };
            this.blurProgram = this.createProgram(this.fullscreenVertexSource(), this.blurFragmentSource());
            this.initQuad();
        }

        initQuad() {
            const gl = this.gl;
            this.quadBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
            gl.bufferData(
                gl.ARRAY_BUFFER,
                new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
                gl.STATIC_DRAW
            );
        }

        resize(config) {
            const width = config.renderWidth;
            const height = Math.round(width * SVG_SIZE.height / SVG_SIZE.width);
            if (this.width === width && this.height === height) return;

            this.width = width;
            this.height = height;
            this.renderScale = width / SVG_SIZE.width;
            this.canvas.width = width;
            this.canvas.height = height;

            const gl = this.gl;
            this.sourceTexture = this.createTexture(width, height);
            this.tempTexture = this.createTexture(width, height);
            this.sourceFramebuffer = this.createFramebuffer(this.sourceTexture);
            this.tempFramebuffer = this.createFramebuffer(this.tempTexture);
        }

        createTexture(width, height) {
            const gl = this.gl;
            const texture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
            return texture;
        }

        createFramebuffer(texture) {
            const gl = this.gl;
            const framebuffer = gl.createFramebuffer();
            gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
            if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
                throw new Error("WebGL framebuffer is incomplete.");
            }
            return framebuffer;
        }

        compileShader(type, source) {
            const gl = this.gl;
            const shader = gl.createShader(type);
            gl.shaderSource(shader, source);
            gl.compileShader(shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                const info = gl.getShaderInfoLog(shader);
                gl.deleteShader(shader);
                throw new Error(info || "Shader compilation failed.");
            }
            return shader;
        }

        createProgram(vertexSource, fragmentSource) {
            const gl = this.gl;
            const vertexShader = this.compileShader(gl.VERTEX_SHADER, vertexSource);
            const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, fragmentSource);
            const program = gl.createProgram();
            gl.attachShader(program, vertexShader);
            gl.attachShader(program, fragmentShader);
            gl.linkProgram(program);
            gl.deleteShader(vertexShader);
            gl.deleteShader(fragmentShader);
            if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
                const info = gl.getProgramInfoLog(program);
                gl.deleteProgram(program);
                throw new Error(info || "Program link failed.");
            }

            return {
                program,
                attributes: {
                    position: gl.getAttribLocation(program, "aPosition")
                },
                uniforms: this.collectUniforms(program)
            };
        }

        collectUniforms(program) {
            const gl = this.gl;
            const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
            const uniforms = {};
            for (let i = 0; i < count; i++) {
                const info = gl.getActiveUniform(program, i);
                if (info) {
                    uniforms[info.name] = gl.getUniformLocation(program, info.name);
                }
            }
            return uniforms;
        }

        bindQuad(programInfo) {
            const gl = this.gl;
            gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
            gl.enableVertexAttribArray(programInfo.attributes.position);
            gl.vertexAttribPointer(programInfo.attributes.position, 2, gl.FLOAT, false, 0, 0);
        }

        render(state) {
            const gl = this.gl;
            this.resize(state.config);

            gl.disable(gl.DEPTH_TEST);
            gl.disable(gl.STENCIL_TEST);

            this.renderEllipses(state);
            this.blurPass(this.sourceTexture, this.tempFramebuffer, 1, 0, state.config.blur, false);
            this.blurPass(this.tempTexture, null, 0, 1, state.config.blur, true);
        }

        renderEllipses(state) {
            const gl = this.gl;
            const programInfo = this.ellipseProgram;
            const meetScale = Math.min(SVG_SIZE.width / SVG_VIEWBOX.width, SVG_SIZE.height / SVG_VIEWBOX.height);
            const xOffset = (SVG_SIZE.width - SVG_VIEWBOX.width * meetScale) * 0.5;
            const yOffset = (SVG_SIZE.height - SVG_VIEWBOX.height * meetScale) * 0.5;
            const disperseFactor = (state.distance - 0.5) * 2;
            const moveAmount = this.paintCohesion / state.config.scale;
            const baseRotation = -state.angle * DEG_TO_RAD;
            const pointerX = state.pointerX || 0;
            const pointerY = state.pointerY || 0;
            const flowTime = state.flowTime || 0;
            const pointerStrength = Math.min(1, Math.sqrt(pointerX * pointerX + pointerY * pointerY));
            const paintFlow = (state.config.paintFlow || 0) * pointerStrength;
            const loopFlow = state.config.loopFlow || 0;

            gl.bindFramebuffer(gl.FRAMEBUFFER, this.sourceFramebuffer);
            gl.viewport(0, 0, this.width, this.height);
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.useProgram(programInfo.program);
            this.bindQuad(programInfo);
            gl.uniform2f(programInfo.uniforms.uResolution, this.width, this.height);
            gl.uniform1f(programInfo.uniforms.uRotation, baseRotation);
            gl.uniform1f(programInfo.uniforms.uFlowTime, flowTime);
            gl.uniform2f(programInfo.uniforms.uPointer, pointerX, pointerY);
            gl.uniform1f(programInfo.uniforms.uFlowAmount, (state.config.shaderFlow || 0) * this.renderScale);
            gl.disable(gl.BLEND);

            for (let i = 0; i < this.ellipses.length; i++) {
                const ellipse = this.ellipses[i];
                const dataIndex = i * 2;
                const phase = (i / this.ellipses.length) * PI2;
                const distanceFromCenter = Math.max(1, Math.sqrt(ellipse.dx * ellipse.dx + ellipse.dy * ellipse.dy));
                const radialX = ellipse.dx / distanceFromCenter;
                const radialY = ellipse.dy / distanceFromCenter;
                const tangentX = -radialY;
                const tangentY = radialX;
                const direction = i % 2 === 0 ? 1 : -1;
                const layerSpeed = (0.58 + i * 0.075) * direction;
                const wobbleSpeed = 0.31 + i * 0.043;
                const loopPhase = flowTime * layerSpeed + phase + pointerX * 0.35 - pointerY * 0.2;
                const wobblePhase = flowTime * wobbleSpeed - phase * 1.35 + pointerY * 0.42;
                const layerBias = 0.66 + 0.24 * Math.sin(phase * 1.9 + flowTime * 0.17);
                const tangentLoop = Math.sin(loopPhase) * loopFlow * layerBias;
                const radialLoop = Math.cos(loopPhase * 0.86 + pointerY * 0.5) * loopFlow * 0.42;
                const crossLoop = Math.sin(wobblePhase + pointerX * 0.7) * loopFlow * 0.19;
                const pointerTangent = paintFlow * (pointerX * 0.28 + pointerY * 0.18) * direction;
                const pointerRadial = paintFlow * (pointerX * radialX + pointerY * radialY) * 0.22;
                const tx = ellipse.dx * disperseFactor * moveAmount +
                    tangentX * (tangentLoop + crossLoop + pointerTangent) +
                    radialX * (radialLoop + pointerRadial) +
                    pointerX * paintFlow * 0.08;
                const ty = ellipse.dy * disperseFactor * moveAmount +
                    tangentY * (tangentLoop + crossLoop + pointerTangent) +
                    radialY * (radialLoop + pointerRadial) +
                    pointerY * paintFlow * 0.08;
                const centerX = ((ellipse.cx + tx - SVG_VIEWBOX.x) * meetScale + xOffset) * this.renderScale;
                const centerY = ((ellipse.cy + ty - SVG_VIEWBOX.y) * meetScale + yOffset) * this.renderScale;
                const radiusPulse = 1 + Math.sin(flowTime * (0.44 + i * 0.045) + phase * 1.7) * 0.032;
                const radiusCounterPulse = 1 + Math.cos(flowTime * (0.37 + i * 0.038) - phase) * 0.024;
                const radiusX = ellipse.rx * meetScale * this.renderScale * this.paintSpread * radiusPulse;
                const radiusY = ellipse.ry * meetScale * this.renderScale * this.paintSpread * radiusCounterPulse;

                this.centerData[dataIndex] = centerX;
                this.centerData[dataIndex + 1] = centerY;
                this.radiusData[dataIndex] = radiusX;
                this.radiusData[dataIndex + 1] = radiusY;
            }

            gl.uniform2fv(this.ellipseUniforms.centers, this.centerData);
            gl.uniform2fv(this.ellipseUniforms.radii, this.radiusData);
            gl.uniform4fv(this.ellipseUniforms.colors, this.colorData);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }

        blurPass(inputTexture, framebuffer, directionX, directionY, blurRadius, unpremultiply) {
            const gl = this.gl;
            const programInfo = this.blurProgram;
            const radius = Math.max(0.1, blurRadius * this.renderScale);

            gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
            gl.viewport(0, 0, this.width, this.height);
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.useProgram(programInfo.program);
            this.bindQuad(programInfo);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, inputTexture);
            gl.uniform1i(programInfo.uniforms.uTexture, 0);
            gl.uniform2f(programInfo.uniforms.uResolution, this.width, this.height);
            gl.uniform2f(programInfo.uniforms.uDirection, directionX, directionY);
            gl.uniform1f(programInfo.uniforms.uRadius, radius);
            gl.uniform1i(programInfo.uniforms.uUnpremultiply, unpremultiply ? 1 : 0);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }

        ellipseVertexSource() {
            return `#version 300 es
in vec2 aPosition;
void main() {
    gl_Position = vec4(aPosition, 0.0, 1.0);
}`;
        }

        ellipseFragmentSource() {
            return `#version 300 es
precision highp float;
const int ELLIPSE_COUNT = ${this.ellipses.length};
uniform vec2 uResolution;
uniform vec2 uCenters[ELLIPSE_COUNT];
uniform vec2 uRadii[ELLIPSE_COUNT];
uniform vec4 uColors[ELLIPSE_COUNT];
uniform float uRotation;
uniform float uFlowTime;
uniform vec2 uPointer;
uniform float uFlowAmount;
out vec4 outColor;
vec2 rotate2d(vec2 v, float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return vec2(c * v.x - s * v.y, s * v.x + c * v.y);
}
vec2 flowField(vec2 p) {
    vec2 center = uResolution * vec2(0.5 + uPointer.x * 0.045, 0.54 + uPointer.y * 0.035);
    vec2 d = p - center;
    float radius = length(d) / max(uResolution.x, uResolution.y);
    float falloff = exp(-radius * radius * 3.15);
    float ring = sin(radius * 17.0 - uFlowTime * 1.15) * 0.55 +
        sin(radius * 9.0 + uFlowTime * 0.73) * 0.45;
    float angle = (ring * 0.21 + sin(uFlowTime * 0.41 + d.x * 0.006 - d.y * 0.005) * 0.085) * falloff;
    vec2 swirled = center + rotate2d(d, angle);
    vec2 wave = vec2(
        sin((swirled.y + uPointer.y * 80.0) * 0.018 + uFlowTime * 1.2),
        cos((swirled.x + uPointer.x * 80.0) * 0.016 - uFlowTime * 0.95)
    );
    return swirled + wave * uFlowAmount * falloff;
}
float paintMask(vec2 p, vec2 center, vec2 radius) {
    vec2 d = p - center;
    float c = cos(-uRotation);
    float s = sin(-uRotation);
    vec2 q = vec2(c * d.x - s * d.y, s * d.x + c * d.y);
    float ellipseDistance = dot(q / radius, q / radius);
    float mask = 1.0 - smoothstep(0.16, 1.22, ellipseDistance);
    return pow(max(mask, 0.0), 0.78);
}
void main() {
    vec2 p = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y);
    vec2 flowedP = flowField(p);
    vec3 colorSum = vec3(0.0);
    vec3 absorbSum = vec3(0.0);
    float totalWeight = 0.0;

    for (int i = 0; i < ELLIPSE_COUNT; i++) {
        float mask = paintMask(flowedP, uCenters[i], uRadii[i]);
        float weight = mask * uColors[i].a * 1.08;
        vec3 paint = clamp(uColors[i].rgb, vec3(0.015), vec3(0.985));
        colorSum += paint * weight;
        absorbSum += -log(paint) * weight;
        totalWeight += weight;
    }

    if (totalWeight <= 0.0001) {
        outColor = vec4(0.0);
        return;
    }

    vec3 lightMix = colorSum / totalWeight;
    vec3 pigmentMix = exp(-absorbSum / totalWeight);
    float overlap = smoothstep(0.45, 1.8, totalWeight);
    vec3 mixed = mix(lightMix, pigmentMix, mix(0.18, 0.38, overlap));
    float luma = dot(mixed, vec3(0.2126, 0.7152, 0.0722));
    mixed = clamp(mix(vec3(luma), mixed, 1.14), vec3(0.0), vec3(1.0));
    mixed = clamp((mixed - 0.5) * 1.02 + 0.5, vec3(0.0), vec3(1.0));
    float coverage = min(0.955, 1.0 - exp(-totalWeight * 1.92));
    outColor = vec4(mixed * coverage * 0.96, coverage);
}`;
        }

        fullscreenVertexSource() {
            return `#version 300 es
in vec2 aPosition;
out vec2 vUv;
void main() {
    vUv = aPosition * 0.5 + 0.5;
    gl_Position = vec4(aPosition, 0.0, 1.0);
}`;
        }

        blurFragmentSource() {
            return `#version 300 es
precision highp float;
uniform sampler2D uTexture;
uniform vec2 uResolution;
uniform vec2 uDirection;
uniform float uRadius;
uniform bool uUnpremultiply;
in vec2 vUv;
out vec4 outColor;
void main() {
    vec4 color = vec4(0.0);
    float total = 0.0;
    float sigma = max(uRadius, 0.001);
    float sampleRadius = sigma * 3.0;
    for (int i = -12; i <= 12; i++) {
        float offsetPx = float(i) * sampleRadius / 12.0;
        float weight = exp(-0.5 * (offsetPx * offsetPx) / (sigma * sigma));
        vec2 offset = uDirection * offsetPx / uResolution;
        color += texture(uTexture, vUv + offset) * weight;
        total += weight;
    }
    color = color / total;
    if (uUnpremultiply && color.a > 0.0001) {
        color.rgb = color.rgb / color.a;
    }
    outColor = color;
}`;
        }
    }

    const getDeviceType = () => {
        const width = window.innerWidth;
        if (width <= BREAKPOINTS.mobile) return "mobile";
        if (width <= BREAKPOINTS.tablet) return "tablet";
        return "desktop";
    };

    const deviceState = {
        type: getDeviceType(),
        get isMobile() { return this.type === "mobile"; },
        get isTablet() { return this.type === "tablet"; },
        get isDesktop() { return this.type === "desktop"; },
        update() {
            const newType = getDeviceType();
            if (newType !== this.type) {
                this.type = newType;
                return true;
            }
            return false;
        }
    };

    const getCurrentConfig = () => RESPONSIVE_CONFIG[deviceState.type];

    function getRestOffset(config = getCurrentConfig()) {
        return config.restOffset || config.maxOffset;
    }

    let currentConfig = getCurrentConfig();
    let targetAngle = 0;
    let currentAngle = (deviceState.isMobile || deviceState.isTablet) ? 220 : 0;
    const initialOffset = getRestOffset(currentConfig);
    let targetX = initialOffset.x;
    let targetY = initialOffset.y;
    let currentX = initialOffset.x;
    let currentY = initialOffset.y;
    let targetPointerX = 0;
    let targetPointerY = 0;
    let currentPointerX = 0;
    let currentPointerY = 0;
    let targetDistance = 0.5;
    let currentDistance = 0.5;
    let flowTime = 0;

    let animationFrameId = null;
    let inputFrameId = null;
    let lastMouseY = 0;
    let isAnimating = false;
    let angleVelocity = 0;
    let windowWidth = window.innerWidth;
    let centerX = windowWidth / 2;
    let frameCounter = 0;
    let lastCSSUpdate = 0;
    let lastAngleValue = null;
    let lastXValue = null;
    let lastYValue = null;
    let lastDistanceValue = null;
    let lastPointerXValue = null;
    let lastPointerYValue = null;
    let lastFlowValue = null;
    let lastFrameTime = performance.now();
    let trackingState = "active";
    let angleOffset = 0;
    let distanceOffset = 0;
    let lastMousePos = { x: 0, y: 0, time: 0 };
    let pendingMouseInput = null;
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    let webglRenderer = null;
    let webglActive = false;

    const ellipseGroups = Array.from(svgElement.querySelectorAll(".ellipse-group"));
    let ellipseData = [];

    function setRendererClass(mode) {
        if (!backgroundRoot) return;
        backgroundRoot.classList.toggle("gradient-renderer-webgl", mode === "webgl");
        backgroundRoot.classList.toggle("gradient-renderer-svg", mode !== "webgl");
    }

    function initWebGLRenderer() {
        if (requestedRenderer !== "webgl" || !canvasElement) {
            setRendererClass("svg");
            return;
        }

        try {
            webglRenderer = new WebGLGradientRenderer(canvasElement, ELLIPSES);
            webglActive = true;
            setRendererClass("webgl");
        } catch (error) {
            webglRenderer = null;
            webglActive = false;
            setRendererClass("svg");
            console.warn("Falling back to SVG gradient renderer.", error);
        }
    }

    function updateResponsiveScale() {
        const config = getCurrentConfig();
        for (const element of visualElements) {
            element.style.setProperty("--responsive-scale", config.scale);
            element.style.setProperty("--responsive-blur", `${config.blur}px`);
        }
    }

    function setVisualProperty(name, value) {
        for (const element of visualElements) {
            element.style.setProperty(name, value);
        }
    }

    function calculateEllipseData() {
        ellipseData = ellipseGroups.map((group, index) => {
            const ellipse = group.querySelector("ellipse");
            const source = ELLIPSES[index] || {};
            const originX = ellipse ? parseFloat(ellipse.getAttribute("cx")) : source.cx || SVG_CENTER.x;
            const originY = ellipse ? parseFloat(ellipse.getAttribute("cy")) : source.cy || SVG_CENTER.y;

            return {
                element: group,
                dx: originX - SVG_CENTER.x,
                dy: originY - SVG_CENTER.y
            };
        });
    }

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    function stopAnimation() {
        isAnimating = false;
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
    }

    function startAnimation() {
        if (isAnimating || document.hidden || reducedMotionQuery.matches) return;
        isAnimating = true;
        lastFrameTime = performance.now();
        animationFrameId = requestAnimationFrame(animate);
    }

    function isWithinAnimationBoundary(scrollY = window.scrollY || window.pageYOffset, mouseY = lastMouseY) {
        const boundaryCheck = deviceState.isMobile ? scrollY : (scrollY + mouseY);
        return boundaryCheck <= CONFIG.animationBoundary;
    }

    function normalizeAngleDelta(fromAngle, toAngle) {
        let delta = toAngle - fromAngle;
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
        return delta;
    }

    const handleResize = debounce(() => {
        const prevType = deviceState.type;

        if (deviceState.update()) {
            currentConfig = getCurrentConfig();
            updateResponsiveScale();
            const restOffset = getRestOffset(currentConfig);
            targetX = restOffset.x;
            targetY = restOffset.y;
            currentX = restOffset.x;
            currentY = restOffset.y;
            targetPointerX = 0;
            targetPointerY = 0;
            currentPointerX = 0;
            currentPointerY = 0;
            flowTime = 0;
            updateCSS(true);

            const hadDesktopListeners = prevType !== "mobile";
            const needsDesktopListeners = !deviceState.isMobile;

            if (hadDesktopListeners && !needsDesktopListeners) {
                detachDesktopListeners();
            } else if (!hadDesktopListeners && needsDesktopListeners) {
                attachDesktopListeners();
            }

            stopAnimation();
            checkAndToggle();
        }

        windowWidth = window.innerWidth;
        centerX = windowWidth / 2;
    }, 250);

    function handleMouseMove(event) {
        const currentMouseX = event.clientX;
        const currentMouseY = event.clientY;
        const rect = backgroundRoot ? backgroundRoot.getBoundingClientRect() : null;
        const interactionRect = rect && rect.width > 0 && rect.height > 0
            ? rect
            : { left: 0, top: 0, width: window.innerWidth, height: CONFIG.animationBoundary };

        const now = performance.now();
        lastMousePos.x = currentMouseX;
        lastMousePos.y = currentMouseY;
        lastMousePos.time = now;

        const rawX = (currentMouseX - (interactionRect.left + interactionRect.width * 0.5)) / (interactionRect.width * 0.5);
        const rawY = (currentMouseY - (interactionRect.top + interactionRect.height * 0.48)) / (interactionRect.height * 0.5);
        const pointerX = softClamp(clamp(rawX, -1.5, 1.5));
        const pointerY = softClamp(clamp(rawY, -1.5, 1.5));
        const pointerStrength = clamp(Math.sqrt(pointerX * pointerX + pointerY * pointerY), 0, 1);
        const easedStrength = pointerStrength * pointerStrength * (3 - 2 * pointerStrength);
        const restOffset = getRestOffset(currentConfig);
        const parallax = currentConfig.parallax || { x: currentConfig.radiusX, y: currentConfig.radiusY };
        const angleRange = currentConfig.angleRange || 24;
        const angleTilt = currentConfig.angleTilt || 8;
        const distanceRange = currentConfig.distanceRange || 0.18;

        targetAngle = pointerX * angleRange + pointerY * angleTilt;
        targetDistance = 0.5 + easedStrength * distanceRange;
        targetX = restOffset.x + pointerX * parallax.x;
        targetY = restOffset.y + pointerY * parallax.y;
        targetPointerX = pointerX;
        targetPointerY = pointerY;
    }

    function updateCSS(forceUpdate = false) {
        const now = performance.now();
        if (!forceUpdate && now - lastCSSUpdate < CONFIG.cssUpdateDelay) {
            return;
        }

        const angleChanged = lastAngleValue === null || Math.abs(currentAngle - lastAngleValue) > CONFIG.updateThreshold;
        const xChanged = lastXValue === null || Math.abs(currentX - lastXValue) > CONFIG.updateThreshold;
        const yChanged = lastYValue === null || Math.abs(currentY - lastYValue) > CONFIG.updateThreshold;
        const distanceChanged = lastDistanceValue === null || Math.abs(currentDistance - lastDistanceValue) > CONFIG.updateThreshold;
        const pointerChanged = webglActive && (
            lastPointerXValue === null ||
            lastPointerYValue === null ||
            Math.abs(currentPointerX - lastPointerXValue) > CONFIG.updateThreshold ||
            Math.abs(currentPointerY - lastPointerYValue) > CONFIG.updateThreshold
        );
        const flowChanged = webglActive && (
            lastFlowValue === null ||
            Math.abs(flowTime - lastFlowValue) > CONFIG.updateThreshold
        );

        if (angleChanged || xChanged || yChanged || distanceChanged || pointerChanged || flowChanged || forceUpdate) {
            if (angleChanged || forceUpdate) {
                setVisualProperty("--mouse-angle", `${currentAngle}deg`);
                lastAngleValue = currentAngle;
            }
            if (xChanged || forceUpdate) {
                setVisualProperty("--x-offset", `${currentX}vw`);
                lastXValue = currentX;
            }
            if (yChanged || forceUpdate) {
                setVisualProperty("--y-offset", `${currentY}vw`);
                lastYValue = currentY;
            }
            if (distanceChanged || angleChanged || pointerChanged || flowChanged || forceUpdate) {
                updateGradientRenderer();
                lastPointerXValue = currentPointerX;
                lastPointerYValue = currentPointerY;
                lastFlowValue = flowTime;
            }
            lastCSSUpdate = now;
        }
    }

    function updateGradientRenderer() {
        if (webglActive && webglRenderer) {
            webglRenderer.render({
                angle: currentAngle,
                distance: currentDistance,
                pointerX: currentPointerX,
                pointerY: currentPointerY,
                flowTime,
                config: currentConfig
            });
            lastDistanceValue = currentDistance;
            return;
        }

        updateEllipseTransforms();
    }

    function updateEllipseTransforms() {
        const disperseFactor = (currentDistance - 0.5) * 2;
        const moveAmount = 1 / currentConfig.scale;
        const baseRotation = -currentAngle;

        for (let i = 0; i < ellipseData.length; i++) {
            const data = ellipseData[i];
            const tX = data.dx * disperseFactor * moveAmount;
            const tY = data.dy * disperseFactor * moveAmount;

            if (data.lastTX !== undefined &&
                Math.abs(tX - data.lastTX) < 0.05 &&
                Math.abs(tY - data.lastTY) < 0.05 &&
                Math.abs(baseRotation - data.lastRot) < 0.05) {
                continue;
            }

            data.lastTX = tX;
            data.lastTY = tY;
            data.lastRot = baseRotation;
            data.element.style.transform = `translate3d(${tX}px,${tY}px,0) rotate(${baseRotation}deg)`;
        }

        lastDistanceValue = currentDistance;
    }

    function calcOrbit(angle) {
        const angleInRadians = angle * DEG_TO_RAD;
        const normalizedAngle = ((angle % 360) + 360) % 360;
        const progress = normalizedAngle <= 180 ? normalizedAngle / 180 : (360 - normalizedAngle) / 180;
        const smoothProgress = (1 - Math.cos(progress * Math.PI)) / 2;
        return {
            angleInRadians,
            smoothProgress,
            radiusX: currentConfig.radiusX * (1 + smoothProgress * 0.15),
            radiusY: currentConfig.radiusY * (1 + smoothProgress * 0.2)
        };
    }

    function hasDesktopAnimationSettled(targetPositionX, targetPositionY) {
        const angleDelta = Math.abs(normalizeAngleDelta(currentAngle, targetAngle));
        const distanceDelta = Math.abs(targetDistance - currentDistance);
        const positionDeltaX = Math.abs(targetPositionX - currentX);
        const positionDeltaY = Math.abs(targetPositionY - currentY);
        const pointerDeltaX = Math.abs(targetPointerX - currentPointerX);
        const pointerDeltaY = Math.abs(targetPointerY - currentPointerY);

        return angleDelta < 0.05 &&
            distanceDelta < 0.001 &&
            Math.abs(angleVelocity) < 0.01 &&
            positionDeltaX < 0.01 &&
            positionDeltaY < 0.01 &&
            pointerDeltaX < 0.001 &&
            pointerDeltaY < 0.001 &&
            !pendingMouseInput;
    }

    function advanceFlowTime(deltaSeconds) {
        if (!webglActive) return;

        const pointerStrength = clamp(Math.sqrt(currentPointerX * currentPointerX + currentPointerY * currentPointerY), 0, 1);
        const baseSpeed = currentConfig.loopSpeed || 0.65;
        const pointerBoost = currentConfig.pointerLoopBoost || 0.35;
        const organicDrift = 0.08 * Math.sin(flowTime * 0.71 + currentPointerX * 1.1 - currentPointerY * 0.6);

        flowTime += deltaSeconds * (baseSpeed + pointerStrength * pointerBoost + organicDrift);
        if (flowTime > PI2 * 1000) {
            flowTime -= PI2 * 1000;
        }
    }

    function animate() {
        if (!isAnimating) return;

        const now = performance.now();
        const deltaSeconds = Math.min(0.05, Math.max(0.001, (now - lastFrameTime) / 1000));
        lastFrameTime = now;
        advanceFlowTime(deltaSeconds);

        const frameSkip = deviceState.isMobile ? CONFIG.mobileFrameSkip : CONFIG.tabletFrameSkip;
        if ((deviceState.isMobile || deviceState.isTablet) && ++frameCounter % frameSkip !== 0) {
            animationFrameId = requestAnimationFrame(animate);
            return;
        }

        if (deviceState.isMobile || deviceState.isTablet) {
            currentAngle += currentConfig.rotationSpeed;
            const { angleInRadians, smoothProgress, radiusX, radiusY } = calcOrbit(currentAngle);
            const normalizedAngle = ((currentAngle % 360) + 360) % 360;

            currentX = Math.cos(angleInRadians) * radiusX * currentConfig.offsetMultiplier;
            currentY = currentConfig.maxOffset.y + Math.sin(angleInRadians) * radiusY * currentConfig.offsetMultiplier - smoothProgress * 10 * currentConfig.offsetMultiplier;
            currentDistance = 0.5 + 0.5 * Math.sin((normalizedAngle / 360) * PI2);
        } else {
            currentDistance += (targetDistance - currentDistance) * CONFIG.distanceEasing;
            const distance = Math.abs(normalizeAngleDelta(currentAngle, targetAngle));
            const adaptiveFactor = currentConfig.angleEasing || (distance > 20 ? 0.08 : CONFIG.smoothingFactor);
            const deltaAngle = normalizeAngleDelta(currentAngle, targetAngle);

            angleVelocity = (angleVelocity + deltaAngle * 0.01) * CONFIG.damping;
            let step = deltaAngle * adaptiveFactor + angleVelocity;
            step = Math.max(-CONFIG.maxSpeedPerFrame, Math.min(step, CONFIG.maxSpeedPerFrame));
            currentAngle += step;

            const positionEasing = currentConfig.positionEasing || 0.10;
            currentX += (targetX - currentX) * positionEasing;
            currentY += (targetY - currentY) * positionEasing;
            currentPointerX += (targetPointerX - currentPointerX) * Math.min(0.24, positionEasing * 1.45);
            currentPointerY += (targetPointerY - currentPointerY) * Math.min(0.24, positionEasing * 1.45);

            if (!webglActive && hasDesktopAnimationSettled(targetX, targetY)) {
                updateCSS();
                stopAnimation();
                return;
            }
        }

        updateCSS();
        animationFrameId = requestAnimationFrame(animate);
    }

    function checkAndToggle() {
        const shouldAnimate = isWithinAnimationBoundary();

        if (document.hidden || reducedMotionQuery.matches) {
            stopAnimation();
            return;
        }

        if (!shouldAnimate && isAnimating) {
            stopAnimation();
        } else if (shouldAnimate && (webglActive || deviceState.isMobile || deviceState.isTablet) && !isAnimating) {
            startAnimation();
        }
    }

    function flushPendingMouseInput() {
        inputFrameId = null;

        if (!pendingMouseInput || document.hidden || reducedMotionQuery.matches) return;
        if (!isWithinAnimationBoundary()) {
            pendingMouseInput = null;
            return;
        }

        handleMouseMove(pendingMouseInput);
        pendingMouseInput = null;
        startAnimation();
    }

    function scheduleMouseInput(event) {
        pendingMouseInput = {
            clientX: event.clientX,
            clientY: event.clientY
        };

        if (inputFrameId !== null) return;
        inputFrameId = requestAnimationFrame(flushPendingMouseInput);
    }

    const passiveSupported = (() => {
        let supported = false;
        try {
            const options = { get passive() { supported = true; return false; } };
            window.addEventListener("test", null, options);
            window.removeEventListener("test", null, options);
        } catch (err) { }
        return supported;
    })();

    const passiveOptions = passiveSupported ? { passive: true } : false;

    function onMouseMove(event) {
        lastMouseY = event.clientY;
        const scrollY = window.scrollY || window.pageYOffset;
        if (scrollY + event.clientY <= CONFIG.animationBoundary) {
            scheduleMouseInput(event);
        } else {
            pendingMouseInput = null;
        }
        checkAndToggle();
    }

    function attachDesktopListeners() {
        document.addEventListener("mousemove", onMouseMove, passiveOptions);
        window.addEventListener("scroll", checkAndToggle, passiveOptions);
    }

    function detachDesktopListeners() {
        document.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("scroll", checkAndToggle);
        pendingMouseInput = null;
        if (inputFrameId) {
            cancelAnimationFrame(inputFrameId);
            inputFrameId = null;
        }
    }

    initWebGLRenderer();
    calculateEllipseData();
    updateResponsiveScale();
    setVisualProperty("--mouse-angle", `${currentAngle}deg`);
    setVisualProperty("--x-offset", `${currentX}vw`);
    setVisualProperty("--y-offset", `${currentY}vw`);
    updateCSS(true);

    if (!deviceState.isMobile) {
        attachDesktopListeners();
    }

    window.addEventListener("resize", handleResize);

    if ("IntersectionObserver" in window) {
        const observedElement = webglActive && canvasElement ? canvasElement : svgElement;
        new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) checkAndToggle();
            else stopAnimation();
        }, { threshold: 0 }).observe(observedElement);
    }

    window.addEventListener("orientationchange", () => {
        setTimeout(handleResize, 300);
    });

    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            stopAnimation();
            if (inputFrameId) {
                cancelAnimationFrame(inputFrameId);
                inputFrameId = null;
            }
            return;
        }

        checkAndToggle();
    });

    if (typeof reducedMotionQuery.addEventListener === "function") {
        reducedMotionQuery.addEventListener("change", () => {
            checkAndToggle();
        });
    } else if (typeof reducedMotionQuery.addListener === "function") {
        reducedMotionQuery.addListener(() => {
            checkAndToggle();
        });
    }

    window.addEventListener("beforeunload", () => {
        stopAnimation();
        if (inputFrameId) cancelAnimationFrame(inputFrameId);
    });

    checkAndToggle();
});
