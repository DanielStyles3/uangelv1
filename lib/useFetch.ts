import { useCallback, useEffect, useState } from "react";
import { Alert } from "react-native";

type Params = Record<string, string | number | undefined>;

interface UseFetchOptions<T, P extends Params> {
    fn: (params: P) => Promise<T>;
    params?: P;
    skip?: boolean;
}

interface UseFetchReturn<T, P> {
    data: T | null;
    loading: boolean;
    error: string | null;
    refetch: (newParams?: P) => Promise<void>;
}

const useFetch = <T, P extends Params>({
    fn,
    params = {} as P,
    skip = false,
}: UseFetchOptions<T, P>): UseFetchReturn<T, P> => {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(!skip);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(
        async (fetchParams: P) => {
            setLoading(true);
            setError(null);

            try {
                const result = await fn({ ...fetchParams });
                setData(result);
            } catch (err: unknown) {
                const errorMessage =
                    err instanceof Error ? err.message : "An unknown error occurred";
                setError(errorMessage);
                Alert.alert("Error", errorMessage);
            } finally {
                setLoading(false);
            }
        },
        [fn]
    );

    // Re-run whenever the params change by value (so callers don't need their own effect).
    const paramsKey = JSON.stringify(params);

    useEffect(() => {
        if (!skip) fetchData(params);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [skip, paramsKey, fetchData]);

    const refetch = async (newParams?: P) => await fetchData(newParams ?? params);

    return { data, loading, error, refetch };
};

export default useFetch;
