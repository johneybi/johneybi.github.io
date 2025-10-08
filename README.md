


































































































<!-- ## 🛠️ 개발 환경 설정 및 실행 가이드

이 프로젝트는 [HUGO](https://gohugo.io/)를 기반으로 [Tailwind CSS](https://tailwindcss.com/)와 [Blowfish](https://github.com/nicokaiser/blowfish) 와 함께 구성되어 있습니다.

### ✅ 필수 명령어

Tailwind CSS를 컴파일하고 감시 모드로 실행하려면 다음 명령어를 **프로젝트 루트 디렉터리에서** 실행하세요:

`npx tailwindcss -c ./themes/blowfish/tailwind.config.js \
  -i ./themes/blowfish/assets/css/main.css \
  -o ./assets/css/compiled/main.css -w` 

> ⚠️ 반드시 **루트 디렉터리**에서 실행해야 `layouts` 폴더 등을 정상적으로 인식합니다.

----------

### ⚙️ 개발 서버 실행

`npm run dev # 개발 서버 실행 
 npm run server # hugo 서버 실행` 

----------

### 🔄 Blowfish 테마 업데이트

Blowfish 테마를 최신 상태로 업데이트하려면 아래 명령어를 차례대로 실행하세요:

`cd themes/blowfish
git fetch origin main
git reset --hard origin/main cd ../..` 

----------

### 🧠 개발 환경 팁 (Windows)

-   **WSL(Windows Subsystem for Linux)** 환경에서 작업하는 것을 권장합니다.
    
-   Windows 환경에서도 실행은 가능하지만, 설정 이슈와 불안정성으로 인해 작업 효율이 떨어질 수 있습니다.
    
-   특히 Tailwind CSS 관련 watch 기능이 제대로 작동하지 않거나, 파일 변경이 감지되지 않는 경우가 많습니다.
    

----------

### 📁 디렉터리 구조 주의사항

-   Tailwind CSS 구성 파일: `./themes/blowfish/tailwind.config.js`
    
-   입력 CSS 파일: `./themes/blowfish/assets/css/main.css`
    
-   출력 CSS 파일: `./assets/css/compiled/main.css`
    

---------- -->