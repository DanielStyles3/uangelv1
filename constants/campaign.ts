/** Christmas 2026 pre-order campaign (Home slide + app/christmas.tsx). Hidden after CAMPAIGN_END. */
export const CAMPAIGN_GOAL = 10000;
export const CAMPAIGN_END = Date.UTC(2026, 11, 15, 22, 59); // 15 Dec 2026, 23:59 Lagos time
export const CAMPAIGN_FLYER = require("../assets/images/xmas-preorder.jpg");

export const campaignLive = () => Date.now() < CAMPAIGN_END;

/** Whole days left (0 on the last day). */
export const campaignDaysLeft = () => Math.max(0, Math.floor((CAMPAIGN_END - Date.now()) / 86400000));
