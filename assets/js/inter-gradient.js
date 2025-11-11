document.addEventListener('DOMContentLoaded', function () {
    const animatedElement = document.querySelector('.interactive-svg-background');

    if (!animatedElement) return;

    const isMobile = ('ontouchstart' in window && navigator.maxTouchPoints > 0) || window.innerWidth < 992;

    // 상태 변수들
    let targetAngle = 0;
    let currentAngle = 0;
    let targetX = 10, currentX = 10;
    let targetY = 15, currentY = 15;
    let velocityX = 0, velocityY = 0;

    // 초기값을 즉시 적용
    animatedElement.style.setProperty('--mouse-angle', `${currentAngle}deg`);
    animatedElement.style.setProperty('--x-offset', `${currentX}vw`);
    animatedElement.style.setProperty('--y-offset', `${currentY}vw`);

    // 설정값
    const CONFIG = {
        smoothingFactor: 0.12,        // 0.05 → 0.12 (더 빠른 반응)
        maxSpeedPerFrame: 3.5,        // 1.5 → 3.5 (최대 속도 증가)
        historySize: 5,               // 8 → 5 (더 즉각적인 반응)
        historyCutoff: 50,            // 100 → 50ms (더 최근 데이터만 사용)
        animationBoundary: 880,
        centerY: 440,
        springStrength: 0.025,        // 0.015 → 0.025 (더 강한 스프링)
        damping: 0.85,                // 0.9 → 0.85 (덜 끈적임)
        velocityDecay: 0.95,          // 0.9 → 0.95 (속도 유지)
        mobileRotationSpeed: 0.2,
        updateThreshold: 0.01,
        mobileFrameSkip: 2,
        cssUpdateDelay: 8,            // 16 → 8ms (120fps 타겟)
        // 새로운 설정 추가
        responsiveness: 0.3,          // 즉각 반응 비율
        predictiveFactor: 0.15
    };

    // 애니메이션 상태
    let animationFrameId = null;
    let lastMouseY = 0;
    let isAnimating = false;

    // 각도 추적 (데스크톱 전용)
    const angleHistory = [];
    let lastTargetAngle = 0;
    let angleVelocity = 0;

    // 성능 최적화를 위한 캐시
    let windowWidth = window.innerWidth;
    let centerX = windowWidth / 2;

    // 성능 최적화: 프레임 스킵 카운터
    let frameCounter = 0;

    // 성능 최적화: 마지막 CSS 업데이트 시간
    let lastCSSUpdate = 0;

    // 성능 최적화: 이전 값 캐시
    let lastAngleValue = null;
    let lastXValue = null;
    let lastYValue = null;

    const handleResize = debounce(() => {
        windowWidth = window.innerWidth;
        centerX = windowWidth / 2;
    }, 250);

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

    // 성능 최적화: 삼각함수 캐시
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

    function handleMouseMove(event) {
        const deltaX = event.clientX - centerX;
        const deltaY = event.clientY - CONFIG.centerY;

        const angleInRadians = Math.atan2(deltaY, deltaX);
        const angleInDegrees = angleInRadians * (180 / Math.PI);
        const normalizedAngle = (angleInDegrees + 90 + 360) % 360;

        const now = performance.now(); // Date.now() 대신 더 정밀한 타이머

        // 즉각적인 반응을 위한 직접 적용
        const instantResponse = normalizedAngle * CONFIG.responsiveness;
        const smoothedResponse = targetAngle * (1 - CONFIG.responsiveness);

        angleHistory.push({ angle: normalizedAngle, timestamp: now });

        // 더 효율적인 배열 관리
        const maxHistorySize = CONFIG.historySize;
        if (angleHistory.length > maxHistorySize) {
            angleHistory.shift();
        }

        if (angleHistory.length < 2) {
            targetAngle = instantResponse + smoothedResponse;
            return;
        }

        // 가중치 계산 최적화
        let weightedSumX = 0, weightedSumY = 0;
        const historyLength = angleHistory.length;

        // 최근 값에 더 큰 가중치
        for (let i = 0; i < historyLength; i++) {
            const weight = Math.pow((i + 1) / historyLength, 2); // 제곱으로 최근값 강조
            const rad = angleHistory[i].angle * Math.PI / 180;
            weightedSumX += getCachedCos(rad) * weight;
            weightedSumY += getCachedSin(rad) * weight;
        }

        const avgAngle = Math.atan2(weightedSumY, weightedSumX) * 180 / Math.PI;
        const smoothedAngle = (avgAngle + 360) % 360;

        // 움직임 예측
        if (angleHistory.length >= 3) {
            const recent = angleHistory[historyLength - 1].angle;
            const previous = angleHistory[historyLength - 2].angle;
            let velocity = recent - previous;

            // 각도 차이 정규화
            if (velocity > 180) velocity -= 360;
            if (velocity < -180) velocity += 360;

            // 예측값 추가
            targetAngle = smoothedAngle + velocity * CONFIG.predictiveFactor;
        } else {
            targetAngle = smoothedAngle;
        }
        // 즉각 반응 혼합
        targetAngle = targetAngle * 0.7 + normalizedAngle * 0.3;
    }

    function updateCSS(forceUpdate = false) {
        const now = performance.now();

        // 성능 최적화: CSS 업데이트 빈도 제한
        if (!forceUpdate && now - lastCSSUpdate < CONFIG.cssUpdateDelay) {
            return;
        }

        // 성능 최적화: 변화가 거의 없으면 업데이트 스킵
        const angleChanged = lastAngleValue === null || Math.abs(currentAngle - lastAngleValue) > CONFIG.updateThreshold;
        const xChanged = lastXValue === null || Math.abs(currentX - lastXValue) > CONFIG.updateThreshold;
        const yChanged = lastYValue === null || Math.abs(currentY - lastYValue) > CONFIG.updateThreshold;

        if (angleChanged || xChanged || yChanged || forceUpdate) {
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
            lastCSSUpdate = now;
        }
    }

    function animate() {
        // 성능 최적화: 모바일에서 프레임 스킵
        if (isMobile && ++frameCounter % CONFIG.mobileFrameSkip !== 0) {
            animationFrameId = requestAnimationFrame(animate);
            return;
        }

        if (isMobile) {
            // --- 모바일 전용 로직 ---
            currentAngle += CONFIG.mobileRotationSpeed;

            const angleInRadians = currentAngle * Math.PI / 180;
            const normalizedAngle = ((currentAngle % 360) + 360) % 360;

            const progress = normalizedAngle <= 180 ? normalizedAngle / 180 : (360 - normalizedAngle) / 180;
            const smoothProgress = (1 - Math.cos(progress * Math.PI)) / 2;

            const radiusX = 10 * (1 + smoothProgress * 0.15);
            const radiusY = 14 * (1 + smoothProgress * 0.2);

            currentX = getCachedCos(angleInRadians) * radiusX;
            currentY = 15 + getCachedSin(angleInRadians) * radiusY - smoothProgress * 10;

        } else {
            // 더 반응적인 보간
            const distance = Math.abs(targetAngle - currentAngle);

            // 거리 기반 적응형 속도
            let adaptiveFactor;
            if (distance > 90) {
                adaptiveFactor = 0.25; // 매우 빠름
            } else if (distance > 45) {
                adaptiveFactor = 0.18;
            } else if (distance > 20) {
                adaptiveFactor = 0.12;
            } else {
                adaptiveFactor = CONFIG.smoothingFactor;
            }

            // 각도 차이 계산 (최단 경로)
            let deltaAngle = targetAngle - currentAngle;
            if (deltaAngle > 180) deltaAngle -= 360;
            if (deltaAngle < -180) deltaAngle += 360;

            // 가속도 적용
            const acceleration = deltaAngle * 0.01;
            angleVelocity = (angleVelocity + acceleration) * 0.92;

            // 스텝 계산
            let step = deltaAngle * adaptiveFactor + angleVelocity;
            step = Math.max(-CONFIG.maxSpeedPerFrame, Math.min(step, CONFIG.maxSpeedPerFrame));

            currentAngle += step;

            // 나머지 로직은 동일
            const angleInRadians = currentAngle * Math.PI / 180;
            const normalizedAngle = ((currentAngle % 360) + 360) % 360;

            const progress = normalizedAngle <= 180 ? normalizedAngle / 180 : (360 - normalizedAngle) / 180;
            const smoothProgress = (1 - Math.cos(progress * Math.PI)) / 2;

            const radiusX = 10 * (1 + smoothProgress * 0.15);
            const radiusY = 14 * (1 + smoothProgress * 0.2);

            // 타겟 위치 즉시 계산
            const newTargetX = getCachedCos(angleInRadians) * radiusX;
            const newTargetY = 15 + getCachedSin(angleInRadians) * radiusY - smoothProgress * 10;

            // 위치 보간 (더 빠르게)
            const positionFactor = 0.15; // 더 빠른 위치 추적
            currentX += (newTargetX - currentX) * positionFactor;
            currentY += (newTargetY - currentY) * positionFactor;
        }

        // CSS 업데이트 (최적화된 버전)
        updateCSS();
        animationFrameId = requestAnimationFrame(animate);
    }

    function checkAndToggle() {
        const scrollY = window.scrollY || window.pageYOffset;

        const boundaryCheck = isMobile ? scrollY : (scrollY + lastMouseY);
        const shouldAnimate = boundaryCheck <= CONFIG.animationBoundary;

        if (shouldAnimate && !isAnimating) {
            isAnimating = true;
            animate();
        } else if (!shouldAnimate && isAnimating) {
            isAnimating = false;
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }
            // 성능 최적화: 캐시 정리
            if (cosCache.size > 100) cosCache.clear();
            if (sinCache.size > 100) sinCache.clear();
        }
    }




    // 성능 최적화: passive 이벤트 리스너
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
                // 즉시 처리
                handleMouseMove(event);

                // throttle 대신 즉시 처리 + 중복 방지
                if (mouseThrottle) return;
                mouseThrottle = setTimeout(() => {
                    mouseThrottle = null;
                }, 8); // 8ms (약 120fps)
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
});