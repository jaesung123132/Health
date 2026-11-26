# 플란체 로드맵

기초 체력이 없는 상태에서 시작해 **풀 플란체**(손과 코어의 힘만으로 몸을 바닥과 수평으로 띄우는 자세)까지 가는 장기 맨몸운동 루틴입니다. 각 운동의 올바른 자세를 **3D 아바타 애니메이션**으로 여러 방향에서 보여 주는 웹앱이 함께 들어 있습니다.

`index.html`을 브라우저로 열면 바로 동작합니다(인터넷 연결 필요: three.js와 글꼴을 CDN에서 불러옴). GitHub Pages로 올리면 휴대폰에서도 앱처럼 쓸 수 있습니다.

---

## 1. 조사 요약: 기초 없는 성인이 플란체까지 가는 길

### 현실적인 기간

| 단계 | 대략적인 기간 | 다음 단계로 넘어가는 기준 |
|---|---|---|
| 0. 기초 체력 | 0–3개월 | 푸시업 15회, 딥스 8회, 할로우 바디 30초 |
| 1. 린과 균형 | 3–6개월 | 플란체 린 30초(어깨가 손목보다 10cm 이상 앞), 프로그 스탠드 20초 |
| 2. 턱 플란체 | 6–12개월 | 턱 플란체 15초 |
| 3. 어드밴스드 턱 | 1–2년 | 어드밴스드 턱 10초(등 수평) |
| 4. 스트래들 플란체 | 2–3년 | 스트래들 10초 |
| 5. 풀 플란체 | 3–5년 이상 | 풀 플란체 3–5초 이상 |

- 기간은 체중, 팔 길이, 훈련 빈도에 따라 크게 달라지는 **추정치**입니다. 기반이 있는 사람은 턱 1–6개월, 풀 1–3년 이상으로 보기도 하고, 상당수는 풀 플란체에 끝내 도달하지 못합니다.
- 단계는 날짜가 아니라 **승급 기준을 채웠을 때** 넘어갑니다.

### 필요한 운동 (앱에서 3D로 확인 가능)

| 단계 | 핵심 운동 | 목적 |
|---|---|---|
| 기초 | 손목 준비운동, 푸시업, 스캐퓰러 푸시업, 할로우 바디 홀드, 딥스, 인버티드 로우 | 미는 힘, 견갑 조절, 몸통 고정, 손목 적응, 당기기로 어깨 균형 |
| 린·균형 | 플란체 린, 프로그 스탠드, 파이크 푸시업, L-싯 | 어깨를 손 앞으로 내미는 감각, 손 위 균형, 머리 위로 미는 힘, 직선팔 지지 |
| 턱 | 턱 플란체, 수도 플란체 푸시업(PPPU) | 첫 번째 진짜 플란체, 플란체 각도에서의 근력 |
| 어드밴스드 턱 | 어드밴스드 턱 플란체 | 등을 펴고 엉덩이를 열어 지렛대 늘리기 |
| 스트래들 | 스트래들 플란체 | 다리를 펴되 넓게 벌린 플란체 |
| 풀 | 풀 플란체 | 최종 목표 |

### 모든 플란체 자세에 공통인 핵심

1. **팔꿈치를 완전히 편다.** 굽히면 다른 운동이 됩니다.
2. **견갑 전인 + 하강.** 바닥을 밀어 등을 둥글게, 어깨는 귀에서 멀리.
3. **골반 후방경사.** 엉덩이를 조이고 골반을 말아 허리가 꺾이지 않게.
4. **어깨가 손보다 앞.** 무게중심이 손 바로 위에 와야 몸이 뜹니다. 다리를 펼수록 더 많이 기울여야 합니다(앱에서 무게중심 표시로 확인).
5. **손가락은 바깥이나 뒤로.** 손목과 이두 힘줄의 부담을 나눕니다.

### 주간 구조

