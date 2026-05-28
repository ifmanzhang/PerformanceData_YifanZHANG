export function createLogExporter({ state, replaySourceLabel }) {
  return function exportLog() {
    const payload = {
      exportedAt: new Date().toISOString(),
      project: "睡眠基线控制台",
      dataSource: state.dataSource,
      replayMeta: state.replay.meta,
      replayStatus: replaySourceLabel(),
      stateLogs: state.stateLogs,
      voiceLogs: state.voiceLogs,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `guided-baseline-mvp-log-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };
}
