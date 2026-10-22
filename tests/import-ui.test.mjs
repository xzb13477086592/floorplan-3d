import test from 'node:test'; import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs'; import {join, dirname} from 'node:path'; import {fileURLToPath} from 'node:url';
import {loadScripts} from './load-lib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const {DXFImport, PlanData} = loadScripts('dxf-lib', 'plan-data');

test('buildPlan + fixState 集成：two-room.dxf → 完整 state', () => {
    const bytes = readFileSync(join(__dirname, 'fixtures', 'two-room.dxf'));
    const text = new TextDecoder('utf-8').decode(bytes);
    const {plan, report} = DXFImport.buildPlan(text, 'two-room.dxf');

    // 验证 plan 结构正确
    assert.equal(plan.rooms.length, 2, 'should have 2 rooms');
    assert.ok(plan.walls, 'plan should have walls');

    // 传给 fixState 并验证返回的 state
    const state = PlanData.fixState({plan, furniture:[]});
    assert.ok(state.plan, 'state should have plan');
    assert.equal(state.plan.rooms.length, 2, 'state.plan should have 2 rooms');
    assert.deepEqual(state.furniture, [], 'furniture should be empty array');
});
