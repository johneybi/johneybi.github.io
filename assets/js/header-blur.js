function setHeaderBlur(config) {
    const {
        targetId,
        scrollDivisor = 300,
        stickyThreshold = 16,
        disableBlur = false
    } = config;

    const blurElement = document.getElementById(targetId);
    if (!blurElement) return;

    const header = document.querySelector('.fixed.inset-x-0');
    const mainMenu = document.querySelector('.main-menu');

    let ticking = false;

    const updateHeaderBlur = () => {
        const scroll = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;

        if (!disableBlur) {
            blurElement.style.opacity = scroll / scrollDivisor;
        }

        // 스티키 헤더 처리
        if (header) {
            if (scroll > stickyThreshold) {
                header.classList.add('is-sticky');
            } else {
                header.classList.remove('is-sticky');
            }
        }

        ticking = false;
    };

    function requestTick() {
        if (!ticking) {
            window.requestAnimationFrame(updateHeaderBlur);
            ticking = true;
        }
    }

    window.addEventListener('scroll', requestTick, { passive: true });
    updateHeaderBlur();
}

// 실행 부분
document.addEventListener('DOMContentLoaded', function () {
    const script = document.currentScript || document.querySelector('script[src*="header-blur"]');

    const targetId = script?.getAttribute('data-header-blur-id') || 'menu-blur';
    const scrollDivisor = Number(script?.getAttribute('data-scroll-divisor') || 300);
    const stickyThreshold = Number(script?.getAttribute('data-sticky-threshold') || 16);

    const settings = JSON.parse(localStorage.getItem('a11ySettings') || '{}');
    const disableBlur = settings.disableBlur || false;

    setHeaderBlur({
        targetId,
        scrollDivisor,
        stickyThreshold,
        disableBlur
    });
});