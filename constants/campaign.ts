import { getAppConfig } from "@/lib/appConfig";

/** Christmas pre-order campaign (Home slide + app/christmas.tsx). Goal and end date: Admin › App settings. */
export const campaignGoal = () => Math.max(1, Number(getAppConfig().campaign.goal) || 10000);
export const campaignEnd = () => {
    const t = Date.parse(getAppConfig().campaign.endsAt);
    return Number.isFinite(t) ? t : Date.UTC(2026, 11, 25, 22, 59);
};
export const CAMPAIGN_FLYER = require("../assets/images/xmas-preorder.jpg");

export const campaignLive = () => Date.now() < campaignEnd();

/** Whole days left (0 on the last day). */
export const campaignDaysLeft = () => Math.max(0, Math.floor((campaignEnd() - Date.now()) / 86400000));
