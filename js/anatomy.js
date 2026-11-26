/* 해부 모드
   BodyParts3D·Z-Anatomy의 근육과 뼈(가공본)를 앱의 관절 구조에 연결해서 동작대로 움직입니다.
   - 25개 뼈대: 골반·허리·가슴우리·목·머리, 좌우 빗장뼈·어깨뼈·위팔·아래팔(+비틀림)·손·손가락·넙다리·정강이·발
   - 어깨뼈: 전인/후인(가슴우리를 감싸며 회전), 상승/하강, 팔을 들면 위쪽 회전(견갑상완 리듬)
   - 아래팔: 손 방향에서 엎침·뒤침 비틀림을 뽑아 아래팔 근육에 나눠 줌
   - 근육 끝점 사이 길이가 줄면 굵어지고 늘면 가늘어짐(부피 보존 근사)
   - 색: 기본 / 활성도(추정) / 길이 변화(짧아짐·늘어남) */
(function () {
  'use strict';
  const T = window.THREE, PL = window.PL;
  if (!T || !PL || !PL.Stage) return;
  const D2R = Math.PI / 180;
  const SIDES = [1, -1];
  const TEXW = 256;

  let decoderP = null;
  function getDecoder() {
    if (decoderP) return decoderP;
    decoderP = (async () => {
      const W = window.MeshoptDecoder;
      if (W && W.supported) {
        try { await W.ready; return W; } catch (e) { console.warn('WASM 디코더를 쓸 수 없어 JS 디코더로 전환', e); }
      }
      if (window.MeshoptDecoderRef) return window.MeshoptDecoderRef;
      throw new Error('meshopt 디코더 없음');
    })();
    return decoderP;
  }

  const v3 = (a) => new T.Vector3(a[0], a[1], a[2]);
  const _a = new T.Vector3(), _b = new T.Vector3(), _c = new T.Vector3(), _X = new T.Vector3(), _Y = new T.Vector3(), _Z = new T.Vector3();
  const _q = new T.Quaternion(), _q2 = new T.Quaternion(), _m = new T.Matrix4();
  function limbQ(a, b, front, out) {
    _Y.subVectors(a, b).normalize();
    _Z.copy(front).addScaledVector(_Y, -front.dot(_Y));
    if (_Z.lengthSq() < 1e-8) _Z.set(0, 0, 1).addScaledVector(_Y, -_Y.z);
    _Z.normalize(); _X.crossVectors(_Y, _Z);
    _m.makeBasis(_X, _Y, _Z); return out.setFromRotationMatrix(_m);
  }
  const baseName = (en) => en.replace(/\b(left|right)\b/g, '').replace(/\s*\(\d+\)/g, '').replace(/\s+/g, ' ').trim();

  function Anatomy(stage) {
    this.stage = stage; this.ready = false; this.visible = false;
    this.layer = 'muscle'; this.colorMode = 1; this.sel = -1;
    this.act = null; this.velo = null;
  }

  Anatomy.prototype.load = async function (lod, base) {
    base = base || 'assets/anatomy/';
    const decP = getDecoder();
    const meta = await fetch(base + 'anatomy.json').then(r => { if (!r.ok) throw new Error('anatomy.json ' + r.status); return r.json(); });
    // 저장소에서는 바이너리(.bin), 바이너리를 못 올리는 곳에서는 base64 텍스트(.txt)
    const file = (meta.files && meta.files[lod]) || ('anatomy-' + lod + '.bin');
    const bin = await fetch(base + file).then(r => { if (!r.ok) throw new Error(file + ' ' + r.status); return meta.enc === 'b64' ? r.text() : r.arrayBuffer(); })
      .then(x => {
        if (typeof x !== 'string') return x;
        const s = atob(x.trim()), u = new Uint8Array(s.length);
        for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
        return u.buffer;
      });
    const dec = await decP;
    this.meta = meta; this.lod = lod;
    const src = new Uint8Array(bin);
    const geo = {};
    for (const layer of ['mus', 'bone']) {
      const info = meta.lods[lod][layer], n = info.count, st = info.streams;
      const part = (s) => src.subarray(s.offset, s.offset + s.bytes);
      const pos = new Int16Array(n * 4); dec.decodeVertexBuffer(new Uint8Array(pos.buffer), n, 8, part(st.pos));
      const nrm = new Int8Array(n * 4); dec.decodeVertexBuffer(new Uint8Array(nrm.buffer), n, 4, part(st.nrm), st.nrm.filter || undefined);
      const skin = new Uint8Array(n * 8); dec.decodeVertexBuffer(skin, n, 8, part(st.skin));
      const aux = new Uint16Array(n * 2); dec.decodeVertexBuffer(new Uint8Array(aux.buffer), n, 4, part(st.aux));
      const idx = new Uint32Array(info.index_count); dec.decodeIndexBuffer(new Uint8Array(idx.buffer), info.index_count, 4, part(st.idx));
      const [mn, mx] = meta.header.bounds[layer];
      const P = new Float32Array(n * 3);
      for (let k = 0; k < 3; k++) {
        const sc = (mx[k] - mn[k]) / 65534;
        for (let i = 0; i < n; i++) P[i * 3 + k] = mn[k] + (pos[i * 4 + k] + 32767) * sc;
      }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.BufferAttribute(P, 3));
      g.setAttribute('normal', new T.InterleavedBufferAttribute(new T.InterleavedBuffer(nrm, 4), 3, 0, true));
      const sk = new T.InterleavedBuffer(skin, 8);
      g.setAttribute('skinIndex', new T.InterleavedBufferAttribute(sk, 4, 0, false));
      g.setAttribute('skinWeight', new T.InterleavedBufferAttribute(sk, 4, 4, true));
      const ax = new T.InterleavedBuffer(aux, 2);
      g.setAttribute('mid', new T.InterleavedBufferAttribute(ax, 1, 0, false));
      g.setAttribute('mu', new T.InterleavedBufferAttribute(ax, 1, 1, true));
      g.setIndex(new T.BufferAttribute(idx, 1));
      geo[layer] = g;
    }
    this._build(geo);
    this.ready = true;
    return this;
  };

  Anatomy.prototype._build = function (geo) {
    const meta = this.meta, LM = meta.landmarks, DIM = PL.DIM;
    // ---- 묶음 자세(해부 모델이 서 있는 자세)의 뼈대 좌표 ----
    const hipMid = v3(LM.L.hip).add(v3(LM.R.hip)).multiplyScalar(.5);
    const root = hipMid.clone(); root.y -= DIM.hip[1];
    const waist = root.clone().add(v3(DIM.waist)), chest = waist.clone().add(v3(DIM.chest));
    const neck = chest.clone().add(v3(DIM.neck)), head = neck.clone().add(v3(DIM.head));
    const QI = new T.Quaternion();
    const bind = new Array(25);
    const put = (i, p, q) => { bind[i] = { p: p.clone(), q: q.clone() }; };
    put(0, root, QI); put(1, waist, QI); put(2, chest, QI); put(3, neck, QI); put(4, head, QI);
    const id = (sym, i) => 5 + ['C', 'S', 'U', 'F', 'W', 'A', 'G', 'Th', 'K', 'D'].indexOf(sym) * 2 + i;
    this.id = id;
    this.side = [];
    for (let i = 0; i < 2; i++) {
      const L = LM[i ? 'R' : 'L'];
      const sh = v3(L.shoulder), el = v3(L.elbow), wr = v3(L.wrist), kn = v3(L.knuckle);
      const hip = v3(L.hip), knee = v3(L.knee), ank = v3(L.ankle), heel = v3(L.heel), ball = v3(L.ball);
      const sc = v3(L.sc), ac = v3(L.ac);
      put(id('C', i), sc, QI); put(id('S', i), sh, QI);
      const sw = _a.subVectors(wr, sh).normalize();
      const bend = _b.subVectors(el, sh); bend.addScaledVector(sw, -bend.dot(sw)).normalize();
      const front = bend.clone().negate();
      const qU = limbQ(sh, el, front, new T.Quaternion()), qF = limbQ(el, wr, front, new T.Quaternion());
      put(id('U', i), sh, qU); put(id('F', i), el, qF); put(id('W', i), el, qF);
      const Zh = _a.subVectors(kn, wr).normalize(), Yh = _b.set(0, 0, -1); Yh.addScaledVector(Zh, -Yh.dot(Zh)).normalize();
      _m.makeBasis(_c.crossVectors(Yh, Zh), Yh, Zh); const qA = new T.Quaternion().setFromRotationMatrix(_m);
      put(id('A', i), wr, qA); put(id('G', i), kn, qA);
      const fz = new T.Vector3(0, 0, 1);
      put(id('Th', i), hip, limbQ(hip, knee, fz, new T.Quaternion())); put(id('K', i), knee, limbQ(knee, ank, fz, new T.Quaternion()));
      const Zf = _a.subVectors(ball, heel); Zf.y = 0; Zf.normalize(); const Yf = _b.set(0, 1, 0);
      _m.makeBasis(_c.crossVectors(Yf, Zf), Yf, Zf); put(id('D', i), ank, new T.Quaternion().setFromRotationMatrix(_m));
      this.side.push({
        SCloc: sc.clone().sub(chest), AC0: ac.clone(), G0: sh.clone(), v0: ac.clone().sub(sc).normalize(),
        relBindInv: qF.clone().invert().multiply(qA).invert(),
        Kloc: kn.clone().sub(wr).applyQuaternion(qA.clone().invert())
      });
    }
    this.bind = bind;
    this.bindInv = bind.map(b => new T.Matrix4().compose(b.p, b.q, new T.Vector3(1, 1, 1)).invert());
    // ---- 뼈대(three.js Skeleton): matrixWorld를 직접 채움 ----
    this.bones = bind.map(() => { const b = new T.Bone(); b.matrixAutoUpdate = false; return b; });
    this.skeleton = new T.Skeleton(this.bones, this.bindInv.map(m => m.clone()));
    this.cur = bind.map(() => ({ p: new T.Vector3(), q: new T.Quaternion() }));
    this.skinM = bind.map(() => new T.Matrix4());
    // ---- 근육 데이터 텍스처 ----
    const M = meta.muscles.length;
    this.M = M;
    this.tex = new T.DataTexture(new Float32Array(TEXW * 4 * 4), TEXW, 4, T.RGBAFormat, T.FloatType);
    this.tex.magFilter = this.tex.minFilter = T.NearestFilter; this.tex.needsUpdate = true;
    this.musA = meta.muscles.map(m => v3(m.A)); this.musB = meta.muscles.map(m => v3(m.B));
    this.musC = meta.muscles.map(m => m.C.map(v3));
    this.L0 = meta.muscles.map(m => m.L0);
    this.base = meta.muscles.map(m => baseName(m.en));
    this.act = new Float32Array(M); this.velo = new Float32Array(M); this.len = new Float32Array(M);
    this.uniforms = {
      uMData: { value: this.tex }, uTexW: { value: TEXW }, uMode: { value: 1 },
      uMuscle: { value: new T.Color('#b5483f').convertSRGBToLinear() }, uTendon: { value: new T.Color('#e8dcc8').convertSRGBToLinear() },
      uIdBase: { value: 0 }
    };
    const U = this.uniforms;
    const vsHead = 'attribute float mid;\nattribute float mu;\nuniform sampler2D uMData;\nuniform float uTexW;\nvarying vec4 vMus;\nvarying float vKind;\n';
    const vsBulge = `
      #include <skinning_vertex>
      {
        float cx = (mid + 0.5) / uTexW;
        vec4 tA = texture2D(uMData, vec2(cx, 0.125));
        vec4 tB = texture2D(uMData, vec2(cx, 0.375));
        vMus = texture2D(uMData, vec2(cx, 0.625));
        vKind = tB.w;
        vec3 ab = tB.xyz - tA.xyz;
        float L2 = max(dot(ab, ab), 1e-6);
        vec3 cp = tA.xyz + ab * clamp(dot(transformed - tA.xyz, ab) / L2, 0.0, 1.0);
        float belly = sin(3.14159265 * clamp(mu, 0.0, 1.0));
        transformed = cp + (transformed - cp) * mix(1.0, tA.w, belly);
      }`;
    // 근육 재질
    const musMat = new T.MeshStandardMaterial({ color: 0xffffff, roughness: .52, metalness: 0, skinning: true });
    musMat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = vsHead + sh.vertexShader.replace('#include <skinning_vertex>', vsBulge);
      sh.fragmentShader = 'uniform float uMode;\nuniform vec3 uMuscle;\nuniform vec3 uTendon;\nvarying vec4 vMus;\nvarying float vKind;\n' +
        sh.fragmentShader.replace('vec4 diffuseColor = vec4( diffuse, opacity );', `
          vec3 mcol = vKind > 0.5 ? uTendon : uMuscle;
          vec3 col = mcol;
          float act = vMus.x;
          if (uMode > 0.5 && uMode < 1.5) {
            vec3 dimc = vKind > 0.5 ? vec3(0.55, 0.52, 0.48) : vec3(0.36, 0.27, 0.26);
            vec3 hot = mix(mcol * 1.35, vec3(1.0, 0.42, 0.1), smoothstep(0.6, 1.0, act));
            col = mix(dimc, hot, smoothstep(0.06, 0.85, act));
          } else if (uMode > 1.5) {
            float v = clamp(vMus.y, -1.0, 1.0);
            vec3 neutral = vKind > 0.5 ? vec3(0.6, 0.58, 0.55) : vec3(0.42, 0.36, 0.35);
            col = v > 0.0 ? mix(neutral, vec3(1.0, 0.3, 0.08), v) : mix(neutral, vec3(0.12, 0.45, 1.0), -v);
          }
          col = mix(col, vec3(1.0, 0.86, 0.25), vMus.z * 0.7);
          vec4 diffuseColor = vec4( col, opacity );`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          if (uMode > 0.5 && uMode < 1.5) totalEmissiveRadiance += col * smoothstep(0.55, 1.0, vMus.x) * 0.28;
          totalEmissiveRadiance += vec3(0.5, 0.4, 0.05) * vMus.z * 0.25;`);
    };
    // 뼈 재질
    const boneMat = new T.MeshStandardMaterial({ color: new T.Color('#efe6d2').convertSRGBToLinear(), roughness: .7, metalness: 0, skinning: true });
    // 선택(GPU 피킹) 재질
    const pickMat = (idBase, bulge) => {
      const m = new T.MeshBasicMaterial({ skinning: true });
      m.onBeforeCompile = (sh) => {
        sh.uniforms.uMData = U.uMData; sh.uniforms.uTexW = U.uTexW; sh.uniforms.uIdBase = { value: idBase };
        sh.vertexShader = vsHead + 'uniform float uIdBase;\nvarying vec3 vId;\n' + sh.vertexShader
          .replace('#include <skinning_vertex>', (bulge ? vsBulge : '#include <skinning_vertex>') + '\n{ float pid = mid + 1.0 + uIdBase; vId = vec3(mod(pid, 256.0), floor(pid / 256.0), 0.0) / 255.0; }');
        sh.fragmentShader = 'varying vec3 vId;\n' + sh.fragmentShader.replace(/}\s*$/, '  gl_FragColor = vec4(vId, 1.0);\n}');
      };
      return m;
    };
    this.musMat = musMat; this.boneMat = boneMat;
    this.pickMus = pickMat(0, true); this.pickBone = pickMat(1000, false);
    const mk = (g, mat) => {
      const m = new T.SkinnedMesh(g, mat);
      m.bind(this.skeleton, new T.Matrix4());
      m.frustumCulled = false; m.visible = false; m.layers.enable(1);
      this.stage.scene.add(m); return m;
    };
    this.musMesh = mk(geo.mus, musMat);
    this.boneMesh = mk(geo.bone, boneMat);
    this.musMesh.castShadow = false; this.boneMesh.castShadow = false; // 그림자는 투명 마네킹이 대신
    this.pickRT = new T.WebGLRenderTarget(1, 1);
    // 기본 이름 -> 근육 번호
    this.byBase = {};
    this.base.forEach((b, i) => { (this.byBase[b] = this.byBase[b] || []).push(i); });
  };

  // ---- 현재 자세에서 뼈대 좌표 ----
  Anatomy.prototype.frames = function (S, out, rec) {
    const set = (i, p, q) => { out[i].p.copy(p); out[i].q.copy(q); };
    set(0, S.pel.p, S.pel.q); set(1, S.wai.p, S.wai.q); set(2, S.che.p, S.che.q); set(3, S.nek.p, S.nek.q); set(4, S.head, S.nek.q);
    const id = this.id, cq = S.che.q;
    for (let i = 0; i < 2; i++) {
      const s = SIDES[i], sd = this.side[i];
      const prot = S.sc[i * 2];
      // 어깨뼈: 위팔이 가슴우리 아래 방향과 이루는 각도로 위쪽 회전
      _a.subVectors(S.el[i], S.sh[i]).normalize();
      _b.set(0, -1, 0).applyQuaternion(cq);
      const elev = Math.acos(Math.max(-1, Math.min(1, _a.dot(_b)))) / D2R;
      const ur = Math.max(0, Math.min(50, 0.38 * (elev - 25)));
      if (rec) { rec.elev[i] = elev; rec.ur[i] = ur; }
      const qS = out[id('S', i)].q.copy(cq)
        .multiply(_q.setFromAxisAngle(_c.set(0, 1, 0), -s * 15 * prot * D2R))
        .multiply(_q.setFromAxisAngle(_c.set(0, 0, 1), s * ur * D2R));
      out[id('S', i)].p.copy(S.sh[i]);
      // 빗장뼈: 복장뼈 끝은 가슴우리에, 어깨 끝은 어깨뼈를 따라감
      const scW = out[id('C', i)].p.copy(sd.SCloc).applyQuaternion(cq).add(S.che.p);
      const acW = _a.copy(sd.AC0).sub(sd.G0).applyQuaternion(qS).add(S.sh[i]);
      _b.subVectors(acW, scW).applyQuaternion(_q2.copy(cq).invert()).normalize();
      out[id('C', i)].q.copy(cq).multiply(_q.setFromUnitVectors(sd.v0, _b));
      // 위팔·아래팔: 팔꿈치 굽힘 평면 기준
      _c.copy(S.ab[i]).negate();
      limbQ(S.sh[i], S.el[i], _c, out[id('U', i)].q); out[id('U', i)].p.copy(S.sh[i]);
      if (rec) { // 위팔 회전: 가슴우리 기준 위팔 방향을 묶음 자세와 비교해 위팔 축(Y) 성분만
        _q2.copy(this.bind[id('U', i)].q).invert().multiply(_q.copy(cq).invert().multiply(out[id('U', i)].q));
        let er = 2 * Math.atan2(_q2.y, _q2.w); if (er > Math.PI) er -= 2 * Math.PI; else if (er < -Math.PI) er += 2 * Math.PI;
        rec.er[i] = s * er / D2R;
      }
      const qF = limbQ(S.el[i], S.wr[i], _c, out[id('F', i)].q); out[id('F', i)].p.copy(S.el[i]);
      // 아래팔 비틀림(엎침·뒤침): 손과 아래팔의 상대 회전에서 아래팔 축(Y) 성분
      _q.copy(qF).invert().multiply(S.hq[i]).multiply(sd.relBindInv);
      let tw = 2 * Math.atan2(_q.y, _q.w);
      if (tw > Math.PI) tw -= 2 * Math.PI; else if (tw < -Math.PI) tw += 2 * Math.PI;
      if (rec) rec.tw[i] = -s * tw / D2R;
      out[id('W', i)].q.copy(qF).multiply(_q.setFromAxisAngle(_c.set(0, 1, 0), 0.9 * tw)); out[id('W', i)].p.copy(S.el[i]);
      set(id('A', i), S.wr[i], S.hq[i]);
      // 손가락: 손허리뼈 머리에서 굽힘
      out[id('G', i)].p.copy(sd.Kloc).applyQuaternion(S.hq[i]).add(S.wr[i]);
      out[id('G', i)].q.copy(S.hq[i]).multiply(_q.setFromAxisAngle(_c.set(1, 0, 0), S.curl[i] * D2R));
      limbQ(S.hip[i], S.kn[i], S.lb[i], out[id('Th', i)].q); out[id('Th', i)].p.copy(S.hip[i]);
      limbQ(S.kn[i], S.an[i], S.lb[i], out[id('K', i)].q); out[id('K', i)].p.copy(S.kn[i]);
      set(id('D', i), S.an[i], S.fq[i]);
    }
    return out;
  };
  const ONE = new T.Vector3(1, 1, 1);
  Anatomy.prototype._skin = function (frames, mats) {
    for (let b = 0; b < 25; b++) mats[b].compose(frames[b].p, frames[b].q, ONE).multiply(this.bindInv[b]);
    return mats;
  };
  function lbs(p, idx, w, mats, out) {
    out.set(0, 0, 0);
    for (let k = 0; k < 4; k++) if (w[k] > 0) out.addScaledVector(_c.copy(p).applyMatrix4(mats[idx[k]]), w[k]);
    return out;
  }
  // 근육 길이 계산용 임시 버퍼
  const tmpFrames = () => Array.from({ length: 25 }, () => ({ p: new T.Vector3(), q: new T.Quaternion() }));
  const tmpMats = () => Array.from({ length: 25 }, () => new T.Matrix4());
  const F1 = tmpFrames(), F2 = tmpFrames(), M1 = tmpMats(), M2 = tmpMats();
  const pA = new T.Vector3(), pB = new T.Vector3(), pC = new T.Vector3(), pD = new T.Vector3();
  // 중심선(5점) 길이: 관절을 감싸는 근육도 길이 변화가 맞게 잡힘
  Anatomy.prototype.pathLen = function (i, Mx) {
    const m = this.meta.muscles[i], C = this.musC[i];
    let L = 0;
    lbs(C[0], m.Ci[0], m.Cw[0], Mx, pC);
    for (let k = 1; k < C.length; k++) { lbs(C[k], m.Ci[k], m.Cw[k], Mx, pD); L += pC.distanceTo(pD); pC.copy(pD); }
    return L;
  };
  Anatomy.prototype.lengths = function (S, out, F, Mx) {
    this._skin(this.frames(S, F), Mx);
    for (let i = 0; i < this.M; i++) out[i] = this.pathLen(i, Mx);
    return out;
  };

  /* 매 프레임: S = 현재 골격, Sm/Sp = 약간 이전/이후 골격(길이 변화 속도), act = 근육 기본 이름 -> 활성도 */
  Anatomy.prototype.update = function (S, Sm, Sp, dts, actMap) {
    if (!this.ready) return;
    this.jt = this.jt || { elev: [0, 0], ur: [0, 0], er: [0, 0], tw: [0, 0] };
    const fr = this.frames(S, this.cur, this.jt);
    for (let b = 0; b < 25; b++) this.bones[b].matrixWorld.compose(fr[b].p, fr[b].q, ONE);
    this._skin(fr, this.skinM);
    const mus = this.meta.muscles, d = this.tex.image.data;
    this._lm = this._lm || new Float32Array(this.M); this._lp = this._lp || new Float32Array(this.M);
    const lm = Sm ? this.lengths(Sm, this._lm, F1, M1) : null;
    const lp = Sp ? this.lengths(Sp, this._lp, F2, M2) : null;
    for (let i = 0; i < this.M; i++) {
      const m = mus[i];
      lbs(this.musA[i], m.Ci[0], m.Cw[0], this.skinM, pA); lbs(this.musB[i], m.Ci[4], m.Cw[4], this.skinM, pB);
      const r = this.pathLen(i, this.skinM) / this.L0[i];
      this.len[i] = r;
      const bulge = Math.max(.78, Math.min(1.32, Math.pow(r, -0.5 * m.b)));
      const v = lm && lp && dts > 0 ? -((lp[i] - lm[i]) / dts) / this.L0[i] : 0;
      this.velo[i] = v;
      const a = actMap ? (actMap[this.base[i]] || 0) : 0;
      this.act[i] = a;
      let o = i * 4;
      d[o] = pA.x; d[o + 1] = pA.y; d[o + 2] = pA.z; d[o + 3] = bulge;
      o = (TEXW + i) * 4;
      d[o] = pB.x; d[o + 1] = pB.y; d[o + 2] = pB.z; d[o + 3] = m.k === 't' ? 1 : 0;
      o = (TEXW * 2 + i) * 4;
      d[o] = a; d[o + 1] = Math.max(-1, Math.min(1, v / 0.22)); d[o + 2] = i === this.sel ? 1 : 0; d[o + 3] = 0;
    }
    this.tex.needsUpdate = true;
  };

  Anatomy.prototype.show = function (on) {
    this.visible = on;
    if (!this.ready) return;
    this.musMesh.visible = on && this.layer === 'muscle';
    this.boneMesh.visible = on;
  };
  Anatomy.prototype.setLayer = function (layer) { this.layer = layer; this.show(this.visible); };
  Anatomy.prototype.setColorMode = function (m) { this.colorMode = m; if (this.uniforms) this.uniforms.uMode.value = m; };

  // 화면 좌표의 근육/뼈 번호 (근육 0..M-1, 뼈 1000+)
  Anatomy.prototype.pick = function (x, y) {
    if (!this.ready || !this.visible) return null;
    const st = this.stage, r = st.renderer, cam = st.cams[0];
    const mm = this.musMesh.material, bm = this.boneMesh.material;
    this.musMesh.material = this.pickMus; this.boneMesh.material = this.pickBone;
    const prevMask = cam.layers.mask;
    cam.layers.set(1);
    cam.setViewOffset(st.w, st.h, Math.round(x), Math.round(y), 1, 1);
    const prevTarget = r.getRenderTarget();
    const cc = new T.Color(); r.getClearColor(cc); const ca = r.getClearAlpha();
    r.setRenderTarget(this.pickRT); r.setClearColor(0x000000, 0); r.clear();
    r.render(st.scene, cam);
    const px = new Uint8Array(4); r.readRenderTargetPixels(this.pickRT, 0, 0, 1, 1, px);
    r.setRenderTarget(prevTarget); r.setClearColor(cc, ca);
    cam.clearViewOffset(); cam.layers.mask = prevMask;
    this.musMesh.material = mm; this.boneMesh.material = bm;
    const pid = px[0] + px[1] * 256;
    if (!pid) return null;
    return pid >= 1000 ? { bone: pid - 1001 } : { muscle: pid - 1 };
  };

  PL.Anatomy = Anatomy;
})();
