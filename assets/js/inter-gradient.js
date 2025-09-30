document.addEventListener('DOMContentLoaded', function () {
    const animatedElement = document.querySelector('.interactive-svg-background');
    
    if (!animatedElement) return;

    // 상태 변수들
    let targetAngle = 0;
    let currentAngle = 0;
    let targetX = 10, currentX = 10;
    let targetY = 15, currentY = 15;
    let velocityX = 0, velocityY = 0; // animate 외부로 이동

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
        velocityDecay: 0.9
    };

    // 애니메이션 상태
    let animationFrameId = null;
    let lastMouseY = 0;
    let isAnimating = false;

    // 각도 추적
    const angleHistory = [];
    let lastTargetAngle = 0;
    let angleVelocity = 0;

    // 성능 최적화를 위한 캐시
    let windowWidth = window.innerWidth;
    let centerX = windowWidth / 2;

    // 윈도우 리사이즈 처리
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

        // 각도 히스토리 관리
        const now = Date.now();
        angleHistory.push({ angle: normalizedAngle, timestamp: now });

        // 오래된 데이터 제거
        const cutoffTime = now - CONFIG.historyCutoff;
        let i = 0;
        while (i < angleHistory.length && angleHistory[i].timestamp < cutoffTime) {
            i++;
        }
        if (i > 0) {
            angleHistory.splice(0, i);
        }

        // 최소 2개 데이터 필요
        if (angleHistory.length < 2) return;

        // 가중 평균 계산
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

        // 각속도 계산
        const timeDelta = Math.max((angleHistory[historyLength - 1].timestamp - angleHistory[0].timestamp) / 1000, 0.016);

        let diff = smoothedAngle - (((currentAngle % 360) + 360) % 360);
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;

        // 목표 각도 설정
        const prediction = angleVelocity * 0.05;
        targetAngle = currentAngle + diff + prediction;

        // 각속도 업데이트
        angleVelocity = (targetAngle - lastTargetAngle) / timeDelta * CONFIG.velocityDecay;
        lastTargetAngle = targetAngle;
    }

    function animate() {
        // 각도 업데이트
        const distance = Math.abs(targetAngle - currentAngle);
        const adaptiveSmoothingFactor = distance > 45 
            ? CONFIG.smoothingFactor * 2 
            : CONFIG.smoothingFactor * (1 + distance / 45);

        const deltaAngle = targetAngle - currentAngle;
        let step = deltaAngle * adaptiveSmoothingFactor + deltaAngle * 0.002; // 스프링 효과
        step = Math.max(-CONFIG.maxSpeedPerFrame, Math.min(step, CONFIG.maxSpeedPerFrame));
        currentAngle += step;

        // 위치 계산
        const angleInRadians = currentAngle * Math.PI / 180;
        const normalizedAngle = ((currentAngle % 360) + 360) % 360;
        
        const progress = normalizedAngle <= 180 ? normalizedAngle / 180 : (360 - normalizedAngle) / 180;
        const smoothProgress = progress * progress * (3 - 2 * progress);

        const radiusX = 10 * (1 + smoothProgress * 0.15);
        const radiusY = 14 * (1 + smoothProgress * 0.2);

        targetX = Math.cos(angleInRadians) * radiusX;
        targetY = 15 + Math.sin(angleInRadians) * radiusY;

        // 스프링 물리
        const springForceX = (targetX - currentX) * CONFIG.springStrength;
        const springForceY = (targetY - currentY) * CONFIG.springStrength;

        velocityX = (velocityX + springForceX) * CONFIG.damping;
        velocityY = (velocityY + springForceY) * CONFIG.damping;

        currentX += velocityX + (targetX - currentX) * CONFIG.smoothingFactor * 0.5;
        currentY += velocityY + (targetY - currentY) * CONFIG.smoothingFactor * 0.5;

        // CSS 업데이트
        animatedElement.style.setProperty('--mouse-angle', `${currentAngle}deg`);
        animatedElement.style.setProperty('--x-offset', `${currentX}vw`);
        animatedElement.style.setProperty('--y-offset', `${currentY}vw`);

        animationFrameId = requestAnimationFrame(animate);
    }

    function checkAndToggle() {
        const scrollY = window.scrollY || window.pageYOffset;
        const absoluteMouseY = scrollY + lastMouseY;
        const shouldAnimate = absoluteMouseY <= CONFIG.animationBoundary;

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

    // 이벤트 핸들러
    const mouseMoveHandler = (event) => {
        lastMouseY = event.clientY;
        const scrollY = window.scrollY || window.pageYOffset;
        const absoluteMouseY = scrollY + event.clientY;

        if (absoluteMouseY <= CONFIG.animationBoundary) {
            handleMouseMove(event);
        }
        checkAndToggle();
    };

    const scrollHandler = () => {
        checkAndToggle();
    };

    // 이벤트 리스너 등록
    document.addEventListener('mousemove', mouseMoveHandler);
    window.addEventListener('scroll', scrollHandler);
    window.addEventListener('resize', handleResize);

    // 클린업 함수
    window.addEventListener('beforeunload', () => {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
        document.removeEventListener('mousemove', mouseMoveHandler);
        window.removeEventListener('scroll', scrollHandler);
        window.removeEventListener('resize', handleResize);
    });
});