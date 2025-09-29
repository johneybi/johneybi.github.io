document.addEventListener('DOMContentLoaded', function () {
    const animatedElement = document.querySelector(
        '.interactive-svg-background'
    );

    if (animatedElement) {
        let targetAngle = 0;
        let currentAngle = 0;
        let targetX = 10,
            currentX = 10;
        let targetY = 15,
            currentY = 15;

        const smoothingFactor = 0.05;
        const maxSpeedPerFrame = 1.5;

        let animationFrameId = null;
        let lastMouseY = 0;

        // ✅ 마우스 위치 기반 회전
        function handleMouseMove(event) {
            const centerX = window.innerWidth / 2;
            const centerY = 440;

            const deltaX = event.clientX - centerX;
            const deltaY = event.clientY - centerY;

            const angleInRadians = Math.atan2(deltaY, deltaX);
            let angleInDegrees = angleInRadians * (180 / Math.PI);

            let normalizedAngle = (angleInDegrees + 90 + 360) % 360;

            let diff = normalizedAngle - (((currentAngle % 360) + 360) % 360);
            if (diff > 180) diff -= 360;
            if (diff < -180) diff += 360;

            targetAngle = currentAngle + diff;
        }

        // 애니메이션 루프
        function animate() {
            let deltaAngle = targetAngle - currentAngle;
            let step = deltaAngle * smoothingFactor;
            step = Math.max(
                -maxSpeedPerFrame,
                Math.min(step, maxSpeedPerFrame)
            );
            currentAngle += step;

            const angleInRadians = (currentAngle * Math.PI) / 180;
            targetX = Math.cos(angleInRadians) * 10;
            targetY = 15 + Math.sin(angleInRadians) * 5;

            currentX += (targetX - currentX) * smoothingFactor;
            currentY += (targetY - currentY) * smoothingFactor;

            animatedElement.style.setProperty(
                '--mouse-angle',
                `${currentAngle}deg`
            );
            animatedElement.style.setProperty('--x-offset', `${currentX}vw`);
            animatedElement.style.setProperty('--y-offset', `${currentY}vw`);

            animationFrameId = requestAnimationFrame(animate);
        }

        // ✅ 조건 체크 및 애니메이션 토글
        function checkAndToggle() {
            const scrollY = window.scrollY || window.pageYOffset;
            const absoluteMouseY = scrollY + lastMouseY;

            // 스크롤 + 마우스Y가 880 이하일 때만 애니메이션
            if (absoluteMouseY <= 880) {
                if (!animationFrameId) {
                    animate();
                }
            } else {
                if (animationFrameId) {
                    cancelAnimationFrame(animationFrameId);
                    animationFrameId = null;
                }
            }
        }

        // 마우스 이벤트
        document.addEventListener('mousemove', function (event) {
            lastMouseY = event.clientY;

            const scrollY = window.scrollY || window.pageYOffset;
            const absoluteMouseY = scrollY + event.clientY;

            if (absoluteMouseY <= 880) {
                handleMouseMove(event);
            }

            checkAndToggle();
        });

        // 스크롤 이벤트
        window.addEventListener('scroll', function () {
            checkAndToggle();
        });
    }
});