- 주 3회(월·수·금) 전신, 또는 주 4회(A: 플란체·밀기 / B: 당기기·코어 + 가벼운 스킬).
- 순서: 손목 준비 → 스킬(정적 홀드) → 근력 → 당기기 → 코어 → 정리.
- 홀드는 최대 시간의 70–80%로 여러 세트, 자세가 무너지기 전에 멈춤.
- 주당 볼륨 증가는 10% 이내, 4–6주마다 1주 디로드. 힘줄·손목은 근육보다 느리게 적응합니다.
- 팔꿈치 안쪽(이두 힘줄)이나 어깨 앞쪽에 찌릿한 통증이 오면 그날 직선팔 훈련은 중단.

---

## 2. 앱 기능

- **단계 사다리**: 0~5단계를 누르면 그 단계의 운동이 나옵니다.
- **3D 아바타**: 15개 운동을 실제 템포로 재생. 측면·정면·대각·위·4분할 시점, 드래그 회전, 확대/축소, 0.5배속.
- **가이드선**: 몸 일직선, 어깨가 손목보다 몇 cm 앞인지, 팔꿈치·고관절 각도, 엉덩이와 어깨 높이 차이, 무게중심 위치를 실시간 표시.
- **주요 근육**: 쓰이는 근육을 색으로 강조.
- **흔한 실수와 비교**: 잘못된 자세를 빨간색으로, 올바른 자세를 반투명으로 겹쳐 보여 줍니다.
- **로드맵**: 5년 축척의 단계별 기간과 승급 기준.
- **주간 루틴**: 단계와 주 3/4회를 고르면 세션 구성이 나오고, 항목을 누르면 3D로 이동.
- **레벨 테스트**: 현재 최대치를 넣으면 시작할 단계와 남은 양을 막대로 보여 줌(입력값은 이 브라우저에만 저장).

### 해부 모드 (근육·뼈)

3D 화면의 **마네킹 / 근육 / 뼈** 전환으로 실제 해부 모델(BodyParts3D·Z-Anatomy의 근육 224개, 뼈 189개)을 같은 동작으로 움직여 볼 수 있습니다.

- **어깨뼈(견갑골)**: 전인·후인 때 갈비뼈를 감싸며 미끄러지고, 팔을 들면 위쪽으로 회전합니다(견갑상완 리듬).
- **아래팔**: 손 방향에 따라 엎침·뒤침으로 비틀립니다(아래팔 근육이 꼬이지 않게 비틀림을 나눠 줌).
- **근육 모양**: 근육 중심선 길이가 줄면 굵어지고 늘면 가늘어집니다.
- **색으로 보기**: *쓰는 정도*(운동별 추정 활성도), *늘어남·줄어듦*(지금 짧아지는지 늘어나는지), *해부 색*.
- **근육 누르기**: 이름, 하는 일, 지금 상태(단축성·신장성·등척성)를 보여 줍니다.
- **지금 일하는 근육**: 근육 묶음별 활성도와 함께 어깨뼈 전인·하강, 위쪽 회전, 팔 들어 올림, 위팔 회전, 아래팔 엎침, 팔꿈치, 허리 각도를 실시간으로 표시합니다.
- 휴대폰은 0.7MB(10만 삼각형), PC는 1.6MB(25만 삼각형) 모델을 처음 켤 때만 불러옵니다. 원본은 34.8MB입니다.

활성도는 근전도 연구와 역학을 바탕으로 한 **추정치**이고, 근육 변형은 실시간 근사(부피 보존)입니다.

## 3. 자세는 어떻게 계산하나

아바타 자세는 손으로 그린 것이 아니라 매 프레임 계산합니다.

