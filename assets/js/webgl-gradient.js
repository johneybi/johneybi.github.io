(function () {
    console.log("WebGL Gradient Script Loaded (Physics Version)");

    // ==============================================
    // CONFIGURATION (Ported from inter-gradient.js)
    // ==============================================
    const CONFIG = {
        // Physics & Interaction
        smoothingFactor: 0.1,
        responsiveness: 0.3,
        maxOffset: { x: 10, y: 15 }, // Percentage of screen
        rotationSpeed: 0.5, // Degrees per frame (desktop)
        mobileRotationSpeed: 0.3,
        
        // Blob Configuration (Original SVG colors and relative positions)
        blobs: [
            { color: [18/255, 113/255, 255/255], radius: 0.4,  angle: 0,   dist: 0.2, speed: 1.0 }, // Blue
            { color: [221/255, 74/255, 255/255], radius: 0.35, angle: 120, dist: 0.3, speed: 0.8 }, // Purple
            { color: [100/255, 220/255, 255/255], radius: 0.3,  angle: 240, dist: 0.25, speed: 1.2 }, // Cyan
            { color: [200/255, 50/255, 50/255],  radius: 0.25, angle: 60,  dist: 0.15, speed: 0.9 }, // Reddish (Accent)
            { color: [50/255, 200/255, 100/255], radius: 0.3,  angle: 180, dist: 0.35, speed: 1.1 }, // Greenish
            { color: [255/255, 200/255, 50/255], radius: 0.2,  angle: 300, dist: 0.2, speed: 1.0 }  // Yellowish
        ],
        
        // Metaball
        metaballThreshold: 0.5,
        blur: 0.2
    };

    let state = {
        mouseX: 0,
        mouseY: 0,
        targetMouseX: 0,
        targetMouseY: 0,
        width: window.innerWidth,
        height: window.innerHeight,
        deviceType: 'desktop', // 'mobile', 'tablet', 'desktop'
        time: 0
    };

    function init() {
        const canvas = document.getElementById('gradient-canvas');
        if (!canvas) {
            console.error("WebGL Gradient: Canvas element not found!");
            return;
        }

        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!gl) {
            console.error('WebGL Gradient: WebGL not supported');
            return;
        }

        // ==============================================
        // SHADERS
        // ==============================================
        const vsSource = `
            attribute vec4 aVertexPosition;
            void main() {
                gl_Position = aVertexPosition;
            }
        `;

        const fsSource = `
            precision mediump float;
            
            uniform vec2 u_resolution;
            uniform float u_time;
            
            // Blob data: x, y, radius
            uniform vec3 u_blobs[6]; 
            uniform vec3 u_colors[6];
            
            // Random noise for dithering
            float random(vec2 st) {
                return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
            }

            void main() {
                vec2 st = gl_FragCoord.xy / u_resolution.xy;
                st.y = 1.0 - st.y; // Flip Y to match screen coords
                
                // Aspect ratio correction
                float aspect = u_resolution.x / u_resolution.y;
                st.x *= aspect;

                vec3 color = vec3(0.0);
                float totalInfluence = 0.0;

                for (int i = 0; i < 6; i++) {
                    vec2 blobPos = u_blobs[i].xy;
                    blobPos.x *= aspect; // Correct blob pos for aspect ratio
                    
                    float radius = u_blobs[i].z;
                    float dist = distance(st, blobPos);
                    
                    // Metaball function (Inverse Square Law or Gaussian)
                    // Using Gaussian-like falloff for smoother blending
                    float influence = exp(-pow(dist / radius, 2.0) * 4.0);
                    
                    color += u_colors[i] * influence;
                    totalInfluence += influence;
                }

                // Normalize color based on total influence
                if (totalInfluence > 0.1) {
                    color /= totalInfluence;
                    // Add a base background color to fill gaps
                    color = mix(vec3(0.05, 0.05, 0.05), color, smoothstep(0.0, 1.0, totalInfluence));
                } else {
                    color = vec3(0.05, 0.05, 0.05); // Dark background
                }

                // Dithering
                float noise = random(gl_FragCoord.xy) * 0.05;
                color += noise;

                gl_FragColor = vec4(color, 1.0);
            }
        `;

        // ==============================================
        // WEBGL SETUP
        // ==============================================
        function createShader(gl, type, source) {
            const shader = gl.createShader(type);
            gl.shaderSource(shader, source);
            gl.compileShader(shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                console.error('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
                gl.deleteShader(shader);
                return null;
            }
            return shader;
        }

        const vertexShader = createShader(gl, gl.VERTEX_SHADER, vsSource);
        const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
        const shaderProgram = gl.createProgram();
        gl.attachShader(shaderProgram, vertexShader);
        gl.attachShader(shaderProgram, fragmentShader);
        gl.linkProgram(shaderProgram);

        if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
            console.error('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
            return;
        }

        // ==============================================
        // BUFFERS & ATTRIBUTES
        // ==============================================
        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        const positions = [
            -1.0,  1.0,
             1.0,  1.0,
            -1.0, -1.0,
             1.0, -1.0,
        ];
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

        const vertexPosition = gl.getAttribLocation(shaderProgram, 'aVertexPosition');
        gl.enableVertexAttribArray(vertexPosition);
        gl.vertexAttribPointer(vertexPosition, 2, gl.FLOAT, false, 0, 0);

        gl.useProgram(shaderProgram);

        // ==============================================
        // UNIFORMS
        // ==============================================
        const uResolution = gl.getUniformLocation(shaderProgram, 'u_resolution');
        const uTime = gl.getUniformLocation(shaderProgram, 'u_time');
        
        // Blob Uniform Locations
        const blobLocations = [];
        const colorLocations = [];
        for(let i=0; i<6; i++) {
            blobLocations.push(gl.getUniformLocation(shaderProgram, `u_blobs[${i}]`));
            colorLocations.push(gl.getUniformLocation(shaderProgram, `u_colors[${i}]`));
            // Set static colors once
            gl.uniform3fv(colorLocations[i], CONFIG.blobs[i].color);
        }

        // ==============================================
        // RESIZE HANDLER
        // ==============================================
        function resize() {
            state.width = window.innerWidth;
            state.height = window.innerHeight;
            canvas.width = state.width;
            canvas.height = state.height;
            gl.viewport(0, 0, canvas.width, canvas.height);
            
            state.deviceType = state.width <= 768 ? 'mobile' : (state.width <= 1024 ? 'tablet' : 'desktop');
        }
        window.addEventListener('resize', resize);
        resize();

        // ==============================================
        // MOUSE HANDLER
        // ==============================================
        window.addEventListener('mousemove', (e) => {
            // Normalize mouse position (-1 to 1)
            state.targetMouseX = (e.clientX / state.width) * 2 - 1;
            state.targetMouseY = (e.clientY / state.height) * 2 - 1;
        });

        // ==============================================
        // ANIMATION LOOP
        // ==============================================
        function render(now) {
            now *= 0.001; // Convert to seconds
            state.time = now;

            // Smooth mouse movement
            state.mouseX += (state.targetMouseX - state.mouseX) * CONFIG.responsiveness;
            state.mouseY += (state.targetMouseY - state.mouseY) * CONFIG.responsiveness;

            // Update Uniforms
            gl.uniform2f(uResolution, state.width, state.height);
            gl.uniform1f(uTime, now);

            // Physics Simulation
            CONFIG.blobs.forEach((blob, i) => {
                // 1. Base Orbiting
                // Calculate current angle based on time and speed
                let currentAngle = blob.angle + (now * 20.0 * blob.speed); 
                
                // 2. Counter-Rotation (Simulated by modifying angle based on index)
                if (i % 2 === 0) {
                    currentAngle = -currentAngle; // Some blobs rotate opposite way
                }

                let rad = currentAngle * Math.PI / 180;
                
                // 3. Calculate Position
                // Center is (0.5, 0.5) in normalized coords
                let x = 0.5 + Math.cos(rad) * blob.dist;
                let y = 0.5 + Math.sin(rad) * blob.dist;

                // 4. Mouse Parallax
                // Move blobs away from mouse or towards, depending on depth (simulated by index)
                let depth = 0.5 + (i * 0.1); // Fake depth
                x += state.mouseX * 0.1 * depth;
                y += state.mouseY * 0.1 * depth;

                // Pass to shader: x, y, radius
                gl.uniform3f(blobLocations[i], x, y, blob.radius);
            });

            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            requestAnimationFrame(render);
        }

        requestAnimationFrame(render);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
