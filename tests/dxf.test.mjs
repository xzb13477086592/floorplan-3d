import test from 'node:test'; import assert from 'node:assert/strict';
import {loadScripts} from './load-lib.mjs'; import {writeDXF, twoRoomDXF} from './dxf-writer.mjs';
const {DXFImport: D} = loadScripts('dxf-lib');

test('parseDXF 读 LINE 和图层，图层名转大写', () => {
    const r = D.parseDXF(writeDXF({entities:[{type:'LINE', layer:'wall', x0:0,y0:0,x1:1000,y1:0}]}));
    assert.deepEqual(r.entities[0], {type:'LINE', layer:'WALL', group:null, x0:0,y0:0,x1:1000,y1:0});
    assert.equal(r.unitScale, 1);
});
test('$INSUNITS=6 (m) 换算系数为 1000，缺省为 1', () => {
    assert.equal(D.parseDXF(writeDXF({units:6, entities:[]})).unitScale, 1000);
    assert.equal(D.parseDXF(writeDXF({units:5, entities:[]})).unitScale, 10);
});
test('CRLF 换行与组码前后空格可正常解析', () => {
    const t = writeDXF({entities:[{type:'LINE', layer:'WALL', x0:0,y0:0,x1:5,y1:0}]}).split('\n').map(l => '  ' + l + ' ').join('\r\n');
    assert.equal(D.parseDXF(t).entities.length, 1);
});
test('闭合 LWPOLYLINE 拆成 4 条 LINE', () => {
    const r = D.parseDXF(writeDXF({entities:[{type:'LWPOLYLINE', layer:'WALL', pts:[[0,0],[10,0],[10,10],[0,10]], closed:true}]}));
    assert.equal(r.entities.filter(e => e.type === 'LINE').length, 4);
});
test('INSERT 展开：先减基点、再缩放旋转、最后平移；同一 INSERT 共享 group', () => {
    const blocks = {D1:{bx:0, by:0, entities:[{type:'LINE', layer:'0', x0:0,y0:0,x1:100,y1:0}, {type:'ARC', layer:'0', cx:0,cy:0,r:100,a0:0,a1:90}]}};
    const r = D.parseDXF(writeDXF({blocks, entities:[{type:'INSERT', layer:'DOOR', name:'D1', x:1000, y:500, sx:2, sy:2, rot:90}]}));
    const [l, a] = r.entities;
    assert.equal(l.layer, 'DOOR');                       // 块内图层 0 继承 INSERT 图层
    assert.ok(Math.abs(l.x1 - 1000) < 1e-6 && Math.abs(l.y1 - 700) < 1e-6);
    assert.equal(a.r, 200); assert.ok(Math.abs(a.a0 - 90) < 1e-6);
    assert.equal(l.group, a.group); assert.notEqual(l.group, null);
});
test('嵌套 INSERT 递归展开', () => {
    const blocks = {IN:{bx:0,by:0, entities:[{type:'LINE', layer:'0', x0:0,y0:0,x1:10,y1:0}]}, OUT:{bx:0,by:0, entities:[{type:'INSERT', layer:'0', name:'IN', x:5, y:0}]}};
    const r = D.parseDXF(writeDXF({blocks, entities:[{type:'INSERT', layer:'DOOR', name:'OUT', x:100, y:0}]}));
    assert.equal(r.entities[0].x0, 105);
});
test('MTEXT 去掉格式码', () => {
    const r = D.parseDXF(writeDXF({entities:[{type:'MTEXT', layer:'TEXT', x:1,y:2, text:'{\\fSimHei;主卧}\\P'}]}));
    assert.equal(r.entities[0].text, '主卧');
});
test('二进制 DXF 抛 DXFError(unreadable)', () => {
    assert.throws(() => D.parseDXF('AutoCAD Binary DXF\r\n\x1a\x00'), e => e.code === 'unreadable');
});

