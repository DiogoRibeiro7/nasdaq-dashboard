export type ShockScenario = {
  name: string;
  returnShock: number;
  volMultiplier?: number;
};

export type ScenarioResult = {
  baseEquity: number;
  shockedEquity: number;
};

export function applyShockScenario(
  currentEquity: number,
  scenario: ShockScenario,
): ScenarioResult {
  const baseEquity = Number.isFinite(currentEquity) ? currentEquity : 1;
  const shockedEquity = baseEquity * (1 + scenario.returnShock);
  return {
    baseEquity,
    shockedEquity,
  };
}

export type MonteCarloPathPoint = {
  step: number;
  equity: number;
};

export type MonteCarloRunResult = {
  paths: MonteCarloPathPoint[][];
  horizonDays: number;
};

export function simulateMonteCarloPaths(
  initialEquity: number,
  dailyMean: number,
  dailyVol: number,
  horizonDays: number,
  nPaths: number,
): MonteCarloRunResult {
  const steps = Math.max(0, Math.trunc(horizonDays));
  const pathCount = Math.max(0, Math.trunc(nPaths));
  const paths: MonteCarloPathPoint[][] = [];

  if (steps === 0 || pathCount === 0) {
    return { paths, horizonDays: steps };
  }

  const mean = Number.isFinite(dailyMean) ? dailyMean : 0;
  const vol = Number.isFinite(dailyVol) && dailyVol > 0 ? dailyVol : 0;

  for (let pathIdx = 0; pathIdx < pathCount; pathIdx++) {
    const path: MonteCarloPathPoint[] = [];
    let logEquity = Math.log(Math.max(initialEquity, 1e-6));
    path.push({ step: 0, equity: Math.exp(logEquity) });

    for (let step = 1; step <= steps; step++) {
      const shock = randomNormal();
      logEquity += mean + vol * shock;
      const equity = Math.exp(logEquity);
      path.push({ step, equity });
    }

    paths.push(path);
  }

  return {
    paths,
    horizonDays: steps,
  };
}

function randomNormal(): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
