import { getItem, setItem } from 'lib/app-storage';

export type ReadinessRunbookPhase = 'config' | 'data' | 'payments' | 'ops' | 'release';

export type ReadinessRunbookTask = {
  id: string;
  phase: ReadinessRunbookPhase;
  title: string;
  detail: string;
  route: string | null;
  dependsOn?: string[];
};

export type ReadinessRunbookPhaseProgress = {
  phase: ReadinessRunbookPhase;
  label: string;
  total: number;
  completed: number;
  remaining: number;
};

export type ReadinessRunbookEventKind = 'completed' | 'reopened' | 'reset';

export type ReadinessRunbookEvent = {
  id: string;
  kind: ReadinessRunbookEventKind;
  taskId: string | null;
  taskTitle: string;
  phase: ReadinessRunbookPhase | null;
  createdAt: string;
};

export type ReadinessRunbookState = {
  completedIds: string[];
  updatedAt: string | null;
  events: ReadinessRunbookEvent[];
};

export type ReadinessRunbookFocus = {
  phase?: ReadinessRunbookPhase | null;
  taskId?: string | null;
};

export type ReadinessRunbookFocusSnapshot = {
  label: string;
  scopeLabel: string;
  tasks: ReadinessRunbookTask[];
  completedCount: number;
  openCount: number;
  totalEvents: number;
  completedEvents: number;
  reopenedEvents: number;
  resetEvents: number;
  latestEvent: ReadinessRunbookEvent | null;
  nextTask: ReadinessRunbookTask | null;
};

export type ReadinessRunbookTaskAnalyticsItem = {
  task: ReadinessRunbookTask;
  completed: boolean;
  activityCount: number;
  completedEvents: number;
  reopenedEvents: number;
  resetEvents: number;
  lastEvent: ReadinessRunbookEvent | null;
  priorityScore: number;
};

export type ReadinessRunbookTaskAnalyticsSummary = {
  openTasks: number;
  completedTasks: number;
  topActiveTask: ReadinessRunbookTaskAnalyticsItem | null;
  topReopenedTask: ReadinessRunbookTaskAnalyticsItem | null;
  topOpenTask: ReadinessRunbookTaskAnalyticsItem | null;
};

export type ReadinessRunbookPriorityBucket = 'critical' | 'high' | 'medium' | 'low' | 'done';

export type ReadinessRunbookPrioritySummary = {
  critical: ReadinessRunbookTaskAnalyticsItem[];
  high: ReadinessRunbookTaskAnalyticsItem[];
  medium: ReadinessRunbookTaskAnalyticsItem[];
  low: ReadinessRunbookTaskAnalyticsItem[];
  done: ReadinessRunbookTaskAnalyticsItem[];
  topPriority: ReadinessRunbookTaskAnalyticsItem | null;
};

export type ReadinessRunbookPriorityAction = {
  task: ReadinessRunbookTaskAnalyticsItem;
  bucket: ReadinessRunbookPriorityBucket;
  reason: string;
};

export type ReadinessRunbookCriticalPathItem = {
  task: ReadinessRunbookTask;
  phaseLabel: string;
  order: number;
  blockersAhead: number;
  statusLabel: 'Nu' | 'Daarna' | 'Later';
  tone: 'danger' | 'warning' | 'accent';
  reason: string;
};

export type ReadinessRunbookDependencyItem = {
  task: ReadinessRunbookTask;
  phaseLabel: string;
  status: 'done' | 'ready' | 'blocked';
  blockedBy: ReadinessRunbookTask[];
  dependsOn: ReadinessRunbookTask[];
  reason: string;
};

export type ReadinessRunbookExecutionWave = {
  order: number;
  label: string;
  tasks: ReadinessRunbookTask[];
  phaseLabels: string[];
  openCount: number;
  readyCount: number;
  blockedCount: number;
  topTask: ReadinessRunbookTask | null;
};

export type ReadinessRunbookWorkstream = {
  phase: ReadinessRunbookPhase;
  label: string;
  tasks: ReadinessRunbookTask[];
  readyTasks: ReadinessRunbookTask[];
  blockedTasks: ReadinessRunbookTask[];
  doneTasks: ReadinessRunbookTask[];
  topReadyTask: ReadinessRunbookTask | null;
  topBlockedTask: ReadinessRunbookTask | null;
  momentumScore: number;
};

export type ReadinessRunbookBottleneckItem = {
  task: ReadinessRunbookTask;
  phaseLabel: string;
  blockedTasks: ReadinessRunbookTask[];
  blockingCount: number;
  isCompleted: boolean;
  reason: string;
};

export type ReadinessRunbookUnlockItem = {
  task: ReadinessRunbookTask;
  phaseLabel: string;
  unlockedTasks: ReadinessRunbookTask[];
  immediateReadyTasks: ReadinessRunbookTask[];
  unlockCount: number;
  immediateReadyCount: number;
  isCompleted: boolean;
  reason: string;
};

export type ReadinessRunbookRecommendedMove = {
  task: ReadinessRunbookTask;
  phaseLabel: string;
  score: number;
  blockingCount: number;
  unlockCount: number;
  immediateReadyCount: number;
  rationale: string;
  nextUnlockedLabels: string[];
};

export type ReadinessRunbookControlTower = {
  headline: string;
  summary: string;
  topMove: ReadinessRunbookRecommendedMove | null;
  topBottleneck: ReadinessRunbookBottleneckItem | null;
  topUnlock: ReadinessRunbookUnlockItem | null;
  topWorkstream: ReadinessRunbookWorkstream | null;
  topWave: ReadinessRunbookExecutionWave | null;
  openTasks: number;
  readyTasks: number;
  blockedTasks: number;
};

export type ReadinessRunbookExecutionAgenda = {
  now: ReadinessRunbookRecommendedMove[];
  next: ReadinessRunbookRecommendedMove[];
  later: ReadinessRunbookRecommendedMove[];
};

export type ReadinessRunbookMovePreview = {
  task: ReadinessRunbookTask;
  phaseLabel: string;
  currentOpen: number;
  currentReady: number;
  currentBlocked: number;
  projectedOpen: number;
  projectedReady: number;
  projectedBlocked: number;
  deltaReady: number;
  deltaBlocked: number;
  newlyReadyTasks: ReadinessRunbookTask[];
  relievedBottlenecks: ReadinessRunbookTask[];
};

export type ReadinessRunbookMoveComparisonItem = {
  move: ReadinessRunbookRecommendedMove;
  preview: ReadinessRunbookMovePreview | null;
};

export type ReadinessRunbookForecastStep = {
  order: number;
  task: ReadinessRunbookTask;
  phaseLabel: string;
  openTasks: number;
  readyTasks: number;
  blockedTasks: number;
  completedCount: number;
  totalTasks: number;
  completionRate: number;
  headline: string;
};

export type ReadinessRunbookForecastSummary = {
  stepsCount: number;
  initialOpenTasks: number;
  initialReadyTasks: number;
  initialBlockedTasks: number;
  initialCompletedCount: number;
  finalOpenTasks: number;
  finalReadyTasks: number;
  finalBlockedTasks: number;
  finalCompletedCount: number;
  totalTasks: number;
  completionRate: number;
  deltaReady: number;
  deltaBlocked: number;
  deltaCompleted: number;
  headline: string;
  nextMove: ReadinessRunbookRecommendedMove | null;
};

export type ReadinessRunbookScenarioComparisonItem = {
  startingMove: ReadinessRunbookRecommendedMove;
  summary: ReadinessRunbookForecastSummary;
  steps: ReadinessRunbookForecastStep[];
};

export type ReadinessRunbookScenarioSignalTask = {
  task: ReadinessRunbookTask;
  phaseLabel: string;
  hitCount: number;
};

export type ReadinessRunbookScenarioSignal = {
  winner: ReadinessRunbookScenarioComparisonItem | null;
  challenger: ReadinessRunbookScenarioComparisonItem | null;
  completionLead: number;
  readyLead: number;
  blockedLead: number;
  completedLead: number;
  closenessLabel: string;
  headline: string;
  summary: string;
  recurringTasks: ReadinessRunbookScenarioSignalTask[];
};

export type ReadinessRunbookScenarioConsensusTask = {
  task: ReadinessRunbookTask;
  phaseLabel: string;
  hitCount: number;
};

export type ReadinessRunbookScenarioConsensus = {
  winner: ReadinessRunbookScenarioComparisonItem | null;
  challenger: ReadinessRunbookScenarioComparisonItem | null;
  consensusTasks: ReadinessRunbookScenarioConsensusTask[];
  winnerOnlyTasks: ReadinessRunbookScenarioConsensusTask[];
  challengerOnlyTasks: ReadinessRunbookScenarioConsensusTask[];
  headline: string;
  summary: string;
};

export type ReadinessRunbookScenarioStability = {
  confidenceScore: number;
  overlapRate: number;
  divergenceCount: number;
  volatilityLabel: string;
  headline: string;
  summary: string;
  winner: ReadinessRunbookScenarioComparisonItem | null;
  challenger: ReadinessRunbookScenarioComparisonItem | null;
  varianceTasks: ReadinessRunbookScenarioConsensusTask[];
};

export type ReadinessRunbookScenarioPlaybook = {
  headline: string;
  summary: string;
  winner: ReadinessRunbookScenarioComparisonItem | null;
  mustDoTasks: ReadinessRunbookScenarioConsensusTask[];
  chooseTasks: ReadinessRunbookScenarioConsensusTask[];
  watchTasks: ReadinessRunbookScenarioConsensusTask[];
};

export type ReadinessRunbookScenarioCheckpoint = {
  winner: ReadinessRunbookScenarioComparisonItem | null;
  challenger: ReadinessRunbookScenarioComparisonItem | null;
  sharedPrefix: ReadinessRunbookScenarioConsensusTask[];
  winnerNext: ReadinessRunbookScenarioConsensusTask | null;
  challengerNext: ReadinessRunbookScenarioConsensusTask | null;
  forkStep: number | null;
  headline: string;
  summary: string;
};

export type ReadinessRunbookScenarioPhaseMapItem = {
  phase: ReadinessRunbookPhase;
  label: string;
  sharedCount: number;
  winnerOnlyCount: number;
  challengerOnlyCount: number;
  totalCount: number;
  statusLabel: string;
};

export type ReadinessRunbookScenarioPhaseMap = {
  headline: string;
  summary: string;
  items: ReadinessRunbookScenarioPhaseMapItem[];
};

export type ReadinessRunbookScenarioRiskItem = {
  task: ReadinessRunbookTask;
  phaseLabel: string;
  status: 'done' | 'ready' | 'blocked';
  statusLabel: string;
  riskScore: number;
  reasons: string[];
};

export type ReadinessRunbookScenarioRiskBoard = {
  headline: string;
  summary: string;
  items: ReadinessRunbookScenarioRiskItem[];
};

export type ReadinessRunbookScenarioBriefing = {
  headline: string;
  summary: string;
  winner: ReadinessRunbookScenarioComparisonItem | null;
  challenger: ReadinessRunbookScenarioComparisonItem | null;
  topRisk: ReadinessRunbookScenarioRiskItem | null;
  phaseHotspot: ReadinessRunbookScenarioPhaseMapItem | null;
  forkStep: number | null;
  volatilityLabel: string;
  confidenceScore: number;
  consensusCount: number;
  mustDoCount: number;
  chooseCount: number;
  watchCount: number;
  nextAction: ReadinessRunbookTask | null;
};

export type ReadinessRunbookScenarioRouteBoardRow = {
  order: number;
  winnerTask: ReadinessRunbookTask | null;
  challengerTask: ReadinessRunbookTask | null;
  winnerPhaseLabel: string | null;
  challengerPhaseLabel: string | null;
  relation: 'shared' | 'fork' | 'winner-only' | 'challenger-only';
  relationLabel: string;
  focusTask: ReadinessRunbookTask | null;
};

export type ReadinessRunbookScenarioRouteBoard = {
  headline: string;
  summary: string;
  rows: ReadinessRunbookScenarioRouteBoardRow[];
  sharedCount: number;
  divergingCount: number;
  forkStep: number | null;
};

export type ReadinessRunbookScenarioDecisionBoard = {
  headline: string;
  summary: string;
  preForkTasks: ReadinessRunbookScenarioConsensusTask[];
  winnerDecision: ReadinessRunbookScenarioConsensusTask | null;
  challengerDecision: ReadinessRunbookScenarioConsensusTask | null;
  winnerAfter: ReadinessRunbookScenarioConsensusTask[];
  challengerAfter: ReadinessRunbookScenarioConsensusTask[];
  forkStep: number | null;
  volatilityLabel: string;
  confidenceScore: number;
};

export type ReadinessRunbookScenarioCommitBoard = {
  headline: string;
  summary: string;
  decisionStatusLabel: string;
  decisionTone: 'success' | 'warning' | 'danger' | 'accent';
  confidenceScore: number;
  forkStep: number | null;
  commitTask: ReadinessRunbookTask | null;
  fallbackTask: ReadinessRunbookTask | null;
  guardrailTask: ReadinessRunbookTask | null;
  openQuestions: string[];
};

export type ReadinessRunbookScenarioMonitorItem = {
  label: string;
  task: ReadinessRunbookTask | null;
  detail: string;
  tone: 'success' | 'warning' | 'danger' | 'accent';
};

export type ReadinessRunbookScenarioMonitorBoard = {
  headline: string;
  summary: string;
  monitorStatusLabel: string;
  monitorTone: 'success' | 'warning' | 'danger' | 'accent';
  activeItems: ReadinessRunbookScenarioMonitorItem[];
  openQuestions: string[];
};

export type ReadinessRunbookScenarioActionBoard = {
  headline: string;
  summary: string;
  actionStatusLabel: string;
  actionTone: 'success' | 'warning' | 'danger' | 'accent';
  confidenceScore: number;
  immediateTasks: ReadinessRunbookScenarioConsensusTask[];
  fallbackTasks: ReadinessRunbookScenarioConsensusTask[];
  verifyTasks: ReadinessRunbookScenarioConsensusTask[];
};

export type ReadinessRunbookScenarioHandoverBoard = {
  headline: string;
  summary: string;
  handoverStatusLabel: string;
  handoverTone: 'success' | 'warning' | 'danger' | 'accent';
  ownerLabel: string;
  confidenceScore: number;
  nowTasks: ReadinessRunbookScenarioConsensusTask[];
  watchTasks: ReadinessRunbookScenarioConsensusTask[];
  escalateTasks: ReadinessRunbookScenarioConsensusTask[];
};

export type ReadinessRunbookScenarioEscalationBoard = {
  headline: string;
  summary: string;
  escalationStatusLabel: string;
  escalationTone: 'success' | 'warning' | 'danger' | 'accent';
  confidenceScore: number;
  urgentTasks: ReadinessRunbookScenarioConsensusTask[];
  fallbackTasks: ReadinessRunbookScenarioConsensusTask[];
  triggerQuestions: string[];
};

export type ReadinessRunbookScenarioRollbackBoard = {
  headline: string;
  summary: string;
  rollbackStatusLabel: string;
  rollbackTone: 'success' | 'warning' | 'danger' | 'accent';
  confidenceScore: number;
  rollbackTask: ReadinessRunbookTask | null;
  safeTasks: ReadinessRunbookScenarioConsensusTask[];
  holdTasks: ReadinessRunbookScenarioConsensusTask[];
  rollbackSignals: string[];
};

export type ReadinessRunbookScenarioRecoveryBoard = {
  headline: string;
  summary: string;
  recoveryStatusLabel: string;
  recoveryTone: 'success' | 'warning' | 'danger' | 'accent';
  confidenceScore: number;
  resumeTask: ReadinessRunbookTask | null;
  stabilizeTasks: ReadinessRunbookScenarioConsensusTask[];
  rebuildTasks: ReadinessRunbookScenarioConsensusTask[];
  recoveryChecks: string[];
};

export type ReadinessRunbookScenarioReleaseGate = {
  headline: string;
  summary: string;
  gateStatusLabel: string;
  gateTone: 'success' | 'warning' | 'danger' | 'accent';
  confidenceScore: number;
  ownerLabel: string;
  releaseTask: ReadinessRunbookTask | null;
  holdTask: ReadinessRunbookTask | null;
  readinessChecks: string[];
  blockers: string[];
};

export type ReadinessRunbookScenarioCutoverBoard = {
  headline: string;
  summary: string;
  cutoverStatusLabel: string;
  cutoverTone: 'success' | 'warning' | 'danger' | 'accent';
  confidenceScore: number;
  ownerLabel: string;
  launchTasks: ReadinessRunbookScenarioConsensusTask[];
  verifyTasks: ReadinessRunbookScenarioConsensusTask[];
  fallbackTask: ReadinessRunbookTask | null;
  cutoverChecks: string[];
};

export type ReadinessRunbookScenarioSmokeBoard = {
  headline: string;
  summary: string;
  smokeStatusLabel: string;
  smokeTone: 'success' | 'warning' | 'danger' | 'accent';
  confidenceScore: number;
  ownerLabel: string;
  greenChecks: string[];
  watchChecks: string[];
  failingChecks: string[];
  fallbackTask: ReadinessRunbookTask | null;
};

export type ReadinessRunbookScenarioHypercareBoard = {
  headline: string;
  summary: string;
  hypercareStatusLabel: string;
  hypercareTone: 'success' | 'warning' | 'danger' | 'accent';
  confidenceScore: number;
  ownerLabel: string;
  keepWarmTasks: ReadinessRunbookScenarioConsensusTask[];
  watchItems: string[];
  escalateItems: string[];
  fallbackTask: ReadinessRunbookTask | null;
};

export type ReadinessRunbookScenarioExitBoard = {
  headline: string;
  summary: string;
  exitStatusLabel: string;
  exitTone: 'success' | 'warning' | 'danger' | 'accent';
  confidenceScore: number;
  ownerLabel: string;
  exitChecks: string[];
  keepWatchItems: string[];
  rollbackSignals: string[];
  fallbackTask: ReadinessRunbookTask | null;
};

export type ReadinessRunbookScenarioSteadyStateBoard = {
  headline: string;
  summary: string;
  steadyStatusLabel: string;
  steadyTone: 'success' | 'warning' | 'danger' | 'accent';
  confidenceScore: number;
  ownerLabel: string;
  keepAliveChecks: string[];
  watchItems: string[];
  alertSignals: string[];
  fallbackTask: ReadinessRunbookTask | null;
};

export type ReadinessRunbookScenarioIncidentBoard = {
  headline: string;
  summary: string;
  incidentStatusLabel: string;
  incidentTone: 'success' | 'warning' | 'danger' | 'accent';
  confidenceScore: number;
  ownerLabel: string;
  firstResponseSignals: string[];
  investigateSignals: string[];
  escalateSignals: string[];
  fallbackTask: ReadinessRunbookTask | null;
};

export type ReadinessRunbookScenarioRcaBoard = {
  headline: string;
  summary: string;
  rcaStatusLabel: string;
  rcaTone: 'success' | 'warning' | 'danger' | 'accent';
  confidenceScore: number;
  ownerLabel: string;
  rootCauseSignals: string[];
  containmentSignals: string[];
  permanentFixSignals: string[];
  fallbackTask: ReadinessRunbookTask | null;
};

export type ReadinessRunbookScenarioPostmortemBoard = {
  headline: string;
  summary: string;
  postmortemStatusLabel: string;
  postmortemTone: 'success' | 'warning' | 'danger' | 'accent';
  confidenceScore: number;
  ownerLabel: string;
  findings: string[];
  followUpActions: string[];
  preventionSignals: string[];
  fallbackTask: ReadinessRunbookTask | null;
};

export type ReadinessRunbookScenarioImprovementBoard = {
  headline: string;
  summary: string;
  improvementStatusLabel: string;
  improvementTone: 'success' | 'warning' | 'danger' | 'accent';
  confidenceScore: number;
  ownerLabel: string;
  structuralImprovements: string[];
  processImprovements: string[];
  safeguardSignals: string[];
  fallbackTask: ReadinessRunbookTask | null;
};

export type ReadinessRunbookScenarioSafeguardBoard = {
  headline: string;
  summary: string;
  safeguardStatusLabel: string;
  safeguardTone: 'success' | 'warning' | 'danger' | 'accent';
  confidenceScore: number;
  ownerLabel: string;
  ownershipSignals: string[];
  cadenceSignals: string[];
  controlChecks: string[];
  fallbackTask: ReadinessRunbookTask | null;
};

export type ReadinessRunbookScenarioReviewBoard = {
  headline: string;
  summary: string;
  reviewStatusLabel: string;
  reviewTone: 'success' | 'warning' | 'danger' | 'accent';
  confidenceScore: number;
  ownerLabel: string;
  evidenceSignals: string[];
  reviewQuestions: string[];
  approvalChecks: string[];
  fallbackTask: ReadinessRunbookTask | null;
};

export type ReadinessRunbookScenarioSignoffBoard = {
  headline: string;
  summary: string;
  signoffStatusLabel: string;
  signoffTone: 'success' | 'warning' | 'danger' | 'accent';
  confidenceScore: number;
  ownerLabel: string;
  approverSignals: string[];
  signoffConditions: string[];
  releaseChecks: string[];
  fallbackTask: ReadinessRunbookTask | null;
};

export type ReadinessRunbookScenarioAcceptanceBoard = {
  headline: string;
  summary: string;
  acceptanceStatusLabel: string;
  acceptanceTone: 'success' | 'warning' | 'danger' | 'accent';
  confidenceScore: number;
  ownerLabel: string;
  acceptanceSignals: string[];
  watchSignals: string[];
  readinessChecks: string[];
  fallbackTask: ReadinessRunbookTask | null;
};

export type ReadinessRunbookScenarioActivationBoard = {
  headline: string;
  summary: string;
  activationStatusLabel: string;
  activationTone: 'success' | 'warning' | 'danger' | 'accent';
  confidenceScore: number;
  ownerLabel: string;
  launchSignals: string[];
  firstWatchSignals: string[];
  activationChecks: string[];
  fallbackTask: ReadinessRunbookTask | null;
};

export type ReadinessRunbookScenarioStabilizationBoard = {
  headline: string;
  summary: string;
  stabilizationStatusLabel: string;
  stabilizationTone: 'success' | 'warning' | 'danger' | 'accent';
  confidenceScore: number;
  ownerLabel: string;
  settleSignals: string[];
  earlyDriftSignals: string[];
  stabilizationChecks: string[];
  fallbackTask: ReadinessRunbookTask | null;
};

export type ReadinessRunbookScenarioValidationBoard = {
  headline: string;
  summary: string;
  validationStatusLabel: string;
  validationTone: 'success' | 'warning' | 'danger' | 'accent';
  confidenceScore: number;
  ownerLabel: string;
  outcomeSignals: string[];
  validationQuestions: string[];
  validationChecks: string[];
  fallbackTask: ReadinessRunbookTask | null;
};

export type ReadinessRunbookScenarioAssuranceBoard = {
  headline: string;
  summary: string;
  assuranceStatusLabel: string;
  assuranceTone: 'success' | 'warning' | 'danger' | 'accent';
  confidenceScore: number;
  ownerLabel: string;
  trustedSignals: string[];
  assuranceWatchSignals: string[];
  assuranceChecks: string[];
  fallbackTask: ReadinessRunbookTask | null;
};

export type ReadinessRunbookScenarioGreenlightBoard = {
  headline: string;
  summary: string;
  greenlightStatusLabel: string;
  greenlightTone: 'success' | 'warning' | 'danger' | 'accent';
  confidenceScore: number;
  ownerLabel: string;
  greenlightSignals: string[];
  cautionSignals: string[];
  goChecks: string[];
  fallbackTask: ReadinessRunbookTask | null;
};

export type ReadinessRunbookScenarioGoNoBoard = {
  headline: string;
  summary: string;
  goNoStatusLabel: string;
  goNoTone: 'success' | 'warning' | 'danger' | 'accent';
  confidenceScore: number;
  ownerLabel: string;
  goSignals: string[];
  holdSignals: string[];
  decisionChecks: string[];
  fallbackTask: ReadinessRunbookTask | null;
};

export type ReadinessRunbookScenarioWatchStartBoard = {
  headline: string;
  summary: string;
  watchStatusLabel: string;
  watchTone: 'success' | 'warning' | 'danger' | 'accent';
  confidenceScore: number;
  ownerLabel: string;
  armedSignals: string[];
  watchSignals: string[];
  startChecks: string[];
  fallbackTask: ReadinessRunbookTask | null;
};

export type ReadinessRunbookScenarioFirstHourBoard = {
  headline: string;
  summary: string;
  firstHourStatusLabel: string;
  firstHourTone: 'success' | 'warning' | 'danger' | 'accent';
  confidenceScore: number;
  ownerLabel: string;
  stableSignals: string[];
  driftSignals: string[];
  firstHourChecks: string[];
  fallbackTask: ReadinessRunbookTask | null;
};

export type ReadinessRunbookScenarioFirstDayBoard = {
  headline: string;
  summary: string;
  firstDayStatusLabel: string;
  firstDayTone: 'success' | 'warning' | 'danger' | 'accent';
  confidenceScore: number;
  ownerLabel: string;
  daySignals: string[];
  driftSignals: string[];
  dayChecks: string[];
  fallbackTask: ReadinessRunbookTask | null;
};

export type ReadinessRunbookScenarioFirstWeekBoard = {
  headline: string;
  summary: string;
  firstWeekStatusLabel: string;
  firstWeekTone: 'success' | 'warning' | 'danger' | 'accent';
  confidenceScore: number;
  ownerLabel: string;
  weekSignals: string[];
  riskSignals: string[];
  weekChecks: string[];
  fallbackTask: ReadinessRunbookTask | null;
};

export type ReadinessRunbookScenarioFirstMonthBoard = {
  headline: string;
  summary: string;
  firstMonthStatusLabel: string;
  firstMonthTone: 'success' | 'warning' | 'danger' | 'accent';
  confidenceScore: number;
  ownerLabel: string;
  monthSignals: string[];
  riskSignals: string[];
  monthChecks: string[];
  fallbackTask: ReadinessRunbookTask | null;
};

export type ReadinessRunbookScenarioFirstQuarterBoard = {
  headline: string;
  summary: string;
  firstQuarterStatusLabel: string;
  firstQuarterTone: 'success' | 'warning' | 'danger' | 'accent';
  confidenceScore: number;
  ownerLabel: string;
  quarterSignals: string[];
  riskSignals: string[];
  quarterChecks: string[];
  fallbackTask: ReadinessRunbookTask | null;
};

export type ReadinessRunbookScenarioFirstYearBoard = {
  headline: string;
  summary: string;
  firstYearStatusLabel: string;
  firstYearTone: 'success' | 'warning' | 'danger' | 'accent';
  confidenceScore: number;
  ownerLabel: string;
  yearSignals: string[];
  riskSignals: string[];
  yearChecks: string[];
  fallbackTask: ReadinessRunbookTask | null;
};

export type ReadinessRunbookScenarioMultiYearBoard = {
  headline: string;
  summary: string;
  multiYearStatusLabel: string;
  multiYearTone: 'success' | 'warning' | 'danger' | 'accent';
  confidenceScore: number;
  ownerLabel: string;
  longSignals: string[];
  riskSignals: string[];
  multiYearChecks: string[];
  fallbackTask: ReadinessRunbookTask | null;
};

export type ReadinessRunbookScenarioContinuityBoard = {
  headline: string;
  summary: string;
  continuityStatusLabel: string;
  continuityTone: 'success' | 'warning' | 'danger' | 'accent';
  confidenceScore: number;
  ownerLabel: string;
  continuitySignals: string[];
  riskSignals: string[];
  continuityChecks: string[];
  fallbackTask: ReadinessRunbookTask | null;
};

export type ReadinessRunbookScenarioHealthBoard = {
  headline: string;
  summary: string;
  healthStatusLabel: string;
  healthTone: 'success' | 'warning' | 'danger' | 'accent';
  confidenceScore: number;
  ownerLabel: string;
  healthSignals: string[];
  watchSignals: string[];
  healthChecks: string[];
  fallbackTask: ReadinessRunbookTask | null;
};

export type ReadinessRunbookScenarioResilienceBoard = {
  headline: string;
  summary: string;
  resilienceStatusLabel: string;
  resilienceTone: 'success' | 'warning' | 'danger' | 'accent';
  confidenceScore: number;
  ownerLabel: string;
  resilienceSignals: string[];
  pressureSignals: string[];
  resilienceChecks: string[];
  fallbackTask: ReadinessRunbookTask | null;
};

export type ReadinessRunbookScenarioCapacityBoard = {
  headline: string;
  summary: string;
  capacityStatusLabel: string;
  capacityTone: 'success' | 'warning' | 'danger' | 'accent';
  confidenceScore: number;
  ownerLabel: string;
  capacitySignals: string[];
  loadSignals: string[];
  capacityChecks: string[];
  fallbackTask: ReadinessRunbookTask | null;
};

export type ReadinessRunbookScenarioBufferBoard = {
  headline: string;
  summary: string;
  bufferStatusLabel: string;
  bufferTone: 'success' | 'warning' | 'danger' | 'accent';
  confidenceScore: number;
  ownerLabel: string;
  bufferSignals: string[];
  pressureSignals: string[];
  bufferChecks: string[];
  fallbackTask: ReadinessRunbookTask | null;
};

export type ReadinessRunbookScenarioSlackBoard = {
  headline: string;
  summary: string;
  slackStatusLabel: string;
  slackTone: 'success' | 'warning' | 'danger' | 'accent';
  confidenceScore: number;
  ownerLabel: string;
  slackSignals: string[];
  pressureSignals: string[];
  slackChecks: string[];
  fallbackTask: ReadinessRunbookTask | null;
};

export type ReadinessRunbookScenarioWatchBoard = {
  headline: string;
  summary: string;
  watchStatusLabel: string;
  watchTone: 'success' | 'warning' | 'danger' | 'accent';
  confidenceScore: number;
  ownerLabel: string;
  watchSignals: string[];
  alertSignals: string[];
  watchChecks: string[];
  fallbackTask: ReadinessRunbookTask | null;
};

export type ReadinessRunbookScenarioTakeoverBoard = {
  headline: string;
  summary: string;
  takeoverStatusLabel: string;
  takeoverTone: 'success' | 'warning' | 'danger' | 'accent';
  confidenceScore: number;
  ownerLabel: string;
  takeoverSignals: string[];
  alertSignals: string[];
  takeoverChecks: string[];
  fallbackTask: ReadinessRunbookTask | null;
};

export type ReadinessRunbookScenarioStartBoard = {
  headline: string;
  summary: string;
  startStatusLabel: string;
  startTone: 'success' | 'warning' | 'danger' | 'accent';
  confidenceScore: number;
  ownerLabel: string;
  startSignals: string[];
  alertSignals: string[];
  startChecks: string[];
  fallbackTask: ReadinessRunbookTask | null;
};

export type ReadinessRunbookScenarioSwitchOnBoard = {
  headline: string;
  summary: string;
  switchStatusLabel: string;
  switchTone: 'success' | 'warning' | 'danger' | 'accent';
  confidenceScore: number;
  ownerLabel: string;
  switchSignals: string[];
  alertSignals: string[];
  switchChecks: string[];
  fallbackTask: ReadinessRunbookTask | null;
};

export type ReadinessRunbookScenarioLinkBoard = {
  headline: string;
  summary: string;
  linkStatusLabel: string;
  linkTone: 'success' | 'warning' | 'danger' | 'accent';
  confidenceScore: number;
  ownerLabel: string;
  linkSignals: string[];
  alertSignals: string[];
  linkChecks: string[];
  fallbackTask: ReadinessRunbookTask | null;
};

export type ReadinessRunbookScenarioMonitorGateBoard = {
  headline: string;
  summary: string;
  gateStatusLabel: string;
  gateTone: 'success' | 'warning' | 'danger' | 'accent';
  confidenceScore: number;
  ownerLabel: string;
  gateSignals: string[];
  alertSignals: string[];
  gateChecks: string[];
  fallbackTask: ReadinessRunbookTask | null;
};

export type ReadinessRunbookScenarioMonitorReleaseBoard = {
  headline: string;
  summary: string;
  releaseStatusLabel: string;
  releaseTone: 'success' | 'warning' | 'danger' | 'accent';
  confidenceScore: number;
  ownerLabel: string;
  releaseSignals: string[];
  alertSignals: string[];
  releaseChecks: string[];
  fallbackTask: ReadinessRunbookTask | null;
};

export type ReadinessRunbookScenarioMonitorStartBoard = {
  headline: string;
  summary: string;
  startStatusLabel: string;
  startTone: 'success' | 'warning' | 'danger' | 'accent';
  confidenceScore: number;
  ownerLabel: string;
  startSignals: string[];
  alertSignals: string[];
  startChecks: string[];
  fallbackTask: ReadinessRunbookTask | null;
};

export type ReadinessRunbookScenarioMonitorRhythmBoard = {
  headline: string;
  summary: string;
  rhythmStatusLabel: string;
  rhythmTone: 'success' | 'warning' | 'danger' | 'accent';
  confidenceScore: number;
  ownerLabel: string;
  rhythmSignals: string[];
  alertSignals: string[];
  rhythmChecks: string[];
  fallbackTask: ReadinessRunbookTask | null;
};

export type ReadinessRunbookScenarioMonitorStabilizationBoard = {
  headline: string;
  summary: string;
  stabilizationStatusLabel: string;
  stabilizationTone: 'success' | 'warning' | 'danger' | 'accent';
  confidenceScore: number;
  ownerLabel: string;
  stabilizationSignals: string[];
  alertSignals: string[];
  stabilizationChecks: string[];
  fallbackTask: ReadinessRunbookTask | null;
};

export type ReadinessRunbookScenarioMonitorLandingBoard = {
  headline: string;
  summary: string;
  landingStatusLabel: string;
  landingTone: 'success' | 'warning' | 'danger' | 'accent';
  confidenceScore: number;
  ownerLabel: string;
  landingSignals: string[];
  alertSignals: string[];
  landingChecks: string[];
  fallbackTask: ReadinessRunbookTask | null;
};

export type ReadinessRunbookScenarioMonitorHandoverBoard = {
  headline: string;
  summary: string;
  handoverStatusLabel: string;
  handoverTone: 'success' | 'warning' | 'danger' | 'accent';
  confidenceScore: number;
  ownerLabel: string;
  handoverSignals: string[];
  alertSignals: string[];
  handoverChecks: string[];
  fallbackTask: ReadinessRunbookTask | null;
};

export type ReadinessRunbookScenarioMonitorActivationBoard = {
  headline: string;
  summary: string;
  activationStatusLabel: string;
  activationTone: 'success' | 'warning' | 'danger' | 'accent';
  confidenceScore: number;
  ownerLabel: string;
  activationSignals: string[];
  alertSignals: string[];
  activationChecks: string[];
  fallbackTask: ReadinessRunbookTask | null;
};

export type ReadinessRunbookScenarioMonitorControlBoard = {
  headline: string;
  summary: string;
  controlStatusLabel: string;
  controlTone: 'success' | 'warning' | 'danger' | 'accent';
  confidenceScore: number;
  ownerLabel: string;
  controlSignals: string[];
  alertSignals: string[];
  controlChecks: string[];
  fallbackTask: ReadinessRunbookTask | null;
};

export type ReadinessRunbookScenarioMonitorConfirmationBoard = {
  headline: string;
  summary: string;
  confirmationStatusLabel: string;
  confirmationTone: 'success' | 'warning' | 'danger' | 'accent';
  confidenceScore: number;
  ownerLabel: string;
  confirmationSignals: string[];
  alertSignals: string[];
  confirmationChecks: string[];
  fallbackTask: ReadinessRunbookTask | null;
};

export type ReadinessRunbookScenarioMonitorApprovalBoard = {
  headline: string;
  summary: string;
  approvalStatusLabel: string;
  approvalTone: 'success' | 'warning' | 'danger' | 'accent';
  confidenceScore: number;
  ownerLabel: string;
  approvalSignals: string[];
  alertSignals: string[];
  approvalChecks: string[];
  fallbackTask: ReadinessRunbookTask | null;
};

export type ReadinessRunbookScenarioMonitorLeadBoard = {
  headline: string;
  summary: string;
  leadStatusLabel: string;
  leadTone: 'success' | 'warning' | 'danger' | 'accent';
  confidenceScore: number;
  ownerLabel: string;
  leadSignals: string[];
  alertSignals: string[];
  leadChecks: string[];
  fallbackTask: ReadinessRunbookTask | null;
};

export type ReadinessRunbookScenarioMonitorMandateBoard = {
  headline: string;
  summary: string;
  mandateStatusLabel: string;
  mandateTone: 'success' | 'warning' | 'danger' | 'accent';
  confidenceScore: number;
  ownerLabel: string;
  mandateSignals: string[];
  alertSignals: string[];
  mandateChecks: string[];
  fallbackTask: ReadinessRunbookTask | null;
};

export type ReadinessRunbookScenarioMonitorDecisionBoard = {
  headline: string;
  summary: string;
  decisionStatusLabel: string;
  decisionTone: 'success' | 'warning' | 'danger' | 'accent';
  confidenceScore: number;
  ownerLabel: string;
  decisionSignals: string[];
  alertSignals: string[];
  decisionChecks: string[];
  fallbackTask: ReadinessRunbookTask | null;
};

export type ReadinessRunbookScenarioMonitorGoBoard = {
  headline: string;
  summary: string;
  goStatusLabel: string;
  goTone: 'success' | 'warning' | 'danger' | 'accent';
  confidenceScore: number;
  ownerLabel: string;
  goSignals: string[];
  alertSignals: string[];
  goChecks: string[];
  fallbackTask: ReadinessRunbookTask | null;
};

export type ReadinessRunbookScenarioMonitorLiveBoard = {
  headline: string;
  summary: string;
  liveStatusLabel: string;
  liveTone: 'success' | 'warning' | 'danger' | 'accent';
  confidenceScore: number;
  ownerLabel: string;
  liveSignals: string[];
  alertSignals: string[];
  liveChecks: string[];
  fallbackTask: ReadinessRunbookTask | null;
};

export type ReadinessRunbookScenarioMonitorStatusBoard = {
  headline: string;
  summary: string;
  stateLabel: string;
  stateTone: 'success' | 'warning' | 'danger' | 'accent';
  confidenceScore: number;
  ownerLabel: string;
  stateSignals: string[];
  alertSignals: string[];
  stateChecks: string[];
  fallbackTask: ReadinessRunbookTask | null;
};

export type ReadinessRunbookScenarioMonitorReadyBoard = {
  headline: string;
  summary: string;
  readyStatusLabel: string;
  readyTone: 'success' | 'warning' | 'danger' | 'accent';
  confidenceScore: number;
  ownerLabel: string;
  readySignals: string[];
  alertSignals: string[];
  readyChecks: string[];
  fallbackTask: ReadinessRunbookTask | null;
};

export type ReadinessRunbookScenarioMonitorTransitionBoard = {
  headline: string;
  summary: string;
  transitionStatusLabel: string;
  transitionTone: 'success' | 'warning' | 'danger' | 'accent';
  confidenceScore: number;
  ownerLabel: string;
  transitionSignals: string[];
  alertSignals: string[];
  transitionChecks: string[];
  fallbackTask: ReadinessRunbookTask | null;
};

export type ReadinessRunbookScenarioMonitorEntryBoard = {
  headline: string;
  summary: string;
  entryStatusLabel: string;
  entryTone: 'success' | 'warning' | 'danger' | 'accent';
  confidenceScore: number;
  ownerLabel: string;
  entrySignals: string[];
  alertSignals: string[];
  entryChecks: string[];
  fallbackTask: ReadinessRunbookTask | null;
};

export type ReadinessRunbookScenarioMonitorInpassingBoard = {
  headline: string;
  summary: string;
  fitStatusLabel: string;
  fitTone: 'success' | 'warning' | 'danger' | 'accent';
  confidenceScore: number;
  ownerLabel: string;
  fitSignals: string[];
  alertSignals: string[];
  fitChecks: string[];
  fallbackTask: ReadinessRunbookTask | null;
};

export type ReadinessRunbookPriorityTrendDay = {
  key: string;
  label: string;
  critical: number;
  high: number;
  reopenRate: number;
};

export type ReadinessRunbookPhaseAnalyticsItem = {
  phase: ReadinessRunbookPhase;
  label: string;
  total: number;
  completed: number;
  open: number;
  activityCount: number;
  reopenedEvents: number;
  criticalCount: number;
  highCount: number;
  priorityLoad: number;
  latestEvent: ReadinessRunbookEvent | null;
  topTask: ReadinessRunbookTaskAnalyticsItem | null;
};

export type ReadinessRunbookTaskTrendDay = {
  key: string;
  label: string;
  activity: number;
  completed: number;
  reopened: number;
  reset: number;
  reopenRate: number;
};

const STORAGE_KEY = 'readiness-runbook-v1';
const MAX_EVENTS = 40;
const RUNBOOK_PHASE_LABELS: Record<ReadinessRunbookPhase, string> = {
  config: 'Config',
  data: 'Data',
  payments: 'Payments',
  ops: 'Ops',
  release: 'Release',
};

export const readinessRunbookTasks: ReadinessRunbookTask[] = [
  {
    id: 'config-app-url',
    phase: 'config',
    title: 'Canonieke bedrijfsplatform URL instellen',
    detail: 'Zet EXPO_PUBLIC_APP_URL op https://app.taze.to voor shareflows en productiebuilds.',
    route: '/security',
  },
  {
    id: 'config-api-origin',
    phase: 'config',
    title: 'Publieke API origin instellen',
    detail: 'Zet EXPO_PUBLIC_API_URL, CORS_ORIGINS en RETURN_URL_ORIGINS op de live Taze domeinen.',
    route: '/security',
    dependsOn: ['config-app-url'],
  },
  {
    id: 'data-supabase-public',
    phase: 'data',
    title: 'Supabase public keys invullen',
    detail: 'Controleer EXPO_PUBLIC_SUPABASE_URL en EXPO_PUBLIC_SUPABASE_ANON_KEY voor web en native.',
    route: '/security',
  },
  {
    id: 'data-run-migrations',
    phase: 'data',
    title: 'Supabase migraties uitvoeren',
    detail: 'Voer 0001_init.sql, 0002_invoice_and_trace_sync.sql en 0003_transport_preferences.sql uit.',
    route: '/readiness',
    dependsOn: ['data-supabase-public'],
  },
  {
    id: 'payments-stripe-public',
    phase: 'payments',
    title: 'Stripe publishable key zetten',
    detail: 'Zet EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY zodat checkout in de app live werkt.',
    route: '/payments',
  },
  {
    id: 'payments-stripe-server',
    phase: 'payments',
    title: 'Stripe serverconfig afronden',
    detail: 'Zet STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET en de STRIPE_PRICE_* waarden.',
    route: '/payments',
    dependsOn: ['payments-stripe-public'],
  },
  {
    id: 'ops-transport-sync',
    phase: 'ops',
    title: 'Transport sync valideren',
    detail: 'Werk lokale, wachtrij- en foutvoorkeuren weg tot de transport health stabiel is.',
    route: '/transport',
    dependsOn: ['config-app-url', 'config-api-origin', 'data-run-migrations'],
  },
  {
    id: 'ops-audit-fill',
    phase: 'ops',
    title: 'Echte auditdata vullen',
    detail: 'Loop AI-flows door zodat audit, legal en transportanalytics echte data bevatten.',
    route: '/audit',
    dependsOn: ['config-app-url', 'config-api-origin', 'data-run-migrations', 'payments-stripe-server'],
  },
  {
    id: 'release-qa',
    phase: 'release',
    title: 'QA-checklist doorlopen',
    detail: 'Voer lint, readiness, build:web en de server smoke checks uit voor de final pass.',
    route: '/readiness',
    dependsOn: ['ops-transport-sync', 'ops-audit-fill'],
  },
  {
    id: 'release-store',
    phase: 'release',
    title: 'Store en legal afronden',
    detail: 'Werk privacy, support, contact, screenshots, Data safety en releasecopy af voor publicatie.',
    route: '/privacy',
    dependsOn: ['release-qa'],
  },
];

const listeners = new Set<(state: ReadinessRunbookState) => void>();
let cache: ReadinessRunbookState = { completedIds: [], updatedAt: null, events: [] };
let hydrated = false;
let hydratePromise: Promise<ReadinessRunbookState> | null = null;

function emit(state: ReadinessRunbookState) {
  cache = state;
  listeners.forEach((listener) => listener(state));
}

function normalizeState(value: unknown): ReadinessRunbookState {
  if (!value || typeof value !== 'object') {
    return { completedIds: [], updatedAt: null, events: [] };
  }

  const candidate = value as Partial<ReadinessRunbookState>;
  const validIds = new Set(readinessRunbookTasks.map((task) => task.id));
  const completedIds = Array.isArray(candidate.completedIds)
    ? candidate.completedIds
        .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
        .filter((entry) => entry.length > 0 && validIds.has(entry))
    : [];

  const events = Array.isArray(candidate.events)
    ? candidate.events
        .filter((entry) => entry && typeof entry === 'object')
        .map((entry) => {
          const event = entry as Partial<ReadinessRunbookEvent>;
          const safeTaskId =
            typeof event.taskId === 'string' && event.taskId && validIds.has(event.taskId) ? event.taskId : null;
          const matchedTask =
            (safeTaskId ? readinessRunbookTasks.find((task) => task.id === safeTaskId) : null) ?? null;
          return {
            id: typeof event.id === 'string' && event.id ? event.id : `runbook-event-${Date.now()}`,
            kind:
              event.kind === 'completed' || event.kind === 'reopened' || event.kind === 'reset'
                ? event.kind
                : 'completed',
            taskId: safeTaskId,
            taskTitle:
              typeof event.taskTitle === 'string' && event.taskTitle.trim()
                ? event.taskTitle.trim().slice(0, 160)
                : matchedTask?.title ?? 'Runbook',
            phase:
              event.phase === 'config' ||
              event.phase === 'data' ||
              event.phase === 'payments' ||
              event.phase === 'ops' ||
              event.phase === 'release'
                ? event.phase
                : matchedTask?.phase ?? null,
            createdAt:
              typeof event.createdAt === 'string' && event.createdAt ? event.createdAt : new Date().toISOString(),
          };
        })
        .slice(0, MAX_EVENTS)
    : [];

  return {
    completedIds: [...new Set(completedIds)],
    updatedAt: typeof candidate.updatedAt === 'string' && candidate.updatedAt ? candidate.updatedAt : null,
    events,
  };
}

async function persist(state: ReadinessRunbookState) {
  emit(state);
  hydrated = true;
  try {
    await setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // keep local state if persistence fails
  }
}

export function getCachedReadinessRunbookState() {
  return hydrated ? cache : { completedIds: [], updatedAt: null, events: [] };
}

export function subscribeReadinessRunbook(listener: (state: ReadinessRunbookState) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function loadReadinessRunbook() {
  if (hydratePromise) return hydratePromise;

  hydratePromise = (async () => {
    try {
      const raw = await getItem(STORAGE_KEY);
      const next = raw ? normalizeState(JSON.parse(raw)) : { completedIds: [], updatedAt: null, events: [] };
      hydrated = true;
      emit(next);
      return next;
    } catch {
      const fallback = { completedIds: [], updatedAt: null, events: [] };
      hydrated = true;
      emit(fallback);
      return fallback;
    } finally {
      hydratePromise = null;
    }
  })();

  return hydratePromise;
}

export async function toggleReadinessRunbookTask(taskId: string) {
  const current = cache.completedIds.length > 0 || cache.updatedAt ? cache : await loadReadinessRunbook();
  const task = readinessRunbookTasks.find((entry) => entry.id === taskId) ?? null;
  const isCompleted = current.completedIds.includes(taskId);
  const eventKind: ReadinessRunbookEventKind = isCompleted ? 'reopened' : 'completed';
  const nextCompletedIds = current.completedIds.includes(taskId)
    ? current.completedIds.filter((entry) => entry !== taskId)
    : [...current.completedIds, taskId];

  const next = {
    completedIds: nextCompletedIds,
    updatedAt: new Date().toISOString(),
    events: [
      {
        id: `runbook-event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        kind: eventKind,
        taskId,
        taskTitle: task?.title ?? taskId,
        phase: task?.phase ?? null,
        createdAt: new Date().toISOString(),
      },
      ...current.events,
    ].slice(0, MAX_EVENTS),
  };
  await persist(next);
  return next;
}

export async function resetReadinessRunbook() {
  const next = {
    completedIds: [],
    updatedAt: new Date().toISOString(),
    events: [
      {
        id: `runbook-event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        kind: 'reset' as const,
        taskId: null,
        taskTitle: 'Runbook reset',
        phase: null,
        createdAt: new Date().toISOString(),
      },
      ...cache.events,
    ].slice(0, MAX_EVENTS),
  };
  await persist(next);
  return next;
}

export function buildReadinessRunbookSummary(reportName: string, state: ReadinessRunbookState) {
  const completed = new Set(state.completedIds);
  return [
    reportName,
    'Go-live runbook',
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    `Voltooid: ${state.completedIds.length}/${readinessRunbookTasks.length}`,
    `Laatste update: ${state.updatedAt ?? 'Nog niet bijgewerkt'}`,
    `Recente activiteit: ${state.events[0] ? `${state.events[0].taskTitle} (${state.events[0].kind})` : 'Nog leeg'}`,
    '',
    'Taken:',
    ...readinessRunbookTasks.map(
      (task) => `- [${completed.has(task.id) ? 'x' : ' '}] ${task.title} | ${task.detail}`
    ),
  ].join('\n');
}

export function buildReadinessRunbookPhaseProgress(completedIds: string[]): ReadinessRunbookPhaseProgress[] {
  const completed = new Set(completedIds);

  return (['config', 'data', 'payments', 'ops', 'release'] as const).map((phase) => {
    const tasks = readinessRunbookTasks.filter((task) => task.phase === phase);
    const completedCount = tasks.filter((task) => completed.has(task.id)).length;
    return {
      phase,
      label: RUNBOOK_PHASE_LABELS[phase],
      total: tasks.length,
      completed: completedCount,
      remaining: Math.max(0, tasks.length - completedCount),
    };
  });
}

export function buildReadinessRunbookFocusSnapshot(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookFocusSnapshot {
  const activeTask =
    typeof focus?.taskId === 'string' && focus.taskId
      ? readinessRunbookTasks.find((task) => task.id === focus.taskId) ?? null
      : null;
  const activePhase = activeTask?.phase ?? (focus?.phase ?? null);
  const tasks = activeTask
    ? [activeTask]
    : activePhase
      ? readinessRunbookTasks.filter((task) => task.phase === activePhase)
      : readinessRunbookTasks;
  const taskIds = new Set(tasks.map((task) => task.id));
  const events = state.events.filter((event) => {
    if (activeTask) return event.taskId === activeTask.id;
    if (activePhase) return event.phase === activePhase;
    return true;
  });
  const completedCount = tasks.filter((task) => state.completedIds.includes(task.id)).length;
  const nextTask = tasks.find((task) => !state.completedIds.includes(task.id)) ?? null;
  const label = activeTask
    ? activeTask.title
    : activePhase
      ? RUNBOOK_PHASE_LABELS[activePhase]
      : 'Schermbreed';
  const scopeLabel = activeTask ? 'Taakfocus' : activePhase ? 'Fasefocus' : 'Runbook totaal';

  return {
    label,
    scopeLabel,
    tasks,
    completedCount,
    openCount: Math.max(0, tasks.length - completedCount),
    totalEvents: events.length,
    completedEvents: events.filter((event) => event.kind === 'completed').length,
    reopenedEvents: events.filter((event) => event.kind === 'reopened').length,
    resetEvents: events.filter((event) => event.kind === 'reset').length,
    latestEvent: events[0] ?? null,
    nextTask:
      nextTask ??
      (activeTask && taskIds.has(activeTask.id) && !state.completedIds.includes(activeTask.id) ? activeTask : null),
  };
}

export function buildReadinessRunbookFocusedSummary(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const completed = new Set(state.completedIds);
  return [
    reportName,
    `Go-live runbook - ${snapshot.scopeLabel}`,
    `Scope: ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    `Voltooid: ${snapshot.completedCount}/${snapshot.tasks.length}`,
    `Open taken: ${snapshot.openCount}`,
    `Activiteit: ${snapshot.totalEvents}`,
    `Laatste update: ${state.updatedAt ?? 'Nog niet bijgewerkt'}`,
    `Laatste event: ${
      snapshot.latestEvent ? `${snapshot.latestEvent.taskTitle} (${snapshot.latestEvent.kind})` : 'Nog leeg'
    }`,
    '',
    'Taken in scope:',
    ...snapshot.tasks.map(
      (task) => `- [${completed.has(task.id) ? 'x' : ' '}] ${task.title} | ${task.detail}`
    ),
  ].join('\n');
}

export function buildReadinessRunbookManagementReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const taskAnalytics = buildReadinessRunbookTaskAnalytics(state, focus).slice(0, 5);
  return [
    reportName,
    `Go-live managementrapport - ${snapshot.scopeLabel}`,
    `Scope: ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    'Overzicht:',
    `Taken: ${snapshot.tasks.length}`,
    `Voltooid: ${snapshot.completedCount}`,
    `Open: ${snapshot.openCount}`,
    `Voltooiingsratio: ${snapshot.tasks.length > 0 ? Math.round((snapshot.completedCount / snapshot.tasks.length) * 100) : 0}%`,
    `Activiteit totaal: ${snapshot.totalEvents}`,
    `Voltooid events: ${snapshot.completedEvents}`,
    `Heropend events: ${snapshot.reopenedEvents}`,
    `Reset events: ${snapshot.resetEvents}`,
    `Laatste event: ${
      snapshot.latestEvent ? `${snapshot.latestEvent.taskTitle} | ${snapshot.latestEvent.kind}` : 'Nog leeg'
    }`,
    `Volgende taak: ${snapshot.nextTask?.title ?? 'Geen open taak'}`,
    '',
    'Taken in scope:',
    ...snapshot.tasks.map(
      (task) =>
        `- ${task.title}: ${state.completedIds.includes(task.id) ? 'klaar' : 'open'} | route ${task.route ?? 'geen'}`
    ),
    '',
    'Taakhotspots:',
    ...taskAnalytics.map(
      (item) =>
        `- ${item.task.title}: ${item.completed ? 'klaar' : 'open'} | prio ${item.priorityScore} | events ${item.activityCount} | heropend ${item.reopenedEvents} | laatste ${item.lastEvent?.kind ?? 'geen'}`
    ),
  ].join('\n');
}

export function buildReadinessRunbookTaskAnalytics(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookTaskAnalyticsItem[] {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);

  return snapshot.tasks
    .map((task) => {
      const taskEvents = state.events.filter((event) => event.taskId === task.id);
      return {
        task,
        completed: state.completedIds.includes(task.id),
        activityCount: taskEvents.length,
        completedEvents: taskEvents.filter((event) => event.kind === 'completed').length,
        reopenedEvents: taskEvents.filter((event) => event.kind === 'reopened').length,
        resetEvents: taskEvents.filter((event) => event.kind === 'reset').length,
        lastEvent: taskEvents[0] ?? null,
        priorityScore: 0,
      };
    })
    .map((item) => ({
      ...item,
      priorityScore: item.completed
        ? 0
        : item.reopenedEvents * 3 + item.activityCount * 2 + item.resetEvents + (item.lastEvent ? 1 : 0),
    }))
    .sort((left, right) => {
      if (left.completed !== right.completed) return Number(left.completed) - Number(right.completed);
      if (right.priorityScore !== left.priorityScore) return right.priorityScore - left.priorityScore;
      if (right.reopenedEvents !== left.reopenedEvents) return right.reopenedEvents - left.reopenedEvents;
      if (right.activityCount !== left.activityCount) return right.activityCount - left.activityCount;
      const rightTime = new Date(right.lastEvent?.createdAt ?? 0).getTime();
      const leftTime = new Date(left.lastEvent?.createdAt ?? 0).getTime();
      return rightTime - leftTime;
    });
}

export function buildReadinessRunbookTaskReport(
  reportName: string,
  state: ReadinessRunbookState,
  taskId: string
) {
  const task = readinessRunbookTasks.find((entry) => entry.id === taskId) ?? null;
  if (!task) {
    return [
      reportName,
      'Go-live taakrapport',
      `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
      'Taak niet gevonden.',
    ].join('\n');
  }

  const taskAnalytics = buildReadinessRunbookTaskAnalytics(state, { taskId })[0] ?? null;

  return [
    reportName,
    'Go-live taakrapport',
    `Taak: ${task.title}`,
    `Fase: ${RUNBOOK_PHASE_LABELS[task.phase]}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    `Status: ${state.completedIds.includes(task.id) ? 'Klaar' : 'Open'}`,
    `Route: ${task.route ?? 'Geen route'}`,
    `Activiteit: ${taskAnalytics?.activityCount ?? 0}`,
    `Voltooid events: ${taskAnalytics?.completedEvents ?? 0}`,
    `Heropend events: ${taskAnalytics?.reopenedEvents ?? 0}`,
    `Reset events: ${taskAnalytics?.resetEvents ?? 0}`,
    `Prioriteitsscore: ${taskAnalytics?.priorityScore ?? 0}`,
    `Laatste event: ${
      taskAnalytics?.lastEvent
        ? `${taskAnalytics.lastEvent.kind} op ${new Date(taskAnalytics.lastEvent.createdAt).toLocaleString('nl-BE')}`
        : 'Nog geen activiteit'
    }`,
    '',
    'Taakdetail:',
    task.detail,
  ].join('\n');
}

export function buildReadinessRunbookTaskManagementReport(
  reportName: string,
  state: ReadinessRunbookState,
  taskId: string
) {
  const task = readinessRunbookTasks.find((entry) => entry.id === taskId) ?? null;
  if (!task) {
    return [
      reportName,
      'Go-live taak managementrapport',
      `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
      'Taak niet gevonden.',
    ].join('\n');
  }

  const taskAnalytics = buildReadinessRunbookTaskAnalytics(state, { taskId })[0] ?? null;

  return [
    reportName,
    'Go-live taak managementrapport',
    `Taak: ${task.title}`,
    `Fase: ${RUNBOOK_PHASE_LABELS[task.phase]}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    'Kerncijfers:',
    `Status: ${state.completedIds.includes(task.id) ? 'Klaar' : 'Open'}`,
    `Activiteit totaal: ${taskAnalytics?.activityCount ?? 0}`,
    `Voltooid events: ${taskAnalytics?.completedEvents ?? 0}`,
    `Heropend events: ${taskAnalytics?.reopenedEvents ?? 0}`,
    `Reset events: ${taskAnalytics?.resetEvents ?? 0}`,
    `Prioriteitsscore: ${taskAnalytics?.priorityScore ?? 0}`,
    `Laatste event: ${
      taskAnalytics?.lastEvent ? `${taskAnalytics.lastEvent.kind} | ${taskAnalytics.lastEvent.createdAt}` : 'Nog geen activiteit'
    }`,
    `Route: ${task.route ?? 'Geen route'}`,
    '',
    'Uitvoering:',
    task.detail,
  ].join('\n');
}

export function buildReadinessRunbookTaskAnalyticsSummary(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookTaskAnalyticsSummary {
  const analytics = buildReadinessRunbookTaskAnalytics(state, focus);
  const openTasks = analytics.filter((item) => !item.completed).length;
  const completedTasks = analytics.length - openTasks;
  const topActiveTask = [...analytics].sort(
    (left, right) =>
      right.activityCount - left.activityCount ||
      right.reopenedEvents - left.reopenedEvents ||
      new Date(right.lastEvent?.createdAt ?? 0).getTime() - new Date(left.lastEvent?.createdAt ?? 0).getTime()
  )[0] ?? null;
  const topReopenedTask = [...analytics].sort(
    (left, right) =>
      right.reopenedEvents - left.reopenedEvents ||
      right.activityCount - left.activityCount ||
      new Date(right.lastEvent?.createdAt ?? 0).getTime() - new Date(left.lastEvent?.createdAt ?? 0).getTime()
  )[0] ?? null;
  const topOpenTask =
    [...analytics]
      .filter((item) => !item.completed)
      .sort(
        (left, right) =>
          right.reopenedEvents - left.reopenedEvents ||
          right.activityCount - left.activityCount ||
          new Date(right.lastEvent?.createdAt ?? 0).getTime() - new Date(left.lastEvent?.createdAt ?? 0).getTime()
      )[0] ?? null;

  return {
    openTasks,
    completedTasks,
    topActiveTask,
    topReopenedTask,
    topOpenTask,
  };
}

export function getReadinessRunbookPriorityBucket(item: ReadinessRunbookTaskAnalyticsItem): ReadinessRunbookPriorityBucket {
  if (item.completed) return 'done';
  if (item.priorityScore >= 12) return 'critical';
  if (item.priorityScore >= 8) return 'high';
  if (item.priorityScore >= 4) return 'medium';
  return 'low';
}

export function buildReadinessRunbookPrioritySummary(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookPrioritySummary {
  const analytics = buildReadinessRunbookTaskAnalytics(state, focus);
  const summary: ReadinessRunbookPrioritySummary = {
    critical: [],
    high: [],
    medium: [],
    low: [],
    done: [],
    topPriority: null,
  };

  analytics.forEach((item) => {
    summary[getReadinessRunbookPriorityBucket(item)].push(item);
  });

  summary.topPriority =
    summary.critical[0] ?? summary.high[0] ?? summary.medium[0] ?? summary.low[0] ?? summary.done[0] ?? null;
  return summary;
}

export function buildReadinessRunbookPriorityActions(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookPriorityAction[] {
  const summary = buildReadinessRunbookPrioritySummary(state, focus);
  return [...summary.critical, ...summary.high, ...summary.medium]
    .slice(0, 6)
    .map((task) => {
      const bucket = getReadinessRunbookPriorityBucket(task);
      const reason =
        task.reopenedEvents > 0
          ? `${task.reopenedEvents}x heropend`
          : task.activityCount > 0
            ? `${task.activityCount} activiteitsevents`
            : 'Nog open zonder activiteit';
      return {
        task,
        bucket,
        reason,
      };
    });
}

export function buildReadinessRunbookTaskAnalyticsCsv(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const analytics = buildReadinessRunbookTaskAnalytics(state, focus);
  const header = [
    'Taak',
    'Fase',
    'Status',
    'Activiteit',
    'Voltooid events',
    'Heropend events',
    'Reset events',
    'Laatste event',
    'Laatste event tijd',
    'Route',
  ].join(',');

  const rows = analytics.map((item) =>
    [
      `"${item.task.title.replace(/"/g, '""')}"`,
      `"${RUNBOOK_PHASE_LABELS[item.task.phase]}"`,
      `"${item.completed ? 'Klaar' : 'Open'}"`,
      item.activityCount,
      item.completedEvents,
      item.reopenedEvents,
      item.resetEvents,
      `"${(item.lastEvent?.kind ?? 'geen').replace(/"/g, '""')}"`,
      `"${(item.lastEvent?.createdAt ?? '').replace(/"/g, '""')}"`,
      `"${(item.task.route ?? '').replace(/"/g, '""')}"`,
    ].join(',')
  );

  return [header, ...rows].join('\n');
}

export function buildReadinessRunbookTaskAnalyticsReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const summary = buildReadinessRunbookTaskAnalyticsSummary(state, focus);
  const analytics = buildReadinessRunbookTaskAnalytics(state, focus).slice(0, 8);

  return [
    reportName,
    'Go-live taakanalyse',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    `Open taken: ${summary.openTasks}`,
    `Voltooide taken: ${summary.completedTasks}`,
    `Top actieve taak: ${summary.topActiveTask?.task.title ?? 'Nog leeg'}`,
    `Top heropende taak: ${summary.topReopenedTask?.task.title ?? 'Nog leeg'}`,
    `Top open taak: ${summary.topOpenTask?.task.title ?? 'Nog leeg'}`,
    '',
    'Top taken:',
    ...analytics.map(
      (item) =>
        `- ${item.task.title}: ${item.completed ? 'klaar' : 'open'} | prio ${item.priorityScore} | activiteit ${item.activityCount} | heropend ${item.reopenedEvents} | laatste ${item.lastEvent?.kind ?? 'geen'}`
    ),
  ].join('\n');
}

export function buildReadinessRunbookPriorityPlan(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const priority = buildReadinessRunbookPrioritySummary(state, focus);
  const nextItems = buildReadinessRunbookPriorityActions(state, focus);

  return [
    reportName,
    'Go-live prioriteitenplan',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    `Kritiek: ${priority.critical.length}`,
    `Hoog: ${priority.high.length}`,
    `Medium: ${priority.medium.length}`,
    `Laag: ${priority.low.length}`,
    '',
    'Nu eerst:',
    ...nextItems.map(
      (item, index) =>
        `${index + 1}. ${item.task.task.title} | ${item.bucket} | prio ${item.task.priorityScore} | ${item.reason}`
    ),
  ].join('\n');
}

export function buildReadinessRunbookPriorityTrend(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const analytics = buildReadinessRunbookTaskAnalytics(state, focus);
  const criticalIds = new Set(
    analytics.filter((item) => getReadinessRunbookPriorityBucket(item) === 'critical').map((item) => item.task.id)
  );
  const highIds = new Set(
    analytics.filter((item) => getReadinessRunbookPriorityBucket(item) === 'high').map((item) => item.task.id)
  );

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    return {
      key: date.toISOString().slice(0, 10),
      label: date.toLocaleDateString('nl-BE', { weekday: 'short' }).replace('.', ''),
      critical: 0,
      high: 0,
      reopenRate: 0,
    } satisfies ReadinessRunbookPriorityTrendDay;
  });

  const byDay = new Map(days.map((day) => [day.key, day]));
  const reopenDenominator = new Map<string, number>();
  const reopenNumerator = new Map<string, number>();

  state.events.forEach((event) => {
    if (!event.taskId) return;
    const createdAt = new Date(event.createdAt);
    if (Number.isNaN(createdAt.getTime())) return;
    createdAt.setHours(0, 0, 0, 0);
    const key = createdAt.toISOString().slice(0, 10);
    const bucket = byDay.get(key);
    if (!bucket) return;
    if (criticalIds.has(event.taskId)) bucket.critical += 1;
    if (highIds.has(event.taskId)) bucket.high += 1;
    reopenDenominator.set(key, (reopenDenominator.get(key) ?? 0) + 1);
    if (event.kind === 'reopened') {
      reopenNumerator.set(key, (reopenNumerator.get(key) ?? 0) + 1);
    }
  });

  days.forEach((day) => {
    const total = reopenDenominator.get(day.key) ?? 0;
    const reopened = reopenNumerator.get(day.key) ?? 0;
    day.reopenRate = total > 0 ? Math.round((reopened / total) * 100) : 0;
  });

  return {
    days,
    maxCritical: Math.max(1, ...days.map((day) => day.critical)),
    maxHigh: Math.max(1, ...days.map((day) => day.high)),
    maxReopenRate: Math.max(1, ...days.map((day) => day.reopenRate)),
  };
}

export function buildReadinessRunbookPhaseAnalytics(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookPhaseAnalyticsItem[] {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const taskAnalytics = buildReadinessRunbookTaskAnalytics(state, focus);
  const visiblePhases = [...new Set(snapshot.tasks.map((task) => task.phase))];

  return visiblePhases
    .map((phase) => {
      const phaseTasks = snapshot.tasks.filter((task) => task.phase === phase);
      const phaseTaskIds = new Set(phaseTasks.map((task) => task.id));
      const phaseTaskAnalytics = taskAnalytics.filter((item) => phaseTaskIds.has(item.task.id));
      const phaseEvents = state.events.filter((event) => event.taskId && phaseTaskIds.has(event.taskId));
      const completed = phaseTasks.filter((task) => state.completedIds.includes(task.id)).length;
      const criticalCount = phaseTaskAnalytics.filter(
        (item) => getReadinessRunbookPriorityBucket(item) === 'critical'
      ).length;
      const highCount = phaseTaskAnalytics.filter((item) => getReadinessRunbookPriorityBucket(item) === 'high').length;
      const reopenedEvents = phaseEvents.filter((event) => event.kind === 'reopened').length;
      const priorityLoad =
        criticalCount * 5 +
        highCount * 3 +
        Math.max(0, phaseTasks.length - completed) * 2 +
        reopenedEvents +
        phaseEvents.length;

      return {
        phase,
        label: RUNBOOK_PHASE_LABELS[phase],
        total: phaseTasks.length,
        completed,
        open: Math.max(0, phaseTasks.length - completed),
        activityCount: phaseEvents.length,
        reopenedEvents,
        criticalCount,
        highCount,
        priorityLoad,
        latestEvent: phaseEvents[0] ?? null,
        topTask: phaseTaskAnalytics[0] ?? null,
      };
    })
    .sort((left, right) => {
      if (right.priorityLoad !== left.priorityLoad) return right.priorityLoad - left.priorityLoad;
      if (right.open !== left.open) return right.open - left.open;
      if (right.reopenedEvents !== left.reopenedEvents) return right.reopenedEvents - left.reopenedEvents;
      return right.activityCount - left.activityCount;
    });
}

export function buildReadinessRunbookPhaseAnalyticsReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const phases = buildReadinessRunbookPhaseAnalytics(state, focus);

  return [
    reportName,
    'Go-live fase-analyse',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    'Fases onder druk:',
    ...phases.map(
      (phase) =>
        `- ${phase.label}: prio ${phase.priorityLoad} | open ${phase.open}/${phase.total} | kritiek ${phase.criticalCount} | hoog ${phase.highCount} | activiteit ${phase.activityCount} | heropend ${phase.reopenedEvents} | top taak ${phase.topTask?.task.title ?? 'Nog leeg'}`
    ),
  ].join('\n');
}

export function buildReadinessRunbookPhaseAnalyticsCsv(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const phases = buildReadinessRunbookPhaseAnalytics(state, focus);
  const header = [
    'Fase',
    'Totaal',
    'Voltooid',
    'Open',
    'Activiteit',
    'Heropend',
    'Kritiek',
    'Hoog',
    'Prio load',
    'Top taak',
    'Laatste event',
    'Laatste event tijd',
  ].join(',');

  const rows = phases.map((phase) =>
    [
      `"${phase.label}"`,
      phase.total,
      phase.completed,
      phase.open,
      phase.activityCount,
      phase.reopenedEvents,
      phase.criticalCount,
      phase.highCount,
      phase.priorityLoad,
      `"${(phase.topTask?.task.title ?? '').replace(/"/g, '""')}"`,
      `"${(phase.latestEvent?.kind ?? '').replace(/"/g, '""')}"`,
      `"${(phase.latestEvent?.createdAt ?? '').replace(/"/g, '""')}"`,
    ].join(',')
  );

  return [header, ...rows].join('\n');
}

export function buildReadinessRunbookCriticalPath(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookCriticalPathItem[] {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const visibleIds = new Set(snapshot.tasks.map((task) => task.id));
  const openTasks = readinessRunbookTasks.filter(
    (task) => visibleIds.has(task.id) && !state.completedIds.includes(task.id)
  );

  return openTasks.map((task, index) => ({
    task,
    phaseLabel: RUNBOOK_PHASE_LABELS[task.phase],
    order: index + 1,
    blockersAhead: index,
    statusLabel: index === 0 ? 'Nu' : index < 3 ? 'Daarna' : 'Later',
    tone: index === 0 ? 'danger' : index < 3 ? 'warning' : 'accent',
    reason: index === 0 ? 'Eerste open stap op het kritieke pad' : `${index} open taak/taken eerst`,
  }));
}

export function buildReadinessRunbookCriticalPathReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const criticalPath = buildReadinessRunbookCriticalPath(state, focus);

  return [
    reportName,
    'Go-live kritiek pad',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    'Open volgorde:',
    ...(criticalPath.length > 0
      ? criticalPath.map(
          (item) =>
            `${item.order}. ${item.task.title} | ${item.phaseLabel} | ${item.statusLabel} | ${item.reason} | route ${item.task.route ?? 'geen'}`
        )
      : ['Geen open taken meer in deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookDependencyMap(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookDependencyItem[] {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const visibleTasks = snapshot.tasks;
  const completedIds = new Set(state.completedIds);
  const allTasksById = new Map(readinessRunbookTasks.map((task) => [task.id, task]));

  return visibleTasks.map((task) => {
    const dependencies = (task.dependsOn ?? [])
      .map((id) => allTasksById.get(id) ?? null)
      .filter((entry): entry is ReadinessRunbookTask => Boolean(entry));
    const blockedBy = dependencies.filter((dependency) => !completedIds.has(dependency.id));
    const status: ReadinessRunbookDependencyItem['status'] = completedIds.has(task.id)
      ? 'done'
      : blockedBy.length > 0
        ? 'blocked'
        : 'ready';
    const reason =
      status === 'done'
        ? 'Taak is al voltooid'
        : blockedBy.length > 0
          ? `Wacht op ${blockedBy.map((entry) => entry.title).join(', ')}`
          : dependencies.length > 0
            ? 'Alle afhankelijkheden zijn afgewerkt'
            : 'Geen blokkades vooraf';

    return {
      task,
      phaseLabel: RUNBOOK_PHASE_LABELS[task.phase],
      status,
      blockedBy,
      dependsOn: dependencies,
      reason,
    };
  }).sort((left, right) => {
    const rank = { blocked: 0, ready: 1, done: 2 };
    if (rank[left.status] !== rank[right.status]) return rank[left.status] - rank[right.status];
    if (right.blockedBy.length !== left.blockedBy.length) return right.blockedBy.length - left.blockedBy.length;
    return left.task.title.localeCompare(right.task.title, 'nl');
  });
}

export function buildReadinessRunbookDependencyReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const dependencies = buildReadinessRunbookDependencyMap(state, focus);

  return [
    reportName,
    'Go-live afhankelijkheden',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    'Afhankelijkheidskaart:',
    ...dependencies.map(
      (item) =>
        `- ${item.task.title}: ${item.status} | ${item.phaseLabel} | ${
          item.dependsOn.length > 0 ? `afhankelijk van ${item.dependsOn.map((entry) => entry.title).join(', ')}` : 'geen afhankelijkheden'
        } | ${item.reason}`
    ),
  ].join('\n');
}

export function buildReadinessRunbookExecutionWaves(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookExecutionWave[] {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const dependencies = buildReadinessRunbookDependencyMap(state, focus);
  const dependencyById = new Map(dependencies.map((item) => [item.task.id, item]));
  const visibleTasks = snapshot.tasks;

  const memo = new Map<string, number>();
  const getDepth = (taskId: string, stack = new Set<string>()): number => {
    if (memo.has(taskId)) return memo.get(taskId) ?? 0;
    if (stack.has(taskId)) return 0;
    stack.add(taskId);
    const task = visibleTasks.find((entry) => entry.id === taskId) ?? null;
    const relevantDependencies = (task?.dependsOn ?? []).filter((dependencyId) =>
      visibleTasks.some((entry) => entry.id === dependencyId)
    );
    const depth =
      relevantDependencies.length > 0
        ? 1 + Math.max(...relevantDependencies.map((dependencyId) => getDepth(dependencyId, new Set(stack))))
        : 0;
    memo.set(taskId, depth);
    return depth;
  };

  const buckets = new Map<number, ReadinessRunbookTask[]>();
  visibleTasks.forEach((task) => {
    const depth = getDepth(task.id);
    const bucket = buckets.get(depth) ?? [];
    bucket.push(task);
    buckets.set(depth, bucket);
  });

  return [...buckets.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([depth, tasks]) => {
      const items = tasks
        .map((task) => dependencyById.get(task.id))
        .filter((entry): entry is ReadinessRunbookDependencyItem => Boolean(entry));
      const phaseLabels = [...new Set(tasks.map((task) => RUNBOOK_PHASE_LABELS[task.phase]))];
      const readyTask =
        items.find((item) => item.status === 'ready')?.task ??
        items.find((item) => item.status === 'blocked')?.task ??
        items[0]?.task ??
        null;
      return {
        order: depth + 1,
        label: `Golf ${depth + 1}`,
        tasks,
        phaseLabels,
        openCount: items.filter((item) => item.status !== 'done').length,
        readyCount: items.filter((item) => item.status === 'ready').length,
        blockedCount: items.filter((item) => item.status === 'blocked').length,
        topTask: readyTask,
      };
    });
}

export function buildReadinessRunbookExecutionWaveReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const waves = buildReadinessRunbookExecutionWaves(state, focus);

  return [
    reportName,
    'Go-live werkbundels',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    'Uitvoergolven:',
    ...waves.map(
      (wave) =>
        `- ${wave.label}: ${wave.openCount} open | ${wave.readyCount} ready | ${wave.blockedCount} geblokkeerd | fases ${wave.phaseLabels.join(', ')} | top taak ${wave.topTask?.title ?? 'Nog leeg'}`
    ),
  ].join('\n');
}

export function buildReadinessRunbookWorkstreams(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookWorkstream[] {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const dependencies = buildReadinessRunbookDependencyMap(state, focus);
  const dependencyById = new Map(dependencies.map((item) => [item.task.id, item]));
  const visiblePhases = [...new Set(snapshot.tasks.map((task) => task.phase))];

  return visiblePhases
    .map((phase) => {
      const tasks = snapshot.tasks.filter((task) => task.phase === phase);
      const items = tasks
        .map((task) => dependencyById.get(task.id))
        .filter((item): item is ReadinessRunbookDependencyItem => Boolean(item));
      const readyTasks = items.filter((item) => item.status === 'ready').map((item) => item.task);
      const blockedTasks = items.filter((item) => item.status === 'blocked').map((item) => item.task);
      const doneTasks = items.filter((item) => item.status === 'done').map((item) => item.task);

      return {
        phase,
        label: RUNBOOK_PHASE_LABELS[phase],
        tasks,
        readyTasks,
        blockedTasks,
        doneTasks,
        topReadyTask: readyTasks[0] ?? null,
        topBlockedTask: blockedTasks[0] ?? null,
        momentumScore: readyTasks.length * 3 + doneTasks.length - blockedTasks.length * 2,
      };
    })
    .sort((left, right) => {
      if (right.momentumScore !== left.momentumScore) return right.momentumScore - left.momentumScore;
      if (right.readyTasks.length !== left.readyTasks.length) return right.readyTasks.length - left.readyTasks.length;
      return left.label.localeCompare(right.label, 'nl');
    });
}

export function buildReadinessRunbookWorkstreamReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const workstreams = buildReadinessRunbookWorkstreams(state, focus);

  return [
    reportName,
    'Go-live werkstromen',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    'Werkstromen:',
    ...workstreams.map(
      (stream) =>
        `- ${stream.label}: momentum ${stream.momentumScore} | ready ${stream.readyTasks.length} | geblokkeerd ${stream.blockedTasks.length} | klaar ${stream.doneTasks.length} | top ready ${stream.topReadyTask?.title ?? 'Nog leeg'}`
    ),
  ].join('\n');
}

export function buildReadinessRunbookBottlenecks(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookBottleneckItem[] {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const visibleTasks = snapshot.tasks;
  const visibleIds = new Set(visibleTasks.map((task) => task.id));
  const completedIds = new Set(state.completedIds);

  const blockedByTask = new Map<string, ReadinessRunbookTask[]>();
  visibleTasks.forEach((task) => {
    const unresolvedDependencies = (task.dependsOn ?? []).filter(
      (dependencyId) => visibleIds.has(dependencyId) && !completedIds.has(dependencyId)
    );
    unresolvedDependencies.forEach((dependencyId) => {
      const bucket = blockedByTask.get(dependencyId) ?? [];
      bucket.push(task);
      blockedByTask.set(dependencyId, bucket);
    });
  });

  return visibleTasks
    .map((task) => {
      const blockedTasks = blockedByTask.get(task.id) ?? [];
      return {
        task,
        phaseLabel: RUNBOOK_PHASE_LABELS[task.phase],
        blockedTasks,
        blockingCount: blockedTasks.length,
        isCompleted: completedIds.has(task.id),
        reason: blockedTasks.length
          ? `${blockedTasks.length} taak/taken wachten op deze stap`
          : completedIds.has(task.id)
            ? 'Geen blokkade meer, taak is klaar'
            : 'Geen directe downstream blokkade',
      };
    })
    .sort((left, right) => {
      if (right.blockingCount !== left.blockingCount) return right.blockingCount - left.blockingCount;
      if (Number(left.isCompleted) !== Number(right.isCompleted)) return Number(left.isCompleted) - Number(right.isCompleted);
      return left.task.title.localeCompare(right.task.title, 'nl');
    });
}

export function buildReadinessRunbookBottleneckReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const bottlenecks = buildReadinessRunbookBottlenecks(state, focus);

  return [
    reportName,
    'Go-live bottlenecks',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    'Taken met downstream impact:',
    ...bottlenecks
      .slice(0, 8)
      .map(
        (item) =>
          `- ${item.task.title}: ${item.blockingCount} blokkades | ${item.phaseLabel} | ${
            item.blockedTasks.length > 0
              ? `wachtend: ${item.blockedTasks.map((task) => task.title).join(', ')}`
              : item.reason
          }`
      ),
  ].join('\n');
}

export function buildReadinessRunbookUnlocks(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookUnlockItem[] {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const visibleTasks = snapshot.tasks;
  const visibleIds = new Set(visibleTasks.map((task) => task.id));
  const completedIds = new Set(state.completedIds);

  return visibleTasks
    .map((task) => {
      const unlockedTasks = visibleTasks.filter(
        (candidate) =>
          !completedIds.has(candidate.id) &&
          (candidate.dependsOn ?? []).includes(task.id)
      );
      const immediateReadyTasks = unlockedTasks.filter((candidate) => {
        const unresolvedDependencies = (candidate.dependsOn ?? []).filter(
          (dependencyId) => visibleIds.has(dependencyId) && !completedIds.has(dependencyId)
        );
        return unresolvedDependencies.length === 1 && unresolvedDependencies[0] === task.id;
      });

      const reason = completedIds.has(task.id)
        ? 'Taak is al voltooid'
        : immediateReadyTasks.length > 0
          ? `Maakt ${immediateReadyTasks.length} taak/taken direct startklaar`
          : unlockedTasks.length > 0
            ? `Haalt blokkade weg voor ${unlockedTasks.length} vervolgtaak/taken`
            : 'Geen directe ontgrendeling';

      return {
        task,
        phaseLabel: RUNBOOK_PHASE_LABELS[task.phase],
        unlockedTasks,
        immediateReadyTasks,
        unlockCount: unlockedTasks.length,
        immediateReadyCount: immediateReadyTasks.length,
        isCompleted: completedIds.has(task.id),
        reason,
      };
    })
    .sort((left, right) => {
      if (right.immediateReadyCount !== left.immediateReadyCount) {
        return right.immediateReadyCount - left.immediateReadyCount;
      }
      if (right.unlockCount !== left.unlockCount) return right.unlockCount - left.unlockCount;
      if (Number(left.isCompleted) !== Number(right.isCompleted)) return Number(left.isCompleted) - Number(right.isCompleted);
      return left.task.title.localeCompare(right.task.title, 'nl');
    });
}

export function buildReadinessRunbookUnlockReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const unlocks = buildReadinessRunbookUnlocks(state, focus);

  return [
    reportName,
    'Go-live ontgrendelplan',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    'Taken met de meeste vrijmaakwaarde:',
    ...unlocks
      .slice(0, 8)
      .map(
        (item) =>
          `- ${item.task.title}: direct ${item.immediateReadyCount} | totaal ${item.unlockCount} | ${item.phaseLabel} | ${item.reason}`
      ),
  ].join('\n');
}

export function buildReadinessRunbookRecommendedMoves(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookRecommendedMove[] {
  const completedIds = new Set(state.completedIds);
  const bottlenecks = buildReadinessRunbookBottlenecks(state, focus);
  const unlocks = buildReadinessRunbookUnlocks(state, focus);
  const criticalPath = buildReadinessRunbookCriticalPath(state, focus);
  const bottleneckById = new Map(bottlenecks.map((item) => [item.task.id, item]));
  const unlockById = new Map(unlocks.map((item) => [item.task.id, item]));
  const criticalById = new Map(criticalPath.map((item) => [item.task.id, item]));

  return readinessRunbookTasks
    .filter((task) => {
      if (completedIds.has(task.id)) return false;
      return (
        bottleneckById.has(task.id) ||
        unlockById.has(task.id) ||
        criticalById.has(task.id)
      );
    })
    .map((task) => {
      const bottleneck = bottleneckById.get(task.id);
      const unlock = unlockById.get(task.id);
      const critical = criticalById.get(task.id);
      const score =
        (unlock?.immediateReadyCount ?? 0) * 5 +
        (unlock?.unlockCount ?? 0) * 2 +
        (bottleneck?.blockingCount ?? 0) * 4 +
        (critical ? Math.max(0, 6 - critical.order) : 0);

      const rationaleParts = [
        bottleneck && bottleneck.blockingCount > 0 ? `${bottleneck.blockingCount} blokkades weg` : null,
        unlock && unlock.immediateReadyCount > 0 ? `${unlock.immediateReadyCount} direct startklaar` : null,
        unlock && unlock.unlockCount > 0 ? `${unlock.unlockCount} totaal vrijgemaakt` : null,
        critical ? `kritiek pad #${critical.order}` : null,
      ].filter((value): value is string => Boolean(value));

      return {
        task,
        phaseLabel: RUNBOOK_PHASE_LABELS[task.phase],
        score,
        blockingCount: bottleneck?.blockingCount ?? 0,
        unlockCount: unlock?.unlockCount ?? 0,
        immediateReadyCount: unlock?.immediateReadyCount ?? 0,
        rationale: rationaleParts.join(' | ') || 'Algemene open livegangstap',
        nextUnlockedLabels: unlock?.immediateReadyTasks.slice(0, 3).map((entry) => entry.title) ?? [],
      };
    })
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      if (right.immediateReadyCount !== left.immediateReadyCount) return right.immediateReadyCount - left.immediateReadyCount;
      if (right.blockingCount !== left.blockingCount) return right.blockingCount - left.blockingCount;
      return left.task.title.localeCompare(right.task.title, 'nl');
    });
}

export function buildReadinessRunbookRecommendedMovesReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const moves = buildReadinessRunbookRecommendedMoves(state, focus);

  return [
    reportName,
    'Go-live slimste zetten',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    'Aanbevolen volgende zetten:',
    ...(moves.length > 0
      ? moves.slice(0, 8).map(
          (item, index) =>
            `${index + 1}. ${item.task.title}: score ${item.score} | ${item.phaseLabel} | ${item.rationale}`
        )
      : ['Geen open aanbevelingen meer in deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookControlTower(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookControlTower {
  const dependencies = buildReadinessRunbookDependencyMap(state, focus);
  const moves = buildReadinessRunbookRecommendedMoves(state, focus);
  const bottlenecks = buildReadinessRunbookBottlenecks(state, focus);
  const unlocks = buildReadinessRunbookUnlocks(state, focus);
  const workstreams = buildReadinessRunbookWorkstreams(state, focus);
  const waves = buildReadinessRunbookExecutionWaves(state, focus);

  const openTasks = dependencies.filter((item) => item.status !== 'done').length;
  const readyTasks = dependencies.filter((item) => item.status === 'ready').length;
  const blockedTasks = dependencies.filter((item) => item.status === 'blocked').length;
  const topMove = moves[0] ?? null;
  const topBottleneck = bottlenecks[0] ?? null;
  const topUnlock = unlocks[0] ?? null;
  const topWorkstream = workstreams[0] ?? null;
  const topWave = waves[0] ?? null;

  const headline = topMove
    ? `Nu eerst: ${topMove.task.title}`
    : openTasks > 0
      ? 'Open livegangstappen zonder topaanbeveling'
      : 'Go-live runbook klaar voor afronding';

  const summary = topMove
    ? `${topMove.rationale}. ${topBottleneck?.blockingCount ? `${topBottleneck.blockingCount} bottleneck(s)` : 'Geen zware bottleneck'} en ${topUnlock?.immediateReadyCount ?? 0} direct vrij te maken taak/taken.`
    : openTasks > 0
      ? `${openTasks} open taken, ${readyTasks} ready en ${blockedTasks} geblokkeerd.`
      : 'Geen open taken meer in deze scope.';

  return {
    headline,
    summary,
    topMove,
    topBottleneck,
    topUnlock,
    topWorkstream,
    topWave,
    openTasks,
    readyTasks,
    blockedTasks,
  };
}

export function buildReadinessRunbookControlTowerReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const controlTower = buildReadinessRunbookControlTower(state, focus);

  return [
    reportName,
    'Go-live regiebrief',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    `Headline: ${controlTower.headline}`,
    `Samenvatting: ${controlTower.summary}`,
    `Open: ${controlTower.openTasks} | Ready: ${controlTower.readyTasks} | Geblokkeerd: ${controlTower.blockedTasks}`,
    `Top zet: ${controlTower.topMove?.task.title ?? 'Nog leeg'}`,
    `Top bottleneck: ${controlTower.topBottleneck?.task.title ?? 'Nog leeg'}`,
    `Top ontgrendelaar: ${controlTower.topUnlock?.task.title ?? 'Nog leeg'}`,
    `Top werkstroom: ${controlTower.topWorkstream?.label ?? 'Nog leeg'}`,
    `Top golf: ${controlTower.topWave?.label ?? 'Nog leeg'}`,
  ].join('\n');
}

export function buildReadinessRunbookExecutionAgenda(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookExecutionAgenda {
  const moves = buildReadinessRunbookRecommendedMoves(state, focus);
  return {
    now: moves.slice(0, 1),
    next: moves.slice(1, 4),
    later: moves.slice(4, 8),
  };
}

export function buildReadinessRunbookExecutionAgendaReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const agenda = buildReadinessRunbookExecutionAgenda(state, focus);

  return [
    reportName,
    'Go-live uitvoeragenda',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    'Nu:',
    ...(agenda.now.length > 0
      ? agenda.now.map((item) => `- ${item.task.title} | ${item.phaseLabel} | ${item.rationale}`)
      : ['- Geen directe zet']),
    'Daarna:',
    ...(agenda.next.length > 0
      ? agenda.next.map((item) => `- ${item.task.title} | ${item.phaseLabel} | ${item.rationale}`)
      : ['- Geen volgende zet']),
    'Later:',
    ...(agenda.later.length > 0
      ? agenda.later.map((item) => `- ${item.task.title} | ${item.phaseLabel} | ${item.rationale}`)
      : ['- Geen latere zet']),
  ].join('\n');
}

export function buildReadinessRunbookMovePreview(
  state: ReadinessRunbookState,
  taskId: string,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookMovePreview | null {
  const task = readinessRunbookTasks.find((entry) => entry.id === taskId) ?? null;
  if (!task) return null;

  const currentDependencies = buildReadinessRunbookDependencyMap(state, focus);
  const currentOpen = currentDependencies.filter((item) => item.status !== 'done').length;
  const currentReady = currentDependencies.filter((item) => item.status === 'ready').length;
  const currentBlocked = currentDependencies.filter((item) => item.status === 'blocked').length;

  const nextState: ReadinessRunbookState = {
    ...state,
    completedIds: state.completedIds.includes(taskId) ? state.completedIds : [...state.completedIds, taskId],
  };

  const projectedDependencies = buildReadinessRunbookDependencyMap(nextState, focus);
  const projectedOpen = projectedDependencies.filter((item) => item.status !== 'done').length;
  const projectedReady = projectedDependencies.filter((item) => item.status === 'ready').length;
  const projectedBlocked = projectedDependencies.filter((item) => item.status === 'blocked').length;

  const currentBlockedMap = new Map(currentDependencies.map((item) => [item.task.id, item.status]));
  const currentBottlenecks = buildReadinessRunbookBottlenecks(state, focus);
  const nextBottlenecks = buildReadinessRunbookBottlenecks(nextState, focus);
  const nextBottleneckIds = new Set(nextBottlenecks.filter((item) => item.blockingCount > 0).map((item) => item.task.id));

  const newlyReadyTasks = projectedDependencies
    .filter((item) => item.status === 'ready' && currentBlockedMap.get(item.task.id) === 'blocked')
    .map((item) => item.task);
  const relievedBottlenecks = currentBottlenecks
    .filter((item) => item.blockingCount > 0 && !nextBottleneckIds.has(item.task.id))
    .map((item) => item.task);

  return {
    task,
    phaseLabel: RUNBOOK_PHASE_LABELS[task.phase],
    currentOpen,
    currentReady,
    currentBlocked,
    projectedOpen,
    projectedReady,
    projectedBlocked,
    deltaReady: projectedReady - currentReady,
    deltaBlocked: projectedBlocked - currentBlocked,
    newlyReadyTasks,
    relievedBottlenecks,
  };
}

export function buildReadinessRunbookMovePreviewReport(
  reportName: string,
  state: ReadinessRunbookState,
  taskId: string,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const preview = buildReadinessRunbookMovePreview(state, taskId, focus);
  if (!preview) {
    return [
      reportName,
      'Go-live move preview',
      `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
      'Taak niet gevonden.',
    ].join('\n');
  }

  return [
    reportName,
    'Go-live move preview',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Taak: ${preview.task.title}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    `Nu: open ${preview.currentOpen} | ready ${preview.currentReady} | geblokkeerd ${preview.currentBlocked}`,
    `Na deze zet: open ${preview.projectedOpen} | ready ${preview.projectedReady} | geblokkeerd ${preview.projectedBlocked}`,
    `Delta ready: ${preview.deltaReady >= 0 ? '+' : ''}${preview.deltaReady} | Delta geblokkeerd: ${preview.deltaBlocked}`,
    `Nieuw direct startklaar: ${preview.newlyReadyTasks.length > 0 ? preview.newlyReadyTasks.map((item) => item.title).join(', ') : 'geen'}`,
    `Verdwijnende bottlenecks: ${preview.relievedBottlenecks.length > 0 ? preview.relievedBottlenecks.map((item) => item.title).join(', ') : 'geen'}`,
  ].join('\n');
}

export function buildReadinessRunbookMoveComparison(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookMoveComparisonItem[] {
  const moves = buildReadinessRunbookRecommendedMoves(state, focus).slice(0, 3);
  return moves.map((move) => ({
    move,
    preview: buildReadinessRunbookMovePreview(state, move.task.id, focus),
  }));
}

export function buildReadinessRunbookMoveComparisonReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const comparison = buildReadinessRunbookMoveComparison(state, focus);

  return [
    reportName,
    'Go-live zetvergelijking',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    'Top moves vergeleken:',
    ...(comparison.length > 0
      ? comparison.map(
          (item, index) =>
            `${index + 1}. ${item.move.task.title}: score ${item.move.score} | ready ${((item.preview?.deltaReady ?? 0) >= 0 ? '+' : '')}${item.preview?.deltaReady ?? 0} | geblokkeerd ${item.preview?.deltaBlocked ?? 0} | ${item.move.rationale}`
        )
      : ['Geen vergelijkbare moves in deze scope.']),
  ].join('\n');
}

function getReadinessRunbookForecastCounts(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const dependencyMap = buildReadinessRunbookDependencyMap(state, focus);
  return {
    openTasks: dependencyMap.filter((item) => item.status !== 'done').length,
    readyTasks: dependencyMap.filter((item) => item.status === 'ready').length,
    blockedTasks: dependencyMap.filter((item) => item.status === 'blocked').length,
    completedCount: dependencyMap.filter((item) => item.status === 'done').length,
    totalTasks: dependencyMap.length,
  };
}

function simulateReadinessRunbookForecast(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null,
  maxSteps = 3,
  preferredFirstTaskId?: string | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const visibleIds = new Set(snapshot.tasks.map((task) => task.id));
  const steps: ReadinessRunbookForecastStep[] = [];
  let simulatedState: ReadinessRunbookState = {
    completedIds: [...state.completedIds],
    updatedAt: state.updatedAt,
    events: state.events,
  };

  for (let index = 0; index < maxSteps; index += 1) {
    const moves = buildReadinessRunbookRecommendedMoves(simulatedState, focus).filter((move) =>
      visibleIds.has(move.task.id)
    );
    const topMove =
      index === 0 && preferredFirstTaskId
        ? moves.find((move) => move.task.id === preferredFirstTaskId) ?? moves[0]
        : moves[0];
    if (!topMove) break;

    if (!simulatedState.completedIds.includes(topMove.task.id)) {
      simulatedState = {
        ...simulatedState,
        completedIds: [...simulatedState.completedIds, topMove.task.id],
      };
    }

    const counts = getReadinessRunbookForecastCounts(simulatedState, focus);
    const completionRate =
      counts.totalTasks > 0 ? Math.round((counts.completedCount / counts.totalTasks) * 100) : 0;

    steps.push({
      order: index + 1,
      task: topMove.task,
      phaseLabel: RUNBOOK_PHASE_LABELS[topMove.task.phase],
      openTasks: counts.openTasks,
      readyTasks: counts.readyTasks,
      blockedTasks: counts.blockedTasks,
      completedCount: counts.completedCount,
      totalTasks: counts.totalTasks,
      completionRate,
      headline: `Na stap ${index + 1}: ${topMove.task.title}`,
    });
  }

  return { steps, simulatedState };
}

export function buildReadinessRunbookForecast(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookForecastStep[] {
  return simulateReadinessRunbookForecast(state, focus, 3).steps;
}

export function buildReadinessRunbookForecastSummary(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null,
  preferredFirstTaskId?: string | null
): ReadinessRunbookForecastSummary | null {
  const initialCounts = getReadinessRunbookForecastCounts(state, focus);
  const { steps, simulatedState } = simulateReadinessRunbookForecast(state, focus, 3, preferredFirstTaskId);
  if (steps.length === 0) return null;

  const finalCounts = getReadinessRunbookForecastCounts(simulatedState, focus);
  const completionRate =
    finalCounts.totalTasks > 0 ? Math.round((finalCounts.completedCount / finalCounts.totalTasks) * 100) : 0;
  const nextMove = buildReadinessRunbookRecommendedMoves(simulatedState, focus)[0] ?? null;

  return {
    stepsCount: steps.length,
    initialOpenTasks: initialCounts.openTasks,
    initialReadyTasks: initialCounts.readyTasks,
    initialBlockedTasks: initialCounts.blockedTasks,
    initialCompletedCount: initialCounts.completedCount,
    finalOpenTasks: finalCounts.openTasks,
    finalReadyTasks: finalCounts.readyTasks,
    finalBlockedTasks: finalCounts.blockedTasks,
    finalCompletedCount: finalCounts.completedCount,
    totalTasks: finalCounts.totalTasks,
    completionRate,
    deltaReady: finalCounts.readyTasks - initialCounts.readyTasks,
    deltaBlocked: finalCounts.blockedTasks - initialCounts.blockedTasks,
    deltaCompleted: finalCounts.completedCount - initialCounts.completedCount,
    headline: `Na ${steps.length} zetten: ${finalCounts.readyTasks} ready, ${finalCounts.blockedTasks} geblokkeerd, ${completionRate}% klaar`,
    nextMove,
  };
}

export function buildReadinessRunbookForecastReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const forecast = buildReadinessRunbookForecast(state, focus);

  return [
    reportName,
    'Go-live forecast 3 stappen',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    'Forecast:',
    ...(forecast.length > 0
      ? forecast.map(
          (step) =>
            `${step.order}. ${step.task.title}: open ${step.openTasks} | ready ${step.readyTasks} | geblokkeerd ${step.blockedTasks} | klaar ${step.completedCount}/${step.totalTasks} (${step.completionRate}%)`
        )
      : ['Geen forecast beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookForecastSummaryReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null,
  preferredFirstTaskId?: string | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const summary = buildReadinessRunbookForecastSummary(state, focus, preferredFirstTaskId);

  return [
    reportName,
    'Go-live forecast horizon',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(summary
      ? [
          summary.headline,
          `Nu: open ${summary.initialOpenTasks} | ready ${summary.initialReadyTasks} | geblokkeerd ${summary.initialBlockedTasks}`,
          `Na ${summary.stepsCount} zetten: open ${summary.finalOpenTasks} | ready ${summary.finalReadyTasks} | geblokkeerd ${summary.finalBlockedTasks}`,
          `Delta ready: ${summary.deltaReady >= 0 ? '+' : ''}${summary.deltaReady} | Delta geblokkeerd: ${summary.deltaBlocked} | Delta klaar: ${summary.deltaCompleted >= 0 ? '+' : ''}${summary.deltaCompleted}`,
          `Volgende zet daarna: ${summary.nextMove?.task.title ?? 'Geen extra zet beschikbaar'}`,
        ]
      : ['Geen forecast horizon beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioComparison(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioComparisonItem[] {
  const openingMoves = buildReadinessRunbookRecommendedMoves(state, focus).slice(0, 3);

  return openingMoves.flatMap((move) => {
    const summary = buildReadinessRunbookForecastSummary(state, focus, move.task.id);
    if (!summary) return [];
    const steps = simulateReadinessRunbookForecast(state, focus, 3, move.task.id).steps;
    return [
      {
        startingMove: move,
        summary,
        steps,
      },
    ];
  });
}

export function buildReadinessRunbookScenarioSignal(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioSignal | null {
  const scenarios = buildReadinessRunbookScenarioComparison(state, focus)
    .slice()
    .sort((left, right) => {
      if (right.summary.completionRate !== left.summary.completionRate) {
        return right.summary.completionRate - left.summary.completionRate;
      }
      if (right.summary.deltaCompleted !== left.summary.deltaCompleted) {
        return right.summary.deltaCompleted - left.summary.deltaCompleted;
      }
      if (right.summary.finalReadyTasks !== left.summary.finalReadyTasks) {
        return right.summary.finalReadyTasks - left.summary.finalReadyTasks;
      }
      if (left.summary.finalBlockedTasks !== right.summary.finalBlockedTasks) {
        return left.summary.finalBlockedTasks - right.summary.finalBlockedTasks;
      }
      return right.startingMove.score - left.startingMove.score;
    });

  const winner = scenarios[0] ?? null;
  if (!winner) return null;
  const challenger = scenarios[1] ?? null;
  const completionLead = winner.summary.completionRate - (challenger?.summary.completionRate ?? 0);
  const readyLead = winner.summary.finalReadyTasks - (challenger?.summary.finalReadyTasks ?? 0);
  const blockedLead = winner.summary.finalBlockedTasks - (challenger?.summary.finalBlockedTasks ?? 0);
  const completedLead = winner.summary.deltaCompleted - (challenger?.summary.deltaCompleted ?? 0);
  const closenessLabel = !challenger
    ? 'Solo'
    : Math.abs(completionLead) <= 2 && Math.abs(readyLead) <= 1 && Math.abs(blockedLead) <= 1
      ? 'Nek-aan-nek'
      : completionLead >= 5 || readyLead >= 2 || blockedLead <= -2
        ? 'Duidelijk voordeel'
        : 'Licht voordeel';

  const recurringMap = new Map<
    string,
    { task: ReadinessRunbookTask; hitCount: number }
  >();
  scenarios.forEach((scenario) => {
    const seen = new Set<string>();
    scenario.steps.forEach((step) => {
      if (seen.has(step.task.id)) return;
      seen.add(step.task.id);
      const existing = recurringMap.get(step.task.id);
      recurringMap.set(step.task.id, {
        task: step.task,
        hitCount: (existing?.hitCount ?? 0) + 1,
      });
    });
  });

  const recurringTasks = [...recurringMap.values()]
    .filter((item) => item.hitCount > 1)
    .sort((left, right) => {
      if (right.hitCount !== left.hitCount) return right.hitCount - left.hitCount;
      return left.task.title.localeCompare(right.task.title, 'nl-BE');
    })
    .slice(0, 3)
    .map((item) => ({
      task: item.task,
      phaseLabel: RUNBOOK_PHASE_LABELS[item.task.phase],
      hitCount: item.hitCount,
    }));

  const summary = challenger
    ? `${winner.startingMove.task.title} wint van ${challenger.startingMove.task.title} met ${completionLead >= 0 ? '+' : ''}${completionLead}% completion, ${readyLead >= 0 ? '+' : ''}${readyLead} ready en ${blockedLead} geblokkeerd verschil.`
    : `${winner.startingMove.task.title} is het enige geldige startsignaal in deze scope.`;

  return {
    winner,
    challenger,
    completionLead,
    readyLead,
    blockedLead,
    completedLead,
    closenessLabel,
    headline: `Beste start: ${winner.startingMove.task.title}`,
    summary,
    recurringTasks,
  };
}

export function buildReadinessRunbookScenarioConsensus(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioConsensus | null {
  const signal = buildReadinessRunbookScenarioSignal(state, focus);
  if (!signal?.winner) return null;

  const winnerSteps = signal.winner.steps;
  const challengerSteps = signal.challenger?.steps ?? [];
  const winnerIds = new Set(winnerSteps.map((step) => step.task.id));
  const challengerIds = new Set(challengerSteps.map((step) => step.task.id));

  const mapTasks = (steps: ReadinessRunbookForecastStep[]) =>
    steps.map((step) => ({
      task: step.task,
      phaseLabel: step.phaseLabel,
      hitCount: 1,
    }));

  const consensusTasks = signal.challenger
    ? winnerSteps
        .filter((step) => challengerIds.has(step.task.id))
        .map((step) => ({
          task: step.task,
          phaseLabel: step.phaseLabel,
          hitCount: 2,
        }))
    : mapTasks(winnerSteps);
  const winnerOnlyTasks = signal.challenger
    ? winnerSteps
        .filter((step) => !challengerIds.has(step.task.id))
        .map((step) => ({
          task: step.task,
          phaseLabel: step.phaseLabel,
          hitCount: 1,
        }))
    : [];
  const challengerOnlyTasks = signal.challenger
    ? challengerSteps
        .filter((step) => !winnerIds.has(step.task.id))
        .map((step) => ({
          task: step.task,
          phaseLabel: step.phaseLabel,
          hitCount: 1,
        }))
    : [];

  const summary = signal.challenger
    ? `${consensusTasks.length} taken komen in beide hoofdpaden terug. Winnaar-only: ${winnerOnlyTasks.length}. Uitdager-only: ${challengerOnlyTasks.length}.`
    : `${consensusTasks.length} taken vormen het enige geldige hoofdpaden in deze scope.`;

  return {
    winner: signal.winner,
    challenger: signal.challenger,
    consensusTasks,
    winnerOnlyTasks,
    challengerOnlyTasks,
    headline: signal.challenger
      ? `Consensus tussen ${signal.winner.startingMove.task.title} en ${signal.challenger.startingMove.task.title}`
      : `Consensus voor ${signal.winner.startingMove.task.title}`,
    summary,
  };
}

export function buildReadinessRunbookScenarioStability(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioStability | null {
  const signal = buildReadinessRunbookScenarioSignal(state, focus);
  const consensus = buildReadinessRunbookScenarioConsensus(state, focus);
  if (!signal || !consensus || !signal.winner) return null;

  const comparedTaskCount =
    consensus.consensusTasks.length +
    consensus.winnerOnlyTasks.length +
    consensus.challengerOnlyTasks.length;
  const overlapRate =
    comparedTaskCount > 0 ? Math.round((consensus.consensusTasks.length / comparedTaskCount) * 100) : 100;
  const divergenceCount = consensus.winnerOnlyTasks.length + consensus.challengerOnlyTasks.length;
  const leadStrength =
    Math.max(0, signal.completionLead) * 4 +
    Math.max(0, signal.readyLead) * 8 +
    Math.max(0, -signal.blockedLead) * 6;
  const confidenceScore = Math.max(
    0,
    Math.min(100, Math.round(overlapRate * 0.45 + leadStrength + (signal.challenger ? 0 : 20)))
  );
  const volatilityLabel =
    !signal.challenger
      ? 'Stabiel'
      : confidenceScore >= 75 && overlapRate >= 50
        ? 'Stabiel'
        : confidenceScore >= 50
          ? 'Gemengd'
          : 'Volatiel';
  const varianceTasks = [...consensus.winnerOnlyTasks, ...consensus.challengerOnlyTasks].slice(0, 4);
  const summary = signal.challenger
    ? `${signal.winner.startingMove.task.title} blijft voorop met ${confidenceScore}% scenariovertrouwen. Overlap ${overlapRate}%, verschilmakers ${divergenceCount}.`
    : `${signal.winner.startingMove.task.title} is het enige serieuze pad en krijgt ${confidenceScore}% scenariovertrouwen.`;

  return {
    confidenceScore,
    overlapRate,
    divergenceCount,
    volatilityLabel,
    headline: `Scenario-stabiliteit: ${volatilityLabel}`,
    summary,
    winner: signal.winner,
    challenger: signal.challenger,
    varianceTasks,
  };
}

export function buildReadinessRunbookScenarioPlaybook(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioPlaybook | null {
  const signal = buildReadinessRunbookScenarioSignal(state, focus);
  const consensus = buildReadinessRunbookScenarioConsensus(state, focus);
  const stability = buildReadinessRunbookScenarioStability(state, focus);
  if (!signal?.winner || !consensus || !stability) return null;

  const mustDoTasks = consensus.consensusTasks.slice(0, 3);
  const chooseTasks = consensus.winnerOnlyTasks.slice(0, 3);
  const watchTasks = (
    signal.challenger
      ? [...consensus.challengerOnlyTasks, ...stability.varianceTasks]
      : [...stability.varianceTasks]
  )
    .filter((item, index, list) => list.findIndex((candidate) => candidate.task.id === item.task.id) === index)
    .slice(0, 3);

  const summary = signal.challenger
    ? `${signal.winner.startingMove.task.title} blijft de voorkeursroute. Eerst de consensus zetten, daarna de winnaar-only keuzes, en bewaak de afwijkers uit het uitdagerpad.`
    : `${signal.winner.startingMove.task.title} is het enige serieuze pad. Voer de vaste zetten uit en bewaak de resterende afwijkers.`;

  return {
    headline: `Scenario-playbook voor ${signal.winner.startingMove.task.title}`,
    summary,
    winner: signal.winner,
    mustDoTasks,
    chooseTasks,
    watchTasks,
  };
}

export function buildReadinessRunbookScenarioCheckpoint(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioCheckpoint | null {
  const signal = buildReadinessRunbookScenarioSignal(state, focus);
  if (!signal?.winner) return null;

  const winnerSteps = signal.winner.steps;
  const challengerSteps = signal.challenger?.steps ?? [];
  const prefix: ReadinessRunbookScenarioConsensusTask[] = [];
  const maxShared = Math.min(winnerSteps.length, challengerSteps.length);
  let forkStep: number | null = null;

  for (let index = 0; index < maxShared; index += 1) {
    const winnerStep = winnerSteps[index];
    const challengerStep = challengerSteps[index];
    if (winnerStep.task.id !== challengerStep.task.id) {
      forkStep = index + 1;
      break;
    }
    prefix.push({
      task: winnerStep.task,
      phaseLabel: winnerStep.phaseLabel,
      hitCount: 2,
    });
  }

  if (forkStep === null && signal.challenger && winnerSteps.length !== challengerSteps.length) {
    forkStep = prefix.length + 1;
  }

  const winnerNextStep = winnerSteps[prefix.length] ?? null;
  const challengerNextStep = challengerSteps[prefix.length] ?? null;
  const winnerNext = winnerNextStep
    ? {
        task: winnerNextStep.task,
        phaseLabel: winnerNextStep.phaseLabel,
        hitCount: 1,
      }
    : null;
  const challengerNext = challengerNextStep
    ? {
        task: challengerNextStep.task,
        phaseLabel: challengerNextStep.phaseLabel,
        hitCount: 1,
      }
    : null;

  const summary = signal.challenger
    ? prefix.length > 0
      ? `Beide paden lopen ${prefix.length} stap(pen) gelijk. De echte keuze valt vanaf stap ${forkStep ?? prefix.length + 1}.`
      : `De paden wijken meteen af vanaf stap ${forkStep ?? 1}.`
    : 'Er is maar één serieus pad, dus er is geen echte scenariovork.';

  return {
    winner: signal.winner,
    challenger: signal.challenger,
    sharedPrefix: prefix,
    winnerNext,
    challengerNext,
    forkStep,
    headline: signal.challenger
      ? `Scenario forkpoint op stap ${forkStep ?? prefix.length + 1}`
      : `Scenario checkpoint voor ${signal.winner.startingMove.task.title}`,
    summary,
  };
}

export function buildReadinessRunbookScenarioPhaseMap(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioPhaseMap | null {
  const consensus = buildReadinessRunbookScenarioConsensus(state, focus);
  if (!consensus?.winner) return null;

  const phaseStats = new Map<
    ReadinessRunbookPhase,
    { phase: ReadinessRunbookPhase; label: string; sharedCount: number; winnerOnlyCount: number; challengerOnlyCount: number }
  >();

  const ensurePhase = (phase: ReadinessRunbookPhase) => {
    const existing = phaseStats.get(phase);
    if (existing) return existing;
    const created = {
      phase,
      label: RUNBOOK_PHASE_LABELS[phase],
      sharedCount: 0,
      winnerOnlyCount: 0,
      challengerOnlyCount: 0,
    };
    phaseStats.set(phase, created);
    return created;
  };

  consensus.consensusTasks.forEach((item) => {
    ensurePhase(item.task.phase).sharedCount += 1;
  });
  consensus.winnerOnlyTasks.forEach((item) => {
    ensurePhase(item.task.phase).winnerOnlyCount += 1;
  });
  consensus.challengerOnlyTasks.forEach((item) => {
    ensurePhase(item.task.phase).challengerOnlyCount += 1;
  });

  const items = [...phaseStats.values()]
    .map((item) => {
      const totalCount = item.sharedCount + item.winnerOnlyCount + item.challengerOnlyCount;
      const divergence = item.winnerOnlyCount + item.challengerOnlyCount;
      const statusLabel =
        divergence === 0
          ? 'Stabiel'
          : item.sharedCount > 0
            ? 'Gemengd'
            : item.winnerOnlyCount > 0 && item.challengerOnlyCount > 0
              ? 'Split'
              : item.winnerOnlyCount > 0
                ? 'Winnaar-rand'
                : 'Uitdager-rand';
      return {
        ...item,
        totalCount,
        statusLabel,
      };
    })
    .sort((left, right) => {
      const leftDivergence = left.winnerOnlyCount + left.challengerOnlyCount;
      const rightDivergence = right.winnerOnlyCount + right.challengerOnlyCount;
      if (rightDivergence !== leftDivergence) return rightDivergence - leftDivergence;
      if (right.sharedCount !== left.sharedCount) return right.sharedCount - left.sharedCount;
      return left.label.localeCompare(right.label, 'nl-BE');
    });

  const splitCount = items.filter((item) => item.statusLabel === 'Split' || item.statusLabel === 'Gemengd').length;
  const stableCount = items.filter((item) => item.statusLabel === 'Stabiel').length;

  return {
    headline: 'Scenario-fasebeeld',
    summary: `${stableCount} stabiel, ${splitCount} onder spanning. Daardoor zie je meteen in welke go-livefase de routes nog gelijk lopen en waar ze uiteen trekken.`,
    items,
  };
}

export function buildReadinessRunbookScenarioRiskBoard(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioRiskBoard | null {
  const consensus = buildReadinessRunbookScenarioConsensus(state, focus);
  const stability = buildReadinessRunbookScenarioStability(state, focus);
  const checkpoint = buildReadinessRunbookScenarioCheckpoint(state, focus);
  const playbook = buildReadinessRunbookScenarioPlaybook(state, focus);
  const dependencyMap = buildReadinessRunbookDependencyMap(state, focus);

  if (!consensus || !stability || !checkpoint || !playbook) return null;

  const byTask = new Map<
    string,
    {
      task: ReadinessRunbookTask;
      score: number;
      reasons: Set<string>;
    }
  >();

  const addRisk = (task: ReadinessRunbookTask | null | undefined, score: number, reason: string) => {
    if (!task) return;
    const existing = byTask.get(task.id) ?? {
      task,
      score: 0,
      reasons: new Set<string>(),
    };
    existing.score += score;
    existing.reasons.add(reason);
    byTask.set(task.id, existing);
  };

  consensus.challengerOnlyTasks.forEach((item) => addRisk(item.task, 3, 'Uitdager-only pad'));
  stability.varianceTasks.forEach((item) => addRisk(item.task, 3, 'Hoge variatie tussen paden'));
  playbook.watchTasks.forEach((item) => addRisk(item.task, 2, 'Bewaken in playbook'));
  playbook.chooseTasks.forEach((item) => addRisk(item.task, 1, 'Keuzezet in winpad'));
  addRisk(checkpoint.winnerNext?.task, 1, 'Winnende zet na de vork');
  addRisk(checkpoint.challengerNext?.task, 2, 'Uitdagerzet na de vork');

  const items = [...byTask.values()]
    .map((item) => {
      const dependency = dependencyMap.find((entry) => entry.task.id === item.task.id);
      const status = dependency?.status ?? 'ready';
      const statusLabel = status === 'done' ? 'Klaar' : status === 'blocked' ? 'Geblokkeerd' : 'Ready';
      const riskScore = item.score + (status === 'blocked' ? 2 : status === 'ready' ? 1 : 0);
      return {
        task: item.task,
        phaseLabel: RUNBOOK_PHASE_LABELS[item.task.phase],
        status,
        statusLabel,
        riskScore,
        reasons: [...item.reasons],
      } satisfies ReadinessRunbookScenarioRiskItem;
    })
    .sort((left, right) => {
      if (right.riskScore !== left.riskScore) return right.riskScore - left.riskScore;
      if (left.status !== right.status) {
        const leftPriority = left.status === 'blocked' ? 2 : left.status === 'ready' ? 1 : 0;
        const rightPriority = right.status === 'blocked' ? 2 : right.status === 'ready' ? 1 : 0;
        return rightPriority - leftPriority;
      }
      return left.task.title.localeCompare(right.task.title, 'nl-BE');
    })
    .slice(0, 5);

  if (items.length === 0) return null;

  return {
    headline: 'Scenario-risicobord',
    summary: `${items.length} scenariorisico's vragen extra aandacht. Hoogste risico: ${items[0]?.task.title ?? 'geen'} (${items[0]?.riskScore ?? 0}).`,
    items,
  };
}

export function buildReadinessRunbookScenarioBriefing(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioBriefing | null {
  const signal = buildReadinessRunbookScenarioSignal(state, focus);
  const consensus = buildReadinessRunbookScenarioConsensus(state, focus);
  const stability = buildReadinessRunbookScenarioStability(state, focus);
  const playbook = buildReadinessRunbookScenarioPlaybook(state, focus);
  const checkpoint = buildReadinessRunbookScenarioCheckpoint(state, focus);
  const phaseMap = buildReadinessRunbookScenarioPhaseMap(state, focus);
  const riskBoard = buildReadinessRunbookScenarioRiskBoard(state, focus);

  if (!signal || !consensus || !stability || !playbook || !checkpoint || !phaseMap || !riskBoard) {
    return null;
  }

  const phaseHotspot =
    phaseMap.items
      .slice()
      .sort((left, right) => {
        const leftSplit = left.winnerOnlyCount + left.challengerOnlyCount;
        const rightSplit = right.winnerOnlyCount + right.challengerOnlyCount;
        if (rightSplit !== leftSplit) return rightSplit - leftSplit;
        if (right.totalCount !== left.totalCount) return right.totalCount - left.totalCount;
        return left.label.localeCompare(right.label, 'nl-BE');
      })[0] ?? null;

  const topRisk = riskBoard.items[0] ?? null;
  const nextAction = signal.winner?.startingMove.task ?? null;
  const forkLabel = checkpoint.forkStep ? `fork op zet ${checkpoint.forkStep}` : 'geen vroege vork';
  const riskLabel = topRisk ? `${topRisk.task.title} (${topRisk.statusLabel.toLowerCase()})` : 'geen top-risico';
  const hotspotLabel = phaseHotspot ? phaseHotspot.label : 'geen fase-hotspot';

  return {
    headline: nextAction ? `Start met ${nextAction.title}` : 'Scenario-briefing',
    summary: `${stability.volatilityLabel} scenario met ${forkLabel}. Hotspot: ${hotspotLabel}. Top-risico: ${riskLabel}.`,
    winner: signal.winner,
    challenger: signal.challenger,
    topRisk,
    phaseHotspot,
    forkStep: checkpoint.forkStep,
    volatilityLabel: stability.volatilityLabel,
    confidenceScore: stability.confidenceScore,
    consensusCount: consensus.consensusTasks.length,
    mustDoCount: playbook.mustDoTasks.length,
    chooseCount: playbook.chooseTasks.length,
    watchCount: playbook.watchTasks.length,
    nextAction,
  };
}

export function buildReadinessRunbookScenarioRouteBoard(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioRouteBoard | null {
  const signal = buildReadinessRunbookScenarioSignal(state, focus);
  const checkpoint = buildReadinessRunbookScenarioCheckpoint(state, focus);
  if (!signal?.winner) return null;

  const winnerSteps = signal.winner.steps;
  const challengerSteps = signal.challenger?.steps ?? [];
  const rowCount = Math.max(winnerSteps.length, challengerSteps.length);
  if (rowCount === 0) return null;

  let sharedCount = 0;
  let divergingCount = 0;

  const rows = Array.from({ length: rowCount }, (_, index) => {
    const winnerStep = winnerSteps[index] ?? null;
    const challengerStep = challengerSteps[index] ?? null;

    let relation: ReadinessRunbookScenarioRouteBoardRow['relation'] = 'shared';
    let relationLabel = 'Gedeeld';

    if (winnerStep && challengerStep && winnerStep.task.id === challengerStep.task.id) {
      relation = 'shared';
      relationLabel = 'Gedeeld';
      sharedCount += 1;
    } else if (winnerStep && challengerStep) {
      relation = 'fork';
      relationLabel = checkpoint?.forkStep === index + 1 ? `Fork ${index + 1}` : 'Split';
      divergingCount += 1;
    } else if (winnerStep) {
      relation = 'winner-only';
      relationLabel = 'Alleen winnaar';
      divergingCount += 1;
    } else {
      relation = 'challenger-only';
      relationLabel = 'Alleen uitdager';
      divergingCount += 1;
    }

    return {
      order: index + 1,
      winnerTask: winnerStep?.task ?? null,
      challengerTask: challengerStep?.task ?? null,
      winnerPhaseLabel: winnerStep ? RUNBOOK_PHASE_LABELS[winnerStep.task.phase] : null,
      challengerPhaseLabel: challengerStep ? RUNBOOK_PHASE_LABELS[challengerStep.task.phase] : null,
      relation,
      relationLabel,
      focusTask: winnerStep?.task ?? challengerStep?.task ?? null,
    } satisfies ReadinessRunbookScenarioRouteBoardRow;
  }).slice(0, 6);

  return {
    headline: `Winpad ${signal.winner.startingMove.task.title} vs ${signal.challenger?.startingMove.task.title ?? 'geen uitdager'}`,
    summary: `${sharedCount} gedeelde zetten, ${divergingCount} afwijkende rijen${checkpoint?.forkStep ? `, fork op zet ${checkpoint.forkStep}` : ''}.`,
    rows,
    sharedCount,
    divergingCount,
    forkStep: checkpoint?.forkStep ?? null,
  };
}

export function buildReadinessRunbookScenarioDecisionBoard(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioDecisionBoard | null {
  const signal = buildReadinessRunbookScenarioSignal(state, focus);
  const checkpoint = buildReadinessRunbookScenarioCheckpoint(state, focus);
  const stability = buildReadinessRunbookScenarioStability(state, focus);
  if (!signal?.winner || !checkpoint || !stability) return null;

  const winnerSteps = signal.winner.steps;
  const challengerSteps = signal.challenger?.steps ?? [];
  const mapStep = (step: ReadinessRunbookForecastStep | undefined | null) =>
    step
      ? ({
          task: step.task,
          phaseLabel: RUNBOOK_PHASE_LABELS[step.task.phase],
          hitCount: 1,
        } satisfies ReadinessRunbookScenarioConsensusTask)
      : null;

  const forkIndex = checkpoint.forkStep ? checkpoint.forkStep - 1 : checkpoint.sharedPrefix.length;
  const winnerAfterStart = checkpoint.winnerNext ? forkIndex + 1 : forkIndex;
  const challengerAfterStart = checkpoint.challengerNext ? forkIndex + 1 : forkIndex;

  const winnerAfter = winnerSteps
    .slice(winnerAfterStart)
    .map((step) => mapStep(step))
    .filter((item): item is ReadinessRunbookScenarioConsensusTask => Boolean(item))
    .slice(0, 3);
  const challengerAfter = challengerSteps
    .slice(challengerAfterStart)
    .map((step) => mapStep(step))
    .filter((item): item is ReadinessRunbookScenarioConsensusTask => Boolean(item))
    .slice(0, 3);

  return {
    headline: `Keuze na ${checkpoint.sharedPrefix.length} zekere zet${checkpoint.sharedPrefix.length === 1 ? '' : 'ten'}`,
    summary: `${stability.volatilityLabel} keuze met ${checkpoint.forkStep ? `fork op zet ${checkpoint.forkStep}` : 'geen harde vroege vork'}. Daarna ${checkpoint.winnerNext?.task.title ?? 'geen winzet'} vs ${checkpoint.challengerNext?.task.title ?? 'geen uitdagerzet'}.`,
    preForkTasks: checkpoint.sharedPrefix.slice(0, 4),
    winnerDecision: checkpoint.winnerNext,
    challengerDecision: checkpoint.challengerNext,
    winnerAfter,
    challengerAfter,
    forkStep: checkpoint.forkStep,
    volatilityLabel: stability.volatilityLabel,
    confidenceScore: stability.confidenceScore,
  };
}

export function buildReadinessRunbookScenarioCommitBoard(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioCommitBoard | null {
  const briefing = buildReadinessRunbookScenarioBriefing(state, focus);
  const decisionBoard = buildReadinessRunbookScenarioDecisionBoard(state, focus);
  const riskBoard = buildReadinessRunbookScenarioRiskBoard(state, focus);
  const stability = buildReadinessRunbookScenarioStability(state, focus);

  if (!briefing || !decisionBoard || !riskBoard || !stability) return null;

  let decisionStatusLabel = 'Eerst bewaken';
  let decisionTone: ReadinessRunbookScenarioCommitBoard['decisionTone'] = 'danger';

  if (!decisionBoard.challengerDecision?.task || (stability.confidenceScore >= 75 && stability.volatilityLabel === 'Stabiel')) {
    decisionStatusLabel = 'Commit klaar';
    decisionTone = 'success';
  } else if (stability.confidenceScore >= 55 || Boolean(decisionBoard.forkStep)) {
    decisionStatusLabel = 'Beslis nu';
    decisionTone = 'warning';
  } else {
    decisionStatusLabel = 'Eerst bewaken';
    decisionTone = 'danger';
  }

  const guardrailTask = riskBoard.items[0]?.task ?? null;
  const commitTask = decisionBoard.winnerDecision?.task ?? briefing.nextAction;
  const fallbackTask = decisionBoard.challengerDecision?.task ?? null;

  const openQuestions = [
    guardrailTask ? `Bewaak ${guardrailTask.title} als hoofd-risico.` : null,
    briefing.phaseHotspot ? `Hou extra zicht op fase ${briefing.phaseHotspot.label}.` : null,
    fallbackTask ? `Bevestig of fallback ${fallbackTask.title} nog levensvatbaar blijft.` : null,
    stability.confidenceScore < 60 ? 'Vertrouwensscore is nog te laag voor een harde keuze.' : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 3);

  return {
    headline: commitTask ? `Commit op ${commitTask.title}` : 'Scenario-commit',
    summary: `${decisionStatusLabel}: ${commitTask?.title ?? 'geen winzet'}${fallbackTask ? ` met fallback ${fallbackTask.title}` : ''}${guardrailTask ? ` en guardrail ${guardrailTask.title}` : ''}.`,
    decisionStatusLabel,
    decisionTone,
    confidenceScore: stability.confidenceScore,
    forkStep: decisionBoard.forkStep,
    commitTask,
    fallbackTask,
    guardrailTask,
    openQuestions,
  };
}

export function buildReadinessRunbookScenarioMonitorBoard(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioMonitorBoard | null {
  const commitBoard = buildReadinessRunbookScenarioCommitBoard(state, focus);
  const decisionBoard = buildReadinessRunbookScenarioDecisionBoard(state, focus);
  const routeBoard = buildReadinessRunbookScenarioRouteBoard(state, focus);
  const riskBoard = buildReadinessRunbookScenarioRiskBoard(state, focus);

  if (!commitBoard || !decisionBoard || !routeBoard || !riskBoard) return null;

  const firstDeviation = routeBoard.rows.find((row) => row.relation === 'fork' || row.relation === 'challenger-only');
  const activeItems = [
    commitBoard.guardrailTask
      ? {
          label: 'Guardrail',
          task: commitBoard.guardrailTask,
          detail: 'Hoofdrisico dat je actief moet bewaken tijdens uitvoering.',
          tone: 'danger',
        }
      : null,
    commitBoard.fallbackTask
      ? {
          label: 'Fallback',
          task: commitBoard.fallbackTask,
          detail: 'Fallback die je warm houdt als het winpad onder druk komt.',
          tone: 'warning',
        }
      : null,
    decisionBoard.winnerAfter[0]
      ? {
          label: 'Volgende winstap',
          task: decisionBoard.winnerAfter[0].task,
          detail: 'Eerste stap die direct na commit klaarstaat.',
          tone: 'accent',
        }
      : null,
    firstDeviation?.focusTask
      ? {
          label: 'Afwijkpunt',
          task: firstDeviation.focusTask,
          detail: 'Punt waar het pad nog kan afwijken en dus aandacht vraagt.',
          tone: 'warning',
        }
      : null,
  ].filter((item): item is ReadinessRunbookScenarioMonitorItem => Boolean(item)).slice(0, 4);

  const openQuestions = [
    ...commitBoard.openQuestions,
    riskBoard.items[1] ? `Tweede risico blijft ${riskBoard.items[1].task.title}.` : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const monitorStatusLabel =
    commitBoard.decisionTone === 'success'
      ? 'Monitor actief'
      : commitBoard.decisionTone === 'warning'
        ? 'Monitor scherp'
        : 'Monitor kritisch';
  const monitorTone =
    commitBoard.decisionTone === 'success'
      ? 'accent'
      : commitBoard.decisionTone === 'warning'
        ? 'warning'
        : 'danger';

  return {
    headline: `Monitor naast ${commitBoard.commitTask?.title ?? 'je winpad'}`,
    summary: `${monitorStatusLabel}: ${activeItems.length} monitorpunten naast commit, fallback en risico.`,
    monitorStatusLabel,
    monitorTone,
    activeItems,
    openQuestions,
  };
}

export function buildReadinessRunbookScenarioActionBoard(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioActionBoard | null {
  const commitBoard = buildReadinessRunbookScenarioCommitBoard(state, focus);
  const decisionBoard = buildReadinessRunbookScenarioDecisionBoard(state, focus);
  const playbook = buildReadinessRunbookScenarioPlaybook(state, focus);
  const monitorBoard = buildReadinessRunbookScenarioMonitorBoard(state, focus);

  if (!commitBoard || !decisionBoard || !playbook || !monitorBoard) return null;

  const toConsensusTask = (task: ReadinessRunbookTask | null | undefined) =>
    task
      ? ({
          task,
          phaseLabel: RUNBOOK_PHASE_LABELS[task.phase],
          hitCount: 1,
        } satisfies ReadinessRunbookScenarioConsensusTask)
      : null;

  const dedupe = (items: Array<ReadinessRunbookScenarioConsensusTask | null>) =>
    items.filter((item): item is ReadinessRunbookScenarioConsensusTask => Boolean(item)).filter(
      (item, index, list) => list.findIndex((candidate) => candidate.task.id === item.task.id) === index
    );

  const immediateTasks = dedupe([
    toConsensusTask(commitBoard.commitTask),
    ...playbook.mustDoTasks,
    ...decisionBoard.winnerAfter.slice(0, 1),
  ]).slice(0, 4);

  const fallbackTasks = dedupe([
    toConsensusTask(commitBoard.fallbackTask),
    decisionBoard.challengerAfter[0] ?? null,
  ]).slice(0, 3);

  const verifyTasks = dedupe([
    toConsensusTask(commitBoard.guardrailTask),
    ...monitorBoard.activeItems.map((item) => toConsensusTask(item.task)),
  ]).slice(0, 4);

  const actionStatusLabel =
    commitBoard.decisionTone === 'success'
      ? 'Uitvoer klaar'
      : commitBoard.decisionTone === 'warning'
        ? 'Voorzichtig uitvoeren'
        : 'Nog niet forceren';
  const actionTone = commitBoard.decisionTone;

  return {
    headline: `Actiebord voor ${commitBoard.commitTask?.title ?? 'het winpad'}`,
    summary: `${actionStatusLabel}: ${immediateTasks.length} directe stappen, ${fallbackTasks.length} fallbackstappen en ${verifyTasks.length} verificaties.`,
    actionStatusLabel,
    actionTone,
    confidenceScore: commitBoard.confidenceScore,
    immediateTasks,
    fallbackTasks,
    verifyTasks,
  };
}

export function buildReadinessRunbookScenarioHandoverBoard(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioHandoverBoard | null {
  const commitBoard = buildReadinessRunbookScenarioCommitBoard(state, focus);
  const actionBoard = buildReadinessRunbookScenarioActionBoard(state, focus);
  const monitorBoard = buildReadinessRunbookScenarioMonitorBoard(state, focus);
  const riskBoard = buildReadinessRunbookScenarioRiskBoard(state, focus);

  if (!commitBoard || !actionBoard || !monitorBoard || !riskBoard) return null;

  const toConsensusTask = (task: ReadinessRunbookTask | null | undefined) =>
    task
      ? ({
          task,
          phaseLabel: RUNBOOK_PHASE_LABELS[task.phase],
          hitCount: 1,
        } satisfies ReadinessRunbookScenarioConsensusTask)
      : null;

  const dedupe = (items: Array<ReadinessRunbookScenarioConsensusTask | null>) =>
    items.filter((item): item is ReadinessRunbookScenarioConsensusTask => Boolean(item)).filter(
      (item, index, list) => list.findIndex((candidate) => candidate.task.id === item.task.id) === index
    );

  const nowTasks = dedupe([
    ...actionBoard.immediateTasks,
    toConsensusTask(commitBoard.commitTask),
  ]).slice(0, 4);

  const watchTasks = dedupe([
    ...actionBoard.verifyTasks,
    ...monitorBoard.activeItems
      .filter((item) => item.tone === 'warning' || item.tone === 'accent')
      .map((item) => toConsensusTask(item.task)),
  ]).slice(0, 4);

  const escalateTasks = dedupe([
    toConsensusTask(commitBoard.guardrailTask),
    toConsensusTask(commitBoard.fallbackTask),
    toConsensusTask(riskBoard.items[0]?.task),
    toConsensusTask(riskBoard.items[1]?.task),
  ]).slice(0, 4);

  let handoverStatusLabel = 'Nog vasthouden';
  let handoverTone: ReadinessRunbookScenarioHandoverBoard['handoverTone'] = 'danger';
  let ownerLabel = 'Scenario blijft nog bij regie';

  if (commitBoard.decisionTone === 'success') {
    handoverStatusLabel = 'Overdracht klaar';
    handoverTone = 'success';
    ownerLabel = 'Nu naar uitvoering met lichte bewaking';
  } else if (commitBoard.decisionTone === 'warning') {
    handoverStatusLabel = 'Overdracht met vangrails';
    handoverTone = 'warning';
    ownerLabel = 'Beslissing en uitvoering lopen nog samen';
  } else if (watchTasks.length > 0) {
    handoverStatusLabel = 'Voorbereiden op overdracht';
    handoverTone = 'accent';
    ownerLabel = 'Regie houdt de route vast tot bewaking scherp staat';
  }

  return {
    headline: `Handover voor ${commitBoard.commitTask?.title ?? 'het winpad'}`,
    summary: `${handoverStatusLabel}: ${nowTasks.length} nu doorzetten, ${watchTasks.length} bewaken en ${escalateTasks.length} escaleren als het pad schuift.`,
    handoverStatusLabel,
    handoverTone,
    ownerLabel,
    confidenceScore: commitBoard.confidenceScore,
    nowTasks,
    watchTasks,
    escalateTasks,
  };
}

export function buildReadinessRunbookScenarioEscalationBoard(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioEscalationBoard | null {
  const commitBoard = buildReadinessRunbookScenarioCommitBoard(state, focus);
  const handoverBoard = buildReadinessRunbookScenarioHandoverBoard(state, focus);
  const monitorBoard = buildReadinessRunbookScenarioMonitorBoard(state, focus);
  const riskBoard = buildReadinessRunbookScenarioRiskBoard(state, focus);

  if (!commitBoard || !handoverBoard || !monitorBoard || !riskBoard) return null;

  const toConsensusTask = (task: ReadinessRunbookTask | null | undefined) =>
    task
      ? ({
          task,
          phaseLabel: RUNBOOK_PHASE_LABELS[task.phase],
          hitCount: 1,
        } satisfies ReadinessRunbookScenarioConsensusTask)
      : null;

  const dedupe = (items: Array<ReadinessRunbookScenarioConsensusTask | null>) =>
    items.filter((item): item is ReadinessRunbookScenarioConsensusTask => Boolean(item)).filter(
      (item, index, list) => list.findIndex((candidate) => candidate.task.id === item.task.id) === index
    );

  const urgentTasks = dedupe([
    ...handoverBoard.escalateTasks,
    toConsensusTask(riskBoard.items[0]?.task),
    toConsensusTask(riskBoard.items[1]?.task),
  ]).slice(0, 4);

  const fallbackTasks = dedupe([
    toConsensusTask(commitBoard.fallbackTask),
    toConsensusTask(commitBoard.guardrailTask),
    ...handoverBoard.watchTasks.slice(0, 2),
  ]).slice(0, 4);

  const triggerQuestions = [
    urgentTasks[0] ? `Escaleren als ${urgentTasks[0].task.title} verder blokkeert.` : null,
    commitBoard.fallbackTask ? `Fallback ${commitBoard.fallbackTask.title} activeren als het winpad kantelt.` : null,
    monitorBoard.activeItems[0]?.task ? `Monitor ${monitorBoard.activeItems[0].task.title} op afwijking van het winpad.` : null,
    commitBoard.confidenceScore < 60 ? 'Vertrouwensscore blijft te laag voor stille uitvoering.' : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  let escalationStatusLabel = 'Escalatie laag';
  let escalationTone: ReadinessRunbookScenarioEscalationBoard['escalationTone'] = 'accent';

  if (urgentTasks.length >= 3 || commitBoard.decisionTone === 'danger') {
    escalationStatusLabel = 'Escaleren als trigger raakt';
    escalationTone = 'danger';
  } else if (urgentTasks.length > 0 || commitBoard.decisionTone === 'warning') {
    escalationStatusLabel = 'Escalatie paraat';
    escalationTone = 'warning';
  } else {
    escalationStatusLabel = 'Escalatie beperkt';
    escalationTone = 'success';
  }

  return {
    headline: `Escalatiepad voor ${commitBoard.commitTask?.title ?? 'het winpad'}`,
    summary: `${escalationStatusLabel}: ${urgentTasks.length} urgente punten, ${fallbackTasks.length} vangrails en ${triggerQuestions.length} actieve triggers.`,
    escalationStatusLabel,
    escalationTone,
    confidenceScore: commitBoard.confidenceScore,
    urgentTasks,
    fallbackTasks,
    triggerQuestions,
  };
}

export function buildReadinessRunbookScenarioRollbackBoard(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioRollbackBoard | null {
  const commitBoard = buildReadinessRunbookScenarioCommitBoard(state, focus);
  const escalationBoard = buildReadinessRunbookScenarioEscalationBoard(state, focus);
  const handoverBoard = buildReadinessRunbookScenarioHandoverBoard(state, focus);
  const riskBoard = buildReadinessRunbookScenarioRiskBoard(state, focus);

  if (!commitBoard || !escalationBoard || !handoverBoard || !riskBoard) return null;

  const toConsensusTask = (task: ReadinessRunbookTask | null | undefined) =>
    task
      ? ({
          task,
          phaseLabel: RUNBOOK_PHASE_LABELS[task.phase],
          hitCount: 1,
        } satisfies ReadinessRunbookScenarioConsensusTask)
      : null;

  const dedupe = (items: Array<ReadinessRunbookScenarioConsensusTask | null>) =>
    items.filter((item): item is ReadinessRunbookScenarioConsensusTask => Boolean(item)).filter(
      (item, index, list) => list.findIndex((candidate) => candidate.task.id === item.task.id) === index
    );

  const rollbackTask = commitBoard.fallbackTask ?? escalationBoard.fallbackTasks[0]?.task ?? null;
  const safeTasks = dedupe([
    toConsensusTask(rollbackTask),
    ...escalationBoard.fallbackTasks.slice(0, 2),
  ]).slice(0, 4);
  const holdTasks = dedupe([
    ...handoverBoard.watchTasks.slice(0, 2),
    toConsensusTask(commitBoard.guardrailTask),
    toConsensusTask(riskBoard.items[0]?.task),
  ]).slice(0, 4);

  const rollbackSignals = [
    escalationBoard.urgentTasks[0] ? `${escalationBoard.urgentTasks[0].task.title} blijft escaleren.` : null,
    rollbackTask ? `Val terug op ${rollbackTask.title} als het winpad breekt.` : null,
    commitBoard.guardrailTask ? `${commitBoard.guardrailTask.title} raakt de guardrail.` : null,
    commitBoard.confidenceScore < 55 ? 'Vertrouwensscore zakt onder veilige uitvoer.' : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  let rollbackStatusLabel = 'Rollback achter de hand';
  let rollbackTone: ReadinessRunbookScenarioRollbackBoard['rollbackTone'] = 'accent';

  if (commitBoard.decisionTone === 'danger' || escalationBoard.escalationTone === 'danger') {
    rollbackStatusLabel = 'Rollback gereed';
    rollbackTone = 'danger';
  } else if (commitBoard.decisionTone === 'warning' || escalationBoard.urgentTasks.length > 0) {
    rollbackStatusLabel = 'Rollback paraat';
    rollbackTone = 'warning';
  } else {
    rollbackStatusLabel = 'Rollback laag risico';
    rollbackTone = 'success';
  }

  return {
    headline: `Rollbackpad voor ${commitBoard.commitTask?.title ?? 'het winpad'}`,
    summary: `${rollbackStatusLabel}: ${safeTasks.length} veilige terugvalstappen, ${holdTasks.length} dingen om vast te houden en ${rollbackSignals.length} rollbacksignalen.`,
    rollbackStatusLabel,
    rollbackTone,
    confidenceScore: commitBoard.confidenceScore,
    rollbackTask,
    safeTasks,
    holdTasks,
    rollbackSignals,
  };
}

export function buildReadinessRunbookScenarioRecoveryBoard(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioRecoveryBoard | null {
  const commitBoard = buildReadinessRunbookScenarioCommitBoard(state, focus);
  const handoverBoard = buildReadinessRunbookScenarioHandoverBoard(state, focus);
  const rollbackBoard = buildReadinessRunbookScenarioRollbackBoard(state, focus);
  const actionBoard = buildReadinessRunbookScenarioActionBoard(state, focus);

  if (!commitBoard || !handoverBoard || !rollbackBoard || !actionBoard) return null;

  const toConsensusTask = (task: ReadinessRunbookTask | null | undefined) =>
    task
      ? ({
          task,
          phaseLabel: RUNBOOK_PHASE_LABELS[task.phase],
          hitCount: 1,
        } satisfies ReadinessRunbookScenarioConsensusTask)
      : null;

  const dedupe = (items: Array<ReadinessRunbookScenarioConsensusTask | null>) =>
    items.filter((item): item is ReadinessRunbookScenarioConsensusTask => Boolean(item)).filter(
      (item, index, list) => list.findIndex((candidate) => candidate.task.id === item.task.id) === index
    );

  const resumeTask = commitBoard.commitTask ?? actionBoard.immediateTasks[0]?.task ?? null;

  const stabilizeTasks = dedupe([
    ...rollbackBoard.safeTasks.slice(0, 2),
    ...handoverBoard.watchTasks.slice(0, 2),
  ]).slice(0, 4);

  const rebuildTasks = dedupe([
    toConsensusTask(resumeTask),
    ...actionBoard.immediateTasks.slice(0, 2),
    ...actionBoard.verifyTasks.slice(0, 1),
  ]).slice(0, 4);

  const recoveryChecks = [
    rollbackBoard.rollbackSignals[0] ? `Check of ${rollbackBoard.rollbackSignals[0]}` : null,
    resumeTask ? `Hervat via ${resumeTask.title} zodra het pad weer stabiel is.` : null,
    handoverBoard.watchTasks[0] ? `${handoverBoard.watchTasks[0].task.title} moet eerst terug stabiel zijn.` : null,
    commitBoard.confidenceScore < 60 ? 'Vertrouwensscore moet eerst terug boven veilige grens klimmen.' : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  let recoveryStatusLabel = 'Herstel rustig opbouwen';
  let recoveryTone: ReadinessRunbookScenarioRecoveryBoard['recoveryTone'] = 'accent';

  if (rollbackBoard.rollbackTone === 'danger') {
    recoveryStatusLabel = 'Eerst stabiliseren';
    recoveryTone = 'danger';
  } else if (rollbackBoard.rollbackTone === 'warning' || handoverBoard.handoverTone === 'warning') {
    recoveryStatusLabel = 'Herstel gefaseerd';
    recoveryTone = 'warning';
  } else {
    recoveryStatusLabel = 'Herstel klaar';
    recoveryTone = 'success';
  }

  return {
    headline: `Herstelpad naar ${resumeTask?.title ?? 'een stabiel winpad'}`,
    summary: `${recoveryStatusLabel}: ${stabilizeTasks.length} stabiliseeracties, ${rebuildTasks.length} herstartstappen en ${recoveryChecks.length} herstelchecks.`,
    recoveryStatusLabel,
    recoveryTone,
    confidenceScore: commitBoard.confidenceScore,
    resumeTask,
    stabilizeTasks,
    rebuildTasks,
    recoveryChecks,
  };
}

export function buildReadinessRunbookScenarioReleaseGate(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioReleaseGate | null {
  const commitBoard = buildReadinessRunbookScenarioCommitBoard(state, focus);
  const handoverBoard = buildReadinessRunbookScenarioHandoverBoard(state, focus);
  const recoveryBoard = buildReadinessRunbookScenarioRecoveryBoard(state, focus);
  const monitorBoard = buildReadinessRunbookScenarioMonitorBoard(state, focus);

  if (!commitBoard || !handoverBoard || !recoveryBoard || !monitorBoard) return null;

  const releaseTask =
    recoveryBoard.resumeTask ??
    commitBoard.commitTask ??
    handoverBoard.nowTasks[0]?.task ??
    null;

  const holdItem =
    monitorBoard.activeItems.find((item) => item.tone === 'danger') ??
    monitorBoard.activeItems.find((item) => item.tone === 'warning') ??
    null;

  const holdTask = holdItem?.task ?? null;

  const readinessChecks = [
    `Commit: ${commitBoard.decisionStatusLabel}`,
    `Herstel: ${recoveryBoard.recoveryStatusLabel}`,
    `Monitor: ${monitorBoard.monitorStatusLabel}`,
    handoverBoard.nowTasks[0] ? `Uitvoering via ${handoverBoard.nowTasks[0].task.title}` : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const blockers = [
    holdItem ? `${holdItem.label}: ${holdItem.task?.title ?? holdItem.detail}` : null,
    recoveryBoard.recoveryChecks[0] ?? null,
    commitBoard.openQuestions[0] ?? null,
    handoverBoard.escalateTasks[0] ? `Escalatie: ${handoverBoard.escalateTasks[0].task.title}` : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  let gateStatusLabel = 'Voorwaardelijk vrijgeven';
  let gateTone: ReadinessRunbookScenarioReleaseGate['gateTone'] = 'warning';

  if (
    commitBoard.decisionTone === 'danger' ||
    recoveryBoard.recoveryTone === 'danger' ||
    monitorBoard.monitorTone === 'danger'
  ) {
    gateStatusLabel = 'Niet vrijgeven';
    gateTone = 'danger';
  } else if (
    commitBoard.decisionTone === 'success' &&
    recoveryBoard.recoveryTone === 'success' &&
    monitorBoard.monitorTone === 'success'
  ) {
    gateStatusLabel = 'Vrijgeven';
    gateTone = 'success';
  }

  return {
    headline: `Releasepoort voor ${releaseTask?.title ?? 'het winpad'}`,
    summary: `${gateStatusLabel}: ${readinessChecks.length} checks actief, ${blockers.length} aandachtspunten en eigenaar ${handoverBoard.ownerLabel}.`,
    gateStatusLabel,
    gateTone,
    confidenceScore: commitBoard.confidenceScore,
    ownerLabel: handoverBoard.ownerLabel,
    releaseTask,
    holdTask,
    readinessChecks,
    blockers,
  };
}

export function buildReadinessRunbookScenarioCutoverBoard(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioCutoverBoard | null {
  const releaseGate = buildReadinessRunbookScenarioReleaseGate(state, focus);
  const actionBoard = buildReadinessRunbookScenarioActionBoard(state, focus);
  const handoverBoard = buildReadinessRunbookScenarioHandoverBoard(state, focus);
  const rollbackBoard = buildReadinessRunbookScenarioRollbackBoard(state, focus);
  const monitorBoard = buildReadinessRunbookScenarioMonitorBoard(state, focus);

  if (!releaseGate || !actionBoard || !handoverBoard || !rollbackBoard || !monitorBoard) return null;

  const dedupe = (items: ReadinessRunbookScenarioConsensusTask[]) =>
    items.filter(
      (item, index, list) => list.findIndex((candidate) => candidate.task.id === item.task.id) === index
    );

  const launchTasks = dedupe([
    ...actionBoard.immediateTasks.slice(0, 2),
    ...handoverBoard.nowTasks.slice(0, 2),
  ]).slice(0, 4);

  const verifyTasks = dedupe([
    ...actionBoard.verifyTasks.slice(0, 2),
    ...handoverBoard.watchTasks.slice(0, 2),
  ]).slice(0, 4);

  const fallbackTask =
    releaseGate.holdTask ??
    rollbackBoard.rollbackTask ??
    actionBoard.fallbackTasks[0]?.task ??
    null;

  const cutoverChecks = [
    releaseGate.readinessChecks[0] ?? null,
    releaseGate.releaseTask ? `Zet live overgang op ${releaseGate.releaseTask.title}.` : null,
    monitorBoard.activeItems[0] ? `${monitorBoard.activeItems[0].label}: ${monitorBoard.activeItems[0].detail}` : null,
    fallbackTask ? `Fallback klaar via ${fallbackTask.title}.` : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  let cutoverStatusLabel = 'Cutover gefaseerd';
  let cutoverTone: ReadinessRunbookScenarioCutoverBoard['cutoverTone'] = 'warning';

  if (releaseGate.gateTone === 'danger' || monitorBoard.monitorTone === 'danger') {
    cutoverStatusLabel = 'Cutover vasthouden';
    cutoverTone = 'danger';
  } else if (releaseGate.gateTone === 'success' && monitorBoard.monitorTone === 'success') {
    cutoverStatusLabel = 'Cutover klaar';
    cutoverTone = 'success';
  }

  return {
    headline: `Cutoverplan voor ${releaseGate.releaseTask?.title ?? actionBoard.immediateTasks[0]?.task.title ?? 'de live overgang'}`,
    summary: `${cutoverStatusLabel}: ${launchTasks.length} launchstappen, ${verifyTasks.length} verificaties en ${cutoverChecks.length} cutoverchecks.`,
    cutoverStatusLabel,
    cutoverTone,
    confidenceScore: releaseGate.confidenceScore,
    ownerLabel: releaseGate.ownerLabel,
    launchTasks,
    verifyTasks,
    fallbackTask,
    cutoverChecks,
  };
}

export function buildReadinessRunbookScenarioSmokeBoard(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioSmokeBoard | null {
  const releaseGate = buildReadinessRunbookScenarioReleaseGate(state, focus);
  const cutoverBoard = buildReadinessRunbookScenarioCutoverBoard(state, focus);
  const monitorBoard = buildReadinessRunbookScenarioMonitorBoard(state, focus);

  if (!releaseGate || !cutoverBoard || !monitorBoard) return null;

  const greenChecks = [
    releaseGate.gateTone === 'success' ? `Releasepoort op ${releaseGate.gateStatusLabel}.` : null,
    cutoverBoard.launchTasks[0] ? `Live overgang draait via ${cutoverBoard.launchTasks[0].task.title}.` : null,
    cutoverBoard.verifyTasks[0] ? `Eerste verificatie: ${cutoverBoard.verifyTasks[0].task.title}.` : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const watchChecks = [
    ...cutoverBoard.cutoverChecks.slice(0, 2),
    ...monitorBoard.openQuestions.slice(0, 2),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const failingChecks = monitorBoard.activeItems
    .filter((item) => item.tone === 'danger' || item.tone === 'warning')
    .map((item) => `${item.label}: ${item.task?.title ?? item.detail}`)
    .slice(0, 4);

  const fallbackTask = cutoverBoard.fallbackTask ?? releaseGate.holdTask ?? null;

  let smokeStatusLabel = 'Smoketest bewaken';
  let smokeTone: ReadinessRunbookScenarioSmokeBoard['smokeTone'] = 'warning';

  if (failingChecks.length > 0 || releaseGate.gateTone === 'danger' || monitorBoard.monitorTone === 'danger') {
    smokeStatusLabel = 'Smoketest faalt';
    smokeTone = 'danger';
  } else if (releaseGate.gateTone === 'success' && cutoverBoard.cutoverTone === 'success' && watchChecks.length <= 2) {
    smokeStatusLabel = 'Smoketest groen';
    smokeTone = 'success';
  }

  return {
    headline: `Smoketest na ${releaseGate.releaseTask?.title ?? 'de livegang'}`,
    summary: `${smokeStatusLabel}: ${greenChecks.length} groene checks, ${watchChecks.length} punten om te volgen en ${failingChecks.length} rooksignalen.`,
    smokeStatusLabel,
    smokeTone,
    confidenceScore: cutoverBoard.confidenceScore,
    ownerLabel: cutoverBoard.ownerLabel,
    greenChecks,
    watchChecks,
    failingChecks,
    fallbackTask,
  };
}

export function buildReadinessRunbookScenarioHypercareBoard(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioHypercareBoard | null {
  const smokeBoard = buildReadinessRunbookScenarioSmokeBoard(state, focus);
  const handoverBoard = buildReadinessRunbookScenarioHandoverBoard(state, focus);
  const monitorBoard = buildReadinessRunbookScenarioMonitorBoard(state, focus);
  const escalationBoard = buildReadinessRunbookScenarioEscalationBoard(state, focus);

  if (!smokeBoard || !handoverBoard || !monitorBoard || !escalationBoard) return null;

  const keepWarmTasks = [...handoverBoard.nowTasks, ...handoverBoard.watchTasks]
    .filter((item, index, list) => list.findIndex((candidate) => candidate.task.id === item.task.id) === index)
    .slice(0, 4);

  const watchItems = [
    ...smokeBoard.watchChecks.slice(0, 2),
    ...monitorBoard.openQuestions.slice(0, 2),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const escalateItems = [
    ...smokeBoard.failingChecks.slice(0, 2),
    ...escalationBoard.triggerQuestions.slice(0, 2),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  let hypercareStatusLabel = 'Hypercare actief';
  let hypercareTone: ReadinessRunbookScenarioHypercareBoard['hypercareTone'] = 'warning';

  if (smokeBoard.smokeTone === 'danger' || escalationBoard.escalationTone === 'danger') {
    hypercareStatusLabel = 'Hypercare opschalen';
    hypercareTone = 'danger';
  } else if (smokeBoard.smokeTone === 'success' && watchItems.length <= 2) {
    hypercareStatusLabel = 'Hypercare stabiel';
    hypercareTone = 'success';
  }

  return {
    headline: `Hypercare voor ${smokeBoard.fallbackTask?.title ?? handoverBoard.nowTasks[0]?.task.title ?? 'de livegang'}`,
    summary: `${hypercareStatusLabel}: ${keepWarmTasks.length} taken warm houden, ${watchItems.length} dingen volgen en ${escalateItems.length} opschaalsignalen.`,
    hypercareStatusLabel,
    hypercareTone,
    confidenceScore: smokeBoard.confidenceScore,
    ownerLabel: handoverBoard.ownerLabel,
    keepWarmTasks,
    watchItems,
    escalateItems,
    fallbackTask: smokeBoard.fallbackTask,
  };
}

export function buildReadinessRunbookScenarioExitBoard(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioExitBoard | null {
  const hypercareBoard = buildReadinessRunbookScenarioHypercareBoard(state, focus);
  const smokeBoard = buildReadinessRunbookScenarioSmokeBoard(state, focus);
  const monitorBoard = buildReadinessRunbookScenarioMonitorBoard(state, focus);

  if (!hypercareBoard || !smokeBoard || !monitorBoard) return null;

  const exitChecks = [
    smokeBoard.smokeTone === 'success' ? `Smoketest staat op ${smokeBoard.smokeStatusLabel}.` : null,
    hypercareBoard.hypercareTone === 'success' ? `Hypercare staat op ${hypercareBoard.hypercareStatusLabel}.` : null,
    monitorBoard.activeItems.length === 0 ? 'Geen actieve monitorpunten meer open.' : null,
    hypercareBoard.keepWarmTasks[0] ? `${hypercareBoard.keepWarmTasks[0].task.title} is nog warm gehouden tot exit.` : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const keepWatchItems = [
    ...hypercareBoard.watchItems.slice(0, 2),
    ...monitorBoard.openQuestions.slice(0, 2),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const rollbackSignals = [
    ...hypercareBoard.escalateItems.slice(0, 2),
    ...smokeBoard.failingChecks.slice(0, 2),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  let exitStatusLabel = 'Exit voorbereiden';
  let exitTone: ReadinessRunbookScenarioExitBoard['exitTone'] = 'warning';

  if (rollbackSignals.length > 0 || monitorBoard.monitorTone === 'danger') {
    exitStatusLabel = 'Exit uitstellen';
    exitTone = 'danger';
  } else if (exitChecks.length >= 2 && keepWatchItems.length <= 2) {
    exitStatusLabel = 'Exit klaar';
    exitTone = 'success';
  }

  return {
    headline: `Exitplan na ${hypercareBoard.fallbackTask?.title ?? 'de hypercare'}`,
    summary: `${exitStatusLabel}: ${exitChecks.length} exitchecks, ${keepWatchItems.length} watch-items en ${rollbackSignals.length} signalen om exit te blokkeren.`,
    exitStatusLabel,
    exitTone,
    confidenceScore: hypercareBoard.confidenceScore,
    ownerLabel: hypercareBoard.ownerLabel,
    exitChecks,
    keepWatchItems,
    rollbackSignals,
    fallbackTask: hypercareBoard.fallbackTask,
  };
}

export function buildReadinessRunbookScenarioSteadyStateBoard(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioSteadyStateBoard | null {
  const exitBoard = buildReadinessRunbookScenarioExitBoard(state, focus);
  const monitorBoard = buildReadinessRunbookScenarioMonitorBoard(state, focus);

  if (!exitBoard || !monitorBoard) return null;

  const keepAliveChecks = [
    ...exitBoard.exitChecks.slice(0, 2),
    monitorBoard.activeItems.length === 0 ? 'Geen actieve monitorpunten meer.' : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const watchItems = [
    ...exitBoard.keepWatchItems.slice(0, 2),
    ...monitorBoard.openQuestions.slice(0, 2),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const alertSignals = [
    ...exitBoard.rollbackSignals.slice(0, 2),
    ...monitorBoard.activeItems
      .filter((item) => item.tone === 'danger' || item.tone === 'warning')
      .map((item) => `${item.label}: ${item.task?.title ?? item.detail}`)
      .slice(0, 2),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  let steadyStatusLabel = 'Steady state actief';
  let steadyTone: ReadinessRunbookScenarioSteadyStateBoard['steadyTone'] = 'warning';

  if (alertSignals.length > 0) {
    steadyStatusLabel = 'Steady state alert';
    steadyTone = 'danger';
  } else if (keepAliveChecks.length >= 2 && watchItems.length <= 2) {
    steadyStatusLabel = 'Steady state stabiel';
    steadyTone = 'success';
  }

  return {
    headline: `Steady state na ${exitBoard.fallbackTask?.title ?? 'de exit'}`,
    summary: `${steadyStatusLabel}: ${keepAliveChecks.length} keep-alive checks, ${watchItems.length} vaste watch-items en ${alertSignals.length} alerts.`,
    steadyStatusLabel,
    steadyTone,
    confidenceScore: exitBoard.confidenceScore,
    ownerLabel: exitBoard.ownerLabel,
    keepAliveChecks,
    watchItems,
    alertSignals,
    fallbackTask: exitBoard.fallbackTask,
  };
}

export function buildReadinessRunbookScenarioIncidentBoard(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioIncidentBoard | null {
  const steadyStateBoard = buildReadinessRunbookScenarioSteadyStateBoard(state, focus);
  const monitorBoard = buildReadinessRunbookScenarioMonitorBoard(state, focus);
  const escalationBoard = buildReadinessRunbookScenarioEscalationBoard(state, focus);

  if (!steadyStateBoard || !monitorBoard || !escalationBoard) return null;

  const firstResponseSignals = [
    ...steadyStateBoard.alertSignals.slice(0, 2),
    ...monitorBoard.activeItems
      .filter((item) => item.tone === 'danger')
      .map((item) => `${item.label}: ${item.task?.title ?? item.detail}`)
      .slice(0, 2),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const investigateSignals = [
    ...steadyStateBoard.watchItems.slice(0, 2),
    ...monitorBoard.openQuestions.slice(0, 2),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const escalateSignals = [
    ...escalationBoard.triggerQuestions.slice(0, 2),
    ...escalationBoard.urgentTasks.slice(0, 2).map((item) => item.task.title),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  let incidentStatusLabel = 'Incident waakstand';
  let incidentTone: ReadinessRunbookScenarioIncidentBoard['incidentTone'] = 'warning';

  if (firstResponseSignals.length > 0 || escalationBoard.escalationTone === 'danger') {
    incidentStatusLabel = 'Incident actief';
    incidentTone = 'danger';
  } else if (investigateSignals.length <= 2 && steadyStateBoard.steadyTone === 'success') {
    incidentStatusLabel = 'Incident laag';
    incidentTone = 'success';
  }

  return {
    headline: `Incidentpad na ${steadyStateBoard.fallbackTask?.title ?? 'steady state'}`,
    summary: `${incidentStatusLabel}: ${firstResponseSignals.length} first-response signalen, ${investigateSignals.length} onderzoekspunten en ${escalateSignals.length} escalatiehaakjes.`,
    incidentStatusLabel,
    incidentTone,
    confidenceScore: steadyStateBoard.confidenceScore,
    ownerLabel: steadyStateBoard.ownerLabel,
    firstResponseSignals,
    investigateSignals,
    escalateSignals,
    fallbackTask: steadyStateBoard.fallbackTask,
  };
}

export function buildReadinessRunbookScenarioRcaBoard(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioRcaBoard | null {
  const incidentBoard = buildReadinessRunbookScenarioIncidentBoard(state, focus);
  const escalationBoard = buildReadinessRunbookScenarioEscalationBoard(state, focus);

  if (!incidentBoard || !escalationBoard) return null;

  const rootCauseSignals = [
    ...incidentBoard.investigateSignals.slice(0, 2),
    ...incidentBoard.firstResponseSignals.slice(0, 1),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const containmentSignals = [
    ...incidentBoard.firstResponseSignals.slice(0, 2),
    ...incidentBoard.escalateSignals.slice(0, 2),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const permanentFixSignals = [
    ...incidentBoard.investigateSignals.slice(0, 2),
    ...escalationBoard.fallbackTasks.slice(0, 2).map((item) => item.task.title),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  let rcaStatusLabel = 'RCA opstarten';
  let rcaTone: ReadinessRunbookScenarioRcaBoard['rcaTone'] = 'warning';

  if (incidentBoard.incidentTone === 'danger') {
    rcaStatusLabel = 'Containment eerst';
    rcaTone = 'danger';
  } else if (rootCauseSignals.length > 0 && permanentFixSignals.length > 0) {
    rcaStatusLabel = 'RCA in opbouw';
    rcaTone = 'success';
  }

  return {
    headline: `RCA na ${incidentBoard.fallbackTask?.title ?? 'het incident'}`,
    summary: `${rcaStatusLabel}: ${rootCauseSignals.length} oorzaaksporen, ${containmentSignals.length} containmentlijnen en ${permanentFixSignals.length} blijvende fixes.`,
    rcaStatusLabel,
    rcaTone,
    confidenceScore: incidentBoard.confidenceScore,
    ownerLabel: incidentBoard.ownerLabel,
    rootCauseSignals,
    containmentSignals,
    permanentFixSignals,
    fallbackTask: incidentBoard.fallbackTask,
  };
}

export function buildReadinessRunbookScenarioPostmortemBoard(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioPostmortemBoard | null {
  const rcaBoard = buildReadinessRunbookScenarioRcaBoard(state, focus);
  const steadyStateBoard = buildReadinessRunbookScenarioSteadyStateBoard(state, focus);

  if (!rcaBoard || !steadyStateBoard) return null;

  const findings = [
    ...rcaBoard.rootCauseSignals.slice(0, 2),
    ...rcaBoard.containmentSignals.slice(0, 1),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const followUpActions = [
    ...rcaBoard.permanentFixSignals.slice(0, 2),
    ...steadyStateBoard.keepAliveChecks.slice(0, 2),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const preventionSignals = [
    ...steadyStateBoard.watchItems.slice(0, 2),
    ...steadyStateBoard.alertSignals.slice(0, 2),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  let postmortemStatusLabel = 'Postmortem opzetten';
  let postmortemTone: ReadinessRunbookScenarioPostmortemBoard['postmortemTone'] = 'warning';

  if (rcaBoard.rcaTone === 'danger') {
    postmortemStatusLabel = 'Eerst containment borgen';
    postmortemTone = 'danger';
  } else if (findings.length > 0 && followUpActions.length > 0) {
    postmortemStatusLabel = 'Postmortem klaar voor acties';
    postmortemTone = 'success';
  }

  return {
    headline: `Postmortem na ${rcaBoard.fallbackTask?.title ?? 'de RCA'}`,
    summary: `${postmortemStatusLabel}: ${findings.length} bevindingen, ${followUpActions.length} vervolgacties en ${preventionSignals.length} preventiesignalen.`,
    postmortemStatusLabel,
    postmortemTone,
    confidenceScore: rcaBoard.confidenceScore,
    ownerLabel: rcaBoard.ownerLabel,
    findings,
    followUpActions,
    preventionSignals,
    fallbackTask: rcaBoard.fallbackTask,
  };
}

export function buildReadinessRunbookScenarioImprovementBoard(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioImprovementBoard | null {
  const postmortemBoard = buildReadinessRunbookScenarioPostmortemBoard(state, focus);
  const steadyStateBoard = buildReadinessRunbookScenarioSteadyStateBoard(state, focus);

  if (!postmortemBoard || !steadyStateBoard) return null;

  const structuralImprovements = [
    ...postmortemBoard.followUpActions.slice(0, 2),
    ...steadyStateBoard.keepAliveChecks.slice(0, 1),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const processImprovements = [
    ...postmortemBoard.findings.slice(0, 1),
    ...postmortemBoard.preventionSignals.slice(0, 2),
    ...steadyStateBoard.watchItems.slice(0, 1),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const safeguardSignals = [
    ...steadyStateBoard.alertSignals.slice(0, 2),
    ...postmortemBoard.preventionSignals.slice(0, 2),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  let improvementStatusLabel = 'Verbeterplan opzetten';
  let improvementTone: ReadinessRunbookScenarioImprovementBoard['improvementTone'] = 'warning';

  if (postmortemBoard.postmortemTone === 'danger') {
    improvementStatusLabel = 'Eerst risico afbouwen';
    improvementTone = 'danger';
  } else if (structuralImprovements.length > 0 && processImprovements.length > 0) {
    improvementStatusLabel = 'Verbeterplan actief';
    improvementTone = 'success';
  } else if (safeguardSignals.length > 0) {
    improvementStatusLabel = 'Verbetering onder bewaking';
    improvementTone = 'accent';
  }

  return {
    headline: `Verbeterplan na ${postmortemBoard.fallbackTask?.title ?? 'de postmortem'}`,
    summary: `${improvementStatusLabel}: ${structuralImprovements.length} structurele verbeteringen, ${processImprovements.length} procesverbeteringen en ${safeguardSignals.length} borgingssignalen.`,
    improvementStatusLabel,
    improvementTone,
    confidenceScore: postmortemBoard.confidenceScore,
    ownerLabel: postmortemBoard.ownerLabel,
    structuralImprovements,
    processImprovements,
    safeguardSignals,
    fallbackTask: postmortemBoard.fallbackTask,
  };
}

export function buildReadinessRunbookScenarioSafeguardBoard(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioSafeguardBoard | null {
  const improvementBoard = buildReadinessRunbookScenarioImprovementBoard(state, focus);
  const steadyStateBoard = buildReadinessRunbookScenarioSteadyStateBoard(state, focus);

  if (!improvementBoard || !steadyStateBoard) return null;

  const ownershipSignals = [
    `Eigenaar ${improvementBoard.ownerLabel}`,
    ...improvementBoard.structuralImprovements.slice(0, 1),
    ...improvementBoard.processImprovements.slice(0, 1),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const cadenceSignals = [
    ...steadyStateBoard.keepAliveChecks.slice(0, 2),
    ...steadyStateBoard.watchItems.slice(0, 1),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const controlChecks = [
    ...improvementBoard.safeguardSignals.slice(0, 2),
    ...steadyStateBoard.alertSignals.slice(0, 2),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  let safeguardStatusLabel = 'Borging voorbereiden';
  let safeguardTone: ReadinessRunbookScenarioSafeguardBoard['safeguardTone'] = 'warning';

  if (improvementBoard.improvementTone === 'danger') {
    safeguardStatusLabel = 'Eerst verbetering stabiliseren';
    safeguardTone = 'danger';
  } else if (ownershipSignals.length > 0 && cadenceSignals.length > 0 && controlChecks.length > 0) {
    safeguardStatusLabel = 'Borging actief';
    safeguardTone = 'success';
  } else if (controlChecks.length > 0) {
    safeguardStatusLabel = 'Borging onder controle';
    safeguardTone = 'accent';
  }

  return {
    headline: `Borging na ${improvementBoard.fallbackTask?.title ?? 'het verbeterplan'}`,
    summary: `${safeguardStatusLabel}: ${ownershipSignals.length} eigenaarsignalen, ${cadenceSignals.length} ritmes en ${controlChecks.length} controlepunten.`,
    safeguardStatusLabel,
    safeguardTone,
    confidenceScore: improvementBoard.confidenceScore,
    ownerLabel: improvementBoard.ownerLabel,
    ownershipSignals,
    cadenceSignals,
    controlChecks,
    fallbackTask: improvementBoard.fallbackTask,
  };
}

export function buildReadinessRunbookScenarioReviewBoard(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioReviewBoard | null {
  const safeguardBoard = buildReadinessRunbookScenarioSafeguardBoard(state, focus);
  const improvementBoard = buildReadinessRunbookScenarioImprovementBoard(state, focus);

  if (!safeguardBoard || !improvementBoard) return null;

  const evidenceSignals = [
    ...improvementBoard.structuralImprovements.slice(0, 2),
    ...safeguardBoard.controlChecks.slice(0, 1),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const reviewQuestions = [
    ...improvementBoard.processImprovements.slice(0, 2),
    ...safeguardBoard.cadenceSignals.slice(0, 1),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const approvalChecks = [
    ...safeguardBoard.ownershipSignals.slice(0, 1),
    ...safeguardBoard.controlChecks.slice(0, 2),
    ...improvementBoard.safeguardSignals.slice(0, 1),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  let reviewStatusLabel = 'Review voorbereiden';
  let reviewTone: ReadinessRunbookScenarioReviewBoard['reviewTone'] = 'warning';

  if (safeguardBoard.safeguardTone === 'danger') {
    reviewStatusLabel = 'Eerst borging verstevigen';
    reviewTone = 'danger';
  } else if (evidenceSignals.length > 0 && reviewQuestions.length > 0 && approvalChecks.length > 0) {
    reviewStatusLabel = 'Review klaar';
    reviewTone = 'success';
  } else if (approvalChecks.length > 0) {
    reviewStatusLabel = 'Review onder controle';
    reviewTone = 'accent';
  }

  return {
    headline: `Review na ${safeguardBoard.fallbackTask?.title ?? 'de borging'}`,
    summary: `${reviewStatusLabel}: ${evidenceSignals.length} bewijsstukken, ${reviewQuestions.length} reviewpunten en ${approvalChecks.length} akkoordchecks.`,
    reviewStatusLabel,
    reviewTone,
    confidenceScore: safeguardBoard.confidenceScore,
    ownerLabel: safeguardBoard.ownerLabel,
    evidenceSignals,
    reviewQuestions,
    approvalChecks,
    fallbackTask: safeguardBoard.fallbackTask,
  };
}

export function buildReadinessRunbookScenarioSignoffBoard(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioSignoffBoard | null {
  const reviewBoard = buildReadinessRunbookScenarioReviewBoard(state, focus);
  const safeguardBoard = buildReadinessRunbookScenarioSafeguardBoard(state, focus);

  if (!reviewBoard || !safeguardBoard) return null;

  const approverSignals = [
    `Eigenaar ${reviewBoard.ownerLabel}`,
    ...reviewBoard.approvalChecks.slice(0, 2),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const signoffConditions = [
    ...reviewBoard.reviewQuestions.slice(0, 2),
    ...reviewBoard.evidenceSignals.slice(0, 1),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const releaseChecks = [
    ...safeguardBoard.controlChecks.slice(0, 2),
    ...safeguardBoard.cadenceSignals.slice(0, 1),
    ...reviewBoard.approvalChecks.slice(0, 1),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  let signoffStatusLabel = 'Sign-off voorbereiden';
  let signoffTone: ReadinessRunbookScenarioSignoffBoard['signoffTone'] = 'warning';

  if (reviewBoard.reviewTone === 'danger') {
    signoffStatusLabel = 'Eerst review afronden';
    signoffTone = 'danger';
  } else if (approverSignals.length > 0 && signoffConditions.length > 0 && releaseChecks.length > 0) {
    signoffStatusLabel = 'Sign-off klaar';
    signoffTone = 'success';
  } else if (releaseChecks.length > 0) {
    signoffStatusLabel = 'Sign-off onder controle';
    signoffTone = 'accent';
  }

  return {
    headline: `Sign-off na ${reviewBoard.fallbackTask?.title ?? 'de review'}`,
    summary: `${signoffStatusLabel}: ${approverSignals.length} approversignalen, ${signoffConditions.length} voorwaarden en ${releaseChecks.length} vrijgavechecks.`,
    signoffStatusLabel,
    signoffTone,
    confidenceScore: reviewBoard.confidenceScore,
    ownerLabel: reviewBoard.ownerLabel,
    approverSignals,
    signoffConditions,
    releaseChecks,
    fallbackTask: reviewBoard.fallbackTask,
  };
}

export function buildReadinessRunbookScenarioAcceptanceBoard(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioAcceptanceBoard | null {
  const signoffBoard = buildReadinessRunbookScenarioSignoffBoard(state, focus);
  const reviewBoard = buildReadinessRunbookScenarioReviewBoard(state, focus);

  if (!signoffBoard || !reviewBoard) return null;

  const acceptanceSignals = [
    ...signoffBoard.approverSignals.slice(0, 2),
    ...signoffBoard.releaseChecks.slice(0, 1),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const watchSignals = [
    ...signoffBoard.signoffConditions.slice(0, 2),
    ...reviewBoard.reviewQuestions.slice(0, 1),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const readinessChecks = [
    ...signoffBoard.releaseChecks.slice(0, 2),
    ...reviewBoard.approvalChecks.slice(0, 1),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  let acceptanceStatusLabel = 'Acceptatie voorbereiden';
  let acceptanceTone: ReadinessRunbookScenarioAcceptanceBoard['acceptanceTone'] = 'warning';

  if (signoffBoard.signoffTone === 'danger') {
    acceptanceStatusLabel = 'Eerst sign-off afronden';
    acceptanceTone = 'danger';
  } else if (acceptanceSignals.length > 0 && watchSignals.length > 0 && readinessChecks.length > 0) {
    acceptanceStatusLabel = 'Acceptatie klaar';
    acceptanceTone = 'success';
  } else if (readinessChecks.length > 0) {
    acceptanceStatusLabel = 'Acceptatie onder controle';
    acceptanceTone = 'accent';
  }

  return {
    headline: `Acceptatie na ${signoffBoard.fallbackTask?.title ?? 'de sign-off'}`,
    summary: `${acceptanceStatusLabel}: ${acceptanceSignals.length} acceptatiesignalen, ${watchSignals.length} bewakingspunten en ${readinessChecks.length} gereedchecks.`,
    acceptanceStatusLabel,
    acceptanceTone,
    confidenceScore: signoffBoard.confidenceScore,
    ownerLabel: signoffBoard.ownerLabel,
    acceptanceSignals,
    watchSignals,
    readinessChecks,
    fallbackTask: signoffBoard.fallbackTask,
  };
}

export function buildReadinessRunbookScenarioActivationBoard(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioActivationBoard | null {
  const acceptanceBoard = buildReadinessRunbookScenarioAcceptanceBoard(state, focus);
  const signoffBoard = buildReadinessRunbookScenarioSignoffBoard(state, focus);

  if (!acceptanceBoard || !signoffBoard) return null;

  const launchSignals = [
    ...acceptanceBoard.acceptanceSignals.slice(0, 2),
    ...acceptanceBoard.readinessChecks.slice(0, 1),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const firstWatchSignals = [
    ...acceptanceBoard.watchSignals.slice(0, 2),
    ...signoffBoard.signoffConditions.slice(0, 1),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const activationChecks = [
    ...acceptanceBoard.readinessChecks.slice(0, 2),
    ...signoffBoard.releaseChecks.slice(0, 1),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  let activationStatusLabel = 'Activatie voorbereiden';
  let activationTone: ReadinessRunbookScenarioActivationBoard['activationTone'] = 'warning';

  if (acceptanceBoard.acceptanceTone === 'danger') {
    activationStatusLabel = 'Eerst acceptatie afronden';
    activationTone = 'danger';
  } else if (launchSignals.length > 0 && firstWatchSignals.length > 0 && activationChecks.length > 0) {
    activationStatusLabel = 'Activatie klaar';
    activationTone = 'success';
  } else if (activationChecks.length > 0) {
    activationStatusLabel = 'Activatie onder controle';
    activationTone = 'accent';
  }

  return {
    headline: `Activatie na ${acceptanceBoard.fallbackTask?.title ?? 'de acceptatie'}`,
    summary: `${activationStatusLabel}: ${launchSignals.length} launchsignalen, ${firstWatchSignals.length} eerste watch-signalen en ${activationChecks.length} activatiechecks.`,
    activationStatusLabel,
    activationTone,
    confidenceScore: acceptanceBoard.confidenceScore,
    ownerLabel: acceptanceBoard.ownerLabel,
    launchSignals,
    firstWatchSignals,
    activationChecks,
    fallbackTask: acceptanceBoard.fallbackTask,
  };
}

export function buildReadinessRunbookScenarioStabilizationBoard(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioStabilizationBoard | null {
  const activationBoard = buildReadinessRunbookScenarioActivationBoard(state, focus);
  const acceptanceBoard = buildReadinessRunbookScenarioAcceptanceBoard(state, focus);

  if (!activationBoard || !acceptanceBoard) return null;

  const settleSignals = [
    ...activationBoard.launchSignals.slice(0, 2),
    ...activationBoard.activationChecks.slice(0, 1),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const earlyDriftSignals = [
    ...activationBoard.firstWatchSignals.slice(0, 2),
    ...acceptanceBoard.watchSignals.slice(0, 1),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const stabilizationChecks = [
    ...activationBoard.activationChecks.slice(0, 2),
    ...acceptanceBoard.readinessChecks.slice(0, 1),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  let stabilizationStatusLabel = 'Stabilisatie voorbereiden';
  let stabilizationTone: ReadinessRunbookScenarioStabilizationBoard['stabilizationTone'] = 'warning';

  if (activationBoard.activationTone === 'danger') {
    stabilizationStatusLabel = 'Eerst activatie afronden';
    stabilizationTone = 'danger';
  } else if (settleSignals.length > 0 && earlyDriftSignals.length > 0 && stabilizationChecks.length > 0) {
    stabilizationStatusLabel = 'Stabilisatie loopt';
    stabilizationTone = 'success';
  } else if (stabilizationChecks.length > 0) {
    stabilizationStatusLabel = 'Stabilisatie onder controle';
    stabilizationTone = 'accent';
  }

  return {
    headline: `Stabilisatie na ${activationBoard.fallbackTask?.title ?? 'de activatie'}`,
    summary: `${stabilizationStatusLabel}: ${settleSignals.length} settle-signalen, ${earlyDriftSignals.length} vroege drift-signalen en ${stabilizationChecks.length} stabilisatiechecks.`,
    stabilizationStatusLabel,
    stabilizationTone,
    confidenceScore: activationBoard.confidenceScore,
    ownerLabel: activationBoard.ownerLabel,
    settleSignals,
    earlyDriftSignals,
    stabilizationChecks,
    fallbackTask: activationBoard.fallbackTask,
  };
}

export function buildReadinessRunbookScenarioValidationBoard(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioValidationBoard | null {
  const stabilizationBoard = buildReadinessRunbookScenarioStabilizationBoard(state, focus);
  const activationBoard = buildReadinessRunbookScenarioActivationBoard(state, focus);

  if (!stabilizationBoard || !activationBoard) return null;

  const outcomeSignals = [
    ...stabilizationBoard.settleSignals.slice(0, 2),
    ...activationBoard.launchSignals.slice(0, 1),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const validationQuestions = [
    ...stabilizationBoard.earlyDriftSignals.slice(0, 2),
    ...activationBoard.firstWatchSignals.slice(0, 1),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const validationChecks = [
    ...stabilizationBoard.stabilizationChecks.slice(0, 2),
    ...activationBoard.activationChecks.slice(0, 1),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  let validationStatusLabel = 'Validatie voorbereiden';
  let validationTone: ReadinessRunbookScenarioValidationBoard['validationTone'] = 'warning';

  if (stabilizationBoard.stabilizationTone === 'danger') {
    validationStatusLabel = 'Eerst stabilisatie afronden';
    validationTone = 'danger';
  } else if (outcomeSignals.length > 0 && validationQuestions.length > 0 && validationChecks.length > 0) {
    validationStatusLabel = 'Validatie klaar';
    validationTone = 'success';
  } else if (validationChecks.length > 0) {
    validationStatusLabel = 'Validatie onder controle';
    validationTone = 'accent';
  }

  return {
    headline: `Validatie na ${stabilizationBoard.fallbackTask?.title ?? 'de stabilisatie'}`,
    summary: `${validationStatusLabel}: ${outcomeSignals.length} uitkomstsignalen, ${validationQuestions.length} validatievragen en ${validationChecks.length} validatiechecks.`,
    validationStatusLabel,
    validationTone,
    confidenceScore: stabilizationBoard.confidenceScore,
    ownerLabel: stabilizationBoard.ownerLabel,
    outcomeSignals,
    validationQuestions,
    validationChecks,
    fallbackTask: stabilizationBoard.fallbackTask,
  };
}

export function buildReadinessRunbookScenarioAssuranceBoard(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioAssuranceBoard | null {
  const validationBoard = buildReadinessRunbookScenarioValidationBoard(state, focus);
  const stabilizationBoard = buildReadinessRunbookScenarioStabilizationBoard(state, focus);

  if (!validationBoard || !stabilizationBoard) return null;

  const trustedSignals = [
    ...validationBoard.outcomeSignals.slice(0, 2),
    ...validationBoard.validationChecks.slice(0, 1),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const assuranceWatchSignals = [
    ...validationBoard.validationQuestions.slice(0, 2),
    ...stabilizationBoard.earlyDriftSignals.slice(0, 1),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const assuranceChecks = [
    ...validationBoard.validationChecks.slice(0, 2),
    ...stabilizationBoard.stabilizationChecks.slice(0, 1),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  let assuranceStatusLabel = 'Assurance voorbereiden';
  let assuranceTone: ReadinessRunbookScenarioAssuranceBoard['assuranceTone'] = 'warning';

  if (validationBoard.validationTone === 'danger') {
    assuranceStatusLabel = 'Eerst validatie afronden';
    assuranceTone = 'danger';
  } else if (trustedSignals.length > 0 && assuranceWatchSignals.length > 0 && assuranceChecks.length > 0) {
    assuranceStatusLabel = 'Assurance klaar';
    assuranceTone = 'success';
  } else if (assuranceChecks.length > 0) {
    assuranceStatusLabel = 'Assurance onder controle';
    assuranceTone = 'accent';
  }

  return {
    headline: `Assurance na ${validationBoard.fallbackTask?.title ?? 'de validatie'}`,
    summary: `${assuranceStatusLabel}: ${trustedSignals.length} trusted signals, ${assuranceWatchSignals.length} watch-signalen en ${assuranceChecks.length} assurancechecks.`,
    assuranceStatusLabel,
    assuranceTone,
    confidenceScore: validationBoard.confidenceScore,
    ownerLabel: validationBoard.ownerLabel,
    trustedSignals,
    assuranceWatchSignals,
    assuranceChecks,
    fallbackTask: validationBoard.fallbackTask,
  };
}

export function buildReadinessRunbookScenarioGreenlightBoard(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioGreenlightBoard | null {
  const assuranceBoard = buildReadinessRunbookScenarioAssuranceBoard(state, focus);
  const validationBoard = buildReadinessRunbookScenarioValidationBoard(state, focus);

  if (!assuranceBoard || !validationBoard) return null;

  const greenlightSignals = [
    ...assuranceBoard.trustedSignals.slice(0, 2),
    ...assuranceBoard.assuranceChecks.slice(0, 1),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const cautionSignals = [
    ...assuranceBoard.assuranceWatchSignals.slice(0, 2),
    ...validationBoard.validationQuestions.slice(0, 1),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const goChecks = [
    ...assuranceBoard.assuranceChecks.slice(0, 2),
    ...validationBoard.validationChecks.slice(0, 1),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  let greenlightStatusLabel = 'Greenlight voorbereiden';
  let greenlightTone: ReadinessRunbookScenarioGreenlightBoard['greenlightTone'] = 'warning';

  if (assuranceBoard.assuranceTone === 'danger') {
    greenlightStatusLabel = 'Eerst assurance afronden';
    greenlightTone = 'danger';
  } else if (greenlightSignals.length > 0 && cautionSignals.length > 0 && goChecks.length > 0) {
    greenlightStatusLabel = 'Greenlight klaar';
    greenlightTone = 'success';
  } else if (goChecks.length > 0) {
    greenlightStatusLabel = 'Greenlight onder controle';
    greenlightTone = 'accent';
  }

  return {
    headline: `Greenlight na ${assuranceBoard.fallbackTask?.title ?? 'de assurance'}`,
    summary: `${greenlightStatusLabel}: ${greenlightSignals.length} greensignalen, ${cautionSignals.length} caution-signalen en ${goChecks.length} go-checks.`,
    greenlightStatusLabel,
    greenlightTone,
    confidenceScore: assuranceBoard.confidenceScore,
    ownerLabel: assuranceBoard.ownerLabel,
    greenlightSignals,
    cautionSignals,
    goChecks,
    fallbackTask: assuranceBoard.fallbackTask,
  };
}

export function buildReadinessRunbookScenarioGoNoBoard(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioGoNoBoard | null {
  const greenlightBoard = buildReadinessRunbookScenarioGreenlightBoard(state, focus);
  const releaseGate = buildReadinessRunbookScenarioReleaseGate(state, focus);
  const cutoverBoard = buildReadinessRunbookScenarioCutoverBoard(state, focus);

  if (!greenlightBoard || !releaseGate || !cutoverBoard) return null;

  const fallbackTask =
    releaseGate.holdTask ??
    cutoverBoard.fallbackTask ??
    greenlightBoard.fallbackTask ??
    null;

  const goSignals = [
    ...greenlightBoard.greenlightSignals.slice(0, 2),
    releaseGate.readinessChecks[0] ?? null,
    cutoverBoard.cutoverChecks[0] ?? null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const holdSignals = [
    ...greenlightBoard.cautionSignals.slice(0, 2),
    ...releaseGate.blockers.slice(0, 1),
    cutoverBoard.cutoverTone === 'danger' ? cutoverBoard.summary : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const decisionChecks = [
    releaseGate.releaseTask ? `Geef vrij via ${releaseGate.releaseTask.title}.` : null,
    cutoverBoard.launchTasks[0] ? `Start cutover op ${cutoverBoard.launchTasks[0].task.title}.` : null,
    cutoverBoard.verifyTasks[0] ? `Valideer direct via ${cutoverBoard.verifyTasks[0].task.title}.` : null,
    fallbackTask ? `Fallback klaar via ${fallbackTask.title}.` : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  let goNoStatusLabel = 'Voorwaardelijk go';
  let goNoTone: ReadinessRunbookScenarioGoNoBoard['goNoTone'] = 'warning';

  if (
    greenlightBoard.greenlightTone === 'danger' ||
    releaseGate.gateTone === 'danger' ||
    cutoverBoard.cutoverTone === 'danger'
  ) {
    goNoStatusLabel = 'No-go';
    goNoTone = 'danger';
  } else if (
    greenlightBoard.greenlightTone === 'success' &&
    releaseGate.gateTone === 'success' &&
    cutoverBoard.cutoverTone === 'success'
  ) {
    goNoStatusLabel = 'Go';
    goNoTone = 'success';
  } else if (decisionChecks.length > 0) {
    goNoStatusLabel = 'Go onder controle';
    goNoTone = 'accent';
  }

  return {
    headline: `Go/no-besluit voor ${releaseGate.releaseTask?.title ?? cutoverBoard.launchTasks[0]?.task.title ?? 'de livegang'}`,
    summary: `${goNoStatusLabel}: ${goSignals.length} go-signalen, ${holdSignals.length} hold-signalen en ${decisionChecks.length} beslischecks.`,
    goNoStatusLabel,
    goNoTone,
    confidenceScore: Math.round(
      (greenlightBoard.confidenceScore + releaseGate.confidenceScore + cutoverBoard.confidenceScore) / 3
    ),
    ownerLabel: releaseGate.ownerLabel,
    goSignals,
    holdSignals,
    decisionChecks,
    fallbackTask,
  };
}

export function buildReadinessRunbookScenarioWatchStartBoard(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioWatchStartBoard | null {
  const goNoBoard = buildReadinessRunbookScenarioGoNoBoard(state, focus);
  const smokeBoard = buildReadinessRunbookScenarioSmokeBoard(state, focus);
  const monitorBoard = buildReadinessRunbookScenarioMonitorBoard(state, focus);

  if (!goNoBoard || !smokeBoard || !monitorBoard) return null;

  const fallbackTask =
    smokeBoard.fallbackTask ??
    goNoBoard.fallbackTask ??
    monitorBoard.activeItems[0]?.task ??
    null;

  const armedSignals = [
    ...goNoBoard.goSignals.slice(0, 2),
    ...smokeBoard.greenChecks.slice(0, 1),
    monitorBoard.monitorTone === 'success' ? `Monitor op ${monitorBoard.monitorStatusLabel}.` : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const watchSignals = [
    ...smokeBoard.watchChecks.slice(0, 2),
    ...monitorBoard.openQuestions.slice(0, 2),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const startChecks = [
    monitorBoard.activeItems[0] ? `${monitorBoard.activeItems[0].label}: ${monitorBoard.activeItems[0].detail}` : null,
    smokeBoard.failingChecks[0] ? `Rooksignaal onder controle: ${smokeBoard.failingChecks[0]}` : null,
    fallbackTask ? `Fallback bewaakt via ${fallbackTask.title}.` : null,
    goNoBoard.decisionChecks[0] ?? null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  let watchStatusLabel = 'Bewaking opstarten';
  let watchTone: ReadinessRunbookScenarioWatchStartBoard['watchTone'] = 'warning';

  if (goNoBoard.goNoTone === 'danger' || smokeBoard.smokeTone === 'danger' || monitorBoard.monitorTone === 'danger') {
    watchStatusLabel = 'Bewaking vasthouden';
    watchTone = 'danger';
  } else if (goNoBoard.goNoTone === 'success' && smokeBoard.smokeTone === 'success' && startChecks.length > 0) {
    watchStatusLabel = 'Bewaking gestart';
    watchTone = 'success';
  } else if (startChecks.length > 0) {
    watchStatusLabel = 'Bewaking onder controle';
    watchTone = 'accent';
  }

  return {
    headline: `Bewakingsstart voor ${monitorBoard.activeItems[0]?.task?.title ?? goNoBoard.fallbackTask?.title ?? 'de livegang'}`,
    summary: `${watchStatusLabel}: ${armedSignals.length} armed signals, ${watchSignals.length} watch-signalen en ${startChecks.length} startchecks.`,
    watchStatusLabel,
    watchTone,
    confidenceScore: Math.round((goNoBoard.confidenceScore + smokeBoard.confidenceScore) / 2),
    ownerLabel: smokeBoard.ownerLabel,
    armedSignals,
    watchSignals,
    startChecks,
    fallbackTask,
  };
}

export function buildReadinessRunbookScenarioFirstHourBoard(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioFirstHourBoard | null {
  const watchStartBoard = buildReadinessRunbookScenarioWatchStartBoard(state, focus);
  const hypercareBoard = buildReadinessRunbookScenarioHypercareBoard(state, focus);
  const monitorBoard = buildReadinessRunbookScenarioMonitorBoard(state, focus);

  if (!watchStartBoard || !hypercareBoard || !monitorBoard) return null;

  const fallbackTask =
    hypercareBoard.fallbackTask ??
    watchStartBoard.fallbackTask ??
    monitorBoard.activeItems[0]?.task ??
    null;

  const stableSignals = [
    ...watchStartBoard.armedSignals.slice(0, 2),
    hypercareBoard.keepWarmTasks[0] ? `Warm houden via ${hypercareBoard.keepWarmTasks[0].task.title}.` : null,
    hypercareBoard.hypercareTone === 'success' ? `Hypercare op ${hypercareBoard.hypercareStatusLabel}.` : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const driftSignals = [
    ...watchStartBoard.watchSignals.slice(0, 2),
    hypercareBoard.escalateItems[0] ?? null,
    monitorBoard.openQuestions[0] ?? null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const firstHourChecks = [
    watchStartBoard.startChecks[0] ?? null,
    hypercareBoard.watchItems[0] ?? null,
    monitorBoard.activeItems[0] ? `${monitorBoard.activeItems[0].label}: ${monitorBoard.activeItems[0].detail}` : null,
    fallbackTask ? `Fallback beschikbaar via ${fallbackTask.title}.` : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  let firstHourStatusLabel = 'Eerste uur bewaken';
  let firstHourTone: ReadinessRunbookScenarioFirstHourBoard['firstHourTone'] = 'warning';

  if (
    watchStartBoard.watchTone === 'danger' ||
    hypercareBoard.hypercareTone === 'danger' ||
    monitorBoard.monitorTone === 'danger'
  ) {
    firstHourStatusLabel = 'Eerste uur onder druk';
    firstHourTone = 'danger';
  } else if (
    watchStartBoard.watchTone === 'success' &&
    hypercareBoard.hypercareTone === 'success' &&
    firstHourChecks.length > 0
  ) {
    firstHourStatusLabel = 'Eerste uur stabiel';
    firstHourTone = 'success';
  } else if (firstHourChecks.length > 0) {
    firstHourStatusLabel = 'Eerste uur onder controle';
    firstHourTone = 'accent';
  }

  return {
    headline: `Eerste uur na ${hypercareBoard.keepWarmTasks[0]?.task.title ?? watchStartBoard.fallbackTask?.title ?? 'de livegang'}`,
    summary: `${firstHourStatusLabel}: ${stableSignals.length} stabiele signalen, ${driftSignals.length} drift-signalen en ${firstHourChecks.length} uurchecks.`,
    firstHourStatusLabel,
    firstHourTone,
    confidenceScore: Math.round((watchStartBoard.confidenceScore + hypercareBoard.confidenceScore) / 2),
    ownerLabel: hypercareBoard.ownerLabel,
    stableSignals,
    driftSignals,
    firstHourChecks,
    fallbackTask,
  };
}

export function buildReadinessRunbookScenarioFirstDayBoard(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioFirstDayBoard | null {
  const firstHourBoard = buildReadinessRunbookScenarioFirstHourBoard(state, focus);
  const steadyStateBoard = buildReadinessRunbookScenarioSteadyStateBoard(state, focus);
  const monitorBoard = buildReadinessRunbookScenarioMonitorBoard(state, focus);

  if (!firstHourBoard || !steadyStateBoard || !monitorBoard) return null;

  const fallbackTask =
    steadyStateBoard.fallbackTask ??
    firstHourBoard.fallbackTask ??
    monitorBoard.activeItems[0]?.task ??
    null;

  const daySignals = [
    ...firstHourBoard.stableSignals.slice(0, 2),
    steadyStateBoard.keepAliveChecks[0] ?? null,
    steadyStateBoard.steadyTone === 'success' ? `Steady state op ${steadyStateBoard.steadyStatusLabel}.` : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const driftSignals = [
    ...firstHourBoard.driftSignals.slice(0, 2),
    steadyStateBoard.alertSignals[0] ?? null,
    monitorBoard.openQuestions[0] ?? null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const dayChecks = [
    firstHourBoard.firstHourChecks[0] ?? null,
    steadyStateBoard.watchItems[0] ?? null,
    monitorBoard.activeItems[0] ? `${monitorBoard.activeItems[0].label}: ${monitorBoard.activeItems[0].detail}` : null,
    fallbackTask ? `Fallback beschikbaar via ${fallbackTask.title}.` : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  let firstDayStatusLabel = 'Eerste dag bewaken';
  let firstDayTone: ReadinessRunbookScenarioFirstDayBoard['firstDayTone'] = 'warning';

  if (
    firstHourBoard.firstHourTone === 'danger' ||
    steadyStateBoard.steadyTone === 'danger' ||
    monitorBoard.monitorTone === 'danger'
  ) {
    firstDayStatusLabel = 'Eerste dag onder druk';
    firstDayTone = 'danger';
  } else if (
    firstHourBoard.firstHourTone === 'success' &&
    steadyStateBoard.steadyTone === 'success' &&
    dayChecks.length > 0
  ) {
    firstDayStatusLabel = 'Eerste dag stabiel';
    firstDayTone = 'success';
  } else if (dayChecks.length > 0) {
    firstDayStatusLabel = 'Eerste dag onder controle';
    firstDayTone = 'accent';
  }

  return {
    headline: `Eerste dag na ${steadyStateBoard.keepAliveChecks[0] ?? firstHourBoard.headline}`,
    summary: `${firstDayStatusLabel}: ${daySignals.length} dagsignalen, ${driftSignals.length} drift-signalen en ${dayChecks.length} dagchecks.`,
    firstDayStatusLabel,
    firstDayTone,
    confidenceScore: Math.round((firstHourBoard.confidenceScore + steadyStateBoard.confidenceScore) / 2),
    ownerLabel: steadyStateBoard.ownerLabel,
    daySignals,
    driftSignals,
    dayChecks,
    fallbackTask,
  };
}

export function buildReadinessRunbookScenarioFirstWeekBoard(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioFirstWeekBoard | null {
  const firstDayBoard = buildReadinessRunbookScenarioFirstDayBoard(state, focus);
  const steadyStateBoard = buildReadinessRunbookScenarioSteadyStateBoard(state, focus);
  const safeguardBoard = buildReadinessRunbookScenarioSafeguardBoard(state, focus);

  if (!firstDayBoard || !steadyStateBoard || !safeguardBoard) return null;

  const fallbackTask =
    steadyStateBoard.fallbackTask ??
    firstDayBoard.fallbackTask ??
    safeguardBoard.fallbackTask ??
    null;

  const weekSignals = [
    ...firstDayBoard.daySignals.slice(0, 2),
    steadyStateBoard.keepAliveChecks[0] ?? null,
    safeguardBoard.controlChecks[0] ?? null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const riskSignals = [
    ...firstDayBoard.driftSignals.slice(0, 2),
    safeguardBoard.cadenceSignals[0] ?? null,
    steadyStateBoard.alertSignals[0] ?? null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const weekChecks = [
    firstDayBoard.dayChecks[0] ?? null,
    steadyStateBoard.watchItems[0] ?? null,
    safeguardBoard.controlChecks[1] ?? null,
    fallbackTask ? `Fallback beschikbaar via ${fallbackTask.title}.` : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  let firstWeekStatusLabel = 'Eerste week bewaken';
  let firstWeekTone: ReadinessRunbookScenarioFirstWeekBoard['firstWeekTone'] = 'warning';

  if (
    firstDayBoard.firstDayTone === 'danger' ||
    steadyStateBoard.steadyTone === 'danger' ||
    safeguardBoard.safeguardTone === 'danger'
  ) {
    firstWeekStatusLabel = 'Eerste week onder druk';
    firstWeekTone = 'danger';
  } else if (
    firstDayBoard.firstDayTone === 'success' &&
    steadyStateBoard.steadyTone === 'success' &&
    weekChecks.length > 0
  ) {
    firstWeekStatusLabel = 'Eerste week stabiel';
    firstWeekTone = 'success';
  } else if (weekChecks.length > 0) {
    firstWeekStatusLabel = 'Eerste week onder controle';
    firstWeekTone = 'accent';
  }

  return {
    headline: `Eerste week na ${steadyStateBoard.keepAliveChecks[0] ?? firstDayBoard.headline}`,
    summary: `${firstWeekStatusLabel}: ${weekSignals.length} weeksignalen, ${riskSignals.length} risicosignalen en ${weekChecks.length} weekchecks.`,
    firstWeekStatusLabel,
    firstWeekTone,
    confidenceScore: Math.round((firstDayBoard.confidenceScore + steadyStateBoard.confidenceScore) / 2),
    ownerLabel: steadyStateBoard.ownerLabel,
    weekSignals,
    riskSignals,
    weekChecks,
    fallbackTask,
  };
}

export function buildReadinessRunbookScenarioFirstMonthBoard(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioFirstMonthBoard | null {
  const firstWeekBoard = buildReadinessRunbookScenarioFirstWeekBoard(state, focus);
  const steadyStateBoard = buildReadinessRunbookScenarioSteadyStateBoard(state, focus);
  const reviewBoard = buildReadinessRunbookScenarioReviewBoard(state, focus);

  if (!firstWeekBoard || !steadyStateBoard || !reviewBoard) return null;

  const fallbackTask =
    reviewBoard.fallbackTask ??
    steadyStateBoard.fallbackTask ??
    firstWeekBoard.fallbackTask ??
    null;

  const monthSignals = [
    ...firstWeekBoard.weekSignals.slice(0, 2),
    steadyStateBoard.keepAliveChecks[0] ?? null,
    reviewBoard.evidenceSignals[0] ?? null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const riskSignals = [
    ...firstWeekBoard.riskSignals.slice(0, 2),
    reviewBoard.reviewQuestions[0] ?? null,
    steadyStateBoard.alertSignals[0] ?? null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const monthChecks = [
    firstWeekBoard.weekChecks[0] ?? null,
    reviewBoard.evidenceSignals[1] ?? null,
    steadyStateBoard.watchItems[0] ?? null,
    fallbackTask ? `Fallback beschikbaar via ${fallbackTask.title}.` : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  let firstMonthStatusLabel = 'Eerste maand bewaken';
  let firstMonthTone: ReadinessRunbookScenarioFirstMonthBoard['firstMonthTone'] = 'warning';

  if (
    firstWeekBoard.firstWeekTone === 'danger' ||
    steadyStateBoard.steadyTone === 'danger' ||
    reviewBoard.reviewTone === 'danger'
  ) {
    firstMonthStatusLabel = 'Eerste maand onder druk';
    firstMonthTone = 'danger';
  } else if (
    firstWeekBoard.firstWeekTone === 'success' &&
    steadyStateBoard.steadyTone === 'success' &&
    monthChecks.length > 0
  ) {
    firstMonthStatusLabel = 'Eerste maand stabiel';
    firstMonthTone = 'success';
  } else if (monthChecks.length > 0) {
    firstMonthStatusLabel = 'Eerste maand onder controle';
    firstMonthTone = 'accent';
  }

  return {
    headline: `Eerste maand na ${reviewBoard.headline}`,
    summary: `${firstMonthStatusLabel}: ${monthSignals.length} maandsignalen, ${riskSignals.length} risicosignalen en ${monthChecks.length} maandchecks.`,
    firstMonthStatusLabel,
    firstMonthTone,
    confidenceScore: Math.round((firstWeekBoard.confidenceScore + reviewBoard.confidenceScore) / 2),
    ownerLabel: reviewBoard.ownerLabel,
    monthSignals,
    riskSignals,
    monthChecks,
    fallbackTask,
  };
}

export function buildReadinessRunbookScenarioFirstQuarterBoard(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioFirstQuarterBoard | null {
  const firstMonthBoard = buildReadinessRunbookScenarioFirstMonthBoard(state, focus);
  const safeguardBoard = buildReadinessRunbookScenarioSafeguardBoard(state, focus);
  const signoffBoard = buildReadinessRunbookScenarioSignoffBoard(state, focus);

  if (!firstMonthBoard || !safeguardBoard || !signoffBoard) return null;

  const fallbackTask =
    signoffBoard.fallbackTask ??
    safeguardBoard.fallbackTask ??
    firstMonthBoard.fallbackTask ??
    null;

  const quarterSignals = [
    ...firstMonthBoard.monthSignals.slice(0, 2),
    safeguardBoard.controlChecks[0] ?? null,
    signoffBoard.releaseChecks[0] ?? null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const riskSignals = [
    ...firstMonthBoard.riskSignals.slice(0, 2),
    signoffBoard.signoffConditions[0] ?? null,
    safeguardBoard.cadenceSignals[0] ?? null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const quarterChecks = [
    firstMonthBoard.monthChecks[0] ?? null,
    signoffBoard.approverSignals[0] ?? null,
    safeguardBoard.ownershipSignals[0] ?? null,
    fallbackTask ? `Fallback beschikbaar via ${fallbackTask.title}.` : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  let firstQuarterStatusLabel = 'Eerste kwartaal bewaken';
  let firstQuarterTone: ReadinessRunbookScenarioFirstQuarterBoard['firstQuarterTone'] = 'warning';

  if (
    firstMonthBoard.firstMonthTone === 'danger' ||
    safeguardBoard.safeguardTone === 'danger' ||
    signoffBoard.signoffTone === 'danger'
  ) {
    firstQuarterStatusLabel = 'Eerste kwartaal onder druk';
    firstQuarterTone = 'danger';
  } else if (
    firstMonthBoard.firstMonthTone === 'success' &&
    safeguardBoard.safeguardTone === 'success' &&
    quarterChecks.length > 0
  ) {
    firstQuarterStatusLabel = 'Eerste kwartaal stabiel';
    firstQuarterTone = 'success';
  } else if (quarterChecks.length > 0) {
    firstQuarterStatusLabel = 'Eerste kwartaal onder controle';
    firstQuarterTone = 'accent';
  }

  return {
    headline: `Eerste kwartaal na ${signoffBoard.headline}`,
    summary: `${firstQuarterStatusLabel}: ${quarterSignals.length} kwartaal-signalen, ${riskSignals.length} risicosignalen en ${quarterChecks.length} kwartaalchecks.`,
    firstQuarterStatusLabel,
    firstQuarterTone,
    confidenceScore: Math.round((firstMonthBoard.confidenceScore + signoffBoard.confidenceScore) / 2),
    ownerLabel: signoffBoard.ownerLabel,
    quarterSignals,
    riskSignals,
    quarterChecks,
    fallbackTask,
  };
}

export function buildReadinessRunbookScenarioFirstYearBoard(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioFirstYearBoard | null {
  const firstQuarterBoard = buildReadinessRunbookScenarioFirstQuarterBoard(state, focus);
  const signoffBoard = buildReadinessRunbookScenarioSignoffBoard(state, focus);
  const acceptanceBoard = buildReadinessRunbookScenarioAcceptanceBoard(state, focus);

  if (!firstQuarterBoard || !signoffBoard || !acceptanceBoard) return null;

  const fallbackTask =
    acceptanceBoard.fallbackTask ??
    signoffBoard.fallbackTask ??
    firstQuarterBoard.fallbackTask ??
    null;

  const yearSignals = [
    ...firstQuarterBoard.quarterSignals.slice(0, 2),
    signoffBoard.releaseChecks[0] ?? null,
    acceptanceBoard.acceptanceSignals[0] ?? null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const riskSignals = [
    ...firstQuarterBoard.riskSignals.slice(0, 2),
    signoffBoard.signoffConditions[0] ?? null,
    acceptanceBoard.watchSignals[0] ?? null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const yearChecks = [
    firstQuarterBoard.quarterChecks[0] ?? null,
    signoffBoard.approverSignals[0] ?? null,
    acceptanceBoard.readinessChecks[0] ?? null,
    fallbackTask ? `Fallback beschikbaar via ${fallbackTask.title}.` : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  let firstYearStatusLabel = 'Eerste jaar bewaken';
  let firstYearTone: ReadinessRunbookScenarioFirstYearBoard['firstYearTone'] = 'warning';

  if (
    firstQuarterBoard.firstQuarterTone === 'danger' ||
    signoffBoard.signoffTone === 'danger' ||
    acceptanceBoard.acceptanceTone === 'danger'
  ) {
    firstYearStatusLabel = 'Eerste jaar onder druk';
    firstYearTone = 'danger';
  } else if (
    firstQuarterBoard.firstQuarterTone === 'success' &&
    signoffBoard.signoffTone === 'success' &&
    yearChecks.length > 0
  ) {
    firstYearStatusLabel = 'Eerste jaar stabiel';
    firstYearTone = 'success';
  } else if (yearChecks.length > 0) {
    firstYearStatusLabel = 'Eerste jaar onder controle';
    firstYearTone = 'accent';
  }

  return {
    headline: `Eerste jaar na ${acceptanceBoard.headline}`,
    summary: `${firstYearStatusLabel}: ${yearSignals.length} jaarsignalen, ${riskSignals.length} risicosignalen en ${yearChecks.length} jaarchecks.`,
    firstYearStatusLabel,
    firstYearTone,
    confidenceScore: Math.round((firstQuarterBoard.confidenceScore + acceptanceBoard.confidenceScore) / 2),
    ownerLabel: acceptanceBoard.ownerLabel,
    yearSignals,
    riskSignals,
    yearChecks,
    fallbackTask,
  };
}

export function buildReadinessRunbookScenarioMultiYearBoard(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioMultiYearBoard | null {
  const firstYearBoard = buildReadinessRunbookScenarioFirstYearBoard(state, focus);
  const safeguardBoard = buildReadinessRunbookScenarioSafeguardBoard(state, focus);
  const reviewBoard = buildReadinessRunbookScenarioReviewBoard(state, focus);

  if (!firstYearBoard || !safeguardBoard || !reviewBoard) return null;

  const fallbackTask =
    reviewBoard.fallbackTask ??
    safeguardBoard.fallbackTask ??
    firstYearBoard.fallbackTask ??
    null;

  const longSignals = [
    ...firstYearBoard.yearSignals.slice(0, 2),
    safeguardBoard.ownershipSignals[0] ?? null,
    reviewBoard.evidenceSignals[0] ?? null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const riskSignals = [
    ...firstYearBoard.riskSignals.slice(0, 2),
    reviewBoard.reviewQuestions[0] ?? null,
    safeguardBoard.cadenceSignals[0] ?? null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const multiYearChecks = [
    firstYearBoard.yearChecks[0] ?? null,
    safeguardBoard.controlChecks[0] ?? null,
    reviewBoard.approvalChecks[0] ?? null,
    fallbackTask ? `Fallback beschikbaar via ${fallbackTask.title}.` : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  let multiYearStatusLabel = 'Meerjarenlaag bewaken';
  let multiYearTone: ReadinessRunbookScenarioMultiYearBoard['multiYearTone'] = 'warning';

  if (
    firstYearBoard.firstYearTone === 'danger' ||
    safeguardBoard.safeguardTone === 'danger' ||
    reviewBoard.reviewTone === 'danger'
  ) {
    multiYearStatusLabel = 'Meerjarenlaag onder druk';
    multiYearTone = 'danger';
  } else if (
    firstYearBoard.firstYearTone === 'success' &&
    safeguardBoard.safeguardTone === 'success' &&
    multiYearChecks.length > 0
  ) {
    multiYearStatusLabel = 'Meerjarenlaag stabiel';
    multiYearTone = 'success';
  } else if (multiYearChecks.length > 0) {
    multiYearStatusLabel = 'Meerjarenlaag onder controle';
    multiYearTone = 'accent';
  }

  return {
    headline: `Meerjarenlaag na ${reviewBoard.headline}`,
    summary: `${multiYearStatusLabel}: ${longSignals.length} lange signalen, ${riskSignals.length} risicosignalen en ${multiYearChecks.length} meerjarenchecks.`,
    multiYearStatusLabel,
    multiYearTone,
    confidenceScore: Math.round((firstYearBoard.confidenceScore + reviewBoard.confidenceScore) / 2),
    ownerLabel: reviewBoard.ownerLabel,
    longSignals,
    riskSignals,
    multiYearChecks,
    fallbackTask,
  };
}

export function buildReadinessRunbookScenarioContinuityBoard(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioContinuityBoard | null {
  const multiYearBoard = buildReadinessRunbookScenarioMultiYearBoard(state, focus);
  const steadyStateBoard = buildReadinessRunbookScenarioSteadyStateBoard(state, focus);
  const incidentBoard = buildReadinessRunbookScenarioIncidentBoard(state, focus);

  if (!multiYearBoard || !steadyStateBoard || !incidentBoard) return null;

  const fallbackTask =
    incidentBoard.fallbackTask ??
    steadyStateBoard.fallbackTask ??
    multiYearBoard.fallbackTask ??
    null;

  const continuitySignals = [
    ...multiYearBoard.longSignals.slice(0, 2),
    steadyStateBoard.keepAliveChecks[0] ?? null,
    incidentBoard.firstResponseSignals.length === 0 ? 'Geen directe incidentdruk zichtbaar.' : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const riskSignals = [
    ...multiYearBoard.riskSignals.slice(0, 2),
    incidentBoard.investigateSignals[0] ?? null,
    steadyStateBoard.alertSignals[0] ?? null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const continuityChecks = [
    multiYearBoard.multiYearChecks[0] ?? null,
    steadyStateBoard.watchItems[0] ?? null,
    incidentBoard.escalateSignals[0] ?? null,
    fallbackTask ? `Fallback beschikbaar via ${fallbackTask.title}.` : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  let continuityStatusLabel = 'Continuiteit bewaken';
  let continuityTone: ReadinessRunbookScenarioContinuityBoard['continuityTone'] = 'warning';

  if (
    multiYearBoard.multiYearTone === 'danger' ||
    steadyStateBoard.steadyTone === 'danger' ||
    incidentBoard.incidentTone === 'danger'
  ) {
    continuityStatusLabel = 'Continuiteit onder druk';
    continuityTone = 'danger';
  } else if (
    multiYearBoard.multiYearTone === 'success' &&
    steadyStateBoard.steadyTone === 'success' &&
    continuityChecks.length > 0
  ) {
    continuityStatusLabel = 'Continuiteit stabiel';
    continuityTone = 'success';
  } else if (continuityChecks.length > 0) {
    continuityStatusLabel = 'Continuiteit onder controle';
    continuityTone = 'accent';
  }

  return {
    headline: `Continuiteit na ${multiYearBoard.headline}`,
    summary: `${continuityStatusLabel}: ${continuitySignals.length} continuiteitssignalen, ${riskSignals.length} risicosignalen en ${continuityChecks.length} continuiteitschecks.`,
    continuityStatusLabel,
    continuityTone,
    confidenceScore: Math.round((multiYearBoard.confidenceScore + steadyStateBoard.confidenceScore) / 2),
    ownerLabel: steadyStateBoard.ownerLabel,
    continuitySignals,
    riskSignals,
    continuityChecks,
    fallbackTask,
  };
}

export function buildReadinessRunbookScenarioHealthBoard(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioHealthBoard | null {
  const continuityBoard = buildReadinessRunbookScenarioContinuityBoard(state, focus);
  const steadyStateBoard = buildReadinessRunbookScenarioSteadyStateBoard(state, focus);
  const monitorBoard = buildReadinessRunbookScenarioMonitorBoard(state, focus);

  if (!continuityBoard || !steadyStateBoard || !monitorBoard) return null;

  const fallbackTask =
    continuityBoard.fallbackTask ??
    steadyStateBoard.fallbackTask ??
    monitorBoard.activeItems[0]?.task ??
    null;

  const healthSignals = [
    ...continuityBoard.continuitySignals.slice(0, 2),
    steadyStateBoard.keepAliveChecks[0] ?? null,
    monitorBoard.activeItems[0]
      ? `${monitorBoard.activeItems[0].label}: ${monitorBoard.activeItems[0].task?.title ?? monitorBoard.activeItems[0].detail}`
      : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const watchSignals = [
    ...continuityBoard.riskSignals.slice(0, 2),
    ...monitorBoard.openQuestions.slice(0, 2),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const healthChecks = [
    continuityBoard.continuityChecks[0] ?? null,
    steadyStateBoard.watchItems[0] ?? null,
    monitorBoard.monitorTone === 'success' ? 'Monitor staat al op een stabiele basis.' : null,
    fallbackTask ? `Fallback warm houden via ${fallbackTask.title}.` : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  let healthStatusLabel = 'Gezondheid bewaken';
  let healthTone: ReadinessRunbookScenarioHealthBoard['healthTone'] = 'warning';

  if (
    continuityBoard.continuityTone === 'danger' ||
    steadyStateBoard.steadyTone === 'danger' ||
    monitorBoard.monitorTone === 'danger'
  ) {
    healthStatusLabel = 'Gezondheid onder druk';
    healthTone = 'danger';
  } else if (
    continuityBoard.continuityTone === 'success' &&
    steadyStateBoard.steadyTone === 'success' &&
    monitorBoard.monitorTone === 'success'
  ) {
    healthStatusLabel = 'Gezondheid stabiel';
    healthTone = 'success';
  } else if (healthChecks.length >= 2) {
    healthStatusLabel = 'Gezondheid onder controle';
    healthTone = 'accent';
  }

  return {
    headline: `Gezondheid na ${continuityBoard.headline}`,
    summary: `${healthStatusLabel}: ${healthSignals.length} gezondheidssignalen, ${watchSignals.length} watch-signalen en ${healthChecks.length} gezondheidschecks.`,
    healthStatusLabel,
    healthTone,
    confidenceScore: Math.round(
      (continuityBoard.confidenceScore + steadyStateBoard.confidenceScore) / 2
    ),
    ownerLabel: continuityBoard.ownerLabel,
    healthSignals,
    watchSignals,
    healthChecks,
    fallbackTask,
  };
}

export function buildReadinessRunbookScenarioResilienceBoard(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioResilienceBoard | null {
  const healthBoard = buildReadinessRunbookScenarioHealthBoard(state, focus);
  const continuityBoard = buildReadinessRunbookScenarioContinuityBoard(state, focus);
  const incidentBoard = buildReadinessRunbookScenarioIncidentBoard(state, focus);

  if (!healthBoard || !continuityBoard || !incidentBoard) return null;

  const fallbackTask =
    incidentBoard.fallbackTask ??
    healthBoard.fallbackTask ??
    continuityBoard.fallbackTask ??
    null;

  const resilienceSignals = [
    ...healthBoard.healthSignals.slice(0, 2),
    continuityBoard.continuityChecks[0] ?? null,
    incidentBoard.firstResponseSignals.length === 0 ? 'Geen acute incidentdruk zichtbaar.' : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const pressureSignals = [
    ...healthBoard.watchSignals.slice(0, 2),
    ...incidentBoard.firstResponseSignals.slice(0, 2),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const resilienceChecks = [
    healthBoard.healthChecks[0] ?? null,
    continuityBoard.continuityChecks[0] ?? null,
    incidentBoard.escalateSignals[0] ?? null,
    fallbackTask ? `Terugvalpad beschikbaar via ${fallbackTask.title}.` : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  let resilienceStatusLabel = 'Weerbaarheid bewaken';
  let resilienceTone: ReadinessRunbookScenarioResilienceBoard['resilienceTone'] = 'warning';

  if (
    healthBoard.healthTone === 'danger' ||
    continuityBoard.continuityTone === 'danger' ||
    incidentBoard.incidentTone === 'danger'
  ) {
    resilienceStatusLabel = 'Weerbaarheid onder druk';
    resilienceTone = 'danger';
  } else if (
    healthBoard.healthTone === 'success' &&
    continuityBoard.continuityTone === 'success' &&
    pressureSignals.length <= 1
  ) {
    resilienceStatusLabel = 'Weerbaarheid stabiel';
    resilienceTone = 'success';
  } else if (resilienceChecks.length >= 2) {
    resilienceStatusLabel = 'Weerbaarheid onder controle';
    resilienceTone = 'accent';
  }

  return {
    headline: `Weerbaarheid na ${healthBoard.headline}`,
    summary: `${resilienceStatusLabel}: ${resilienceSignals.length} weerbaarheidssignalen, ${pressureSignals.length} druksignalen en ${resilienceChecks.length} weerbaarheidschecks.`,
    resilienceStatusLabel,
    resilienceTone,
    confidenceScore: Math.round((healthBoard.confidenceScore + continuityBoard.confidenceScore) / 2),
    ownerLabel: healthBoard.ownerLabel,
    resilienceSignals,
    pressureSignals,
    resilienceChecks,
    fallbackTask,
  };
}

export function buildReadinessRunbookScenarioCapacityBoard(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioCapacityBoard | null {
  const resilienceBoard = buildReadinessRunbookScenarioResilienceBoard(state, focus);
  const healthBoard = buildReadinessRunbookScenarioHealthBoard(state, focus);
  const monitorBoard = buildReadinessRunbookScenarioMonitorBoard(state, focus);

  if (!resilienceBoard || !healthBoard || !monitorBoard) return null;

  const fallbackTask =
    resilienceBoard.fallbackTask ??
    healthBoard.fallbackTask ??
    monitorBoard.activeItems[0]?.task ??
    null;

  const capacitySignals = [
    ...resilienceBoard.resilienceSignals.slice(0, 2),
    healthBoard.healthChecks[0] ?? null,
    monitorBoard.activeItems.length <= 1 ? 'Beperkte actieve monitorlast zichtbaar.' : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const loadSignals = [
    ...resilienceBoard.pressureSignals.slice(0, 2),
    ...monitorBoard.activeItems
      .map((item) => `${item.label}: ${item.task?.title ?? item.detail}`)
      .slice(0, 2),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const capacityChecks = [
    resilienceBoard.resilienceChecks[0] ?? null,
    healthBoard.healthChecks[0] ?? null,
    monitorBoard.openQuestions[0] ? `Open vraag blijft: ${monitorBoard.openQuestions[0]}` : null,
    fallbackTask ? `Terugval beschikbaar via ${fallbackTask.title}.` : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  let capacityStatusLabel = 'Draagkracht bewaken';
  let capacityTone: ReadinessRunbookScenarioCapacityBoard['capacityTone'] = 'warning';

  if (resilienceBoard.resilienceTone === 'danger' || monitorBoard.monitorTone === 'danger') {
    capacityStatusLabel = 'Draagkracht onder druk';
    capacityTone = 'danger';
  } else if (
    resilienceBoard.resilienceTone === 'success' &&
    healthBoard.healthTone === 'success' &&
    loadSignals.length <= 2
  ) {
    capacityStatusLabel = 'Draagkracht stabiel';
    capacityTone = 'success';
  } else if (capacityChecks.length >= 2) {
    capacityStatusLabel = 'Draagkracht onder controle';
    capacityTone = 'accent';
  }

  return {
    headline: `Draagkracht na ${resilienceBoard.headline}`,
    summary: `${capacityStatusLabel}: ${capacitySignals.length} draagkrachtsignalen, ${loadSignals.length} load-signalen en ${capacityChecks.length} draagkrachtchecks.`,
    capacityStatusLabel,
    capacityTone,
    confidenceScore: Math.round((resilienceBoard.confidenceScore + healthBoard.confidenceScore) / 2),
    ownerLabel: resilienceBoard.ownerLabel,
    capacitySignals,
    loadSignals,
    capacityChecks,
    fallbackTask,
  };
}

export function buildReadinessRunbookScenarioBufferBoard(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioBufferBoard | null {
  const capacityBoard = buildReadinessRunbookScenarioCapacityBoard(state, focus);
  const resilienceBoard = buildReadinessRunbookScenarioResilienceBoard(state, focus);
  const monitorBoard = buildReadinessRunbookScenarioMonitorBoard(state, focus);

  if (!capacityBoard || !resilienceBoard || !monitorBoard) return null;

  const fallbackTask =
    capacityBoard.fallbackTask ??
    resilienceBoard.fallbackTask ??
    monitorBoard.activeItems[0]?.task ??
    null;

  const bufferSignals = [
    ...capacityBoard.capacitySignals.slice(0, 2),
    resilienceBoard.resilienceChecks[0] ?? null,
    monitorBoard.activeItems.length <= 2 ? 'Monitorruimte blijft beheersbaar.' : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const pressureSignals = [
    ...capacityBoard.loadSignals.slice(0, 2),
    ...monitorBoard.activeItems
      .map((item) => `${item.label}: ${item.task?.title ?? item.detail}`)
      .slice(0, 2),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const bufferChecks = [
    capacityBoard.capacityChecks[0] ?? null,
    resilienceBoard.resilienceChecks[0] ?? null,
    monitorBoard.openQuestions[0] ? `Open monitorvraag: ${monitorBoard.openQuestions[0]}` : null,
    fallbackTask ? `Buffer terugval via ${fallbackTask.title}.` : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  let bufferStatusLabel = 'Buffer bewaken';
  let bufferTone: ReadinessRunbookScenarioBufferBoard['bufferTone'] = 'warning';

  if (capacityBoard.capacityTone === 'danger' || monitorBoard.monitorTone === 'danger') {
    bufferStatusLabel = 'Buffer onder druk';
    bufferTone = 'danger';
  } else if (
    capacityBoard.capacityTone === 'success' &&
    resilienceBoard.resilienceTone === 'success' &&
    pressureSignals.length <= 2
  ) {
    bufferStatusLabel = 'Buffer stabiel';
    bufferTone = 'success';
  } else if (bufferChecks.length >= 2) {
    bufferStatusLabel = 'Buffer onder controle';
    bufferTone = 'accent';
  }

  return {
    headline: `Buffer na ${capacityBoard.headline}`,
    summary: `${bufferStatusLabel}: ${bufferSignals.length} buffersignalen, ${pressureSignals.length} druksignalen en ${bufferChecks.length} bufferchecks.`,
    bufferStatusLabel,
    bufferTone,
    confidenceScore: Math.round((capacityBoard.confidenceScore + resilienceBoard.confidenceScore) / 2),
    ownerLabel: capacityBoard.ownerLabel,
    bufferSignals,
    pressureSignals,
    bufferChecks,
    fallbackTask,
  };
}

export function buildReadinessRunbookScenarioSlackBoard(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioSlackBoard | null {
  const bufferBoard = buildReadinessRunbookScenarioBufferBoard(state, focus);
  const capacityBoard = buildReadinessRunbookScenarioCapacityBoard(state, focus);
  const monitorBoard = buildReadinessRunbookScenarioMonitorBoard(state, focus);

  if (!bufferBoard || !capacityBoard || !monitorBoard) return null;

  const fallbackTask =
    bufferBoard.fallbackTask ??
    capacityBoard.fallbackTask ??
    monitorBoard.activeItems[0]?.task ??
    null;

  const slackSignals = [
    ...bufferBoard.bufferSignals.slice(0, 2),
    capacityBoard.capacityChecks[0] ?? null,
    monitorBoard.activeItems.length <= 2 ? 'Nog voldoende operationele speling zichtbaar.' : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const pressureSignals = [
    ...bufferBoard.pressureSignals.slice(0, 2),
    ...monitorBoard.activeItems
      .map((item) => `${item.label}: ${item.task?.title ?? item.detail}`)
      .slice(0, 2),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const slackChecks = [
    bufferBoard.bufferChecks[0] ?? null,
    capacityBoard.capacityChecks[0] ?? null,
    monitorBoard.openQuestions[0] ? `Monitorvraag blijft open: ${monitorBoard.openQuestions[0]}` : null,
    fallbackTask ? `Speling terugval via ${fallbackTask.title}.` : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  let slackStatusLabel = 'Speling bewaken';
  let slackTone: ReadinessRunbookScenarioSlackBoard['slackTone'] = 'warning';

  if (bufferBoard.bufferTone === 'danger' || monitorBoard.monitorTone === 'danger') {
    slackStatusLabel = 'Speling onder druk';
    slackTone = 'danger';
  } else if (
    bufferBoard.bufferTone === 'success' &&
    capacityBoard.capacityTone === 'success' &&
    pressureSignals.length <= 2
  ) {
    slackStatusLabel = 'Speling stabiel';
    slackTone = 'success';
  } else if (slackChecks.length >= 2) {
    slackStatusLabel = 'Speling onder controle';
    slackTone = 'accent';
  }

  return {
    headline: `Speling na ${bufferBoard.headline}`,
    summary: `${slackStatusLabel}: ${slackSignals.length} spelingssignalen, ${pressureSignals.length} druksignalen en ${slackChecks.length} spelingchecks.`,
    slackStatusLabel,
    slackTone,
    confidenceScore: Math.round((bufferBoard.confidenceScore + capacityBoard.confidenceScore) / 2),
    ownerLabel: bufferBoard.ownerLabel,
    slackSignals,
    pressureSignals,
    slackChecks,
    fallbackTask,
  };
}

export function buildReadinessRunbookScenarioWatchBoard(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioWatchBoard | null {
  const slackBoard = buildReadinessRunbookScenarioSlackBoard(state, focus);
  const bufferBoard = buildReadinessRunbookScenarioBufferBoard(state, focus);
  const monitorBoard = buildReadinessRunbookScenarioMonitorBoard(state, focus);

  if (!slackBoard || !bufferBoard || !monitorBoard) return null;

  const fallbackTask =
    slackBoard.fallbackTask ??
    bufferBoard.fallbackTask ??
    monitorBoard.activeItems[0]?.task ??
    null;

  const watchSignals = [
    ...slackBoard.slackSignals.slice(0, 2),
    bufferBoard.bufferChecks[0] ?? null,
    monitorBoard.activeItems.length <= 2 ? 'Waaklast blijft binnen een beheersbare band.' : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const alertSignals = [
    ...slackBoard.pressureSignals.slice(0, 2),
    ...monitorBoard.activeItems
      .filter((item) => item.tone === 'danger' || item.tone === 'warning')
      .map((item) => `${item.label}: ${item.task?.title ?? item.detail}`)
      .slice(0, 2),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const watchChecks = [
    slackBoard.slackChecks[0] ?? null,
    bufferBoard.bufferChecks[0] ?? null,
    monitorBoard.openQuestions[0] ? `Waakvraag blijft open: ${monitorBoard.openQuestions[0]}` : null,
    fallbackTask ? `Waakfallback via ${fallbackTask.title}.` : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  let watchStatusLabel = 'Waaklaag bewaken';
  let watchTone: ReadinessRunbookScenarioWatchBoard['watchTone'] = 'warning';

  if (slackBoard.slackTone === 'danger' || monitorBoard.monitorTone === 'danger') {
    watchStatusLabel = 'Waaklaag onder druk';
    watchTone = 'danger';
  } else if (
    slackBoard.slackTone === 'success' &&
    bufferBoard.bufferTone === 'success' &&
    alertSignals.length <= 2
  ) {
    watchStatusLabel = 'Waaklaag stabiel';
    watchTone = 'success';
  } else if (watchChecks.length >= 2) {
    watchStatusLabel = 'Waaklaag onder controle';
    watchTone = 'accent';
  }

  return {
    headline: `Waaklaag na ${slackBoard.headline}`,
    summary: `${watchStatusLabel}: ${watchSignals.length} waaksignalen, ${alertSignals.length} alertsignalen en ${watchChecks.length} waakchecks.`,
    watchStatusLabel,
    watchTone,
    confidenceScore: Math.round((slackBoard.confidenceScore + bufferBoard.confidenceScore) / 2),
    ownerLabel: slackBoard.ownerLabel,
    watchSignals,
    alertSignals,
    watchChecks,
    fallbackTask,
  };
}

export function buildReadinessRunbookScenarioTakeoverBoard(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioTakeoverBoard | null {
  const watchBoard = buildReadinessRunbookScenarioWatchBoard(state, focus);
  const slackBoard = buildReadinessRunbookScenarioSlackBoard(state, focus);
  const monitorBoard = buildReadinessRunbookScenarioMonitorBoard(state, focus);

  if (!watchBoard || !slackBoard || !monitorBoard) return null;

  const fallbackTask =
    watchBoard.fallbackTask ??
    slackBoard.fallbackTask ??
    monitorBoard.activeItems[0]?.task ??
    null;

  const takeoverSignals = [
    ...watchBoard.watchSignals.slice(0, 2),
    slackBoard.slackChecks[0] ?? null,
    monitorBoard.activeItems.length <= 2 ? 'Volledige monitoring kan beheerst overnemen.' : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const alertSignals = [
    ...watchBoard.alertSignals.slice(0, 2),
    ...monitorBoard.activeItems
      .map((item) => `${item.label}: ${item.task?.title ?? item.detail}`)
      .slice(0, 2),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const takeoverChecks = [
    watchBoard.watchChecks[0] ?? null,
    slackBoard.slackChecks[0] ?? null,
    monitorBoard.openQuestions[0] ? `Overnamevraag open: ${monitorBoard.openQuestions[0]}` : null,
    fallbackTask ? `Overnamefallback via ${fallbackTask.title}.` : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  let takeoverStatusLabel = 'Overname bewaken';
  let takeoverTone: ReadinessRunbookScenarioTakeoverBoard['takeoverTone'] = 'warning';

  if (watchBoard.watchTone === 'danger' || monitorBoard.monitorTone === 'danger') {
    takeoverStatusLabel = 'Overname onder druk';
    takeoverTone = 'danger';
  } else if (
    watchBoard.watchTone === 'success' &&
    slackBoard.slackTone === 'success' &&
    alertSignals.length <= 2
  ) {
    takeoverStatusLabel = 'Overname stabiel';
    takeoverTone = 'success';
  } else if (takeoverChecks.length >= 2) {
    takeoverStatusLabel = 'Overname onder controle';
    takeoverTone = 'accent';
  }

  return {
    headline: `Overname na ${watchBoard.headline}`,
    summary: `${takeoverStatusLabel}: ${takeoverSignals.length} overnamesignalen, ${alertSignals.length} alertsignalen en ${takeoverChecks.length} overnamechecks.`,
    takeoverStatusLabel,
    takeoverTone,
    confidenceScore: Math.round((watchBoard.confidenceScore + slackBoard.confidenceScore) / 2),
    ownerLabel: watchBoard.ownerLabel,
    takeoverSignals,
    alertSignals,
    takeoverChecks,
    fallbackTask,
  };
}

export function buildReadinessRunbookScenarioStartBoard(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioStartBoard | null {
  const takeoverBoard = buildReadinessRunbookScenarioTakeoverBoard(state, focus);
  const watchBoard = buildReadinessRunbookScenarioWatchBoard(state, focus);
  const monitorBoard = buildReadinessRunbookScenarioMonitorBoard(state, focus);

  if (!takeoverBoard || !watchBoard || !monitorBoard) return null;

  const fallbackTask =
    takeoverBoard.fallbackTask ??
    watchBoard.fallbackTask ??
    monitorBoard.activeItems[0]?.task ??
    null;

  const startSignals = [
    ...takeoverBoard.takeoverSignals.slice(0, 2),
    watchBoard.watchChecks[0] ?? null,
    monitorBoard.activeItems.length <= 2 ? 'Monitor kan in een beheerst opstartritme starten.' : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const alertSignals = [
    ...takeoverBoard.alertSignals.slice(0, 2),
    ...monitorBoard.activeItems
      .filter((item) => item.tone === 'danger' || item.tone === 'warning')
      .map((item) => `${item.label}: ${item.task?.title ?? item.detail}`)
      .slice(0, 2),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const startChecks = [
    takeoverBoard.takeoverChecks[0] ?? null,
    watchBoard.watchChecks[0] ?? null,
    monitorBoard.openQuestions[0] ? `Opstartvraag open: ${monitorBoard.openQuestions[0]}` : null,
    fallbackTask ? `Opstartfallback via ${fallbackTask.title}.` : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  let startStatusLabel = 'Opstart bewaken';
  let startTone: ReadinessRunbookScenarioStartBoard['startTone'] = 'warning';

  if (takeoverBoard.takeoverTone === 'danger' || monitorBoard.monitorTone === 'danger') {
    startStatusLabel = 'Opstart onder druk';
    startTone = 'danger';
  } else if (
    takeoverBoard.takeoverTone === 'success' &&
    watchBoard.watchTone === 'success' &&
    alertSignals.length <= 2
  ) {
    startStatusLabel = 'Opstart stabiel';
    startTone = 'success';
  } else if (startChecks.length >= 2) {
    startStatusLabel = 'Opstart onder controle';
    startTone = 'accent';
  }

  return {
    headline: `Opstart na ${takeoverBoard.headline}`,
    summary: `${startStatusLabel}: ${startSignals.length} opstartsignalen, ${alertSignals.length} alertsignalen en ${startChecks.length} opstartchecks.`,
    startStatusLabel,
    startTone,
    confidenceScore: Math.round((takeoverBoard.confidenceScore + watchBoard.confidenceScore) / 2),
    ownerLabel: takeoverBoard.ownerLabel,
    startSignals,
    alertSignals,
    startChecks,
    fallbackTask,
  };
}

export function buildReadinessRunbookScenarioSwitchOnBoard(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioSwitchOnBoard | null {
  const startBoard = buildReadinessRunbookScenarioStartBoard(state, focus);
  const takeoverBoard = buildReadinessRunbookScenarioTakeoverBoard(state, focus);
  const monitorBoard = buildReadinessRunbookScenarioMonitorBoard(state, focus);

  if (!startBoard || !takeoverBoard || !monitorBoard) return null;

  const fallbackTask =
    startBoard.fallbackTask ??
    takeoverBoard.fallbackTask ??
    monitorBoard.activeItems[0]?.task ??
    null;

  const switchSignals = [
    ...startBoard.startSignals.slice(0, 2),
    takeoverBoard.takeoverChecks[0] ?? null,
    monitorBoard.activeItems.length <= 2 ? 'Monitoring kan gecontroleerd worden ingeschakeld.' : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const alertSignals = [
    ...startBoard.alertSignals.slice(0, 2),
    ...monitorBoard.activeItems
      .filter((item) => item.tone === 'danger' || item.tone === 'warning')
      .map((item) => `${item.label}: ${item.task?.title ?? item.detail}`)
      .slice(0, 2),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const switchChecks = [
    startBoard.startChecks[0] ?? null,
    takeoverBoard.takeoverChecks[0] ?? null,
    monitorBoard.openQuestions[0] ? `Inschakelvraag open: ${monitorBoard.openQuestions[0]}` : null,
    fallbackTask ? `Inschakelfallback via ${fallbackTask.title}.` : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  let switchStatusLabel = 'Inschakelen bewaken';
  let switchTone: ReadinessRunbookScenarioSwitchOnBoard['switchTone'] = 'warning';

  if (startBoard.startTone === 'danger' || monitorBoard.monitorTone === 'danger') {
    switchStatusLabel = 'Inschakelen onder druk';
    switchTone = 'danger';
  } else if (
    startBoard.startTone === 'success' &&
    takeoverBoard.takeoverTone === 'success' &&
    alertSignals.length <= 2
  ) {
    switchStatusLabel = 'Inschakelen stabiel';
    switchTone = 'success';
  } else if (switchChecks.length >= 2) {
    switchStatusLabel = 'Inschakelen onder controle';
    switchTone = 'accent';
  }

  return {
    headline: `Inschakelen na ${startBoard.headline}`,
    summary: `${switchStatusLabel}: ${switchSignals.length} inschakelsignalen, ${alertSignals.length} alertsignalen en ${switchChecks.length} inschakelchecks.`,
    switchStatusLabel,
    switchTone,
    confidenceScore: Math.round((startBoard.confidenceScore + takeoverBoard.confidenceScore) / 2),
    ownerLabel: startBoard.ownerLabel,
    switchSignals,
    alertSignals,
    switchChecks,
    fallbackTask,
  };
}

export function buildReadinessRunbookScenarioLinkBoard(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioLinkBoard | null {
  const switchBoard = buildReadinessRunbookScenarioSwitchOnBoard(state, focus);
  const startBoard = buildReadinessRunbookScenarioStartBoard(state, focus);
  const monitorBoard = buildReadinessRunbookScenarioMonitorBoard(state, focus);

  if (!switchBoard || !startBoard || !monitorBoard) return null;

  const fallbackTask =
    switchBoard.fallbackTask ??
    startBoard.fallbackTask ??
    monitorBoard.activeItems[0]?.task ??
    null;

  const linkSignals = [
    ...switchBoard.switchSignals.slice(0, 2),
    startBoard.startChecks[0] ?? null,
    monitorBoard.activeItems.length <= 2 ? 'Aansluiting naar monitor blijft beheerst.' : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const alertSignals = [
    ...switchBoard.alertSignals.slice(0, 2),
    ...monitorBoard.activeItems
      .filter((item) => item.tone === 'danger' || item.tone === 'warning')
      .map((item) => `${item.label}: ${item.task?.title ?? item.detail}`)
      .slice(0, 2),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const linkChecks = [
    switchBoard.switchChecks[0] ?? null,
    startBoard.startChecks[0] ?? null,
    monitorBoard.openQuestions[0] ? `Aansluitvraag open: ${monitorBoard.openQuestions[0]}` : null,
    fallbackTask ? `Aansluitfallback via ${fallbackTask.title}.` : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  let linkStatusLabel = 'Aansluiting bewaken';
  let linkTone: ReadinessRunbookScenarioLinkBoard['linkTone'] = 'warning';

  if (switchBoard.switchTone === 'danger' || monitorBoard.monitorTone === 'danger') {
    linkStatusLabel = 'Aansluiting onder druk';
    linkTone = 'danger';
  } else if (
    switchBoard.switchTone === 'success' &&
    startBoard.startTone === 'success' &&
    alertSignals.length <= 2
  ) {
    linkStatusLabel = 'Aansluiting stabiel';
    linkTone = 'success';
  } else if (linkChecks.length >= 2) {
    linkStatusLabel = 'Aansluiting onder controle';
    linkTone = 'accent';
  }

  return {
    headline: `Aansluiting na ${switchBoard.headline}`,
    summary: `${linkStatusLabel}: ${linkSignals.length} aansluitsignalen, ${alertSignals.length} alertsignalen en ${linkChecks.length} aansluitchecks.`,
    linkStatusLabel,
    linkTone,
    confidenceScore: Math.round((switchBoard.confidenceScore + startBoard.confidenceScore) / 2),
    ownerLabel: switchBoard.ownerLabel,
    linkSignals,
    alertSignals,
    linkChecks,
    fallbackTask,
  };
}

export function buildReadinessRunbookScenarioMonitorGateBoard(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioMonitorGateBoard | null {
  const linkBoard = buildReadinessRunbookScenarioLinkBoard(state, focus);
  const switchBoard = buildReadinessRunbookScenarioSwitchOnBoard(state, focus);
  const monitorBoard = buildReadinessRunbookScenarioMonitorBoard(state, focus);

  if (!linkBoard || !switchBoard || !monitorBoard) return null;

  const fallbackTask =
    linkBoard.fallbackTask ??
    switchBoard.fallbackTask ??
    monitorBoard.activeItems[0]?.task ??
    null;

  const gateSignals = [
    ...linkBoard.linkSignals.slice(0, 2),
    switchBoard.switchChecks[0] ?? null,
    monitorBoard.activeItems.length <= 2 ? 'Monitorpoort kan gecontroleerd open.' : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const alertSignals = [
    ...linkBoard.alertSignals.slice(0, 2),
    ...monitorBoard.activeItems
      .filter((item) => item.tone === 'danger' || item.tone === 'warning')
      .map((item) => `${item.label}: ${item.task?.title ?? item.detail}`)
      .slice(0, 2),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const gateChecks = [
    linkBoard.linkChecks[0] ?? null,
    switchBoard.switchChecks[0] ?? null,
    monitorBoard.openQuestions[0] ? `Poortvraag open: ${monitorBoard.openQuestions[0]}` : null,
    fallbackTask ? `Poortfallback via ${fallbackTask.title}.` : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  let gateStatusLabel = 'Monitorpoort bewaken';
  let gateTone: ReadinessRunbookScenarioMonitorGateBoard['gateTone'] = 'warning';

  if (linkBoard.linkTone === 'danger' || monitorBoard.monitorTone === 'danger') {
    gateStatusLabel = 'Monitorpoort onder druk';
    gateTone = 'danger';
  } else if (
    linkBoard.linkTone === 'success' &&
    switchBoard.switchTone === 'success' &&
    alertSignals.length <= 2
  ) {
    gateStatusLabel = 'Monitorpoort stabiel';
    gateTone = 'success';
  } else if (gateChecks.length >= 2) {
    gateStatusLabel = 'Monitorpoort onder controle';
    gateTone = 'accent';
  }

  return {
    headline: `Monitorpoort na ${linkBoard.headline}`,
    summary: `${gateStatusLabel}: ${gateSignals.length} poortsignalen, ${alertSignals.length} alertsignalen en ${gateChecks.length} poortchecks.`,
    gateStatusLabel,
    gateTone,
    confidenceScore: Math.round((linkBoard.confidenceScore + switchBoard.confidenceScore) / 2),
    ownerLabel: linkBoard.ownerLabel,
    gateSignals,
    alertSignals,
    gateChecks,
    fallbackTask,
  };
}

export function buildReadinessRunbookScenarioMonitorReleaseBoard(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioMonitorReleaseBoard | null {
  const gateBoard = buildReadinessRunbookScenarioMonitorGateBoard(state, focus);
  const linkBoard = buildReadinessRunbookScenarioLinkBoard(state, focus);
  const monitorBoard = buildReadinessRunbookScenarioMonitorBoard(state, focus);

  if (!gateBoard || !linkBoard || !monitorBoard) return null;

  const fallbackTask =
    gateBoard.fallbackTask ??
    linkBoard.fallbackTask ??
    monitorBoard.activeItems[0]?.task ??
    null;

  const releaseSignals = [
    ...gateBoard.gateSignals.slice(0, 2),
    ...monitorBoard.activeItems
      .filter((item) => item.tone === 'success' || item.tone === 'accent')
      .map((item) => `${item.label}: ${item.task?.title ?? item.detail}`)
      .slice(0, 2),
    monitorBoard.openQuestions.length <= 2 ? 'Monitor kan leidend worden zonder extra poortspanning.' : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const alertSignals = [
    ...gateBoard.alertSignals.slice(0, 2),
    ...monitorBoard.activeItems
      .filter((item) => item.tone === 'danger' || item.tone === 'warning')
      .map((item) => `${item.label}: ${item.task?.title ?? item.detail}`)
      .slice(0, 2),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const releaseChecks = [
    gateBoard.gateChecks[0] ?? null,
    linkBoard.linkChecks[0] ?? null,
    monitorBoard.openQuestions[0] ? `Vrijgavevraag open: ${monitorBoard.openQuestions[0]}` : null,
    fallbackTask ? `Vrijgavefallback via ${fallbackTask.title}.` : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  let releaseStatusLabel = 'Monitorvrijgave bewaken';
  let releaseTone: ReadinessRunbookScenarioMonitorReleaseBoard['releaseTone'] = 'warning';

  if (gateBoard.gateTone === 'danger' || monitorBoard.monitorTone === 'danger') {
    releaseStatusLabel = 'Monitorvrijgave onder druk';
    releaseTone = 'danger';
  } else if (
    gateBoard.gateTone === 'success' &&
    (monitorBoard.monitorTone === 'accent' || monitorBoard.monitorTone === 'success') &&
    alertSignals.length <= 2
  ) {
    releaseStatusLabel = 'Monitorvrijgave klaar';
    releaseTone = 'success';
  } else if (releaseChecks.length >= 2) {
    releaseStatusLabel = 'Monitorvrijgave onder controle';
    releaseTone = 'accent';
  }

  return {
    headline: `Monitorvrijgave na ${gateBoard.headline}`,
    summary: `${releaseStatusLabel}: ${releaseSignals.length} vrijgavesignalen, ${alertSignals.length} alertsignalen en ${releaseChecks.length} vrijgavechecks.`,
    releaseStatusLabel,
    releaseTone,
    confidenceScore: Math.round((gateBoard.confidenceScore + linkBoard.confidenceScore) / 2),
    ownerLabel: gateBoard.ownerLabel,
    releaseSignals,
    alertSignals,
    releaseChecks,
    fallbackTask,
  };
}

export function buildReadinessRunbookScenarioMonitorStartBoard(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioMonitorStartBoard | null {
  const releaseBoard = buildReadinessRunbookScenarioMonitorReleaseBoard(state, focus);
  const gateBoard = buildReadinessRunbookScenarioMonitorGateBoard(state, focus);
  const monitorBoard = buildReadinessRunbookScenarioMonitorBoard(state, focus);

  if (!releaseBoard || !gateBoard || !monitorBoard) return null;

  const fallbackTask =
    releaseBoard.fallbackTask ??
    gateBoard.fallbackTask ??
    monitorBoard.activeItems[0]?.task ??
    null;

  const startSignals = [
    ...releaseBoard.releaseSignals.slice(0, 2),
    ...monitorBoard.activeItems
      .filter((item) => item.tone === 'success' || item.tone === 'accent')
      .map((item) => `${item.label}: ${item.task?.title ?? item.detail}`)
      .slice(0, 2),
    monitorBoard.openQuestions.length <= 1 ? 'Monitorstart kan rustig openen.' : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const alertSignals = [
    ...releaseBoard.alertSignals.slice(0, 2),
    ...monitorBoard.activeItems
      .filter((item) => item.tone === 'danger' || item.tone === 'warning')
      .map((item) => `${item.label}: ${item.task?.title ?? item.detail}`)
      .slice(0, 2),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const startChecks = [
    releaseBoard.releaseChecks[0] ?? null,
    gateBoard.gateChecks[0] ?? null,
    monitorBoard.openQuestions[0] ? `Startvraag open: ${monitorBoard.openQuestions[0]}` : null,
    fallbackTask ? `Startfallback via ${fallbackTask.title}.` : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  let startStatusLabel = 'Monitorstart bewaken';
  let startTone: ReadinessRunbookScenarioMonitorStartBoard['startTone'] = 'warning';

  if (releaseBoard.releaseTone === 'danger' || monitorBoard.monitorTone === 'danger') {
    startStatusLabel = 'Monitorstart onder druk';
    startTone = 'danger';
  } else if (
    releaseBoard.releaseTone === 'success' &&
    (monitorBoard.monitorTone === 'accent' || monitorBoard.monitorTone === 'success') &&
    alertSignals.length <= 2
  ) {
    startStatusLabel = 'Monitorstart klaar';
    startTone = 'success';
  } else if (startChecks.length >= 2) {
    startStatusLabel = 'Monitorstart onder controle';
    startTone = 'accent';
  }

  return {
    headline: `Monitorstart na ${releaseBoard.headline}`,
    summary: `${startStatusLabel}: ${startSignals.length} startsignalen, ${alertSignals.length} alertsignalen en ${startChecks.length} startchecks.`,
    startStatusLabel,
    startTone,
    confidenceScore: Math.round((releaseBoard.confidenceScore + gateBoard.confidenceScore) / 2),
    ownerLabel: releaseBoard.ownerLabel,
    startSignals,
    alertSignals,
    startChecks,
    fallbackTask,
  };
}

export function buildReadinessRunbookScenarioMonitorRhythmBoard(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioMonitorRhythmBoard | null {
  const startBoard = buildReadinessRunbookScenarioMonitorStartBoard(state, focus);
  const releaseBoard = buildReadinessRunbookScenarioMonitorReleaseBoard(state, focus);
  const monitorBoard = buildReadinessRunbookScenarioMonitorBoard(state, focus);

  if (!startBoard || !releaseBoard || !monitorBoard) return null;

  const fallbackTask =
    startBoard.fallbackTask ??
    releaseBoard.fallbackTask ??
    monitorBoard.activeItems[0]?.task ??
    null;

  const rhythmSignals = [
    ...startBoard.startSignals.slice(0, 2),
    ...monitorBoard.activeItems
      .filter((item) => item.tone === 'success' || item.tone === 'accent')
      .map((item) => `${item.label}: ${item.task?.title ?? item.detail}`)
      .slice(0, 2),
    monitorBoard.openQuestions.length === 0 ? 'Monitorritme loopt zonder open vragen.' : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const alertSignals = [
    ...startBoard.alertSignals.slice(0, 2),
    ...monitorBoard.activeItems
      .filter((item) => item.tone === 'danger' || item.tone === 'warning')
      .map((item) => `${item.label}: ${item.task?.title ?? item.detail}`)
      .slice(0, 2),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const rhythmChecks = [
    startBoard.startChecks[0] ?? null,
    releaseBoard.releaseChecks[0] ?? null,
    monitorBoard.openQuestions[0] ? `Ritmevraag open: ${monitorBoard.openQuestions[0]}` : null,
    fallbackTask ? `Ritmefallback via ${fallbackTask.title}.` : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  let rhythmStatusLabel = 'Monitorritme bewaken';
  let rhythmTone: ReadinessRunbookScenarioMonitorRhythmBoard['rhythmTone'] = 'warning';

  if (startBoard.startTone === 'danger' || monitorBoard.monitorTone === 'danger') {
    rhythmStatusLabel = 'Monitorritme onder druk';
    rhythmTone = 'danger';
  } else if (
    startBoard.startTone === 'success' &&
    (monitorBoard.monitorTone === 'accent' || monitorBoard.monitorTone === 'success') &&
    alertSignals.length <= 2
  ) {
    rhythmStatusLabel = 'Monitorritme stabiel';
    rhythmTone = 'success';
  } else if (rhythmChecks.length >= 2) {
    rhythmStatusLabel = 'Monitorritme onder controle';
    rhythmTone = 'accent';
  }

  return {
    headline: `Monitorritme na ${startBoard.headline}`,
    summary: `${rhythmStatusLabel}: ${rhythmSignals.length} ritmesignalen, ${alertSignals.length} alertsignalen en ${rhythmChecks.length} ritmechecks.`,
    rhythmStatusLabel,
    rhythmTone,
    confidenceScore: Math.round((startBoard.confidenceScore + releaseBoard.confidenceScore) / 2),
    ownerLabel: startBoard.ownerLabel,
    rhythmSignals,
    alertSignals,
    rhythmChecks,
    fallbackTask,
  };
}

export function buildReadinessRunbookScenarioMonitorStabilizationBoard(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioMonitorStabilizationBoard | null {
  const rhythmBoard = buildReadinessRunbookScenarioMonitorRhythmBoard(state, focus);
  const startBoard = buildReadinessRunbookScenarioMonitorStartBoard(state, focus);
  const monitorBoard = buildReadinessRunbookScenarioMonitorBoard(state, focus);

  if (!rhythmBoard || !startBoard || !monitorBoard) return null;

  const fallbackTask =
    rhythmBoard.fallbackTask ??
    startBoard.fallbackTask ??
    monitorBoard.activeItems[0]?.task ??
    null;

  const stabilizationSignals = [
    ...rhythmBoard.rhythmSignals.slice(0, 2),
    ...monitorBoard.activeItems
      .filter((item) => item.tone === 'success' || item.tone === 'accent')
      .map((item) => `${item.label}: ${item.task?.title ?? item.detail}`)
      .slice(0, 2),
    monitorBoard.openQuestions.length === 0 ? 'Monitorstabilisatie loopt zonder open monitorvragen.' : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const alertSignals = [
    ...rhythmBoard.alertSignals.slice(0, 2),
    ...monitorBoard.activeItems
      .filter((item) => item.tone === 'danger' || item.tone === 'warning')
      .map((item) => `${item.label}: ${item.task?.title ?? item.detail}`)
      .slice(0, 2),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const stabilizationChecks = [
    rhythmBoard.rhythmChecks[0] ?? null,
    startBoard.startChecks[0] ?? null,
    monitorBoard.openQuestions[0] ? `Stabilisatievraag open: ${monitorBoard.openQuestions[0]}` : null,
    fallbackTask ? `Stabilisatiefallback via ${fallbackTask.title}.` : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  let stabilizationStatusLabel = 'Monitorstabilisatie bewaken';
  let stabilizationTone: ReadinessRunbookScenarioMonitorStabilizationBoard['stabilizationTone'] = 'warning';

  if (rhythmBoard.rhythmTone === 'danger' || monitorBoard.monitorTone === 'danger') {
    stabilizationStatusLabel = 'Monitorstabilisatie onder druk';
    stabilizationTone = 'danger';
  } else if (
    rhythmBoard.rhythmTone === 'success' &&
    (monitorBoard.monitorTone === 'accent' || monitorBoard.monitorTone === 'success') &&
    alertSignals.length <= 2
  ) {
    stabilizationStatusLabel = 'Monitorstabilisatie stabiel';
    stabilizationTone = 'success';
  } else if (stabilizationChecks.length >= 2) {
    stabilizationStatusLabel = 'Monitorstabilisatie onder controle';
    stabilizationTone = 'accent';
  }

  return {
    headline: `Monitorstabilisatie na ${rhythmBoard.headline}`,
    summary: `${stabilizationStatusLabel}: ${stabilizationSignals.length} stabilisatiesignalen, ${alertSignals.length} alertsignalen en ${stabilizationChecks.length} stabilisatiechecks.`,
    stabilizationStatusLabel,
    stabilizationTone,
    confidenceScore: Math.round((rhythmBoard.confidenceScore + startBoard.confidenceScore) / 2),
    ownerLabel: rhythmBoard.ownerLabel,
    stabilizationSignals,
    alertSignals,
    stabilizationChecks,
    fallbackTask,
  };
}

export function buildReadinessRunbookScenarioMonitorLandingBoard(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioMonitorLandingBoard | null {
  const stabilizationBoard = buildReadinessRunbookScenarioMonitorStabilizationBoard(state, focus);
  const rhythmBoard = buildReadinessRunbookScenarioMonitorRhythmBoard(state, focus);
  const monitorBoard = buildReadinessRunbookScenarioMonitorBoard(state, focus);

  if (!stabilizationBoard || !rhythmBoard || !monitorBoard) return null;

  const fallbackTask =
    stabilizationBoard.fallbackTask ??
    rhythmBoard.fallbackTask ??
    monitorBoard.activeItems[0]?.task ??
    null;

  const landingSignals = [
    ...stabilizationBoard.stabilizationSignals.slice(0, 2),
    ...monitorBoard.activeItems
      .filter((item) => item.tone === 'success' || item.tone === 'accent')
      .map((item) => `${item.label}: ${item.task?.title ?? item.detail}`)
      .slice(0, 2),
    monitorBoard.openQuestions.length === 0 ? 'Monitorlanding kan zonder open monitorvragen afronden.' : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const alertSignals = [
    ...stabilizationBoard.alertSignals.slice(0, 2),
    ...monitorBoard.activeItems
      .filter((item) => item.tone === 'danger' || item.tone === 'warning')
      .map((item) => `${item.label}: ${item.task?.title ?? item.detail}`)
      .slice(0, 2),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const landingChecks = [
    stabilizationBoard.stabilizationChecks[0] ?? null,
    rhythmBoard.rhythmChecks[0] ?? null,
    monitorBoard.openQuestions[0] ? `Landingsvraag open: ${monitorBoard.openQuestions[0]}` : null,
    fallbackTask ? `Landingsfallback via ${fallbackTask.title}.` : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  let landingStatusLabel = 'Monitorlanding bewaken';
  let landingTone: ReadinessRunbookScenarioMonitorLandingBoard['landingTone'] = 'warning';

  if (stabilizationBoard.stabilizationTone === 'danger' || monitorBoard.monitorTone === 'danger') {
    landingStatusLabel = 'Monitorlanding onder druk';
    landingTone = 'danger';
  } else if (
    stabilizationBoard.stabilizationTone === 'success' &&
    (monitorBoard.monitorTone === 'accent' || monitorBoard.monitorTone === 'success') &&
    alertSignals.length <= 2
  ) {
    landingStatusLabel = 'Monitorlanding stabiel';
    landingTone = 'success';
  } else if (landingChecks.length >= 2) {
    landingStatusLabel = 'Monitorlanding onder controle';
    landingTone = 'accent';
  }

  return {
    headline: `Monitorlanding na ${stabilizationBoard.headline}`,
    summary: `${landingStatusLabel}: ${landingSignals.length} landingssignalen, ${alertSignals.length} alertsignalen en ${landingChecks.length} landingchecks.`,
    landingStatusLabel,
    landingTone,
    confidenceScore: Math.round((stabilizationBoard.confidenceScore + rhythmBoard.confidenceScore) / 2),
    ownerLabel: stabilizationBoard.ownerLabel,
    landingSignals,
    alertSignals,
    landingChecks,
    fallbackTask,
  };
}

export function buildReadinessRunbookScenarioMonitorHandoverBoard(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioMonitorHandoverBoard | null {
  const landingBoard = buildReadinessRunbookScenarioMonitorLandingBoard(state, focus);
  const stabilizationBoard = buildReadinessRunbookScenarioMonitorStabilizationBoard(state, focus);
  const monitorBoard = buildReadinessRunbookScenarioMonitorBoard(state, focus);

  if (!landingBoard || !stabilizationBoard || !monitorBoard) return null;

  const fallbackTask =
    landingBoard.fallbackTask ??
    stabilizationBoard.fallbackTask ??
    monitorBoard.activeItems[0]?.task ??
    null;

  const handoverSignals = [
    ...landingBoard.landingSignals.slice(0, 2),
    ...monitorBoard.activeItems
      .filter((item) => item.tone === 'success' || item.tone === 'accent')
      .map((item) => `${item.label}: ${item.task?.title ?? item.detail}`)
      .slice(0, 2),
    monitorBoard.openQuestions.length === 0 ? 'Monitoroverdracht kan zonder open monitorvragen afronden.' : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const alertSignals = [
    ...landingBoard.alertSignals.slice(0, 2),
    ...monitorBoard.activeItems
      .filter((item) => item.tone === 'danger' || item.tone === 'warning')
      .map((item) => `${item.label}: ${item.task?.title ?? item.detail}`)
      .slice(0, 2),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const handoverChecks = [
    landingBoard.landingChecks[0] ?? null,
    stabilizationBoard.stabilizationChecks[0] ?? null,
    monitorBoard.openQuestions[0] ? `Overdrachtsvraag open: ${monitorBoard.openQuestions[0]}` : null,
    fallbackTask ? `Overdrachtfallback via ${fallbackTask.title}.` : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  let handoverStatusLabel = 'Monitoroverdracht bewaken';
  let handoverTone: ReadinessRunbookScenarioMonitorHandoverBoard['handoverTone'] = 'warning';

  if (landingBoard.landingTone === 'danger' || monitorBoard.monitorTone === 'danger') {
    handoverStatusLabel = 'Monitoroverdracht onder druk';
    handoverTone = 'danger';
  } else if (
    landingBoard.landingTone === 'success' &&
    (monitorBoard.monitorTone === 'accent' || monitorBoard.monitorTone === 'success') &&
    alertSignals.length <= 2
  ) {
    handoverStatusLabel = 'Monitoroverdracht stabiel';
    handoverTone = 'success';
  } else if (handoverChecks.length >= 2) {
    handoverStatusLabel = 'Monitoroverdracht onder controle';
    handoverTone = 'accent';
  }

  return {
    headline: `Monitoroverdracht na ${landingBoard.headline}`,
    summary: `${handoverStatusLabel}: ${handoverSignals.length} overdrachtsignalen, ${alertSignals.length} alertsignalen en ${handoverChecks.length} overdrachtchecks.`,
    handoverStatusLabel,
    handoverTone,
    confidenceScore: Math.round((landingBoard.confidenceScore + stabilizationBoard.confidenceScore) / 2),
    ownerLabel: landingBoard.ownerLabel,
    handoverSignals,
    alertSignals,
    handoverChecks,
    fallbackTask,
  };
}

export function buildReadinessRunbookScenarioMonitorActivationBoard(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioMonitorActivationBoard | null {
  const handoverBoard = buildReadinessRunbookScenarioMonitorHandoverBoard(state, focus);
  const landingBoard = buildReadinessRunbookScenarioMonitorLandingBoard(state, focus);
  const monitorBoard = buildReadinessRunbookScenarioMonitorBoard(state, focus);

  if (!handoverBoard || !landingBoard || !monitorBoard) return null;

  const fallbackTask =
    handoverBoard.fallbackTask ??
    landingBoard.fallbackTask ??
    monitorBoard.activeItems[0]?.task ??
    null;

  const activationSignals = [
    ...handoverBoard.handoverSignals.slice(0, 2),
    ...monitorBoard.activeItems
      .filter((item) => item.tone === 'success' || item.tone === 'accent')
      .map((item) => `${item.label}: ${item.task?.title ?? item.detail}`)
      .slice(0, 2),
    monitorBoard.openQuestions.length === 0 ? 'Monitoractivatie kan zonder open monitorvragen afronden.' : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const alertSignals = [
    ...handoverBoard.alertSignals.slice(0, 2),
    ...monitorBoard.activeItems
      .filter((item) => item.tone === 'danger' || item.tone === 'warning')
      .map((item) => `${item.label}: ${item.task?.title ?? item.detail}`)
      .slice(0, 2),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const activationChecks = [
    handoverBoard.handoverChecks[0] ?? null,
    landingBoard.landingChecks[0] ?? null,
    monitorBoard.openQuestions[0] ? `Activatievraag open: ${monitorBoard.openQuestions[0]}` : null,
    fallbackTask ? `Activatiefallback via ${fallbackTask.title}.` : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  let activationStatusLabel = 'Monitoractivatie bewaken';
  let activationTone: ReadinessRunbookScenarioMonitorActivationBoard['activationTone'] = 'warning';

  if (handoverBoard.handoverTone === 'danger' || monitorBoard.monitorTone === 'danger') {
    activationStatusLabel = 'Monitoractivatie onder druk';
    activationTone = 'danger';
  } else if (
    handoverBoard.handoverTone === 'success' &&
    (monitorBoard.monitorTone === 'accent' || monitorBoard.monitorTone === 'success') &&
    alertSignals.length <= 2
  ) {
    activationStatusLabel = 'Monitoractivatie stabiel';
    activationTone = 'success';
  } else if (activationChecks.length >= 2) {
    activationStatusLabel = 'Monitoractivatie onder controle';
    activationTone = 'accent';
  }

  return {
    headline: `Monitoractivatie na ${handoverBoard.headline}`,
    summary: `${activationStatusLabel}: ${activationSignals.length} activatiesignalen, ${alertSignals.length} alertsignalen en ${activationChecks.length} activatiechecks.`,
    activationStatusLabel,
    activationTone,
    confidenceScore: Math.round((handoverBoard.confidenceScore + landingBoard.confidenceScore) / 2),
    ownerLabel: handoverBoard.ownerLabel,
    activationSignals,
    alertSignals,
    activationChecks,
    fallbackTask,
  };
}

export function buildReadinessRunbookScenarioMonitorControlBoard(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioMonitorControlBoard | null {
  const activationBoard = buildReadinessRunbookScenarioMonitorActivationBoard(state, focus);
  const handoverBoard = buildReadinessRunbookScenarioMonitorHandoverBoard(state, focus);
  const monitorBoard = buildReadinessRunbookScenarioMonitorBoard(state, focus);

  if (!activationBoard || !handoverBoard || !monitorBoard) return null;

  const fallbackTask =
    activationBoard.fallbackTask ??
    handoverBoard.fallbackTask ??
    monitorBoard.activeItems[0]?.task ??
    null;

  const controlSignals = [
    ...activationBoard.activationSignals.slice(0, 2),
    ...monitorBoard.activeItems
      .filter((item) => item.tone === 'success' || item.tone === 'accent')
      .map((item) => `${item.label}: ${item.task?.title ?? item.detail}`)
      .slice(0, 2),
    monitorBoard.openQuestions.length === 0 ? 'Monitorregie kan zonder open monitorvragen volledig overnemen.' : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const alertSignals = [
    ...activationBoard.alertSignals.slice(0, 2),
    ...monitorBoard.activeItems
      .filter((item) => item.tone === 'danger' || item.tone === 'warning')
      .map((item) => `${item.label}: ${item.task?.title ?? item.detail}`)
      .slice(0, 2),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const controlChecks = [
    activationBoard.activationChecks[0] ?? null,
    handoverBoard.handoverChecks[0] ?? null,
    monitorBoard.openQuestions[0] ? `Regievraag open: ${monitorBoard.openQuestions[0]}` : null,
    fallbackTask ? `Regiefallback via ${fallbackTask.title}.` : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  let controlStatusLabel = 'Monitorregie bewaken';
  let controlTone: ReadinessRunbookScenarioMonitorControlBoard['controlTone'] = 'warning';

  if (activationBoard.activationTone === 'danger' || monitorBoard.monitorTone === 'danger') {
    controlStatusLabel = 'Monitorregie onder druk';
    controlTone = 'danger';
  } else if (
    activationBoard.activationTone === 'success' &&
    (monitorBoard.monitorTone === 'accent' || monitorBoard.monitorTone === 'success') &&
    alertSignals.length <= 2
  ) {
    controlStatusLabel = 'Monitorregie stabiel';
    controlTone = 'success';
  } else if (controlChecks.length >= 2) {
    controlStatusLabel = 'Monitorregie onder controle';
    controlTone = 'accent';
  }

  return {
    headline: `Monitorregie na ${activationBoard.headline}`,
    summary: `${controlStatusLabel}: ${controlSignals.length} regiesignalen, ${alertSignals.length} alertsignalen en ${controlChecks.length} regiechecks.`,
    controlStatusLabel,
    controlTone,
    confidenceScore: Math.round((activationBoard.confidenceScore + handoverBoard.confidenceScore) / 2),
    ownerLabel: activationBoard.ownerLabel,
    controlSignals,
    alertSignals,
    controlChecks,
    fallbackTask,
  };
}

export function buildReadinessRunbookScenarioMonitorConfirmationBoard(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioMonitorConfirmationBoard | null {
  const controlBoard = buildReadinessRunbookScenarioMonitorControlBoard(state, focus);
  const activationBoard = buildReadinessRunbookScenarioMonitorActivationBoard(state, focus);
  const monitorBoard = buildReadinessRunbookScenarioMonitorBoard(state, focus);

  if (!controlBoard || !activationBoard || !monitorBoard) return null;

  const fallbackTask =
    controlBoard.fallbackTask ??
    activationBoard.fallbackTask ??
    monitorBoard.activeItems[0]?.task ??
    null;

  const confirmationSignals = [
    ...controlBoard.controlSignals.slice(0, 2),
    ...monitorBoard.activeItems
      .filter((item) => item.tone === 'success' || item.tone === 'accent')
      .map((item) => `${item.label}: ${item.task?.title ?? item.detail}`)
      .slice(0, 2),
    monitorBoard.openQuestions.length === 0 ? 'Monitorbevestiging kan zonder open monitorvragen afronden.' : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const alertSignals = [
    ...controlBoard.alertSignals.slice(0, 2),
    ...monitorBoard.activeItems
      .filter((item) => item.tone === 'danger' || item.tone === 'warning')
      .map((item) => `${item.label}: ${item.task?.title ?? item.detail}`)
      .slice(0, 2),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const confirmationChecks = [
    controlBoard.controlChecks[0] ?? null,
    activationBoard.activationChecks[0] ?? null,
    monitorBoard.openQuestions[0] ? `Bevestigingsvraag open: ${monitorBoard.openQuestions[0]}` : null,
    fallbackTask ? `Bevestigingsfallback via ${fallbackTask.title}.` : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  let confirmationStatusLabel = 'Monitorbevestiging bewaken';
  let confirmationTone: ReadinessRunbookScenarioMonitorConfirmationBoard['confirmationTone'] = 'warning';

  if (controlBoard.controlTone === 'danger' || monitorBoard.monitorTone === 'danger') {
    confirmationStatusLabel = 'Monitorbevestiging onder druk';
    confirmationTone = 'danger';
  } else if (
    controlBoard.controlTone === 'success' &&
    (monitorBoard.monitorTone === 'accent' || monitorBoard.monitorTone === 'success') &&
    alertSignals.length <= 2
  ) {
    confirmationStatusLabel = 'Monitorbevestiging stabiel';
    confirmationTone = 'success';
  } else if (confirmationChecks.length >= 2) {
    confirmationStatusLabel = 'Monitorbevestiging onder controle';
    confirmationTone = 'accent';
  }

  return {
    headline: `Monitorbevestiging na ${controlBoard.headline}`,
    summary: `${confirmationStatusLabel}: ${confirmationSignals.length} bevestigingssignalen, ${alertSignals.length} alertsignalen en ${confirmationChecks.length} bevestigingchecks.`,
    confirmationStatusLabel,
    confirmationTone,
    confidenceScore: Math.round((controlBoard.confidenceScore + activationBoard.confidenceScore) / 2),
    ownerLabel: controlBoard.ownerLabel,
    confirmationSignals,
    alertSignals,
    confirmationChecks,
    fallbackTask,
  };
}

export function buildReadinessRunbookScenarioMonitorApprovalBoard(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioMonitorApprovalBoard | null {
  const confirmationBoard = buildReadinessRunbookScenarioMonitorConfirmationBoard(state, focus);
  const controlBoard = buildReadinessRunbookScenarioMonitorControlBoard(state, focus);
  const monitorBoard = buildReadinessRunbookScenarioMonitorBoard(state, focus);

  if (!confirmationBoard || !controlBoard || !monitorBoard) return null;

  const fallbackTask =
    confirmationBoard.fallbackTask ??
    controlBoard.fallbackTask ??
    monitorBoard.activeItems[0]?.task ??
    null;

  const approvalSignals = [
    ...confirmationBoard.confirmationSignals.slice(0, 2),
    ...monitorBoard.activeItems
      .filter((item) => item.tone === 'success' || item.tone === 'accent')
      .map((item) => `${item.label}: ${item.task?.title ?? item.detail}`)
      .slice(0, 2),
    monitorBoard.openQuestions.length === 0 ? 'Monitorakkoord kan zonder open monitorvragen afronden.' : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const alertSignals = [
    ...confirmationBoard.alertSignals.slice(0, 2),
    ...monitorBoard.activeItems
      .filter((item) => item.tone === 'danger' || item.tone === 'warning')
      .map((item) => `${item.label}: ${item.task?.title ?? item.detail}`)
      .slice(0, 2),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const approvalChecks = [
    confirmationBoard.confirmationChecks[0] ?? null,
    controlBoard.controlChecks[0] ?? null,
    monitorBoard.openQuestions[0] ? `Akkoordvraag open: ${monitorBoard.openQuestions[0]}` : null,
    fallbackTask ? `Akkoordfallback via ${fallbackTask.title}.` : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  let approvalStatusLabel = 'Monitorakkoord bewaken';
  let approvalTone: ReadinessRunbookScenarioMonitorApprovalBoard['approvalTone'] = 'warning';

  if (confirmationBoard.confirmationTone === 'danger' || monitorBoard.monitorTone === 'danger') {
    approvalStatusLabel = 'Monitorakkoord onder druk';
    approvalTone = 'danger';
  } else if (
    confirmationBoard.confirmationTone === 'success' &&
    (monitorBoard.monitorTone === 'accent' || monitorBoard.monitorTone === 'success') &&
    alertSignals.length <= 2
  ) {
    approvalStatusLabel = 'Monitorakkoord stabiel';
    approvalTone = 'success';
  } else if (approvalChecks.length >= 2) {
    approvalStatusLabel = 'Monitorakkoord onder controle';
    approvalTone = 'accent';
  }

  return {
    headline: `Monitorakkoord na ${confirmationBoard.headline}`,
    summary: `${approvalStatusLabel}: ${approvalSignals.length} akkoordsignalen, ${alertSignals.length} alertsignalen en ${approvalChecks.length} akkoordchecks.`,
    approvalStatusLabel,
    approvalTone,
    confidenceScore: Math.round((confirmationBoard.confidenceScore + controlBoard.confidenceScore) / 2),
    ownerLabel: confirmationBoard.ownerLabel,
    approvalSignals,
    alertSignals,
    approvalChecks,
    fallbackTask,
  };
}

export function buildReadinessRunbookScenarioMonitorLeadBoard(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioMonitorLeadBoard | null {
  const approvalBoard = buildReadinessRunbookScenarioMonitorApprovalBoard(state, focus);
  const confirmationBoard = buildReadinessRunbookScenarioMonitorConfirmationBoard(state, focus);
  const monitorBoard = buildReadinessRunbookScenarioMonitorBoard(state, focus);

  if (!approvalBoard || !confirmationBoard || !monitorBoard) return null;

  const fallbackTask =
    approvalBoard.fallbackTask ??
    confirmationBoard.fallbackTask ??
    monitorBoard.activeItems[0]?.task ??
    null;

  const leadSignals = [
    ...approvalBoard.approvalSignals.slice(0, 2),
    ...monitorBoard.activeItems
      .filter((item) => item.tone === 'success' || item.tone === 'accent')
      .map((item) => `${item.label}: ${item.task?.title ?? item.detail}`)
      .slice(0, 2),
    monitorBoard.openQuestions.length === 0 ? 'Monitorleiding kan zonder open monitorvragen starten.' : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const alertSignals = [
    ...approvalBoard.alertSignals.slice(0, 2),
    ...monitorBoard.activeItems
      .filter((item) => item.tone === 'danger' || item.tone === 'warning')
      .map((item) => `${item.label}: ${item.task?.title ?? item.detail}`)
      .slice(0, 2),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const leadChecks = [
    approvalBoard.approvalChecks[0] ?? null,
    confirmationBoard.confirmationChecks[0] ?? null,
    monitorBoard.openQuestions[0] ? `Leidvraag open: ${monitorBoard.openQuestions[0]}` : null,
    fallbackTask ? `Leidfallback via ${fallbackTask.title}.` : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  let leadStatusLabel = 'Monitorleiding bewaken';
  let leadTone: ReadinessRunbookScenarioMonitorLeadBoard['leadTone'] = 'warning';

  if (approvalBoard.approvalTone === 'danger' || monitorBoard.monitorTone === 'danger') {
    leadStatusLabel = 'Monitorleiding onder druk';
    leadTone = 'danger';
  } else if (
    approvalBoard.approvalTone === 'success' &&
    (monitorBoard.monitorTone === 'accent' || monitorBoard.monitorTone === 'success') &&
    alertSignals.length <= 2
  ) {
    leadStatusLabel = 'Monitorleiding stabiel';
    leadTone = 'success';
  } else if (leadChecks.length >= 2) {
    leadStatusLabel = 'Monitorleiding onder controle';
    leadTone = 'accent';
  }

  return {
    headline: `Monitorleiding na ${approvalBoard.headline}`,
    summary: `${leadStatusLabel}: ${leadSignals.length} leidsignalen, ${alertSignals.length} alertsignalen en ${leadChecks.length} leidchecks.`,
    leadStatusLabel,
    leadTone,
    confidenceScore: Math.round((approvalBoard.confidenceScore + confirmationBoard.confidenceScore) / 2),
    ownerLabel: approvalBoard.ownerLabel,
    leadSignals,
    alertSignals,
    leadChecks,
    fallbackTask,
  };
}

export function buildReadinessRunbookScenarioMonitorMandateBoard(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioMonitorMandateBoard | null {
  const leadBoard = buildReadinessRunbookScenarioMonitorLeadBoard(state, focus);
  const approvalBoard = buildReadinessRunbookScenarioMonitorApprovalBoard(state, focus);
  const monitorBoard = buildReadinessRunbookScenarioMonitorBoard(state, focus);

  if (!leadBoard || !approvalBoard || !monitorBoard) return null;

  const fallbackTask =
    leadBoard.fallbackTask ??
    approvalBoard.fallbackTask ??
    monitorBoard.activeItems[0]?.task ??
    null;

  const mandateSignals = [
    ...leadBoard.leadSignals.slice(0, 2),
    ...monitorBoard.activeItems
      .filter((item) => item.tone === 'success' || item.tone === 'accent')
      .map((item) => `${item.label}: ${item.task?.title ?? item.detail}`)
      .slice(0, 2),
    monitorBoard.openQuestions.length === 0 ? 'Monitormandaat kan zonder open monitorvragen ingaan.' : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const alertSignals = [
    ...leadBoard.alertSignals.slice(0, 2),
    ...monitorBoard.activeItems
      .filter((item) => item.tone === 'danger' || item.tone === 'warning')
      .map((item) => `${item.label}: ${item.task?.title ?? item.detail}`)
      .slice(0, 2),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const mandateChecks = [
    leadBoard.leadChecks[0] ?? null,
    approvalBoard.approvalChecks[0] ?? null,
    monitorBoard.openQuestions[0] ? `Mandaatvraag open: ${monitorBoard.openQuestions[0]}` : null,
    fallbackTask ? `Mandaatfallback via ${fallbackTask.title}.` : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  let mandateStatusLabel = 'Monitormandaat bewaken';
  let mandateTone: ReadinessRunbookScenarioMonitorMandateBoard['mandateTone'] = 'warning';

  if (leadBoard.leadTone === 'danger' || monitorBoard.monitorTone === 'danger') {
    mandateStatusLabel = 'Monitormandaat onder druk';
    mandateTone = 'danger';
  } else if (
    leadBoard.leadTone === 'success' &&
    (monitorBoard.monitorTone === 'accent' || monitorBoard.monitorTone === 'success') &&
    alertSignals.length <= 2
  ) {
    mandateStatusLabel = 'Monitormandaat stabiel';
    mandateTone = 'success';
  } else if (mandateChecks.length >= 2) {
    mandateStatusLabel = 'Monitormandaat onder controle';
    mandateTone = 'accent';
  }

  return {
    headline: `Monitormandaat na ${leadBoard.headline}`,
    summary: `${mandateStatusLabel}: ${mandateSignals.length} mandaatsignalen, ${alertSignals.length} alertsignalen en ${mandateChecks.length} mandaatchecks.`,
    mandateStatusLabel,
    mandateTone,
    confidenceScore: Math.round((leadBoard.confidenceScore + approvalBoard.confidenceScore) / 2),
    ownerLabel: leadBoard.ownerLabel,
    mandateSignals,
    alertSignals,
    mandateChecks,
    fallbackTask,
  };
}

export function buildReadinessRunbookScenarioMonitorDecisionBoard(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioMonitorDecisionBoard | null {
  const mandateBoard = buildReadinessRunbookScenarioMonitorMandateBoard(state, focus);
  const leadBoard = buildReadinessRunbookScenarioMonitorLeadBoard(state, focus);
  const monitorBoard = buildReadinessRunbookScenarioMonitorBoard(state, focus);

  if (!mandateBoard || !leadBoard || !monitorBoard) return null;

  const fallbackTask =
    mandateBoard.fallbackTask ??
    leadBoard.fallbackTask ??
    monitorBoard.activeItems[0]?.task ??
    null;

  const decisionSignals = [
    ...mandateBoard.mandateSignals.slice(0, 2),
    ...monitorBoard.activeItems
      .filter((item) => item.tone === 'success' || item.tone === 'accent')
      .map((item) => `${item.label}: ${item.task?.title ?? item.detail}`)
      .slice(0, 2),
    monitorBoard.openQuestions.length === 0 ? 'Monitorbesluit kan zonder open monitorvragen vastliggen.' : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const alertSignals = [
    ...mandateBoard.alertSignals.slice(0, 2),
    ...monitorBoard.activeItems
      .filter((item) => item.tone === 'danger' || item.tone === 'warning')
      .map((item) => `${item.label}: ${item.task?.title ?? item.detail}`)
      .slice(0, 2),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const decisionChecks = [
    mandateBoard.mandateChecks[0] ?? null,
    leadBoard.leadChecks[0] ?? null,
    monitorBoard.openQuestions[0] ? `Besluitvraag open: ${monitorBoard.openQuestions[0]}` : null,
    fallbackTask ? `Besluitfallback via ${fallbackTask.title}.` : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  let decisionStatusLabel = 'Monitorbesluit bewaken';
  let decisionTone: ReadinessRunbookScenarioMonitorDecisionBoard['decisionTone'] = 'warning';

  if (mandateBoard.mandateTone === 'danger' || monitorBoard.monitorTone === 'danger') {
    decisionStatusLabel = 'Monitorbesluit onder druk';
    decisionTone = 'danger';
  } else if (
    mandateBoard.mandateTone === 'success' &&
    (monitorBoard.monitorTone === 'accent' || monitorBoard.monitorTone === 'success') &&
    alertSignals.length <= 2
  ) {
    decisionStatusLabel = 'Monitorbesluit stabiel';
    decisionTone = 'success';
  } else if (decisionChecks.length >= 2) {
    decisionStatusLabel = 'Monitorbesluit onder controle';
    decisionTone = 'accent';
  }

  return {
    headline: `Monitorbesluit na ${mandateBoard.headline}`,
    summary: `${decisionStatusLabel}: ${decisionSignals.length} besluitsignalen, ${alertSignals.length} alertsignalen en ${decisionChecks.length} besluitchecks.`,
    decisionStatusLabel,
    decisionTone,
    confidenceScore: Math.round((mandateBoard.confidenceScore + leadBoard.confidenceScore) / 2),
    ownerLabel: mandateBoard.ownerLabel,
    decisionSignals,
    alertSignals,
    decisionChecks,
    fallbackTask,
  };
}

export function buildReadinessRunbookScenarioMonitorGoBoard(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioMonitorGoBoard | null {
  const decisionBoard = buildReadinessRunbookScenarioMonitorDecisionBoard(state, focus);
  const mandateBoard = buildReadinessRunbookScenarioMonitorMandateBoard(state, focus);
  const monitorBoard = buildReadinessRunbookScenarioMonitorBoard(state, focus);

  if (!decisionBoard || !mandateBoard || !monitorBoard) return null;

  const fallbackTask =
    decisionBoard.fallbackTask ??
    mandateBoard.fallbackTask ??
    monitorBoard.activeItems[0]?.task ??
    null;

  const goSignals = [
    ...decisionBoard.decisionSignals.slice(0, 2),
    ...monitorBoard.activeItems
      .filter((item) => item.tone === 'success' || item.tone === 'accent')
      .map((item) => `${item.label}: ${item.task?.title ?? item.detail}`)
      .slice(0, 2),
    monitorBoard.openQuestions.length === 0 ? 'Monitorgo kan zonder open monitorvragen starten.' : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const alertSignals = [
    ...decisionBoard.alertSignals.slice(0, 2),
    ...monitorBoard.activeItems
      .filter((item) => item.tone === 'danger' || item.tone === 'warning')
      .map((item) => `${item.label}: ${item.task?.title ?? item.detail}`)
      .slice(0, 2),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const goChecks = [
    decisionBoard.decisionChecks[0] ?? null,
    mandateBoard.mandateChecks[0] ?? null,
    monitorBoard.openQuestions[0] ? `Go-vraag open: ${monitorBoard.openQuestions[0]}` : null,
    fallbackTask ? `Go-fallback via ${fallbackTask.title}.` : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  let goStatusLabel = 'Monitorgo bewaken';
  let goTone: ReadinessRunbookScenarioMonitorGoBoard['goTone'] = 'warning';

  if (decisionBoard.decisionTone === 'danger' || monitorBoard.monitorTone === 'danger') {
    goStatusLabel = 'Monitorgo onder druk';
    goTone = 'danger';
  } else if (
    decisionBoard.decisionTone === 'success' &&
    (monitorBoard.monitorTone === 'accent' || monitorBoard.monitorTone === 'success') &&
    alertSignals.length <= 2
  ) {
    goStatusLabel = 'Monitorgo stabiel';
    goTone = 'success';
  } else if (goChecks.length >= 2) {
    goStatusLabel = 'Monitorgo onder controle';
    goTone = 'accent';
  }

  return {
    headline: `Monitorgo na ${decisionBoard.headline}`,
    summary: `${goStatusLabel}: ${goSignals.length} go-signalen, ${alertSignals.length} alertsignalen en ${goChecks.length} go-checks.`,
    goStatusLabel,
    goTone,
    confidenceScore: Math.round((decisionBoard.confidenceScore + mandateBoard.confidenceScore) / 2),
    ownerLabel: decisionBoard.ownerLabel,
    goSignals,
    alertSignals,
    goChecks,
    fallbackTask,
  };
}

export function buildReadinessRunbookScenarioMonitorLiveBoard(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioMonitorLiveBoard | null {
  const goBoard = buildReadinessRunbookScenarioMonitorGoBoard(state, focus);
  const decisionBoard = buildReadinessRunbookScenarioMonitorDecisionBoard(state, focus);
  const monitorBoard = buildReadinessRunbookScenarioMonitorBoard(state, focus);

  if (!goBoard || !decisionBoard || !monitorBoard) return null;

  const fallbackTask =
    goBoard.fallbackTask ??
    decisionBoard.fallbackTask ??
    monitorBoard.activeItems[0]?.task ??
    null;

  const liveSignals = [
    ...goBoard.goSignals.slice(0, 2),
    ...monitorBoard.activeItems
      .filter((item) => item.tone === 'success' || item.tone === 'accent')
      .map((item) => `${item.label}: ${item.task?.title ?? item.detail}`)
      .slice(0, 2),
    monitorBoard.openQuestions.length === 0 ? 'Monitorlive kan zonder open monitorvragen lopen.' : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const alertSignals = [
    ...goBoard.alertSignals.slice(0, 2),
    ...monitorBoard.activeItems
      .filter((item) => item.tone === 'danger' || item.tone === 'warning')
      .map((item) => `${item.label}: ${item.task?.title ?? item.detail}`)
      .slice(0, 2),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const liveChecks = [
    goBoard.goChecks[0] ?? null,
    decisionBoard.decisionChecks[0] ?? null,
    monitorBoard.openQuestions[0] ? `Live-vraag open: ${monitorBoard.openQuestions[0]}` : null,
    fallbackTask ? `Live-fallback via ${fallbackTask.title}.` : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  let liveStatusLabel = 'Monitorlive bewaken';
  let liveTone: ReadinessRunbookScenarioMonitorLiveBoard['liveTone'] = 'warning';

  if (goBoard.goTone === 'danger' || monitorBoard.monitorTone === 'danger') {
    liveStatusLabel = 'Monitorlive onder druk';
    liveTone = 'danger';
  } else if (
    goBoard.goTone === 'success' &&
    (monitorBoard.monitorTone === 'accent' || monitorBoard.monitorTone === 'success') &&
    alertSignals.length <= 2
  ) {
    liveStatusLabel = 'Monitorlive stabiel';
    liveTone = 'success';
  } else if (liveChecks.length >= 2) {
    liveStatusLabel = 'Monitorlive onder controle';
    liveTone = 'accent';
  }

  return {
    headline: `Monitorlive na ${goBoard.headline}`,
    summary: `${liveStatusLabel}: ${liveSignals.length} live-signalen, ${alertSignals.length} alertsignalen en ${liveChecks.length} live-checks.`,
    liveStatusLabel,
    liveTone,
    confidenceScore: Math.round((goBoard.confidenceScore + decisionBoard.confidenceScore) / 2),
    ownerLabel: goBoard.ownerLabel,
    liveSignals,
    alertSignals,
    liveChecks,
    fallbackTask,
  };
}

export function buildReadinessRunbookScenarioMonitorStatusBoard(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioMonitorStatusBoard | null {
  const liveBoard = buildReadinessRunbookScenarioMonitorLiveBoard(state, focus);
  const goBoard = buildReadinessRunbookScenarioMonitorGoBoard(state, focus);
  const monitorBoard = buildReadinessRunbookScenarioMonitorBoard(state, focus);

  if (!liveBoard || !goBoard || !monitorBoard) return null;

  const fallbackTask =
    liveBoard.fallbackTask ??
    goBoard.fallbackTask ??
    monitorBoard.activeItems[0]?.task ??
    null;

  const stateSignals = [
    ...liveBoard.liveSignals.slice(0, 2),
    ...monitorBoard.activeItems
      .filter((item) => item.tone === 'success' || item.tone === 'accent')
      .map((item) => `${item.label}: ${item.task?.title ?? item.detail}`)
      .slice(0, 2),
    monitorBoard.openQuestions.length === 0 ? 'Monitorstatus kan zonder open monitorvragen stabiel blijven.' : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const alertSignals = [
    ...liveBoard.alertSignals.slice(0, 2),
    ...monitorBoard.activeItems
      .filter((item) => item.tone === 'danger' || item.tone === 'warning')
      .map((item) => `${item.label}: ${item.task?.title ?? item.detail}`)
      .slice(0, 2),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const stateChecks = [
    liveBoard.liveChecks[0] ?? null,
    goBoard.goChecks[0] ?? null,
    monitorBoard.openQuestions[0] ? `Statusvraag open: ${monitorBoard.openQuestions[0]}` : null,
    fallbackTask ? `Statusfallback via ${fallbackTask.title}.` : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  let stateLabel = 'Monitorstatus bewaken';
  let stateTone: ReadinessRunbookScenarioMonitorStatusBoard['stateTone'] = 'warning';

  if (liveBoard.liveTone === 'danger' || monitorBoard.monitorTone === 'danger') {
    stateLabel = 'Monitorstatus onder druk';
    stateTone = 'danger';
  } else if (
    liveBoard.liveTone === 'success' &&
    (monitorBoard.monitorTone === 'accent' || monitorBoard.monitorTone === 'success') &&
    alertSignals.length <= 2
  ) {
    stateLabel = 'Monitorstatus stabiel';
    stateTone = 'success';
  } else if (stateChecks.length >= 2) {
    stateLabel = 'Monitorstatus onder controle';
    stateTone = 'accent';
  }

  return {
    headline: `Monitorstatus na ${liveBoard.headline}`,
    summary: `${stateLabel}: ${stateSignals.length} statussignalen, ${alertSignals.length} alertsignalen en ${stateChecks.length} statuschecks.`,
    stateLabel,
    stateTone,
    confidenceScore: Math.round((liveBoard.confidenceScore + goBoard.confidenceScore) / 2),
    ownerLabel: liveBoard.ownerLabel,
    stateSignals,
    alertSignals,
    stateChecks,
    fallbackTask,
  };
}

export function buildReadinessRunbookScenarioMonitorReadyBoard(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioMonitorReadyBoard | null {
  const statusBoard = buildReadinessRunbookScenarioMonitorStatusBoard(state, focus);
  const liveBoard = buildReadinessRunbookScenarioMonitorLiveBoard(state, focus);
  const monitorBoard = buildReadinessRunbookScenarioMonitorBoard(state, focus);

  if (!statusBoard || !liveBoard || !monitorBoard) return null;

  const fallbackTask =
    statusBoard.fallbackTask ??
    liveBoard.fallbackTask ??
    monitorBoard.activeItems[0]?.task ??
    null;

  const readySignals = [
    ...statusBoard.stateSignals.slice(0, 2),
    ...monitorBoard.activeItems
      .filter((item) => item.tone === 'success' || item.tone === 'accent')
      .map((item) => `${item.label}: ${item.task?.title ?? item.detail}`)
      .slice(0, 2),
    monitorBoard.openQuestions.length === 0 ? 'Monitorklaar kan zonder open monitorvragen doorlopen.' : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const alertSignals = [
    ...statusBoard.alertSignals.slice(0, 2),
    ...monitorBoard.activeItems
      .filter((item) => item.tone === 'danger' || item.tone === 'warning')
      .map((item) => `${item.label}: ${item.task?.title ?? item.detail}`)
      .slice(0, 2),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const readyChecks = [
    statusBoard.stateChecks[0] ?? null,
    liveBoard.liveChecks[0] ?? null,
    monitorBoard.openQuestions[0] ? `Klaarvraag open: ${monitorBoard.openQuestions[0]}` : null,
    fallbackTask ? `Klaarfallback via ${fallbackTask.title}.` : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  let readyStatusLabel = 'Monitorklaar bewaken';
  let readyTone: ReadinessRunbookScenarioMonitorReadyBoard['readyTone'] = 'warning';

  if (statusBoard.stateTone === 'danger' || monitorBoard.monitorTone === 'danger') {
    readyStatusLabel = 'Monitorklaar onder druk';
    readyTone = 'danger';
  } else if (
    statusBoard.stateTone === 'success' &&
    (monitorBoard.monitorTone === 'accent' || monitorBoard.monitorTone === 'success') &&
    alertSignals.length <= 2
  ) {
    readyStatusLabel = 'Monitorklaar stabiel';
    readyTone = 'success';
  } else if (readyChecks.length >= 2) {
    readyStatusLabel = 'Monitorklaar onder controle';
    readyTone = 'accent';
  }

  return {
    headline: `Monitorklaar na ${statusBoard.headline}`,
    summary: `${readyStatusLabel}: ${readySignals.length} klaarsignalen, ${alertSignals.length} alertsignalen en ${readyChecks.length} klaarchecks.`,
    readyStatusLabel,
    readyTone,
    confidenceScore: Math.round((statusBoard.confidenceScore + liveBoard.confidenceScore) / 2),
    ownerLabel: statusBoard.ownerLabel,
    readySignals,
    alertSignals,
    readyChecks,
    fallbackTask,
  };
}

export function buildReadinessRunbookScenarioMonitorTransitionBoard(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioMonitorTransitionBoard | null {
  const readyBoard = buildReadinessRunbookScenarioMonitorReadyBoard(state, focus);
  const statusBoard = buildReadinessRunbookScenarioMonitorStatusBoard(state, focus);
  const monitorBoard = buildReadinessRunbookScenarioMonitorBoard(state, focus);

  if (!readyBoard || !statusBoard || !monitorBoard) return null;

  const fallbackTask =
    readyBoard.fallbackTask ??
    statusBoard.fallbackTask ??
    monitorBoard.activeItems[0]?.task ??
    null;

  const transitionSignals = [
    ...readyBoard.readySignals.slice(0, 2),
    ...monitorBoard.activeItems
      .filter((item) => item.tone === 'success' || item.tone === 'accent')
      .map((item) => `${item.label}: ${item.task?.title ?? item.detail}`)
      .slice(0, 2),
    monitorBoard.openQuestions.length === 0 ? 'Monitorovergang kan zonder open monitorvragen landen.' : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const alertSignals = [
    ...readyBoard.alertSignals.slice(0, 2),
    ...monitorBoard.activeItems
      .filter((item) => item.tone === 'danger' || item.tone === 'warning')
      .map((item) => `${item.label}: ${item.task?.title ?? item.detail}`)
      .slice(0, 2),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const transitionChecks = [
    readyBoard.readyChecks[0] ?? null,
    statusBoard.stateChecks[0] ?? null,
    monitorBoard.openQuestions[0] ? `Overgangsvraag open: ${monitorBoard.openQuestions[0]}` : null,
    fallbackTask ? `Overgangsfallback via ${fallbackTask.title}.` : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  let transitionStatusLabel = 'Monitorovergang bewaken';
  let transitionTone: ReadinessRunbookScenarioMonitorTransitionBoard['transitionTone'] = 'warning';

  if (readyBoard.readyTone === 'danger' || monitorBoard.monitorTone === 'danger') {
    transitionStatusLabel = 'Monitorovergang onder druk';
    transitionTone = 'danger';
  } else if (
    readyBoard.readyTone === 'success' &&
    (monitorBoard.monitorTone === 'accent' || monitorBoard.monitorTone === 'success') &&
    alertSignals.length <= 2
  ) {
    transitionStatusLabel = 'Monitorovergang stabiel';
    transitionTone = 'success';
  } else if (transitionChecks.length >= 2) {
    transitionStatusLabel = 'Monitorovergang onder controle';
    transitionTone = 'accent';
  }

  return {
    headline: `Monitorovergang na ${readyBoard.headline}`,
    summary: `${transitionStatusLabel}: ${transitionSignals.length} overgangssignalen, ${alertSignals.length} alertsignalen en ${transitionChecks.length} overgangschecks.`,
    transitionStatusLabel,
    transitionTone,
    confidenceScore: Math.round((readyBoard.confidenceScore + statusBoard.confidenceScore) / 2),
    ownerLabel: readyBoard.ownerLabel,
    transitionSignals,
    alertSignals,
    transitionChecks,
    fallbackTask,
  };
}

export function buildReadinessRunbookScenarioMonitorEntryBoard(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioMonitorEntryBoard | null {
  const transitionBoard = buildReadinessRunbookScenarioMonitorTransitionBoard(state, focus);
  const readyBoard = buildReadinessRunbookScenarioMonitorReadyBoard(state, focus);
  const monitorBoard = buildReadinessRunbookScenarioMonitorBoard(state, focus);

  if (!transitionBoard || !readyBoard || !monitorBoard) return null;

  const fallbackTask =
    transitionBoard.fallbackTask ??
    readyBoard.fallbackTask ??
    monitorBoard.activeItems[0]?.task ??
    null;

  const entrySignals = [
    ...transitionBoard.transitionSignals.slice(0, 2),
    ...monitorBoard.activeItems
      .filter((item) => item.tone === 'success' || item.tone === 'accent')
      .map((item) => `${item.label}: ${item.task?.title ?? item.detail}`)
      .slice(0, 2),
    monitorBoard.openQuestions.length === 0 ? 'Monitorintrede kan zonder open monitorvragen landen.' : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const alertSignals = [
    ...transitionBoard.alertSignals.slice(0, 2),
    ...monitorBoard.activeItems
      .filter((item) => item.tone === 'danger' || item.tone === 'warning')
      .map((item) => `${item.label}: ${item.task?.title ?? item.detail}`)
      .slice(0, 2),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const entryChecks = [
    transitionBoard.transitionChecks[0] ?? null,
    readyBoard.readyChecks[0] ?? null,
    monitorBoard.openQuestions[0] ? `Intredevraag open: ${monitorBoard.openQuestions[0]}` : null,
    fallbackTask ? `Intredefallback via ${fallbackTask.title}.` : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  let entryStatusLabel = 'Monitorintrede bewaken';
  let entryTone: ReadinessRunbookScenarioMonitorEntryBoard['entryTone'] = 'warning';

  if (transitionBoard.transitionTone === 'danger' || monitorBoard.monitorTone === 'danger') {
    entryStatusLabel = 'Monitorintrede onder druk';
    entryTone = 'danger';
  } else if (
    transitionBoard.transitionTone === 'success' &&
    (monitorBoard.monitorTone === 'accent' || monitorBoard.monitorTone === 'success') &&
    alertSignals.length <= 2
  ) {
    entryStatusLabel = 'Monitorintrede stabiel';
    entryTone = 'success';
  } else if (entryChecks.length >= 2) {
    entryStatusLabel = 'Monitorintrede onder controle';
    entryTone = 'accent';
  }

  return {
    headline: `Monitorintrede na ${transitionBoard.headline}`,
    summary: `${entryStatusLabel}: ${entrySignals.length} intredesignalen, ${alertSignals.length} alertsignalen en ${entryChecks.length} intredechecks.`,
    entryStatusLabel,
    entryTone,
    confidenceScore: Math.round((transitionBoard.confidenceScore + readyBoard.confidenceScore) / 2),
    ownerLabel: transitionBoard.ownerLabel,
    entrySignals,
    alertSignals,
    entryChecks,
    fallbackTask,
  };
}

export function buildReadinessRunbookScenarioMonitorInpassingBoard(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
): ReadinessRunbookScenarioMonitorInpassingBoard | null {
  const entryBoard = buildReadinessRunbookScenarioMonitorEntryBoard(state, focus);
  const transitionBoard = buildReadinessRunbookScenarioMonitorTransitionBoard(state, focus);
  const monitorBoard = buildReadinessRunbookScenarioMonitorBoard(state, focus);

  if (!entryBoard || !transitionBoard || !monitorBoard) return null;

  const fallbackTask =
    entryBoard.fallbackTask ??
    transitionBoard.fallbackTask ??
    monitorBoard.activeItems[0]?.task ??
    null;

  const fitSignals = [
    ...entryBoard.entrySignals.slice(0, 2),
    ...monitorBoard.activeItems
      .filter((item) => item.tone === 'success' || item.tone === 'accent')
      .map((item) => `${item.label}: ${item.task?.title ?? item.detail}`)
      .slice(0, 2),
    monitorBoard.openQuestions.length === 0 ? 'Monitorinpassing kan zonder open monitorvragen sluiten.' : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const alertSignals = [
    ...entryBoard.alertSignals.slice(0, 2),
    ...monitorBoard.activeItems
      .filter((item) => item.tone === 'danger' || item.tone === 'warning')
      .map((item) => `${item.label}: ${item.task?.title ?? item.detail}`)
      .slice(0, 2),
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const fitChecks = [
    entryBoard.entryChecks[0] ?? null,
    transitionBoard.transitionChecks[0] ?? null,
    monitorBoard.openQuestions[0] ? `Inpassingsvraag open: ${monitorBoard.openQuestions[0]}` : null,
    fallbackTask ? `Inpassingsfallback via ${fallbackTask.title}.` : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  let fitStatusLabel = 'Monitorinpassing bewaken';
  let fitTone: ReadinessRunbookScenarioMonitorInpassingBoard['fitTone'] = 'warning';

  if (entryBoard.entryTone === 'danger' || monitorBoard.monitorTone === 'danger') {
    fitStatusLabel = 'Monitorinpassing onder druk';
    fitTone = 'danger';
  } else if (
    entryBoard.entryTone === 'success' &&
    (monitorBoard.monitorTone === 'accent' || monitorBoard.monitorTone === 'success') &&
    alertSignals.length <= 2
  ) {
    fitStatusLabel = 'Monitorinpassing stabiel';
    fitTone = 'success';
  } else if (fitChecks.length >= 2) {
    fitStatusLabel = 'Monitorinpassing onder controle';
    fitTone = 'accent';
  }

  return {
    headline: `Monitorinpassing na ${entryBoard.headline}`,
    summary: `${fitStatusLabel}: ${fitSignals.length} inpassingssignalen, ${alertSignals.length} alertsignalen en ${fitChecks.length} inpassingschecks.`,
    fitStatusLabel,
    fitTone,
    confidenceScore: Math.round((entryBoard.confidenceScore + transitionBoard.confidenceScore) / 2),
    ownerLabel: entryBoard.ownerLabel,
    fitSignals,
    alertSignals,
    fitChecks,
    fallbackTask,
  };
}

export function buildReadinessRunbookScenarioComparisonReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const scenarios = buildReadinessRunbookScenarioComparison(state, focus);

  return [
    reportName,
    'Go-live scenariovergelijking 3 zetten',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    'Scenario’s:',
    ...(scenarios.length > 0
      ? scenarios.map(
          (scenario, index) =>
            `${index + 1}. Start met ${scenario.startingMove.task.title}: ready ${scenario.summary.finalReadyTasks} | geblokkeerd ${scenario.summary.finalBlockedTasks} | klaar ${scenario.summary.finalCompletedCount}/${scenario.summary.totalTasks} (${scenario.summary.completionRate}%) | delta ready ${scenario.summary.deltaReady >= 0 ? '+' : ''}${scenario.summary.deltaReady}`
        )
      : ['Geen scenariovergelijking beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioBriefingReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const briefing = buildReadinessRunbookScenarioBriefing(state, focus);

  return [
    reportName,
    'Go-live scenario-briefing',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(briefing
      ? [
          briefing.headline,
          briefing.summary,
          `Winnaar: ${briefing.winner?.startingMove.task.title ?? 'Geen'}`,
          `Uitdager: ${briefing.challenger?.startingMove.task.title ?? 'Geen'}`,
          `Vertrouwen: ${briefing.confidenceScore}% | Stabiliteit: ${briefing.volatilityLabel} | Fork: ${briefing.forkStep ?? 'geen vroege vork'}`,
          `Hotspot: ${briefing.phaseHotspot?.label ?? 'geen'} | Top-risico: ${briefing.topRisk ? `${briefing.topRisk.task.title} (${briefing.topRisk.riskScore})` : 'geen'}`,
          `Playbook: doen ${briefing.mustDoCount} | kiezen ${briefing.chooseCount} | bewaken ${briefing.watchCount} | overlap ${briefing.consensusCount}`,
        ]
      : ['Geen scenario-briefing beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioRouteBoardReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const board = buildReadinessRunbookScenarioRouteBoard(state, focus);

  return [
    reportName,
    'Go-live scenario-routebord',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(board
      ? [
          board.headline,
          board.summary,
          ...board.rows.map(
            (row) =>
              `${row.order}. ${row.relationLabel}: winnaar ${row.winnerTask?.title ?? '-'}${row.winnerPhaseLabel ? ` [${row.winnerPhaseLabel}]` : ''} | uitdager ${row.challengerTask?.title ?? '-'}${row.challengerPhaseLabel ? ` [${row.challengerPhaseLabel}]` : ''}`
          ),
        ]
      : ['Geen scenario-routebord beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioDecisionBoardReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const board = buildReadinessRunbookScenarioDecisionBoard(state, focus);

  return [
    reportName,
    'Go-live scenario-keuzebord',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(board
      ? [
          board.headline,
          board.summary,
          `Voor de vork: ${board.preForkTasks.length > 0 ? board.preForkTasks.map((item) => item.task.title).join(', ') : 'geen gedeelde prefix'}`,
          `Keuze: ${board.winnerDecision?.task.title ?? 'geen winzet'} vs ${board.challengerDecision?.task.title ?? 'geen uitdagerzet'}`,
          `Na winpad: ${board.winnerAfter.length > 0 ? board.winnerAfter.map((item) => item.task.title).join(', ') : 'geen extra winstappen'}`,
          `Na uitdager: ${board.challengerAfter.length > 0 ? board.challengerAfter.map((item) => item.task.title).join(', ') : 'geen extra uitdagerstappen'}`,
        ]
      : ['Geen scenario-keuzebord beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioCommitBoardReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const board = buildReadinessRunbookScenarioCommitBoard(state, focus);

  return [
    reportName,
    'Go-live scenario-commit',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(board
      ? [
          board.headline,
          board.summary,
          `Status: ${board.decisionStatusLabel} | Vertrouwen ${board.confidenceScore}% | Fork ${board.forkStep ?? 'geen'}`,
          `Commit: ${board.commitTask?.title ?? 'geen'}`,
          `Fallback: ${board.fallbackTask?.title ?? 'geen'}`,
          `Guardrail: ${board.guardrailTask?.title ?? 'geen'}`,
          `Open vragen: ${board.openQuestions.length > 0 ? board.openQuestions.join(' | ') : 'geen open vragen'}`,
        ]
      : ['Geen scenario-commit beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioMonitorBoardReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const board = buildReadinessRunbookScenarioMonitorBoard(state, focus);

  return [
    reportName,
    'Go-live scenario-monitor',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(board
      ? [
          board.headline,
          board.summary,
          `Status: ${board.monitorStatusLabel}`,
          `Monitorpunten: ${board.activeItems.length > 0 ? board.activeItems.map((item) => `${item.label}: ${item.task?.title ?? 'geen taak'}`).join(' | ') : 'geen actieve punten'}`,
          `Open vragen: ${board.openQuestions.length > 0 ? board.openQuestions.join(' | ') : 'geen open vragen'}`,
        ]
      : ['Geen scenario-monitor beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioActionBoardReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const board = buildReadinessRunbookScenarioActionBoard(state, focus);

  return [
    reportName,
    'Go-live scenario-actiebord',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(board
      ? [
          board.headline,
          board.summary,
          `Status: ${board.actionStatusLabel} | Vertrouwen ${board.confidenceScore}%`,
          `Direct doen: ${board.immediateTasks.length > 0 ? board.immediateTasks.map((item) => item.task.title).join(', ') : 'geen directe taken'}`,
          `Fallback warm: ${board.fallbackTasks.length > 0 ? board.fallbackTasks.map((item) => item.task.title).join(', ') : 'geen fallbacktaken'}`,
          `Verifiëren: ${board.verifyTasks.length > 0 ? board.verifyTasks.map((item) => item.task.title).join(', ') : 'geen verificaties'}`,
        ]
      : ['Geen scenario-actiebord beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioHandoverBoardReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const board = buildReadinessRunbookScenarioHandoverBoard(state, focus);

  return [
    reportName,
    'Go-live scenario-handoverbord',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(board
      ? [
          board.headline,
          board.summary,
          `Status: ${board.handoverStatusLabel} | Eigenaar: ${board.ownerLabel} | Vertrouwen ${board.confidenceScore}%`,
          `Nu doorzetten: ${board.nowTasks.length > 0 ? board.nowTasks.map((item) => item.task.title).join(', ') : 'geen directe overdrachtstaken'}`,
          `Bewaken: ${board.watchTasks.length > 0 ? board.watchTasks.map((item) => item.task.title).join(', ') : 'geen bewakingstaken'}`,
          `Escaleren: ${board.escalateTasks.length > 0 ? board.escalateTasks.map((item) => item.task.title).join(', ') : 'geen escalatiepunten'}`,
        ]
      : ['Geen scenario-handoverbord beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioEscalationBoardReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const board = buildReadinessRunbookScenarioEscalationBoard(state, focus);

  return [
    reportName,
    'Go-live scenario-escalatiebord',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(board
      ? [
          board.headline,
          board.summary,
          `Status: ${board.escalationStatusLabel} | Vertrouwen ${board.confidenceScore}%`,
          `Urgent: ${board.urgentTasks.length > 0 ? board.urgentTasks.map((item) => item.task.title).join(', ') : 'geen urgente punten'}`,
          `Vangrails: ${board.fallbackTasks.length > 0 ? board.fallbackTasks.map((item) => item.task.title).join(', ') : 'geen fallbacktaken'}`,
          `Triggers: ${board.triggerQuestions.length > 0 ? board.triggerQuestions.join(' | ') : 'geen actieve triggers'}`,
        ]
      : ['Geen scenario-escalatiebord beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioRollbackBoardReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const board = buildReadinessRunbookScenarioRollbackBoard(state, focus);

  return [
    reportName,
    'Go-live scenario-rollbackbord',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(board
      ? [
          board.headline,
          board.summary,
          `Status: ${board.rollbackStatusLabel} | Vertrouwen ${board.confidenceScore}%`,
          `Rollback op: ${board.rollbackTask?.title ?? 'geen expliciete rollbacktaak'}`,
          `Veilige terugval: ${board.safeTasks.length > 0 ? board.safeTasks.map((item) => item.task.title).join(', ') : 'geen veilige terugvalstappen'}`,
          `Vasthouden: ${board.holdTasks.length > 0 ? board.holdTasks.map((item) => item.task.title).join(', ') : 'geen hold-taken'}`,
          `Signalen: ${board.rollbackSignals.length > 0 ? board.rollbackSignals.join(' | ') : 'geen rollbacksignalen'}`,
        ]
      : ['Geen scenario-rollbackbord beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioRecoveryBoardReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const board = buildReadinessRunbookScenarioRecoveryBoard(state, focus);

  return [
    reportName,
    'Go-live scenario-herstelbord',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(board
      ? [
          board.headline,
          board.summary,
          `Status: ${board.recoveryStatusLabel} | Vertrouwen ${board.confidenceScore}%`,
          `Hervatten via: ${board.resumeTask?.title ?? 'geen expliciete hervatstap'}`,
          `Stabiliseren: ${board.stabilizeTasks.length > 0 ? board.stabilizeTasks.map((item) => item.task.title).join(', ') : 'geen stabilisatie-acties'}`,
          `Herstarten: ${board.rebuildTasks.length > 0 ? board.rebuildTasks.map((item) => item.task.title).join(', ') : 'geen herstartstappen'}`,
          `Checks: ${board.recoveryChecks.length > 0 ? board.recoveryChecks.join(' | ') : 'geen herstelchecks'}`,
        ]
      : ['Geen scenario-herstelbord beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioReleaseGateReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const board = buildReadinessRunbookScenarioReleaseGate(state, focus);

  return [
    reportName,
    'Go-live scenario-releasepoort',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(board
      ? [
          board.headline,
          board.summary,
          `Status: ${board.gateStatusLabel} | Vertrouwen ${board.confidenceScore}% | Eigenaar ${board.ownerLabel}`,
          `Vrijgeven via: ${board.releaseTask?.title ?? 'geen expliciete releasetaak'}`,
          `Hold op: ${board.holdTask?.title ?? 'geen expliciete hold-taak'}`,
          `Checks: ${board.readinessChecks.length > 0 ? board.readinessChecks.join(' | ') : 'geen checks'}`,
          `Blokkers: ${board.blockers.length > 0 ? board.blockers.join(' | ') : 'geen blokkers'}`,
        ]
      : ['Geen scenario-releasepoort beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioCutoverBoardReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const board = buildReadinessRunbookScenarioCutoverBoard(state, focus);

  return [
    reportName,
    'Go-live scenario-cutoverbord',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(board
      ? [
          board.headline,
          board.summary,
          `Status: ${board.cutoverStatusLabel} | Vertrouwen ${board.confidenceScore}% | Eigenaar ${board.ownerLabel}`,
          `Nu live zetten: ${board.launchTasks.length > 0 ? board.launchTasks.map((item) => item.task.title).join(', ') : 'geen launchstappen'}`,
          `Valideren: ${board.verifyTasks.length > 0 ? board.verifyTasks.map((item) => item.task.title).join(', ') : 'geen verificaties'}`,
          `Fallback: ${board.fallbackTask?.title ?? 'geen expliciete fallback'}`,
          `Checks: ${board.cutoverChecks.length > 0 ? board.cutoverChecks.join(' | ') : 'geen cutoverchecks'}`,
        ]
      : ['Geen scenario-cutoverbord beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioSmokeBoardReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const board = buildReadinessRunbookScenarioSmokeBoard(state, focus);

  return [
    reportName,
    'Go-live scenario-smokebord',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(board
      ? [
          board.headline,
          board.summary,
          `Status: ${board.smokeStatusLabel} | Vertrouwen ${board.confidenceScore}% | Eigenaar ${board.ownerLabel}`,
          `Groen: ${board.greenChecks.length > 0 ? board.greenChecks.join(' | ') : 'geen groene checks'}`,
          `Bewaken: ${board.watchChecks.length > 0 ? board.watchChecks.join(' | ') : 'geen watch checks'}`,
          `Rooksignalen: ${board.failingChecks.length > 0 ? board.failingChecks.join(' | ') : 'geen rooksignalen'}`,
          `Fallback: ${board.fallbackTask?.title ?? 'geen expliciete fallback'}`,
        ]
      : ['Geen scenario-smokebord beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioHypercareBoardReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const board = buildReadinessRunbookScenarioHypercareBoard(state, focus);

  return [
    reportName,
    'Go-live scenario-hypercarebord',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(board
      ? [
          board.headline,
          board.summary,
          `Status: ${board.hypercareStatusLabel} | Vertrouwen ${board.confidenceScore}% | Eigenaar ${board.ownerLabel}`,
          `Warm houden: ${board.keepWarmTasks.length > 0 ? board.keepWarmTasks.map((item) => item.task.title).join(', ') : 'geen warme taken'}`,
          `Volgen: ${board.watchItems.length > 0 ? board.watchItems.join(' | ') : 'geen watch items'}`,
          `Opschalen: ${board.escalateItems.length > 0 ? board.escalateItems.join(' | ') : 'geen opschaalsignalen'}`,
          `Fallback: ${board.fallbackTask?.title ?? 'geen expliciete fallback'}`,
        ]
      : ['Geen scenario-hypercarebord beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioExitBoardReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const board = buildReadinessRunbookScenarioExitBoard(state, focus);

  return [
    reportName,
    'Go-live scenario-exitbord',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(board
      ? [
          board.headline,
          board.summary,
          `Status: ${board.exitStatusLabel} | Vertrouwen ${board.confidenceScore}% | Eigenaar ${board.ownerLabel}`,
          `Exitchecks: ${board.exitChecks.length > 0 ? board.exitChecks.join(' | ') : 'geen exitchecks'}`,
          `Blijven volgen: ${board.keepWatchItems.length > 0 ? board.keepWatchItems.join(' | ') : 'geen watch-items'}`,
          `Blokkers: ${board.rollbackSignals.length > 0 ? board.rollbackSignals.join(' | ') : 'geen exitsignalen'}`,
          `Fallback: ${board.fallbackTask?.title ?? 'geen expliciete fallback'}`,
        ]
      : ['Geen scenario-exitbord beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioSteadyStateBoardReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const board = buildReadinessRunbookScenarioSteadyStateBoard(state, focus);

  return [
    reportName,
    'Go-live scenario-steady-statebord',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(board
      ? [
          board.headline,
          board.summary,
          `Status: ${board.steadyStatusLabel} | Vertrouwen ${board.confidenceScore}% | Eigenaar ${board.ownerLabel}`,
          `Keep-alive: ${board.keepAliveChecks.length > 0 ? board.keepAliveChecks.join(' | ') : 'geen keep-alive checks'}`,
          `Volgen: ${board.watchItems.length > 0 ? board.watchItems.join(' | ') : 'geen watch-items'}`,
          `Alerts: ${board.alertSignals.length > 0 ? board.alertSignals.join(' | ') : 'geen alerts'}`,
          `Fallback: ${board.fallbackTask?.title ?? 'geen expliciete fallback'}`,
        ]
      : ['Geen scenario-steady-statebord beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioIncidentBoardReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const board = buildReadinessRunbookScenarioIncidentBoard(state, focus);

  return [
    reportName,
    'Go-live scenario-incidentbord',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(board
      ? [
          board.headline,
          board.summary,
          `Status: ${board.incidentStatusLabel} | Vertrouwen ${board.confidenceScore}% | Eigenaar ${board.ownerLabel}`,
          `First response: ${board.firstResponseSignals.length > 0 ? board.firstResponseSignals.join(' | ') : 'geen first-response signalen'}`,
          `Onderzoeken: ${board.investigateSignals.length > 0 ? board.investigateSignals.join(' | ') : 'geen onderzoekspunten'}`,
          `Escaleren: ${board.escalateSignals.length > 0 ? board.escalateSignals.join(' | ') : 'geen escalatiesignalen'}`,
          `Fallback: ${board.fallbackTask?.title ?? 'geen expliciete fallback'}`,
        ]
      : ['Geen scenario-incidentbord beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioRcaBoardReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const board = buildReadinessRunbookScenarioRcaBoard(state, focus);

  return [
    reportName,
    'Go-live scenario-rcabord',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(board
      ? [
          board.headline,
          board.summary,
          `Status: ${board.rcaStatusLabel} | Vertrouwen ${board.confidenceScore}% | Eigenaar ${board.ownerLabel}`,
          `Root cause: ${board.rootCauseSignals.length > 0 ? board.rootCauseSignals.join(' | ') : 'geen oorzaaksporen'}`,
          `Containment: ${board.containmentSignals.length > 0 ? board.containmentSignals.join(' | ') : 'geen containmentlijnen'}`,
          `Blijvende fix: ${board.permanentFixSignals.length > 0 ? board.permanentFixSignals.join(' | ') : 'geen blijvende fixes'}`,
          `Fallback: ${board.fallbackTask?.title ?? 'geen expliciete fallback'}`,
        ]
      : ['Geen scenario-rcabord beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioPostmortemBoardReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const board = buildReadinessRunbookScenarioPostmortemBoard(state, focus);

  return [
    reportName,
    'Go-live scenario-postmortembord',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(board
      ? [
          board.headline,
          board.summary,
          `Status: ${board.postmortemStatusLabel} | Vertrouwen ${board.confidenceScore}% | Eigenaar ${board.ownerLabel}`,
          `Bevindingen: ${board.findings.length > 0 ? board.findings.join(' | ') : 'geen bevindingen'}`,
          `Vervolgacties: ${board.followUpActions.length > 0 ? board.followUpActions.join(' | ') : 'geen vervolgacties'}`,
          `Preventie: ${board.preventionSignals.length > 0 ? board.preventionSignals.join(' | ') : 'geen preventiesignalen'}`,
          `Fallback: ${board.fallbackTask?.title ?? 'geen expliciete fallback'}`,
        ]
      : ['Geen scenario-postmortembord beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioImprovementBoardReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const board = buildReadinessRunbookScenarioImprovementBoard(state, focus);

  return [
    reportName,
    'Go-live scenario-verbeterbord',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(board
      ? [
          board.headline,
          board.summary,
          `Status: ${board.improvementStatusLabel} | Vertrouwen ${board.confidenceScore}% | Eigenaar ${board.ownerLabel}`,
          `Structureel: ${board.structuralImprovements.length > 0 ? board.structuralImprovements.join(' | ') : 'geen structurele verbeteringen'}`,
          `Proces: ${board.processImprovements.length > 0 ? board.processImprovements.join(' | ') : 'geen procesverbeteringen'}`,
          `Borging: ${board.safeguardSignals.length > 0 ? board.safeguardSignals.join(' | ') : 'geen borgingssignalen'}`,
          `Fallback: ${board.fallbackTask?.title ?? 'geen expliciete fallback'}`,
        ]
      : ['Geen scenario-verbeterbord beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioSafeguardBoardReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const board = buildReadinessRunbookScenarioSafeguardBoard(state, focus);

  return [
    reportName,
    'Go-live scenario-borgingsbord',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(board
      ? [
          board.headline,
          board.summary,
          `Status: ${board.safeguardStatusLabel} | Vertrouwen ${board.confidenceScore}% | Eigenaar ${board.ownerLabel}`,
          `Eigenaarschap: ${board.ownershipSignals.length > 0 ? board.ownershipSignals.join(' | ') : 'geen eigenaarsignalen'}`,
          `Ritme: ${board.cadenceSignals.length > 0 ? board.cadenceSignals.join(' | ') : 'geen ritmes'}`,
          `Controle: ${board.controlChecks.length > 0 ? board.controlChecks.join(' | ') : 'geen controlepunten'}`,
          `Fallback: ${board.fallbackTask?.title ?? 'geen expliciete fallback'}`,
        ]
      : ['Geen scenario-borgingsbord beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioReviewBoardReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const board = buildReadinessRunbookScenarioReviewBoard(state, focus);

  return [
    reportName,
    'Go-live scenario-reviewbord',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(board
      ? [
          board.headline,
          board.summary,
          `Status: ${board.reviewStatusLabel} | Vertrouwen ${board.confidenceScore}% | Eigenaar ${board.ownerLabel}`,
          `Bewijs: ${board.evidenceSignals.length > 0 ? board.evidenceSignals.join(' | ') : 'geen bewijsstukken'}`,
          `Review: ${board.reviewQuestions.length > 0 ? board.reviewQuestions.join(' | ') : 'geen reviewpunten'}`,
          `Akkoord: ${board.approvalChecks.length > 0 ? board.approvalChecks.join(' | ') : 'geen akkoordchecks'}`,
          `Fallback: ${board.fallbackTask?.title ?? 'geen expliciete fallback'}`,
        ]
      : ['Geen scenario-reviewbord beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioSignoffBoardReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const board = buildReadinessRunbookScenarioSignoffBoard(state, focus);

  return [
    reportName,
    'Go-live scenario-sign-offbord',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(board
      ? [
          board.headline,
          board.summary,
          `Status: ${board.signoffStatusLabel} | Vertrouwen ${board.confidenceScore}% | Eigenaar ${board.ownerLabel}`,
          `Approvers: ${board.approverSignals.length > 0 ? board.approverSignals.join(' | ') : 'geen approversignalen'}`,
          `Voorwaarden: ${board.signoffConditions.length > 0 ? board.signoffConditions.join(' | ') : 'geen voorwaarden'}`,
          `Vrijgavechecks: ${board.releaseChecks.length > 0 ? board.releaseChecks.join(' | ') : 'geen vrijgavechecks'}`,
          `Fallback: ${board.fallbackTask?.title ?? 'geen expliciete fallback'}`,
        ]
      : ['Geen scenario-sign-offbord beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioAcceptanceBoardReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const board = buildReadinessRunbookScenarioAcceptanceBoard(state, focus);

  return [
    reportName,
    'Go-live scenario-acceptatiebord',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(board
      ? [
          board.headline,
          board.summary,
          `Status: ${board.acceptanceStatusLabel} | Vertrouwen ${board.confidenceScore}% | Eigenaar ${board.ownerLabel}`,
          `Acceptatie: ${board.acceptanceSignals.length > 0 ? board.acceptanceSignals.join(' | ') : 'geen acceptatiesignalen'}`,
          `Bewaken: ${board.watchSignals.length > 0 ? board.watchSignals.join(' | ') : 'geen bewakingspunten'}`,
          `Gereedchecks: ${board.readinessChecks.length > 0 ? board.readinessChecks.join(' | ') : 'geen gereedchecks'}`,
          `Fallback: ${board.fallbackTask?.title ?? 'geen expliciete fallback'}`,
        ]
      : ['Geen scenario-acceptatiebord beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioActivationBoardReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const board = buildReadinessRunbookScenarioActivationBoard(state, focus);

  return [
    reportName,
    'Go-live scenario-activatiebord',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(board
      ? [
          board.headline,
          board.summary,
          `Status: ${board.activationStatusLabel} | Vertrouwen ${board.confidenceScore}% | Eigenaar ${board.ownerLabel}`,
          `Launch: ${board.launchSignals.length > 0 ? board.launchSignals.join(' | ') : 'geen launchsignalen'}`,
          `Eerste watch: ${board.firstWatchSignals.length > 0 ? board.firstWatchSignals.join(' | ') : 'geen watch-signalen'}`,
          `Activatiechecks: ${board.activationChecks.length > 0 ? board.activationChecks.join(' | ') : 'geen activatiechecks'}`,
          `Fallback: ${board.fallbackTask?.title ?? 'geen expliciete fallback'}`,
        ]
      : ['Geen scenario-activatiebord beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioStabilizationBoardReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const board = buildReadinessRunbookScenarioStabilizationBoard(state, focus);

  return [
    reportName,
    'Go-live scenario-stabilisatiebord',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(board
      ? [
          board.headline,
          board.summary,
          `Status: ${board.stabilizationStatusLabel} | Vertrouwen ${board.confidenceScore}% | Eigenaar ${board.ownerLabel}`,
          `Settle: ${board.settleSignals.length > 0 ? board.settleSignals.join(' | ') : 'geen settle-signalen'}`,
          `Vroege drift: ${board.earlyDriftSignals.length > 0 ? board.earlyDriftSignals.join(' | ') : 'geen drift-signalen'}`,
          `Stabilisatiechecks: ${board.stabilizationChecks.length > 0 ? board.stabilizationChecks.join(' | ') : 'geen stabilisatiechecks'}`,
          `Fallback: ${board.fallbackTask?.title ?? 'geen expliciete fallback'}`,
        ]
      : ['Geen scenario-stabilisatiebord beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioValidationBoardReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const board = buildReadinessRunbookScenarioValidationBoard(state, focus);

  return [
    reportName,
    'Go-live scenario-validatiebord',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(board
      ? [
          board.headline,
          board.summary,
          `Status: ${board.validationStatusLabel} | Vertrouwen ${board.confidenceScore}% | Eigenaar ${board.ownerLabel}`,
          `Uitkomst: ${board.outcomeSignals.length > 0 ? board.outcomeSignals.join(' | ') : 'geen uitkomstsignalen'}`,
          `Vragen: ${board.validationQuestions.length > 0 ? board.validationQuestions.join(' | ') : 'geen validatievragen'}`,
          `Checks: ${board.validationChecks.length > 0 ? board.validationChecks.join(' | ') : 'geen validatiechecks'}`,
          `Fallback: ${board.fallbackTask?.title ?? 'geen expliciete fallback'}`,
        ]
      : ['Geen scenario-validatiebord beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioAssuranceBoardReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const board = buildReadinessRunbookScenarioAssuranceBoard(state, focus);

  return [
    reportName,
    'Go-live scenario-assurancebord',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(board
      ? [
          board.headline,
          board.summary,
          `Status: ${board.assuranceStatusLabel} | Vertrouwen ${board.confidenceScore}% | Eigenaar ${board.ownerLabel}`,
          `Trusted signals: ${board.trustedSignals.length > 0 ? board.trustedSignals.join(' | ') : 'geen trusted signals'}`,
          `Watch: ${board.assuranceWatchSignals.length > 0 ? board.assuranceWatchSignals.join(' | ') : 'geen watch-signalen'}`,
          `Assurancechecks: ${board.assuranceChecks.length > 0 ? board.assuranceChecks.join(' | ') : 'geen assurancechecks'}`,
          `Fallback: ${board.fallbackTask?.title ?? 'geen expliciete fallback'}`,
        ]
      : ['Geen scenario-assurancebord beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioGreenlightBoardReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const board = buildReadinessRunbookScenarioGreenlightBoard(state, focus);

  return [
    reportName,
    'Go-live scenario-greenlightbord',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(board
      ? [
          board.headline,
          board.summary,
          `Status: ${board.greenlightStatusLabel} | Vertrouwen ${board.confidenceScore}% | Eigenaar ${board.ownerLabel}`,
          `Greensignalen: ${board.greenlightSignals.length > 0 ? board.greenlightSignals.join(' | ') : 'geen greensignalen'}`,
          `Caution: ${board.cautionSignals.length > 0 ? board.cautionSignals.join(' | ') : 'geen caution-signalen'}`,
          `Go-checks: ${board.goChecks.length > 0 ? board.goChecks.join(' | ') : 'geen go-checks'}`,
          `Fallback: ${board.fallbackTask?.title ?? 'geen expliciete fallback'}`,
        ]
      : ['Geen scenario-greenlightbord beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioGoNoBoardReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const board = buildReadinessRunbookScenarioGoNoBoard(state, focus);

  return [
    reportName,
    'Go-live scenario-go-nobord',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(board
      ? [
          board.headline,
          board.summary,
          `Status: ${board.goNoStatusLabel} | Vertrouwen ${board.confidenceScore}% | Eigenaar ${board.ownerLabel}`,
          `Go-signalen: ${board.goSignals.length > 0 ? board.goSignals.join(' | ') : 'geen go-signalen'}`,
          `Hold-signalen: ${board.holdSignals.length > 0 ? board.holdSignals.join(' | ') : 'geen hold-signalen'}`,
          `Beslischecks: ${board.decisionChecks.length > 0 ? board.decisionChecks.join(' | ') : 'geen beslischecks'}`,
          `Fallback: ${board.fallbackTask?.title ?? 'geen expliciete fallback'}`,
        ]
      : ['Geen scenario-go-nobord beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioWatchStartBoardReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const board = buildReadinessRunbookScenarioWatchStartBoard(state, focus);

  return [
    reportName,
    'Go-live scenario-bewakingsstartbord',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(board
      ? [
          board.headline,
          board.summary,
          `Status: ${board.watchStatusLabel} | Vertrouwen ${board.confidenceScore}% | Eigenaar ${board.ownerLabel}`,
          `Armed signals: ${board.armedSignals.length > 0 ? board.armedSignals.join(' | ') : 'geen armed signals'}`,
          `Watch-signalen: ${board.watchSignals.length > 0 ? board.watchSignals.join(' | ') : 'geen watch-signalen'}`,
          `Startchecks: ${board.startChecks.length > 0 ? board.startChecks.join(' | ') : 'geen startchecks'}`,
          `Fallback: ${board.fallbackTask?.title ?? 'geen expliciete fallback'}`,
        ]
      : ['Geen scenario-bewakingsstartbord beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioFirstHourBoardReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const board = buildReadinessRunbookScenarioFirstHourBoard(state, focus);

  return [
    reportName,
    'Go-live scenario-eerste-uurbord',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(board
      ? [
          board.headline,
          board.summary,
          `Status: ${board.firstHourStatusLabel} | Vertrouwen ${board.confidenceScore}% | Eigenaar ${board.ownerLabel}`,
          `Stabiele signalen: ${board.stableSignals.length > 0 ? board.stableSignals.join(' | ') : 'geen stabiele signalen'}`,
          `Drift-signalen: ${board.driftSignals.length > 0 ? board.driftSignals.join(' | ') : 'geen drift-signalen'}`,
          `Uurchecks: ${board.firstHourChecks.length > 0 ? board.firstHourChecks.join(' | ') : 'geen uurchecks'}`,
          `Fallback: ${board.fallbackTask?.title ?? 'geen expliciete fallback'}`,
        ]
      : ['Geen scenario-eerste-uurbord beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioFirstDayBoardReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const board = buildReadinessRunbookScenarioFirstDayBoard(state, focus);

  return [
    reportName,
    'Go-live scenario-eerste-dagbord',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(board
      ? [
          board.headline,
          board.summary,
          `Status: ${board.firstDayStatusLabel} | Vertrouwen ${board.confidenceScore}% | Eigenaar ${board.ownerLabel}`,
          `Dagsignalen: ${board.daySignals.length > 0 ? board.daySignals.join(' | ') : 'geen dagsignalen'}`,
          `Drift-signalen: ${board.driftSignals.length > 0 ? board.driftSignals.join(' | ') : 'geen drift-signalen'}`,
          `Dagchecks: ${board.dayChecks.length > 0 ? board.dayChecks.join(' | ') : 'geen dagchecks'}`,
          `Fallback: ${board.fallbackTask?.title ?? 'geen expliciete fallback'}`,
        ]
      : ['Geen scenario-eerste-dagbord beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioFirstWeekBoardReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const board = buildReadinessRunbookScenarioFirstWeekBoard(state, focus);

  return [
    reportName,
    'Go-live scenario-eerste-weekbord',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(board
      ? [
          board.headline,
          board.summary,
          `Status: ${board.firstWeekStatusLabel} | Vertrouwen ${board.confidenceScore}% | Eigenaar ${board.ownerLabel}`,
          `Weeksignalen: ${board.weekSignals.length > 0 ? board.weekSignals.join(' | ') : 'geen weeksignalen'}`,
          `Risicosignalen: ${board.riskSignals.length > 0 ? board.riskSignals.join(' | ') : 'geen risicosignalen'}`,
          `Weekchecks: ${board.weekChecks.length > 0 ? board.weekChecks.join(' | ') : 'geen weekchecks'}`,
          `Fallback: ${board.fallbackTask?.title ?? 'geen expliciete fallback'}`,
        ]
      : ['Geen scenario-eerste-weekbord beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioFirstMonthBoardReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const board = buildReadinessRunbookScenarioFirstMonthBoard(state, focus);

  return [
    reportName,
    'Go-live scenario-eerste-maandbord',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(board
      ? [
          board.headline,
          board.summary,
          `Status: ${board.firstMonthStatusLabel} | Vertrouwen ${board.confidenceScore}% | Eigenaar ${board.ownerLabel}`,
          `Maandsignalen: ${board.monthSignals.length > 0 ? board.monthSignals.join(' | ') : 'geen maandsignalen'}`,
          `Risicosignalen: ${board.riskSignals.length > 0 ? board.riskSignals.join(' | ') : 'geen risicosignalen'}`,
          `Maandchecks: ${board.monthChecks.length > 0 ? board.monthChecks.join(' | ') : 'geen maandchecks'}`,
          `Fallback: ${board.fallbackTask?.title ?? 'geen expliciete fallback'}`,
        ]
      : ['Geen scenario-eerste-maandbord beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioFirstQuarterBoardReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const board = buildReadinessRunbookScenarioFirstQuarterBoard(state, focus);

  return [
    reportName,
    'Go-live scenario-eerste-kwartaalbord',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(board
      ? [
          board.headline,
          board.summary,
          `Status: ${board.firstQuarterStatusLabel} | Vertrouwen ${board.confidenceScore}% | Eigenaar ${board.ownerLabel}`,
          `Kwartaal-signalen: ${board.quarterSignals.length > 0 ? board.quarterSignals.join(' | ') : 'geen kwartaal-signalen'}`,
          `Risicosignalen: ${board.riskSignals.length > 0 ? board.riskSignals.join(' | ') : 'geen risicosignalen'}`,
          `Kwartaalchecks: ${board.quarterChecks.length > 0 ? board.quarterChecks.join(' | ') : 'geen kwartaalchecks'}`,
          `Fallback: ${board.fallbackTask?.title ?? 'geen expliciete fallback'}`,
        ]
      : ['Geen scenario-eerste-kwartaalbord beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioFirstYearBoardReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const board = buildReadinessRunbookScenarioFirstYearBoard(state, focus);

  return [
    reportName,
    'Go-live scenario-eerste-jaarbord',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(board
      ? [
          board.headline,
          board.summary,
          `Status: ${board.firstYearStatusLabel} | Vertrouwen ${board.confidenceScore}% | Eigenaar ${board.ownerLabel}`,
          `Jaarsignalen: ${board.yearSignals.length > 0 ? board.yearSignals.join(' | ') : 'geen jaarsignalen'}`,
          `Risicosignalen: ${board.riskSignals.length > 0 ? board.riskSignals.join(' | ') : 'geen risicosignalen'}`,
          `Jaarchecks: ${board.yearChecks.length > 0 ? board.yearChecks.join(' | ') : 'geen jaarchecks'}`,
          `Fallback: ${board.fallbackTask?.title ?? 'geen expliciete fallback'}`,
        ]
      : ['Geen scenario-eerste-jaarbord beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioMultiYearBoardReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const board = buildReadinessRunbookScenarioMultiYearBoard(state, focus);

  return [
    reportName,
    'Go-live scenario-meerjarenlaag',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(board
      ? [
          board.headline,
          board.summary,
          `Status: ${board.multiYearStatusLabel} | Vertrouwen ${board.confidenceScore}% | Eigenaar ${board.ownerLabel}`,
          `Lange signalen: ${board.longSignals.length > 0 ? board.longSignals.join(' | ') : 'geen lange signalen'}`,
          `Risicosignalen: ${board.riskSignals.length > 0 ? board.riskSignals.join(' | ') : 'geen risicosignalen'}`,
          `Meerjarenchecks: ${board.multiYearChecks.length > 0 ? board.multiYearChecks.join(' | ') : 'geen meerjarenchecks'}`,
          `Fallback: ${board.fallbackTask?.title ?? 'geen expliciete fallback'}`,
        ]
      : ['Geen scenario-meerjarenlaag beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioContinuityBoardReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const board = buildReadinessRunbookScenarioContinuityBoard(state, focus);

  return [
    reportName,
    'Go-live scenario-continuiteitsbord',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(board
      ? [
          board.headline,
          board.summary,
          `Status: ${board.continuityStatusLabel} | Vertrouwen ${board.confidenceScore}% | Eigenaar ${board.ownerLabel}`,
          `Continuiteitssignalen: ${board.continuitySignals.length > 0 ? board.continuitySignals.join(' | ') : 'geen continuiteitssignalen'}`,
          `Risicosignalen: ${board.riskSignals.length > 0 ? board.riskSignals.join(' | ') : 'geen risicosignalen'}`,
          `Continuiteitschecks: ${board.continuityChecks.length > 0 ? board.continuityChecks.join(' | ') : 'geen continuiteitschecks'}`,
          `Fallback: ${board.fallbackTask?.title ?? 'geen expliciete fallback'}`,
        ]
      : ['Geen scenario-continuiteitsbord beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioHealthBoardReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const board = buildReadinessRunbookScenarioHealthBoard(state, focus);

  return [
    reportName,
    'Go-live scenario-gezondheidsbord',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(board
      ? [
          board.headline,
          board.summary,
          `Status: ${board.healthStatusLabel} | Vertrouwen ${board.confidenceScore}% | Eigenaar ${board.ownerLabel}`,
          `Gezondheidssignalen: ${board.healthSignals.length > 0 ? board.healthSignals.join(' | ') : 'geen gezondheidssignalen'}`,
          `Watch-signalen: ${board.watchSignals.length > 0 ? board.watchSignals.join(' | ') : 'geen watch-signalen'}`,
          `Gezondheidschecks: ${board.healthChecks.length > 0 ? board.healthChecks.join(' | ') : 'geen gezondheidschecks'}`,
          `Fallback: ${board.fallbackTask?.title ?? 'geen expliciete fallback'}`,
        ]
      : ['Geen scenario-gezondheidsbord beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioResilienceBoardReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const board = buildReadinessRunbookScenarioResilienceBoard(state, focus);

  return [
    reportName,
    'Go-live scenario-weerbaarheidsbord',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(board
      ? [
          board.headline,
          board.summary,
          `Status: ${board.resilienceStatusLabel} | Vertrouwen ${board.confidenceScore}% | Eigenaar ${board.ownerLabel}`,
          `Weerbaarheidssignalen: ${board.resilienceSignals.length > 0 ? board.resilienceSignals.join(' | ') : 'geen weerbaarheidssignalen'}`,
          `Druksignalen: ${board.pressureSignals.length > 0 ? board.pressureSignals.join(' | ') : 'geen druksignalen'}`,
          `Weerbaarheidschecks: ${board.resilienceChecks.length > 0 ? board.resilienceChecks.join(' | ') : 'geen weerbaarheidschecks'}`,
          `Fallback: ${board.fallbackTask?.title ?? 'geen expliciete fallback'}`,
        ]
      : ['Geen scenario-weerbaarheidsbord beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioCapacityBoardReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const board = buildReadinessRunbookScenarioCapacityBoard(state, focus);

  return [
    reportName,
    'Go-live scenario-draagkrachtbord',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(board
      ? [
          board.headline,
          board.summary,
          `Status: ${board.capacityStatusLabel} | Vertrouwen ${board.confidenceScore}% | Eigenaar ${board.ownerLabel}`,
          `Draagkrachtsignalen: ${board.capacitySignals.length > 0 ? board.capacitySignals.join(' | ') : 'geen draagkrachtsignalen'}`,
          `Load-signalen: ${board.loadSignals.length > 0 ? board.loadSignals.join(' | ') : 'geen load-signalen'}`,
          `Draagkrachtchecks: ${board.capacityChecks.length > 0 ? board.capacityChecks.join(' | ') : 'geen draagkrachtchecks'}`,
          `Fallback: ${board.fallbackTask?.title ?? 'geen expliciete fallback'}`,
        ]
      : ['Geen scenario-draagkrachtbord beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioBufferBoardReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const board = buildReadinessRunbookScenarioBufferBoard(state, focus);

  return [
    reportName,
    'Go-live scenario-bufferbord',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(board
      ? [
          board.headline,
          board.summary,
          `Status: ${board.bufferStatusLabel} | Vertrouwen ${board.confidenceScore}% | Eigenaar ${board.ownerLabel}`,
          `Buffersignalen: ${board.bufferSignals.length > 0 ? board.bufferSignals.join(' | ') : 'geen buffersignalen'}`,
          `Druksignalen: ${board.pressureSignals.length > 0 ? board.pressureSignals.join(' | ') : 'geen druksignalen'}`,
          `Bufferchecks: ${board.bufferChecks.length > 0 ? board.bufferChecks.join(' | ') : 'geen bufferchecks'}`,
          `Fallback: ${board.fallbackTask?.title ?? 'geen expliciete fallback'}`,
        ]
      : ['Geen scenario-bufferbord beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioSlackBoardReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const board = buildReadinessRunbookScenarioSlackBoard(state, focus);

  return [
    reportName,
    'Go-live scenario-spelingbord',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(board
      ? [
          board.headline,
          board.summary,
          `Status: ${board.slackStatusLabel} | Vertrouwen ${board.confidenceScore}% | Eigenaar ${board.ownerLabel}`,
          `Spelingssignalen: ${board.slackSignals.length > 0 ? board.slackSignals.join(' | ') : 'geen spelingssignalen'}`,
          `Druksignalen: ${board.pressureSignals.length > 0 ? board.pressureSignals.join(' | ') : 'geen druksignalen'}`,
          `Spelingchecks: ${board.slackChecks.length > 0 ? board.slackChecks.join(' | ') : 'geen spelingchecks'}`,
          `Fallback: ${board.fallbackTask?.title ?? 'geen expliciete fallback'}`,
        ]
      : ['Geen scenario-spelingbord beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioWatchBoardReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const board = buildReadinessRunbookScenarioWatchBoard(state, focus);

  return [
    reportName,
    'Go-live scenario-waakbord',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(board
      ? [
          board.headline,
          board.summary,
          `Status: ${board.watchStatusLabel} | Vertrouwen ${board.confidenceScore}% | Eigenaar ${board.ownerLabel}`,
          `Waaksignalen: ${board.watchSignals.length > 0 ? board.watchSignals.join(' | ') : 'geen waaksignalen'}`,
          `Alertsignalen: ${board.alertSignals.length > 0 ? board.alertSignals.join(' | ') : 'geen alertsignalen'}`,
          `Waakchecks: ${board.watchChecks.length > 0 ? board.watchChecks.join(' | ') : 'geen waakchecks'}`,
          `Fallback: ${board.fallbackTask?.title ?? 'geen expliciete fallback'}`,
        ]
      : ['Geen scenario-waakbord beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioTakeoverBoardReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const board = buildReadinessRunbookScenarioTakeoverBoard(state, focus);

  return [
    reportName,
    'Go-live scenario-overnamebord',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(board
      ? [
          board.headline,
          board.summary,
          `Status: ${board.takeoverStatusLabel} | Vertrouwen ${board.confidenceScore}% | Eigenaar ${board.ownerLabel}`,
          `Overnamesignalen: ${board.takeoverSignals.length > 0 ? board.takeoverSignals.join(' | ') : 'geen overnamesignalen'}`,
          `Alertsignalen: ${board.alertSignals.length > 0 ? board.alertSignals.join(' | ') : 'geen alertsignalen'}`,
          `Overnamechecks: ${board.takeoverChecks.length > 0 ? board.takeoverChecks.join(' | ') : 'geen overnamechecks'}`,
          `Fallback: ${board.fallbackTask?.title ?? 'geen expliciete fallback'}`,
        ]
      : ['Geen scenario-overnamebord beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioStartBoardReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const board = buildReadinessRunbookScenarioStartBoard(state, focus);

  return [
    reportName,
    'Go-live scenario-opstartbord',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(board
      ? [
          board.headline,
          board.summary,
          `Status: ${board.startStatusLabel} | Vertrouwen ${board.confidenceScore}% | Eigenaar ${board.ownerLabel}`,
          `Opstartsignalen: ${board.startSignals.length > 0 ? board.startSignals.join(' | ') : 'geen opstartsignalen'}`,
          `Alertsignalen: ${board.alertSignals.length > 0 ? board.alertSignals.join(' | ') : 'geen alertsignalen'}`,
          `Opstartchecks: ${board.startChecks.length > 0 ? board.startChecks.join(' | ') : 'geen opstartchecks'}`,
          `Fallback: ${board.fallbackTask?.title ?? 'geen expliciete fallback'}`,
        ]
      : ['Geen scenario-opstartbord beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioSwitchOnBoardReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const board = buildReadinessRunbookScenarioSwitchOnBoard(state, focus);

  return [
    reportName,
    'Go-live scenario-inschakelbord',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(board
      ? [
          board.headline,
          board.summary,
          `Status: ${board.switchStatusLabel} | Vertrouwen ${board.confidenceScore}% | Eigenaar ${board.ownerLabel}`,
          `Inschakelsignalen: ${board.switchSignals.length > 0 ? board.switchSignals.join(' | ') : 'geen inschakelsignalen'}`,
          `Alertsignalen: ${board.alertSignals.length > 0 ? board.alertSignals.join(' | ') : 'geen alertsignalen'}`,
          `Inschakelchecks: ${board.switchChecks.length > 0 ? board.switchChecks.join(' | ') : 'geen inschakelchecks'}`,
          `Fallback: ${board.fallbackTask?.title ?? 'geen expliciete fallback'}`,
        ]
      : ['Geen scenario-inschakelbord beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioLinkBoardReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const board = buildReadinessRunbookScenarioLinkBoard(state, focus);

  return [
    reportName,
    'Go-live scenario-aansluitbord',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(board
      ? [
          board.headline,
          board.summary,
          `Status: ${board.linkStatusLabel} | Vertrouwen ${board.confidenceScore}% | Eigenaar ${board.ownerLabel}`,
          `Aansluitsignalen: ${board.linkSignals.length > 0 ? board.linkSignals.join(' | ') : 'geen aansluitsignalen'}`,
          `Alertsignalen: ${board.alertSignals.length > 0 ? board.alertSignals.join(' | ') : 'geen alertsignalen'}`,
          `Aansluitchecks: ${board.linkChecks.length > 0 ? board.linkChecks.join(' | ') : 'geen aansluitchecks'}`,
          `Fallback: ${board.fallbackTask?.title ?? 'geen expliciete fallback'}`,
        ]
      : ['Geen scenario-aansluitbord beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioMonitorGateBoardReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const board = buildReadinessRunbookScenarioMonitorGateBoard(state, focus);

  return [
    reportName,
    'Go-live scenario-monitorpoort',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(board
      ? [
          board.headline,
          board.summary,
          `Status: ${board.gateStatusLabel} | Vertrouwen ${board.confidenceScore}% | Eigenaar ${board.ownerLabel}`,
          `Poortsignalen: ${board.gateSignals.length > 0 ? board.gateSignals.join(' | ') : 'geen poortsignalen'}`,
          `Alertsignalen: ${board.alertSignals.length > 0 ? board.alertSignals.join(' | ') : 'geen alertsignalen'}`,
          `Poortchecks: ${board.gateChecks.length > 0 ? board.gateChecks.join(' | ') : 'geen poortchecks'}`,
          `Fallback: ${board.fallbackTask?.title ?? 'geen expliciete fallback'}`,
        ]
      : ['Geen scenario-monitorpoort beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioMonitorReleaseBoardReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const board = buildReadinessRunbookScenarioMonitorReleaseBoard(state, focus);

  return [
    reportName,
    'Go-live scenario-monitorvrijgave',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(board
      ? [
          board.headline,
          board.summary,
          `Status: ${board.releaseStatusLabel} | Vertrouwen ${board.confidenceScore}% | Eigenaar ${board.ownerLabel}`,
          `Vrijgavesignalen: ${board.releaseSignals.length > 0 ? board.releaseSignals.join(' | ') : 'geen vrijgavesignalen'}`,
          `Alertsignalen: ${board.alertSignals.length > 0 ? board.alertSignals.join(' | ') : 'geen alertsignalen'}`,
          `Vrijgavechecks: ${board.releaseChecks.length > 0 ? board.releaseChecks.join(' | ') : 'geen vrijgavechecks'}`,
          `Fallback: ${board.fallbackTask?.title ?? 'geen expliciete fallback'}`,
        ]
      : ['Geen scenario-monitorvrijgave beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioMonitorStartBoardReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const board = buildReadinessRunbookScenarioMonitorStartBoard(state, focus);

  return [
    reportName,
    'Go-live scenario-monitorstart',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(board
      ? [
          board.headline,
          board.summary,
          `Status: ${board.startStatusLabel} | Vertrouwen ${board.confidenceScore}% | Eigenaar ${board.ownerLabel}`,
          `Startsignalen: ${board.startSignals.length > 0 ? board.startSignals.join(' | ') : 'geen startsignalen'}`,
          `Alertsignalen: ${board.alertSignals.length > 0 ? board.alertSignals.join(' | ') : 'geen alertsignalen'}`,
          `Startchecks: ${board.startChecks.length > 0 ? board.startChecks.join(' | ') : 'geen startchecks'}`,
          `Fallback: ${board.fallbackTask?.title ?? 'geen expliciete fallback'}`,
        ]
      : ['Geen scenario-monitorstart beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioMonitorRhythmBoardReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const board = buildReadinessRunbookScenarioMonitorRhythmBoard(state, focus);

  return [
    reportName,
    'Go-live scenario-monitorritme',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(board
      ? [
          board.headline,
          board.summary,
          `Status: ${board.rhythmStatusLabel} | Vertrouwen ${board.confidenceScore}% | Eigenaar ${board.ownerLabel}`,
          `Ritmesignalen: ${board.rhythmSignals.length > 0 ? board.rhythmSignals.join(' | ') : 'geen ritmesignalen'}`,
          `Alertsignalen: ${board.alertSignals.length > 0 ? board.alertSignals.join(' | ') : 'geen alertsignalen'}`,
          `Ritmechecks: ${board.rhythmChecks.length > 0 ? board.rhythmChecks.join(' | ') : 'geen ritmechecks'}`,
          `Fallback: ${board.fallbackTask?.title ?? 'geen expliciete fallback'}`,
        ]
      : ['Geen scenario-monitorritme beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioMonitorStabilizationBoardReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const board = buildReadinessRunbookScenarioMonitorStabilizationBoard(state, focus);

  return [
    reportName,
    'Go-live scenario-monitorstabilisatie',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(board
      ? [
          board.headline,
          board.summary,
          `Status: ${board.stabilizationStatusLabel} | Vertrouwen ${board.confidenceScore}% | Eigenaar ${board.ownerLabel}`,
          `Stabilisatiesignalen: ${board.stabilizationSignals.length > 0 ? board.stabilizationSignals.join(' | ') : 'geen stabilisatiesignalen'}`,
          `Alertsignalen: ${board.alertSignals.length > 0 ? board.alertSignals.join(' | ') : 'geen alertsignalen'}`,
          `Stabilisatiechecks: ${board.stabilizationChecks.length > 0 ? board.stabilizationChecks.join(' | ') : 'geen stabilisatiechecks'}`,
          `Fallback: ${board.fallbackTask?.title ?? 'geen expliciete fallback'}`,
        ]
      : ['Geen scenario-monitorstabilisatie beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioMonitorLandingBoardReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const board = buildReadinessRunbookScenarioMonitorLandingBoard(state, focus);

  return [
    reportName,
    'Go-live scenario-monitorlanding',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(board
      ? [
          board.headline,
          board.summary,
          `Status: ${board.landingStatusLabel} | Vertrouwen ${board.confidenceScore}% | Eigenaar ${board.ownerLabel}`,
          `Landingssignalen: ${board.landingSignals.length > 0 ? board.landingSignals.join(' | ') : 'geen landingssignalen'}`,
          `Alertsignalen: ${board.alertSignals.length > 0 ? board.alertSignals.join(' | ') : 'geen alertsignalen'}`,
          `Landingchecks: ${board.landingChecks.length > 0 ? board.landingChecks.join(' | ') : 'geen landingchecks'}`,
          `Fallback: ${board.fallbackTask?.title ?? 'geen expliciete fallback'}`,
        ]
      : ['Geen scenario-monitorlanding beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioMonitorHandoverBoardReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const board = buildReadinessRunbookScenarioMonitorHandoverBoard(state, focus);

  return [
    reportName,
    'Go-live scenario-monitoroverdracht',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(board
      ? [
          board.headline,
          board.summary,
          `Status: ${board.handoverStatusLabel} | Vertrouwen ${board.confidenceScore}% | Eigenaar ${board.ownerLabel}`,
          `Overdrachtsignalen: ${board.handoverSignals.length > 0 ? board.handoverSignals.join(' | ') : 'geen overdrachtsignalen'}`,
          `Alertsignalen: ${board.alertSignals.length > 0 ? board.alertSignals.join(' | ') : 'geen alertsignalen'}`,
          `Overdrachtchecks: ${board.handoverChecks.length > 0 ? board.handoverChecks.join(' | ') : 'geen overdrachtchecks'}`,
          `Fallback: ${board.fallbackTask?.title ?? 'geen expliciete fallback'}`,
        ]
      : ['Geen scenario-monitoroverdracht beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioMonitorActivationBoardReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const board = buildReadinessRunbookScenarioMonitorActivationBoard(state, focus);

  return [
    reportName,
    'Go-live scenario-monitoractivatie',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(board
      ? [
          board.headline,
          board.summary,
          `Status: ${board.activationStatusLabel} | Vertrouwen ${board.confidenceScore}% | Eigenaar ${board.ownerLabel}`,
          `Activatiesignalen: ${board.activationSignals.length > 0 ? board.activationSignals.join(' | ') : 'geen activatiesignalen'}`,
          `Alertsignalen: ${board.alertSignals.length > 0 ? board.alertSignals.join(' | ') : 'geen alertsignalen'}`,
          `Activatiechecks: ${board.activationChecks.length > 0 ? board.activationChecks.join(' | ') : 'geen activatiechecks'}`,
          `Fallback: ${board.fallbackTask?.title ?? 'geen expliciete fallback'}`,
        ]
      : ['Geen scenario-monitoractivatie beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioMonitorControlBoardReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const board = buildReadinessRunbookScenarioMonitorControlBoard(state, focus);

  return [
    reportName,
    'Go-live scenario-monitorregie',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(board
      ? [
          board.headline,
          board.summary,
          `Status: ${board.controlStatusLabel} | Vertrouwen ${board.confidenceScore}% | Eigenaar ${board.ownerLabel}`,
          `Regiesignalen: ${board.controlSignals.length > 0 ? board.controlSignals.join(' | ') : 'geen regiesignalen'}`,
          `Alertsignalen: ${board.alertSignals.length > 0 ? board.alertSignals.join(' | ') : 'geen alertsignalen'}`,
          `Regiechecks: ${board.controlChecks.length > 0 ? board.controlChecks.join(' | ') : 'geen regiechecks'}`,
          `Fallback: ${board.fallbackTask?.title ?? 'geen expliciete fallback'}`,
        ]
      : ['Geen scenario-monitorregie beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioMonitorConfirmationBoardReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const board = buildReadinessRunbookScenarioMonitorConfirmationBoard(state, focus);

  return [
    reportName,
    'Go-live scenario-monitorbevestiging',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(board
      ? [
          board.headline,
          board.summary,
          `Status: ${board.confirmationStatusLabel} | Vertrouwen ${board.confidenceScore}% | Eigenaar ${board.ownerLabel}`,
          `Bevestigingssignalen: ${board.confirmationSignals.length > 0 ? board.confirmationSignals.join(' | ') : 'geen bevestigingssignalen'}`,
          `Alertsignalen: ${board.alertSignals.length > 0 ? board.alertSignals.join(' | ') : 'geen alertsignalen'}`,
          `Bevestigingchecks: ${board.confirmationChecks.length > 0 ? board.confirmationChecks.join(' | ') : 'geen bevestigingchecks'}`,
          `Fallback: ${board.fallbackTask?.title ?? 'geen expliciete fallback'}`,
        ]
      : ['Geen scenario-monitorbevestiging beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioMonitorApprovalBoardReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const board = buildReadinessRunbookScenarioMonitorApprovalBoard(state, focus);

  return [
    reportName,
    'Go-live scenario-monitorakkoord',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(board
      ? [
          board.headline,
          board.summary,
          `Status: ${board.approvalStatusLabel} | Vertrouwen ${board.confidenceScore}% | Eigenaar ${board.ownerLabel}`,
          `Akkoordsignalen: ${board.approvalSignals.length > 0 ? board.approvalSignals.join(' | ') : 'geen akkoordsignalen'}`,
          `Alertsignalen: ${board.alertSignals.length > 0 ? board.alertSignals.join(' | ') : 'geen alertsignalen'}`,
          `Akkoordchecks: ${board.approvalChecks.length > 0 ? board.approvalChecks.join(' | ') : 'geen akkoordchecks'}`,
          `Fallback: ${board.fallbackTask?.title ?? 'geen expliciete fallback'}`,
        ]
      : ['Geen scenario-monitorakkoord beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioMonitorLeadBoardReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const board = buildReadinessRunbookScenarioMonitorLeadBoard(state, focus);

  return [
    reportName,
    'Go-live scenario-monitorleiding',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(board
      ? [
          board.headline,
          board.summary,
          `Status: ${board.leadStatusLabel} | Vertrouwen ${board.confidenceScore}% | Eigenaar ${board.ownerLabel}`,
          `Leidsignalen: ${board.leadSignals.length > 0 ? board.leadSignals.join(' | ') : 'geen leidsignalen'}`,
          `Alertsignalen: ${board.alertSignals.length > 0 ? board.alertSignals.join(' | ') : 'geen alertsignalen'}`,
          `Leidchecks: ${board.leadChecks.length > 0 ? board.leadChecks.join(' | ') : 'geen leidchecks'}`,
          `Fallback: ${board.fallbackTask?.title ?? 'geen expliciete fallback'}`,
        ]
      : ['Geen scenario-monitorleiding beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioMonitorMandateBoardReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const board = buildReadinessRunbookScenarioMonitorMandateBoard(state, focus);

  return [
    reportName,
    'Go-live scenario-monitormandaat',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(board
      ? [
          board.headline,
          board.summary,
          `Status: ${board.mandateStatusLabel} | Vertrouwen ${board.confidenceScore}% | Eigenaar ${board.ownerLabel}`,
          `Mandaatsignalen: ${board.mandateSignals.length > 0 ? board.mandateSignals.join(' | ') : 'geen mandaatsignalen'}`,
          `Alertsignalen: ${board.alertSignals.length > 0 ? board.alertSignals.join(' | ') : 'geen alertsignalen'}`,
          `Mandaatchecks: ${board.mandateChecks.length > 0 ? board.mandateChecks.join(' | ') : 'geen mandaatchecks'}`,
          `Fallback: ${board.fallbackTask?.title ?? 'geen expliciete fallback'}`,
        ]
      : ['Geen scenario-monitormandaat beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioMonitorDecisionBoardReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const board = buildReadinessRunbookScenarioMonitorDecisionBoard(state, focus);

  return [
    reportName,
    'Go-live scenario-monitorbesluit',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(board
      ? [
          board.headline,
          board.summary,
          `Status: ${board.decisionStatusLabel} | Vertrouwen ${board.confidenceScore}% | Eigenaar ${board.ownerLabel}`,
          `Besluitsignalen: ${board.decisionSignals.length > 0 ? board.decisionSignals.join(' | ') : 'geen besluitsignalen'}`,
          `Alertsignalen: ${board.alertSignals.length > 0 ? board.alertSignals.join(' | ') : 'geen alertsignalen'}`,
          `Besluitchecks: ${board.decisionChecks.length > 0 ? board.decisionChecks.join(' | ') : 'geen besluitchecks'}`,
          `Fallback: ${board.fallbackTask?.title ?? 'geen expliciete fallback'}`,
        ]
      : ['Geen scenario-monitorbesluit beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioMonitorGoBoardReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const board = buildReadinessRunbookScenarioMonitorGoBoard(state, focus);

  return [
    reportName,
    'Go-live scenario-monitorgo',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(board
      ? [
          board.headline,
          board.summary,
          `Status: ${board.goStatusLabel} | Vertrouwen ${board.confidenceScore}% | Eigenaar ${board.ownerLabel}`,
          `Go-signalen: ${board.goSignals.length > 0 ? board.goSignals.join(' | ') : 'geen go-signalen'}`,
          `Alertsignalen: ${board.alertSignals.length > 0 ? board.alertSignals.join(' | ') : 'geen alertsignalen'}`,
          `Go-checks: ${board.goChecks.length > 0 ? board.goChecks.join(' | ') : 'geen go-checks'}`,
          `Fallback: ${board.fallbackTask?.title ?? 'geen expliciete fallback'}`,
        ]
      : ['Geen scenario-monitorgo beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioMonitorLiveBoardReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const board = buildReadinessRunbookScenarioMonitorLiveBoard(state, focus);

  return [
    reportName,
    'Go-live scenario-monitorlive',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(board
      ? [
          board.headline,
          board.summary,
          `Status: ${board.liveStatusLabel} | Vertrouwen ${board.confidenceScore}% | Eigenaar ${board.ownerLabel}`,
          `Live-signalen: ${board.liveSignals.length > 0 ? board.liveSignals.join(' | ') : 'geen live-signalen'}`,
          `Alertsignalen: ${board.alertSignals.length > 0 ? board.alertSignals.join(' | ') : 'geen alertsignalen'}`,
          `Live-checks: ${board.liveChecks.length > 0 ? board.liveChecks.join(' | ') : 'geen live-checks'}`,
          `Fallback: ${board.fallbackTask?.title ?? 'geen expliciete fallback'}`,
        ]
      : ['Geen scenario-monitorlive beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioMonitorStatusBoardReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const board = buildReadinessRunbookScenarioMonitorStatusBoard(state, focus);

  return [
    reportName,
    'Go-live scenario-monitorstatus',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(board
      ? [
          board.headline,
          board.summary,
          `Status: ${board.stateLabel} | Vertrouwen ${board.confidenceScore}% | Eigenaar ${board.ownerLabel}`,
          `Statussignalen: ${board.stateSignals.length > 0 ? board.stateSignals.join(' | ') : 'geen statussignalen'}`,
          `Alertsignalen: ${board.alertSignals.length > 0 ? board.alertSignals.join(' | ') : 'geen alertsignalen'}`,
          `Statuschecks: ${board.stateChecks.length > 0 ? board.stateChecks.join(' | ') : 'geen statuschecks'}`,
          `Fallback: ${board.fallbackTask?.title ?? 'geen expliciete fallback'}`,
        ]
      : ['Geen scenario-monitorstatus beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioMonitorReadyBoardReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const board = buildReadinessRunbookScenarioMonitorReadyBoard(state, focus);

  return [
    reportName,
    'Go-live scenario-monitorklaar',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(board
      ? [
          board.headline,
          board.summary,
          `Status: ${board.readyStatusLabel} | Vertrouwen ${board.confidenceScore}% | Eigenaar ${board.ownerLabel}`,
          `Klaarsignalen: ${board.readySignals.length > 0 ? board.readySignals.join(' | ') : 'geen klaarsignalen'}`,
          `Alertsignalen: ${board.alertSignals.length > 0 ? board.alertSignals.join(' | ') : 'geen alertsignalen'}`,
          `Klaarchecks: ${board.readyChecks.length > 0 ? board.readyChecks.join(' | ') : 'geen klaarchecks'}`,
          `Fallback: ${board.fallbackTask?.title ?? 'geen expliciete fallback'}`,
        ]
      : ['Geen scenario-monitorklaar beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioMonitorTransitionBoardReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const board = buildReadinessRunbookScenarioMonitorTransitionBoard(state, focus);

  return [
    reportName,
    'Go-live scenario-monitorovergang',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(board
      ? [
          board.headline,
          board.summary,
          `Status: ${board.transitionStatusLabel} | Vertrouwen ${board.confidenceScore}% | Eigenaar ${board.ownerLabel}`,
          `Overgangssignalen: ${board.transitionSignals.length > 0 ? board.transitionSignals.join(' | ') : 'geen overgangssignalen'}`,
          `Alertsignalen: ${board.alertSignals.length > 0 ? board.alertSignals.join(' | ') : 'geen alertsignalen'}`,
          `Overgangschecks: ${board.transitionChecks.length > 0 ? board.transitionChecks.join(' | ') : 'geen overgangschecks'}`,
          `Fallback: ${board.fallbackTask?.title ?? 'geen expliciete fallback'}`,
        ]
      : ['Geen scenario-monitorovergang beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioMonitorEntryBoardReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const board = buildReadinessRunbookScenarioMonitorEntryBoard(state, focus);

  return [
    reportName,
    'Go-live scenario-monitorintrede',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(board
      ? [
          board.headline,
          board.summary,
          `Status: ${board.entryStatusLabel} | Vertrouwen ${board.confidenceScore}% | Eigenaar ${board.ownerLabel}`,
          `Intredesignalen: ${board.entrySignals.length > 0 ? board.entrySignals.join(' | ') : 'geen intredesignalen'}`,
          `Alertsignalen: ${board.alertSignals.length > 0 ? board.alertSignals.join(' | ') : 'geen alertsignalen'}`,
          `Intredechecks: ${board.entryChecks.length > 0 ? board.entryChecks.join(' | ') : 'geen intredechecks'}`,
          `Fallback: ${board.fallbackTask?.title ?? 'geen expliciete fallback'}`,
        ]
      : ['Geen scenario-monitorintrede beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioMonitorInpassingBoardReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const board = buildReadinessRunbookScenarioMonitorInpassingBoard(state, focus);

  return [
    reportName,
    'Go-live scenario-monitorinpassing',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(board
      ? [
          board.headline,
          board.summary,
          `Status: ${board.fitStatusLabel} | Vertrouwen ${board.confidenceScore}% | Eigenaar ${board.ownerLabel}`,
          `Inpassingssignalen: ${board.fitSignals.length > 0 ? board.fitSignals.join(' | ') : 'geen inpassingssignalen'}`,
          `Alertsignalen: ${board.alertSignals.length > 0 ? board.alertSignals.join(' | ') : 'geen alertsignalen'}`,
          `Inpassingschecks: ${board.fitChecks.length > 0 ? board.fitChecks.join(' | ') : 'geen inpassingschecks'}`,
          `Fallback: ${board.fallbackTask?.title ?? 'geen expliciete fallback'}`,
        ]
      : ['Geen scenario-monitorinpassing beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioSignalReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const signal = buildReadinessRunbookScenarioSignal(state, focus);

  return [
    reportName,
    'Go-live scenarioregie',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(signal
      ? [
          signal.headline,
          `Spanning: ${signal.closenessLabel}`,
          signal.summary,
          `Uitdager: ${signal.challenger?.startingMove.task.title ?? 'Geen'}`,
          `Terugkerende taken: ${signal.recurringTasks.length > 0 ? signal.recurringTasks.map((item) => `${item.task.title} (${item.hitCount}x)`).join(', ') : 'geen overlap'}`,
        ]
      : ['Geen scenarioregie beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioConsensusReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const consensus = buildReadinessRunbookScenarioConsensus(state, focus);

  return [
    reportName,
    'Go-live scenario-consensus',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(consensus
      ? [
          consensus.headline,
          consensus.summary,
          `Consensus: ${consensus.consensusTasks.length > 0 ? consensus.consensusTasks.map((item) => item.task.title).join(', ') : 'geen'}`,
          `Winnaar-only: ${consensus.winnerOnlyTasks.length > 0 ? consensus.winnerOnlyTasks.map((item) => item.task.title).join(', ') : 'geen'}`,
          `Uitdager-only: ${consensus.challengerOnlyTasks.length > 0 ? consensus.challengerOnlyTasks.map((item) => item.task.title).join(', ') : 'geen'}`,
        ]
      : ['Geen scenario-consensus beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioStabilityReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const stability = buildReadinessRunbookScenarioStability(state, focus);

  return [
    reportName,
    'Go-live scenario-stabiliteit',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(stability
      ? [
          stability.headline,
          stability.summary,
          `Winnaar: ${stability.winner?.startingMove.task.title ?? 'Geen'}`,
          `Uitdager: ${stability.challenger?.startingMove.task.title ?? 'Geen'}`,
          `Overlap: ${stability.overlapRate}% | Verschilmakers: ${stability.divergenceCount} | Vertrouwen: ${stability.confidenceScore}%`,
          `Variatie: ${stability.varianceTasks.length > 0 ? stability.varianceTasks.map((item) => item.task.title).join(', ') : 'geen'}`,
        ]
      : ['Geen scenario-stabiliteit beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioPlaybookReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const playbook = buildReadinessRunbookScenarioPlaybook(state, focus);

  return [
    reportName,
    'Go-live scenario-playbook',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(playbook
      ? [
          playbook.headline,
          playbook.summary,
          `Doen: ${playbook.mustDoTasks.length > 0 ? playbook.mustDoTasks.map((item) => item.task.title).join(', ') : 'geen vaste zetten'}`,
          `Kiezen: ${playbook.chooseTasks.length > 0 ? playbook.chooseTasks.map((item) => item.task.title).join(', ') : 'geen winnaar-only zetten'}`,
          `Bewaken: ${playbook.watchTasks.length > 0 ? playbook.watchTasks.map((item) => item.task.title).join(', ') : 'geen afwijkers'}`,
        ]
      : ['Geen scenario-playbook beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioCheckpointReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const checkpoint = buildReadinessRunbookScenarioCheckpoint(state, focus);

  return [
    reportName,
    'Go-live scenario-checkpoint',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(checkpoint
      ? [
          checkpoint.headline,
          checkpoint.summary,
          `Gelijke prefix: ${checkpoint.sharedPrefix.length > 0 ? checkpoint.sharedPrefix.map((item) => item.task.title).join(', ') : 'geen'}`,
          `Winpad daarna: ${checkpoint.winnerNext?.task.title ?? 'geen volgende zet'}`,
          `Uitdager daarna: ${checkpoint.challengerNext?.task.title ?? 'geen uitdagerzet'}`,
        ]
      : ['Geen scenario-checkpoint beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioPhaseMapReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const phaseMap = buildReadinessRunbookScenarioPhaseMap(state, focus);

  return [
    reportName,
    'Go-live scenario-fasebeeld',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(phaseMap
      ? [
          phaseMap.summary,
          ...phaseMap.items.map(
            (item) =>
              `${item.label}: shared ${item.sharedCount} | winnaar-only ${item.winnerOnlyCount} | uitdager-only ${item.challengerOnlyCount} | status ${item.statusLabel}`
          ),
        ]
      : ['Geen scenario-fasebeeld beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookScenarioRiskBoardReport(
  reportName: string,
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const board = buildReadinessRunbookScenarioRiskBoard(state, focus);

  return [
    reportName,
    'Go-live scenario-risicobord',
    `Scope: ${snapshot.scopeLabel} - ${snapshot.label}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    ...(board
      ? [
          board.summary,
          ...board.items.map(
            (item, index) =>
              `${index + 1}. ${item.task.title}: score ${item.riskScore} | ${item.statusLabel} | ${item.reasons.join(', ')}`
          ),
        ]
      : ['Geen scenario-risicobord beschikbaar voor deze scope.']),
  ].join('\n');
}

export function buildReadinessRunbookTaskTrend(
  state: ReadinessRunbookState,
  focus?: ReadinessRunbookFocus | null
) {
  const snapshot = buildReadinessRunbookFocusSnapshot(state, focus);
  const taskIds = new Set(snapshot.tasks.map((task) => task.id));
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    return {
      key: date.toISOString().slice(0, 10),
      label: date.toLocaleDateString('nl-BE', { weekday: 'short' }).replace('.', ''),
      activity: 0,
      completed: 0,
      reopened: 0,
      reset: 0,
      reopenRate: 0,
    } satisfies ReadinessRunbookTaskTrendDay;
  });

  const byDay = new Map(days.map((day) => [day.key, day]));
  state.events.forEach((event) => {
    if (event.taskId && !taskIds.has(event.taskId)) return;
    if (!event.taskId && snapshot.scopeLabel === 'Taakfocus') return;
    const createdAt = new Date(event.createdAt);
    if (Number.isNaN(createdAt.getTime())) return;
    createdAt.setHours(0, 0, 0, 0);
    const bucket = byDay.get(createdAt.toISOString().slice(0, 10));
    if (!bucket) return;
    bucket.activity += 1;
    if (event.kind === 'completed') bucket.completed += 1;
    if (event.kind === 'reopened') bucket.reopened += 1;
    if (event.kind === 'reset') bucket.reset += 1;
  });

  days.forEach((day) => {
    day.reopenRate = day.activity > 0 ? Math.round((day.reopened / day.activity) * 100) : 0;
  });

  return {
    days,
    maxActivity: Math.max(1, ...days.map((day) => day.activity)),
    maxReopenRate: Math.max(1, ...days.map((day) => day.reopenRate)),
  };
}

export function buildReadinessRunbookTrend(events: ReadinessRunbookEvent[]) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    return {
      key: date.toISOString().slice(0, 10),
      label: date.toLocaleDateString('nl-BE', { weekday: 'short' }).replace('.', ''),
      completed: 0,
      reopened: 0,
      reset: 0,
      total: 0,
    };
  });

  const byDay = new Map(days.map((day) => [day.key, day]));
  events.forEach((event) => {
    const createdAt = new Date(event.createdAt);
    if (Number.isNaN(createdAt.getTime())) return;
    createdAt.setHours(0, 0, 0, 0);
    const bucket = byDay.get(createdAt.toISOString().slice(0, 10));
    if (!bucket) return;
    bucket.total += 1;
    if (event.kind === 'completed') bucket.completed += 1;
    if (event.kind === 'reopened') bucket.reopened += 1;
    if (event.kind === 'reset') bucket.reset += 1;
  });

  return {
    days,
    maxTotal: Math.max(1, ...days.map((day) => day.total)),
  };
}
