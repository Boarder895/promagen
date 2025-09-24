"use strict";
/**
 * updateScores — take raw per-provider values and return normalised totals.
 * This is a tiny placeholder so the build stays green.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateScores = updateScores;
/** Normalise to 0..100 by simple min-max per column, then average. */
function updateScores(raw) {
    var _a;
    if (!raw.length)
        return [];
    // Assume all rows share the same number of criteria
    var cols = raw[0].values.length;
    var mins = new Array(cols).fill(Number.POSITIVE_INFINITY);
    var maxs = new Array(cols).fill(Number.NEGATIVE_INFINITY);
    for (var _i = 0, raw_1 = raw; _i < raw_1.length; _i++) {
        var r = raw_1[_i];
        for (var i = 0; i < cols; i++) {
            var v = (_a = r.values[i]) !== null && _a !== void 0 ? _a : 0;
            if (v < mins[i])
                mins[i] = v;
            if (v > maxs[i])
                maxs[i] = v;
        }
    }
    return raw.map(function (r) {
        var norm = r.values.map(function (v, i) {
            var range = maxs[i] - mins[i];
            if (!isFinite(range) || range === 0)
                return 50; // flat column → mid
            return ((v - mins[i]) / range) * 100;
        });
        var avg = norm.reduce(function (a, b) { return a + b; }, 0) / (norm.length || 1);
        return { provider: r.provider, score: Math.round(avg * 100) / 100, breakdown: norm };
    });
}