- **역운동학(IK)**: 손목과 발끝 위치를 바닥에 고정하고 팔꿈치·무릎을 계산합니다.
- **바닥 접지**: 푸시업·플란체 린은 손목과 발끝이 바닥에 고정된 채 몸통 각도가 정해집니다.
- **균형**: 턱·어드밴스드 턱·스트래들·풀 플란체와 딥스, L-싯은 체절 질량비(Dempster/Winter)로 무게중심을 구해, 무게중심이 손 바로 위에 오도록 어깨 기울기를 자동으로 찾습니다.
- 평균 체형(약 178cm) 기준이라 실제 기울기는 팔 길이와 체형에 따라 다릅니다.

`npm install && npm run check`를 실행하면 모든 운동의 모든 프레임에서 바닥 뚫림, 손 고정, 곧은 팔, 발끝 접지, 무게중심 위치를 수치로 검사합니다.

## 4. 파일 구조

```
index.html              화면 구성과 스타일
js/engine.js            3D 마네킹, IK, 자세 계산기, 렌더러, 카메라, 가이드선, 픽토그램
js/anatomy.js           해부 모드: 근육·뼈 모델을 관절에 연결, 견갑골·아래팔 비틀림, 근육 길이·색
js/data.js              단계, 운동(키프레임과 자세 설명), 주간 루틴, 테스트 기준, 근육 활성도, 출처
js/app.js               화면 조작
js/vendor/              meshoptimizer 디코더(MIT)
assets/anatomy/         압축된 해부 모델(CC BY-SA, LICENSE.txt 참고)
tools/check-poses.js    자세 수치 검증
tools/anatomy/          해부 모델 가공 파이프라인(README 참고)
```

운동을 추가하거나 고치려면 `js/data.js`의 `exercises`에 키프레임(`keys`)과 설명을 넣으면 됩니다. 각 키프레임은 자세 계산기(`prone`, `planche`, `pike`, `quad`, `supine`, `bars`, `row`)에 넘길 값입니다.

## 5. 참고한 자료

- [r/bodyweightfitness 위키: 플란체](https://www.reddit.com/r/bodyweightfitness/wiki/exercises/planche)
- [GMB: Advanced Strength Progressions](https://gmb.io/advanced-strength-progressions/)
- [The REAL Way To Train For The Planche (Skool)](https://www.skool.com/awesome-ninja-fitness/the-real-way-to-train-for-the-planche)
- [Antranik: Progression exercises for static holds](https://antranik.org/progression-exercises-for-static-holds/)
- [Overcoming Gravity 2nd Edition Exercise Charts (Steven Low)](https://www.calisthenics-101.co.uk/wp-content/uploads/2020/05/Overcoming-Gravity-2nd-Edition-Exercise-Charts.pdf)
- [GymnasticBodies: Planche Leans](https://www.gymnasticbodies.com/?p=16163)
- [Calisteniapp: In-depth analysis of the planche](https://calisteniapp.com/articles/in-depth-analysis-planche)
- [Liftosaur: Pseudo planche push-up](https://www.liftosaur.com/exercises/bodyweight-pseudo-planche-pushup)
- [Equinox: Planche progression](https://equinox.com/articles/2020/03/planche-progression-workout)
- [Stronger by Science: Biceps tendinopathy](https://www.strongerbyscience.com/biceps-tendinopathy/)

- 해부 모델: [BodyParts3D](https://lifesciencedb.jp/bp3d/) © The Database Center for Life Science (CC BY-SA 2.1 JP), [Z-Anatomy](https://www.z-anatomy.com/) by Gauthier Kervyn (CC BY-SA 4.0), 정리된 메시 [BodyExplorer](https://github.com/JohanBellander/BodyExplorer)

## 라이선스

- 앱 코드: 아직 라이선스를 정하지 않았습니다. 다른 사람이 쓰게 하려면 LICENSE 파일을 추가하세요.
- `assets/anatomy/` 해부 모델: 원본을 따라 CC BY-SA (`assets/anatomy/LICENSE.txt`)
- `js/vendor/` meshoptimizer 디코더: MIT

> 일반적인 운동 정보이며 의학적 조언이 아닙니다. 통증이나 기존 부상이 있다면 전문가와 상담하세요.
