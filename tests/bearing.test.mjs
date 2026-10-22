import test from 'node:test';
import assert from 'node:assert/strict';
import {loadScripts} from './load-lib.mjs';

const {PlanData: P} = loadScripts('plan-data');

test('toggleBearing: imported exterior wall toggles e → b → e', () => {
    const plan = {walls: [[0,0,100,240,'e','e']], rooms: []};
    const plan1 = P.toggleBearing(plan, 0);
    assert.equal(plan1.walls[0][4], 'b', 'e → b');
    assert.equal(plan1.walls[0][5], 'e', 'baseKind preserved');
    assert.equal(P.toggleBearing(plan1, 0).walls[0][4], 'e', 'b → e');
});

test('toggleBearing: imported interior wall toggles n → b → n', () => {
    const plan = {walls: [[0,0,100,240,'n','n']], rooms: []};
    const plan1 = P.toggleBearing(plan, 0);
    assert.equal(plan1.walls[0][4], 'b', 'n → b');
    assert.equal(P.toggleBearing(plan1, 0).walls[0][4], 'n', 'b → n');
});

test('toggleBearing: default-plan wall (no baseKind) and invalid id leave plan unchanged', () => {
    const plan = {walls: [[0,0,100,240,'n']], rooms: []};
    // loadScripts 跨 vm 结构化克隆返回值，只能比较值，不能比较引用
    assert.deepEqual(P.toggleBearing(plan, 0), plan, 'no baseKind → unchanged');
    assert.deepEqual(P.toggleBearing(plan, 5), plan, 'out-of-range id → unchanged');
});

test('toggleBearing: returns new plan without mutating input', () => {
    const plan = {walls: [[0,0,100,240,'n','n'], [0,0,240,100,'e','e']], rooms: []};
    const original = JSON.stringify(plan);
    const next = P.toggleBearing(plan, 0);
    assert.equal(JSON.stringify(plan), original, 'input plan unchanged');
    assert.deepEqual(next.walls[1], plan.walls[1], 'other walls kept');
});
