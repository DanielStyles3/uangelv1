import { createContext, useContext } from 'react';

import type { AffiliateSummary } from './api';

type AffiliateContextValue = {
    /** Set inside the affiliate screens (the layout only shows them once joined). null = not joined. */
    summary: AffiliateSummary | null;
    /** Re-fetches affiliate_summary(); throws on failure so callers can show the message. */
    refresh: () => Promise<void>;
};

export const AffiliateContext = createContext<AffiliateContextValue>({
    summary: null,
    refresh: async () => {},
});

export const useAffiliate = () => useContext(AffiliateContext);
