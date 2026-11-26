#!/usr/bin/env python3
"""해부 모델 가공 1단계 (Python)
선택 -> 좌표 변환(앱 좌표: Y 위, Z 앞, 단위 m) -> 관절 중심 -> 간소화(hi/lo) -> 스킨 가중치 -> 근육 끝점 -> 원시 버퍼

사용:
  python3 -I tools/anatomy/build_anatomy.py --src <BodyExplorer/public 폴더> --raw <작업 폴더>
다음 단계: node tools/anatomy/encode_anatomy.js --raw <작업 폴더> --out assets/anatomy
"""
import argparse
import json
import os
import re
import sys

import numpy as np
from scipy import sparse
from scipy.spatial import cKDTree
import fast_simplification as fsimp

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from glbload import load_meshes  # noqa: E402
from parts import MUSCLES, BONES, BONE_IDS, SIDED  # noqa: E402

BUDGET = {'hi': {'mus': 190000, 'bone': 60000}, 'lo': {'mus': 70000, 'bone': 21000}}
MINTRI = {'hi': {'mus': 60, 'bone': 40}, 'lo': {'mus': 28, 'bone': 16}}
FALLOFF = 0.012     # 뼈까지 거리 차이에 대한 가중치 감쇠(m)
SMOOTH_IT = 10      # 가중치 평활 반복
BULGE = {'m': 1.0, 'f': 0.45, 't': 0.0}


def to_rig(p):
    return np.stack([p[:, 0], p[:, 2], -p[:, 1]], 1) / 1000.0


def parse_name(n):
    m = re.search(r'\b(left|right)\b', n)
    side = {'left': 'L', 'right': 'R'}[m.group(1)] if m else None
    base = re.sub(r'\b(left|right)\b', '', n)
    base = re.sub(r'\s*\(\d+\)', '', base)
    return side, re.sub(r'\s+', ' ', base).strip()


def weld(P, F, N0, tol=2e-6):
    q = np.round(P / tol).astype(np.int64)
    _, first, inv = np.unique(q, axis=0, return_index=True, return_inverse=True)
    inv = inv.reshape(-1)
    F2 = inv[F]
    ok = (F2[:, 0] != F2[:, 1]) & (F2[:, 1] != F2[:, 2]) & (F2[:, 0] != F2[:, 2])
    F2 = F2[ok]
    used = np.unique(F2)
    remap = -np.ones(len(first), np.int64)
    remap[used] = np.arange(len(used))
    # 원본 법선(용접된 정점에 평균)으로 감기 방향 확인
    Nw = np.zeros((len(first), 3))
    np.add.at(Nw, inv, N0)
    return P[first][used], remap[F2], Nw[used]


def face_normals(P, F):
    return np.cross(P[F[:, 1]] - P[F[:, 0]], P[F[:, 2]] - P[F[:, 0]])


def vertex_normals(P, F):
    fn = face_normals(P, F)
    N = np.zeros_like(P)
    for k in range(3):
        np.add.at(N, F[:, k], fn)
    return N / np.maximum(1e-12, np.linalg.norm(N, axis=1, keepdims=True))


def area(P, F):
    return 0.5 * np.linalg.norm(face_normals(P, F), axis=1).sum()


def decimate(P, F, target):
    if len(F) <= target:
        return P, F
    red = float(np.clip(1.0 - target / len(F), 0.0, 0.995))
    P2, F2 = fsimp.simplify(P.astype(np.float32), F.astype(np.int32), target_reduction=red, agg=7)
    P2 = P2.astype(np.float64)
    F2 = F2.astype(np.int64)
    used = np.unique(F2)
    remap = -np.ones(len(P2), np.int64)
    remap[used] = np.arange(len(used))
    return P2[used], remap[F2]


def allocate(areas, orig, budget, mn):
    w = np.power(np.maximum(areas, 1e-9), 0.75)
    t = np.zeros(len(w))
    fixed = np.zeros(len(w), bool)
    for _ in range(20):
        free = ~fixed
        if not free.any():
            break
        rem = budget - t[fixed].sum()
        t[free] = rem * w[free] / w[free].sum()
        lo = free & (t < mn)
        hi = free & (t > orig)
        t[lo] = np.minimum(mn, orig[lo])
        t[hi] = orig[hi]
        fixed |= lo | hi
        if not (lo.any() or hi.any()):
            break
    return np.maximum(4, np.round(t)).astype(int)


def sphere_fit(P):
    A = np.c_[2 * P, np.ones(len(P))]
    f = (P ** 2).sum(1)
    c, *_ = np.linalg.lstsq(A, f, rcond=None)
    return c[:3], float(np.sqrt(c[3] + (c[:3] ** 2).sum()))


