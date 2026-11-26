// 해부 모델 가공 2단계 (Node): 정점 순서 최적화 + meshopt 압축
// 사용: node tools/anatomy/encode_anatomy.js --raw <작업 폴더> --out assets/anatomy
// 출력: anatomy.json(메타), anatomy-hi.bin(PC용), anatomy-lo.bin(휴대폰용)
const fs = require('fs');
const path = require('path');
const { MeshoptEncoder } = require('meshoptimizer');

const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const RAW = arg('--raw'), OUT = arg('--out');
if (!RAW || !OUT) { console.error('사용: --raw <dir> --out <dir>'); process.exit(1); }

(async () => {
  await MeshoptEncoder.ready;
  const meta = JSON.parse(fs.readFileSync(path.join(RAW, 'raw.json'), 'utf8'));
  const raw = fs.readFileSync(path.join(RAW, 'raw.bin'));
  const view = (s) => new Uint8Array(raw.buffer, raw.byteOffset + s.offset, s.bytes);
  fs.mkdirSync(OUT, { recursive: true });
  const files = {};
  const lods = {};
  for (const [key, ent] of Object.entries(meta.header.streams)) {
    const [layer, lod] = key.split('_');
    const n = ent.count;
    // 삼각형 순서·정점 순서 최적화(GPU 캐시 + 압축률)
    const idx = new Uint32Array(view(ent.idx).slice().buffer);
    const [remap, unique] = MeshoptEncoder.reorderMesh(idx, true, false);
    const streams = {};
    for (const nm of ['pos', 'nrm', 'skin', 'aux']) {
      const st = ent[nm].stride, src = view(ent[nm]), dst = new Uint8Array(unique * st);
      for (let i = 0; i < n; i++) {
        const r = remap[i];
        if (r !== 0xffffffff) dst.set(src.subarray(i * st, i * st + st), r * st);
      }
      streams[nm] = { data: dst, stride: st };
    }
    // 법선은 팔면체 필터(8비트)로
    const nf = new Float32Array(unique * 4);
    const ni = new Int8Array(streams.nrm.data.buffer);
    for (let i = 0; i < unique; i++) { for (let k = 0; k < 3; k++) nf[i * 4 + k] = ni[i * 4 + k] / 127; nf[i * 4 + 3] = 0; }
    const nOct = MeshoptEncoder.encodeFilterOct(nf, unique, 4, 8);
    const enc = {
      pos: MeshoptEncoder.encodeVertexBuffer(streams.pos.data, unique, 8),
      nrm: MeshoptEncoder.encodeVertexBuffer(nOct, unique, 4),
      skin: MeshoptEncoder.encodeVertexBuffer(streams.skin.data, unique, 8),
      aux: MeshoptEncoder.encodeVertexBuffer(streams.aux.data, unique, 4),
      idx: MeshoptEncoder.encodeIndexBuffer(new Uint8Array(idx.buffer), idx.length, 4)
    };
    files[lod] = files[lod] || [];
    const info = { count: unique, index_count: idx.length, streams: {} };
    let off = files[lod].reduce((s, b) => s + b.length, 0);
    for (const nm of ['pos', 'nrm', 'skin', 'aux', 'idx']) {
      const b = enc[nm];
      info.streams[nm] = { offset: off, bytes: b.length, stride: nm === 'pos' || nm === 'skin' ? 8 : 4, filter: nm === 'nrm' ? 'OCTAHEDRAL' : null };
      files[lod].push(b);
      off += b.length;
    }
    lods[lod] = lods[lod] || {};
    lods[lod][layer] = info;
    const rawBytes = ['pos', 'nrm', 'skin', 'aux', 'idx'].reduce((s, k) => s + ent[k].bytes, 0);
    console.log(`${key}: 정점 ${unique.toLocaleString()} 삼각형 ${(idx.length / 3).toLocaleString()}  ${(rawBytes / 1e6).toFixed(2)}MB -> ${(off - info.streams.pos.offset) / 1e6 >= 0 ? ((enc.pos.length + enc.nrm.length + enc.skin.length + enc.aux.length + enc.idx.length) / 1e6).toFixed(2) : '?'}MB`);
  }
  for (const lod of Object.keys(files)) {
    const buf = Buffer.concat(files[lod].map(b => Buffer.from(b.buffer, b.byteOffset, b.length)));
    fs.writeFileSync(path.join(OUT, `anatomy-${lod}.bin`), buf);
    console.log(`anatomy-${lod}.bin ${(buf.length / 1e6).toFixed(2)}MB`);
  }
  delete meta.header.streams;
  meta.lods = lods;
  meta.license = 'BodyParts3D © The Database Center for Life Science (CC BY-SA 2.1 JP), Z-Anatomy by Gauthier Kervyn (CC BY-SA 4.0). 가공: BodyExplorer(JohanBellander) 데이터를 간소화·재구성.';
  fs.writeFileSync(path.join(OUT, 'anatomy.json'), JSON.stringify(meta));
  console.log('anatomy.json', (fs.statSync(path.join(OUT, 'anatomy.json')).size / 1e3).toFixed(1), 'KB');
})().catch(e => { console.error(e); process.exit(1); });
