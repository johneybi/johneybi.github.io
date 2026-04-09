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
        tablet: 1024
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
    // rotationSpeed: 값이 클수록 빠르게 회전 (mobile/tablet 자동회전, desktop 미사용)

    const RESPONSIVE_CONFIG = {
        mobile: {
            scale: 3.5,
            blur: 20,
            offsetMultiplier: 0.5,
            rotationSpeed: 0.55, // ~20fps × 0.55 = 11°/sec, 약 33초/회전
            maxOffset: { x: 6, y: 11 },
            radiusX: 5,
            radiusY: 7
        },
        tablet: {
            scale: 4.5,
            blur: 24,
            offsetMultiplier: 0.6,
            rotationSpeed: 0.4,
            maxOffset: { x: 7, y: 10 },
            radiusX: 6,
            radiusY: 8
        },
        desktop: {
            scale: 5.8,
            blur: 28,
            offsetMultiplier: 1,
            rotationSpeed: 0.5,
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
    let currentAngle = (deviceState.isMobile || deviceState.isTablet) ? 220 : 0; // 모바일: ~20초 진행된 위치, 데스크톱: 기본값 유지
    let currentX = currentConfig.maxOffset.x;
    let currentY = currentConfig.maxOffset.y;
    let targetDistance = 0.5;
    let currentDistance = 0.5;

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


    const DEG_TO_RAD = Math.PI / 180;
    const RAD_TO_DEG = 180 / Math.PI;
    const PI2 = Math.PI * 2;

    const CONFIG = {
        // 마우스 추적 (데스크톱)
        smoothingFactor: 0.1,       // 각도 지연 (낮을수록 느리게 따라옴)
        maxSpeedPerFrame: 3,        // 프레임당 최대 회전각 (deg)
        damping: 0.75,              // 관성 감속 계수
        fastMovementThreshold: 2.5, // 빠른 이동 무시 임계값 (px/ms)
        maxDistance: 400,           // distance 정규화 기준 (px)
        distanceEasing: 0.12,       // distance lerp 속도

        // 애니메이션 제어
        animationBoundary: 880,     // 이 스크롤 위치 이하에서만 실행 (px)
        centerY: 440,               // 화면 중심 Y (px)
        mobileFrameSkip: 3,         // 모바일: ~20fps
        tabletFrameSkip: 2,         // 태블릿: ~30fps

        // CSS 업데이트 최적화
        updateThreshold: 0.01,
        cssUpdateDelay: 16
    };

    // ==============================================
    // STATE VARIABLES
    // ==============================================

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

    // 빠른 마우스 이동 무시 후 재추적을 위한 상태
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

    // SVG viewBox 중심: viewBox="-1000 -900 4474 3541" 기준
    const SVG_CENTER = { x: 1237, y: 870.5 };

    // ellipse의 실제 cx/cy 속성을 읽어 SVG 중심으로부터의 delta 계산
    const calculateEllipseData = () => {
        ellipseData = ellipseGroups.map((group) => {
            const ellipse = group.querySelector('ellipse');
            const originX = ellipse ? parseFloat(ellipse.getAttribute('cx')) : SVG_CENTER.x;
            const originY = ellipse ? parseFloat(ellipse.getAttribute('cy')) : SVG_CENTER.y;

            return {
                element: group,
                dx: originX - SVG_CENTER.x,
                dy: originY - SVG_CENTER.y
            };
        });
    };

    // Initialize ellipse data
    calculateEllipseData();

    const handleResize = debounce(() => {
        const prevType = deviceState.type;

        if (deviceState.update()) {
            currentConfig = getCurrentConfig();
            updateResponsiveScale();
            currentX = currentConfig.maxOffset.x;
            currentY = currentConfig.maxOffset.y;

            const hadDesktopListeners = prevType !== 'mobile';
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

        const rawTargetAngle = (Math.atan2(deltaY, deltaX) * RAD_TO_DEG + 90 + 360) % 360;

        // 3. Handle Fast Movement (Pause & Resume Logic)
        if (velocity > CONFIG.fastMovementThreshold) {
            trackingState = 'paused';
            return;
        } else if (trackingState === 'paused') {
            angleOffset = normalizeAngleDelta(rawTargetAngle, targetAngle);
            distanceOffset = targetDistance - rawTargetDistance;
            trackingState = 'active';
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

        const angleChanged    = lastAngleValue    === null || Math.abs(currentAngle    - lastAngleValue)    > CONFIG.updateThreshold;
        const xChanged        = lastXValue        === null || Math.abs(currentX        - lastXValue)        > CONFIG.updateThreshold;
        const yChanged        = lastYValue        === null || Math.abs(currentY        - lastYValue)        > CONFIG.updateThreshold;
        const distanceChanged = lastDistanceValue === null || Math.abs(currentDistance - lastDistanceValue) > CONFIG.updateThreshold;

        if (angleChanged || xChanged || yChanged || distanceChanged || forceUpdate) {
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
            if (distanceChanged || angleChanged) {
                updateEllipseTransforms();
            }
            lastCSSUpdate = now;
        }
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

    // 모바일/데스크톱 공통 orbit 계산
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

            const mobileProgress = normalizedAngle / 360;
            currentDistance = 0.5 + 0.5 * Math.sin(mobileProgress * PI2);

        } else {
            currentDistance += (targetDistance - currentDistance) * CONFIG.distanceEasing;

            const distance = Math.abs(normalizeAngleDelta(currentAngle, targetAngle));
            const adaptiveFactor = distance > 90 ? 0.15 : distance > 45 ? 0.10 : distance > 20 ? 0.08 : CONFIG.smoothingFactor;

            let deltaAngle = normalizeAngleDelta(currentAngle, targetAngle);
            angleVelocity = (angleVelocity + deltaAngle * 0.01) * CONFIG.damping;

            let step = deltaAngle * adaptiveFactor + angleVelocity;
            step = Math.max(-CONFIG.maxSpeedPerFrame, Math.min(step, CONFIG.maxSpeedPerFrame));
            currentAngle += step;

            const { angleInRadians, smoothProgress, radiusX, radiusY } = calcOrbit(currentAngle);
            const newTargetX = Math.cos(angleInRadians) * radiusX;
            const newTargetY = currentConfig.maxOffset.y + Math.sin(angleInRadians) * radiusY - smoothProgress * 10;

            currentX += (newTargetX - currentX) * 0.10;
            currentY += (newTargetY - currentY) * 0.10;

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
        document.addEventListener('mousemove', onMouseMove, passiveOptions);
        window.addEventListener('scroll', checkAndToggle, passiveOptions);
    }

    function detachDesktopListeners() {
        document.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('scroll', checkAndToggle);
        pendingMouseInput = null;
        if (inputFrameId) {
            cancelAnimationFrame(inputFrameId);
            inputFrameId = null;
        }
    }

    // 초기 등록: mobile이 아니면 데스크톱 리스너 부착 (tablet 포함)
    if (!deviceState.isMobile) {
        attachDesktopListeners();
    }

    window.addEventListener('resize', handleResize);

    // 뷰포트 밖으로 스크롤 시 rAF 완전 중단 — scroll 이벤트보다 비용이 낮음
    if ('IntersectionObserver' in window) {
        new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) checkAndToggle();
            else stopAnimation();
        }, { threshold: 0 }).observe(animatedElement);
    }

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

    checkAndToggle();

});