def landmarks(BN, hand_pts, foot_pts):
    """BN[(side, base)] = 뼈 정점(앱 좌표). 관절 중심과 손·발 접지 치수."""
    LM = {}
    for side, s in (('L', 1), ('R', -1)):
        hum = BN[(side, 'humerus')]
        fem = BN[(side, 'femur')]
        top = hum[:, 1].max()
        cx = np.median(hum[:, 0])
        shc, shr = sphere_fit(hum[(hum[:, 1] > top - 0.045) & (s * (hum[:, 0] - cx) < 0.005)])
        bot = hum[:, 1].min()
        d = hum[hum[:, 1] < bot + 0.035]
        elb = np.array([(d[:, 0].max() + d[:, 0].min()) / 2, bot + 0.016, d[:, 2].mean()])
        wr = BN[(side, 'lunate')].mean(0)
        mc = [BN[(side, n + ' metacarpal bone')] for n in ('second', 'third', 'fourth', 'fifth')]
        kn = np.mean([m[m[:, 1].argmin()] for m in mc], 0)
        tip = BN[(side, 'distal phalanx of middle finger')]
        tipp = tip[tip[:, 1].argmin()]
        thumb = BN[(side, 'first metacarpal bone')].mean(0)
        ftop = fem[:, 1].max()
        fcx = np.median(fem[:, 0])
        hipc, hipr = sphere_fit(fem[(fem[:, 1] > ftop - 0.06) & (s * (fem[:, 0] - fcx) < -0.01)])
        fb = fem[:, 1].min()
        fd = fem[fem[:, 1] < fb + 0.045]
        knee = np.array([(fd[:, 0].max() + fd[:, 0].min()) / 2, fb + 0.02, fd[:, 2].mean()])
        tib = BN[(side, 'tibia')]
        fib = BN[(side, 'fibula')]
        mm_ = tib[tib[:, 1].argmin()]
        lm_ = fib[fib[:, 1].argmin()]
        ank = np.array([(mm_[0] + lm_[0]) / 2, (mm_[1] + lm_[1]) / 2 + 0.012, (mm_[2] + lm_[2]) / 2])
        clav = BN[(side, 'clavicle')]
        sc = clav[np.argmin(np.abs(clav[:, 0]))]
        ac = clav[np.argmax(np.abs(clav[:, 0]))]
        # 손바닥 두께: 손목 중심에서 손바닥 면(앞쪽)까지
        hp = hand_pts[side]
        seg = kn - wr
        u = np.clip(((hp - wr) @ seg) / (seg @ seg), 0, 1)
        near = np.linalg.norm(hp - (wr + u[:, None] * seg), axis=1) < 0.045
        palm_z = np.percentile(hp[near][:, 2], 97)
        # 발: 발끝 아랫면, 뒤꿈치 아랫면 (발 좌표가 아니라 앱 좌표로 저장, 엔진에서 변환)
        fp = foot_pts[side]
        toe_i = np.argmax(fp[:, 2])
        tip_region = fp[fp[:, 2] > fp[toe_i, 2] - 0.025]
        toe = np.array([fp[toe_i, 0], tip_region[:, 1].min(), fp[toe_i, 2] - 0.006])
        heel_region = fp[fp[:, 2] < fp[:, 2].min() + 0.03]
        heel = np.array([heel_region[:, 0].mean(), fp[:, 1].min(), fp[:, 2].min() + 0.012])
        cal = BN[(side, 'calcaneus')]
        mt1 = BN[(side, 'first metatarsal bone')]
        ball = mt1[mt1[:, 2].argmax()]
        LM[side] = dict(shoulder=shc, sh_r=shr, elbow=elb, wrist=wr, knuckle=kn, fingertip=tipp, thumb=thumb,
                        palm_z=palm_z, hip=hipc, hip_r=hipr, knee=knee, ankle=ank, toe=toe, heel=heel,
                        ball=ball, sc=sc, ac=ac, calc=cal.mean(0))
    vc = lambda n: BN[(None, n)].mean(0)
    sp = {'L3': vc('third lumbar vertebra'), 'T12': vc('twelfth thoracic vertebra'), 'T11': vc('eleventh thoracic vertebra'),
          'C7': vc('seventh cervical vertebra'), 'T1': vc('first thoracic vertebra')}
    skull = np.vstack([v for (sd, n), v in BN.items() if re.search(r'^(frontal|parietal|occipital|temporal|sphenoid) bone$', n)])
    sp['head'] = (skull.max(0) + skull.min(0)) / 2
    sp['top'] = np.array([0, skull[:, 1].max(), 0])
    return LM, sp


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def adjacency(F, n):
    r = np.concatenate([F[:, 0], F[:, 1], F[:, 2], F[:, 1], F[:, 2], F[:, 0]])
    c = np.concatenate([F[:, 1], F[:, 2], F[:, 0], F[:, 0], F[:, 1], F[:, 2]])
    A = sparse.csr_matrix((np.ones(len(r)), (r, c)), shape=(n, n))
    A.data[:] = 1.0
    deg = np.asarray(A.sum(1)).ravel()
    return sparse.diags(1.0 / np.maximum(deg, 1)) @ A


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', required=True)
    ap.add_argument('--raw', required=True)
    a = ap.parse_args()
    os.makedirs(a.raw, exist_ok=True)

    sk = load_meshes(os.path.join(a.src, 'skeleton.glb'))
    an = load_meshes(os.path.join(a.src, 'anatomy.glb'))
    floor = min(to_rig(m['pos'])[:, 1].min() for m in sk)

    def prep(m):
        P = to_rig(m['pos'])
        P[:, 1] -= floor
        N0 = to_rig(m['nor']) * 1000.0
        return weld(P, m['idx'], N0)

    def true_side(name, side, P):
        # 원본 데이터의 좌우 이름이 바뀐 경우가 있어(예: flexor pollicis brevis) 위치로 판정
        cx = P[:, 0].mean()
        if side is None or abs(cx) < 0.015:
            return side, name
        g = 'L' if cx > 0 else 'R'
        if g != side:
            fixed = re.sub(r'\b(left|right)\b', lambda mm: 'right' if mm.group(1) == 'left' else 'left', name)
            print(f'좌우 이름 수정: {name} -> {fixed}')
            return g, fixed
        return side, name

    # ---- 뼈 ----
    BN = {}
    bones = []
    for m in sk:
        side, base = parse_name(m['name'])
        P, F, N0 = prep(m)
        side, m['name'] = true_side(m['name'], side, P)
        BN[(side, base)] = P if (side, base) not in BN else np.vstack([BN[(side, base)], P])
        for rx, ko, sym in BONES:
            if re.search(rx, base):
                key = sym + side if sym in SIDED else sym
                bones.append(dict(en=m['name'], base=base, side=side, ko=ko, sym=sym, key=key, P=P, F=F, N0=N0))
                break
    # ---- 근육 ----
    mus = []
    for m in an:
        side, base = parse_name(m['name'])
        if base not in MUSCLES or side is None:
            continue
        ko, grp, bstr, kind = MUSCLES[base]
        P, F, N0 = prep(m)
        side, m['name'] = true_side(m['name'], side, P)
        mus.append(dict(en=m['name'], base=base, side=side, ko=ko, g=grp, kind=kind, bones=bstr.split(), P=P, F=F, N0=N0))
    print(f'선택: 근육 {len(mus)}개, 뼈 {len(bones)}개')

    # 감기 방향: 원본 법선과 반대면 뒤집기
    flipped = 0
    for s in mus + bones:
        fn = face_normals(s['P'], s['F'])
        vn = (s['N0'][s['F'][:, 0]] + s['N0'][s['F'][:, 1]] + s['N0'][s['F'][:, 2]])
        if np.sum(np.einsum('ij,ij->i', fn, vn)) < 0:
            s['F'] = s['F'][:, [0, 2, 1]]
            flipped += 1
    print('감기 방향 뒤집은 구조물', flipped)

    hand_pts = {sd: np.vstack([s['P'] for s in bones if s['side'] == sd and s['sym'] in ('A', 'G')] +
                              [s['P'] for s in mus if s['side'] == sd and s['g'] == '손']) for sd in ('L', 'R')}
    foot_pts = {sd: np.vstack([s['P'] for s in bones if s['side'] == sd and s['sym'] == 'D'] +
                              [s['P'] for s in mus if s['side'] == sd and s['g'] == '발']) for sd in ('L', 'R')}
    LM, SP = landmarks(BN, hand_pts, foot_pts)

    # 뼈대별 KD-트리 (고해상도 뼈 정점)
    trees = {}
    for key in set(s['key'] for s in bones):
        trees[key] = cKDTree(np.vstack([s['P'] for s in bones if s['key'] == key]))
    print('뼈대 트리', sorted(trees))

    def forearm_u(V, side):
        E = LM[side]['elbow']
        W = LM[side]['wrist']
        d = W - E
        return ((V - E) @ d) / (d @ d)

    def skin_muscle(s, V, F):
        sd = s['side']
        cands = [b + sd if b in SIDED else b for b in s['bones']]
        cands = [c for c in cands if c in trees]
        D = np.stack([trees[c].query(V)[0] for c in cands], 1)
        W = np.exp(-(D - D.min(1, keepdims=True)) / FALLOFF)
        cols = list(cands)
        if 'F' + sd in cols:
            j = cols.index('F' + sd)
            t = smoothstep(0.25, 0.95, forearm_u(V, sd))
            W = np.c_[W, W[:, j] * t]
            W[:, j] *= (1 - t)
            cols.append('W' + sd)
        A = adjacency(F, len(V))
        for _ in range(SMOOTH_IT):
            W = 0.5 * W + 0.5 * (A @ W)
        W /= W.sum(1, keepdims=True)
        return W, cols

    def skin_bone(s, V):
        if s['sym'] == 'F' and s['base'] == 'radius':
            t = smoothstep(0.25, 0.95, forearm_u(V, s['side']))
            return np.c_[1 - t, t], ['F' + s['side'], 'W' + s['side']]
        return np.ones((len(V), 1)), [s['key']]

    def top4(W, cols):
        ids = np.array([BONE_IDS[c] for c in cols])
        k = min(4, W.shape[1])
        order = np.argsort(-W, axis=1)[:, :k]
        w = np.take_along_axis(W, order, 1)
        w /= w.sum(1, keepdims=True)
        idx = ids[order]
        if k < 4:
            idx = np.c_[idx, np.zeros((len(W), 4 - k), int)]
            w = np.c_[w, np.zeros((len(W), 4 - k))]
        wq = np.floor(w * 255).astype(int)
        wq[:, 0] += 255 - wq.sum(1)
        return idx.astype(np.uint8), wq.astype(np.uint8)

    # ---- 간소화 + 가중치 ----
    meta_mus, meta_bones = [], []
    out = {}
    for lod in ('hi', 'lo'):
        for layer, items in (('mus', mus), ('bone', bones)):
            areas = np.array([area(s['P'], s['F']) for s in items])
            orig = np.array([len(s['F']) for s in items], float)
            tgt = allocate(areas, orig, BUDGET[lod][layer], MINTRI[lod][layer])
            parts = []
            for i, s in enumerate(items):
                V, F = decimate(s['P'], s['F'], tgt[i])
                N = vertex_normals(V, F)
                if layer == 'mus':
                    W, cols = skin_muscle(s, V, F)
                else:
                    W, cols = skin_bone(s, V)
                si, sw = top4(W, cols)
                if layer == 'mus':
                    if lod == 'hi':  # 근육 길이 축(주성분)과 양 끝
                        c = V.mean(0)
                        X = V - c
                        ev, evec = np.linalg.eigh(X.T @ X)
                        ax = evec[:, -1]
                        t = X @ ax
                        ea = t <= np.percentile(t, 5)
                        eb = t >= np.percentile(t, 95)
                        A_ = V[ea].mean(0)
                        B_ = V[eb].mean(0)
                        Wd = np.zeros((len(V), len(BONE_IDS)))
                        for j, cnm in enumerate(cols):
                            Wd[:, BONE_IDS[cnm]] += W[:, j]
                        def end_w(mask):
                            m = Wd[mask].mean(0)
                            o = np.argsort(-m)[:4]
                            ww = m[o] / m[o].sum()
                            return o.tolist(), [round(float(x), 4) for x in ww]
                        # 양 끝을 붙는 뼈에 고정: parts.py의 뼈 목록은 기시(처음) -> 정지(마지막) 순서
                        sd = s['side']
                        bl = [b + sd if b in SIDED else b for b in s['bones']]
                        first, last = bl[0], bl[-1]
                        if last in trees and trees[last].query(A_)[0] < trees[last].query(B_)[0]:
                            A_, B_ = B_, A_
                        Ai, Aw = [BONE_IDS[first]], [1.0]
                        Bi, Bw = [BONE_IDS[last]], [1.0]
                        s['axis'] = (A_, B_)
                        # 중심선 5점: 양 끝은 붙는 뼈, 가운데 3점은 그 단면 정점들의 평균 가중치(관절을 감싸는 길이 변화)
                        dd = B_ - A_
                        uu = ((V - A_) @ dd) / (dd @ dd)
                        CL = [dict(p=A_, i=Ai, w=Aw)]
                        for uk in (0.25, 0.5, 0.75):
                            sel = np.abs(uu - uk) < 0.09
                            if sel.sum() < 3:
                                sel = np.argsort(np.abs(uu - uk))[:6]
                            m_ = Wd[sel].mean(0)
                            o = np.argsort(-m_)[:3]
                            o = o[m_[o] > 0.02]
                            ww = m_[o] / m_[o].sum()
                            CL.append(dict(p=V[sel].mean(0), i=o.tolist(), w=[round(float(x), 3) for x in ww]))
                        CL.append(dict(p=B_, i=Bi, w=Bw))
                        s['center'] = CL
                        L0 = sum(float(np.linalg.norm(CL[k + 1]['p'] - CL[k]['p'])) for k in range(len(CL) - 1))
                        meta_mus.append(dict(en=s['en'], ko=s['ko'], g=s['g'], side=s['side'], k=s['kind'], b=BULGE[s['kind']],
                                             A=np.round(A_, 5).tolist(), B=np.round(B_, 5).tolist(),
                                             C=[np.round(c['p'], 4).tolist() for c in CL], Ci=[c['i'] for c in CL], Cw=[c['w'] for c in CL],
                                             L0=round(L0, 5)))
                    A_, B_ = s['axis']
                    d = B_ - A_
                    u = np.clip(((V - A_) @ d) / (d @ d), 0, 1)
                else:
                    if lod == 'hi':
                        meta_bones.append(dict(en=s['en'], ko=s['ko'], side=s['side']))
                    u = np.zeros(len(V))
                parts.append(dict(V=V, F=F, N=N, si=si, sw=sw, u=u, id=i))
            out[(layer, lod)] = parts
            print(f'{lod} {layer}: 삼각형 {sum(len(p["F"]) for p in parts):,} 정점 {sum(len(p["V"]) for p in parts):,}')

    # ---- 원시 버퍼 쓰기 ----
    header = {'streams': {}, 'bounds': {}}
    blob = bytearray()
    for layer in ('mus', 'bone'):
        allV = np.vstack([p['V'] for lod in ('hi', 'lo') for p in out[(layer, lod)]])
        mn = allV.min(0) - 0.002
        mx = allV.max(0) + 0.002
        header['bounds'][layer] = [mn.tolist(), mx.tolist()]
        for lod in ('hi', 'lo'):
            parts = out[(layer, lod)]
            V = np.vstack([p['V'] for p in parts])
            N = np.vstack([p['N'] for p in parts])
            SI = np.vstack([p['si'] for p in parts])
            SW = np.vstack([p['sw'] for p in parts])
            U = np.concatenate([p['u'] for p in parts])
            MID = np.concatenate([np.full(len(p['V']), p['id']) for p in parts])
            offs = np.cumsum([0] + [len(p['V']) for p in parts])[:-1]
            I = np.vstack([p['F'] + o for p, o in zip(parts, offs)]).astype(np.uint32)
            ranges = []
            fo = 0
            for p, o in zip(parts, offs):
                ranges.append([int(o), int(len(p['V'])), int(fo), int(len(p['F']) * 3)])
                fo += len(p['F']) * 3
            q = np.round((V - mn) / (mx - mn) * 65534 - 32767).astype(np.int16)
            pos = np.c_[q, np.zeros(len(V), np.int16)].astype(np.int16)
            nrm = np.c_[np.round(N * 127).astype(np.int8), np.zeros(len(V), np.int8)].astype(np.int8)
            skin = np.c_[SI, SW].astype(np.uint8)
            aux = np.c_[MID.astype(np.uint16), np.round(U * 65535).astype(np.uint16)].astype(np.uint16)
            ent = {'count': int(len(V)), 'index_count': int(I.size), 'ranges': ranges}
            for nm, arr, stride in (('pos', pos, 8), ('nrm', nrm, 4), ('skin', skin, 8), ('aux', aux, 4), ('idx', I, 4)):
                b = arr.tobytes()
                ent[nm] = {'offset': len(blob), 'bytes': len(b), 'stride': stride}
                blob += b
            header['streams'][f'{layer}_{lod}'] = ent
    open(os.path.join(a.raw, 'raw.bin'), 'wb').write(bytes(blob))
    f3 = lambda v: [round(float(x), 5) for x in v]
    lm_out = {sd: {k: (f3(v) if hasattr(v, '__len__') else round(float(v), 5)) for k, v in d.items()} for sd, d in LM.items()}
    sp_out = {k: f3(v) for k, v in SP.items()}
    meta = dict(version=1, units='m', bones=list(BONE_IDS.keys()), landmarks=lm_out, spine=sp_out,
                muscles=meta_mus, boneParts=meta_bones, header=header)
    json.dump(meta, open(os.path.join(a.raw, 'raw.json'), 'w'), ensure_ascii=False)
    print('원시 버퍼', round(len(blob) / 1e6, 2), 'MB')


if __name__ == '__main__':
    main()
