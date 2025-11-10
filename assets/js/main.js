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

    gsap.set("#animated-svg", { visibility: "visible" }); // SVG 보이기
    const tl = gsap.timeline();

    // 초기 상태 (모두 중심, 투명)
    gsap.set(["#leftFar", "#leftClose", "#upFar", "#upClose", "#diagonal", "#center"], {
        x: 336, y: 336, opacity: 0, transformOrigin: "center center"
    });
    gsap.set("#diagonal", { rotation: 90 });
    gsap.set("#centerH, #centerV", { scaleX: 1, scaleY: 1, transformOrigin: "center center" }); // 명시적 초기 스케일

    // 전체 애니메이션 1초 뒤 시작 (원본 타이밍 그대로 +1초 오프셋)
    // 1.000초 ~ 1.766초 : 중심 정사각형 → 십자가 모핑 (scale로 GPU 가속, 완벽히 매끄러움)
    //    - 처음 0.5초는 opacity 0이라 보이지 않음 (원본과 동일)
    //    - fade-in 시점에 이미 중간 정도 얇아진 상태로 등장 → 나머지 천천히 얇아지며 십자가 완성
    tl.to("#centerH", { scaleY: 0.05, duration: 2, ease: "power3.inOut" }, 1);
    tl.to("#centerV", { scaleX: 0.05, duration: 2, ease: "power3.inOut" }, 1);

    // 1.0초: 중심 요소가 동적으로 나타나는 애니메이션 (크기+투명도)
    tl.fromTo("#center",
        { scale: 0.5, opacity: 0 }, // 시작 상태
        { scale: 1, opacity: 1, duration: 0.5, ease: "back.out(1.7)" }, // 종료 상태
        2 // 타임라인에서 1초 시점에 시작
    );

    // 1.1초: 나머지 요소들 페이드인
    tl.to(["#leftFar", "#leftClose", "#upFar", "#upClose", "#diagonal"], {
        opacity: 1, duration: 0.6, ease: "power2.out"
    }, 2.2);

    // 1.5초 ~ 2.7초 : 날아가기 (원본 t=30~102, 1.2초, power3.inOut으로 easing 99% 일치)
    tl.to("#leftFar", { x: 40, duration: 1.2, ease: "power3.inOut" }, 2.8);
    tl.to("#leftClose", { x: 188, duration: 1.2, ease: "power3.inOut" }, 3);
    tl.to("#upFar", { y: 40, duration: 1.2, ease: "power3.inOut" }, 2.8);
    tl.to("#upClose", { y: 188, duration: 1.2, ease: "power3.inOut" }, 3);
    tl.to("#diagonal", { x: 190, y: 188, duration: 1.2, ease: "power3.inOut" }, 2.5);

    // 3.0초 ~ 3.733초 : 대각선 십자가 스핀 (원본 t=120~164, 315° 회전)
    tl.to("#diagonal", { rotation: 405, duration: 0.733, ease: "power4.inOut" }, 4.5);



});