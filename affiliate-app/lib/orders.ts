import { CustomerOrder, getCustomerOrders } from './api';

// Small in-memory cache of each referred customer's orders, so the order detail screen can
// show straight away after the customer screen loaded them (and re-fetches when it can't).

const cache = new Map<string, CustomerOrder[]>();

export const cachedCustomerOrders = (customerId: string): CustomerOrder[] | undefined => cache.get(customerId);

export const loadCustomerOrders = async (customerId: string): Promise<CustomerOrder[]> => {
    const orders = await getCustomerOrders(customerId);
    cache.set(customerId, orders);
    return orders;
};

export const cachedOrder = (customerId: string, orderId: string): CustomerOrder | undefined =>
    cache.get(customerId)?.find((o) => o.order_id === orderId);

/** Forget everything (e.g. on sign-out) so another account never sees these. */
export const clearOrderCache = () => cache.clear();
