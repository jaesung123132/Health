/* 플란체 로드맵 — 3D 엔진
   마네킹 관절 구조(FK) + 2관절 IK + 운동별 자세 계산기(바닥 접지, 무게중심 균형) +
   렌더러, 카메라, 가이드선, 픽토그램(SVG).
   좌표: Y 위, 바닥 y=0. 엎드린 자세에서 머리는 +Z, 아바타의 왼쪽은 +X. 단위 m. */
(function () {
  'use strict';
  const T = window.THREE;
  if (!T) return; // three.js를 못 불러오면 3D 없이 설명만 표시
  const D2R = Math.PI / 180, R2D = 180 / Math.PI;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const V = (x, y, z) => new T.Vector3(x || 0, y || 0, z || 0);
  const AX = V(1, 0, 0), ZA = V(0, 0, 1), ZERO = V(), QI = new T.Quaternion();
  const SIDES = [1, -1]; // 0 = 왼쪽(+X), 1 = 오른쪽(-X)

  /* ---------- 신체 치수 (약 178cm 성인) ---------- */
  const DIM = {
    hip: [0.09, -0.07, 0], waist: [0, 0.09, -0.01], chest: [0, 0.16, 0],
    neck: [0, 0.25, -0.012], sh: [0.175, 0.215, -0.005], head: [0, 0.165, 0.02],
    ua: 0.31, fa: 0.26, th: 0.43, sk: 0.42, wristH: 0.033
  };
  const ARM = DIM.ua + DIM.fa, LEG = DIM.th + DIM.sk;
  const TOE = V(0, -0.045, 0.19), HEEL = V(0, -0.035, -0.062);
  const FOOT_R = TOE.length(), FOOT_D = Math.atan2(0.045, 0.19);
  // 체절 질량비 (Dempster/Winter)
  const MASS = { head: .081, che: .216, abd: .139, pel: .142, ua: .028, fa: .016, hand: .006, th: .1, sk: .0465, ft: .0145 };

  const _a = V(), _b = V(), _c = V(), _d = V(), _q = new T.Quaternion(), _m = new T.Matrix4(), _e = new T.Euler();
  const eq = (fx, lat, tw, out) => { _e.set(fx * D2R, tw * D2R, -lat * D2R, 'XYZ'); return out.setFromEuler(_e); };
  const basisQ = (X, Y, Z, out) => { _m.makeBasis(X, Y, Z); return out.setFromRotationMatrix(_m); };
  const rotX = (deg) => new T.Quaternion().setFromAxisAngle(AX, deg * D2R);
  const mid = (a, b, o) => o.addVectors(a, b).multiplyScalar(0.5);

  /* ---------- 자세(Pose): 블렌딩 가능한 값들 ---------- */
  function newPose() {
    const L = () => ({ t: V(), p: V() });
    const H = () => ({ f: V(0, 0, 1), u: V(0, 1, 0), w: 1, curl: 0 });
    const F = () => ({ p: 0, c: V(), cw: 0, flat: 0 });
    return { root: V(), q: new T.Quaternion(), sp: [0, 0, 0, 0, 0, 0, 0, 0, 0], sc: [0, 0, 0, 0],
      a: [L(), L()], l: [L(), L()], h: [H(), H()], f: [F(), F()], straight: 0 };
  }
  function blendPose(A, B, t, o) {
    o.root.lerpVectors(A.root, B.root, t); o.q.copy(A.q).slerp(B.q, t);
    for (let i = 0; i < 9; i++) o.sp[i] = lerp(A.sp[i], B.sp[i], t);
    for (let i = 0; i < 4; i++) o.sc[i] = lerp(A.sc[i], B.sc[i], t);
    for (let i = 0; i < 2; i++) {
      o.a[i].t.lerpVectors(A.a[i].t, B.a[i].t, t); o.a[i].p.lerpVectors(A.a[i].p, B.a[i].p, t);
      o.l[i].t.lerpVectors(A.l[i].t, B.l[i].t, t); o.l[i].p.lerpVectors(A.l[i].p, B.l[i].p, t);
      const ha = A.h[i], hb = B.h[i], ho = o.h[i];
      ho.f.lerpVectors(ha.f, hb.f, t); ho.u.lerpVectors(ha.u, hb.u, t); ho.w = lerp(ha.w, hb.w, t); ho.curl = lerp(ha.curl, hb.curl, t);
      const fa = A.f[i], fb = B.f[i], fo = o.f[i];
      fo.p = lerp(fa.p, fb.p, t); fo.c.lerpVectors(fa.c, fb.c, t); fo.cw = lerp(fa.cw, fb.cw, t); fo.flat = lerp(fa.flat, fb.flat, t);
    }
    o.straight = Math.min(A.straight, B.straight);
    return o;
  }

  /* ---------- 골격(Skeleton) 계산 ---------- */
  function newSkel() {
    const F = () => ({ p: V(), q: new T.Quaternion() });
    const P2 = () => [V(), V()];
    return { pel: F(), wai: F(), che: F(), nek: F(), head: V(),
      sh: P2(), el: P2(), wr: P2(), ab: P2(), hip: P2(), kn: P2(), an: P2(), lb: P2(),
      hq: [new T.Quaternion(), new T.Quaternion()], hZ: P2(), hY: P2(), curl: [0, 0],
      fq: [new T.Quaternion(), new T.Quaternion()], fZ: P2(), fY: P2(), sc: [0, 0, 0, 0], com: V() };
  }
  function solveTorso(P, S) {
    S.pel.p.copy(P.root); S.pel.q.copy(P.q);
    S.wai.p.set(DIM.waist[0], DIM.waist[1], DIM.waist[2]).applyQuaternion(P.q).add(P.root);
    S.wai.q.copy(P.q).multiply(eq(P.sp[0], P.sp[1], P.sp[2], _q));
    S.che.p.set(DIM.chest[0], DIM.chest[1], DIM.chest[2]).applyQuaternion(S.wai.q).add(S.wai.p);
    S.che.q.copy(S.wai.q).multiply(eq(P.sp[3], P.sp[4], P.sp[5], _q));
    S.nek.p.set(DIM.neck[0], DIM.neck[1], DIM.neck[2]).applyQuaternion(S.che.q).add(S.che.p);
    S.nek.q.copy(S.che.q).multiply(eq(P.sp[6], P.sp[7], P.sp[8], _q));
    S.head.set(DIM.head[0], DIM.head[1], DIM.head[2]).applyQuaternion(S.nek.q).add(S.nek.p);
    for (let i = 0; i < 4; i++) S.sc[i] = P.sc[i];
    for (let i = 0; i < 2; i++) {
      const s = SIDES[i], pr = P.sc[i * 2], el = P.sc[i * 2 + 1];
      S.sh[i].set(s * (DIM.sh[0] - 0.012 * pr), DIM.sh[1] + 0.04 * el, DIM.sh[2] + (pr > 0 ? 0.045 : 0.03) * pr)
        .applyQuaternion(S.che.q).add(S.che.p);
      S.hip[i].set(s * DIM.hip[0], DIM.hip[1], DIM.hip[2]).applyQuaternion(P.q).add(P.root);
    }
  }
  // 2관절 IK: 시작점 S → 목표 Tg, 굽힘 방향은 Pole 쪽
  function twoBone(S, Tg, Pole, a, b, E, W, bend) {
    const dir = _a.subVectors(Tg, S); let dist = dir.length();
    if (dist < 1e-6) { dir.set(0, -1, 0); dist = 1e-6; } else dir.divideScalar(dist);
    const r = clamp(dist, Math.abs(a - b) + 1e-4, a + b - 1e-6);
    const pv = _b.subVectors(Pole, S); pv.addScaledVector(dir, -pv.dot(dir));
    if (pv.lengthSq() < 1e-10) { pv.set(0, 0, 1).addScaledVector(dir, -dir.z); if (pv.lengthSq() < 1e-10) pv.set(1, 0, 0).addScaledVector(dir, -dir.x); }
    pv.normalize();
    const cosA = clamp((a * a + r * r - b * b) / (2 * a * r), -1, 1), sinA = Math.sqrt(1 - cosA * cosA);
    E.copy(S).addScaledVector(dir, a * cosA).addScaledVector(pv, a * sinA);
    W.copy(S).addScaledVector(dir, r);
    bend.copy(pv);
  }
  function handFrame(P, S, i) {
    const h = P.h[i];
    const Z = S.hZ[i].subVectors(S.wr[i], S.el[i]).normalize().lerp(h.f, h.w);
    if (Z.lengthSq() < 1e-8) Z.copy(h.f);
    Z.normalize();
    const Y = S.hY[i].copy(h.u); Y.addScaledVector(Z, -Y.dot(Z));
    if (Y.lengthSq() < 1e-8) { Y.set(0, 1, 0).addScaledVector(Z, -Z.y); if (Y.lengthSq() < 1e-8) Y.set(0, 0, 1); }
    Y.normalize();
    basisQ(_c.crossVectors(Y, Z), Y, Z, S.hq[i]); S.curl[i] = h.curl;
  }
  function footFrame(P, S, i) {
    const f = P.f[i];
    const D = _c.subVectors(S.an[i], S.kn[i]).normalize();
    const An = _d.copy(S.lb[i]); An.addScaledVector(D, -An.dot(D));
    if (An.lengthSq() < 1e-8) An.set(0, 0, 1).addScaledVector(D, -D.z);
    An.normalize();
    let p = f.p * D2R;
    if (f.cw > 0) { const v = _a.subVectors(f.c, S.an[i]); p = lerp(p, Math.atan2(v.dot(D), v.dot(An)) - FOOT_D, f.cw); }
    if (f.flat > 0) { let pf = Math.atan2(An.y, -D.y); if (pf < -0.75) pf += Math.PI; else if (pf > 2.0) pf -= Math.PI; p = lerp(p, pf, f.flat); }
    // 바닥 구속: 발끝이 바닥 아래로 내려가면 발목을 돌려 바닥에 닿게
    const fa = TOE.z * An.y - TOE.y * D.y, fb = TOE.z * D.y + TOE.y * An.y, ty = S.an[i].y + fa * Math.cos(p) + fb * Math.sin(p);
    if (ty < 0.004) {
      const R = Math.hypot(fa, fb), c = (0.004 - S.an[i].y) / R;
      if (Math.abs(c) <= 1) {
        const psi = Math.atan2(fb, fa), ac = Math.acos(c), p1 = psi + ac, p2 = psi - ac;
        const d1 = Math.abs(Math.atan2(Math.sin(p1 - p), Math.cos(p1 - p))), d2 = Math.abs(Math.atan2(Math.sin(p2 - p), Math.cos(p2 - p)));
        p = d1 < d2 ? p1 : p2;
      }
    }
    const Z = S.fZ[i].copy(An).multiplyScalar(Math.cos(p)).addScaledVector(D, Math.sin(p));
    const X = _b.crossVectors(An, D).normalize();
    S.fY[i].crossVectors(Z, X);
    basisQ(X, S.fY[i], Z, S.fq[i]);
  }
  function comOf(S) {
    const c = S.com.set(0, 0, 0);
    c.addScaledVector(S.head, MASS.head);
    c.addScaledVector(_a.set(0, .12, .03).applyQuaternion(S.che.q).add(S.che.p), MASS.che);
    c.addScaledVector(_a.set(0, .075, .03).applyQuaternion(S.wai.q).add(S.wai.p), MASS.abd);
    c.addScaledVector(_a.set(0, -.03, .01).applyQuaternion(S.pel.q).add(S.pel.p), MASS.pel);
    for (let i = 0; i < 2; i++) {
      c.addScaledVector(_a.lerpVectors(S.sh[i], S.el[i], .436), MASS.ua);
      c.addScaledVector(_a.lerpVectors(S.el[i], S.wr[i], .43), MASS.fa);
      c.addScaledVector(_a.copy(S.wr[i]).addScaledVector(S.hZ[i], .06), MASS.hand);
      c.addScaledVector(_a.lerpVectors(S.hip[i], S.kn[i], .433), MASS.th);
      c.addScaledVector(_a.lerpVectors(S.kn[i], S.an[i], .433), MASS.sk);
      c.addScaledVector(_a.copy(S.an[i]).addScaledVector(S.fZ[i], .07).addScaledVector(S.fY[i], -.03), MASS.ft);
    }
    return c;
  }
  function solve(P, S) {
    solveTorso(P, S);
    for (let i = 0; i < 2; i++) {
      twoBone(S.sh[i], P.a[i].t, P.a[i].p, DIM.ua, DIM.fa, S.el[i], S.wr[i], S.ab[i]);
      twoBone(S.hip[i], P.l[i].t, P.l[i].p, DIM.th, DIM.sk, S.kn[i], S.an[i], S.lb[i]);
      handFrame(P, S, i); footFrame(P, S, i);
    }
    comOf(S);
    return S;
  }
  // 서로 다른 계산기 사이를 블렌딩할 때 팔을 곧게 유지
  function fixStraight(P, S) {
    if (P.straight <= 0) return;
    solveTorso(P, S);
    let dy = 0;
    for (let i = 0; i < 2; i++) {
      const W = P.a[i].t, Sh = S.sh[i], dx = Sh.x - W.x, dz = Sh.z - W.z;
      dy += (W.y + Math.sqrt(Math.max(0, ARM * ARM - dx * dx - dz * dz)) - Sh.y) / 2;
    }
    P.root.y += dy * P.straight;
  }
  function lowestY(S) {
    let m = 1e9;
    const sp = (pt, r) => { if (pt.y - r < m) m = pt.y - r; };
    const loc = (fr, x, y, z) => _a.set(x, y, z).applyQuaternion(fr.q).add(fr.p);
    sp(loc(S.pel, 0, -.04, -.01), .092); sp(loc(S.wai, 0, .07, -.0), .075); sp(loc(S.che, 0, .07, .0), .075); sp(loc(S.che, 0, .17, .0), .075);
    sp(S.head, .1);
    for (let i = 0; i < 2; i++) {
      sp(S.el[i], .038); sp(S.wr[i], .03); sp(_c.copy(S.wr[i]).addScaledVector(S.hZ[i], .1), .02);
      sp(S.kn[i], .052); sp(S.an[i], .036); sp(_c.lerpVectors(S.hip[i], S.kn[i], .5), .066); sp(_c.lerpVectors(S.kn[i], S.an[i], .5), .046);
      sp(_c.copy(TOE).applyQuaternion(S.fq[i]).add(S.an[i]), .006); sp(_c.copy(HEEL).applyQuaternion(S.fq[i]).add(S.an[i]), .01);
    }
    return m;
  }

  /* ---------- 자세 계산기(builder) ---------- */
  const SK = newSkel();
  const LU = [V(), V()], LBd = [V(), V()];
  function setTorso(P, p) {
    P.sp[0] = p.lum || 0; P.sp[3] = p.tho || 0; P.sp[6] = p.neck || 0;
    P.sc[0] = P.sc[2] = p.prot || 0; P.sc[1] = P.sc[3] = p.elev || 0;
  }
  function torsoAt(P, root, q) { P.root.copy(root); P.q.copy(q); solveTorso(P, SK); return SK; }
  function setLeg(P, i, hip, U, Bd, k) {
    const kn = _b.copy(hip).addScaledVector(U, DIM.th);
    const c = Math.cos(k * D2R), sn = Math.sin(k * D2R);
    P.l[i].t.copy(kn).addScaledVector(U, DIM.sk * c).addScaledVector(Bd, DIM.sk * sn);
    P.l[i].p.copy(kn).addScaledVector(Bd, -0.3);
  }
  // 고관절 굴곡 f, 외전 a, 무릎 굴곡 k (도). 골반 좌표 기준 → 월드 IK 목표
  function legFK(P, i, f, a, k) {
    const s = SIDES[i];
    const U = LU[i].set(0, -1, 0).applyAxisAngle(ZA, s * a * D2R).applyAxisAngle(AX, -f * D2R).applyQuaternion(P.q);
    const Bd = LBd[i].set(0, 0, -1).applyAxisAngle(ZA, s * a * D2R).applyAxisAngle(AX, -f * D2R).applyQuaternion(P.q);
    const hip = _a.set(s * DIM.hip[0], DIM.hip[1], DIM.hip[2]).applyQuaternion(P.q).add(P.root);
    setLeg(P, i, hip, U, Bd, k);
  }
  // 팔 FK: 거상각 e, 거상면 az(0=앞, 90=옆), 팔꿈치 굴곡 k, 가슴 좌표 기준
  function armFK(P, S, i, e, az, k, bHint) {
    const s = SIDES[i];
    const U = _a.set(s * Math.sin(e * D2R) * Math.sin(az * D2R), -Math.cos(e * D2R), Math.sin(e * D2R) * Math.cos(az * D2R)).applyQuaternion(S.che.q);
    const Bd = _b.copy(bHint).applyQuaternion(S.che.q); Bd.addScaledVector(U, -Bd.dot(U));
    if (Bd.lengthSq() < 1e-8) Bd.set(0, 1, 0);
    Bd.normalize();
    const el = _c.copy(S.sh[i]).addScaledVector(U, DIM.ua);
    P.a[i].t.copy(el).addScaledVector(U, DIM.fa * Math.cos(k * D2R)).addScaledVector(Bd, DIM.fa * Math.sin(k * D2R));
    P.a[i].p.copy(el).addScaledVector(Bd, -0.3);
    const h = P.h[i]; h.w = 0; h.curl = 12; h.f.copy(U); h.u.set(s, 0, 0).applyQuaternion(S.che.q);
  }
  // 손바닥을 바닥에: 손목 위치, 손가락 방향(fing: 0=앞, 90=바깥, 180=뒤), 팔꿈치 방향(flare)
  function armFloor(P, i, hw, fing, flare, Wy, Wz) {
    const s = SIDES[i];
    const W = P.a[i].t.set(s * hw, Wy, Wz);
    const feet = _a.set(0, -1, 0).applyQuaternion(P.q); feet.y = 0;
    if (feet.lengthSq() < 1e-6) feet.set(0, 0, -1);
    feet.normalize();
    const fl = flare * D2R;
    P.a[i].p.set(s * Math.sin(fl), 0, 0).addScaledVector(feet, Math.cos(fl)).multiplyScalar(0.5).add(W);
    P.a[i].p.y += 0.35;
    const h = P.h[i], fg = fing * D2R;
    h.f.set(s * Math.sin(fg), 0, Math.cos(fg)); h.u.set(0, 1, 0); h.w = 1; h.curl = 0;
  }
  // 봉 잡기(평행봉·패럴렛): 엄지 앞, 손가락이 바깥쪽으로 감쌈
  function armBar(P, i, barX, flare, Wy, Wz) {
    const s = SIDES[i];
    const W = P.a[i].t.set(s * barX, Wy, Wz);
    const fl = flare * D2R;
    P.a[i].p.set(s * Math.sin(fl) * 0.5, 0.3, -Math.cos(fl) * 0.5).add(W);
    const h = P.h[i]; h.f.set(s, -0.45, 0).normalize(); h.u.set(s * 0.45, 1, 0).normalize(); h.w = 1; h.curl = 100;
  }
  // 2D 2링크: S(y,z) → C, 중간 관절 위치 (up>0 이면 위쪽 해)
  function link2(Sy, Sz, Cy, Cz, l1, l2, up) {
    const dy = Cy - Sy, dz = Cz - Sz;
    const d = clamp(Math.hypot(dy, dz), Math.abs(l1 - l2) + 1e-5, l1 + l2 - 1e-5);
    const base = Math.atan2(dz, dy), a = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
    const y1 = Sy + l1 * Math.cos(base + a), z1 = Sz + l1 * Math.sin(base + a);
    const y2 = Sy + l1 * Math.cos(base - a), z2 = Sz + l1 * Math.sin(base - a);
    return (up > 0) === (y1 > y2) ? { y: y1, z: z1 } : { y: y2, z: z2 };
  }
  const straightY = (dx, lean) => DIM.wristH + Math.sqrt(Math.max(1e-4, ARM * ARM - dx * dx - lean * lean));

  const DEF = {}, B = {};

  // 엎드린 지지(푸시업, 스캐퓰러, 플란체 린, PPPU): 손목·발끝 고정, 몸통 각도는 자동
  DEF.prone = { hw: .21, wz: 0, fing: 0, lean: .02, drop: 0, prot: 0, elev: 0, lum: 0, tho: 0, neck: -8, hip: 0, abd: 0, toeZ: null, flare: 45, footRef: 10 };
  B.prone = function (p) {
    const P = newPose(); setTorso(P, p); torsoAt(P, ZERO, QI);
    const s0 = mid(SK.sh[0], SK.sh[1], V()), dx = SK.sh[0].x - p.hw;
    const an0 = [V(), V()];
    for (let i = 0; i < 2; i++) { legFK(P, i, p.hip, p.abd, 0); an0[i].copy(P.l[i].t); }
    const am = mid(an0[0], an0[1], V());
    const Dy = am.y - s0.y, Dz = am.z - s0.z, l1 = Math.hypot(Dy, Dz);
    const Wy = DIM.wristH, Wz = p.wz;
    const Sy = straightY(dx, p.lean) - p.drop, Sz = Wz + p.lean;
    const toeZ = p.toeZ == null ? autoToe(p) : p.toeZ;
    const A = link2(Sy, Sz, 0, toeZ, l1, FOOT_R, 1);
    const beta = Math.atan2(A.z - Sz, A.y - Sy) - Math.atan2(Dz, Dy);
    P.q.setFromAxisAngle(AX, beta);
    P.root.set(0, Sy, Sz).sub(_d.copy(s0).applyQuaternion(P.q));
    for (let i = 0; i < 2; i++) {
      legFK(P, i, p.hip, p.abd, 0);
      const f = P.f[i]; f.cw = 1; f.c.set(P.l[i].t.x, 0, toeZ);
      armFloor(P, i, p.hw, p.fing, p.flare, Wy, Wz);
    }
    P.straight = p.drop < 1e-4 ? 1 : 0;
    return P;
  };
  // 발끝 접지점: 발 각도 footRef 일 때 발끝이 바닥에 닿는 z
  function autoToe(p) {
    const P = newPose(); setTorso(P, p); torsoAt(P, ZERO, QI);
    const s0 = mid(SK.sh[0], SK.sh[1], V()), dx = SK.sh[0].x - p.hw;
    for (let i = 0; i < 2; i++) { legFK(P, i, p.hip, p.abd, 0); P.f[i].p = p.footRef; P.a[i].t.copy(SK.sh[i]).y -= ARM; P.a[i].p.set(0, 0, -1); }
    solve(P, SK);
    const c0 = V();
    for (let i = 0; i < 2; i++) c0.add(_a.copy(TOE).applyQuaternion(SK.fq[i]).add(SK.an[i]).multiplyScalar(0.5));
    const Ey = c0.y - s0.y, Ez = c0.z - s0.z, R = Math.hypot(Ey, Ez), phi = Math.atan2(Ez, Ey);
    const Sy = straightY(dx, p.lean) - p.drop, Sz = p.wz + p.lean;
    const base = Math.acos(clamp(-Sy / R, -1, 1));
    let best = null;
    for (const b of [base - phi, -base - phi]) {
      const z = Sz + (Ey * Math.sin(b) + Ez * Math.cos(b));
      if (best === null || z < best) best = z;
    }
    return best;
  }

  // 손 위 홀드(프로그 스탠드, 턱/어드밴스드 턱/스트래들/풀 플란체): 무게중심이 손 위에 오도록 기울기 자동
  DEF.planche = { hw: .2, wz: 0, fing: 90, pitch: 90, lum: 0, tho: 0, neck: -6, prot: 1, elev: -.6, hipF: 0, knee: 0, abd: 0, plantar: 45,
    bent: 0, flare: 15, comOff: .03, g: 0, gLean: .05, gFeetZ: -.35, gFw: .14, kneeAim: 0 };
  B.planche = function (p) {
    const P = newPose(); setTorso(P, p);
    const q = rotX(p.pitch);
    torsoAt(P, ZERO, q);
    const s0 = mid(SK.sh[0], SK.sh[1], V()), dx = SK.sh[0].x - p.hw;
    const Wy = DIM.wristH, Wz = p.wz;
    const place = (lean, g) => {
      const Sy = straightY(dx, lean) - p.bent;
      P.q.copy(q); P.root.set(0, Sy, Wz + lean).sub(s0);
      for (let i = 0; i < 2; i++) {
        armFloor(P, i, p.hw, p.fing, p.flare, Wy, Wz); legFK(P, i, p.hipF, p.abd, p.knee);
        P.f[i].p = p.plantar; P.f[i].cw = 0; P.f[i].flat = 0;
      }
      if (p.kneeAim > 0) { solve(P, SK); for (let i = 0; i < 2; i++) aimKnee(P, i, p); }
      if (g > 0) {
        for (let i = 0; i < 2; i++) { P.l[i].t.lerp(_a.set(SIDES[i] * p.gFw, 0.07, p.gFeetZ), g); P.f[i].flat = g; }
      }
      solve(P, SK);
      return SK.com.z - (Wz + p.comOff);
    };
    let lo = -0.15, hi = 0.53;
    for (let it = 0; it < 24; it++) { const m = (lo + hi) / 2; if (place(m, 0) > 0) hi = m; else lo = m; }
    let lean = (lo + hi) / 2;
    if (p.g > 0) lean = lerp(lean, p.gLean, p.g);
    place(lean, p.g);
    P.straight = p.bent < 1e-4 ? 1 : 0;
    return P;
  };
  // 프로그 스탠드: 무릎을 위팔(팔꿈치 바로 위) 쪽으로 겨냥
  function aimKnee(P, i, p) {
    const s = SIDES[i];
    const Kt = _c.copy(SK.el[i]).add(_d.set(s * 0.055, 0.04, -0.02));
    const hip = SK.hip[i].clone();
    const Ua = Kt.sub(hip).normalize();
    const U = LU[i].lerp(Ua, p.kneeAim).normalize();
    const Bd = LBd[i]; Bd.addScaledVector(U, -Bd.dot(U)).normalize();
    setLeg(P, i, hip, U, Bd, p.knee);
  }

  // 누운 자세(할로우 바디): 바닥 접촉은 자동
  DEF.supine = { pitch: -90, lum: 0, tho: 0, neck: 0, prot: 0, elev: .3, armE: 175, armAbd: 8, hipF: 0, knee: 0, abd: 0, plantar: 40, z0: 0 };
  B.supine = function (p) {
    const P = newPose(); setTorso(P, p); P.q.copy(rotX(p.pitch));
    const build = () => {
      solveTorso(P, SK);
      for (let i = 0; i < 2; i++) { armFK(P, SK, i, p.armE, p.armAbd, 0, V(0, 0, 1)); legFK(P, i, p.hipF, p.abd, p.knee); P.f[i].p = p.plantar; }
    };
    P.root.set(0, 0, 0); build(); solve(P, SK);
    P.root.y = -lowestY(SK) + 0.001; P.root.z = p.z0;
    build();
    return P;
  };

  // 평행봉·패럴렛 지지(딥스, L-싯)
  DEF.bars = { barH: 1.15, barX: .25, wz: 0, bal: 1, lean: 0, comOff: 0, drop: 0, pitch: 0, lum: 0, tho: 0, neck: 0, prot: 0, elev: -.8,
    hipF: 15, knee: 80, abd: 0, plantar: 35, flare: 8, sit: 0 };
  B.bars = function (p) {
    const P = newPose(); setTorso(P, p);
    const q = rotX(p.pitch);
    torsoAt(P, ZERO, q);
    const s0 = mid(SK.sh[0], SK.sh[1], V()), dx = SK.sh[0].x - p.barX;
    const Wy = p.barH + 0.045, Wz = p.wz;
    const place = (lean) => {
      const Sy = Wy - DIM.wristH + straightY(dx, lean) - p.drop;
      P.q.copy(q); P.root.set(0, Sy, Wz + lean).sub(s0);
      for (let i = 0; i < 2; i++) { armBar(P, i, p.barX, p.flare, Wy, Wz); legFK(P, i, p.hipF, p.abd, p.knee); P.f[i].p = p.plantar; }
      solve(P, SK);
      return SK.com.z - (Wz + p.comOff);
    };
    let lean = p.lean;
    if (p.bal) { let lo = -0.3, hi = 0.3; for (let it = 0; it < 22; it++) { const m = (lo + hi) / 2; if (place(m) > 0) hi = m; else lo = m; } lean = (lo + hi) / 2; }
    place(lean);
    if (p.sit > 0) {
      P.root.y -= lowestY(SK) * p.sit;
      for (let i = 0; i < 2; i++) legFK(P, i, p.hipF, p.abd, p.knee);
    }
    P.straight = (p.drop < 1e-4 && p.sit <= 0) ? 1 : 0;
    return P;
  };

  // 인버티드 로우: 뒤꿈치 고정, 몸은 일직선으로 회전
  DEF.row = { barH: .95, hw: .27, heelZ: null, pull: 0, prot: 0, elev: 0, lum: 0, tho: 0, neck: 10, hip: 0, flare: 45 };
  B.row = function (p) {
    const P = newPose(); setTorso(P, p); torsoAt(P, ZERO, QI);
    for (let i = 0; i < 2; i++) { legFK(P, i, p.hip, 0, 0); P.f[i].p = 0; P.a[i].t.copy(SK.sh[i]).y -= ARM; P.a[i].p.set(0, 0, -1); }
    solve(P, SK);
    const heel0 = V();
    for (let i = 0; i < 2; i++) heel0.add(_a.copy(HEEL).applyQuaternion(SK.fq[i]).add(SK.an[i]).multiplyScalar(0.5));
    const s0 = mid(SK.sh[0], SK.sh[1], V()), dx = SK.sh[0].x - p.hw;
    const st0 = _a.set(0, 0.15, 0.13).applyQuaternion(SK.che.q).add(SK.che.p).clone();
    const vS = s0.clone().sub(heel0), vT = st0.sub(heel0);
    const Wy = p.barH - 0.035, Le = Math.sqrt(ARM * ARM - dx * dx);
    const rot = (v, b) => ({ y: v.y * Math.cos(b) - v.z * Math.sin(b), z: v.y * Math.sin(b) + v.z * Math.cos(b) });
    const bis = (f, lo, hi) => { for (let it = 0; it < 30; it++) { const m = (lo + hi) / 2; if (f(m) > 0) hi = m; else lo = m; } return (lo + hi) / 2; };
    // 맨 위: 가슴(명치 위)이 봉 바로 아래 → 회전각과 뒤꿈치 위치 결정
    const b1 = bis(b => rot(vT, b).y - (p.barH - 0.05), -Math.PI / 2, -0.2);
    const Hc = V(0, 0, p.heelZ == null ? -rot(vT, b1).z : p.heelZ);
    const b0 = bis(b => { const s = rot(vS, b); return Le - Math.hypot(Hc.y + s.y - Wy, Hc.z + s.z); }, -Math.PI / 2, -0.2);
    const beta = lerp(b0, b1, p.pull);
    P.heelZ = Hc.z;
    P.q.setFromAxisAngle(AX, beta);
    P.root.copy(Hc).sub(_d.copy(heel0).applyQuaternion(P.q));
    solveTorso(P, SK);
    const fl = p.flare * D2R;
    for (let i = 0; i < 2; i++) {
      const s = SIDES[i];
      legFK(P, i, p.hip, 0, 0); P.f[i].p = 0;
      P.a[i].t.set(s * p.hw, Wy, 0);
      P.a[i].p.lerpVectors(SK.sh[i], P.a[i].t, 0.5).add(_a.set(s * Math.sin(fl) * 0.45, -0.5, Math.cos(fl) * 0.35));
      const h = P.h[i]; h.f.set(0, 1, 0); h.u.set(0, 0, -1); h.w = 1; h.curl = 100;
    }
    return P;
  };

  // 파이크 푸시업: 손·발 고정, 엉덩이는 2링크로 계산
  DEF.pike = { hw: .2, wz: 0, fing: 0, lean: -.03, drop: 0, prot: .3, elev: .5, lum: 0, tho: 0, neck: 0, flare: 35, feetZ: -.75, fw: .09, tilt: 58, minHead: .03 };
  B.pike = function (p) {
    const P = newPose(); setTorso(P, p); torsoAt(P, ZERO, QI);
    const s0 = mid(SK.sh[0], SK.sh[1], V()), h0 = mid(SK.hip[0], SK.hip[1], V()), dx = SK.sh[0].x - p.hw, head0 = SK.head.clone();
    const ty = h0.y - s0.y, tz = h0.z - s0.z, lt = Math.hypot(ty, tz);
    const tl = p.tilt * D2R, Zf = V(0, -Math.sin(tl), Math.cos(tl)), Yf = V(0, Math.cos(tl), Math.sin(tl));
    const A = V(0, 0, p.feetZ).addScaledVector(Zf, -TOE.z).addScaledVector(Yf, -TOE.y);
    const Wy = DIM.wristH, Wz = p.wz;
    let drop = p.drop;
    for (let it = 0; it < 4; it++) {
      const Sy = straightY(dx, p.lean) - drop, Sz = Wz + p.lean;
      const H = link2(Sy, Sz, A.y, A.z, lt, LEG - 0.002, 1);
      const beta = Math.atan2(H.z - Sz, H.y - Sy) - Math.atan2(tz, ty);
      P.q.setFromAxisAngle(AX, beta); P.root.set(0, Sy, Sz).sub(_d.copy(s0).applyQuaternion(P.q));
      const hy = _c.copy(head0).applyQuaternion(P.q).add(P.root).y - 0.1;
      if (hy >= p.minHead - 1e-3) break;
      drop -= (p.minHead - hy);
    }
    solveTorso(P, SK);
    const shm = mid(SK.sh[0], SK.sh[1], V());
    for (let i = 0; i < 2; i++) {
      const s = SIDES[i];
      armFloor(P, i, p.hw, p.fing, p.flare, Wy, Wz);
      P.l[i].t.set(s * p.fw, A.y, A.z); P.l[i].p.copy(shm);
      P.f[i].cw = 1; P.f[i].c.set(s * p.fw, 0, p.feetZ);
    }
    P.straight = drop < 1e-4 ? 1 : 0;
    return P;
  };

  // 네발 자세(손목 준비운동): 손·무릎 고정
  DEF.quad = { hw: .16, wz: 0, fingL: 0, fingR: 0, liftL: 0, liftR: 0, lean: 0, prot: .2, elev: 0, lum: 0, tho: 0, neck: -10, kz: null, kw: .1, flare: 0 };
  B.quad = function (p) {
    const P = newPose(); setTorso(P, p); torsoAt(P, ZERO, QI);
    const s0 = mid(SK.sh[0], SK.sh[1], V()), h0 = mid(SK.hip[0], SK.hip[1], V()), dx = SK.sh[0].x - p.hw;
    const ty = h0.y - s0.y, tz = h0.z - s0.z, lt = Math.hypot(ty, tz);
    const Wy = DIM.wristH, Wz = p.wz, kH = 0.055;
    let kz = p.kz;
    if (kz == null) { const Sy0 = straightY(dx, 0); kz = Wz - Math.sqrt(Math.max(0, lt * lt - Math.pow(Sy0 - (kH + DIM.th), 2))); }
    const Sy = straightY(dx, p.lean), Sz = Wz + p.lean;
    const H = link2(Sy, Sz, kH, kz, lt, DIM.th, 1);
    const beta = Math.atan2(H.z - Sz, H.y - Sy) - Math.atan2(tz, ty);
    P.q.setFromAxisAngle(AX, beta); P.root.set(0, Sy, Sz).sub(_d.copy(s0).applyQuaternion(P.q));
    for (let i = 0; i < 2; i++) {
      const s = SIDES[i];
      armFloor(P, i, p.hw, i ? p.fingR : p.fingL, p.flare, Wy, Wz);
      P.a[i].t.y += (i ? p.liftR : p.liftL) * 0.07;
      P.l[i].t.set(s * p.kw, 0.06, kz - DIM.sk * 0.995); P.l[i].p.set(s * p.kw, kH, kz);
      P.f[i].p = 82;
    }
    P.straight = 0;
    return P;
  };

  /* ---------- 운동 타임라인 ---------- */
  function lerpParams(a, b, t) {
    const o = {};
    for (const k in a) { const x = a[k], y = b[k]; o[k] = (typeof x === 'number' && typeof y === 'number') ? lerp(x, y, t) : (t < 0.5 ? x : y); }
    return o;
  }
  function prepare(ex) {
    const keys = [], last = {};
    for (let i = 0; i < ex.keys.length; i++) {
      const k = ex.keys[i];
      const b = k.b || (i ? keys[i - 1].b : ex.b);
      const p = Object.assign({}, DEF[b], ex.base || {}, (ex.baseBy && ex.baseBy[b]) || {}, last[b] || {}, k.p || {});
      last[b] = Object.assign({}, last[b] || {}, k.p || {});
      keys.push({ t: k.t, b, p, label: k.label });
    }
    // 엎드린 자세의 발끝 위치는 운동 전체에서 고정
    const firstProne = keys.find(k => k.b === 'prone' && k.p.toeZ == null);
    if (firstProne) { const tz = autoToe(firstProne.p); keys.forEach(k => { if (k.b === 'prone' && k.p.toeZ == null) k.p.toeZ = tz; }); }
    const firstRow = keys.find(k => k.b === 'row' && k.p.heelZ == null);
    if (firstRow) { const hz = B.row(firstRow.p).heelZ; keys.forEach(k => { if (k.b === 'row' && k.p.heelZ == null) k.p.heelZ = hz; }); }
    const mis = ex.mistake || {};
    keys.forEach((k, i) => {
      k.pm = Object.assign({}, k.p, mis.p || {}, (mis.byB && mis.byB[k.b]) || {}, (mis.at && mis.at[i]) || {});
      k.P = B[k.b](k.p); k.PM = B[k.b](k.pm);
    });
    let lab = '';
    keys.forEach(k => { if (k.label) lab = k.label; k.lab = lab; });
    ex._keys = keys;
    ex.dur = keys[keys.length - 1].t + (ex.tail == null ? 0.5 : ex.tail);
    ex._steps = keys.map((k, i) => ({ t: k.t, label: k.label, i })).filter(s => s.label);
    return ex;
  }
  const ease = (u) => u * u * (3 - 2 * u);
  function poseAt(ex, t, wrong) {
    const ks = ex._keys, n = ks.length;
    t = ((t % ex.dur) + ex.dur) % ex.dur;
    let i = 0; while (i < n - 1 && t >= ks[i + 1].t) i++;
    const k0 = ks[i], k1 = i < n - 1 ? ks[i + 1] : ks[0];
    const t1 = i < n - 1 ? k1.t : ex.dur;
    const u = ease(clamp((t - k0.t) / Math.max(1e-6, t1 - k0.t), 0, 1));
    let P;
    if (k0.b === k1.b) P = B[k0.b](lerpParams(wrong ? k0.pm : k0.p, wrong ? k1.pm : k1.p, u));
    else { P = blendPose(wrong ? k0.PM : k0.P, wrong ? k1.PM : k1.P, u, newPose()); fixStraight(P, SK); }
    P.step = k0.lab; P.ki = i;
    return P;
  }

  /* ---------- 지오메트리 ---------- */
  function limbGeo(len, r0, r1) {
    const pts = [], n = 8;
    for (let k = 0; k <= n; k++) { const a = -Math.PI / 2 + (k / n) * (Math.PI / 2); pts.push(new T.Vector2(Math.cos(a) * r1, -len + Math.sin(a) * r1)); }
    for (let k = 1; k < 12; k++) { const u = k / 12; pts.push(new T.Vector2(lerp(r1, r0, u) * (1 + 0.07 * Math.sin(Math.PI * u)), -len + u * len)); }
    for (let k = 0; k <= n; k++) { const a = (k / n) * (Math.PI / 2); pts.push(new T.Vector2(Math.cos(a) * r0, Math.sin(a) * r0)); }
    return new T.LatheGeometry(pts, 22);
  }
  function profileGeo(prof, sz) {
    const g = new T.LatheGeometry(prof.map(([r, y]) => new T.Vector2(r, y)), 28);
    g.scale(1, 1, sz);
    return g;
  }
  const SPH = new T.SphereGeometry(1, 24, 16);
  function ellip(mat, sx, sy, sz, x, y, z) { const m = new T.Mesh(SPH, mat); m.scale.set(sx, sy, sz); m.position.set(x || 0, y || 0, z || 0); return m; }

  /* ---------- 마네킹 ---------- */
  function Mannequin(mats, ghost) {
    this.ghost = ghost; this.mats = mats; this.root = new T.Group(); this.parts = {}; this.all = [];
    const G = this.root, mk = (key, mesh, base) => { mesh.userData.base = base || 'body'; mesh.userData.key = key; this.all.push(mesh); (this.parts[key] = this.parts[key] || []).push(mesh); mesh.castShadow = !ghost; return mesh; };
    const grp = () => { const g = new T.Group(); G.add(g); return g; };
    const M = mats.body;
    this.pel = grp(); this.pel.add(mk('pelvis', new T.Mesh(profileGeo([[0, -.13], [.07, -.125], [.115, -.1], [.14, -.055], [.148, -.01], [.14, .035], [.122, .065], [.09, .085], [0, .09]], .72), M)));
    this.pel.children[0].position.z = .012;
    [1, -1].forEach(s => { this.pel.add(mk('glute', ellip(M, .07, .072, .058, s * .062, -.07, -.07), 'muscle')); });
    this.wai = grp(); this.wai.add(mk('abdomen', ellip(M, .128, .118, .098, 0, .075, .025)));
    this.wai.add(mk('abs', ellip(M, .072, .1, .03, 0, .072, .103), 'muscle'));
    this.che = grp();
    const chest = mk('chest', new T.Mesh(profileGeo([[0, -.04], [.1, -.03], [.128, 0], [.145, .05], [.158, .1], [.163, .15], [.158, .19], [.142, .225], [.11, .25], [.06, .262], [0, .266]], .66), M));
    chest.position.z = .03; this.che.add(chest);
    [1, -1].forEach(s => {
      const pec = mk('pec', ellip(M, .07, .052, .03, s * .068, .158, .117), 'muscle'); pec.rotation.z = s * .22; this.che.add(pec);
      this.che.add(mk('serr', ellip(M, .024, .056, .045, s * .138, .09, .055), 'muscle'));
      const lat = mk('lat', ellip(M, .052, .1, .03, s * .1, .08, -.055), 'muscle'); lat.rotation.z = -s * .25; this.che.add(lat);
      this.che.add(mk('trap', ellip(M, .06, .034, .045, s * .072, .232, -.02), 'muscle'));
    });
    this.nek = grp(); const neck = mk('neck', new T.Mesh(new T.CylinderGeometry(.044, .048, .1, 18), M)); neck.position.set(0, .05, .01); this.nek.add(neck);
    this.head = grp();
    this.head.add(mk('head', ellip(M, .092, .112, .1)));
    this.head.add(mk('head', ellip(mats.joint, .02, .02, .022, 0, -.012, .098), 'joint'));
    [1, -1].forEach(s => this.head.add(mk('head', ellip(M, .012, .026, .02, s * .089, 0, -.004))));
    this.scap = [0, 1].map(i => {
      const s = SIDES[i];
      const sh = new T.Shape(); sh.moveTo(0, .065); sh.lineTo(s * .058, .048); sh.lineTo(s * .012, -.075); sh.lineTo(0, .065);
      const geo = new T.ExtrudeGeometry(sh, { depth: .007, bevelEnabled: true, bevelThickness: .003, bevelSize: .006, bevelSegments: 2 });
      const m = mk('scap', new T.Mesh(geo, mats.joint), 'joint'); G.add(m); return m;
    });
    this.limbs = [0, 1].map(i => {
      const L = {};
      L.delt = mk('delt', ellip(M, .062, .07, .062), 'muscle'); G.add(L.delt);
      L.ua = grp(); L.ua.add(mk('ua', new T.Mesh(limbGeo(DIM.ua, .047, .036), M)));
      L.ua.add(mk('bi', ellip(M, .03, .075, .026, 0, -.14, .024), 'muscle'));
      L.ua.add(mk('tri', ellip(M, .033, .085, .028, 0, -.12, -.026), 'muscle'));
      L.elb = mk('elbow', ellip(mats.joint, .044, .044, .044), 'joint'); G.add(L.elb);
      L.fa = grp(); L.fa.add(mk('fa', new T.Mesh(limbGeo(DIM.fa, .039, .027), M)));
      L.hand = grp();
      L.hand.add(mk('hand', ellip(M, .043, .017, .05, 0, -.012, .048)));
      const th = mk('hand', ellip(M, .013, .012, .034, -SIDES[i] * .041, -.012, .045)); th.rotation.y = SIDES[i] * .5; L.hand.add(th);
      L.fing = new T.Group(); L.fing.position.set(0, -.014, .09); L.hand.add(L.fing);
      L.fing.add(mk('hand', ellip(M, .04, .012, .045, 0, 0, .04)));
      L.th = grp(); L.th.add(mk('th', new T.Mesh(limbGeo(DIM.th, .078, .052), M)));
      L.th.add(mk('quad', ellip(M, .055, .15, .04, 0, -.2, .036), 'muscle'));
      L.knee = mk('knee', ellip(mats.joint, .058, .058, .058), 'joint'); G.add(L.knee);
      L.sk = grp(); L.sk.add(mk('sk', new T.Mesh(limbGeo(DIM.sk, .052, .035), M)));
      L.sk.add(mk('calf', ellip(M, .038, .09, .035, 0, -.12, -.026), 'muscle'));
      L.ank = mk('ankle', ellip(mats.joint, .041, .041, .041), 'joint'); G.add(L.ank);
      L.foot = grp(); L.foot.add(mk('foot', ellip(M, .045, .032, .125, 0, -.04, .07))); L.foot.add(mk('foot', ellip(M, .04, .036, .04, 0, -.04, -.035)));
      return L;
    });
    this.setState([], []);
  }
  const GROUPS = {
    delt: ['delt'], chest: ['pec'], tri: ['tri'], bi: ['bi'], fore: ['fa', 'hand'], core: ['abs', 'abdomen'], serr: ['serr', 'scap'],
    lat: ['lat'], trap: ['trap'], glute: ['glute'], quad: ['quad'], calf: ['calf'],
    elbow: ['ua', 'fa', 'elbow', 'bi', 'tri'], hips: ['pelvis', 'glute', 'abdomen', 'abs'], back: ['chest', 'abdomen', 'scap', 'lat'],
    shoulder: ['delt', 'trap', 'scap'], legs: ['th', 'sk', 'knee', 'quad', 'calf'], head: ['head', 'neck']
  };
  Mannequin.prototype.setState = function (hl, bad) {
    const hs = new Set(), bs = new Set();
    hl.forEach(k => (GROUPS[k] || [k]).forEach(x => hs.add(x)));
    bad.forEach(k => (GROUPS[k] || [k]).forEach(x => bs.add(x)));
    const m = this.mats;
    this.all.forEach(mesh => {
      const key = mesh.userData.key, base = mesh.userData.base;
      mesh.material = this.ghost ? m.body : bs.has(key) ? m.bad : hs.has(key) ? m.hl : (base === 'joint' ? m.joint : base === 'muscle' ? m.muscle : m.body);
    });
  };
  const _X = V(), _Y = V(), _Z = V();
  function limbQ(a, b, front, out) {
    _Y.subVectors(a, b).normalize();
    _Z.copy(front).addScaledVector(_Y, -front.dot(_Y));
    if (_Z.lengthSq() < 1e-8) _Z.set(0, 0, 1).addScaledVector(_Y, -_Y.z);
    _Z.normalize(); _X.crossVectors(_Y, _Z);
    return basisQ(_X, _Y, _Z, out);
  }
  Mannequin.prototype.update = function (S) {
    const set = (g, p, q) => { g.position.copy(p); g.quaternion.copy(q); };
    set(this.pel, S.pel.p, S.pel.q); set(this.wai, S.wai.p, S.wai.q); set(this.che, S.che.p, S.che.q); set(this.nek, S.nek.p, S.nek.q);
    set(this.head, S.head, S.nek.q);
    for (let i = 0; i < 2; i++) {
      const L = this.limbs[i], s = SIDES[i], pr = S.sc[i * 2], el = S.sc[i * 2 + 1];
      // 견갑골: 갈비뼈 곡면을 따라 이동
      const x = s * clamp(0.085 + 0.04 * pr, 0.05, 0.135), y = 0.14 + 0.04 * el;
      const rx = 0.163, rz = 0.1076, zz = 0.03 - rz * Math.sqrt(Math.max(0.05, 1 - (x / rx) * (x / rx)));
      const nrm = _a.set(x / (rx * rx), 0, (zz - 0.03) / (rz * rz)).normalize();
      const sc = this.scap[i];
      sc.position.set(x, y, zz).addScaledVector(nrm, 0.004).applyQuaternion(S.che.q).add(S.che.p);
      _q.setFromUnitVectors(_b.set(0, 0, -1), nrm); sc.quaternion.copy(S.che.q).multiply(_q);
      _c.subVectors(S.el[i], S.sh[i]);
      const front = _d.copy(S.ab[i]).negate();
      limbQ(S.sh[i], S.el[i], front, L.ua.quaternion); L.ua.position.copy(S.sh[i]);
      L.delt.position.copy(S.sh[i]).addScaledVector(_c.normalize(), 0.018); L.delt.quaternion.copy(L.ua.quaternion);
      L.elb.position.copy(S.el[i]);
      limbQ(S.el[i], S.wr[i], front, L.fa.quaternion); L.fa.position.copy(S.el[i]);
      set(L.hand, S.wr[i], S.hq[i]); L.fing.rotation.x = S.curl[i] * D2R;
      limbQ(S.hip[i], S.kn[i], S.lb[i], L.th.quaternion); L.th.position.copy(S.hip[i]);
      L.knee.position.copy(S.kn[i]);
      limbQ(S.kn[i], S.an[i], S.lb[i], L.sk.quaternion); L.sk.position.copy(S.kn[i]);
      L.ank.position.copy(S.an[i]);
      set(L.foot, S.an[i], S.fq[i]);
    }
  };

  /* ---------- 가이드선 (점선, 몸 위에 겹쳐 그림) ---------- */
  function Guides(scene) {
    const g = new T.CylinderGeometry(1, 1, 1, 6, 1, false);
    this.mat = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .96, depthTest: false, depthWrite: false });
    this.max = 700;
    this.mesh = new T.InstancedMesh(g, this.mat, this.max);
    this.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    const c = new T.Color(1, 1, 1);
    for (let i = 0; i < this.max; i++) this.mesh.setColorAt(i, c);
    this.mesh.renderOrder = 20; this.mesh.frustumCulled = false; this.mesh.count = 0;
    scene.add(this.mesh);
    const rm = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthTest: false, depthWrite: false });
    this.ring = new T.Mesh(new T.TorusGeometry(.05, .009, 8, 40), rm); this.ring.renderOrder = 21; this.ring.rotation.x = Math.PI / 2; scene.add(this.ring);
    this.dot = new T.Mesh(new T.SphereGeometry(.018, 14, 10), rm); this.dot.renderOrder = 21; scene.add(this.dot);
    this.n = 0; this._m = new T.Matrix4(); this._q = new T.Quaternion(); this._s = V(); this._p = V(); this._d = V();
  }
  Guides.prototype.begin = function () { this.n = 0; this.ring.visible = this.dot.visible = false; };
  Guides.prototype.dash = function (a, b, color, solid) {
    const d = this._d.subVectors(b, a), L = d.length();
    if (L < 1e-4) return;
    d.divideScalar(L);
    this._q.setFromUnitVectors(_b.set(0, 1, 0), d);
    const dl = solid ? L : .045, gap = solid ? 0 : .03, r = .0055;
    for (let s = 0; s < L && this.n < this.max; s += dl + gap) {
      const e = Math.min(L, s + dl);
      this._p.copy(a).addScaledVector(d, (s + e) / 2);
      this._s.set(r, e - s, r);
      this._m.compose(this._p, this._q, this._s);
      this.mesh.setMatrixAt(this.n, this._m); this.mesh.setColorAt(this.n, color); this.n++;
    }
  };
  Guides.prototype.marker = function (p, color) {
    this.ring.visible = this.dot.visible = true;
    this.ring.position.copy(p); this.dot.position.copy(p);
    this.ring.material.color.copy(color);
  };
  Guides.prototype.end = function () {
    this.mesh.count = this.n; this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  };

  /* ---------- 운동 기구 ---------- */
  function props(mats) {
    const g = {}, cyl = (r, h, mat) => { const m = new T.Mesh(new T.CylinderGeometry(r, r, h, 20), mat); m.castShadow = true; m.receiveShadow = true; return m; };
    // 평행봉
    g.pbars = new T.Group();
    [1, -1].forEach(s => {
      const rail = cyl(.022, 1.6, mats.wood); rail.rotation.x = Math.PI / 2; rail.position.set(s * .25, 1.15, 0); g.pbars.add(rail);
      [-.62, .62].forEach(z => {
        const post = cyl(.028, 1.15, mats.metal); post.position.set(s * .25, .575, z); g.pbars.add(post);
        const foot = new T.Mesh(new T.BoxGeometry(.12, .03, .22), mats.metal); foot.position.set(s * .25, .015, z); foot.castShadow = true; g.pbars.add(foot);
      });
    });
    // 패럴렛
    g.ptx = new T.Group();
    [1, -1].forEach(s => {
      const rail = cyl(.017, .5, mats.wood); rail.rotation.x = Math.PI / 2; rail.position.set(s * .24, .15, 0); g.ptx.add(rail);
      [-.21, .21].forEach(z => {
        const post = cyl(.013, .15, mats.metal); post.position.set(s * .24, .075, z); g.ptx.add(post);
        const foot = cyl(.012, .2, mats.metal); foot.rotation.z = Math.PI / 2; foot.position.set(s * .24, .012, z); g.ptx.add(foot);
      });
    });
    // 로우 바
    g.rowbar = new T.Group();
    const bar = cyl(.016, 1.5, mats.metal); bar.rotation.z = Math.PI / 2; bar.position.set(0, .95, 0); g.rowbar.add(bar);
    [1, -1].forEach(s => {
      const post = cyl(.03, .95, mats.metal); post.position.set(s * .75, .475, 0); g.rowbar.add(post);
      const foot = new T.Mesh(new T.BoxGeometry(.1, .03, .5), mats.metal); foot.position.set(s * .75, .015, 0); foot.castShadow = true; g.rowbar.add(foot);
    });
    return g;
  }
  const PROP_BOX = {
    pbars: [V(-.3, 0, -.7), V(.3, 1.2, .7)], ptx: [V(-.3, 0, -.25), V(.3, .17, .25)], rowbar: [V(-.8, 0, -.1), V(.8, 1, .1)]
  };

  /* ---------- 무대(렌더러 + 카메라 + 조작) ---------- */
  function Stage(el, opts) {
    this.el = el; this.opts = opts || {};
    const r = this.renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: !!this.opts.preserve });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.outputEncoding = T.sRGBEncoding;
    r.shadowMap.enabled = true; r.shadowMap.type = T.PCFSoftShadowMap;
    r.domElement.className = 'gl';
    el.prepend(r.domElement);
    const sc = this.scene = new T.Scene();
    const mk = (o) => new T.MeshStandardMaterial(Object.assign({ roughness: .6, metalness: 0 }, o));
    this.mats = { body: mk({}), muscle: mk({}), joint: mk({ roughness: .45 }), hl: mk({ roughness: .5 }), bad: mk({ roughness: .5 }),
      floor: mk({ roughness: .95 }), mat: mk({ roughness: .9 }), edge: mk({ roughness: .9 }), wood: mk({ roughness: .55 }), metal: mk({ roughness: .35, metalness: .5 }) };
    this.gmats = { body: new T.MeshStandardMaterial({ transparent: true, opacity: .26, depthWrite: false, roughness: .6 }) };
    this.hemi = new T.HemisphereLight(0xffffff, 0x8899bb, .62); sc.add(this.hemi);
    const sun = this.sun = new T.DirectionalLight(0xffffff, .95);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.035;
    const sc2 = sun.shadow.camera; sc2.left = -2.2; sc2.right = 2.2; sc2.top = 2.2; sc2.bottom = -2.2; sc2.near = .5; sc2.far = 12;
    sc.add(sun); sc.add(sun.target);
    const fill = this.fill = new T.DirectionalLight(0xffffff, .28); fill.position.set(-3, 2.5, -2); sc.add(fill);
    const floor = new T.Mesh(new T.PlaneGeometry(40, 40), this.mats.floor); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; sc.add(floor);
    const rr = (w, h, rad) => { const s = new T.Shape(), x = -w / 2, y = -h / 2; s.moveTo(x + rad, y); s.lineTo(x + w - rad, y); s.quadraticCurveTo(x + w, y, x + w, y + rad); s.lineTo(x + w, y + h - rad); s.quadraticCurveTo(x + w, y + h, x + w - rad, y + h); s.lineTo(x + rad, y + h); s.quadraticCurveTo(x, y + h, x, y + h - rad); s.lineTo(x, y + rad); s.quadraticCurveTo(x, y, x + rad, y); return new T.ShapeGeometry(s, 6); };
    this.matGroup = new T.Group();
    const edge = new T.Mesh(rr(1.62, 2.82, .1), this.mats.edge); edge.rotation.x = -Math.PI / 2; edge.position.y = .0015; edge.receiveShadow = true;
    const mat = new T.Mesh(rr(1.5, 2.7, .07), this.mats.mat); mat.rotation.x = -Math.PI / 2; mat.position.y = .003; mat.receiveShadow = true;
    this.matGroup.add(edge, mat); sc.add(this.matGroup);
    this.props = props(this.mats); Object.values(this.props).forEach(g => { g.visible = false; sc.add(g); });
    this.man = new Mannequin(this.mats, false); sc.add(this.man.root);
    this.ghost = new Mannequin(this.gmats, true); this.ghost.root.visible = false; sc.add(this.ghost.root);
    this.guides = new Guides(sc);
    this.cams = [0, 1, 2, 3].map(() => new T.PerspectiveCamera(30, 1, .05, 60));
    this.view = { az: -90, el: 8, zoom: 1 }; this.cur = { az: -90, el: 8, zoom: 1 };
    this.multi = false; this.box = new T.Box3(V(-1, 0, -1), V(1, 1, 1)); this.center = V();
    this.S = newSkel(); this.SG = newSkel();
    this.colors = {};
    this.onUserOrbit = null;
    this._bindPointer();
    const ro = new ResizeObserver(() => this.resize()); ro.observe(el); this._ro = ro;
    this.resize();
  }
  Stage.prototype.setColors = function (c) {
    const lin = (h) => new T.Color(h).convertSRGBToLinear();
    const m = this.mats;
    m.body.color.copy(lin(c.body)); m.muscle.color.copy(lin(c.muscle)); m.joint.color.copy(lin(c.joint));
    m.hl.color.copy(lin(c.hl)); m.hl.emissive.copy(lin(c.hl)).multiplyScalar(.18);
    m.bad.color.copy(lin(c.bad)); m.bad.emissive.copy(lin(c.bad)).multiplyScalar(.22);
    m.floor.color.copy(lin(c.floor)); m.mat.color.copy(lin(c.mat)); m.edge.color.copy(lin(c.edge));
    m.wood.color.copy(lin(c.wood)); m.metal.color.copy(lin(c.metal));
    this.gmats.body.color.copy(lin(c.ghost));
    this.hemi.color.copy(lin(c.sky)); this.hemi.groundColor.copy(lin(c.ground));
    this.colors = { ok: lin(c.guide), ref: lin(c.ref), bad: lin(c.bad), com: lin(c.guide) };
  };
  Stage.prototype.resize = function () {
    const w = Math.max(1, this.el.clientWidth), h = Math.max(1, this.el.clientHeight);
    this.renderer.setSize(w, h, false); this.w = w; this.h = h;
  };
  Stage.prototype.setExercise = function (ex) {
    this.ex = ex;
    Object.keys(this.props).forEach(k => { this.props[k].visible = (ex.props || []).indexOf(k) >= 0; });
    // 애니메이션 전체의 경계 상자 → 카메라 맞춤
    const box = new T.Box3(), S = newSkel();
    for (let s = 0; s <= 30; s++) {
      solve(poseAt(ex, ex.dur * s / 30, false), S);
      [S.head, S.pel.p, S.che.p, S.nek.p].concat(S.sh, S.el, S.wr, S.hip, S.kn, S.an).forEach(p => box.expandByPoint(p));
      for (let i = 0; i < 2; i++) { box.expandByPoint(_a.copy(TOE).applyQuaternion(S.fq[i]).add(S.an[i])); box.expandByPoint(_a.copy(S.wr[i]).addScaledVector(S.hZ[i], .15)); }
    }
    box.expandByScalar(.11); if (box.min.y < 0) box.min.y = 0;
    (ex.props || []).forEach(k => { const pb = PROP_BOX[k]; if (pb) { box.expandByPoint(pb[0]); box.expandByPoint(pb[1]); } });
    this.box = box; box.getCenter(this.center);
    this.matGroup.position.set(0, 0, this.center.z);
    const sz = box.getSize(V());
    const span = Math.max(sz.x, sz.z);
    this.sun.position.set(this.center.x + 1.8, 4.2, this.center.z + 2.6); this.sun.target.position.copy(this.center);
    const sc2 = this.sun.shadow.camera, e = Math.max(1.2, span * .75 + .4); sc2.left = -e; sc2.right = e; sc2.top = e; sc2.bottom = -e; sc2.updateProjectionMatrix();
  };
  Stage.prototype.setView = function (v, instant) {
    this.view.az = v.az; this.view.el = v.el; if (v.zoom) this.view.zoom = v.zoom;
    if (instant) Object.assign(this.cur, this.view);
  };
  // 카메라 맞춤: 화면 위·아래 오버레이(mt, mb px)를 피해 경계 상자가 남은 영역에 들어오게
  Stage.prototype._fit = function (cam, az, el, aspect, zoom, h, mt, mb) {
    const ca = Math.cos(el * D2R), dir = _a.set(ca * Math.sin(az * D2R), Math.sin(el * D2R), ca * Math.cos(az * D2R));
    const up = Math.abs(dir.y) > .985 ? _b.set(0, 0, -1) : _b.set(0, 1, 0);
    const right = _c.crossVectors(up, dir).normalize(), u2 = _d.crossVectors(dir, right).normalize();
    mt = mt || 0; mb = mb || 0;
    const vf = Math.tan(cam.fov * D2R / 2), hf = vf * aspect, vfe = vf * Math.max(.3, (h - mt - mb) / h), b = this.box, c = this.center;
    let need = 0;
    for (let k = 0; k < 8; k++) {
      const p = V(k & 1 ? b.max.x : b.min.x, k & 2 ? b.max.y : b.min.y, k & 4 ? b.max.z : b.min.z).sub(c);
      const x = Math.abs(p.dot(right)), y = Math.abs(p.dot(u2)), z = p.dot(dir);
      need = Math.max(need, z + x / hf, z + y / vfe);
    }
    const dist = need * 1.03 * zoom;
    const tgt = V().copy(c).addScaledVector(u2, -dist * vf * (mb - mt) / h);
    cam.aspect = aspect; cam.up.copy(up);
    cam.position.copy(tgt).addScaledVector(dir, dist); cam.lookAt(tgt); cam.updateProjectionMatrix();
  };
  Stage.prototype.render = function (dt, P, PG, guideFn) {
    const k = 1 - Math.exp(-dt * 7);
    let daz = ((this.view.az - this.cur.az + 540) % 360) - 180;
    this.cur.az += daz * k; this.cur.el += (this.view.el - this.cur.el) * k; this.cur.zoom += (this.view.zoom - this.cur.zoom) * k;
    solve(P, this.S); this.man.update(this.S);
    if (PG) { solve(PG, this.SG); this.ghost.update(this.SG); }
    this.ghost.root.visible = !!PG;
    this.guides.begin(); if (guideFn) guideFn(this.S, this.guides, this.colors); this.guides.end();
    const r = this.renderer, w = this.w, h = this.h;
    const sf = this.safe || { t: 0, b: 0, q: 0 };
    if (!this.multi) {
      r.setScissorTest(false); r.setViewport(0, 0, w, h);
      this._fit(this.cams[0], this.cur.az, this.cur.el, w / h, this.cur.zoom, h, sf.t, sf.b);
      r.render(this.scene, this.cams[0]);
    } else {
      const ex = this.ex || {}, fr = (ex.front || 0) + (ex.azOff || 0), vs = [[fr - 90, 6], [fr, 10], [fr - 90, 80], [fr - 45, 24]];
      const top = sf.q || 0, bot = sf.b || 0, hw = Math.floor(w / 2), hh = Math.floor((h - top - bot) / 2);
      r.setScissorTest(true);
      r.setViewport(0, 0, w, h); r.setScissor(0, 0, w, h); r.clear();
      vs.forEach((v, i) => {
        const x = (i % 2) * hw, y = bot + (i < 2 ? hh : 0);
        r.setViewport(x, y, hw, hh); r.setScissor(x, y, hw, hh);
        this._fit(this.cams[i], v[0], v[1], hw / hh, 1, hh, 0, 0);
        r.render(this.scene, this.cams[i]);
      });
      r.setScissorTest(false);
    }
  };
  Stage.prototype.project = function (p) {
    const v = _a.copy(p).project(this.cams[0]);
    return { x: (v.x + 1) / 2 * this.w, y: (1 - v.y) / 2 * this.h, vis: v.z < 1 };
  };
  Stage.prototype._bindPointer = function () {
    const el = this.el, pts = new Map();
    let lastD = 0;
    el.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button, input, label, a, .playbar, .views')) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY, t: e.pointerType });
      if (pts.size === 2) { const a = [...pts.values()]; lastD = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); }
      try { el.setPointerCapture(e.pointerId); } catch (_) { /* 무시 */ }
    });
    const end = (e) => { pts.delete(e.pointerId); };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
    el.addEventListener('pointermove', (e) => {
      const p = pts.get(e.pointerId); if (!p) return;
      if (pts.size === 2) {
        const a = [...pts.values()]; p.x = e.clientX; p.y = e.clientY;
        const d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
        if (lastD > 0) { this.view.zoom = clamp(this.view.zoom * lastD / d, .45, 2.4); this.cur.zoom = this.view.zoom; }
        lastD = d; if (this.onUserOrbit) this.onUserOrbit(); return;
      }
      const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
      if (this.multi) return;
      this.view.az -= dx * .35; this.view.el = clamp(this.view.el + dy * .3, -4, 86);
      this.cur.az = this.view.az; this.cur.el = this.view.el;
      if (this.onUserOrbit) this.onUserOrbit();
    });
    el.addEventListener('wheel', (e) => {
      if (this.multi) return;
      e.preventDefault();
      this.view.zoom = clamp(this.view.zoom * Math.exp(e.deltaY * .0012), .45, 2.4);
      if (this.onUserOrbit) this.onUserOrbit();
    }, { passive: false });
  };

  /* ---------- 픽토그램 (측면 실루엣 SVG) ---------- */
  function pictogram(ex, ki) {
    const k = ex._keys[clamp(ki == null ? (ex.pic || 0) : ki, 0, ex._keys.length - 1)];
    const S = solve(k.P, newSkel());
    const P2 = (v) => [v.z, -v.y];
    const segs = [], all = [];
    const add = (a, b, w, far) => { const A = P2(a), Bp = P2(b); segs.push({ A, B: Bp, w, far }); all.push([A, w], [Bp, w]); };
    for (const i of [0, 1]) {
      const far = i === 0;
      add(S.hip[i], S.kn[i], .12, far); add(S.kn[i], S.an[i], .085, far);
      add(S.an[i], _a.copy(TOE).applyQuaternion(S.fq[i]).add(S.an[i]), .06, far);
      add(S.sh[i], S.el[i], .085, far); add(S.el[i], S.wr[i], .068, far);
      add(S.wr[i], _a.copy(S.wr[i]).addScaledVector(S.hZ[i], .13), .055, far);
    }
    const loc = (fr, x, y, z) => P2(_a.set(x, y, z).applyQuaternion(fr.q).add(fr.p));
    const tor = [loc(S.pel, 0, -.03, .02), loc(S.wai, 0, .07, .03), loc(S.che, 0, .09, .035), loc(S.che, 0, .19, .02), P2(S.nek.p)];
    tor.forEach(p => all.push([p, .22]));
    const hd = P2(S.head); all.push([hd, .22]);
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    all.forEach(([p, w]) => { x0 = Math.min(x0, p[0] - w / 2); x1 = Math.max(x1, p[0] + w / 2); y0 = Math.min(y0, p[1] - w / 2); y1 = Math.max(y1, p[1] + w / 2); });
    const bars = [];
    (ex.props || []).forEach(pk => {
      if (pk === 'pbars') bars.push(`<line x1="${(x0 - .05).toFixed(3)}" y1="-1.15" x2="${(x1 + .05).toFixed(3)}" y2="-1.15" stroke-width=".035" opacity=".55"/>`);
      if (pk === 'ptx') bars.push(`<line x1="-.25" y1="-.15" x2=".25" y2="-.15" stroke-width=".03" opacity=".55"/>`);
      if (pk === 'rowbar') bars.push(`<circle cx="0" cy="-.95" r=".03" fill="currentColor" stroke="none" opacity=".7"/>`);
    });
    const floorY = 0;
    y1 = Math.max(y1, floorY + .02);
    const pad = .05, W = x1 - x0 + pad * 2, H = y1 - y0 + pad * 2;
    const f = (n) => n.toFixed(3);
    const line = (s) => `<line x1="${f(s.A[0])}" y1="${f(s.A[1])}" x2="${f(s.B[0])}" y2="${f(s.B[1])}" stroke-width="${s.w}"${s.far ? ' opacity=".38"' : ''}/>`;
    return `<svg class="pic" viewBox="${f(x0 - pad)} ${f(y0 - pad)} ${f(W)} ${f(H)}" preserveAspectRatio="xMidYMax meet" aria-hidden="true">` +
      `<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">` +
      `<line x1="${f(x0 - pad)}" y1="${floorY + .012}" x2="${f(x1 + pad)}" y2="${floorY + .012}" stroke-width=".018" opacity=".3"/>` + bars.join('') +
      segs.filter(s => s.far).map(line).join('') +
      `<polyline points="${tor.map(p => f(p[0]) + ',' + f(p[1])).join(' ')}" stroke-width=".2"/>` +
      `<circle cx="${f(hd[0])}" cy="${f(hd[1])}" r=".1" fill="currentColor" stroke="none"/>` +
      segs.filter(s => !s.far).map(line).join('') + `</g></svg>`;
  }

  /* ---------- 측정 도우미 ---------- */
  const pts = {
    shM: (S, o) => mid(S.sh[0], S.sh[1], o), hipM: (S, o) => mid(S.hip[0], S.hip[1], o), anM: (S, o) => mid(S.an[0], S.an[1], o),
    wrM: (S, o) => mid(S.wr[0], S.wr[1], o), knM: (S, o) => mid(S.kn[0], S.kn[1], o), elR: (S, o) => o.copy(S.el[1]),
    head: (S, o) => o.copy(S.head), com: (S, o) => o.copy(S.com),
    heelM: (S, o) => { o.set(0, 0, 0); for (let i = 0; i < 2; i++) o.add(_a.copy(HEEL).applyQuaternion(S.fq[i]).add(S.an[i]).multiplyScalar(.5)); return o; },
    toeM: (S, o) => { o.set(0, 0, 0); for (let i = 0; i < 2; i++) o.add(_a.copy(TOE).applyQuaternion(S.fq[i]).add(S.an[i]).multiplyScalar(.5)); return o; }
  };
  const angleAt = (a, b, c) => { const u = _a.subVectors(a, b).normalize(), v = _b.subVectors(c, b).normalize(); return Math.acos(clamp(u.dot(v), -1, 1)) * R2D; };

  window.PL = window.PL || {};
  Object.assign(window.PL, { THREE: T, DIM, prepare, poseAt, solve, newSkel, Stage, pictogram, pts, angleAt, V, D2R, R2D, clamp, lowestY, TOE, ARM });
})();
