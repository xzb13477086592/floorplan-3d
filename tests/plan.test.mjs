import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
import {loadScripts} from './load-lib.mjs';
const {PlanData: P} = loadScripts('plan-data');
const base = JSON.parse(fs.readFileSync(new URL('./fixtures/default-plan.json', import.meta.url)));
test('DEFAULT_PLAN 与改动前的常量逐项一致', () => {
    const p = P.DEFAULT_PLAN;
    assert.deepEqual(JSON.parse(JSON.stringify({WALLS:p.walls, WINS:p.wins, DOORS:p.doors, SLIDES:p.slides, ROOMS:p.rooms})), base);
});
test('默认户型 bounds/center 不变', () => {
    assert.deepEqual(P.planBounds(P.DEFAULT_PLAN), {x:-1850, y:-1750, w:15600, h:14100});
    assert.deepEqual(P.planCenter(P.DEFAULT_PLAN), [6000, 5300]);
});
test('导入户型 bounds 外扩 1500', () => {
    const plan = {walls:[[0,0,6240,240,'e','e'],[0,4000,6240,4240,'e','e']], rooms:[]};
    assert.deepEqual(P.planBounds(plan), {x:-1500, y:-1500, w:9240, h:7240});
});
test('fixState：旧存档没有 plan 字段 → plan=null，房间按默认户型补齐', () => {
    const s = P.fixState({furniture:[], rooms:{}});
    assert.equal(s.plan, null); assert.deepEqual(s.rooms.master, {name:'主卧室', mat:'wood'}); assert.deepEqual(s.demolished, []);
});
test('fixState：导入户型的 rooms 以 plan.rooms 为准，删掉多余项', () => {
    const plan = {walls:[], rooms:[{id:'r1', name:'卧室', mat:'wood', poly:[]}]};
    const s = P.fixState({plan, furniture:[], rooms:{master:{}, r1:{name:'主卧', mat:'carpet'}}});
    assert.deepEqual(Object.keys(s.rooms), ['r1']); assert.equal(s.rooms.r1.mat, 'carpet');
});