const W = (x0,y0,x1,y1) => ({type:'LINE', layer:'WALL', group:null, x0,y0,x1,y1});
test('normalize 翻转 Y 并平移到 (0,0)', () => {
    const n = D.normalize({unitScale:1, entities:[W(100,5000,1100,5000), W(100,4760,1100,4760)]});
    assert.deepEqual(n.lines.map(l => [l.y0, l.y1]), [[0,0],[240,240]]);
    assert.equal(n.lines[0].x0, 0);
});
test('双线合墙：两条间距 240 的水平线 → 一个 240 厚的墙矩形', () => {
    const r = D.extractWalls([W(0,0,3000,0), W(0,240,3000,240)]);
    assert.deepEqual(r.walls, [[0,0,3000,240]]); assert.equal(r.unpaired, 0);
});
test('只取投影重叠部分；伸出 > 50mm 记为单线', () => {
    const r = D.extractWalls([W(0,0,3000,0), W(0,240,2000,240)]);
    assert.deepEqual(r.walls, [[0,0,2000,240]]); assert.equal(r.unpaired, 1);
});
test('三线并行取最近一对，剩余一条记为单线', () => {
    const r = D.extractWalls([W(0,0,3000,0), W(0,120,3000,120), W(0,360,3000,360)]);
    assert.deepEqual(r.walls, [[0,0,3000,120]]); assert.equal(r.unpaired, 1);
});
test('一条长线可与多条短线分段配对（T 形）', () => {
    const r = D.extractWalls([W(0,0,4000,0), W(0,240,1800,240), W(2040,240,4000,240)]);
    assert.equal(r.walls.length, 2);
});
test('间距 > 500 不配对；斜线计入 oblique', () => {
    const r = D.extractWalls([W(0,0,3000,0), W(0,600,3000,600), W(0,0,1000,1000)]);
    assert.equal(r.walls.length, 0); assert.equal(r.oblique, 1); assert.equal(r.unpaired, 2);
});
test('门洞把墙拆成两段，洞口取墙厚', () => {
    const door = [{type:'LINE', layer:'DOOR', group:7, x0:1000,y0:240,x1:1000,y1:1140}, {type:'ARC', layer:'DOOR', group:7, cx:1000,cy:240,r:900,a0:0,a1:90}];
    const r = D.cutOpenings([[0,0,3000,240]], door, door.filter(e => e.type==='ARC'));
    assert.deepEqual(r.walls, [[0,0,1000,240],[1900,0,3000,240]]);
    assert.deepEqual(r.openings[0].rect, [1000,0,1900,240]); assert.ok(r.openings[0].arc);
});
test('窗不落在墙上 → unmatched，墙不变', () => {
    const r = D.cutOpenings([[0,0,3000,240]], [{type:'LINE', layer:'WINDOW', group:null, x0:0,y0:5000,x1:900,y1:5000}], []);
    assert.equal(r.unmatched, 1); assert.deepEqual(r.walls, [[0,0,3000,240]]);
});
test('normalize：ARC 翻转后角度落在 [0,360)，单位换算', () => {
    const n = D.normalize({unitScale:1000, entities:[W(0,0,1,0), {type:'ARC', layer:'DOOR', group:null, cx:0.5,cy:-0.2,r:0.9,a0:0,a1:90}]});
    assert.deepEqual(n.arcs[0], {type:'ARC', layer:'DOOR', group:null, cx:500, cy:200, r:900, a0:270, a1:360 % 360});
});
test('竖直双线合墙，竖直墙上的窗洞沿 Y 切开', () => {
    const v = (x0,y0,x1,y1) => ({type:'LINE', layer:'WALL', group:null, x0,y0,x1,y1});
    const r = D.extractWalls([v(0,0,0,3000), v(240,0,240,3000)]); assert.deepEqual(r.walls, [[0,0,240,3000]]);
    const c = D.cutOpenings(r.walls, [{type:'LINE', layer:'WINDOW', group:null, x0:0,y0:1000,x1:0,y1:2000}], []);
    assert.deepEqual(c.walls, [[0,0,240,1000],[0,2000,240,3000]]); assert.deepEqual(c.wins, [[0,1000,240,2000]]);
});
test('转角处的门按铰链-弧端线段匹配，不会切到垂直邻墙', () => {
    const door = [{type:'LINE', layer:'DOOR', group:3, x0:2100,y0:240,x1:2100,y1:1140}, {type:'ARC', layer:'DOOR', group:3, cx:2100,cy:240,r:900,a0:0,a1:90}];
    const r = D.cutOpenings([[0,0,3000,240],[3000,0,3240,3000]], door, []);
    assert.deepEqual(r.walls, [[0,0,2100,240],[3000,0,3240,3000]]);
    assert.deepEqual(r.openings[0].rect, [2100,0,3000,240]); assert.equal(r.unmatched, 0);
    const r2 = D.cutOpenings([[3000,0,3240,3000],[0,0,3000,240]], door, []);   // 墙顺序反过来（包围盒重叠并列时先到先得）
    assert.deepEqual(r2.walls.slice().sort((p, q) => p[0] - q[0]), [[0,0,2100,240],[3000,0,3240,3000]]); assert.deepEqual(r2.openings[0].rect, [2100,0,3000,240]);
});
test('同一面墙上一门一窗都被切开，剩三段墙', () => {
    const door = [{type:'LINE', layer:'DOOR', group:1, x0:500,y0:240,x1:500,y1:1140}, {type:'ARC', layer:'DOOR', group:1, cx:500,cy:240,r:900,a0:0,a1:90}];
    const win = {type:'LINE', layer:'WINDOW', group:null, x0:2000,y0:0,x1:2800,y1:0};
    const r = D.cutOpenings([[0,0,4000,240]], door.concat([win]), []);
    assert.deepEqual(r.walls, [[0,0,500,240],[1400,0,2000,240],[2800,0,4000,240]]);
    assert.deepEqual(r.openings.map(o => o.rect), [[500,0,1400,240]]); assert.deepEqual(r.wins, [[2000,0,2800,240]]); assert.equal(r.unmatched, 0);
});

