/**
 * ==============================================
 * INTERACTIVE SVG BACKGROUND CONTROLLER V4
 * ==============================================
 * 
 * 개선사항:
 * 1. SVG 중심축 기준 역회전 (공전 효과)
 * 2. 회전량/최대각도 자유 설정 가능
 * 3. 부드러운 보간 유지
 */

document.addEventListener('DOMContentLoaded', function () {
    // ==============================================
    // DOM & ENVIRONMENT
    // ==============================================

    const animatedElement = document.querySelector('.interactive-svg-background');
    if (!animatedElement) return;

    const isMobile = ('ontouchstart' in window && navigator.maxTouchPoints > 0) || window.innerWidth < 992;

    // ==============================================
    // STATE MANAGEMENT
    // ==============================================

    let targetAngle = 0;
    let currentAngle = 0;
    let targetX = 10, currentX = 10;
    let targetY = 15, currentY = 15;
    let velocityX = 0, velocityY = 0;
    let targetDistance = 0.5;
    let currentDistance = 0.5;
    let scaleFactor = 1;

    // 초기값 적용
    animatedElement.style.setProperty('--mouse-angle', `${currentAngle}deg`);
    animatedElement.style.setProperty('--x-offset', `${currentX}vw`);
    animatedElement.style.setProperty('--y-offset', `${currentY}vw`);
    animatedElement.style.setProperty('--ellipse-scale', '1');

    // ==============================================
    // CONFIGURATION
    // ==============================================

    const CONFIG = {
        smoothingFactor: 0.06,          // 부드러운 보간
        maxSpeedPerFrame: 1.2,          // 느린 최대 속도
        historySize: 8,
        historyCutoff: 50,
        animationBoundary: 880,
        centerY: 440,
        springStrength: 0.015,
        damping: 0.92,
        velocityDecay: 0.95,
        mobileRotationSpeed: 0.15,
        updateThreshold: 0.01,
        mobileFrameSkip: 2,
        cssUpdateDelay: 16,

        // ===== 회전 제어 =====
        // 옵션 1: 제한된 회전 (부드러운 움직임)
        //rotationScale: 0.3,             // 회전량 30% (1.0 = 100% 자유 회전)
        //maxRotation: 60,                // 최대 ±60도 (null = 제한 없음)
        //enableRotationLimit: true,      // 제한 활성화 (false = 자유 회전)

        // 옵션 2: 자유 회전 설정 예시
        rotationScale: 1.0,           // 100% 회전
        maxRotation: null,            // 제한 없음
        enableRotationLimit: false,   // 제한 비활성화

        responsiveness: 0.25,
        predictiveFactor: 0.1,

        // 거리 관련
        maxDistance: 400,
        scaleRange: 1,
        distanceEasing: 0.12,

        // ===== 역회전 설정 (중심축 기준) =====
        counterRotation: {
            enabled: null,
            ellipses: [1, 3],                    // 역회전할 타원 인덱스
            mode: 'orbit',                       // 'orbit' = 중심축 기준 공전
            speed: 1.0,                          // 역회전 속도 배율
            svgCenter: { x: 1237, y: 870.5 }     // SVG viewBox 중심점
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

    const handleResize = debounce(() => {
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

        // 거리 계산
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        targetDistance = Math.min(distance / CONFIG.maxDistance, 1);

        // 각도 계산
        const angleInRadians = Math.atan2(deltaY, deltaX);
        const angleInDegrees = angleInRadians * (180 / Math.PI);
        let normalizedAngle = (angleInDegrees + 90 + 360) % 360;

        // ===== 회전량 제어 =====
        if (CONFIG.enableRotationLimit) {
            // -180 ~ 180도로 변환
            if (normalizedAngle > 180) {
                normalizedAngle = normalizedAngle - 360;
            }

            // 회전량 스케일링
            normalizedAngle = normalizedAngle * CONFIG.rotationScale;

            // 최대 각도 제한 (설정된 경우)
            if (CONFIG.maxRotation !== null) {
                normalizedAngle = Math.max(-CONFIG.maxRotation, Math.min(CONFIG.maxRotation, normalizedAngle));
            }

            // 다시 0-360 범위로
            normalizedAngle = (normalizedAngle + 360) % 360;
        }
        // enableRotationLimit가 false면 normalizedAngle 그대로 사용 (자유 회전)

        const now = performance.now();

        // 즉각 반응
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

        // 가중 평균
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

        // 예측
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

        // 혼합
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

    /**
     * 타원 변환 업데이트
     * - 분산 효과
     * - SVG 중심축 기준 역회전 (공전)
     */
    function updateEllipseTransforms() {
        const ellipseGroups = animatedElement.querySelectorAll('.ellipse-group');

        const disperseFactor = (currentDistance - 0.5) * 2;

        // SVG 중심점
        const svgCenterX = CONFIG.counterRotation.svgCenter.x;
        const svgCenterY = CONFIG.counterRotation.svgCenter.y;

        ellipseGroups.forEach((group, index) => {
            const origin = group.style.transformOrigin.split(' ');
            const originX = parseFloat(origin[0]);
            const originY = parseFloat(origin[1]);

            // ===== 1. 분산 효과 (중심에서 멀어지기) =====
            const dx = originX - svgCenterX;
            const dy = originY - svgCenterY;

            const scaleDivisor = 5.8;
            const moveAmount = CONFIG.scaleRange / scaleDivisor;

            const translateX = dx * disperseFactor * moveAmount;
            const translateY = dy * disperseFactor * moveAmount;

            // ===== 2. 회전 처리 =====
            let rotation = -currentAngle; // 기본: 부모 회전 상쇄

            // 역회전 타원 (중심축 기준 공전)
            if (CONFIG.counterRotation.enabled &&
                CONFIG.counterRotation.mode === 'orbit' &&
                CONFIG.counterRotation.ellipses.includes(index)) {

                // SVG 중심으로부터의 거리와 각도
                const distFromCenter = Math.sqrt(dx * dx + dy * dy);
                const angleFromCenter = Math.atan2(dy, dx) * (180 / Math.PI);

                // 역회전: 중심축 기준으로 반대 방향 공전
                // currentAngle만큼 반대로 회전
                const counterRotationAngle = -currentAngle * 2 * CONFIG.counterRotation.speed;
                const newAngle = (angleFromCenter + counterRotationAngle) * (Math.PI / 180);

                // 새로운 위치 계산 (공전)
                const newX = Math.cos(newAngle) * distFromCenter;
                const newY = Math.sin(newAngle) * distFromCenter;

                // 원래 위치에서 새 위치로의 변위
                const orbitTranslateX = (newX - dx) + translateX;
                const orbitTranslateY = (newY - dy) + translateY;

                // 타원 자체는 회전하지 않음 (부모 회전만 상쇄)
                rotation = -currentAngle;

                const transformValue = `translate(${orbitTranslateX}px, ${orbitTranslateY}px) rotate(${rotation}deg)`;
                group.style.transform = transformValue;
            } else {
                // 일반 타원: 분산만 적용
                const transformValue = `translate(${translateX}px, ${translateY}px) rotate(${rotation}deg)`;
                group.style.transform = transformValue;
            }
        });

        lastScaleValue = scaleFactor;
    }

    // ==============================================
    // ANIMATION LOOP
    // ==============================================

    function animate() {
        if (isMobile && ++frameCounter % CONFIG.mobileFrameSkip !== 0) {
            animationFrameId = requestAnimationFrame(animate);
            return;
        }

        if (isMobile) {
            // 모바일 로직
            currentAngle += CONFIG.mobileRotationSpeed;

            const angleInRadians = currentAngle * Math.PI / 180;
            const normalizedAngle = ((currentAngle % 360) + 360) % 360;

            const progress = normalizedAngle <= 180 ? normalizedAngle / 180 : (360 - normalizedAngle) / 180;
            const smoothProgress = (1 - Math.cos(progress * Math.PI)) / 2;

            const radiusX = 10 * (1 + smoothProgress * 0.15);
            const radiusY = 14 * (1 + smoothProgress * 0.2);

            currentX = getCachedCos(angleInRadians) * radiusX;
            currentY = 15 + getCachedSin(angleInRadians) * radiusY - smoothProgress * 10;

            const mobileProgress = normalizedAngle / 360;
            currentDistance = 0.5 + 0.5 * Math.sin(mobileProgress * Math.PI * 2);
            scaleFactor = 1 + (currentDistance - 0.5) * CONFIG.scaleRange * 2;

        } else {
            // 데스크톱 로직

            // 거리 보간
            currentDistance += (targetDistance - currentDistance) * CONFIG.distanceEasing;
            scaleFactor = 1 + (currentDistance - 0.5) * CONFIG.scaleRange * 2;

            // 각도 보간
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

            // 위치 계산
            const angleInRadians = currentAngle * Math.PI / 180;
            const normalizedAngle = ((currentAngle % 360) + 360) % 360;

            const progress = normalizedAngle <= 180 ? normalizedAngle / 180 : (360 - normalizedAngle) / 180;
            const smoothProgress = (1 - Math.cos(progress * Math.PI)) / 2;

            const radiusX = 10 * (1 + smoothProgress * 0.15);
            const radiusY = 14 * (1 + smoothProgress * 0.2);

            const newTargetX = getCachedCos(angleInRadians) * radiusX;
            const newTargetY = 15 + getCachedSin(angleInRadians) * radiusY - smoothProgress * 10;

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
        const boundaryCheck = isMobile ? scrollY : (scrollY + lastMouseY);
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

    if (!isMobile) {
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
        window.addEventListener('resize', handleResize);
    }

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
            scaleFactor
        }),
        config: CONFIG,
        isAnimating: () => isAnimating,

        // 애니메이션 제어
        forceStart: () => {
            isAnimating = true;
            animate();
        },
        forceStop: () => {
            isAnimating = false;
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
        },

        // ===== 회전 제어 함수 =====
        // 자유 회전 활성화
        enableFreeRotation: () => {
            CONFIG.rotationScale = 1.0;
            CONFIG.maxRotation = null;
            CONFIG.enableRotationLimit = false;
            console.log('✅ Free rotation enabled (100%, no limit)');
        },

        // 제한된 회전 활성화
        enableLimitedRotation: (scale = 0.3, maxAngle = 60) => {
            CONFIG.rotationScale = scale;
            CONFIG.maxRotation = maxAngle;
            CONFIG.enableRotationLimit = true;
            console.log(`✅ Limited rotation enabled (${scale * 100}%, ±${maxAngle}°)`);
        },

        // 회전량만 조절 (제한 유지)
        setRotationScale: (scale) => {
            CONFIG.rotationScale = scale;
            console.log(`Rotation scale: ${scale * 100}%`);
        },

        // 최대 각도만 조절
        setMaxRotation: (angle) => {
            CONFIG.maxRotation = angle;
            console.log(`Max rotation: ±${angle}°`);
        },

        // 역회전 타원 설정
        setCounterRotationEllipses: (indices) => {
            CONFIG.counterRotation.ellipses = indices;
            console.log('Counter-rotation ellipses:', indices);
        },

        // 역회전 속도 조절
        setCounterRotationSpeed: (speed) => {
            CONFIG.counterRotation.speed = speed;
            console.log('Counter-rotation speed:', speed);
        }
    };

    // ==============================================
    // INITIALIZATION
    // ==============================================

    checkAndToggle();

    console.log('🎨 Enhanced interactive background v4 initialized');
    console.log('📊 Current settings:', {
        isMobile,
        rotationMode: CONFIG.enableRotationLimit ? 'LIMITED' : 'FREE',
        rotationScale: `${CONFIG.rotationScale * 100}%`,
        maxRotation: CONFIG.maxRotation ? `±${CONFIG.maxRotation}°` : 'UNLIMITED',
        counterRotating: CONFIG.counterRotation.ellipses,
        counterRotationMode: CONFIG.counterRotation.mode
    });
    console.log('🛠️ Debug commands:');
    console.log('  debugAnimation.enableFreeRotation() - 자유 회전 (100%)');
    console.log('  debugAnimation.enableLimitedRotation(0.3, 60) - 제한 회전');
    console.log('  debugAnimation.setCounterRotationSpeed(0.5) - 역회전 속도');
});