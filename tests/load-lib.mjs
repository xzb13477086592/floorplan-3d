// 从 index.html 抽出 <script id="…"> 纯函数库，在同一个 vm 上下文里按顺序执行
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
const HTML = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'index.html');
export function loadScripts(...ids) {
    const html = fs.readFileSync(HTML, 'utf8');
    const ctx = vm.createContext({TextDecoder, TextEncoder});
    for (const id of ids) {
        const m = html.match(new RegExp('<script id="' + id + '">([\\s\\S]*?)</script>'));
        if (!m) throw new Error('script not found: ' + id);
        vm.runInContext(m[1], ctx, {filename: id});
    }
    // vm 里造的对象原型属于另一个 realm，deepStrictEqual 会判不等：把导出的函数包一层，返回值逐层复制回宿主 realm（class 如 DXFError 原样保留）。
    // 函数值属性（如 findRooms().isOutside）复制时跳过，只能按行为测试
    const own = x => Array.isArray(x) ? Array.from(x, y => own(y)) : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).filter(([, y]) => typeof y !== 'function').map(([k, y]) => [k, own(y)])) : x;
    for (const v of Object.values(ctx)) if (v && typeof v === 'object') for (const k of Object.keys(v)) {
        const f = v[k]; if (typeof f !== 'function' || /^class\b/.test(Function.prototype.toString.call(f))) continue;
        v[k] = (...a) => own(f(...a));
    }
    return ctx;
}
