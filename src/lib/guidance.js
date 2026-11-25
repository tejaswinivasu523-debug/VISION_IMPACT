/**
 * Continuous path guidance.
 *
 * The scene is modelled as a walking corridor with five lanes. Every frame the
 * planner scores each lane against current obstacles and picks the safest one,
 * re-planning as soon as anything changes. That is why guidance keeps correcting
 * itself instead of playing a fixed clip.
 */

export const LANES = [
  { id: 'far-left', offset: -1, name: 'far left' },
  { id: 'left', offset: -0.52, name: 'left' },
  { id: 'centre', offset: 0, name: 'centre' },
  { id: 'right', offset: 0.52, name: 'right' },
  { id: 'far-right', offset: 1, name: 'far right' },
];

const SEVERITY_WEIGHT = { low: 0.55, medium: 1, high: 1.7, critical: 2.6 };

function riskOf(obstacle, laneOffset) {
  const distance = Math.max(0.5, obstacle.distance ?? 3);
  if (distance > 6.5) return 0;
  const halfWidth = obstacle.width ?? 0.25;
  const lateral = Math.abs(laneOffset - (obstacle.bearing ?? 0));
  const clearance = lateral - halfWidth;
  if (clearance >= 0.42) return 0;
  const proximity = Math.max(0, 1 - distance / 6.5) ** 1.4;
  const overlap = 1 - Math.max(0, clearance) / 0.42;
  return (SEVERITY_WEIGHT[obstacle.severity] || 1) * proximity * (0.45 + overlap) * 1.5;
}

export function laneName(offset) {
  if (offset <= -0.75) return 'far left';
  if (offset < -0.18) return 'left';
  if (offset <= 0.18) return 'centre';
  if (offset < 0.75) return 'right';
  return 'far right';
}

function movementPhrase(from, to) {
  const delta = to - from;
  if (Math.abs(delta) < 0.18) return 'hold your line';
  if (Math.abs(delta) >= 0.75) return delta < 0 ? 'move well to the left' : 'move well to the right';
  return delta < 0 ? 'move slightly left' : 'move slightly right';
}

/** Safe walking ribbon drawn over the camera: bottom (near) to top (far). */
export function buildWeave(offset) {
  return [
    { x: 0.5 + offset * 0.16, y: 1 },
    { x: 0.5 + offset * 0.24, y: 0.78 },
    { x: 0.5 + offset * 0.2, y: 0.52 },
    { x: 0.5 + offset * 0.12, y: 0.26 },
    { x: 0.5, y: 0.04 },
  ];
}

/**
 * @param {Array} obstacles live obstacles from the vision engine
 * @param {number} currentOffset lane the walker currently occupies
 * @param {object} options previous decision for hysteresis
 */
export function planPath(obstacles = [], currentOffset = 0, options = {}) {
  const { previousLaneOffset = currentOffset } = options;
  const relevant = obstacles.filter((o) => (o.distance ?? 0) < 6.5);
  const scored = LANES.map((lane) => {
    const risk = relevant.reduce((sum, o) => sum + riskOf(o, lane.offset), 0);
    const travel = Math.abs(lane.offset - previousLaneOffset) * 0.42;
    const edgePenalty = Math.abs(lane.offset) * 0.06;
    return { ...lane, risk, cost: risk + travel + edgePenalty };
  }).sort((a, b) => a.cost - b.cost);

  const best = scored[0];
  const previous = scored.find((l) => Math.abs(l.offset - previousLaneOffset) < 0.01) || scored[2];
  const improvement = previous.cost - best.cost;
  const chosen = improvement > 0.12 || previous.risk === 0 ? best : previous;

  const nearest = relevant
    .slice()
    .sort((a, b) => (a.distance ?? 9) - (b.distance ?? 9))[0];

  const inChosenLane = nearest
    ? Math.abs(chosen.offset - (nearest.bearing ?? 0)) < (nearest.width ?? 0.25) + 0.06
    : false;

  const distanceText = nearest ? `${Math.max(0.5, nearest.distance).toFixed(1).replace('.0', '')} metres` : '';
  const label = nearest?.label?.toLowerCase() || 'obstacle';
  const move = movementPhrase(previousLaneOffset, chosen.offset);

  let instruction;
  let urgency = 'clear';
  let speech;

  if (!nearest) {
    instruction = 'Path clear ahead. Keep walking straight.';
    speech = 'Path clear ahead. Keep walking straight.';
  } else if (inChosenLane && nearest.distance < 1.6) {
    urgency = 'stop';
    instruction = `Stop. ${nearest.label} directly ahead at ${distanceText}. ${move}.`;
    speech = `Stop. ${label} directly ahead at ${distanceText}. ${move}.`;
  } else if (inChosenLane) {
    urgency = 'caution';
    instruction = `${nearest.label} ahead, ${distanceText}. ${move}.`;
    speech = `${label} ahead, ${distanceText}. ${move}.`;
  } else {
    const safe = laneName(chosen.offset);
    const side = nearest.bearing < 0 ? 'left' : 'right';
    const alreadyClear = Math.abs(chosen.offset - previousLaneOffset) < 0.18;
    urgency = 'rerouted';
    instruction = alreadyClear
      ? `${nearest.label} ${distanceText} to your ${side}. Stay on the ${safe} line.`
      : `${nearest.label} ${distanceText} to your ${side}. ${move} to the ${safe} line.`;
    speech = alreadyClear
      ? `${label} ${distanceText} on your ${side}. Stay on the ${safe} line.`
      : `${label} ${distanceText} on your ${side}. ${move}.`;
  }

  return {
    laneId: chosen.id,
    offset: chosen.offset,
    laneName: laneName(chosen.offset),
    cost: chosen.cost,
    risk: chosen.risk,
    improvement,
    nearest,
    urgency,
    instruction,
    speech,
    weave: buildWeave(chosen.offset),
    blocked: scored.every((l) => l.risk > 0.6),
    alternatives: scored,
  };
}

/** Human summary of the corridor used by the map/dashboard widgets. */
export function corridorState(plan) {
  if (!plan) return { label: 'Waiting for scan', tone: 'neutral' };
  if (plan.urgency === 'stop') return { label: 'Stop — obstacle close', tone: 'critical' };
  if (plan.urgency === 'caution') return { label: 'Caution — rerouting', tone: 'high' };
  if (plan.urgency === 'rerouted') return { label: 'Safe line found', tone: 'medium' };
  return { label: 'Path clear', tone: 'low' };
}