test('TEXT 对齐方式非 0 时取第二对齐点 11/21，否则取 10/20', () => {
    const r = D.parseDXF(writeDXF({entities:[{type:'TEXT', layer:'TEXT', x:0,y:0, text:'甲', h:1, ax:500, ay:600}, {type:'TEXT', layer:'TEXT', x:7,y:8, text:'乙'}]}));
    assert.deepEqual(r.entities.map(e => [e.x, e.y]), [[500,600],[7,8]]);
});
test('findRooms：240 墙围出 3000×2000 的盒子 → 1 个房间，墙面吸附后多边形为 4 点矩形', () => {
    const r = D.findRooms([[0,0,3240,240],[0,2240,3240,2480],[0,240,240,2240],[3000,240,3240,2240]]);
    assert.equal(r.rooms.length, 1);
    assert.deepEqual(r.rooms[0].poly, [[240,240],[3000,240],[3000,2240],[240,2240]]);
    assert.equal(r.rooms[0].area, 2.76*2);
});
test('两室户型：2 个房间、命名正确、材料按名称猜', () => {
    const {plan, report} = D.buildPlan(twoRoomDXF({}), 'a.dxf');
    assert.equal(report.rooms, 2); assert.equal(report.doors, 1); assert.equal(report.windows, 1); assert.equal(report.unnamed, 0); assert.equal(report.unmatched, 0);
    assert.equal(report.unpaired, 0); assert.equal(report.leaks, 0);   // 外线穿过转角伸出的段被转角墙矩形覆盖，不算单线
    const names = plan.rooms.map(r => r.name).sort();
    assert.deepEqual(names, ['卧室', '客厅'].sort());
    assert.equal(plan.rooms.find(r => r.name === '卧室').mat, 'wood');
    assert.equal(plan.source.file, 'a.dxf');
});
test('房间面积按墙面吸附后误差 < 0.5%（卧室净面积 2.76m×3.76m）', () => {
    const {plan} = D.buildPlan(twoRoomDXF({}), 'a.dxf');
    const a = plan.rooms.find(r => r.name === '卧室'), poly = a.poly;
    const area = Math.abs(poly.reduce((s,p,i) => { const q = poly[(i+1)%poly.length]; return s + p[0]*q[1] - q[0]*p[1]; }, 0)) / 2e6;
    assert.ok(Math.abs(area - 2.76*3.76) / (2.76*3.76) < .005);
});
test('外墙标 e，内墙标 n', () => {
    const {plan} = D.buildPlan(twoRoomDXF({}), 'a.dxf');
    const inner = plan.walls.filter(w => w[0] === 3000 && w[2] === 3240);
    assert.ok(inner.length >= 1 && inner.every(w => w[4] === 'n'));
    assert.ok(plan.walls.filter(w => w[1] === 0 && w[3] === 240).every(w => w[4] === 'e'));
});
test('门：len=900，c/o 为单位轴向量且互相垂直', () => {
    const d = D.buildPlan(twoRoomDXF({}), 'a.dxf').plan.doors[0];
    assert.equal(d.len, 900);
    assert.deepEqual([d.rect, d.h, d.c, d.o], [[3000,1840,3240,2740], [3240,2740], [0,-1], [1,0]]);   // 铰在内墙右面下端，向客厅开
    assert.ok(!('entry' in d));                                                              // 内门两侧都不是室外，不是入户门
    assert.equal(Math.abs(d.c[0]) + Math.abs(d.c[1]), 1); assert.equal(d.c[0]*d.o[0] + d.c[1]*d.o[1], 0);
});
test('单位为 m 时结果与 mm 一致', () => {
    const a = D.buildPlan(twoRoomDXF({}), 'a').plan.walls, b = D.buildPlan(twoRoomDXF({units:6}), 'a').plan.walls;
    assert.deepEqual(a, b);
});
test('外墙有缺口 → DXFError(noRooms)', () => {
    assert.throws(() => D.buildPlan(twoRoomDXF({gap:true}), 'a'), e => e.code === 'noRooms');
});
test('没有 WALL 图层 → DXFError(noWalls)', () => {
    assert.throws(() => D.buildPlan(writeDXF({entities:[{type:'LINE', layer:'X', x0:0,y0:0,x1:1,y1:0}]}), 'a'), e => e.code === 'noWalls');
});
test('guessMat', () => {
    assert.equal(D.guessMat('主卫浴'), 'antislip'); assert.equal(D.guessMat('厨房'), 'tile600');
    assert.equal(D.guessMat('书房'), 'wood'); assert.equal(D.guessMat('客厅'), 'tile800');
});
test('墙面不在 50mm 栅格上时外墙仍标 e（外侧 25mm 落在墙格里要再往外取样）', () => {
    const t = writeDXF({entities:[[0,0,3270,0],[3270,0,3270,2490],[3270,2490,0,2490],[0,2490,0,0],[240,240,3030,240],[3030,240,3030,2250],[3030,2250,240,2250],[240,2250,240,240]].map(([x0,y0,x1,y1]) => ({type:'LINE', layer:'WALL', x0,y0,x1,y1}))});
    const {plan} = D.buildPlan(t, 'a');
    assert.equal(plan.walls.length, 4); assert.ok(plan.walls.every(w => w[4] === 'e'));
});
test('无标注泄漏：缺口 + 漏进室外的房间没有文字 → 导入成功，report.leaks = 1', () => {
    const {report} = D.buildPlan(twoRoomDXF({gap:true, livingLabel:false}), 'a');
    assert.equal(report.rooms, 1); assert.equal(report.leaks, 1);
});
// L 形户型（DXF Y 向上）：外框 6000×4000 去掉右上 2000×2000 的缺角，墙厚 240，无文字
const lShape = () => writeDXF({entities:[
        {type:'LWPOLYLINE', layer:'WALL', closed:true, pts:[[0,0],[6000,0],[6000,2000],[4000,2000],[4000,4000],[0,4000]]},
        {type:'LWPOLYLINE', layer:'WALL', closed:true, pts:[[240,240],[5760,240],[5760,1760],[3760,1760],[3760,3760],[240,3760]]}]});
