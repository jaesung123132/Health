# 해부 모델 가공 파이프라인

`assets/anatomy/`의 근육·뼈 모델을 다시 만드는 방법입니다. 모든 작업은 가공용 PC나 클라우드 환경에서 하며, 결과물만 저장소에 넣습니다.

## 준비

1. 원본: [BodyExplorer](https://github.com/JohanBellander/BodyExplorer)의 `public/anatomy.glb`, `public/skeleton.glb`
   (BodyParts3D CC BY-SA 2.1 JP + Z-Anatomy CC BY-SA 4.0)
2. Python 3.10+ 와 `pip install numpy scipy fast-simplification`
3. `npm install` (meshoptimizer 0.22.0, three 0.128.0)

## 실행

```bash
python3 -I tools/anatomy/build_anatomy.py --src <BodyExplorer/public> --raw <작업 폴더>
node tools/anatomy/encode_anatomy.js --raw <작업 폴더> --out assets/anatomy
npm run check
```

## 하는 일

| 단계 | 내용 |
|---|---|
| 선택 | `parts.py`: 운동에 필요한 근육 224개(좌우), 뼈 189개. 얼굴·후두·골반저 등 제외 |
| 좌표 | BodyParts3D(mm, Z 위, -Y 앞) → 앱(m, Y 위, Z 앞), 발바닥을 y=0에 |
| 좌우 확인 | 이름의 left/right가 실제 위치와 다르면 위치를 따름(원본의 flexor pollicis brevis 좌우가 바뀌어 있음) |
| 관절 중심 | 상완골두·대퇴골두 구 맞춤, 상과 중점, 월상골, 복사뼈 중점, 척추뼈 몸통 → 앱의 신체 치수(`js/engine.js`의 DIM) |
| 간소화 | 면적 비례로 삼각형 배분: PC용 근육 19만·뼈 6만, 휴대폰용 근육 8만·뼈 2만 |
| 스킨 가중치 | 근육마다 허용된 뼈(기시→정지 순서) 중 가까운 뼈일수록 큰 가중치, 아래팔은 엎침·뒤침 비틀림 뼈로 나눔, 메시 위에서 평활, 상위 4개 |
| 근육 중심선 | 주성분 축 위 5점. 양 끝은 기시·정지 뼈에 고정, 가운데는 단면의 평균 가중치. 길이 변화(수축·이완)와 부풂 계산에 사용 |
| 압축 | 위치 16비트, 법선 팔면체 8비트, meshoptimizer 정점·인덱스 코덱 → PC용 1.6MB, 휴대폰용 0.7MB |

브라우저에서는 `js/vendor/meshopt_decoder.js`(WebAssembly)로 풀고, WebAssembly를 못 쓰면 `meshopt_decoder_ref.js`(순수 JS)로 풉니다.
