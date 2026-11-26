/* 플란체 로드맵 — 데이터: 단계, 운동(3D 키프레임 + 자세 설명), 주간 루틴, 레벨 테스트, 출처 */
(function () {
  'use strict';

  const phases = [
    { id: 0, name: '기초 체력', short: '기초', m: [0, 3], mlabel: '0–3개월', key: 'pushup',
      goal: '미는 힘, 코어, 손목을 만들어 플란체 훈련을 버틸 몸을 준비합니다.',
      exit: '푸시업 15회 · 딥스 8회 · 할로우 바디 30초', ex: ['pushup', 'wrist', 'scap', 'hollow', 'dips', 'row'], sup: [] },
    { id: 1, name: '린과 균형', short: '린·균형', m: [3, 6], mlabel: '3–6개월', key: 'lean',
      goal: '어깨를 손보다 앞으로 내미는 플란체 린과, 손 위에서 균형을 잡는 프로그 스탠드를 익힙니다.',
      exit: '플란체 린 30초 · 프로그 스탠드 20초', ex: ['lean', 'frog', 'pike', 'lsit'], sup: ['dips', 'row'] },
    { id: 2, name: '턱 플란체', short: '턱', m: [6, 12], mlabel: '6–12개월', key: 'tuck',
      goal: '발을 바닥에서 떼고 팔을 편 채 버티는 첫 번째 진짜 플란체입니다.',
      exit: '턱 플란체 15초', ex: ['tuck', 'pppu'], sup: ['lean', 'lsit', 'dips'] },
    { id: 3, name: '어드밴스드 턱', short: '어드밴스드', m: [12, 24], mlabel: '1–2년', key: 'advtuck',
      goal: '등을 평평하게 펴고 엉덩이를 열어 지렛대를 늘립니다. 가장 오래 머무는 구간입니다.',
      exit: '어드밴스드 턱 10초 (등 수평)', ex: ['advtuck'], sup: ['tuck', 'pppu', 'pike'] },
    { id: 4, name: '스트래들 플란체', short: '스트래들', m: [24, 36], mlabel: '2–3년', key: 'straddle',
      goal: '다리를 펴되 넓게 벌려 지렛대를 줄인 플란체입니다.',
      exit: '스트래들 10초', ex: ['straddle'], sup: ['advtuck', 'pppu'] },
    { id: 5, name: '풀 플란체', short: '풀', m: [36, 60], mlabel: '3–5년+', key: 'full',
      goal: '다리를 모은 채 머리부터 발끝까지 바닥과 수평. 최종 목표입니다.',
      exit: '풀 플란체 3–5초 이상', ex: ['full'], sup: ['straddle', 'lean'] }
  ];

  const G = {
    bodyLine: ['line', 'shM', 'anM', 'ok', '어깨–발목 일직선'],
    lean: ['lean', 'wrM', 'shM'],
    wristV: ['vert', 'wrM', .78, 'ref'],
    com: ['com'],
    elbow: ['angle', 'shR', 'elR', 'wrR', '팔꿈치']
  };

  const exercises = [
    {
      id: 'wrist', name: '손목 준비운동', en: 'Wrist prep', phase: 0, b: 'quad', front: 0, pic: 1,
      rx: '매 운동 전 5분', rest: '세트 사이 휴식 없음', tempo: '앞뒤 10회씩 × 손 방향 2가지',
      why: '플란체는 손목을 90° 가까이 젖힌 채 체중을 버팁니다. 손목과 전완을 미리 데우고, 하중에 조금씩 적응시켜야 통증 없이 오래 훈련할 수 있습니다.',
      cues: ['네발 자세에서 손은 어깨 바로 아래, 무릎은 엉덩이 아래', '손바닥 전체, 특히 손가락 뿌리로 바닥을 꾹 누릅니다', '팔꿈치를 편 채 어깨를 손 앞뒤로 천천히 옮깁니다', '손가락 방향을 앞 → 옆 → 뒤(무릎 쪽)로 바꿔 가며 반복합니다', '늘어나는 느낌까지만. 찌릿한 통증이 오면 범위를 줄입니다'],
      errors: ['손바닥 아래쪽(손목 쪽)에만 체중이 실리고 손가락이 뜸', '반동을 주며 빠르게 흔듦'],
      muscles: { names: '손목 굴곡근·신전근, 전완', keys: ['fore'] },
      easier: { text: '무릎 쪽으로 체중을 더 실어 손목 부하를 줄이기' }, harder: { text: '손가락 끝으로 들어 올리기(핑거 리프트), 주먹 쥐고 버티기' },
      base: { hw: .16, prot: .2, neck: -12 },
      keys: [
        { t: 0, p: { lean: 0 }, label: '손은 어깨 아래, 손가락은 앞으로' },
        { t: 1.5, p: { lean: .09 }, label: '어깨를 손보다 앞으로 천천히' },
        { t: 3.0, p: { lean: -.05 }, label: '뒤로 돌아오기' },
        { t: 4.5, p: { lean: .09 } },
        { t: 6.0, p: { lean: 0 }, label: '손 방향 바꾸기' },
        { t: 6.7, p: { liftL: 1, fingL: 90 } },
        { t: 7.4, p: { liftL: 0, fingL: 180 } },
        { t: 8.1, p: { liftR: 1, fingR: 90 } },
        { t: 8.8, p: { liftR: 0, fingR: 180 }, label: '손가락을 무릎 쪽으로, 뒤로 앉으며 손목 안쪽 늘리기' },
        { t: 10.3, p: { lean: -.08 } },
        { t: 11.8, p: { lean: .01 } },
        { t: 13.3, p: { lean: -.08 } },
        { t: 14.8, p: { lean: 0 }, label: '손 방향 되돌리기' },
        { t: 15.5, p: { liftL: 1, fingL: 90 } },
        { t: 16.2, p: { liftL: 0, fingL: 0 } },
        { t: 16.9, p: { liftR: 1, fingR: 90 } },
        { t: 17.6, p: { liftR: 0, fingR: 0 } }
      ], tail: .4,
      guides: [G.wristV, G.lean]
    },
    {
      id: 'pushup', name: '푸시업', en: 'Push-up', phase: 0, b: 'prone', front: 0, pic: 1,
      rx: '3세트 × 8–15회', rest: '휴식 90초', tempo: '2초 내리고 1초 올리기', pass: '3세트 × 15회 이상, 마지막 회까지 같은 자세',
      why: '미는 힘의 기본입니다. 플란체에 필요한 가슴·삼두·전면 삼각근의 바탕 근력과, 몸을 한 덩어리로 유지하는 힘을 만듭니다.',
      cues: ['손은 어깨 바로 아래, 어깨너비보다 조금 넓게', '머리–엉덩이–발목이 일직선. 엉덩이와 복부에 힘', '팔꿈치는 몸통에서 약 45°로 뒤를 향하게', '가슴이 바닥 가까이 갈 때까지 내려가고 끝까지 밀기', '맨 위에서 바닥을 한 번 더 밀어 견갑을 벌립니다(전인)'],
      errors: ['허리와 엉덩이가 처져 몸이 꺾임', '팔꿈치를 옆으로 90° 벌림', '반만 내려갔다 올라옴'],
      muscles: { names: '대흉근, 삼두근, 전면 삼각근, 복근', keys: ['chest', 'tri', 'delt', 'core'] },
      easier: { text: '무릎 대고 푸시업, 손을 벤치에 올린 인클라인 푸시업' }, harder: { text: '다이아몬드 푸시업', ex: ['pppu'] },
      base: { hw: .23, fing: 8, flare: 45, neck: -6, footRef: 5 },
      keys: [
        { t: 0, p: { lean: .02, drop: 0, prot: .4 }, label: '2초 동안 내려가기' },
        { t: 2.0, p: { lean: .09, drop: .39, prot: -.35 }, label: '가슴이 바닥 가까이' },
        { t: 2.4, p: {}, label: '1초 만에 밀어 올리기' },
        { t: 3.4, p: { lean: .02, drop: 0, prot: .55 }, label: '맨 위에서 견갑 밀어내기' },
        { t: 4.0, p: { prot: .4 } }
      ], tail: .3,
      mistake: { p: { lum: -14, hip: -14, flare: 80 }, at: { 1: { drop: .33 }, 2: { drop: .33 } }, seg: ['hips', 'elbow'], text: '엉덩이·허리가 처지고 팔꿈치가 옆으로 벌어진 자세' },
      guides: [G.bodyLine, G.elbow]
    },
    {
      id: 'scap', name: '스캐퓰러 푸시업', en: 'Scapula push-up', phase: 0, b: 'prone', front: 0, pic: 3,
      rx: '3세트 × 10–15회', rest: '휴식 60초', tempo: '맨 위에서 2초 정지',
      why: '팔을 편 채 견갑골만 움직여 전거근을 깨웁니다. 플란체의 핵심인 "바닥을 밀어 등을 둥글게"(견갑 전인) 감각을 가장 쉽게 배우는 동작입니다.',
      cues: ['팔꿈치는 처음부터 끝까지 완전히 편 상태', '견갑을 모으면 가슴이 손 사이로 살짝 내려갑니다(후인)', '바닥을 밀어내 등 위쪽을 둥글게 올립니다(전인)', '엉덩이와 몸통은 플랭크처럼 고정'],
      errors: ['팔꿈치가 굽혀져 작은 푸시업이 됨', '고개만 숙였다 들었다 함'],
      muscles: { names: '전거근, 승모근 하부·중부', keys: ['serr', 'trap'] },
      easier: { text: '무릎 대고 하기, 벽에 손 짚고 하기' }, harder: { text: '플란체 린 자세에서 하기', ex: ['lean'] },
      base: { hw: .21, fing: 10, lean: .02, drop: 0, flare: 30, neck: -6 },
      keys: [
        { t: 0, p: { prot: 0, tho: 0 }, label: '팔을 편 채 견갑만 모으기' },
        { t: 1.2, p: { prot: -1, tho: -6 }, label: '가슴이 손 사이로 살짝 내려감' },
        { t: 1.8, p: {}, label: '바닥을 밀어 등 위쪽을 둥글게' },
        { t: 3.0, p: { prot: 1, tho: 12 }, label: '2초 유지' },
        { t: 5.0, p: {}, label: '중립으로' },
        { t: 5.6, p: { prot: 0, tho: 0 } }
      ], tail: .3,
      mistake: { at: { 1: { drop: .09 }, 2: { drop: .09 } }, seg: ['elbow'], text: '팔꿈치가 굽혀져 일반 푸시업처럼 된 자세' },
      guides: [G.elbow, G.bodyLine]
    },
    {
      id: 'hollow', name: '할로우 바디 홀드', en: 'Hollow body hold', phase: 0, b: 'supine', front: 180, pic: 2,
      rx: '3–5세트 × 20–45초', rest: '휴식 60초', tempo: '목표 60초',
      why: '플란체의 몸통 모양(골반을 말고 복부를 조인 상태)을 바닥에서 배웁니다. 이후 모든 단계에서 몸이 바나나처럼 꺾이지 않게 해 줍니다.',
      cues: ['허리를 바닥에 완전히 붙입니다(골반 후방경사)', '어깨와 다리를 동시에 바닥에서 띄웁니다', '팔은 귀 옆으로 뻗고, 다리는 모아 발끝까지 폅니다', '힘들면 무릎을 굽히거나 팔을 몸 옆에 두세요'],
      errors: ['허리가 바닥에서 떠 아치가 생김', '목만 들어 올림', '숨을 참음'],
      muscles: { names: '복직근, 복횡근, 고관절 굴곡근', keys: ['core', 'quad'] },
      easier: { text: '무릎 굽힌 할로우, 팔을 몸 옆에 두기' }, harder: { text: '할로우 락(앞뒤로 흔들기)', ex: ['lsit'] },
      base: { armE: 172, armAbd: 8, plantar: 40, elev: .4 },
      keys: [
        { t: 0, p: { pitch: -89, lum: 0, tho: 0, neck: 0, hipF: 0, armE: 178 }, label: '누워서 팔을 머리 위로' },
        { t: 1.0, p: {}, label: '허리를 바닥에 붙이며 어깨·다리 들기' },
        { t: 2.4, p: { pitch: -100, lum: 14, tho: 14, neck: 10, hipF: 12, armE: 180 }, label: '홀드: 허리 밀착, 다리 모으기' },
        { t: 5.6, p: {}, label: '천천히 내려놓기' },
        { t: 6.8, p: { pitch: -89, lum: 0, tho: 0, neck: 0, hipF: 0, armE: 178 } }
      ], tail: .8,
      mistake: { at: { 2: { pitch: -84, lum: -12, hipF: 16 }, 3: { pitch: -84, lum: -12, hipF: 16 } }, seg: ['hips', 'back'], text: '허리가 바닥에서 떠 아치가 생긴 자세' },
      guides: [['floor', 'hipM', 'shM', 'ok', '허리는 바닥에 밀착']]
    },
    {
      id: 'dips', name: '딥스', en: 'Parallel bar dip', phase: 0, b: 'bars', front: 0, pic: 1, props: ['pbars'],
      rx: '3세트 × 5–12회', rest: '휴식 2분', tempo: '2초 내리기', pass: '3세트 × 8–10회',
      why: '체중 전체를 위아래로 미는 운동입니다. 팔을 편 지지 자세(서포트)에서 어깨를 눌러 내리는 힘과, 삼두·가슴 근력을 기릅니다.',
      cues: ['시작은 팔을 펴고 어깨를 귀에서 멀리 내린 서포트', '상체를 살짝 앞으로 기울이고 팔꿈치는 뒤로', '위팔이 바닥과 평행해질 때까지만 내려갑니다', '맨 위에서 팔꿈치를 끝까지 잠급니다'],
      errors: ['어깨가 귀 쪽으로 으쓱 올라감', '너무 깊이 내려가 어깨 앞쪽이 과하게 늘어남', '팔꿈치가 옆으로 벌어짐'],
      muscles: { names: '삼두근, 대흉근 하부, 전면 삼각근', keys: ['tri', 'chest', 'delt'] },
      easier: { text: '서포트 홀드 10–30초, 천천히 내려가기만 하는 네거티브 딥스, 벤치 딥스' }, harder: { text: '중량 딥스, 링 딥스' },
      base: { barH: 1.15, barX: .25, bal: 1, comOff: 0, neck: -4, hipF: 22, knee: 85, plantar: 40, flare: 8 },
      keys: [
        { t: 0, p: { drop: 0, pitch: 6, prot: .1, elev: -.8, tho: 4 }, label: '2초 동안 내려가기, 상체는 살짝 앞으로' },
        { t: 2.0, p: { drop: .23, pitch: 24, prot: -.25, elev: -.25, tho: 8 }, label: '위팔이 바닥과 평행' },
        { t: 2.3, p: {}, label: '밀어 올리며 팔꿈치 잠금' },
        { t: 3.4, p: { drop: 0, pitch: 6, prot: .1, elev: -.8, tho: 4 }, label: '서포트: 어깨를 귀에서 멀리' },
        { t: 4.2, p: {} }
      ], tail: .2,
      mistake: { at: { 1: { drop: .38, elev: 1, prot: -.6 }, 2: { drop: .38, elev: 1, prot: -.6 } }, seg: ['shoulder'], text: '어깨가 으쓱 올라가고 너무 깊이 내려간 자세' },
      guides: [G.elbow, ['vert', 'wrM', 1.95, 'ref']]
    },
    {
      id: 'row', name: '인버티드 로우', en: 'Inverted row', phase: 0, b: 'row', front: 180, azOff: 28, pic: 1, props: ['rowbar'],
      rx: '3세트 × 8–15회', rest: '휴식 90초', tempo: '1초 당기고 2초 내리기',
      why: '미는 운동만 하면 어깨 앞쪽이 과부하됩니다. 등과 어깨 뒤쪽의 당기는 근육으로 균형을 맞춰 부상을 막습니다. 플란체 루틴에 꼭 함께 넣으세요.',
      cues: ['발뒤꿈치부터 어깨까지 일직선', '가슴을 봉 쪽으로 당기고, 위에서 견갑을 모읍니다', '팔꿈치는 몸통에서 약 45°', '내려갈 때도 천천히, 팔을 끝까지 폅니다'],
      errors: ['엉덩이가 처져 몸이 꺾임', '턱만 봉 위로 내밈', '반동을 씀'],
      muscles: { names: '광배근, 능형근, 후면 삼각근, 이두근', keys: ['lat', 'trap', 'delt', 'bi'] },
      easier: { text: '무릎 굽히기, 봉을 더 높게' }, harder: { text: '발을 높은 곳에 올리기, 풀업(턱걸이)' },
      base: { barH: .95, hw: .27, neck: 12, flare: 45 },
      keys: [
        { t: 0, p: { pull: 0, prot: .3 }, label: '1초 동안 가슴을 봉으로' },
        { t: 1.1, p: { pull: 1, prot: -1 }, label: '견갑 모으고 잠깐 정지' },
        { t: 1.6, p: {}, label: '2초 동안 천천히 내려가기' },
        { t: 3.6, p: { pull: 0, prot: .3 } }
      ], tail: .4,
      mistake: { p: { hip: 24 }, seg: ['hips'], text: '엉덩이가 처져 몸이 꺾인 자세' },
      guides: [['line', 'shM', 'heelM', 'ok', '어깨–뒤꿈치 일직선']]
    },
    {
      id: 'lean', name: '플란체 린', en: 'Planche lean', phase: 1, b: 'prone', front: 0, pic: 1,
      rx: '4–6세트 × 10–30초', rest: '휴식 2분', tempo: '천천히 기울여 버티기', pass: '어깨가 손목보다 15cm 이상 앞에서 30초',
      why: '발을 바닥에 둔 채 플란체의 핵심 자세를 연습합니다. 어깨가 손보다 앞으로 나갈수록 어려워지므로 강도를 세밀하게 조절할 수 있습니다.',
      cues: ['팔꿈치를 완전히 펴고 잠급니다', '바닥을 밀어 등을 둥글게(전인), 어깨는 귀에서 멀리(하강)', '어깨를 손보다 앞으로. 처음 5–10cm에서 시작해 20cm 이상까지', '골반을 말고 엉덩이를 조여 몸을 일직선으로', '손가락은 바깥이나 뒤쪽으로 돌려 손목·이두 부담을 나눕니다', '발끝(발등)으로 밀어 몸을 앞으로 보냅니다'],
      errors: ['팔꿈치가 굽음', '견갑이 모이며 가슴이 바닥으로 꺼짐', '엉덩이가 들림'],
      muscles: { names: '전면 삼각근, 전거근, 이두근(직선팔 부하), 복근, 손목', keys: ['delt', 'serr', 'bi', 'core', 'fore'] },
      easier: { text: '어깨를 5cm만 앞으로, 무릎 대고 린' }, harder: { text: '어깨를 더 앞으로', ex: ['pppu', 'tuck'] },
      base: { hw: .2, fing: 75, flare: 15, neck: -10, footRef: 0 },
      keys: [
        { t: 0, p: { lean: .02, prot: .6, elev: -.3, lum: 2, tho: 6 }, label: '어깨를 손보다 앞으로 천천히' },
        { t: 1.8, p: { lean: .17, prot: 1, elev: -.7, lum: 7, tho: 13 }, label: '홀드: 팔 잠금, 견갑 전인, 골반 말기' },
        { t: 5.2, p: {}, label: '천천히 돌아오기' },
        { t: 6.6, p: { lean: .02, prot: .6, elev: -.3, lum: 2, tho: 6 } }
      ], tail: .6,
      mistake: { at: { 1: { drop: .07, prot: -.7, tho: -6, hip: 6 }, 2: { drop: .07, prot: -.7, tho: -6, hip: 6 } }, seg: ['elbow', 'back'], text: '팔꿈치가 굽고 견갑이 모여 가슴이 꺼진 자세' },
      guides: [G.wristV, G.lean, G.bodyLine]
    },
    {
      id: 'frog', name: '프로그 스탠드', en: 'Frog stand', phase: 1, b: 'planche', front: 0, pic: 2,
      rx: '4세트 × 10–30초', rest: '휴식 90초', tempo: '발이 뜨면 정지', pass: '20초 이상 안정적으로',
      why: '손 위에서 균형을 잡는 감각을 배웁니다. 체중을 손으로 옮기는 "기울기"를 익히는 턱 플란체 직전 단계입니다.',
      cues: ['쪼그려 앉아 손을 어깨너비로 짚고 손가락을 벌려 바닥을 움켜쥡니다', '무릎을 팔꿈치 바깥쪽, 위팔 뒤에 올립니다', '시선은 손보다 앞쪽 바닥', '천천히 앞으로 기울여 발이 저절로 뜨게 합니다', '손가락 끝으로 눌러 앞으로 넘어가지 않게 조절'],
      errors: ['팔꿈치가 바깥으로 벌어져 무릎을 받치지 못함', '기울기가 부족해 발이 뜨지 않음', '점프하듯 발을 차올림'],
      muscles: { names: '전면 삼각근, 삼두근, 손목·손가락, 코어', keys: ['delt', 'tri', 'fore', 'core'] },
      easier: { text: '발끝을 바닥에 둔 채 체중만 손으로 옮기기, 머리 앞에 쿠션' }, harder: { text: '팔을 펴는 스트레이트 암 프로그', ex: ['tuck'] },
      base: { hw: .2, fing: 0, bent: .2, flare: 35, prot: .3, elev: -.2, neck: -18, abd: 24, plantar: 30, kneeAim: 1, comOff: .04, gFeetZ: -.3, gFw: .16 },
      keys: [
        { t: 0, p: { g: 1, gLean: .04, pitch: 60, lum: 18, tho: 18, hipF: 118, knee: 125 }, label: '쪼그려 손 짚기, 무릎을 팔꿈치 바깥에' },
        { t: 1.4, p: { g: 1, gLean: .1, pitch: 85, lum: 18, tho: 20, hipF: 124, knee: 130 }, label: '앞으로 기울이며 체중을 손으로' },
        { t: 2.6, p: { g: 0, pitch: 95, hipF: 128, knee: 135 }, label: '발이 뜨면 균형 유지' },
        { t: 5.6, p: {}, label: '천천히 발 내리기' },
        { t: 6.8, p: { g: 1, gLean: .04, pitch: 60, lum: 18, tho: 18, hipF: 118, knee: 125 } }
      ], tail: .6,
      mistake: { p: { flare: 80 }, seg: ['elbow'], text: '팔꿈치가 바깥으로 벌어진 자세' },
      guides: [G.com, G.wristV]
    },
    {
      id: 'pike', name: '파이크 푸시업', en: 'Pike push-up', phase: 1, b: 'pike', front: 0, pic: 1,
      rx: '3세트 × 6–12회', rest: '휴식 2분', tempo: '2초 내리고 1초 올리기',
      why: '머리 위로 미는 힘(전면 삼각근·삼두)을 기릅니다. 플란체는 어깨 앞쪽이 매우 강해야 하고, 이 동작은 물구나무 푸시업으로 가는 길이기도 합니다.',
      cues: ['엉덩이를 높이 들어 몸을 거꾸로 된 V자로', '발을 손 쪽으로 걸어와 상체를 수직에 가깝게', '머리는 손보다 앞쪽 바닥으로. 머리와 두 손이 삼각형', '팔꿈치는 뒤를 향하게(옆으로 벌리지 않기)'],
      errors: ['팔꿈치가 양옆으로 벌어짐', '머리가 두 손 사이로 수직으로 떨어짐', '엉덩이가 내려가 일반 푸시업이 됨'],
      muscles: { names: '전면 삼각근, 삼두근, 상부 승모근', keys: ['delt', 'tri', 'trap'] },
      easier: { text: '손을 벤치에 올린 인클라인 파이크' }, harder: { text: '발을 의자에 올린 파이크 → 벽 물구나무 푸시업' },
      base: { hw: .2, fing: 5, flare: 35, feetZ: -.72, tilt: 58, neck: 4 },
      keys: [
        { t: 0, p: { lean: -.04, drop: 0, prot: .3, elev: .6 }, label: '2초 동안 머리를 손 앞쪽 바닥으로' },
        { t: 2.0, p: { lean: .12, drop: .34, prot: 0, elev: .3 }, label: '머리와 두 손이 삼각형' },
        { t: 2.3, p: {}, label: '밀어 올리기' },
        { t: 3.4, p: { lean: -.04, drop: 0, prot: .3, elev: .6 }, label: '팔을 펴고 어깨로 바닥 밀기' },
        { t: 4.0, p: {} }
      ], tail: .2,
      mistake: { p: { flare: 85 }, at: { 1: { lean: 0 }, 2: { lean: 0 } }, seg: ['elbow', 'head'], text: '팔꿈치가 옆으로 벌어지고 머리가 손 사이로 떨어진 자세' },
      guides: [G.elbow, ['floor', 'wrM', 'head', 'ok', '머리는 손 앞쪽']]
    },
    {
      id: 'lsit', name: 'L-싯', en: 'L-sit', phase: 1, b: 'bars', front: 0, pic: 2, props: ['ptx'],
      rx: '5–8세트 × 5–15초', rest: '휴식 90초', tempo: '누적 30–60초',
      why: '팔을 편 채 어깨를 눌러 내리는 힘과 복부·고관절의 압축력을 동시에 기릅니다. 플란체 홀드에 필요한 직선팔 근력과 코어를 함께 단련합니다.',
      cues: ['팔꿈치를 잠그고 어깨를 끝까지 내립니다(목을 길게)', '다리를 모아 무릎을 펴고 발끝까지 뻗습니다', '다리를 바닥과 평행하게 들어 올립니다', '상체는 살짝 뒤로, 엉덩이는 두 손 사이'],
      errors: ['어깨가 으쓱 올라감', '무릎이 굽고 다리가 처짐', '등이 과하게 말림'],
      muscles: { names: '고관절 굴곡근, 복근, 삼두근, 광배근(어깨 하강)', keys: ['core', 'quad', 'tri', 'lat'] },
      easier: { text: '무릎을 가슴 쪽으로 굽힌 턱 L-싯, 한 다리씩 펴기' }, harder: { text: 'V-싯, 바닥에서 L-싯' },
      base: { barH: .15, barX: .24, bal: 1, comOff: 0, neck: -2, prot: .1, elev: -.9, plantar: 50, abd: 0 },
      keys: [
        { t: 0, p: { sit: 1, drop: 0, pitch: -6, lum: 6, tho: 8, hipF: 88, knee: 0 }, label: '패럴렛 사이에 앉아 손 짚기' },
        { t: 1.0, p: {}, label: '바닥을 눌러 엉덩이와 다리 띄우기' },
        { t: 2.0, p: { sit: 0, pitch: -8, lum: 8, tho: 10, hipF: 92, knee: 0 }, label: '홀드: 다리 수평, 어깨 내리기' },
        { t: 5.4, p: {}, label: '천천히 앉기' },
        { t: 6.4, p: { sit: 1, pitch: -6, lum: 6, tho: 8, hipF: 88 } }
      ], tail: .6,
      mistake: { at: { 2: { elev: .7, knee: 28, hipF: 104, tho: 22 }, 3: { elev: .7, knee: 28, hipF: 104, tho: 22 } }, seg: ['shoulder', 'legs'], text: '어깨가 으쓱 올라가고 무릎이 굽은 자세' },
      guides: [['line', 'hipM', 'anM', 'ok', '다리 수평'], G.wristV]
    },
    {
      id: 'pppu', name: '수도 플란체 푸시업', en: 'Pseudo planche push-up (PPPU)', phase: 2, b: 'prone', front: 0, pic: 1,
      rx: '3–4세트 × 5–10회', rest: '휴식 2분', tempo: '2초 내리고 1초 올리기', pass: '3세트 × 8회, 어깨가 계속 손 앞',
      why: '플란체 린 자세 그대로 하는 푸시업입니다. 손이 허리 옆에 오도록 기울여, 전면 삼각근과 이두 힘줄을 플란체 각도에서 강화합니다.',
      cues: ['손을 허리 옆에 두고 손가락은 바깥·뒤쪽으로', '내려갈 때도 어깨가 손보다 앞에 있게 유지', '팔꿈치를 몸통 쪽으로 붙여 뒤로 굽힙니다', '올라와서 견갑을 벌려 등을 밀어 올립니다', '몸은 처음부터 끝까지 일직선'],
      errors: ['내려가며 기울기를 잃고 어깨가 손 뒤로 빠짐', '팔꿈치가 옆으로 벌어짐', '엉덩이가 먼저 내려감'],
      muscles: { names: '전면 삼각근, 대흉근, 이두근, 전거근', keys: ['delt', 'chest', 'bi', 'serr'] },
      easier: { text: '기울기 줄이기(어깨를 손보다 5–10cm 앞), 무릎 대고 하기' }, harder: { text: '기울기 늘리기, 턱 플란체 푸시업' },
      base: { hw: .2, fing: 115, flare: 12, neck: -10, footRef: 0 },
      keys: [
        { t: 0, p: { lean: .21, drop: 0, prot: 1, elev: -.5, lum: 6, tho: 12 }, label: '2초 동안 내려가기, 기울기 유지' },
        { t: 2.0, p: { lean: .25, drop: .3, prot: -.1, elev: -.2, lum: 4, tho: 4 }, label: '어깨는 계속 손보다 앞' },
        { t: 2.3, p: {}, label: '밀어 올리기' },
        { t: 3.4, p: { lean: .21, drop: 0, prot: 1, elev: -.5, lum: 6, tho: 12 }, label: '맨 위에서 견갑 전인' },
        { t: 4.2, p: {} }
      ], tail: .2,
      mistake: { at: { 1: { lean: .08, drop: .2, flare: 70 }, 2: { lean: .08, drop: .2, flare: 70 } }, seg: ['shoulder', 'elbow'], text: '어깨가 손 뒤로 빠지고 팔꿈치가 벌어진 자세' },
      guides: [G.wristV, G.lean, G.bodyLine]
    },
    {
      id: 'tuck', name: '턱 플란체', en: 'Tuck planche', phase: 2, b: 'planche', front: 0, pic: 2,
      rx: '6–10세트 × 3–10초', rest: '휴식 2–3분', tempo: '최대 홀드의 70–80%', pass: '15초 깔끔하게',
      why: '첫 번째 진짜 플란체입니다. 발이 바닥에서 떨어진 상태로, 팔을 편 채 손 위에서 균형을 잡습니다.',
      cues: ['팔꿈치를 완전히 폅니다. 굽히면 프로그 스탠드입니다', '바닥을 밀어 등을 둥글게, 어깨는 귀에서 멀리', '무릎을 가슴 쪽으로 당기고 엉덩이를 어깨 높이까지', '어깨가 손보다 앞. 무게중심이 손 위에 와야 뜹니다', '손가락은 옆이나 뒤로, 손바닥 전체로 바닥 밀기'],
      errors: ['팔꿈치가 굽음', '엉덩이가 어깨보다 낮게 처짐', '무릎을 팔에 걸쳐 쉼'],
      muscles: { names: '전면 삼각근, 전거근, 이두근, 코어, 손목', keys: ['delt', 'serr', 'bi', 'core', 'fore'] },
      easier: { text: '높은 패럴렛에서, 한 발만 살짝 들기', ex: ['frog'] }, harder: { text: '등을 점점 펴기', ex: ['advtuck'] },
      base: { hw: .2, fing: 90, flare: 15, neck: -8, plantar: 45, abd: 6, comOff: .03, gFeetZ: -.36, gFw: .12 },
      keys: [
        { t: 0, p: { g: 1, gLean: .05, pitch: 55, lum: 18, tho: 20, prot: .6, elev: -.4, hipF: 118, knee: 130 }, label: '쪼그려 손 짚기, 팔은 곧게' },
        { t: 1.2, p: {}, label: '어깨를 앞으로 보내며 발 띄우기' },
        { t: 2.6, p: { g: 0, pitch: 74, lum: 16, tho: 24, prot: 1, elev: -.7, hipF: 128, knee: 145 }, label: '홀드: 엉덩이를 어깨 높이로, 등 둥글게' },
        { t: 6.0, p: {}, label: '발 내리기' },
        { t: 7.2, p: { g: 1, gLean: .05, pitch: 55, lum: 18, tho: 20, prot: .6, elev: -.4, hipF: 118, knee: 130 } }
      ], tail: .6,
      mistake: { at: { 2: { bent: .07, pitch: 58 }, 3: { bent: .07, pitch: 58 } }, seg: ['elbow', 'hips'], text: '팔꿈치가 굽고 엉덩이가 어깨보다 낮은 자세' },
      guides: [G.com, G.wristV, ['level', 'shM', 'hipM', { k: [2] }]]
    },
    {
      id: 'advtuck', name: '어드밴스드 턱 플란체', en: 'Advanced tuck planche', phase: 3, b: 'planche', front: 0, pic: 2,
      rx: '6–8세트 × 3–10초', rest: '휴식 2–3분', tempo: '최대 홀드의 70–80%', pass: '10초, 등이 바닥과 수평',
      why: '등을 평평하게 펴고 엉덩이를 열어 다리가 몸에서 멀어집니다. 지렛대가 길어져 턱보다 훨씬 어렵고, 스트래들로 가기 전 가장 오래 머무는 구간입니다.',
      cues: ['등은 바닥과 평행하게 평평', '허벅지와 몸통이 약 90°', '엉덩이 높이 = 어깨 높이', '턱보다 어깨를 더 앞으로 보냅니다', '전인과 하강은 그대로 유지'],
      errors: ['등이 다시 둥글게 말려 턱으로 돌아감', '엉덩이만 높이 들림', '팔꿈치가 굽음'],
      muscles: { names: '전면 삼각근, 전거근, 이두근, 코어, 둔근', keys: ['delt', 'serr', 'bi', 'core', 'glute'] },
      easier: { text: '등을 반만 편 하프 턱', ex: ['tuck'] }, harder: { text: '한 다리 펴기', ex: ['straddle'] },
      base: { hw: .2, fing: 100, flare: 15, neck: -8, plantar: 50, abd: 6, comOff: .03, prot: 1, elev: -.7 },
      keys: [
        { t: 0, p: { pitch: 74, lum: 16, tho: 24, hipF: 128, knee: 145 }, label: '턱 플란체에서 시작' },
        { t: 1.0, p: {}, label: '등을 펴며 엉덩이 열기' },
        { t: 2.6, p: { pitch: 86, lum: 2, tho: 6, hipF: 80, knee: 105 }, label: '홀드: 등 수평, 허벅지와 몸통 약 90°' },
        { t: 6.0, p: {}, label: '다시 턱으로' },
        { t: 7.4, p: { pitch: 74, lum: 16, tho: 24, hipF: 128, knee: 145 } }
      ], tail: .6,
      mistake: { at: { 2: { pitch: 100, tho: 20, lum: 12, bent: .05 }, 3: { pitch: 100, tho: 20, lum: 12, bent: .05 } }, seg: ['back', 'elbow'], text: '등이 다시 말리고 엉덩이가 높아진 자세' },
      guides: [G.com, ['level', 'shM', 'hipM', { k: [2] }], ['angle', 'shM', 'hipM', 'knM', '고관절', { k: [1, 2] }]]
    },
    {
      id: 'straddle', name: '스트래들 플란체', en: 'Straddle planche', phase: 4, b: 'prone', front: 0, pic: 2,
      rx: '5–8세트 × 2–8초', rest: '휴식 3분', tempo: '밴드 보조 가능', pass: '10초',
      why: '다리를 펴되 넓게 벌려 지렛대를 줄인 플란체입니다. 풀 플란체 직전의 주요 단계입니다.',
      cues: ['다리를 넓게 벌리고 무릎과 발끝을 폅니다', '엉덩이와 어깨가 같은 높이, 몸이 바닥과 수평', '골반을 말아 허리가 꺾이지 않게', '어깨를 손보다 크게 앞으로(팔 기울기 약 40–50°)', '팔꿈치 잠금, 전인·하강 유지'],
      errors: ['엉덩이가 굽어 다리가 처짐', '허리가 꺾여 다리만 들림', '팔꿈치가 굽음'],
      muscles: { names: '전면 삼각근, 전거근, 이두근, 둔근, 허리', keys: ['delt', 'serr', 'bi', 'glute', 'core'] },
      easier: { text: '저항 밴드를 골반에 걸어 보조, 한 다리 플란체', ex: ['advtuck'] }, harder: { text: '다리 간격 좁히기', ex: ['full'] },
      base: { hw: .2, fing: 100, flare: 15, neck: -8, abd: 40, prot: 1, elev: -.7 },
      baseBy: { prone: { footRef: 10 }, planche: { plantar: 50, comOff: .03 } },
      keys: [
        { t: 0, b: 'prone', p: { lean: .18, lum: 4, tho: 10 }, label: '다리를 벌린 플란체 린' },
        { t: 1.4, b: 'prone', p: { lean: .3 }, label: '어깨를 더 앞으로, 발에 실린 체중이 빠짐' },
        { t: 2.6, b: 'planche', p: { pitch: 84, lum: 4, tho: 8, hipF: 0, knee: 0 }, label: '홀드: 다리 펴고 몸 수평' },
        { t: 5.8, p: {}, label: '발끝 내리기' },
        { t: 7.0, b: 'prone', p: { lean: .18 } }
      ], tail: .6,
      mistake: { byB: { planche: { hipF: 28, pitch: 94, lum: 10 } }, seg: ['hips', 'legs'], text: '엉덩이가 굽어 다리가 처진 자세' },
      guides: [G.com, ['level', 'shM', 'hipM', { k: [2] }], ['angle', 'wrR', 'shR', 'hipM', '팔–몸통', { k: [2] }]]
    },
    {
      id: 'full', name: '풀 플란체', en: 'Full planche', phase: 5, b: 'prone', front: 0, pic: 2,
      rx: '4–6세트 × 2–6초', rest: '휴식 3분', tempo: '밴드 보조·네거티브 활용', pass: '3–5초 이상 수평',
      why: '최종 목표입니다. 다리를 모은 채 몸 전체가 바닥과 수평이 되고, 무게중심이 손 바로 위에 옵니다.',
      cues: ['머리부터 발끝까지 수평 일직선', '다리를 모으고 엉덩이를 조여 발끝까지 폅니다', '팔꿈치 잠금, 견갑 전인·하강', '손이 허리~골반 아래에 오도록 깊이 기울입니다', '처음에는 밴드 보조로 자세를 먼저 익힙니다'],
      errors: ['허리가 꺾인 바나나 자세', '팔꿈치가 굽음', '엉덩이가 처짐'],
      muscles: { names: '전면 삼각근, 전거근, 이두근, 둔근, 코어 전체', keys: ['delt', 'serr', 'bi', 'glute', 'core', 'quad'] },
      easier: { text: '하프 레이(무릎만 굽힌 풀), 밴드 보조', ex: ['straddle'] }, harder: { text: '풀 플란체 푸시업, 홀드 시간 늘리기' },
      base: { hw: .2, fing: 100, flare: 15, neck: -8, abd: 0, prot: 1, elev: -.7 },
      baseBy: { prone: { footRef: 10 }, planche: { plantar: 55, comOff: .03 } },
      keys: [
        { t: 0, b: 'prone', p: { lean: .22, lum: 4, tho: 10 }, label: '깊은 플란체 린' },
        { t: 1.4, b: 'prone', p: { lean: .32 }, label: '어깨를 최대한 앞으로' },
        { t: 2.6, b: 'planche', p: { pitch: 86, lum: 3, tho: 6, hipF: 0, knee: 0 }, label: '홀드: 머리부터 발끝까지 수평' },
        { t: 5.8, p: {}, label: '발끝 내리기' },
        { t: 7.0, b: 'prone', p: { lean: .22 } }
      ], tail: .6,
      mistake: { byB: { planche: { lum: -14, hipF: -12, pitch: 80, bent: .03 } }, seg: ['back', 'hips'], text: '허리가 꺾인 바나나 자세' },
      guides: [G.com, ['line', 'shM', 'anM', 'ok', '수평 일직선', { k: [2] }], ['angle', 'wrR', 'shR', 'hipM', '팔–몸통', { k: [2] }]]
    }
  ];

  // 주간 루틴: A = 플란체·밀기 중심, B = 당기기·코어 + 가벼운 스킬 (주 4회일 때)
  const routine = {
    0: {
      A: [
        { k: '워밍업', items: [['wrist', '5분'], ['scap', '1 × 10회']] },
        { k: '근력', items: [['pushup', '3 × 8–15회'], ['dips', '3 × 5–12회', '안 되면 서포트 홀드 3 × 20초'], ['row', '3 × 8–15회']] },
        { k: '코어', items: [['hollow', '3 × 20–45초'], ['scap', '2 × 12회']] }
      ],
      B: [
        { k: '워밍업', items: [['wrist', '5분']] },
        { k: '당기기·코어', items: [['row', '4 × 8–15회'], ['scap', '3 × 12회'], ['hollow', '4 × 20–45초']] },
        { k: '가벼운 밀기', items: [['pushup', '2 × 10회', '여유 있게']] }
      ]
    },
    1: {
      A: [
        { k: '워밍업', items: [['wrist', '5분'], ['scap', '1 × 10회']] },
        { k: '스킬', items: [['lean', '4 × 10–20초'], ['frog', '4 × 10–30초']] },
        { k: '근력', items: [['pike', '3 × 6–12회'], ['dips', '3 × 8–12회'], ['row', '3 × 10–15회']] },
        { k: '코어', items: [['lsit', '5 × 5–15초', '턱 L-싯부터'], ['hollow', '2 × 30–45초']] }
      ],
      B: [
        { k: '워밍업', items: [['wrist', '5분']] },
        { k: '가벼운 스킬', items: [['frog', '3 × 20초']] },
        { k: '당기기·밀기', items: [['row', '4 × 10–15회'], ['pushup', '3 × 12–20회']] },
        { k: '코어', items: [['hollow', '3 × 30–60초'], ['lsit', '4 × 10초']] }
      ]
    },
    2: {
      A: [
        { k: '워밍업', items: [['wrist', '5분'], ['scap', '1 × 10회'], ['lean', '2 × 10초', '가볍게']] },
        { k: '스킬', items: [['tuck', '6–8 × 3–10초', '최대 홀드의 70–80%'], ['lean', '3 × 15–30초', '더 깊게']] },
        { k: '근력', items: [['pppu', '3 × 5–10회'], ['dips', '3 × 8–12회'], ['row', '3 × 8–12회', '풀업으로 대체 가능']] },
        { k: '코어', items: [['lsit', '4 × 10–15초'], ['hollow', '2 × 45초']] }
      ],
      B: [
        { k: '워밍업', items: [['wrist', '5분']] },
        { k: '가벼운 스킬', items: [['tuck', '3 × 5초'], ['frog', '2 × 20초']] },
        { k: '근력', items: [['pike', '3 × 8–12회'], ['row', '4 × 10회']] },
        { k: '코어', items: [['hollow', '3 × 45초']] }
      ]
    },
    3: {
      A: [
        { k: '워밍업', items: [['wrist', '5분'], ['scap', '1 × 10회'], ['tuck', '2 × 5초']] },
        { k: '스킬', items: [['advtuck', '6–8 × 3–8초'], ['tuck', '2 × 최대', '볼륨 채우기']] },
        { k: '근력', items: [['pppu', '4 × 6–10회', '기울기 깊게'], ['dips', '4 × 6–10회', '중량 가능'], ['row', '3 × 6–10회', '풀업 권장']] },
        { k: '코어', items: [['lsit', '4 × 15초'], ['hollow', '2 × 60초']] }
      ],
      B: [
        { k: '워밍업', items: [['wrist', '5분']] },
        { k: '가벼운 스킬', items: [['lean', '4 × 20–30초']] },
        { k: '근력', items: [['pike', '3 × 8–12회'], ['row', '4 × 10회']] },
        { k: '코어', items: [['hollow', '3 × 45초']] }
      ]
    },
    4: {
      A: [
        { k: '워밍업', items: [['wrist', '5분'], ['scap', '1 × 10회'], ['tuck', '2 × 5초']] },
        { k: '스킬', items: [['straddle', '5–8 × 2–8초', '밴드 보조'], ['advtuck', '3 × 최대']] },
        { k: '근력', items: [['pppu', '4 × 5–8회', '최대 기울기'], ['dips', '4 × 6–10회'], ['row', '3 × 6–10회', '풀업 권장']] },
        { k: '코어', items: [['lsit', '3 × 15초'], ['hollow', '2 × 60초']] }
      ],
      B: [
        { k: '워밍업', items: [['wrist', '5분']] },
        { k: '가벼운 스킬', items: [['lean', '4 × 15–20초', '최대한 깊게']] },
        { k: '근력', items: [['pike', '3 × 8회'], ['row', '4 × 10회']] },
        { k: '코어', items: [['hollow', '3 × 45초']] }
      ]
    },
    5: {
      A: [
        { k: '워밍업', items: [['wrist', '5분'], ['scap', '1 × 10회'], ['advtuck', '2 × 5초']] },
        { k: '스킬', items: [['full', '4–6 × 2–6초', '밴드 보조·네거티브'], ['straddle', '3 × 최대']] },
        { k: '근력', items: [['pppu', '4 × 5–8회'], ['dips', '4 × 6–10회'], ['row', '3 × 6–10회', '풀업 권장']] },
        { k: '코어', items: [['hollow', '3 × 60초']] }
      ],
      B: [
        { k: '워밍업', items: [['wrist', '5분']] },
        { k: '가벼운 스킬', items: [['lean', '4 × 15–20초'], ['straddle', '3 × 3초', '밴드 보조']] },
        { k: '근력', items: [['pike', '3 × 8회'], ['row', '4 × 10회']] },
        { k: '코어', items: [['lsit', '3 × 15초']] }
      ]
    }
  };
  const weeks = {
    3: ['A', '쉼', 'A', '쉼', 'A', '쉼', '쉼'],
    4: ['A', 'B', '쉼', 'A', 'B', '쉼', '쉼']
  };

  // 레벨 테스트 항목과 단계 승급 기준
  const tests = [
    { id: 'pushup', label: '푸시업', unit: '회', ex: 'pushup', def: 12 },
    { id: 'dips', label: '딥스', unit: '회', ex: 'dips', def: 4 },
    { id: 'hollow', label: '할로우 바디', unit: '초', ex: 'hollow', def: 25 },
    { id: 'lean', label: '플란체 린', unit: '초', ex: 'lean', def: 0, note: '어깨가 손목보다 10cm 이상 앞' },
    { id: 'frog', label: '프로그 스탠드', unit: '초', ex: 'frog', def: 0 },
    { id: 'tuck', label: '턱 플란체', unit: '초', ex: 'tuck', def: 0 },
    { id: 'advtuck', label: '어드밴스드 턱', unit: '초', ex: 'advtuck', def: 0 },
    { id: 'straddle', label: '스트래들', unit: '초', ex: 'straddle', def: 0 }
  ];
  const gates = [
    [['pushup', 15], ['dips', 8], ['hollow', 30]],
    [['lean', 30], ['frog', 20]],
    [['tuck', 15]],
    [['advtuck', 10]],
    [['straddle', 10]]
  ];

  const principles = [
    ['스킬은 먼저', '플란체 홀드는 워밍업 직후, 가장 힘이 남아 있을 때 합니다.'],
    ['홀드는 70–80%', '최대 홀드 시간의 70–80%로 여러 세트. 자세가 무너지기 전에 멈춥니다. 최대 10초라면 7초 × 6세트.'],
    ['상한을 채우면 다음', '횟수 범위의 상한(예: 3 × 12)을 두 번 연속 채우면 다음 단계나 더 어려운 변형으로 넘어갑니다.'],
    ['볼륨은 천천히', '주당 운동량 증가는 10% 이내. 4–6주마다 1주는 세트 수를 절반으로 줄여(디로드) 손목과 힘줄이 따라오게 합니다.'],
    ['미는 만큼 당기기', '인버티드 로우나 풀업을 매번 넣어 어깨 앞뒤 균형을 맞춥니다.'],
    ['회복', '수면 7시간 이상, 단백질은 체중 1kg당 1.6g 안팎. 체중이 가벼울수록 플란체가 쉬워지지만 무리한 감량은 하지 않습니다.']
  ];
  const safety = [
    '손목 준비운동은 매번. 통증이 있으면 패럴렛이나 주먹 쥐고 하기로 각도를 바꿉니다.',
    '팔꿈치 안쪽(이두 힘줄)이나 어깨 앞쪽에 찌릿한 통증이 오면 그날은 직선팔 훈련을 멈춥니다.',
    '기울기(린)는 몇 cm씩만 늘립니다. 갑자기 깊게 기울이면 손목과 이두 힘줄에 부담이 큽니다.',
    '턱 플란체 이상은 앞으로 넘어질 수 있으니 머리 앞에 쿠션을 두고, 손가락으로 브레이크를 거는 연습부터 합니다.'
  ];

  const sources = [
    ['r/bodyweightfitness 위키: 플란체', 'https://www.reddit.com/r/bodyweightfitness/wiki/exercises/planche', '좋은 플란체까지 대부분 2년 정도 걸린다는 설명, 단계 구성'],
    ['GMB: Advanced Strength Progressions', 'https://gmb.io/advanced-strength-progressions/', '대부분은 풀 플란체에 도달하지 못한다는 현실적인 기대치'],
    ['The REAL Way To Train For The Planche (Skool)', 'https://www.skool.com/awesome-ninja-fitness/the-real-way-to-train-for-the-planche', '단계별 예상 기간(턱 1–6개월 ~ 풀 1–3년+, 기반이 있을 때)'],
    ['Antranik: 정적 홀드 진행 단계', 'https://antranik.org/progression-exercises-for-static-holds/', '턱 → 어드밴스드 턱 → 한 다리 → 스트래들 → 하프 레이 → 풀의 유연한 순서'],
    ['Overcoming Gravity 2판 운동 차트 (Steven Low)', 'https://www.calisthenics-101.co.uk/wp-content/uploads/2020/05/Overcoming-Gravity-2nd-Edition-Exercise-Charts.pdf', '난이도 단계별 플란체 진행표'],
    ['GymnasticBodies: Planche Leans', 'https://www.gymnasticbodies.com/?p=16163', '플란체 린의 견갑 전인·하강, 골반 후방경사 큐'],
    ['Calisteniapp: In-depth analysis of the planche', 'https://calisteniapp.com/articles/in-depth-analysis-planche', '골반 후방경사와 견갑 전인에 대한 코치들 간 관점 차이'],
    ['Liftosaur: Pseudo planche push-up', 'https://www.liftosaur.com/exercises/bodyweight-pseudo-planche-pushup', 'PPPU 손 위치(손가락 바깥 약 45°)와 기울기 유지'],
    ['Equinox: Planche progression', 'https://equinox.com/articles/2020/03/planche-progression-workout', '플란체는 보통 수년이 걸린다는 설명'],
    ['Stronger by Science: 이두 힘줄 통증', 'https://www.strongerbyscience.com/biceps-tendinopathy/', '이두 힘줄 과부하 기전과 관리']
  ];

  window.PL_DATA = { phases, exercises, routine, weeks, tests, gates, principles, safety, sources };
})();
