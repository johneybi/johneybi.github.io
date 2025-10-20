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
        smoothingFactor: 0.05,
        maxSpeedPerFrame: 1.5,
        historySize: 8,
        historyCutoff: 100, // ms
        animationBoundary: 880,
        centerY: 440,
        springStrength: 0.015,
        damping: 0.9,
        velocityDecay: 0.9,
        mobileRotationSpeed: 0.2 
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

    function handleMouseMove(event) {
        const deltaX = event.clientX - centerX;
        const deltaY = event.clientY - CONFIG.centerY;

        const angleInRadians = Math.atan2(deltaY, deltaX);
        const angleInDegrees = angleInRadians * (180 / Math.PI);
        const normalizedAngle = (angleInDegrees + 90 + 360) % 360;

        const now = Date.now();
        angleHistory.push({ angle: normalizedAngle, timestamp: now });

        const cutoffTime = now - CONFIG.historyCutoff;
        let i = 0;
        while (i < angleHistory.length && angleHistory[i].timestamp < cutoffTime) {
            i++;
        }
        if (i > 0) {
            angleHistory.splice(0, i);
        }

        if (angleHistory.length < 2) return;

        let weightedSumX = 0, weightedSumY = 0, totalWeight = 0;
        const historyLength = angleHistory.length;
        
        for (let i = 0; i < historyLength; i++) {
            const weight = (i + 1) / historyLength;
            const rad = angleHistory[i].angle * Math.PI / 180;
            weightedSumX += Math.cos(rad) * weight;
            weightedSumY += Math.sin(rad) * weight;
            totalWeight += weight;
        }

        const avgAngle = Math.atan2(weightedSumY / totalWeight, weightedSumX / totalWeight) * 180 / Math.PI;
        const smoothedAngle = (avgAngle + 360) % 360;

        const timeDelta = Math.max((angleHistory[historyLength - 1].timestamp - angleHistory[0].timestamp) / 1000, 0.016);

        let diff = smoothedAngle - (((currentAngle % 360) + 360) % 360);
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;

        const prediction = angleVelocity * 0.05;
        targetAngle = currentAngle + diff + prediction;

        angleVelocity = (targetAngle - lastTargetAngle) / timeDelta * CONFIG.velocityDecay;
        lastTargetAngle = targetAngle;
    }

    function animate() {
        if (isMobile) {
            // --- 모바일 전용 로직 ---
            currentAngle += CONFIG.mobileRotationSpeed;

            const angleInRadians = currentAngle * Math.PI / 180;
            const normalizedAngle = ((currentAngle % 360) + 360) % 360;
            
            const progress = normalizedAngle <= 180 ? normalizedAngle / 180 : (360 - normalizedAngle) / 180;
            const smoothProgress = (1 - Math.cos(progress * Math.PI)) / 2;

            const radiusX = 10 * (1 + smoothProgress * 0.15);
            const radiusY = 14 * (1 + smoothProgress * 0.2);

            currentX = Math.cos(angleInRadians) * radiusX;
            currentY = 15 + Math.sin(angleInRadians) * radiusY - smoothProgress * 10;
            
        } else {
            // --- 데스크톱 전용 로직 ---
            const distance = Math.abs(targetAngle - currentAngle);
            const adaptiveSmoothingFactor = distance > 45 
                ? CONFIG.smoothingFactor * 2 
                : CONFIG.smoothingFactor * (1 + distance / 45);

            const deltaAngle = targetAngle - currentAngle;
            let step = deltaAngle * adaptiveSmoothingFactor + deltaAngle * 0.002;
            step = Math.max(-CONFIG.maxSpeedPerFrame, Math.min(step, CONFIG.maxSpeedPerFrame));
            currentAngle += step;

            const angleInRadians = currentAngle * Math.PI / 180;
            const normalizedAngle = ((currentAngle % 360) + 360) % 360;
            
            const progress = normalizedAngle <= 180 ? normalizedAngle / 180 : (360 - normalizedAngle) / 180;
            const smoothProgress = (1 - Math.cos(progress * Math.PI)) / 2;

            const radiusX = 10 * (1 + smoothProgress * 0.15);
            const radiusY = 14 * (1 + smoothProgress * 0.2);

            targetX = Math.cos(angleInRadians) * radiusX;
            targetY = 15 + Math.sin(angleInRadians) * radiusY - smoothProgress * 10; 

            const springForceX = (targetX - currentX) * CONFIG.springStrength;
            const springForceY = (targetY - currentY) * CONFIG.springStrength;

            velocityX = (velocityX + springForceX) * CONFIG.damping;
            velocityY = (velocityY + springForceY) * CONFIG.damping;

            currentX += velocityX + (targetX - currentX) * CONFIG.smoothingFactor * 0.5;
            currentY += velocityY + (targetY - currentY) * CONFIG.smoothingFactor * 0.5;
        }

        // 공통 로직: CSS 업데이트
        animatedElement.style.setProperty('--mouse-angle', `${currentAngle}deg`);
        animatedElement.style.setProperty('--x-offset', `${currentX}vw`);
        animatedElement.style.setProperty('--y-offset', `${currentY}vw`);

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
        }
    }

    if (isMobile) {
        window.addEventListener('scroll', checkAndToggle);
        window.addEventListener('resize', handleResize);
        checkAndToggle();
    } else {
        const mouseMoveHandler = (event) => {
            lastMouseY = event.clientY;
            const scrollY = window.scrollY || window.pageYOffset;
            const absoluteMouseY = scrollY + event.clientY;

            if (absoluteMouseY <= CONFIG.animationBoundary) {
                handleMouseMove(event);
            }
            checkAndToggle();
        };
        document.addEventListener('mousemove', mouseMoveHandler);
        window.addEventListener('scroll', checkAndToggle);
        window.addEventListener('resize', handleResize);
    }

    window.addEventListener('beforeunload', () => {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
    });
});