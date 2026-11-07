import {View, Text, TextInput} from 'react-native'
import {CustomInputProps} from "@/type";
import {useState} from "react";
import cn from "clsx";

const CustomInput = ({
    placeholder = 'Enter text',
    value,
    onChangeText,
    label,
    secureTextEntry = false,
    keyboardType = "default",
    autoCapitalize = "none",
    multiline = false,
    editable = true,
}: CustomInputProps) => {
    const [isFocused, setIsFocused] = useState(false);

    return (
        <View className="w-full">
            <Text className="label">{label}</Text>

            <TextInput
                autoCapitalize={autoCapitalize}
                autoCorrect={false}
                value={value}
                onChangeText={onChangeText}
                secureTextEntry={secureTextEntry}
                keyboardType={keyboardType}
                multiline={multiline}
                editable={editable}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder={placeholder}
                placeholderTextColor="#888"
                textAlignVertical={multiline ? "top" : "center"}
                className={cn(
                    'input',
                    isFocused ? 'border-primary' : 'border-gray-300',
                    multiline && 'min-h-20',
                    !editable && 'opacity-60'
                )}
            />
        </View>
    )
}
export default CustomInput
