import {View, Text, TouchableOpacity, ActivityIndicator} from 'react-native'
import React from 'react'
import {CustomButtonProps} from "@/type";
import cn from "clsx";

const CustomButton = ({
    onPress,
    title="Click Me",
    style,
    textStyle,
    leftIcon,
    isLoading = false
}: CustomButtonProps) => {
    return (
        // Disabled while loading so a slow request can't be submitted twice (e.g. double orders).
        <TouchableOpacity
            className={cn('custom-btn', style, isLoading && 'opacity-70')}
            onPress={onPress}
            disabled={isLoading}
        >
            {leftIcon}

            <View className="flex-center flex-row">
                {isLoading ? (
                    <ActivityIndicator size="small" color="white" />
                ): (
                    <Text className={cn('text-white-100 paragraph-semibold', textStyle)}>
                        {title}
                    </Text>
                )}
            </View>
        </TouchableOpacity>
    )
}
export default CustomButton
