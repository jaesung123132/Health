// 자세 검증: 엔진을 Node에서 불러와 모든 운동의 프레임을 수치로 검사합니다.
// 실행: npm install && npm run check
// 검사 항목: 바닥 뚫림, 손 고정, 곧은 팔(편 팔 구간), 발끝 접지, 홀드 중 무게중심이 손 위에 있는지
const path = require('path'), fs = require('fs'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
global.window = global;
global.THREE = require('three');
for (const f of ['js/engine.js', 'js/data.js']) vm.runInThisContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), { filename: f });
const PL = window.PL, D = window.PL_DATA;
const FLOOR_HANDS = ['prone', 'planche', 'pike', 'quad'];
let fails = 0;
for (const ex of D.exercises) {
  PL.prepare(ex);
  const S = PL.newSkel();
  for (const wrong of [false, true]) {
    if (wrong && !ex.mistake) continue;
    let minY = 1e9, wrist = 0, bent = 0, toe = 0, com = 0, nan = false;
    for (let s = 0; s < 240; s++) {
      const P = PL.poseAt(ex, ex.dur * s / 240, wrong);
      PL.solve(P, S);
      if ([S.pel.p, S.head, ...S.sh, ...S.wr, ...S.an, S.com].some(v => !isFinite(v.x + v.y + v.z))) nan = true;
      minY = Math.min(minY, PL.lowestY(S));
      const k = ex._keys[P.ki], k1 = ex._keys[(P.ki + 1) % ex._keys.length];
      if (FLOOR_HANDS.includes(k.b) && FLOOR_HANDS.includes(k1.b) && k.b !== 'quad') S.wr.forEach(w => { wrist = Math.max(wrist, Math.abs(w.y - PL.DIM.wristH)); });
      if (P.straight >= 1) for (let i = 0; i < 2; i++) bent = Math.max(bent, 180 - PL.angleAt(S.sh[i], S.el[i], S.wr[i]));
      if (k.b === 'prone' && k1.b === 'prone') for (let i = 0; i < 2; i++) toe = Math.max(toe, Math.abs(PL.TOE.clone().applyQuaternion(S.fq[i]).add(S.an[i]).y));
      if (!wrong && k.b === 'planche' && k1.b === 'planche' && !(k.p.g > 0) && !(k1.p.g > 0)) {
        com = Math.max(com, Math.abs(S.com.z - (S.wr[0].z + S.wr[1].z) / 2 - (k.p.comOff || 0)));
      }
    }
    const bad = nan || minY < -0.012 || wrist > 0.004 || bent > 4 || toe > 0.012 || com > 0.012;
    if (bad) fails++;
    console.log(`${bad ? 'FAIL' : 'ok  '} ${ex.id.padEnd(9)} ${wrong ? '실수' : '정자세'}  바닥 ${(minY * 100).toFixed(1)}cm  손 ±${(wrist * 1000).toFixed(1)}mm  팔 굽힘 ${bent.toFixed(1)}°  발끝 ±${(toe * 100).toFixed(1)}cm  무게중심 ±${(com * 100).toFixed(1)}cm${nan ? '  NaN' : ''}`);
  }
}
console.log(fails ? `\n실패 ${fails}건` : '\n모든 자세 통과');
process.exit(fails ? 1 : 0);
