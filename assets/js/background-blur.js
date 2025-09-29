function setBackgroundBlur(targetId, scrollDivisor = 300, disableBlur = false, isMenuBlur = false, scrollThreshold = 200) {
  if (!targetId) {
    console.error("data-blur-id is null");
    return;
  }
  const blurElement = document.getElementById(targetId);
  if (!blurElement) return;
  if (disableBlur) {
    blurElement.setAttribute("aria-hidden", "true");
    if (!isMenuBlur) {
      blurElement.style.display = "none";
      blurElement.style.opacity = "0";
    } else {
      blurElement.style.display = "";
    }
  } else {
    blurElement.style.display = "";
    blurElement.removeAttribute("aria-hidden");
  }
  const updateBlur = () => {
    if (!disableBlur || isMenuBlur) {
      const scroll = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
      // 스크롤이 threshold 이하일 때는 opacity 0, 넘으면 계산된 값 적용
      if (scroll <= scrollThreshold) {
        blurElement.style.opacity = "0";
      } else {
        // threshold를 넘은 스크롤 값만 계산에 사용
        blurElement.style.opacity = (scroll - scrollThreshold) / scrollDivisor;
      }
    }
  };
  blurElement.setAttribute("role", "presentation");
  blurElement.setAttribute("tabindex", "-1");
  window.addEventListener("scroll", updateBlur);
  updateBlur();
}

document.querySelectorAll("script[data-blur-id]").forEach((script) => {
  const targetId = script.getAttribute("data-blur-id");
  const scrollDivisor = Number(script.getAttribute("data-scroll-divisor") || 300);
  const scrollThreshold = Number(script.getAttribute("data-scroll-threshold") || 200); // 새로운 속성 추가
  const isMenuBlur = targetId === "menu-blur";
  const settings = JSON.parse(localStorage.getItem("a11ySettings") || "{}");
  const disableBlur = settings.disableBlur || false;
  setBackgroundBlur(targetId, scrollDivisor, disableBlur, isMenuBlur, scrollThreshold);
});