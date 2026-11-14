import { useEffect } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { pathTo } from "@/lib/catalog";
import useCatalog from "@/lib/useCatalog";

/**
 * Old links to a subcategory (Home, breadcrumbs, promotions) now open the main category's
 * aisle view at that subcategory / group / section.
 */
export default function SubcategoryRedirect() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const snap = useCatalog();

    useEffect(() => {
        if (!snap || !id) return;
        const path = pathTo(snap, id);
        const main = path[0];
        if (main) router.replace({ pathname: "/category/[id]", params: { id: main.id, sel: id } });
        else router.replace("/");
    }, [snap, id]);

    return <View style={{ flex: 1, backgroundColor: "#fff" }} />;
}
