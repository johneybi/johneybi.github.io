import { gsap } from "gsap";

document.addEventListener("DOMContentLoaded", () => {
    const typingElement = document.getElementById("typing");
    if (typingElement) {
        const originalText = typingElement.textContent;
        typingElement.style.minHeight = typingElement.offsetHeight + 'px';
        typingElement.textContent = ''; // Start empty

        gsap.to({}, {
            delay: 0.5,
            duration: originalText.length * 0.08,
            ease: "none",
            onUpdate: function () {
                const progress = this.progress();
                const currentLength = Math.floor(progress * originalText.length);
                typingElement.textContent = originalText.substring(0, currentLength);
            }
        });
    }



    const typingSecondElement = document.getElementById("typingSecond");
    if (typingSecondElement) {
        gsap.matchMedia().add({
            // 1280px 초과 뷰포트
            isDesktop: "(min-width: 1281px)",
            // 1280px 이하 뷰포트
            isMobile: "(max-width: 1280px)"
        }, (context) => {
            let { isDesktop } = context.conditions;

            gsap.to(typingSecondElement, {
                delay: 1.4,
                duration: 1.5,
                x: isDesktop ? 268 : 160, // 화면 너비에 따라 x값 변경
                ease: "power2.inOut"
            });
        });
    }

    const andMarkElement = document.getElementById("andMark");
    if (andMarkElement) {
        // 1. 1초부터 1.4초까지 왼쪽에서 페이드인하며 날아오는 애니메이션
        gsap.from(andMarkElement, {
            delay: 0.8,
            duration: 0.6,
            x: -150, // 왼쪽 화면 밖에서 시작 (거리는 조절 가능)
            opacity: 0,
            ease: "bounce.out"
        });

        // 2. 2초 뒤부터 3초 간격으로 360도 회전하는 애니메이션
        gsap.to(andMarkElement, {
            delay: 3.4, // (날아오기 끝 1.4초 + 대기 2초)
            rotationY: 360, // 세로(Y)축을 기준으로 360도 회전
            duration: 1, // 1초 동안 회전
            ease: "expo.inOut", // 더 빠르고 역동적인 느낌을 주는 이징
            repeat: -1, // 무한 반복
            repeatDelay: 5 // 반복 사이 4초 대기 (총 5초 간격)
        });
    }

    const rollingElement = document.getElementById("rolling");
    if (rollingElement) {
        const originalText = rollingElement.textContent;

        const computedStyle = window.getComputedStyle(rollingElement);
        const lineHeight = computedStyle.lineHeight;
        const fontStyle = computedStyle.fontStyle;

        rollingElement.textContent = '';
        rollingElement.style.display = 'inline-block';
        rollingElement.style.lineHeight = lineHeight;

        for (const char of originalText) {
            const charContainer = document.createElement('span');
            charContainer.style.display = 'inline-block';
            charContainer.style.position = 'relative';
            charContainer.style.verticalAlign = 'top';

            // clip-path 사용으로 overflow: hidden 대체
            charContainer.style.clipPath = 'inset(0 -20% -20% -20%)'; // 좌우 여유 공간 확보

            if (char === ' ') {
                charContainer.innerHTML = '&nbsp;';
                charContainer.style.width = '0.25em';
            } else {
                const charInner = document.createElement('span');
                charInner.textContent = char;
                charInner.style.display = 'inline-block';
                charInner.style.lineHeight = 'inherit';

                charContainer.appendChild(charInner);
            }

            rollingElement.appendChild(charContainer);
        }

        gsap.from(rollingElement.querySelectorAll("span > span"), {
            delay: 0.4,
            duration: 1.0,
            yPercent: 100,
            ease: "power3.out",
            stagger: 0.06,
            onComplete: function () {
                console.log('Rolling animation completed');
            }
        });
    }

});