const DEMO_STATE_KEYS = [
  "recon_review_decisions_v1",
  "recon_imported_batches_v1",
  "recon_batch_counter_v1",
  "recon-inbox-filters-v1",
  "recon_recommendation_proposed_v1",
  "recon_recommendation_escalation_v1"
];

export const resetDemoState = () => {
  DEMO_STATE_KEYS.forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore storage errors to keep reset deterministic.
    }
  });
};
