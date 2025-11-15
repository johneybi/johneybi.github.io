document.addEventListener('DOMContentLoaded', function () {
    // ==============================================
    // DOM & ENVIRONMENT
    // ==============================================

    const animatedElement = document.querySelector('.interactive-svg-background');
    if (!animatedElement) return;

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

    const RESPONSIVE_CONFIG = {
        mobile: {
            scale: 3.5,
            blur: 20,
            offsetMultiplier: 0.6,
            rotationSpeed: 0.3,
            maxOffset: { x: 8, y: 12 },
            radiusX: 6,
            radiusY: 10
        },
        tablet: {
            scale: 4.5,
            blur: 24,
            offsetMultiplier: 0.8,
            rotationSpeed: 0.12,
            maxOffset: { x: 9, y: 13 },
            radiusX: 8,
            radiusY: 12
        },
        desktop: {
            scale: 5.8,
            blur: 28,
            offsetMultiplier: 1,
            rotationSpeed: 0.15,
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
    // CONFIGURATION
    // ==============================================

    const CONFIG = {
        smoothingFactor: 0.06,
        maxSpeedPerFrame: 1.2,
        historySize: 8,
        historyCutoff: 50,
        animationBoundary: 880,
        centerY: 440,
        springStrength: 0.015,
        damping: 0.92,
        velocityDecay: 0.95,
        updateThreshold: 0.01,
        mobileFrameSkip: 2,
        cssUpdateDelay: 16,

        rotationScale: 1.0,
        maxRotation: null,
        enableRotationLimit: false,

        responsiveness: 0.25,
        predictiveFactor: 0.1,

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
    let lastMouseY = 0;
    let isAnimating = false;

    const angleHistory = [];
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
    }, 250);

    // ==============================================
    // TRIGONOMETRY CACHE
    // ==============================================

    const cosCache = new Map();
    const sinCache = new Map();

    function getCachedCos(angle) {
        const key = angle.toFixed(2);
        if (!cosCache.has(key)) {
            cosCache.set(key, Math.cos(angle));
        }
        return cosCache.get(key);
    }

    function getCachedSin(angle) {
        const key = angle.toFixed(2);
        if (!sinCache.has(key)) {
            sinCache.set(key, Math.sin(angle));
        }
        return sinCache.get(key);
    }

    // ==============================================
    // MOUSE MOVE HANDLER
    // ==============================================

    function handleMouseMove(event) {
        const deltaX = event.clientX - centerX;
        const deltaY = event.clientY - CONFIG.centerY;

        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        targetDistance = Math.min(distance / CONFIG.maxDistance, 1);

        const angleInRadians = Math.atan2(deltaY, deltaX);
        const angleInDegrees = angleInRadians * (180 / Math.PI);
        let normalizedAngle = (angleInDegrees + 90 + 360) % 360;

        if (CONFIG.enableRotationLimit) {
            if (normalizedAngle > 180) {
                normalizedAngle = normalizedAngle - 360;
            }

            normalizedAngle = normalizedAngle * CONFIG.rotationScale;

            if (CONFIG.maxRotation !== null) {
                normalizedAngle = Math.max(-CONFIG.maxRotation, Math.min(CONFIG.maxRotation, normalizedAngle));
            }

            normalizedAngle = (normalizedAngle + 360) % 360;
        }

        const now = performance.now();

        const instantResponse = normalizedAngle * CONFIG.responsiveness;
        const smoothedResponse = targetAngle * (1 - CONFIG.responsiveness);

        angleHistory.push({ angle: normalizedAngle, timestamp: now });

        if (angleHistory.length > CONFIG.historySize) {
            angleHistory.shift();
        }

        if (angleHistory.length < 2) {
            targetAngle = instantResponse + smoothedResponse;
            return;
        }

        let weightedSumX = 0, weightedSumY = 0;
        const historyLength = angleHistory.length;

        for (let i = 0; i < historyLength; i++) {
            const weight = Math.pow((i + 1) / historyLength, 2);
            const rad = angleHistory[i].angle * Math.PI / 180;
            weightedSumX += getCachedCos(rad) * weight;
            weightedSumY += getCachedSin(rad) * weight;
        }

        const avgAngle = Math.atan2(weightedSumY, weightedSumX) * 180 / Math.PI;
        const smoothedAngle = (avgAngle + 360) % 360;

        if (angleHistory.length >= 3) {
            const recent = angleHistory[historyLength - 1].angle;
            const previous = angleHistory[historyLength - 2].angle;
            let velocity = recent - previous;

            if (velocity > 180) velocity -= 360;
            if (velocity < -180) velocity += 360;

            targetAngle = smoothedAngle + velocity * CONFIG.predictiveFactor;
        } else {
            targetAngle = smoothedAngle;
        }

        targetAngle = targetAngle * 0.7 + normalizedAngle * 0.3;
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
        const ellipseGroups = animatedElement.querySelectorAll('.ellipse-group');

        const disperseFactor = (currentDistance - 0.5) * 2;

        const svgCenterX = CONFIG.counterRotation.svgCenter.x;
        const svgCenterY = CONFIG.counterRotation.svgCenter.y;

        ellipseGroups.forEach((group, index) => {
            const origin = group.style.transformOrigin.split(' ');
            const originX = parseFloat(origin[0]);
            const originY = parseFloat(origin[1]);

            const dx = originX - svgCenterX;
            const dy = originY - svgCenterY;

            const scaleDivisor = currentConfig.scale; // 반응형 스케일 사용
            const moveAmount = CONFIG.scaleRange / scaleDivisor;

            const translateX = dx * disperseFactor * moveAmount;
            const translateY = dy * disperseFactor * moveAmount;

            let rotation = -currentAngle;

            if (CONFIG.counterRotation.enabled &&
                CONFIG.counterRotation.mode === 'orbit' &&
                CONFIG.counterRotation.ellipses.includes(index)) {

                const distFromCenter = Math.sqrt(dx * dx + dy * dy);
                const angleFromCenter = Math.atan2(dy, dx) * (180 / Math.PI);

                const counterRotationAngle = -currentAngle * 2 * CONFIG.counterRotation.speed;
                const newAngle = (angleFromCenter + counterRotationAngle) * (Math.PI / 180);

                const newX = Math.cos(newAngle) * distFromCenter;
                const newY = Math.sin(newAngle) * distFromCenter;

                const orbitTranslateX = (newX - dx) + translateX;
                const orbitTranslateY = (newY - dy) + translateY;

                rotation = -currentAngle;

                const transformValue = `translate($${orbitTranslateX}px, $${orbitTranslateY}px) rotate(${rotation}deg)`;
                group.style.transform = transformValue;
            } else {
                const transformValue = `translate($${translateX}px, $${translateY}px) rotate(${rotation}deg)`;
                group.style.transform = transformValue;
            }
        });

        lastScaleValue = scaleFactor;
    }

    // ==============================================
    // ANIMATION LOOP
    // ==============================================

    function animate() {
        const config = getCurrentConfig();

        if ((deviceState.isMobile || deviceState.isTablet) && ++frameCounter % CONFIG.mobileFrameSkip !== 0) {
            animationFrameId = requestAnimationFrame(animate);
            return;
        }

        if (deviceState.isMobile || deviceState.isTablet) {
            // 모바일/태블릿 로직
            currentAngle += config.rotationSpeed;

            const angleInRadians = currentAngle * Math.PI / 180;
            const normalizedAngle = ((currentAngle % 360) + 360) % 360;

            const progress = normalizedAngle <= 180 ? normalizedAngle / 180 : (360 - normalizedAngle) / 180;
            const smoothProgress = (1 - Math.cos(progress * Math.PI)) / 2;

            const radiusX = config.radiusX * (1 + smoothProgress * 0.15);
            const radiusY = config.radiusY * (1 + smoothProgress * 0.2);

            currentX = getCachedCos(angleInRadians) * radiusX * config.offsetMultiplier;
            currentY = config.maxOffset.y + getCachedSin(angleInRadians) * radiusY * config.offsetMultiplier - smoothProgress * 10 * config.offsetMultiplier;

            const mobileProgress = normalizedAngle / 360;
            currentDistance = 0.5 + 0.5 * Math.sin(mobileProgress * Math.PI * 2);
            scaleFactor = 1 + (currentDistance - 0.5) * CONFIG.scaleRange * 2;

        } else {
            // 데스크톱 로직
            currentDistance += (targetDistance - currentDistance) * CONFIG.distanceEasing;
            scaleFactor = 1 + (currentDistance - 0.5) * CONFIG.scaleRange * 2;

            const distance = Math.abs(targetAngle - currentAngle);

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

            let deltaAngle = targetAngle - currentAngle;
            if (deltaAngle > 180) deltaAngle -= 360;
            if (deltaAngle < -180) deltaAngle += 360;

            const acceleration = deltaAngle * 0.01;
            angleVelocity = (angleVelocity + acceleration) * CONFIG.damping;

            let step = deltaAngle * adaptiveFactor + angleVelocity;
            step = Math.max(-CONFIG.maxSpeedPerFrame, Math.min(step, CONFIG.maxSpeedPerFrame));

            currentAngle += step;

            const angleInRadians = currentAngle * Math.PI / 180;
            const normalizedAngle = ((currentAngle % 360) + 360) % 360;

            const progress = normalizedAngle <= 180 ? normalizedAngle / 180 : (360 - normalizedAngle) / 180;
            const smoothProgress = (1 - Math.cos(progress * Math.PI)) / 2;

            const radiusX = config.radiusX * (1 + smoothProgress * 0.15);
            const radiusY = config.radiusY * (1 + smoothProgress * 0.2);

            const newTargetX = getCachedCos(angleInRadians) * radiusX;
            const newTargetY = config.maxOffset.y + getCachedSin(angleInRadians) * radiusY - smoothProgress * 10;

            const positionFactor = 0.10;
            currentX += (newTargetX - currentX) * positionFactor;
            currentY += (newTargetY - currentY) * positionFactor;
        }

        updateCSS();
        animationFrameId = requestAnimationFrame(animate);
    }

    // ==============================================
    // ANIMATION CONTROL
    // ==============================================

    function checkAndToggle() {
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
        let mouseThrottle = null;
        const mouseMoveHandler = (event) => {
            lastMouseY = event.clientY;
            const scrollY = window.scrollY || window.pageYOffset;
            const absoluteMouseY = scrollY + event.clientY;

            if (absoluteMouseY <= CONFIG.animationBoundary) {
                handleMouseMove(event);

                if (mouseThrottle) return;
                mouseThrottle = setTimeout(() => {
                    mouseThrottle = null;
                }, 16);
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

    window.addEventListener('beforeunload', () => {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
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

    console.log('🎨 Responsive interactive background initialized');
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
    console.log('🛠️ Debug commands:');
    console.log('  debugAnimation.state() - 현재 상태 확인');
    console.log('  debugAnimation.deviceState - 디바이스 정보');
    console.log('  debugAnimation.updateResponsiveConfig("mobile", {scale: 3.0}) - 반응형 설정 변경');
    console.log('  debugAnimation.enableFreeRotation() - 자유 회전 (100%)');
    console.log('  debugAnimation.enableLimitedRotation(0.3, 60) - 제한 회전');
});