// 测试用最小 DXF 写入器：writeDXF({units?, entities, blocks?}) -> string
const pair = (c, v) => c + '\n' + v + '\n';
function ent(e) {
    let s = pair(0, e.type) + pair(8, e.layer ?? '0');
    switch (e.type) {
        case 'LINE': s += pair(10, e.x0) + pair(20, e.y0) + pair(11, e.x1) + pair(21, e.y1); break;
        case 'ARC': s += pair(10, e.cx) + pair(20, e.cy) + pair(40, e.r) + pair(50, e.a0) + pair(51, e.a1); break;
        case 'TEXT': case 'MTEXT': s += pair(10, e.x) + pair(20, e.y) + pair(1, e.text) + (e.h != null ? pair(72, e.h) + pair(11, e.ax) + pair(21, e.ay) : ''); break;   // h：水平对齐方式，非 0 时 (ax,ay) 为第二对齐点
        case 'LWPOLYLINE': s += pair(90, e.pts.length) + pair(70, e.closed ? 1 : 0) + e.pts.map(p => pair(10, p[0]) + pair(20, p[1])).join(''); break;
        case 'INSERT': s += pair(2, e.name) + pair(10, e.x) + pair(20, e.y) + (e.sx != null ? pair(41, e.sx) : '') + (e.sy != null ? pair(42, e.sy) : '') + (e.rot != null ? pair(50, e.rot) : ''); break;
        default: throw new Error('writeDXF: unsupported ' + e.type);
    }
    return s;
}
export function writeDXF({units, entities, blocks = {}}) {
    let s = pair(0, 'SECTION') + pair(2, 'HEADER');
    if (units != null) s += pair(9, '$INSUNITS') + pair(70, units);
    s += pair(0, 'ENDSEC') + pair(0, 'SECTION') + pair(2, 'BLOCKS');
    for (const [name, b] of Object.entries(blocks))
        s += pair(0, 'BLOCK') + pair(8, '0') + pair(2, name) + pair(70, 0) + pair(10, b.bx) + pair(20, b.by) + b.entities.map(ent).join('') + pair(0, 'ENDBLK') + pair(8, '0');
    s += pair(0, 'ENDSEC') + pair(0, 'SECTION') + pair(2, 'ENTITIES') + entities.map(ent).join('') + pair(0, 'ENDSEC') + pair(0, 'EOF');
    return s;
}
// 两室户型（DXF Y 向上）：外框 0..6240 × 0..4240，墙厚 240；x=3000..3240 内墙，内墙 y=1500..2400 一扇门（INSERT 块：门扇线 + 弧），
// 上墙 x=1000..2500 一扇窗，TEXT「卧室」(1500,2000)、「客厅」(4500,2000)。gap：右外墙内外线在 y=1000..1500 断开。units=6 时坐标 ÷1000
// livingLabel:false 不写「客厅」；entryDoor:true 在下外墙 x=4500..5400 加一扇向外画弧的门（铰点在外墙面）
export function twoRoomDXF({gap = false, units, livingLabel = true, entryDoor = false} = {}) {
    const k = units === 6 ? 1 / 1000 : 1, L = (layer, x0, y0, x1, y1) => ({type: 'LINE', layer, x0: x0 * k, y0: y0 * k, x1: x1 * k, y1: y1 * k});
    const W = (...a) => L('WALL', ...a);
    const ents = [
        W(0, 0, 6240, 0), W(6240, 4240, 0, 4240), W(0, 4240, 0, 0),                                   // 外线（右边另算）
        W(240, 240, 3000, 240), W(3240, 240, 6000, 240), W(240, 4000, 3000, 4000), W(3240, 4000, 6000, 4000),   // 上下内线
        W(240, 240, 240, 4000), W(3000, 240, 3000, 4000), W(3240, 240, 3240, 4000),                  // 左内线、内墙两线
    ];
    if (gap) ents.push(W(6240, 0, 6240, 1000), W(6240, 1500, 6240, 4240), W(6000, 240, 6000, 1000), W(6000, 1500, 6000, 4000));
    else ents.push(W(6240, 0, 6240, 4240), W(6000, 240, 6000, 4000));
    ents.push(L('WINDOW', 1000, 4240, 2500, 4240));                                             // 窗：外墙面一条线（散图元各自成组，画两条会多一个 unmatched）
    ents.push({type: 'INSERT', layer: 'DOOR', name: 'D900', x: 3240 * k, y: 1500 * k});           // 铰点在内墙右侧面，向客厅开
    ents.push({type: 'TEXT', layer: 'TEXT', x: 1500 * k, y: 2000 * k, text: '卧室'});
    if (livingLabel) ents.push({type: 'TEXT', layer: 'TEXT', x: 4500 * k, y: 2000 * k, text: '客厅'});
    if (entryDoor) ents.push({type: 'INSERT', layer: 'DOOR', name: 'DOUT', x: 4500 * k, y: 0});
    const blocks = {D900: {bx: 0, by: 0, entities: [{type: 'LINE', layer: '0', x0: 0, y0: 0, x1: 900 * k, y1: 0}, {type: 'ARC', layer: '0', cx: 0, cy: 0, r: 900 * k, a0: 0, a1: 90}]}};
    if (entryDoor) blocks.DOUT = {bx: 0, by: 0, entities: [{type: 'LINE', layer: '0', x0: 0, y0: 0, x1: 0, y1: -900 * k}, {type: 'ARC', layer: '0', cx: 0, cy: 0, r: 900 * k, a0: 270, a1: 360}]};
    return writeDXF({units, entities: ents, blocks});
}