test('L 形户型的外部缺角不算泄漏；无文字房间用 tile800', () => {
    const {plan, report} = D.buildPlan(lShape(), 'a');
    assert.equal(report.rooms, 1); assert.equal(report.leaks, 0); assert.equal(report.unpaired, 0); assert.equal(report.unnamed, 1);
    assert.equal(plan.rooms[0].name, '未命名房间'); assert.equal(plan.rooms[0].mat, 'tile800');
});
test('外墙上的门是入户门，弧画向室外时 o 也翻成向室内', () => {
    const {plan} = D.buildPlan(twoRoomDXF({entryDoor:true}), 'a');
    assert.equal(plan.doors.length, 2);
    const ext = plan.doors.find(d => d.rect[1] === 4000), inner = plan.doors.find(d => d.rect[0] === 3000);
    assert.deepEqual([ext.rect, ext.o, ext.entry], [[4500,4000,5400,4240], [0,-1], true]);
    assert.deepEqual(ext.h, [4500,4000]); assert.equal(ext.c[0]*ext.o[0] + ext.c[1]*ext.o[1], 0);
    assert.ok(!('entry' in inner));
});
test('decodeDXF：GBK 字节回退解码', () => {
    const head = new TextEncoder().encode('0\nTEXT\n1\n');
    const bytes = new Uint8Array([...head, 0xCE, 0xD4, 0xCA, 0xD2]);
    assert.ok(D.decodeDXF(bytes).endsWith('卧室'));
});
test('decodeDXF：\\U+XXXX 转义', () => {
    assert.ok(D.decodeDXF(new TextEncoder().encode('1\n\\U+5367\\U+5BA4')).endsWith('卧室'));
});
