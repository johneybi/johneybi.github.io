document.addEventListener('DOMContentLoaded', function () {
    // ==============================================
    // DOM & ENVIRONMENT
    // ==============================================

    const animatedElement = document.querySelector('.interactive-svg-background');
    if (!animatedElement) return;

    // Cache ellipse elements and their static data
    let ellipseData = [];
    const ellipseGroups = Array.from(animatedElement.querySelectorAll('.ellipse-group'));

    // 반응형 breakpoint 정의
    const BREAKPOINTS = {
        mobile: 768,
        tablet: 1024,
        desktop: 1440
    };

    // 디바이스 타입 감지
    const getDeviceType = () => {
        const width = window.innerWidth;
        if (width <= BREAKPOINTS.mobile) return 'mobile';
        if (width <= BREAKPOINTS.tablet) return 'tablet';
        return 'desktop';
    };

    // 디바이스 상태 관리 객체
    const deviceState = {
        type: getDeviceType(),
        get isMobile() { return this.type === 'mobile'; },
        get isTablet() { return this.type === 'tablet'; },
        get isDesktop() { return this.type === 'desktop'; },

        update() {
            const newType = getDeviceType();
            if (newType !== this.type) {
                this.type = newType;
                return true;
            }
            return false;
        }
    };

    // ==============================================
    // RESPONSIVE CONFIGURATION
    // ==============================================
    // [속도 조절 가이드]
    // 아래의 rotationSpeed 값을 조절하여 디바이스별 회전 속도를 변경할 수 있습니다.
    // - 값이 클수록 더 빠르게 회전합니다.
    // - 예: 0.15 -> 0.3 (2배 빨라짐)

    const RESPONSIVE_CONFIG = {
        mobile: {
            scale: 3.5,
            blur: 20,
            offsetMultiplier: 0.6,
            rotationSpeed: 0.3, // [모바일] 자동 회전 속도 (기본값: 0.3)
            maxOffset: { x: 8, y: 12 },
            radiusX: 6,
            radiusY: 10
        },
        tablet: {
            scale: 4.5,
            blur: 24,
            offsetMultiplier: 0.8,
            rotationSpeed: 0.4, // [태블릿] 자동 회전 속도 (기본값: 0.12)
            maxOffset: { x: 9, y: 13 },
            radiusX: 8,
            radiusY: 12
        },
        desktop: {
            scale: 5.8,
            blur: 28,
            offsetMultiplier: 1,
            rotationSpeed: 0.5, // [데스크톱] 마우스 반응 회전 민감도 (기본값: 0.15)
            maxOffset: { x: 10, y: 15 },
            radiusX: 10,
            radiusY: 14
        }
    };

    // 현재 디바이스 설정 가져오기
    const getCurrentConfig = () => RESPONSIVE_CONFIG[deviceState.type];

    // ==============================================
    // STATE MANAGEMENT
    // ==============================================

    let currentConfig = getCurrentConfig();
    let targetAngle = 0;
    let currentAngle = 0;
    let targetX = currentConfig.maxOffset.x;
    let currentX = currentConfig.maxOffset.x;
    let targetY = currentConfig.maxOffset.y;
    let currentY = currentConfig.maxOffset.y;
    let velocityX = 0, velocityY = 0;
    let targetDistance = 0.5;
    let currentDistance = 0.5;
    let scaleFactor = 1;

    // 반응형 스케일 적용 함수
    const updateResponsiveScale = () => {
        const config = getCurrentConfig();
        animatedElement.style.setProperty('--responsive-scale', config.scale);
        animatedElement.style.setProperty('--responsive-blur', `${config.blur}px`);
    };

    // 초기값 적용
    updateResponsiveScale();
    animatedElement.style.setProperty('--mouse-angle', `${currentAngle}deg`);
    animatedElement.style.setProperty('--x-offset', `${currentX}vw`);
    animatedElement.style.setProperty('--y-offset', `${currentY}vw`);
    animatedElement.style.setProperty('--ellipse-scale', '1');


    // ==============================================
    // OPTIMIZATION CONSTANTS
    // ==============================================
    const DEG_TO_RAD = Math.PI / 180;
    const RAD_TO_DEG = 180 / Math.PI;
    const PI2 = Math.PI * 2;

    // ==============================================
    // CONFIGURATION
    // ==============================================
    // [고급 설정 가이드]
    // 애니메이션의 물리적인 느낌을 미세 조정할 수 있습니다.

    const CONFIG = {
        // 1. 움직임 부드러움 설정
        smoothingFactor: 0.1,      // [중요] 마우스 따라오는 지연 시간 (낮을수록 더 부드럽고 느리게 따라옴, 0.01 ~ 0.1 추천)
        maxSpeedPerFrame: 3,      // 한 프레임당 최대 회전 각도 제한 (너무 빠르면 어지러울 수 있음)

        // 2. 물리 엔진 설정
        springStrength: 0.015,      // 탄성 강도
        damping: 0.75,              // 감속 계수 (관성) - 1.0에 가까울수록 미끄러지듯 오래 움직임
        velocityDecay: 0.95,        // 속도 감쇠

        // 3. 반응성 설정
        responsiveness: 0.3,       // [중요] 즉각적인 반응성 (높을수록 마우스 움직임에 즉시 반응)
        predictiveFactor: 0.1,      // 마우스 경로 예측 (빠른 움직임 보정)
        fastMovementThreshold: 2.5, // [NEW] 빠른 움직임 감지 임계값 (px/ms) - 이 속도 이상이면 추적 일시 중지

        // 4. 기타 설정
        historySize: 8,
        historyCutoff: 50,
        animationBoundary: 880,
        centerY: 440,
        updateThreshold: 0.01,
        mobileFrameSkip: 2,
        cssUpdateDelay: 16,

        rotationScale: 1.0,
        maxRotation: null,
        enableRotationLimit: false,

        maxDistance: 400,
        scaleRange: 1,
        distanceEasing: 0.12,

        counterRotation: {
            enabled: null,
            ellipses: [1, 3],
            mode: 'orbit',
            speed: 1.0,
            svgCenter: { x: 1237, y: 870.5 }
        }
    };

    // ==============================================
    // STATE VARIABLES
    // ==============================================

    let animationFrameId = null;
    let inputFrameId = null;
    let lastMouseY = 0;
    let isAnimating = false;

    // Optimized Circular Buffer for Angle History
    const angleHistory = new Float32Array(CONFIG.historySize);
    let historyIndex = 0;
    let historyCount = 0;

    let lastTargetAngle = 0;
    let angleVelocity = 0;

    let windowWidth = window.innerWidth;
    let centerX = windowWidth / 2;

    let frameCounter = 0;
    let lastCSSUpdate = 0;

    let lastAngleValue = null;
    let lastXValue = null;
    let lastYValue = null;
    let lastScaleValue = null;

    // [NEW] Relative Tracking State
    let trackingState = 'active'; // 'active' | 'paused'
    let angleOffset = 0;
    let distanceOffset = 0;
    let lastMousePos = { x: 0, y: 0, time: 0 };
    let pendingMouseInput = null;
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    // ==============================================
    // UTILITY FUNCTIONS
    // ==============================================

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

    // Pre-calculate ellipse data
    const calculateEllipseData = () => {
        const svgCenterX = CONFIG.counterRotation.svgCenter.x;
        const svgCenterY = CONFIG.counterRotation.svgCenter.y;

        ellipseData = ellipseGroups.map((group, index) => {
            const style = window.getComputedStyle(group);
            const origin = style.transformOrigin.split(' ');
            const originX = parseFloat(origin[0]);
            const originY = parseFloat(origin[1]);

            const dx = originX - svgCenterX;
            const dy = originY - svgCenterY;
            const distFromCenter = Math.sqrt(dx * dx + dy * dy);
            const angleFromCenter = Math.atan2(dy, dx); // Radians

            return {
                element: group,
                index,
                dx,
                dy,
                distFromCenter,
                angleFromCenter,
                isCounterRotating: CONFIG.counterRotation.ellipses.includes(index)
            };
        });
    };

    // Initialize ellipse data
    calculateEllipseData();

    // 기존 handleResize를 수정하여 반응형 기능 포함
    const handleResize = debounce(() => {
        // 디바이스 타입 체크 및 업데이트
        if (deviceState.update()) {
            currentConfig = getCurrentConfig();

            // 스케일 업데이트
            updateResponsiveScale();

            // 오프셋 범위 업데이트
            targetX = currentX = currentConfig.maxOffset.x;
            targetY = currentY = currentConfig.maxOffset.y;

            console.log(`📱 Device type changed to: ${deviceState.type}`);
        }

        // 기존 resize 로직
        windowWidth = window.innerWidth;
        centerX = windowWidth / 2;

        // Re-calculate ellipse data in case layout changes affect transform-origin
        calculateEllipseData();
    }, 250);

    // ==============================================
    // MOUSE MOVE HANDLER
    // ==============================================

    function handleMouseMove(event) {
        const now = performance.now();
        const currentMouseX = event.clientX;
        const currentMouseY = event.clientY;

        // 1. Calculate Mouse Velocity
        let velocity = 0;
        if (lastMousePos.time > 0) {
            const dx = currentMouseX - lastMousePos.x;
            const dy = currentMouseY - lastMousePos.y;
            const dt = now - lastMousePos.time;
            if (dt > 0) {
                velocity = Math.sqrt(dx * dx + dy * dy) / dt; // px/ms
            }
        }

        lastMousePos.x = currentMouseX;
        lastMousePos.y = currentMouseY;
        lastMousePos.time = now;

        // 2. Calculate Raw Target Values (Absolute)
        const deltaX = currentMouseX - centerX;
        const deltaY = currentMouseY - CONFIG.centerY;

        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const rawTargetDistance = Math.min(distance / CONFIG.maxDistance, 1);

        const angleInRadians = Math.atan2(deltaY, deltaX);
        const angleInDegrees = angleInRadians * RAD_TO_DEG;
        let rawTargetAngle = (angleInDegrees + 90 + 360) % 360;

        // Apply Rotation Limits if enabled
        if (CONFIG.enableRotationLimit) {
            if (rawTargetAngle > 180) rawTargetAngle -= 360;
            rawTargetAngle *= CONFIG.rotationScale;
            if (CONFIG.maxRotation !== null) {
                rawTargetAngle = Math.max(-CONFIG.maxRotation, Math.min(CONFIG.maxRotation, rawTargetAngle));
            }
            rawTargetAngle = (rawTargetAngle + 360) % 360;
        }

        // 3. Handle Fast Movement (Pause & Resume Logic)
        if (velocity > CONFIG.fastMovementThreshold) {
            // Too fast! Pause tracking.
            if (trackingState === 'active') {
                console.log('🚀 Fast movement detected! Pausing tracking.');
                trackingState = 'paused';
            }
            // While paused, we DO NOT update targetAngle/targetDistance.
            // The animation will continue to its *last known* target, effectively "ignoring" the fast whip.
            return; 
        } else {
            // Speed is normal.
            if (trackingState === 'paused') {
                // Resume! Calculate offsets to maintain relative position.
                console.log('✨ Movement slowed. Resuming tracking with relative offset.');
                
                // Calculate the difference between where we ARE (or were going) and where the mouse IS.
                // We want: newTarget = rawTarget + offset
                // So: offset = currentTarget - rawTarget
                
                // For Angle: Handle wrap-around carefully
                let angleDiff = normalizeAngleDelta(rawTargetAngle, targetAngle);
                
                angleOffset = angleDiff;
                distanceOffset = targetDistance - rawTargetDistance;
                
                trackingState = 'active';
            }
        }

        // 4. Apply Offsets (Relative Tracking)
        if (trackingState === 'active') {
            let newTargetAngle = rawTargetAngle + angleOffset;
            let newTargetDistance = rawTargetDistance + distanceOffset;

            // Normalize Angle
            newTargetAngle = (newTargetAngle + 360) % 360;
            
            // Clamp Distance
            newTargetDistance = Math.max(0, Math.min(1, newTargetDistance));

            targetAngle = newTargetAngle;
            targetDistance = newTargetDistance;
        }
    }

    // ==============================================
    // CSS UPDATE
    // ==============================================

    function updateCSS(forceUpdate = false) {
        const now = performance.now();

        if (!forceUpdate && now - lastCSSUpdate < CONFIG.cssUpdateDelay) {
            return;
        }

        const angleChanged = lastAngleValue === null || Math.abs(currentAngle - lastAngleValue) > CONFIG.updateThreshold;
        const xChanged = lastXValue === null || Math.abs(currentX - lastXValue) > CONFIG.updateThreshold;
        const yChanged = lastYValue === null || Math.abs(currentY - lastYValue) > CONFIG.updateThreshold;
        const scaleChanged = lastScaleValue === null || Math.abs(scaleFactor - lastScaleValue) > CONFIG.updateThreshold;

        if (angleChanged || xChanged || yChanged || scaleChanged || forceUpdate) {
            if (angleChanged) {
                animatedElement.style.setProperty('--mouse-angle', `${currentAngle}deg`);
                lastAngleValue = currentAngle;
            }
            if (xChanged) {
                animatedElement.style.setProperty('--x-offset', `${currentX}vw`);
                lastXValue = currentX;
            }
            if (yChanged) {
                animatedElement.style.setProperty('--y-offset', `${currentY}vw`);
                lastYValue = currentY;
            }
            if (scaleChanged || angleChanged) {
                updateEllipseTransforms();
            }
            lastCSSUpdate = now;
        }
    }

    function updateEllipseTransforms() {
        const disperseFactor = (currentDistance - 0.5) * 2;
        const scaleDivisor = currentConfig.scale;
        const moveAmount = CONFIG.scaleRange / scaleDivisor;
        const baseRotation = -currentAngle;

        // Pre-calculate common values
        const counterRotationAngle = -currentAngle * 2 * CONFIG.counterRotation.speed * DEG_TO_RAD;

        // Use cached data
        for (let i = 0; i < ellipseData.length; i++) {
            const data = ellipseData[i];

            const translateX = data.dx * disperseFactor * moveAmount;
            const translateY = data.dy * disperseFactor * moveAmount;

            if (CONFIG.counterRotation.enabled &&
                CONFIG.counterRotation.mode === 'orbit' &&
                data.isCounterRotating) {

                const newAngle = data.angleFromCenter + counterRotationAngle;

                const newX = Math.cos(newAngle) * data.distFromCenter;
                const newY = Math.sin(newAngle) * data.distFromCenter;

                const orbitTranslateX = (newX - data.dx) + translateX;
                const orbitTranslateY = (newY - data.dy) + translateY;

                // GPU Acceleration: translate3d
                data.element.style.transform = `translate3d(${orbitTranslateX}px, ${orbitTranslateY}px, 0) rotate(${baseRotation}deg)`;
            } else {
                // GPU Acceleration: translate3d
                data.element.style.transform = `translate3d(${translateX}px, ${translateY}px, 0) rotate(${baseRotation}deg)`;
            }
        }

        lastScaleValue = scaleFactor;
    }

    function hasDesktopAnimationSettled(targetPositionX, targetPositionY) {
        const angleDelta = Math.abs(normalizeAngleDelta(currentAngle, targetAngle));
        const distanceDelta = Math.abs(targetDistance - currentDistance);
        const positionDeltaX = Math.abs(targetPositionX - currentX);
        const positionDeltaY = Math.abs(targetPositionY - currentY);

        return angleDelta < 0.05 &&
            distanceDelta < 0.001 &&
            Math.abs(angleVelocity) < 0.01 &&
            positionDeltaX < 0.01 &&
            positionDeltaY < 0.01 &&
            !pendingMouseInput;
    }

    // ==============================================
    // ANIMATION LOOP
    // ==============================================

    function animate() {
        if (!isAnimating) return;

        if ((deviceState.isMobile || deviceState.isTablet) && ++frameCounter % CONFIG.mobileFrameSkip !== 0) {
            animationFrameId = requestAnimationFrame(animate);
            return;
        }

        if (deviceState.isMobile || deviceState.isTablet) {
            // 모바일/태블릿 로직
            currentAngle += currentConfig.rotationSpeed;

            const angleInRadians = currentAngle * DEG_TO_RAD;
            const normalizedAngle = ((currentAngle % 360) + 360) % 360;

            const progress = normalizedAngle <= 180 ? normalizedAngle / 180 : (360 - normalizedAngle) / 180;
            const smoothProgress = (1 - Math.cos(progress * Math.PI)) / 2;

            const radiusX = currentConfig.radiusX * (1 + smoothProgress * 0.15);
            const radiusY = currentConfig.radiusY * (1 + smoothProgress * 0.2);

            currentX = Math.cos(angleInRadians) * radiusX * currentConfig.offsetMultiplier;
            currentY = currentConfig.maxOffset.y + Math.sin(angleInRadians) * radiusY * currentConfig.offsetMultiplier - smoothProgress * 10 * currentConfig.offsetMultiplier;

            const mobileProgress = normalizedAngle / 360;
            currentDistance = 0.5 + 0.5 * Math.sin(mobileProgress * PI2);
            scaleFactor = 1 + (currentDistance - 0.5) * CONFIG.scaleRange * 2;

        } else {
            // 데스크톱 로직
            currentDistance += (targetDistance - currentDistance) * CONFIG.distanceEasing;
            scaleFactor = 1 + (currentDistance - 0.5) * CONFIG.scaleRange * 2;

            const distance = Math.abs(normalizeAngleDelta(currentAngle, targetAngle));

            let adaptiveFactor;
            if (distance > 90) {
                adaptiveFactor = 0.15;
            } else if (distance > 45) {
                adaptiveFactor = 0.10;
            } else if (distance > 20) {
                adaptiveFactor = 0.08;
            } else {
                adaptiveFactor = CONFIG.smoothingFactor;
            }

            let deltaAngle = normalizeAngleDelta(currentAngle, targetAngle);

            const acceleration = deltaAngle * 0.01;
            angleVelocity = (angleVelocity + acceleration) * CONFIG.damping;

            let step = deltaAngle * adaptiveFactor + angleVelocity;
            step = Math.max(-CONFIG.maxSpeedPerFrame, Math.min(step, CONFIG.maxSpeedPerFrame));

            currentAngle += step;

            const angleInRadians = currentAngle * DEG_TO_RAD;
            const normalizedAngle = ((currentAngle % 360) + 360) % 360;

            const progress = normalizedAngle <= 180 ? normalizedAngle / 180 : (360 - normalizedAngle) / 180;
            const smoothProgress = (1 - Math.cos(progress * Math.PI)) / 2;

            const radiusX = currentConfig.radiusX * (1 + smoothProgress * 0.15);
            const radiusY = currentConfig.radiusY * (1 + smoothProgress * 0.2);

            const newTargetX = Math.cos(angleInRadians) * radiusX;
            const newTargetY = currentConfig.maxOffset.y + Math.sin(angleInRadians) * radiusY - smoothProgress * 10;

            const positionFactor = 0.10;
            currentX += (newTargetX - currentX) * positionFactor;
            currentY += (newTargetY - currentY) * positionFactor;

            if (hasDesktopAnimationSettled(newTargetX, newTargetY)) {
                updateCSS();
                stopAnimation();
                return;
            }
        }

        updateCSS();
        animationFrameId = requestAnimationFrame(animate);
    }

    // ==============================================
    // ANIMATION CONTROL
    // ==============================================

    function legacyCheckAndToggle() {
        const scrollY = window.scrollY || window.pageYOffset;
        const boundaryCheck = deviceState.isMobile ? scrollY : (scrollY + lastMouseY);
        const shouldAnimate = boundaryCheck <= CONFIG.animationBoundary;

        if (shouldAnimate && !isAnimating) {
            console.log('✨ Animation activated');
            isAnimating = true;
            animate();
        } else if (!shouldAnimate && isAnimating) {
            console.log('💤 Animation paused');
            isAnimating = false;
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }
        }
    }

    function checkAndToggle() {
        const shouldAnimate = isWithinAnimationBoundary();

        if (document.hidden || reducedMotionQuery.matches) {
            stopAnimation();
            return;
        }

        if (!shouldAnimate && isAnimating) {
            stopAnimation();
        } else if (shouldAnimate && (deviceState.isMobile || deviceState.isTablet) && !isAnimating) {
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

    // ==============================================
    // EVENT LISTENERS
    // ==============================================

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

    if (!deviceState.isMobile) {
        const mouseMoveHandler = (event) => {
            lastMouseY = event.clientY;
            const scrollY = window.scrollY || window.pageYOffset;
            const absoluteMouseY = scrollY + event.clientY;

            if (absoluteMouseY <= CONFIG.animationBoundary) {
                scheduleMouseInput(event);
            } else {
                pendingMouseInput = null;
            }
            checkAndToggle();
        };
        document.addEventListener('mousemove', mouseMoveHandler, passiveOptions);
        window.addEventListener('scroll', checkAndToggle, passiveOptions);
    }

    window.addEventListener('resize', handleResize);

    // 오리엔테이션 변경 감지 (모바일)
    window.addEventListener('orientationchange', () => {
        setTimeout(handleResize, 300);
    });

    document.addEventListener('visibilitychange', () => {
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

    reducedMotionQuery.addEventListener('change', () => {
        checkAndToggle();
    });

    window.addEventListener('beforeunload', () => {
        stopAnimation();
        if (inputFrameId) cancelAnimationFrame(inputFrameId);
    });

    // ==============================================
    // DEBUG INTERFACE
    // ==============================================

    window.debugAnimation = {
        state: () => ({
            currentAngle,
            targetAngle,
            currentDistance,
            targetDistance,
            currentX,
            currentY,
            scaleFactor,
            deviceType: deviceState.type,
            currentConfig
        }),
        config: CONFIG,
        responsiveConfig: RESPONSIVE_CONFIG,
        isAnimating: () => isAnimating,
        deviceState: deviceState,

        // 애니메이션 제어
        forceStart: () => {
            isAnimating = true;
            animate();
        },
        forceStop: () => {
            isAnimating = false;
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
        },

        // 회전 제어 함수
        enableFreeRotation: () => {
            CONFIG.rotationScale = 1.0;
            CONFIG.maxRotation = null;
            CONFIG.enableRotationLimit = false;
            console.log('✅ Free rotation enabled (100%, no limit)');
        },

        enableLimitedRotation: (scale = 0.3, maxAngle = 60) => {
            CONFIG.rotationScale = scale;
            CONFIG.maxRotation = maxAngle;
            CONFIG.enableRotationLimit = true;
            console.log(`✅ Limited rotation enabled (${scale * 100}%, ±${maxAngle}°)`);
        },

        setRotationScale: (scale) => {
            CONFIG.rotationScale = scale;
            console.log(`Rotation scale: ${scale * 100}%`);
        },

        setMaxRotation: (angle) => {
            CONFIG.maxRotation = angle;
            console.log(`Max rotation: ±${angle}°`);
        },

        setCounterRotationEllipses: (indices) => {
            CONFIG.counterRotation.ellipses = indices;
            // Re-calculate ellipse data to update isCounterRotating flag
            calculateEllipseData();
            console.log('Counter-rotation ellipses:', indices);
        },

        setCounterRotationSpeed: (speed) => {
            CONFIG.counterRotation.speed = speed;
            console.log('Counter-rotation speed:', speed);
        },

        // 반응형 설정 변경
        updateResponsiveConfig: (deviceType, config) => {
            Object.assign(RESPONSIVE_CONFIG[deviceType], config);
            if (deviceState.type === deviceType) {
                currentConfig = getCurrentConfig();
                updateResponsiveScale();
            }
            console.log(`Updated ${deviceType} config:`, RESPONSIVE_CONFIG[deviceType]);
        }
    };

    // ==============================================
    // INITIALIZATION
    // ==============================================

    checkAndToggle();

    console.log('🎨 Responsive interactive background initialized (Optimized)');
    console.log('📊 Current settings:', {
        deviceType: deviceState.type,
        scale: currentConfig.scale,
        blur: currentConfig.blur,
        isMobile: deviceState.isMobile,
        isTablet: deviceState.isTablet,
        rotationMode: CONFIG.enableRotationLimit ? 'LIMITED' : 'FREE',
        rotationScale: `${CONFIG.rotationScale * 100}%`,
        maxRotation: CONFIG.maxRotation ? `±${CONFIG.maxRotation}°` : 'UNLIMITED'
    });
});
