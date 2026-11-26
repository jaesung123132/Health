# 최소한의 GLB 읽기 (POSITION/NORMAL/indices만, 압축 확장 없음)
import json, struct
import numpy as np

CT = {5126: np.float32, 5125: np.uint32, 5123: np.uint16, 5121: np.uint8}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}


def read_glb(path):
    b = open(path, 'rb').read()
    _, _, length = struct.unpack_from('<4sII', b, 0)
    off = 12
    js = binc = None
    while off < length:
        clen, ctype = struct.unpack_from('<I4s', b, off)
        off += 8
        if ctype == b'JSON':
            js = json.loads(b[off:off + clen])
        elif ctype == b'BIN\x00':
            binc = b[off:off + clen]
        off += clen
    return js, binc


def accessor(js, binc, i):
    a = js['accessors'][i]
    bv = js['bufferViews'][a['bufferView']]
    dt = CT[a['componentType']]
    n = NC[a['type']]
    start = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    stride = bv.get('byteStride', 0)
    cnt = a['count']
    size = n * np.dtype(dt).itemsize
    if stride and stride != size:
        raw = np.frombuffer(binc, dtype=np.uint8, count=stride * cnt, offset=start).reshape(cnt, stride)
        return raw[:, :size].copy().view(dt).reshape(cnt, n)
    arr = np.frombuffer(binc, dtype=dt, count=cnt * n, offset=start)
    return arr.reshape(cnt, n) if n > 1 else arr.copy()


def load_meshes(path):
    js, binc = read_glb(path)
    out = []
    for nd in js['nodes']:
        if 'mesh' not in nd:
            continue
        if any(k in nd for k in ('translation', 'rotation', 'scale', 'matrix')):
            raise SystemExit('노드 변환은 지원하지 않습니다: ' + nd['name'])
        P, N, I, base = [], [], [], 0
        for pr in js['meshes'][nd['mesh']]['primitives']:
            pos = accessor(js, binc, pr['attributes']['POSITION']).astype(np.float64)
            nor = (accessor(js, binc, pr['attributes']['NORMAL']).astype(np.float64) if 'NORMAL' in pr['attributes']
                   else np.zeros_like(pos))
            idx = (accessor(js, binc, pr['indices']).astype(np.int64).reshape(-1, 3) if 'indices' in pr
                   else np.arange(len(pos)).reshape(-1, 3))
            P.append(pos)
            N.append(nor)
            I.append(idx + base)
            base += len(pos)
        out.append({'name': nd['name'], 'pos': np.vstack(P), 'nor': np.vstack(N), 'idx': np.vstack(I)})
    return out
